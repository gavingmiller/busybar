import { describe, it, expect } from "bun:test";
import { toDeviceColor, rect, FRONT_DISPLAY_WIDTH, FRONT_DISPLAY_HEIGHT, VERTICAL_SAFE_MARGIN, DRAW_PRIORITY } from "./display.ts";

describe("toDeviceColor", () => {
  it("swaps the R and B channels", () => {
    // Confirmed empirically against the physical device: a #RRGGBBAA fill
    // sent as-is renders with red and blue swapped (red draws as blue, a
    // tan border draws steel-blue, etc). Compensate by swapping before send.
    expect(toDeviceColor("#FF8000FF")).toBe("#0080FFFF");
  });

  it("leaves the alpha and green channels untouched", () => {
    expect(toDeviceColor("#11223344")).toBe("#33221144");
  });
});

describe("rect", () => {
  it("builds a solid-fill RectangleElement offset from an origin, with no border", () => {
    const el = rect("swatch-0", 10, 5, 2, 3, 6, 4, "#FF0000FF");

    expect(el).toEqual({
      id: "swatch-0",
      type: "rectangle",
      x: 12,
      y: 8,
      width: 6,
      height: 4,
      fill: "solid",
      fill_colors: [toDeviceColor("#FF0000FF")],
      border_width: 0,
      display: "front",
      timeout: 0,
    });
  });
});

describe("display constants", () => {
  it("matches the physical front display's RGB LED matrix", () => {
    expect(FRONT_DISPLAY_WIDTH).toBe(72);
    expect(FRONT_DISPLAY_HEIGHT).toBe(16);
  });

  it("draws high enough priority to preempt an active work session (90)", () => {
    expect(DRAW_PRIORITY).toBeGreaterThan(90);
    expect(DRAW_PRIORITY).toBeLessThanOrEqual(100);
  });

  it("keeps content 1px in from the bezel-clipped edge rows", () => {
    expect(VERTICAL_SAFE_MARGIN).toBe(1);
  });
});
