import { describe, it, expect } from "bun:test";
import { BONEHEAD } from "./bonehead.ts";

// Gavin's picks from the bar line-up (2026-11-09): walk = round-3 pick 1
// (taller body, near-black sockets, one swinging arm); dance = picks 4 and 5
// (head bob on the step, both arms swinging) as a separate pose set.
describe("BONEHEAD art", () => {
  const w = BONEHEAD.frames[0]![0]!.length, h = BONEHEAD.frames[0]!.length;

  it("walks with near-black sockets and one arm swinging forward then back", () => {
    expect(BONEHEAD.frames).toHaveLength(2);
    expect(BONEHEAD.colors.E).toMatch(/^#1/);
    for (const f of BONEHEAD.frames) expect(f.join("")).toContain("EE");
    const armRow = (f: readonly string[]) => f.findIndex((r, y) => y >= 6 && /W.?$/.test(r.replace(/\.+$/, "")) && r.trimEnd().endsWith("W"));
    expect(BONEHEAD.frames[0]![7]!.endsWith("W.")).toBe(true); // arm forward
    expect(BONEHEAD.frames[1]![7]!.startsWith(".W")).toBe(true); // arm back
    expect(armRow).toBeDefined();
  });

  it("has a dance: same box as the walk, head bobbing and both arms out, no frame shared with the walk", () => {
    const dance = BONEHEAD.dance!;
    expect(dance.length).toBeGreaterThanOrEqual(4);
    const walk = new Set(BONEHEAD.frames.map((f) => f.join("/")));
    let bobbed = 0, bothArms = 0;
    for (const f of dance) {
      expect(f).toHaveLength(h);
      for (const r of f) expect(r).toHaveLength(w);
      expect(walk.has(f.join("/"))).toBe(false);
      if (f[0] === ".".repeat(w)) bobbed++; // skull dropped a row
      if (f.some((r) => r.startsWith(".W") && r.endsWith("W."))) bothArms++;
    }
    expect(bobbed).toBeGreaterThanOrEqual(2);
    expect(bothArms).toBeGreaterThanOrEqual(2);
  });
});
