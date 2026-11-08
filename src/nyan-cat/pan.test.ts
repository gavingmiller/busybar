import { describe, it, expect, mock } from "bun:test";
import { startPan, PAN, type PanDeps } from "./pan.ts";

/** Lets the play-then-schedule promise chain settle. */
const flush = () => new Promise((r) => setTimeout(r, 0));
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
};

const EXCURSIONS = [
  { name: "exc_a", durationMs: 6_000 },
  { name: "exc_b", durationMs: 12_000 },
];
const LOOP_MS = 6_000;

function harness(random: () => number) {
  const played: Array<[string, boolean]> = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const cancelled: unknown[] = [];
  const deps: PanDeps = {
    excursions: EXCURSIONS,
    loopMs: LOOP_MS,
    play: mock(async (section: string, loop: boolean) => { played.push([section, loop]); }),
    random,
    schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    cancel: (id) => cancelled.push(id),
  };
  return { deps, played, timers, cancelled };
}

describe("startPan", () => {
  it("idles, queues a random excursion for the next loop boundary, then queues home once the excursion has surely begun", async () => {
    const { deps, played, timers } = harness(seq(0.5, 0.9));
    const handle = startPan(deps);
    await flush();
    // 1. idle at home (nothing played yet); the wait is random within PAN.idleMs
    expect(played).toEqual([]);
    expect(timers).toHaveLength(1);
    expect(timers[0]!.ms).toBe((PAN.idleMs[0] + PAN.idleMs[1]) / 2);

    // 2. the excursion is queued as a one-shot that starts on the home loop's boundary
    timers[0]!.fn();
    await flush();
    expect(played).toEqual([["exc_b", false]]);
    // 3. home can only be queued after the excursion has started (queue depth is one), i.e. a full loop plus margin later
    expect(timers).toHaveLength(2);
    expect(timers[1]!.ms).toBe(LOOP_MS + PAN.startMarginMs);
    timers[1]!.fn();
    await flush();
    expect(played).toEqual([["exc_b", false], ["home", true]]);
    // 4. then wait out the excursion itself before the next idle starts
    expect(timers).toHaveLength(3);
    expect(timers[2]!.ms).toBe(12_000);
    timers[2]!.fn();
    await flush();
    expect(timers).toHaveLength(4); // next idle
    expect(timers[3]!.ms).toBeGreaterThanOrEqual(PAN.idleMs[0]);
    handle.stop();
  });

  it("picks excursions by the random source and keeps cycling", async () => {
    const { deps, played, timers } = harness(seq(0, 0, 0, 0.99, 0, 0));
    const handle = startPan(deps);
    await flush();
    for (let i = 0; i < 6; i++) { timers[i]!.fn(); await flush(); }
    expect(played.map(([s]) => s)).toEqual(["exc_a", "home", "exc_b", "home"]);
    handle.stop();
  });

  it("stop cancels the pending timer and ignores a stale one firing afterwards", async () => {
    const { deps, played, timers, cancelled } = harness(seq(0.5, 0.5));
    const handle = startPan(deps);
    await flush();
    handle.stop();
    expect(cancelled).toHaveLength(1);
    timers[0]!.fn();
    await flush();
    expect(played).toEqual([]);
    expect(timers).toHaveLength(1);
  });

  it("reports a failed play and carries on with the cycle", async () => {
    const errors: unknown[] = [];
    const { deps, timers } = harness(seq(0.5, 0.5));
    deps.play = mock(async () => { throw new Error("508"); });
    deps.onError = (e) => errors.push(e);
    const handle = startPan(deps);
    await flush();
    timers[0]!.fn();
    await flush();
    expect(errors).toHaveLength(1);
    expect(timers).toHaveLength(2);
    handle.stop();
  });
});
