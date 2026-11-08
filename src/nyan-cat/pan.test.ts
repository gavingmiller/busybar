import { describe, it, expect, mock } from "bun:test";
import { planPan, startPan, PAN, type PanStep } from "./pan.ts";

/** Lets the pan's draw-then-schedule promise chain settle. */
const flush = () => new Promise((r) => setTimeout(r, 0));

/** A random source that returns the given unit values in order (then repeats the last). */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
};

describe("planPan", () => {
  it("is one excursion: idle at home, drift left, hold, come back to home, with eased steps", () => {
    const steps = planPan(42, seq(0.5, 0.5, 0.5));
    expect(steps[0]).toEqual({ x: 42, waitMs: expect.any(Number) });
    const xs = steps.map((s) => s.x);
    expect(Math.min(...xs)).toBeLessThan(42);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(42 - PAN.maxDriftPx);
    expect(xs[xs.length - 1]).toBe(42);
    // Leaves home, reaches the far point, returns — never overshoots either side.
    for (const x of xs) {
      expect(x).toBeLessThanOrEqual(42);
      expect(x).toBeGreaterThanOrEqual(42 - PAN.maxDriftPx);
    }
    // Moves are smooth: every step is exactly one pixel; easing lives in the timing, not the distance.
    for (let i = 1; i < xs.length; i++) expect(Math.abs(xs[i]! - xs[i - 1]!)).toBe(1);
    // Eased: the first and last steps of the drift are slower than the middle one.
    const drift = steps.slice(1, 1 + (42 - Math.min(...xs)));
    const mid = drift[Math.floor(drift.length / 2)]!.waitMs;
    expect(drift[0]!.waitMs).toBeGreaterThan(mid);
    expect(drift[drift.length - 2]!.waitMs).toBeGreaterThan(mid);
  });

  it("the idle wait, drift distance and hold are random within their ranges", () => {
    const low = planPan(42, seq(0, 0, 0));
    const high = planPan(42, seq(1, 1, 1));
    expect(low[0]!.waitMs).toBe(PAN.idleMs[0]);
    expect(high[0]!.waitMs).toBe(PAN.idleMs[1]);
    expect(Math.min(...low.map((s) => s.x))).toBe(42 - PAN.driftPx[0]);
    expect(Math.min(...high.map((s) => s.x))).toBe(42 - PAN.driftPx[1]);
    const holdOf = (steps: PanStep[]) => {
      const far = Math.min(...steps.map((s) => s.x));
      return steps.filter((s) => s.x === far).reduce((sum, s) => sum + s.waitMs, 0);
    };
    expect(holdOf(low)).toBeLessThan(holdOf(high));
  });

  it("never sends faster than the device's request budget", () => {
    const steps = planPan(42, seq(0.3, 0.7, 0.2));
    for (const s of steps.slice(1)) expect(s.waitMs).toBeGreaterThanOrEqual(PAN.minStepMs);
  });
});

describe("startPan", () => {
  it("drives the cat element through the plan with the injected scheduler and stops cleanly", async () => {
    const sent: number[] = [];
    const timers: Array<{ fn: () => void; ms: number }> = [];
    const schedule = (fn: () => void, ms: number) => {
      timers.push({ fn, ms });
      return timers.length;
    };
    const cancelled: number[] = [];
    const draw = mock(async (x: number) => { sent.push(x); });

    const handle = startPan({
      homeX: 42,
      draw,
      random: seq(0.5, 0.5, 0.5),
      schedule,
      cancel: (id: number) => cancelled.push(id),
    });

    // Run the scheduler by hand: each timer fires the next step.
    await flush();
    for (let guard = 0; guard < 60; guard++) {
      const next = timers[guard];
      if (!next) break;
      next.fn();
      await flush();
    }
    // The first timer is the idle wait at home (no draw), then every step draws once.
    expect(sent.length).toBeGreaterThan(5);
    expect(sent[sent.length - 1]).toBeDefined();
    expect(Math.min(...sent)).toBeLessThan(42);
    expect(sent.every((x) => x <= 42 && x >= 42 - PAN.maxDriftPx)).toBe(true);

    handle.stop();
    expect(cancelled.length).toBe(1);
    // After stop, firing a stale timer does nothing.
    const before = sent.length;
    timers[timers.length - 1]!.fn();
    await flush();
    expect(sent.length).toBe(before);
  });

  it("keeps going with a fresh random plan after one excursion ends", async () => {
    const sent: number[] = [];
    const timers: Array<() => void> = [];
    const handle = startPan({
      homeX: 42,
      draw: async (x) => { sent.push(x); },
      random: seq(0.2, 0.9, 0.4, 0.8, 0.1, 0.6),
      schedule: (fn) => { timers.push(fn); return timers.length; },
      cancel: () => {},
    });
    const firstPlanLength = planPan(42, seq(0.2, 0.9, 0.4)).length;
    await flush();
    for (let i = 0; i < firstPlanLength + 3; i++) { timers[i]!(); await flush(); }
    // More timers were scheduled than one plan holds: a second excursion is under way.
    expect(timers.length).toBeGreaterThan(firstPlanLength + 1);
    handle.stop();
  });
});
