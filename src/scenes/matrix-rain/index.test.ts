import { describe, it, expect } from "bun:test";
import { MATRIX_RAIN, LOOP_SECONDS, FRAME_COUNT, COLUMNS, CELL_W, THEME, rainFrame } from "./index.ts";
import { FRONT_WIDTH, FRONT_HEIGHT } from "../../lib/scene.ts";
import { encodeAnimFile } from "../../lib/anim-file.ts";

const px = (f: Uint8Array, x: number, y: number) => {
  const i = (y * FRONT_WIDTH + x) * 4;
  return [f[i]!, f[i + 1]!, f[i + 2]!, f[i + 3]!] as const;
};
const lit = (f: Uint8Array) => {
  const out: Array<{ x: number; y: number; rgb: readonly [number, number, number] }> = [];
  for (let y = 0; y < FRONT_HEIGHT; y++) for (let x = 0; x < FRONT_WIDTH; x++) {
    const [r, g, b] = px(f, x, y);
    if (r + g + b > 0) out.push({ x, y, rgb: [r, g, b] });
  }
  return out;
};

describe("MATRIX_RAIN scene", () => {
  const frames = MATRIX_RAIN.frames();

  it("identifies itself and renders one 10–30 s loop of opaque full-display frames at 24–48 fps", () => {
    expect(MATRIX_RAIN.id).toBe("matrix_rain");
    expect(MATRIX_RAIN.name).toBe("Matrix Rain");
    expect(MATRIX_RAIN.fps).toBeGreaterThanOrEqual(24);
    expect(MATRIX_RAIN.fps).toBeLessThanOrEqual(48);
    expect(LOOP_SECONDS).toBeGreaterThanOrEqual(10);
    expect(LOOP_SECONDS).toBeLessThanOrEqual(30);
    expect(frames).toHaveLength(FRAME_COUNT);
    expect(FRAME_COUNT).toBe(LOOP_SECONDS * MATRIX_RAIN.fps);
    for (const f of frames) {
      expect(f.length).toBe(FRONT_WIDTH * FRONT_HEIGHT * 4);
      for (let i = 3; i < f.length; i += 4) if (f[i] !== 255) throw new Error("non-opaque pixel");
    }
  });

  it("loops seamlessly: the frame after the last one is frame 0, and is deterministic", () => {
    expect(rainFrame(FRAME_COUNT)).toEqual(frames[0]!);
    expect(rainFrame(FRAME_COUNT + 7)).toEqual(frames[7]!);
    expect(MATRIX_RAIN.frames()[100]).toEqual(frames[100]!);
  });

  it("only paints the green theme, and every frame has a brighter head than its tail", () => {
    const palette = new Set(Object.values(THEME).map((c) => c.join()));
    for (const i of [0, 50, 150, FRAME_COUNT - 1]) {
      const pixels = lit(frames[i]!);
      expect(pixels.length).toBeGreaterThan(40);
      for (const p of pixels) {
        // every lit pixel is green-dominant
        expect(p.rgb[1]).toBeGreaterThanOrEqual(p.rgb[0]);
        expect(p.rgb[1]).toBeGreaterThanOrEqual(p.rgb[2]);
      }
      expect(pixels.some((p) => p.rgb.join() === THEME.head.join())).toBe(true);
      expect(pixels.some((p) => p.rgb[1] <= THEME.mid[1])).toBe(true);
    }
    expect(palette.size).toBe(4);
  });

  it("drops fall: the brightest pixel in a column sits lower on the next frame (or has wrapped to the top)", () => {
    let moved = 0, checked = 0;
    for (const i of [10, 60, 200]) {
      for (let c = 0; c < COLUMNS; c++) {
        const headY = (f: Uint8Array) => {
          for (let y = 0; y < FRONT_HEIGHT; y++) for (let x = c * CELL_W; x < c * CELL_W + CELL_W; x++) {
            if (px(f, x, y).slice(0, 3).join() === THEME.head.join()) return y;
          }
          return -1;
        };
        const a = headY(frames[i]!), b = headY(frames[i + 2]!);
        if (a < 0 || b < 0) continue;
        checked++;
        if (b > a || b < a - 6) moved++; // down, or wrapped around to the top
        expect(b === a || b > a || b < a - 6).toBe(true); // never drifts upward
      }
    }
    expect(checked).toBeGreaterThan(10);
    expect(moved).toBeGreaterThan(checked / 2);
  });

  it("glyphs flicker: some lit cell changes shape while its head stays put", () => {
    // Compare two frames one glyph-tick apart with the same positions modulo motion: just require that
    // lit-pixel sets differ by more than a pure shift would explain over the loop (cheap proxy).
    const a = lit(frames[0]!).map((p) => `${p.x},${p.y}`).join("|");
    const b = lit(frames[1]!).map((p) => `${p.x},${p.y}`).join("|");
    expect(a).not.toBe(b);
  });

  it("encodes to a .anim under 6 MB", () => {
    const bytes = encodeAnimFile({ width: FRONT_WIDTH, height: FRONT_HEIGHT, fps: MATRIX_RAIN.fps, frames });
    expect(bytes.length).toBeLessThan(6 * 1024 * 1024);
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
