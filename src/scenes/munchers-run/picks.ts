// TEMPORARY comparison scene: five candidates for one Munchers Run character
// stand in a row on the bar, each alternating between two poses, with its
// number above (Gavin 2026-11-09: "give me 5 different versions with a
// number over top so I can choose"). The winner moves into art/<name>.ts and
// the variants here are replaced by the next character's.
//
// Current subject: the RAVENS (js-apps/app.gavin.ravens; Gavin: "a titch
// smaller, they're pretty fat"). The app's 14x11 flight frames majority-
// shrunk to five smaller boxes by scratchpad raven-shrink.ts, eye and beak
// re-placed; the winner is hand-tuned into the app's sprites.ts.
//   K body  B feather highlight  E eye  Y beak and feet
import { FRONT_WIDTH as W, FRONT_HEIGHT as H, type Scene } from "../../lib/scene.ts";
import type { RunnerArt } from "./art.ts";

// Ravens palette, from js-apps/app.gavin.ravens/src/sprites.ts.
const RAVEN = { K: "#3C4650", B: "#8A929A", E: "#FFFFFF", Y: "#E6B428" };
const RAVEN_LIGHT = { ...RAVEN, K: "#4E5A66" };

export const PICK_VARIANTS: readonly RunnerArt[] = [
  {
    name: "1 10x8 as picked",
    frames: [
      ["..KKK.....", ".KKKKK....", "KKBBKKKEYY", "..BBBKKKKY", "...KBKKKKK", "....KKKKK.", "...KKKKKK.", "...YY...Y."],
      [".KKK......", ".KKKK.....", ".KBKKKKEYY", "..KBKKKKKY", "...KBKKKKK", "....KKKKK.", "...KKKKK..", "...KKKK.Y."],
      [".......KK.", "......KEYY", ".....KKKKY", "....KKKKK.", "...KKKKKK.", "..KKKKKKK.", "..KKKKKKK.", "...Y.KKKK."],
      ["......KKK.", ".....KKEYY", "....KKKKKY", "...KKKKKK.", "...KKKKKK.", "..KKKKKKB.", "..KKKKKKB.", ".....KKKK."],
      ["..........", "....KK.KK.", "...KKKKEYY", "..KKKKKKKK", "..KKKKKKK.", "...KKKKK..", "...KKKKKY.", ".........."],
    ],
    colors: RAVEN,
    eye: [7, 2],
  },
  {
    name: "2 10x7 flatter",
    frames: [
      ["..KKK.....", "KKKKKKKKK.", "..KBKKKEYY", "...BBKKKKY", "....KKKKK.", "...KKKKKK.", "...YY...Y."],
      [".KKK......", ".KKKKKKK..", "..KKKKKEYY", "...BKKKKKY", "....KKKKKK", "...KKKKKK.", "...KKKK.Y."],
      [".......KK.", ".....KKEYY", "....KKKKKK", "...KKKKKK.", "..KKKKKKK.", "..KKKKKKK.", "...Y.KKKK."],
      ["......KKK.", ".....KKEYY", "....KKKKK.", "...KKKKKK.", "..KKKKKKB.", "..KKKKKKB.", ".....KKKK."],
      ["..........", "...KKKKEYY", "..KKKKKKKY", "..KKKKKKKK", "..KKKKKK..", "...KKKKKY.", ".........."],
    ],
    colors: RAVEN,
    eye: [7, 2],
  },
  {
    name: "3 9x8 narrower",
    frames: [
      ["..KKK....", ".KKKKK...", "KKBBKKEYY", "..BBBKKKY", "...KBKKKK", "...KKKKK.", "...KBKKK.", "...YY.Y.."],
      [".KKK.....", ".KKKK....", ".KKKKKEYY", "..KBKKKKY", "...KKKKKK", "...KBKKK.", "...KBKKK.", "...KKKY.."],
      ["......KK.", ".....KEYY", "....KKKKY", "...KKKKK.", "...KKKKK.", "..KKKKKB.", "..KKKKKK.", "....KKKK."],
      [".....KKK.", ".....KEYY", "....KKKKY", "...KKKKK.", "...KKKKK.", "..KKKKKB.", "..KKKKKK.", "....KKKK."],
      [".........", "....KKKK.", "..KKKKEYY", "..KKKKKKK", "..KKKKKK.", "..KKKKKK.", "...KBKKY.", "......Y.."],
    ],
    colors: RAVEN,
    eye: [6, 2],
  },
  {
    name: "4 9x7 smallest",
    frames: [
      ["..KKK....", "KKKKKKKK.", ".KKBKKEYY", "..BBBKKKY", "...KKKKK.", "...KKKKK.", "...YY.Y.."],
      [".KKK.....", ".KKKKKK..", ".KBKKKEYY", "..KBKKKKY", "...KBKKKK", "...KKKKK.", "...KKKY.."],
      ["......KK.", ".....KEYY", "....KKKKK", "...KKKKK.", "..KKKKKB.", "..KKKKKK.", "....KKKK."],
      [".....KKK.", "....KKEYY", "...KKKKK.", "...KKKKK.", "..KKKKKB.", "..KKKKKB.", "....KKKK."],
      [".........", "...KKKEYY", "..KKKKKKY", "..KKKKKKK", "..KKKKKK.", "...KBKKK.", "......Y.."],
    ],
    colors: RAVEN,
    eye: [6, 2],
  },
  {
    name: "5 10x8 solid, lighter body",
    frames: [
      ["..KKK.....", ".KKKKK....", "KKKKKKKEYY", "..KKKKKKKY", "...KKKKKKK", "....KKKKK.", "...KKKKKK.", "...YY...Y."],
      [".KKK......", ".KKKK.....", ".KKKKKKEYY", "..KKKKKKKY", "...KKKKKKK", "....KKKKK.", "...KKKKK..", "...KKKK.Y."],
      [".......KK.", "......KEYY", ".....KKKKY", "....KKKKK.", "...KKKKKK.", "..KKKKKKK.", "..KKKKKKK.", "...Y.KKKK."],
      ["......KKK.", ".....KKEYY", "....KKKKKY", "...KKKKKK.", "...KKKKKK.", "..KKKKKKK.", "..KKKKKKK.", ".....KKKK."],
      ["..........", "....KK.KK.", "...KKKKEYY", "..KKKKKKKK", "..KKKKKKK.", "...KKKKK..", "...KKKKKY.", ".........."],
    ],
    colors: RAVEN_LIGHT,
    eye: [7, 2],
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
/** Four display frames per pose (6 poses/s); 60 poses per 10 s loop so 1- to 6-frame cycles all close. */
const POSE_FRAMES = 4;
export const PICKS_FRAME_COUNT = POSE_FRAMES * 60;
const DIGIT_RGB: [number, number, number] = [0xf0, 0xb0, 0x40];

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function put(buf: Uint8Array, x: number, y: number, c: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
}

export function renderPicksFrame(i: number): Uint8Array {
  const buf = new Uint8Array(W * H * 4);
  for (let p = 3; p < buf.length; p += 4) buf[p] = 255;
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
