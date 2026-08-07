import { describe, it, expect } from "bun:test";
import {
  hsvToHex,
  colorGridElements,
  colorGridPayload,
  PALETTE,
  COLUMNS,
  ROWS,
  HUES,
  FRONT_DISPLAY_WIDTH,
  FRONT_DISPLAY_HEIGHT,
} from "./palette.ts";

describe("hsvToHex", () => {
  it("converts known hues at full saturation/value", () => {
    expect(hsvToHex(0, 100, 100)).toBe("#FF0000FF"); // red
    expect(hsvToHex(120, 100, 100)).toBe("#00FF00FF"); // green
    expect(hsvToHex(240, 100, 100)).toBe("#0000FFFF"); // blue
    expect(hsvToHex(60, 100, 100)).toBe("#FFFF00FF"); // yellow
  });

  it("converts zero-saturation to grayscale", () => {
    expect(hsvToHex(0, 0, 0)).toBe("#000000FF");
    expect(hsvToHex(0, 0, 100)).toBe("#FFFFFFFF");
    expect(hsvToHex(0, 0, 50)).toBe("#808080FF");
  });
});

describe("PALETTE", () => {
  // 12 hues (30deg apart) covers the full wheel, not 8 hand-picked ones;
  // crossed with value ramp (100/66/33% at full saturation) and saturation
  // ramp (100/66/33% at full value — 100% shared with the value ramp's
  // first row) plus a grayscale row, this is a systematic hue x saturation
  // x value sweep rather than a hand-picked sample, closer to answering
  // "what can this display actually render" than 24 named colors were.
  it("has exactly COLUMNS x ROWS swatches, one per grid cell", () => {
    expect(PALETTE).toHaveLength(COLUMNS * ROWS);
  });

  it("covers 12 hues 30 degrees apart", () => {
    expect(HUES).toHaveLength(12);
    expect(HUES).toEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
  });

  it("every swatch has a label and a valid #RRGGBBAA color", () => {
    for (const swatch of PALETTE) {
      expect(swatch.label.length).toBeGreaterThan(0);
      expect(swatch.color).toMatch(/^#[0-9A-Fa-f]{8}$/);
    }
  });

  it("includes a full-brightness, fully-saturated swatch for every hue", () => {
    for (const h of HUES) {
      expect(PALETTE.find((s) => s.color === hsvToHex(h, 100, 100))).toBeTruthy();
    }
  });

  it("includes a grayscale ramp from black to white", () => {
    expect(PALETTE.find((s) => s.color === "#000000FF")).toBeTruthy();
    expect(PALETTE.find((s) => s.color === "#FFFFFFFF")).toBeTruthy();
  });
});

describe("colorGridElements", () => {
  const elements = colorGridElements();

  it("draws one rectangle per palette swatch", () => {
    expect(elements).toHaveLength(PALETTE.length);
  });

  it("gives every element a unique id", () => {
    const ids = elements.map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every element is a valid solid-fill rectangle on the front display, with no border", () => {
    for (const el of elements) {
      expect(el.type).toBe("rectangle");
      expect(el.display).toBe("front");
      expect(el.fill).toBe("solid");
      expect(el.border_width).toBe(0);
      expect(el.fill_colors[0]).toMatch(/^#[0-9A-Fa-f]{8}$/);
    }
  });

  it("tiles the grid to exactly fill the display width with no gaps or overlap", () => {
    const row = elements.filter((el) => el.y === elements[0]!.y).sort((a, b) => a.x - b.x);
    expect(row).toHaveLength(COLUMNS);
    expect(row[0]!.x).toBe(0);
    for (let i = 1; i < row.length; i++) {
      expect(row[i]!.x).toBe(row[i - 1]!.x + row[i - 1]!.width);
    }
    const last = row[row.length - 1]!;
    expect(last.x + last.width).toBe(FRONT_DISPLAY_WIDTH);
  });

  it("stays within the display bounds on every axis", () => {
    for (const el of elements) {
      expect(el.x).toBeGreaterThanOrEqual(0);
      expect(el.y).toBeGreaterThanOrEqual(0);
      expect(el.x + el.width).toBeLessThanOrEqual(FRONT_DISPLAY_WIDTH);
      expect(el.y + el.height).toBeLessThanOrEqual(FRONT_DISPLAY_HEIGHT);
    }
  });

  it("stays well under the device's ~100-element per-draw cap", () => {
    expect(elements.length).toBeLessThanOrEqual(100);
  });
});

describe("colorGridPayload", () => {
  it("wraps the elements under a stable application_name at high priority", () => {
    const payload = colorGridPayload();
    expect(payload.application_name).toBe("color_grid");
    expect(payload.elements).toEqual(colorGridElements());
    expect(payload.priority).toBeGreaterThan(90);
  });
});
