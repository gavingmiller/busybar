import { describe, it, expect } from "bun:test";
import {
  nyanCatPayload,
  nyanCatElements,
  catElements,
  trailAnimationFrames,
  sceneAnimationFrames,
  stationaryOriginX,
  flyingOriginX,
  waveShift,
  bobShift,
  WAVE_PERIOD,
  NYAN_COLORS,
  FRONT_DISPLAY_WIDTH,
  CAT_WIDTH,
  CAT_HEIGHT,
  TRAIL_CANVAS_HEIGHT,
  SCENE_HEIGHT,
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

  it("vertically centers the trail within the cat's height", () => {
    // The trail canvas (band stack + 1 row of wave headroom) is shorter
    // than the cat, and was top-aligned with it by default, pinning the red
    // band's top row right against the bezel-clipped edge — invisible at
    // 2px thick where it used to be masked by a 4px band. Center it instead
    // so there's roughly equal breathing room top and bottom (allow
    // off-by-one: an odd height difference can only split evenly one way).
    const trail = elements.filter((el) => el.id.startsWith("trail-"));
    const trailTop = Math.min(...trail.map((el) => el.y));
    const trailBottom = Math.max(...trail.map((el) => el.y + el.height));
    const originY = 0; // matches nyanCatElements(40, 0) above
    const topGap = trailTop - originY;
    const bottomGap = originY + CAT_HEIGHT - trailBottom;
    expect(Math.abs(topGap - bottomGap)).toBeLessThanOrEqual(1);
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

  it("draws no black outline within the cat's head/fur region, just the mouth", () => {
    // The pop-tart's own outline was already removed; the head's internal
    // eye/ear-separator lines are gone too, by request — except a single
    // small mouth mark, added back deliberately. Assert there's exactly
    // one black element in the head band (the mouth), not a full outline's
    // worth, which would mean the old lines crept back in.
    const cat = elements.filter((el) => el.id.startsWith("cat-"));
    const black = cat.filter((el) => el.fill_colors[0] === NYAN_COLORS.K);
    // The ground-line under the whole sprite legitimately stays black —
    // only count black elements within the head's row band (local rows
    // 5-11, i.e. device y in [originY+5, originY+12)).
    const inHeadBand = black.filter((el) => el.y >= 5 && el.y < 12); // originY is 0 here
    expect(inHeadBand).toHaveLength(1);
    expect(inHeadBand[0]).toMatchObject({ width: 1, height: 1 });
  });
});

describe("animated trail (tick)", () => {
  it("shifts the wave pattern as tick advances", () => {
    const a = nyanCatElements(40, 0, DEFAULT_TRAIL_LENGTH, 0);
    const b = nyanCatElements(40, 0, DEFAULT_TRAIL_LENGTH, 4);
    expect(b).not.toEqual(a);
  });

  it("is periodic in tick with period WAVE_PERIOD, so the animation loops seamlessly", () => {
    const a = nyanCatElements(40, 0, DEFAULT_TRAIL_LENGTH, 3);
    const b = nyanCatElements(40, 0, DEFAULT_TRAIL_LENGTH, 3 + WAVE_PERIOD);
    expect(b).toEqual(a);
  });

  it("leaves the cat untouched by tick — only the trail moves", () => {
    const a = nyanCatElements(40, 0, DEFAULT_TRAIL_LENGTH, 0).filter((el) => el.id.startsWith("cat-"));
    const b = nyanCatElements(40, 0, DEFAULT_TRAIL_LENGTH, 5).filter((el) => el.id.startsWith("cat-"));
    expect(b).toEqual(a);
  });
});

describe("catElements", () => {
  it("matches exactly the cat- prefixed elements nyanCatElements produces, independent of trail params", () => {
    const combined = nyanCatElements(40, 0, DEFAULT_TRAIL_LENGTH, 5).filter((el) =>
      el.id.startsWith("cat-")
    );
    expect(catElements(40, 0)).toEqual(combined);
  });
});

describe("trailAnimationFrames", () => {
  const trailLength = DEFAULT_TRAIL_LENGTH;
  const frames = trailAnimationFrames(trailLength);

  it("returns one RGBA frame per tick in a full wave period", () => {
    expect(frames).toHaveLength(WAVE_PERIOD);
  });

  it("each frame is trailLength x TRAIL_CANVAS_HEIGHT RGBA bytes", () => {
    for (const frame of frames) {
      expect(frame.length).toBe(trailLength * TRAIL_CANVAS_HEIGHT * 4);
    }
  });

  it("actually animates — consecutive frames differ", () => {
    expect(frames[0]).not.toEqual(frames[1]);
  });

  it("loops seamlessly — frame WAVE_PERIOD would repeat frame 0 (matches waveShift's periodicity)", () => {
    const frames2 = trailAnimationFrames(trailLength);
    expect(frames2[0]).toEqual(frames[0]);
  });
});

describe("bobShift", () => {
  it("alternates every tick (period 2) — the classic Nyan Cat A/B bob", () => {
    expect(bobShift(0)).not.toBe(bobShift(1));
    expect(bobShift(0)).toBe(bobShift(2));
    expect(bobShift(1)).toBe(bobShift(3));
  });

  it("takes exactly two values", () => {
    const values = new Set(Array.from({ length: 8 }, (_, t) => bobShift(t)));
    expect(values.size).toBe(2);
  });
});

describe("sceneAnimationFrames", () => {
  const trailLength = DEFAULT_TRAIL_LENGTH;
  const frames = sceneAnimationFrames(trailLength);
  const sceneWidth = trailLength + CAT_WIDTH;

  it("returns one RGBA frame per tick in a full wave period", () => {
    expect(frames).toHaveLength(WAVE_PERIOD);
  });

  it("each frame is (trailLength+CAT_WIDTH) x SCENE_HEIGHT RGBA bytes", () => {
    for (const frame of frames) {
      expect(frame.length).toBe(sceneWidth * SCENE_HEIGHT * 4);
    }
  });

  it("the cat itself moves between frames, not just the trail", () => {
    // CAT_GRID row 0, col 3 is crust (T) when the cat sits at its resting
    // (bob=0) position; if the whole scene truly bobs as one rigid unit,
    // that exact pixel goes empty on the frame where the cat shifts down.
    const pixelAt = (frame: Uint8Array, x: number, y: number) => {
      const i = (y * sceneWidth + x) * 4;
      return [frame[i], frame[i + 1], frame[i + 2], frame[i + 3]];
    };
    const x = trailLength + 3;
    expect(pixelAt(frames[1], x, 0)).not.toEqual(pixelAt(frames[0], x, 0));
  });

  it("loops seamlessly — frame WAVE_PERIOD would repeat frame 0", () => {
    const frames2 = sceneAnimationFrames(trailLength);
    expect(frames2[0]).toEqual(frames[0]);
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
