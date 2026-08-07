import { describe, it, expect } from "bun:test";
import {
  nyanCatPayload,
  nyanCatElements,
  gridToRectangles,
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

describe("gridToRectangles", () => {
  // Sprites are authored as a grid of characters (one per pixel) rather than
  // hand-placed rects — much easier to eyeball and iterate on. This compiler
  // run-length-encodes each row into the fewest rectangles, skipping "."
  // (background/transparent, lets the black canvas show through).
  const colors = { A: "#FF0000FF", B: "#00FF00FF" };

  it("merges each row's runs of identical characters into one rect per run", () => {
    const rects = gridToRectangles(["AAB", ".BB"], colors, "t", 0, 0);

    expect(rects).toHaveLength(3);
    expect(rects.find((r) => r.id === "t-0-0")).toMatchObject({ x: 0, y: 0, width: 2 });
    expect(rects.find((r) => r.id === "t-0-2")).toMatchObject({ x: 2, y: 0, width: 1 });
    expect(rects.find((r) => r.id === "t-1-1")).toMatchObject({ x: 1, y: 1, width: 2 });
  });

  it("skips background cells entirely", () => {
    const rects = gridToRectangles(["..."], colors, "t", 0, 0);
    expect(rects).toHaveLength(0);
  });

  it("offsets columns by originX/originY and an optional column offset", () => {
    const rects = gridToRectangles(["A"], colors, "t", 10, 5, -3);
    expect(rects[0]).toMatchObject({ x: 10 - 3, y: 5 });
  });

  it("merges vertically-stacked identical runs into one taller rect", () => {
    // Same run (start, length, char) on consecutive rows -> a single rect,
    // not one per row. The device rejects draws past an element-count cap,
    // so collapsing solid blocks matters, not just tidiness.
    const rects = gridToRectangles(["AA", "AA", "AA"], colors, "t", 0, 0);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toMatchObject({ x: 0, y: 0, width: 2, height: 3 });
  });

  it("breaks the merge where a row's run differs", () => {
    const rects = gridToRectangles(["AA", "AA", "AB"], colors, "t", 0, 0);
    // rows 0-1 merge into one 2-tall "AA" rect; row 2 splits into its own
    // "A" and "B" rects since it no longer matches.
    expect(rects).toHaveLength(3);
    expect(rects.find((r) => r.x === 0 && r.y === 0)).toMatchObject({ width: 2, height: 2 });
    expect(rects.find((r) => r.y === 2 && r.x === 0)).toMatchObject({ width: 1, height: 1 });
    expect(rects.find((r) => r.y === 2 && r.x === 1)).toMatchObject({ width: 1, height: 1 });
  });

  it("looks up each run's fill color and swaps it for device order, with no border", () => {
    const [rect] = gridToRectangles(["A"], colors, "t", 0, 0);
    expect(rect!.fill).toBe("solid");
    expect(rect!.fill_colors).toEqual([toDeviceColor("#FF0000FF")]);
    expect(rect!.border_width).toBe(0);
  });
});

describe("nyanCatElements", () => {
  const elements = nyanCatElements(40, 0);

  it("draws a non-trivial number of rectangles for the cat + trail", () => {
    expect(elements.length).toBeGreaterThan(20);
  });

  it("stays under the device's per-draw element cap", () => {
    // Empirically found via binary search against the real device: a draw
    // with >100 elements is rejected with "Elements number limit exceeded"
    // (undocumented in the OpenAPI spec). Any future sprite edit that adds
    // detail must keep collapsing well under this via gridToRectangles'
    // vertical merge, not just stay under it by luck.
    expect(elements.length).toBeLessThanOrEqual(100);
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
      // border_width defaults to 1px, white — on 1px-thick shapes that
      // border alone fills the whole shape, hiding the intended fill color.
      expect(el.border_width).toBe(0);
    }
  });

  it("positions the entire rainbow trail to the left of the cat's origin", () => {
    const trail = elements.filter((el) => el.id.startsWith("trail-"));
    expect(trail.length).toBeGreaterThan(0);
    for (const band of trail) {
      expect(band.x + band.width).toBeLessThanOrEqual(40);
    }
  });

  it("keeps every cat-body element within the cat's own bounding box", () => {
    const cat = elements.filter((el) => el.id.startsWith("cat-"));
    expect(cat.length).toBeGreaterThan(0);
    for (const el of cat) {
      expect(el.x).toBeGreaterThanOrEqual(40);
      expect(el.x + el.width).toBeLessThanOrEqual(40 + CAT_WIDTH);
    }
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
