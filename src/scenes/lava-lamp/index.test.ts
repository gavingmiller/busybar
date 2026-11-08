import { describe, it, expect } from "bun:test";
import { FRONT_WIDTH, FRONT_HEIGHT } from "../../lib/scene.ts";
import { encodeAnimFile } from "../../lib/anim-file.ts";
import {
  LAVA_LAMP, LAVA_FPS, LAVA_LOOP_S, LAVA_FRAME_COUNT, PALETTE, BLOBS, blobStates, renderFrame,
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
    expect(LAVA_LOOP_S).toBeGreaterThanOrEqual(10);
    expect(LAVA_LOOP_S).toBeLessThanOrEqual(30);
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

  it("uses the classic lamp palette: dark plum background, orange-to-amber lava, nothing outside that gamut", () => {
    const [lava, hi, bg] = [hex(PALETTE.lava), hex(PALETTE.highlight), hex(PALETTE.background)];
    expect(PALETTE).toEqual({ lava: "#FF5A24", highlight: "#FFB000", background: "#190019" });
    let lavaPixels = 0, bgPixels = 0;
    for (const f of [frames[0]!, frames[Math.floor(LAVA_FRAME_COUNT / 2)]!]) {
      for (let y = 0; y < FRONT_HEIGHT; y++) for (let x = 0; x < FRONT_WIDTH; x++) {
        const [r, g, b] = px(f, x, y);
        // a mix of bg, lava and highlight: red >= green >= blue-ish, never green/blue dominant
        expect(r).toBeGreaterThanOrEqual(g - 1);
        expect(r).toBeGreaterThanOrEqual(b - 1);
        expect(b).toBeLessThanOrEqual(Math.max(bg[2]!, lava[2]!, hi[2]!) + 1);
        if (r > 200) lavaPixels++;
        if (r <= bg[0]! + 2 && g <= bg[1]! + 2) bgPixels++;
      }
    }
    expect(lavaPixels).toBeGreaterThan(80);
    expect(bgPixels).toBeGreaterThan(200);
  });

  it("encodes to a modest .anim asset", () => {
    const bytes = encodeAnimFile({ width: FRONT_WIDTH, height: FRONT_HEIGHT, fps: LAVA_FPS, frames });
    expect(bytes.length).toBeLessThan(6 * 1024 * 1024);
  });
});
