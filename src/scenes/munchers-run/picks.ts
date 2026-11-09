// TEMPORARY comparison scene: five candidates for one Munchers Run character
// stand in a row on the bar, each alternating between two poses, with its
// number above (Gavin 2026-11-09: "give me 5 different versions with a
// number over top so I can choose"). The winner moves into art/<name>.ts and
// the variants here are replaced by the next character's.
//
// Current subject: BONEHEAD. Sheet walkRight frames show him in profile:
// shaded back of skull, one big socket at the front, nose notch, teeth row,
// a short ribbed body with a swinging arm, two legs.
//   W bone  S shade  D dark bone (back of skull)  K plum outline  E socket  B bright bone
import { FRONT_WIDTH as W, FRONT_HEIGHT as H, type Scene } from "../../lib/scene.ts";
import type { RunnerArt } from "./art.ts";

const BONE = { W: "#EBD0C5", S: "#CCA8A3", D: "#A17877", K: "#4A2E44", E: "#120812" };
const BONE_HI = { ...BONE, B: "#F8ECE6" };
const BONE_OUTLINE = { ...BONE, K: "#6A4464" };

export const PICK_VARIANTS: readonly RunnerArt[] = [
  {
    name: "1 current body, black sockets",
    frames: [
      ["..KKKKKK..", ".KWWWWWWK.", "KWWWWWWWWK", "KSWEWWEEWK", "KSWEWWEEWK", "KSSWWWWWKK", ".KKWKWKWK.", "..KSWWWK..", "..KSWWWK..", ".KSK..KWK."],
      ["..KKKKKK..", ".KWWWWWWK.", "KWWWWWWWWK", "KSWEWWEEWK", "KSWEWWEEWK", "KSSWWWWWKK", ".KKWKWKWK.", "..KSWWWK..", "..KSWWWK..", "..KWK..KSK"],
    ],
    colors: BONE,
    eye: [6, 3],
  },
  {
    name: "2 big skull, nose hole",
    frames: [
      ["..KKKKKK..", ".KWWWWWWK.", "KWWWWWWWWK", "KSWWWWEEWK", "KSWWWWEEWK", "KSSWWWEWKK", ".KKWKWKWK.", "..KKSWWKK.", "...KSWWK..", ".KSK..KWK."],
      ["..KKKKKK..", ".KWWWWWWK.", "KWWWWWWWWK", "KSWWWWEEWK", "KSWWWWEEWK", "KSSWWWEWKK", ".KKWKWKWK.", "..KKSWWKK.", "...KSWWK..", "..KWK..KSK"],
    ],
    colors: BONE,
    eye: [6, 3],
  },
  {
    name: "3 current body, black sockets, swinging arm",
    frames: [
      ["..KKKKKK..", ".KWWWWWWK.", "KWWWWWWWWK", "KSWEWWEEWK", "KSWEWWEEWK", "KSSWWWWWKK", ".KKWKWKWK.", "..KSWWWKW.", "..KSWWWK..", ".KSK..KWK."],
      ["..KKKKKK..", ".KWWWWWWK.", "KWWWWWWWWK", "KSWEWWEEWK", "KSWEWWEEWK", "KSSWWWWWKK", ".KKWKWKWK.", ".WKSWWWK..", "..KSWWWK..", "..KWK..KSK"],
    ],
    colors: BONE,
    eye: [6, 3],
  },
  {
    name: "4 big skull, highlight, fewer teeth",
    frames: [
      ["..KKKKKK..", ".KBWWWWWK.", "KBWWWWWWWK", "KSWWWWEEWK", "KSWWWWEEWK", "KSSWWWWWKK", ".KKKWKWKK.", "..KKSWWKK.", "...KSWWK..", ".KSK..KWK."],
      ["..KKKKKK..", ".KBWWWWWK.", "KBWWWWWWWK", "KSWWWWEEWK", "KSWWWWEEWK", "KSSWWWWWKK", ".KKKWKWKK.", "..KKSWWKK.", "...KSWWK..", "..KWK..KSK"],
    ],
    colors: BONE_HI,
    eye: [6, 3],
  },
  {
    name: "5 big skull, brighter outline",
    frames: [
      ["..KKKKKK..", ".KWWWWWWK.", "KWWWWWWWWK", "KSWWWWEEWK", "KSWWWWEEWK", "KSSWWWWWKK", ".KKWKWKWK.", "..KKSWWKK.", "...KSWWK..", ".KSK..KWK."],
      ["..KKKKKK..", ".KWWWWWWK.", "KWWWWWWWWK", "KSWWWWEEWK", "KSWWWWEEWK", "KSSWWWWWKK", ".KKWKWKWK.", "..KKSWWKK.", "...KSWWK..", "..KWK..KSK"],
    ],
    colors: BONE_OUTLINE,
    eye: [6, 3],
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
/** Pose A 8 frames, pose B 4 frames; four cycles per 2 s loop. */
const CYCLE = 12;
export const PICKS_FRAME_COUNT = CYCLE * 4;
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
  const k = (((i % PICKS_FRAME_COUNT) + PICKS_FRAME_COUNT) % PICKS_FRAME_COUNT) % CYCLE < 8 ? 0 : 1;
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
  frames: () => Array.from({ length: PICKS_FRAME_COUNT }, (_, i) => renderPicksFrame(i)),
};
