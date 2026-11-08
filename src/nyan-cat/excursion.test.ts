import { describe, it, expect } from "bun:test";
import {
  EXCURSIONS,
  HOME_SECTION,
  PAN_PAD,
  excursionFrameCount,
  excursionDrift,
  excursionDurationMs,
  catPanLayerWidth,
  catPanLayerSections,
} from "./excursion.ts";
import { catLayerFrames, CAT_LAYER_WIDTH, SKY_FPS, SKY_FRAME_COUNT } from "./sky.ts";
import { CAT_HEIGHT } from "./sprite.ts";

describe("excursions", () => {
  it("names fit the firmware's section-name limit (\u22647 chars; confirmed live 2026-11-08: 8+ char names never play)", () => {
    for (const e of EXCURSIONS) expect(e.name.length).toBeLessThanOrEqual(7);
    expect(new Set(EXCURSIONS.map((e) => e.name)).size).toBe(EXCURSIONS.length);
  });
  it("each lasts a whole number of home loops so the home loop can follow seamlessly", () => {
    expect(EXCURSIONS.length).toBeGreaterThanOrEqual(3);
    for (const e of EXCURSIONS) {
      expect(excursionFrameCount(e) % SKY_FRAME_COUNT).toBe(0);
      expect(excursionFrameCount(e)).toBeGreaterThan(0);
      expect(excursionDurationMs(e)).toBe((excursionFrameCount(e) / SKY_FPS) * 1000);
    }
    expect(new Set(EXCURSIONS.map((e) => e.name)).size).toBe(EXCURSIONS.length);
    expect(EXCURSIONS.some((e) => e.name === HOME_SECTION)).toBe(false);
  });

  it("moves at a lazy pace: no leg averages more than 2.5 px/s (Gavin 2026-11-08: the pan should take longer)", () => {
    for (const e of EXCURSIONS) {
      expect(e.driftPx / e.outS).toBeLessThanOrEqual(2.5);
      expect(e.driftPx / e.backS).toBeLessThanOrEqual(2.5);
    }
  });

  it("drifts out to its distance, holds, and comes all the way back, one pixel at a time", () => {
    for (const e of EXCURSIONS) {
      const n = excursionFrameCount(e);
      const d = Array.from({ length: n }, (_, i) => excursionDrift(e, i));
      expect(d[0]).toBe(0);
      expect(d[n - 1]).toBe(0);
      expect(Math.max(...d)).toBe(e.driftPx);
      expect(e.driftPx).toBeLessThanOrEqual(PAN_PAD);
      for (let i = 1; i < n; i++) expect(Math.abs(d[i]! - d[i - 1]!)).toBeLessThanOrEqual(1);
      // out, hold, back: never moves outward again after it started coming back
      const peakFirst = d.indexOf(e.driftPx);
      const peakLast = d.lastIndexOf(e.driftPx);
      for (let i = 1; i <= peakFirst; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1]!);
      for (let i = peakLast + 1; i < n; i++) expect(d[i]).toBeLessThanOrEqual(d[i - 1]!);
      // Easing: the first step away from home is slower than the middle of the move out.
      const firstStepAt = d.findIndex((v) => v === 1);
      const midStepAt = d.findIndex((v) => v === Math.floor(e.driftPx / 2));
      const midNextAt = d.findIndex((v) => v === Math.floor(e.driftPx / 2) + 1);
      expect(firstStepAt).toBeGreaterThan(midNextAt - midStepAt);
    }
  });
});

describe("catPanLayerSections", () => {
  const sections = catPanLayerSections();
  const home = catLayerFrames();
  const W = catPanLayerWidth();

  it("is the home loop plus every excursion, all PAN_PAD wider than the plain cat layer", () => {
    expect(W).toBe(CAT_LAYER_WIDTH + PAN_PAD);
    expect(sections.map((s) => s.name)).toEqual([HOME_SECTION, ...EXCURSIONS.map((e) => e.name)]);
    expect(sections[0]!.frames).toHaveLength(SKY_FRAME_COUNT);
    for (const [i, e] of EXCURSIONS.entries()) expect(sections[i + 1]!.frames).toHaveLength(excursionFrameCount(e));
    for (const s of sections) for (const f of s.frames) expect(f.length).toBe(W * CAT_HEIGHT * 4);
  });

  const pixel = (f: Uint8Array, w: number, x: number, y: number) => Array.from(f.subarray((y * w + x) * 4, (y * w + x) * 4 + 4));

  it("home frames are the plain cat layer shifted right by PAN_PAD (transparent padding on the left)", () => {
    const f = sections[0]!.frames[5]!;
    for (let y = 0; y < CAT_HEIGHT; y++) {
      for (let x = 0; x < PAN_PAD; x++) expect(pixel(f, W, x, y)[3]).toBe(0);
      for (let x = 0; x < CAT_LAYER_WIDTH; x++) expect(pixel(f, W, x + PAN_PAD, y)).toEqual(pixel(home[5]!, CAT_LAYER_WIDTH, x, y));
    }
  });

  it("an excursion frame is the matching home-loop frame shifted left by that frame's drift", () => {
    const e = EXCURSIONS[0]!;
    const frames = sections[1]!.frames;
    for (const i of [0, 17, 100, Math.floor(excursionFrameCount(e) / 2), excursionFrameCount(e) - 1]) {
      const d = excursionDrift(e, i);
      const src = home[i % SKY_FRAME_COUNT]!;
      for (const y of [0, 6, CAT_HEIGHT - 1]) {
        for (let x = 0; x < CAT_LAYER_WIDTH; x++) expect(pixel(frames[i]!, W, x + PAN_PAD - d, y)).toEqual(pixel(src, CAT_LAYER_WIDTH, x, y));
      }
    }
  });
});
