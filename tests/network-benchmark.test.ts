import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyCommand, hydrateCampaign, initialCampaign, jointPlanKey, parseCommand, roundId, snapshot, type CampaignState, type Command, type CommandBody, type Seat } from '../server/protocol';
import { availableSpells, createBattle, type BattleVariant } from '../src/simulation/battle';

const both: Seat[] = ['mage1', 'mage2'];
let serial = 0;
const command = (body: CommandBody): Command => ({ ...body, version: 1, commandId: `benchmark-${++serial}` });
function act(s: CampaignState, seat: Seat, body: CommandBody, connected = both) { return applyCommand(s, seat, command(body), connected); }
/** Arranged marker positions are a protocol fixture, not a claim of gameplay input. */
function atLesson(variant: BattleVariant = 'book') {
  const s = initialCampaign('benchmark-fixture'); s.stage = 2; s.variant = variant;
  s.positions.mage1 = { x: -1, z: -4, yaw: 0 }; s.positions.mage2 = { x: 1, z: -4, yaw: 0 };
  return s;
}
function start(s: CampaignState) {
  s = act(s, 'mage1', { kind: 'consent', encounter: 'lesson', configRevision: s.configRevision }).state;
  return act(s, 'mage2', { kind: 'consent', encounter: 'lesson', configRevision: s.configRevision }).state;
}
describe('benchmark shared configuration and optional fact (protocol fixtures)', () => {
  it('defaults new sessions to book, but preserves pre-benchmark sessions and active baseline battles', () => {
    expect(initialCampaign('new').variant).toBe('book');
    const legacy = initialCampaign('legacy') as Partial<CampaignState>;
    legacy.battle = createBattle('lesson', 'duo');
    delete legacy.variant; delete legacy.traditions; delete legacy.facts; delete legacy.configRevision;
    const before = structuredClone(legacy.battle);
    const migrated = hydrateCampaign(legacy as CampaignState);
    expect(migrated.variant).toBe('baseline'); expect(migrated.facts).toEqual({ echo: false });
    expect(migrated.battle).toEqual(before); expect(hydrateCampaign(migrated)).toEqual(migrated);
  });
  it('validates only the bounded supported configuration values', () => {
    for (const configuration of [{}, [], { variant: 'ranked' }, { tradition: 'fire' }, { variant: null }]) {
      expect(parseCommand(JSON.stringify({ version: 1, commandId: 'invalid', kind: 'configure', configuration }))).toBeNull();
    }
    expect(parseCommand(JSON.stringify(command({ kind: 'configure', configuration: { variant: 'hand', tradition: 'hearth' } })))?.kind).toBe('configure');
    expect(parseCommand(JSON.stringify(command({ kind: 'interact', interaction: 'echo' })))?.kind).toBe('interact');
    expect(parseCommand(JSON.stringify({ version: 1, commandId: 'bad', kind: 'consent', encounter: 'lesson', configRevision: -1 }))).toBeNull();
  });
  it('allows host preparation before a friend arrives, restricts variant ownership, and keeps traditions personal', () => {
    let s = initialCampaign('permissions');
    s = act(s, 'mage1', { kind: 'configure', configuration: { variant: 'hand', tradition: 'hearth' } }, ['mage1']).state;
    expect(s.variant).toBe('hand'); expect(s.traditions).toEqual({ mage1: 'hearth', mage2: 'hearth' });
    const forbidden = act(s, 'mage2', { kind: 'configure', configuration: { variant: 'baseline', tradition: 'margin' } });
    expect(forbidden.ack.accepted).toBe(false); expect(forbidden.state).toEqual(s);
    s = act(s, 'mage2', { kind: 'configure', configuration: { tradition: 'margin' } }).state;
    expect(s.traditions).toEqual({ mage1: 'hearth', mage2: 'margin' }); expect(s.variant).toBe('hand');
  });
  it('clears consent on meaningful edits and rejects delayed consent against the previous configuration', () => {
    let s = atLesson(); const stale = command({ kind: 'consent', encounter: 'lesson', configRevision: s.configRevision });
    s = applyCommand(s, 'mage1', stale, both).state; expect(s.consent.mage1).toBe('lesson');
    s = act(s, 'mage2', { kind: 'configure', configuration: { tradition: 'margin' } }).state;
    expect(s.consent).toEqual({}); expect(s.configRevision).toBe(1);
    expect(applyCommand(s, 'mage2', stale, both).ack.accepted).toBe(false);
    expect(applyCommand(s, 'mage1', stale, both).ack.accepted).toBe(false);
    s = start(s); expect(s.battle?.variant).toBe('book');
    expect(s.battle?.actors.filter(a => a.team === 'mage').map(a => a.tradition)).toEqual(['margin', 'margin']);
    expect(act(s, 'mage1', { kind: 'configure', configuration: { variant: 'baseline' } }).ack.accepted).toBe(false);
  });
  it('retains consent for identical configuration and permits a consented legacy baseline encounter', () => {
    let s = atLesson('baseline');
    s = act(s, 'mage1', { kind: 'consent', encounter: 'lesson' }).state;
    s = act(s, 'mage1', { kind: 'configure', configuration: { variant: 'baseline', tradition: 'margin' } }).state;
    expect(s.configRevision).toBe(0); expect(s.consent.mage1).toBe('lesson');
    s = act(s, 'mage2', { kind: 'consent', encounter: 'lesson' }).state;
    expect(s.battle?.variant ?? 'baseline').toBe('baseline');
  });
  it('records echo once after NPC, requires proximity, and never advances the main stage', () => {
    let s = initialCampaign('echo'); s.positions.mage1 = { x: -10, z: 10, yaw: 0 };
    expect(act(s, 'mage1', { kind: 'interact', interaction: 'echo' }).ack.accepted).toBe(false);
    s.stage = 1;
    expect(act(s, 'mage2', { kind: 'interact', interaction: 'echo' }).ack.accepted).toBe(false);
    s = act(s, 'mage1', { kind: 'interact', interaction: 'echo' }).state;
    expect(s.stage).toBe(1); expect(s.facts).toEqual({ echo: true });
    expect(act(s, 'mage1', { kind: 'interact', interaction: 'echo' }).ack.accepted).toBe(false);
    expect(hydrateCampaign(JSON.parse(JSON.stringify(s))).facts).toEqual({ echo: true });
    expect(snapshot(s, both).facts).toEqual({ echo: true });
  });
  it.each(['book', 'hand'] as const)('%s remains deterministic across serialized authority reconstruction and simultaneous plan submission', variant => {
    let s = start(atLesson(variant));
    expect(s.battle?.variant).toBe(variant);
    const initial = structuredClone(s);
    const plans = both.map(seat => command({ kind: 'plan', roundId: roundId(s), revision: s.battle!.revision, planRevision: s.planRevisions[seat], plan: { actorId: seat, spellId: 'spark', targetId: 'moth1' } }));
    for (const [i, seat] of both.entries()) {
      expect(availableSpells(s.battle!, seat).some(spell => spell.id === 'spark')).toBe(true);
      const result = applyCommand(s, seat, plans[i], both); expect(result.ack.accepted).toBe(true); s = result.state;
    }
    const ready = command({ kind: 'ready', roundId: roundId(s), revision: s.battle!.revision, jointPlanKey: jointPlanKey(s) });
    s = applyCommand(s, 'mage1', ready, both).state;
    const rebuilt = hydrateCampaign(JSON.parse(JSON.stringify(s)));
    const committed = applyCommand(s, 'mage2', ready, both).state;
    expect(applyCommand(rebuilt, 'mage2', ready, both).state).toEqual(committed);
    expect(committed.battle!.revision).toBe(initial.battle!.revision + 1);
    expect(applyCommand(committed, 'mage2', ready, both).ack.accepted).toBe(false);
  });
  it('model configuration sequences retain seat ownership and clear every obsolete consent', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 5 }), { maxLength: 30 }), changes => {
      let s = atLesson();
      for (const change of changes) {
        s = act(s, 'mage1', { kind: 'consent', encounter: 'lesson', configRevision: s.configRevision }).state;
        const before = structuredClone(s);
        const seat: Seat = change % 2 ? 'mage2' : 'mage1';
        const configuration = change < 2 ? { variant: 'hand' as const } : { tradition: change < 4 ? 'margin' as const : 'hearth' as const };
        const result = act(s, seat, { kind: 'configure', configuration }); s = result.state;
        if (s.configRevision !== before.configRevision) { expect(s.consent).toEqual({}); expect(s.configRevision).toBe(before.configRevision + 1); }
        expect(s.traditions[seat === 'mage1' ? 'mage2' : 'mage1']).toBe(before.traditions[seat === 'mage1' ? 'mage2' : 'mage1']);
        if (seat === 'mage2') expect(s.variant).toBe(before.variant);
        expect(s.stage).toBe(2); expect(s.battle).toBeNull();
      }
    }), { numRuns: 100 });
  });
});
