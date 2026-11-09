// Ember, hand-drawn at bar scale from number-munchers/public/sprites/ember
// (walkRight). A small rounded grey body with two glowing eyes and stub
// legs, flame sweeping up and back from the top of the head. The grey is
// lifted from the original's #2F2F2E so it reads against the black sky. A red
// outline was tried for visibility and rejected (Gavin 2026-11-09:
// "ridiculous"); red belongs to the flame only.
import type { RunnerArt } from "../art.ts";

export const EMBER: RunnerArt = {
  name: "Ember",
  frames: [
    [
      "...RR........",
      "..RROOR......",
      ".ROOYYOR.....",
      "..ROYYOOR....",
      "...RROOKKKKK.",
      "....KKKKKKKK.",
      "....KKHEKEKK.",
      "....KKKWKWKK.",
      "....KKKKKKKK.",
      ".....KK..KK..",
      ".....KK..KK..",
    ],
    [
      "....RR.......",
      "R.RROOOR.....",
      ".ROOYYYOR....",
      "...RYYOORR...",
      "...RROOKKKKK.",
      "....KKKKKKKK.",
      "....KKHEKEKK.",
      "....KKKWKWKK.",
      "....KKKKKKKK.",
      "......KKKK...",
      "......KKKK...",
    ],
    [
      "..R.RR.......",
      "...ROOOR.....",
      ".RROOYYOR....",
      "..ROYYOOR....",
      "...RROOKKKKK.",
      "....KKKKKKKK.",
      "....KKHEKEKK.",
      "....KKKWKWKK.",
      "....KKKKKKKK.",
      ".....KK..KK..",
      ".....KK..KK..",
    ],
    [
      "...RR........",
      "..RROOR......",
      ".ROOYYOR.....",
      "..ROYYOOR....",
      "...RROOKKKKK.",
      "....KKKKKKKK.",
      "....KKHEKEKK.",
      "....KKKWKWKK.",
      "....KKKKKKKK.",
      "....KK....KK.",
      "....KK....KK.",
    ],
  ],
  colors: { K: "#5C5C66", H: "#7A7A86", R: "#D8402A", O: "#F08A30", Y: "#F0C040", E: "#FF6A20", W: "#FFFFFF" },
  eye: [9, 6],
};
