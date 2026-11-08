import { describe, it, expect } from "bun:test";
import { FRONT_WIDTH, FRONT_HEIGHT } from "../../lib/scene.ts";
import { encodeAnimFile } from "../../lib/anim-file.ts";
import {
  LAVA_LAMP, LAVA_FPS, LAVA_LOOP_S, LAVA_FRAME_COUNT, MOTION_LOOP_S, PALETTES, paletteAt, blobPaletteAt, BLOBS, blobStates, renderFrame,
} from "./index.ts";

const px = (frame: Uint8Array, x: number, y: number) => {
  const i = (y * FRONT_WIDTH + x) * 4;
  return [frame[i]!, frame[i + 1]!, frame[i + 2]!, frame[i + 3]!];
};
const hex = (s: string) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16));

describe("LAVA_LAMP scene", () => {
  const frames = LAVA_LAMP.frames();

  it("identifies itself and renders one full-display opaque frame per loop step", () => {
    expect(LAVA_LAMP.id).toBe("lava_lamp");
    expect(LAVA_LAMP.name).toBe("Lava Lamp");
    expect(LAVA_LAMP.fps).toBe(LAVA_FPS);
    expect(LAVA_FPS).toBeGreaterThanOrEqual(24);
    expect(LAVA_FPS).toBeLessThanOrEqual(48);
    expect(LAVA_LOOP_S).toBeGreaterThanOrEqual(180); // Gavin 2026-11-08: the 60 s tour was too quick
    expect(LAVA_LOOP_S).toBeLessThanOrEqual(400);
    expect(LAVA_LOOP_S % MOTION_LOOP_S).toBe(0); // the blob motion repeats a whole number of times per colour cycle
    expect(frames).toHaveLength(LAVA_FRAME_COUNT);
    expect(LAVA_FRAME_COUNT).toBe(LAVA_FPS * LAVA_LOOP_S);
    for (const f of frames) {
      expect(f.length).toBe(FRONT_WIDTH * FRONT_HEIGHT * 4);
      for (let i = 3; i < f.length; i += 4) expect(f[i]).toBe(255);
    }
  });

  it("loops seamlessly: every blob is back where it started after one loop, and the frame after the last equals the first", () => {
    const a = blobStates(0);
    const b = blobStates(LAVA_FRAME_COUNT);
    expect(a).toHaveLength(BLOBS.length);
    a.forEach((s, k) => {
      expect(b[k]!.x).toBeCloseTo(s.x, 6);
      expect(b[k]!.y).toBeCloseTo(s.y, 6);
      expect(b[k]!.rx).toBeCloseTo(s.rx, 6);
      expect(b[k]!.ry).toBeCloseTo(s.ry, 6);
    });
    expect([...renderFrame(LAVA_FRAME_COUNT)]).toEqual([...frames[0]!]);
  });

  it("blobs actually move, smoothly: consecutive frames differ by a whisker, a second apart they differ plainly", () => {
    expect(frames[0]).not.toEqual(frames[1]);
    expect(frames[10]).not.toEqual(frames[11]);
    const changed = (p: Uint8Array, q: Uint8Array) => { let n = 0; for (let i = 0; i < p.length; i += 4) if (p[i] !== q[i] || p[i + 1] !== q[i + 1] || p[i + 2] !== q[i + 2]) n++; return n; };
    const meanAbsDiff = (p: Uint8Array, q: Uint8Array) => { let s = 0; for (let i = 0; i < p.length; i += 4) s += Math.abs(p[i]! - q[i]!) + Math.abs(p[i + 1]! - q[i + 1]!) + Math.abs(p[i + 2]! - q[i + 2]!); return s / ((p.length / 4) * 3); };
    expect(meanAbsDiff(frames[0]!, frames[1]!)).toBeLessThan(3);
    expect(changed(frames[0]!, frames[LAVA_FPS]!)).toBeGreaterThan(FRONT_WIDTH * FRONT_HEIGHT * 0.1);
    // every blob's position is a sub-pixel function of time
    const s0 = blobStates(0), s1 = blobStates(1);
    expect(s0.some((s, k) => Math.abs(s.y - s1[k]!.y) > 0 && Math.abs(s.y - s1[k]!.y) < 1)).toBe(true);
  });

  it("cycles slowly through the original's six themes, starting on classic and closing the ring on the loop", () => {
    expect(PALETTES.map((p) => p.name)).toEqual(["classic", "sunset", "magenta", "ocean", "ice", "toxic"]);
    expect(PALETTES[0]).toMatchObject({ lava: "#FF5A24", highlight: "#FFB000", background: "#190019" });
    expect(paletteAt(0)).toEqual(hex(PALETTES[0]!.lava).concat(hex(PALETTES[0]!.highlight), hex(PALETTES[0]!.background)));
    expect(paletteAt(LAVA_FRAME_COUNT)).toEqual(paletteAt(0));
    const seg = LAVA_FRAME_COUNT / PALETTES.length;
    // Each theme is pure at the start of its segment, and half-way between two it is a true blend.
    expect(paletteAt(3 * seg)).toEqual(hex(PALETTES[3]!.lava).concat(hex(PALETTES[3]!.highlight), hex(PALETTES[3]!.background)));
    const mid = paletteAt(0.5 * seg);
    const a = hex(PALETTES[0]!.lava), b = hex(PALETTES[1]!.lava);
    for (let k = 0; k < 3; k++) {
      expect(mid[k]!).toBeGreaterThanOrEqual(Math.min(a[k]!, b[k]!) - 1);
      expect(mid[k]!).toBeLessThanOrEqual(Math.max(a[k]!, b[k]!) + 1);
    }
    // The change is gradual: neighbouring frames never jump.
    for (const f of [1, Math.floor(seg * 0.5), Math.floor(seg * 1.5), LAVA_FRAME_COUNT - 1]) {
      const p0 = paletteAt(f - 1), p1 = paletteAt(f);
      for (let k = 0; k < 9; k++) expect(Math.abs(p1[k]! - p0[k]!)).toBeLessThanOrEqual(3);
    }
  });

  it("gives every blob its own colour clock: whole tours per loop so the loop closes, at least three distinct speeds, and no blob faster than one theme per 20 s", () => {
    const speeds = new Set(BLOBS.map((b) => b.hueCycles));
    expect(speeds.size).toBeGreaterThanOrEqual(3);
    for (const [k, b] of BLOBS.entries()) {
      expect(Number.isInteger(b.hueCycles)).toBe(true);
      expect(b.hueCycles).toBeGreaterThanOrEqual(1);
      expect(LAVA_LOOP_S / (b.hueCycles * PALETTES.length)).toBeGreaterThanOrEqual(20);
      expect(blobPaletteAt(k, LAVA_FRAME_COUNT)).toEqual(blobPaletteAt(k, 0));
      // gradual
      for (const f of [1, Math.floor(LAVA_FRAME_COUNT / 7), LAVA_FRAME_COUNT - 1]) {
        const p0 = blobPaletteAt(k, f - 1), p1 = blobPaletteAt(k, f);
        for (let c = 0; c < 6; c++) expect(Math.abs(p1[c]! - p0[c]!)).toBeLessThanOrEqual(3);
      }
    }
    // Two blobs with different speeds are different colours most of the time.
    const [a, b] = [0, BLOBS.findIndex((x) => x.hueCycles !== BLOBS[0]!.hueCycles)];
    let differ = 0;
    for (let f = 0; f < LAVA_FRAME_COUNT; f += LAVA_FPS) {
      const pa = blobPaletteAt(a, f), pb = blobPaletteAt(b, f);
      if (pa.some((v, i) => Math.abs(v - pb[i]!) > 40)) differ++;
    }
    expect(differ).toBeGreaterThan(LAVA_LOOP_S * 0.6);
  });

  it("renders blobs in different colours at the same moment, over dark glass", () => {
    const hues = (f: Uint8Array) => {
      const seen = new Set<string>(); let dark = 0;
      for (let y = 0; y < FRONT_HEIGHT; y++) for (let x = 0; x < FRONT_WIDTH; x++) {
        const [r, g, b] = px(f, x, y);
        if (r + g + b < 60) dark++;
        else if (r + g + b > 350) seen.add(r >= g && r >= b ? "R" : g >= b ? "G" : "B");
      }
      return { seen, dark };
    };
    let multi = 0;
    const samples = [0, 0.2, 0.4, 0.6, 0.8].map((u) => Math.floor(u * LAVA_FRAME_COUNT));
    for (const i of samples) {
      const { seen, dark } = hues(frames[i]!);
      expect(dark).toBeGreaterThan(200);
      if (seen.size >= 2) multi++;
    }
    expect(multi).toBeGreaterThanOrEqual(3);
  });

  it("encodes to a modest .anim asset", () => {
    const bytes = encodeAnimFile({ width: FRONT_WIDTH, height: FRONT_HEIGHT, fps: LAVA_FPS, frames });
    expect(bytes.length).toBeLessThan(44 * 1024 * 1024);
  });
});
