// Bonehead, the little skull-headed Number Muncher, hand-drawn at bar scale.
// Gavin settled him from the numbered line-up on the bar (2026-11-09): the
// taller body with near-black eye sockets and one arm that swings forward
// and back as the legs alternate. He also has a DANCE (the line-up's head
// bob and both-arms poses) that the scene plays when he stops mid-run.
// Fixed 10x10 box, facing right. Outline is a mid plum so it shows on the
// black sky; sockets are near-black so they read as holes.
//   W bone  S shade  K plum outline  E socket

import type { RunnerArt } from "../art.ts";

const SKULL = ["..KKKKKK..", ".KWWWWWWK.", "KWWWWWWWWK", "KSWEWWEEWK", "KSWEWWEEWK", "KSSWWWWWKK", ".KKWKWKWK."];
const LEGS_A = ".KSK..KWK.", LEGS_B = "..KWK..KSK";

export const BONEHEAD: RunnerArt = {
  name: "Bonehead",
  frames: [
    [...SKULL, "..KSWWWKW.", "..KSWWWK..", LEGS_A], // arm forward
    [...SKULL, ".WKSWWWK..", "..KSWWWK..", LEGS_B], // arm back
  ],
  dance: [
    [...SKULL, ".WKSWWWKW.", "..KSWWWK..", LEGS_A], // both arms out
    ["..........", ...SKULL, ".WKSWWWKW.", LEGS_B], // bob down, arms out
    [...SKULL, "..KSWWWK..", ".WKSWWWKW.", LEGS_A], // arms low
    ["..........", ...SKULL, "..KSWWWK..", LEGS_B], // bob down, arms in
  ],
  colors: { W: "#EBD0C5", S: "#CCA8A3", K: "#4A2E44", E: "#120812" },
  // The front eye socket, frame 0.
  eye: [6, 3],
};
