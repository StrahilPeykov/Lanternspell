/** Pure, deterministic, serializable battle rules. Presentation never mutates these rules. */
export type SpellId = 'spark' | 'mark' | 'unfold' | 'shelter' | 'unseal' | 'mend';
export type BattleKind = 'lesson' | 'guardian';
export type BattleMode = 'solo' | 'duo';
export interface Spell {
  id: SpellId; name: string; cost: number; tier: number; target: 'enemy' | 'mage'; description: string;
}
export const SPELLS: Record<SpellId, Spell> = {
  spark: { id: 'spark', name: 'Wick Spark', cost: 0, tier: 1, target: 'enemy', description: 'Deal 5 damage. Always available.' },
  mark: { id: 'mark', name: 'Inkseed', cost: 1, tier: 1, target: 'enemy', description: 'Deal 2 damage and inscribe a seed through the next two rounds.' },
  unfold: { id: 'unfold', name: 'Folded Sky', cost: 4, tier: 2, target: 'enemy', description: 'Deal 9 damage, or 18 to an inscribed target. Consume its seed. Margin note adds 3 damage.' },
  shelter: { id: 'shelter', name: 'Hearthveil', cost: 2, tier: 0, target: 'mage', description: 'Give yourself or an ally 11 ward through the next round. Ward does not stack.' },
  unseal: { id: 'unseal', name: 'Unstitch', cost: 2, tier: 0, target: 'enemy', description: 'Remove all ward, deal 4 damage, and halve this round’s heavy attack.' },
  mend: { id: 'mend', name: 'Mending Light', cost: 3, tier: 0, target: 'mage', description: 'Restore 12 health to yourself or a living ally.' },
};
export const BATTLE_TUNING = { startingEmber: 3, emberCap: 7, emberPerRound: 2, mageHealth: 38 } as const;
export interface Actor {
  id: string; name: string; team: 'mage' | 'enemy'; hp: number; maxHp: number;
  ember: number; ward: number; wardUntil: number; markedUntil: number; staggeredUntil: number;
}
export interface Battle {
  version: 1; id: string; kind: BattleKind; mode: BattleMode; round: number; revision: number;
  phase: 'planning' | 'victory' | 'defeat'; actors: Actor[]; upgraded: boolean; rewardGranted: boolean;
}
export interface Plan { actorId: string; spellId: SpellId; targetId: string }
export interface QueueEntry {
  actorId: string; targetId: string; spellId: string; name: string; tier: number;
  amount: number; text: string; fallbackFrom?: string;
}
export interface BattleEvent {
  id: string; kind: 'cast' | 'attack' | 'status' | 'round' | 'victory' | 'defeat';
  actorId: string; targetId: string; spellId: string; amount: number; text: string; fallbackFrom?: string;
}
export interface Intention { actorId: string; targetId: string; name: string; spellId: string; tier: number; amount: number; text: string }
const actor = (id: string, name: string, team: 'mage' | 'enemy', hp: number, ward = 0): Actor => ({
  id, name, team, hp, maxHp: hp, ember: team === 'mage' ? BATTLE_TUNING.startingEmber : 0,
  ward, wardUntil: ward ? 9999 : 0, markedUntil: 0, staggeredUntil: 0,
});
export function createBattle(kind: BattleKind, mode: BattleMode, upgraded = false): Battle {
  const actors = [actor('mage1', 'Visiting mage', 'mage', BATTLE_TUNING.mageHealth)];
  if (mode === 'duo') actors.push(actor('mage2', 'Fellow mage', 'mage', BATTLE_TUNING.mageHealth));
  if (kind === 'lesson') {
    actors.push(actor('moth1', 'Paper Moth', 'enemy', mode === 'solo' ? 18 : 28));
  } else {
    actors.push(actor('guardian', 'Drowsing Atlas', 'enemy', mode === 'solo' ? 36 : 62, 8));
    if (mode === 'duo') actors.push(actor('moth1', 'Margin Moth', 'enemy', 14));
  }
  return { version: 1, id: `${kind}-${mode}`, kind, mode, round: 1, revision: 0, phase: 'planning', actors, upgraded, rewardGranted: false };
}
export function getIntentions(battle: Battle): Intention[] {
  const mages = battle.actors.filter(a => a.team === 'mage' && a.hp > 0);
  if (!mages.length || battle.phase !== 'planning') return [];
  return battle.actors.filter(a => a.team === 'enemy' && a.hp > 0).map((enemy, index) => {
    const target = mages[(battle.round + index - 1) % mages.length]!;
    if (enemy.id === 'guardian' && battle.round % 3 === 0) {
      return { actorId: enemy.id, targetId: enemy.id, name: 'Brass Rebinding', spellId: 'rebind', tier: 2, amount: 4, text: 'Restore 4 ward. No attack this round.' };
    }
    const heavy = enemy.id === 'guardian' && battle.round % 3 === 2;
    const amount = enemy.id === 'guardian' ? (heavy ? 12 : 6) : (battle.kind === 'lesson' ? 4 : 3);
    return { actorId: enemy.id, targetId: target.id, name: heavy ? 'Pendulum Fall' : enemy.id === 'guardian' ? 'Brass Sweep' : 'Paper Flutter', spellId: heavy ? 'heavy' : 'strike', tier: heavy ? 3 : 2, amount,
      text: `${amount} damage to ${target.name}${heavy ? ' · Unstitch halves this strike' : ''}.` };
  });
}
/** Invalid manual commands fail explicitly; dead targets are accepted for predictable retargeting. */
export function validatePlan(battle: Battle, plan: Plan): string | null {
  if (battle.phase !== 'planning') return 'This encounter is already complete.';
  const caster = battle.actors.find(a => a.id === plan.actorId);
  if (!caster || caster.team !== 'mage' || caster.hp <= 0) return 'Choose a living mage.';
  const spell = SPELLS[plan.spellId];
  if (!spell) return 'Unknown spell.';
  if (caster.ember < spell.cost) return `Needs ${spell.cost} Ember.`;
  const target = battle.actors.find(a => a.id === plan.targetId);
  if (!target || target.team !== spell.target) return `Choose a ${spell.target === 'mage' ? 'friendly' : 'hostile'} target.`;
  return null;
}
function clone(b: Battle): Battle { return { ...b, actors: b.actors.map(a => ({ ...a })) }; }
function targetFor(b: Battle, requested: string, team: Actor['team'], casterId: string): Actor | undefined {
  const wanted = b.actors.find(a => a.id === requested && a.team === team && a.hp > 0);
  if (wanted) return wanted;
  // A defeated ally's support is redirected to self; defeated enemies to first living foe.
  return (team === 'mage' ? b.actors.find(a => a.id === casterId && a.hp > 0) : undefined)
    ?? b.actors.find(a => a.team === team && a.hp > 0);
}
function hit(target: Actor, amount: number): number {
  const absorbed = Math.min(target.ward, amount);
  target.ward -= absorbed;
  const actual = Math.min(target.hp, amount - absorbed);
  target.hp -= actual;
  return actual;
}
function execute(input: Battle, plans: Plan[]): { battle: Battle; events: BattleEvent[]; queue: QueueEntry[] } {
  const battle = clone(input);
  const events: BattleEvent[] = [], queue: QueueEntry[] = [];
  if (battle.phase !== 'planning') return { battle, events, queue };
  const livingMages = battle.actors.filter(a => a.team === 'mage' && a.hp > 0);
  if (plans.length !== livingMages.length || new Set(plans.map(p => p.actorId)).size !== plans.length) throw new Error('Exactly one plan per living mage is required.');
  for (const plan of plans) { const error = validatePlan(battle, plan); if (error) throw new Error(error); }
  const actions: QueueEntry[] = plans.map(plan => ({ ...plan, ...{ name: SPELLS[plan.spellId].name, tier: SPELLS[plan.spellId].tier, amount: 0, text: SPELLS[plan.spellId].description } }));
  actions.push(...getIntentions(battle));
  // Stable actor IDs break ties, never arrival order. Mages win equal-tier ties.
  actions.sort((a, b) => a.tier - b.tier || Number(!a.actorId.startsWith('mage')) - Number(!b.actorId.startsWith('mage')) || a.actorId.localeCompare(b.actorId));
  const emit = (entry: QueueEntry, kind: BattleEvent['kind'], amount: number, text: string) => {
    const resolved = { ...entry, amount, text };
    queue.push(resolved);
    events.push({ ...resolved, id: `${battle.id}:${battle.round}:${events.length}`, kind });
  };
  for (const action of actions) {
    const caster = battle.actors.find(a => a.id === action.actorId)!;
    if (caster.hp <= 0) continue;
    if (!battle.actors.some(a => a.team !== caster.team && a.hp > 0)) break;
    if (caster.team === 'enemy') {
      if (action.spellId === 'rebind') {
        caster.ward = Math.max(caster.ward, action.amount); caster.wardUntil = 9999;
        emit(action, 'status', action.amount, `${caster.name} restores ${action.amount} ward.`);
      } else {
        const target = targetFor(battle, action.targetId, 'mage', caster.id);
        if (!target) continue;
        const damage = action.spellId === 'heavy' && caster.staggeredUntil >= battle.round ? Math.floor(action.amount / 2) : action.amount;
        const actual = hit(target, damage);
        emit({ ...action, targetId: target.id, ...(target.id !== action.targetId ? { fallbackFrom: action.targetId } : {}) }, 'attack', actual, `${caster.name}: ${action.name} — ${damage} damage${actual < damage ? ' (ward absorbed some)' : ''}.`);
      }
      continue;
    }
    const spell = SPELLS[action.spellId as SpellId];
    const target = targetFor(battle, action.targetId, spell.target, caster.id);
    if (!target) continue;
    caster.ember -= spell.cost;
    let amount = 0, text = '';
    switch (spell.id) {
      case 'spark': amount = hit(target, 5); text = `${target.name}: 5 damage.`; break;
      case 'mark': amount = hit(target, 2); target.markedUntil = battle.round + 2; text = `${target.name}: 2 damage; inscribed through round ${target.markedUntil}.`; break;
      case 'unfold': {
        const damage = (target.markedUntil >= battle.round ? 18 : 9) + (battle.upgraded ? 3 : 0);
        const seeded = target.markedUntil >= battle.round;
        target.markedUntil = 0; amount = hit(target, damage);
        text = `${target.name}: ${damage} damage${seeded ? '; seed unfolds into a constellation' : ''}.`;
        break;
      }
      case 'shelter': target.ward = Math.max(target.ward, 11); target.wardUntil = battle.round + 1; amount = 11; text = `${target.name}: 11 ward through round ${target.wardUntil}.`; break;
      case 'unseal': {
        const removed = target.ward; target.ward = 0; target.staggeredUntil = battle.round;
        amount = hit(target, 4); text = `${target.name}: ${removed} ward removed, 4 damage; heavy strike halved this round.`; break;
      }
      case 'mend': amount = Math.min(12, target.maxHp - target.hp); target.hp += amount; text = `${target.name}: ${amount} health restored.`; break;
    }
    emit({ ...action, targetId: target.id, ...(target.id !== action.targetId ? { fallbackFrom: action.targetId } : {}) }, 'cast', amount, `${spell.name} — ${text}`);
  }
  battle.revision += 1;
  const won = !battle.actors.some(a => a.team === 'enemy' && a.hp > 0);
  const lost = !battle.actors.some(a => a.team === 'mage' && a.hp > 0);
  if (won || lost) {
    battle.phase = won ? 'victory' : 'defeat';
    battle.rewardGranted = won;
    events.push({ id: `${battle.id}:${battle.round}:outcome`, kind: won ? 'victory' : 'defeat', actorId: '', targetId: '', spellId: '', amount: won ? 1 : 0,
      text: won ? (battle.kind === 'lesson' ? 'The paper moth settles. A margin note awaits on the path.' : 'The sleeping orrery opens its golden eye. Bellweather wakes.') : 'The light retreats. Take a breath and try a different plan.' });
  } else {
    battle.round += 1;
    for (const a of battle.actors) {
      if (a.team === 'mage' && a.hp > 0) a.ember = Math.min(BATTLE_TUNING.emberCap, a.ember + BATTLE_TUNING.emberPerRound);
      if (a.wardUntil < battle.round) a.ward = 0;
      if (a.markedUntil < battle.round) a.markedUntil = 0;
      if (a.staggeredUntil < battle.round) a.staggeredUntil = 0;
    }
  }
  return { battle, events, queue };
}
/** Full deterministic preview includes fallback targets after earlier predicted kills. Partial plans preview the selected actions plus enemy intentions. */
export function previewQueue(battle: Battle, plans: Plan[]): QueueEntry[] {
  const mages = battle.actors.filter(a => a.team === 'mage' && a.hp > 0);
  if (plans.length === mages.length && plans.every(p => validatePlan(battle, p) === null)) return execute(battle, plans).queue;
  return [...plans.filter(p => !validatePlan(battle, p)).map(p => ({ ...p, name: SPELLS[p.spellId].name, tier: SPELLS[p.spellId].tier, amount: 0, text: SPELLS[p.spellId].description })), ...getIntentions(battle)]
    .sort((a, b) => a.tier - b.tier || Number(!a.actorId.startsWith('mage')) - Number(!b.actorId.startsWith('mage')) || a.actorId.localeCompare(b.actorId));
}
export function resolveRound(battle: Battle, plans: Plan[]): { battle: Battle; events: BattleEvent[] } {
  const result = execute(battle, plans);
  return { battle: result.battle, events: result.events };
}
