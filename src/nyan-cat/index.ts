import { drawFrame, uploadAsset, clearAllDisplays } from "../lib/busybar-client.ts";
import { runAnimation, installShutdownHandler, type AnimationHandle } from "../lib/animate.ts";
import { encodeAnimFile } from "../lib/anim-file.ts";
import {
  nyanCatPayload,
  trailAnimationFrames,
  catAnimationFrames,
  trailOriginY,
  stationaryOriginX,
  flyingOriginX,
  DEFAULT_TRAIL_LENGTH,
  TRAIL_ANIM_HEIGHT,
  TRAIL_FPS,
  CAT_WIDTH,
  CAT_HEIGHT,
  CAT_FPS,
  CAT_TRAIL_OVERLAP,
  VERTICAL_SAFE_MARGIN,
  DRAW_PRIORITY,
} from "./sprite.ts";

const APPLICATION_NAME = "nyan_cat";
const FRAME_INTERVAL_MS = 150;
const FLYING_STEP_PX = 2;
const RAINBOW_ASSET_FILENAME = "rainbow-trail.anim";
const CAT_RUN_ASSET_FILENAME = "cat-run.anim";
// TRAIL_FPS is fixed at the trail's 1px/frame scroll rate, not derived from
// frame count — a similar visual pace to the old ~150ms/frame polling loop,
// just now handled natively by the device instead of us re-POSTing every
// frame.
const RAINBOW_FPS = TRAIL_FPS;
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
 * Draws the cat's run cycle and the rainbow trail as two independent native
 * looping AnimationElements — the device plays and loops both forever on
 * its own, at their own paces (CAT_FPS vs TRAIL_FPS), same as the old
 * client-side clear+draw polling loop this replaced, which flashed the
 * device's built-in idle app through the gap between our DELETE and POST
 * every frame (upsert-by-id semantics mean a DELETE always leaves us with
 * zero elements for a moment). One-shot, like runStationary — there's
 * nothing left to poll, so no AnimationHandle.
 */
export async function runRainbow(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  settleMs: number = RAINBOW_ASSET_SETTLE_MS
): Promise<void> {
  const trailLength = DEFAULT_TRAIL_LENGTH;
  const originX = stationaryOriginX(trailLength);
  const originY = VERTICAL_SAFE_MARGIN;

  // The device holds an .anim asset file open while it's actively looping
  // that asset, so re-uploading over the same filename 508s "Failed to open
  // file for writing" unless the display is cleared first — bit us live the
  // first time this ran twice in a row (busybar commit 11bc484's memory
  // note). Clearing here makes re-running this function (e.g. iterating on
  // CAT_FRAMES) safe without a separate manual clear step.
  await clearAllDisplays(baseUrl, fetchImpl);

  const trailBytes = encodeAnimFile({
    width: trailLength,
    height: TRAIL_ANIM_HEIGHT,
    fps: RAINBOW_FPS,
    frames: trailAnimationFrames(trailLength),
  });
  const catBytes = encodeAnimFile({
    width: CAT_WIDTH,
    height: CAT_HEIGHT,
    fps: CAT_FPS,
    frames: catAnimationFrames(),
  });
  await Promise.all([
    uploadAsset(baseUrl, APPLICATION_NAME, RAINBOW_ASSET_FILENAME, trailBytes, fetchImpl),
    uploadAsset(baseUrl, APPLICATION_NAME, CAT_RUN_ASSET_FILENAME, catBytes, fetchImpl),
  ]);

  if (settleMs > 0) await new Promise((resolve) => setTimeout(resolve, settleMs));

  await drawFrame(
    baseUrl,
    {
      application_name: APPLICATION_NAME,
      priority: DRAW_PRIORITY,
      elements: [
        // Trail drawn first (underneath), overlapped CAT_TRAIL_OVERLAP px
        // under the cat's left edge so it shows through the cat's
        // top-left notch instead of stopping at a hard seam — cat is
        // listed after (on top) so its opaque pixels still cover the
        // overlap everywhere except that notch. See CAT_TRAIL_OVERLAP's
        // own comment in sprite.ts.
        {
          id: "trail-anim",
          type: "animation",
          path: RAINBOW_ASSET_FILENAME,
          loop: true,
          x: originX - trailLength + CAT_TRAIL_OVERLAP,
          // TRAIL_ANIM_HEIGHT now exactly equals CAT_HEIGHT (both derived
          // from sprite-data.ts), so trailOriginY() is a no-op offset here —
          // kept in case the two diverge again after a hand-edit.
          y: trailOriginY(originY),
          display: "front",
        },
        {
          id: "cat-anim",
          type: "animation",
          path: CAT_RUN_ASSET_FILENAME,
          loop: true,
          x: originX,
          y: originY,
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
