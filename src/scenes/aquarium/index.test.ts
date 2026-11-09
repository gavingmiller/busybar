import { describe, it, expect } from "bun:test";
import { AQUARIUM, AQUARIUM_FPS, AQUARIUM_LOOP_S, AQUARIUM_FRAME_COUNT, FISH, BUBBLES, renderFrame, fishX, fishFacing, fishSpeed, fishSlotS, fishSprite, bubbleY, TURNAROUND_CHANCE } from "./index.ts";
import { FRONT_WIDTH, FRONT_HEIGHT } from "../../lib/scene.ts";
import { encodeAnimFile } from "../../lib/anim-file.ts";

const px = (f: Uint8Array, x: number, y: number) => {
  const i = (y * FRONT_WIDTH + x) * 4;
  return [f[i], f[i + 1], f[i + 2], f[i + 3]];
};

describe("AQUARIUM scene", () => {
  const frames = AQUARIUM.frames();

  it("is a full-display opaque loop of 10–300 s at 24–48 fps", () => {
    expect(AQUARIUM.id).toBe("aquarium");
    expect(AQUARIUM.name).toBe("Aquarium");
    expect(AQUARIUM.fps).toBe(AQUARIUM_FPS);
    expect(AQUARIUM_FPS).toBeGreaterThanOrEqual(24);
    expect(AQUARIUM_FPS).toBeLessThanOrEqual(48);
    expect(AQUARIUM_LOOP_S).toBeGreaterThanOrEqual(10);
    expect(AQUARIUM_LOOP_S).toBeLessThanOrEqual(300);
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

  it("fish swim lazily: cruise speeds 0.5–2.5 px/s, bigger fish slower (Gavin 2026-11-08: they were entirely too fast)", () => {
    const by = (size: number) => FISH.filter((f) => f.size === size).map(fishSpeed);
    for (const f of FISH) {
      expect(fishSpeed(f)).toBeLessThanOrEqual(2.5);
      expect(fishSpeed(f)).toBeGreaterThanOrEqual(0.5);
    }
    expect(Math.max(...by(3))).toBeLessThan(Math.min(...by(2)));
    expect(Math.max(...by(2))).toBeLessThan(Math.min(...by(1)));
    // No frame-to-frame step exceeds the cap (except the off-screen wrap back to the entry side).
    for (const f of FISH) for (let t = 0; t < AQUARIUM_LOOP_S; t += 1) {
      const d = Math.abs(fishX(f, t + 1) - fishX(f, t));
      if (d < FRONT_WIDTH / 2) expect(d).toBeLessThanOrEqual(2.5 * 1.1 + 1e-6);
    }
    // Bubbles keep their original pace (2.75 px/s and up) rather than slowing with the fish.
    for (const b of BUBBLES) expect(Math.abs(bubbleY(b, 1) - bubbleY(b, 0))).toBeGreaterThanOrEqual(2.5);
  });

  it("comes in three sizes: a school of small fish, a few medium, and exactly one large (Gavin 2026-11-08)", () => {
    const small = FISH.filter((f) => f.size === 1), medium = FISH.filter((f) => f.size === 2), large = FISH.filter((f) => f.size === 3);
    expect(small.length).toBeGreaterThanOrEqual(4);
    expect(medium.length).toBeGreaterThanOrEqual(2);
    expect(small.length).toBeGreaterThan(medium.length);
    expect(large).toHaveLength(1);
    expect(fishSprite(small[0]!, 1)[0]!.length).toBeLessThan(fishSprite(medium[0]!, 1)[0]!.length);
    expect(fishSprite(medium[0]!, 1)[0]!.length).toBeLessThan(fishSprite(large[0]!, 1)[0]!.length);
  });

  it("the large fish is a rare visitor: on screen for under a third of the loop, in one visit", () => {
    const big = FISH.find((f) => f.size === 3)!;
    const visible = (t: number) => { const x = fishX(big, t); return x > -big.width && x < FRONT_WIDTH; };
    let seconds = 0, visits = 0, was = visible(AQUARIUM_LOOP_S - 1);
    for (let t = 0; t < AQUARIUM_LOOP_S; t++) {
      const is = visible(t);
      if (is) seconds++;
      if (is && !was) visits++;
      was = is;
    }
    expect(seconds / AQUARIUM_LOOP_S).toBeLessThan(1 / 3);
    expect(seconds).toBeGreaterThan(20);
    expect(visits).toBe(1);
  });

  it("about one crossing in ten turns around mid-tank and goes back where it came from (Gavin 2026-11-08)", () => {
    expect(TURNAROUND_CHANCE).toBe(0.1);
    const slots = FISH.reduce((n, f) => n + f.turns.length, 0);
    const turns = FISH.reduce((n, f) => n + f.turns.filter((k) => k !== null).length, 0);
    expect(slots).toBeGreaterThanOrEqual(30);
    expect(turns).toBeGreaterThanOrEqual(1);
    expect(turns / slots).toBeLessThanOrEqual(0.25);
    for (const f of FISH) f.turns.forEach((turn, k) => {
      if (turn === null) return;
      // Walk the slot: it starts off-screen on the entry side, faces dir on the way in, flips exactly
      // once, never reaches the far side, and ends off-screen on the entry side again.
      const slot = fishSlotS(f), start = k * slot - f.phaseS;
      const t0 = ((start % AQUARIUM_LOOP_S) + AQUARIUM_LOOP_S) % AQUARIUM_LOOP_S;
      const entryEdge = (x: number) => (f.dir > 0 ? x + f.width <= 0 : x >= FRONT_WIDTH);
      const farEdge = (x: number) => (f.dir > 0 ? x + f.width > FRONT_WIDTH : x < 0);
      expect(entryEdge(fishX(f, t0))).toBe(true);
      let flips = 0, facing = f.dir;
      for (let s = 0; s < slot; s += 0.25) {
        const now = fishFacing(f, t0 + s);
        if (now !== facing) { flips++; facing = now; }
        expect(farEdge(fishX(f, t0 + s))).toBe(false);
      }
      expect(flips).toBe(1);
      expect(facing).toBe(-f.dir);
      expect(entryEdge(fishX(f, t0 + slot - 1e-6))).toBe(true);
    });
  });

  it("a fish always faces the way it is moving, including after a turnaround", () => {
    const dt = 1 / AQUARIUM_FPS;
    for (const f of FISH) for (let t = 0; t < AQUARIUM_LOOP_S; t += 0.5) {
      const d = fishX(f, t + dt) - fishX(f, t);
      if (fishFacing(f, t + dt) !== fishFacing(f, t)) continue; // the frame it turns on
      if (Math.abs(d) < FRONT_WIDTH / 2 && d !== 0) expect(Math.sign(d)).toBe(fishFacing(f, t));
    }
  });

  it("each fish swims head first: tapered head leading, round body, forked tail trailing (Gavin 2026-11-08: they looked like they were swimming backwards)", () => {
    const lit = (col: string[]) => col.filter((c) => c !== ".").length;
    for (const f of FISH) {
      const rows = fishSprite(f, f.dir);
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
      const flipped = fishSprite(f, f.dir > 0 ? -1 : 1);
      expect(flipped).toEqual(rows.map((r) => r.split("").reverse().join("")));
    }
  });

  it("fish move between frames and bubbles rise", () => {
    for (const f of FISH) {
      const d = fishX(f, 1 / AQUARIUM_FPS) - fishX(f, 0);
      if (Math.abs(d) < FRONT_WIDTH / 2) expect(Math.sign(d)).toBe(fishFacing(f, 0)); // else it wrapped round the track this frame
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

  it("encodes under 30 MB (a 4-minute loop so the large fish can stay away most of the time)", () => {
    const bytes = encodeAnimFile({ width: FRONT_WIDTH, height: FRONT_HEIGHT, fps: AQUARIUM_FPS, frames });
    expect(bytes.length).toBeLessThan(30 * 1024 * 1024);
  });
});
