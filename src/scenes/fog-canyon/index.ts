// Fog Canyon: Hallownest's green murk. Uomas and Oomas drift and bob in
// the haze above a mossy floor, their cores flickering pink and orange,
// bubbles rise through drifting fog streaks and a slow mist band, a Metroid
// hunts lower down (Gavin 2026-11-09: one of the Fog Canyon baddies), and the
// Knight walks through: once left to right (pausing mid-way to look up at
// the jellies), later once right to left; Hornet dashes through twice too,
// at other times, so the two are never on screen together; and once a loop,
// in a gap when nobody else is about, Samus sprints through left to right
// (Gavin 2026-11-09: "running through rarely"). Everything is a periodic function
// of t with an integer number of cycles per 96 s loop, so the pre-rendered
// loop closes seamlessly. Gavin 2026-11-09: "I like fog canyon, can you get
// the actual hollow knight walking through there too?" Fan homage: shapes
// are hand-drawn in the game's colour language, nothing copied.

import { FRONT_WIDTH as W, FRONT_HEIGHT as H, type Scene } from "../../lib/scene.ts";
import { KNIGHT, HORNET, UOMA, OOMA, METROID, type SpriteArt } from "./art.ts";
import { SAMUS, SAMUS_POSE_RATE } from "../samus/art.ts";

export const FOG_FPS = 24;
export const FOG_LOOP_S = 96;
export const FOG_FRAME_COUNT = FOG_FPS * FOG_LOOP_S;
/** First floor row; the Knight's feet stand on the row above it. */
export const FLOOR_Y = 13;
/** The Knight's walking pace, px/s: slow and deliberate. */
export const KNIGHT_SPEED = 6;
/** Pixels of travel per walk-cycle frame. */
export const KNIGHT_STRIDE_PX = 1.5; // 4 steps/s at 6 px/s, matching Hornet (Gavin 2026-11-09: feet did not match the pace)
/** Hornet's pace, px/s: twice the Knight's. */
export const HORNET_SPEED = 12;
export const HORNET_STRIDE_PX = 3;
/** Samus's sprint, px/s: about two pixels per pose at SAMUS_POSE_RATE. */
export const SAMUS_SPEED = 16;
/** Seconds into the loop her one crossing starts: after Hornet's first (30–36.6 s), before the Knight's second (60 s). */
export const SAMUS_START_S = 46;

type RGB = readonly [number, number, number];
const TAU = Math.PI * 2;
const turn = (cycles: number, t: number, phase = 0) => TAU * ((cycles * t) / FOG_LOOP_S) + phase;
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** mulberry32: a tiny seeded PRNG so the canyon is the same every build. */
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
const random = rng(0xf06ca7);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;
const between = (lo: number, hi: number) => lo + random() * (hi - lo);
const intBetween = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));

// ---- palette ---------------------------------------------------------------
const FOG: RGB = [12, 40, 34];
const FOG_LIGHT: RGB = [18, 56, 46];
const MIST: RGB = [22, 62, 54];
const MOSS: RGB = [28, 74, 56];
const MOSS_TUFT: RGB = [40, 100, 70];
const FLOOR_MID: RGB = [20, 56, 44];
const FLOOR_DEEP: RGB = [16, 44, 36];
const BUBBLE_DIM: RGB = [56, 130, 112];
const BUBBLE_BRIGHT: RGB = [90, 180, 160];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const artWidth = (a: SpriteArt) => a.frames[0]![0]!.length;
const artHeight = (a: SpriteArt) => a.frames[0]!.length;

// ---- the Knight --------------------------------------------------------------
interface Crossing {
  dir: 1 | -1;
  /** Seconds into the loop he steps on. */
  start: number;
  /** Seconds of travel after `start` at which he stops, and for how long (0 = no pause). */
  pauseAt: number;
  pauseS: number;
}
const KNIGHT_W = artWidth(KNIGHT), KNIGHT_H = artHeight(KNIGHT);
const KNIGHT_TRAVEL_PX = W + KNIGHT_W;
const KNIGHT_TRAVEL_S = KNIGHT_TRAVEL_PX / KNIGHT_SPEED;
/** Left to right first, pausing mid-screen to look up at the jellies; back the other way later. */
export const CROSSINGS: readonly Crossing[] = [
  { dir: 1, start: 8, pauseAt: 39 / KNIGHT_SPEED, pauseS: 2 },
  { dir: -1, start: 60, pauseAt: 0, pauseS: 0 },
];
const crossingDuration = (c: Crossing) => KNIGHT_TRAVEL_S + c.pauseS;

export interface KnightState { x: number; dir: 1 | -1; frame: number; standing: boolean }

/** Where the Knight is at time t, or null when he is off screen. */
export function knightState(t: number): KnightState | null {
  for (const c of CROSSINGS) {
    const tl = t - c.start;
    if (tl < 0 || tl >= crossingDuration(c)) continue;
    let travelS = tl, standing = false;
    if (c.pauseS > 0 && tl > c.pauseAt) {
      if (tl < c.pauseAt + c.pauseS) { travelS = c.pauseAt; standing = true; } else travelS = tl - c.pauseS;
    }
    const d = travelS * KNIGHT_SPEED;
    const x = c.dir > 0 ? -KNIGHT_W + d : W - d;
    const frame = standing ? 0 : Math.floor(d / KNIGHT_STRIDE_PX + 1e-9) % KNIGHT.frames.length;
    return { x, dir: c.dir, frame, standing };
  }
  return null;
}

/** The Knight's pixel rows at time t, mirrored when walking left; empty when off screen. */
export function knightRows(t: number): string[] {
  const s = knightState(t);
  if (!s) return [];
  const rows = [...KNIGHT.frames[s.frame]!];
  return s.dir > 0 ? rows : rows.map((r) => r.split("").reverse().join(""));
}

// ---- Hornet -----------------------------------------------------------------
interface HornetCrossing { dir: 1 | -1; start: number }
const HORNET_W = artWidth(HORNET), HORNET_H = artHeight(HORNET);
const HORNET_TRAVEL_S = (W + HORNET_W) / HORNET_SPEED;
/** Quick crossings in the gaps between the Knight's (8–23.2 s and 60–73.2 s). */
export const HORNET_CROSSINGS: readonly HornetCrossing[] = [
  { dir: 1, start: 30 },
  { dir: -1, start: 82 },
];

export interface HornetState { x: number; dir: 1 | -1; frame: number }

/** Where Hornet is at time t, or null when she is off screen. */
export function hornetState(t: number): HornetState | null {
  for (const c of HORNET_CROSSINGS) {
    const tl = t - c.start;
    if (tl < 0 || tl >= HORNET_TRAVEL_S) continue;
    const d = tl * HORNET_SPEED;
    const x = c.dir > 0 ? -HORNET_W + d : W - d;
    const frame = Math.floor(d / HORNET_STRIDE_PX + 1e-9) % HORNET.frames.length;
    return { x, dir: c.dir, frame };
  }
  return null;
}

/** Hornet's pixel rows at time t, mirrored when walking left; empty when off screen. */
export function hornetRows(t: number): string[] {
  const s = hornetState(t);
  if (!s) return [];
  const rows = [...HORNET.frames[s.frame]!];
  return s.dir > 0 ? rows : rows.map((r) => r.split("").reverse().join(""));
}

// ---- Samus ------------------------------------------------------------------
const SAMUS_W = artWidth(SAMUS), SAMUS_H = artHeight(SAMUS);
const SAMUS_TRAVEL_S = (W + SAMUS_W) / SAMUS_SPEED;

export interface SamusState { x: number; dir: 1; frame: number }

/** Where Samus is at time t (one left-to-right sprint per loop), or null when she is off screen. Poses advance on the clock. */
export function samusState(t: number): SamusState | null {
  const tl = t - SAMUS_START_S;
  if (tl < 0 || tl >= SAMUS_TRAVEL_S) return null;
  const x = -SAMUS_W + tl * SAMUS_SPEED;
  const frame = Math.floor(tl * SAMUS_POSE_RATE + 1e-9) % SAMUS.frames.length;
  return { x, dir: 1, frame };
}

/** Samus's pixel rows at time t; empty when off screen. */
export function samusRows(t: number): string[] {
  const s = samusState(t);
  return s ? [...SAMUS.frames[s.frame]!] : [];
}

// ---- jellies ----------------------------------------------------------------
export interface Jelly {
  kind: "uoma" | "ooma" | "metroid";
  x0: number;
  dir: 1 | -1;
  /** Whole crossings per loop. */
  cycles: number;
  yBase: number;
  amp: number;
  yCycles: number;
  phase: number;
  coreCycles: number;
}
export const JELLIES: readonly Jelly[] = [
  { kind: "uoma", x0: 10, dir: 1, cycles: 2, yBase: 2, amp: 2, yCycles: 9, phase: 0.3, coreCycles: 60 },
  { kind: "uoma", x0: 40, dir: -1, cycles: 1, yBase: 1, amp: 1, yCycles: 7, phase: 2.1, coreCycles: 48 },
  { kind: "uoma", x0: 60, dir: 1, cycles: 1, yBase: 3, amp: 1, yCycles: 11, phase: 4.0, coreCycles: 72 },
  { kind: "ooma", x0: 25, dir: -1, cycles: 1, yBase: 0, amp: 1, yCycles: 6, phase: 1.0, coreCycles: 40 },
  { kind: "ooma", x0: 55, dir: 1, cycles: 2, yBase: 2, amp: 2, yCycles: 8, phase: 5.2, coreCycles: 36 },
  // the Metroid: one slow pass per loop, lower than the jellies, bobbing two rows, claws and nuclei pulsing on a half-second clock
  { kind: "metroid", x0: 30, dir: -1, cycles: 1, yBase: 3, amp: 2, yCycles: 5, phase: 0.8, coreCycles: 0 },
];
const jellyArt = (j: Jelly) => (j.kind === "ooma" ? OOMA : j.kind === "metroid" ? METROID : UOMA);
/** Metroid pose clock: half a second per frame (192 swaps per loop, so it closes). */
export const METROID_FRAME_S = 0.5;
/** Which art frame a jelly shows at time t (only the Metroid has more than one). */
export function jellyFrame(j: Jelly, t: number): number {
  const n = jellyArt(j).frames.length;
  return n === 1 ? 0 : Math.floor(mod(t, FOG_LOOP_S) / METROID_FRAME_S + 1e-9) % n;
}

/** Top-left of a jelly at time t (integer pixels). */
export function jellyPos(j: Jelly, t: number): { x: number; y: number } {
  const w = artWidth(jellyArt(j)), span = W + w;
  const x = Math.round(mod(j.x0 + j.dir * ((j.cycles * span * t) / FOG_LOOP_S), span)) - w;
  const y = Math.round(j.yBase + j.amp * Math.sin(turn(j.yCycles, t, j.phase)));
  return { x, y };
}
const coreLit = (j: Jelly, t: number) => Math.sin(turn(j.coreCycles, t, j.phase)) > 0.6;

// ---- bubbles ----------------------------------------------------------------
export interface Bubble { x0: number; cycles: number; phase: number; wobble: number }
export const BUBBLES: readonly Bubble[] = Array.from({ length: 10 }, () => ({
  x0: intBetween(0, W - 1), cycles: pick([3, 4, 6]), phase: pick([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]), wobble: between(0, TAU),
}));
/** A bubble rises from the floor to the top once per cycle, wobbling a pixel either way. */
export function bubblePos(b: Bubble, t: number): { x: number; y: number; u: number } {
  const u = mod((b.cycles * t) / FOG_LOOP_S + b.phase, 1);
  const y = Math.round(FLOOR_Y - u * 14);
  const x = mod(b.x0 + Math.round(Math.sin(turn(b.cycles * 3, t, b.wobble))), W);
  return { x, y, u };
}

// ---- drawing ------------------------------------------------------------------
function put(buf: Uint8Array, x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
}
function blit(buf: Uint8Array, rows: readonly string[], x0: number, y0: number, colors: Readonly<Record<string, string>>, swap: Record<string, string> = {}): void {
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") put(buf, x0 + x, y0 + y, hex(colors[swap[ch] ?? ch]!)); }));
}

/** One frame of the loop at frame index `i` (any integer; wraps). */
export function renderFrame(i: number): Uint8Array {
  const t = mod(i, FOG_FRAME_COUNT) / FOG_FPS;
  const buf = new Uint8Array(W * H * 4);

  // fog: a glowing teal murk with faint diagonal streaks drifting through (six passes per loop)
  const shift = Math.floor((102 * t) / FOG_LOOP_S);
  for (let y = 0; y < FLOOR_Y; y++) for (let x = 0; x < W; x++) put(buf, x, y, mod(x + y * 3 + shift, 17) === 0 ? FOG_LIGHT : FOG);
  // a slow mist band low in the canyon
  for (let x = 0; x < W; x++) { const m = Math.sin(x / 7 + turn(1, t)) * Math.sin(x / 3.1 - turn(2, t)); if (m > 0.55) put(buf, x, 10, MIST); if (m > 0.8) { put(buf, x, 9, MIST); put(buf, x, 11, MIST); } }
  // mossy floor
  for (let x = 0; x < W; x++) { put(buf, x, FLOOR_Y, (x * 7) % 5 === 0 ? MOSS_TUFT : MOSS); put(buf, x, FLOOR_Y + 1, FLOOR_MID); put(buf, x, FLOOR_Y + 2, (x * 3) % 7 === 0 ? FLOOR_MID : FLOOR_DEEP); }

  // bubbles rising
  for (const b of BUBBLES) { const p = bubblePos(b, t); if (p.y >= 0 && p.y < FLOOR_Y) put(buf, p.x, p.y, p.u > 0.5 ? BUBBLE_BRIGHT : BUBBLE_DIM); }

  // jellies drifting above head height
  for (const j of JELLIES) {
    const art = jellyArt(j), p = jellyPos(j, t);
    const swap = j.kind === "metroid" ? {} : coreLit(j, t) ? (j.kind === "ooma" ? { O: "OF" } : { C: "CF" }) : {};
    blit(buf, art.frames[jellyFrame(j, t)]!, p.x, p.y, art.colors, swap);
  }

  // Samus, Hornet and the Knight, drawn last so nothing crosses them (they are never on screen together)
  const sm = samusState(t);
  if (sm) blit(buf, samusRows(t), Math.round(sm.x), FLOOR_Y - SAMUS_H, SAMUS.colors);
  const h = hornetState(t);
  if (h) blit(buf, hornetRows(t), Math.round(h.x), FLOOR_Y - HORNET_H, HORNET.colors);
  const s = knightState(t);
  if (s) blit(buf, knightRows(t), Math.round(s.x), FLOOR_Y - KNIGHT_H, KNIGHT.colors);
  return buf;
}

export const FOG_CANYON: Scene = {
  id: "fog_canyon",
  name: "Fog Canyon",
  fps: FOG_FPS,
  frames: () => Array.from({ length: FOG_FRAME_COUNT }, (_, i) => renderFrame(i)),
};
