// Munchers Run: the Number Munchers characters (and a chicken) sprint across
// the front display over a fixed Dino-Run-style ground, each entering from one
// side and leaving by the other, on a seeded timetable with idle gaps. A
// pre-rendered seamless loop like the aquarium: every run starts and ends
// inside the loop, so frame N-1 flows into frame 0.

import { FRONT_WIDTH as W, FRONT_HEIGHT as H, type Scene } from "../../lib/scene.ts";
import { RUNNER_ART, type RunnerArt } from "./art.ts";

export const MUNCHERS_FPS = 24;
export const MUNCHERS_LOOP_S = 180;
export const MUNCHERS_FRAME_COUNT = MUNCHERS_FPS * MUNCHERS_LOOP_S;
/** Row of the ground line; runners' feet sit on the row above it. */
export const GROUND_Y = 14;
/** Pixels of travel per run-cycle frame, so legs match pace. */
export const STRIDE_PX = 3;
const MAX_ON_SCREEN = 3;
/** Dance poses per second while a runner is stopped. */
export const DANCE_FPS = 4;
/** Share of a dancer's runs that stop for a dance (Gavin 2026-11-09: "occasionally"). */
const DANCE_CHANCE = 0.4;

type RGB = readonly [number, number, number];
/** Ground line: green grass (Gavin 2026-11-09), with brown dirt below and a few darker pebbles in it. */
export const GRASS: RGB = [72, 150, 52];
/** Cast shadow on the grass: darker green (Gavin 2026-11-09: every runner gets one, not just Squirt). */
export const SHADOW: RGB = [0x2e, 0x5a, 0x22];
const DIRT: RGB = [140, 124, 92];
const DIRT_DARK: RGB = [84, 74, 56];

export interface Run {
  art: RunnerArt;
  /** 1 enters from the left and runs right; -1 the reverse. */
  dir: 1 | -1;
  /** Seconds into the loop the runner steps on screen. */
  start: number;
  /** px/s. */
  speed: number;
  /** A mid-run stop: `at` seconds after `start` the runner halts for `duration` seconds and plays `art.dance`. */
  pause?: { at: number; duration: number };
}

/** mulberry32: a tiny seeded PRNG so the timetable is the same every build. */
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
const random = rng(0x6d75ce);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;
const between = (lo: number, hi: number) => lo + random() * (hi - lo);

const artWidth = (art: RunnerArt) => art.frames[0]![0]!.length;
/** Seconds the runner is on screen: the crossing plus any dance stop. */
export const runDuration = (r: Run) => (W + artWidth(r.art)) / r.speed + (r.pause?.duration ?? 0);

function makeRuns(): Run[] {
  const runs: Run[] = [];
  // Deal the roster in shuffled rounds so everyone gets a turn before repeats.
  let deck: RunnerArt[] = [];
  const next = (): RunnerArt => {
    if (deck.length === 0) deck = [...RUNNER_ART].sort(() => random() - 0.5);
    return deck.pop()!;
  };
  let t = between(1, 3);
  for (;;) {
    const art = next();
    const speed = Math.round(between(8, 20) * 2) / 2;
    const run: Run = { art, dir: random() < 0.5 ? 1 : -1, start: t, speed };
    if (art.dance && random() < DANCE_CHANCE) {
      // Stop somewhere fully on screen, a few px in from either edge.
      const travelled = between(artWidth(art) + 4, W - 4);
      run.pause = { at: travelled / speed, duration: Math.round(between(2, 4) * 4) / 4 };
    }
    if (t + runDuration(run) > MUNCHERS_LOOP_S - 1) break;
    // Never more than MAX_ON_SCREEN at once: wait for the earliest to leave. And never the same
    // character twice on screen (Gavin 2026-11-09): wait for its earlier run to leave.
    const crowd = runs.filter((r) => r.start + runDuration(r) > t);
    const twin = crowd.find((r) => r.art === art);
    if (crowd.length >= MAX_ON_SCREEN || twin) {
      const leaves = twin ? twin.start + runDuration(twin) : Math.min(...crowd.map((r) => r.start + runDuration(r)));
      t = leaves + between(0.3, 1);
      run.start = t;
      if (t + runDuration(run) > MUNCHERS_LOOP_S - 1) break;
    }
    runs.push(run);
    // Mostly a short beat before the next one; now and then an empty stretch.
    t += random() < 0.18 ? between(5, 9) : between(0.8, 4);
  }
  return runs;
}

export const RUNS: readonly Run[] = makeRuns();

/** Seconds of actual travel by time t: the clock stops while the runner dances. */
function travelS(r: Run, t: number): number {
  const tt = t - r.start;
  if (!r.pause) return tt;
  const { at, duration } = r.pause;
  if (tt <= at) return tt;
  if (tt < at + duration) return at;
  return tt - duration;
}

/** Left edge of the runner at time t (seconds into the loop); off-screen before and after its run. */
export function runnerX(r: Run, t: number): number {
  const d = r.speed * travelS(r, t);
  return r.dir > 0 ? -artWidth(r.art) + d : W - d;
}

/** Which run-cycle frame shows at time t: one step per STRIDE_PX travelled. */
export function runnerFrame(r: Run, t: number): number {
  const d = Math.max(0, r.speed * travelS(r, t));
  return Math.floor(d / STRIDE_PX + 1e-9) % r.art.frames.length;
}

/** True while the runner is stopped for its dance. */
export function isDancing(r: Run, t: number): boolean {
  if (!r.pause) return false;
  const tt = t - r.start;
  return tt >= r.pause.at && tt < r.pause.at + r.pause.duration;
}

/** The pixel rows to draw for the run at time t: a dance pose while stopped, else the run cycle. */
export function runnerRows(r: Run, t: number): string[] {
  if (isDancing(r, t) && r.art.dance) {
    const k = Math.floor((t - r.start - r.pause!.at) * DANCE_FPS + 1e-9) % r.art.dance.length;
    const rows = [...r.art.dance[k]!];
    return r.dir > 0 ? rows : rows.map((row) => row.split("").reverse().join(""));
  }
  return runnerSprite(r.art, r.dir, runnerFrame(r, t));
}

/** Runs on screen at time t. */
export function activeRuns(t: number): Run[] {
  return RUNS.filter((r) => t >= r.start && t < r.start + runDuration(r));
}

/** The runner's pixel rows for frame `k`, facing `facing` (1 = right, as drawn). */
export function runnerSprite(art: RunnerArt, facing: 1 | -1, k: number): string[] {
  const rows = [...art.frames[k % art.frames.length]!];
  return facing > 0 ? rows : rows.map((r) => r.split("").reverse().join(""));
}

/** Columns [a, b) a runner's shadow covers: the lit span of its lowest two non-blank rows (the feet). */
export function shadowSpan(rows: readonly string[]): [number, number] {
  const feet = rows.filter((r) => /[^.]/.test(r)).slice(-2);
  let a = Infinity, b = -Infinity;
  for (const r of feet) { a = Math.min(a, r.search(/[^.]/)); b = Math.max(b, r.length - [...r].reverse().join("").search(/[^.]/)); }
  return a === Infinity ? [0, 0] : [a, b];
}

function put(buf: Uint8Array, x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
}
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** One frame of the loop at frame index `i` (any integer; wraps). */
export function renderFrame(i: number): Uint8Array {
  const t = (((i % MUNCHERS_FRAME_COUNT) + MUNCHERS_FRAME_COUNT) % MUNCHERS_FRAME_COUNT) / MUNCHERS_FPS;
  const buf = new Uint8Array(W * H * 4);
  for (let p = 3; p < buf.length; p += 4) buf[p] = 255; // black sky

  // Fixed ground: a solid grass line over solid dirt with pebbles (Gavin 2026-11-09: no breaks).
  for (let x = 0; x < W; x++) { put(buf, x, GROUND_Y, GRASS); put(buf, x, GROUND_Y + 1, DIRT); }
  for (const x of [3, 11, 20, 27, 38, 46, 55, 63, 69]) put(buf, x, GROUND_Y + 1, DIRT_DARK);

  const active = activeRuns(t);
  // Shadows first, so every sprite is drawn over them.
  for (const r of active) {
    if (r.art.onGround) continue; // bakes its own (Squirt's shrinks as he hops)
    const rows = runnerRows(r, t), x0 = Math.round(runnerX(r, t));
    const [a, b] = shadowSpan(rows);
    for (let x = a; x < b; x++) put(buf, x0 + x, GROUND_Y, SHADOW);
  }
  for (const r of active) {
    const rows = runnerRows(r, t);
    const x0 = Math.round(runnerX(r, t)), y0 = GROUND_Y - rows.length + (r.art.onGround ?? 0);
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y]!.length; x++) {
      const ch = rows[y]![x]!;
      if (ch !== ".") put(buf, x0 + x, y0 + y, hex(r.art.colors[ch]!));
    }
  }
  return buf;
}

export const MUNCHERS_RUN: Scene = {
  id: "munchers_run",
  name: "Munchers Run",
  fps: MUNCHERS_FPS,
  frames: () => Array.from({ length: MUNCHERS_FRAME_COUNT }, (_, i) => renderFrame(i)),
};
