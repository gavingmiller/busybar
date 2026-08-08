import { describe, it, expect, mock } from "bun:test";
import { drawElements, clearDisplay, clearAllDisplays, drawFrame, uploadAsset } from "./busybar-client.ts";

describe("drawElements", () => {
  it("POSTs the payload to <baseUrl>/api/display/draw", async () => {
    const fetchMock = mock(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    const payload = { application_name: "test_app", elements: [{ id: "0", type: "text" }] };

    await drawElements("http://10.0.4.20", payload, fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://10.0.4.20/api/display/draw");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it("throws with the response body when the device rejects the request", async () => {
    const fetchMock = mock(async () =>
      new Response(JSON.stringify({ error: "bad request" }), { status: 400 })
    );

    await expect(
      drawElements(
        "http://10.0.4.20",
        { application_name: "test_app", elements: [] },
        fetchMock as unknown as typeof fetch
      )
    ).rejects.toThrow(/400/);
  });
});

describe("drawFrame", () => {
  it("clears every app's prior draw before drawing the new one, in order", async () => {
    // /api/display/draw upserts elements by id rather than replacing the
    // scene, so a stale element from a differently-shaped prior draw
    // otherwise lingers. Scoping the clear to just this payload's own
    // application_name isn't enough, either: confirmed live against the
    // device that a DIFFERENT app's leftover draw can block a fresh
    // application_name's draw even at equal max priority (100), despite
    // the OpenAPI spec claiming equal-priority + different app_name should
    // override. An unscoped DELETE (no application_name) reliably clears
    // everything and avoids this regardless of which app drew previously.
    const calls: Array<{ url: string; method: string }> = [];
    const fetchMock = mock(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method! });
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });
    const payload = { application_name: "test_app", elements: [{ id: "0", type: "text" }] };

    await drawFrame("http://10.0.4.20", payload, fetchMock as unknown as typeof fetch);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({ url: "http://10.0.4.20/api/display/draw", method: "DELETE" });
    expect(calls[1]).toEqual({ url: "http://10.0.4.20/api/display/draw", method: "POST" });
  });
});

describe("clearAllDisplays", () => {
  it("DELETEs <baseUrl>/api/display/draw with no application_name filter", async () => {
    const fetchMock = mock(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ result: "OK" }), { status: 200 })
    );

    await clearAllDisplays("http://10.0.4.20", fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://10.0.4.20/api/display/draw");
    expect(init.method).toBe("DELETE");
  });

  it("throws with the response body when the device rejects the request", async () => {
    const fetchMock = mock(async () =>
      new Response(JSON.stringify({ error: "bad request" }), { status: 400 })
    );

    await expect(
      clearAllDisplays("http://10.0.4.20", fetchMock as unknown as typeof fetch)
    ).rejects.toThrow(/400/);
  });
});

describe("clearDisplay", () => {
  it("DELETEs <baseUrl>/api/display/draw scoped to the app", async () => {
    const fetchMock = mock(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    await clearDisplay("http://10.0.4.20", "nyan_cat", fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://10.0.4.20/api/display/draw?application_name=nyan_cat");
    expect(init.method).toBe("DELETE");
  });

  it("throws with the response body when the device rejects the request", async () => {
    const fetchMock = mock(async () =>
      new Response(JSON.stringify({ error: "bad request" }), { status: 400 })
    );

    await expect(
      clearDisplay("http://10.0.4.20", "nyan_cat", fetchMock as unknown as typeof fetch)
    ).rejects.toThrow(/400/);
  });
});

describe("uploadAsset", () => {
  it("POSTs raw bytes to /api/assets/upload with application_name and file query params", async () => {
    const fetchMock = mock(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ result: "OK" }), { status: 200 })
    );
    const bytes = new Uint8Array([1, 2, 3, 4]);

    await uploadAsset(
      "http://10.0.4.20",
      "nyan_cat",
      "trail.anim",
      bytes,
      fetchMock as unknown as typeof fetch
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://10.0.4.20/api/assets/upload?application_name=nyan_cat&file=trail.anim");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/octet-stream" });
    expect(init.body).toBe(bytes);
  });

  it("throws with the response body when the device rejects the upload", async () => {
    const fetchMock = mock(async () =>
      new Response(JSON.stringify({ error: "bad request" }), { status: 400 })
    );

    await expect(
      uploadAsset(
        "http://10.0.4.20",
        "nyan_cat",
        "trail.anim",
        new Uint8Array([1]),
        fetchMock as unknown as typeof fetch
      )
    ).rejects.toThrow(/400/);
  });
});
