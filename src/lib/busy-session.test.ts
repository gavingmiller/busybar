import { describe, it, expect, mock } from "bun:test";
import { getBusySnapshot, isSessionActive, watchBusySessionActive, type BusySnapshot } from "./busy-session.ts";

function snapshot(inner: BusySnapshot["snapshot"]): BusySnapshot {
  return { snapshot: inner, snapshot_timestamp_ms: 0 };
}

describe("isSessionActive", () => {
  it("is false when no session has been started", () => {
    expect(isSessionActive(snapshot({ type: "NOT_STARTED" }))).toBe(false);
  });

  it("is true for a running, unpaused session (any type)", () => {
    expect(isSessionActive(snapshot({ type: "INFINITE", card_id: "x", is_paused: false }))).toBe(true);
    expect(isSessionActive(snapshot({ type: "SIMPLE", card_id: "x", time_left_ms: 1, is_paused: false }))).toBe(
      true
    );
    expect(
      isSessionActive(
        snapshot({
          type: "INTERVAL",
          card_id: "x",
          current_interval: 1,
          current_interval_time_total_ms: 1,
          current_interval_time_left_ms: 1,
          is_paused: false,
        })
      )
    ).toBe(true);
  });

  it("is false when the running session is paused — BUSY Bar's own Start/Pause button pauses (not ends) an active session on a second press, per docs/bar/basics/controls.md", () => {
    expect(isSessionActive(snapshot({ type: "INFINITE", card_id: "x", is_paused: true }))).toBe(false);
  });
});

describe("getBusySnapshot", () => {
  it("fetches and parses /api/busy/snapshot", async () => {
    const fetchMock = mock(
      async () => new Response(JSON.stringify(snapshot({ type: "NOT_STARTED" })), { status: 200 })
    );
    const result = await getBusySnapshot("http://10.0.4.20", fetchMock as unknown as typeof fetch);
    expect(result.snapshot.type).toBe("NOT_STARTED");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://10.0.4.20/api/busy/snapshot");
  });

  it("throws on a non-ok response", async () => {
    const fetchMock = mock(async () => new Response("boom", { status: 500 }));
    await expect(getBusySnapshot("http://10.0.4.20", fetchMock as unknown as typeof fetch)).rejects.toThrow();
  });
});

describe("watchBusySessionActive", () => {
  it("calls onChange once immediately with the initial state, then only on actual changes", async () => {
    const states: BusySnapshot["snapshot"][] = [
      { type: "NOT_STARTED" }, // initial: inactive
      { type: "INFINITE", card_id: "x", is_paused: false }, // -> active
      { type: "INFINITE", card_id: "x", is_paused: false }, // no change
      { type: "INFINITE", card_id: "x", is_paused: true }, // paused -> inactive
      { type: "NOT_STARTED" }, // still inactive, no change
    ];
    let call = 0;
    const fetchMock = mock(async () => {
      const state = states[Math.min(call, states.length - 1)]!;
      call++;
      return new Response(JSON.stringify(snapshot(state)), { status: 200 });
    });

    const seen: boolean[] = [];
    const handle = watchBusySessionActive("http://10.0.4.20", (active) => seen.push(active), {
      intervalMs: 5,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await new Promise((resolve) => setTimeout(resolve, 45));
    await handle.stop();

    expect(seen).toEqual([false, true, false]);
  });

  it("stop() halts further polling", async () => {
    let calls = 0;
    const fetchMock = mock(async () => {
      calls++;
      return new Response(JSON.stringify(snapshot({ type: "NOT_STARTED" })), { status: 200 });
    });
    const handle = watchBusySessionActive("http://10.0.4.20", () => {}, {
      intervalMs: 5,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await new Promise((resolve) => setTimeout(resolve, 15));
    await handle.stop();
    const countAtStop = calls;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toBe(countAtStop);
  });

  it("a failed poll is logged, not thrown, and doesn't kill the loop", async () => {
    let call = 0;
    const fetchMock = mock(async () => {
      call++;
      if (call === 1) return new Response("boom", { status: 500 });
      return new Response(JSON.stringify(snapshot({ type: "NOT_STARTED" })), { status: 200 });
    });
    const errors: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => errors.push(args);

    const handle = watchBusySessionActive("http://10.0.4.20", () => {}, {
      intervalMs: 5,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    await handle.stop();

    console.error = originalError;
    expect(errors.length).toBeGreaterThan(0);
    expect(call).toBeGreaterThan(1);
  });

  it("never overlaps polls — a slow poll delays the next one rather than racing it", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = mock(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight--;
      return new Response(JSON.stringify(snapshot({ type: "NOT_STARTED" })), { status: 200 });
    });

    const handle = watchBusySessionActive("http://10.0.4.20", () => {}, {
      intervalMs: 5,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    await handle.stop();

    expect(maxInFlight).toBe(1);
  });
});
