import { describe, it, expect } from "bun:test";
import {
  FOG_CANYON, FOG_FPS, FOG_LOOP_S, FOG_FRAME_COUNT, FLOOR_Y, KNIGHT_SPEED, KNIGHT_STRIDE_PX,
  JELLIES, BUBBLES, renderFrame, knightState, knightRows, jellyPos, jellyFrame, bubblePos,
  HORNET_SPEED, HORNET_STRIDE_PX, HORNET_CROSSINGS, hornetState, hornetRows,
  SAMUS_SPEED, SAMUS_START_S, samusState, samusRows,
} from "./index.ts";
import { KNIGHT, HORNET, UOMA, OOMA, METROID } from "./art.ts";
import { SAMUS, SAMUS_POSE_RATE } from "../samus/art.ts";
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
    // Gavin 2026-11-09: his feet did not match his pace; Hornet's cadence (4 steps/s) looked right, so his matches hers.
    expect(KNIGHT_SPEED / KNIGHT_STRIDE_PX).toBeCloseTo(HORNET_SPEED / HORNET_STRIDE_PX, 6);
    expect(KNIGHT_SPEED / KNIGHT_STRIDE_PX).toBeGreaterThanOrEqual(3.5);
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
      if (j.kind === "metroid") continue; // the Metroid hunts lower (its own spec)
      for (let t = 0; t < FOG_LOOP_S; t += 1) { total++; if (jellyPos(j, t).y + (j.kind === "ooma" ? OOMA : UOMA).frames[0]!.length <= 9) high++; }
    }
    expect(high / total).toBeGreaterThanOrEqual(0.75);
    // cores flicker: the core colour changes over time somewhere in the loop
    const coreColours = new Set<string>();
    for (const i of sample) { const f = frames[i]!; for (let p = 0; p < f.length; p += 4) { const r = f[p]!, g = f[p + 1]!, b = f[p + 2]!; if (r > 200 && b > 150 && g < 220) coreColours.add(`${r},${g},${b}`); } }
    expect(coreColours.size).toBeGreaterThanOrEqual(2);
  });

  it("a Metroid drifts through too (Gavin 2026-11-09): green dome, three red nuclei, claws below; two frames alternating every half second; lower than the jellies but clear of the floor", () => {
    // art
    expect(METROID.frames).toHaveLength(2);
    const w = METROID.frames[0]![0]!.length, h = METROID.frames[0]!.length;
    expect(w).toBeGreaterThanOrEqual(8); expect(w).toBeLessThanOrEqual(10);
    expect(h).toBeGreaterThanOrEqual(7); expect(h).toBeLessThanOrEqual(9);
    expect(METROID.frames[0]).not.toEqual(METROID.frames[1]);
    for (const f of METROID.frames) {
      for (const r of f) expect(r).toHaveLength(w);
      const flat = f.join("");
      expect((flat.match(/[RQ]/g) ?? []).length).toBe(3); // nuclei
      expect(flat).toContain("G"); // dome
      expect(f[h - 1]!.replace(/[.K]/g, "")).toBe(""); // bottom row is claws only
      expect(f[h - 1]).toContain("K");
      // the dome sits above the claws: top row has no claws
      expect(f[0]).not.toContain("K");
    }
    // the nuclei pulse: one frame uses the lighter red
    expect(METROID.frames[0]!.join("")).toContain("R");
    expect(METROID.frames[1]!.join("")).toContain("Q");
    const dome = hex(METROID.colors.G!), bell = hex(OOMA.colors.G!);
    expect(dome[1]!).toBeGreaterThan(bell[1]! + 40); // brighter green than the Ooma bell
    // roster: exactly one Metroid, drifting across the whole loop, lower than the others
    const ms = JELLIES.filter((j) => j.kind === "metroid");
    expect(ms).toHaveLength(1);
    const m = ms[0]!;
    expect(m.cycles).toBe(1);
    const others = JELLIES.filter((j) => j.kind !== "metroid");
    expect(m.yBase).toBeGreaterThanOrEqual(Math.max(...others.map((j) => j.yBase)));
    let lowest = 0;
    for (let t = 0; t < FOG_LOOP_S; t += 0.25) { const p = jellyPos(m, t); lowest = Math.max(lowest, p.y + h); expect(p.y + h).toBeLessThanOrEqual(FLOOR_Y); }
    expect(lowest).toBeGreaterThan(9); // it does dip below the jellies' band
    // frames alternate every 0.5 s and close on the loop
    expect(jellyFrame(m, 0)).toBe(0); expect(jellyFrame(m, 0.5)).toBe(1); expect(jellyFrame(m, 1)).toBe(0);
    expect(jellyFrame(m, FOG_LOOP_S)).toBe(jellyFrame(m, 0));
    // never drawn over a character: wherever its box meets the Knight, Hornet or Samus, their pixels win
    let checked = 0;
    for (let t = 0; t < FOG_LOOP_S; t += 0.5) {
      const p = jellyPos(m, t);
      const chars: Array<[string[], number, number, Readonly<Record<string, string>>]> = [];
      const k = knightState(t); if (k) chars.push([knightRows(t), Math.round(k.x), FLOOR_Y - KNIGHT.frames[0]!.length, KNIGHT.colors]);
      const ho = hornetState(t); if (ho) chars.push([hornetRows(t), Math.round(ho.x), FLOOR_Y - HORNET.frames[0]!.length, HORNET.colors]);
      const sa = samusState(t); if (sa) chars.push([samusRows(t), Math.round(sa.x), FLOOR_Y - SAMUS.frames[0]!.length, SAMUS.colors]);
      for (const [rows, cx, cy, colors] of chars) {
        const cw = rows[0]!.length, ch = rows.length;
        if (p.x + w <= cx || cx + cw <= p.x || p.y + h <= cy || cy + ch <= p.y) continue;
        const f = renderFrame(Math.round(t * FOG_FPS));
        rows.forEach((row, y) => [...row].forEach((c, x) => { const sx = cx + x; if (c !== "." && sx >= 0 && sx < FRONT_WIDTH) { expect(px(f, sx, cy + y)).toEqual(hex(colors[c]!)); checked++; } }));
      }
    }
    expect(checked).toBeGreaterThan(0); // it does meet them, and they stay intact
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

  it("Hornet is Gavin's line-up pick (2026-11-09): 7x9, straight horns from the mask corners, two-row eye hollows, pointed chin, one-tone red cape, stub feet", () => {
    expect(HORNET.frames).toHaveLength(4);
    for (const f of HORNET.frames) {
      expect(f).toHaveLength(9);
      for (const r of f) expect(r).toHaveLength(7);
      expect(f[0]).toBe(".W...W."); // straight horns: rows 0 and 1 identical
      expect(f[1]).toBe(".W...W.");
      expect(f[2]).toBe(".WWWWW.");
      expect(f[3]).toBe(".WEWEW."); // two-row eye hollows
      expect(f[4]).toBe(".WEWEW.");
      expect(f[5]).toBe("..WWW.."); // pointed chin
      expect(f[6]).toMatch(/^\.*R{3,5}\.*$/); // single-tone cape
      expect(f[7]).toMatch(/^\.*R{3,5}\.*$/);
      expect(f[8].replace(/\./g, "")).toMatch(/^K{2}$/); // two stub feet
    }
    expect(new Set(HORNET.frames.map((f) => f.join("/"))).size).toBe(4);
    expect(HORNET.colors).toEqual({ W: "#F2F2F4", E: "#0A0A12", R: "#E04050", K: "#A02838" });
  });

  it("Hornet crosses once each way at a quick pace, never while the Knight is on screen, on screen 10–20 % of the loop", () => {
    expect(HORNET_SPEED).toBeGreaterThanOrEqual(10);
    expect(HORNET_SPEED).toBeLessThanOrEqual(14);
    expect(HORNET_STRIDE_PX).toBe(3);
    expect(HORNET_CROSSINGS.map((c) => c.dir).sort()).toEqual([-1, 1]);
    const step = 1 / FOG_FPS;
    let on = 0, both = 0;
    const seen = { right: false, left: false };
    for (let t = 0; t < FOG_LOOP_S; t += step) {
      const h = hornetState(t);
      if (!h) continue;
      on++;
      if (knightState(t)) both++;
      if (h.dir > 0) seen.right = true; else seen.left = true;
      // moves the way she faces
      const n = hornetState(t + step);
      if (n && n.dir === h.dir) expect(Math.sign(n.x - h.x) === h.dir || n.x === h.x).toBe(true);
      // mirrored rows when walking left
      const rows = hornetRows(t);
      const base = HORNET.frames[h.frame]!;
      expect(rows).toEqual(h.dir > 0 ? [...base] : base.map((r) => r.split("").reverse().join("")));
    }
    expect(both).toBe(0);
    expect(seen).toEqual({ right: true, left: true });
    const share = on / (FOG_LOOP_S * FOG_FPS);
    expect(share).toBeGreaterThanOrEqual(0.10);
    expect(share).toBeLessThanOrEqual(0.20);
    // legs step once per stride and cycle through all four frames
    const c = HORNET_CROSSINGS[0]!;
    expect(hornetState(c.start + HORNET_STRIDE_PX / HORNET_SPEED + 1e-6)!.frame).toBe(1);
    const framesSeen = new Set<number>();
    for (let t = c.start; t < c.start + (FRONT_WIDTH + 7) / HORNET_SPEED; t += step) { const h = hornetState(t); if (h) framesSeen.add(h.frame); }
    expect(framesSeen.size).toBe(4);
  });

  it("draws Hornet in her own colours with her feet on the floor", () => {
    const c = HORNET_CROSSINGS[0]!;
    const t = c.start + 3;
    const i = Math.round(t * FOG_FPS);
    const h = hornetState(i / FOG_FPS)!;
    const f = frames[i]!;
    const rows = hornetRows(i / FOG_FPS);
    const x0 = Math.round(h.x), y0 = FLOOR_Y - rows.length;
    expect(rows).toHaveLength(9);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") expect(px(f, x0 + x, y0 + y)).toEqual(hex(HORNET.colors[ch]!)); }));
    expect(rows[8]!).toContain("K"); // feet on the row above the floor
  });

  it("Samus runs through rarely: one crossing per loop, left to right, poses at 8/s, never with the Knight or Hornet, on screen 4–7 % of the loop (Gavin 2026-11-09)", () => {
    expect(SAMUS_SPEED).toBeGreaterThanOrEqual(14);
    expect(SAMUS_SPEED).toBeLessThanOrEqual(18);
    expect(SAMUS_POSE_RATE).toBe(8);
    const step = 1 / FOG_FPS;
    let on = 0, others = 0, entries = 0, wasOn = false;
    for (let t = 0; t < FOG_LOOP_S; t += step) {
      const s = samusState(t);
      if (!s) { wasOn = false; continue; }
      if (!wasOn) entries++;
      wasOn = true;
      on++;
      if (knightState(t) || hornetState(t)) others++;
      expect(s.dir).toBe(1);
      const n = samusState(t + step);
      if (n) expect(n.x).toBeGreaterThanOrEqual(s.x);
      // poses advance on the clock, not the stride
      expect(s.frame).toBe(Math.floor((t - SAMUS_START_S) * SAMUS_POSE_RATE + 1e-9) % SAMUS.frames.length);
      expect(samusRows(t)).toEqual([...SAMUS.frames[s.frame]!]);
    }
    expect(entries).toBe(1);
    expect(others).toBe(0);
    const share = on / (FOG_LOOP_S * FOG_FPS);
    expect(share).toBeGreaterThanOrEqual(0.04);
    expect(share).toBeLessThanOrEqual(0.07);
    // a second of clearance either side of her crossing
    for (let t = SAMUS_START_S - 1; t < SAMUS_START_S; t += step) expect(knightState(t) ?? hornetState(t)).toBeNull();
    const end = SAMUS_START_S + (FRONT_WIDTH + 9) / SAMUS_SPEED;
    for (let t = end; t < end + 1; t += step) expect(knightState(t) ?? hornetState(t)).toBeNull();
    const framesSeen = new Set<number>();
    for (let t = SAMUS_START_S; t < end; t += step) { const s = samusState(t); if (s) framesSeen.add(s.frame); }
    expect(framesSeen.size).toBe(4);
  });

  it("draws Samus in her own colours with her feet on the row above the floor", () => {
    const t = SAMUS_START_S + 2.5;
    const i = Math.round(t * FOG_FPS);
    const s = samusState(i / FOG_FPS)!;
    const f = frames[i]!;
    const rows = samusRows(i / FOG_FPS);
    const x0 = Math.round(s.x), y0 = FLOOR_Y - rows.length;
    expect(rows).toHaveLength(10);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") expect(px(f, x0 + x, y0 + y)).toEqual(hex(SAMUS.colors[ch]!)); }));
    expect(rows[9]!).toMatch(/[ND]/); // feet on the row above the floor
  });

  it("encodes under 25 MB", () => {
    const bytes = encodeAnimFile({ width: FRONT_WIDTH, height: FRONT_HEIGHT, fps: FOG_FPS, frames });
    expect(bytes.length).toBeLessThan(25 * 1024 * 1024);
  });
});
