import { describe, it, expect } from "bun:test";
import {
  nyanCatPayload,
  nyanCatElements,
  stationaryOriginX,
  flyingOriginX,
  waveShift,
  WAVE_PERIOD,
  NYAN_COLORS,
  FRONT_DISPLAY_WIDTH,
  CAT_WIDTH,
  DEFAULT_TRAIL_LENGTH,
} from "./sprite.ts";

describe("waveShift", () => {
  it("is periodic with period WAVE_PERIOD", () => {
    for (let x = 0; x < WAVE_PERIOD * 3; x++) {
      expect(waveShift(x)).toBe(waveShift(x + WAVE_PERIOD));
    }
  });

  it("takes more than one value across a period, i.e. the trail actually waves", () => {
    const values = new Set(Array.from({ length: WAVE_PERIOD }, (_, x) => waveShift(x)));
    expect(values.size).toBeGreaterThan(1);
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
    // detail must keep collapsing well under this via Canvas's vertical
    // merge (see src/lib/canvas.ts), not just stay under it by luck.
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

  it("positions blue above purple in the trail (swapped from the previous order)", () => {
    const trail = elements.filter((el) => el.id.startsWith("trail-"));
    const avgY = (color: string) => {
      const matches = trail.filter((el) => el.fill_colors[0] === color);
      expect(matches.length).toBeGreaterThan(0);
      return matches.reduce((sum, el) => sum + el.y, 0) / matches.length;
    };
    expect(avgY(NYAN_COLORS.C!)).toBeLessThan(avgY(NYAN_COLORS.P!));
  });

  it("draws no black outline within the cat's head/fur region", () => {
    // The pop-tart's own outline was already removed; the head's internal
    // eye/ear-separator lines are gone too now, by request.
    const cat = elements.filter((el) => el.id.startsWith("cat-"));
    const black = cat.filter((el) => el.fill_colors[0] === NYAN_COLORS.K);
    // The ground-line under the whole sprite legitimately stays black —
    // only assert none of it sits within the head's row band (local rows
    // 5-11, i.e. device y in [originY+5, originY+12)).
    for (const el of black) {
      const localY = el.y; // originY is 0 in this test
      expect(localY < 5 || localY >= 12).toBe(true);
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
