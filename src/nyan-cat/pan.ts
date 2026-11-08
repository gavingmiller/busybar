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
  /** Duration of the drift out and the catch-up, ms. */
  driftOutMs: 1_800,
  catchUpMs: 1_400,
  /** Interval between draws while moving; the device throttles above ~10 req/s. */
  stepMs: 125,
  minStepMs: 100,
  maxStepPx: 4,
  maxDriftPx: 24,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const pick = (random: () => number, [min, max]: readonly [number, number]) => min + random() * (max - min);

/** Steps for a move from `from` to `to` over `ms`, eased, one every PAN.stepMs. */
function moveSteps(from: number, to: number, ms: number, holdAfterMs: number): PanStep[] {
  const n = Math.max(1, Math.round(ms / PAN.stepMs));
  const steps: PanStep[] = [];
  for (let i = 1; i <= n; i++) {
    const x = Math.round(lerp(from, to, easeInOut(i / n)));
    const last = i === n;
    steps.push({ x, waitMs: last ? holdAfterMs : PAN.stepMs });
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
