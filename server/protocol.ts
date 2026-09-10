import { createBattle, resolveRound, validatePlan, type Battle, type BattleEvent, type Plan } from '../src/simulation/battle';

export type Seat = 'mage1' | 'mage2';
export type Position = { x: number; z: number; yaw: number };
export type Encounter = 'lesson' | 'guardian';
export type Interaction = 'npc' | 'lantern' | 'discovery';
export type CommandBody =
  | { kind: 'interact'; interaction: Interaction }
  | { kind: 'consent'; encounter: Encounter }
  | { kind: 'plan'; roundId: string; revision: number; planRevision: number; plan: Plan }
  | { kind: 'ready'; roundId: string; revision: number; jointPlanKey: string }
  | { kind: 'leaveBattle' }
  | { kind: 'move'; position: Position }
  | { kind: 'sync' };
export type Command = CommandBody & { version: 1; commandId: string };
export type Ack = { type: 'ack'; version: 1; commandId: string; accepted: boolean; reason?: string; revision: number };
export interface CampaignState {
  version: 1; sessionId: string; stage: number; battle: Battle | null;
  plans: Partial<Record<Seat, Plan>>; planRevisions: Record<Seat, number>; ready: Partial<Record<Seat, string>>;
  consent: Partial<Record<Seat, Encounter>>; positions: Record<Seat, Position>;
  lastResult: { id: string; events: BattleEvent[] } | null;
  battleSerial: number; rewardIds: string[];
}
export interface Snapshot extends CampaignState {
  type: 'snapshot'; jointPlanKey: string; roundId: string; paused: boolean;
  seats: { id: Seat; connected: boolean; position: Position }[];
}
export const SEATS: Seat[] = ['mage1', 'mage2'];
export const POINTS = { npc: { x: -3, z: 6 }, lantern: { x: 4, z: 1 }, discovery: { x: -5, z: -9 }, lesson: { x: 0, z: -4 }, guardian: { x: 0, z: -14 } };
export function initialCampaign(sessionId: string): CampaignState {
  return { version: 1, sessionId, stage: 0, battle: null, plans: {}, planRevisions: { mage1: 0, mage2: 0 }, ready: {}, consent: {}, positions: { mage1: { x: -0.7, z: 10, yaw: 0 }, mage2: { x: 0.7, z: 10, yaw: 0 } }, lastResult: null, battleSerial: 0, rewardIds: [] };
}
export const roundId = (s: CampaignState) => s.battle ? `${s.battle.id}:${s.battle.round}` : '';
export const jointPlanKey = (s: CampaignState) => `${roundId(s)}:${s.planRevisions.mage1}:${s.planRevisions.mage2}`;
export function snapshot(s: CampaignState, connected: Seat[]): Snapshot {
  return { ...structuredClone(s), type: 'snapshot', roundId: roundId(s), jointPlanKey: jointPlanKey(s), paused: SEATS.some(id => !connected.includes(id)), seats: SEATS.map(id => ({ id, connected: connected.includes(id), position: s.positions[id] })) };
}
function nearby(s: CampaignState, seat: Seat, point: { x: number; z: number }) {
  return Math.hypot(s.positions[seat].x - point.x, s.positions[seat].z - point.z) <= 5;
}
export function parseCommand(input: string): Command | null {
  if (input.length > 4096) return null;
  let v: any; try { v = JSON.parse(input); } catch { return null; }
  if (!v || v.version !== 1 || typeof v.commandId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(v.commandId)) return null;
  if (['sync', 'leaveBattle'].includes(v.kind)) return v;
  if (v.kind === 'interact' && ['npc', 'lantern', 'discovery'].includes(v.interaction)) return v;
  if (v.kind === 'consent' && ['lesson', 'guardian'].includes(v.encounter)) return v;
  if (v.kind === 'move' && v.position && ['x', 'z', 'yaw'].every(k => typeof v.position[k] === 'number' && Number.isFinite(v.position[k])) && Math.abs(v.position.x) <= 14 && v.position.z >= -21 && v.position.z <= 16 && Math.abs(v.position.yaw) < 1000) return v;
  if (['plan', 'ready'].includes(v.kind) && typeof v.roundId === 'string' && v.roundId.length < 120 && Number.isSafeInteger(v.revision) && v.revision >= 0) {
    if (v.kind === 'ready' && typeof v.jointPlanKey === 'string' && v.jointPlanKey.length < 160) return v;
    if (v.kind === 'plan' && Number.isSafeInteger(v.planRevision) && v.planRevision >= 0 && v.plan && ['actorId', 'spellId', 'targetId'].every(k => typeof v.plan[k] === 'string' && v.plan[k].length < 80)) return v;
  }
  return null;
}
/** Pure command transition; the caller commits state + acknowledgement atomically. */
export function applyCommand(original: CampaignState, seat: Seat, command: Command, connected: Seat[]): { state: CampaignState; ack: Ack } {
  const s = structuredClone(original);
  const reject = (reason: string) => ({ state: original, ack: { type: 'ack' as const, version: 1 as const, commandId: command.commandId, accepted: false, reason, revision: original.battle?.revision ?? 0 } });
  if (command.kind === 'sync') return { state: original, ack: { type: 'ack', version: 1, commandId: command.commandId, accepted: true, revision: s.battle?.revision ?? 0 } };
  if (command.kind === 'move') { if (s.battle?.phase === 'planning') return reject('Movement is paused during the encounter.'); s.positions[seat] = command.position; }
  else {
    if (SEATS.some(id => !connected.includes(id))) return reject('Waiting for both mages to reconnect.');
    if (command.kind === 'interact') {
      if (s.battle) return reject('Finish the encounter first.');
      const stage = { npc: 0, lantern: 1, discovery: 3 }[command.interaction];
      if (s.stage !== stage) return reject('This discovery has already been shared, or is not ready.');
      if (!nearby(s, seat, POINTS[command.interaction])) return reject('Walk closer to interact.');
      s.stage++;
    } else if (command.kind === 'consent') {
      if (s.battle || s.stage !== (command.encounter === 'lesson' ? 2 : 4)) return reject('That encounter is not available.');
      if (!nearby(s, seat, POINTS[command.encounter])) return reject('Meet near the encounter marker.');
      s.consent[seat] = command.encounter;
      for (const id of SEATS) if (!nearby(s, id, POINTS[command.encounter])) delete s.consent[id];
      if (SEATS.every(id => s.consent[id] === command.encounter)) {
        s.battle = createBattle(command.encounter, 'duo', s.stage >= 4);
        s.battle.id = `${s.sessionId}-${++s.battleSerial}`;
        s.plans = {}; s.ready = {}; s.consent = {}; s.planRevisions = { mage1: 0, mage2: 0 }; s.lastResult = null;
      }
    } else if (command.kind === 'leaveBattle') {
      if (!s.battle || s.battle.phase === 'planning') return reject('The encounter is still in progress.');
      s.battle = null; s.plans = {}; s.ready = {}; s.consent = {};
    } else {
      const b = s.battle;
      if (!b || b.phase !== 'planning') return reject('No round is accepting plans.');
      if (command.roundId !== roundId(s) || command.revision !== b.revision) return reject('This message belongs to an old round.');
      if (command.kind === 'plan') {
        if (command.plan.actorId !== seat || command.planRevision !== s.planRevisions[seat]) return reject('Your plan changed. Refresh the current plan.');
        const problem = validatePlan(b, command.plan); if (problem) return reject(problem);
        s.plans[seat] = command.plan; s.planRevisions[seat]++; s.ready = {};
      } else {
        if (command.jointPlanKey !== jointPlanKey(s)) return reject('Plans changed. Review the current queue before confirming.');
        const required = SEATS.filter(id => b.actors.some(a => a.id === id && a.hp > 0));
        if (required.some(id => !s.plans[id])) return reject('Each living mage needs a plan.');
        s.ready[seat] = command.jointPlanKey;
        // Both participants review the queue, even if one mage is down.
        if (SEATS.every(id => s.ready[id] === jointPlanKey(s))) {
          const result = resolveRound(b, required.map(id => s.plans[id]!));
          s.battle = result.battle; s.lastResult = { id: `${b.id}:${b.round}`, events: result.events };
          s.plans = {}; s.ready = {}; s.planRevisions = { mage1: 0, mage2: 0 };
          if (s.battle.phase === 'victory' && !s.rewardIds.includes(b.id)) {
            s.rewardIds.push(b.id); s.rewardIds = s.rewardIds.slice(-8); s.stage = b.kind === 'lesson' ? 3 : 5;
          }
        }
      }
    }
  }
  return { state: s, ack: { type: 'ack', version: 1, commandId: command.commandId, accepted: true, revision: s.battle?.revision ?? 0 } };
}
