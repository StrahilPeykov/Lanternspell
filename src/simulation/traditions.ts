import type { Spell, SpellId } from './battle';

export type BattleVariant = 'baseline' | 'book' | 'hand';
export type Tradition = 'margin' | 'hearth';
export interface BattleOptions {
  variant?: BattleVariant;
  traditions?: Partial<Record<'mage1' | 'mage2', Tradition>>;
  seed?: number;
}
export const TRADITIONS: Record<Tradition, { id: Tradition; name: string; description: string; motif: string }> = {
  margin: { id: 'margin', name: 'Marginweaver', description: 'Write through wards. Turn an inscription into a wide constellation, or cut a binding to reveal a new margin.', motif: 'ink, folded paper, orbiting script' },
  hearth: { id: 'hearth', name: 'Hearthbinder', description: 'Protect while preparing. Keep your shelter for a counterstroke, or weave its remaining ward into your signature.', motif: 'warm thread, woven lanterns, sheltering wings' },
};
const traditionSpells: Record<Tradition, Record<SpellId, [string, string]>> = {
  margin: {
    spark: ['Quill Flick', 'Deal 5 damage. Always available, even outside your hand.'],
    mark: ['Living Marginalia', 'Deal 4 damage through ward; inscribe through two further rounds. Useful now, ready to unfold later.'],
    unfold: ['Atlas Unbound', 'Deal 9 damage, or 18 to an inscribed foe and 5 to other foes. Consume its seed. Margin note adds 3 to the main hit.'],
    shelter: ['Paper Sanctuary', 'Give yourself or a living ally 11 ward through the next round. Ward does not stack.'],
    unseal: ['Cut the Binding', 'Remove all ward and deal 4 damage. Removing ward also inscribes the foe. Halve its heavy strike this round.'],
    mend: ['A Quiet Margin', 'Restore 12 health to yourself or a living ally.'],
  },
  hearth: {
    spark: ['Hearth Spark', 'Deal 5 damage. Always available, even outside your hand.'],
    mark: ['Kindling Stitch', 'Deal 3 damage; inscribe through two further rounds and give yourself 6 ward through the next round.'],
    unfold: ['The Lantern Wakes', 'Deal 8 damage, +6 if inscribed. Consume the seed and up to 8 of your ward for equal extra damage. Margin note adds 3.'],
    shelter: ['Hearthlash Mantle', 'Give yourself or an ally 11 ward through next round. The next hit absorbed by it returns 5 damage to its attacker.'],
    unseal: ['Loose the Knot', 'Remove ward, deal 4 damage, and halve this round’s heavy strike. Reweave up to 4 removed ward onto yourself.'],
    mend: ['Lantern Mending', 'Restore 12 health. Up to 6 excess healing becomes ward through the next round, ready to shelter or release.'],
  },
};
export function traditionalSpell(base: Spell, tradition: Tradition): Spell {
  const [name, description] = traditionSpells[tradition][base.id];
  return { ...base, name, description };
}

/** Eight prepared pages. Refill wraps around this once-shuffled order; no reshuffle state. */
export function makeDeck(seed: number): SpellId[] {
  const deck: SpellId[] = ['mark', 'mark', 'unfold', 'unfold', 'shelter', 'shelter', 'unseal', 'mend'];
  let state = seed >>> 0;
  for (let i = deck.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  // Teaching reliability: begin with one signature setup, while the other three pages vary.
  const markIndex = deck.indexOf('mark');
  [deck[0], deck[markIndex]] = [deck[markIndex]!, deck[0]!];
  return deck;
}
