import {
  type RectangleElement,
  type DisplayPayload,
  FRONT_DISPLAY_WIDTH,
  VERTICAL_SAFE_MARGIN,
  DRAW_PRIORITY,
  toDeviceColor,
} from "../lib/display.ts";
import { Canvas } from "../lib/canvas.ts";

export type { RectangleElement, DisplayPayload };
export { FRONT_DISPLAY_WIDTH, VERTICAL_SAFE_MARGIN, DRAW_PRIORITY, toDeviceColor };

// Sprite data derived from a reference Nyan Cat pixel-art grid, downsampled
// to fit the 72x16 front display. K = black outline, T = pop-tart crust,
// M = pink body, D = magenta body dot, H = cat fur, R/O/Y/G/C/P = rainbow.
export const NYAN_COLORS: Record<string, string> = {
  K: "#000000FF",
  T: "#F5E1B8FF", // light tan crust
  M: "#FFB3D9FF",
  D: "#E040C0FF",
  H: "#B0B0B0FF", // true grey cat fur (was a dusty pink, wrong color entirely)
  R: "#FF0000FF",
  O: "#FF8000FF",
  Y: "#FFFF00FF",
  G: "#00FF00FF",
  C: "#0080FFFF", // blue — now above purple, swapped from the earlier order
  P: "#8000FFFF", // purple — now the bottommost band
};

export const DEFAULT_TRAIL_LENGTH = 32;

// Rainbow bands, top to bottom, each with a row thickness — uniformly 2px
// per Gavin's request (red and green were thicker, purple was 1px; now all
// six bands match). Blue (C) sits above purple (P) — swapped from an
// earlier order, also per request.
const TRAIL_BANDS: Array<{ char: string; rows: number }> = [
  { char: "R", rows: 2 },
  { char: "O", rows: 2 },
  { char: "Y", rows: 2 },
  { char: "G", rows: 2 },
  { char: "C", rows: 2 },
  { char: "P", rows: 2 },
];
const TRAIL_HEIGHT = TRAIL_BANDS.reduce((sum, band) => sum + band.rows, 0);

/** The band character at canonical (unshifted) row `row`, or null outside the band stack. */
function trailBandCharAt(row: number): string | null {
  if (row < 0) return null;
  let r = row;
  for (const band of TRAIL_BANDS) {
    if (r < band.rows) return band.char;
    r -= band.rows;
  }
  return null;
}

// A repeating square wave: half the columns show the canonical band stack
// pushed up by WAVE_AMPLITUDE rows, half show it at its resting position.
// Reproduces the reference Nyan Cat art's scalloped/stepped rainbow edges —
// see the 2026-08 reference image. The canvas is WAVE_AMPLITUDE rows taller
// than the band stack so the top band (red) has headroom to poke upward for
// the pushed-up columns; those same columns lose their bottom row (purple)
// since the whole stack moved up within a fixed-height canvas. The resting
// columns are the mirror image: full bottom row, empty headroom at top.
export const WAVE_PERIOD = 16;
const WAVE_AMPLITUDE = 1;
export const TRAIL_CANVAS_HEIGHT = TRAIL_HEIGHT + WAVE_AMPLITUDE;

export function waveShift(x: number): number {
  const phase = Math.floor(x / (WAVE_PERIOD / 2)) % 2;
  return phase === 0 ? 0 : WAVE_AMPLITUDE;
}

function paintWavyTrail(canvas: Canvas, tick: number = 0): void {
  for (let x = 0; x < canvas.width; x++) {
    const shift = waveShift(x + tick);
    for (let row = 0; row < canvas.height; row++) {
      const canonicalRow = row - (WAVE_AMPLITUDE - shift);
      const char = trailBandCharAt(canonicalRow);
      if (char) canvas.setPixel(x, row, NYAN_COLORS[char]!);
    }
  }
}

// Independent vertical (bob) and horizontal (drift) motion per 8px chunk,
// layered on top of the wave above, for the native-animation trail ONLY
// (see trailAnimationFrames) — the cat, and the plain rectangle path in
// nyanCatElements (used by the stationary/flying modes, which are
// element-count-limited — see the cap below), stay unaffected. Both are
// driven by (x + tick), same as waveShift, so each chunk's state scrolls
// along with the wave rather than the whole trail moving as one rigid
// block. bobShift and driftShift are phase-offset from each other AND from
// the wave's own segmentation — genuinely independent axes, not one motion
// read twice. The phase offset matters a lot here: an earlier attempt
// offset drift by exactly half a chunk width (4), which stays a clean
// divisor of CHUNK_WIDTH and left every third-or-so column-block (notably
// the rightmost chunk, right where the trail meets the cat) rendering
// completely flat for half the loop — bob, drift, and the wave all
// resolved to the same "neutral" combination there for several consecutive
// ticks. Offsetting drift by a non-divisor (3) breaks that resonance;
// confirmed by rendering frames directly to images and comparing (the
// device's own live preview turned out to be unreliable for spot-checking
// frame-to-frame animation — see commit notes) — every sampled frame now
// shows visible variation across the whole trail, including at the edge
// nearest the cat. This finer segmentation increases how many distinct
// runs the trail's rows produce — fine for a rasterized native asset, but
// it blew well past the rectangle draw API's 100-element cap when it was
// applied to the shared paintWavyTrail used by nyanCatElements too (up to
// 121 elements at a single tick) — hence the separate function.
const CHUNK_WIDTH = 8;
const BOB_AMPLITUDE = 1;
const DRIFT_AMPLITUDE = 3;
const DRIFT_PHASE = 3;
export const TRAIL_ANIM_HEIGHT = TRAIL_CANVAS_HEIGHT + BOB_AMPLITUDE;

function chunkShift(pos: number, phaseOffset: number, amplitude: number): number {
  const t = (((pos + phaseOffset) % WAVE_PERIOD) + WAVE_PERIOD) % WAVE_PERIOD;
  return Math.floor(t / CHUNK_WIDTH) % 2 === 0 ? 0 : amplitude;
}

export function bobShift(pos: number): number {
  return chunkShift(pos, 0, BOB_AMPLITUDE);
}

export function driftShift(pos: number): number {
  return chunkShift(pos, DRIFT_PHASE, DRIFT_AMPLITUDE);
}

function paintBobbingTrail(canvas: Canvas, tick: number = 0): void {
  for (let x = 0; x < canvas.width; x++) {
    const bob = bobShift(x + tick);
    const drift = driftShift(x + tick);
    const shift = waveShift(x + tick + drift);
    for (let row = 0; row < canvas.height; row++) {
      const canonicalRow = row - bob - (WAVE_AMPLITUDE - shift);
      const char = trailBandCharAt(canonicalRow);
      if (char) canvas.setPixel(x, row, NYAN_COLORS[char]!);
    }
  }
}

export const CAT_WIDTH = 34;
export const CAT_HEIGHT = 14;
// Rows 0-4 have no cat (H) content at all — every "K" there was purely the
// pop-tart's own outline (top/left/right edge), so it's dropped in favor of
// the crust simply forming the outer edge, no border line. Rows 5-11 (the
// head/fur band) similarly had their internal "K" eye/ear-separator lines
// dropped by request — the ground line under the whole sprite (row 12) and
// the leg separators (row 13) are a different feature and stay.
const CAT_GRID = [
  "...TTTTTTTTTTTTTTTTT............",
  "RRTTTTTTTTTTTTTTTTTTT...........",
  "TTTMMMMMMMMMMMMMTTTTTT..........",
  "TTMMMDMMMMMMMMMDMMMMTT..........",
  "TTMMMMMDMMMMMMMHMMMMTT.H........",
  "TTMMMMMMMMMMMMHHHMMMTTHHH.......",
  "TTMMMMMMMDDMMMHHHHHHHHHHH.......",
  "TTMMMMMMMMMDMHHHHHHHHHHHHH......",
  "TTMMDMMMMMMMMHHH.HHHHH.HHH......", // the two "." gaps here read as eyes
  "TTMMMMMMMMMMMHHHHHHKHHHHHH......", // small mouth, centered under the eyes
  "TTMMMDMMDMMMMHHHHHHHHHHHHH......",
  "TTTTTTTTTTTTTTHHHHHHHHHHH.......",
  ".HTTTTTTTTTTTTTHHTTTKHHKK.......",
  ".HHKKKHHKKKKKKKHHKKKKHHK........",
];

/** Builds just the pop-tart body + head (no trail), anchored at (originX, originY). */
export function catElements(originX: number, originY: number): RectangleElement[] {
  const catCanvas = new Canvas(CAT_WIDTH, CAT_HEIGHT);
  catCanvas.paintGrid(CAT_GRID, NYAN_COLORS);
  return catCanvas.toElements("cat", originX, originY);
}

// The trail canvas (band stack + wave headroom) is shorter than the cat —
// center it vertically within the cat's height rather than top-aligning it,
// so it isn't pinned right against the bezel-clipped top edge.
export function trailOriginY(originY: number): number {
  return originY + Math.floor((CAT_HEIGHT - TRAIL_CANVAS_HEIGHT) / 2);
}

/**
 * Builds the Nyan Cat sprite (pop-tart body + head + rainbow trail) anchored
 * so the cat's bounding box top-left sits at (originX, originY). The trail
 * extends `trailLength` px to the left, i.e. it trails behind the cat when
 * the cat moves rightward.
 */
export function nyanCatElements(
  originX: number,
  originY: number,
  trailLength: number = DEFAULT_TRAIL_LENGTH,
  tick: number = 0
): RectangleElement[] {
  const trailCanvas = new Canvas(trailLength, TRAIL_CANVAS_HEIGHT);
  paintWavyTrail(trailCanvas, tick);

  return [
    ...trailCanvas.toElements("trail", originX - trailLength, trailOriginY(originY)),
    ...catElements(originX, originY),
  ];
}

/**
 * One RGBA frame per tick across a full WAVE_PERIOD, for encoding the trail
 * as a native looping .anim asset instead of client-side polling. Each frame
 * is `trailLength x TRAIL_ANIM_HEIGHT` pixels (see Canvas.toRGBA) — taller
 * than the plain rectangle path's TRAIL_CANVAS_HEIGHT to make room for the
 * vertical bob.
 */
export function trailAnimationFrames(trailLength: number = DEFAULT_TRAIL_LENGTH): Uint8Array[] {
  const frames: Uint8Array[] = [];
  for (let tick = 0; tick < WAVE_PERIOD; tick++) {
    const canvas = new Canvas(trailLength, TRAIL_ANIM_HEIGHT);
    paintBobbingTrail(canvas, tick);
    frames.push(canvas.toRGBA());
  }
  return frames;
}

export function nyanCatPayload(
  originX: number,
  originY: number,
  trailLength: number = DEFAULT_TRAIL_LENGTH,
  tick: number = 0
): DisplayPayload {
  return {
    application_name: "nyan_cat",
    elements: nyanCatElements(originX, originY, trailLength, tick),
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
