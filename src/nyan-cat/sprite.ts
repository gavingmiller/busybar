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
const NYAN_COLORS: Record<string, string> = {
  K: "#000000FF",
  // Zero blue channel deliberately: a muddy R>G>B tan (e.g. #C48240) reads
  // as blue-tinted on the physical LED matrix even though the raw digital
  // value renders correctly (confirmed via /api/screen — the stored value
  // matched intent exactly). This is a hardware color-mixing/gamma issue,
  // not a data bug, so the fix is picking a color the LEDs render faithfully
  // rather than a "correct" one they distort.
  T: "#C88C00FF",
  M: "#FFB3D9FF",
  D: "#E040C0FF",
  H: "#B0B0B0FF", // true grey cat fur (was a dusty pink, wrong color entirely)
  R: "#FF0000FF",
  O: "#FF8000FF",
  Y: "#FFFF00FF",
  G: "#00FF00FF",
  C: "#0080FFFF",
  P: "#8000FFFF",
};

export const DEFAULT_TRAIL_LENGTH = 32;
const TRAIL_GRID = [
  "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
  "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
  "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
  "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
  "OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO",
  "OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO",
  "YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY",
  "YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
];

export const CAT_WIDTH = 34;
export const CAT_HEIGHT = 14;
// Rows 0-4 have no cat (H) content at all — every "K" there was purely the
// pop-tart's own outline (top/left/right edge), so it's dropped in favor of
// the crust simply forming the outer edge, no border line.
const CAT_GRID = [
  "RRRTTTTTTTTTTTTTTTTTTTTT..........",
  "RRTTTTTTTTTTTTTTTTTTTTTTT.........",
  "TTTTTMMMMMMMMMMMMMMMTTTTTT........",
  "TTTMMDMMMMMMMMMMMMMDMMMMTT........",
  "TTTMMMMMMDMMMMMMMMMMMMMMTT........",
  "TTTMMMMMMMMMMMMMKHHHKMMMTKKHHHK...",
  "TTTMMMMDMMMDDMMMKHHHHKKKKKHHHHK...",
  "TTTMMMMMMMMMMDMKHHHHHHHHHHHHHHHK..",
  "TTTMDMMMMMMMMMMKHHH.KHHHHHH.KHHK..",
  "TTTMMMMMMMMMMMMKHHHKKHHHHHHKKHHK..",
  "TTTTMDMMMMMMMMMKHHHHHKHHKHKHHHHK..",
  "TTTTTMMMMMMMMMMMKHHHHKKKKKKHHHK...",
  "HHHKKKKKKKKKKKKKKKKKKKKKKKKKK.....",
  "HHHK.KHHK.........KHHK..KHHK......",
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
  const trailCanvas = new Canvas(trailLength, TRAIL_GRID.length);
  trailCanvas.paintGrid(TRAIL_GRID, NYAN_COLORS);

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
