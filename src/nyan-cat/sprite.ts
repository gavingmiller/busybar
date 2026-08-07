import {
  type RectangleElement,
  type DisplayPayload,
  FRONT_DISPLAY_WIDTH,
  VERTICAL_SAFE_MARGIN,
  DRAW_PRIORITY,
  toDeviceColor,
  rect,
} from "../lib/display.ts";

export type { RectangleElement, DisplayPayload };
export { FRONT_DISPLAY_WIDTH, VERTICAL_SAFE_MARGIN, DRAW_PRIORITY, toDeviceColor };

const BACKGROUND = ".";

interface Run {
  start: number;
  length: number;
  char: string;
}

function rowRuns(row: string): Run[] {
  const runs: Run[] = [];
  let runStart = 0;
  for (let col = 1; col <= row.length; col++) {
    if (col === row.length || row[col] !== row[runStart]) {
      const ch = row[runStart]!;
      if (ch !== BACKGROUND) runs.push({ start: runStart, length: col - runStart, char: ch });
      runStart = col;
    }
  }
  return runs;
}

/**
 * Compiles a sprite authored as a grid of characters (one per pixel, "."
 * for background/transparent) into the fewest RectangleElements: each row is
 * run-length-encoded, then identical runs stacked on consecutive rows merge
 * into one taller rectangle. Much easier to author and iterate on by eye
 * than hand-placed rects, and keeps the element count well under the
 * device's per-draw element cap for anything mostly solid-colored.
 */
export function gridToRectangles(
  grid: string[],
  colors: Record<string, string>,
  idPrefix: string,
  originX: number,
  originY: number,
  colOffset: number = 0
): RectangleElement[] {
  const elements: RectangleElement[] = [];
  const active = new Map<string, { run: Run; startRow: number; height: number }>();

  const flush = (key: string, endRow: number) => {
    const entry = active.get(key)!;
    active.delete(key);
    elements.push(
      rect(
        `${idPrefix}-${entry.startRow}-${entry.run.start}`,
        originX,
        originY,
        colOffset + entry.run.start,
        entry.startRow,
        entry.run.length,
        endRow - entry.startRow,
        colors[entry.run.char]!
      )
    );
  };

  grid.forEach((row, rowIndex) => {
    const runs = rowRuns(row);
    const currentKeys = new Set(runs.map((r) => `${r.start}:${r.length}:${r.char}`));

    for (const key of active.keys()) {
      if (!currentKeys.has(key)) flush(key, rowIndex);
    }
    for (const run of runs) {
      const key = `${run.start}:${run.length}:${run.char}`;
      const entry = active.get(key);
      if (entry) entry.height += 1;
      else active.set(key, { run, startRow: rowIndex, height: 1 });
    }
  });
  for (const key of [...active.keys()]) flush(key, grid.length);

  return elements;
}

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
  return [
    ...gridToRectangles(TRAIL_GRID, NYAN_COLORS, "trail", originX, originY, -trailLength),
    ...gridToRectangles(CAT_GRID, NYAN_COLORS, "cat", originX, originY, 0),
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
