import { describe, it, expect } from "bun:test";
import {
  FOG_CANYON, FOG_FPS, FOG_LOOP_S, FOG_FRAME_COUNT, FLOOR_Y, KNIGHT_SPEED, KNIGHT_STRIDE_PX,
  JELLIES, BUBBLES, renderFrame, knightState, knightRows, jellyPos, bubblePos,
} from "./index.ts";
import { KNIGHT, UOMA, OOMA } from "./art.ts";
import { FRONT_WIDTH, FRONT_HEIGHT } from "../../lib/scene.ts";
import { encodeAnimFile } from "../../lib/anim-file.ts";

const px = (f: Uint8Array, x: number, y: number) => {
  const i = (y * FRONT_WIDTH + x) * 4;
  return [f[i]!, f[i + 1]!, f[i + 2]!, f[i + 3]!] as const;
};
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const sample = Array.from({ length: 48 }, (_, k) => Math.floor((k * FOG_FRAME_COUNT) / 48));

describe("FOG_CANYON scene", () => {
  const frames = FOG_CANYON.frames();

  it("is a full-display opaque 96 s loop at 24 fps, never black anywhere (the fog glows)", () => {
    expect(FOG_CANYON.id).toBe("fog_canyon");
    expect(FOG_CANYON.name).toBe("Fog Canyon");
    expect(FOG_CANYON.fps).toBe(FOG_FPS);
    expect(FOG_FPS).toBe(24);
    expect(FOG_LOOP_S).toBe(96);
    expect(frames).toHaveLength(FOG_FRAME_COUNT);
    for (const i of sample) {
      const f = frames[i]!;
      expect(f.length).toBe(FRONT_WIDTH * FRONT_HEIGHT * 4);
      for (let p = 0; p < f.length; p += 4) {
        if (f[p + 3] !== 255) throw new Error(`transparent pixel in frame ${i}`);
        if (f[p]! + f[p + 1]! + f[p + 2]! === 0) throw new Error(`black pixel in frame ${i} at ${p / 4}`);
      }
    }
  });

  it("loops seamlessly and deterministically", () => {
    expect(renderFrame(FOG_FRAME_COUNT)).toEqual(frames[0]!);
    expect(renderFrame(17)).toEqual(frames[17]!);
    expect(FOG_CANYON.frames()[900]).toEqual(frames[900]!);
    expect(frames[0]).not.toEqual(frames[12]!);
  });

  it("the Knight is Gavin's line-up pick (2026-11-09): 7x9, white mask with horns rising from the outer edges and curving IN at the tips, two-row eye hollows fixed across a four-frame walk, one-tone cape, stub feet", () => {
    expect(KNIGHT.frames).toHaveLength(4);
    const w = KNIGHT.frames[0]![0]!.length, h = KNIGHT.frames[0]!.length;
    expect([w, h]).toEqual([7, 9]);
    const MASK_ROWS = 6;
    for (const fr of KNIGHT.frames) {
      expect(fr).toHaveLength(h);
      for (const r of fr) expect(r).toHaveLength(w);
      // mask rows identical in every frame (eye-drift rule)
      expect(fr.slice(0, MASK_ROWS)).toEqual(KNIGHT.frames[0]!.slice(0, MASK_ROWS));
      // below the mask: a single-tone cape 3-5 wide, then stub feet in the bottom row
      for (const r of fr.slice(MASK_ROWS, h - 1)) { expect(r).toMatch(/^\.*N{3,5}\.*$/); }
      expect(fr[h - 1]!).toMatch(/^\.*K\.*K\.*$|^\.*KK\.*$/);
    }
    const mask = KNIGHT.frames[0]!;
    // horns: tips (row 0) sit inside the flare (row 1), which spans the full width
    const span = (r: string) => r.lastIndexOf("W") - r.indexOf("W");
    expect(span(mask[0]!)).toBeLessThan(span(mask[1]!));
    expect(mask[1]![0]).toBe("W"); expect(mask[1]![w - 1]).toBe("W");
    expect(mask[2]).toBe("W".repeat(w));
    expect(mask[3]).toBe(mask[4]); // two-row eye hollows
    expect((mask[3]!.match(/E/g) ?? []).length).toBe(2);
    expect(KNIGHT.frames.map((f) => f.join("/")).filter((s, i, a) => a.indexOf(s) === i)).toHaveLength(4);
    expect(KNIGHT.colors.W).toMatch(/^#F/);
    expect(KNIGHT.colors.N).toBe("#8094E4");
    expect(KNIGHT.colors.K).toBe("#5262B0");
  });

  it("the Knight crosses once each way at a slow walk, on screen 25–45 % of the loop, facing the way he goes, legs stepping per stride", () => {
    expect(KNIGHT_SPEED).toBeGreaterThanOrEqual(5);
    expect(KNIGHT_SPEED).toBeLessThanOrEqual(8);
    expect(KNIGHT_STRIDE_PX).toBe(3);
    let on = 0, right = 0, left = 0, lastDir = 0, flips = 0;
    const step = 1 / FOG_FPS;
    for (let t = 0; t < FOG_LOOP_S; t += step) {
      const s = knightState(t);
      if (!s) { lastDir = 0; continue; }
      on++;
      if (s.dir !== lastDir) { flips++; lastDir = s.dir; }
      if (s.dir > 0) right++; else left++;
    }
    const share = on / (FOG_LOOP_S * FOG_FPS);
    expect(share).toBeGreaterThanOrEqual(0.25);
    expect(share).toBeLessThanOrEqual(0.45);
    expect(right).toBeGreaterThan(0);
    expect(left).toBeGreaterThan(0);
    expect(flips).toBe(2); // exactly one crossing each way
    // moving the way he faces, and off screen between crossings
    const a = knightState(10)!, b = knightState(10.5)!;
    expect(Math.sign(b.x - a.x)).toBe(a.dir);
    expect(knightState(0)).toBeNull();
    expect(knightState(FOG_LOOP_S - 0.01)).toBeNull();
    // the mirrored sprite is used when walking left
    const l = [...Array(FOG_LOOP_S * 4).keys()].map((k) => k / 4).find((t) => knightState(t)?.dir === -1)!;
    const rows = knightRows(l);
    const flare = rows[1]!;
    expect(flare[0]).toBe("W");
    expect(flare[flare.length - 1]).toBe("W");
    expect(knightRows(10)).toEqual(KNIGHT.frames[knightState(10)!.frame]!);
    // pauses once mid-screen (stands still for a moment) during a crossing
    let still = 0;
    for (let t = 0; t < FOG_LOOP_S; t += step) { const s1 = knightState(t), s2 = knightState(t + step); if (s1 && s2 && s1.x === s2.x) still++; }
    expect(still).toBeGreaterThanOrEqual(FOG_FPS * 1.5);
  });

  it("draws the Knight last, mask visible, feet on the floor", () => {
    const s = knightState(10)!;
    const i = Math.round(10 * FOG_FPS);
    const f = frames[i]!;
    const rows = knightRows(i / FOG_FPS);
    const x0 = Math.round(s.x), y0 = FLOOR_Y - rows.length;
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") expect(px(f, x0 + x, y0 + y)).toEqual(hex(KNIGHT.colors[ch]!)); }));
  });

  it("Uomas and Oomas drift and bob above head height, cores flickering", () => {
    expect(JELLIES.length).toBeGreaterThanOrEqual(4);
    expect(JELLIES.some((j) => j.kind === "uoma")).toBe(true);
    expect(JELLIES.some((j) => j.kind === "ooma")).toBe(true);
    expect(UOMA.frames[0]![0]!.length).toBeLessThan(OOMA.frames[0]![0]!.length);
    let high = 0, total = 0;
    for (const j of JELLIES) {
      const p0 = jellyPos(j, 0), p1 = jellyPos(j, 3), pEnd = jellyPos(j, FOG_LOOP_S);
      expect(p0.x).not.toBe(p1.x);
      expect(p0).toEqual(pEnd); // closes on the loop
      for (let t = 0; t < FOG_LOOP_S; t += 1) { total++; if (jellyPos(j, t).y + (j.kind === "ooma" ? OOMA : UOMA).frames[0]!.length <= 9) high++; }
    }
    expect(high / total).toBeGreaterThanOrEqual(0.75);
    // cores flicker: the core colour changes over time somewhere in the loop
    const coreColours = new Set<string>();
    for (const i of sample) { const f = frames[i]!; for (let p = 0; p < f.length; p += 4) { const r = f[p]!, g = f[p + 1]!, b = f[p + 2]!; if (r > 200 && b > 150 && g < 220) coreColours.add(`${r},${g},${b}`); } }
    expect(coreColours.size).toBeGreaterThanOrEqual(2);
  });

  it("bubbles rise from the floor to the top and the mossy floor is lit edge to edge", () => {
    expect(BUBBLES.length).toBeGreaterThanOrEqual(6);
    for (const b of BUBBLES) {
      const y0 = bubblePos(b, 0.5).y, y1 = bubblePos(b, 2.5).y;
      expect(y1).toBeLessThanOrEqual(y0);
      const a = bubblePos(b, 0), z = bubblePos(b, FOG_LOOP_S);
      expect([a.x, a.y]).toEqual([z.x, z.y]); // closes on the loop (u carries float noise)
    }
    expect(FLOOR_Y).toBe(13);
    for (const i of sample) for (let x = 0; x < FRONT_WIDTH; x++) {
      const [r, g, b] = px(frames[i]!, x, FLOOR_Y);
      expect(g).toBeGreaterThan(r); expect(g).toBeGreaterThan(40); expect(g).toBeGreaterThanOrEqual(b);
    }
    // fog has a drifting texture: a sky pixel's colour is not constant over the loop
    const seen = new Set<string>(); for (const i of sample) seen.add(px(frames[i]!, 20, 2).join());
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it("encodes under 25 MB", () => {
    const bytes = encodeAnimFile({ width: FRONT_WIDTH, height: FRONT_HEIGHT, fps: FOG_FPS, frames });
    expect(bytes.length).toBeLessThan(25 * 1024 * 1024);
  });
});
