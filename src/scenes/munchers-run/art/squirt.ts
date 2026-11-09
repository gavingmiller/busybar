// Squirt, the water blob, hand-drawn at bar scale. Gavin chose this one from
// five rounds of a numbered line-up on the bar (2026-11-09): a round 9x6 body
// in the Number Munchers sheet's palette (navy outline, teal → blue → dark
// base, dark grin line), eyes and 2 px mouth shifted forward so it reads as
// heading right, and the sheet's ground shadow, cast ON the ground line
// (onGround: 1) as a darker patch of ground so he sits on the floor instead
// of floating above it (Gavin 2026-11-09). Fixed 12x9 box; the hop
// is rest → squash (wider, shadow spreads) → rest → stretch (taller, airborne
// over a smaller shadow).
//   O outline  T teal top  M mid blue  D dark base  G grin line  W highlight / eye white  K pupil  R mouth  X shadow
import type { RunnerArt } from "../art.ts";

const REST = [
  "............",
  "............",
  "....OOOOO...",
  "...OWTTTTTO.",
  "..OTTTWTWTO.",
  "..OMTTKTKTO.",
  "..OMMMGRRGO.",
  "...ODDDDDO..",
  ".XXXXXXXXXX.",
];

export const SQUIRT: RunnerArt = {
  name: "Squirt",
  frames: [
    REST,
    [
      "............",
      "............",
      "............",
      "...OOOOOOO..",
      ".OOWTTTTTTOO",
      ".OTTTTWTWTTO",
      ".OMMTTKTKTMO",
      ".OMMMMGRRGMO",
      "XXXXXXXXXXXX",
    ],
    REST,
    [
      ".....OOO....",
      "....OWTTO...",
      "...OTTTTTO..",
      "...OTTWTWO..",
      "...OMTKTKO..",
      "...OMMGRRO..",
      "....ODDDO...",
      "............",
      "..XXXXXXXX..",
    ],
  ],
  colors: { O: "#1D235D", T: "#65B1B8", M: "#4D8AB3", D: "#425B9E", G: "#33418A", W: "#FFFFFF", K: "#000000", R: "#B83048", X: "#4A4034" },
  onGround: 1,
  eye: [6, 5],
};
