import { describe, it, expect } from "bun:test";
import { SAMUS, SAMUS_POSE_RATE } from "./art.ts";

// Gavin's pick after fifteen line-up rounds on the bar (2026-11-09).
describe("SAMUS art", () => {
  const w = SAMUS.frames[0]![0]!.length, h = SAMUS.frames[0]!.length;

  it("is a 9x10 profile runner: red helmet with a lime visor, orange shoulder and legs, yellow belly, teal cannon leading", () => {
    expect([w, h]).toEqual([9, 10]);
    for (const f of SAMUS.frames) { expect(f).toHaveLength(h); for (const r of f) expect(r).toHaveLength(w); }
    const torso = SAMUS.frames[0]!.slice(0, 7).join("/");
    for (const f of SAMUS.frames) expect(f.slice(0, 7).join("/")).toBe(torso); // torso never moves (no bob); the hip row below carries the soft pixel
    expect(SAMUS.frames[0]![1]).toBe("...RRR...");
    expect(SAMUS.frames[0]![2]).toBe("..RRGGG..");
    expect(SAMUS.frames[0]![5]).toBe(".OOYYOCCC"); // cannon on the leading side
    expect(SAMUS.frames[0]![6]).toBe("..OYY..CC"); // narrow belly
  });

  it("runs on four key frames at 8 poses/s: contact, pass, contact, pass, near leg bright and far leg dark", () => {
    expect(SAMUS.frames).toHaveLength(4);
    expect(SAMUS_POSE_RATE).toBe(8);
    const [c1, p1, c2, p2] = SAMUS.frames as [string[], string[], string[], string[]];
    expect(c1[8]).toBe("DD.NN...."); expect(c2[8]).toBe("NN.DD....");
    expect(p1[8]).toBe(".DNN....."); expect(p2[8]).toBe(".NDD.....");
    expect(SAMUS.colors.N).not.toBe(SAMUS.colors.D);
  });

  it("has the soft hip pixel on the contact frames and the soft heel on the passes, nothing solid at the hip", () => {
    const [c1, p1, c2, p2] = SAMUS.frames as [string[], string[], string[], string[]];
    expect(c1[7]).toBe("..OYYs..."); expect(c2[7]).toBe("..OYYs...");
    expect(p1[7]).toBe("..OYY...."); expect(p2[7]).toBe("..OYY....");
    expect(p1[9]).toBe(".DNNs...."); expect(p2[9]).toBe(".NDDs....");
    expect(SAMUS.colors.s).toBe("#7A4818");
  });
});
