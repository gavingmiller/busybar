import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import {
  clearAllDisplays as clearAllDisplaysReal,
  listApps as listAppsReal,
  launchApp as launchAppReal,
  quitApp as quitAppReal,
  type DeviceApp,
} from "../lib/busybar-client.ts";
import { runRainbow as runRainbowReal, playNyanCatSection } from "../nyan-cat/index.ts";
import { startPan as startPanReal, type PanHandle } from "../nyan-cat/pan.ts";
import { EXCURSIONS, excursionDurationMs } from "../nyan-cat/excursion.ts";
import { SKY_FPS, SKY_FRAME_COUNT } from "../nyan-cat/sky.ts";
import { CONTROL_PAGE_HTML } from "./page.ts";
import { runScene } from "../lib/scene.ts";
import { SCENES } from "../scenes/index.ts";

export type AppState = "on" | "off" | "unknown";
export type AppKind = "draw" | "js";

export interface AppStatus {
  id: string;
  name: string;
  kind: AppKind;
  state: AppState;
}

export interface AppsStatus {
  apps: AppStatus[];
  /** UTC ISO 8601 `Z` instant of the last successful command, or null. */
  changedAt: string | null;
}

/** What the state file holds: the one thing this server last put on the bar. */
interface StoredState {
  active: string | null;
  changedAt: string;
}

export interface SceneApp {
  id: string;
  name: string;
  run: (baseUrl: string, fetchImpl: typeof fetch) => Promise<void>;
}

export interface ServerDeps {
  /** BUSY Bar device base URL. */
  baseUrl: string;
  /** JSON file holding the last command successfully sent to the device. */
  stateFile: string;
  fetchImpl: typeof fetch;
  runRainbow: (baseUrl: string, fetchImpl: typeof fetch) => Promise<void>;
  clearAllDisplays: (baseUrl: string, fetchImpl: typeof fetch) => Promise<void>;
  listApps: (baseUrl: string, fetchImpl: typeof fetch) => Promise<DeviceApp[]>;
  launchApp: (baseUrl: string, appId: string, fetchImpl: typeof fetch) => Promise<void>;
  quitApp: (baseUrl: string, fetchImpl: typeof fetch) => Promise<void>;
  /** Starts the Nyan Cat camera pan (nyan-cat/pan.ts) against the device; returns a handle to stop it. */
  startPan: (baseUrl: string, fetchImpl: typeof fetch) => PanHandle;
  /** Pre-rendered full-display loops (lib/scene.ts), listed as draw apps after Nyan Cat. */
  scenes: SceneApp[];
  now: () => Date;
}

/** The draw-API Nyan Cat; not a JS app, so it has no device id of its own. */
export const NYAN_ID = "nyan_cat";
export const DEFAULT_PORT = 7495;
export const DEFAULT_BASE_URL = "http://10.0.4.20";
export const DEFAULT_STATE_FILE = join(
  homedir(),
  "Library",
  "Application Support",
  "busybar",
  "state.json"
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

/**
 * The device exposes no endpoint that reports what is currently drawn or
 * which JS app is running, so the only truth we can offer is the last
 * command this server successfully sent. It lives in a file, never only in
 * memory, so a restart of the server (launchd KeepAlive) doesn't forget it.
 * Only one thing is ever on the bar at once, so the model is "the active
 * app" rather than a flag per app.
 */
function readState(stateFile: string): StoredState | null {
  let raw: string;
  try {
    raw = readFileSync(stateFile, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (
      (parsed.active === null || typeof parsed.active === "string") &&
      typeof parsed.changedAt === "string"
    ) {
      return { active: parsed.active, changedAt: parsed.changedAt };
    }
  } catch {
    // fall through — a corrupt file is the same as no file
  }
  return null;
}

function writeState(stateFile: string, state: StoredState): void {
  mkdirSync(dirname(stateFile), { recursive: true });
  const tmp = `${stateFile}.tmp`;
  writeFileSync(tmp, JSON.stringify(state));
  renameSync(tmp, stateFile);
}

async function statusFor(deps: ServerDeps, state: StoredState | null): Promise<AppsStatus> {
  const deviceApps = await deps.listApps(deps.baseUrl, deps.fetchImpl);
  const stateOf = (id: string): AppState =>
    state === null ? "unknown" : state.active === id ? "on" : "off";
  const apps: AppStatus[] = [
    { id: NYAN_ID, name: "Nyan Cat", kind: "draw", state: stateOf(NYAN_ID) },
    ...deps.scenes.map((s) => ({ id: s.id, name: s.name, kind: "draw" as const, state: stateOf(s.id) })),
    ...deviceApps.map((a) => ({ id: a.id, name: a.name, kind: "js" as const, state: stateOf(a.id) })),
  ];
  return { apps, changedAt: state?.changedAt ?? null };
}

export function createHandler(deps: ServerDeps): (req: Request) => Promise<Response> {
  // The pan is the one thing this server keeps running between requests; it
  // lives only while Nyan Cat is the active app.
  let pan: PanHandle | null = null;
  const stopPan = (): void => {
    pan?.stop();
    pan = null;
  };

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/") {
      return new Response(CONTROL_PAGE_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (req.method === "GET" && url.pathname === "/api/apps") {
      try {
        return json(await statusFor(deps, readState(deps.stateFile)));
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : String(err) }, 502);
      }
    }

    const match = url.pathname.match(/^\/api\/apps\/([^/]+)$/);
    if (match && req.method === "POST") {
      const id = decodeURIComponent(match[1]!);

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ error: "Body must be JSON" }, 400);
      }
      const on = (body as { on?: unknown } | null)?.on;
      if (typeof on !== "boolean") {
        return json({ error: 'Body must be { "on": true | false }' }, 400);
      }

      try {
        const scene = deps.scenes.find((s) => s.id === id);
        const known =
          id === NYAN_ID ||
          scene !== undefined ||
          (await deps.listApps(deps.baseUrl, deps.fetchImpl)).some((a) => a.id === id);
        if (!known) return json({ error: `Unknown app "${id}"` }, 404);

        // Only one thing is on the bar at a time, so turning anything on
        // means stopping whatever is running first: quit the JS app (a 409
        // "not running" is fine), drop every draw, then start the new one.
        stopPan();
        await deps.quitApp(deps.baseUrl, deps.fetchImpl);
        if (on) {
          if (id === NYAN_ID) {
            await deps.runRainbow(deps.baseUrl, deps.fetchImpl);
            pan = deps.startPan(deps.baseUrl, deps.fetchImpl);
          } else if (scene) {
            await scene.run(deps.baseUrl, deps.fetchImpl);
          } else {
            await deps.clearAllDisplays(deps.baseUrl, deps.fetchImpl);
            await deps.launchApp(deps.baseUrl, id, deps.fetchImpl);
          }
        } else if (id === NYAN_ID || scene) {
          await deps.clearAllDisplays(deps.baseUrl, deps.fetchImpl);
        }
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : String(err) }, 502);
      }

      const state: StoredState = { active: on ? id : null, changedAt: deps.now().toISOString() };
      writeState(deps.stateFile, state);
      try {
        return json(await statusFor(deps, state));
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : String(err) }, 502);
      }
    }

    if (url.pathname === "/api/apps" || match) return json({ error: "Method Not Allowed" }, 405);
    return json({ error: "Not Found" }, 404);
  };
}

if (import.meta.main) {
  const port = Number(process.env.BUSYBAR_CONTROL_PORT ?? DEFAULT_PORT);
  const handler = createHandler({
    baseUrl: process.env.BUSYBAR_BASE_URL ?? DEFAULT_BASE_URL,
    stateFile: process.env.BUSYBAR_STATE_FILE ?? DEFAULT_STATE_FILE,
    fetchImpl: fetch,
    runRainbow: runRainbowReal,
    clearAllDisplays: clearAllDisplaysReal,
    listApps: listAppsReal,
    launchApp: launchAppReal,
    quitApp: quitAppReal,
    startPan: (baseUrl, fetchImpl) =>
      startPanReal({
        excursions: EXCURSIONS.map((e) => ({ name: e.name, durationMs: excursionDurationMs(e) })),
        loopMs: (SKY_FRAME_COUNT / SKY_FPS) * 1000,
        play: (section, loop) => playNyanCatSection(baseUrl, section, loop, fetchImpl),
        onError: (err) => console.error(`nyan pan: ${err instanceof Error ? err.message : String(err)}`),
      }),
    scenes: SCENES.map((scene) => ({ id: scene.id, name: scene.name, run: (baseUrl, fetchImpl) => runScene(baseUrl, scene, fetchImpl) })),
    now: () => new Date(),
  });
  Bun.serve({ hostname: "127.0.0.1", port, fetch: handler });
  console.log(`BUSY Bar control server listening on http://127.0.0.1:${port}`);
}
