// Every pre-rendered scene the control server offers, in the order the
// control page lists them (after Nyan Cat). Each lives in its own folder.
import type { Scene } from "../lib/scene.ts";
import { AQUARIUM } from "./aquarium/index.ts";
import { MATRIX_RAIN } from "./matrix-rain/index.ts";

export const SCENES: readonly Scene[] = [AQUARIUM, MATRIX_RAIN];
