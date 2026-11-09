import { describe, it, expect } from "bun:test";
import {
  MUNCHERS_RUN, MUNCHERS_FPS, MUNCHERS_LOOP_S, MUNCHERS_FRAME_COUNT, GROUND_Y, STRIDE_PX,
  RUNS, runnerX, runnerFrame, runnerSprite, runnerRows, isDancing, runDuration, activeRuns, renderFrame, DANCE_FPS, type Run,
} from "./index.ts";
import { RUNNER_ART, CHICKEN, EMBER, BONEHEAD } from "./art.ts";
import { FRONT_WIDTH, FRONT_HEIGHT } from "../../lib/scene.ts";
import { encodeAnimFile } from "../../lib/anim-file.ts";

const px = (f: Uint8Array, x: number, y: number) => {
  const i = (y * FRONT_WIDTH + x) * 4;
  return [f[i], f[i + 1], f[i + 2], f[i + 3]];
};
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const duration = runDuration;

describe("MUNCHERS_RUN scene", () => {
  const frames = MUNCHERS_RUN.frames();

  it("is a full-display opaque loop of 120–240 s at 24 fps", () => {
    expect(MUNCHERS_RUN.id).toBe("munchers_run");
    expect(MUNCHERS_RUN.name).toBe("Munchers Run");
    expect(MUNCHERS_RUN.fps).toBe(MUNCHERS_FPS);
    expect(MUNCHERS_FPS).toBe(24);
    expect(MUNCHERS_LOOP_S).toBeGreaterThanOrEqual(120);
    expect(MUNCHERS_LOOP_S).toBeLessThanOrEqual(240);
    expect(frames).toHaveLength(MUNCHERS_FRAME_COUNT);
    expect(MUNCHERS_FRAME_COUNT).toBe(MUNCHERS_FPS * MUNCHERS_LOOP_S);
    for (const f of frames) {
      expect(f.length).toBe(FRONT_WIDTH * FRONT_HEIGHT * 4);
      for (let i = 3; i < f.length; i += 4) if (f[i] !== 255) throw new Error(`transparent pixel at byte ${i}`);
    }
  });

  it("loops seamlessly and deterministically: no run straddles the wrap, frame N equals frame 0", () => {
    for (const r of RUNS) {
      expect(r.start).toBeGreaterThanOrEqual(0);
      expect(r.start + duration(r)).toBeLessThanOrEqual(MUNCHERS_LOOP_S);
    }
    expect(renderFrame(MUNCHERS_FRAME_COUNT)).toEqual(frames[0]!);
    expect(renderFrame(11)).toEqual(frames[11]!);
    expect(MUNCHERS_RUN.frames()[500]).toEqual(frames[500]!);
  });

  it("has a fixed ground like Dino Run: the ground rows never change and are not blank", () => {
    expect(GROUND_Y).toBe(14);
    const groundOf = (f: Uint8Array) => Array.from(f.slice(GROUND_Y * FRONT_WIDTH * 4));
    const first = groundOf(frames[0]!);
    for (let i = 1; i < MUNCHERS_FRAME_COUNT; i += 97) expect(groundOf(frames[i]!)).toEqual(first);
    // Solid, no gaps (Gavin 2026-11-09: "the ground has breaks in it, make it solid").
    for (let x = 0; x < FRONT_WIDTH; x++) expect(px(frames[0]!, x, GROUND_Y).slice(0, 3).some((c) => c! > 0)).toBe(true);
    // Sky above the ground is black so the runners stand out.
    expect(px(frames[0]!, 0, 0)).toEqual([0, 0, 0, 255]);
  });

  it("runs every Number Munchers character and the chicken, both ways, at running speeds, standing on the ground", () => {
    for (const art of RUNNER_ART) expect(RUNS.some((r) => r.art === art)).toBe(true);
    expect(RUNS.some((r) => r.art === CHICKEN)).toBe(true);
    expect(RUNS.some((r) => r.dir > 0)).toBe(true);
    expect(RUNS.some((r) => r.dir < 0)).toBe(true);
    expect(RUNS.length).toBeGreaterThanOrEqual(20);
    for (const r of RUNS) {
      expect(r.speed).toBeGreaterThanOrEqual(8);
      expect(r.speed).toBeLessThanOrEqual(20);
      expect(r.art.frames[0]!.length).toBeLessThanOrEqual(12);
    }
  });

  it("brings runners in and out on a timer: never more than three at once, sometimes two or more, sometimes nobody", () => {
    let most = 0, empty = 0, crowd = 0;
    for (let t = 0; t < MUNCHERS_LOOP_S; t += 0.5) {
      const n = activeRuns(t).length;
      most = Math.max(most, n);
      if (n === 0) empty++;
      if (n >= 2) crowd++;
    }
    expect(most).toBeLessThanOrEqual(3);
    expect(empty).toBeGreaterThanOrEqual(10); // ≥ 5 s of empty ground per loop
    expect(crowd).toBeGreaterThanOrEqual(10);
  });

  it("every runner faces the way it runs: art faces right, left-runners are the mirror, the eye leads (Gavin 2026-11-08: fish swam backwards)", () => {
    for (const art of RUNNER_ART) {
      const w = art.frames[0]![0]!.length;
      for (const fr of art.frames) { expect(fr.length).toBe(art.frames[0]!.length); for (const row of fr) expect(row.length).toBe(w); }
      const [ex, ey] = art.eye;
      expect(ex).toBeGreaterThanOrEqual(Math.floor((w - 1) / 2));
      expect(art.frames[0]![ey]![ex]).not.toBe(".");
      expect(runnerSprite(art, -1, 0)).toEqual(runnerSprite(art, 1, 0).map((r) => r.split("").reverse().join("")));
      for (const ch of new Set(art.frames.flat().join("").replace(/\./g, ""))) expect(art.colors[ch]).toMatch(/^#[0-9A-F]{6}$/);
    }
    // Drawn: a run's x advances in its direction; its eye pixel is painted where the facing sprite puts it.
    for (const r of RUNS) {
      const t = r.start + 0.5;
      expect(Math.sign(runnerX(r, t + 0.1) - runnerX(r, t))).toBe(r.dir);
    }
    const r = RUNS.find((run) => run.dir > 0 && activeRuns(run.start + duration(run) / 2).length === 1)!;
    const t = r.start + duration(r) / 2;
    const i = Math.round(t * MUNCHERS_FPS);
    const frame = renderFrame(i);
    const sprite = runnerSprite(r.art, 1, runnerFrame(r, i / MUNCHERS_FPS));
    const x0 = Math.round(runnerX(r, i / MUNCHERS_FPS)), y0 = GROUND_Y - sprite.length;
    const [ex, ey] = r.art.eye;
    if (sprite[ey]![ex] !== ".") expect(px(frame, x0 + ex, y0 + ey)).toEqual(hex(r.art.colors[sprite[ey]![ex]!]!));
  });

  it("no runner looks back and forth: the eye keeps its column in every frame, bobbing at most two rows (Gavin 2026-11-09: the snail's eye shifted)", () => {
    // The chicken is traced from its GIF and its eye shares the outline colour, so it is exempt (its waddle is approved).
    for (const art of RUNNER_ART.filter((a) => a.name !== "Chicken")) {
      const [ex, ey] = art.eye;
      const letter = art.frames[0]![ey]![ex]!;
      expect(letter).not.toBe(".");
      for (const frame of art.frames) {
        let found = false;
        frame.forEach((r, y) => { for (let x = ex - 1; x <= ex + 1; x++) if (r[x] === letter && Math.abs(y - ey) <= 2) found = true; });
        expect(found).toBe(true);
      }
    }
  });

  it("Ember has no red outline: red belongs to the flame only (Gavin 2026-11-09: 'the red around fire guy is ridiculous')", () => {
    for (const frame of EMBER.frames) {
      // An outline is red hugging the grey body all the way round (~24 touching pixels); the flame's
      // tail dipping to body level touches it in at most a few places (5 in one frame).
      let touching = 0;
      frame.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch !== "R") return;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => frame[y + dy]?.[x + dx] === "K")) touching++;
      }));
      expect(touching).toBeLessThanOrEqual(6);
      expect(frame.join("")).toContain("R"); // the flame is still red
    }
    expect(EMBER.frames.length).toBeGreaterThanOrEqual(8); // the original run cycle (Gavin: "the old animation was much better")
    expect(EMBER.colors.K).not.toBe("#2B2B2B"); // but the body stays visible on black
  });

  it("legs keep pace: the run cycle advances one frame every STRIDE_PX of travel and cycles fully across the screen", () => {
    expect(STRIDE_PX).toBeGreaterThanOrEqual(2);
    expect(STRIDE_PX).toBeLessThanOrEqual(4);
    for (const r of RUNS.slice(0, 8)) {
      const seen = new Set<number>();
      for (let t = r.start; t < r.start + duration(r); t += 1 / MUNCHERS_FPS) seen.add(runnerFrame(r, t));
      expect(seen.size).toBe(r.art.frames.length);
      expect(runnerFrame(r, r.start + STRIDE_PX / r.speed + 1e-6)).toBe(1 % r.art.frames.length);
    }
  });

  it("the chicken's legs are orange; red is only its comb and wattle up top (Gavin 2026-11-09: a leg came out red)", () => {
    for (const frame of CHICKEN.frames) {
      const height = frame.length;
      // Legs and feet: the bottom three rows, below the white body.
      for (const row of frame.slice(height - 3)) expect(row).not.toContain("R");
      // Red lives only in the head rows.
      frame.forEach((row, y) => { if (y >= 4) expect(row).not.toContain("R"); });
      expect(frame.slice(0, 4).join("")).toContain("R");
    }
    expect(CHICKEN.colors.O).toMatch(/^#F/); // the orange, same key the beak uses
  });

  it("Bonehead stops to dance now and then (Gavin 2026-11-09): some of his runs pause on screen, the dance poses play, then he carries on; nobody else does", () => {
    const bone = RUNS.filter((r) => r.art === BONEHEAD);
    const dancing = bone.filter((r) => r.pause);
    expect(dancing.length).toBeGreaterThanOrEqual(1);
    expect(dancing.length).toBeLessThan(bone.length); // occasionally, not always
    for (const r of RUNS) if (r.art !== BONEHEAD) expect(r.pause).toBeUndefined();
    expect(DANCE_FPS).toBeGreaterThanOrEqual(3);
    for (const r of dancing) {
      const { at, duration: d } = r.pause!;
      expect(d).toBeGreaterThanOrEqual(2);
      expect(d).toBeLessThanOrEqual(5);
      expect(runDuration(r)).toBeCloseTo((FRONT_WIDTH + 10) / r.speed + d, 6);
      const t0 = r.start + at, t1 = t0 + d;
      // stands still, fully on screen, for the whole pause
      const x = runnerX(r, t0 + 0.01);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(FRONT_WIDTH - 10);
      for (let t = t0 + 0.01; t < t1; t += 0.25) {
        expect(runnerX(r, t)).toBeCloseTo(x, 6);
        expect(isDancing(r, t)).toBe(true);
        expect(BONEHEAD.dance!.map((f) => f.join("/"))).toContain(runnerRows(r, t).join("/"));
      }
      // the dance cycles through every pose
      const poses = new Set<string>();
      for (let t = t0 + 0.01; t < t1; t += 1 / MUNCHERS_FPS) poses.add(runnerRows(r, t).join("/"));
      expect(poses.size).toBe(BONEHEAD.dance!.length);
      // walking before and after, continuing in the same direction from the same spot
      expect(isDancing(r, t0 - 0.1)).toBe(false);
      expect(isDancing(r, t1 + 0.1)).toBe(false);
      expect(Math.sign(runnerX(r, t1 + 0.2) - runnerX(r, t1 + 0.1))).toBe(r.dir);
      expect(Math.abs(runnerX(r, t1 + 0.01) - x)).toBeLessThan(0.5);
      expect(BONEHEAD.frames.map((f) => f.join("/"))).toContain(runnerRows(r, t1 + 0.3).join("/"));
    }
    // and it shows: a dancing Bonehead is drawn with a dance pose
    const r = dancing[0]!;
    const t = r.start + r.pause!.at + 0.3;
    const i = Math.round(t * MUNCHERS_FPS);
    const rows = runnerRows(r, i / MUNCHERS_FPS), x0 = Math.round(runnerX(r, i / MUNCHERS_FPS)), y0 = GROUND_Y - rows.length;
    const frame = renderFrame(i);
    const others = activeRuns(i / MUNCHERS_FPS).filter((o) => o !== r);
    const overlapped = others.some((o) => Math.abs(runnerX(o, i / MUNCHERS_FPS) - x0) < 24);
    if (!overlapped) rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") expect(px(frame, x0 + x, y0 + y)).toEqual(hex(r.art.colors[ch]!)); }));
  });

  it("encodes under 25 MB", () => {
    const bytes = encodeAnimFile({ width: FRONT_WIDTH, height: FRONT_HEIGHT, fps: MUNCHERS_FPS, frames });
    expect(bytes.length).toBeLessThan(25 * 1024 * 1024);
  });
});
