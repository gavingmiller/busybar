// Procedural rainbow trail (replaces the hand-authored TRAIL_FRAMES, whose
// 2-pixel bumps flipping every few frames read as jarring on the bar).
//
// Six bands (red, orange, yellow, green, blue, purple — the NYAN_COLORS
// keys) stacked top to bottom, every column offset by a gentle travelling
// sine wave of ±1 px that scrolls one column left per frame. Because the
// wave moves instead of flipping, the motion reads as smooth.
//
// Timing is in wall-clock terms (px/s, seconds); frame counts are derived
// from TRAIL_FPS, the .anim frame rate the scene is encoded at. The device
// plays .anim files at ~62 fps natively, so 48 fps costs nothing in
// smoothness and lets a 16 px/s wave advance in 1/3 px phase steps.

/** Band colour keys in NYAN_COLORS, top to bottom. */
export const TRAIL_BANDS = ["R", "O", "Y", "G", "C", "P"] as const;
/** Frame rate the trail (and the whole Nyan scene) is encoded at. */
export const TRAIL_FPS = 48;
/** How fast the wave travels left, in pixels per second. */
export const TRAIL_SPEED_PX_PER_S = 16;
/** Pixels per wave, also the horizontal distance between two crests. */
export const TRAIL_WAVELENGTH = 24;
/** Frames before the wave pattern repeats exactly (one wavelength scrolled past): 1.5 s. */
export const TRAIL_PERIOD = (TRAIL_WAVELENGTH / TRAIL_SPEED_PX_PER_S) * TRAIL_FPS;
/** Frames per pixel of wave travel. */
export const TRAIL_SCROLL_FRAMES = TRAIL_FPS / TRAIL_SPEED_PX_PER_S;
if (!Number.isInteger(TRAIL_PERIOD) || !Number.isInteger(TRAIL_SCROLL_FRAMES)) {
  throw new Error("trail: TRAIL_FPS must be a multiple of TRAIL_SPEED_PX_PER_S so the wave loops on whole frames");
}
/** Wave amplitude in pixels. */
const AMPLITUDE = 1;

/** Vertical offset of column `x` on frame `frame`: a sine wave travelling left 1/TRAIL_SCROLL_FRAMES px per frame. */
export function waveOffset(frame: number, x: number): number {
  // Work in whole phase steps (TRAIL_SCROLL_FRAMES per pixel) and reduce
  // modulo the period first so the pattern is exactly periodic (otherwise
  // rounding at the sin = ±0.5 points can differ a period apart).
  const step = (((x * TRAIL_SCROLL_FRAMES + frame) % TRAIL_PERIOD) + TRAIL_PERIOD) % TRAIL_PERIOD;
  const phase = (step / TRAIL_PERIOD) * Math.PI * 2;
  return Math.round(Math.sin(phase) * AMPLITUDE);
}

/**
 * One frame of the trail as an ASCII grid (one char per pixel, "." clear),
 * `length` wide and `height` tall. The six bands share the height evenly
 * (any remainder goes to the top bands) and leave one row of headroom
 * top and bottom for the wave.
 */
export function trailGrid(frame: number, length: number, height: number): string[] {
  const usable = height - 2 * AMPLITUDE;
  const base = Math.floor(usable / TRAIL_BANDS.length);
  const extra = usable - base * TRAIL_BANDS.length;
  const bandRows: string[] = [];
  TRAIL_BANDS.forEach((band, i) => {
    for (let r = 0; r < base + (i < extra ? 1 : 0); r++) bandRows.push(band);
  });

  const rows: string[][] = Array.from({ length: height }, () => Array(length).fill("."));
  for (let x = 0; x < length; x++) {
    const top = AMPLITUDE + waveOffset(frame, x);
    bandRows.forEach((band, r) => {
      const y = top + r;
      if (y >= 0 && y < height) rows[y]![x] = band;
    });
  }
  return rows.map((row) => row.join(""));
}
