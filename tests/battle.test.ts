import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createBattle, getIntentions, previewQueue, resolveRound, SPELLS, validatePlan, type Battle, type Plan, type SpellId } from '../src/simulation/battle';

const plan = (spellId: SpellId, targetId = 'guardian', actorId = 'mage1'): Plan => ({ spellId, targetId, actorId });
const byId = (b: Battle, id: string) => b.actors.find(a => a.id === id)!;
describe('pure ordered spellbook rules', () => {
  it('is immutable, deterministic, and serializable', () => {
    const battle = createBattle('guardian', 'solo');
    const before = JSON.stringify(battle);
    const result = resolveRound(battle, [plan('mark')]);
    expect(JSON.stringify(battle)).toBe(before);
    expect(resolveRound(battle, [plan('mark')])).toEqual(result);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
  it('allows solo setup then an affordable exploit on the next round', () => {
    let battle = createBattle('guardian', 'solo');
    battle.actors[1]!.ward = 0; // Labelled fixture: unwarded target.
    battle = resolveRound(battle, [plan('mark')]).battle;
    expect(byId(battle, 'mage1').ember).toBe(4);
    expect(byId(battle, 'guardian').markedUntil).toBe(3);
    const next = resolveRound(battle, [plan('unfold')]);
    expect(next.events.find(e => e.spellId === 'unfold')?.amount).toBe(18);
    expect(byId(next.battle, 'guardian').markedUntil).toBe(0);
  });
  it('expires a seed at the named round boundary and refreshes instead of stacking', () => {
    let battle = createBattle('guardian', 'solo');
    battle = resolveRound(battle, [plan('mark')]).battle;
    battle = resolveRound(battle, [plan('shelter', 'mage1')]).battle;
    expect(byId(battle, 'guardian').markedUntil).toBe(3);
    battle = resolveRound(battle, [plan('mend', 'mage1')]).battle;
    expect(battle.round).toBe(4);
    expect(byId(battle, 'guardian').markedUntil).toBe(0);
  });
  it('support works on self and Unstitch removes ward and weakens heavy intent', () => {
    let battle = createBattle('guardian', 'solo');
    battle = resolveRound(battle, [plan('shelter', 'mage1')]).battle;
    expect(byId(battle, 'mage1').hp).toBe(38);
    expect(getIntentions(battle)[0]!.amount).toBe(12);
    battle = resolveRound(battle, [plan('unseal')]).battle;
    expect(byId(battle, 'guardian').ward).toBe(0);
    expect(byId(battle, 'mage1').hp).toBe(37); // 6 weakened damage minus remaining 5 ward.
  });
  it('arrival order does not change outcomes or action queue', () => {
    const battle = createBattle('guardian', 'duo');
    const plans = [plan('spark'), plan('unseal', 'guardian', 'mage2')];
    expect(resolveRound(battle, plans)).toEqual(resolveRound(battle, [...plans].reverse()));
    expect(previewQueue(battle, plans)[0]!.spellId).toBe('unseal');
  });
  it('ordinary same-round duo synergy works without a player-count damage bonus', () => {
    const battle = createBattle('guardian', 'duo');
    byId(battle, 'guardian').ward = 0; // Labelled fixture: compare identical seeded damage.
    byId(battle, 'mage2').ember = 4;
    const result = resolveRound(battle, [plan('unfold', 'guardian', 'mage2'), plan('mark')]);
    expect(result.events.find(e => e.spellId === 'unfold')?.amount).toBe(18);
    expect(byId(result.battle, 'guardian').markedUntil).toBe(0);
  });
  it('previews the same fallback when an earlier action defeats the requested foe', () => {
    const battle = createBattle('guardian', 'duo');
    byId(battle, 'moth1').hp = 3; // Labelled fixture: vulnerable second enemy.
    const plans = [plan('spark', 'moth1'), plan('spark', 'moth1', 'mage2')];
    const queue = previewQueue(battle, plans);
    expect(queue.find(a => a.actorId === 'mage2')?.targetId).toBe('guardian');
    expect(queue.find(a => a.actorId === 'mage2')?.fallbackFrom).toBe('moth1');
    expect(resolveRound(battle, plans).events.find(e => e.actorId === 'mage2')?.targetId).toBe('guardian');
  });
  it('rejects illegal and duplicate plans without resource expenditure', () => {
    const battle = createBattle('guardian', 'solo');
    expect(validatePlan(battle, plan('unfold'))).toMatch('Ember');
    expect(validatePlan(battle, plan('mend'))).toMatch('friendly');
    expect(() => resolveRound(battle, [plan('spark'), plan('spark')])).toThrow('Exactly one');
    expect(byId(battle, 'mage1').ember).toBe(3);
  });
  it('victory is terminal and rewards are not emitted twice', () => {
    const battle = createBattle('lesson', 'solo');
    byId(battle, 'moth1').hp = 1; // Labelled fixture: final blow.
    const result = resolveRound(battle, [plan('spark', 'moth1')]);
    expect(result.battle.phase).toBe('victory');
    expect(result.battle.rewardGranted).toBe(true);
    expect(result.events.filter(e => e.kind === 'victory')).toHaveLength(1);
    expect(resolveRound(result.battle, [plan('spark', 'moth1')]).events).toEqual([]);
  });
  it('defeat is authoritative regardless of presentation skip or replay', () => {
    const battle = createBattle('guardian', 'solo');
    byId(battle, 'mage1').hp = 1; // Labelled fixture: lethal incoming strike.
    const result = resolveRound(battle, [plan('spark')]);
    expect(result.battle.phase).toBe('defeat');
    const saved = JSON.parse(JSON.stringify(result.battle)) as Battle;
    expect(resolveRound(saved, []).battle).toEqual(result.battle);
    expect(saved.rewardGranted).toBe(false);
  });
  it('maintains bounds under arbitrary legal choices and serialization boundaries', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 50 }), { minLength: 1, maxLength: 40 }), choices => {
      let battle = createBattle('guardian', 'duo', true);
      for (const choice of choices) {
        if (battle.phase !== 'planning') break;
        const plans = battle.actors.filter(a => a.team === 'mage' && a.hp > 0).map((mage, index) => {
          const available = Object.values(SPELLS).filter(s => s.cost <= mage.ember);
          const spell = available[(choice + index) % available.length]!;
          const target = battle.actors.find(a => a.team === spell.target && a.hp > 0)!;
          return { actorId: mage.id, spellId: spell.id, targetId: target.id };
        });
        const result = resolveRound(battle, plans);
        expect(resolveRound(battle, [...plans].reverse())).toEqual(result);
        expect(result.battle.revision).toBe(battle.revision + 1);
        battle = JSON.parse(JSON.stringify(result.battle)) as Battle;
        for (const a of battle.actors) {
          expect(a.hp).toBeGreaterThanOrEqual(0); expect(a.hp).toBeLessThanOrEqual(a.maxHp);
          expect(a.ember).toBeGreaterThanOrEqual(0); expect(a.ember).toBeLessThanOrEqual(7);
          expect(a.ward).toBeGreaterThanOrEqual(0);
        }
      }
    }), { seed: 9182026, numRuns: 150 });
  });
});

describe('labelled diagnostic policies, not human enjoyment evidence', () => {
  it('compares four policies across opening, imminent-heavy and vulnerable fixtures', () => {
    const rows: { mode: string; state: string; policy: string; result: string; rounds: number; hp: string }[] = [];
    for (const mode of ['solo', 'duo'] as const) for (const state of ['opening', 'heavy', 'vulnerable']) for (const policy of ['basic', 'strongest', 'setup', 'defensive']) {
      let battle = createBattle('guardian', mode, true);
      if (state === 'heavy') battle.round = 2;
      if (state === 'vulnerable') { const guardian = byId(battle, 'guardian'); guardian.ward = 0; guardian.hp = 26; guardian.markedUntil = 3; }
      let rounds = 0;
      while (battle.phase === 'planning' && rounds < 40) {
        const plans = battle.actors.filter(a => a.team === 'mage' && a.hp > 0).map(mage => {
          const foe = battle.actors.find(a => a.team === 'enemy' && a.hp > 0)!;
          let spell: SpellId = 'spark';
          if (policy === 'strongest' && mage.ember >= 4) spell = 'unfold';
          if (policy === 'setup' || policy === 'defensive') {
            if (foe.ward && mage.ember >= 2) spell = 'unseal';
            else if (foe.markedUntil >= battle.round && mage.ember >= 4) spell = 'unfold';
            else if (!foe.markedUntil && mage.ember >= 1) spell = 'mark';
          }
          if (policy === 'defensive') {
            if (mage.hp <= 22 && mage.ember >= 3) spell = 'mend';
            else if (battle.round % 3 === 2 && mage.hp <= 18 && mage.ember >= 2) spell = 'shelter';
          }
          return plan(spell, SPELLS[spell].target === 'mage' ? mage.id : foe.id, mage.id);
        });
        battle = resolveRound(battle, plans).battle;
        rounds++;
      }
      rows.push({ mode, state, policy, result: battle.phase, rounds, hp: battle.actors.filter(a => a.team === 'mage').map(a => a.hp).join('/') });
    }
    console.table(rows);
    expect(rows.find(r => r.mode === 'solo' && r.state === 'opening' && r.policy === 'setup')?.result).toBe('victory');
    expect(rows.find(r => r.mode === 'solo' && r.state === 'opening' && r.policy === 'strongest')?.result).toBe('victory');
  });
});
