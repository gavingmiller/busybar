import { describe, it, expect } from "bun:test";
import { trailGrid, TRAIL_BANDS, TRAIL_WAVELENGTH, TRAIL_PERIOD, TRAIL_FPS, TRAIL_SPEED_PX_PER_S, TRAIL_SCROLL_FRAMES } from "./trail.ts";

describe("trailGrid", () => {
  const length = 32;
  const height = 12;

  it("is a rectangular grid of the requested size", () => {
    const grid = trailGrid(0, length, height);
    expect(grid).toHaveLength(height);
    for (const row of grid) expect(row).toHaveLength(length);
  });

  it("uses only the six rainbow colours and transparency", () => {
    const chars = new Set(trailGrid(3, length, height).join(""));
    for (const ch of chars) expect([...TRAIL_BANDS, "."]).toContain(ch);
  });

  it("every column carries all six bands in order, top to bottom, with no gaps inside the band", () => {
    const grid = trailGrid(5, length, height);
    for (let x = 0; x < length; x++) {
      const column = grid.map((row) => row[x]).filter((ch) => ch !== ".");
      // Collapse runs so "RROOYYGGCCPP" becomes "ROYGCP".
      const order = column.filter((ch, i) => i === 0 || ch !== column[i - 1]).join("");
      expect(order).toBe(TRAIL_BANDS.join(""));
    }
  });

  it("the wave is gentle: adjacent columns never differ by more than one pixel", () => {
    const grid = trailGrid(7, length, height);
    const top = (x: number) => grid.findIndex((row) => row[x] !== ".");
    for (let x = 1; x < length; x++) expect(Math.abs(top(x) - top(x - 1))).toBeLessThanOrEqual(1);
  });

  it("plays at the device's fast native cadence while the wave still travels 16 px/s", () => {
    expect(TRAIL_FPS).toBe(48);
    expect(TRAIL_SPEED_PX_PER_S).toBe(16);
    expect(TRAIL_SCROLL_FRAMES).toBe(TRAIL_FPS / TRAIL_SPEED_PX_PER_S);
    expect(Number.isInteger(TRAIL_SCROLL_FRAMES)).toBe(true);
  });

  it("the wave actually moves: the pattern scrolls one column left every TRAIL_SCROLL_FRAMES frames", () => {
    const a = trailGrid(0, length, height);
    const b = trailGrid(TRAIL_SCROLL_FRAMES, length, height);
    for (const row of a.keys()) expect(b[row]!.slice(0, length - 1)).toBe(a[row]!.slice(1));
  });

  it("in-between frames only ever nudge a column by one pixel (no flicker)", () => {
    for (let f = 0; f < TRAIL_SCROLL_FRAMES * 2; f++) {
      const a = trailGrid(f, length, height);
      const b = trailGrid(f + 1, length, height);
      const top = (g: string[], x: number) => g.findIndex((row) => row[x] !== ".");
      for (let x = 0; x < length; x++) expect(Math.abs(top(a, x) - top(b, x))).toBeLessThanOrEqual(1);
    }
  });

  it("repeats every TRAIL_PERIOD frames: one wavelength scrolled past at 16 px/s", () => {
    expect(TRAIL_PERIOD).toBe((TRAIL_WAVELENGTH / TRAIL_SPEED_PX_PER_S) * TRAIL_FPS);
    expect(TRAIL_PERIOD % TRAIL_WAVELENGTH).toBe(0);
    expect(trailGrid(TRAIL_PERIOD, length, height)).toEqual(trailGrid(0, length, height));
    expect(trailGrid(1, length, height)).not.toEqual(trailGrid(0, length, height));
  });
});
