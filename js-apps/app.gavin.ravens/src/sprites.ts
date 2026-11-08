import { generateXpm2 } from "@busy-app/busy-lib";

// Raven pixel art traced from the sixth sprite (the first flying pose,
// second row) of the itch.io raven sheet Gavin picked on 2026-11-08:
// https://img.itch.zone/aW1nLzE5ODg1MTguZ2lm/original/dF5%2FyQ.gif
// Every GIF frame of that sprite was sampled at its 4x4 art-pixel grid,
// trimmed from 20x18 to 20x16 (the bar's height) by dropping the one-pixel
// top and bottom edge rows. The perched pose is the sheet's first (standing)
// sprite. Colours are lifted from the sheet's near-black so the body still
// reads on an LED matrix over a dark sky.

/** Raven sprite size in flight: every frame shares it so the element never changes shape. */
export const RAVEN_W = 20;
export const RAVEN_H = 16;
/** Perched sprite size. */
export const PERCHED_W = 15;
export const PERCHED_H = 12;

/** Palette for both ravens. `.` is transparent. */
const RAVEN_PALETTE = {
  ".": "none",
  "k": "#3C4650", // body
  "b": "#8A929A", // feather highlights
  "e": "#FFFFFF", // eye
} as const;

/** Wings forward, high. Facing right. */
const FLY0 = [
  "....kkkkk...........",
  ".kkkkkkkkkk.........",
  "kkkkkkkkkkkkkkkk....",
  "kkbbbbkkkkkkkkkkk...",
  "..kkkbbkkkkkkkkkkkk.",
  "...kbbbbbkkkkkkebbbk",
  "....kkbbkkkkkkkkkkkk",
  "......kbbbkkkkkkkk..",
  ".......kkkkkkkkkk...",
  "........kkkkkkkk....",
  ".......kkkkkkkk.....",
  "......kkkbkkkkk.....",
  "......kkbkkk...kk...",
  "......kkk...kk.k....",
  "............k.......",
  "....................",
];

/** Wings forward, raised. Facing right. */
const FLY1 = [
  ".kkkkkk.............",
  ".kkkkkkkk...........",
  ".kbkkkkkkkk.........",
  "..kbkkkkkkkkkkkk....",
  "...kbkkkkkkkkkkkk...",
  "....kbkkkkkkkkkkkkk.",
  ".....kbkkkkkkkkebbbk",
  "......kbkkkkkkkkkkkk",
  ".......kbbkkkkkkkk..",
  "........kkkkkkkkk...",
  ".......kkkkkkkkk....",
  "......kkkkkkkkk.....",
  "......kkbbkkkkk.....",
  "......kkkkkk...kk...",
  "............kk.k....",
  "............k.......",
];

/** Wings swept down. Facing right. */
const FLY2 = [
  "............kkkk....",
  "...........kkkkkk...",
  "..........kkkkkkkkk.",
  ".........kkkkkkebbbk",
  "........kkkkkkkkkkkk",
  ".......kkkkkkkkkk...",
  "......kkkkkkkkkk....",
  ".....kkkkkkkkkkk....",
  ".....kkkkkkkkkbk....",
  "....kkkkkkkkkkbk....",
  "....kkkkkkkkkkbk....",
  "....kkkkkkkkkkkk....",
  "....kkk..kkkkkkk....",
  ".....k...kkkkkkk....",
  "..........kkkkkk....",
  "...........kkkk.....",
];

/** Wings swept down, low. Facing right. */
const FLY3 = [
  "...........kkkkkk...",
  "..........kkkkkkkkk.",
  ".........kkkkkkebbbk",
  "........kkkkkkkkkkkk",
  ".......kkkkkkkkkk...",
  "......kkkkkkkkkk....",
  ".....kkkkkkkkkkk....",
  ".....kkkkkkkkkkk....",
  "....kkkkkkkkkkbk....",
  "....kkkkkkkkkkbbk...",
  "....kkkkkkkkkkbbk...",
  "....kkkkkkkkkkkbk...",
  ".....k..kkkkkkkkk...",
  ".........kkkkkkk....",
  "..........kkkkkk....",
  "...........kkkk.....",
];

/** Glide. Facing right. */
const FLY4 = [
  "....................",
  "........kkk.kkkk....",
  "......kkkkkkkkkkk...",
  ".....kkkkkkkkkkkkkk.",
  "....kkkkkkkkkkkebbbk",
  "....kkkkkkkkkkkkkkkk",
  "....kkkkkkkkkkkkkk..",
  "....kkkkkkkkkkkkk...",
  "....kkkkkkkkkkkk....",
  "....kkkkkkkkkkk.....",
  ".....kkkkbkkkkk.....",
  "......kkbkkk...kk...",
  "......kkk...kk.k....",
  "............k.......",
  "....................",
  "....................",
];

/** Standing, wings folded. Facing right. */
const PERCHED = [
  "........kkk....",
  ".......kkkkk...",
  "......kkkkkkkk.",
  "......kkkkebbbk",
  ".....kkkkkkkkkk",
  "....kkkkkkkkk..",
  "...kkkkkkkkk...",
  "..kkkkkkkkk....",
  ".kkkkkkkkk.....",
  "kkkkkkkkk......",
  "......k.k......",
  ".....kkkkk.....",
];

export const RAVEN_FRAMES: readonly string[] = [FLY0, FLY1, FLY2, FLY3, FLY4].map((grid) =>
  generateXpm2({ palette: RAVEN_PALETTE, grid })
);

export const RAVEN_PERCHED: string = generateXpm2({ palette: RAVEN_PALETTE, grid: PERCHED });
