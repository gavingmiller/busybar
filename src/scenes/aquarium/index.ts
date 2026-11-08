// Pixel Aquarium, ported from robynhub's community BUSY Bar app
// (maxswinkels/busybar-apps apps/pixel-aquarium) as a pre-rendered loop: six
// fish swim both ways at different depths, bubbles rise and sway, seaweed
// bends in the current over a sand floor. The original redraws 12 PNGs a
// second over HTTP and follows the wall clock through a day/night cycle;
// here the look is fixed daytime and every motion is a periodic function of
// t that closes exactly on the loop, so the bar plays it seamlessly itself.

import { FRONT_WIDTH as W, FRONT_HEIGHT as H, type Scene } from "../../lib/scene.ts";

export const AQUARIUM_FPS = 24;
export const AQUARIUM_LOOP_S = 96; // 4x the original 24 s: fish were entirely too fast (Gavin 2026-11-08)
export const AQUARIUM_FRAME_COUNT = AQUARIUM_FPS * AQUARIUM_LOOP_S;

type RGB = readonly [number, number, number];

const DAY_TOP: RGB = [3, 50, 92];
const DAY_BOTTOM: RGB = [0, 126, 145];
const SAND: RGB = [111, 84, 47];
const SAND_DARK: RGB = [70, 54, 34];
const PLANT: RGB = [20, 163, 82];
const PLANT_DARK: RGB = [11, 101, 57];
const BUBBLE: RGB = [166, 242, 255];
const CAUSTIC: RGB = blend([6, 44, 61], [70, 196, 203], 0.7);
const EYE: RGB = [6, 10, 14];

const FISH_PALETTES: ReadonlyArray<readonly [RGB, RGB]> = [
  [[255, 125, 40], [255, 210, 61]],
  [[255, 71, 94], [255, 164, 184]],
  [[71, 210, 255], [146, 244, 255]],
  [[172, 99, 255], [223, 180, 255]],
  [[75, 231, 118], [168, 255, 147]],
  [[255, 207, 63], [255, 118, 34]],
];

function blend(a: RGB, b: RGB, t: number): RGB {
  const k = Math.max(0, Math.min(1, t));
  return [Math.floor(a[0] + (b[0] - a[0]) * k), Math.floor(a[1] + (b[1] - a[1]) * k), Math.floor(a[2] + (b[2] - a[2]) * k)];
}

/** mulberry32: a tiny seeded PRNG so the tank is the same every build. */
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
const random = rng(0x0a9a71);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;
const between = (lo: number, hi: number) => lo + random() * (hi - lo);

/** Gap kept between a fish leaving one edge and re-entering the other. */
const FISH_GAP = 10;

export interface Fish {
  dir: 1 | -1;
  size: 1 | 2;
  width: number;
  /** Phase along the wrap track at t=0, px. */
  x0: number;
  /** Full crossings (track lengths) per loop; speed = crossings * track / loop. */
  crossings: number;
  y: number;
  bobCycles: number;
  bobPhase: number;
  palette: number;
  variant: number;
}

const fishTrack = (f: Fish) => W + f.width + FISH_GAP;

/** Left edge of the fish at time t (seconds); in [-(width+gap), W). Closes on the loop. */
export function fishX(f: Fish, t: number): number {
  const track = fishTrack(f);
  const speed = (f.crossings * track) / AQUARIUM_LOOP_S;
  const u = (((f.x0 + f.dir * speed * t) % track) + track) % track;
  return u - f.width - FISH_GAP;
}

export interface Bubble {
  x: number;
  y0: number;
  /** Rises this many track lengths per loop. */
  rises: number;
  swayCycles: number;
  swayPhase: number;
  big: boolean;
}

const BUBBLE_TRACK = H + 6;

/** Bubble row at time t; in [-3, H+3). Closes on the loop. */
export function bubbleY(b: Bubble, t: number): number {
  const speed = (b.rises * BUBBLE_TRACK) / AQUARIUM_LOOP_S;
  const u = (((b.y0 - speed * t) % BUBBLE_TRACK) + BUBBLE_TRACK) % BUBBLE_TRACK;
  return u - 3;
}

interface Plant {
  x: number;
  height: number;
  swayCycles: number;
  phase: number;
  branch: 1 | -1;
}

function makeFish(): Fish[] {
  const fish: Fish[] = [];
  for (let i = 0; i < 6; i++) {
    const size = pick([1, 1, 1, 2] as const);
    const width = size === 1 ? 6 : 9;
    const dir = i % 2 === 0 ? 1 : -1;
    fish.push({
      dir,
      size,
      width,
      x0: between(0, W + width + FISH_GAP),
      crossings: size === 2 ? 1 : pick([2, 2, 2]), // ~1.7 px/s small, ~0.85 px/s big over the 96 s loop
      y: Math.floor(between(2, size === 1 ? 11 : 9)),
      bobCycles: pick([16, 20, 24]),
      bobPhase: between(0, Math.PI * 2),
      palette: i % FISH_PALETTES.length,
      variant: Math.floor(random() * 3),
    });
  }
  // Guarantee a populated tank at t=0: spread the first four across the screen.
  for (let i = 0; i < 4; i++) {
    const f = fish[i]!;
    f.x0 = f.width + FISH_GAP + 4 + i * 16;
  }
  return fish;
}

function makeBubbles(): Bubble[] {
  return Array.from({ length: 10 }, () => ({
    x: 1 + Math.floor(random() * (W - 2)),
    y0: between(0, BUBBLE_TRACK),
    rises: pick([12, 16, 20, 24, 28]),
    swayCycles: pick([28, 32, 36, 40]),
    swayPhase: between(0, Math.PI * 2),
    big: random() < 0.18,
  }));
}

function makePlants(): Plant[] {
  return [2, 8, 14, 22, 31, 40, 50, 59, 67].map((x) => ({
    x: x + Math.floor(between(-1, 2)),
    height: 3 + Math.floor(random() * 5),
    swayCycles: pick([12, 16, 20]),
    phase: between(0, Math.PI * 2),
    branch: random() < 0.5 ? -1 : 1,
  }));
}

export const FISH: readonly Fish[] = makeFish();
export const BUBBLES: readonly Bubble[] = makeBubbles();
const PLANTS: readonly Plant[] = makePlants();

const TAU = Math.PI * 2;
/** Angle of a motion that completes `cycles` turns per loop. */
const turn = (cycles: number, t: number, phase: number) => (TAU * cycles * t) / AQUARIUM_LOOP_S + phase;

function put(buf: Uint8Array, x: number, y: number, c: RGB): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
}
function fill(buf: Uint8Array, x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(buf, xx, yy, c);
}

function drawFish(buf: Uint8Array, f: Fish, t: number): void {
  const x = Math.round(fishX(f, t));
  const y = f.y + Math.round(Math.sin(turn(f.bobCycles, t, f.bobPhase)) * 0.65);
  const [base, accent] = FISH_PALETTES[f.palette]!;
  if (f.size === 1) {
    // 6x4: 4x3 body, 2 px triangular tail.
    if (f.dir > 0) {
      put(buf, x, y + 1, accent); put(buf, x, y + 2, accent);
      put(buf, x + 1, y, base); fill(buf, x + 1, y + 1, 4, 2, base); put(buf, x + 1, y + 3, base);
      put(buf, x + 4, y, base); put(buf, x + 4, y + 3, base);
      put(buf, x + 4, y + 1, EYE);
      if (f.variant === 1) put(buf, x + 2, y + 1, accent);
      else if (f.variant === 2) put(buf, x + 3, y + 2, accent);
    } else {
      put(buf, x + 5, y + 1, accent); put(buf, x + 5, y + 2, accent);
      put(buf, x + 4, y, base); fill(buf, x + 1, y + 1, 4, 2, base); put(buf, x + 4, y + 3, base);
      put(buf, x + 1, y, base); put(buf, x + 1, y + 3, base);
      put(buf, x + 1, y + 1, EYE);
      if (f.variant === 1) put(buf, x + 3, y + 1, accent);
      else if (f.variant === 2) put(buf, x + 2, y + 2, accent);
    }
  } else {
    // 9x6: the rarer big fish.
    if (f.dir > 0) {
      put(buf, x, y + 2, accent); put(buf, x, y + 3, accent); put(buf, x + 1, y + 1, accent); put(buf, x + 1, y + 4, accent);
      fill(buf, x + 2, y + 1, 5, 4, base); fill(buf, x + 3, y, 3, 1, base); fill(buf, x + 3, y + 5, 3, 1, base);
      put(buf, x + 6, y + 2, EYE);
      put(buf, x + 4, y + 2 + (f.variant % 2), accent);
    } else {
      put(buf, x + 8, y + 2, accent); put(buf, x + 8, y + 3, accent); put(buf, x + 7, y + 1, accent); put(buf, x + 7, y + 4, accent);
      fill(buf, x + 2, y + 1, 5, 4, base); fill(buf, x + 3, y, 3, 1, base); fill(buf, x + 3, y + 5, 3, 1, base);
      put(buf, x + 2, y + 2, EYE);
      put(buf, x + 4, y + 2 + (f.variant % 2), accent);
    }
  }
}

/** One frame of the loop at frame index `i` (any integer; wraps). */
export function renderFrame(i: number): Uint8Array {
  const t = (i % AQUARIUM_FRAME_COUNT) / AQUARIUM_FPS;
  const buf = new Uint8Array(W * H * 4);

  // Water gradient, slightly darker toward the floor.
  for (let y = 0; y < H; y++) fill(buf, 0, y, W, 1, blend(DAY_TOP, DAY_BOTTOM, y / (H - 1)));

  // Caustic shimmer near the surface: steps twice a second, 48 steps per loop.
  const step = Math.floor(t * 2);
  for (let x = 0; x < W; x += 7) {
    const yy = 1 + ((Math.floor(x / 7) + step) % 2);
    put(buf, x, yy, CAUSTIC); put(buf, x + 1, yy, CAUSTIC);
  }

  // Sand with darker gravel flecks.
  fill(buf, 0, H - 2, W, 2, SAND);
  for (let x = 0; x < W; x += 5) put(buf, x, H - 2 + (Math.floor(x / 5) % 2), SAND_DARK);

  for (const p of PLANTS) {
    for (let k = 0; k < p.height; k++) {
      const yy = H - 2 - k;
      const sway = Math.round(Math.sin(turn(p.swayCycles, t, p.phase) + k * 0.45) * Math.min(1.2, k * 0.18));
      const xx = p.x + sway;
      put(buf, xx, yy, k % 2 ? PLANT : PLANT_DARK);
      if (k >= 2 && k % 2 === 0) put(buf, xx + p.branch, yy, PLANT);
    }
  }

  for (const b of BUBBLES) {
    const x = Math.round(b.x + Math.sin(turn(b.swayCycles, t, b.swayPhase)) * 0.8);
    const y = Math.round(bubbleY(b, t));
    put(buf, x, y, BUBBLE);
    if (b.big) { put(buf, x + 1, y, BUBBLE); put(buf, x, y + 1, BUBBLE); }
  }

  for (const f of FISH) drawFish(buf, f, t);
  return buf;
}

export const AQUARIUM: Scene = {
  id: "aquarium",
  name: "Aquarium",
  fps: AQUARIUM_FPS,
  frames: () => Array.from({ length: AQUARIUM_FRAME_COUNT }, (_, i) => renderFrame(i)),
};
