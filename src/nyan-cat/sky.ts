// The full-display Nyan Cat scene: a star field drifting right-to-left
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

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number): number => (a * b) / gcd(a, b);

/** How fast the sky drifts past, in pixels per second (the trail wave travels at the same speed). */
export const STAR_SPEED_PX_PER_S = 16;
/** Frames per pixel of star travel; stars sit on fractional positions in between. */
export const STAR_FRAMES_PER_PX = SKY_FPS / STAR_SPEED_PX_PER_S;
/** Width of the repeating star strip, px. At least the display width or the strip would show a gap. */
export const STAR_STRIP_WIDTH = 96;
if (!Number.isInteger(STAR_FRAMES_PER_PX)) throw new Error("sky: SKY_FPS must be a multiple of STAR_SPEED_PX_PER_S");
if (STAR_STRIP_WIDTH < SKY_WIDTH) throw new Error("sky: the star strip is narrower than the display; stars would gap");

/**
 * Frames in the loop: the smallest count that is a whole number of cat+trail
 * cycles (SCENE_FRAME_COUNT) and a whole number of star-strip laps, so every
 * layer is back at its first frame together. 288 (6 s) with today's numbers.
 */
export const SKY_FRAME_COUNT = lcm(SCENE_FRAME_COUNT, STAR_STRIP_WIDTH * STAR_FRAMES_PER_PX);

/** Star colours: most are a soft white, a few dimmer and bluer for depth. */
export const STAR_COLORS: Record<string, string> = {
  "*": "#C8C8E0FF",
  "+": "#606890FF",
};

/** Star positions on the STAR_STRIP_WIDTH-wide strip: [x, y, "*" bright | "+" dim]. */
export const STARS: ReadonlyArray<readonly [number, number, "*" | "+"]> = [
  [2, 1, "*"], [9, 13, "+"], [15, 4, "*"], [21, 10, "+"], [27, 0, "*"], [33, 7, "*"],
  [38, 14, "+"], [44, 3, "*"], [50, 11, "*"], [55, 6, "+"], [61, 1, "*"], [66, 9, "*"],
  [72, 13, "+"], [78, 5, "*"], [84, 10, "+"], [90, 2, "*"], [93, 8, "*"],
];

export interface StarPosition {
  /** Fractional x on the strip, [0, STAR_STRIP_WIDTH). */
  x: number;
  y: number;
  ch: "*" | "+";
}

/** Where every star sits on frame `frame`, having drifted left 1/STAR_FRAMES_PER_PX px per frame. */
export function starPositions(frame: number): StarPosition[] {
  const lap = STAR_STRIP_WIDTH * STAR_FRAMES_PER_PX;
  return STARS.map(([x0, y, ch]) => {
    const steps = (((x0 * STAR_FRAMES_PER_PX - frame) % lap) + lap) % lap;
    return { x: steps / STAR_FRAMES_PER_PX, y, ch };
  });
}

/** `color` ("#RRGGBBAA") dimmed to `weight` of its brightness, still opaque (the layer sits over black). */
function dim(color: string, weight: number): string {
  const channel = (i: number) => Math.round(parseInt(color.slice(i, i + 2), 16) * weight).toString(16).padStart(2, "0");
  return `#${channel(1)}${channel(3)}${channel(5)}FF`;
}

/**
 * Paints the stars for frame `frame`. A star between two columns lights
 * both, splitting its brightness by the fractional part, so the drift reads
 * as smooth sub-pixel motion rather than 16 px/s hops.
 */
export function paintStars(canvas: Canvas, frame: number): void {
  for (const { x, y, ch } of starPositions(frame)) {
    const left = Math.floor(x);
    const frac = x - left;
    const color = STAR_COLORS[ch]!;
    const put = (col: number, weight: number) => {
      const c = col % STAR_STRIP_WIDTH;
      if (weight > 1e-9 && c < SKY_WIDTH) canvas.setPixel(c, y, dim(color, weight));
    };
    put(left, 1 - frac);
    put(left + 1, frac);
  }
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
    paintStars(canvas, i);
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
    paintStars(canvas, i);
    canvas.paintGrid(trailGrid(i % TRAIL_PERIOD, trailLength, CAT_HEIGHT), NYAN_COLORS, catX - trailLength + CAT_TRAIL_OVERLAP, catY);
    const catIndex = Math.floor((i * CAT_FPS) / TRAIL_FPS) % CAT_FRAMES.length;
    canvas.paintGrid(CAT_FRAMES[catIndex]!, NYAN_COLORS, catX, catY);
    frames.push(canvas.toRGBA());
  }
  return frames;
}
