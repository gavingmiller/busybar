import { generateXpm2 } from "@busy-app/busy-lib";

// Raven pixel art traced from the sixth sprite (the first flying pose,
// second row) of the itch.io raven sheet Gavin picked on 2026-11-08:
// https://img.itch.zone/aW1nLzE5ODg1MTguZ2lm/original/dF5%2FyQ.gif
// Each GIF frame of that sprite was sampled on its 4x4 art-pixel grid
// (20x16), then shrunk to 14x11 by majority sampling (a cell is lit when at
// least half its source pixels are) because the full-height raven was too
// big for the bar. The perched pose is the sheet's standing sprite, shrunk
// the same way to 10x8. The beak (everything right of the eye on its row)
// and the feet (short runs in the bottom rows) are yellow at Gavin's ask.
// Colours are lifted from the sheet's near-black so the body still reads
// on an LED matrix over a dark sky.

/** Raven sprite size in flight: every frame shares it so the element never changes shape. */
export const RAVEN_W = 14;
export const RAVEN_H = 11;
/** Perched sprite size. */
export const PERCHED_W = 10;
export const PERCHED_H = 8;

/** Palette for both ravens. `.` is transparent. */
const RAVEN_PALETTE = {
  ".": "none",
  "k": "#3C4650", // body
  "b": "#8A929A", // feather highlights
  "e": "#FFFFFF", // eye
  "y": "#E6B428", // beak and feet
} as const;

/** Wings forward, high. Facing right. */
const FLY0 = [
  "...kkkk.......",
  ".kkkkkkk......",
  "kkbbbkkkkkkk..",
  "..kkbkkkkkkkkk",
  "...bbbbkkkkeyy",
  "....kbbkkkkkk.",
  ".....kkkkkkk..",
  ".....kkkkkk...",
  "....kkbkkkkk..",
  "....yyy..y.y..",
  "..............",
];

/** Wings forward, raised. Facing right. */
const FLY1 = [
  ".kkkk.........",
  ".kkkkkk.......",
  ".kbkkkkkkkk...",
  "..kbkkkkkkkk..",
  "...kbkkkkkkeyy",
  "....kbkkkkkkkk",
  ".....kbkkkkkk.",
  ".....kkkkkkk..",
  "....kkbkkkk...",
  "....kkkkk..y..",
  ".........y....",
];

/** Wings swept down. Facing right. */
const FLY2 = [
  ".........kkk..",
  "........kkkk..",
  ".......kkkkeyy",
  "......kkkkkkkk",
  ".....kkkkkkk..",
  "....kkkkkkkk..",
  "...kkkkkkkbk..",
  "...kkkkkkkbk..",
  "...kkkkkkkkk..",
  "....y.kkkkkk..",
  ".......kkkk...",
];

/** Wings swept down, low. Facing right. */
const FLY3 = [
  "........kkkk..",
  ".......kkkkkkk",
  "......kkkkkeyy",
  ".....kkkkkkk..",
  "....kkkkkkkk..",
  "....kkkkkkkk..",
  "...kkkkkkkbb..",
  "...kkkkkkkbb..",
  "...kkkkkkkkb..",
  "......kkkkkk..",
  ".......kkkk...",
];

/** Glide. Facing right. */
const FLY4 = [
  "..............",
  "......kk.kkk..",
  "....kkkkkkkkk.",
  "...kkkkkkkkeyy",
  "...kkkkkkkkkkk",
  "...kkkkkkkkk..",
  "...kkkkkkkk...",
  "....kkbkkkk...",
  "....kkbkkk.y..",
  ".........y....",
  "..............",
];

/** Standing, wings folded. Facing right. */
const PERCHED = [
  ".....kkk..",
  "....kkkkk.",
  "....kkkeyy",
  "...kkkkkkk",
  "..kkkkkk..",
  ".kkkkkk...",
  "kkkkkk....",
  "....yyy...",
];

export const RAVEN_FRAMES: readonly string[] = [FLY0, FLY1, FLY2, FLY3, FLY4].map((grid) =>
  generateXpm2({ palette: RAVEN_PALETTE, grid })
);

export const RAVEN_PERCHED: string = generateXpm2({ palette: RAVEN_PALETTE, grid: PERCHED });
