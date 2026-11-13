import { describe, it, expect } from "bun:test";
import { CONTROL_PAGE_HTML, relativeUntil, PAGE_POLL_MS } from "./page.ts";

const T0 = Date.parse("2026-11-09T15:00:00.000Z");
const at = (min: number) => new Date(T0 + min * 60_000).toISOString();

describe("relativeUntil", () => {
  it("says how long until an instant in hours and minutes (Gavin 2026-11-09: not a clock time)", () => {
    expect(relativeUntil(at(70), T0)).toBe("in 1 hr 10 min");
    expect(relativeUntil(at(20), T0)).toBe("in 20 min");
    expect(relativeUntil(at(120), T0)).toBe("in 2 hr");
    expect(relativeUntil(at(60), T0)).toBe("in 1 hr");
    expect(relativeUntil(at(119.6), T0)).toBe("in 2 hr"); // rounds to the minute
  });

  it("handles the edges: under a minute, overdue, missing", () => {
    expect(relativeUntil(at(0.4), T0)).toBe("in under a minute");
    expect(relativeUntil(at(-5), T0)).toBe("any moment now");
    expect(relativeUntil("", T0)).toBe("");
    expect(relativeUntil("garbage", T0)).toBe("");
  });
});

describe("control page", () => {
  it("keeps itself current: polls the app list every 10 s and when the tab becomes visible (Gavin 2026-11-09: Pantheon showed a stale app)", () => {
    expect(PAGE_POLL_MS).toBe(10_000);
    expect(CONTROL_PAGE_HTML).toContain(`setInterval(`);
    expect(CONTROL_PAGE_HTML).toContain(String(PAGE_POLL_MS));
    expect(CONTROL_PAGE_HTML).toContain("visibilitychange");
  });

  it("surfaces a failed poll instead of keeping stale state (Gavin 2026-11-13: bar rebooted for a firmware update, page still said Fog Canyon on)", () => {
    // A quiet poll that fails must not be swallowed...
    expect(CONTROL_PAGE_HTML).not.toContain("if (!quiet) setError(");
    // ...it marks the bar unreachable: banner, every dot off, no toggle pressed.
    expect(CONTROL_PAGE_HTML).toContain("function markUnreachable(");
    expect(CONTROL_PAGE_HTML).toContain("'Bar unreachable: ' + err.message");
    expect(CONTROL_PAGE_HTML).toMatch(/function markUnreachable\([\s\S]*?classList\.remove\('on'\)[\s\S]*?aria-pressed', 'false'[\s\S]*?\n  \}/);
    // A command in flight still wins over a quiet poll's failure.
    expect(CONTROL_PAGE_HTML).toMatch(/\.catch\(function \(err\) \{ if \(quiet && inflight\) return; markUnreachable\(/);
  });

  it("shows the next shuffle change as a countdown, with the formatter shipped into the page", () => {
    expect(CONTROL_PAGE_HTML).toContain("'next change ' + relativeUntil(");
    expect(CONTROL_PAGE_HTML).toContain("function relativeUntil(");
  });
});
