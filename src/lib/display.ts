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

// An earlier version of this swapped R and B, based on a capture-script-
// derived "confirmation" that turned out to be wrong — the capture script
// had a matching R/B decode bug that made a truly-broken (swapped) device
// render look correct when read back through it. Re-verified live via the
// device's own web UI (http://10.0.4.20/) and a controlled 6-color test:
// unswapped colors render correctly with no compensation. Kept as a named
// pass-through — the one seam where real device color compensation would
// go if one's ever found again — rather than removed outright. Don't
// reintroduce a swap without re-confirming via the web UI or a physical
// photo, not just this project's own capture tooling.
export function toDeviceColor(rrggbbaa: string): string {
  return rrggbbaa;
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
