import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler, NYAN_ID, type ServerDeps } from "./index.ts";
import { SHUFFLE_INTERVAL_MS } from "./shuffle.ts";

const BASE_URL = "http://10.0.4.20";
const DEVICE_APPS = [
  { id: "app.busy.clock", name: "Clock", version: "0.6.1", is_debug: false },
  { id: "community.dino_run", name: "Dino Run", version: "1.0.0", is_debug: false },
];

let tmp: string;
let stateFile: string;

beforeEach(() => {
  timers = [];
  cancelled = [];
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
    listApps: mock(async () => DEVICE_APPS),
    launchApp: mock(async () => {}),
    quitApp: mock(async () => {}),
    startPan: mock(() => ({ stop: panStop })),
    scenes: [
      { id: "lava_lamp", name: "Lava Lamp", run: mock(async () => {}) },
      { id: "aquarium", name: "Aquarium", run: mock(async () => {}) },
    ],
    now: () => new Date("2026-11-08T15:00:00.000Z"),
    random: () => 0.5,
    schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    cancel: (id) => { cancelled.push(id); },
    ...overrides,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const calls = (fn: unknown) => (fn as ReturnType<typeof mock>).mock.calls;
let panStop = mock(() => {});
let timers: Array<{ fn: () => void; ms: number }> = [];
let cancelled: unknown[] = [];
const req = (path: string, init?: RequestInit) => new Request(`http://127.0.0.1:7495${path}`, init);
const post = (id: string, body: unknown) =>
  req(`/api/apps/${id}`, {
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
    expect(html).toContain("busy-pulse");
    expect(html).toContain("prefers-reduced-motion");
    expect(html).toContain("navigator.userAgent");
    expect(html).toContain("Pantheon");
    expect(html).toContain("prefers-color-scheme");
    expect(html).toContain("America/Regina");
    expect(html).toMatch(/Light.*Dark.*System/s);
    expect(html).toContain("/api/shuffle");
    expect(html).toContain("nextChangeAt");
  });
});

describe("GET /api/apps", () => {
  it("lists Nyan Cat first, then the device's installed JS apps, all unknown before any command", async () => {
    const res = await createHandler(deps())(req("/api/apps"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      changedAt: null,
      shuffle: { on: false },
      apps: [
        { id: NYAN_ID, name: "Nyan Cat", kind: "draw", state: "unknown" },
        { id: "lava_lamp", name: "Lava Lamp", kind: "draw", state: "unknown" },
        { id: "aquarium", name: "Aquarium", kind: "draw", state: "unknown" },
        { id: "app.busy.clock", name: "Clock", kind: "js", state: "unknown" },
        { id: "community.dino_run", name: "Dino Run", kind: "js", state: "unknown" },
      ],
    });
  });

  it("answers 502 when the device cannot list its apps", async () => {
    const d = deps({ listApps: mock(async () => { throw new Error("fetch failed"); }) });
    const res = await createHandler(d)(req("/api/apps"));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("fetch failed");
  });
});

describe("POST /api/apps/:id", () => {
  it("turning Nyan Cat on quits any JS app, draws the scene, and marks only Nyan Cat on", async () => {
    const d = deps();
    const handler = createHandler(d);
    const res = await handler(post(NYAN_ID, { on: true }));
    expect(res.status).toBe(200);
    expect(d.quitApp).toHaveBeenCalledTimes(1);
    expect(d.runRainbow).toHaveBeenCalledTimes(1);
    expect(calls(d.runRainbow)[0]![0]).toBe(BASE_URL);
    expect(d.launchApp).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.changedAt).toBe("2026-11-08T15:00:00.000Z");
    expect(body.apps.map((a: { id: string; state: string }) => [a.id, a.state])).toEqual([
      [NYAN_ID, "on"],
      ["lava_lamp", "off"],
      ["aquarium", "off"],
      ["app.busy.clock", "off"],
      ["community.dino_run", "off"],
    ]);
    expect(existsSync(stateFile)).toBe(true);
    expect(JSON.parse(readFileSync(stateFile, "utf8"))).toEqual({
      active: NYAN_ID,
      changedAt: "2026-11-08T15:00:00.000Z",
    });
  });

  it("turning a JS app on quits the running app, clears every draw, then launches it", async () => {
    const order: string[] = [];
    const d = deps({
      quitApp: mock(async () => { order.push("quit"); }),
      clearAllDisplays: mock(async () => { order.push("clear"); }),
      launchApp: mock(async (_b: string, id: string) => { order.push(`launch:${id}`); }),
    });
    const res = await createHandler(d)(post("community.dino_run", { on: true }));
    expect(res.status).toBe(200);
    expect(order).toEqual(["quit", "clear", "launch:community.dino_run"]);
    expect(calls(d.launchApp)[0]![0]).toBe(BASE_URL);
    expect(d.runRainbow).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.apps.find((a: { id: string }) => a.id === "community.dino_run").state).toBe("on");
    expect(body.apps.find((a: { id: string }) => a.id === NYAN_ID).state).toBe("off");
  });

  it("turning a JS app off quits it and leaves nothing active", async () => {
    const d = deps();
    const handler = createHandler(d);
    await handler(post("community.dino_run", { on: true }));
    const res = await handler(post("community.dino_run", { on: false }));
    expect(res.status).toBe(200);
    expect(d.quitApp).toHaveBeenCalledTimes(2);
    const body = await res.json();
    expect(body.apps.every((a: { state: string }) => a.state === "off")).toBe(true);
    expect(JSON.parse(readFileSync(stateFile, "utf8"))).toEqual({
      active: null,
      changedAt: "2026-11-08T15:00:00.000Z",
    });
  });

  it("turning Nyan Cat off clears the displays", async () => {
    const d = deps();
    const handler = createHandler(d);
    await handler(post(NYAN_ID, { on: true }));
    const res = await handler(post(NYAN_ID, { on: false }));
    expect(res.status).toBe(200);
    expect(d.clearAllDisplays).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(stateFile, "utf8")).active).toBeNull();
  });

  it("state survives a fresh handler (read back from the file, not memory)", async () => {
    await createHandler(deps())(post("community.dino_run", { on: true }));
    const res = await createHandler(deps())(req("/api/apps"));
    const body = await res.json();
    expect(body.changedAt).toBe("2026-11-08T15:00:00.000Z");
    expect(body.apps.find((a: { id: string }) => a.id === "community.dino_run").state).toBe("on");
  });

  it("a device failure responds 502 and leaves the state untouched", async () => {
    await createHandler(deps())(post(NYAN_ID, { on: true }));
    const failing = deps({
      launchApp: mock(async () => {
        throw new Error("BUSY Bar rejected launch: 503 Failed to launch the application");
      }),
    });
    const res = await createHandler(failing)(post("community.dino_run", { on: true }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("503");
    expect(JSON.parse(readFileSync(stateFile, "utf8")).active).toBe(NYAN_ID);
  });

  it("rejects an unknown app id with 404", async () => {
    const res = await createHandler(deps())(post("app.nope", { on: true }));
    expect(res.status).toBe(404);
  });

  it("rejects a body without a boolean `on` with 400", async () => {
    const handler = createHandler(deps());
    expect((await handler(post(NYAN_ID, { on: "yes" }))).status).toBe(400);
    expect((await handler(post(NYAN_ID, "{ nope"))).status).toBe(400);
    expect((await handler(post(NYAN_ID, {}))).status).toBe(400);
  });
});

describe("panning", () => {
  it("starts the cat pan after Nyan Cat is drawn, and stops it when anything else is turned on or Nyan Cat is turned off", async () => {
    panStop = mock(() => {});
    const d = deps();
    const handler = createHandler(d);
    await handler(post(NYAN_ID, { on: true }));
    expect(d.startPan).toHaveBeenCalledTimes(1);
    expect(calls(d.startPan)[0]![0]).toBe(BASE_URL);
    expect(panStop).not.toHaveBeenCalled();

    await handler(post("community.dino_run", { on: true }));
    expect(panStop).toHaveBeenCalledTimes(1);
    expect(d.startPan).toHaveBeenCalledTimes(1);

    await handler(post(NYAN_ID, { on: true }));
    expect(d.startPan).toHaveBeenCalledTimes(2);
    await handler(post(NYAN_ID, { on: false }));
    expect(panStop).toHaveBeenCalledTimes(2);
  });

  it("does not start the pan when the draw failed", async () => {
    const d = deps({ runRainbow: mock(async () => { throw new Error("508"); }) });
    await createHandler(d)(post(NYAN_ID, { on: true }));
    expect(d.startPan).not.toHaveBeenCalled();
  });
});

describe("scenes (pre-rendered draw apps)", () => {
  it("turning a scene on quits any JS app, stops the Nyan pan, runs that scene, and marks only it on", async () => {
    panStop = mock(() => {});
    const d = deps();
    const handler = createHandler(d);
    await handler(post(NYAN_ID, { on: true }));
    const res = await handler(post("lava_lamp", { on: true }));
    expect(res.status).toBe(200);
    expect(panStop).toHaveBeenCalledTimes(1);
    expect(d.quitApp).toHaveBeenCalledTimes(2);
    expect(d.scenes[0]!.run).toHaveBeenCalledTimes(1);
    expect(calls(d.scenes[0]!.run)[0]![0]).toBe(BASE_URL);
    expect(d.scenes[1]!.run).not.toHaveBeenCalled();
    expect(d.runRainbow).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.apps.map((a: { id: string; state: string }) => [a.id, a.state])).toEqual([
      [NYAN_ID, "off"],
      ["lava_lamp", "on"],
      ["aquarium", "off"],
      ["app.busy.clock", "off"],
      ["community.dino_run", "off"],
    ]);
    expect(JSON.parse(readFileSync(stateFile, "utf8")).active).toBe("lava_lamp");
  });

  it("turning a scene off clears the displays and leaves nothing active", async () => {
    const d = deps();
    const handler = createHandler(d);
    await handler(post("aquarium", { on: true }));
    const res = await handler(post("aquarium", { on: false }));
    expect(res.status).toBe(200);
    expect(d.clearAllDisplays).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(stateFile, "utf8")).active).toBeNull();
  });

  it("a scene that fails to draw responds 502 and leaves the state untouched", async () => {
    const d = deps();
    d.scenes[0]!.run = mock(async () => { throw new Error("508 upload failed"); });
    await createHandler(d)(post(NYAN_ID, { on: true }));
    const res = await createHandler(d)(post("lava_lamp", { on: true }));
    expect(res.status).toBe(502);
    expect(JSON.parse(readFileSync(stateFile, "utf8")).active).toBe(NYAN_ID);
  });
});

describe("shuffle (global rotation)", () => {
  const ANIMATIONS = [NYAN_ID, "lava_lamp", "aquarium"];
  const shuffle = (on: boolean) => req("/api/shuffle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on }) });
  const ran = (d: ServerDeps): string[] => {
    const out: string[] = [];
    for (let i = 0; i < calls(d.runRainbow).length; i++) out.push(NYAN_ID);
    for (const s of d.scenes) for (let i = 0; i < calls(s.run).length; i++) out.push(s.id);
    return out;
  };

  it("is reported off (and not as an app) until switched on", async () => {
    const body = await (await createHandler(deps())(req("/api/apps"))).json();
    expect(body.apps.map((a: { id: string }) => a.id)).not.toContain("shuffle");
    expect(body.shuffle).toEqual({ on: false });
  });

  it("switching it on with nothing showing deals a card now, marks that animation on, and books the next change two hours out", async () => {
    const d = deps();
    const handler = createHandler(d);
    const res = await handler(shuffle(true));
    expect(res.status).toBe(200);
    const shown = ran(d);
    expect(shown).toHaveLength(1);
    expect(ANIMATIONS).toContain(shown[0]);
    const body = await res.json();
    expect(body.shuffle).toEqual({ on: true, nextChangeAt: "2026-11-08T17:00:00.000Z" });
    expect(body.apps.find((a: { id: string }) => a.id === shown[0]).state).toBe("on");
    expect(body.apps.filter((a: { state: string }) => a.state === "on")).toHaveLength(1);
    expect(timers).toHaveLength(1);
    expect(timers[0]!.ms).toBe(SHUFFLE_INTERVAL_MS);
    const stored = JSON.parse(readFileSync(stateFile, "utf8"));
    expect(stored.active).toBe(shown[0]);
    expect(stored.shuffle.nextAt).toBe("2026-11-08T17:00:00.000Z");
    expect([stored.active, ...stored.shuffle.deck].sort()).toEqual([...ANIMATIONS].sort());
  });

  it("switching it on while an animation is already showing keeps that one as the current card and just starts the clock", async () => {
    const d = deps();
    const handler = createHandler(d);
    await handler(post("lava_lamp", { on: true }));
    const res = await handler(shuffle(true));
    expect(ran(d)).toEqual(["lava_lamp"]); // nothing redrawn
    const body = await res.json();
    expect(body.apps.find((a: { id: string }) => a.id === "lava_lamp").state).toBe("on");
    expect(body.shuffle.on).toBe(true);
    const stored = JSON.parse(readFileSync(stateFile, "utf8"));
    expect(stored.active).toBe("lava_lamp");
    expect(stored.shuffle.deck).not.toContain("lava_lamp");
    expect([...stored.shuffle.deck].sort()).toEqual(["aquarium", NYAN_ID]);
  });

  it("each tick plays a different animation until every one has been shown, then starts a fresh round", async () => {
    let r = 0.1;
    const d = deps({ random: () => (r = (r * 7.3) % 1) });
    const handler = createHandler(d);
    await handler(shuffle(true));
    for (let i = 0; i < ANIMATIONS.length * 2 - 1; i++) { timers[timers.length - 1]!.fn(); await flush(); }
    const shown = ran(d);
    expect(shown).toHaveLength(ANIMATIONS.length * 2);
    for (const id of ANIMATIONS) expect(shown.filter((x) => x === id)).toHaveLength(2);
    expect(timers).toHaveLength(ANIMATIONS.length * 2);
    const body = await (await handler(req("/api/apps"))).json();
    expect(body.apps.filter((a: { state: string }) => a.state === "on")).toHaveLength(1);
  });

  it("picking an animation by hand while it is on shows that one, counts it as dealt, and restarts the two-hour clock", async () => {
    const d = deps({ random: () => 0.99 });
    const handler = createHandler(d);
    await handler(shuffle(true));
    const first = ran(d)[0]!;
    const other = ANIMATIONS.find((a) => a !== first)!;
    const res = await handler(post(other, { on: true }));
    const body = await res.json();
    expect(body.shuffle.on).toBe(true);
    expect(body.apps.find((a: { id: string }) => a.id === other).state).toBe("on");
    expect(cancelled).toHaveLength(1);
    expect(timers).toHaveLength(2);
    expect(timers[1]!.ms).toBe(SHUFFLE_INTERVAL_MS);
    const stored = JSON.parse(readFileSync(stateFile, "utf8"));
    expect(stored.active).toBe(other);
    expect(stored.shuffle.deck).not.toContain(other);
  });

  it("turning the bar off, or launching a JS app, switches shuffle off; switching it off by hand leaves the bar as it is", async () => {
    const d = deps();
    const handler = createHandler(d);
    await handler(shuffle(true));
    const shown = ran(d)[0]!;
    let body = await (await handler(post(shown, { on: false }))).json();
    expect(body.shuffle).toEqual({ on: false });
    expect(cancelled).toHaveLength(1);
    expect(JSON.parse(readFileSync(stateFile, "utf8")).shuffle).toBeUndefined();

    await handler(shuffle(true));
    body = await (await handler(post("community.dino_run", { on: true }))).json();
    expect(body.shuffle).toEqual({ on: false });
    expect(body.apps.find((a: { id: string }) => a.id === "community.dino_run").state).toBe("on");

    await handler(post("lava_lamp", { on: true }));
    await handler(shuffle(true));
    const before = ran(d).length;
    body = await (await handler(shuffle(false))).json();
    expect(body.shuffle).toEqual({ on: false });
    expect(body.apps.find((a: { id: string }) => a.id === "lava_lamp").state).toBe("on");
    expect(ran(d)).toHaveLength(before);
    expect(d.clearAllDisplays).toHaveBeenCalledTimes(2); // the off + the JS launch, not the shuffle-off
  });

  it("a fresh server resumes a stored round: the timer is re-armed for the remaining time, and a missed change fires straight away", async () => {
    await createHandler(deps())(shuffle(true)); // nextAt 17:00
    timers = [];
    createHandler(deps({ now: () => new Date("2026-11-08T16:30:00.000Z") }));
    expect(timers).toHaveLength(1);
    expect(timers[0]!.ms).toBe(30 * 60 * 1000);
    timers = [];
    const late = deps({ now: () => new Date("2026-11-08T19:00:00.000Z") });
    createHandler(late);
    expect(timers).toHaveLength(1);
    expect(timers[0]!.ms).toBe(0);
    timers[0]!.fn();
    await flush();
    expect(ran(late)).toHaveLength(1);
    expect(JSON.parse(readFileSync(stateFile, "utf8")).shuffle.nextAt).toBe("2026-11-08T21:00:00.000Z");
  });

  it("a failed change answers 502 when switching on, and a failed tick is logged and retried in a minute", async () => {
    const errors: unknown[] = [];
    const d = deps({ runRainbow: mock(async () => { throw new Error("508"); }) });
    for (const sc of d.scenes) sc.run = mock(async () => { throw new Error("508"); });
    expect((await createHandler(d)(shuffle(true))).status).toBe(502);
    expect(timers).toHaveLength(0);
    const ok = deps();
    const h2 = createHandler(ok);
    await h2(shuffle(true));
    ok.runRainbow = mock(async () => { throw new Error("508"); });
    for (const sc of ok.scenes) sc.run = mock(async () => { throw new Error("508"); });
    ok.onError = (e) => errors.push(e);
    timers[timers.length - 1]!.fn();
    await flush();
    expect(errors).toHaveLength(1);
    expect(timers[timers.length - 1]!.ms).toBe(60 * 1000);
  });

  it("rejects a body without a boolean `on` with 400", async () => {
    const handler = createHandler(deps());
    expect((await handler(req("/api/shuffle", { method: "POST", body: "{}" }))).status).toBe(400);
  });
});

describe("unknown routes", () => {
  it("404 as JSON", async () => {
    const res = await createHandler(deps())(req("/nope"));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
