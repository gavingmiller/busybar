// Extra Dino Run obstacles, hand-drawn at bar scale (Gavin 2026-11-16: "let's do
// both" — a rolling tumbleweed and a boulder). The upstream package's obst.anim
// cannot be appended to (mask-compressed, and the upstream repo carries no
// licence), so these live in their own anims/extra.anim built by
// ../build-extra-anim.ts with the project's bicycle1 encoder.
//
// Envelope at the fixed tier-0 speed (1 px/frame): ≤ 11 px wide and ≤ 5 rows
// tall keeps an obstacle jumpable by the 36-frame jump. Every obstacle sits on
// the ground: the obstacle layer is 72x14 (screen rows 0–13), the ground line
// is screen row 14, so an obstacle's bottom row is 13, like the upstream cacti
// (s1 top 10 + 4 rows, l1 top 9 + 5 rows). Row 12 left them floating 1 px
// above the ground (Gavin 2026-11-16, confirmed on a screen readback).
//
// Five numbered candidates each, with real variance per round, for the picks
// line-up on the bar; the chosen pair becomes TUMBLEWEED / BOULDER below.

export interface ObstacleArt {
  name: string;
  /** Frames, all the same size; a static obstacle has one. "." is transparent. */
  frames: readonly (readonly string[])[];
  colors: Readonly<Record<string, string>>;
  /**
   * Top rows left OUT of the collision mask (a sting tip, a shell cap, a lit
   * crest): the art keeps them, the jump window is judged on the solid body
   * below, and the dino may brush them. At 1 px/frame a 5-row obstacle leaves
   * only a 3-4 frame window; one soft row restores the 7+ frames the double
   * large cactus has (patch.py bakes the windows, 2026-11-16).
   */
  softTop?: number;
}

/** The obstacle layer the upstream game draws into (screen rows 0–13). */
export const LAYER_W = 72;
export const LAYER_H = 14;
/** Bottom row of a ground obstacle inside the layer (the ground line is the row below). */
export const GROUND_ROW = 13;
export const MAX_W = 11;
export const MAX_H = 5;

// Round 2 (Gavin on round 1: "they suck, can you look for some others?"):
// drawn from references this time, not from nothing —
//   tumbleweed: Wikimedia Commons "Tumbleweed rolling.jpg" (CC BY-SA 2.0, jeza;
//     reference only) — a pale straw ball, open and airy, more black than twig,
//     stray twigs poking past the silhouette; the roll is the twig pattern
//     turning, with the brightest twigs orbiting the rim.
//   rocks: OpenGameArt "Desert Tileset" by Beast (CC-BY 3.0) rock cluster —
//     irregular sandstone lumps, pale lit top-left, deep shadow right and
//     under, a chip or two; and "Shiny Boulders" (CC0) for the grey ones.
//   other kinds: OGA "Scorpy Scorp" (CC0) side-view scorpion, "Animated Snake"
//     by calciumtrice (CC-BY 3.0) raised-head snake, "Zombies & Skeletons"
//     (CC0) skull. Sources + licences: scratchpad refs/SOURCES.md. Nothing is
//     vendored; every sprite below is hand-drawn at bar scale.
// Straw palette: pale straw, straw, dry twig; no outline (an outline closes
// the silhouette and turns it back into a blob).
const STRAW = { P: "#F0E0A0", S: "#D0B870", T: "#A08848" };

export const TUMBLEWEEDS: readonly ObstacleArt[] = [
  // Round 2b: the first alternating-pixel attempt read as a checkerboard, so
  // these are built as a ROUND rim with one or two gaps and a few curled
  // twigs inside; the roll is the gap and the curls walking round the rim
  // (the ball moves left, so it turns counter-clockwise: top → left → bottom → right).
  {
    name: "1 ball 7x5, rim gap and curl going round",
    frames: [
      ["..S.P..", ".P...S.", "S.T.T.S", ".S.T.S.", "..SSS.."],
      ["..PSS..", "P..T..S", "..T.T.S", ".S.T.S.", "..SSS.."],
      ["..SSS..", ".S.T.S.", "S.T.T.S", ".S...P.", "..S.P.."],
      ["..SSP..", ".S.T.P.", "S.T.T..", ".S.T..P", "..SSS.."],
    ],
    colors: STRAW,
  },
  {
    name: "2 loose 7x5, two gaps, stray twig flicking out",
    frames: [
      ["..S.S..", ".P...S.", "S.T...S", ".S..T.S", "..S.S.."],
      ["..SSS..", ".P...S.", "..T.T.S", ".S....S", "..S.S.."],
      ["..S.S..", ".S...S.", "S...T.S", ".S.T..P", "..S.S.."],
      ["..S.S..", ".S....S", "S.T.T..", ".S...P.", "..SSS.."],
    ],
    colors: STRAW,
  },
  {
    name: "3 dense 7x5, closed rim, inner spiral turning",
    frames: [
      ["..SPS..", ".S.T.S.", "S.TT..S", ".S...S.", "..SSS.."],
      ["..SSS..", ".P...S.", "S..TT.S", ".S.T.S.", "..SSS.."],
      ["..SSS..", ".S...P.", "S.TT..S", ".S.T.S.", "..SPS.."],
      ["..SSS..", ".S.T.S.", "S..TT.S", ".P...S.", "..SSS.."],
    ],
    colors: STRAW,
  },
  {
    name: "4 small 5x5, pale, one curl",
    frames: [
      [".SP..", "S..S.", "S.T.S", ".S..S", "..SS."],
      ["..SP.", ".S..S", "S.T.S", "S..S.", ".SS.."],
      [".SS..", "S..S.", "S.T.S", ".S..S", "..PS."],
      ["..SS.", ".S..S", "S.T.S", "S..S.", ".PS.."],
    ],
    colors: { P: "#F8ECB8", S: "#E0CC88", T: "#B09858" },
  },
  {
    name: "5 big 9x5, dry brown twigs, bright rim top",
    frames: [
      ["...PPP...", ".T.....T.", "T...T...T", ".T.T...T.", "...TTT..."],
      ["...TTT...", ".P.....T.", "P..T....T", ".P...T.T.", "...TTT..."],
      ["...TTT...", ".T.....T.", "T...T...T", ".T...T.T.", "...PPP..."],
      ["...TTT...", ".T.....P.", "T....T..P", ".T.T...P.", "...TTT..."],
    ],
    colors: { P: "#F0E0A0", T: "#A88850" },
  },
];

// Sandstone (desert tileset reference) and grey granite: lit edge top-left,
// mid face, deep shadow right and underneath, the odd chip of black.
const SAND = { L: "#E8D0A0", M: "#B08858", D: "#6A4A30", K: "#3A2818" };
const GRAN = { L: "#D8D8E0", M: "#8C8C98", D: "#4A4A58", K: "#2A2A34" };

export const BOULDERS: readonly ObstacleArt[] = [
  {
    name: "1 sandstone lump 8x4, chipped",
    frames: [["..LLL...", ".LMMML..", "LMMMMMD.", "DMKMDDDD"]],
    colors: SAND,
  },
  {
    name: "2 granite 9x5, cracked face",
    frames: [["...LLL...", ".LLMMMLD.", "LMMKMMMDD", "LMKMMMDDD", ".DDDDDDD."]],
    colors: GRAN,
  },
  {
    name: "3 two sandstone rocks 11x4",
    frames: [["..LL....L..", ".LMMD..LMD.", "LMMMMD.MMDD", "DMMDDDDDDD."]],
    colors: SAND,
  },
  {
    name: "4 granite peak 7x5, tall",
    frames: [["...L...", "..LML..", ".LMMMD.", "LMMMMDD", ".DDDDD."]],
    colors: GRAN,
  },
  {
    name: "5 low sandstone slab 10x3, broken",
    frames: [[".LLLL.LLL.", "LMMMD.MMMD", "DMMDDDMDDD"]],
    colors: SAND,
  },
];

// A third line-up of different obstacle KINDS, so Gavin can pick something
// other than a tumbleweed or a rock. All ground obstacles the dino jumps.
const SCORP = { R: "#C85A3A", r: "#8A3A2A", K: "#4A2018", Y: "#F0D060" };
const SNAKE = { G: "#5AA050", g: "#3A7838", W: "#F0F0E0", R: "#E04040" };
const SKULL = { B: "#E8E0C0", b: "#B0A888", S: "#605850" };
const LOG = { L: "#C09060", M: "#8A6038", D: "#5A3C22", R: "#E0B880" };
const TORT = { S: "#8A9A40", s: "#5A6A28", H: "#C8A870", h: "#8A7048", E: "#2A2418" };

export const KINDS: readonly ObstacleArt[] = [
  {
    name: "1 scorpion 11x5, tail up",
    frames: [
      [".........Y.", "........rR.", "RR..RRRRR..", ".rRRrRrRr..", ".K.K.K.K.K."],
      [".........Y.", "........rR.", "RR..RRRRR..", ".rRRrRrRr..", "K.K.K.K.K.."],
    ],
    colors: SCORP,
  },
  {
    name: "2 snake 9x4, head raised, tongue",
    frames: [
      ["..GG.....", "RWGg.....", "..Gg..GG.", ".gGGGGgg."],
      ["..GG.....", ".WGg.....", "..Gg.GG..", ".gGGGggg."],
    ],
    colors: SNAKE,
  },
  {
    name: "3 skull 6x5, sockets",
    frames: [[".BBBB.", "BBBBBB", "BSBBSB", ".bBBb.", ".bSbS."]],
    colors: SKULL,
  },
  {
    name: "4 fallen log 11x4, end ring",
    frames: [["RLLLLLLLLL.", "RMMMMMMMMML", "RDMMMMMMMMD", ".DDDDDDDDD."]],
    colors: LOG,
  },
  {
    name: "5 tortoise 11x5, head out",
    frames: [
      ["...SSSSS...", "..SsSsSsS..", "HSSsSsSsSS.", "EHhhhhhhhh.", ".hh.....hh."],
      ["...SSSSS...", "..SsSsSsS..", "HSSsSsSsSS.", "EHhhhhhhhhh", "hh.......hh"],
    ],
    colors: TORT,
  },
];

/** Default picks until Gavin chooses: candidate 1 of each. */
export const TUMBLEWEED: ObstacleArt = TUMBLEWEEDS[0]!;
export const BOULDER: ObstacleArt = BOULDERS[0]!;

export const spriteWidth = (art: ObstacleArt): number => art.frames[0]![0]!.length;
export const spriteHeight = (art: ObstacleArt): number => art.frames[0]!.length;

/** The game's collision shape: per-row column bitmasks (bit i = column i), the union of every frame, plus `top` and `w`. */
export function obstEntry(art: ObstacleArt): { w: number; top: number; hit: number[]; frames: Record<string, number> } {
  const w = spriteWidth(art), h = spriteHeight(art), soft = art.softTop ?? 0;
  const hit: number[] = [];
  for (let r = soft; r < h; r++) {
    let mask = 0;
    for (const frame of art.frames) for (let c = 0; c < w; c++) if (frame[r]![c] !== ".") mask |= 1 << c;
    hit.push(mask);
  }
  return { w, top: GROUND_ROW - h + 1 + soft, hit, frames: { "0": LAYER_W + w + 1 } }; // frames 0..72+w, like upstream
}

/** The frame of a rolling obstacle shown on display frame `f` (one roll step every ROLL_FRAMES frames). */
export const ROLL_FRAMES = 4;
export const rollingFrame = (art: ObstacleArt, f: number): readonly string[] =>
  art.frames[Math.floor(f / ROLL_FRAMES) % art.frames.length]!;

const hexToRgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** Paints a sprite frame into a transparent LAYER_W x LAYER_H RGBA buffer with its left edge at `x` and bottom row on GROUND_ROW. */
export function rasterize(art: ObstacleArt, frame: readonly string[], x: number): Uint8Array {
  const buf = new Uint8Array(LAYER_W * LAYER_H * 4);
  const top = GROUND_ROW - frame.length + 1;
  frame.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]!;
      if (ch === ".") continue;
      const px = x + c, py = top + r;
      if (px < 0 || px >= LAYER_W || py < 0 || py >= LAYER_H) continue;
      const color = art.colors[ch];
      if (!color) throw new Error(`obstacle "${art.name}": no colour for "${ch}"`);
      const [rr, gg, bb] = hexToRgb(color);
      const i = (py * LAYER_W + px) * 4;
      buf[i] = rr; buf[i + 1] = gg; buf[i + 2] = bb; buf[i + 3] = 255;
    }
  });
  return buf;
}

/**
 * The five-candidate line-up for the bar's "Character Picks" scene
 * (src/scenes/munchers-run/picks.ts takes RunnerArt-shaped variants: frames,
 * colors, eye). Obstacles have no eye; [0, 0] keeps the shape. To show a round,
 * point PICK_VARIANTS in picks.ts at TUMBLEWEED_PICKS or BOULDER_PICKS.
 */
export interface PickShape { name: string; frames: readonly (readonly string[])[]; colors: Readonly<Record<string, string>>; eye: readonly [number, number]; poseFrames?: number }
const toPick = (art: ObstacleArt): PickShape => ({ name: art.name, frames: art.frames, colors: art.colors, eye: [0, 0], poseFrames: ROLL_FRAMES });
export const TUMBLEWEED_PICKS: readonly PickShape[] = TUMBLEWEEDS.map(toPick);
export const BOULDER_PICKS: readonly PickShape[] = BOULDERS.map(toPick);
export const KIND_PICKS: readonly PickShape[] = KINDS.map(toPick);

/**
 * Gavin's picks from round 2 (2026-11-16): six new obstacle types, one
 * extra.anim. Two-letter type names, none starting with "b" (the game's
 * bird no-repeat rule keys on that letter).
 */
export interface ChosenObstacle { type: string; art: ObstacleArt }
// No softTop: on the ground (bottom row 13, like the cacti) every one has a 9+ frame
// window with all its drawn pixels in the collision mask. Trimming the top row (crown,
// lit cap, sting tip, shell cap) had let the planner aim where those visible pixels
// clip the dino (Gavin 2026-11-16: "jumping through them").
export const CHOSEN: readonly ChosenObstacle[] = [
  { type: "sk", art: KINDS[2]! },                        // skull
  { type: "gr", art: BOULDERS[1]! },                     // granite, cracked face
  { type: "sa", art: BOULDERS[0]! },                     // sandstone lump
  { type: "sn", art: KINDS[1]! },                        // snake
  { type: "sc", art: KINDS[0]! },                        // scorpion
  { type: "to", art: KINDS[4]! },                        // tortoise
];
