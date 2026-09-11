import type { Spell, SpellId } from './battle';

export type BattleVariant = 'baseline' | 'book' | 'hand';
export type Tradition = 'margin' | 'hearth';
export interface BattleOptions {
  variant?: BattleVariant;
  traditions?: Partial<Record<'mage1' | 'mage2', Tradition>>;
  seed?: number;
}
export const TRADITIONS: Record<Tradition, { id: Tradition; name: string; description: string; motif: string }> = {
  margin: { id: 'margin', name: 'Marginweaver', description: 'Damage through shields. Mark a foe, then hit it harder with your signature. This is the book you practised with.', motif: 'ink, folded paper, orbiting script' },
  hearth: { id: 'hearth', name: 'Hearthbinder', description: 'Gain protection while marking foes. Your signature spends leftover protection for more damage.', motif: 'warm thread, woven lanterns, sheltering wings' },
};
const traditionSpells: Record<Tradition, Record<SpellId, [string, string]>> = {
  margin: {
    spark: ['Quill Flick', '5 damage. No Ember cost.'],
    mark: ['Living Marginalia', '4 damage through ward. Mark the foe for 2 more rounds.'],
    unfold: ['Atlas Unbound', '9 damage. Marked foe: 18 damage, plus 5 to other foes. Uses the mark.'],
    shelter: ['Paper Sanctuary', '11 protection for you or an ally through next round. Replaces existing ward.'],
    unseal: ['Cut the Binding', 'Remove ward; 4 damage. Marks shielded foes. Halves this round’s heavy strike.'],
    mend: ['A Quiet Margin', 'Restore 12 health to you or an ally.'],
  },
  hearth: {
    spark: ['Hearth Spark', '5 damage. No Ember cost.'],
    mark: ['Kindling Stitch', '3 damage. Mark for 2 more rounds; gain 6 ward through next round.'],
    unfold: ['The Lantern Wakes', '8 damage; +6 if marked. Uses the mark and up to 8 of your ward for extra damage.'],
    shelter: ['Hearthlash Mantle', '11 ward for you or an ally through next round. The next absorbed hit returns 5 damage.'],
    unseal: ['Loose the Knot', 'Remove ward; 4 damage. Halves this round’s heavy strike. Keep up to 4 removed ward.'],
    mend: ['Lantern Mending', 'Restore 12 health. Up to 6 excess healing becomes ward through next round.'],
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
