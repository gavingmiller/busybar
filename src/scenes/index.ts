// Every pre-rendered scene the control server offers, in the order the
// control page lists them (after Nyan Cat). Each lives in its own folder.
import type { Scene } from "../lib/scene.ts";
import { AQUARIUM } from "./aquarium/index.ts";
import { LAVA_LAMP } from "./lava-lamp/index.ts";
import { MATRIX_RAIN } from "./matrix-rain/index.ts";
import { MUNCHERS_RUN } from "./munchers-run/index.ts";
import { CHARACTER_PICKS } from "./munchers-run/picks.ts";
import { LONGSHIP } from "./longship/index.ts";
import { FIREFLIES } from "./fireflies/index.ts";
import { SLEIGH } from "./sleigh/index.ts";

export const SCENES: readonly Scene[] = [LAVA_LAMP, MATRIX_RAIN, AQUARIUM, MUNCHERS_RUN, LONGSHIP, FIREFLIES, SLEIGH, CHARACTER_PICKS];
