import { describe, it, expect } from "bun:test";
import { AQUARIUM, AQUARIUM_FPS, AQUARIUM_LOOP_S, AQUARIUM_FRAME_COUNT, FISH, BUBBLES, renderFrame, fishX, bubbleY, fishSprite } from "./index.ts";
import { FRONT_WIDTH, FRONT_HEIGHT } from "../../lib/scene.ts";
import { encodeAnimFile } from "../../lib/anim-file.ts";

const px = (f: Uint8Array, x: number, y: number) => {
  const i = (y * FRONT_WIDTH + x) * 4;
  return [f[i], f[i + 1], f[i + 2], f[i + 3]];
};

describe("AQUARIUM scene", () => {
  const frames = AQUARIUM.frames();

  it("is a full-display opaque loop of 10–120 s at 24–48 fps", () => {
    expect(AQUARIUM.id).toBe("aquarium");
    expect(AQUARIUM.name).toBe("Aquarium");
    expect(AQUARIUM.fps).toBe(AQUARIUM_FPS);
    expect(AQUARIUM_FPS).toBeGreaterThanOrEqual(24);
    expect(AQUARIUM_FPS).toBeLessThanOrEqual(48);
    expect(AQUARIUM_LOOP_S).toBeGreaterThanOrEqual(10);
    expect(AQUARIUM_LOOP_S).toBeLessThanOrEqual(120);
    expect(frames).toHaveLength(AQUARIUM_FRAME_COUNT);
    expect(AQUARIUM_FRAME_COUNT).toBe(AQUARIUM_FPS * AQUARIUM_LOOP_S);
    for (const f of frames) {
      expect(f.length).toBe(FRONT_WIDTH * FRONT_HEIGHT * 4);
      for (let i = 3; i < f.length; i += 4) if (f[i] !== 255) throw new Error(`transparent pixel at byte ${i}`);
    }
  });

  it("loops seamlessly: the frame after the last equals frame 0, and is deterministic", () => {
    expect(renderFrame(AQUARIUM_FRAME_COUNT)).toEqual(frames[0]!);
    expect(renderFrame(7)).toEqual(frames[7]!);
    expect(AQUARIUM.frames()[100]).toEqual(frames[100]!);
  });

  it("fish and bubbles each close on the loop", () => {
    for (const fish of FISH) expect(fishX(fish, AQUARIUM_LOOP_S)).toBeCloseTo(fishX(fish, 0), 6);
    for (const b of BUBBLES) expect(bubbleY(b, AQUARIUM_LOOP_S)).toBeCloseTo(bubbleY(b, 0), 6);
  });

  it("has at least three fish on screen in frame 0, swimming both ways", () => {
    const onScreen = FISH.filter((f) => { const x = fishX(f, 0); return x > -1 && x < FRONT_WIDTH - f.width + 1; });
    expect(onScreen.length).toBeGreaterThanOrEqual(3);
    expect(FISH.some((f) => f.dir > 0)).toBe(true);
    expect(FISH.some((f) => f.dir < 0)).toBe(true);
  });

  it("fish swim lazily: no fish faster than 2.5 px/s, big fish slower than small (Gavin 2026-11-08: they were entirely too fast)", () => {
    const speed = (f: typeof FISH[number]) => Math.abs(fishX(f, 1) - fishX(f, 0));
    for (const f of FISH) {
      expect(speed(f)).toBeLessThanOrEqual(2.5);
      expect(speed(f)).toBeGreaterThanOrEqual(0.5);
    }
    const big = FISH.filter((f) => f.size === 2), small = FISH.filter((f) => f.size === 1);
    if (big.length && small.length) expect(Math.max(...big.map(speed))).toBeLessThan(Math.min(...small.map(speed)));
    // Bubbles keep their original pace (2.75 px/s and up) rather than slowing with the fish.
    for (const b of BUBBLES) expect(Math.abs(bubbleY(b, 1) - bubbleY(b, 0))).toBeGreaterThanOrEqual(2.5);
  });

  it("each fish swims head first: tapered head leading, round body, forked tail trailing (Gavin 2026-11-08: they looked like they were swimming backwards)", () => {
    const lit = (col: string[]) => col.filter((c) => c !== ".").length;
    for (const f of FISH) {
      const rows = fishSprite(f);
      const w = rows[0]!.length;
      expect(w).toBe(f.width);
      const cols = Array.from({ length: w }, (_, x) => rows.map((r) => r[x]!));
      const lead = f.dir > 0 ? w - 1 : 0, trail = f.dir > 0 ? 0 : w - 1;
      // One eye, in the leading half.
      const eyeCols = cols.map((c, x) => (c.includes("E") ? x : -1)).filter((x) => x >= 0);
      expect(eyeCols).toHaveLength(1);
      expect(f.dir > 0 ? eyeCols[0]! >= w / 2 : eyeCols[0]! < w / 2).toBe(true);
      // Trailing column is a fork: lit top and bottom, dark in between.
      const tail = cols[trail]!;
      expect(tail[0]).not.toBe(".");
      expect(tail[tail.length - 1]).not.toBe(".");
      expect(tail.slice(1, -1).every((c) => c === ".")).toBe(true);
      // Body is the tallest part; the head tapers to fewer pixels than the body.
      const tallest = Math.max(...cols.map(lit));
      expect(tallest).toBe(rows.length);
      expect(lit(cols[lead]!)).toBeLessThan(tallest);
      expect(lit(cols[lead]!)).toBeGreaterThan(0);
      // Facing is a pure mirror of the same silhouette.
      const flipped = fishSprite({ ...f, dir: f.dir > 0 ? -1 : 1 });
      expect(flipped).toEqual(rows.map((r) => r.split("").reverse().join("")));
    }
  });

  it("fish move between frames and bubbles rise", () => {
    for (const f of FISH) {
      const d = fishX(f, 1 / AQUARIUM_FPS) - fishX(f, 0);
      if (Math.abs(d) < FRONT_WIDTH / 2) expect(Math.sign(d)).toBe(f.dir); // else it wrapped round the track this frame
      expect(Math.abs(fishX(f, 1) - fishX(f, 0))).toBeGreaterThan(0);
    }
    for (const b of BUBBLES) {
      const d = bubbleY(b, 1 / AQUARIUM_FPS) - bubbleY(b, 0);
      if (Math.abs(d) < FRONT_HEIGHT / 2) expect(d).toBeLessThan(0); // else it wrapped from the top back to the floor
    }
    expect(frames[0]).not.toEqual(frames[1]!);
  });

  it("has sand along the bottom rows and water above", () => {
    const sand = px(frames[0]!, 30, 15);
    const water = px(frames[0]!, 30, 0);
    expect(sand[0]).toBeGreaterThan(sand[2]!); // brown: red over blue
    expect(water[2]).toBeGreaterThan(water[0]!); // blue over red
  });

  it("encodes under 12 MB", () => {
    const bytes = encodeAnimFile({ width: FRONT_WIDTH, height: FRONT_HEIGHT, fps: AQUARIUM_FPS, frames });
    expect(bytes.length).toBeLessThan(12 * 1024 * 1024);
  });
});
