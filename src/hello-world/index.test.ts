import { describe, it, expect, mock } from "bun:test";
import { helloWorldPayload, drawHelloWorld } from "./index.ts";

describe("helloWorldPayload", () => {
  it("draws a single text element saying Hello, World! on the front display", () => {
    const payload = helloWorldPayload();

    expect(payload.application_name).toBe("hello_world");
    expect(payload.elements).toHaveLength(1);

    const [el] = payload.elements;
    expect(el.type).toBe("text");
    expect(el.text).toBe("Hello, World!");
    expect(el.display).toBe("front");
    expect(el.align).toBe("center");
    expect(el.id).toBeTruthy();

    // Front display is 72x16px. `align: center` anchors the element's
    // center point at (x, y) — omitting x/y defaults to (0, 0), pushing the
    // text off the top-left edge of the screen. Anchor at the true center.
    expect(el.x).toBe(36);
    expect(el.y).toBe(8);
  });

  it("draws at high priority so it can preempt an active work session (priority 90)", () => {
    expect(helloWorldPayload().priority).toBeGreaterThan(90);
    expect(helloWorldPayload().priority).toBeLessThanOrEqual(100);
  });
});

describe("drawHelloWorld", () => {
  it("clears every app's prior draw before drawing, then POSTs the payload", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchMock = mock(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method! });
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    await drawHelloWorld("http://10.0.4.20", fetchMock as unknown as typeof fetch);

    expect(calls).toEqual([
      { url: "http://10.0.4.20/api/display/draw", method: "DELETE" },
      { url: "http://10.0.4.20/api/display/draw", method: "POST" },
    ]);
  });

  it("throws with the response body when the device rejects the request", async () => {
    const fetchMock = mock(async () =>
      new Response(JSON.stringify({ error: "bad request" }), { status: 400 })
    );

    await expect(
      drawHelloWorld("http://10.0.4.20", fetchMock as unknown as typeof fetch)
    ).rejects.toThrow(/400/);
  });
});
