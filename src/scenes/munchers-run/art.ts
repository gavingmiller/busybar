// Data-only file: the runners' pixel art, one character per pixel ("." is
// transparent), every frame facing RIGHT. The Number Munchers five were ported
// from ~/projects/number-munchers/public/sprites/<name>/sheet.png (walkRight
// frames, downscaled to fit the 16 px display, colours snapped to a small
// curated palette); the chicken from Gavin's reference GIF (14 frames, every
// other one kept). Regenerate with the extract2.py script noted in the commit.

export interface RunnerArt {
  name: string;
  /** Run-cycle frames, all the same size, facing right. */
  frames: readonly (readonly string[])[];
  colors: Readonly<Record<string, string>>;
  /** [col, row] of an eye in frame 0 (right-facing); pins "faces the way it runs" in the spec. */
  eye: readonly [number, number];
}

export const REGGIE: RunnerArt = {
  name: "Reggie",
  frames: [
    [".......KK..KK.", ".........K.K..", "..KKKKKK.KK...", ".KTPPPPTKTTT..", "KKPPQQPPKTTK..", "KTPPPPQPKTTT..", "KPPPPQPPKTTT..", ".KPQQPPKTTTT..", ".KPPPQQKTTTK..", "KKKKKKKTTTUK..", "KUUUUUUUUUK..."],
    ["........KK..KK", ".........K.K..", "..KKKKKK..KK..", ".KTPPPPTKKTTK.", "KKPPQQPPPKKTK.", "KTPPPPQPPKTTK.", "KPPPPQPPQKTTK.", ".KPQQPPQKTTTK.", ".KPPPQQQKTTUK.", "KKKKKKKTTTUU..", "KUUUUUUUUUK..."],
    [".........K...K", "..........K.K.", "...KKKKKK.KKK.", "..KTPPPPTKTTTK", ".KPPPQQPPPTTKK", ".KTQPPPPPPTTTK", ".KPQPQPPPQTTTK", "..KPQPPQQKTTTK", "..KPPQQQQTTTU.", "KKKKKKKTTTUU..", "KUUUUUUUUUK..."],
  ],
  colors: { K: "#2B1B1E", P: "#F0A0D0", Q: "#C870A8", T: "#F8E0B0", U: "#C8A878" },
  eye: [12, 0],
};

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
  colors: { K: "#2B2B2B", R: "#D8402A", Y: "#F0B040", O: "#FF8A30" },
  eye: [9, 5],
};

export const BONEHEAD: RunnerArt = {
  name: "Bonehead",
  frames: [
    ["........", "..KKKKKK", ".KSSWWWK", "KSSSWWWK", "KSSKKWWK", "KSSKKWWK", ".KSSWWWK", "..KSWSWK", ".KWSSWWK", ".KSSWSSK", "..KKWSK."],
    ["..KKKKKK", ".KSSWWWK", "KSSSWWWK", "KSSSKWWK", "KSSKKWWK", ".KSSWWWK", "..KKWSWK", ".KKSSSSK", ".KSSSSSK", "..KWWWWK", ".KWSKKSK"],
    ["........", "..KKKKKK", ".KSSWWWK", "KSSSWWWK", "KSSKKWWK", "KSSKKWWK", ".KSSWWWK", "..KSWSWK", ".KWSSWWK", ".KSSWSSK", "..KKWWK."],
    ["..KKKKKK", ".KSSWWWK", "KSSSWWWK", "KSSSKWWK", "KSSKKWWK", ".KSSWWWK", "..KKWSWK", ".KKSSSSK", ".KSSSSSK", "..KSWWWK", ".KSSKKWK"],
  ],
  colors: { K: "#3D253B", W: "#E9CEC3", S: "#CCA9A4" },
  eye: [4, 4],
};

export const FANGS: RunnerArt = {
  name: "Fangs",
  frames: [
    ["............KK...", "...........KRRK..", "..........KRKRRK.", "..........KRRKRK.", "....K..KK.KRRRDK.", "...KRK.RRKRRRRRD.", "....KRKRRRRRDK...", "....KRRRRRRDD....", ".....RRDKDDDK...."],
    [".................", "............KKK..", "...........KRRRK.", "..........KRRKRR.", "..........KRRRRR.", "........KKKRRRRD.", ".......KRRKRRDK..", "...KRKRRRRRRDD...", "....KRRDKDRDD...."],
    [".................", ".................", "..............K..", ".............RRR.", "............KRKRR", "............KRKRR", "........KKKKKRRRR", "KK..KKKRRRRRRRRR.", "KRKRRRRRRRRRDDK.."],
    [".................", "............KKK..", "...........KRRRK.", "..........KRRKRR.", "..........KRRRRR.", "........KKKRRRRD.", ".......KRRKRRDK..", "...KRKRRRRRRDD...", "....KRRDKDRDD...."],
  ],
  colors: { K: "#4E3458", R: "#C54C67", D: "#923C5E" },
  eye: [12, 2],
};

export const SQUIRT: RunnerArt = {
  name: "Squirt",
  frames: [
    ["..........", "..........", "..........", "..........", "..KKKKKK..", ".KBLWLLLK.", "KBBLBBBLBK", "KBBBRRBBBK", "KKBBBBBBKK"],
    ["..........", "....KKK...", "...BWLLK..", "..KLLLLL..", "..KLLLLK..", "..KLRRBK..", "..KBBBBK..", "..KKKKKK..", "..KKKKKK.."],
    ["...KKKK...", "..KBWLLK..", "..KLLKLL..", "..KLLLLK..", "..KLRRBK..", "...BBBB...", "...KKKK...", "..KKKKKK..", "..KKKKKK.."],
    ["..........", "...KKKK...", "..KBBBBK..", "..KBWLLL..", ".KBLLLLLK.", ".KBLRRBLK.", "..KBBBBBK.", ".KKKKKKKK.", ".KKKKKKKK."],
    ["..........", "..........", "..........", "...KKKK...", "..KBLLLK..", "..BLWKLLK.", ".KBLBLLBK.", ".KBBRRBBK.", ".KKBBBBKK."],
    ["..........", "..........", "..........", "....KKK...", "..KLLLLB..", ".KBLWKLLB.", ".KBLBLLLB.", ".KBLRRBBB.", ".KKBBBBBK."],
  ],
  colors: { K: "#1A1F4A", B: "#4A7AB0", L: "#5CB0C0", W: "#FFFFFF", R: "#D83040" },
  eye: [4, 5],
};

export const CHICKEN: RunnerArt = {
  name: "Chicken",
  frames: [
    ["...........", ".....KRK...", ".....RRRK..", ".....WWRR..", "..KKKWWWWO.", ".WWWWWKWOOK", "KWWWWWWWOOK", "KWWWWWWWW..", ".KWWWWWWW..", "..OOKKOK...", ".....KOK..."],
    [".......KK..", "......KRRK.", ".....KWWRK.", "....KWWWWK.", ".KKKKWKWOK.", ".KWWWWWWOO.", ".WWWWWWWWO.", ".WWWWWWWW..", ".KWWWWWWK..", "....KOOK...", "....KOK...."],
    ["........KK.", "......KKRR.", ".....KWWRR.", "..KK.WWKOK.", ".KKKKWWWOOK", ".WWWWWWWWOK", "KWWWWWWWWK.", "KWWWWWWWWK.", ".KKWWWWWW..", "...KOKKOK..", "...KOKOOK.."],
    [".........K.", "........RRK", ".....KWWRR.", ".....WWWRK.", ".KKKKWKWOOO", "KWWWWWWWWOK", "KWWWWWWWWW.", ".KWWWWWWWW.", "..WWOWWWWK.", "..KWOOWWK..", "....KOOK..."],
    ["...........", ".......KRR.", ".....KWRRR.", "....KWWWRK.", "..KKKWWWWK.", ".KWWWWWWOOK", "KWWWWWWWWK.", "KWWWWWWWWK.", ".KWWWOOWW..", "..KKKOOK...", "....OO....."],
    [".....KKK...", ".....RRRK..", "....KWWRK..", "...KWWWWOK.", ".KKKWKWOOO.", ".KWWWWWWWK.", "KWWWWWWWW..", "KWWWWWWWW..", ".KWWWWWWK..", "...KOKKOO..", "...OO..KO.."],
    ["...........", ".....RRRK..", "....KRRRKK.", "....WWWOOO.", ".KKKWKWOO..", "KWWWWWWWWK.", "KWWWWWWWWK.", "KWWWWWWWWK.", ".KKWWWWWW..", "..KOKKKOK..", "..OO..KOK.."],
  ],
  colors: { W: "#FFFFFF", S: "#D0C8C8", K: "#4A3040", R: "#D83A3A", O: "#F0A030" },
  eye: [6, 5],
};

export const RUNNER_ART: readonly RunnerArt[] = [REGGIE, EMBER, BONEHEAD, FANGS, SQUIRT, CHICKEN];
