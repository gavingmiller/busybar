// Shuffle: a control-server mode that plays a different animation every two
// hours, dealing every animation once (a "round") before any repeats. The
// state is small and lives in the server's state file so a restart resumes
// the round where it left off.

export const SHUFFLE_INTERVAL_MS = 2 * 60 * 60 * 1000;

export interface ShuffleState {
  /** Animations still to be shown this round, in play order. */
  deck: string[];
  /** The animation currently on the bar (the server's `active` app while shuffle is on). */
  showing: string;
  /** UTC ISO 8601 `Z` instant of the next change. */
  nextAt: string;
}

/** Starts the clock on an animation already showing: it counts as this round's current card. */
export function adoptShowing(state: ShuffleState | null, showing: string, ids: readonly string[], now: Date, random: () => number = Math.random): ShuffleState {
  let deck = (state?.deck ?? []).filter((id) => ids.includes(id) && id !== showing);
  if (deck.length === 0 && state === null) deck = shuffleDeck(ids.filter((id) => id !== showing), random);
  return { deck, showing, nextAt: new Date(now.getTime() + SHUFFLE_INTERVAL_MS).toISOString() };
}

/** Fisher–Yates over a copy of `ids`, randomness injected for tests. */
export function shuffleDeck(ids: readonly string[], random: () => number = Math.random): string[] {
  const deck = [...ids];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

/** The next card: the round's remaining deck, or a fresh deal when it is exhausted (never repeating the card just shown). */
export function advanceShuffle(state: ShuffleState | null, ids: readonly string[], now: Date, random: () => number = Math.random): ShuffleState {
  let deck = (state?.deck ?? []).filter((id) => ids.includes(id));
  if (deck.length === 0) {
    deck = shuffleDeck(ids, random);
    if (deck.length > 1 && deck[0] === state?.showing) deck.push(deck.shift()!);
  }
  const showing = deck.shift()!;
  return { deck, showing, nextAt: new Date(now.getTime() + SHUFFLE_INTERVAL_MS).toISOString() };
}
