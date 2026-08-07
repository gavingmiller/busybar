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

// A draw is only accepted when its priority >= the currently active system
// app's (an active BUSY/CUSTOM work session runs at 90) — draw high enough
// to preempt that, since this is an explicit user-triggered custom app.
export const DRAW_PRIORITY = 95;

// Front display is a 72x16 RGB LED matrix (see tech-specs.md — the "LED
// type: RGB" spec is the main display's pixels, not just the status LED).
export const FRONT_DISPLAY_WIDTH = 72;
export const FRONT_DISPLAY_HEIGHT = 16;

// Cat + pop-tart bounding box, in local sprite coordinates.
export const CAT_WIDTH = 16;
export const CAT_HEIGHT = 16;

export const DEFAULT_TRAIL_LENGTH = 28;

const RAINBOW = [
  "#FF0000FF", // red
  "#FF8000FF", // orange
  "#FFFF00FF", // yellow
  "#00FF00FF", // green
  "#0080FFFF", // blue
  "#8000FFFF", // purple
] as const;

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
  const elements: RectangleElement[] = [];

  RAINBOW.forEach((color, i) => {
    elements.push(
      rect(`trail-${i}`, originX, originY, -trailLength, 2 + i * 2, trailLength, 2, color)
    );
  });

  elements.push(rect("head", originX, originY, 3, 0, 9, 2, "#B0B0B0FF"));
  elements.push(rect("body-border", originX, originY, 0, 2, 15, 12, "#C68E5DFF"));
  elements.push(rect("body-fill", originX, originY, 1, 3, 13, 10, "#FFB3D9FF"));
  elements.push(rect("eye-left", originX, originY, 5, 0, 1, 1, "#000000FF"));
  elements.push(rect("eye-right", originX, originY, 9, 0, 1, 1, "#000000FF"));
  elements.push(rect("cheek-left", originX, originY, 4, 3, 1, 1, "#FF6FA5FF"));
  elements.push(rect("cheek-right", originX, originY, 11, 3, 1, 1, "#FF6FA5FF"));
  elements.push(rect("mouth", originX, originY, 7, 4, 2, 1, "#A83264FF"));
  elements.push(rect("leg-left", originX, originY, 2, 14, 2, 2, "#FFB3D9FF"));
  elements.push(rect("leg-right", originX, originY, 12, 14, 2, 2, "#FFB3D9FF"));

  return elements;
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
