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

type RGB = readonly [number, number, number];
const GROUND: RGB = [140, 124, 92];
const GROUND_DARK: RGB = [84, 74, 56];

export interface Run {
  art: RunnerArt;
  /** 1 enters from the left and runs right; -1 the reverse. */
  dir: 1 | -1;
  /** Seconds into the loop the runner steps on screen. */
  start: number;
  /** px/s. */
  speed: number;
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
const runDuration = (r: Run) => (W + artWidth(r.art)) / r.speed;

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
    if (t + runDuration(run) > MUNCHERS_LOOP_S - 1) break;
    // Never more than MAX_ON_SCREEN at once: wait for the earliest to leave.
    const crowd = runs.filter((r) => r.start + runDuration(r) > t);
    if (crowd.length >= MAX_ON_SCREEN) {
      t = Math.min(...crowd.map((r) => r.start + runDuration(r))) + between(0.3, 1);
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

/** Left edge of the runner at time t (seconds into the loop); off-screen before and after its run. */
export function runnerX(r: Run, t: number): number {
  const d = r.speed * (t - r.start);
  return r.dir > 0 ? -artWidth(r.art) + d : W - d;
}

/** Which run-cycle frame shows at time t: one step per STRIDE_PX travelled. */
export function runnerFrame(r: Run, t: number): number {
  const d = Math.max(0, r.speed * (t - r.start));
  return Math.floor(d / STRIDE_PX + 1e-9) % r.art.frames.length;
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

  // Fixed ground: a dashed line with pebbles below, like Dino Run's.
  for (let x = 0; x < W; x++) if (x % 9 !== 4) put(buf, x, GROUND_Y, GROUND);
  for (const x of [3, 11, 20, 27, 38, 46, 55, 63, 69]) put(buf, x, GROUND_Y + 1, GROUND_DARK);

  for (const r of activeRuns(t)) {
    const rows = runnerSprite(r.art, r.dir, runnerFrame(r, t));
    const x0 = Math.round(runnerX(r, t)), y0 = GROUND_Y - rows.length;
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
