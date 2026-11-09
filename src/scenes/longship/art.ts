// Longship pixel art, hand-drawn at bar scale, every ship FACING RIGHT (the
// scene mirrors it for the leftward voyage). "." is transparent. Outlines
// and hulls are mid browns, never near-black: the sky behind is black.
//   M mast  S sail  R sail stripe  H hull  D keel (dark hull)  Y prow / dragon head and shield  B shield  G rope

export interface ShipArt {
  rows: readonly string[];
  colors: Readonly<Record<string, string>>;
}

/** The foreground longship: 22x11, keel on the last row, dragon-head prow at the right. */
export const LONGSHIP_ART: ShipArt = {
  rows: [
    "..........M...........",
    "....SSSSSSMSSSSSS.....",
    "....RRRRRRMRRRRRR.....",
    "....SSSSSSMSSSSSS.....",
    "....RRRRRRMRRRRRR...YY",
    "....SSSSSSMSSSSSS...Y.",
    "....G.....M.....G...Y.",
    "H...G.....M.....G...H.",
    "HHYBYBYBYBYBYBYBYBYHH.",
    ".HHHHHHHHHHHHHHHHHHHH.",
    "..DDDDDDDDDDDDDDDDDD..",
  ],
  colors: { M: "#8A5A2A", S: "#E8E2CC", R: "#B8321E", H: "#7A4A22", D: "#5A3A1E", Y: "#D8B060", B: "#4D7FB3", G: "#9A8A6A" },
};

/** A distant longship on the horizon: 8x5, desaturated. */
export const SMALL_SHIP_ART: ShipArt = {
  rows: [
    "...M....",
    ".SSMSS..",
    ".SSMSS..",
    "...M...Y",
    "HHHHHHHH",
  ],
  colors: { M: "#6A5A4A", S: "#A09C90", H: "#5A4A3A", Y: "#9A8A60" },
};

/** The farthest ship: 6x4. */
export const TINY_SHIP_ART: ShipArt = {
  rows: [
    "..M...",
    ".SMS..",
    "..M..Y",
    "HHHHHH",
  ],
  colors: { M: "#5A4E42", S: "#8A867C", H: "#4A3E32", Y: "#86785A" },
};
