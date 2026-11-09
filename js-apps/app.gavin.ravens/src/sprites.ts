import { generateXpm2 } from "@busy-app/busy-lib";

// Raven pixel art traced from the sixth sprite (the first flying pose,
// second row) of the itch.io raven sheet Gavin picked on 2026-11-08:
// https://img.itch.zone/aW1nLzE5ODg1MTguZ2lm/original/dF5%2FyQ.gif
// Each GIF frame of that sprite was sampled on its 4x4 art-pixel grid
// (20x16), then shrunk by majority sampling (a cell is lit when at least
// half its source pixels are): first to 14x11, and on 2026-11-09 to 9x7
// after Gavin picked that size from a numbered line-up on the bar ("they're
// pretty fat"); the eye and a two-pixel beak are re-placed at the head end
// of the eye's row. The perched pose is the sheet's standing sprite, shrunk
// the same way to 7x6 with a yellow foot row. The beak (everything right of the eye on its row)
// and the feet (short runs in the bottom rows) are yellow at Gavin's ask.
// Colours are lifted from the sheet's near-black so the body still reads
// on an LED matrix over a dark sky.

/** Raven sprite size in flight: every frame shares it so the element never changes shape. */
export const RAVEN_W = 9;
export const RAVEN_H = 7;
/** Perched sprite size. */
export const PERCHED_W = 7;
export const PERCHED_H = 6;

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
  "..kkk....",
  "kkkkkkkk.",
  ".kkbkkeyy",
  "..bbbkkky",
  "...kkkkk.",
  "...kkkkk.",
  "...yy.y..",
];

/** Wings forward, raised. Facing right. */
const FLY1 = [
  ".kkk.....",
  ".kkkkkk..",
  ".kbkkkeyy",
  "..kbkkkky",
  "...kbkkkk",
  "...kkkkk.",
  "...kkky..",
];

/** Wings swept down. Facing right. */
const FLY2 = [
  "......kk.",
  ".....keyy",
  "....kkkkk",
  "...kkkkk.",
  "..kkkkkb.",
  "..kkkkkk.",
  "....kkkk.",
];

/** Wings swept down, low. Facing right. */
const FLY3 = [
  ".....kkk.",
  "....kkeyy",
  "...kkkkk.",
  "...kkkkk.",
  "..kkkkkb.",
  "..kkkkkb.",
  "....kkkk.",
];

/** Glide. Facing right. */
const FLY4 = [
  ".........",
  "...kkkeyy",
  "..kkkkkky",
  "..kkkkkkk",
  "..kkkkkk.",
  "...kbkkk.",
  "......y..",
];

/** Standing, wings folded. Facing right. */
const PERCHED = [
  "....kk.",
  "...keyy",
  "...kkky",
  "..kkkk.",
  ".kkkk..",
  "yyyyy..",
];

export const RAVEN_FRAMES: readonly string[] = [FLY0, FLY1, FLY2, FLY3, FLY4].map((grid) =>
  generateXpm2({ palette: RAVEN_PALETTE, grid })
);

export const RAVEN_PERCHED: string = generateXpm2({ palette: RAVEN_PALETTE, grid: PERCHED });

/** Cloud from Dino Run's sky (alexseminoisok/busybar-dino-run, sprites.py), 9x3. */
const CLOUD = [
  "..ccc....",
  ".cc..cc..",
  "ccccccccc",
];
export const CLOUD_W = 9;
export const CLOUD_H = 3;

const cloudCache: Record<string, string> = {};
/** The cloud bitmap in a palette's cloud colour (built once per colour). */
export function cloudXpm(color: string): string {
  if (!cloudCache[color]) cloudCache[color] = generateXpm2({ palette: { ".": "none", c: color }, grid: CLOUD });
  return cloudCache[color];
}
