import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { clearAllDisplays as clearAllDisplaysReal } from "../lib/busybar-client.ts";
import { runRainbow as runRainbowReal } from "../nyan-cat/index.ts";
import { CONTROL_PAGE_HTML } from "./page.ts";

export type NyanState = "on" | "off" | "unknown";

export interface NyanStatus {
  state: NyanState;
  /** UTC ISO 8601 `Z` instant of the last successful command, or null. */
  changedAt: string | null;
}

export interface ServerDeps {
  /** BUSY Bar device base URL. */
  baseUrl: string;
  /** JSON file holding the last command successfully sent to the device. */
  stateFile: string;
  fetchImpl: typeof fetch;
  runRainbow: (baseUrl: string, fetchImpl: typeof fetch) => Promise<void>;
  clearAllDisplays: (baseUrl: string, fetchImpl: typeof fetch) => Promise<void>;
  now: () => Date;
}

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
 * The device exposes no endpoint that reports what is currently drawn, so
 * the only truth we can offer is the last command this server successfully
 * sent. It lives in a file, never only in memory, so a restart of the
 * server (launchd KeepAlive) doesn't forget it.
 */
function readStatus(stateFile: string): NyanStatus {
  let raw: string;
  try {
    raw = readFileSync(stateFile, "utf8");
  } catch {
    return { state: "unknown", changedAt: null };
  }
  try {
    const parsed = JSON.parse(raw);
    if ((parsed.state === "on" || parsed.state === "off") && typeof parsed.changedAt === "string") {
      return { state: parsed.state, changedAt: parsed.changedAt };
    }
  } catch {
    // fall through — a corrupt file is the same as no file
  }
  return { state: "unknown", changedAt: null };
}

function writeStatus(stateFile: string, status: NyanStatus): void {
  mkdirSync(dirname(stateFile), { recursive: true });
  const tmp = `${stateFile}.tmp`;
  writeFileSync(tmp, JSON.stringify(status));
  renameSync(tmp, stateFile);
}

export function createHandler(deps: ServerDeps): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/") {
      return new Response(CONTROL_PAGE_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (url.pathname === "/api/nyan") {
      if (req.method === "GET") return json(readStatus(deps.stateFile));

      if (req.method === "POST") {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return json({ error: "Body must be JSON" }, 400);
        }
        const on = (body as { on?: unknown } | null)?.on;
        if (typeof on !== "boolean") {
          return json({ error: "Body must be { \"on\": true | false }" }, 400);
        }

        try {
          if (on) await deps.runRainbow(deps.baseUrl, deps.fetchImpl);
          else await deps.clearAllDisplays(deps.baseUrl, deps.fetchImpl);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : String(err) }, 502);
        }

        const status: NyanStatus = { state: on ? "on" : "off", changedAt: deps.now().toISOString() };
        writeStatus(deps.stateFile, status);
        return json(status);
      }

      return json({ error: "Method Not Allowed" }, 405);
    }

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
    now: () => new Date(),
  });
  Bun.serve({ hostname: "127.0.0.1", port, fetch: handler });
  console.log(`BUSY Bar control server listening on http://127.0.0.1:${port}`);
}
