// Ember: the eight-frame run from number-munchers/public/sprites/ember
// (walkRight), reduced to bar scale, with the body grey lifted from the
// original's #2F2F2E so it shows against the black sky. Gavin 2026-11-09:
// the hand-drawn still body "looked good" but "the old animation was much
// better", and a red outline tried for visibility was "ridiculous" — so
// these are the original frames with only the colour changed.
import type { RunnerArt } from "../art.ts";

export const EMBER: RunnerArt = {
  name: "Ember",
  frames: [
    ["...........", "....RRR....", "...ROOOORR.", "....ROYYOO.", ".....OKKKKR", ".....KKOKOK", ".....KKRKRK", "....KKKKKKK", ".....KKKKKK", "..........."],
    ["...........", "..ROOOORR..", ".ROOYYYYOO.", "..ROOYYYYOR", ".....RKOKOK", ".....KKYKYK", "....KKKKKKK", "....KKKKKKK", "...........", "..........."],
    ["...........", "...ROOR....", "..ROYOOR...", "...OOYYORO.", ".....RKOKOR", ".....KKYKYK", ".....KKRKRK", "....KKKKKKK", ".....KKKKKK", "..........."],
    ["...........", "..R........", ".OOR.R.....", "..R.OOOOO..", "....ROYOOO.", ".....OYYYOR", ".....RKOKOK", ".....KKYKYK", ".....KKKKKK", ".....KKKKK."],
    ["...........", "....ROOOO..", "...OOOYYOO.", "....OYYYYOR", ".....RKKKKK", ".....KKOKOK", ".....KKKKKK", ".....KKKKK.", "......KKKK.", "..........."],
    ["......RRRR.", "R...ROOOOO.", "...ROOYYYOR", "..OOYYKKKKO", "..RR.KKKOKY", ".....KKKYKY", ".....KKKKKK", "......KKKK.", "...........", "..........."],
    ["......RR...", ".....OOOO..", "....ROYOOO.", "..R.OOYYYOR", ".OOR.KKOKOK", "..R..KKYKYK", ".....KKKKKK", ".....KKKKK.", "......KKKK.", "..........."],
    ["...........", "...........", "....RRRR...", "..ROOOOOO..", "...ROOYYOO.", "....ROYYYOR", ".....RKOKOK", ".....KKYKYK", ".....KKKKKK", ".....KKKKK."],
  ],
  colors: { K: "#5C5C66", R: "#D8402A", Y: "#F0B040", O: "#FF8A30" },
  eye: [9, 5],
};
