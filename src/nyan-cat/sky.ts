// The full-display Nyan Cat scene: a star field scrolling right-to-left
// behind the (stationary) cat and its rainbow trail, so the cat reads as
// flying across the sky. Built as RGBA frames for one looping .anim asset,
// composited in software because the device can't layer elements with
// transparency (see nyanCatElements in sprite.ts).

import { Canvas } from "../lib/canvas.ts";
import { FRONT_DISPLAY_WIDTH, FRONT_DISPLAY_HEIGHT } from "../lib/display.ts";
import { CAT_FRAMES, NYAN_COLORS } from "./sprite-data.ts";
import { CAT_WIDTH, CAT_HEIGHT, CAT_FPS, TRAIL_FPS, CAT_TRAIL_OVERLAP, SCENE_FRAME_COUNT } from "./sprite.ts";
import { trailGrid, TRAIL_PERIOD } from "./trail.ts";

export const SKY_WIDTH = FRONT_DISPLAY_WIDTH;
export const SKY_HEIGHT = FRONT_DISPLAY_HEIGHT;
export const SKY_FPS = TRAIL_FPS;

/**
 * Frames in the loop: one seamless cat+trail cycle (SCENE_FRAME_COUNT, 96
 * today). It is also the width of the star strip, which scrolls one pixel
 * per frame, so the stars loop at the same moment. Must be at least the
 * display width or the strip would show a gap.
 */
export const SKY_FRAME_COUNT = SCENE_FRAME_COUNT;
if (SKY_FRAME_COUNT < SKY_WIDTH) throw new Error("sky: the loop is shorter than the display is wide; stars would gap");

/** Star colours: most are a soft white, a few dimmer and bluer for depth. */
export const STAR_COLORS: Record<string, string> = {
  "*": "#C8C8E0FF",
  "+": "#606890FF",
};

/** Star positions on the SKY_FRAME_COUNT-wide strip: [x, y, "*" bright | "+" dim]. */
export const STARS: ReadonlyArray<readonly [number, number, "*" | "+"]> = [
  [2, 1, "*"], [9, 13, "+"], [15, 4, "*"], [21, 10, "+"], [27, 0, "*"], [33, 7, "*"],
  [38, 14, "+"], [44, 3, "*"], [50, 11, "*"], [55, 6, "+"], [61, 1, "*"], [66, 9, "*"],
  [72, 13, "+"], [78, 5, "*"], [84, 10, "+"], [90, 2, "*"], [93, 8, "*"],
];

/** The star layer for frame `frame` as a SKY_WIDTH x SKY_HEIGHT ASCII grid, scrolled left one pixel per frame. */
export function starGrid(frame: number): string[] {
  const rows: string[][] = Array.from({ length: SKY_HEIGHT }, () => Array(SKY_WIDTH).fill("."));
  for (const [x0, y, ch] of STARS) {
    const x = (((x0 - frame) % SKY_FRAME_COUNT) + SKY_FRAME_COUNT) % SKY_FRAME_COUNT;
    if (x < SKY_WIDTH) rows[y]![x] = ch;
  }
  return rows.map((r) => r.join(""));
}

/** Sky showing to the right of the cat. */
const RIGHT_MARGIN = 4;

/** Where the cat's top-left sits on the display: near the right edge, vertically centred. */
export function skyCatOrigin(): { x: number; y: number } {
  return { x: SKY_WIDTH - CAT_WIDTH - RIGHT_MARGIN, y: Math.floor((SKY_HEIGHT - CAT_HEIGHT) / 2) };
}

/** The trail runs from the cat all the way off the left edge of the display. */
export function skyTrailLength(): number {
  return skyCatOrigin().x + CAT_TRAIL_OVERLAP;
}

/** Transparent background for a layer that the device composites over whatever is below it. */
const CLEAR = "#00000000";

/** The star field alone, SKY_WIDTH x SKY_HEIGHT with a transparent background, one frame per loop step. */
export function starLayerFrames(): Uint8Array[] {
  return Array.from({ length: SKY_FRAME_COUNT }, (_, i) => {
    const canvas = new Canvas(SKY_WIDTH, SKY_HEIGHT);
    canvas.paintGrid(starGrid(i), STAR_COLORS, 0, 0);
    return canvas.toRGBA(CLEAR);
  });
}

/** Trail length baked into the cat layer: a whole display width, so the trail still reaches the left edge when the cat drifts left. */
export const CAT_LAYER_TRAIL_LENGTH = SKY_WIDTH;
export const CAT_LAYER_WIDTH = CAT_LAYER_TRAIL_LENGTH - CAT_TRAIL_OVERLAP + CAT_WIDTH;

/** The cat and its trail alone, CAT_LAYER_WIDTH x CAT_HEIGHT with a transparent background, one frame per loop step. */
export function catLayerFrames(): Uint8Array[] {
  return Array.from({ length: SKY_FRAME_COUNT }, (_, i) => {
    const canvas = new Canvas(CAT_LAYER_WIDTH, CAT_HEIGHT);
    canvas.paintGrid(trailGrid(i % TRAIL_PERIOD, CAT_LAYER_TRAIL_LENGTH, CAT_HEIGHT), NYAN_COLORS, 0, 0);
    const catIndex = Math.floor((i * CAT_FPS) / TRAIL_FPS) % CAT_FRAMES.length;
    canvas.paintGrid(CAT_FRAMES[catIndex]!, NYAN_COLORS, CAT_LAYER_TRAIL_LENGTH - CAT_TRAIL_OVERLAP, 0);
    return canvas.toRGBA(CLEAR);
  });
}

/** One RGBA frame per loop step: stars, then the trail, then the cat on top (the single-asset preview of the same scene). */
export function skySceneFrames(trailLength: number = skyTrailLength()): Uint8Array[] {
  const { x: catX, y: catY } = skyCatOrigin();
  const frames: Uint8Array[] = [];
  for (let i = 0; i < SKY_FRAME_COUNT; i++) {
    const canvas = new Canvas(SKY_WIDTH, SKY_HEIGHT);
    canvas.paintGrid(starGrid(i), STAR_COLORS, 0, 0);
    canvas.paintGrid(trailGrid(i % TRAIL_PERIOD, trailLength, CAT_HEIGHT), NYAN_COLORS, catX - trailLength + CAT_TRAIL_OVERLAP, catY);
    const catIndex = Math.floor((i * CAT_FPS) / TRAIL_FPS) % CAT_FRAMES.length;
    canvas.paintGrid(CAT_FRAMES[catIndex]!, NYAN_COLORS, catX, catY);
    frames.push(canvas.toRGBA());
  }
  return frames;
}
