// Camera "pan": every so often the sky seems to pull ahead and the cat falls
// behind, hangs there a moment, then catches up. The motion itself is baked
// into the cat layer's .anim as extra sections (excursion.ts) and plays at
// the device's own frame rate; this module only decides WHEN, and tells the
// device which section to play next.
//
// Device semantics (Dino Run's pattern, confirmed live 2026-11-08): an upsert
// with `await_previous_end` is queued and starts when the running section
// ends — on the loop boundary for a looping one — and the queue is one deep:
// a second queued upsert replaces the first. So: queue the one-shot
// excursion, wait a full loop (it has started by then), queue the home loop
// to follow it, then wait the excursion out.

export const PAN = {
  /** Idle at home between excursions, ms. */
  idleMs: [5_000, 20_000] as const,
  /** Slack past one loop before queuing home behind the excursion. */
  startMarginMs: 500,
};

export const HOME_SECTION = "home";

export interface PanExcursion {
  name: string;
  durationMs: number;
}

export interface PanDeps {
  excursions: readonly PanExcursion[];
  /** Length of the home loop, ms. */
  loopMs: number;
  /** Upserts the cat element to play `section` (looping or one-shot) after the current one ends. */
  play: (section: string, loop: boolean) => Promise<void>;
  random?: () => number;
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (id: unknown) => void;
  onError?: (err: unknown) => void;
}

export interface PanHandle {
  stop(): void;
}

const pick = (random: () => number, [min, max]: readonly [number, number]) => min + random() * (max - min);

/** Runs idle → excursion → home cycles until stopped. */
export function startPan(deps: PanDeps): PanHandle {
  const random = deps.random ?? Math.random;
  const schedule = deps.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel = deps.cancel ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  let stopped = false;
  let timer: unknown = null;

  const after = (ms: number, fn: () => void): void => {
    if (stopped) return;
    timer = schedule(fn, ms);
  };
  const play = (section: string, loop: boolean): Promise<void> =>
    deps.play(section, loop).catch((err) => deps.onError?.(err));

  const cycle = (): void => {
    after(Math.round(pick(random, PAN.idleMs)), () => {
      if (stopped) return;
      const excursion = deps.excursions[Math.min(deps.excursions.length - 1, Math.floor(random() * deps.excursions.length))]!;
      void play(excursion.name, false).then(() => {
        after(deps.loopMs + PAN.startMarginMs, () => {
          if (stopped) return;
          void play(HOME_SECTION, true).then(() => after(excursion.durationMs, cycle));
        });
      });
    });
  };

  cycle();
  return {
    stop() {
      stopped = true;
      if (timer !== null) cancel(timer);
      timer = null;
    },
  };
}
