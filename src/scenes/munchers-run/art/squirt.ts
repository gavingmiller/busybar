// Squirt, the water blob, hand-drawn at bar scale (Gavin 2026-11-09: the
// downscaled frames jumped in height and wore a heavy outline). A 12x10 box
// that never changes size; the blob rests on the bottom row and hops with a
// gentle squash (8 rows) → rest (9) → stretch (10) → rest (9).
//   O outline  B body  S shade  W eye white / highlight  K pupil  R mouth
import type { RunnerArt } from "../art.ts";

export const SQUIRT: RunnerArt = {
  name: "Squirt",
  frames: [
    // rest
    [
      "............",
      "...OOOOOO...",
      "..OBWBBBBO..",
      ".OBBWKBWKBO.",
      ".OBBBBBBBBO.",
      ".OBBRRRRBBO.",
      ".OSBBBRRBSO.",
      ".OSSSSSSSSO.",
      "..OSSSSSSO..",
      "...OOOOOO...",
    ],
    // squash, landing wide
    [
      "............",
      "............",
      "..OOOOOOOO..",
      ".OBWBBBBBBO.",
      "OBBBWKBBWKBO",
      "OBBBBRRRRBBO",
      "OSBBBBBRRBSO",
      "OSSSSSSSSSSO",
      ".OSSSSSSSSO.",
      "..OOOOOOOO..",
    ],
    // rest
    [
      "............",
      "...OOOOOO...",
      "..OBWBBBBO..",
      ".OBBWKBWKBO.",
      ".OBBBBBBBBO.",
      ".OBBRRRRBBO.",
      ".OSBBBRRBSO.",
      ".OSSSSSSSSO.",
      "..OSSSSSSO..",
      "...OOOOOO...",
    ],
    // stretch, in the air
    [
      "....OOOO....",
      "...OBWBBO...",
      "..OBBBBBBO..",
      "..OBWKBWKO..",
      "..OBBBBBBO..",
      "..OBRRRRBO..",
      "..OSBBRRBO..",
      "..OSSSSSSO..",
      "..OSSSSSSO..",
      "...OOOOOO...",
    ],
  ],
  colors: { O: "#2A3F7A", B: "#5CB0C0", S: "#4A7AB0", W: "#FFFFFF", K: "#1A1F4A", R: "#D83040" },
  eye: [8, 3],
};
