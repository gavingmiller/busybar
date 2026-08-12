import { describe, it, expect } from "bun:test";
import {
  nyanCatPayload,
  nyanCatElements,
  catElements,
  trailAnimationFrames,
  stationaryOriginX,
  flyingOriginX,
  NYAN_COLORS,
  FRONT_DISPLAY_WIDTH,
  CAT_WIDTH,
  CAT_HEIGHT,
  TRAIL_ANIM_HEIGHT,
  TRAIL_FPS,
  DEFAULT_TRAIL_LENGTH,
} from "./sprite.ts";
import { CAT_GRID, TRAIL_FRAMES } from "./sprite-data.ts";
import { Canvas } from "../lib/canvas.ts";

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

  it("vertically centers the trail within the cat's height", () => {
    const trail = elements.filter((el) => el.id.startsWith("trail-"));
    const trailTop = Math.min(...trail.map((el) => el.y));
    const trailBottom = Math.max(...trail.map((el) => el.y + el.height));
    const originY = 0; // matches nyanCatElements(40, 0) above
    const topGap = trailTop - originY;
    const bottomGap = originY + CAT_HEIGHT - trailBottom;
    expect(Math.abs(topGap - bottomGap)).toBeLessThanOrEqual(1);
  });

  it("draws no black outline within the cat's head/fur region, just the mouth", () => {
    // The pop-tart's own outline was already removed; the head's internal
    // eye/ear-separator lines are gone too, by request — except a single
    // small mouth mark, added back deliberately. Assert there's exactly
    // one black element in the head band (the mouth), not a full outline's
    // worth, which would mean the old lines crept back in.
    const cat = elements.filter((el) => el.id.startsWith("cat-"));
    const black = cat.filter((el) => el.fill_colors[0] === NYAN_COLORS.K);
    const inHeadBand = black.filter((el) => el.y >= 5 && el.y < 12); // originY is 0 here
    expect(inHeadBand).toHaveLength(1);
    expect(inHeadBand[0]).toMatchObject({ width: 1, height: 1 });
  });

  it("renders TRAIL_FRAMES[0] as its static trail snapshot", () => {
    const trailCanvas = new Canvas(DEFAULT_TRAIL_LENGTH, TRAIL_ANIM_HEIGHT);
    trailCanvas.paintGrid(TRAIL_FRAMES[0]!, NYAN_COLORS);
    const expected = trailCanvas.toElements("trail", 40 - DEFAULT_TRAIL_LENGTH, 0);
    const actual = elements.filter((el) => el.id.startsWith("trail-"));
    expect(actual).toEqual(expected);
  });
});

describe("catElements", () => {
  it("matches exactly the cat- prefixed elements nyanCatElements produces", () => {
    const combined = nyanCatElements(40, 0).filter((el) => el.id.startsWith("cat-"));
    expect(catElements(40, 0)).toEqual(combined);
  });

  it("renders CAT_GRID from sprite-data.ts", () => {
    const canvas = new Canvas(CAT_WIDTH, CAT_HEIGHT);
    canvas.paintGrid(CAT_GRID, NYAN_COLORS);
    expect(catElements(40, 0)).toEqual(canvas.toElements("cat", 40, 0));
  });
});

describe("trailAnimationFrames", () => {
  const trailLength = DEFAULT_TRAIL_LENGTH;
  const frames = trailAnimationFrames(trailLength);

  it("returns one RGBA frame per entry in TRAIL_FRAMES", () => {
    expect(frames).toHaveLength(TRAIL_FRAMES.length);
  });

  it("plays at a fixed 16fps regardless of frame count, preserving scroll speed", () => {
    expect(TRAIL_FPS).toBe(16);
  });

  it("each frame is trailLength x TRAIL_ANIM_HEIGHT RGBA bytes", () => {
    for (const frame of frames) {
      expect(frame.length).toBe(trailLength * TRAIL_ANIM_HEIGHT * 4);
    }
  });

  it("frame content matches TRAIL_FRAMES via Canvas.paintGrid", () => {
    frames.forEach((frame, i) => {
      const canvas = new Canvas(trailLength, TRAIL_ANIM_HEIGHT);
      canvas.paintGrid(TRAIL_FRAMES[i]!, NYAN_COLORS);
      expect(frame).toEqual(canvas.toRGBA());
    });
  });

  it("consecutive frames differ (the trail actually animates)", () => {
    expect(frames[0]).not.toEqual(frames[1]);
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
    const range = FRONT_DISPLAY_WIDTH - start;
    const ticksPerLoop = range / step;

    expect(flyingOriginX(ticksPerLoop, trailLength, step)).toBe(start);
  });
});
