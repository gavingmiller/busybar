import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import {
  clearAllDisplays as clearAllDisplaysReal,
  listApps as listAppsReal,
  launchApp as launchAppReal,
  quitApp as quitAppReal,
  getBootTime as getBootTimeReal,
  uninstallApp as uninstallAppReal,
  type DeviceApp,
} from "../lib/busybar-client.ts";
import { runRainbow as runRainbowReal, playNyanCatSection } from "../nyan-cat/index.ts";
import { startPan as startPanReal, type PanHandle } from "../nyan-cat/pan.ts";
import { EXCURSIONS, excursionDurationMs } from "../nyan-cat/excursion.ts";
import { NYAN_FLAVOURS, CLASSIC_NYAN, flavourById } from "../nyan-cat/flavours.ts";
import { SKY_FPS, SKY_FRAME_COUNT } from "../nyan-cat/sky.ts";
import { CONTROL_PAGE_HTML } from "./page.ts";
import { runScene } from "../lib/scene.ts";
import { SCENES } from "../scenes/index.ts";
import { advanceShuffle, adoptShowing, SHUFFLE_INTERVAL_MS, type ShuffleState } from "./shuffle.ts";

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
  /** The global rotation: on, and when the next change is due (UTC ISO `Z`). */
  shuffle: { on: boolean; nextChangeAt?: string };
}

/** What the state file holds: the one thing this server last put on the bar, plus the shuffle round while shuffle is on. */
interface StoredState {
  active: string | null;
  changedAt: string;
  shuffle?: ShuffleState;
}

export interface SceneApp {
  id: string;
  name: string;
  run: (baseUrl: string, fetchImpl: typeof fetch) => Promise<void>;
  /** Hidden from the page and from Shuffle; still switchable by id (debug tools like Character Picks). */
  debug?: boolean;
  /** Seasonal gate (see Scene.available): false hides it from the page and Shuffle and makes switching it on a 409. */
  available?: (now: Date) => boolean;
  availableNote?: string;
}

export interface ServerDeps {
  /** BUSY Bar device base URL. */
  baseUrl: string;
  /** JSON file holding the last command successfully sent to the device. */
  stateFile: string;
  fetchImpl: typeof fetch;
  /** The draw-API Nyan Cat flavours, listed first as draw apps. */
  nyans: NyanApp[];
  /** Draws Nyan Cat in flavour `id` (nyan-cat/index.ts runRainbow). */
  runRainbow: (baseUrl: string, fetchImpl: typeof fetch, id: string) => Promise<void>;
  clearAllDisplays: (baseUrl: string, fetchImpl: typeof fetch) => Promise<void>;
  listApps: (baseUrl: string, fetchImpl: typeof fetch) => Promise<DeviceApp[]>;
  launchApp: (baseUrl: string, appId: string, fetchImpl: typeof fetch) => Promise<void>;
  quitApp: (baseUrl: string, fetchImpl: typeof fetch) => Promise<void>;
  /** Starts the Nyan Cat camera pan (nyan-cat/pan.ts) against the device; returns a handle to stop it. */
  startPan: (baseUrl: string, fetchImpl: typeof fetch, id: string) => PanHandle;
  /** Pre-rendered full-display loops (lib/scene.ts), listed as draw apps after Nyan Cat. */
  scenes: SceneApp[];
  now: () => Date;
  /** Shuffle's randomness and timer, injectable for tests. */
  random?: () => number;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (id: unknown) => void;
  onError?: (err: unknown) => void;
  /** When the device last booted (busybar-client getBootTime); the reconcile heartbeat's one question. */
  getBootTime?: (baseUrl: string, fetchImpl: typeof fetch) => Promise<Date>;
  /** Fixed-interval timer for the heartbeat (setInterval), injectable for tests. */
  every?: (fn: () => void, ms: number) => unknown;
  /** Informational log line (console.log). */
  log?: (message: string) => void;
  /** Removes an installed JS app (busybar-client uninstallApp); the heartbeat uses it on stock apps. */
  uninstallApp?: (baseUrl: string, appId: string, fetchImpl: typeof fetch) => Promise<void>;
}

/**
 * The firmware's own JS apps (Clock, Weather, JS App Example) share this id
 * prefix. Gavin removed them 2026-11-08; the 1.4.1 update re-installed them
 * (2026-11-13: "make sure they never come back"), so the server hides them,
 * refuses to launch them, and uninstalls them again on every heartbeat.
 */
export const STOCK_APP_PREFIX = "app.busy.";
export const isStockApp = (id: string): boolean => id.startsWith(STOCK_APP_PREFIX);

/**
 * How often the server checks that the bar still shows what the state file
 * says. The bar reboots behind our back (firmware auto-update, power), which
 * clears every draw and running app; the heartbeat puts the active one back.
 */
export const RECONCILE_INTERVAL_MS = 60 * 1000;

/** How soon Shuffle tries again after a change fails (device unreachable, upload refused). */
export const SHUFFLE_RETRY_MS = 60 * 1000;

/** The classic draw-API Nyan Cat; not a JS app, so it has no device id of its own. */
export const NYAN_ID = CLASSIC_NYAN.id;
export interface NyanApp { id: string; name: string }
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
      const sh = parsed.shuffle;
      const shuffle: ShuffleState | undefined =
        sh && Array.isArray(sh.deck) && typeof sh.showing === "string" && typeof sh.nextAt === "string"
          ? { deck: sh.deck.filter((d: unknown) => typeof d === "string"), showing: sh.showing, nextAt: sh.nextAt }
          : undefined;
      return { active: parsed.active, changedAt: parsed.changedAt, ...(shuffle ? { shuffle } : {}) };
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

/** A scene the page may list and Shuffle may deal right now: not a debug tool, and in season. */
function offered(s: SceneApp, now: Date): boolean {
  return !s.debug && (s.available?.(now) ?? true);
}

async function statusFor(deps: ServerDeps, state: StoredState | null): Promise<AppsStatus> {
  const deviceApps = (await deps.listApps(deps.baseUrl, deps.fetchImpl)).filter((a) => !isStockApp(a.id));
  const stateOf = (id: string): AppState =>
    state === null ? "unknown" : state.active === id ? "on" : "off";
  const apps: AppStatus[] = [
    ...deps.nyans.map((n) => ({ id: n.id, name: n.name, kind: "draw" as const, state: stateOf(n.id) })),
    ...deps.scenes.filter((s) => offered(s, deps.now())).map((s) => ({ id: s.id, name: s.name, kind: "draw" as const, state: stateOf(s.id) })),
    ...deviceApps.map((a) => ({ id: a.id, name: a.name, kind: "js" as const, state: stateOf(a.id) })),
  ];
  const shuffle = state?.shuffle ? { on: true, nextChangeAt: state.shuffle.nextAt } : { on: false };
  return { apps, changedAt: state?.changedAt ?? null, shuffle };
}

export function createHandler(deps: ServerDeps): (req: Request) => Promise<Response> {
  const random = deps.random ?? Math.random;
  const schedule = deps.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = deps.cancel ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  const report = (err: unknown): void => {
    if (deps.onError) deps.onError(err);
    else console.error(`busybar server: ${err instanceof Error ? err.message : String(err)}`);
  };

  // The pan is the one thing this server keeps running between requests; it
  // lives only while Nyan Cat is the active app (Shuffle included).
  let pan: PanHandle | null = null;
  const stopPan = (): void => {
    pan?.stop();
    pan = null;
  };

  /** Puts one animation (Nyan Cat or a scene) on the bar, after stopping whatever runs. */
  const showAnimation = async (id: string): Promise<void> => {
    stopPan();
    await deps.quitApp(deps.baseUrl, deps.fetchImpl);
    if (deps.nyans.some((n) => n.id === id)) {
      await deps.runRainbow(deps.baseUrl, deps.fetchImpl, id);
      pan = deps.startPan(deps.baseUrl, deps.fetchImpl, id);
      return;
    }
    const scene = deps.scenes.find((s) => s.id === id);
    if (!scene) throw new Error(`Unknown animation "${id}"`);
    await scene.run(deps.baseUrl, deps.fetchImpl);
  };
  /** Puts a JS app on the bar: stop the pan and whatever app runs, clear every draw, launch. */
  const launchJsApp = async (id: string): Promise<void> => {
    stopPan();
    await deps.quitApp(deps.baseUrl, deps.fetchImpl);
    await deps.clearAllDisplays(deps.baseUrl, deps.fetchImpl);
    await deps.launchApp(deps.baseUrl, id, deps.fetchImpl);
  };
  /** Puts anything switchable on the bar by id. */
  const show = async (id: string): Promise<void> => {
    if (allAnimationIds().includes(id)) await showAnimation(id);
    else await launchJsApp(id);
  };
  /** Animations the page lists and Shuffle may deal: debug scenes excluded. */
  const animationIds = (): string[] => [...deps.nyans.map((n) => n.id), ...deps.scenes.filter((s) => offered(s, deps.now())).map((s) => s.id)];
  /** Everything switchable by id, debug scenes included. */
  const allAnimationIds = (): string[] => [...deps.nyans.map((n) => n.id), ...deps.scenes.map((s) => s.id)];
  /** Gavin's own JS apps installed on the bar (never the firmware's stock ones). */
  const jsAppIds = async (): Promise<string[]> =>
    (await deps.listApps(deps.baseUrl, deps.fetchImpl)).map((a) => a.id).filter((id) => !isStockApp(id));
  /** Shuffle's cards: the animations plus the JS apps (Gavin 2026-11-13: Ravens and Dino Run weren't cycling). */
  const dealIds = async (): Promise<string[]> => [...animationIds(), ...(await jsAppIds())];

  // Shuffle: one timer, re-armed after every change; the round itself is in
  // the state file so a restart carries on where it left off.
  let shuffleTimer: unknown = null;
  const stopShuffle = (): void => {
    if (shuffleTimer !== null) cancel(shuffleTimer);
    shuffleTimer = null;
  };
  const armShuffle = (ms: number): void => {
    stopShuffle();
    shuffleTimer = schedule(() => { shuffleTimer = null; void shuffleTick(); }, Math.max(0, ms));
  };
  /** Deals the next card, shows it, persists, and books the following change. */
  const shuffleAdvance = async (previous: ShuffleState | null): Promise<StoredState> => {
    const now = deps.now();
    const next = advanceShuffle(previous, await dealIds(), now, random);
    await show(next.showing);
    const state: StoredState = { active: next.showing, changedAt: now.toISOString(), shuffle: next };
    writeState(deps.stateFile, state);
    armShuffle(SHUFFLE_INTERVAL_MS);
    return state;
  };
  const shuffleTick = async (): Promise<void> => {
    const state = readState(deps.stateFile);
    if (!state?.shuffle) return;
    try {
      await shuffleAdvance(state.shuffle);
    } catch (err) {
      report(err);
      armShuffle(SHUFFLE_RETRY_MS);
    }
  };
  {
    const stored = readState(deps.stateFile);
    if (stored?.shuffle) armShuffle(new Date(stored.shuffle.nextAt).getTime() - deps.now().getTime());
  }

  // Reconcile: once a minute, if something is meant to be on, ask the bar when
  // it booted. A boot after our last command means the bar came up empty (its
  // APPS menu), so put the same thing back and stamp when we did. Unreachable
  // is not an error here: the page already shows that, and Shuffle's own
  // retries used to fill the log with one line a minute.
  const getBootTime = deps.getBootTime ?? getBootTimeReal;
  const uninstallApp = deps.uninstallApp ?? uninstallAppReal;
  const every = deps.every ?? ((fn, ms) => setInterval(fn, ms));
  const log = deps.log ?? ((m: string) => console.log(m));
  const putBackAfterReboot = async (): Promise<void> => {
    const state = readState(deps.stateFile);
    if (!state?.active) return;
    let booted: Date;
    try {
      booted = await getBootTime(deps.baseUrl, deps.fetchImpl);
    } catch {
      return;
    }
    if (booted.getTime() <= new Date(state.changedAt).getTime()) return;
    try {
      await show(state.active);
      writeState(deps.stateFile, { ...state, changedAt: deps.now().toISOString() });
      log(`busybar server: the bar rebooted at ${booted.toISOString()}; put ${state.active} back`);
    } catch (err) {
      report(err);
    }
  };
  // Firmware updates re-install the stock apps; take them off again, one line each.
  const purgeStockApps = async (): Promise<void> => {
    let installed: DeviceApp[];
    try {
      installed = await deps.listApps(deps.baseUrl, deps.fetchImpl);
    } catch {
      return;
    }
    for (const app of installed.filter((a) => isStockApp(a.id))) {
      try {
        await uninstallApp(deps.baseUrl, app.id, deps.fetchImpl);
        log(`busybar server: uninstalled stock app ${app.id} (${app.name})`);
      } catch (err) {
        report(err);
      }
    }
  };
  const reconcile = async (): Promise<void> => {
    await putBackAfterReboot();
    await purgeStockApps();
  };
  every(() => { void reconcile(); }, RECONCILE_INTERVAL_MS);

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

    if (url.pathname === "/api/shuffle") {
      if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
      let on: unknown;
      try {
        on = ((await req.json()) as { on?: unknown } | null)?.on;
      } catch {
        return json({ error: "Body must be JSON" }, 400);
      }
      if (typeof on !== "boolean") return json({ error: 'Body must be { "on": true | false }' }, 400);
      const current = readState(deps.stateFile);
      let state: StoredState;
      try {
        if (!on) {
          stopShuffle();
          state = { active: current?.active ?? null, changedAt: current?.changedAt ?? deps.now().toISOString() };
          writeState(deps.stateFile, state);
        } else if (current?.active && (await dealIds()).includes(current.active)) {
          // Something is already showing: it becomes this round's current card; the clock starts now.
          const round = adoptShowing(current.shuffle ?? null, current.active, await dealIds(), deps.now(), random);
          state = { active: current.active, changedAt: current.changedAt, shuffle: round };
          writeState(deps.stateFile, state);
          armShuffle(SHUFFLE_INTERVAL_MS);
        } else {
          state = await shuffleAdvance(null);
        }
        return json(await statusFor(deps, state));
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

      let state: StoredState;
      try {
        const isAnimation = allAnimationIds().includes(id);
        const known = isAnimation || (!isStockApp(id) && (await jsAppIds()).includes(id));
        if (!known) return json({ error: `Unknown app "${id}"` }, 404);
        const seasonal = deps.scenes.find((s) => s.id === id);
        if (on && seasonal?.available && !seasonal.available(deps.now())) {
          return json({ error: `${seasonal.name} ${seasonal.availableNote ?? "is not available right now"}` }, 409);
        }

        // Only one thing is on the bar at a time, so turning anything on
        // means stopping whatever is running first: the pan, the JS app (a
        // 409 "not running" is fine), every draw, then start the new one.
        // Shuffle survives a hand-picked app (it becomes the current card)
        // but not turning the bar off.
        const current = readState(deps.stateFile);
        stopShuffle();
        const now = deps.now();
        if (on) {
          await show(id);
          const round = current?.shuffle ? adoptShowing(current.shuffle, id, await dealIds(), now, random) : undefined;
          state = { active: id, changedAt: now.toISOString(), ...(round ? { shuffle: round } : {}) };
          if (round) armShuffle(SHUFFLE_INTERVAL_MS);
        } else {
          stopPan();
          await deps.quitApp(deps.baseUrl, deps.fetchImpl);
          if (isAnimation) await deps.clearAllDisplays(deps.baseUrl, deps.fetchImpl);
          state = { active: null, changedAt: now.toISOString() };
        }
        writeState(deps.stateFile, state);
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : String(err) }, 502);
      }
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
    nyans: NYAN_FLAVOURS.map((f) => ({ id: f.id, name: f.name })),
    runRainbow: (baseUrl, fetchImpl, id) => runRainbowReal(baseUrl, fetchImpl, undefined, flavourById(id)),
    clearAllDisplays: clearAllDisplaysReal,
    listApps: listAppsReal,
    launchApp: launchAppReal,
    quitApp: quitAppReal,
    startPan: (baseUrl, fetchImpl, id) =>
      startPanReal({
        excursions: EXCURSIONS.map((e) => ({ name: e.name, durationMs: excursionDurationMs(e) })),
        loopMs: (SKY_FRAME_COUNT / SKY_FPS) * 1000,
        play: (section, loop) => playNyanCatSection(baseUrl, section, loop, fetchImpl, flavourById(id)),
        onError: (err) => console.error(`nyan pan: ${err instanceof Error ? err.message : String(err)}`),
      }),
    scenes: SCENES.map((scene) => ({ id: scene.id, name: scene.name, debug: scene.debug, available: scene.available, availableNote: scene.availableNote, run: (baseUrl, fetchImpl) => runScene(baseUrl, scene, fetchImpl) })),
    now: () => new Date(),
  });
  // Drawing an animation uploads its asset first (up to ~100 s for a cat
  // layer); Bun's default 10 s idle timeout cut those responses off mid-upload.
  Bun.serve({ hostname: "127.0.0.1", port, fetch: handler, idleTimeout: 255 });
  console.log(`BUSY Bar control server listening on http://127.0.0.1:${port}`);
}
