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
