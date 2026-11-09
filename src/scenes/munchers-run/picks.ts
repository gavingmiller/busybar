// TEMPORARY comparison scene: five candidates for one Munchers Run character
// stand in a row on the bar, each alternating between two poses, with its
// number above (Gavin 2026-11-09: "give me 5 different versions with a
// number over top so I can choose"). The winner moves into art/<name>.ts and
// the variants here are replaced by the next character's.
//
// Current subject: REGGIE the snail (Gavin: "it's not great"). The sheet
// shows a big round pink spiral shell, an upright cream head at the front
// with one black eye and two antennae, and a cream foot. The bar version is
// 17 px wide; these are 12 wide so five fit, with the spiral kept legible.
//   K plum outline  P pink  D dark spiral  H mid spiral  L highlight  T cream  U dark cream  E eye
import { FRONT_WIDTH as W, FRONT_HEIGHT as H, type Scene } from "../../lib/scene.ts";
import type { RunnerArt } from "./art.ts";

// Reggie palette, lifted from the sheet: plum outline, pinks for the shell and spiral, cream body.
const SNAIL = { K: "#3A1A33", P: "#FFA9E1", D: "#A03C80", H: "#D563AD", L: "#FFD8F2", T: "#FCE5A9", U: "#DEC481", E: "#140A14", W: "#FFFFFF" };

export const PICK_VARIANTS: readonly RunnerArt[] = [
  {
    name: "1 open shell, skinny outlined body",
    frames: [
      ["........K..K", "........KTTK", "..PPPP..KTEK", ".PPPPPP.KTTK", "PPPDDDPPKTTK", "PPDPPDPPKTTK", "PPDPDDPPKTTK", "PPPDPPPPTTTK", ".PPPPPPTTTTK", ".KTTTTTTTTTK"],
      ["........K..K", "........KTTK", "..PPPP..KTEK", ".PPPPPP.KTTK", "PPPDDDPPKTTK", "PPDPPDPPKTTK", "PPDPDDPPKTTK", "PPPDPPPPTTTK", ".PPPPPPTTTTK", "KTTTTTTTTTTK"],
    ],
    colors: SNAIL,
    eye: [10, 2],
  },
  {
    name: "2 plus shell highlight",
    frames: [
      ["........K..K", "........KTTK", "..PPPP..KTEK", ".PLLPPP.KTTK", "PLPDDDPPKTTK", "PPDPPDPPKTTK", "PPDPDDPPKTTK", "PPPDPPPPTTTK", ".PPPPPPTTTTK", ".KTTTTTTTTTK"],
      ["........K..K", "........KTTK", "..PPPP..KTEK", ".PLLPPP.KTTK", "PLPDDDPPKTTK", "PPDPPDPPKTTK", "PPDPDDPPKTTK", "PPPDPPPPTTTK", ".PPPPPPTTTTK", "KTTTTTTTTTTK"],
    ],
    colors: SNAIL,
    eye: [10, 2],
  },
  {
    name: "3 taller shell",
    frames: [
      ["........K..K", "..PPPP..KTTK", ".PPPPPP.KTEK", "PPPDDDPPKTTK", "PPDPPPDPKTTK", "PPDPDDDPKTTK", "PPDPPDPPKTTK", "PPPDDPPPTTTK", ".PPPPPPTTTTK", ".KTTTTTTTTTK"],
      ["........K..K", "..PPPP..KTTK", ".PPPPPP.KTEK", "PPPDDDPPKTTK", "PPDPPPDPKTTK", "PPDPDDDPKTTK", "PPDPPDPPKTTK", "PPPDDPPPTTTK", ".PPPPPPTTTTK", "KTTTTTTTTTTK"],
    ],
    colors: SNAIL,
    eye: [10, 2],
  },
  {
    name: "4 no outline anywhere, thinner neck",
    frames: [
      [".........K.K", ".........TT.", "..PPPP...TE.", ".PPPPPP..TT.", "PPPDDDPP.TT.", "PPDPPDPP.TT.", "PPDPDDPP.TT.", "PPPDPPPPTTT.", ".PPPPPPTTTT.", ".UTTTTTTTTU."],
      [".........K.K", ".........TT.", "..PPPP...TE.", ".PPPPPP..TT.", "PPPDDDPP.TT.", "PPDPPDPP.TT.", "PPDPDDPP.TT.", "PPPDPPPPTTT.", ".PPPPPPTTTT.", "UTTTTTTTTTU."],
    ],
    colors: SNAIL,
    eye: [10, 2],
  },
  {
    name: "5 two-tone spiral, eye glint",
    frames: [
      ["........K..K", "........KTTK", "..PPPP..KWEK", ".PPPPPP.KTTK", "PPPDDHPPKTTK", "PPDHHDPPKTTK", "PPDHDDPPKTTK", "PPPDPPPPTTTK", ".PPPPPPTTTTK", ".KTTTTTTTTTK"],
      ["........K..K", "........KTTK", "..PPPP..KWEK", ".PPPPPP.KTTK", "PPPDDHPPKTTK", "PPDHHDPPKTTK", "PPDHDDPPKTTK", "PPPDPPPPTTTK", ".PPPPPPTTTTK", "KTTTTTTTTTTK"],
    ],
    colors: SNAIL,
    eye: [10, 2],
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
