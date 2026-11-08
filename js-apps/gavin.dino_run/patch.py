#!/usr/bin/env python3
"""Turn the Dino Run release into a stand-alone, self-running animation.

Reads an unpacked community.dino_run package dir (argv[1]) and writes the
patched package to argv[2]/gavin.dino_run. The game logic is left intact
except for what makes it a game:

- an autopilot in step() simulates the game's own collision model a jump
  ahead over every obstacle and jumps or ducks when staying put would hit;
- no title screen and no game-over screen: the dino is already running when
  the app starts, and a (rare) hit just stumbles and keeps going;
- no score and no speed-up: the ground and obstacles always move at the
  first tier's speed, but the obstacle pool still unlocks level by level
  (birds, bigger cacti) by distance run, so the variety still progresses;
- Back still exits.
"""
import json, shutil, sys, pathlib

APP_ID = "gavin.dino_run"
src = pathlib.Path(sys.argv[1]) / "community.dino_run"
dst = pathlib.Path(sys.argv[2]) / APP_ID
if dst.exists():
    shutil.rmtree(dst)
shutil.copytree(src, dst)

def sub(s, old, new, count=1):
    assert s.count(old) == count, (old, s.count(old))
    return s.replace(old, new)

js = (dst / "scripts/main.js").read_text()
js = sub(js, 'var APP = "community.dino_run";',
         f'var APP = "{APP_ID}";\nvar AUTO_DEAD_MS = 700;      // a hit: stumble this long, then keep running\nvar level = 0;               // obstacle pool unlocked so far (speed never changes)')

# ── Autopilot ───────────────────────────────────────────────
js = sub(js, "function step(now) {", r'''// ── Autopilot ───────────────────────────────────────────────
// Simulates the game's own collision model with a candidate dino mode from
// `from` to `to` (ms) and reports whether it would hit anything.
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
js = sub(js, "  obstacles = keep;\n\n  // Collisions:", "  obstacles = keep;\n\n  autopilot(now);\n\n  // Collisions:")
js = sub(js, 'setTimeout(tick, state === "play" && (near.length || dinoMode === "jump") ? TICK : 30);',
         'setTimeout(tick, state === "play" && (obstacles.length || dinoMode === "jump") ? TICK : 30);')

# ── No score ────────────────────────────────────────────────
js = sub(js, '  els.push(text("sc", "00000", 71, -1, "small", SCORE, "top_right", 10));\n', '')
js = sub(js, '  if (m > milestone) {\n    milestone = m;\n    blinkUntil = now + 900;\n    sfx("score");\n  }\n', '')
js = sub(js, '''  if (inflight === 0 && now - scoreSentAt >= 100) {
    var blink = now < blinkUntil;
    var shown = blink ? milestone * 100 : score;
    var on = !blink || Math.floor((blinkUntil - now) / 150) % 2 === 1;
    var key = shown * 2 + (on ? 1 : 0);
    if (key !== shownScore) {
      shownScore = key;
      scoreSentAt = now;
      send([text("sc", pad5(shown), 71, -1, "small", on ? SCORE : HIDDEN, "top_right", 10)]);
    } else if (trash.length) {
      send(trash);
      trash = [];
    }
  }''', '''  if (inflight === 0 && trash.length) {
    send(trash);
    trash = [];
  }''')

# ── No speed-up, but the obstacle pool still progresses ─────
js = sub(js, "  if (pendingTier < 0 && tier + 1 < D.TIERS.length && score >= TIER_AT[tier + 1]) scheduleTier(now, tier + 1);",
         "  if (level + 1 < POOL.length && score >= TIER_AT[level + 1]) level++;")
js = sub(js, "  var pool = POOL[tier], type, tries = 0;", "  var pool = POOL[level], type, tries = 0;")
js = sub(js, "  tier = 0; pendingTier = -1;", "  tier = 0; level = 0; pendingTier = -1;")

# ── Always running: no title, no opening hop, no game-over screen ─
js = sub(js, '''  dinoMode = "jump"; queued = duckHeld ? "duck" : "run"; jumpAnchor = now + EXPECT;
  els.push(dino("jump", false));
  send(els, function (t) {
    var a = t + ANCHOR;
    gAnchor = a; segStart = a; jumpAnchor = a;
    send([dino(queued, true, { await_previous_end: true })]);
  });
  sfx("jump");
}''', '''  // The sky layer used to come from the title screen, which is gone.
  els.push(sky());
  dinoMode = "run"; queued = "run"; duckHeld = false;
  els.push(dino("run", true));
  send(els, function (t) {
    var a = t + ANCHOR;
    gAnchor = a; segStart = a;
  });
}''')
js = sub(js, '  else if (state === "dead") deadStep(t);\n  else if (state === "title") titleStep(t);',
         '  else if (state === "dead") { if (t - deadAt >= AUTO_DEAD_MS) startGame(t); }')
js = sub(js, "showTitle();\ntick();", "startGame(Date.now());\ntick();")
(dst / "scripts/main.js").write_text(js)

m = json.loads((dst / "appmeta/manifest.json").read_text())
m.update(id=APP_ID, name="Dino Run", author="alex; self-running edit by Gavin Miller",
         description="Dino Run as a stand-alone animation: runs, jumps and ducks on its own")
(dst / "appmeta/manifest.json").write_text(json.dumps(m, indent=4) + "\n")

s = json.loads((dst / "appmeta/settings.json").read_text())
s["fields"]["sound"]["default"] = False
(dst / "appmeta/settings.json").write_text(json.dumps(s, indent=4) + "\n")
print("patched ->", dst)
