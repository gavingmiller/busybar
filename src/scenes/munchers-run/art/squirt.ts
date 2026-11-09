// Squirt, the water blob, hand-drawn at bar scale. Gavin chose this one from
// five rounds of a numbered line-up on the bar (2026-11-09): a round 9x6 body
// in the Number Munchers sheet's palette (navy outline, teal → blue → dark
// base, dark grin line), eyes and 2 px mouth shifted forward so it reads as
// heading right, and the sheet's ground shadow, cast ON the ground line
// (onGround: 1) as a darker patch of grass so he sits on the floor instead
// of floating above it (Gavin 2026-11-09). Fixed 12x12 box; the hop
// is rest → squash (wider, shadow spreads) → launch (stretched, airborne) →
// apex (four rows up over a small shadow) → fall (Gavin: "make the jump
// bigger").
//   O outline  T teal top  M mid blue  D dark base  G grin line  W highlight / eye white  K pupil  R mouth  X shadow
import type { RunnerArt } from "../art.ts";

const REST = [
  "............",
  "............",
  "............",
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
const SQUASH = [
  "............",
  "............",
  "............",
  "............",
  "............",
  "............",
  "...OOOOOOO..",
  ".OOWTTTTTTOO",
  ".OTTTTWTWTTO",
  ".OMMTTKTKTMO",
  ".OMMMMGRRGMO",
  "XXXXXXXXXXXX",
];
const STRETCH = [
  "............",
  "............",
  "............",
  ".....OOO....",
  "....OWTTO...",
  "...OTTTTTO..",
  "...OTTWTWO..",
  "...OMTKTKO..",
  "...OMMGRRO..",
  "....ODDDO...",
  "............",
];
const APEX = [
  "............",
  "....OOOOO...",
  "...OWTTTTTO.",
  "..OTTTWTWTO.",
  "..OMTTKTKTO.",
  "..OMMMGRRGO.",
  "...ODDDDDO..",
  "............",
  "............",
  "............",
  "............",
  "...XXXXXX...",
];

export const SQUIRT: RunnerArt = {
  name: "Squirt",
  // rest → squash → launch (stretched, just off the shadow) → apex (four rows up) → fall (stretched, shadow widening)
  frames: [REST, SQUASH, [...STRETCH, "..XXXXXXXX.."], APEX, [...STRETCH, ".XXXXXXXXXX."]],
  colors: { O: "#1D235D", T: "#65B1B8", M: "#4D8AB3", D: "#425B9E", G: "#33418A", W: "#FFFFFF", K: "#000000", R: "#B83048", X: "#2E5A22" },
  onGround: 1,
  eye: [6, 8],
};
