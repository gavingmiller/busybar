import { drawElements, clearDisplay } from "../lib/busybar-client.ts";
import {
  nyanCatPayload,
  stationaryOriginX,
  flyingOriginX,
  VERTICAL_SAFE_MARGIN,
} from "./sprite.ts";

const APPLICATION_NAME = "nyan_cat";
const FRAME_INTERVAL_MS = 150;
const FLYING_STEP_PX = 2;

export async function runStationary(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  await clearDisplay(baseUrl, APPLICATION_NAME, fetchImpl);
  await drawElements(
    baseUrl,
    nyanCatPayload(stationaryOriginX(), VERTICAL_SAFE_MARGIN),
    fetchImpl
  );
}

export async function runFlying(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<() => Promise<void>> {
  await clearDisplay(baseUrl, APPLICATION_NAME, fetchImpl);
  let tick = 0;

  const interval = setInterval(() => {
    drawElements(
      baseUrl,
      nyanCatPayload(flyingOriginX(tick, undefined, FLYING_STEP_PX), VERTICAL_SAFE_MARGIN),
      fetchImpl
    ).catch(
      (err) => console.error(`[nyan-cat] draw failed: ${err instanceof Error ? err.message : err}`)
    );
    tick++;
  }, FRAME_INTERVAL_MS);

  return async () => {
    clearInterval(interval);
    await clearDisplay(baseUrl, APPLICATION_NAME, fetchImpl);
  };
}

if (import.meta.main) {
  const baseUrl = process.env.BUSYBAR_BASE_URL ?? "http://10.0.4.20";
  const mode = process.argv[2];

  if (mode === "stationary") {
    await runStationary(baseUrl);
    console.log(`Nyan Cat drawn on ${baseUrl} (stationary)`);
  } else if (mode === "flying") {
    console.log(`Nyan Cat flying across ${baseUrl} on a loop — Ctrl+C to stop`);
    const stop = await runFlying(baseUrl);
    const shutdown = async () => {
      await stop();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } else {
    console.error("Usage: bun src/nyan-cat/index.ts <stationary|flying>");
    process.exit(1);
  }
}
