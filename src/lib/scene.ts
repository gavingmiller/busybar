// A full-display looping animation rendered ahead of time and played by the
// bar's own firmware (see anim-file.ts). Scenes are pure: `frames()` returns
// every frame of one seamless loop as opaque RGBA, FRONT_WIDTH*FRONT_HEIGHT*4
// bytes each; runScene (below) encodes, uploads and draws it.

export const FRONT_WIDTH = 72;
export const FRONT_HEIGHT = 16;

export interface Scene {
  /** Control-server app id and device application_name, e.g. "lava_lamp" (snake_case). */
  id: string;
  /** Display name, Title Case, e.g. "Lava Lamp". */
  name: string;
  /** Playback rate the frames were rendered for; 24–48. */
  fps: number;
  /** One seamless loop: frame N-1 flows into frame 0. */
  frames(): Uint8Array[];
  /** Debug-only: reachable by id but hidden from the control page and from Shuffle (the Character Picks line-up). */
  debug?: boolean;
}

import { encodeAnimFile } from "./anim-file.ts";
import { DRAW_PRIORITY } from "./display.ts";
import { assetStoragePath, clearAllDisplays, drawElements, listStorage, removeStorageFile, uploadAsset } from "./busybar-client.ts";

/** Mirrors the firmware's own upload-then-draw integration test (see nyan-cat/index.ts). */
export const SCENE_ASSET_SETTLE_MS = 1000;
export const SCENE_ELEMENT_ID = "scene";

const encoded = new WeakMap<Scene, { bytes: Uint8Array; name: string }>();

/** Encodes `scene` once per process; the file name carries a content hash so unchanged renders are reused on the device. */
function encodeScene(scene: Scene): { bytes: Uint8Array; name: string } {
  const hit = encoded.get(scene);
  if (hit) return hit;
  const frames = scene.frames();
  const expected = FRONT_WIDTH * FRONT_HEIGHT * 4;
  frames.forEach((f, i) => {
    if (f.length !== expected) throw new Error(`scene "${scene.id}": frame ${i} has ${f.length} bytes, expected ${expected} for 72x16 RGBA`);
  });
  const bytes = encodeAnimFile({ width: FRONT_WIDTH, height: FRONT_HEIGHT, fps: scene.fps, frames });
  const hash = new Bun.CryptoHasher("sha1").update(bytes).digest("hex").slice(0, 8);
  const out = { bytes, name: `${scene.id}-${hash}.anim` };
  encoded.set(scene, out);
  return out;
}

export function sceneAssetName(scene: Scene): string {
  return encodeScene(scene).name;
}

/**
 * Puts `scene` on the front display, looping natively: clear everything,
 * upload the render unless the device already holds it, draw it, and only
 * then drop this scene's stale renders (removing an asset something is still
 * playing wedges the device's HTTP server until a USB power cycle).
 */
export async function runScene(baseUrl: string, scene: Scene, fetchImpl: typeof fetch = fetch, settleMs: number = SCENE_ASSET_SETTLE_MS): Promise<void> {
  const { bytes, name } = encodeScene(scene);
  await clearAllDisplays(baseUrl, fetchImpl);
  const present = (await listStorage(baseUrl, assetStoragePath(scene.id), fetchImpl)).filter((e) => e.type === "file").map((e) => e.name);
  if (!present.includes(name)) {
    await uploadAsset(baseUrl, scene.id, name, bytes, fetchImpl);
    if (settleMs > 0) await new Promise((resolve) => setTimeout(resolve, settleMs));
  }
  await drawElements(baseUrl, {
    application_name: scene.id,
    priority: DRAW_PRIORITY,
    elements: [{ id: SCENE_ELEMENT_ID, type: "animation", path: name, loop: true, x: 0, y: 0, z_index: 1, display: "front" } as never],
  }, fetchImpl);
  const stale = new RegExp(`^${scene.id}-[0-9a-f]{8}\\.anim$`);
  for (const file of present) {
    if (file !== name && stale.test(file)) await removeStorageFile(baseUrl, assetStoragePath(scene.id, file), fetchImpl);
  }
}
