import {
  type RectangleElement,
  type DisplayPayload,
  FRONT_DISPLAY_WIDTH,
  FRONT_DISPLAY_HEIGHT,
  VERTICAL_SAFE_MARGIN,
  DRAW_PRIORITY,
  rect,
} from "../lib/display.ts";

export { FRONT_DISPLAY_WIDTH, FRONT_DISPLAY_HEIGHT };

export interface Swatch {
  label: string;
  color: string;
}

export const COLUMNS = 8;
export const ROWS = 3;

// A diagnostic spread, not just pretty colors: saturated primary/secondary
// hues (expected to render faithfully per prior apps), a row of muddy/earth
// tones (the category that turned out to render blue-tinted on the physical
// LED matrix in nyan-cat — this row is for spotting which others do too),
// and a grayscale ramp (checks R=G=B parity and brightness linearity).
export const PALETTE: Swatch[] = [
  { label: "red", color: "#FF0000FF" },
  { label: "orange", color: "#FF8000FF" },
  { label: "yellow", color: "#FFFF00FF" },
  { label: "green", color: "#00FF00FF" },
  { label: "cyan", color: "#00FFFFFF" },
  { label: "blue", color: "#0000FFFF" },
  { label: "purple", color: "#8000FFFF" },
  { label: "magenta", color: "#FF00FFFF" },

  { label: "tan", color: "#C8A064FF" },
  { label: "brown", color: "#8B4513FF" },
  { label: "olive", color: "#808000FF" },
  { label: "maroon", color: "#800000FF" },
  { label: "teal", color: "#008080FF" },
  { label: "navy", color: "#000080FF" },
  { label: "salmon", color: "#FA8072FF" },
  { label: "orchid", color: "#DA70D6FF" },

  { label: "black", color: "#000000FF" },
  { label: "grey-1", color: "#242424FF" },
  { label: "grey-2", color: "#484848FF" },
  { label: "grey-3", color: "#6C6C6CFF" },
  { label: "grey-4", color: "#909090FF" },
  { label: "grey-5", color: "#B4B4B4FF" },
  { label: "grey-6", color: "#D8D8D8FF" },
  { label: "white", color: "#FFFFFFFF" },
];

const CELL_WIDTH = FRONT_DISPLAY_WIDTH / COLUMNS; // 9, exact
const ROW_HEIGHTS = [5, 5, 4]; // sums to 14 usable rows (16 minus 2x margin)

export function colorGridElements(): RectangleElement[] {
  const elements: RectangleElement[] = [];
  let y = VERTICAL_SAFE_MARGIN;

  for (let row = 0; row < ROWS; row++) {
    const height = ROW_HEIGHTS[row]!;
    for (let col = 0; col < COLUMNS; col++) {
      const swatch = PALETTE[row * COLUMNS + col]!;
      elements.push(
        rect(`swatch-${row}-${col}`, 0, 0, col * CELL_WIDTH, y, CELL_WIDTH, height, swatch.color)
      );
    }
    y += height;
  }

  return elements;
}

export function colorGridPayload(): DisplayPayload {
  return {
    application_name: "color_grid",
    elements: colorGridElements(),
    priority: DRAW_PRIORITY,
  };
}
