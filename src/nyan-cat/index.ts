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
const RAINBOW_STEP_PX = 1;
// The rainbow trail's merged-element ids shift as the wave's phase advances,
// so each frame needs its own clear (see clearEachFrame in animate.ts) —
// that's 2 requests/frame instead of 1. Confirmed live against the device:
// at FRAME_INTERVAL_MS (150ms) that pushed the request rate high enough to
// get every draw rejected with 508 "Resource Limit Reached". Slower interval
// keeps the *request* rate comparable to flying's, even with 2x the requests.
const RAINBOW_INTERVAL_MS = 350;

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

export async function runRainbow(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<AnimationHandle> {
  return runAnimation(
    baseUrl,
    APPLICATION_NAME,
    (tick) =>
      nyanCatPayload(stationaryOriginX(), VERTICAL_SAFE_MARGIN, undefined, tick * RAINBOW_STEP_PX),
    { intervalMs: RAINBOW_INTERVAL_MS, clearEachFrame: true, fetchImpl }
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
  } else if (mode === "rainbow") {
    console.log(`Nyan Cat rainbow trail animating on ${baseUrl} — Ctrl+C to stop`);
    installShutdownHandler(await runRainbow(baseUrl));
  } else {
    console.error("Usage: bun src/nyan-cat/index.ts <stationary|flying|rainbow>");
    process.exit(1);
  }
}
