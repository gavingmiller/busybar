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
  /** Optional poses played in place when the scene stops this runner mid-run (same box as `frames`). */
  dance?: readonly (readonly string[])[];
}






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

// The five Number Munchers characters are hand-drawn at bar scale in art/*.ts
// (the downscaled sheet versions read as blobs on the bar, Gavin 2026-11-09).
import { REGGIE } from "./art/reggie.ts";
import { EMBER } from "./art/ember.ts";
import { BONEHEAD } from "./art/bonehead.ts";
import { FANGS } from "./art/fangs.ts";
import { SQUIRT } from "./art/squirt.ts";
export { REGGIE, EMBER, BONEHEAD, FANGS, SQUIRT };

export const RUNNER_ART: readonly RunnerArt[] = [REGGIE, EMBER, BONEHEAD, FANGS, SQUIRT, CHICKEN];
