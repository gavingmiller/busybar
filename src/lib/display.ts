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

// The physical display's top/bottom row appears to be clipped by the bezel,
// so sprites are drawn 1px in from the full 16px height rather than using
// rows 0-15 edge to edge.
export const VERTICAL_SAFE_MARGIN = 1;

// A draw is only accepted when its priority >= the currently active system
// app's. An active BUSY/CUSTOM work session runs at 90, but that ceiling
// isn't reliable in practice — a draw at 95 has been rejected as "too low"
// more than once. 100 is the maximum the API accepts (values are 1-100), so
// use it unconditionally rather than re-chasing this each time it happens.
export const DRAW_PRIORITY = 100;

// Confirmed empirically against the physical device: a #RRGGBBAA fill_colors
// value renders with red and blue swapped (send red, get blue back). Colors
// throughout this codebase are written as their true intended RGB and
// converted here at the one point they're attached to an element.
export function toDeviceColor(rrggbbaa: string): string {
  const r = rrggbbaa.slice(1, 3);
  const g = rrggbbaa.slice(3, 5);
  const b = rrggbbaa.slice(5, 7);
  const a = rrggbbaa.slice(7, 9);
  return `#${b}${g}${r}${a}`;
}

export function rect(
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
