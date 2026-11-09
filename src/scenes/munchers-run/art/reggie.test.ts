import { describe, it, expect } from "bun:test";
import { REGGIE } from "./reggie.ts";

// Gavin's pick after four line-up rounds on the bar (2026-11-09): 12x10, no
// outline, open pink shell tucked over the neck, dark eye, two antennae, and
// a head bob for the walk (head and antennae drop a row every other step).
describe("REGGIE art", () => {
  it("is a 12x10 outline-free snail: pinks and creams only, eye and antennae dark", () => {
    for (const f of REGGIE.frames) { expect(f).toHaveLength(10); for (const r of f) expect(r).toHaveLength(12); }
    const letters = new Set(REGGIE.frames.flat().join("").replace(/\./g, ""));
    expect([...letters].sort()).toEqual(["D", "E", "K", "P", "T", "U"]);
    expect(REGGIE.colors.K).toBe("#3A1A33"); // antennae only, no outline rows
    for (const f of REGGIE.frames) expect(f.filter((r) => r.includes("K"))).toHaveLength(1);
  });

  it("walks with a head bob: the head drops one row on the second frame while the shell stays put", () => {
    expect(REGGIE.frames).toHaveLength(2);
    const [a, b] = REGGIE.frames as [string[], string[]];
    const headCol = (f: string[]) => f.map((r) => r.slice(10)); // the shell shares column 9 with the neck
    expect(headCol(b).slice(1, 9)).toEqual(headCol(a).slice(0, 8));
    expect(a.map((r) => r.slice(0, 9)).slice(2, 9)).toEqual(b.map((r) => r.slice(0, 9)).slice(2, 9));
    expect(a[2]!.indexOf("E")).toBe(10);
    expect(b[3]!.indexOf("E")).toBe(10);
  });
});
