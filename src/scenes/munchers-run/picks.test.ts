import { describe, it, expect } from "bun:test";
import { CHARACTER_PICKS, PICK_VARIANTS, DIGITS, PICK_SLOT_W, renderPicksFrame } from "./picks.ts";
import { FRONT_WIDTH, FRONT_HEIGHT } from "../../lib/scene.ts";

const px = (f: Uint8Array, x: number, y: number) => {
  const i = (y * FRONT_WIDTH + x) * 4;
  return [f[i], f[i + 1], f[i + 2]];
};
const lit = (f: Uint8Array, x: number, y: number) => px(f, x, y).some((c) => c !== 0);

describe("Character picks line-up (temporary comparison scene)", () => {
  it("offers five distinct variants that fit a 12x10 slot, every letter coloured, each resting on its bottom row", () => {
    expect(PICK_VARIANTS).toHaveLength(5);
    const seen = new Set<string>();
    for (const v of PICK_VARIANTS) {
      expect(v.frames.length).toBeGreaterThanOrEqual(1);
      const w = v.frames[0]![0]!.length, h = v.frames[0]!.length;
      expect(w).toBeLessThanOrEqual(12);
      expect(h).toBeLessThanOrEqual(10);
      for (const fr of v.frames) {
        expect(fr).toHaveLength(h);
        for (const row of fr) {
          expect(row).toHaveLength(w);
          for (const ch of row) if (ch !== ".") expect(v.colors[ch], `${v.name}: colour ${ch}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
        expect(fr[h - 1]!.replace(/\./g, "").length, `${v.name} rests on the bottom row`).toBeGreaterThan(0);
      }
      const letters = new Set(v.frames[0]!.join("").replace(/\./g, ""));
      expect(letters.size, `${v.name} uses several colours`).toBeGreaterThanOrEqual(2);
      const key = v.frames.map((f) => f.join("")).join("/") + JSON.stringify(v.colors);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("digits 1–5 are 3x5 glyphs", () => {
    for (const d of [1, 2, 3, 4, 5]) {
      const g = DIGITS[d]!;
      expect(g).toHaveLength(5);
      for (const row of g) expect(row).toHaveLength(3);
    }
  });

  it("lays the five out across the display with a lit number above each one", () => {
    expect(PICK_SLOT_W * 5).toBeLessThanOrEqual(FRONT_WIDTH);
    const f = renderPicksFrame(0);
    expect(f.length).toBe(FRONT_WIDTH * FRONT_HEIGHT * 4);
    for (let i = 0; i < 5; i++) {
      const x0 = 1 + i * PICK_SLOT_W;
      let digitLit = 0;
      for (let y = 0; y < 5; y++) for (let x = x0; x < x0 + PICK_SLOT_W; x++) if (lit(f, x, y)) digitLit++;
      expect(digitLit, `digit ${i + 1} visible`).toBeGreaterThanOrEqual(5);
      let bodyLit = 0;
      for (let y = 6; y < FRONT_HEIGHT; y++) for (let x = x0; x < x0 + PICK_SLOT_W; x++) if (lit(f, x, y)) bodyLit++;
      expect(bodyLit, `variant ${i + 1} visible`).toBeGreaterThan(30);
      // bottom-aligned: the last display row carries the variant's bottom row
      expect(Array.from({ length: PICK_SLOT_W }, (_, k) => lit(f, x0 + k, FRONT_HEIGHT - 1)).some(Boolean)).toBe(true);
    }
    for (let x = 0; x < FRONT_WIDTH; x++) expect(lit(f, x, 5)).toBe(false);
  });

  it("is a short seamless opaque loop that animates", () => {
    const frames = CHARACTER_PICKS.frames();
    expect(CHARACTER_PICKS.id).toBe("picks");
    expect(frames.length / CHARACTER_PICKS.fps).toBeLessThanOrEqual(4);
    for (const f of frames) for (let i = 3; i < f.length; i += 4) if (f[i] !== 255) throw new Error("transparent pixel");
    expect(renderPicksFrame(frames.length)).toEqual(frames[0]!);
    expect(frames.some((f) => !f.every((b, i) => b === frames[0]![i]))).toBe(true);
  });
});
