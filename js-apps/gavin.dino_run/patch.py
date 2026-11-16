#!/usr/bin/env python3
"""Turn the Dino Run release into a stand-alone, self-running animation.

Reads an unpacked community.dino_run package dir (argv[1]) and writes the
patched package to argv[2]/gavin.dino_run. The game logic is left intact
except for what makes it a game:

- an autopilot in step() simulates the game's own collision model: it plans
  each obstacle once (a few probes per tick) and jumps at the centre of the
  window that clears it, reacting tick by tick only as a fallback;
- no title screen and no game-over screen: the dino is already running when
  the app starts, and a (rare) hit just stumbles and keeps going;
- no score and no speed-up: the ground and obstacles always move at the
  first tier's speed, and one fixed obstacle mix (MIX: mostly small cacti,
  plus the low and high birds; the mid bird looked weird) is used for the
  whole run (Gavin 2026-11-16: the level ramp read as "speeding up", but he
  wants birds);
- Back still exits.
"""
import json, re, shutil, sys, pathlib

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
         f'var APP = "{APP_ID}";\nvar AUTO_DEAD_MS = 700;      // a hit: stumble this long, then keep running\nvar MIX = ["s1", "s1", "s2", "s2", "l1", "l2", "s3", "bl", "bh"]; // one fixed pool for the whole run: small cacti most of the time, low and high birds only; the mid bird looked weird (Gavin 2026-11-16)')

# ── Frame period: fw 1.4.1 renders a frame every 18.81 ms, not 16.03 ──────
# Measured 2026-11-16 three ways on the bar (ground scroll, obstacle edges, the
# dino's 35-frame airtime = 658 ms); the autopilot's whole timeline runs on F.
js = sub(js, "var F = 16.03;               // ms per animation frame (measured on fw 27.14)",
         "var F = 18.81;               // ms per animation frame (measured on fw 1.4.1, 2026-11-16; was 16.03 on fw 27.14)")

# ── Jump windows, baked ────────────────────────────────────────────────────
# A replica of main.js's collision model (hits/dinoAt/obstX) run here, once, so the
# bar never simulates: for every obstacle type the contiguous range of jump-START
# frames (obstacle frames since its anchor, 1 px/frame) that clears it, and which
# types the dino simply runs under. One wouldHit on JerryScript costs ~30 ms; the
# old per-tick autopilot therefore decided 4-8 frames late and the 7-frame windows
# of l2/s3 went by (22/26 l2 jumps stumbled, telemetry 2026-11-16). patch.test.ts
# checks these windows against the game's own wouldHit.
D = json.loads(re.search(r"^var D = (\{.*\});$", js, re.M).group(1))
_JUMP, _HIT, _DINO_X, _DINO_TOP, _W = D["JUMP"], D["HIT_STAND"], D["DINO_X"], 6, 72

def _hits(ot, x, dH):
    dx = x - _DINO_X
    if dx > 10 or dx <= -ot["w"]:
        return False
    d_top = _DINO_TOP - dH
    for r, m in enumerate(ot["hit"]):
        if not m:
            continue
        dj = ot["top"] + r - d_top
        if dj < 0 or dj > 7:
            continue
        if _HIT[dj] & (m << dx if dx >= 0 else m >> -dx):
            return True
    return False

def _clears(ot, j):
    """A jump starting at obstacle frame j never touches the obstacle while it crosses."""
    for f in range(_W + ot["w"] + 2):
        k = f - j
        if _hits(ot, _W - f, _JUMP[k] if 0 <= k < len(_JUMP) else 0):
            return False
    return True

WINDOW, RUN_SAFE = {}, {}
for name, ot in D["OBST"].items():
    if "0" not in ot["frames"]:
        continue                      # not available at the fixed speed (l3)
    if all(not _hits(ot, _W - f, 0) for f in range(_W + ot["w"] + 2)):
        RUN_SAFE[name] = True         # the dino runs under it (high bird)
        continue
    safe = [j for j in range(20, 90) if _clears(ot, j)]
    if not safe:
        continue                      # no clean jump (the mid bird is ducked, not in the mix)
    runs = [[safe[0], safe[0]]]
    for j in safe[1:]:
        if j == runs[-1][1] + 1:
            runs[-1][1] = j
        else:
            runs.append([j, j])
    assert len(runs) == 1, (name, runs)   # one window per type, or the model changed
    WINDOW[name] = runs[0]

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

// Plans each obstacle from the baked WINDOW table: jump at the CENTRE of its
// window of safe start frames, so request latency a few frames either way still
// clears. Deciding by simulation on the bar was too slow (see patch.py).
var WINDOW = ''' + json.dumps(WINDOW, separators=(',', ':')) + r''';   // type -> [first, last] safe jump-start frame
var RUN_SAFE = ''' + json.dumps(RUN_SAFE, separators=(',', ':')) + r''';  // the dino runs under these

function planStep(now) {
  for (var i = 0; i < obstacles.length; i++) {
    var o = obstacles[i];
    if (o.plan) continue;
    o.plan = "done";
    if (RUN_SAFE[o.type]) { o.action = "none"; continue; }
    var w = WINDOW[o.type];
    if (!w) { o.action = "react"; continue; }     // no clean jump: fall back to reacting
    o.action = "jump";
    // Decision frame = start frame minus the request latency the start allows for.
    o.fdTarget = (w[0] + w[1]) / 2 - EXPECT / F;
  }
}

function autopilot(now) {
  if (!obstacles.length) { if (duckHeld) setDuck(false); return; }
  if (dinoMode === "jump" && !landed(now)) return;
  planStep(now);
  // The nearest obstacle still ahead of the dino decides.
  var o = null;
  for (var i = 0; i < obstacles.length; i++) {
    var c = obstacles[i];
    if (c.jumped || (now >= c.anchor && obstX(c, obstFrame(c, now)) < -c.w)) continue;
    if (!o || c.anchor < o.anchor) o = c;
  }
  if (!o) return;
  if (o.plan === "done" && o.action === "none") { if (duckHeld) setDuck(false); return; }
  if (o.plan === "done" && o.action === "jump") {
    if ((now - o.anchor) / F >= o.fdTarget) { o.jumped = true; if (duckHeld) setDuck(false); doJump(); }
    return;
  }
  // Still planning, or no clean jump exists: react the old way.
  var horizon = now + JUMP_MS + 6 * F;
  var cur = dinoMode === "duck" ? "duck" : "run";
  if (!wouldHit(cur, duckAnchor, now, horizon)) {
    // Safe as we are; stand back up once ducking is no longer needed.
    if (duckHeld && !wouldHit("run", 0, now, horizon)) setDuck(false);
    return;
  }
  if (!wouldHit("jump", now + EXPECT, now, horizon)) { o.jumped = true; if (duckHeld) setDuck(false); doJump(); return; }
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

# ── No speed-up, no obstacle-pool progression ───────────────
js = sub(js, "  if (pendingTier < 0 && tier + 1 < D.TIERS.length && score >= TIER_AT[tier + 1]) scheduleTier(now, tier + 1);\n", "")
js = sub(js, "  var pool = POOL[tier], type, tries = 0;",
         "  var pool = MIX, type, tries = 0; // the same mix for the whole run, birds from the first second")

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
