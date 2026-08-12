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
 * Frames per second the cat's 4-frame run cycle plays at, conceptually — a
 * light trot, independent of TRAIL_FPS (the two loops don't need to look
 * synced, same as the real Nyan Cat gif's legs and trail moving at their
 * own paces). Not the device's actual playback fps for the cat, though:
 * the composited scene asset (sceneAnimationFrames) resamples the cat into
 * the trail's own frame timeline, so this only needs to stay a whole
 * divisor of the trail's loop duration for that resampling to close
 * seamlessly — see sceneAnimationFrames.
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
 * ~39 budget. The native `.anim` path (`rainbow` mode, sceneAnimationFrames)
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

// The trail (TRAIL_ANIM_HEIGHT) is now exactly CAT_HEIGHT tall, so this is a
// no-op offset in practice — kept as a function (rather than inlining
// originY) in case the two heights diverge again after a hand-edit.
export function trailOriginY(originY: number): number {
  return originY + Math.floor((CAT_HEIGHT - TRAIL_ANIM_HEIGHT) / 2);
}

function paintTrail(canvas: Canvas, x: number, y: number, frameIndex: number): void {
  canvas.paintGrid(TRAIL_FRAMES[frameIndex]!, NYAN_COLORS, x, y);
}

function paintCat(canvas: Canvas, x: number, y: number, frameIndex: number): void {
  canvas.paintGrid(CAT_FRAMES[frameIndex]!, NYAN_COLORS, x, y);
}

/**
 * Builds just the pop-tart body + head + legs (no trail), anchored at
 * (originX, originY). `frameIndex` picks a pose from CAT_FRAMES (default 0,
 * the neutral/legs-planted pose).
 */
export function catElements(
  originX: number,
  originY: number,
  frameIndex: number = 0
): RectangleElement[] {
  const canvas = new Canvas(CAT_WIDTH, CAT_HEIGHT);
  paintCat(canvas, 0, 0, frameIndex);
  return canvas.toElements("cat", originX, originY);
}

/**
 * Width of the composited cat+trail scene: the trail's length plus the
 * cat's width, minus CAT_TRAIL_OVERLAP where the two are painted onto the
 * same canvas (see CAT_TRAIL_OVERLAP and nyanCatElements below).
 */
export function sceneWidth(trailLength: number): number {
  return trailLength + CAT_WIDTH - CAT_TRAIL_OVERLAP;
}

/**
 * Builds the composited Nyan Cat scene (rainbow trail + pop-tart body +
 * head + legs) anchored so the cat's bounding box top-left sits at
 * (originX, originY). The trail extends `trailLength` px to the left,
 * overlapped CAT_TRAIL_OVERLAP px under the cat's top-left corner.
 *
 * The device can't layer two separate elements with transparency — an
 * element's background doesn't composite against whatever's underneath it,
 * confirmed live (a second AnimationElement drawn "on top" of the trail
 * just showed a hard black gap at the cat's transparent notch instead of
 * the trail peeking through). So trail and cat are painted onto ONE shared
 * Canvas here — composited in software, trail first then cat on top, with
 * Canvas.paintGrid's own background-skip doing the transparency handling —
 * before ever being converted to device elements. Used by the
 * `stationary`/`flying` modes; the animated run cycle is a separate native
 * `.anim` asset built the same way, see sceneAnimationFrames below.
 */
export function nyanCatElements(
  originX: number,
  originY: number,
  trailLength: number = STATIC_TRAIL_LENGTH
): RectangleElement[] {
  const canvas = new Canvas(sceneWidth(trailLength), CAT_HEIGHT);
  paintTrail(canvas, 0, trailOriginY(0), 0);
  paintCat(canvas, trailLength - CAT_TRAIL_OVERLAP, 0, 0);
  return canvas.toElements("scene", originX - trailLength + CAT_TRAIL_OVERLAP, originY);
}

/**
 * One RGBA frame per entry in TRAIL_FRAMES, for encoding the composited
 * cat+trail scene as a single native looping .anim asset (see
 * nyanCatElements's comment on why this must be pre-composited in software
 * rather than sent as two separate device elements).
 *
 * Sampled at the trail's own native cadence (TRAIL_FPS / TRAIL_FRAMES.length)
 * so the trail reproduces exactly 1:1; the cat's pose is resampled to fit —
 * at combined frame `i`, elapsed time is i/TRAIL_FPS, so the showing cat
 * frame is floor(i * CAT_FPS / TRAIL_FPS) % CAT_FRAMES.length. This only
 * loops seamlessly if the trail's full loop duration is a whole multiple of
 * the cat's — true today (2s trail loop = exactly 3 cat loops of ~0.667s
 * each) — asserted below so a future frame-count/fps change that breaks
 * this fails loudly instead of producing a subtle seam glitch.
 */
export function sceneAnimationFrames(trailLength: number = DEFAULT_TRAIL_LENGTH): Uint8Array[] {
  const trailLoopUnits = TRAIL_FRAMES.length * CAT_FPS;
  const catLoopUnits = CAT_FRAMES.length * TRAIL_FPS;
  if (trailLoopUnits % catLoopUnits !== 0) {
    throw new Error(
      "sceneAnimationFrames: the trail's loop duration isn't a whole multiple of the cat's — " +
        "the combined scene wouldn't loop seamlessly. Adjust CAT_FPS/CAT_FRAMES or TRAIL_FPS/TRAIL_FRAMES."
    );
  }

  const width = sceneWidth(trailLength);
  const catX = trailLength - CAT_TRAIL_OVERLAP;
  const trailY = trailOriginY(0);
  return TRAIL_FRAMES.map((_, i) => {
    const catIndex = Math.floor((i * CAT_FPS) / TRAIL_FPS) % CAT_FRAMES.length;
    const canvas = new Canvas(width, CAT_HEIGHT);
    paintTrail(canvas, 0, trailY, i);
    paintCat(canvas, catX, 0, catIndex);
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
