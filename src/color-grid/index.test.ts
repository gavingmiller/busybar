import { describe, it, expect, mock } from "bun:test";
import { drawColorGrid } from "./index.ts";

describe("drawColorGrid", () => {
  it("clears every app's prior draw before drawing the current frame", async () => {
    // Same lesson as nyan-cat: /api/display/draw upserts by id rather than
    // replacing the scene, and scoping the clear to just this app's own
    // name isn't enough — a different app's leftover draw can block this
    // one even at max priority, confirmed live. drawFrame clears
    // everything (see busybar-client.ts).
    const calls: Array<{ url: string; method: string }> = [];
    const fetchMock = mock(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method! });
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });

    await drawColorGrid("http://10.0.4.20", fetchMock as unknown as typeof fetch);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      url: "http://10.0.4.20/api/display/draw",
      method: "DELETE",
    });
    expect(calls[1]).toEqual({
      url: "http://10.0.4.20/api/display/draw",
      method: "POST",
    });
  });
});
