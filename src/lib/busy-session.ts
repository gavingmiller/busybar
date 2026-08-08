export interface BusySnapshot {
  snapshot: {
    type: "NOT_STARTED" | "INFINITE" | "SIMPLE" | "INTERVAL";
    is_paused?: boolean;
    [key: string]: unknown;
  };
  snapshot_timestamp_ms: number;
}

export async function getBusySnapshot(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<BusySnapshot> {
  const res = await fetchImpl(`${baseUrl}/api/busy/snapshot`);
  if (!res.ok) {
    throw new Error(`BUSY Bar rejected busy snapshot request: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as BusySnapshot;
}

/**
 * Whether BUSY Bar's own focus-timer session is actively running (and not
 * paused) right now. Per docs/bar/basics/controls.md, the physical
 * Start/Pause button starts a session from idle (NOT_STARTED -> a running
 * type) on a first press, then *pauses* (not ends) that session on a second
 * press (is_paused: true) — it doesn't return to NOT_STARTED. Treating
 * "running and unpaused" as the single active/inactive boolean gives a
 * natural two-press toggle: press once to start (active), press again to
 * pause (inactive) — matching "push the button, X stops; push it again, X
 * resumes" without needing to fully end the session.
 */
export function isSessionActive(snapshot: BusySnapshot): boolean {
  return snapshot.snapshot.type !== "NOT_STARTED" && snapshot.snapshot.is_paused !== true;
}

export interface BusySessionWatchOptions {
  intervalMs: number;
  fetchImpl?: typeof fetch;
}

export interface BusySessionWatchHandle {
  /** Stops polling. Waits for any in-flight poll to finish first. */
  stop: () => Promise<void>;
}

/**
 * Polls `/api/busy/snapshot` on `intervalMs` and calls `onChange(active)`
 * whenever `isSessionActive()` changes — including once immediately for the
 * initial state, so callers don't need special-case startup logic. A
 * self-scheduling loop (next poll only scheduled once the current one
 * finishes) rather than setInterval, so a slow poll can't overlap with the
 * next one — see the same lesson in animate.ts's runAnimation.
 */
export function watchBusySessionActive(
  baseUrl: string,
  onChange: (active: boolean) => void,
  options: BusySessionWatchOptions
): BusySessionWatchHandle {
  const fetchImpl = options.fetchImpl ?? fetch;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let currentPoll: Promise<void> = Promise.resolve();
  let lastActive: boolean | undefined;

  const poll = async (): Promise<void> => {
    try {
      const snapshot = await getBusySnapshot(baseUrl, fetchImpl);
      const active = isSessionActive(snapshot);
      if (active !== lastActive) {
        lastActive = active;
        onChange(active);
      }
    } catch (err) {
      console.error(`[busy-session] poll failed: ${err instanceof Error ? err.message : err}`);
    }
    if (!stopped) {
      timer = setTimeout(() => {
        currentPoll = poll();
      }, options.intervalMs);
    }
  };
  currentPoll = poll();

  return {
    stop: async () => {
      stopped = true;
      clearTimeout(timer);
      await currentPoll;
    },
  };
}
