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

function patched(): string {
  if (!existsSync(upstream)) throw new Error(`${upstream} is missing — run ./build.sh first to download and unpack the upstream release`);
  const out = mkdtempSync(join(tmpdir(), "dino-patch-"));
  const r = spawnSync("python3", ["-I", "patch.py", join(here, "build", "src"), out], { cwd: here, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`patch.py failed: ${r.stdout}${r.stderr}`);
  return readFileSync(join(out, "gavin.dino_run", "scripts", "main.js"), "utf8");
}

describe("patch.py gives Dino Run one fixed obstacle pool for the whole run", () => {
  const js = patched();
  test("spawn always picks from the fixed MIX pool", () => {
    expect(js).toContain("var pool = MIX");
    expect(js).not.toContain("POOL[tier]");
    expect(js).not.toContain("POOL[0]");
  });
  test("MIX has every bird from the start and no l3 (it has no tier-0 frames)", () => {
    const m = js.match(/var MIX = (\[[^\]]*\]);/);
    expect(m).not.toBeNull();
    const mix = JSON.parse(m![1]!) as string[];
    expect(mix).toContain("bl");
    expect(mix).toContain("bm");
    expect(mix).toContain("bh");
    expect(mix).not.toContain("l3");
    expect(mix.filter((t) => t.startsWith("s")).length).toBeGreaterThan(mix.filter((t) => t.startsWith("b")).length);
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
