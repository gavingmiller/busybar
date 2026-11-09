// Fog Canyon sprites, hand-drawn at bar scale in Hollow Knight's colour
// language (shapes from the game's wiki and sprite index; nothing copied).
// Every sprite faces right; the scene mirrors it for leftward travel.
//   Knight: W bone-white mask  E eye hollow  N cape (one tone)  K stub feet
//   Hornet: W mask  E eye hollow  R red cape (one tone)  K dark-red feet
//   Jellies: P pale Uoma bell  C pink Uoma core  G Ooma bell  O orange Ooma core
//   Cores also have a flicker colour (CF / OF) swapped in by the scene.

export interface SpriteArt {
  frames: readonly (readonly string[])[];
  colors: Readonly<Record<string, string>>;
}

/**
 * The Knight, 7x9, Gavin's pick from seven rounds of the bar line-up
 * (2026-11-09): horns rise from the mask's outer edges and curve IN at the
 * tips, two-row eye hollows, a short single-tone cape, two stub feet. Mask
 * rows 0-5 are identical in every frame; the cape sways a column and the
 * feet step through four poses.
 */
const MASK = [
  ".W...W.",
  "W.....W",
  "WWWWWWW",
  ".WEWEW.",
  ".WEWEW.",
  ".WWWWW.",
];
export const KNIGHT: SpriteArt = {
  frames: [
    [...MASK, "..NNN..", ".NNNNN.", "..K.K.."],
    [...MASK, "..NNN..", ".NNNNN.", ".K...K."],
    [...MASK, "..NNN..", "NNNNN..", "...KK.."],
    [...MASK, "..NNN..", ".NNNNN.", ".K..K.."],
  ],
  colors: { W: "#F2F2F4", E: "#0A0A12", N: "#8094E4", K: "#5262B0" },
};

/**
 * Hornet, 7x9, Gavin's pick from three rounds of the bar line-up
 * (2026-11-09): straight horns rising from the mask corners, two-row eye
 * hollows, a pointed chin, a short single-tone red cape, dark-red stub feet.
 * Mask rows 0-5 fixed; the cape sways a column and the feet step.
 */
const HORNET_MASK = [
  ".W...W.",
  ".W...W.",
  ".WWWWW.",
  ".WEWEW.",
  ".WEWEW.",
  "..WWW..",
];
export const HORNET: SpriteArt = {
  frames: [
    [...HORNET_MASK, "..RRR..", ".RRRRR.", "..K.K.."],
    [...HORNET_MASK, "..RRR..", ".RRRRR.", ".K...K."],
    [...HORNET_MASK, "..RRR..", "RRRRR..", "...KK.."],
    [...HORNET_MASK, "..RRR..", ".RRRRR.", ".K..K.."],
  ],
  colors: { W: "#F2F2F4", E: "#0A0A12", R: "#E04050", K: "#A02838" },
};

/** Uoma: a small translucent bell with a pink core and three short tendrils. 6x5. */
export const UOMA: SpriteArt = {
  frames: [[
    ".PPPP.",
    "PPPPPP",
    "PPCCPP",
    "PPPPPP",
    ".P.P.P",
  ]],
  colors: { P: "#6A9A88", C: "#F090C0", CF: "#FFD0F0" },
};

/** Ooma: a bigger bell with an orange core and trailing tendrils. 8x7. */
export const OOMA: SpriteArt = {
  frames: [[
    "..GGGG..",
    ".GGGGGG.",
    "GGGOOGGG",
    "GGGOOGGG",
    ".GGGGGG.",
    "..G.G.G.",
    "..G...G.",
  ]],
  colors: { G: "#5A8A78", O: "#F0A040", OF: "#FFE0A0" },
};

/**
 * Metroid: the Metroid-series creature, hand-drawn from Gavin's LED-box photo
 * (refs/metroid-led-box.png). A bright green translucent dome with a lighter
 * membrane rim, three red nuclei in a triangle, and two forked claws below.
 * 9x8. Two frames: the claws clench inward and the nuclei pulse lighter.
 *   G dome  L membrane highlight  R nucleus  Q nucleus (pulse)  K claw
 */
export const METROID: SpriteArt = {
  frames: [
    [
      "...GGG...",
      ".GGLLLGG.",
      "GGLGRGLGG",
      "GGLGGGLGG",
      "GGRGGGRGG",
      ".GGGGGGG.",
      ".KK...KK.",
      ".K.....K.",
    ],
    [
      "...GGG...",
      ".GGLLLGG.",
      "GGLGQGLGG",
      "GGLGGGLGG",
      "GGQGGGQGG",
      ".GGGGGGG.",
      "..KK.KK..",
      "..K...K..",
    ],
  ],
  colors: { G: "#58C878", L: "#A0F0B0", R: "#E03040", Q: "#FF7080", K: "#A02830" },
};
