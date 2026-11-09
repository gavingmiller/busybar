// Pixel Aquarium, ported from robynhub's community BUSY Bar app
// (maxswinkels/busybar-apps apps/pixel-aquarium) as a pre-rendered loop: six
// fish swim both ways at different depths, bubbles rise and sway, seaweed
// bends in the current over a sand floor. The original redraws 12 PNGs a
// second over HTTP and follows the wall clock through a day/night cycle;
// here the look is fixed daytime and every motion is a periodic function of
// t that closes exactly on the loop, so the bar plays it seamlessly itself.

import { FRONT_WIDTH as W, FRONT_HEIGHT as H, type Scene } from "../../lib/scene.ts";

export const AQUARIUM_FPS = 24;
export const AQUARIUM_LOOP_S = 240; // 10x the original 24 s: fish were entirely too fast (Gavin 2026-11-08), and a
                                   // long loop lets the one large fish stay away most of the time (rare visitor).
/** Chance, per crossing, that a fish turns around mid-tank and goes back where it came from. */
export const TURNAROUND_CHANCE = 0.1;
/** Seconds per loop the large fish spends out of the tank. */
const LARGE_FISH_REST_S = 170;
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
  /** Entry side: 1 comes in from the left and swims right, -1 the reverse. */
  dir: 1 | -1;
  /** 1 small (4x3), 2 medium (6x4), 3 large (9x6). */
  size: 1 | 2 | 3;
  width: number;
  /** Crossing slots per loop (each is a full track at cruise speed, or a turnaround of the same length of time). */
  crossings: number;
  /** Seconds at the end of each loop spent parked off-screen (the large fish's rarity). */
  restS: number;
  /** Timeline offset into the moving window, s. */
  phaseS: number;
  /** Per crossing slot: null = straight across; else the fraction of the track swum before turning back. */
  turns: Array<number | null>;
  y: number;
  bobCycles: number;
  bobPhase: number;
  palette: number;
  variant: number;
}

const fishTrack = (f: Fish) => W + f.width + FISH_GAP;
const fishMoveS = (f: Fish) => AQUARIUM_LOOP_S - f.restS;
/** Seconds per crossing slot. */
export const fishSlotS = (f: Fish) => fishMoveS(f) / f.crossings;
/** Cruise speed on a straight crossing, px/s. */
export const fishSpeed = (f: Fish) => fishTrack(f) / fishSlotS(f);

/** Where the fish is and which way it faces at time t (seconds). Closes on the loop. */
function fishState(f: Fish, t: number): { x: number; facing: 1 | -1 } {
  const L = AQUARIUM_LOOP_S;
  const tt = ((t % L) + L) % L;
  // Distance u along the path from the entry side: left edge in [-(width+gap), W).
  const at = (u: number) => (f.dir > 0 ? -(f.width + FISH_GAP) + u : W - u);
  const moveS = fishMoveS(f);
  if (tt >= moveS) return { x: at(0), facing: f.dir }; // parked off-screen
  const local = (tt + f.phaseS) % moveS;
  const slot = fishSlotS(f);
  const k = Math.min(f.crossings - 1, Math.floor(local / slot));
  const tau = local - k * slot;
  const track = fishTrack(f);
  const turn = f.turns[k] ?? null;
  if (turn === null) return { x: at((track / slot) * tau), facing: f.dir };
  // Turnaround: swim in to turn*track, flip, swim back out the same side, all within the slot.
  const d = turn * track;
  const p = ((2 * d) / slot) * tau;
  return p < d ? { x: at(p), facing: f.dir } : { x: at(2 * d - p), facing: f.dir > 0 ? -1 : 1 };
}
/** Left edge of the fish at time t (seconds). */
export const fishX = (f: Fish, t: number): number => fishState(f, t).x;
/** Which way the fish faces at time t: its direction of travel. */
export const fishFacing = (f: Fish, t: number): 1 | -1 => fishState(f, t).facing;

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

const FISH_SIZES = {
  1: { width: 4, yMax: 12 },
  2: { width: 6, yMax: 11 },
  3: { width: 9, yMax: 9 },
} as const;

function makeFish(): Fish[] {
  // A school of small fish, a few medium, and one large fish that visits once a loop.
  const plan: Array<{ size: 1 | 2 | 3; crossings: number; restS: number }> = [
    ...Array.from({ length: 5 }, () => ({ size: 1 as const, crossings: pick([5, 6, 6]), restS: 0 })), // 1.8–2.15 px/s
    ...Array.from({ length: 3 }, () => ({ size: 2 as const, crossings: 4, restS: 0 })), // ~1.5 px/s
    { size: 3, crossings: 1, restS: LARGE_FISH_REST_S }, // ~1.3 px/s, on screen ~1 minute in 4
  ];
  const fish = plan.map((p, i): Fish => {
    const moveS = AQUARIUM_LOOP_S - p.restS;
    return {
      dir: i % 2 === 0 ? 1 : -1,
      size: p.size,
      width: FISH_SIZES[p.size].width,
      crossings: p.crossings,
      restS: p.restS,
      phaseS: p.restS ? 0 : between(0, moveS),
      turns: Array.from({ length: p.crossings }, () => (random() < TURNAROUND_CHANCE ? pick([0.45, 0.5, 0.55]) : null)),
      y: Math.floor(between(2, FISH_SIZES[p.size].yMax)),
      bobCycles: pick([40, 50, 60]),
      bobPhase: between(0, Math.PI * 2),
      palette: i % FISH_PALETTES.length,
      variant: Math.floor(random() * 3),
    };
  });
  // Guarantee a populated tank at t=0: spread the first four across the screen on a straight crossing.
  for (let i = 0; i < 4; i++) {
    const f = fish[i]!;
    f.turns[0] = null;
    f.phaseS = (f.width + FISH_GAP + 4 + i * 16) / fishSpeed(f);
  }
  return fish;
}

function makeBubbles(): Bubble[] {
  return Array.from({ length: 10 }, () => ({
    x: 1 + Math.floor(random() * (W - 2)),
    y0: between(0, BUBBLE_TRACK),
    rises: pick([30, 40, 50, 60, 70]),
    swayCycles: pick([70, 80, 90, 100]),
    swayPhase: between(0, Math.PI * 2),
    big: random() < 0.18,
  }));
}

function makePlants(): Plant[] {
  return [2, 8, 14, 22, 31, 40, 50, 59, 67].map((x) => ({
    x: x + Math.floor(between(-1, 2)),
    height: 3 + Math.floor(random() * 5),
    swayCycles: pick([30, 40, 50]),
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

// Fish silhouettes drawn swimming RIGHT: a tapered head leads, the body is
// the tallest part, and a forked tail trails. Left-swimmers are the mirror.
// ('.' water, 'B' base colour, 'A' accent, 'E' eye.) The first cut had the
// small fish 4 px tall at both ends and 2 px in the middle, so the eye end
// read as a tail fin and they looked like they swam backwards (Gavin 2026-11-08).
const SMALL_FISH_RIGHT: readonly string[] = [
  "A.B.",
  ".ABE",
  "A.B.",
];
const MEDIUM_FISH_RIGHT: readonly string[] = [
  "A.BBB.",
  ".ABBBE",
  ".ABBBB",
  "A.BBB.",
];
const BIG_FISH_RIGHT: readonly string[] = [
  "A...BBB..",
  ".A.BBBBB.",
  ".ABBBBBEB",
  ".ABBBBBBB",
  ".A.BBBBB.",
  "A...BBB..",
];
/** Accent marking inside the medium body per variant, as [col, row] on the right-facing sprite. */
const MEDIUM_MARK: ReadonlyArray<readonly [number, number] | null> = [null, [3, 1], [2, 2]];

/** The fish's pixel rows, facing `facing` (1 = right). */
export function fishSprite(f: Pick<Fish, "size" | "variant">, facing: 1 | -1): string[] {
  const base = f.size === 1 ? SMALL_FISH_RIGHT : f.size === 2 ? MEDIUM_FISH_RIGHT : BIG_FISH_RIGHT;
  const rows = base.map((r) => r.split(""));
  if (f.size === 2) {
    const mark = MEDIUM_MARK[f.variant % MEDIUM_MARK.length];
    if (mark) rows[mark[1]]![mark[0]] = "A";
  } else if (f.size === 3) {
    rows[2 + (f.variant % 2)]![4] = "A";
  }
  const out = rows.map((r) => r.join(""));
  return facing > 0 ? out : out.map((r) => r.split("").reverse().join(""));
}

function drawFish(buf: Uint8Array, f: Fish, t: number): void {
  const { x: fx, facing } = fishState(f, t);
  const x = Math.round(fx);
  const y = f.y + Math.round(Math.sin(turn(f.bobCycles, t, f.bobPhase)) * 0.65);
  const [base, accent] = FISH_PALETTES[f.palette]!;
  const rows = fishSprite(f, facing);
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r]!.length; c++) {
      const ch = rows[r]![c];
      if (ch === ".") continue;
      put(buf, x + c, y + r, ch === "E" ? EYE : ch === "A" ? accent : base);
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
