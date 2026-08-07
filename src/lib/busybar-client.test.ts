import { describe, it, expect, mock } from "bun:test";
import { drawElements, clearDisplay } from "./busybar-client.ts";

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
