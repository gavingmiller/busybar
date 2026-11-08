import { drawFrame, drawElements, uploadAsset, clearAllDisplays } from "../lib/busybar-client.ts";
import { runAnimation, installShutdownHandler, type AnimationHandle } from "../lib/animate.ts";
import { encodeAnimFile } from "../lib/anim-file.ts";
import { starLayerFrames, catLayerFrames, skyCatOrigin, SKY_WIDTH, SKY_HEIGHT, SKY_FPS, CAT_LAYER_WIDTH, CAT_LAYER_TRAIL_LENGTH } from "./sky.ts";
import {
  nyanCatPayload,
  sceneAnimationFrames,
  sceneWidth,
  stationaryOriginX,
  flyingOriginX,
  DEFAULT_TRAIL_LENGTH,
  CAT_HEIGHT,
  TRAIL_FPS,
  CAT_TRAIL_OVERLAP,
  VERTICAL_SAFE_MARGIN,
  DRAW_PRIORITY,
} from "./sprite.ts";

const APPLICATION_NAME = "nyan_cat";
const FRAME_INTERVAL_MS = 150;
const FLYING_STEP_PX = 2;
const STARS_ASSET_FILENAME = "nyan-stars.anim";
const CAT_ASSET_FILENAME = "nyan-cat-layer.anim";
/** The cat layer's element id; the control server pans this element (see pan.ts). */
export const NYAN_CAT_ELEMENT_ID = "cat";

/** Element x that puts the cat at its home spot (the layer starts a trail-length to the left of the cat). */
export function nyanHomeElementX(): number {
  return skyCatOrigin().x - (CAT_LAYER_TRAIL_LENGTH - CAT_TRAIL_OVERLAP);
}

/**
 * The cat layer element at element x `x` (home = nyanHomeElementX()).
 *
 * `await_previous_end` matters: an upsert must carry `path` (the device
 * 400s without it), and a plain re-send makes the firmware restart the
 * asset, which at the pan's 9 upserts/s froze the cat's run cycle (4
 * distinct leg frames in 4 s against 8–9 at rest, measured live). With
 * `await_previous_end: true` the running range carries on under the new
 * position (8 in 4 s, i.e. at-rest cadence).
 */
export function nyanCatLayerElement(x: number): Record<string, unknown> {
  return {
    id: NYAN_CAT_ELEMENT_ID,
    type: "animation",
    path: CAT_ASSET_FILENAME,
    section: "default",
    loop: true,
    await_previous_end: true,
    x,
    y: skyCatOrigin().y,
    z_index: 2,
    display: "front",
  };
}

/** Upserts just the cat layer at a new x; used by the pan to move it without touching the stars. */
export async function moveNyanCat(baseUrl: string, x: number, fetchImpl: typeof fetch = fetch): Promise<void> {
  await drawElements(baseUrl, { application_name: APPLICATION_NAME, priority: DRAW_PRIORITY, elements: [nyanCatLayerElement(x)] }, fetchImpl);
}
// The composited scene samples at the trail's own native cadence (see
// sceneAnimationFrames) — a similar visual pace to the old ~150ms/frame
// polling loop, just now handled natively by the device instead of us
// re-POSTing every frame.
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
 * Draws the composited cat+trail scene as a single native looping
 * AnimationElement — the device plays and loops it forever on its own.
 * Composited into one asset rather than two separate AnimationElements
 * because the device can't layer elements with transparency (confirmed
 * live — see sceneAnimationFrames/nyanCatElements in sprite.ts for the
 * software-compositing fix). Replaces the old client-side clear+draw
 * polling loop, which flashed the device's built-in idle app through the
 * gap between our DELETE and POST every frame (upsert-by-id semantics mean
 * a DELETE always leaves us with zero elements for a moment). One-shot,
 * like runStationary — there's nothing left to poll, so no AnimationHandle.
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

  // Two transparent layers (the firmware composites them since 1.3.1): the
  // star field over the whole display, and the cat + a display-width trail
  // in front of it, so the cat can be panned without moving the sky.
  const starsBytes = encodeAnimFile({ width: SKY_WIDTH, height: SKY_HEIGHT, fps: SKY_FPS, frames: starLayerFrames() });
  await uploadAsset(baseUrl, APPLICATION_NAME, STARS_ASSET_FILENAME, starsBytes, fetchImpl);
  const catBytes = encodeAnimFile({ width: CAT_LAYER_WIDTH, height: CAT_HEIGHT, fps: SKY_FPS, frames: catLayerFrames() });
  await uploadAsset(baseUrl, APPLICATION_NAME, CAT_ASSET_FILENAME, catBytes, fetchImpl);

  if (settleMs > 0) await new Promise((resolve) => setTimeout(resolve, settleMs));

  await drawFrame(
    baseUrl,
    {
      application_name: APPLICATION_NAME,
      priority: DRAW_PRIORITY,
      elements: [
        { id: "stars", type: "animation", path: STARS_ASSET_FILENAME, loop: true, x: 0, y: 0, z_index: 1, display: "front" },
        nyanCatLayerElement(nyanHomeElementX()),
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
