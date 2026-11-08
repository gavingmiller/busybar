import { generateXpm2 } from "@busy-app/busy-lib";

/** Raven sprite size: both wing frames share it so the element never changes shape. */
export const RAVEN_W = 10;
export const RAVEN_H = 7;

/** Palette for both ravens. `.` is transparent. */
const RAVEN_PALETTE = {
  ".": "none",
  "b": "#8A8AA8", // body / wings
  "d": "#5C5C78", // shading
  "e": "#FFD24A", // eye
  "k": "#E09A2C", // beak
} as const;

/** Wings raised. Facing right. */
const WINGS_UP = [
  "..bb......",
  ".bbbb.....",
  "..bbbb....",
  "...dbbbbee",
  "....dbbbbk",
  ".....dbb..",
  "......d...",
];

/** Wings down. Facing right. */
const WINGS_DOWN = [
  "..........",
  "..........",
  "......bbee",
  "...dbbbbbk",
  "..bbbbdd..",
  ".bbb..d...",
  "bb....d...",
];

/** Perched: wings folded, feet down. Facing right. */
const PERCHED = [
  "..........",
  "......bbee",
  "....dbbbbk",
  "...bbbbb..",
  "..dbbbd...",
  "...dbd....",
  "...d.d....",
];

export const RAVEN_FRAMES: readonly string[] = [
  generateXpm2({ palette: RAVEN_PALETTE, grid: WINGS_UP }),
  generateXpm2({ palette: RAVEN_PALETTE, grid: WINGS_DOWN }),
];

export const RAVEN_PERCHED: string = generateXpm2({ palette: RAVEN_PALETTE, grid: PERCHED });
