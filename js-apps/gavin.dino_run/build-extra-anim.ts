#!/usr/bin/env bun
// Builds anims/extra.anim for Dino Run's extra obstacles (the six CHOSEN in
// art/obstacles.ts) with the project's bicycle1 encoder, in the shape the upstream
// game expects of its own obst.anim: fps 76 (one step per 16 ms refresh), the
// 72x14 obstacle layer, one crossing section `<t>_0` of 72+w frames in which
// the sprite's left edge is x = 71 - f (1 px/frame, leftwards; tier 0 is the
// only speed since 2026-11-16), and one-frame stills `<t>@<x>` for every
// x in -w+1..71, which die() uses to freeze an obstacle where it is.
//
// Usage: bun run build-extra-anim.ts [out-dir]
//   writes <out-dir>/anims/extra.anim and <out-dir>/obst.json (the D.OBST
//   entries patch.py merges into main.js; default out-dir build/extra) and
//   prints the same JSON object.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { encodeAnimFile, type AnimSection } from "../../src/lib/anim-file.ts";
import {
  CHOSEN, LAYER_H, LAYER_W, obstEntry, rasterize, rollingFrame, spriteWidth, type ChosenObstacle, type ObstacleArt,
} from "./art/obstacles.ts";

/** Upstream's anims run at fps 76 so one file frame maps to one 16 ms display refresh. */
export const EXTRA_FPS = 76;
export function obstacleSections(type: string, art: ObstacleArt): AnimSection[] {
  const w = spriteWidth(art);
  const crossing: Uint8Array[] = [];
  for (let f = 0; f < LAYER_W + w; f++) crossing.push(rasterize(art, rollingFrame(art, f), LAYER_W - 1 - f));
  const sections: AnimSection[] = [{ name: `${type}_0`, frames: crossing }];
  for (let x = -w + 1; x < LAYER_W; x++) sections.push({ name: `${type}@${x}`, frames: [rasterize(art, art.frames[0]!, x)] });
  return sections;
}

export function buildExtraAnim(chosen: readonly ChosenObstacle[] = CHOSEN) {
  const bytes = encodeAnimFile({
    width: LAYER_W, height: LAYER_H, fps: EXTRA_FPS,
    sections: chosen.flatMap((c) => obstacleSections(c.type, c.art)),
  });
  const entries: Record<string, ReturnType<typeof obstEntry>> = {};
  for (const c of chosen) entries[c.type] = obstEntry(c.art);
  return { bytes, entries };
}

if (import.meta.main) {
  const outDir = process.argv[2] ?? join(import.meta.dir, "build/extra");
  const { bytes, entries } = buildExtraAnim();
  const file = join(outDir, "anims/extra.anim");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  writeFileSync(join(outDir, "obst.json"), JSON.stringify(entries) + "\n");
  console.error(`wrote ${file} (${bytes.length} bytes; ${CHOSEN.map((c) => `${c.type}="${c.art.name}"`).join(", ")})`);
  console.log(JSON.stringify(entries));
}
