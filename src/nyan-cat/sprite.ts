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

/** The band character at canonical (unshifted) row `row`, or null past the last band. */
function trailBandCharAt(row: number): string | null {
  let r = row;
  for (const band of TRAIL_BANDS) {
    if (r < band.rows) return band.char;
    r -= band.rows;
  }
  return null;
}

// A repeating square wave, columns per full cycle: half the columns sample
// the canonical band pattern, half sample it shifted by WAVE_AMPLITUDE rows.
// Reproduces the reference Nyan Cat art's scalloped/stepped rainbow edges —
// see the 2026-08 reference image. Boundaries between bands (and between the
// trail and the background) are where the shift becomes visible; a thick
// band shifted by 1px still shows the same color on most of its rows.
export const WAVE_PERIOD = 16;
const WAVE_AMPLITUDE = 1;

export function waveShift(x: number): number {
  const phase = Math.floor(x / (WAVE_PERIOD / 2)) % 2;
  return phase === 0 ? 0 : WAVE_AMPLITUDE;
}

function paintWavyTrail(canvas: Canvas): void {
  for (let x = 0; x < canvas.width; x++) {
    const shift = waveShift(x);
    for (let row = 0; row < canvas.height; row++) {
      const char = trailBandCharAt(row + shift);
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
  "RRRTTTTTTTTTTTTTTTTTTTTT..........",
  "RRTTTTTTTTTTTTTTTTTTTTTTT.........",
  "TTTTTMMMMMMMMMMMMMMMTTTTTT........",
  "TTTMMDMMMMMMMMMMMMMDMMMMTT........",
  "TTTMMMMMMDMMMMMMMMMMMMMMTT........",
  "TTTMMMMMMMMMMMMMHHHHHMMMTHHHHHH...",
  "TTTMMMMDMMMDDMMMHHHHHHHHHHHHHHH...",
  "TTTMMMMMMMMMMDMHHHHHHHHHHHHHHHHH..",
  "TTTMDMMMMMMMMMMHHHH.HHHHHHH.HHHH..",
  "TTTMMMMMMMMMMMMHHHHHHHHHHHHHHHHH..",
  "TTTTMDMMMMMMMMMHHHHHHHHHHHHHHHHH..",
  "TTTTTMMMMMMMMMMMHHHHHHHHHHHHHHH...",
  "HHHKKKKKKKKKKKKKKKKKKKKKKKKKK.....",
  "HHHKHKHHKHHHHHHHHHKHHKHHKHHK......",
];

/**
 * Builds the Nyan Cat sprite (pop-tart body + head + rainbow trail) anchored
 * so the cat's bounding box top-left sits at (originX, originY). The trail
 * extends `trailLength` px to the left, i.e. it trails behind the cat when
 * the cat moves rightward.
 */
export function nyanCatElements(
  originX: number,
  originY: number,
  trailLength: number = DEFAULT_TRAIL_LENGTH
): RectangleElement[] {
  const trailCanvas = new Canvas(trailLength, TRAIL_HEIGHT);
  paintWavyTrail(trailCanvas);

  const catCanvas = new Canvas(CAT_WIDTH, CAT_HEIGHT);
  catCanvas.paintGrid(CAT_GRID, NYAN_COLORS);

  return [
    ...trailCanvas.toElements("trail", originX - trailLength, originY),
    ...catCanvas.toElements("cat", originX, originY),
  ];
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
