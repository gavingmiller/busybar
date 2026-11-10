import { describe, it, expect } from "bun:test";
import {
  LONGSHIP, LONGSHIP_FPS, LONGSHIP_LOOP_S, LONGSHIP_FRAME_COUNT, HORIZON_Y, WATERLINE_Y,
  FOREGROUND, BACKGROUND, shipX, shipVisible, shipRows, renderFrame,
} from "./index.ts";
import { LONGSHIP_ART, SMALL_SHIP_ART, TINY_SHIP_ART } from "./art.ts";
import { FRONT_WIDTH, FRONT_HEIGHT } from "../../lib/scene.ts";
import { encodeAnimFile } from "../../lib/anim-file.ts";

const px = (f: Uint8Array, x: number, y: number) => {
  const i = (y * FRONT_WIDTH + x) * 4;
  return [f[i], f[i + 1], f[i + 2], f[i + 3]];
};
const rowBytes = (f: Uint8Array, y: number) => Array.from(f.slice(y * FRONT_WIDTH * 4, (y + 1) * FRONT_WIDTH * 4));

describe("LONGSHIP scene", () => {
  const frames = LONGSHIP.frames();

  it("is a full-display opaque loop of 60–120 s at 24 fps", () => {
    expect(LONGSHIP.id).toBe("longship");
    expect(LONGSHIP.name).toBe("Longship");
    expect(LONGSHIP.fps).toBe(LONGSHIP_FPS);
    expect(LONGSHIP_FPS).toBe(24);
    expect(LONGSHIP_LOOP_S).toBeGreaterThanOrEqual(60);
    expect(LONGSHIP_LOOP_S).toBeLessThanOrEqual(120);
    expect(frames).toHaveLength(LONGSHIP_FRAME_COUNT);
    expect(LONGSHIP_FRAME_COUNT).toBe(LONGSHIP_FPS * LONGSHIP_LOOP_S);
    for (const f of frames) {
      expect(f.length).toBe(FRONT_WIDTH * FRONT_HEIGHT * 4);
      for (let i = 3; i < f.length; i += 4) if (f[i] !== 255) throw new Error(`transparent pixel at byte ${i}`);
    }
  });

  it("loops seamlessly and deterministically", () => {
    expect(renderFrame(LONGSHIP_FRAME_COUNT)).toEqual(frames[0]!);
    expect(renderFrame(7)).toEqual(frames[7]!);
    expect(LONGSHIP.frames()[300]).toEqual(frames[300]!);
    expect(frames[0]).not.toEqual(frames[1]);
  });

  it("the art faces right and the mirrored copy is used for the leftward voyage, dragon head leading", () => {
    for (const art of [LONGSHIP_ART, SMALL_SHIP_ART, TINY_SHIP_ART]) {
      const w = art.rows[0]!.length;
      for (const r of art.rows) expect(r).toHaveLength(w);
      for (const ch of new Set(art.rows.join("").replace(/\./g, ""))) expect(art.colors[ch]).toMatch(/^#[0-9A-F]{6}$/);
      // prow (Y) sits right of the mast (M) in the right-facing art
      const prowCol = Math.max(...art.rows.map((r) => r.lastIndexOf("Y")));
      const mastCol = art.rows.find((r) => r.includes("M"))!.indexOf("M");
      expect(prowCol).toBeGreaterThan(mastCol);
    }
    expect(FOREGROUND.dir).toBe(-1);
    const rows = shipRows(FOREGROUND);
    const prowCol = Math.min(...rows.map((r) => (r.includes("Y") ? r.indexOf("Y") : Infinity)));
    const mastCol = rows.find((r) => r.includes("M"))!.indexOf("M");
    expect(prowCol).toBeLessThan(mastCol); // head leads when sailing left
    expect(rows).toEqual(LONGSHIP_ART.rows.map((r) => r.split("").reverse().join("")));
  });

  it("the longship crosses the whole display several times per loop, moving steadily leftward", () => {
    const w = LONGSHIP_ART.rows[0]!.length;
    let crossings = 0, prev = shipX(FOREGROUND, 0);
    for (let t = 1 / LONGSHIP_FPS; t < LONGSHIP_LOOP_S; t += 1 / LONGSHIP_FPS) {
      const x = shipX(FOREGROUND, t);
      if (x > prev) crossings++; else expect(x).toBeLessThanOrEqual(prev);
      prev = x;
    }
    expect(crossings).toBeGreaterThanOrEqual(3);
    expect(crossings).toBeLessThanOrEqual(6);
    // and it is fully on screen at some point and fully off at another
    let onScreen = false, offScreen = false;
    for (let t = 0; t < LONGSHIP_LOOP_S; t += 0.25) {
      const x = shipX(FOREGROUND, t);
      if (x >= 0 && x + w <= FRONT_WIDTH) onScreen = true;
      if (!shipVisible(FOREGROUND, t)) offScreen = true;
    }
    expect(onScreen).toBe(true);
    expect(offScreen).toBe(true);
  });

  it("background ships are smaller, sit on the horizon, and move slower than the longship (parallax)", () => {
    expect(BACKGROUND.length).toBeGreaterThanOrEqual(2);
    for (const b of BACKGROUND) {
      expect(b.art.rows[0]!.length).toBeLessThan(LONGSHIP_ART.rows[0]!.length / 2);
      expect(b.art.rows.length).toBeLessThan(LONGSHIP_ART.rows.length);
      expect(b.speed).toBeLessThan(FOREGROUND.speed / 2);
      expect(b.dir).toBe(FOREGROUND.dir);
      expect(b.waterline).toBe(HORIZON_Y);
      // visible for part of the loop, gone for part of it
      let seen = 0, gone = 0;
      for (let t = 0; t < LONGSHIP_LOOP_S; t += 0.5) (shipVisible(b, t) ? seen++ : gone++);
      expect(seen).toBeGreaterThan(20);
      expect(gone).toBeGreaterThan(20);
    }
    expect(FOREGROUND.waterline).toBe(WATERLINE_Y);
    expect(HORIZON_Y).toBeLessThan(WATERLINE_Y);
    // the two background ships are not glued together
    const [a, b] = BACKGROUND as [typeof BACKGROUND[0], typeof BACKGROUND[0]];
    expect(a.speed).not.toBe(b.speed);
  });

  it("waves roll under the ships: the sea rows change over time and carry crests brighter than the water", () => {
    for (const y of [WATERLINE_Y - 1, FRONT_HEIGHT - 1]) {
      expect(rowBytes(frames[0]!, y)).not.toEqual(rowBytes(frames[6]!, y));
    }
    const seaRow = rowBytes(frames[0]!, FRONT_HEIGHT - 2);
    const lum = new Set<number>();
    for (let x = 0; x < FRONT_WIDTH; x++) lum.add(seaRow[x * 4]! + seaRow[x * 4 + 1]! + seaRow[x * 4 + 2]!);
    expect(lum.size).toBeGreaterThanOrEqual(2);
    // sea is blue: more blue than red everywhere on the bottom row
    for (let x = 0; x < FRONT_WIDTH; x++) { const [r, , b] = px(frames[0]!, x, FRONT_HEIGHT - 1); expect(b!).toBeGreaterThan(r!); }
  });

  it("has a starry sky above the horizon that twinkles", () => {
    let lit = 0;
    for (let y = 0; y < HORIZON_Y - 1; y++) for (let x = 0; x < FRONT_WIDTH; x++) if (px(frames[0]!, x, y).slice(0, 3).some((c) => c! > 0)) lit++;
    expect(lit).toBeGreaterThan(8);
    expect(lit).toBeLessThan(FRONT_WIDTH * HORIZON_Y * 0.3);
    // find a time with no ship masts in the sky rows to compare pure sky... stars differ between frames 0 and 48
    expect(frames[0]!.slice(0, 2 * FRONT_WIDTH * 4)).not.toEqual(frames[48]!.slice(0, 2 * FRONT_WIDTH * 4));
  });

  it("draws no oars under the longship: nothing brown or splash-white appears in the water below its keel", () => {
    // Gavin 2026-11-10: the brown oar blades and white splash dots read as stray pixels, not paddles.
    const OAR = [122, 74, 34], SPLASH = [200, 220, 240];
    for (let i = 0; i < frames.length; i += 7) {
      const f = frames[i]!;
      for (let y = WATERLINE_Y + 1; y < FRONT_HEIGHT; y++) for (let x = 0; x < FRONT_WIDTH; x++) {
        const [r, g, b] = px(f, x, y);
        const isOar = r === OAR[0] && g === OAR[1] && b === OAR[2];
        const isSplash = r === SPLASH[0] && g === SPLASH[1] && b === SPLASH[2];
        if (isOar || isSplash) throw new Error(`oar/splash pixel at (${x},${y}) in frame ${i}`);
      }
    }
  });

  it("encodes under 25 MB", () => {
    const bytes = encodeAnimFile({ width: FRONT_WIDTH, height: FRONT_HEIGHT, fps: LONGSHIP_FPS, frames });
    expect(bytes.length).toBeLessThan(25 * 1024 * 1024);
  });
});
