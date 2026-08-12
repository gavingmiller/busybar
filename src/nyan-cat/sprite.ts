import {
  type RectangleElement,
  type DisplayPayload,
  FRONT_DISPLAY_WIDTH,
  VERTICAL_SAFE_MARGIN,
  DRAW_PRIORITY,
  toDeviceColor,
} from "../lib/display.ts";
import { Canvas } from "../lib/canvas.ts";
import { NYAN_COLORS, CAT_GRID, TRAIL_FRAMES } from "./sprite-data.ts";

export type { RectangleElement, DisplayPayload };
export { FRONT_DISPLAY_WIDTH, VERTICAL_SAFE_MARGIN, DRAW_PRIORITY, toDeviceColor, NYAN_COLORS };

// Dimensions are derived from the hand-authored data (sprite-data.ts) rather
// than hardcoded, so editing the art (e.g. via the number-munchers viewer
// tool) can't silently desync from these constants.
export const CAT_WIDTH = CAT_GRID[0]!.length;
export const CAT_HEIGHT = CAT_GRID.length;
export const TRAIL_ANIM_HEIGHT = TRAIL_FRAMES[0]!.length;
export const DEFAULT_TRAIL_LENGTH = TRAIL_FRAMES[0]![0]!.length;
/**
 * Frames per second the trail loop plays at on the device — fixed at the
 * trail's 1px-per-frame scroll rate (16px/sec) rather than derived from
 * TRAIL_FRAMES.length, so the loop's scroll speed stays constant regardless
 * of how many frames the physical period needs (32, to cover a full lap of
 * the 2 desynced bumps — see the comment above TRAIL_FRAMES).
 */
export const TRAIL_FPS = 16;

/** Builds just the pop-tart body + head (no trail), anchored at (originX, originY). */
export function catElements(originX: number, originY: number): RectangleElement[] {
  const catCanvas = new Canvas(CAT_WIDTH, CAT_HEIGHT);
  catCanvas.paintGrid(CAT_GRID, NYAN_COLORS);
  return catCanvas.toElements("cat", originX, originY);
}

// The trail (TRAIL_ANIM_HEIGHT) is now exactly CAT_HEIGHT tall, so this is a
// no-op offset in practice — kept as a function (rather than inlining
// originY) in case the two heights diverge again after a hand-edit.
export function trailOriginY(originY: number): number {
  return originY + Math.floor((CAT_HEIGHT - TRAIL_ANIM_HEIGHT) / 2);
}

/**
 * Builds the Nyan Cat sprite (pop-tart body + head + a single static trail
 * frame) anchored so the cat's bounding box top-left sits at
 * (originX, originY). The trail extends `trailLength` px to the left, i.e.
 * it trails behind the cat when the cat moves rightward. Used by the
 * `stationary`/`flying` modes, which draw a single frame (or move the cat
 * as a whole via flyingOriginX) rather than animating the trail itself —
 * the animated trail is a separate native `.anim` asset, see
 * trailAnimationFrames below.
 */
export function nyanCatElements(
  originX: number,
  originY: number,
  trailLength: number = DEFAULT_TRAIL_LENGTH
): RectangleElement[] {
  const trailCanvas = new Canvas(trailLength, TRAIL_ANIM_HEIGHT);
  trailCanvas.paintGrid(TRAIL_FRAMES[0]!, NYAN_COLORS);

  return [
    ...trailCanvas.toElements("trail", originX - trailLength, trailOriginY(originY)),
    ...catElements(originX, originY),
  ];
}

/**
 * One RGBA frame per entry in TRAIL_FRAMES, for encoding the trail as a
 * native looping .anim asset. Each frame is `trailLength x
 * TRAIL_ANIM_HEIGHT` pixels (see Canvas.toRGBA). TRAIL_FRAMES is a static,
 * hand-editable data table (see sprite-data.ts) — there's no formula here
 * anymore, just rasterizing each stored frame.
 */
export function trailAnimationFrames(trailLength: number = DEFAULT_TRAIL_LENGTH): Uint8Array[] {
  return TRAIL_FRAMES.map((grid) => {
    const canvas = new Canvas(trailLength, TRAIL_ANIM_HEIGHT);
    canvas.paintGrid(grid, NYAN_COLORS);
    return canvas.toRGBA();
  });
}

export function nyanCatPayload(
  originX: number,
  originY: number,
  trailLength: number = DEFAULT_TRAIL_LENGTH
): DisplayPayload {
  return {
    application_name: "nyan_cat",
    elements: nyanCatElements(originX, originY, trailLength),
    priority: DRAW_PRIORITY,
  };
}

/** Centers the cat + trail scene horizontally on the front display. */
export function stationaryOriginX(trailLength: number = DEFAULT_TRAIL_LENGTH): number {
  const sceneWidth = trailLength + CAT_WIDTH;
  const leftMargin = Math.round((FRONT_DISPLAY_WIDTH - sceneWidth) / 2);
  return leftMargin + trailLength;
}

/**
 * Cat origin for `tick` frames into a rightward flight, looping seamlessly:
 * starts with the whole scene (trail included) fully off-screen left, exits
 * fully off-screen right, then wraps back to the start.
 */
export function flyingOriginX(
  tick: number,
  trailLength: number = DEFAULT_TRAIL_LENGTH,
  stepPx: number = 2
): number {
  const startX = -(trailLength + CAT_WIDTH);
  const range = FRONT_DISPLAY_WIDTH - startX;
  const offset = ((tick * stepPx) % range + range) % range;
  return startX + offset;
}
