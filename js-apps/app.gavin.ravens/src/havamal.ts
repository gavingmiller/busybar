/**
 * Short lines from the Hávamál ("Sayings of the High One"), the Poetic Edda poem
 * in Odin's voice. Printable ASCII only: the device fonts are bitmap ASCII.
 */
export const HAVAMAL: readonly string[] = [
  "Cattle die, kinsmen die, you yourself will die; but fair fame never dies for the one who earns it.",
  "A guest must depart again on his way, nor stay in the same place ever.",
  "Praise no day until evening, no wife until burned, no sword until tried.",
  "The foolish man lies awake all night and worries over everything; he is tired when morning comes and all is as it was.",
  "Be a friend to your friend, and repay gift with gift.",
  "Better a house, though a hut it be, a man is master at home.",
  "Wits are needful to him who travels far; at home all is easy.",
  "The flock knows the man who is loved by his friends; the lonely one stands alone.",
];

/** Picks a line other than the last one shown, so two presses never repeat. */
export function nextLine(previous: number): number {
  if (HAVAMAL.length < 2) return 0;
  let index = Math.floor(Math.random() * HAVAMAL.length);
  if (index === previous) index = (index + 1) % HAVAMAL.length;
  return index;
}
