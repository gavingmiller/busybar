import { describe, it, expect } from "bun:test";
import {
  nyanCatPayload,
  nyanCatElements,
  stationaryOriginX,
  flyingOriginX,
  toDeviceColor,
  FRONT_DISPLAY_WIDTH,
  CAT_WIDTH,
  DEFAULT_TRAIL_LENGTH,
} from "./sprite.ts";

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

describe("nyanCatElements", () => {
  const elements = nyanCatElements(40, 0);

  it("draws the cat body plus a 6-band rainbow trail", () => {
    // 10 cat parts (head, body border/fill, eyes, cheeks, mouth, legs) + 6 trail bands
    expect(elements).toHaveLength(16);
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
      expect(el.fill_colors).toHaveLength(1);
      expect(el.fill_colors[0]).toMatch(/^#[0-9A-Fa-f]{8}$/);
      expect(el.width).toBeGreaterThan(0);
      expect(el.height).toBeGreaterThan(0);
      // border_width defaults to 1px, white — on 1-2px-thick shapes (the
      // trail bands, eyes, mouth) that border alone fills the whole shape,
      // hiding the intended fill color entirely. Must be explicitly 0.
      expect(el.border_width).toBe(0);
    }
  });

  it("positions the rainbow trail entirely to the left of the cat's origin", () => {
    const trail = elements.filter((el) => el.id.startsWith("trail-"));
    expect(trail).toHaveLength(6);
    for (const band of trail) {
      expect(band.x + band.width).toBeLessThanOrEqual(40);
    }
  });

  it("orders the trail bands red-to-purple top to bottom", () => {
    const trail = elements
      .filter((el) => el.id.startsWith("trail-"))
      .sort((a, b) => a.y - b.y)
      .map((el) => el.fill_colors[0]);
    // True red-to-purple order, expressed in device-native (R/B-swapped) hex.
    expect(trail).toEqual(
      ["#FF0000FF", "#FF8000FF", "#FFFF00FF", "#00FF00FF", "#0080FFFF", "#8000FFFF"].map(
        toDeviceColor
      )
    );
  });
});

describe("nyanCatPayload", () => {
  it("wraps the elements under a stable application_name", () => {
    const payload = nyanCatPayload(40, 0);
    expect(payload.application_name).toBe("nyan_cat");
    expect(payload.elements).toEqual(nyanCatElements(40, 0));
  });

  it("draws at high priority so it can preempt an active work session (priority 90)", () => {
    const payload = nyanCatPayload(40, 0);
    expect(payload.priority).toBeGreaterThan(90);
    expect(payload.priority).toBeLessThanOrEqual(100);
  });
});

describe("stationaryOriginX", () => {
  it("centers the cat + trail scene within the front display width", () => {
    const trailLength = DEFAULT_TRAIL_LENGTH;
    const originX = stationaryOriginX(trailLength);

    // scene spans [originX - trailLength, originX + CAT_WIDTH)
    const sceneLeft = originX - trailLength;
    const sceneRight = originX + CAT_WIDTH;
    const sceneWidth = sceneRight - sceneLeft;
    const expectedLeft = Math.round((FRONT_DISPLAY_WIDTH - sceneWidth) / 2);

    expect(sceneLeft).toBe(expectedLeft);
  });
});

describe("flyingOriginX", () => {
  const trailLength = DEFAULT_TRAIL_LENGTH;
  const step = 2;

  it("starts fully off-screen to the left (trail included)", () => {
    const originX = flyingOriginX(0, trailLength, step);
    expect(originX + CAT_WIDTH).toBeLessThanOrEqual(0);
  });

  it("advances rightward by `step` pixels per tick", () => {
    const a = flyingOriginX(3, trailLength, step);
    const b = flyingOriginX(4, trailLength, step);
    expect(b - a).toBe(step);
  });

  it("wraps back to the starting position once fully off-screen right, forming a loop", () => {
    const start = flyingOriginX(0, trailLength, step);
    const range = FRONT_DISPLAY_WIDTH - start; // distance from start to fully-off-right
    const ticksPerLoop = range / step;

    expect(flyingOriginX(ticksPerLoop, trailLength, step)).toBe(start);
  });
});
