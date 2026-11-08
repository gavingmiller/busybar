// Camera "pan" excursions, baked into the cat layer's .anim as extra
// sections: the cat falls behind (drifts left), hangs there, and catches
// back up to its home spot, at the device's own frame rate. The control
// server only ever says "play this section next" (see pan.ts); it never
// moves the element over HTTP, which was capped near 9 px/s and visibly
// stepped next to the 48 fps scene (2026-11-08).
//
// Every excursion is a whole number of home loops long and starts/ends in
// the home pose, so a switch on the loop boundary (await_previous_end) is
// seamless both ways.

import type { AnimSection } from "../lib/anim-file.ts";
import { catLayerFrames, CAT_LAYER_WIDTH, SKY_FPS, SKY_FRAME_COUNT } from "./sky.ts";
import { CAT_HEIGHT } from "./sprite.ts";
import { HOME_SECTION } from "./pan.ts";

export { HOME_SECTION } from "./pan.ts";
/** Transparent padding on the layer's left: the furthest the cat ever drifts. */
export const PAN_PAD = 24;

export interface Excursion {
  name: string;
  /** How far the cat falls behind, px (≤ PAN_PAD). */
  driftPx: number;
  /** Seconds drifting out, holding at the far point, and catching up. The sum is a whole number of home loops. */
  outS: number;
  holdS: number;
  backS: number;
}

const LOOP_S = SKY_FRAME_COUNT / SKY_FPS;

export const EXCURSIONS: readonly Excursion[] = [
  // Glacial pace, ~0.5 px/s: the cat drifts, lingers, and ambles back over 8–16 home loops.
  { name: "exc_s", driftPx: 10, outS: 20.0, holdS: 6.0, backS: 8 * LOOP_S - 26.0 },
  { name: "exc_m", driftPx: 16, outS: 28.0, holdS: 8.0, backS: 12 * LOOP_S - 36.0 },
  { name: "exc_l", driftPx: PAN_PAD, outS: 40.0, holdS: 12.0, backS: 16 * LOOP_S - 52.0 },
];

export function excursionFrameCount(e: Excursion): number {
  return Math.round((e.outS + e.holdS + e.backS) * SKY_FPS);
}

export function excursionDurationMs(e: Excursion): number {
  return (excursionFrameCount(e) / SKY_FPS) * 1000;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

/** Drift (px left of home) on frame `i` of excursion `e`: eased out, flat hold, eased back, 0 at both ends. */
export function excursionDrift(e: Excursion, i: number): number {
  const t = i / SKY_FPS;
  if (t < e.outS) return Math.round(easeInOut(t / e.outS) * e.driftPx);
  if (t < e.outS + e.holdS) return e.driftPx;
  const back = (t - e.outS - e.holdS) / e.backS;
  // Reaches 0 a frame before the end so the last frame already matches home frame 0.
  const remaining = 1 - Math.min(1, back * (e.backS * SKY_FPS) / (e.backS * SKY_FPS - 1));
  return Math.round(easeInOut(remaining) * e.driftPx);
}

export function catPanLayerWidth(): number {
  return CAT_LAYER_WIDTH + PAN_PAD;
}

/** `frame` (CAT_LAYER_WIDTH wide) copied into a catPanLayerWidth()-wide transparent frame at column `offset`. */
function placed(frame: Uint8Array, offset: number): Uint8Array {
  const w = catPanLayerWidth();
  const out = new Uint8Array(w * CAT_HEIGHT * 4);
  for (let y = 0; y < CAT_HEIGHT; y++) {
    out.set(frame.subarray(y * CAT_LAYER_WIDTH * 4, (y + 1) * CAT_LAYER_WIDTH * 4), (y * w + offset) * 4);
  }
  return out;
}

/** The cat layer as sections: the home loop first, then one section per excursion. */
export function catPanLayerSections(): AnimSection[] {
  const home = catLayerFrames();
  return [
    { name: HOME_SECTION, frames: home.map((f) => placed(f, PAN_PAD)) },
    ...EXCURSIONS.map((e) => ({
      name: e.name,
      frames: Array.from({ length: excursionFrameCount(e) }, (_, i) => placed(home[i % SKY_FRAME_COUNT]!, PAN_PAD - excursionDrift(e, i))),
    })),
  ];
}
