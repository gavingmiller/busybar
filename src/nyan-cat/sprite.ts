export interface RectangleElement {
  id: string;
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: "solid";
  fill_colors: [string];
  border_width: number;
  display: "front";
  timeout: number;
}

export interface DisplayPayload {
  application_name: string;
  elements: RectangleElement[];
  priority: number;
}

// Front display is a 72x16 RGB LED matrix (see tech-specs.md — the "LED
// type: RGB" spec is the main display's pixels, not just the status LED).
export const FRONT_DISPLAY_WIDTH = 72;
export const FRONT_DISPLAY_HEIGHT = 16;

// A draw is only accepted when its priority >= the currently active system
// app's (an active BUSY/CUSTOM work session runs at 90) — draw high enough
// to preempt that, since this is an explicit user-triggered custom app.
export const DRAW_PRIORITY = 95;

// Confirmed empirically against the physical device: a #RRGGBBAA fill_colors
// value renders with red and blue swapped (send red, get blue back). Colors
// throughout this file are written as their true intended RGB and converted
// here at the one point they're attached to an element.
export function toDeviceColor(rrggbbaa: string): string {
  const r = rrggbbaa.slice(1, 3);
  const g = rrggbbaa.slice(3, 5);
  const b = rrggbbaa.slice(5, 7);
  const a = rrggbbaa.slice(7, 9);
  return `#${b}${g}${r}${a}`;
}

function rect(
  id: string,
  originX: number,
  originY: number,
  dx: number,
  dy: number,
  width: number,
  height: number,
  color: string
): RectangleElement {
  return {
    id,
    type: "rectangle",
    x: originX + dx,
    y: originY + dy,
    width,
    height,
    fill: "solid",
    fill_colors: [toDeviceColor(color)],
    border_width: 0,
    display: "front",
    timeout: 0,
  };
}

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

// The physical display's top/bottom row appears to be clipped by the bezel,
// so sprites are drawn 1px in from the full 16px height rather than using
// rows 0-15 edge to edge.
export const VERTICAL_SAFE_MARGIN = 1;

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
