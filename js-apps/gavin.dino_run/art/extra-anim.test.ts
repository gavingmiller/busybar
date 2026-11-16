import { describe, expect, it } from "bun:test";
import { EXTRA_FPS, buildExtraAnim, obstacleSections } from "../build-extra-anim.ts";
import { BOULDERS, CHOSEN, KINDS, LAYER_H, LAYER_W, TUMBLEWEEDS, spriteWidth } from "./obstacles.ts";

// bicycle1 header (34 bytes) + sections chunk: start u32, end u32, frame_offs u32, name\0.
function readSections(bytes: Uint8Array) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = {
    signature: new TextDecoder().decode(bytes.slice(0, 8)),
    width: dv.getUint8(9), height: dv.getUint8(10), fps: dv.getUint8(16),
    sectionsChunkLength: dv.getUint32(18, true), sectionCount: dv.getUint32(26, true), frameCount: dv.getUint32(30, true),
  };
  const sections: Array<{ name: string; start: number; end: number }> = [];
  let off = 34;
  for (let i = 0; i < header.sectionCount; i++) {
    const start = dv.getUint32(off, true), end = dv.getUint32(off + 4, true);
    let e = off + 12; while (bytes[e] !== 0) e++;
    sections.push({ name: new TextDecoder().decode(bytes.slice(off + 12, e)), start, end });
    off = e + 1;
  }
  expect(off).toBe(34 + header.sectionsChunkLength);
  return { header, sections };
}

describe("extra.anim for the six chosen obstacles", () => {
  it("is a 72x14 bicycle1 file at fps 76 with a whole-file default section first", () => {
    const { header, sections } = readSections(buildExtraAnim().bytes);
    expect(header.signature).toBe("bicycle1");
    expect([header.width, header.height, header.fps]).toEqual([LAYER_W, LAYER_H, EXTRA_FPS]);
    expect(sections[0]).toEqual({ name: "default", start: 0, end: header.frameCount - 1 });
  });

  it("has a <t>_0 crossing of 73+w frames (like upstream's: s1 is 78 at w 5) and a one-frame still for every x in -w+1..71, for all six types", () => {
    const { bytes, entries } = buildExtraAnim();
    const { sections } = readSections(bytes);
    const byName = new Map(sections.map((s) => [s.name, s.end - s.start + 1]));
    expect(Object.keys(entries).sort()).toEqual(["gr", "sa", "sc", "sk", "sn", "to"]);
    for (const { type, art } of CHOSEN) {
      const w = spriteWidth(art);
      expect(byName.get(`${type}_0`)).toBe(LAYER_W + w + 1);
      expect(entries[type]!.frames).toEqual({ "0": LAYER_W + w + 1 });
      for (let x = -w + 1; x < LAYER_W; x++) expect(byName.get(`${type}@${x}`), `${type}@${x}`).toBe(1);
      expect(byName.has(`${type}@${-w}`)).toBe(false);
    }
    // Every section name fits the firmware's lookup buffer (the encoder enforces ≤ 7, so a build is proof).
    for (const s of sections) expect(s.name.length).toBeLessThanOrEqual(7);
    // A different pair still builds (the builder is not tied to the six).
    const two = readSections(buildExtraAnim([{ type: "tw", art: TUMBLEWEEDS[2]! }, { type: "rk", art: BOULDERS[1]! }]).bytes);
    expect(two.header.sectionCount).toBe(1 + 2 + (LAYER_W + spriteWidth(TUMBLEWEEDS[2]!) - 1) + (LAYER_W + spriteWidth(BOULDERS[1]!) - 1));
  });

  // Upstream's convention, which the game's obstX models: frame f has its left edge at
  // x = 72 - f, so frame 0 is just off the right edge. Drawing frame 0 at 71 put the
  // six extras a frame ahead of the model (2026-11-16).
  it("moves the sprite one pixel left per frame with its left edge at x = 72 - f, like upstream's obstacles", () => {
    const art = BOULDERS[0]!;
    const [crossing] = obstacleSections("rk", art);
    const alpha = (frame: Uint8Array, x: number, y: number) => frame[(y * LAYER_W + x) * 4 + 3];
    const bottom = 13; // the upstream cacti's bottom row: on the ground, not 1 px above it
    expect(crossing!.frames[0]!.every((b) => b === 0)).toBe(true); // x = 72: just off the right edge
    expect(alpha(crossing!.frames[1]!, 71, bottom)).toBe(255);
    expect(alpha(crossing!.frames[1]!, 70, bottom)).toBe(0);
    expect(alpha(crossing!.frames[11]!, 61, bottom)).toBe(255);
    expect(alpha(crossing!.frames[11]!, 60, bottom)).toBe(0);
    expect(crossing!.frames.at(-1)!.every((b) => b === 0)).toBe(true); // fully off the left edge
  });

  it("advances an animated obstacle one pose every four display frames and holds a static one", () => {
    const art = TUMBLEWEEDS[0]!;
    const [crossing] = obstacleSections("tw", art);
    const sameFrame = (a: Uint8Array, b: Uint8Array, dx: number) => { // b is a shifted left by dx
      for (let y = 0; y < LAYER_H; y++) for (let x = 0; x < LAYER_W - dx; x++) for (let k = 0; k < 4; k++) if (a[(y * LAYER_W + x + dx) * 4 + k] !== b[(y * LAYER_W + x) * 4 + k]) return false;
      return true;
    };
    expect(sameFrame(crossing!.frames[8]!, crossing!.frames[11]!, 3)).toBe(true);
    expect(sameFrame(crossing!.frames[8]!, crossing!.frames[12]!, 4)).toBe(false);
    const [skull] = obstacleSections("sk", KINDS[2]!);
    expect(sameFrame(skull!.frames[8]!, skull!.frames[12]!, 4)).toBe(true);
    const [snake] = obstacleSections("sn", KINDS[1]!);
    expect(sameFrame(snake!.frames[8]!, snake!.frames[12]!, 4)).toBe(false);
    expect(sameFrame(snake!.frames[8]!, snake!.frames[16]!, 8)).toBe(true);
  });
});
