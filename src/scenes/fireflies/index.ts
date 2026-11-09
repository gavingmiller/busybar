// Fireflies: a summer meadow at night. Three layers of fireflies drift over
// swaying grass under a crescent moon: far ones are single dim pixels, near
// ones a bright core with a soft halo. Each fly has its own pulse (slow
// glow, quick double blink, long dark gaps, or steady), its own hue
// (yellow-green, amber, cool green-white), and its own drift. Once a loop a
// cluster falls into step and flashes together before drifting apart again,
// and one firefly lands on a tall blade and glows there a while. Everything
// is a periodic function of t with an integer number of cycles per loop, so
// the pre-rendered loop closes seamlessly. Gavin 2026-11-09 on the first
// mock-up: "needs some more differentiation".

import { FRONT_WIDTH as W, FRONT_HEIGHT as H, type Scene } from "../../lib/scene.ts";

export const FIREFLIES_FPS = 24;
export const FIREFLIES_LOOP_S = 96;
export const FIREFLIES_FRAME_COUNT = FIREFLIES_FPS * FIREFLIES_LOOP_S;
/** First row of the meadow floor; grass blades rise above it, fireflies stay above the blades. */
export const MEADOW_TOP = 13;

type RGB = readonly [number, number, number];
const TAU = Math.PI * 2;
/** Angle of a motion that completes `cycles` whole turns per loop. */
const turn = (cycles: number, t: number, phase = 0) => TAU * ((cycles * t) / FIREFLIES_LOOP_S) + phase;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const smooth = (u: number) => { const k = Math.max(0, Math.min(1, u)); return k * k * (3 - 2 * k); };
/** 1 inside [start, end] with `edge`-second soft ramps, 0 outside. */
const window = (t: number, start: number, end: number, edge: number) => smooth((t - start) / edge) * (1 - smooth((t - (end - edge)) / edge));

/** mulberry32: a tiny seeded PRNG so the meadow is the same every build. */
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
const random = rng(0xf1ef1e);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;
const between = (lo: number, hi: number) => lo + random() * (hi - lo);
const intBetween = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));

// ---- palette ---------------------------------------------------------------
const MEADOW: RGB = [18, 48, 20];
const MEADOW_LIGHT: RGB = [24, 60, 26];
const BLADE: RGB = [30, 92, 34];
const BLADE_TIP: RGB = [46, 124, 46];
const TREELINE: RGB = [24, 40, 28];
const MIST: RGB = [34, 46, 42];
const POST: RGB = [96, 72, 44];
const REED: RGB = [92, 76, 40];
const REED_HEAD: RGB = [120, 84, 48];
const MOON: RGB = [222, 222, 190];
const STAR_BRIGHT: RGB = [150, 160, 190];
const STAR_DIM: RGB = [78, 84, 110];
const HUES = {
  green: [200, 255, 90] as RGB,
  amber: [255, 190, 70] as RGB,
  cool: [190, 255, 210] as RGB,
};

// ---- landscape -------------------------------------------------------------
export interface Blade { x: number; tall: boolean; cycles: number; phase: number }
export const BLADES: readonly Blade[] = (() => {
  const out: Blade[] = [];
  for (let x = 1; x < W - 1; x += intBetween(3, 5)) out.push({ x, tall: random() < 0.45, cycles: pick([2, 3, 4]), phase: between(0, TAU) });
  return out;
})();
/** [col, row] of a blade's tip at time t: it sways one column either way in the breeze. */
export function bladeTip(b: Blade, t: number): [number, number] {
  return [b.x + Math.round(0.9 * Math.sin(turn(b.cycles, t, b.phase))), b.tall ? MEADOW_TOP - 2 : MEADOW_TOP - 1];
}
const STARS: ReadonlyArray<{ x: number; y: number; cycles: number; phase: number }> = Array.from({ length: 11 }, () => ({ x: intBetween(0, W - 1), y: intBetween(0, 5), cycles: pick([3, 5, 7, 8]), phase: between(0, TAU) }));
const TREE_TOP: readonly number[] = (() => { const tops: number[] = []; let h = 9; for (let x = 0; x < W; x++) { if (x % 4 === 0) h = intBetween(8, 10); tops.push(h); } return tops; })();
const FENCE_X = 9;
const REED_XS = [55, 57, 59];

// ---- fireflies -------------------------------------------------------------
export type Layer = "far" | "mid" | "near";
export type Pulse = "sine" | "double" | "gap" | "steady";
export interface Fly {
  layer: Layer;
  hue: keyof typeof HUES;
  pulse: Pulse;
  /** Brightness ceiling for the layer, 0..1. */
  peak: number;
  /** Rest position and drift: a wrap-around glide at `vx` px/s plus a sine wobble. */
  x0: number; y0: number; vx: number;
  ax: number; ay: number; cx: number; cy: number; px: number; py: number;
  /** Pulse: whole cycles per loop and a phase. */
  pc: number; pp: number;
  /** Member of the cluster that flashes in step during SYNC. */
  sync: boolean;
  /** The one that lands on a blade during LANDING. */
  lands: boolean;
}
/** The cluster's in-step flashing window, seconds into the loop (soft 2 s edges). */
export const SYNC = { start: 30, end: 52, edge: 2 } as const;
/** When the lander sits on its blade, seconds into the loop (soft 2 s edges). */
export const LANDING = { blade: BLADES.findIndex((b) => b.tall && b.x > 20 && b.x < 50), start: 62, end: 84, edge: 2 } as const;
const SYNC_CYCLES = 72; // the cluster's shared pulse: one flash every 1.33 s

function makeFlies(): Fly[] {
  const flies: Fly[] = [];
  const add = (layer: Layer, n: number, make: (k: number) => Partial<Fly>) => {
    for (let k = 0; k < n; k++) {
      const peak = layer === "far" ? 0.45 : layer === "mid" ? 0.8 : 1;
      const glide = layer === "far" ? 1 : layer === "mid" ? 2 : 3; // W px per `glide` loops → vx = glide*W/LOOP
      const base: Fly = {
        layer, hue: pick(["green", "green", "amber", "cool"]), pulse: pick(["sine", "sine", "double", "gap"]), peak,
        x0: between(0, W), y0: between(1.5, layer === "near" ? 9.5 : 10.5), vx: (glide * W) / FIREFLIES_LOOP_S * (random() < 0.5 ? 1 : -1),
        ax: between(1, layer === "near" ? 4 : 2), ay: between(0.5, layer === "near" ? 2 : 1.2),
        cx: pick([2, 3, 4, 5]), cy: pick([3, 4, 5, 6, 7]), px: between(0, TAU), py: between(0, TAU),
        pc: pick([24, 32, 40, 48, 64]), pp: between(0, TAU), sync: false, lands: false,
      };
      flies.push({ ...base, ...make(k) });
    }
  };
  add("far", 10, () => ({}));
  add("mid", 10, (k) => (k < 5 ? { sync: true, pulse: "sine", pc: SYNC_CYCLES, hue: "green", y0: between(3, 8), x0: between(24, 48) } : {}));
  add("near", 8, (k) => (k === 0 ? { lands: true, pulse: "sine", hue: "amber" } : k === 1 ? { pulse: "steady", hue: "cool" } : {}));
  return flies;
}
export const FLIES: readonly Fly[] = makeFlies();

function pulseOf(f: Fly, t: number): number {
  const phase = f.sync ? f.pp * (1 - window(t, SYNC.start, SYNC.end, SYNC.edge)) : f.pp;
  const u = mod(turn(f.pc, t, phase) / TAU, 1);
  switch (f.pulse) {
    case "sine": return 0.5 + 0.5 * Math.sin(u * TAU);
    case "double": { const blink = (a: number, w: number) => (u >= a && u < a + w ? Math.sin(((u - a) / w) * Math.PI) : 0); return Math.max(blink(0, 0.08), blink(0.14, 0.08)); }
    case "gap": return u < 0.15 ? Math.sin((u / 0.15) * Math.PI) : 0;
    case "steady": return 1;
  }
}

/** Where a firefly is and how brightly it glows (0..1, before the layer's peak) at time t. */
export function flyState(f: Fly, t: number): { x: number; y: number; b: number; color: RGB } {
  let x = mod(f.x0 + f.vx * t + f.ax * Math.sin(turn(f.cx, t, f.px)), W);
  let y = f.y0 + f.ay * Math.sin(turn(f.cy, t, f.py));
  let b = pulseOf(f, t);
  if (f.lands) {
    const w = window(t, LANDING.start, LANDING.end, LANDING.edge);
    const [tx, ty] = bladeTip(BLADES[LANDING.blade]!, t);
    // glide in from wherever the drift has it, shortest way round the wrap
    let dx = tx - x; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W;
    x = mod(x + dx * w, W); y = y + (ty - 1 - y) * w; b = b * (1 - w) + 0.9 * w;
  }
  return { x, y, b, color: HUES[f.hue] };
}

// ---- render ----------------------------------------------------------------
function put(buf: Uint8Array, x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
}
/** Additive glow: brightens the pixel toward `c` by `k`, never darkens it. */
function glow(buf: Uint8Array, x: number, y: number, c: RGB, k: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  for (let ch = 0; ch < 3; ch++) buf[i + ch] = Math.max(buf[i + ch]!, Math.min(255, Math.floor(c[ch]! * k)));
}
const scale = (c: RGB, k: number): RGB => [Math.floor(c[0] * k), Math.floor(c[1] * k), Math.floor(c[2] * k)];

/** One frame of the loop at frame index `i` (any integer; wraps). */
export function renderFrame(i: number): Uint8Array {
  const t = mod(i, FIREFLIES_FRAME_COUNT) / FIREFLIES_FPS;
  const buf = new Uint8Array(W * H * 4);
  for (let p = 3; p < buf.length; p += 4) buf[p] = 255;

  // sky: stars twinkle, a crescent moon top right
  for (const s of STARS) put(buf, s.x, s.y, Math.sin(turn(s.cycles, t, s.phase)) > 0.2 ? STAR_BRIGHT : STAR_DIM);
  for (const [dx, dy] of [[2, 0], [3, 0], [1, 1], [1, 2], [1, 3], [2, 4], [3, 4], [4, 3]] as const) put(buf, 63 + dx, 1 + dy, MOON);

  // far treeline silhouette
  for (let x = 0; x < W; x++) for (let y = TREE_TOP[x]!; y < MEADOW_TOP; y++) put(buf, x, y, TREELINE);
  // a slow mist band drifting through the trees
  for (let x = 0; x < W; x++) { const m = Math.sin(x / 7 + turn(1, t)) * Math.sin(x / 3.1 - turn(2, t)); if (m > 0.55) put(buf, x, 11, MIST); if (m > 0.8) put(buf, x, 10, MIST); }

  // meadow floor
  for (let x = 0; x < W; x++) for (let y = MEADOW_TOP; y < H; y++) put(buf, x, y, (x * 7 + y * 3) % 5 === 0 ? MEADOW_LIGHT : MEADOW);
  // fence post and rail, reeds
  for (let y = 9; y < MEADOW_TOP; y++) { put(buf, FENCE_X, y, POST); put(buf, FENCE_X + 1, y, POST); }
  for (let x = FENCE_X - 3; x <= FENCE_X + 4; x++) put(buf, x, 10, POST);
  REED_XS.forEach((rx, k) => { const lean = Math.round(0.8 * Math.sin(turn(3, t, k))); for (let y = 9; y < MEADOW_TOP; y++) put(buf, rx + (y < 11 ? lean : 0), y, REED); put(buf, rx + lean, 8, REED_HEAD); });
  // grass blades
  for (const b of BLADES) { const [tx, ty] = bladeTip(b, t); put(buf, b.x, MEADOW_TOP - 1, BLADE); if (b.tall) put(buf, tx, ty + 1, BLADE); put(buf, tx, ty, BLADE_TIP); }

  // fireflies, far to near so the bright ones win
  for (const layer of ["far", "mid", "near"] as const) for (const f of FLIES) {
    if (f.layer !== layer) continue;
    const s = flyState(f, t);
    const k = s.b * f.peak;
    if (k < 0.08) continue;
    const x = Math.round(s.x) % W, y = Math.round(s.y);
    if (layer === "near" && k > 0.6) { const h = (k - 0.6) * 0.9; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) glow(buf, (x + dx + W) % W, y + dy, s.color, h); }
    glow(buf, x, y, scale(s.color, 1), k);
  }
  return buf;
}

export const FIREFLIES: Scene = {
  id: "fireflies",
  name: "Fireflies",
  fps: FIREFLIES_FPS,
  frames: () => Array.from({ length: FIREFLIES_FRAME_COUNT }, (_, i) => renderFrame(i)),
};
