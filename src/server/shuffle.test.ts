import { describe, it, expect } from "bun:test";
import { advanceShuffle, adoptShowing, shuffleDeck, SHUFFLE_INTERVAL_MS, type ShuffleState } from "./shuffle.ts";

const IDS = ["nyan_cat", "lava_lamp", "matrix_rain", "aquarium"];
const seq = (...values: number[]) => { let i = 0; return () => values[Math.min(i++, values.length - 1)]!; };
const NOW = new Date("2026-11-08T22:00:00.000Z");

describe("shuffleDeck", () => {
  it("is a permutation of the ids driven only by the random source", () => {
    const a = shuffleDeck(IDS, seq(0.1, 0.7, 0.3));
    expect([...a].sort()).toEqual([...IDS].sort());
    expect(shuffleDeck(IDS, seq(0.1, 0.7, 0.3))).toEqual(a);
    expect(shuffleDeck(IDS, seq(0.9, 0.2, 0.6))).not.toEqual(a);
  });
});

describe("advanceShuffle", () => {
  it("interval is two hours", () => {
    expect(SHUFFLE_INTERVAL_MS).toBe(2 * 60 * 60 * 1000);
  });

  it("starts a round by dealing a shuffled deck, shows the first card and books the next change two hours out", () => {
    const s = advanceShuffle(null, IDS, NOW, seq(0.5));
    expect(IDS).toContain(s.showing);
    expect(s.deck).toHaveLength(IDS.length - 1);
    expect(s.deck).not.toContain(s.showing);
    expect(s.nextAt).toBe("2026-11-09T00:00:00.000Z");
  });

  it("never repeats an animation until every one has been shown, then deals a fresh round", () => {
    let s: ShuffleState | null = null;
    const shown: string[] = [];
    const random = seq(0.3, 0.8, 0.1, 0.6, 0.9, 0.2, 0.7, 0.4, 0.5);
    for (let i = 0; i < IDS.length * 3; i++) {
      s = advanceShuffle(s, IDS, new Date(NOW.getTime() + i * SHUFFLE_INTERVAL_MS), random);
      shown.push(s.showing);
    }
    for (let r = 0; r < 3; r++) expect([...shown.slice(r * IDS.length, (r + 1) * IDS.length)].sort()).toEqual([...IDS].sort());
    // Rounds never butt the same animation up against itself.
    for (let i = 1; i < shown.length; i++) expect(shown[i]).not.toBe(shown[i - 1]);
  });

  it("drops cards for animations that no longer exist and picks up new ones on the next round", () => {
    const s1: ShuffleState = { deck: ["gone", "aquarium"], showing: "nyan_cat", nextAt: NOW.toISOString() };
    const s2 = advanceShuffle(s1, IDS, NOW, seq(0.5));
    expect(s2.showing).toBe("aquarium");
    expect(s2.deck).toEqual([]);
    const s3 = advanceShuffle(s2, [...IDS, "new_scene"], NOW, seq(0.5));
    expect([s3.showing, ...s3.deck].sort()).toEqual([...IDS, "new_scene"].sort());
  });

  it("adoptShowing makes a hand-picked animation the current card: dealt out of the deck, clock restarted", () => {
    const fresh = adoptShowing(null, "lava_lamp", IDS, NOW, seq(0.5));
    expect(fresh.showing).toBe("lava_lamp");
    expect([...fresh.deck].sort()).toEqual(IDS.filter((i) => i !== "lava_lamp").sort());
    expect(fresh.nextAt).toBe("2026-11-09T00:00:00.000Z");
    const mid: ShuffleState = { deck: ["aquarium", "matrix_rain"], showing: "nyan_cat", nextAt: NOW.toISOString() };
    const picked = adoptShowing(mid, "aquarium", IDS, NOW, seq(0.5));
    expect(picked).toEqual({ deck: ["matrix_rain"], showing: "aquarium", nextAt: "2026-11-09T00:00:00.000Z" });
  });
});
