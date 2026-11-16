// patch.py turns the upstream Dino Run into a self-running animation. Gavin
// (2026-11-16) saw the run "speeding up": the obstacle pool used to progress
// level by level (birds, triple cacti), so the action got frantic. The patched
// script must use ONE fixed pool for the whole run — no speed-up, no pool
// progression — and that pool includes birds from the start ("I would like to
// see birds", Gavin 2026-11-16).
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = import.meta.dir;
const upstream = join(here, "build", "src", "community.dino_run");

/** The six hand-drawn obstacles: build-extra-anim.ts writes anims/extra.anim + obst.json into a dir patch.py takes as argv[3]. */
function builtExtra(): string {
  const extra = mkdtempSync(join(tmpdir(), "dino-extra-"));
  const r = spawnSync("bun", ["run", "build-extra-anim.ts", extra], { cwd: here, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`build-extra-anim.ts failed: ${r.stdout}${r.stderr}`);
  return extra;
}
let outDir = "";
function patched(): string {
  if (!existsSync(upstream)) throw new Error(`${upstream} is missing — run ./build.sh first to download and unpack the upstream release`);
  if (outDir) return readFileSync(join(outDir, "gavin.dino_run", "scripts", "main.js"), "utf8");
  const out = mkdtempSync(join(tmpdir(), "dino-patch-"));
  const r = spawnSync("python3", ["-I", "patch.py", join(here, "build", "src"), out, builtExtra()], { cwd: here, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`patch.py failed: ${r.stdout}${r.stderr}`);
  outDir = out;
  return readFileSync(join(out, "gavin.dino_run", "scripts", "main.js"), "utf8");
}
const EXTRA_TYPES = ["sk", "gr", "sa", "sn", "sc", "to"];

describe("patch.py gives Dino Run one fixed obstacle pool for the whole run", () => {
  const js = patched();
  test("spawn always picks from the fixed MIX pool", () => {
    expect(js).toContain("var pool = MIX");
    expect(js).not.toContain("POOL[tier]");
    expect(js).not.toContain("POOL[0]");
  });
  test("MIX has the low and high birds from the start, no mid bird (looked weird) and no l3 (no tier-0 frames)", () => {
    const m = js.match(/var MIX = (\[[^\]]*\]);/);
    expect(m).not.toBeNull();
    const mix = JSON.parse(m![1]!) as string[];
    expect(mix).toContain("bl");
    expect(mix).not.toContain("bm");
    expect(mix).toContain("bh");
    expect(mix).not.toContain("l3");
    const cacti = mix.filter((t) => /^[sl]\d$/.test(t)).length;
    expect(cacti).toBeGreaterThan(mix.filter((t) => t.startsWith("b")).length);
    // Gavin's six picks (2026-11-16) are all dealt, and the cacti still outnumber them.
    for (const t of EXTRA_TYPES) expect(mix).toContain(t);
    expect(cacti).toBeGreaterThan(mix.filter((t) => EXTRA_TYPES.includes(t)).length);
  });
  test("has no level progression at all", () => {
    expect(js).not.toMatch(/\blevel\b/);
    expect(js).not.toContain("level++");
  });
  test("never schedules a speed tier", () => {
    expect(js).not.toContain("scheduleTier(now, tier + 1)");
  });
  test("never gates anything on TIER_AT", () => {
    expect(js).not.toContain("score >= TIER_AT[");
  });
});

// Gavin (2026-11-16): "the dino is still hitting obstacles". Telemetry from the bar
// showed 22 of 26 double large cacti (l2) ending in a stumble while every other type
// was clean: the autopilot re-simulated three jumps per 10 ms tick, JerryScript took
// ~30 ms per simulation, and the decision landed 4-8 frames after l2's 7-frame window
// had opened. A first fix that planned each obstacle with a few probes per tick was
// slower still (jumps 7-14 frames late, 73 stumbles in 5 min). So the simulation
// leaves the bar: patch.py bakes each type's safe jump-start window into the script
// and the runtime only looks it up and jumps at its CENTRE. F is calibrated to
// fw 1.4.1 (18.81 ms/frame, measured three ways).
describe("patch.py bakes the jump windows so the autopilot never simulates at runtime", () => {
  const js = patched();
  test("the frame period is calibrated to fw 1.4.1", () => {
    expect(js).toContain("var F = 18.81;");
    expect(js).not.toContain("var F = 16.03;");
  });
  function table(): Record<string, [number, number]> {
    const m = js.match(/var WINDOW = (\{[^;]*\});/);
    expect(m).not.toBeNull();
    return JSON.parse(m![1]!);
  }
  test("a WINDOW table of safe jump-start frames covers every jumpable type in the mix, and the high bird is run under", () => {
    const w = table();
    for (const t of ["s1", "s2", "s3", "l1", "l2", "bl", ...EXTRA_TYPES]) expect(w[t], t).toBeDefined();
    expect(w["bh"]).toBeUndefined();
    expect(js).toMatch(/var RUN_SAFE = \{[^;]*"bh":true[^;]*\};/);
  });

  // Run the real script with stubs: spawn one obstacle, let planStep assign its plan.
  function game() {
    const body = js.replace(/startGame\(Date\.now\(\)\);\ntick\(\);\s*$/, "");
    const stubs: Record<string, unknown> = {
      fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
      Request: class { constructor(public u: string, public o: unknown) {} },
      listen: () => () => {}, localStorage: { getItem: () => null, setItem: () => {} },
      setTimeout: () => 0, setInterval: () => 0, Date, Math, JSON, String, console,
    };
    const tail = `
      return {
        F: F, EXPECT: EXPECT, JUMP_MS: JUMP_MS,
        spawnAt: function (type, anchor) { var m = D.OBST[type]; var o = { id: "o1", type: type, s: 1, w: m.w, ys: m.ys, ms: m.ms, life: m.frames[0], anchor: anchor }; obstacles = [o]; dinoMode = "run"; queued = "run"; duckHeld = false; jumpAnchor = 0; duckAnchor = 0; near.length = 0; return o; },
        planStep: function (now) { planStep(now); },
        autopilot: function (now) { autopilot(now); },
        wouldHit: function (mode, anchor, from, to) { return wouldHit(mode, anchor, from, to); },
        mode: function () { return dinoMode; },
      };`;
    return new Function(...Object.keys(stubs), body + tail)(...Object.values(stubs));
  }
  function planned(type: string) {
    const g = game(); const anchor = 1e6; const o = g.spawnAt(type, anchor);
    g.planStep(anchor);
    return { g, o, anchor };
  }
  test("the baked windows agree with the game's own collision model (inside clears, 2 frames outside hits)", () => {
    const g = game(); const anchor = 1e6;
    for (const [type, [a, b]] of Object.entries(table())) {
      g.spawnAt(type, anchor);
      const probe = (j: number) => g.wouldHit("jump", anchor + j * g.F, anchor + (j - 4) * g.F, anchor + (j + 42) * g.F);
      for (let j = a; j <= b; j++) expect([type, j, probe(j)]).toEqual([type, j, false]);
      expect([type, "before", probe(a - 2)]).toEqual([type, "before", true]);
      expect([type, "after", probe(b + 2)]).toEqual([type, "after", true]);
    }
  });
  test("plans a jump centred in the window with 2+ frames of slack each side for the narrow-window cacti (l2, s3) and the six extras", () => {
    for (const type of ["l2", "s3", ...EXTRA_TYPES]) {
      const { g, o, anchor } = planned(type);
      expect(o.plan).toBe("done");
      expect(o.action).toBe("jump");
      const [a, b] = table()[type]!;
      const start = o.fdTarget + g.EXPECT / g.F;        // decision frame + request latency = jump start
      expect(start - a).toBeGreaterThanOrEqual(2);
      expect(b - start).toBeGreaterThanOrEqual(2);
      for (const d of [-2, 0, 2]) {
        const tDec = anchor + (o.fdTarget + d) * g.F;
        expect(g.wouldHit("jump", tDec + g.EXPECT, tDec, tDec + g.JUMP_MS + 6 * g.F)).toBe(false);
      }
    }
  });
  test("plans no move for the high bird, which the dino runs under", () => {
    const { o } = planned("bh");
    expect(o.plan).toBe("done");
    expect(o.action).toBe("none");
  });
  test("planning is a table lookup: one planStep call finishes the plan, no simulation", () => {
    const { o } = planned("l2");
    expect(o.plan).toBe("done");
    expect(js).not.toContain("PROBES_PER_TICK");
  });
  test("the autopilot jumps at the planned frame and not before", () => {
    const { g, o, anchor } = planned("l2");
    g.autopilot(anchor + (o.fdTarget - 3) * g.F);
    expect(g.mode()).toBe("run");
    g.autopilot(anchor + o.fdTarget * g.F);
    expect(g.mode()).toBe("jump");
  });
});

// Gavin's six picks from the obstacle line-ups (2026-11-16): skull, granite,
// sandstone, snake, scorpion, tortoise, hand-drawn in art/obstacles.ts and
// baked into anims/extra.anim by build-extra-anim.ts. patch.py registers them
// in D.OBST (collision masks), draws them from the extra file and deals them.
describe("patch.py wires the six hand-drawn obstacles in anims/extra.anim", () => {
  const js = patched();
  test("D.OBST carries an entry per type with the baked collision mask and tier-0 frame count", () => {
    const m = js.match(/^var D = (\{.*\});$/m);
    expect(m).not.toBeNull();
    const D = JSON.parse(m![1]!) as { OBST: Record<string, { w: number; top: number; hit: number[]; frames: Record<string, number> }> };
    for (const t of EXTRA_TYPES) {
      const o = D.OBST[t]!;
      expect(o, t).toBeDefined();
      expect(o.frames["0"]).toBe(72 + o.w);
      expect(o.hit.length).toBe(13 - o.top);         // bottom row on 12, like the cacti
      expect(o.w).toBeLessThanOrEqual(11);
    }
  });
  test("obstacle elements for those types point at anims/extra.anim; cacti and birds keep obst.anim", () => {
    expect(js).toMatch(/function obst\(o, sec, loop\) \{ return anim\(o\.id, EXTRA\[o\.type\] \? "extra" : "obst"/);
    expect(js).toMatch(/var EXTRA = \{"sk":true,"gr":true,"sa":true,"sn":true,"sc":true,"to":true\};/);
  });
  test("the package ships anims/extra.anim with a crossing section and stills for every type", () => {
    const bytes = readFileSync(join(outDir, "gavin.dino_run", "anims", "extra.anim"));
    expect(bytes.subarray(0, 8).toString()).toBe("bicycle1");
    const text = bytes.subarray(0, 60000).toString("latin1");
    for (const t of EXTRA_TYPES) {
      expect(text).toContain(`${t}_0\0`);
      expect(text).toContain(`${t}@0\0`);
      expect(text).toContain(`${t}@71\0`);
    }
  });
});
