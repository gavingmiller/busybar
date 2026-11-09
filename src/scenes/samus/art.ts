// Samus Aran (Metroid), hand-drawn at bar scale from Gavin's references in
// refs/ (a 16-bit standing sprite and a cross-stitch running pose) and
// settled through fifteen numbered line-up rounds on the bar (2026-11-09).
// 9x10, facing right, in profile, running with the arm cannon pointed
// ahead. The torso never moves (no bob); the legs follow Bandygrass's
// walk-cycle method (refs/bandygrass-walk-cycles.png): the two key poses,
// contact and passing, duplicated with the legs switched, near leg bright
// and far leg dark, played at 8 poses per second. A soft (dim) hip pixel
// shows on the contact frames and a soft heel trails on the passes.
//   R helmet/chest  G visor  O shoulder/limbs  Y belly  C arm cannon
//   N near leg  D far leg  s soft hip / heel
import type { RunnerArt } from "../munchers-run/art.ts";

/** Poses per second the run cycle was tuned at; a scene sets travel speed so stride matches. */
export const SAMUS_POSE_RATE = 8;

const TORSO = [
  ".........",
  "...RRR...",
  "..RRGGG..",
  "..RRRGG..",
  ".OORRRR..",
  ".OOYYOCCC",
  "..OYY..CC",
];

export const SAMUS: RunnerArt = {
  name: "Samus",
  frames: [
    [...TORSO, "..OYYs...", "DD.NN....", "DD.NN...."], // contact, near leg forward
    [...TORSO, "..OYY....", ".DNN.....", ".DNNs...."], // pass
    [...TORSO, "..OYYs...", "NN.DD....", "NN.DD...."], // contact, far leg forward
    [...TORSO, "..OYY....", ".NDD.....", ".NDDs...."], // pass
  ],
  colors: { R: "#D83030", G: "#60D070", O: "#F0A030", Y: "#F8E060", C: "#40B8A8", N: "#F0A030", D: "#B86020", s: "#7A4818" },
  // The visor, frame 0.
  eye: [5, 2],
};
