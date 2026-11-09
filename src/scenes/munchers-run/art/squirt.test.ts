import { describe, it, expect } from "bun:test";
import { SQUIRT } from "./squirt.ts";

// Gavin's pick after five line-up rounds on the bar (2026-11-09): round 9x6
// body, navy outline, face shifted forward, 2 px mouth, grey ground shadow.
describe("SQUIRT art", () => {
  const W = SQUIRT.frames[0]![0]!.length, H = SQUIRT.frames[0]!.length;

  it("hops through rest → squash → rest → stretch in one fixed 12x9 box", () => {
    expect(SQUIRT.frames).toHaveLength(4);
    expect([W, H]).toEqual([12, 9]);
    for (const f of SQUIRT.frames) { expect(f).toHaveLength(H); for (const r of f) expect(r).toHaveLength(W); }
    expect(SQUIRT.frames[0]).toEqual(SQUIRT.frames[2]);
    expect(SQUIRT.frames[1]).not.toEqual(SQUIRT.frames[0]);
    expect(SQUIRT.frames[3]).not.toEqual(SQUIRT.frames[0]);
    expect(SQUIRT.frames[3]).not.toEqual(SQUIRT.frames[1]);
  });

  it("casts a grey shadow on the bottom row and lifts clear of it on the stretch", () => {
    for (const f of SQUIRT.frames) expect(f[H - 1]!.replace(/\./g, "")).toMatch(/^X+$/);
    expect(SQUIRT.frames[3]![H - 2]!).toBe(".".repeat(W)); // airborne gap
    expect(SQUIRT.frames[1]![H - 2]!).not.toBe(".".repeat(W)); // squash sits on the shadow
  });

  it("keeps the small mouth and the forward-facing eyes every frame", () => {
    for (const f of SQUIRT.frames) {
      const flat = f.join("");
      expect(flat.split("R").length - 1).toBe(2);
      expect(flat.split("K").length - 1).toBe(2);
      // the eyes sit in the right half of the body
      const eyeRow = f.find((r) => r.includes("K"))!;
      expect(eyeRow.indexOf("K")).toBeGreaterThan(W / 2 - 1);
    }
    expect(SQUIRT.colors.X).toBeDefined();
    expect(SQUIRT.colors.O).toBe("#1D235D");
  });
});
