import {
  type RectangleElement,
  type DisplayPayload,
  FRONT_DISPLAY_WIDTH,
  VERTICAL_SAFE_MARGIN,
  DRAW_PRIORITY,
  toDeviceColor,
} from "../lib/display.ts";
import { Canvas } from "../lib/canvas.ts";
import { NYAN_COLORS, CAT_FRAMES, TRAIL_FRAMES } from "./sprite-data.ts";

export type { RectangleElement, DisplayPayload };
export { FRONT_DISPLAY_WIDTH, VERTICAL_SAFE_MARGIN, DRAW_PRIORITY, toDeviceColor, NYAN_COLORS };

// Dimensions are derived from the hand-authored data (sprite-data.ts) rather
// than hardcoded, so editing the art (e.g. via the number-munchers viewer
// tool) can't silently desync from these constants.
export const CAT_WIDTH = CAT_FRAMES[0]![0]!.length;
export const CAT_HEIGHT = CAT_FRAMES[0]!.length;
export const TRAIL_ANIM_HEIGHT = TRAIL_FRAMES[0]!.length;
export const DEFAULT_TRAIL_LENGTH = TRAIL_FRAMES[0]![0]!.length;
/**
 * Frames per second the cat's 4-frame run cycle plays at on the device —
 * a light trot, not tied to TRAIL_FPS (the two loops are independent and
 * don't need to stay in sync, same as the real Nyan Cat gif's legs and
 * trail moving at their own paces).
 */
export const CAT_FPS = 6;
/**
 * Frames per second the trail loop plays at on the device — fixed at the
 * trail's 1px-per-frame scroll rate (16px/sec) rather than derived from
 * TRAIL_FRAMES.length, so the loop's scroll speed stays constant regardless
 * of how many frames the physical period needs (32, to cover a full lap of
 * the 2 desynced bumps — see the comment above TRAIL_FRAMES).
 */
export const TRAIL_FPS = 16;

/**
 * Trail width used by the rectangle-based static render path (nyanCatElements
 * / nyanCatPayload, i.e. the `stationary` and `flying` modes) — deliberately
 * narrower than DEFAULT_TRAIL_LENGTH. The 4-bump trail (see TRAIL_FRAMES)
 * has more vertical seams than the old 2-bump design, so rendering the full
 * 32px width as RectangleElements no longer fits under the device's ~100-
 * element cap once combined with the cat (61 elements alone). 16px = 2 full
 * repeat-units of the 4-bump pattern (each bump+gap is 8px), so it's still a
 * complete, self-contained chunk of the zigzag rather than a mid-bump crop —
 * keeps trail elements to 30-36 across all 32 frames, comfortably under the
 * ~39 budget. The native `.anim` path (`rainbow` mode, trailAnimationFrames)
 * has no such cap and still uses the full DEFAULT_TRAIL_LENGTH.
 */
export const STATIC_TRAIL_LENGTH = 16;

/**
 * How many pixels the trail should be drawn overlapping *under* the cat's
 * left edge, so the trail shows through the transparent notch in the cat's
 * top-left corner (the pop-tart's rounded corner — rows 0-1 of CAT_FRAMES
 * have a few leading "." pixels there) instead of stopping at a hard seam.
 * Derived from the art itself (the longest run of leading transparent
 * pixels across any row of any frame) rather than hardcoded, so a future
 * hand-edit to the notch's shape via the number-munchers viewer tool can't
 * silently desync from this. Elsewhere (rows with no notch) the cat is
 * fully opaque and simply paints over this same overlap, so it's a no-op
 * there — only rows with a transparent gap actually reveal the trail.
 */
export const CAT_TRAIL_OVERLAP = Math.max(
  ...CAT_FRAMES.flatMap((frame) =>
    frame.map((row) => {
      let n = 0;
      while (row[n] === ".") n++;
      return n;
    })
  )
);

/**
 * Builds just the pop-tart body + head + legs (no trail), anchored at
 * (originX, originY). `frameIndex` picks a pose from CAT_FRAMES (default 0,
 * the neutral/legs-planted pose) — used by the static rectangle path
 * (`stationary`/`flying`); the animated run cycle is a separate native
 * `.anim` asset, see catAnimationFrames below.
 */
export function catElements(
  originX: number,
  originY: number,
  frameIndex: number = 0
): RectangleElement[] {
  const catCanvas = new Canvas(CAT_WIDTH, CAT_HEIGHT);
  catCanvas.paintGrid(CAT_FRAMES[frameIndex]!, NYAN_COLORS);
  return catCanvas.toElements("cat", originX, originY);
}

/**
 * One RGBA frame per entry in CAT_FRAMES, for encoding the cat's run cycle
 * as a native looping .anim asset — same pattern as trailAnimationFrames.
 */
export function catAnimationFrames(): Uint8Array[] {
  return CAT_FRAMES.map((grid) => {
    const canvas = new Canvas(CAT_WIDTH, CAT_HEIGHT);
    canvas.paintGrid(grid, NYAN_COLORS);
    return canvas.toRGBA();
  });
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
  trailLength: number = STATIC_TRAIL_LENGTH
): RectangleElement[] {
  const trailCanvas = new Canvas(trailLength, TRAIL_ANIM_HEIGHT);
  trailCanvas.paintGrid(TRAIL_FRAMES[0]!, NYAN_COLORS);

  return [
    // Overlapped CAT_TRAIL_OVERLAP px under the cat (drawn after, so it
    // paints on top) so the trail shows through the cat's top-left notch —
    // see CAT_TRAIL_OVERLAP's own comment.
    ...trailCanvas.toElements("trail", originX - trailLength + CAT_TRAIL_OVERLAP, trailOriginY(originY)),
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
  trailLength: number = STATIC_TRAIL_LENGTH
): DisplayPayload {
  return {
    application_name: "nyan_cat",
    elements: nyanCatElements(originX, originY, trailLength),
    priority: DRAW_PRIORITY,
  };
}

/** Centers the cat + trail scene horizontally on the front display. */
export function stationaryOriginX(trailLength: number = STATIC_TRAIL_LENGTH): number {
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
  trailLength: number = STATIC_TRAIL_LENGTH,
  stepPx: number = 2
): number {
  const startX = -(trailLength + CAT_WIDTH);
  const range = FRONT_DISPLAY_WIDTH - startX;
  const offset = ((tick * stepPx) % range + range) % range;
  return startX + offset;
}
