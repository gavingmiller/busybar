import { describe, it, expect } from "bun:test";
import {
  colorGridElements,
  colorGridPayload,
  PALETTE,
  COLUMNS,
  ROWS,
  FRONT_DISPLAY_WIDTH,
  FRONT_DISPLAY_HEIGHT,
} from "./palette.ts";

describe("PALETTE", () => {
  it("has exactly COLUMNS x ROWS swatches, one per grid cell", () => {
    expect(PALETTE).toHaveLength(COLUMNS * ROWS);
  });

  it("every swatch has a label and a valid #RRGGBBAA color", () => {
    for (const swatch of PALETTE) {
      expect(swatch.label.length).toBeGreaterThan(0);
      expect(swatch.color).toMatch(/^#[0-9A-Fa-f]{8}$/);
    }
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
