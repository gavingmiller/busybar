import { describe, it, expect } from "bun:test";
import {
  MUNCHERS_RUN, MUNCHERS_FPS, MUNCHERS_LOOP_S, MUNCHERS_FRAME_COUNT, GROUND_Y, STRIDE_PX,
  RUNS, runnerX, runnerFrame, runnerSprite, activeRuns, renderFrame, type Run,
} from "./index.ts";
import { RUNNER_ART, CHICKEN } from "./art.ts";
import { FRONT_WIDTH, FRONT_HEIGHT } from "../../lib/scene.ts";
import { encodeAnimFile } from "../../lib/anim-file.ts";

const px = (f: Uint8Array, x: number, y: number) => {
  const i = (y * FRONT_WIDTH + x) * 4;
  return [f[i], f[i + 1], f[i + 2], f[i + 3]];
};
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const duration = (r: Run) => (FRONT_WIDTH + r.art.frames[0]![0]!.length) / r.speed;

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
    const lit = [];
    for (let x = 0; x < FRONT_WIDTH; x++) if (px(frames[0]!, x, GROUND_Y).slice(0, 3).some((c) => c! > 0)) lit.push(x);
    expect(lit.length).toBeGreaterThan(FRONT_WIDTH / 2);
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
      const t = r.start + duration(r) / 2;
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

  it("encodes under 25 MB", () => {
    const bytes = encodeAnimFile({ width: FRONT_WIDTH, height: FRONT_HEIGHT, fps: MUNCHERS_FPS, frames });
    expect(bytes.length).toBeLessThan(25 * 1024 * 1024);
  });
});
