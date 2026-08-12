import { describe, it, expect } from "bun:test";
import {
  nyanCatPayload,
  nyanCatElements,
  catElements,
  sceneAnimationFrames,
  sceneWidth,
  stationaryOriginX,
  flyingOriginX,
  NYAN_COLORS,
  FRONT_DISPLAY_WIDTH,
  CAT_WIDTH,
  CAT_HEIGHT,
  TRAIL_FPS,
  CAT_FPS,
  CAT_TRAIL_OVERLAP,
  DEFAULT_TRAIL_LENGTH,
  STATIC_TRAIL_LENGTH,
} from "./sprite.ts";
import { CAT_FRAMES, TRAIL_FRAMES } from "./sprite-data.ts";
import { Canvas } from "../lib/canvas.ts";

describe("nyanCatElements", () => {
  const elements = nyanCatElements(40, 0);

  it("draws a non-trivial number of rectangles for the composited scene", () => {
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

  it("keeps every element within the composited scene's bounding box", () => {
    const sceneLeft = 40 - STATIC_TRAIL_LENGTH + CAT_TRAIL_OVERLAP;
    const sceneRight = sceneLeft + sceneWidth(STATIC_TRAIL_LENGTH);
    for (const el of elements) {
      expect(el.x).toBeGreaterThanOrEqual(sceneLeft);
      expect(el.x + el.width).toBeLessThanOrEqual(sceneRight);
      expect(el.y).toBeGreaterThanOrEqual(0);
      expect(el.y + el.height).toBeLessThanOrEqual(CAT_HEIGHT);
    }
  });

  it("draws no black outline within the cat's head/fur region, just the mouth", () => {
    // The pop-tart's own outline was already removed; the head's internal
    // eye/ear-separator lines are gone too, by request — except a single
    // small mouth mark, added back deliberately. Assert there's exactly
    // one black element in the head band (the mouth), not a full outline's
    // worth, which would mean the old lines crept back in. Scoped to
    // el.x >= 40 (the cat's own origin) rather than an id prefix, since
    // trail and cat are now one composited canvas — safe because black
    // only ever appears in the cat's own art, never the trail's palette,
    // so it can't get folded into a trail-spanning merged rectangle.
    const black = elements.filter((el) => el.fill_colors[0] === NYAN_COLORS.K && el.x >= 40);
    const inHeadBand = black.filter((el) => el.y >= 5 && el.y < 12); // originY is 0 here
    expect(inHeadBand).toHaveLength(1);
    expect(inHeadBand[0]).toMatchObject({ width: 1, height: 1 });
  });

  it("exactly matches a canvas composited the same way (trail painted first, cat painted on top)", () => {
    // The device can't layer separate elements with transparency, so
    // nyanCatElements must pre-composite trail + cat onto one shared
    // Canvas in software before converting to elements — this is the
    // single strongest check that the compositing (position, overlap,
    // paint order) is right.
    const canvas = new Canvas(sceneWidth(STATIC_TRAIL_LENGTH), CAT_HEIGHT);
    canvas.paintGrid(TRAIL_FRAMES[0]!, NYAN_COLORS, 0, 0);
    canvas.paintGrid(CAT_FRAMES[0]!, NYAN_COLORS, STATIC_TRAIL_LENGTH - CAT_TRAIL_OVERLAP, 0);
    const expected = canvas.toElements("scene", 40 - STATIC_TRAIL_LENGTH + CAT_TRAIL_OVERLAP, 0);
    expect(elements).toEqual(expected);
  });
});

describe("catElements", () => {
  it("renders CAT_FRAMES[0] (the neutral pose) from sprite-data.ts by default", () => {
    const canvas = new Canvas(CAT_WIDTH, CAT_HEIGHT);
    canvas.paintGrid(CAT_FRAMES[0]!, NYAN_COLORS);
    expect(catElements(40, 0)).toEqual(canvas.toElements("cat", 40, 0));
  });

  it("renders the requested frameIndex", () => {
    const canvas = new Canvas(CAT_WIDTH, CAT_HEIGHT);
    canvas.paintGrid(CAT_FRAMES[1]!, NYAN_COLORS);
    expect(catElements(40, 0, 1)).toEqual(canvas.toElements("cat", 40, 0));
  });
});

describe("sceneAnimationFrames", () => {
  const trailLength = DEFAULT_TRAIL_LENGTH;
  const frames = sceneAnimationFrames(trailLength);

  it("returns one RGBA frame per entry in TRAIL_FRAMES (sampled at the trail's native cadence)", () => {
    expect(frames).toHaveLength(TRAIL_FRAMES.length);
  });

  it("plays at a fixed 16fps regardless of frame count, preserving trail scroll speed", () => {
    expect(TRAIL_FPS).toBe(16);
  });

  it("each frame is sceneWidth(trailLength) x CAT_HEIGHT RGBA bytes", () => {
    for (const frame of frames) {
      expect(frame.length).toBe(sceneWidth(trailLength) * CAT_HEIGHT * 4);
    }
  });

  it("frame content matches compositing TRAIL_FRAMES[i] then the resampled CAT_FRAMES pose onto one canvas", () => {
    frames.forEach((frame, i) => {
      const catIndex = Math.floor((i * CAT_FPS) / TRAIL_FPS) % CAT_FRAMES.length;
      const canvas = new Canvas(sceneWidth(trailLength), CAT_HEIGHT);
      canvas.paintGrid(TRAIL_FRAMES[i]!, NYAN_COLORS, 0, 0);
      canvas.paintGrid(CAT_FRAMES[catIndex]!, NYAN_COLORS, trailLength - CAT_TRAIL_OVERLAP, 0);
      expect(frame).toEqual(canvas.toRGBA());
    });
  });

  it("consecutive frames differ (the scene actually animates)", () => {
    expect(frames[0]).not.toEqual(frames[1]);
  });

  it("the cat's resampled pose visibly changes across the loop, not just the trail", () => {
    const catIndices = frames.map((_, i) => Math.floor((i * CAT_FPS) / TRAIL_FPS) % CAT_FRAMES.length);
    expect(new Set(catIndices).size).toBeGreaterThan(1);
  });

  it("loops seamlessly: the trail's loop duration is a whole multiple of the cat's", () => {
    expect((TRAIL_FRAMES.length * CAT_FPS) % (CAT_FRAMES.length * TRAIL_FPS)).toBe(0);
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
