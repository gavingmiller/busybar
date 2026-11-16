import { describe, expect, it } from "bun:test";
import {
  BOULDER, BOULDERS, CHOSEN, GROUND_ROW, KINDS, LAYER_H, LAYER_W, MAX_H, MAX_W, TUMBLEWEED, TUMBLEWEEDS,
  obstEntry, rasterize, rollingFrame, spriteHeight, spriteWidth, type ObstacleArt,
} from "./obstacles.ts";

const all: ObstacleArt[] = [...TUMBLEWEEDS, ...BOULDERS, ...KINDS];

describe("extra Dino Run obstacles (tumbleweed + boulder, Gavin 2026-11-16)", () => {
  it("offers five numbered candidates in each of the three line-ups (tumbleweeds, rocks, other kinds)", () => {
    expect(TUMBLEWEEDS.length).toBe(5);
    expect(BOULDERS.length).toBe(5);
    expect(KINDS.length).toBe(5);
    all.forEach((a, i) => expect(a.name.startsWith(`${(i % 5) + 1} `)).toBe(true));
  });

  it("CHOSEN holds Gavin's six picks (2026-11-16) as two-letter types that never start with \"b\"", () => {
    expect(CHOSEN.map((c) => c.type)).toEqual(["sk", "gr", "sa", "sn", "sc", "to"]);
    expect(CHOSEN.map((c) => c.art.name)).toEqual([
      KINDS[2]!.name, BOULDERS[1]!.name, BOULDERS[0]!.name, KINDS[1]!.name, KINDS[0]!.name, KINDS[4]!.name,
    ]);
    for (const { type, art } of CHOSEN) {
      expect(type).toMatch(/^[ac-z][a-z]$/);
      expect(`${type}@${-spriteWidth(art) + 1}`.length).toBeLessThanOrEqual(7);
      expect(spriteWidth(art)).toBeLessThanOrEqual(MAX_W);
      expect(spriteHeight(art)).toBeLessThanOrEqual(MAX_H);
    }
  });

  it("stays inside the jumpable envelope at 1 px/frame (≤ 11 wide, ≤ 5 tall)", () => {
    for (const art of all) {
      expect(spriteWidth(art)).toBeLessThanOrEqual(MAX_W);
      expect(spriteHeight(art)).toBeLessThanOrEqual(MAX_H);
    }
    for (const art of TUMBLEWEEDS) expect(spriteWidth(art)).toBeGreaterThanOrEqual(5);
    for (const art of BOULDERS) expect(spriteWidth(art)).toBeGreaterThanOrEqual(7);
  });

  it("keeps the same box in every frame and only uses colours it defines", () => {
    for (const art of all) {
      const w = spriteWidth(art), h = spriteHeight(art);
      for (const frame of art.frames) {
        expect(frame.length).toBe(h);
        for (const row of frame) {
          expect(row.length).toBe(w);
          for (const ch of row) if (ch !== ".") expect(art.colors[ch], `${art.name}: "${ch}"`).toBeDefined();
        }
      }
    }
  });

  it("tumbleweeds roll through four frames that each touch the ground row; boulders are static", () => {
    for (const art of TUMBLEWEEDS) {
      expect(art.frames.length).toBe(4);
      for (const frame of art.frames) expect(frame[frame.length - 1]!.replace(/\./g, "").length).toBeGreaterThan(0);
      // Frames must actually differ, or it is not rolling.
      expect(new Set(art.frames.map((f) => f.join("/"))).size).toBe(4);
    }
    for (const art of BOULDERS) expect(art.frames.length).toBe(1);
    for (const art of KINDS) expect(art.frames.length).toBeLessThanOrEqual(2); // a static pose or a two-pose twitch
    expect(rollingFrame(TUMBLEWEED, 0)).toBe(TUMBLEWEED.frames[0]!);
    expect(rollingFrame(TUMBLEWEED, 4)).toBe(TUMBLEWEED.frames[1]!);
    expect(rollingFrame(TUMBLEWEED, 17)).toBe(TUMBLEWEED.frames[0]!);
  });

  it("sits on the ground like the upstream cacti: bottom row 13 of the 72x14 layer", () => {
    expect(GROUND_ROW).toBe(13);
    expect(GROUND_ROW).toBe(LAYER_H - 1);
  });
  it("builds the game's D.OBST entry: bottom row on GROUND_ROW, row bitmasks with bit i = column i, 73+w crossing frames", () => {
    const e = obstEntry({ name: "x", frames: [[".LLLLL.", "LMMMMMD", "DDDDDDD"]], colors: {} });
    expect(e.w).toBe(7);
    expect(e.top).toBe(GROUND_ROW - 3 + 1);
    expect(e.hit).toEqual([0b0111110, 0b1111111, 0b1111111]);
    expect(e.frames).toEqual({ "0": LAYER_W + 7 + 1 });
    for (const art of all) expect(obstEntry(art).top + obstEntry(art).hit.length - 1).toBe(GROUND_ROW);
    // `softTop` rows (thin tips: a sting, a shell cap) stay in the art but leave the collision mask,
    // so the jump window is judged on the solid body; the dino may brush them.
    const soft = obstEntry({ name: "x", frames: [["...L...", ".LLLLL.", "LLLLLLL"]], colors: {}, softTop: 1 });
    expect(soft).toEqual({ w: 7, top: GROUND_ROW - 1, hit: [0b0111110, 0b1111111], frames: { "0": LAYER_W + 7 + 1 } });
    // On the ground (bottom row 13) every chosen obstacle has a 9+ frame window with ALL its drawn
    // pixels in the mask, so none trims a top row: a trimmed row let the planner aim where the
    // visible crown / sting / shell cap clips the dino (Gavin 2026-11-16: "jumping through them").
    for (const { type, art } of CHOSEN) expect(obstEntry(art).hit.length, type).toBe(spriteHeight(art));
    // A rolling obstacle's mask is the union of its frames, so no frame pokes outside the collision shape.
    const t = obstEntry(TUMBLEWEED);
    for (const frame of TUMBLEWEED.frames) frame.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] !== ".") expect(t.hit[r]! & (1 << c)).toBeTruthy(); });
  });

  it("rasterizes onto the 72x14 obstacle layer with the bottom row on the ground, clipping off-screen columns", () => {
    const rock: ObstacleArt = { name: "x", frames: [[".LLLLL.", "LMMMMMD", "DDDDDDD"]], colors: { L: "#FFFFFF", M: "#888888", D: "#444444" } };
    const buf = rasterize(rock, rock.frames[0]!, 10);
    expect(buf.length).toBe(LAYER_W * LAYER_H * 4);
    const alpha = (x: number, y: number) => buf[(y * LAYER_W + x) * 4 + 3];
    expect(alpha(10, GROUND_ROW)).toBe(255);
    expect(alpha(10, GROUND_ROW - 2)).toBe(0); // the top row's corner is transparent
    expect(alpha(11, GROUND_ROW - 2)).toBe(255);
    expect(GROUND_ROW + 1).toBe(LAYER_H); // nothing is drawn below the bottom row: it is the layer's last
    const partly = rasterize(rock, rock.frames[0]!, -5);
    expect(partly[(GROUND_ROW * LAYER_W + 0) * 4 + 3]).toBe(255);
    expect(partly[(GROUND_ROW * LAYER_W + 2) * 4 + 3]).toBe(0);
    expect(BOULDER.frames.length).toBe(1);
  });
});
