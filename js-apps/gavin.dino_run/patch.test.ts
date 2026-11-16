// patch.py turns the upstream Dino Run into a self-running animation. Gavin
// (2026-11-16) saw the run "speeding up": the obstacle pool used to progress
// level by level (birds, triple cacti), so the action got frantic. The patched
// script must stay at the opening tier for the whole run — no speed-up, no
// pool progression.
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

describe("patch.py keeps Dino Run at the opening tier for the whole run", () => {
  const js = patched();
  test("spawn always picks from the opening tier's pool", () => {
    expect(js).toContain("var pool = POOL[0]");
    expect(js).not.toContain("POOL[tier]");
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
