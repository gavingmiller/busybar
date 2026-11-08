import { drawFrame, drawElements, uploadAsset, clearAllDisplays, listStorage, removeStorageFile, assetStoragePath } from "../lib/busybar-client.ts";
import { runAnimation, installShutdownHandler, type AnimationHandle } from "../lib/animate.ts";
import { encodeAnimFile } from "../lib/anim-file.ts";
import { starLayerFrames, skyCatOrigin, SKY_WIDTH, SKY_HEIGHT, SKY_FPS, CAT_LAYER_TRAIL_LENGTH } from "./sky.ts";
import { catPanLayerSections, catPanLayerWidth, PAN_PAD } from "./excursion.ts";
import { HOME_SECTION } from "./pan.ts";
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

export const NYAN_APPLICATION_NAME = "nyan_cat";
const APPLICATION_NAME = NYAN_APPLICATION_NAME;
const FRAME_INTERVAL_MS = 150;
const FLYING_STEP_PX = 2;
/** The cat layer's element id; the control server switches this element's section (see pan.ts). */
export const NYAN_CAT_ELEMENT_ID = "cat";

/** Element x of the cat layer: the cat's home spot, less the trail baked to its left, less the pan padding. The element never moves. */
export function nyanHomeElementX(): number {
  return skyCatOrigin().x - (CAT_LAYER_TRAIL_LENGTH - CAT_TRAIL_OVERLAP) - PAN_PAD;
}

interface EncodedAssets {
  stars: Uint8Array;
  cat: Uint8Array;
  names: { stars: string; cat: string };
}

let encodedAssets: EncodedAssets | null = null;

/** First 8 hex digits of the SHA-1 of `bytes`. */
function contentHash(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("sha1").update(bytes).digest("hex").slice(0, 8);
}

/**
 * The two layer assets, encoded once per process. Their file names carry a
 * content hash, so a device that already holds them (a previous run of the
 * same code) needs no re-upload — the cat layer with its pan sections is
 * ~8 MB and takes ~20 s over the USB link.
 */
function assets(): EncodedAssets {
  if (encodedAssets) return encodedAssets;
  const stars = encodeAnimFile({ width: SKY_WIDTH, height: SKY_HEIGHT, fps: SKY_FPS, frames: starLayerFrames() });
  const cat = encodeAnimFile({ width: catPanLayerWidth(), height: CAT_HEIGHT, fps: SKY_FPS, sections: catPanLayerSections() });
  encodedAssets = { stars, cat, names: { stars: `nyan-stars-${contentHash(stars)}.anim`, cat: `nyan-cat-${contentHash(cat)}.anim` } };
  return encodedAssets;
}

/** The asset file names this build draws with. */
export function nyanAssetNames(): { stars: string; cat: string } {
  return assets().names;
}

/**
 * The cat layer element playing `section`. `await_previous_end` queues the
 * change behind whatever is playing (on the loop boundary when it loops),
 * which both keeps the run cycle unbroken and is how the pan excursions
 * splice in seamlessly (excursion.ts).
 */
export function nyanCatLayerElement(section: string, loop: boolean, awaitPreviousEnd: boolean): Record<string, unknown> {
  return {
    id: NYAN_CAT_ELEMENT_ID,
    type: "animation",
    path: assets().names.cat,
    section,
    loop,
    ...(awaitPreviousEnd ? { await_previous_end: true } : {}),
    x: nyanHomeElementX(),
    y: skyCatOrigin().y,
    z_index: 2,
    display: "front",
  };
}

/** Queues `section` of the cat layer to play after the current one ends; the pan's only device call. */
export async function playNyanCatSection(baseUrl: string, section: string, loop: boolean, fetchImpl: typeof fetch = fetch): Promise<void> {
  await drawElements(baseUrl, { application_name: APPLICATION_NAME, priority: DRAW_PRIORITY, elements: [nyanCatLayerElement(section, loop, true)] }, fetchImpl);
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
  // (with its pan excursions as extra sections) in front of it. Upload only
  // what the device doesn't already hold, and drop this app's stale builds.
  const { stars, cat, names } = assets();
  const present = new Set((await listStorage(baseUrl, assetStoragePath(APPLICATION_NAME), fetchImpl)).filter((e) => e.type === "file").map((e) => e.name));
  let uploaded = false;
  for (const [name, bytes] of [[names.stars, stars], [names.cat, cat]] as const) {
    if (present.has(name)) continue;
    await uploadAsset(baseUrl, APPLICATION_NAME, name, bytes, fetchImpl);
    uploaded = true;
  }
  if (uploaded && settleMs > 0) await new Promise((resolve) => setTimeout(resolve, settleMs));

  await drawFrame(
    baseUrl,
    {
      application_name: APPLICATION_NAME,
      priority: DRAW_PRIORITY,
      elements: [
        { id: "stars", type: "animation", path: names.stars, loop: true, x: 0, y: 0, z_index: 1, display: "front" },
        nyanCatLayerElement(HOME_SECTION, true, false),
      ],
    },
    fetchImpl
  );

  // Only now drop this app's stale builds: the new draw references the new
  // files, so nothing on the display can still hold an old one open.
  // Removing an asset that an element is playing wedges the device's HTTP
  // server until a USB power cycle (happened live 2026-11-08).
  for (const name of present) {
    if (/^nyan-(stars|cat)-[0-9a-f]{8}\.anim$/.test(name) && name !== names.stars && name !== names.cat) {
      await removeStorageFile(baseUrl, assetStoragePath(APPLICATION_NAME, name), fetchImpl);
    }
  }
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
