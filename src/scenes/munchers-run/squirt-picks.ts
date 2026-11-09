// TEMPORARY comparison scene (Gavin 2026-11-09: "the water blob could be
// better, give me 5 different versions with a number over top"). Five Squirt
// candidates stand in a row on the bar, each wobbling rest → squash, with its
// number above. The winner becomes art/squirt.ts; this file then goes away.
//   B body  S shade  H gloss  L light rim  W eye white / highlight  K pupil  R mouth
import { FRONT_WIDTH as W, FRONT_HEIGHT as H, type Scene } from "../../lib/scene.ts";
import type { RunnerArt } from "./art.ts";

// Palette lifted from the Number Munchers sheet: navy outline, teal → blue → dark-blue body, dark grin line, grey shadow.
const BRIGHT = { O: "#3D4FB0", T: "#65B1B8", M: "#4D8AB3", D: "#425B9E", G: "#33418A", W: "#FFFFFF", K: "#000000", R: "#B83048" };
const ORIG = { O: "#1D235D", T: "#65B1B8", M: "#4D8AB3", D: "#425B9E", G: "#33418A", W: "#FFFFFF", K: "#000000", R: "#B83048", X: "#505058" };

export const SQUIRT_VARIANTS: readonly RunnerArt[] = [
  {
    name: "1 lean, brighter outline",
    frames: [
      ["............", "............", "............", ".....OOOOO..", "....OWTTTTO.", "...OTTTWTWTO", "...OMTTKTKTO", "..OMMMMGRRGO", "..ODDDDDDDO.", "...OOOOOOO.."],
      ["............", "............", "............", "............", "....OOOOOOO.", "..OOWTTTWTWO", ".OMMTTTTKTKO", ".OMMMMMGRRGO", ".ODDDDDDDDDO", "..OOOOOOOOO."],
    ],
    colors: BRIGHT,
    eye: [7, 6],
  },
  {
    name: "2 lean, trailing fin",
    frames: [
      ["............", "............", "............", ".....OOOOO..", "....OWTTTTO.", "...OTTTWTWTO", "...OMTTKTKTO", ".MOMMMMGRRGO", "..ODDDDDDDO.", "...OOOOOOO.."],
      ["............", "............", "............", "............", "....OOOOOOO.", "..OOWTTTWTWO", ".OMMTTTTKTKO", "MOMMMMMGRRGO", ".ODDDDDDDDDO", "..OOOOOOOOO."],
    ],
    colors: ORIG,
    eye: [7, 6],
  },
  {
    name: "3 lean, droplets behind",
    frames: [
      ["............", "............", "............", ".....OOOOO..", ".T..OWTTTTO.", "...OTTTWTWTO", "T..OMTTKTKTO", "..OMMMMGRRGO", "..ODDDDDDDO.", ".T.OOOOOOO.."],
      ["............", "............", "............", "............", "....OOOOOOO.", "T.OOWTTTWTWO", ".OMMTTTTKTKO", ".OMMMMMGRRGO", ".ODDDDDDDDDO", "T.OOOOOOOOO."],
    ],
    colors: ORIG,
    eye: [7, 6],
  },
  {
    name: "4 lean, ground shadow",
    frames: [
      ["............", "............", "............", ".....OOOOO..", "....OWTTTTO.", "...OTTTWTWTO", "...OMTTKTKTO", "..OMMMMGRRGO", "...OOOOOOO..", "..XXXXXXXXX."],
      ["............", "............", "............", "............", "....OOOOOOO.", "..OOWTTTWTWO", ".OMMTTTTKTKO", ".OMMMMMGRRGO", "..OOOOOOOOO.", "..XXXXXXXXX."],
    ],
    colors: ORIG,
    eye: [7, 6],
  },
  {
    name: "5 harder lean, mouth forward",
    frames: [
      ["............", "............", "............", "......OOOOO.", ".....OWTTTTO", "....OTTTWTWO", "...OMTTTKTKO", "..OMMMMMGRRO", ".ODDDDDDDDDO", "..OOOOOOOOO."],
      ["............", "............", "............", "............", ".....OOOOOOO", "...OOWTTWTWO", "..OMMTTTKTKO", ".OMMMMMMGRRO", ".ODDDDDDDDDO", "..OOOOOOOOO."],
    ],
    colors: ORIG,
    eye: [8, 6],
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
/** Rest 8 frames, squash 4 frames; four wobbles per 2 s loop. */
const WOBBLE_PERIOD = 12;
export const PICKS_FRAME_COUNT = WOBBLE_PERIOD * 4;
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
  const k = (((i % PICKS_FRAME_COUNT) + PICKS_FRAME_COUNT) % PICKS_FRAME_COUNT) % WOBBLE_PERIOD < 8 ? 0 : 1;
  SQUIRT_VARIANTS.forEach((v, n) => {
    const x0 = 1 + n * PICK_SLOT_W;
    const glyph = DIGITS[n + 1]!;
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (glyph[y]![x] === "#") put(buf, x0 + 6 + x, y, DIGIT_RGB);
    const rows = v.frames[k % v.frames.length]!;
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y]!.length; x++) {
      const ch = rows[y]![x]!;
      if (ch !== ".") put(buf, x0 + 1 + x, 6 + y, hex(v.colors[ch]!));
    }
  });
  return buf;
}

export const SQUIRT_PICKS: Scene = {
  id: "squirt_picks",
  name: "Squirt Picks",
  fps: PICKS_FPS,
  frames: () => Array.from({ length: PICKS_FRAME_COUNT }, (_, i) => renderPicksFrame(i)),
};
