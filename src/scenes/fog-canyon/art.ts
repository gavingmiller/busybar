// Fog Canyon sprites, hand-drawn at bar scale in Hollow Knight's colour
// language (shapes from the game's wiki and sprite index; nothing copied).
// Every sprite faces right; the scene mirrors it for leftward travel.
//   Knight: W bone-white mask  E eye hollow  N cape (one tone)  K stub feet
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
