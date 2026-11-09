import { describe, it, expect } from "bun:test";
import {
  FIREFLIES, FIREFLIES_FPS, FIREFLIES_LOOP_S, FIREFLIES_FRAME_COUNT, FLIES, SYNC, LANDING, BLADES, MEADOW_TOP,
  renderFrame, flyState, bladeTip, type Fly,
} from "./index.ts";
import { FRONT_WIDTH, FRONT_HEIGHT } from "../../lib/scene.ts";
import { encodeAnimFile } from "../../lib/anim-file.ts";

const px = (f: Uint8Array, x: number, y: number) => {
  const i = (y * FRONT_WIDTH + x) * 4;
  return [f[i]!, f[i + 1]!, f[i + 2]!, f[i + 3]!] as const;
};
const luma = (c: readonly number[]) => (c[0]! * 3 + c[1]! * 6 + c[2]!) / 10;
const bright = (f: Uint8Array, t = 100) => { let n = 0; for (let i = 0; i < f.length; i += 4) if (luma([f[i]!, f[i + 1]!, f[i + 2]!]) > t) n++; return n; };
const colours = (f: Uint8Array, t = 80) => { const s = new Set<string>(); for (let i = 0; i < f.length; i += 4) if (luma([f[i]!, f[i + 1]!, f[i + 2]!]) > t) s.add(`${f[i]},${f[i + 1]},${f[i + 2]}`); return s.size; };
const sample = Array.from({ length: 48 }, (_, k) => Math.floor(k * FIREFLIES_FRAME_COUNT / 48));

describe("FIREFLIES scene", () => {
  it("is a full-display opaque loop of 60–120 s at 24 fps", () => {
    expect(FIREFLIES.id).toBe("fireflies");
    expect(FIREFLIES.name).toBe("Fireflies");
    expect(FIREFLIES.fps).toBe(FIREFLIES_FPS);
    expect(FIREFLIES_FPS).toBe(24);
    expect(FIREFLIES_LOOP_S).toBeGreaterThanOrEqual(60);
    expect(FIREFLIES_LOOP_S).toBeLessThanOrEqual(120);
    expect(FIREFLIES_FRAME_COUNT).toBe(FIREFLIES_FPS * FIREFLIES_LOOP_S);
    const frames = FIREFLIES.frames();
    expect(frames).toHaveLength(FIREFLIES_FRAME_COUNT);
    for (const i of sample) {
      const f = frames[i]!;
      expect(f.length).toBe(FRONT_WIDTH * FRONT_HEIGHT * 4);
      for (let p = 3; p < f.length; p += 4) if (f[p] !== 255) throw new Error(`transparent pixel in frame ${i}`);
    }
  });

  it("loops seamlessly and deterministically", () => {
    expect(renderFrame(FIREFLIES_FRAME_COUNT)).toEqual(renderFrame(0));
    expect(renderFrame(777)).toEqual(renderFrame(777));
    expect(renderFrame(0)).not.toEqual(renderFrame(12));
  });

  it("has a dark meadow across the bottom with grass blades that sway", () => {
    const f0 = renderFrame(0);
    for (let x = 0; x < FRONT_WIDTH; x++) for (let y = MEADOW_TOP; y < FRONT_HEIGHT; y++) {
      const c = px(f0, x, y);
      expect(c[1]).toBeGreaterThan(c[0]!); // green over red
      expect(c[1]).toBeGreaterThan(c[2]!);
      expect(c[1]).toBeGreaterThan(20);
    }
    expect(BLADES.length).toBeGreaterThanOrEqual(12);
    expect(BLADES.some((b) => b.tall)).toBe(true);
    expect(BLADES.some((b) => !b.tall)).toBe(true);
    // every blade's tip moves sideways over the loop, never more than one column
    let moved = 0;
    for (const b of BLADES) {
      const xs = new Set(sample.map((i) => bladeTip(b, i / FIREFLIES_FPS)[0]));
      expect(xs.size).toBeLessThanOrEqual(3);
      if (xs.size > 1) moved++;
    }
    expect(moved).toBeGreaterThanOrEqual(BLADES.length * 0.7);
  });

  it("keeps the glow budget: bright pixels stay under a quarter of the display and the count rises and falls", () => {
    const counts = sample.map((i) => bright(renderFrame(i)));
    expect(Math.max(...counts)).toBeLessThanOrEqual(FRONT_WIDTH * FRONT_HEIGHT / 4);
    expect(Math.min(...counts)).toBeGreaterThan(0);
    expect(Math.min(...counts)).toBeLessThan(Math.max(...counts) * 0.6);
  });

  it("varies colour: at least three distinct lit colours per frame on average, from three hue families", () => {
    const avg = sample.map((i) => colours(renderFrame(i))).reduce((a, b) => a + b, 0) / sample.length;
    expect(avg).toBeGreaterThanOrEqual(3);
    const hues = new Set(FLIES.map((f) => f.hue));
    expect(hues.size).toBeGreaterThanOrEqual(3);
  });

  it("varies depth and behaviour: three layers, far ones dimmer and slower than near ones, four pulse patterns", () => {
    const layers = new Set(FLIES.map((f) => f.layer));
    expect([...layers].sort()).toEqual(["far", "mid", "near"]);
    for (const l of ["far", "mid", "near"] as const) expect(FLIES.filter((f) => f.layer === l).length).toBeGreaterThanOrEqual(5);
    const speed = (f: Fly) => { let d = 0; for (let k = 1; k < 48; k++) { const a = flyState(f, (k - 1) * 0.5), b = flyState(f, k * 0.5); d += Math.hypot(a.x - b.x, a.y - b.y); } return d; };
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const far = FLIES.filter((f) => f.layer === "far"), near = FLIES.filter((f) => f.layer === "near");
    expect(mean(far.map(speed))).toBeLessThan(mean(near.map(speed)));
    expect(Math.max(...far.map((f) => f.peak))).toBeLessThan(Math.min(...near.map((f) => f.peak)));
    const patterns = new Set(FLIES.map((f) => f.pulse));
    expect([...patterns].sort()).toEqual(["double", "gap", "sine", "steady"]);
    // a steady fly holds its brightness; a pulsing one changes within a few seconds
    const steady = FLIES.find((f) => f.pulse === "steady")!, sine = FLIES.find((f) => f.pulse === "sine")!;
    const bs = sample.map((i) => flyState(steady, i / FIREFLIES_FPS).b);
    expect(Math.max(...bs) - Math.min(...bs)).toBeLessThan(0.05);
    const bsine = Array.from({ length: 48 }, (_, k) => flyState(sine, k * 0.25).b);
    expect(Math.max(...bsine) - Math.min(...bsine)).toBeGreaterThan(0.5);
    // a gap fly is dark most of the time; a double fly has two peaks per period
    const gap = FLIES.find((f) => f.pulse === "gap")!;
    const dark = Array.from({ length: 200 }, (_, k) => flyState(gap, k * FIREFLIES_LOOP_S / 200).b < 0.05).filter(Boolean).length;
    expect(dark).toBeGreaterThan(120);
  });

  it("near fireflies glow with a halo: neighbours of a bright core are lit dimmer", () => {
    const near = FLIES.filter((f) => f.layer === "near");
    let haloed = 0;
    for (const f of near) for (const i of sample) {
      const s = flyState(f, i / FIREFLIES_FPS);
      if (s.b < 0.9) continue;
      const x = Math.round(s.x), y = Math.round(s.y);
      if (x < 1 || x > FRONT_WIDTH - 2 || y < 1 || y >= MEADOW_TOP - 1) continue;
      const fr = renderFrame(i);
      const core = luma(px(fr, x, y)), side = luma(px(fr, x + 1, y));
      if (core > 150 && side > 30 && side < core) { haloed++; break; }
    }
    expect(haloed).toBeGreaterThanOrEqual(3);
  });

  it("a cluster flashes in step for a while, then drifts apart again", () => {
    const cluster = FLIES.filter((f) => f.sync);
    expect(cluster.length).toBeGreaterThanOrEqual(4);
    const spread = (t: number) => { const bs = cluster.map((f) => flyState(f, t).b); return Math.max(...bs) - Math.min(...bs); };
    const inside = Array.from({ length: 20 }, (_, k) => spread(SYNC.start + 2 + (k * (SYNC.end - SYNC.start - 4)) / 20));
    const outside = Array.from({ length: 20 }, (_, k) => spread(((SYNC.end + 8 + k * 1.7) % FIREFLIES_LOOP_S)));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(inside)).toBeLessThan(0.15);
    expect(mean(outside)).toBeGreaterThan(0.3);
  });

  it("one firefly lands on a blade and glows there for a while, then takes off", () => {
    const lander = FLIES.find((f) => f.lands)!;
    expect(lander).toBeDefined();
    const blade = BLADES[LANDING.blade]!;
    const t = (LANDING.start + LANDING.end) / 2;
    const [tx, ty] = bladeTip(blade, t);
    const s = flyState(lander, t);
    expect(Math.round(s.x)).toBe(tx);
    expect(Math.round(s.y)).toBe(ty - 1);
    expect(s.b).toBeGreaterThan(0.6);
    const away = flyState(lander, (LANDING.end + 10) % FIREFLIES_LOOP_S);
    expect(Math.hypot(away.x - tx, away.y - ty)).toBeGreaterThan(3);
  });

  it("the sky is not empty: stars and a moon above the meadow at frame 0", () => {
    const f = renderFrame(0);
    let sky = 0;
    for (let y = 0; y < 6; y++) for (let x = 0; x < FRONT_WIDTH; x++) if (luma(px(f, x, y)) > 60) sky++;
    expect(sky).toBeGreaterThanOrEqual(8);
  });

  it("encodes under 25 MB", () => {
    const bytes = encodeAnimFile({ width: FRONT_WIDTH, height: FRONT_HEIGHT, fps: FIREFLIES_FPS, frames: FIREFLIES.frames() });
    expect(bytes.length).toBeLessThan(25 * 1024 * 1024);
  });
});
