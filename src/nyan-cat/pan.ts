// Camera "pan": every so often the sky seems to pull ahead and the cat falls
// behind (drifts left), hangs there a moment, then catches up (drifts back
// to its home spot). The scene itself is a native looping .anim; only the
// cat layer's x is nudged, by the always-on control server, through
// ordinary draw upserts (confirmed live: moving an AnimationElement does
// not restart its playback, and the star layer behind it stays put).

export interface PanStep {
  /** Cat element x to draw. The first step is the home position (no draw, just the idle wait). */
  x: number;
  /** How long to wait after this step before the next one. */
  waitMs: number;
}

export const PAN = {
  /** Idle at home between excursions, ms. */
  idleMs: [5_000, 20_000] as const,
  /** How far the cat falls behind, px. */
  driftPx: [8, 24] as const,
  /** Hold at the far point, ms. */
  holdMs: [500, 3_000] as const,
  /** Nominal duration of the drift out and the catch-up, ms (stretched when the 1 px/step floor demands). */
  driftOutMs: 2_600,
  catchUpMs: 2_200,
  /** Shortest gap between draws while moving; the device throttles above ~10 req/s. */
  stepMs: 120,
  minStepMs: 110,
  maxDriftPx: 24,
};

/** Inverse of a quadratic ease-in-out: the time fraction at which the eased progress reaches `y`. */
const easeInOutInverse = (y: number) => (y < 0.5 ? Math.sqrt(y / 2) : 1 - Math.sqrt((1 - y) / 2));
const pick = (random: () => number, [min, max]: readonly [number, number]) => min + random() * (max - min);

/**
 * Steps for a move from `from` to `to`: always one pixel per draw (so the
 * motion is never jumpy), with the ease-in-out expressed in the time between
 * draws — slow at both ends, fastest in the middle, never faster than
 * PAN.minStepMs per pixel. `ms` is the nominal duration; it stretches if the
 * per-pixel floor needs more.
 */
function moveSteps(from: number, to: number, ms: number, holdAfterMs: number): PanStep[] {
  const n = Math.abs(to - from);
  const dir = Math.sign(to - from);
  const steps: PanStep[] = [];
  for (let i = 1; i <= n; i++) {
    const x = from + dir * i;
    const last = i === n;
    const wait = last ? holdAfterMs : Math.max(PAN.minStepMs, Math.round((easeInOutInverse((i + 1) / n) - easeInOutInverse(i / n)) * ms));
    steps.push({ x, waitMs: wait });
  }
  return steps;
}

/**
 * One excursion from `homeX`: idle, drift left by a random distance, hold,
 * catch up to home. `random` returns [0, 1) and is consumed in that order:
 * idle, distance, hold.
 */
export function planPan(homeX: number, random: () => number = Math.random): PanStep[] {
  const idle = Math.round(pick(random, PAN.idleMs));
  const drift = Math.round(pick(random, PAN.driftPx));
  const hold = Math.round(pick(random, PAN.holdMs));
  const far = homeX - drift;
  return [
    { x: homeX, waitMs: idle },
    ...moveSteps(homeX, far, PAN.driftOutMs, hold),
    // Back home; the next plan's own idle wait follows, so just one normal step gap here.
    ...moveSteps(far, homeX, PAN.catchUpMs, PAN.stepMs),
  ];
}

export interface PanDeps {
  homeX: number;
  /** Draws the cat element at x (an upsert of just that element). */
  draw: (x: number) => Promise<void>;
  random?: () => number;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (id: unknown) => void;
  onError?: (err: unknown) => void;
}

export interface PanHandle {
  stop(): void;
}

/** Runs excursions back to back until stopped. Each draw is awaited before the next wait starts, so steps never overlap. */
export function startPan(deps: PanDeps): PanHandle {
  const random = deps.random ?? Math.random;
  const schedule = deps.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = deps.cancel ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  let stopped = false;
  let timer: unknown = null;
  let plan: PanStep[] = [];
  let index = 0;

  const next = (): void => {
    if (stopped) return;
    if (index >= plan.length) {
      plan = planPan(deps.homeX, random);
      index = 0;
    }
    const step = plan[index++]!;
    const go = index === 1 ? Promise.resolve() : deps.draw(step.x).catch((err) => deps.onError?.(err));
    void go.then(() => {
      if (stopped) return;
      timer = schedule(next, step.waitMs);
    });
  };

  next();
  return {
    stop() {
      stopped = true;
      if (timer !== null) cancel(timer);
      timer = null;
    },
  };
}
