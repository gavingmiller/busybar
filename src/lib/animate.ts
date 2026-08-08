import {
  drawElements,
  clearDisplay,
  clearAllDisplays,
  type DisplayDrawPayload,
} from "./busybar-client.ts";

export interface AnimationHandle {
  /** Stops drawing further frames and clears the app's elements. */
  stop: () => Promise<void>;
}

export interface RunAnimationOptions {
  intervalMs: number;
  fetchImpl?: typeof fetch;
  /**
   * Clear this app's own elements before every frame, not just at the
   * start. `/api/display/draw` upserts elements by id rather than
   * replacing the scene, so an animation whose merged-element ids shift
   * from frame to frame (e.g. the nyan-cat rainbow trail's old client-side
   * wave animation, whose run-length-encoded shapes changed as the wave's
   * phase advanced) otherwise accumulates stale elements from every prior
   * frame until the device rejects the draw with "Elements number limit
   * exceeded". Note: even with this on, a DELETE always leaves a real gap
   * where this app has zero elements — a lower-priority app can flash
   * through during it. That's exactly why the rainbow trail moved to a
   * native looping .anim asset (see nyan-cat/index.ts's runRainbow)
   * instead of using this option; prefer that pattern over clearEachFrame
   * for anything where the flash would be visible.
   *
   * Off by default: it doubles the request rate against the device, and
   * confirmed live against the device, doubling from ~6.7req/s to
   * ~13.3req/s (150ms interval, 2 requests/frame) got the whole device
   * rejecting requests with 508 "Resource Limit Reached". Only turn this
   * on for animations that actually need it, and pair it with a slower
   * interval so the extra request doesn't push the total rate too high.
   */
  clearEachFrame?: boolean;
}

/**
 * Clears `applicationName`'s prior draw, then repeatedly calls
 * `frameFn(tick)` on `intervalMs` and draws the result, starting at tick 0.
 * A frame that fails to draw is logged and skipped rather than killing the
 * loop — one dropped frame in an animation shouldn't stop the rest.
 */
export async function runAnimation(
  baseUrl: string,
  applicationName: string,
  frameFn: (tick: number) => DisplayDrawPayload,
  options: RunAnimationOptions
): Promise<AnimationHandle> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const clearEachFrame = options.clearEachFrame ?? false;

  await clearAllDisplays(baseUrl, fetchImpl);

  let tick = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let currentRun: Promise<void> = Promise.resolve();

  // A self-scheduling loop rather than setInterval: the next frame is only
  // scheduled once this one's requests have finished, so a slow frame can
  // never overlap with the next. Confirmed live against the device that
  // overlapping requests can arrive out of order — a late clear/draw pair
  // landing after the next frame's already fired reintroduces stale
  // elements even with clearEachFrame on, eventually hitting "Elements
  // number limit exceeded" again.
  const runFrame = async (): Promise<void> => {
    try {
      if (clearEachFrame) {
        await clearDisplay(baseUrl, applicationName, fetchImpl);
      }
      await drawElements(baseUrl, frameFn(tick), fetchImpl);
    } catch (err) {
      console.error(`[animate:${applicationName}] frame draw failed: ${err instanceof Error ? err.message : err}`);
    }
    tick++;
    if (!stopped) {
      timer = setTimeout(() => {
        currentRun = runFrame();
      }, options.intervalMs);
    }
  };
  timer = setTimeout(() => {
    currentRun = runFrame();
  }, options.intervalMs);

  return {
    stop: async () => {
      stopped = true;
      clearTimeout(timer);
      await currentRun; // let any in-flight frame finish before the final clear
      await clearDisplay(baseUrl, applicationName, fetchImpl);
    },
  };
}

/** Wires SIGINT/SIGTERM to stop an animation and exit cleanly. */
export function installShutdownHandler(handle: AnimationHandle): void {
  const shutdown = async () => {
    await handle.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
