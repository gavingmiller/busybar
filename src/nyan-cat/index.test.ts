import { describe, it, expect, mock } from "bun:test";
import { runStationary, runRainbow } from "./index.ts";

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
  // POST calls. The composited cat+trail scene is now a single native
  // looping .anim asset: upload once, draw once (one AnimationElement
  // referencing it), and the device handles looping forever with no
  // further requests from us. It's ONE asset, not two, because the device
  // can't layer separate elements with transparency — see
  // sceneAnimationFrames/nyanCatElements in sprite.ts.
  it("uploads the composited scene as a single .anim asset, then draws one looping AnimationElement referencing it", async () => {
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

    const uploadCalls = calls.filter((c) => c.url.startsWith("http://10.0.4.20/api/assets/upload"));
    expect(uploadCalls).toHaveLength(1);
    const uploadCall = uploadCalls[0]!;
    expect(uploadCall.method).toBe("POST");
    expect(uploadCall.url).toMatch(/application_name=nyan_cat/);
    expect(uploadCall.url).toMatch(/file=.+\.anim/);
    expect(uploadCall.body).toBeInstanceOf(Uint8Array);
    expect((uploadCall.body as Uint8Array).length).toBeGreaterThan(0);

    const drawCalls = calls.filter((c) => c.url === "http://10.0.4.20/api/display/draw");
    // Re-uploading over a filename the device is actively looping 508s
    // ("Failed to open file for writing") unless the display was cleared
    // first — so the upload must be preceded by a clear (see runRainbow's
    // comment), on top of drawFrame's own clear before the actual draw.
    expect(drawCalls).toHaveLength(3); // pre-upload clear, drawFrame's own clear, then the draw
    expect(drawCalls[0]!.method).toBe("DELETE");
    expect(drawCalls[1]!.method).toBe("DELETE");
    expect(drawCalls[2]!.method).toBe("POST");

    const payload = drawCalls[2]!.body as { application_name: string; elements: Array<Record<string, unknown>> };
    expect(payload.application_name).toBe("nyan_cat");

    expect(payload.elements).toHaveLength(1);
    const [el] = payload.elements;
    expect(el).toMatchObject({ type: "animation", loop: true, display: "front" });
    expect(typeof el!.path).toBe("string");

    // The upload must happen before the draw references it.
    const drawIndex = calls.indexOf(drawCalls[2]!);
    expect(calls.indexOf(uploadCall)).toBeLessThan(drawIndex);
  });
});
