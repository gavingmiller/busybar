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

  await clearAllDisplays(baseUrl, fetchImpl);

  let tick = 0;
  const interval = setInterval(() => {
    drawElements(baseUrl, frameFn(tick), fetchImpl).catch((err) =>
      console.error(`[animate:${applicationName}] frame draw failed: ${err instanceof Error ? err.message : err}`)
    );
    tick++;
  }, options.intervalMs);

  return {
    stop: async () => {
      clearInterval(interval);
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
