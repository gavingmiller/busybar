// Fog Canyon sprites, hand-drawn at bar scale in Hollow Knight's colour
// language (shapes from the game's wiki and sprite index; nothing copied).
// Every sprite faces right; the scene mirrors it for leftward travel.
//   Knight: W bone-white mask  E eye hollow  K black body  N navy cloak
//   Jellies: P pale Uoma bell  C pink Uoma core  G Ooma bell  O orange Ooma core
//   Cores also have a flicker colour (CF / OF) swapped in by the scene.

export interface SpriteArt {
  frames: readonly (readonly string[])[];
  colors: Readonly<Record<string, string>>;
}

/** The Knight, 6x9. Rows 0-4 (the mask) are identical in every frame; cloak and legs alternate below. */
const MASK = [
  "W....W",
  ".W..W.",
  ".WWWW.",
  "WWEWEW",
  ".WWWW.",
];
export const KNIGHT: SpriteArt = {
  frames: [
    [...MASK, "NNKKN.", ".NKKN.", ".NKK..", ".K..K."],
    [...MASK, ".NKKN.", ".NKKN.", "NNKK..", "..KK.."],
    [...MASK, "NNKKN.", "NNKKN.", ".NKK..", "K...K."],
    [...MASK, ".NKKN.", ".NKKN.", ".NKK..", "..KK.."],
  ],
  colors: { W: "#F2F2F4", E: "#0A0A12", K: "#0C0C14", N: "#2A3560" },
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
