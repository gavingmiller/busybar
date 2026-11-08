// Matrix digital rain, pre-rendered as one seamless loop for the bar to play
// natively. Ported from the community app (robynhub, maxswinkels/busybar-apps):
// 2x3 glyphs in 3x4 cells, a near-white head, bright green behind it, and a
// tail fading from mid to dim green. Where the original re-rolled columns at
// random, every column here is a periodic function of the frame index so the
// last frame flows straight into the first.

import { FRONT_WIDTH, FRONT_HEIGHT, type Scene } from "../../lib/scene.ts";

export const FPS = 24;
export const LOOP_SECONDS = 12;
export const FRAME_COUNT = FPS * LOOP_SECONDS;

export const CELL_W = 3;
export const CELL_H = 4;
export const COLUMNS = FRONT_WIDTH / CELL_W; // 24
const VISIBLE_CELLS = FRONT_HEIGHT / CELL_H; // 4

export const THEME = {
  head: [220, 255, 220],
  bright: [60, 255, 90],
  mid: [0, 170, 45],
  dim: [0, 70, 18],
} as const;

// The original's 2x3 glyph set (kept verbatim).
const GLYPHS: string[][] = [
  ["11", "11", "11"], ["01", "01", "01"], ["11", "01", "10"], ["11", "01", "11"],
  ["10", "11", "01"], ["11", "10", "01"], ["10", "11", "11"], ["11", "01", "01"],
  ["11", "11", "01"], ["11", "11", "10"], ["11", "10", "11"], ["10", "11", "10"],
  ["01", "01", "11"], ["11", "11", "10"], ["11", "10", "01"], ["10", "10", "11"],
  ["10", "01", "10"], ["10", "11", "01"], ["11", "01", "10"], ["00", "11", "01"],
  ["00", "11", "00"], ["10", "01", "10"],
];

/** Small integer hash → [0, 1). Deterministic; no Math.random anywhere. */
function hash(...parts: number[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    h ^= (p + 0x9e3779b9) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 13;
  }
  return (h >>> 0) / 4294967296;
}

interface Column {
  /** Tail length in cells. */
  length: number;
  /** Cells between one drop's tail leaving and the next head arriving. */
  gap: number;
  /** One drop cycle, in cells: it enters above the top and leaves below the bottom. */
  span: number;
  /** Passes per loop; speed = passes*span/LOOP_SECONDS cells/s, 4–10 like the original. */
  passes: number;
  /** Phase offset in cells. */
  phase: number;
  /** Glyph re-rolls per second; an integer count per loop keeps it seamless. */
  mutateHz: number;
}

const COLUMNS_SPEC: Column[] = Array.from({ length: COLUMNS }, (_, c) => {
  const length = 3 + Math.floor(hash(c, 1) * 5); // 3..7 (the original's 2..6 reads too sparse on 4 visible cells)
  const gap = 1 + Math.floor(hash(c, 2) * 4); // 1..4
  const span = VISIBLE_CELLS + length + gap;
  // speed ≈ 4–10 cells/s → passes = round(speed*LOOP/span), clamped so no column is static.
  const wanted = 4 + hash(c, 3) * 6;
  const passes = Math.max(2, Math.round((wanted * LOOP_SECONDS) / span));
  const phase = hash(c, 4) * span;
  const mutateHz = [3, 4, 6][Math.floor(hash(c, 5) * 3)]!; // integers → mutateHz*LOOP ticks per loop
  return { length, gap, span, passes, phase, mutateHz };
});

function color(i: number, length: number): readonly [number, number, number] {
  if (i === 0) return THEME.head;
  if (i === 1) return THEME.bright;
  const t = Math.min(1, (i - 2) / Math.max(1, length - 2));
  // Snap to the two tail colours like the original's mix(), quantised so the palette stays 4-wide.
  return t < 0.5 ? THEME.mid : THEME.dim;
}

function put(f: Uint8Array, x: number, y: number, rgb: readonly [number, number, number]): void {
  if (x < 0 || x >= FRONT_WIDTH || y < 0 || y >= FRONT_HEIGHT) return;
  const i = (y * FRONT_WIDTH + x) * 4;
  f[i] = rgb[0]; f[i + 1] = rgb[1]; f[i + 2] = rgb[2]; f[i + 3] = 255;
}

/** Frame `n` of the loop (any integer; periodic in FRAME_COUNT). */
export function rainFrame(n: number): Uint8Array {
  const f = new Uint8Array(FRONT_WIDTH * FRONT_HEIGHT * 4);
  for (let i = 3; i < f.length; i += 4) f[i] = 255;
  const t = (((n % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT) / FPS;
  COLUMNS_SPEC.forEach((col, c) => {
    const speed = (col.passes * col.span) / LOOP_SECONDS; // cells/s
    const pos = (col.phase + speed * t) % col.span; // head position in cells, 0 = just above the display
    const pass = Math.floor((col.phase + speed * t) / col.span) % col.passes; // periodic, so the glyph roll closes on the loop
    const headPx = Math.floor(pos * CELL_H) - CELL_H; // head cell's top pixel row; pos 0 is just above the display
    const tick = Math.floor(t * col.mutateHz);
    for (let i = 0; i < col.length; i++) {
      const y = headPx - i * CELL_H;
      if (y >= FRONT_HEIGHT || y + 3 < 0) continue;
      const cellRow = Math.floor((y + CELL_H) / CELL_H); // stable per glyph position
      const glyph = GLYPHS[Math.floor(hash(c, pass, i, cellRow, tick) * GLYPHS.length)]!;
      const rgb = color(i, col.length);
      glyph.forEach((row, gy) => {
        for (let gx = 0; gx < 2; gx++) if (row[gx] === "1") put(f, c * CELL_W + gx, y + gy, rgb);
      });
    }
  });
  return f;
}

export const MATRIX_RAIN: Scene = {
  id: "matrix_rain",
  name: "Matrix Rain",
  fps: FPS,
  frames: () => Array.from({ length: FRAME_COUNT }, (_, n) => rainFrame(n)),
};
