// Bonehead, the little skull-headed Number Muncher, hand-drawn at bar scale
// from number-munchers/public/sprites/bonehead/sheet.png (walkRight frames
// 16-19). Facing right. A big round skull with two sockets (the front one
// larger, side-on), a nose hole, a row of teeth, a short body and two legs
// that alternate; frames 1 and 3 are the bounce (one row higher, legs
// together). Outline and sockets are a mid plum so they still show against
// the scene's black sky. The downscaled version this replaces was a slab.

import type { RunnerArt } from "../art.ts";

export const BONEHEAD: RunnerArt = {
  name: "Bonehead",
  frames: [
    ["..........", "..KKKKKK..", ".KWWWWWWK.", "KWWWWWWWWK", "KSWKWWKKWK", "KSWKWWKKWK", "KSSWWWWWKK", ".KKWKWKWK.", "..KSWWWK..", "..KSWWWK..", ".KSK..KWK."],
    ["..KKKKKK..", ".KWWWWWWK.", "KWWWWWWWWK", "KSWKWWKKWK", "KSWKWWKKWK", "KSSWWWWWKK", ".KKWKWKWK.", "..KSWWWK..", "..KSWWWK..", "...KSWK...", "...KK.KK.."],
    ["..........", "..KKKKKK..", ".KWWWWWWK.", "KWWWWWWWWK", "KSWKWWKKWK", "KSWKWWKKWK", "KSSWWWWWKK", ".KKWKWKWK.", "..KSWWWK..", "..KSWWWK..", "..KWK..KSK"],
    ["..KKKKKK..", ".KWWWWWWK.", "KWWWWWWWWK", "KSWKWWKKWK", "KSWKWWKKWK", "KSSWWWWWKK", ".KKWKWKWK.", "..KSWWWK..", "..KSWWWK..", "...KSWK...", "...KK.KK.."],
  ],
  colors: { W: "#EBD0C5", S: "#CCA8A3", D: "#A17877", K: "#4A2E44" },
  // The front eye socket, frame 0.
  eye: [6, 4],
};
