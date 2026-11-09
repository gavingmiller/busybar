import { describe, it, expect } from "bun:test";
import { SQUIRT } from "./squirt.ts";

// Gavin's pick after five line-up rounds on the bar (2026-11-09): round 9x6
// body, navy outline, face shifted forward, 2 px mouth, grey ground shadow.
describe("SQUIRT art", () => {
  const W = SQUIRT.frames[0]![0]!.length, H = SQUIRT.frames[0]!.length;

  it("hops big: rest → squash → launch → apex → fall, five distinct poses in one fixed 12x12 box (Gavin 2026-11-09: 'make the jump bigger')", () => {
    expect(SQUIRT.frames).toHaveLength(5);
    expect([W, H]).toEqual([12, 12]);
    for (const f of SQUIRT.frames) { expect(f).toHaveLength(H); for (const r of f) expect(r).toHaveLength(W); }
    expect(new Set(SQUIRT.frames.map((f) => f.join("/"))).size).toBe(5);
  });

  it("casts a shadow on the bottom row that shrinks as he rises; the apex clears the ground by at least three rows", () => {
    const shadowW = (f: readonly string[]) => f[H - 1]!.replace(/\./g, "").length;
    const air = (f: readonly string[]) => { let n = 0; for (let y = H - 2; y >= 0 && f[y] === ".".repeat(W); y--) n++; return n; };
    for (const f of SQUIRT.frames) expect(f[H - 1]!.replace(/\./g, "")).toMatch(/^X+$/);
    const [rest, squash, launch, apex, fall] = SQUIRT.frames as [string[], string[], string[], string[], string[]];
    expect(air(rest)).toBe(0);
    expect(air(squash)).toBe(0);
    expect(air(launch)).toBeGreaterThanOrEqual(1);
    expect(air(apex)).toBeGreaterThanOrEqual(3);
    expect(air(fall)).toBeGreaterThanOrEqual(1);
    expect(shadowW(squash)).toBeGreaterThan(shadowW(rest));
    expect(shadowW(rest)).toBeGreaterThan(shadowW(launch));
    expect(shadowW(launch)).toBeGreaterThan(shadowW(apex));
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
