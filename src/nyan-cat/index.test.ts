import { describe, it, expect, mock } from "bun:test";
import { runStationary } from "./index.ts";

describe("runStationary", () => {
  it("clears every app's prior draw before drawing the current frame", async () => {
    // The device's draw endpoint upserts elements by id rather than
    // replacing the whole scene — a stale element from a previous,
    // differently-shaped draw (e.g. after editing the sprite) sticks around
    // until explicitly cleared. Scoping the clear to just nyan_cat isn't
    // enough either: confirmed live that a *different* app's leftover draw
    // can block this one even at max priority, so drawFrame clears
    // everything, not just this app's own name (see busybar-client.ts).
    const calls: Array<{ url: string; method: string }> = [];
    const fetchMock = mock(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method! });
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });

    await runStationary("http://10.0.4.20", fetchMock as unknown as typeof fetch);

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
