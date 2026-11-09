// Reggie the snail, hand-drawn at bar scale from number-munchers/public/sprites/reggie
// (walkRight frames 3-5), facing right. The head, both eyestalks and the eye tips sit at the
// same pixels in every frame (Gavin 2026-11-09: the downscaled snail "looked back and forth");
// only the foot ripples. Outline is a mid plum, not black: the scene's sky is black.

import type { RunnerArt } from "../art.ts";

export const REGGIE: RunnerArt = {
  name: "Reggie",
  frames: [
    [
      "............E..E.",
      ".............TT..",
      "....KKKKK...KCCK.",
      "...KHHPPPK..KTTK.",
      "..KHPDDDPPK.KTTK.",
      ".KPPDPPPDPMKTTTK.",
      ".KPPDPDDDPMKTTTK.",
      ".KPMDDPPMMKTTTTK.",
      "..KMMMMMMKTTTTTK.",
      "KKKKKKKKKKTTTTUK.",
      "KUUUUUUUUUUUUUK..",
    ],
    [
      "............E..E.",
      ".............TT..",
      "....KKKKK...KCCK.",
      "...KHHPPPK..KTTK.",
      "..KHPDDDPPK.KTTK.",
      ".KPPDPPPDPMKTTTK.",
      ".KPPDPDDDPMKTTTK.",
      ".KPMDDPPMMKTTTTK.",
      "..KMMMMMMKTTTTTK.",
      "KKKKKKKKKKTTTTUK.",
      ".KUUUUUUUUUUUUUK.",
    ],
    [
      "............E..E.",
      ".............TT..",
      "....KKKKK...KCCK.",
      "...KHHPPPK..KTTK.",
      "..KHPDDDPPK.KTTK.",
      ".KPPDPPPDPMKTTTK.",
      ".KPPDPDDDPMKTTTK.",
      ".KPMDDPPMMKTTTTK.",
      "..KMMMMMMKTTTTTK.",
      "KKKKKKKKKKTTTTUK.",
      "..KUUUUUUUUUUUUK.",
    ],
  ],
  colors: { K: "#5A2E3A", P: "#FFA9E1", H: "#FFD8F2", M: "#ED83C8", D: "#852E67", T: "#FCE5A9", C: "#FFF2CF", U: "#DEC481", E: "#8A5A6A" },
  // Front eye tip.
  eye: [15, 0],
};
