import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyCommand, initialCampaign, jointPlanKey, parseCommand, roundId, snapshot, type CampaignState, type Command, type CommandBody, type Seat } from '../server/protocol';
import { createBattle } from '../src/simulation/battle';

const both: Seat[] = ['mage1', 'mage2'];
let serial = 0;
const cmd = (body: CommandBody): Command => ({ ...body, version: 1, commandId: `test-${++serial}` });
/** Named fixture: arranged lesson round, used only for protocol/rules diagnostics. */
function lessonFixture(): CampaignState { const s = initialCampaign('test'); s.stage = 2; s.battle = createBattle('lesson', 'duo'); return s; }
function plan(s: CampaignState, seat: Seat, spellId: 'spark' | 'mark' = 'spark') {
  return cmd({ kind: 'plan', roundId: roundId(s), revision: s.battle!.revision, planRevision: s.planRevisions[seat], plan: { actorId: seat, spellId, targetId: 'moth1' } });
}
function ready(s: CampaignState) { return cmd({ kind: 'ready', roundId: roundId(s), revision: s.battle!.revision, jointPlanKey: jointPlanKey(s) }); }
describe('Shared authority transitions (arranged protocol fixtures)', () => {
  it('accepts concurrent plans against the same battle revision', () => {
    const s = lessonFixture(), p1 = plan(s, 'mage1'), p2 = plan(s, 'mage2');
    const first = applyCommand(s, 'mage1', p1, both);
    const second = applyCommand(first.state, 'mage2', p2, both);
    expect(second.ack.accepted).toBe(true); expect(second.state.planRevisions).toEqual({ mage1: 1, mage2: 1 }); expect(second.state.battle!.revision).toBe(0);
  });
  it('editing invalidates the full joint readiness; stale confirm cannot resolve', () => {
    let s = lessonFixture(); for (const seat of both) s = applyCommand(s, seat, plan(s, seat), both).state;
    const oldReady = ready(s); s = applyCommand(s, 'mage1', oldReady, both).state;
    s = applyCommand(s, 'mage2', plan(s, 'mage2', 'mark'), both).state;
    expect(s.ready).toEqual({}); expect(applyCommand(s, 'mage2', oldReady, both).ack.accepted).toBe(false);
    expect(s.battle!.round).toBe(1);
  });
  it('commits one complete round, rejects old/repeated confirmations, survives serialized reconstruction', () => {
    let s = lessonFixture(); for (const seat of both) s = applyCommand(s, seat, plan(s, seat), both).state;
    const confirmation = ready(s); s = applyCommand(s, 'mage1', confirmation, both).state;
    s = applyCommand(s, 'mage2', confirmation, both).state;
    expect(s.battle!.round).toBe(2); expect(s.battle!.revision).toBe(1); expect(s.lastResult!.events.length).toBeGreaterThan(0);
    const rebuilt = JSON.parse(JSON.stringify(s));
    expect(applyCommand(rebuilt, 'mage2', confirmation, both).ack.accepted).toBe(false);
    expect(applyCommand(rebuilt, 'mage2', confirmation, both).state).toEqual(s);
  });
  it('pauses before resolution when a participant disconnects; after commit retains result', () => {
    let s = lessonFixture(); for (const seat of both) s = applyCommand(s, seat, plan(s, seat), both).state;
    s = applyCommand(s, 'mage1', ready(s), both).state;
    expect(applyCommand(s, 'mage2', ready(s), ['mage1']).ack.accepted).toBe(false);
    s = applyCommand(s, 'mage2', ready(s), both).state;
    expect(snapshot(s, ['mage1']).paused).toBe(true); expect(snapshot(s, both).lastResult).toEqual(s.lastResult);
  });
  it('requires two independent encounter consents and rejects out-of-range interactions', () => {
    let s = initialCampaign('test');
    expect(applyCommand(s, 'mage1', cmd({ kind: 'interact', interaction: 'lantern' }), both).ack.accepted).toBe(false);
    s.stage = 2; s.positions.mage1 = { x: 0, z: -4, yaw: 0 }; s.positions.mage2 = { x: 0, z: -4, yaw: 0 };
    s = applyCommand(s, 'mage1', cmd({ kind: 'consent', encounter: 'lesson' }), both).state; expect(s.battle).toBeNull();
    s = applyCommand(s, 'mage2', cmd({ kind: 'consent', encounter: 'lesson' }), both).state; expect(s.battle!.mode).toBe('duo');
  });
  it('advances a victory reward once; the next retry cannot award again', () => {
    let s = lessonFixture(); s.battle!.actors.find(a => a.id === 'moth1')!.hp = 1;
    for (const seat of both) s = applyCommand(s, seat, plan(s, seat), both).state;
    const r = ready(s); s = applyCommand(s, 'mage1', r, both).state; s = applyCommand(s, 'mage2', r, both).state;
    expect(s.stage).toBe(3); expect(s.rewardIds).toHaveLength(1);
    s = applyCommand(s, 'mage2', r, both).state; expect(s.rewardIds).toHaveLength(1);
  });
  it('validates bounded versioned input', () => {
    expect(parseCommand('x'.repeat(4097))).toBeNull(); expect(parseCommand('{')).toBeNull();
    expect(parseCommand(JSON.stringify({ ...cmd({ kind: 'move', position: { x: 200, z: 0, yaw: 0 } }) }))).toBeNull();
    expect(parseCommand(JSON.stringify(cmd({ kind: 'sync' })))?.kind).toBe('sync');
    expect(parseCommand(JSON.stringify({ ...cmd({ kind: 'sync' }), version: 2 }))).toBeNull();
    expect(parseCommand(JSON.stringify({ ...cmd({ kind: 'sync' }), commandId: '../credential' }))).toBeNull();
  });
  it('one seat cannot plan another mage, and same-seat concurrent edits accept only one revision', () => {
    const s = lessonFixture();
    expect(applyCommand(s, 'mage1', plan(s, 'mage2'), both).ack.accepted).toBe(false);
    const edit = plan(s, 'mage1'); const first = applyCommand(s, 'mage1', edit, both);
    expect(first.ack.accepted).toBe(true);
    expect(applyCommand(first.state, 'mage1', plan(s, 'mage1', 'mark'), both).ack.accepted).toBe(false);
  });
  it('consent expires if an earlier consenting player leaves the encounter area', () => {
    let s = initialCampaign('test'); s.stage = 2;
    s.positions.mage1 = { x: 0, z: -4, yaw: 0 }; s.positions.mage2 = { x: 0, z: -4, yaw: 0 };
    s = applyCommand(s, 'mage1', cmd({ kind: 'consent', encounter: 'lesson' }), both).state;
    s.positions.mage1.z = 10;
    s = applyCommand(s, 'mage2', cmd({ kind: 'consent', encounter: 'lesson' }), both).state;
    expect(s.battle).toBeNull(); expect(s.consent.mage1).toBeUndefined();
  });
  it('model sequences never resolve without two confirmations of the current plans', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 6 }), { maxLength: 80 }), actions => {
      let s = lessonFixture(); let stale: Command | null = null;
      for (const action of actions) {
        if (s.battle!.phase !== 'planning') break;
        const before = structuredClone(s), seat = action % 2 === 0 ? 'mage1' : 'mage2';
        const command: Command = action < 2 ? plan(s, seat) : action < 4 ? ready(s) : action === 4 && stale ? stale : plan(s, seat, 'mark');
        stale = command;
        const connected = action === 6 ? ['mage1' as Seat] : both;
        const result = applyCommand(s, seat, command, connected); s = result.state;
        if (s.battle!.revision > before.battle!.revision) {
          expect(command.kind).toBe('ready'); expect(connected).toHaveLength(2);
          expect(before.ready[seat === 'mage1' ? 'mage2' : 'mage1']).toBe(jointPlanKey(before));
          expect(s.battle!.revision).toBe(before.battle!.revision + 1);
        }
        if (!result.ack.accepted) expect(s).toEqual(before);
      }
    }), { numRuns: 200 });
  });
});
