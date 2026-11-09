import { describe, it, expect } from "bun:test";
import {
  FOG_CANYON, FOG_FPS, FOG_LOOP_S, FOG_FRAME_COUNT, FLOOR_Y, KNIGHT_SPEED, KNIGHT_STRIDE_PX,
  JELLIES, BUBBLES, renderFrame, knightState, knightRows, jellyPos, jellyFrame, bubblePos,
  HORNET_SPEED, HORNET_STRIDE_PX, HORNET_CROSSINGS, hornetState, hornetRows,
  SAMUS_SPEED, SAMUS_SPRINT_S, SAMUS_EXIT_S, DRAW_ORDER, SAMUS_START_S, samusState, samusRows,
  CHASE, metroidState, METROID_FRAME_S, METROID_FLEE_FRAME_S,
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

  it("a Metroid drifts in to the quarter mark and Samus chases it off (Gavin 2026-11-09): green dome, three red nuclei, claws below; two frames; lower than the jellies but clear of the floor", () => {
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
    // the chase (Gavin 2026-11-09): it drifts in from the right to the quarter mark, hovers, then Samus
    // comes in from the left and chases it off the right edge
    expect(JELLIES.some((j) => j.kind === "metroid")).toBe(false); // no longer a whole-loop drifter
    const step = 1 / FOG_FPS;
    let entries = 0, wasOn = false, reachedMark = -1, leftMark = -1, exitT = -1, minX = Infinity, lowest = 0;
    for (let t = 0; t < FOG_LOOP_S; t += step) {
      const m = metroidState(t);
      if (!m) { if (wasOn && exitT < 0) exitT = t; wasOn = false; continue; }
      if (!wasOn) { entries++; expect(m.x).toBeGreaterThanOrEqual(FRONT_WIDTH - 1); } // enters from the right edge
      wasOn = true;
      minX = Math.min(minX, m.x);
      lowest = Math.max(lowest, m.y + h);
      expect(m.y + h).toBeLessThanOrEqual(FLOOR_Y);
      if (reachedMark < 0 && Math.abs(m.x - CHASE.markX) <= 2) reachedMark = t;
      if (reachedMark >= 0 && leftMark < 0 && m.x > CHASE.markX + 2) leftMark = t;
      const n = metroidState(t + step);
      if (n) {
        if (reachedMark < 0) expect(n.x).toBeLessThanOrEqual(m.x); // drifting in leftward
        if (leftMark >= 0) expect(n.x).toBeGreaterThanOrEqual(m.x); // fleeing rightward
      }
    }
    expect(entries).toBe(1);
    expect(Math.abs(minX - CHASE.markX)).toBeLessThanOrEqual(2); // about a quarter of the way across
    expect(leftMark - reachedMark).toBeGreaterThanOrEqual(0.8); // hovers at the mark
    // it bolts the moment she starts sprinting, not before (Gavin 2026-11-09): hovering through her walk and pause
    expect(metroidState(SAMUS_SPRINT_S - step)!.phase).toBe("hover");
    expect(metroidState(SAMUS_SPRINT_S)!.phase).toBe("flee");
    expect(Math.abs(leftMark - SAMUS_SPRINT_S)).toBeLessThanOrEqual(2 / CHASE.fleeSpeed + 2 * step); // "left" = 2 px past the mark
    const markS = CHASE.metroidEnterS + (FRONT_WIDTH - CHASE.markX) / CHASE.driftSpeed;
    for (let t = markS + step; t < SAMUS_SPRINT_S; t += step) expect(metroidState(t)!.x).toBe(CHASE.markX); // stationary (bob aside)
    expect(CHASE.fleeSpeed).toBeGreaterThan(CHASE.driftSpeed * 2); // bolts faster than it came in
    expect(exitT).toBeGreaterThan(leftMark);
    expect(lowest).toBeGreaterThan(9); // still hunts below the jellies' band
    // off screen outside the chase window
    for (let t = 0; t < CHASE.metroidEnterS - 0.5; t += 1) expect(metroidState(t)).toBeNull();
    for (let t = exitT + 0.5; t < FOG_LOOP_S; t += 1) expect(metroidState(t)).toBeNull();
    // frames: half a second apart while drifting, a quarter while fleeing (agitated)
    expect(METROID_FRAME_S).toBe(0.5); expect(METROID_FLEE_FRAME_S).toBe(0.25);
    const drift = CHASE.metroidEnterS + 1;
    expect(metroidState(drift)!.frame).not.toBe(metroidState(drift + 0.5)!.frame);
    expect(metroidState(drift)!.frame).toBe(metroidState(drift + 1)!.frame);
    const flee = leftMark + 0.1;
    expect(metroidState(flee)!.frame).not.toBe(metroidState(flee + 0.25)!.frame);
    // Samus enters from the left no earlier than the mark is reached, stays behind it, and both are on screen together ≥ 2 s
    expect(SAMUS_START_S).toBeGreaterThanOrEqual(reachedMark);
    let together = 0;
    for (let t = 0; t < FOG_LOOP_S; t += step) {
      const m = metroidState(t), sa = samusState(t);
      if (!m || !sa) continue;
      together += step;
      expect(sa.x + SAMUS.frames[0]![0]!.length).toBeLessThanOrEqual(m.x); // her front edge never passes its back edge
    }
    expect(together).toBeGreaterThanOrEqual(2);
    expect(metroidState(SAMUS_EXIT_S - step)).toBeNull(); // the Metroid is gone before she leaves
    // never drawn over a character: wherever its box meets the Knight, Hornet or Samus, their pixels win
    let checked = 0;
    for (let t = CHASE.metroidEnterS; t < exitT; t += 0.25) {
      const p = metroidState(t)!;
      const chars: Array<[string[], number, number, Readonly<Record<string, string>>]> = [];
      const k = knightState(t); if (k) chars.push([knightRows(t), Math.round(k.x), FLOOR_Y - KNIGHT.frames[0]!.length, KNIGHT.colors]);
      const ho = hornetState(t); if (ho) chars.push([hornetRows(t), Math.round(ho.x), FLOOR_Y - HORNET.frames[0]!.length, HORNET.colors]);
      const sa = samusState(t); if (sa) chars.push([samusRows(t), Math.round(sa.x), FLOOR_Y - SAMUS.frames[0]!.length, SAMUS.colors]);
      expect(k ?? ho).toBeNull(); // only Samus shares the window with it
      for (const [rows, cx, cy, colors] of chars) {
        const f = renderFrame(Math.round(t * FOG_FPS));
        rows.forEach((row, y) => [...row].forEach((c, x) => { const sx = cx + x; if (c !== "." && sx >= 0 && sx < FRONT_WIDTH) { expect(px(f, sx, cy + y)).toEqual(hex(colors[c]!)); checked++; } }));
      }
    }
    expect(checked).toBeGreaterThan(0);
    // and it is drawn where metroidState says, in its own colours, when alone
    const tAlone = CHASE.metroidEnterS + 2;
    const i = Math.round(tAlone * FOG_FPS), m = metroidState(i / FOG_FPS)!, f = renderFrame(i);
    METROID.frames[m.frame]!.forEach((row, y) => [...row].forEach((c, x) => { const sx = Math.round(m.x) + x; if (c !== "." && sx < FRONT_WIDTH) expect(px(f, sx, m.y + y)).toEqual(hex(METROID.colors[c]!)); }));
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

  it("Samus walks in, notices the Metroid, stops, then sprints; poses follow her speed (Gavin 2026-11-09)", () => {
    expect(SAMUS_SPEED).toBeGreaterThanOrEqual(14);
    expect(SAMUS_SPEED).toBeLessThanOrEqual(18);
    expect(CHASE.walkSpeed).toBeGreaterThanOrEqual(5);
    expect(CHASE.walkSpeed).toBeLessThanOrEqual(9); // brisk walk so the whole appearance stays short
    expect(SAMUS_POSE_RATE).toBe(8);
    const step = 1 / FOG_FPS;
    let on = 0, others = 0, entries = 0, wasOn = false, stopS = 0;
    const phases: string[] = [];
    for (let t = 0; t < FOG_LOOP_S; t += step) {
      const s = samusState(t);
      if (!s) { wasOn = false; continue; }
      if (!wasOn) entries++;
      wasOn = true;
      on++;
      if (knightState(t) || hornetState(t)) others++;
      expect(s.dir).toBe(1);
      if (phases[phases.length - 1] !== s.phase) phases.push(s.phase);
      const n = samusState(t + step);
      if (n && n.phase === s.phase) {
        const v = (n.x - s.x) / step;
        if (s.phase === "walk") expect(v).toBeCloseTo(CHASE.walkSpeed, 6);
        if (s.phase === "stop") { expect(v).toBe(0); stopS += step; }
        if (s.phase === "sprint") expect(v).toBeCloseTo(SAMUS_SPEED, 6);
      }
      // poses: speed / 2 per second while moving, from the start of that phase; frame 0 while stopped
      if (s.phase === "walk") expect(s.frame).toBe(Math.floor((t - SAMUS_START_S) * (CHASE.walkSpeed / 2) + 1e-9) % 4);
      if (s.phase === "stop") expect(s.frame).toBe(0);
      if (s.phase === "sprint") expect(s.frame).toBe(Math.floor((t - SAMUS_SPRINT_S) * (SAMUS_SPEED / 2) + 1e-9) % 4);
      expect(SAMUS_SPEED / 2).toBe(SAMUS_POSE_RATE);
      expect(samusRows(t)).toEqual([...SAMUS.frames[s.frame]!]);
    }
    expect(entries).toBe(1);
    expect(others).toBe(0);
    expect(phases).toEqual(["walk", "stop", "sprint"]);
    expect(stopS).toBeGreaterThanOrEqual(0.5);
    // the rate change does not jump a frame: walk ends on frame 0, stop holds 0, sprint starts on 0
    expect(samusState(SAMUS_SPRINT_S - step)!.frame).toBe(0);
    expect(samusState(SAMUS_SPRINT_S)!.frame).toBe(0);
    // she notices it from about 12 px away
    const notice = samusState(SAMUS_SPRINT_S - step)!;
    // She notices at the quarter mark of the screen, not next to the Metroid (Gavin 2026-11-09: too much time on screen).
    expect(Math.abs(notice.x - 18)).toBeLessThanOrEqual(2);
    expect(SAMUS_EXIT_S - CHASE.samusStartS).toBeLessThanOrEqual(8);
    const share = on / (FOG_LOOP_S * FOG_FPS);
    expect(share).toBeGreaterThanOrEqual(0.04);
    expect(share).toBeLessThanOrEqual(0.12);
    // a second of clearance either side of her time on screen
    for (let t = SAMUS_START_S - 1; t < SAMUS_START_S; t += step) expect(knightState(t) ?? hornetState(t)).toBeNull();
    for (let t = SAMUS_EXIT_S; t < SAMUS_EXIT_S + 1; t += step) expect(knightState(t) ?? hornetState(t)).toBeNull();
    const framesSeen = new Set<number>();
    for (let t = SAMUS_START_S; t < SAMUS_EXIT_S; t += step) { const s = samusState(t); if (s) framesSeen.add(s.frame); }
    expect(framesSeen.size).toBe(4);
    // she is the topmost foreground: drawn after everything else
    expect(DRAW_ORDER[DRAW_ORDER.length - 1]).toBe("samus");
    expect(DRAW_ORDER.indexOf("metroid")).toBeLessThan(DRAW_ORDER.indexOf("samus"));
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
