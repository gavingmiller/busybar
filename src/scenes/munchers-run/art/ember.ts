// Ember, hand-drawn at bar scale from number-munchers/public/sprites/ember
// (walkRight). A small rounded grey body with two glowing eyes and stub
// legs, flame sweeping up and back from the top of the head. The grey is
// lifted from the original's #2F2F2E and the body carries a 1 px red
// outline (Gavin 2026-11-09: "a bit hard to see") so it reads against the
// black sky; the outline runs under the feet too.
import type { RunnerArt } from "../art.ts";

export const EMBER: RunnerArt = {
  name: "Ember",
  frames: [
    [
      "...RR........",
      "..RROOR......",
      ".ROOYYOR.....",
      "..ROYYOOR....",
      "...RROORRRRRR",
      "...RKKKKKKKKR",
      "...RKKHEKEKKR",
      "...RKKKWKWKKR",
      "...RKKKKKKKKR",
      "...RRKKRRKKRR",
      "....RRRRRRRR.",
    ],
    [
      "....RR.......",
      "R.RROOOR.....",
      ".ROOYYYOR....",
      "...RYYOORR...",
      "...RROORRRRRR",
      "...RKKKKKKKKR",
      "...RKKHEKEKKR",
      "...RKKKWKWKKR",
      "...RKKKKKKKKR",
      "...RRRKKKKRRR",
      ".....RRRRRR..",
    ],
    [
      "..R.RR.......",
      "...ROOOR.....",
      ".RROOYYOR....",
      "..ROYYOOR....",
      "...RROORRRRRR",
      "...RKKKKKKKKR",
      "...RKKHEKEKKR",
      "...RKKKWKWKKR",
      "...RKKKKKKKKR",
      "...RRKKRRKKRR",
      "....RRRRRRRR.",
    ],
    [
      "...RR........",
      "..RROOR......",
      ".ROOYYOR.....",
      "..ROYYOOR....",
      "...RROORRRRRR",
      "...RKKKKKKKKR",
      "...RKKHEKEKKR",
      "...RKKKWKWKKR",
      "...RKKKKKKKKR",
      "...RKKRRRRKKR",
      "...RRRRRRRRRR",
    ],
  ],
  colors: { K: "#5C5C66", H: "#7A7A86", R: "#D8402A", O: "#F08A30", Y: "#F0C040", E: "#FF6A20", W: "#FFFFFF" },
  eye: [9, 6],
};
