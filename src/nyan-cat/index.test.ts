import { describe, it, expect, mock } from "bun:test";
import { runStationary, runRainbow, NYAN_CAT_ELEMENT_ID, nyanHomeElementX, playNyanCatSection, nyanAssetNames, NYAN_APPLICATION_NAME } from "./index.ts";
import { HOME_SECTION } from "./pan.ts";

/** A device whose asset directory already holds `files`; records every request. */
function device(files: string[]) {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetchMock = mock(async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body instanceof Uint8Array ? init.body : init?.body ? JSON.parse(init.body as string) : undefined,
    });
    if (url.includes("/api/storage/list")) {
      return new Response(JSON.stringify({ list: files.map((name) => ({ type: "file", name, size: 1 })) }), { status: 200 });
    }
    return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
  });
  return { calls, fetchMock: fetchMock as unknown as typeof fetch };
}

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

describe("playNyanCatSection", () => {
  it("queues the cat layer's section behind the one playing (await_previous_end), at the fixed element position", async () => {
    const { calls, fetchMock } = device([]);
    await playNyanCatSection("http://10.0.4.20", "exc_mid", false, fetchMock);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("http://10.0.4.20/api/display/draw");
    const body = calls[0]!.body as { elements: Array<Record<string, unknown>> };
    expect(body.elements).toHaveLength(1);
    expect(body.elements[0]).toMatchObject({ id: NYAN_CAT_ELEMENT_ID, type: "animation", section: "exc_mid", loop: false, await_previous_end: true, x: nyanHomeElementX() });
    expect(body.elements[0]!.path).toBe(nyanAssetNames().cat);
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
    const { calls, fetchMock } = device([]);

    await runRainbow("http://10.0.4.20", fetchMock, 0);

    // Two layers now: the star field behind, the cat + trail in front, so the
    // control server can pan the cat without moving the sky (the firmware
    // composites transparent .anim layers since 1.3.1, verified live).
    const uploadCalls = calls.filter((c) => c.url.startsWith("http://10.0.4.20/api/assets/upload"));
    expect(uploadCalls).toHaveLength(2);
    for (const uploadCall of uploadCalls) {
      expect(uploadCall.method).toBe("POST");
      expect(uploadCall.url).toMatch(/application_name=nyan_cat/);
      expect(uploadCall.url).toMatch(/file=.+\.anim/);
      expect(uploadCall.body).toBeInstanceOf(Uint8Array);
      expect((uploadCall.body as Uint8Array).length).toBeGreaterThan(0);
    }
    const uploadCall = uploadCalls[1]!;

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

    expect(payload.elements).toHaveLength(2);
    const [stars, cat] = payload.elements;
    expect(stars).toMatchObject({ id: "stars", type: "animation", loop: true, display: "front", x: 0, y: 0, z_index: 1 });
    expect(cat).toMatchObject({ id: NYAN_CAT_ELEMENT_ID, type: "animation", section: HOME_SECTION, loop: true, display: "front", x: nyanHomeElementX(), z_index: 2 });
    expect(stars!.path).toBe(nyanAssetNames().stars);
    expect(cat!.path).toBe(nyanAssetNames().cat);

    // The upload must happen before the draw references it.
    const drawIndex = calls.indexOf(drawCalls[2]!);
    expect(calls.indexOf(uploadCall)).toBeLessThan(drawIndex);
  });

  it("skips the uploads when the device already holds the assets by their content-hashed names, and removes stale nyan-* files", async () => {
    const names = nyanAssetNames();
    expect(names.stars).toMatch(/^nyan-stars-[0-9a-f]{8}\.anim$/);
    expect(names.cat).toMatch(/^nyan-cat-[0-9a-f]{8}\.anim$/);
    const { calls, fetchMock } = device([names.stars, names.cat, "nyan-cat-00000000.anim", "keep-me.bin"]);

    await runRainbow("http://10.0.4.20", fetchMock, 0);

    expect(calls.filter((c) => c.url.includes("/api/assets/upload"))).toHaveLength(0);
    const removes = calls.filter((c) => c.url.includes("/api/storage/remove"));
    expect(removes).toHaveLength(1);
    expect(removes[0]!.method).toBe("DELETE");
    expect(decodeURIComponent(removes[0]!.url)).toContain(`/ext/user_assets/${NYAN_APPLICATION_NAME}/nyan-cat-00000000.anim`);
    const draws = calls.filter((c) => c.url === "http://10.0.4.20/api/display/draw" && c.method === "POST");
    expect(draws).toHaveLength(1);
    // Stale files go only after the new draw is up: removing a file an element still plays wedges the device.
    expect(calls.indexOf(removes[0]!)).toBeGreaterThan(calls.indexOf(draws[0]!));
  });
});
