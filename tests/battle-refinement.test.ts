import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createBattle, getSpell, nextDraw, previewQueue, resolveRound, type Battle, type Plan, type SpellId } from '../src/simulation/battle';

const spark: Plan = { actorId: 'mage1', spellId: 'spark', targetId: 'guardian' };
const mage = (b: Battle) => b.actors.find(a => a.id === 'mage1')!;

describe('seeded-hand escape from unavailable pages', () => {
  it('turns exactly the visible leftmost page on a free attack without spending Ember', () => {
    const battle = createBattle('guardian', 'solo', false, { variant: 'hand', seed: 17 });
    const before = JSON.stringify(battle);
    const hand = [...mage(battle).hand!];
    const expected = nextDraw(battle, 'mage1')!;
    const queue = previewQueue(battle, [spark]);
    expect(JSON.stringify(battle)).toBe(before);
    const result = resolveRound(battle, [spark]);
    expect(mage(result.battle).hand).toEqual([...hand.slice(1), expected]);
    expect(mage(result.battle).drawIndex).toBe(5);
    expect(mage(result.battle).ember).toBe(5);
    expect(queue[0]!.text).toContain(`Turned ${getSpell(battle, 'mage1', hand[0]!).name}`);
    expect(result.events[0]!.text).toBe(queue[0]!.text);
    expect(getSpell(battle, 'mage1', 'spark').description).toContain('leftmost');
  });

  it('can reach every prepared role without paying for an unwanted page, for arbitrary seeds', () => {
    fc.assert(fc.property(fc.integer(), seed => {
      let battle = createBattle('guardian', 'solo', false, { variant: 'hand', seed });
      // Labelled endurance fixture: isolate page reachability from encounter length/health.
      for (const actor of battle.actors) actor.hp = actor.maxHp = 1000;
      const observed = new Set<SpellId>(mage(battle).hand);
      for (let i = 0; i < 8; i++) {
        battle = resolveRound(battle, [spark]).battle;
        for (const page of mage(battle).hand!) observed.add(page);
        expect(mage(battle).hand).toHaveLength(4);
      }
      expect([...observed].sort()).toEqual(['mark', 'mend', 'shelter', 'unfold', 'unseal']);
      expect(JSON.parse(JSON.stringify(battle))).toEqual(battle);
    }), { seed: 9112601, numRuns: 100 });
  });

  it('preserves paid-page replacement and leaves baseline/full-book attacks unchanged', () => {
    const battle = createBattle('guardian', 'solo', false, { variant: 'hand', seed: 17 });
    const before = [...mage(battle).hand!];
    const expected = nextDraw(battle, 'mage1')!;
    const result = resolveRound(battle, [{ ...spark, spellId: 'mark' }]);
    before[before.indexOf('mark')] = expected;
    expect(mage(result.battle).hand).toEqual(before);
    for (const variant of ['baseline', 'book'] as const) {
      const original = createBattle('guardian', 'solo', false, { variant });
      const result = resolveRound(original, [spark]);
      expect(mage(result.battle).hand).toBeUndefined();
      expect(result.events[0]!.text).not.toContain('Turned');
      expect(getSpell(original, 'mage1', 'spark').description).not.toContain('leftmost');
    }
  });
});
