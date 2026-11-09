// Ember: the eight-frame run from number-munchers/public/sprites/ember
// (walkRight), reduced to bar scale. Gavin 2026-11-09: the hand-drawn still
// body "looked good" but "the old animation was much better", and a red
// outline tried for visibility was "ridiculous" — so these are the original
// frames with only the colours changed: the body greys are lifted from the
// sheet's #2F2F2E / #464646 / #525252 so they show against the black sky,
// and all THREE greys are kept (the first reduction collapsed them to one,
// which lost his legs — they are the lighter patches under the body).
// Regenerate with scratchpad ember-shrink.py (block-shrink to 10 rows,
// orange wins a block at 30 percent or more).
//   K dark body  F mid grey  E light grey (face, legs)  R red  Y yellow  O orange (eyes, flame)
import type { RunnerArt } from "../art.ts";

export const EMBER: RunnerArt = {
  name: "Ember",
  frames: [
    ["...........", "....RRR....", "...ROOOORR.", "....ROYYOO.", ".....OKKKKR", ".....KEOEOK", ".....KERFRK", "....KFEEKEF", ".....KKKKKK", "..........."],
    ["...........", "..ROOOORR..", ".ROOYYYYOO.", "..ROOYYYYOR", ".....REOEOK", ".....KEYFYK", "....KFEEKEF", "....KEEFFKK", "...........", "..........."],
    ["...........", "...ROOR....", "..ROYOOR...", "...OOYYORO.", ".....RKOKOR", ".....KEYEYK", ".....KERFRK", "....KFEEKEF", ".....KKKKKK", "..........."],
    ["...........", "..R........", ".OOR.R.....", "..R.OOOOO..", "....ROYOOO.", ".....OYYYOR", ".....REOEOK", ".....KEYFYK", ".....KEEKEK", ".....KEFFK."],
    ["...........", "....ROOOO..", "...OOOYYOO.", "....OYYYYOR", ".....REEEEK", ".....KEOFOK", ".....KEEKEK", ".....KFFFF.", "......KKKK.", "..........."],
    ["......RRRR.", "R...ROOOOO.", "...ROOYYYOR", "..OOYYKKKKO", "..RR.KFEOFY", ".....KFEEFK", ".....KFFEEK", "......KKFK.", "...........", "..........."],
    ["......RR...", ".....OOOO..", "....ROYOOO.", "..R.OOYYYOR", ".OOR.KEOEOK", "..R..KEYFOK", ".....KEEKEK", ".....KFFFF.", "......KKKK.", "..........."],
    ["...........", "...........", "....RRRR...", "..ROOOOOO..", "...ROOYYOO.", "....ROYYYOR", ".....REOEOK", ".....KEYFOK", ".....KEEKEK", ".....KEFFK."],
  ],
  colors: { K: "#5C5C66", F: "#7E7E8A", E: "#9C9CA8", R: "#D8402A", Y: "#F0B040", O: "#FF8A30" },
  eye: [9, 5],
};
