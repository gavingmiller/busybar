// TEMPORARY comparison scene: five candidates for one Munchers Run character
// stand in a row on the bar, each alternating between two poses, with its
// number above (Gavin 2026-11-09: "give me 5 different versions with a
// number over top so I can choose"). The winner moves into art/<name>.ts and
// the variants here are replaced by the next character's.
//
// Current subject: the KNIGHT from Fog Canyon (Gavin: "give me 5 options
// for him"). Five hand-drawn takes at 6-8 px wide, shown on the fog colour
// so the black body reads as it does in the scene.
//   W mask  E eye hollow  K body  N cloak  L nail
import { FRONT_WIDTH as W, FRONT_HEIGHT as H, type Scene } from "../../lib/scene.ts";
import type { RunnerArt } from "./art.ts";

// Hollow Knight palette from fog-canyon/art.ts: bone mask, eye hollows, black body, navy cloak, pale nail.
const HK = { W: "#F2F2F4", E: "#0A0A12", K: "#0C0C14", N: "#2A3560", L: "#B8BCC8" };
const HK_LIFT = { ...HK, K: "#1E1E2A" };

export const PICK_VARIANTS: readonly RunnerArt[] = [
  {
    name: "1 as in Fog Canyon, 6x9",
    frames: [
      ["W....W", ".W..W.", ".WWWW.", "WWEWEW", ".WWWW.", "NNKKN.", ".NKKN.", ".NKK..", ".K..K."],
      ["W....W", ".W..W.", ".WWWW.", "WWEWEW", ".WWWW.", ".NKKN.", ".NKKN.", "NNKK..", "..KK.."],
    ],
    colors: HK,
    eye: [2, 3],
  },
  {
    name: "2 taller, long horns, 7x10",
    frames: [
      ["W.....W", ".W...W.", ".WWWWW.", ".WEWEW.", ".WWWWW.", "NNKKKN.", ".NKKKN.", ".NKKK..", ".NKK...", ".K..K.."],
      ["W.....W", ".W...W.", ".WWWWW.", ".WEWEW.", ".WWWWW.", ".NKKKN.", ".NKKKN.", "NNKKK..", ".NKK...", "..K.K.."],
    ],
    colors: HK,
    eye: [2, 3],
  },
  {
    name: "3 nail on his back, 8x10",
    frames: [
      ["..W....W", "...W..W.", "L..WWWW.", ".L.WEWEW", "..LWWWW.", ".NNNKKN.", "..NNKKN.", "..NNKK..", "...NKK..", "...K..K."],
      ["..W....W", "...W..W.", "L..WWWW.", ".L.WEWEW", "..LWWWW.", "..NNKKN.", "..NNKKN.", ".NNNKK..", "...NKK..", "....KK.."],
    ],
    colors: HK,
    eye: [4, 3],
  },
  {
    name: "4 lifted body, big eyes, 6x10",
    frames: [
      ["W....W", ".W..W.", ".WWWW.", "WWEWEW", "WWEWEW", ".WWWW.", "NNKKN.", ".NKKN.", ".NKK..", ".K..K."],
      ["W....W", ".W..W.", ".WWWW.", "WWEWEW", "WWEWEW", ".WWWW.", ".NKKN.", ".NKKN.", "NNKK..", "..KK.."],
    ],
    colors: HK_LIFT,
    eye: [2, 3],
  },
  {
    name: "5 chibi: big mask, tiny body, 7x9",
    frames: [
      ["W.....W", ".W...W.", ".WWWWW.", "WWWWWWW", "WWEWWEW", ".WWWWW.", ".NNKNN.", "..NKN..", "..K.K.."],
      ["W.....W", ".W...W.", ".WWWWW.", "WWWWWWW", "WWEWWEW", ".WWWWW.", "..NKN..", ".NNKNN.", "...K..."],
    ],
    colors: HK,
    eye: [2, 4],
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
/** Backdrop behind the line-up: black by default; the scene colour when a character's body is black (Fog Canyon's fog). */
export const PICKS_BG: [number, number, number] = [12, 40, 34];

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
