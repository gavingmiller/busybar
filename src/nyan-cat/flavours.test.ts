import { describe, it, expect } from "bun:test";
import { NYAN_FLAVOURS, CLASSIC_NYAN, PURPLE_NYAN, flavourColors, flavourById } from "./flavours.ts";
import { NYAN_COLORS } from "./sprite-data.ts";

const hue = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
};

const luma = (hex: string): number =>
  0.299 * parseInt(hex.slice(1, 3), 16) + 0.587 * parseInt(hex.slice(3, 5), 16) + 0.114 * parseInt(hex.slice(5, 7), 16);

describe("Nyan Cat flavours", () => {
  it("has unique snake_case ids and Title Case names, classic first, each with a distinct asset tag", () => {
    expect(NYAN_FLAVOURS[0]).toBe(CLASSIC_NYAN);
    expect(CLASSIC_NYAN.id).toBe("nyan_cat");
    expect(CLASSIC_NYAN.name).toBe("Nyan Cat");
    const ids = NYAN_FLAVOURS.map((f) => f.id), tags = NYAN_FLAVOURS.map((f) => f.asset);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(tags).size).toBe(tags.length);
    for (const f of NYAN_FLAVOURS) {
      expect(f.id).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(f.asset).toMatch(/^[a-z]+$/);
      expect(f.name).toMatch(/^([A-Z][a-z]+ ?)+$/);
    }
    expect(flavourById("nyan_cat")).toBe(CLASSIC_NYAN);
    expect(flavourById("nope")).toBeUndefined();
  });

  it("classic is the hand-authored palette untouched", () => {
    expect(flavourColors(CLASSIC_NYAN)).toEqual(NYAN_COLORS);
    expect(CLASSIC_NYAN.asset).toBe("cat");
  });

  it("purple swaps the pink frosting (M) for a light purple with dark purple sprinkles (D), keeping every other colour (Gavin 2026-11-09)", () => {
    const colors = flavourColors(PURPLE_NYAN);
    expect(Object.keys(colors).sort()).toEqual(Object.keys(NYAN_COLORS).sort());
    for (const k of ["M", "D"]) {
      expect(hue(colors[k]!)).toBeGreaterThanOrEqual(255);
      expect(hue(colors[k]!)).toBeLessThanOrEqual(295);
    }
    // Lighter than the first cut (#B266FF, luma ~140); the specks clearly darker than the frosting.
    expect(luma(colors.M!)).toBeGreaterThan(150);
    expect(luma(colors.M!)).toBeLessThan(215); // still reads as purple, not lilac-white
    expect(luma(colors.D!)).toBeLessThan(luma(colors.M!) - 60);
    for (const k of Object.keys(NYAN_COLORS)) if (k !== "M" && k !== "D") expect(colors[k]).toBe(NYAN_COLORS[k]!);
    expect(PURPLE_NYAN.name).toBe("Purple Nyan Cat");
  });
});
