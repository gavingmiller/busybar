// Nyan Cat flavours: the same hand-authored pixel art (sprite-data.ts) with
// some of its colour keys swapped. Each flavour is its own animation on the
// control server and bakes its own cat-layer asset (tagged by `asset`), so
// switching between flavours never removes the other one's upload.

import { NYAN_COLORS } from "./sprite-data.ts";

export interface NyanFlavour {
  /** Control-server animation id. */
  id: string;
  /** Listed name. */
  name: string;
  /** Tag in the cat-layer asset file name: `nyan-<asset>-<hash>.anim`. */
  asset: string;
  /** Overrides for NYAN_COLORS keys (M = frosting, D = sprinkles). */
  colors: Readonly<Record<string, string>>;
}

export const CLASSIC_NYAN: NyanFlavour = { id: "nyan_cat", name: "Nyan Cat", asset: "cat", colors: {} };

/** Purple frosting with pink sprinkles (Gavin 2026-11-09). */
export const PURPLE_NYAN: NyanFlavour = {
  id: "nyan_cat_purple",
  name: "Purple Nyan Cat",
  asset: "purple",
  colors: { M: "#B266FFFF", D: "#FF80E0FF" },
};

export const NYAN_FLAVOURS: readonly NyanFlavour[] = [CLASSIC_NYAN, PURPLE_NYAN];

export const flavourColors = (f: NyanFlavour): Record<string, string> => ({ ...NYAN_COLORS, ...f.colors });
export const flavourById = (id: string): NyanFlavour | undefined => NYAN_FLAVOURS.find((f) => f.id === id);
