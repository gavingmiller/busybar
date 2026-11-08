// Lava Lamp: a port of robynhub's community BUSY Bar app (busybar-apps/
// apps/lava-lamp) to a pre-rendered Scene. The original integrates blob
// physics live at 12 fps and is deliberately aperiodic; a baked loop can't be,
// so here every blob rides periodic curves whose cycle counts divide the loop
// — the metaball rendering (field, soft sigmoid edge, halo, glass shading and
// the classic palette) is kept from the original.

import { type Scene, FRONT_WIDTH, FRONT_HEIGHT } from "../../lib/scene.ts";

export const LAVA_FPS = 24;
/** One rise-and-fall cycle of the blobs. */
export const MOTION_LOOP_S = 20;
/** The whole asset: one slow tour of every palette, with the motion repeating underneath. */
export const LAVA_LOOP_S = 360;
export const LAVA_FRAME_COUNT = LAVA_FPS * LAVA_LOOP_S;
const MOTION_FRAME_COUNT = LAVA_FPS * MOTION_LOOP_S;

export interface Palette { name: string; lava: string; highlight: string; background: string }

/** The original app's themes, ordered so neighbours blend pleasantly; the cycle tours them in this order. */
export const PALETTES: readonly Palette[] = [
  { name: "classic", lava: "#FF5A24", highlight: "#FFB000", background: "#190019" },
  { name: "sunset", lava: "#FF3A5E", highlight: "#FFB13B", background: "#21000B" },
  { name: "magenta", lava: "#FF2D95", highlight: "#9B4DFF", background: "#120018" },
  { name: "ocean", lava: "#00D4FF", highlight: "#0077FF", background: "#001226" },
  { name: "ice", lava: "#D8FFFF", highlight: "#5DEBFF", background: "#00141A" },
  { name: "toxic", lava: "#7CFF00", highlight: "#D7FF2F", background: "#061400" },
];

const TAU = Math.PI * 2;

export interface Blob {
  /** Lane the blob drifts around, px. */
  anchorX: number;
  /** Horizontal wobble amplitude, px, and whole cycles per loop. */
  wobble: number;
  wobbleCycles: number;
  wobblePhase: number;
  /** Vertical travel: centre, amplitude (px) and whole cycles per loop. */
  midY: number;
  rise: number;
  riseCycles: number;
  risePhase: number;
  /** Base radius, breathing amount and whole cycles per loop. */
  radius: number;
  pulse: number;
  pulseCycles: number;
  pulsePhase: number;
  /** Squash: rx/ry trade places as the blob speeds up and slows down. */
  squash: number;
  /** Small attached lobe (as in the original) that slowly orbits the core. */
  lobeW: number;
  lobeCycles: number;
  lobePhase: number;
}

/**
 * Six lumps of wax spread across the lamp (the original defaults to 6 blobs,
 * radii 5–7.2). Rise cycles are small integers so each blob makes 1–3 full
 * trips per 20 s loop — the original's `--speed 8` pace — and travel well past
 * the top and bottom edges, like the original's off-screen turnarounds, so only
 * two or three are in view at a time against the dark glass.
 */
export const BLOBS: readonly Blob[] = [
  { anchorX: 7,  wobble: 2.2, wobbleCycles: 1, wobblePhase: 0.3, midY: 8, rise: 16, riseCycles: 1, risePhase: 0.0, radius: 5.6, pulse: 0.16, pulseCycles: 3, pulsePhase: 1.1, squash: 0.18, lobeW: 0.24, lobeCycles: 2, lobePhase: 0.4 },
  { anchorX: 20, wobble: 3.0, wobbleCycles: 2, wobblePhase: 2.1, midY: 8, rise: 17, riseCycles: 2, risePhase: 2.4, radius: 4.6, pulse: 0.14, pulseCycles: 4, pulsePhase: 0.2, squash: 0.22, lobeW: 0.22, lobeCycles: 3, lobePhase: 2.9 },
  { anchorX: 33, wobble: 2.6, wobbleCycles: 1, wobblePhase: 4.0, midY: 8, rise: 16, riseCycles: 1, risePhase: 3.6, radius: 6.0, pulse: 0.16, pulseCycles: 2, pulsePhase: 2.7, squash: 0.16, lobeW: 0.26, lobeCycles: 1, lobePhase: 1.6 },
  { anchorX: 45, wobble: 2.4, wobbleCycles: 2, wobblePhase: 1.2, midY: 8, rise: 17, riseCycles: 3, risePhase: 1.3, radius: 4.4, pulse: 0.18, pulseCycles: 5, pulsePhase: 4.1, squash: 0.24, lobeW: 0.20, lobeCycles: 2, lobePhase: 5.2 },
  { anchorX: 57, wobble: 2.8, wobbleCycles: 1, wobblePhase: 5.3, midY: 8, rise: 16, riseCycles: 2, risePhase: 5.0, radius: 5.2, pulse: 0.15, pulseCycles: 3, pulsePhase: 0.9, squash: 0.2,  lobeW: 0.24, lobeCycles: 3, lobePhase: 3.3 },
  { anchorX: 67, wobble: 2.0, wobbleCycles: 2, wobblePhase: 0.8, midY: 8, rise: 17, riseCycles: 1, risePhase: 1.9, radius: 5.7, pulse: 0.16, pulseCycles: 2, pulsePhase: 3.5, squash: 0.17, lobeW: 0.22, lobeCycles: 1, lobePhase: 0.1 },
];

export interface BlobState {
  x: number;
  y: number;
  rx: number;
  ry: number;
  lobeDx: number;
  lobeDy: number;
  lobeW: number;
  heatPhase: number;
}

/** Where each blob is on frame `frame` (any integer; periodic in MOTION_FRAME_COUNT). */
export function blobStates(frame: number): BlobState[] {
  const u = (frame % MOTION_FRAME_COUNT) / MOTION_FRAME_COUNT; // motion-loop fraction
  return BLOBS.map((b) => {
    const riseAngle = TAU * (b.riseCycles * u) + b.risePhase;
    const y = b.midY - b.rise * Math.sin(riseAngle);
    const x = b.anchorX + b.wobble * Math.sin(TAU * (b.wobbleCycles * u) + b.wobblePhase);
    const breath = 1 + b.pulse * Math.sin(TAU * (b.pulseCycles * u) + b.pulsePhase);
    // Moving fast (mid-travel) stretches the blob vertically; turning round at the ends flattens it.
    const speed = Math.cos(riseAngle); // -1..1, |speed| high mid-lamp
    const stretch = 1 + b.squash * (Math.abs(speed) - 0.5);
    const r = b.radius * breath;
    const lobeAngle = TAU * (b.lobeCycles * u) + b.lobePhase;
    return {
      x, y,
      rx: r / stretch,
      ry: r * stretch,
      lobeDx: Math.cos(lobeAngle) * r * 0.55,
      lobeDy: Math.sin(lobeAngle) * r * 0.55,
      lobeW: b.lobeW,
      heatPhase: b.lobePhase + b.pulsePhase,
    };
  });
}

const hex = (s: string): [number, number, number] => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mix = (a: readonly number[], b: readonly number[], t: number): [number, number, number] =>
  [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];
const scale = (c: readonly number[], k: number): [number, number, number] => [c[0]! * k, c[1]! * k, c[2]! * k];
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * The lava, highlight and background colours on frame `frame` as nine channel
 * values: the palette ring is walked once per LAVA_LOOP_S, each theme pure at
 * the start of its segment and eased into the next, so the colour shifts
 * imperceptibly from frame to frame and the ring closes on the loop.
 */
export function paletteAt(frame: number): number[] {
  const n = PALETTES.length;
  const pos = (((frame % LAVA_FRAME_COUNT) + LAVA_FRAME_COUNT) % LAVA_FRAME_COUNT) / LAVA_FRAME_COUNT * n;
  const i = Math.floor(pos);
  const t = smooth(pos - i);
  const a = PALETTES[i]!, b = PALETTES[(i + 1) % n]!;
  const blend = (x: string, y: string) => mix(hex(x), hex(y), t).map(Math.round);
  return [...blend(a.lava, b.lava), ...blend(a.highlight, b.highlight), ...blend(a.background, b.background)];
}

// Rendering constants from the original's defaults.
const SOFTNESS = 0.65;
const DENSITY = 1.0;
const BRIGHTNESS = 1.0;
const HALO_ONSET = 0.5;
const EDGE_FLOOR = 0.08;

/** One frame of the lamp, opaque RGBA. */
export function renderFrame(frame: number): Uint8Array {
  const out = new Uint8Array(FRONT_WIDTH * FRONT_HEIGHT * 4);
  const states = blobStates(frame);
  const t = ((frame % MOTION_FRAME_COUNT) / MOTION_FRAME_COUNT) * MOTION_LOOP_S;
  const pal = paletteAt(frame);
  const LAVA = pal.slice(0, 3), HI = pal.slice(3, 6), BG: [number, number, number] = [pal[6]!, pal[7]!, pal[8]!];
  const edgeK = 0.10 + SOFTNESS * 0.26;
  const haloC = scale(LAVA, 0.24 * BRIGHTNESS);
  for (let y = 0; y < FRONT_HEIGHT; y++) {
    for (let x = 0; x < FRONT_WIDTH; x++) {
      let field = 0;
      let heat = 0;
      for (let k = 0; k < states.length; k++) {
        const s = states[k]!;
        const dx = (x - s.x) / s.rx;
        const dy = (y - s.y) / s.ry;
        let c = 1 / (dx * dx + dy * dy + 0.11);
        const lrx = Math.max(0.8, s.rx * 0.72);
        const lry = Math.max(0.8, s.ry * 0.72);
        const ldx = (x - s.x - s.lobeDx) / lrx;
        const ldy = (y - s.y - s.lobeDy) / lry;
        c += s.lobeW / (ldx * ldx + ldy * ldy + 0.16);
        field += c;
        // Heat varies per blob on a loop-closing cycle (the original used t*0.35 with a random phase).
        heat += c * (0.72 + 0.28 * Math.sin(s.heatPhase + TAU * Math.round(0.35 * MOTION_LOOP_S / TAU) * (t / MOTION_LOOP_S)));
      }
      const f = field * 0.54 * DENSITY;
      const edge = 1 / (1 + Math.exp(-(f - 1) / edgeK));
      // Halo onset raised from the original's 0.28: six periodic blobs keep the field
      // higher between them than the original's live simulation does, and the glass
      // between blobs should stay dark.
      const halo = clamp01((f - HALO_ONSET) / (1 - HALO_ONSET)) * 0.22;
      let col: [number, number, number] = BG;
      // The sigmoid never quite reaches zero, which on the original tints the whole
      // glass a shade of lava; lift the floor so the space between blobs is truly dark.
      const lit = clamp01((edge - EDGE_FLOOR) / (1 - EDGE_FLOOR));
      if (lit > 0 || halo > 0) {
        const molten = Math.min(1, lit * 1.08);
        const hotness = clamp01(heat / Math.max(field, 1e-6) - 0.55);
        let c = mix(LAVA, HI, Math.min(1, molten * 0.58 + hotness * 0.55));
        c = scale(c, BRIGHTNESS * (0.72 + 0.28 * molten));
        col = halo > 0 ? mix(mix(BG, haloC, halo), c, molten) : mix(BG, c, molten);
      }
      // Glass shading at the extreme edges, as in the original.
      if (x === 0 || x === FRONT_WIDTH - 1) col = mix(BG, col, 0.42);
      else if (x === 1 || x === FRONT_WIDTH - 2) col = mix(BG, col, 0.66);
      const i = (y * FRONT_WIDTH + x) * 4;
      out[i] = Math.round(clamp01(col[0] / 255) * 255);
      out[i + 1] = Math.round(clamp01(col[1] / 255) * 255);
      out[i + 2] = Math.round(clamp01(col[2] / 255) * 255);
      out[i + 3] = 255;
    }
  }
  return out;
}

export const LAVA_LAMP: Scene = {
  id: "lava_lamp",
  name: "Lava Lamp",
  fps: LAVA_FPS,
  frames: () => Array.from({ length: LAVA_FRAME_COUNT }, (_, i) => renderFrame(i)),
};
