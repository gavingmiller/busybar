import { drawFrame, uploadAsset, clearDisplay } from "../lib/busybar-client.ts";
import { runAnimation, installShutdownHandler, type AnimationHandle } from "../lib/animate.ts";
import { encodeAnimFile } from "../lib/anim-file.ts";
import { watchBusySessionActive } from "../lib/busy-session.ts";
import {
  nyanCatPayload,
  catElements,
  trailAnimationFrames,
  trailOriginY,
  stationaryOriginX,
  flyingOriginX,
  DEFAULT_TRAIL_LENGTH,
  TRAIL_CANVAS_HEIGHT,
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

function rainbowOrigin(): { originX: number; originY: number; trailLength: number } {
  const trailLength = DEFAULT_TRAIL_LENGTH;
  return { originX: stationaryOriginX(trailLength), originY: VERTICAL_SAFE_MARGIN, trailLength };
}

/** Uploads the rainbow trail as a .anim asset. Idempotent — call once, reuse the same filename thereafter. */
async function uploadRainbowAsset(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  settleMs: number = RAINBOW_ASSET_SETTLE_MS
): Promise<void> {
  const { trailLength } = rainbowOrigin();
  const bytes = encodeAnimFile({
    width: trailLength,
    height: TRAIL_CANVAS_HEIGHT,
    fps: RAINBOW_FPS,
    frames: trailAnimationFrames(trailLength),
  });
  await uploadAsset(baseUrl, APPLICATION_NAME, RAINBOW_ASSET_FILENAME, bytes, fetchImpl);

  if (settleMs > 0) await new Promise((resolve) => setTimeout(resolve, settleMs));
}

/** Draws the cat + the (already-uploaded) rainbow trail asset. Safe to call repeatedly. */
async function drawRainbowFrame(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const { originX, originY, trailLength } = rainbowOrigin();
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
          y: trailOriginY(originY),
          display: "front",
        },
      ],
    },
    fetchImpl
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
  await uploadRainbowAsset(baseUrl, fetchImpl, settleMs);
  await drawRainbowFrame(baseUrl, fetchImpl);
}

export interface RainbowToggleHandle {
  /** Stops watching the BUSY session and clears this app's own elements. */
  stop: () => Promise<void>;
}

const BUSY_POLL_INTERVAL_MS = 1000;

/**
 * Like runRainbow, but also reacts to BUSY Bar's own physical Start/Pause
 * button: while a focus session is actively running (started, not paused),
 * this app's elements are cleared so the session's own display isn't
 * fought over; whenever it isn't (idle, or paused by a second button
 * press), the rainbow trail is (re)drawn. See busy-session.ts's
 * isSessionActive for exactly what "active" means here. The trail asset is
 * uploaded once up front and never re-uploaded on subsequent toggles —
 * only the cheap draw/clear repeats.
 */
export async function runRainbowToggle(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  options: { settleMs?: number; pollIntervalMs?: number } = {}
): Promise<RainbowToggleHandle> {
  const settleMs = options.settleMs ?? RAINBOW_ASSET_SETTLE_MS;
  const pollIntervalMs = options.pollIntervalMs ?? BUSY_POLL_INTERVAL_MS;

  await uploadRainbowAsset(baseUrl, fetchImpl, settleMs);
  await drawRainbowFrame(baseUrl, fetchImpl);

  const watcher = watchBusySessionActive(
    baseUrl,
    (active) => {
      const action = active ? clearDisplay(baseUrl, APPLICATION_NAME, fetchImpl) : drawRainbowFrame(baseUrl, fetchImpl);
      action.catch((err) =>
        console.error(
          `[nyan-cat:rainbow-toggle] ${active ? "clear" : "redraw"} failed: ${err instanceof Error ? err.message : err}`
        )
      );
    },
    { intervalMs: pollIntervalMs, fetchImpl }
  );

  return {
    stop: async () => {
      await watcher.stop();
      await clearDisplay(baseUrl, APPLICATION_NAME, fetchImpl);
    },
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
    installShutdownHandler(await runFlying(baseUrl));
  } else if (mode === "rainbow") {
    await runRainbow(baseUrl);
    console.log(`Nyan Cat rainbow trail drawn on ${baseUrl} (looping natively on the device)`);
  } else if (mode === "rainbow-toggle") {
    console.log(
      `Nyan Cat rainbow trail drawn on ${baseUrl} — press the device's Start/Pause button to pause it, press again to resume; Ctrl+C to stop watching`
    );
    installShutdownHandler(await runRainbowToggle(baseUrl));
  } else {
    console.error("Usage: bun src/nyan-cat/index.ts <stationary|flying|rainbow|rainbow-toggle>");
    process.exit(1);
  }
}
