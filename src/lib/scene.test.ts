import { describe, it, expect, mock } from "bun:test";
import { runScene, sceneAssetName, type Scene, FRONT_WIDTH, FRONT_HEIGHT } from "./scene.ts";

const solid = (r: number, g: number, b: number) => {
  const f = new Uint8Array(FRONT_WIDTH * FRONT_HEIGHT * 4);
  for (let i = 0; i < f.length; i += 4) { f[i] = r; f[i + 1] = g; f[i + 2] = b; f[i + 3] = 255; }
  return f;
};
const TEST_SCENE: Scene = { id: "test_scene", name: "Test Scene", fps: 24, frames: () => [solid(255, 0, 0), solid(0, 255, 0)] };

/** A device whose asset directory already holds `files`; records every request. */
function device(files: string[]) {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetchMock = mock(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body instanceof Uint8Array ? init.body : init?.body ? JSON.parse(init.body as string) : undefined });
    if (url.includes("/api/storage/list")) {
      return new Response(JSON.stringify({ list: files.map((name) => ({ type: "file", name, size: 1 })) }), { status: 200 });
    }
    return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
  });
  return { calls, fetchMock: fetchMock as unknown as typeof fetch };
}

describe("sceneAssetName", () => {
  it("is the scene id plus a content hash, so a changed render gets a new file and an unchanged one is reused", () => {
    const name = sceneAssetName(TEST_SCENE);
    expect(name).toMatch(/^test_scene-[0-9a-f]{8}\.anim$/);
    expect(sceneAssetName(TEST_SCENE)).toBe(name);
    const other: Scene = { ...TEST_SCENE, frames: () => [solid(0, 0, 255), solid(0, 255, 0)] };
    expect(sceneAssetName(other)).not.toBe(name);
  });
});

describe("runScene", () => {
  it("clears the displays, uploads the encoded loop under the scene's app, waits for it to settle, then draws it looping full-screen", async () => {
    const { calls, fetchMock } = device([]);
    await runScene("http://10.0.4.20", TEST_SCENE, fetchMock, 0);
    const name = sceneAssetName(TEST_SCENE);
    expect(calls.map((c) => [c.method, c.url.replace("http://10.0.4.20", "")])).toEqual([
      ["DELETE", "/api/display/draw"],
      ["GET", "/api/storage/list?path=%2Fext%2Fuser_assets%2Ftest_scene"],
      ["POST", `/api/assets/upload?application_name=test_scene&file=${name}`],
      ["POST", "/api/display/draw"],
    ]);
    const upload = calls[2]!.body as Uint8Array;
    expect(new TextDecoder().decode(upload.slice(0, 8))).toBe("bicycle1");
    const draw = calls[3]!.body as { application_name: string; elements: Array<Record<string, unknown>> };
    expect(draw.application_name).toBe("test_scene");
    expect(draw.elements).toEqual([
      { id: "scene", type: "animation", path: name, loop: true, x: 0, y: 0, z_index: 1, display: "front" },
    ]);
  });

  it("skips the upload when the device already holds this render, and removes this scene's stale renders only after the new draw", async () => {
    const name = sceneAssetName(TEST_SCENE);
    const { calls, fetchMock } = device([name, "test_scene-00000000.anim", "unrelated.anim", "other_scene-12345678.anim"]);
    await runScene("http://10.0.4.20", TEST_SCENE, fetchMock, 0);
    expect(calls.map((c) => [c.method, c.url.replace("http://10.0.4.20", "")])).toEqual([
      ["DELETE", "/api/display/draw"],
      ["GET", "/api/storage/list?path=%2Fext%2Fuser_assets%2Ftest_scene"],
      ["POST", "/api/display/draw"],
      ["DELETE", "/api/storage/remove?path=%2Fext%2Fuser_assets%2Ftest_scene%2Ftest_scene-00000000.anim"],
    ]);
  });

  it("rejects a scene whose frames are not full-display RGBA", async () => {
    const bad: Scene = { ...TEST_SCENE, frames: () => [new Uint8Array(10)] };
    await expect(runScene("http://10.0.4.20", bad, device([]).fetchMock, 0)).rejects.toThrow(/72x16/);
  });
});
