import { describe, it, expect } from "bun:test";
import { skySceneFrames, skyCatOrigin, SKY_WIDTH, SKY_HEIGHT, SKY_FRAME_COUNT, SKY_FPS, STARS, starGrid } from "./sky.ts";
import { CAT_FRAMES } from "./sprite-data.ts";
import { CAT_FPS, TRAIL_FPS, CAT_HEIGHT } from "./sprite.ts";
import { TRAIL_PERIOD } from "./trail.ts";

const px = (frame: Uint8Array, x: number, y: number) => {
  const i = (y * SKY_WIDTH + x) * 4;
  return [frame[i], frame[i + 1], frame[i + 2], frame[i + 3]];
};
const BLACK = [0, 0, 0, 255];

describe("skySceneFrames", () => {
  const frames = skySceneFrames();

  it("fills the whole front display, one frame per loop step, at the trail's cadence", () => {
    expect(SKY_WIDTH).toBe(72);
    expect(SKY_HEIGHT).toBe(16);
    expect(SKY_FPS).toBe(TRAIL_FPS);
    expect(frames).toHaveLength(SKY_FRAME_COUNT);
    for (const f of frames) expect(f.length).toBe(SKY_WIDTH * SKY_HEIGHT * 4);
  });

  it("loops seamlessly: the frame count is a multiple of the trail period, the cat cycle and the star strip", () => {
    expect(SKY_FRAME_COUNT % TRAIL_PERIOD).toBe(0);
    // Cat pose = floor(i * CAT_FPS / TRAIL_FPS) % CAT_FRAMES.length must be back at 0 on frame SKY_FRAME_COUNT.
    expect(((SKY_FRAME_COUNT * CAT_FPS) / TRAIL_FPS) % CAT_FRAMES.length).toBe(0);
    expect(Number.isInteger((SKY_FRAME_COUNT * CAT_FPS) / TRAIL_FPS)).toBe(true);
    // Stars scroll one pixel per frame around a strip as wide as the loop.
    expect(starGrid(SKY_FRAME_COUNT)).toEqual(starGrid(0));
  });

  it("the cat is drawn at a fixed spot and fits inside the display", () => {
    expect(CAT_HEIGHT).toBeLessThanOrEqual(SKY_HEIGHT - 2);
    const catColour = px(frames[0]!, 50, 8); // inside the cat's body on the right half
    expect(catColour).not.toEqual(BLACK);
  });

  it("the rainbow trail runs off the left edge of the display instead of stopping mid-screen", () => {
    const { y } = skyCatOrigin();
    // Every band row at column 0 is painted on every frame (the wave only moves it ±1 row).
    for (const i of [0, 7, 40, 95]) {
      const litRows = Array.from({ length: SKY_HEIGHT }, (_, row) => row).filter((row) => px(frames[i]!, 0, row).join() !== BLACK.join());
      expect(litRows.length).toBeGreaterThanOrEqual(CAT_HEIGHT - 2);
      expect(Math.min(...litRows)).toBeGreaterThanOrEqual(y);
    }
  });

  it("stars sit behind the scene and scroll left one pixel per frame", () => {
    expect(STARS.length).toBeGreaterThanOrEqual(10);
    const g0 = starGrid(0);
    const g1 = starGrid(1);
    expect(g0).toHaveLength(SKY_HEIGHT);
    for (let y = 0; y < SKY_HEIGHT; y++) expect(g1[y]!.slice(0, SKY_WIDTH - 1)).toBe(g0[y]!.slice(1));
    // The star layer is painted first, so a star under the cat is hidden: no star
    // character survives where frame 0 has cat/trail pixels.
    const lit = g0.flatMap((row, y) => [...row].map((ch, x) => ({ ch, x, y }))).filter((p) => p.ch !== ".");
    expect(lit.length).toBeGreaterThan(0);
    for (const p of lit) {
      const colour = px(frames[0]!, p.x, p.y);
      expect(colour).not.toEqual(BLACK);
    }
  });

  it("consecutive frames differ and frame 0 is reached again only after the full loop", () => {
    expect(frames[0]).not.toEqual(frames[1]);
    expect(frames[0]).not.toEqual(frames[TRAIL_PERIOD]!);
  });
});
