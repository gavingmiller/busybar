#!/usr/bin/env python3
"""Turn the Dino Run release into a self-playing animation.

Reads an unpacked community.dino_run package dir (argv[1]) and writes the
patched package to argv[2]/gavin.dino_auto. The game logic is left intact;
an autopilot in step() simulates the game's own collision model a jump ahead
and jumps or ducks when staying put would hit. Title and game-over screens
auto-advance. Back still exits.
"""
import json, shutil, sys, pathlib

src = pathlib.Path(sys.argv[1]) / "community.dino_run"
dst = pathlib.Path(sys.argv[2]) / "gavin.dino_auto"
if dst.exists():
    shutil.rmtree(dst)
shutil.copytree(src, dst)

def sub(s, old, new, count=1):
    assert s.count(old) == count, (old, s.count(old))
    return s.replace(old, new)

js = (dst / "scripts/main.js").read_text()
js = sub(js, 'var APP = "community.dino_run";', 'var APP = "gavin.dino_auto";\nvar AUTO_TITLE_MS = 1500;    // autopilot: title -> play\nvar AUTO_DEAD_MS = 2600;     // autopilot: game over -> play')

# Autopilot helpers, inserted before the game loop's step().
js = sub(js, "function step(now) {", r'''// ── Autopilot ───────────────────────────────────────────────
// Simulates the game's own collision model with a candidate dino mode from
// `from` to `to` (ms) and reports whether it would hit anything near.
function wouldHit(mode, anchor, from, to) {
  var sm = dinoMode, sj = jumpAnchor, sd = duckAnchor, sq = queued;
  dinoMode = mode; queued = "run";
  if (mode === "jump") jumpAnchor = anchor; else if (mode === "duck") duckAnchor = anchor;
  // Every obstacle, not just the game's `near` list: by the time one is
  // near, a jump started now would not be high enough in time.
  var hit = false;
  for (var t = from; t <= to && !hit; t += F) {
    dinoAt(t);
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      if (t >= o.anchor && hits(o, obstX(o, obstFrame(o, t)))) { hit = true; break; }
    }
  }
  dinoMode = sm; jumpAnchor = sj; duckAnchor = sd; queued = sq;
  return hit;
}

function autopilot(now) {
  if (!obstacles.length) { if (duckHeld) setDuck(false); return; }
  if (dinoMode === "jump" && !landed(now)) return;
  var horizon = now + JUMP_MS + 6 * F;
  var cur = dinoMode === "duck" ? "duck" : "run";
  if (!wouldHit(cur, duckAnchor, now, horizon)) {
    // Safe as we are; stand back up once ducking is no longer needed.
    if (duckHeld && !wouldHit("run", 0, now, horizon)) setDuck(false);
    return;
  }
  if (!wouldHit("jump", now + EXPECT, now, horizon)) { if (duckHeld) setDuck(false); doJump(); return; }
  if (!duckHeld && !wouldHit("duck", now + EXPECT, now, horizon)) setDuck(true);
  // Otherwise neither move is safe yet: wait a tick and re-check.
}

function step(now) {''')

# Run the autopilot once the near list is fresh, before the collision scan.
js = sub(js, "  obstacles = keep;\n\n  // Collisions:", "  obstacles = keep;\n\n  autopilot(now);\n\n  // Collisions:")

# Title and game-over auto-advance.
js = sub(js, "  else if (state === \"dead\") deadStep(t);\n  else if (state === \"title\") titleStep(t);",
         "  else if (state === \"dead\") { deadStep(t); if (t - deadAt >= AUTO_DEAD_MS) startGame(t); }\n  else if (state === \"title\") { titleStep(t); if (titleAt && t - titleAt >= AUTO_TITLE_MS) startGame(t); }")
js = sub(js, 'setTimeout(tick, state === "play" && (near.length || dinoMode === "jump") ? TICK : 30);',
         'setTimeout(tick, state === "play" && (obstacles.length || dinoMode === "jump") ? TICK : 30);')
(dst / "scripts/main.js").write_text(js)

m = json.loads((dst / "appmeta/manifest.json").read_text())
m.update(id="gavin.dino_auto", name="Dino Run Auto", author="alex, autopilot by Gavin Miller",
         description="Dino Run playing itself: jumps and ducks on its own")
(dst / "appmeta/manifest.json").write_text(json.dumps(m, indent=4) + "\n")

s = json.loads((dst / "appmeta/settings.json").read_text())
s["fields"]["sound"]["default"] = False
(dst / "appmeta/settings.json").write_text(json.dumps(s, indent=4) + "\n")
print("patched ->", dst)
