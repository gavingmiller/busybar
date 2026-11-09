import { describe, it, expect } from "bun:test";
import {
  SLEIGH, SLEIGH_FPS, SLEIGH_LOOP_S, SLEIGH_FRAME_COUNT, SLEIGH_SPEED, TREE_SPEED, CROSSING_S,
  REINDEER, LEAD_NOSE, SNOW_ROWS, SNOW, STAR_COLORS, SNOWFLAKE, isDecemberInEdmonton, teamX, renderFrame,
} from "./index.ts";
import { FRONT_WIDTH, FRONT_HEIGHT } from "../../lib/scene.ts";
import { encodeAnimFile } from "../../lib/anim-file.ts";

const px = (f: Uint8Array, x: number, y: number) => {
  const i = (y * FRONT_WIDTH + x) * 4;
  return [f[i], f[i + 1], f[i + 2], f[i + 3]];
};
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const lit = (f: Uint8Array, x: number, y: number) => px(f, x, y).slice(0, 3).some((c) => c! > 0);

describe("SLEIGH scene", () => {
  const frames = SLEIGH.frames();

  it("is a full-display opaque 24 fps loop of 45–90 s", () => {
    expect(SLEIGH.id).toBe("sleigh");
    expect(SLEIGH.name).toBe("Santa's Sleigh");
    expect(SLEIGH.fps).toBe(SLEIGH_FPS);
    expect(SLEIGH_FPS).toBe(24);
    expect(SLEIGH_LOOP_S).toBeGreaterThanOrEqual(45);
    expect(SLEIGH_LOOP_S).toBeLessThanOrEqual(90);
    expect(frames).toHaveLength(SLEIGH_FRAME_COUNT);
    expect(SLEIGH_FRAME_COUNT).toBe(SLEIGH_FPS * SLEIGH_LOOP_S);
    for (const f of frames) {
      expect(f.length).toBe(FRONT_WIDTH * FRONT_HEIGHT * 4);
      for (let i = 3; i < f.length; i += 4) if (f[i] !== 255) throw new Error(`transparent pixel at byte ${i}`);
    }
  });

  it("loops seamlessly and deterministically", () => {
    expect(renderFrame(SLEIGH_FRAME_COUNT)).toEqual(frames[0]!);
    expect(renderFrame(37)).toEqual(frames[37]!);
    expect(SLEIGH.frames()[400]).toEqual(frames[400]!);
    expect(frames[0]).not.toEqual(frames[12]); // half a second on, the snow has fallen a row
  });

  it("only plays in December, judged on the Edmonton calendar", () => {
    expect(SLEIGH.available).toBeDefined();
    expect(isDecemberInEdmonton(new Date("2026-12-01T12:00:00Z"))).toBe(true);
    expect(isDecemberInEdmonton(new Date("2026-11-30T23:30:00Z"))).toBe(false); // Nov 30 16:30 MST
    // Boundary cases chosen to hold whether the tz data has Alberta at UTC-7 or the permanent UTC-6 it moved to in Nov 2026.
    expect(isDecemberInEdmonton(new Date("2026-12-01T04:00:00Z"))).toBe(false); // Nov 30 21:00/22:00 in Edmonton, though UTC is already Dec 1
    expect(isDecemberInEdmonton(new Date("2027-01-01T04:00:00Z"))).toBe(true); // Dec 31 21:00/22:00 in Edmonton, though UTC is already Jan 1
    expect(isDecemberInEdmonton(new Date("2027-01-01T08:00:00Z"))).toBe(false); // Jan 1 01:00/02:00 in Edmonton
    expect(SLEIGH.available!(new Date("2026-12-24T20:00:00Z"))).toBe(true);
    expect(SLEIGH.available!(new Date("2026-07-01T20:00:00Z"))).toBe(false);
    expect(SLEIGH.availableNote).toBe("only plays in December");
  });

  it("the reindeer face the way they travel: the red nose is the leading (leftmost) pixel of the lead reindeer in every pose (Gavin 2026-11-09: the nose was on his butt)", () => {
    expect(SLEIGH_SPEED).toBeGreaterThan(0); // px/s, travel is right → left
    for (const pose of REINDEER) {
      const noseCol = Math.min(...pose.map((r) => r.indexOf(LEAD_NOSE)).filter((c) => c >= 0));
      const leftmostLit = Math.min(...pose.map((r) => r.search(/[^.]/)).filter((c) => c >= 0));
      expect(noseCol).toBe(leftmostLit);
      expect(pose.join("")).toMatch(/Y/); // antlers up top
      expect(pose[0]!).toMatch(/Y/);
    }
    // the sleigh sits mid-screen heading left: x decreases with time
    const t = CROSSING_S * 0.27; // lead reindeer around x = 9, whole team on screen
    expect(teamX(t + 0.2)).toBeLessThan(teamX(t));
    // drawn: a lit red nose pixel is the leftmost lit pixel of the whole team on its row
    const i = Math.round(t * SLEIGH_FPS);
    const f = renderFrame(i);
    const noseRGB = [hex("#FF3030"), hex("#B02020")];
    let noseX = -1, noseY = -1;
    for (let y = 0; y < 13 && noseX < 0; y++) for (let x = 0; x < FRONT_WIDTH; x++) if (noseRGB.some((c) => c.join() === px(f, x, y).join())) { noseX = x; noseY = y; break; }
    expect(noseX).toBeGreaterThanOrEqual(0);
    for (let x = 0; x < noseX; x++) {
      const p = px(f, x, noseY);
      const isSkyThing = !lit(f, x, noseY) || STAR_COLORS.some((c) => hex(c).join() === p.join()) || hex(SNOWFLAKE).join() === p.join();
      expect(isSkyThing, `col ${x} left of the nose should be sky`).toBe(true);
    }
  });

  it("snowy ground every column every frame, trees scroll slower than the sleigh (parallax), snow falls", () => {
    expect(SNOW_ROWS).toEqual([14, 15]);
    for (let i = 0; i < SLEIGH_FRAME_COUNT; i += 113) for (const y of SNOW_ROWS) for (let x = 0; x < FRONT_WIDTH; x++) expect(px(frames[i]!, x, y)).toEqual(hex(SNOW[y === 14 ? 0 : 1]!));
    expect(TREE_SPEED).toBeLessThan(SLEIGH_SPEED / 2);
    expect(TREE_SPEED).toBeGreaterThan(0);
    let flakes = 0;
    for (let y = 0; y < 14; y++) for (let x = 0; x < FRONT_WIDTH; x++) if (px(frames[0]!, x, y).join() === hex(SNOWFLAKE).join()) flakes++;
    expect(flakes).toBeGreaterThanOrEqual(3);
  });

  it("the sky is empty of the team between crossings, so the loop breathes", () => {
    let withTeam = 0, without = 0;
    for (let t = 0; t < SLEIGH_LOOP_S; t += 0.5) {
      const x = teamX(t);
      if (x > -60 && x < FRONT_WIDTH) withTeam++; else without++;
    }
    expect(withTeam).toBeGreaterThan(10);
    expect(without).toBeGreaterThan(10);
  });

  it("encodes under 25 MB", () => {
    const bytes = encodeAnimFile({ width: FRONT_WIDTH, height: FRONT_HEIGHT, fps: SLEIGH_FPS, frames });
    expect(bytes.length).toBeLessThan(25 * 1024 * 1024);
  });
});
