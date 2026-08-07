import {
  type RectangleElement,
  type DisplayPayload,
  FRONT_DISPLAY_WIDTH,
  FRONT_DISPLAY_HEIGHT,
  VERTICAL_SAFE_MARGIN,
  DRAW_PRIORITY,
} from "../lib/display.ts";
import { Canvas } from "../lib/canvas.ts";

export { FRONT_DISPLAY_WIDTH, FRONT_DISPLAY_HEIGHT };

export interface Swatch {
  label: string;
  color: string;
}

/** h in degrees [0,360), s and v in percent [0,100]. Standard HSV->RGB. */
export function hsvToHex(h: number, s: number, v: number): string {
  const c = (v / 100) * (s / 100);
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v / 100 - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}FF`;
}

// 12 hues, 30 degrees apart — covers the full color wheel rather than a
// hand-picked sample of it.
export const HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
export const COLUMNS = HUES.length;

// Rows: a value ramp and a saturation ramp crossed at every hue (row 0 is
// shared by both — full saturation, full value), plus a grayscale ramp.
// This is a systematic hue x saturation x value sweep, not a curated list,
// so it actually answers "what can this display render" rather than just
// spot-checking a handful of named colors.
const ROW_SPECS: Array<{ label: string; s: number; v: number } | "grayscale"> = [
  { label: "full", s: 100, v: 100 },
  { label: "dark1", s: 100, v: 66 },
  { label: "dark2", s: 100, v: 33 },
  { label: "pale1", s: 66, v: 100 },
  { label: "pale2", s: 33, v: 100 },
  "grayscale",
];
export const ROWS = ROW_SPECS.length;
export const ROW_LABELS = ROW_SPECS.map((spec) => (spec === "grayscale" ? "grayscale" : spec.label));

export const PALETTE: Swatch[] = ROW_SPECS.flatMap((spec, row) => {
  if (spec === "grayscale") {
    return HUES.map((_, col) => {
      const v = Math.round((col * 100) / (COLUMNS - 1));
      return { label: `gray-${col}`, color: hsvToHex(0, 0, v) };
    });
  }
  return HUES.map((h) => ({
    label: `h${h}-${spec.label}`,
    color: hsvToHex(h, spec.s, spec.v),
  }));
});

const CELL_WIDTH = FRONT_DISPLAY_WIDTH / COLUMNS; // 6, exact
const ROW_HEIGHTS = [3, 2, 2, 2, 2, 3]; // sums to 14 usable rows (16 minus 2x margin)
const TOTAL_HEIGHT = ROW_HEIGHTS.reduce((a, b) => a + b, 0);

export function colorGridElements(): RectangleElement[] {
  const canvas = new Canvas(FRONT_DISPLAY_WIDTH, TOTAL_HEIGHT);
  let y = 0;

  for (let row = 0; row < ROWS; row++) {
    const height = ROW_HEIGHTS[row]!;
    for (let col = 0; col < COLUMNS; col++) {
      const swatch = PALETTE[row * COLUMNS + col]!;
      canvas.fillRect(col * CELL_WIDTH, y, CELL_WIDTH, height, swatch.color);
    }
    y += height;
  }

  return canvas.toElements("swatch", 0, VERTICAL_SAFE_MARGIN);
}

export function colorGridPayload(): DisplayPayload {
  return {
    application_name: "color_grid",
    elements: colorGridElements(),
    priority: DRAW_PRIORITY,
  };
}
