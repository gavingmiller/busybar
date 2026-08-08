import { describe, it, expect, mock } from "bun:test";
import { runAnimation } from "./animate.ts";

function payloadFor(tick: number) {
  return { application_name: "test_app", elements: [{ id: "0", tick }] };
}

describe("runAnimation", () => {
  it("clears every app (not just this one) before drawing the first frame", async () => {
    // A different app's leftover draw can block a fresh draw even at max
    // priority (confirmed live against the device) — see drawFrame in
    // busybar-client.ts. The initial clear needs to be unscoped too.
    const calls: Array<{ url: string; method: string }> = [];
    const fetchMock = mock(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method! });
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });

    const handle = await runAnimation("http://10.0.4.20", "test_app", payloadFor, {
      intervalMs: 10_000, // long enough that no tick fires during this test
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(calls[0]).toEqual({ url: "http://10.0.4.20/api/display/draw", method: "DELETE" });

    await handle.stop();
  });

  it("draws successive frames from frameFn(tick) on the given interval", async () => {
    const draws: number[] = [];
    const fetchMock = mock(async (url: string, init: RequestInit) => {
      if (init.method === "POST") {
        const body = JSON.parse(init.body as string);
        draws.push(body.elements[0].tick);
      }
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });

    const handle = await runAnimation("http://10.0.4.20", "test_app", payloadFor, {
      intervalMs: 5,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await new Promise((resolve) => setTimeout(resolve, 35));
    await handle.stop();

    expect(draws.length).toBeGreaterThanOrEqual(3);
    expect(draws).toEqual([...draws].sort((a, b) => a - b)); // strictly increasing ticks, in order
  });

  it("with clearEachFrame, clears this app's own elements before each frame draw, not just at the start", async () => {
    // /api/display/draw upserts elements by id rather than replacing the
    // scene (see drawFrame's docstring in busybar-client.ts). An animation
    // whose merged-element ids shift from frame to frame — e.g. a rainbow
    // trail whose run-length-encoded shapes change as the wave's phase
    // advances — otherwise accumulates stale elements from every prior
    // frame until the device rejects the draw with "Elements number limit
    // exceeded". Opt-in only (see RunAnimationOptions) — doubling the
    // request rate to get this safety tripped the device's own rate
    // limiting (508 "Resource Limit Reached") when tried at 150ms/frame.
    const calls: Array<{ url: string; method: string }> = [];
    const fetchMock = mock(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method! });
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });

    const handle = await runAnimation("http://10.0.4.20", "test_app", payloadFor, {
      intervalMs: 5,
      clearEachFrame: true,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await handle.stop();

    const perFrame = calls.slice(1); // drop the initial unscoped clear-everything
    for (let i = 0; i < perFrame.length; i++) {
      if (perFrame[i]!.method === "POST") {
        expect(perFrame[i - 1]).toEqual({
          url: "http://10.0.4.20/api/display/draw?application_name=test_app",
          method: "DELETE",
        });
      }
    }
    expect(perFrame.filter((c) => c.method === "POST").length).toBeGreaterThan(0);
  });

  it("without clearEachFrame (the default), does not clear between frames", async () => {
    const calls: Array<{ method: string }> = [];
    const fetchMock = mock(async (_url: string, init: RequestInit) => {
      calls.push({ method: init.method! });
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });

    const handle = await runAnimation("http://10.0.4.20", "test_app", payloadFor, {
      intervalMs: 5,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await handle.stop();

    const perFrame = calls.slice(1, -1); // drop the initial clear and stop()'s own clear
    expect(perFrame.length).toBeGreaterThan(0);
    expect(perFrame.every((c) => c.method === "POST")).toBe(true);
  });

  it("never starts a new frame's requests before the previous frame's finished, even if a frame is slower than the interval", async () => {
    // Confirmed live against the device: with clearEachFrame, a fixed-clock
    // setInterval let a slow frame's clear+draw overlap with the next
    // frame's, so a late-arriving draw from frame N could land *after*
    // frame N+1's clear — silently reintroducing the exact stale-element
    // accumulation clearEachFrame exists to prevent, eventually hitting
    // "Elements number limit exceeded" again despite clearing every frame.
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchMock = mock(async (_url: string, _init: RequestInit) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20)); // slower than the interval below
      inFlight--;
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });

    const handle = await runAnimation("http://10.0.4.20", "test_app", payloadFor, {
      intervalMs: 5,
      clearEachFrame: true,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await new Promise((resolve) => setTimeout(resolve, 70));
    await handle.stop();

    expect(maxInFlight).toBe(1);
  });

  it("stop() halts further frames and clears the display", async () => {
    const calls: Array<{ method: string }> = [];
    const fetchMock = mock(async (_url: string, init: RequestInit) => {
      calls.push({ method: init.method! });
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });

    const handle = await runAnimation("http://10.0.4.20", "test_app", payloadFor, {
      intervalMs: 5,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await handle.stop();
    const countAtStop = calls.length;

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(calls.length).toBe(countAtStop); // nothing fired after stop
    expect(calls[calls.length - 1]!.method).toBe("DELETE"); // stop() itself cleared
  });

  it("a failed frame draw is logged, not thrown, and doesn't kill the loop", async () => {
    let call = 0;
    const fetchMock = mock(async (_url: string, init: RequestInit) => {
      if (init.method === "POST") {
        call++;
        if (call === 1) return new Response("boom", { status: 500 });
      }
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });
    const errors: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => errors.push(args);

    const handle = await runAnimation("http://10.0.4.20", "test_app", payloadFor, {
      intervalMs: 5,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    await handle.stop();

    console.error = originalError;
    expect(errors.length).toBeGreaterThan(0);
    expect(call).toBeGreaterThan(1); // kept drawing after the failure
  });
});
