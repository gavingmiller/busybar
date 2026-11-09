import { describe, it, expect } from "bun:test";
import { SQUIRT_PICKS, SQUIRT_VARIANTS, DIGITS, PICK_SLOT_W, renderPicksFrame } from "./squirt-picks.ts";
import { FRONT_WIDTH, FRONT_HEIGHT } from "../../lib/scene.ts";

const px = (f: Uint8Array, x: number, y: number) => {
  const i = (y * FRONT_WIDTH + x) * 4;
  return [f[i], f[i + 1], f[i + 2]];
};
const lit = (f: Uint8Array, x: number, y: number) => px(f, x, y).some((c) => c !== 0);

describe("Squirt picks line-up (temporary comparison scene)", () => {
  it("offers five distinct 12x10 water-blob variants, each with eye, mouth and highlight colours", () => {
    expect(SQUIRT_VARIANTS).toHaveLength(5);
    const seen = new Set<string>();
    for (const v of SQUIRT_VARIANTS) {
      expect(v.frames.length).toBeGreaterThanOrEqual(1);
      for (const fr of v.frames) {
        expect(fr).toHaveLength(10);
        for (const row of fr) {
          expect(row).toHaveLength(12);
          for (const ch of row) if (ch !== ".") expect(v.colors[ch], `${v.name}: colour ${ch}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
        expect(fr[9]!.replace(/\./g, "").length, `${v.name} rests on the bottom row`).toBeGreaterThan(0);
      }
      const flat = v.frames[0]!.join("") + JSON.stringify(v.colors);
      for (const ch of ["K", "R", "W"]) expect(flat.includes(ch), `${v.name} has ${ch}`).toBe(true);
      expect(seen.has(flat)).toBe(false);
      seen.add(flat);
    }
  });

  it("digits 1–5 are 3x5 glyphs", () => {
    for (const d of [1, 2, 3, 4, 5]) {
      const g = DIGITS[d]!;
      expect(g).toHaveLength(5);
      for (const row of g) expect(row).toHaveLength(3);
    }
  });

  it("lays the five out across the display with a lit number above each blob", () => {
    expect(PICK_SLOT_W * 5).toBeLessThanOrEqual(FRONT_WIDTH);
    const f = renderPicksFrame(0);
    expect(f.length).toBe(FRONT_WIDTH * FRONT_HEIGHT * 4);
    for (let i = 0; i < 5; i++) {
      const x0 = 1 + i * PICK_SLOT_W;
      let digitLit = 0;
      for (let y = 0; y < 5; y++) for (let x = x0; x < x0 + PICK_SLOT_W; x++) if (lit(f, x, y)) digitLit++;
      expect(digitLit, `digit ${i + 1} visible`).toBeGreaterThanOrEqual(5);
      let blobLit = 0;
      for (let y = 6; y < FRONT_HEIGHT; y++) for (let x = x0; x < x0 + PICK_SLOT_W; x++) if (lit(f, x, y)) blobLit++;
      expect(blobLit, `blob ${i + 1} visible`).toBeGreaterThan(30);
    }
    // nothing bleeds into the gap row between numbers and blobs
    for (let x = 0; x < FRONT_WIDTH; x++) expect(lit(f, x, 5)).toBe(false);
  });

  it("is a short seamless opaque loop that animates", () => {
    const frames = SQUIRT_PICKS.frames();
    expect(SQUIRT_PICKS.id).toBe("squirt_picks");
    expect(frames.length / SQUIRT_PICKS.fps).toBeLessThanOrEqual(4);
    for (const f of frames) for (let i = 3; i < f.length; i += 4) if (f[i] !== 255) throw new Error("transparent pixel");
    expect(renderPicksFrame(frames.length)).toEqual(frames[0]!);
    expect(frames.some((f) => !f.every((b, i) => b === frames[0]![i]))).toBe(true);
  });
});
