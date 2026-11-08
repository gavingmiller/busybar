import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler, type ServerDeps } from "./index.ts";

const BASE_URL = "http://10.0.4.20";

let tmp: string;
let stateFile: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "busybar-server-"));
  stateFile = join(tmp, "nested", "state.json");
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function deps(overrides: Partial<ServerDeps> = {}): ServerDeps {
  return {
    baseUrl: BASE_URL,
    stateFile,
    fetchImpl: mock(async () => new Response("{}")) as unknown as typeof fetch,
    runRainbow: mock(async () => {}),
    clearAllDisplays: mock(async () => {}),
    now: () => new Date("2026-11-08T15:00:00.000Z"),
    ...overrides,
  };
}

const req = (path: string, init?: RequestInit) => new Request(`http://127.0.0.1:7495${path}`, init);
const post = (body: unknown) =>
  req("/api/nyan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("GET /", () => {
  it("serves the self-contained control page", async () => {
    const res = await createHandler(deps())(req("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("<title>BUSY Bar</title>");
    expect(html).toContain("Nyan Cat");
    expect(html).toContain("busy-pulse");
    expect(html).toContain("prefers-reduced-motion");
    expect(html).toContain("navigator.userAgent");
    expect(html).toContain("Pantheon");
    expect(html).toContain("prefers-color-scheme");
    expect(html).toContain("America/Regina");
    expect(html).toMatch(/Light.*Dark.*System/s);
  });
});

describe("GET /api/nyan", () => {
  it("reports unknown when nothing has been sent yet", async () => {
    const res = await createHandler(deps())(req("/api/nyan"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: "unknown", changedAt: null });
  });
});

describe("POST /api/nyan", () => {
  it("on draws the rainbow scene against the device and persists the state", async () => {
    const d = deps();
    const handler = createHandler(d);
    const res = await handler(post({ on: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: "on", changedAt: "2026-11-08T15:00:00.000Z" });
    expect(d.runRainbow).toHaveBeenCalledTimes(1);
    expect((d.runRainbow as ReturnType<typeof mock>).mock.calls[0]![0]).toBe(BASE_URL);
    expect(d.clearAllDisplays).not.toHaveBeenCalled();
    expect(existsSync(stateFile)).toBe(true);
    expect(JSON.parse(readFileSync(stateFile, "utf8"))).toEqual({
      state: "on",
      changedAt: "2026-11-08T15:00:00.000Z",
    });
  });

  it("off clears every display and persists the state", async () => {
    const d = deps();
    const handler = createHandler(d);
    const res = await handler(post({ on: false }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: "off", changedAt: "2026-11-08T15:00:00.000Z" });
    expect(d.clearAllDisplays).toHaveBeenCalledTimes(1);
    expect((d.clearAllDisplays as ReturnType<typeof mock>).mock.calls[0]![0]).toBe(BASE_URL);
    expect(d.runRainbow).not.toHaveBeenCalled();
  });

  it("state survives a fresh handler (read back from the file, not memory)", async () => {
    const d = deps();
    await createHandler(d)(post({ on: true }));
    const res = await createHandler(deps())(req("/api/nyan"));
    expect(await res.json()).toEqual({ state: "on", changedAt: "2026-11-08T15:00:00.000Z" });
  });

  it("a device failure responds 502 and leaves the state untouched", async () => {
    const d = deps();
    const handler = createHandler(d);
    await handler(post({ on: true }));

    const failing = deps({
      clearAllDisplays: mock(async () => {
        throw new Error("BUSY Bar rejected clear request: 508 Resource Limit Reached");
      }),
    });
    const res = await createHandler(failing)(post({ on: false }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("508");

    const state = await createHandler(deps())(req("/api/nyan"));
    expect(await state.json()).toEqual({ state: "on", changedAt: "2026-11-08T15:00:00.000Z" });
  });

  it("rejects a body without a boolean `on` with 400", async () => {
    const handler = createHandler(deps());
    expect((await handler(post({ on: "yes" }))).status).toBe(400);
    expect((await handler(post("{ nope"))).status).toBe(400);
    expect((await handler(post({}))).status).toBe(400);
  });
});

describe("unknown routes", () => {
  it("404 as JSON", async () => {
    const res = await createHandler(deps())(req("/nope"));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
