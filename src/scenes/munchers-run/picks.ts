// TEMPORARY comparison scene: five candidates for one Munchers Run character
// stand in a row on the bar, each alternating between two poses, with its
// number above (Gavin 2026-11-09: "give me 5 different versions with a
// number over top so I can choose"). The winner moves into art/<name>.ts and
// the variants here are replaced by the next character's.
//
// Current subject: SAMUS ARAN, round 9: narrow-belly build settled;
// five smaller helmets.
//   letters per palette below
// Horns rise from the mask's outer edges and curve IN at the tips (Gavin 2026-11-09: "outward inward, not inward outward").
import { FRONT_WIDTH as W, FRONT_HEIGHT as H, type Scene } from "../../lib/scene.ts";
import type { RunnerArt } from "./art.ts";

// Hollow Knight palette from fog-canyon/art.ts: bone mask, eye hollows, black body, navy cloak, pale nail.
// Gavin 2026-11-09: the body was too dark; body takes the old cloak navy, the cloak goes a step darker.
const MASK = { W: "#F2F2F4", E: "#0A0A12" };
const C1 = { ...MASK, K: "#34407A", N: "#4A5AA8" };
const C2 = { ...MASK, K: "#3E4C8C", N: "#5A6CC0" };
const C3 = { ...MASK, K: "#4858A0", N: "#6C80D4" };
const C4 = { ...MASK, K: "#5262B0", N: "#8094E4" };
const C5 = { ...MASK, K: "#4A3C8C", N: "#7A68C8" };

// Samus Aran (Metroid), hand-drawn facing right from Gavin's two references (16-bit standing sprite,
// cross-stitch running pose): red helmet with a lime visor, red chest, big round orange shoulders,
// yellow belly, orange legs, teal arm cannon leading. No outlines: the bar's black does that job.
//   R helmet/chest  G visor  O shoulders/limbs  Y belly  C arm cannon
const SAMUS        = { R: "#B82020", G: "#A8E040", O: "#E87020", Y: "#F0D040", C: "#30A090" };
const SAMUS_BRIGHT = { R: "#D83030", G: "#60D070", O: "#F0A030", Y: "#F8E060", C: "#40B8A8" };
// Run-cycle legs: N near leg (bright), D far leg (darker), B/b boots near/far.
const SAMUS_RUN = { ...SAMUS_BRIGHT, N: "#F0A030", D: "#B86020", B: "#D83030", b: "#901818" };

export const PICK_VARIANTS: readonly RunnerArt[] = [
  {
    name: "1 two-row helmet",
    frames: [
      [".........", ".........", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..DD.NN..", ".DD...NN."],
      [".........", ".........", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..DD.NN..", "..D...NN."],
      [".........", ".........", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...DNN...", "....NN..."],
      [".........", ".........", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...NND...", "....NN..."],
      [".........", ".........", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..NN.DD..", ".NN...DD."],
      [".........", ".........", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..NN.DD..", "..N...DD."],
      [".........", ".........", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...NDD...", "....DD..."],
      [".........", ".........", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...DDN...", "....DD..."],
    ],
    colors: SAMUS_RUN,
    eye: [5, 2],
  },
  {
    name: "2 four-wide helmet",
    frames: [
      [".........", "...RRR...", "..RRGG...", "..RRGG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..DD.NN..", ".DD...NN."],
      [".........", "...RRR...", "..RRGG...", "..RRGG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..DD.NN..", "..D...NN."],
      [".........", "...RRR...", "..RRGG...", "..RRGG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...DNN...", "....NN..."],
      [".........", "...RRR...", "..RRGG...", "..RRGG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...NND...", "....NN..."],
      [".........", "...RRR...", "..RRGG...", "..RRGG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..NN.DD..", ".NN...DD."],
      [".........", "...RRR...", "..RRGG...", "..RRGG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..NN.DD..", "..N...DD."],
      [".........", "...RRR...", "..RRGG...", "..RRGG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...NDD...", "....DD..."],
      [".........", "...RRR...", "..RRGG...", "..RRGG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...DDN...", "....DD..."],
    ],
    colors: SAMUS_RUN,
    eye: [5, 2],
  },
  {
    name: "3 three-wide helmet, slit visor",
    frames: [
      [".........", "...RRR...", "...RGG...", "...RRG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..DD.NN..", ".DD...NN."],
      [".........", "...RRR...", "...RGG...", "...RRG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..DD.NN..", "..D...NN."],
      [".........", "...RRR...", "...RGG...", "...RRG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...DNN...", "....NN..."],
      [".........", "...RRR...", "...RGG...", "...RRG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...NND...", "....NN..."],
      [".........", "...RRR...", "...RGG...", "...RRG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..NN.DD..", ".NN...DD."],
      [".........", "...RRR...", "...RGG...", "...RRG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..NN.DD..", "..N...DD."],
      [".........", "...RRR...", "...RGG...", "...RRG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...NDD...", "....DD..."],
      [".........", "...RRR...", "...RGG...", "...RRG...", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...DDN...", "....DD..."],
    ],
    colors: SAMUS_RUN,
    eye: [5, 2],
  },
  {
    name: "4 two-row, four-wide helmet",
    frames: [
      [".........", ".........", "...RRGG..", "...RRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..DD.NN..", ".DD...NN."],
      [".........", ".........", "...RRGG..", "...RRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..DD.NN..", "..D...NN."],
      [".........", ".........", "...RRGG..", "...RRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...DNN...", "....NN..."],
      [".........", ".........", "...RRGG..", "...RRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...NND...", "....NN..."],
      [".........", ".........", "...RRGG..", "...RRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..NN.DD..", ".NN...DD."],
      [".........", ".........", "...RRGG..", "...RRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..NN.DD..", "..N...DD."],
      [".........", ".........", "...RRGG..", "...RRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...NDD...", "....DD..."],
      [".........", ".........", "...RRGG..", "...RRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...DDN...", "....DD..."],
    ],
    colors: SAMUS_RUN,
    eye: [5, 2],
  },
  {
    name: "5 small rounded dome",
    frames: [
      [".........", "....RR...", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..DD.NN..", ".DD...NN."],
      [".........", "....RR...", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..DD.NN..", "..D...NN."],
      [".........", "....RR...", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...DNN...", "....NN..."],
      [".........", "....RR...", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...NND...", "....NN..."],
      [".........", "....RR...", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..NN.DD..", ".NN...DD."],
      [".........", "....RR...", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "..NN.DD..", "..N...DD."],
      [".........", "....RR...", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...NDD...", "....DD..."],
      [".........", "....RR...", "...RRGG..", "..RRRGG..", ".OORRRR..", ".OOYYOCCC", "..OYY..CC", "..OYYO...", "...DDN...", "....DD..."],
    ],
    colors: SAMUS_RUN,
    eye: [5, 2],
  },
];

/** 3x5 digit glyphs, "#" lit. */
export const DIGITS: Record<number, readonly string[]> = {
  1: [".#.", "##.", ".#.", ".#.", "###"],
  2: ["###", "..#", "###", "#..", "###"],
  3: ["###", "..#", "###", "..#", "###"],
  4: ["#.#", "#.#", "###", "..#", "..#"],
  5: ["###", "#..", "###", "..#", "###"],
};

export const PICK_SLOT_W = 14;
export const PICKS_FPS = 24;
/** Four display frames per pose (6 poses/s); 24 poses per 4 s loop so 1-, 2-, 3-, 4-, 6- and 8-frame cycles all close. */
const POSE_FRAMES = 4;
export const PICKS_FRAME_COUNT = POSE_FRAMES * 24;
const DIGIT_RGB: [number, number, number] = [0xf0, 0xb0, 0x40];
/** Backdrop behind the line-up: black by default; the scene colour when a character's body is black (Fog Canyon's fog). */
export const PICKS_BG: [number, number, number] = [0, 0, 0];

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function put(buf: Uint8Array, x: number, y: number, c: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
}

export function renderPicksFrame(i: number): Uint8Array {
  const buf = new Uint8Array(W * H * 4);
  for (let p = 0; p < buf.length; p += 4) { buf[p] = PICKS_BG[0]; buf[p + 1] = PICKS_BG[1]; buf[p + 2] = PICKS_BG[2]; buf[p + 3] = 255; }
  const k = Math.floor((((i % PICKS_FRAME_COUNT) + PICKS_FRAME_COUNT) % PICKS_FRAME_COUNT) / POSE_FRAMES);
  PICK_VARIANTS.forEach((v, n) => {
    const x0 = 1 + n * PICK_SLOT_W;
    const glyph = DIGITS[n + 1]!;
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (glyph[y]![x] === "#") put(buf, x0 + 6 + x, y, DIGIT_RGB);
    const rows = v.frames[k % v.frames.length]!;
    const w = rows[0]!.length, sx = x0 + 1 + Math.floor((12 - w) / 2), sy = H - rows.length;
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < w; x++) {
      const ch = rows[y]![x]!;
      if (ch !== ".") put(buf, sx + x, sy + y, hex(v.colors[ch]!));
    }
  });
  return buf;
}

export const CHARACTER_PICKS: Scene = {
  id: "picks",
  name: "Character Picks",
  fps: PICKS_FPS,
  debug: true,
  frames: () => Array.from({ length: PICKS_FRAME_COUNT }, (_, i) => renderPicksFrame(i)),
};
