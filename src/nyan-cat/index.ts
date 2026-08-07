import { drawFrame } from "../lib/busybar-client.ts";
import { runAnimation, installShutdownHandler, type AnimationHandle } from "../lib/animate.ts";
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
  await drawFrame(baseUrl, nyanCatPayload(stationaryOriginX(), VERTICAL_SAFE_MARGIN), fetchImpl);
}

export async function runFlying(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<AnimationHandle> {
  return runAnimation(
    baseUrl,
    APPLICATION_NAME,
    (tick) => nyanCatPayload(flyingOriginX(tick, undefined, FLYING_STEP_PX), VERTICAL_SAFE_MARGIN),
    { intervalMs: FRAME_INTERVAL_MS, fetchImpl }
  );
}

if (import.meta.main) {
  const baseUrl = process.env.BUSYBAR_BASE_URL ?? "http://10.0.4.20";
  const mode = process.argv[2];

  if (mode === "stationary") {
    await runStationary(baseUrl);
    console.log(`Nyan Cat drawn on ${baseUrl} (stationary)`);
  } else if (mode === "flying") {
    console.log(`Nyan Cat flying across ${baseUrl} on a loop — Ctrl+C to stop`);
    installShutdownHandler(await runFlying(baseUrl));
  } else {
    console.error("Usage: bun src/nyan-cat/index.ts <stationary|flying>");
    process.exit(1);
  }
}
