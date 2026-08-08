import { drawFrame, uploadAsset } from "../lib/busybar-client.ts";
import { runAnimation, installShutdownHandler, type AnimationHandle } from "../lib/animate.ts";
import { encodeAnimFile } from "../lib/anim-file.ts";
import {
  nyanCatPayload,
  catElements,
  trailAnimationFrames,
  trailOriginY,
  stationaryOriginX,
  flyingOriginX,
  DEFAULT_TRAIL_LENGTH,
  TRAIL_ANIM_HEIGHT,
  WAVE_PERIOD,
  VERTICAL_SAFE_MARGIN,
  DRAW_PRIORITY,
} from "./sprite.ts";

const APPLICATION_NAME = "nyan_cat";
const FRAME_INTERVAL_MS = 150;
const FLYING_STEP_PX = 2;
const RAINBOW_ASSET_FILENAME = "rainbow-trail.anim";
// Loops one full WAVE_PERIOD of trail frames per second — a similar visual
// pace to the old ~150ms/frame polling loop, just now handled natively by
// the device instead of us re-POSTing every frame.
const RAINBOW_FPS = WAVE_PERIOD;
// A settle delay between uploading an asset and referencing it in a draw —
// mirrors the firmware's own image-upload integration test, which sleeps 5s
// before drawing an uploaded image. Not confirmed strictly necessary for
// .anim assets specifically, but cheap insurance; verified live at 1000ms
// with no issue. Injectable so tests don't pay for a real wait.
const RAINBOW_ASSET_SETTLE_MS = 1000;

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

/**
 * Draws the cat once (static rectangles, unchanged) plus the rainbow trail
 * as a single native looping AnimationElement — the device plays and loops
 * it forever on its own. Replaces the old client-side clear+draw polling
 * loop, which flashed the device's built-in idle app through the gap
 * between our DELETE and POST every frame (upsert-by-id semantics mean a
 * DELETE always leaves us with zero elements for a moment). One-shot, like
 * runStationary — there's nothing left to poll, so no AnimationHandle.
 */
export async function runRainbow(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  settleMs: number = RAINBOW_ASSET_SETTLE_MS
): Promise<void> {
  const trailLength = DEFAULT_TRAIL_LENGTH;
  const originX = stationaryOriginX(trailLength);
  const originY = VERTICAL_SAFE_MARGIN;

  const bytes = encodeAnimFile({
    width: trailLength,
    height: TRAIL_ANIM_HEIGHT,
    fps: RAINBOW_FPS,
    frames: trailAnimationFrames(trailLength),
  });
  await uploadAsset(baseUrl, APPLICATION_NAME, RAINBOW_ASSET_FILENAME, bytes, fetchImpl);

  if (settleMs > 0) await new Promise((resolve) => setTimeout(resolve, settleMs));

  await drawFrame(
    baseUrl,
    {
      application_name: APPLICATION_NAME,
      priority: DRAW_PRIORITY,
      elements: [
        ...catElements(originX, originY),
        {
          id: "trail-anim",
          type: "animation",
          path: RAINBOW_ASSET_FILENAME,
          loop: true,
          x: originX - trailLength,
          // trailOriginY() centers TRAIL_CANVAS_HEIGHT (13) within
          // CAT_HEIGHT (14) — coincidentally still originY+0, the correct
          // placement for the taller TRAIL_ANIM_HEIGHT (14) asset too,
          // since 14 now exactly fills CAT_HEIGHT with no centering offset.
          y: trailOriginY(originY),
          display: "front",
        },
      ],
    },
    fetchImpl
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
    await runRainbow(baseUrl);
    console.log(`Nyan Cat rainbow trail drawn on ${baseUrl} (looping natively on the device)`);
  } else {
    console.error("Usage: bun src/nyan-cat/index.ts <stationary|flying|rainbow>");
    process.exit(1);
  }
}
