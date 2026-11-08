// Procedural rainbow trail (replaces the hand-authored TRAIL_FRAMES, whose
// 2-pixel bumps flipping every few frames read as jarring on the bar).
//
// Six bands (red, orange, yellow, green, blue, purple — the NYAN_COLORS
// keys) stacked top to bottom, every column offset by a gentle travelling
// sine wave of ±1 px that scrolls one column left per frame. Because the
// wave moves instead of flipping, consecutive frames differ by a single
// pixel column shift and the motion reads as smooth at TRAIL_FPS.

/** Band colour keys in NYAN_COLORS, top to bottom. */
export const TRAIL_BANDS = ["R", "O", "Y", "G", "C", "P"] as const;
/** Pixels per wave, also the horizontal distance between two crests. */
export const TRAIL_WAVELENGTH = 24;
/** Frames before the wave pattern repeats exactly (one wavelength scrolled past). */
export const TRAIL_PERIOD = TRAIL_WAVELENGTH;
/** Wave amplitude in pixels. */
const AMPLITUDE = 1;

/** Vertical offset of column `x` on frame `frame`: a sine wave travelling left. */
export function waveOffset(frame: number, x: number): number {
  // Reduce modulo the wavelength first so the pattern is exactly periodic
  // (otherwise rounding at the sin = ±0.5 points can differ a wavelength apart).
  const step = (((x + frame) % TRAIL_WAVELENGTH) + TRAIL_WAVELENGTH) % TRAIL_WAVELENGTH;
  const phase = (step / TRAIL_WAVELENGTH) * Math.PI * 2;
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
