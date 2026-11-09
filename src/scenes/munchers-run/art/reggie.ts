// Reggie the snail, hand-drawn at bar scale. Gavin settled him from four
// rounds of the numbered line-up on the bar (2026-11-09): 12 px wide (was
// 17), no outline anywhere, a big open pink shell with a dark spiral tucked
// over the neck so the head pokes up behind it, one dark eye, two antennae,
// a cream foot. The walk is a head bob: head and antennae drop a row every
// other step while the shell holds still and the foot's dark spot shifts.
//   P pink shell  D dark spiral  T cream body  U dark cream  E eye  K antennae
import type { RunnerArt } from "../art.ts";

export const REGGIE: RunnerArt = {
  name: "Reggie",
  frames: [
    [
      ".........K.K",
      ".........TT.",
      "....PPPP.TE.",
      "...PPPPPPTT.",
      "..PPPDDDPPT.",
      "..PPDPPDPPT.",
      "..PPDPDDPPT.",
      "..PPPDPPPPT.",
      "...PPPPPPTT.",
      "..UTTTTTTTU.",
    ],
    [
      "............",
      ".........K.K",
      "....PPPP.TT.",
      "...PPPPPPTE.",
      "..PPPDDDPPT.",
      "..PPDPPDPPT.",
      "..PPDPDDPPT.",
      "..PPPDPPPPT.",
      "...PPPPPPTT.",
      ".UTTTTTTTTU.",
    ],
  ],
  colors: { P: "#FFA9E1", D: "#A03C80", T: "#FCE5A9", U: "#DEC481", E: "#140A14", K: "#3A1A33" },
  eye: [10, 2],
};
