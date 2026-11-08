import { describe, it, expect } from "bun:test";
import { SCENES } from "./index.ts";

describe("SCENES registry", () => {
  it("every scene has a unique snake_case id, a Title Case name and a playable fps", () => {
    const ids = SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SCENES) {
      expect(s.id).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(s.name).toMatch(/^([A-Z][a-z0-9]*)( [A-Z][a-z0-9]*)*$/);
      expect(s.fps).toBeGreaterThanOrEqual(24);
      expect(s.fps).toBeLessThanOrEqual(48);
      expect(s.id).not.toBe("nyan_cat");
    }
  });
});
