import { describe, it, expect, mock } from "bun:test";
import { runStationary, runRainbow, runRainbowToggle } from "./index.ts";

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

describe("runRainbow", () => {
  // The old client-side polling loop (repeated clear+draw) flashed the
  // device's built-in idle app through the gap between our own DELETE and
  // POST calls. The rainbow trail is now a native looping .anim asset:
  // upload once, draw once (cat as static rectangles + the trail as a
  // single AnimationElement referencing the uploaded asset), and the
  // device handles looping forever with no further requests from us.
  it("uploads the trail as a .anim asset, then draws the cat + a looping AnimationElement referencing it", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const fetchMock = mock(async (url: string, init: RequestInit) => {
      calls.push({
        url,
        method: init.method!,
        body: init.body instanceof Uint8Array ? init.body : init.body ? JSON.parse(init.body as string) : undefined,
      });
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });

    await runRainbow("http://10.0.4.20", fetchMock as unknown as typeof fetch, 0);

    const uploadCall = calls.find((c) => c.url.startsWith("http://10.0.4.20/api/assets/upload"));
    expect(uploadCall).toBeDefined();
    expect(uploadCall!.method).toBe("POST");
    expect(uploadCall!.url).toMatch(/application_name=nyan_cat/);
    expect(uploadCall!.url).toMatch(/file=.+\.anim/);
    expect(uploadCall!.body).toBeInstanceOf(Uint8Array);
    expect((uploadCall!.body as Uint8Array).length).toBeGreaterThan(0);

    const drawCalls = calls.filter((c) => c.url === "http://10.0.4.20/api/display/draw");
    expect(drawCalls).toHaveLength(2); // unscoped clear, then draw
    expect(drawCalls[0]!.method).toBe("DELETE");
    expect(drawCalls[1]!.method).toBe("POST");

    const payload = drawCalls[1]!.body as { application_name: string; elements: Array<Record<string, unknown>> };
    expect(payload.application_name).toBe("nyan_cat");

    const catRects = payload.elements.filter((el) => el.type === "rectangle");
    expect(catRects.length).toBeGreaterThan(0);

    const animationEls = payload.elements.filter((el) => el.type === "animation");
    expect(animationEls).toHaveLength(1);
    expect(animationEls[0]).toMatchObject({ loop: true, display: "front" });
    expect(typeof animationEls[0]!.path).toBe("string");

    // The upload must happen before the draw references it.
    const uploadIndex = calls.indexOf(uploadCall!);
    const drawIndex = calls.indexOf(drawCalls[1]!);
    expect(uploadIndex).toBeLessThan(drawIndex);
  });
});

describe("runRainbowToggle", () => {
  // BUSY Bar's own physical Start/Pause button starts a focus session from
  // idle (NOT_STARTED -> a running type), then pauses (not ends) it on a
  // second press (is_paused: true) — see busy-session.ts's isSessionActive.
  // This mode should react to that: clear our own elements while a session
  // is actively running (get out of the way), and redraw the already-
  // uploaded rainbow trail whenever it isn't (idle or paused) — without ever
  // re-uploading the asset.
  it("uploads once, draws once, then clears on session-active and redraws on session-inactive, never re-uploading", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    let snapshotType: "NOT_STARTED" | "INFINITE" = "NOT_STARTED";
    let isPaused = false;
    const fetchMock = mock(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      calls.push({ url, method });
      if (url.startsWith("http://10.0.4.20/api/busy/snapshot")) {
        const snapshot =
          snapshotType === "NOT_STARTED"
            ? { type: "NOT_STARTED" }
            : { type: "INFINITE", card_id: "x", is_paused: isPaused };
        return new Response(JSON.stringify({ snapshot, snapshot_timestamp_ms: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });

    const handle = await runRainbowToggle("http://10.0.4.20", fetchMock as unknown as typeof fetch, {
      settleMs: 0,
      pollIntervalMs: 5,
    });

    const uploads = () => calls.filter((c) => c.url.startsWith("http://10.0.4.20/api/assets/upload"));
    const drawPosts = () => calls.filter((c) => c.url === "http://10.0.4.20/api/display/draw" && c.method === "POST");
    const scopedClears = () =>
      calls.filter(
        (c) => c.url === "http://10.0.4.20/api/display/draw?application_name=nyan_cat" && c.method === "DELETE"
      );

    expect(uploads()).toHaveLength(1);
    expect(drawPosts().length).toBeGreaterThanOrEqual(1); // initial draw

    // simulate button press: session starts -> our elements should get cleared
    snapshotType = "INFINITE";
    isPaused = false;
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(scopedClears().length).toBeGreaterThan(0);
    const drawsAfterFirstPress = drawPosts().length;

    // simulate button press again: session pauses -> our animation redraws
    isPaused = true;
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(drawPosts().length).toBeGreaterThan(drawsAfterFirstPress);

    expect(uploads()).toHaveLength(1); // never re-uploaded the asset

    await handle.stop();
  });
});
