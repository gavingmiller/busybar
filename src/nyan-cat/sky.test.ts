import { describe, it, expect } from "bun:test";
import {
  skySceneFrames, skyCatOrigin, starLayerFrames, starPositions, STARS, STAR_COLORS,
  SKY_WIDTH, SKY_HEIGHT, SKY_FRAME_COUNT, SKY_FPS, STAR_SPEED_PX_PER_S, STAR_FRAMES_PER_PX, STAR_STRIP_WIDTH,
} from "./sky.ts";
import { CAT_FRAMES } from "./sprite-data.ts";
import { CAT_FPS, TRAIL_FPS, CAT_HEIGHT } from "./sprite.ts";
import { TRAIL_PERIOD } from "./trail.ts";

const px = (frame: Uint8Array, x: number, y: number, width = SKY_WIDTH) => {
  const i = (y * width + x) * 4;
  return [frame[i], frame[i + 1], frame[i + 2], frame[i + 3]];
};
const BLACK = [0, 0, 0, 255];
const CLEAR = [0, 0, 0, 0];

describe("skySceneFrames", () => {
  const frames = skySceneFrames();

  it("fills the whole front display, one frame per loop step, at the device's fast native cadence", () => {
    expect(SKY_WIDTH).toBe(72);
    expect(SKY_HEIGHT).toBe(16);
    expect(SKY_FPS).toBe(TRAIL_FPS);
    expect(SKY_FPS).toBe(48);
    expect(frames).toHaveLength(SKY_FRAME_COUNT);
    for (const f of frames) expect(f.length).toBe(SKY_WIDTH * SKY_HEIGHT * 4);
  });

  it("keeps the loop short enough that the two layer assets stay small", () => {
    expect(SKY_FRAME_COUNT / SKY_FPS).toBeLessThanOrEqual(10);
    expect(SKY_FRAME_COUNT).toBeLessThanOrEqual(500);
  });

  it("loops seamlessly: the frame count closes the trail period, the cat cycle and the star strip", () => {
    expect(SKY_FRAME_COUNT % TRAIL_PERIOD).toBe(0);
    // Cat pose = floor(i * CAT_FPS / TRAIL_FPS) % CAT_FRAMES.length must be back at 0 on frame SKY_FRAME_COUNT.
    expect(((SKY_FRAME_COUNT * CAT_FPS) / TRAIL_FPS) % CAT_FRAMES.length).toBe(0);
    expect(Number.isInteger((SKY_FRAME_COUNT * CAT_FPS) / TRAIL_FPS)).toBe(true);
    // Stars: the strip has scrolled past a whole number of times.
    expect(SKY_FRAME_COUNT % (STAR_STRIP_WIDTH * STAR_FRAMES_PER_PX)).toBe(0);
    expect(starPositions(SKY_FRAME_COUNT)).toEqual(starPositions(0));
    expect(frames[0]).not.toEqual(frames[TRAIL_PERIOD]!);
  });

  it("the cat is drawn at a fixed spot and fits inside the display", () => {
    expect(CAT_HEIGHT).toBeLessThanOrEqual(SKY_HEIGHT - 2);
    const catColour = px(frames[0]!, 50, 8); // inside the cat's body on the right half
    expect(catColour).not.toEqual(BLACK);
  });

  it("the rainbow trail runs off the left edge of the display instead of stopping mid-screen", () => {
    const { y } = skyCatOrigin();
    for (const i of [0, 7, 40, SKY_FRAME_COUNT - 1]) {
      // Rows level with the cat that are painted at column 0 (stars above/below the band don't count).
      const litRows = Array.from({ length: CAT_HEIGHT }, (_, r) => y + r).filter((row) => px(frames[i]!, 0, row).join() !== BLACK.join());
      expect(litRows.length).toBeGreaterThanOrEqual(CAT_HEIGHT - 2);
    }
  });

  it("stars are painted first, so the cat and trail cover them", () => {
    const lit = starPositions(0).filter((s) => s.x < SKY_WIDTH - 1);
    expect(lit.length).toBeGreaterThan(0);
    for (const s of lit) expect(px(frames[0]!, Math.floor(s.x), s.y)).not.toEqual(BLACK);
  });

  it("consecutive frames differ", () => {
    expect(frames[0]).not.toEqual(frames[1]);
  });
});

describe("stars", () => {
  it("drift right-to-left at 16 px/s: one pixel every STAR_FRAMES_PER_PX frames, as a fraction in between", () => {
    expect(STARS.length).toBeGreaterThanOrEqual(10);
    expect(STAR_SPEED_PX_PER_S).toBe(16);
    expect(STAR_FRAMES_PER_PX).toBe(SKY_FPS / STAR_SPEED_PX_PER_S);
    expect(STAR_STRIP_WIDTH).toBeGreaterThanOrEqual(SKY_WIDTH);
    const p0 = starPositions(0);
    const p1 = starPositions(1);
    const p3 = starPositions(STAR_FRAMES_PER_PX);
    p0.forEach((s, k) => {
      expect(p1[k]!.y).toBe(s.y);
      expect(((s.x - p1[k]!.x) % STAR_STRIP_WIDTH + STAR_STRIP_WIDTH) % STAR_STRIP_WIDTH).toBeCloseTo(1 / STAR_FRAMES_PER_PX, 6);
      expect(((s.x - p3[k]!.x) % STAR_STRIP_WIDTH + STAR_STRIP_WIDTH) % STAR_STRIP_WIDTH).toBeCloseTo(1, 6);
    });
  });

  it("renders sub-pixel positions as two neighbouring pixels sharing the star's brightness", () => {
    const layer = starLayerFrames();
    const [x0, y, ch] = STARS[0]!; // whole-pixel at frame 0
    const full = STAR_COLORS[ch]!;
    const fullRed = parseInt(full.slice(1, 3), 16);
    // Frame 0: exactly on a pixel — one column, full brightness, alpha opaque; neighbours clear.
    expect(px(layer[0]!, x0, y)).toEqual([fullRed, parseInt(full.slice(3, 5), 16), parseInt(full.slice(5, 7), 16), 255]);
    expect(px(layer[0]!, x0 - 1, y)).toEqual(CLEAR);
    expect(px(layer[0]!, x0 + 1, y)).toEqual(CLEAR);
    // Frame 1: moved 1/3 px left — the left neighbour takes 1/3 of the light, the home pixel keeps 2/3.
    const left = px(layer[1]!, x0 - 1, y);
    const home = px(layer[1]!, x0, y);
    expect(left[3]).toBe(255);
    expect(home[3]).toBe(255);
    expect(left[0]! / fullRed).toBeCloseTo(1 / 3, 1);
    expect(home[0]! / fullRed).toBeCloseTo(2 / 3, 1);
    expect(left[0]! + home[0]!).toBeGreaterThanOrEqual(fullRed - 1);
    expect(left[0]! + home[0]!).toBeLessThanOrEqual(fullRed + 1);
    // Everything that isn't a star stays transparent.
    expect(px(layer[1]!, x0 + 1, y)).toEqual(CLEAR);
    expect(px(layer[1]!, x0, y + 1)).toEqual(CLEAR);
  });

  it("the star layer is transparent except for stars and never paints over where a star isn't", () => {
    const layer = starLayerFrames();
    for (const i of [0, 1, 2, 100]) {
      let lit = 0;
      for (let y = 0; y < SKY_HEIGHT; y++) for (let x = 0; x < SKY_WIDTH; x++) {
        const p = px(layer[i]!, x, y);
        if (p[3] !== 0) lit++;
        else expect(p).toEqual(CLEAR);
      }
      // Each visible star lights at most two columns.
      expect(lit).toBeLessThanOrEqual(STARS.length * 2);
      expect(lit).toBeGreaterThan(0);
    }
  });
});
