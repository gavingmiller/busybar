// Longship: a Viking longship rows across a rolling night sea, right to left,
// riding the swell, while two much smaller ships creep along the horizon
// behind it (parallax: smaller, slower, duller) under a twinkling sky.
// Pre-rendered seamless loop like the aquarium: every motion is a periodic
// function of t with an integer number of cycles per loop.

import { FRONT_WIDTH as W, FRONT_HEIGHT as H, type Scene } from "../../lib/scene.ts";
import { LONGSHIP_ART, SMALL_SHIP_ART, TINY_SHIP_ART, type ShipArt } from "./art.ts";

export const LONGSHIP_FPS = 24;
export const LONGSHIP_LOOP_S = 96;
export const LONGSHIP_FRAME_COUNT = LONGSHIP_FPS * LONGSHIP_LOOP_S;
/** Row of the far sea where the background ships float. */
export const HORIZON_Y = 11;
/** Row the longship's keel sits on. */
export const WATERLINE_Y = 13;

type RGB = readonly [number, number, number];
const SKY_STAR: readonly RGB[] = [[58, 64, 96], [128, 136, 168], [216, 220, 240]];
const HORIZON: RGB = [26, 52, 80];
const SEA_MID: RGB = [36, 74, 112];
const SEA_MID_CREST: RGB = [77, 127, 179];
const SEA_NEAR: RGB = [28, 59, 92];
const SEA_NEAR_CREST: RGB = [59, 106, 154];
const FOAM: RGB = [223, 232, 242];

export interface Ship {
  art: ShipArt;
  /** -1: sails left (the art is mirrored). */
  dir: 1 | -1;
  /** px/s. */
  speed: number;
  /** Seconds between the ship's appearances; the loop holds an integer number of them. */
  periodS: number;
  /** Seconds into the loop it first steps onto the right edge. */
  startS: number;
  /** Screen row the bottom row of the art sits on. */
  waterline: number;
  /** Rows of vertical bob, 0 for distant ships. */
  bob: number;
}

const artWidth = (a: ShipArt) => a.rows[0]!.length;

/** The longship: four voyages per loop (24 s each), 94 px of track at 3.92 px/s. */
export const FOREGROUND: Ship = {
  art: LONGSHIP_ART, dir: -1, periodS: 24, speed: (W + artWidth(LONGSHIP_ART)) / 24, startS: 0, waterline: WATERLINE_Y, bob: 1,
};
/** Distant ships: one pass per loop each, far slower, out of sight for the rest. */
export const BACKGROUND: readonly Ship[] = [
  { art: SMALL_SHIP_ART, dir: -1, periodS: 96, speed: 1.625, startS: 10, waterline: HORIZON_Y, bob: 0 },
  { art: TINY_SHIP_ART, dir: -1, periodS: 96, speed: 1.0, startS: 58, waterline: HORIZON_Y, bob: 0 },
];

/** Left edge of the ship at time t (seconds into the loop). Starts at the right edge each period. */
export function shipX(s: Ship, t: number): number {
  const tt = (((t - s.startS) % s.periodS) + s.periodS) % s.periodS;
  const d = s.speed * tt;
  return s.dir < 0 ? W - d : -artWidth(s.art) + d;
}

export function shipVisible(s: Ship, t: number): boolean {
  const x = shipX(s, t);
  return x > -artWidth(s.art) && x < W;
}

/** The ship's rows as drawn: mirrored when it sails left. */
export function shipRows(s: Ship): string[] {
  const rows = [...s.art.rows];
  return s.dir > 0 ? rows : rows.map((r) => r.split("").reverse().join(""));
}

/** Twinkling stars: fixed positions, each with a period that divides the loop. */
interface Star { x: number; y: number; periodS: number; phase: number }
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(0x10c5a1);
export const STARS: readonly Star[] = Array.from({ length: 26 }, () => ({
  x: Math.floor(random() * W),
  y: Math.floor(random() * (HORIZON_Y - 1)),
  periodS: [2, 3, 4, 6, 8][Math.floor(random() * 5)]!,
  phase: random() * Math.PI * 2,
}));

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function put(buf: Uint8Array, x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
}

/** One frame of the loop at frame index `i` (any integer; wraps). */
export function renderFrame(i: number): Uint8Array {
  const t = (((i % LONGSHIP_FRAME_COUNT) + LONGSHIP_FRAME_COUNT) % LONGSHIP_FRAME_COUNT) / LONGSHIP_FPS;
  const buf = new Uint8Array(W * H * 4);
  for (let p = 3; p < buf.length; p += 4) buf[p] = 255; // black sky

  // Stars.
  for (const s of STARS) {
    const b = 0.5 + 0.5 * Math.sin((t / s.periodS) * Math.PI * 2 + s.phase);
    put(buf, s.x, s.y, SKY_STAR[b > 0.78 ? 2 : b > 0.45 ? 1 : 0]!);
  }

  // Sea: horizon band, mid sea with crests sliding left at 9 px/s, near sea with crests at 6 px/s (both close on 96 s).
  for (let x = 0; x < W; x++) {
    put(buf, x, HORIZON_Y, HORIZON);
    const m = (((x + t * 9) % 18) + 18) % 18;
    put(buf, x, 12, m < 2 ? SEA_MID_CREST : SEA_MID);
    put(buf, x, 13, m >= 9 && m < 11 ? SEA_MID_CREST : SEA_MID);
    if (m < 1) put(buf, x, 12, FOAM);
    const n = (((x + t * 6) % 12) + 12) % 12;
    put(buf, x, 14, n < 2 ? SEA_NEAR_CREST : SEA_NEAR);
    put(buf, x, 15, n >= 6 && n < 8 ? SEA_NEAR_CREST : SEA_NEAR);
  }

  // Background ships first, so the longship passes in front of them.
  const ships = [...BACKGROUND, FOREGROUND];
  for (const s of ships) {
    if (!shipVisible(s, t)) continue;
    const rows = shipRows(s);
    const bob = s.bob ? Math.round(Math.sin((t / 2) * Math.PI * 2) * s.bob) : 0;
    const x0 = Math.round(shipX(s, t)), y0 = s.waterline - rows.length + 1 + bob;
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y]!.length; x++) {
      const ch = rows[y]![x]!;
      if (ch !== ".") put(buf, x0 + x, y0 + y, hex(s.art.colors[ch]!));
    }
  }
  return buf;
}

export const LONGSHIP: Scene = {
  id: "longship",
  name: "Longship",
  fps: LONGSHIP_FPS,
  frames: () => Array.from({ length: LONGSHIP_FRAME_COUNT }, (_, i) => renderFrame(i)),
};
