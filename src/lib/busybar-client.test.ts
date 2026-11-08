import { describe, it, expect, mock } from "bun:test";
import { drawElements, clearDisplay, clearAllDisplays, drawFrame, uploadAsset, listStorage, removeStorageFile } from "./busybar-client.ts";

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

describe("JS apps API", () => {
  const { listApps, launchApp, quitApp } = require("./busybar-client.ts");

  it("listApps GETs /api/apps/list and returns the apps array", async () => {
    const fetchMock = mock(async () =>
      new Response(JSON.stringify({ apps: [{ id: "community.dino_run", name: "Dino Run" }] }), { status: 200 })
    );
    const apps = await listApps("http://10.0.4.20", fetchMock as unknown as typeof fetch);
    expect(fetchMock.mock.calls[0]![0]).toBe("http://10.0.4.20/api/apps/list");
    expect(apps).toEqual([{ id: "community.dino_run", name: "Dino Run" }]);
  });

  it("launchApp POSTs /api/apps/launch with the app_id", async () => {
    const fetchMock = mock(async () => new Response(JSON.stringify({ result: "OK" }), { status: 200 }));
    await launchApp("http://10.0.4.20", "community.dino_run", fetchMock as unknown as typeof fetch);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://10.0.4.20/api/apps/launch?app_id=community.dino_run");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("launchApp throws on a non-OK status", async () => {
    const fetchMock = mock(async () => new Response(JSON.stringify({ error: "busy" }), { status: 409 }));
    await expect(launchApp("http://10.0.4.20", "x", fetchMock as unknown as typeof fetch)).rejects.toThrow(/409/);
  });

  it("quitApp POSTs /api/apps/quit and treats 409 'not running' as success", async () => {
    const fetchMock = mock(async () => new Response(JSON.stringify({ error: "Application is not running" }), { status: 409 }));
    await quitApp("http://10.0.4.20", fetchMock as unknown as typeof fetch);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://10.0.4.20/api/apps/quit");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("quitApp throws on other failures", async () => {
    const fetchMock = mock(async () => new Response(JSON.stringify({ error: "nope" }), { status: 503 }));
    await expect(quitApp("http://10.0.4.20", fetchMock as unknown as typeof fetch)).rejects.toThrow(/503/);
  });
});

describe("storage", () => {

  it("listStorage GETs the directory listing and returns its entries", async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    const fetchMock = mock(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method });
      return new Response(JSON.stringify({ list: [{ type: "file", name: "a.anim", size: 12 }, { type: "dir", name: "x" }] }), { status: 200 });
    });
    const entries = await listStorage("http://10.0.4.20", "/ext/user_assets/nyan_cat", fetchMock as unknown as typeof fetch);
    expect(calls).toEqual([{ url: "http://10.0.4.20/api/storage/list?path=%2Fext%2Fuser_assets%2Fnyan_cat", method: undefined }]);
    expect(entries).toEqual([{ type: "file", name: "a.anim", size: 12 }, { type: "dir", name: "x" }]);
  });

  it("listStorage returns an empty list for a directory that does not exist yet (400)", async () => {
    const fetchMock = mock(async () => new Response(JSON.stringify({ error: "Bad Request" }), { status: 400 }));
    expect(await listStorage("http://10.0.4.20", "/ext/user_assets/nope", fetchMock as unknown as typeof fetch)).toEqual([]);
  });

  it("removeStorageFile DELETEs /api/storage/remove and throws on failure", async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    const fetchMock = mock(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method });
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });
    await removeStorageFile("http://10.0.4.20", "/ext/user_assets/nyan_cat/old.anim", fetchMock as unknown as typeof fetch);
    expect(calls).toEqual([{ url: "http://10.0.4.20/api/storage/remove?path=%2Fext%2Fuser_assets%2Fnyan_cat%2Fold.anim", method: "DELETE" }]);
    const failing = mock(async () => new Response("nope", { status: 500 }));
    await expect(removeStorageFile("http://10.0.4.20", "/x", failing as unknown as typeof fetch)).rejects.toThrow(/500/);
  });
});
