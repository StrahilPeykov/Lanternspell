import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { availableSpells, createBattle, getIntentions, getSpell, nextDraw, previewQueue, resolveRound, validatePlan, type Battle, type Plan, type SpellId } from '../src/simulation/battle';

const actor = (b: Battle, id = 'mage1') => b.actors.find(a => a.id === id)!;
const plan = (spellId: SpellId, targetId = 'guardian', actorId = 'mage1'): Plan => ({ actorId, spellId, targetId });
describe('controlled tradition variants', () => {
  it('preserves baseline exactly and gives each tradition six self-sufficient roles', () => {
    expect(createBattle('guardian', 'solo', true, { variant: 'baseline', traditions: { mage1: 'hearth' }, seed: 7 })).toEqual(createBattle('guardian', 'solo', true));
    for (const tradition of ['margin', 'hearth'] as const) {
      const b = createBattle('guardian', 'solo', true, { variant: 'book', traditions: { mage1: tradition } });
      expect(availableSpells(b, 'mage1')).toHaveLength(6);
      expect(getSpell(b, 'mage1', 'shelter').target).toBe('mage');
      expect(getSpell(b, 'mage1', 'mend').target).toBe('mage');
      expect(getSpell(b, 'mage1', 'mark').name).not.toBe('Inkseed');
    }
  });
  it('Marginweaver setup hurts through ward now and preserves a future opportunity', () => {
    const b = createBattle('guardian', 'solo', true, { variant: 'book', traditions: { mage1: 'margin' } });
    const next = resolveRound(b, [plan('mark')]).battle;
    expect(actor(next, 'guardian').hp).toBe(32); expect(actor(next, 'guardian').ward).toBe(8);
    expect(actor(next, 'guardian').markedUntil).toBe(3);
    expect(actor(next).ember).toBe(4);
    expect(getIntentions(next)[0]!.spellId).toBe('purge');
    const exploit = resolveRound(next, [plan('unfold')]);
    expect(exploit.events.find(e => e.spellId === 'unfold')?.text).toContain('21 damage');
  });
  it('Hearthbinder setup supplies immediate shelter; release spends real protection', () => {
    const b = createBattle('guardian', 'solo', true, { variant: 'book', traditions: { mage1: 'hearth' } });
    const next = resolveRound(b, [plan('mark')]).battle;
    expect(actor(next).hp).toBe(38); expect(actor(next, 'guardian').ward).toBe(5);
    const fixture = createBattle('guardian', 'solo', true, { variant: 'book', traditions: { mage1: 'hearth' } });
    actor(fixture).ward = 8; actor(fixture).wardUntil = 3; actor(fixture).ember = 4;
    actor(fixture, 'guardian').ward = 0; actor(fixture, 'guardian').markedUntil = 3;
    const released = resolveRound(fixture, [plan('unfold')]);
    expect(released.events.find(e => e.spellId === 'unfold')?.amount).toBe(25);
    expect(actor(released.battle).ward).toBe(0); expect(actor(released.battle).hp).toBe(32);
    const kept = resolveRound(fixture, [plan('spark')]).battle;
    expect(actor(kept).hp).toBe(38); expect(actor(kept).ward).toBe(2);
  });
  it('a hearth mantle protects either tradition and counters only once', () => {
    const b = createBattle('guardian', 'duo', false, { variant: 'book', traditions: { mage1: 'hearth', mage2: 'margin' } });
    actor(b, 'guardian').ward = 0; // Labelled fixture: inspect returned HP damage without ward absorption.
    const next = resolveRound(b, [plan('shelter', 'mage1'), plan('spark', 'moth1', 'mage2')]).battle;
    expect(actor(next, 'guardian').hp).toBe(57);
    expect(actor(next).counter).toBe(0); expect(actor(next).hp).toBe(38);
    expect(actor(next, 'mage2').hp).toBe(38); // Both intentions locked onto mage1 before its mantle was chosen.
    expect(actor(next, 'moth1').hp).toBe(9); // No second counterstroke against the moth.
  });
  it('does not pretend two simultaneous unseals each removed the same ward', () => {
    const b = createBattle('guardian', 'duo', false, { variant: 'book', traditions: { mage1: 'margin', mage2: 'hearth' } });
    const next = resolveRound(b, [plan('unseal'), plan('unseal', 'guardian', 'mage2')]).battle;
    expect(actor(next, 'mage2').ward).toBe(0);
    expect(actor(next, 'guardian').markedUntil).toBe(3);
  });
  it('locks state-based intentions at planning start and changes only at the next boundary', () => {
    const b = createBattle('guardian', 'solo', false, { variant: 'book' });
    const locked = getIntentions(b);
    previewQueue(b, [plan('mark')]); previewQueue(b, [plan('unseal')]);
    expect(getIntentions(b)).toEqual(locked);
    getIntentions(b)[0]!.amount = 999; expect(getIntentions(b)).toEqual(locked);
    const next = resolveRound(b, [plan('unseal')]).battle;
    expect(getIntentions(next)[0]!.spellId).toBe('rebind');
    expect(locked[0]!.spellId).toBe('strike');
    expect(next.intentions).toEqual(getIntentions(next));
    expect(JSON.parse(JSON.stringify(next))).toEqual(next);
  });
  it('deals seeded cards reproducibly, exposes the next draw, and rejects unavailable spells', () => {
    const b = createBattle('guardian', 'solo', false, { variant: 'hand', seed: 123 });
    expect(createBattle('guardian', 'solo', false, { variant: 'hand', seed: 123 })).toEqual(b);
    expect(actor(b).hand).toHaveLength(4); expect(actor(b).drawPile).toHaveLength(8);
    const expected = nextDraw(b, 'mage1');
    const first = actor(b).hand![0]!;
    const next = resolveRound(b, [plan(first)]).battle;
    expect(actor(next).hand![0]).toBe(expected); expect(actor(b).drawIndex).toBe(4);
    const unavailable = ['unseal', 'mend', 'shelter', 'unfold'].find(s => !actor(b).hand!.includes(s as SpellId)) as SpellId;
    if (unavailable) expect(validatePlan(b, plan(unavailable, getSpell(b, 'mage1', unavailable).target === 'mage' ? 'mage1' : 'guardian'))).toContain('hand');
    expect(availableSpells(next, 'mage1').find(s => s.id === 'spark')?.cost).toBe(0);
  });
  it('keeps hand snapshots immutable and deterministic under arbitrary legal joint plans', () => {
    fc.assert(fc.property(fc.integer(), fc.array(fc.nat(100), { minLength: 1, maxLength: 30 }), (seed, choices) => {
      let b = createBattle('guardian', 'duo', true, { variant: 'hand', seed });
      for (const choice of choices) {
        if (b.phase !== 'planning') break;
        const plans = b.actors.filter(a => a.team === 'mage' && a.hp > 0).map((mage, i) => {
          const options = availableSpells(b, mage.id).filter(s => s.cost <= mage.ember);
          expect(options.some(s => s.id === 'spark')).toBe(true);
          const spell = options[(choice + i) % options.length]!;
          return plan(spell.id, b.actors.find(a => a.team === spell.target && a.hp > 0)!.id, mage.id);
        });
        const before = JSON.stringify(b);
        const normal = resolveRound(b, plans), reversed = resolveRound(b, [...plans].reverse());
        expect(normal).toEqual(reversed); expect(JSON.stringify(b)).toBe(before);
        b = JSON.parse(JSON.stringify(normal.battle));
        for (const a of b.actors) {
          expect(a.hp).toBeGreaterThanOrEqual(0); expect(a.hp).toBeLessThanOrEqual(a.maxHp);
          expect(a.ward).toBeGreaterThanOrEqual(0); expect(a.ward).toBeLessThanOrEqual(11);
          expect(a.ember).toBeGreaterThanOrEqual(0); expect(a.ember).toBeLessThanOrEqual(7);
          if (a.team === 'mage') expect(a.hand).toHaveLength(4);
        }
      }
    }), { seed: 9102601, numRuns: 100 });
  });
});
