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
});

describe("drawHelloWorld", () => {
  it("POSTs the hello-world payload to <baseUrl>/api/display/draw", async () => {
    const fetchMock = mock(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    await drawHelloWorld("http://10.0.4.20", fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://10.0.4.20/api/display/draw");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual(helloWorldPayload());
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
