import { describe, it, expect } from "bun:test";
import { toDeviceColor, rect, FRONT_DISPLAY_WIDTH, FRONT_DISPLAY_HEIGHT, VERTICAL_SAFE_MARGIN, DRAW_PRIORITY } from "./display.ts";

describe("toDeviceColor", () => {
  it("passes the color through unchanged", () => {
    // An earlier version of this function swapped R and B, based on a
    // capture-script-derived "confirmation" that turned out to be wrong —
    // the capture script itself had a matching R/B decode bug that made a
    // truly-broken (swapped) device render look correct when read back
    // through it. Re-verified live via the device's own web UI
    // (http://10.0.4.20/) and a controlled 6-color test: unswapped colors
    // sent as their true RGB values render correctly with no compensation
    // needed. Kept as a named pass-through (not removed) as the one seam
    // where real device color compensation would go if one is ever found
    // again — don't reintroduce a swap here without re-confirming via the
    // web UI or a physical photo, not just this project's own capture tooling.
    expect(toDeviceColor("#FF8000FF")).toBe("#FF8000FF");
  });

  it("is a no-op regardless of channel values", () => {
    expect(toDeviceColor("#11223344")).toBe("#11223344");
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
