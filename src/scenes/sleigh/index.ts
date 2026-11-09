// Santa's Sleigh: four reindeer pull Santa right to left across a starry
// night over snow, a few times per loop with empty sky between crossings.
// Snow falls, dark fir trees scroll slower behind the team (parallax), the
// lead reindeer's nose glows red AT THE FRONT (Gavin 2026-11-09: the mock-up
// had it on his butt), and now and then a present tumbles from the sleigh.
// Seasonal: only offered in December on the Edmonton calendar.

import { FRONT_WIDTH as W, FRONT_HEIGHT as H, type Scene } from "../../lib/scene.ts";

export const SLEIGH_FPS = 24;
export const SLEIGH_LOOP_S = 60;
export const SLEIGH_FRAME_COUNT = SLEIGH_FPS * SLEIGH_LOOP_S;
/** One crossing plus the empty sky after it; the loop holds four. */
export const CROSSING_S = 15;
/** Team speed, px/s, right → left. */
export const SLEIGH_SPEED = 16;
/** Tree strip speed, px/s; the strip is 240 px so it closes once per loop. */
export const TREE_SPEED = 4;
const TREE_STRIP = TREE_SPEED * SLEIGH_LOOP_S;

type RGB = readonly [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export const SNOW_ROWS = [14, 15] as const;
export const SNOW = ["#E8ECF4", "#C8D0E0"] as const;
export const SNOWFLAKE = "#F0F4FF";
export const STAR_COLORS = ["#3A4060", "#8088A8", "#D8DCF0"] as const;
const TREE = "#1E4A28", TREE_CAP = "#DCE4F0", REIN = "#6A4A2A";

/** Lead reindeer's nose letter; the other three wear a dark nose instead. */
export const LEAD_NOSE = "N";
const COLORS: Record<string, string> = {
  N: "#FF3030", n: "#B02020", D: "#4A3020", H: "#A06A40", B: "#8A5A3A", Y: "#D8C080",
  R: "#C82828", W: "#F0F0F0", F: "#F0C8A0", G: "#D8B060",
};

/** Reindeer, drawn FACING LEFT: nose at column 0, antlers up top, two leg poses. */
export const REINDEER: readonly (readonly string[])[] = [
  [
    ".Y.Y.....",
    "..YY.....",
    "NHHBBBBB.",
    ".HBBBBBBB",
    "..B..B..B",
    "..B.B...B",
  ],
  [
    ".Y.Y.....",
    "..YY.....",
    "NHHBBBBB.",
    ".HBBBBBBB",
    "...B.BB..",
    "..B...B.B",
  ],
];
/** Sleigh facing left with Santa seated at the back (right). */
const SLEIGH_ART: readonly string[] = [
  "........W..",
  ".......RRR.",
  "R......FWW.",
  "RRRRRRRRRRR",
  ".RRRRRRRRR.",
  "..RRRRRRR..",
  "GGGGGGGGGGG",
];
const DEER_W = 9, DEER_GAP = 1, DEER_Y = 6, SLEIGH_X = 4 * (DEER_W + DEER_GAP) + 2, SLEIGH_Y = 5;
const TEAM_W = SLEIGH_X + SLEIGH_ART[0]!.length;

/** mulberry32, so the sky and trees are the same every build. */
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
const random = rng(0x5a17e);
const STARS = Array.from({ length: 18 }, () => ({ x: Math.floor(random() * W), y: Math.floor(random() * 10), k: 1 + Math.floor(random() * 5), ph: random() * Math.PI * 2 }));
const TREES = Array.from({ length: 14 }, () => ({ x: Math.floor(random() * TREE_STRIP), h: 2 + Math.floor(random() * 3) }));
const FLAKES = Array.from({ length: 10 }, (_, i) => ({ x0: Math.floor(random() * W), period: [6, 10, 12, 15, 20][i % 5]!, k: 1 + Math.floor(random() * 3), ph: random() * Math.PI * 2 }));

/** Leftmost column of the team (the lead reindeer's nose) at loop time t; far off screen between crossings. */
export function teamX(t: number): number {
  const tl = ((t % CROSSING_S) + CROSSING_S) % CROSSING_S;
  return W + 2 - SLEIGH_SPEED * tl;
}

/** December on Gavin's calendar (America/Edmonton), whatever the UTC date says. */
export function isDecemberInEdmonton(now: Date): boolean {
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", month: "numeric" }).format(now);
  return month === "12";
}

function put(buf: Uint8Array, x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
}
function blit(buf: Uint8Array, rows: readonly string[], x0: number, y0: number, colors: Record<string, string>): void {
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y]!.length; x++) {
    const ch = rows[y]![x]!;
    if (ch !== ".") put(buf, x0 + x, y0 + y, hex(colors[ch]!));
  }
}

/** One frame of the loop at frame index `i` (any integer; wraps). */
export function renderFrame(i: number): Uint8Array {
  const t = (((i % SLEIGH_FRAME_COUNT) + SLEIGH_FRAME_COUNT) % SLEIGH_FRAME_COUNT) / SLEIGH_FPS;
  const tau = Math.PI * 2;
  const buf = new Uint8Array(W * H * 4);
  for (let p = 3; p < buf.length; p += 4) buf[p] = 255;

  // Stars: each twinkles an integer number of times per loop.
  for (const s of STARS) {
    const b = 0.5 + 0.5 * Math.sin(tau * s.k * t / SLEIGH_LOOP_S + s.ph);
    put(buf, s.x, s.y, hex(STAR_COLORS[b > 0.8 ? 2 : b > 0.5 ? 1 : 0]!));
  }
  // Snowflakes: fall the full height once per period, swaying.
  for (const f of FLAKES) {
    const y = Math.floor(((t / f.period) % 1) * 14);
    const x = ((f.x0 + Math.round(Math.sin(tau * f.k * t / SLEIGH_LOOP_S + f.ph) * 2)) % W + W) % W;
    put(buf, x, y, hex(SNOWFLAKE));
  }
  // Fir trees on the far snow line, scrolling slowly (parallax behind the team).
  for (const tr of TREES) {
    const x = ((Math.round(tr.x - TREE_SPEED * t) % TREE_STRIP) + TREE_STRIP) % TREE_STRIP - 4;
    for (let r = 0; r < tr.h; r++) {
      const y = 13 - r, half = tr.h - 1 - r;
      for (let dx = -half; dx <= half; dx++) put(buf, x + dx, y, hex(r === tr.h - 1 ? TREE_CAP : TREE));
    }
  }
  // Snow ground.
  for (let x = 0; x < W; x++) { put(buf, x, 14, hex(SNOW[0])); put(buf, x, 15, hex(SNOW[1])); }

  // The team.
  const tx = Math.round(teamX(t));
  if (tx + TEAM_W > 0 && tx < W) {
    const pose = Math.floor(t * 6) % 2;
    const blink = Math.floor(t * 3) % 2;
    for (let d = 0; d < 4; d++) {
      const rows = REINDEER[(pose + d) % 2]!;
      const art = d === 0 ? rows.map((r) => r.replace("N", blink ? "N" : "n")) : rows.map((r) => r.replace("N", "D"));
      const dx = tx + d * (DEER_W + DEER_GAP);
      blit(buf, art, dx, DEER_Y, COLORS);
      put(buf, dx + DEER_W, DEER_Y + 2, hex(REIN));
    }
    put(buf, tx + SLEIGH_X - 1, DEER_Y + 2, hex(REIN));
    blit(buf, SLEIGH_ART, tx + SLEIGH_X, SLEIGH_Y, COLORS);
    // A present tumbles out once per crossing and lies in the snow until the team has gone.
    const tl = ((t % CROSSING_S) + CROSSING_S) % CROSSING_S;
    if (tl >= 4.5 && tl < 8) {
      const dropX = Math.round(teamX(4.5)) + SLEIGH_X + 4;
      const y = Math.min(12, SLEIGH_Y + 6 + Math.floor((tl - 4.5) * 6));
      put(buf, dropX, y, hex("#30C060")); put(buf, dropX + 1, y, hex("#F0D040"));
      put(buf, dropX, y + 1, hex("#F0D040")); put(buf, dropX + 1, y + 1, hex("#30C060"));
    }
  }
  return buf;
}

export const SLEIGH: Scene = {
  id: "sleigh",
  name: "Santa's Sleigh",
  fps: SLEIGH_FPS,
  frames: () => Array.from({ length: SLEIGH_FRAME_COUNT }, (_, i) => renderFrame(i)),
  available: isDecemberInEdmonton,
  availableNote: "only plays in December",
};
