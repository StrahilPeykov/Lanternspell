/** Pure, deterministic, serializable battle rules. Presentation never mutates these rules. */
import { makeDeck, traditionalSpell, type BattleOptions, type BattleVariant, type Tradition } from './traditions';
export { TRADITIONS } from './traditions';
export type { BattleOptions, BattleVariant, Tradition } from './traditions';
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
  tradition?: Tradition; hand?: SpellId[]; drawPile?: SpellId[]; drawIndex?: number;
  counter?: number; lastSpell?: SpellId; lastIntent?: string;
}
export interface Battle {
  version: 1; id: string; kind: BattleKind; mode: BattleMode; round: number; revision: number;
  phase: 'planning' | 'victory' | 'defeat'; actors: Actor[]; upgraded: boolean; rewardGranted: boolean;
  variant?: BattleVariant; seed?: number; intentions?: Intention[];
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
export function createBattle(kind: BattleKind, mode: BattleMode, upgraded = false, options: BattleOptions = {}): Battle {
  const actors = [actor('mage1', 'Visiting mage', 'mage', BATTLE_TUNING.mageHealth)];
  if (mode === 'duo') actors.push(actor('mage2', 'Fellow mage', 'mage', BATTLE_TUNING.mageHealth));
  if (kind === 'lesson') {
    actors.push(actor('moth1', 'Paper Moth', 'enemy', mode === 'solo' ? (options.variant === 'book' ? 24 : 18) : 28));
  } else {
    actors.push(actor('guardian', 'Drowsing Atlas', 'enemy', mode === 'solo' ? 36 : 62, 8));
    if (mode === 'duo') actors.push(actor('moth1', 'Margin Moth', 'enemy', 14));
  }
  const battle: Battle = { version: 1, id: `${kind}-${mode}`, kind, mode, round: 1, revision: 0, phase: 'planning', actors, upgraded, rewardGranted: false };
  if (options.variant && options.variant !== 'baseline') {
    battle.variant = options.variant;
    battle.seed = (options.seed ?? 104729) >>> 0;
    for (const [index, mage] of actors.filter(a => a.team === 'mage').entries()) {
      mage.tradition = options.traditions?.[mage.id as 'mage1' | 'mage2'] ?? (index ? 'hearth' : 'margin');
      mage.counter = 0;
      if (battle.variant === 'hand') {
        mage.drawPile = makeDeck(battle.seed + index * 7919);
        mage.hand = mage.drawPile.slice(0, 4); mage.drawIndex = 4;
      }
    }
    battle.intentions = stateIntentions(battle);
  }
  return battle;
}
export function getIntentions(battle: Battle): Intention[] {
  if (battle.phase !== 'planning') return [];
  if (battle.variant && battle.variant !== 'baseline') return (battle.intentions ?? stateIntentions(battle)).map(i => ({ ...i }));
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
/** Intentions are locked at the planning boundary, never chosen after seeing this round's plans. */
function stateIntentions(battle: Battle): Intention[] {
  const mages = battle.actors.filter(a => a.team === 'mage' && a.hp > 0);
  if (!mages.length) return [];
  return battle.actors.filter(a => a.team === 'enemy' && a.hp > 0).map(enemy => {
    const candidates = [...mages].sort((a, b) => b.ember - a.ember || b.hp - a.hp || a.id.localeCompare(b.id));
    const target = candidates[0]!;
    const intention = (spellId: string, name: string, amount: number, tier: number, reason: string, targetId = target.id): Intention => ({ actorId: enemy.id, targetId, spellId, name, amount, tier, text: `${reason} · ${targetId === enemy.id ? '' : `${amount} damage to ${target.name}.`}`.trim() });
    if (enemy.id !== 'guardian') {
      const reader = [...mages].sort((a, b) => a.ward - b.ward || a.hp - b.hp || a.id.localeCompare(b.id))[0]!;
      const amount = enemy.markedUntil >= battle.round ? 6 : battle.kind === 'lesson' ? 4 : 3;
      return { ...intention('strike', amount === 6 ? 'Inkflutter' : 'Paper Flutter', amount, 2, amount === 6 ? 'Its inscription stirs the wings' : 'The moth seeks an unguarded reader', reader.id), text: `${amount === 6 ? 'Inscribed wings' : 'Least ward'} · ${amount} damage to ${reader.name}.` };
    }
    if (enemy.ward === 0 && enemy.lastIntent !== 'rebind') return intention('rebind', 'Gather the Loose Brass', 6, 2, 'Its broken ward calls the rings home: gain 6 ward, no attack', enemy.id);
    if (enemy.hp <= enemy.maxHp * .4 && enemy.lastIntent !== 'heavy') return intention('heavy', 'Falling Hour', 12, 3, 'Its weakened heart swings a desperate pendulum; Unstitch halves this strike');
    if (enemy.markedUntil >= battle.round && enemy.lastIntent !== 'purge') return intention('purge', 'Polish the Margins', 4, 2, 'An inscription troubles the brass: erase it and gain 4 ward, no attack', enemy.id);
    if (target.ward >= 8 && enemy.lastIntent !== 'heavy') return intention('heavy', 'Test the Shelter', 12, 3, 'A strong shelter draws the pendulum; Unstitch halves this strike');
    if (enemy.lastIntent === 'strike' && enemy.ward > 0) return intention('heavy', 'Pendulum Fall', 12, 3, 'Its intact rings wind up after a sweep; Unstitch halves this strike');
    return intention('strike', 'Brass Sweep', 6, 2, 'The brass follows the mage holding most Ember');
  });
}
export function getSpell(battle: Battle, actorId: string, spellId: SpellId): Spell {
  const base = SPELLS[spellId];
  const tradition = battle.actors.find(a => a.id === actorId)?.tradition;
  const spell = battle.variant && battle.variant !== 'baseline' && (tradition === 'margin' || tradition === 'hearth') ? traditionalSpell(base, tradition) : base;
  return battle.variant === 'hand' && spellId === 'spark'
    ? { ...spell, description: 'Deal 5 damage for no Ember. Turn your leftmost held page into the visible next page.' }
    : spell;
}
export function availableSpells(battle: Battle, actorId: string): Spell[] {
  const actor = battle.actors.find(a => a.id === actorId);
  return Object.values(SPELLS).filter(s => battle.variant !== 'hand' || s.id === 'spark' || actor?.hand?.includes(s.id)).map(s => getSpell(battle, actorId, s.id));
}
export function nextDraw(battle: Battle, actorId: string): SpellId | null {
  const mage = battle.actors.find(a => a.id === actorId);
  return mage?.drawPile?.[(mage.drawIndex ?? 0) % mage.drawPile.length] ?? null;
}
/** Invalid manual commands fail explicitly; dead targets are accepted for predictable retargeting. */
export function validatePlan(battle: Battle, plan: Plan): string | null {
  if (battle.phase !== 'planning') return 'This encounter is already complete.';
  // Wire commands are untrusted strings even though local TypeScript callers use SpellId.
  if (!Object.hasOwn(SPELLS, plan.spellId)) return 'Unknown spell.';
  const caster = battle.actors.find(a => a.id === plan.actorId);
  if (!caster || caster.team !== 'mage' || caster.hp <= 0) return 'Choose a living mage.';
  const spell = getSpell(battle, plan.actorId, plan.spellId);
  if (!availableSpells(battle, plan.actorId).some(s => s.id === spell.id)) return 'That page is not in your current hand.';
  if (caster.ember < spell.cost) return `Needs ${spell.cost} Ember.`;
  const target = battle.actors.find(a => a.id === plan.targetId);
  if (!target || target.team !== spell.target) return `Choose a ${spell.target === 'mage' ? 'friendly' : 'hostile'} target.`;
  return null;
}
function clone(b: Battle): Battle { return { ...b, ...(b.intentions ? { intentions: b.intentions.map(i => ({ ...i })) } : {}), actors: b.actors.map(a => ({ ...a, ...(a.hand ? { hand: [...a.hand] } : {}), ...(a.drawPile ? { drawPile: [...a.drawPile] } : {}) })) }; }
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
  const actions: QueueEntry[] = plans.map(plan => { const spell = getSpell(battle, plan.actorId, plan.spellId); return { ...plan, name: spell.name, tier: spell.tier, amount: 0, text: spell.description }; });
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
      if (battle.variant && battle.variant !== 'baseline') caster.lastIntent = action.spellId;
      if (action.spellId === 'rebind' || action.spellId === 'purge') {
        if (action.spellId === 'purge') caster.markedUntil = 0;
        caster.ward = Math.max(caster.ward, action.amount); caster.wardUntil = 9999;
        emit(action, 'status', action.amount, `${caster.name} restores ${action.amount} ward.${action.spellId === 'purge' ? ' The inscription is polished away.' : ''}`);
      } else {
        const target = targetFor(battle, action.targetId, 'mage', caster.id);
        if (!target) continue;
        const damage = action.spellId === 'heavy' && caster.staggeredUntil >= battle.round ? Math.floor(action.amount / 2) : action.amount;
        const guarded = target.ward > 0;
        const actual = hit(target, damage);
        let returned = 0;
        if (guarded && target.counter) { returned = hit(caster, target.counter); target.counter = 0; }
        emit({ ...action, targetId: target.id, ...(target.id !== action.targetId ? { fallbackFrom: action.targetId } : {}) }, 'attack', actual, `${caster.name}: ${action.name} — ${damage} damage${actual < damage ? ' (ward absorbed some)' : ''}.${returned ? ` Hearthlash returns ${returned} damage.` : ''}`);
      }
      continue;
    }
    const spell = getSpell(battle, caster.id, action.spellId as SpellId);
    const target = targetFor(battle, action.targetId, spell.target, caster.id);
    if (!target) continue;
    caster.ember -= spell.cost;
    const tradition = battle.variant && battle.variant !== 'baseline' ? caster.tradition : undefined;
    let amount = 0, text = '';
    switch (spell.id) {
      case 'spark': amount = hit(target, 5); text = `${target.name}: 5 damage.`; break;
      case 'mark': {
        if (tradition === 'margin') { amount = Math.min(target.hp, 4); target.hp -= amount; }
        else amount = hit(target, tradition === 'hearth' ? 3 : 2);
        target.markedUntil = battle.round + 2;
        if (tradition === 'hearth') { caster.ward = Math.max(caster.ward, 6); caster.wardUntil = battle.round + 1; }
        text = `${target.name}: ${tradition === 'margin' ? '4 damage through ward' : `${tradition === 'hearth' ? 3 : 2} damage`}; inscribed through round ${target.markedUntil}.${tradition === 'hearth' ? ' Your kindling grants 6 ward.' : ''}`; break;
      }
      case 'unfold': {
        const seeded = target.markedUntil >= battle.round;
        const released = tradition === 'hearth' ? Math.min(caster.ward, 8) : 0;
        const damage = (tradition === 'hearth' ? 8 + (seeded ? 6 : 0) + released : seeded ? 18 : 9) + (battle.upgraded ? 3 : 0);
        if (released) caster.ward -= released;
        target.markedUntil = 0; amount = hit(target, damage);
        const spread = tradition === 'margin' && seeded ? battle.actors.filter(a => a.team === 'enemy' && a.id !== target.id && a.hp > 0) : [];
        for (const other of spread) hit(other, 5);
        text = `${target.name}: ${damage} damage${seeded ? '; seed unfolds into a constellation' : ''}.${released ? ` Released ${released} of your ward.` : ''}${spread.length ? ' Loose pages deal 5 to other foes.' : ''}`;
        break;
      }
      case 'shelter': target.ward = Math.max(target.ward, 11); target.wardUntil = battle.round + 1; if (tradition === 'hearth') target.counter = 5; amount = 11; text = `${target.name}: 11 ward through round ${target.wardUntil}.${tradition === 'hearth' ? ' The next absorbed attack returns 5 damage.' : ''}`; break;
      case 'unseal': {
        const removed = target.ward; target.ward = 0; target.staggeredUntil = battle.round;
        amount = hit(target, 4); text = `${target.name}: ${removed} ward removed, 4 damage; heavy strike halved this round.`;
        if (removed && tradition === 'margin') { target.markedUntil = battle.round + 2; text += ' The cut binding leaves an inscription.'; }
        if (removed && tradition === 'hearth') { caster.ward = Math.max(caster.ward, Math.min(4, removed)); caster.wardUntil = battle.round + 1; text += ` Rewoven ${Math.min(4, removed)} ward onto you.`; }
        break;
      }
      case 'mend': amount = Math.min(12, target.maxHp - target.hp); target.hp += amount; text = `${target.name}: ${amount} health restored.`; if (tradition === 'hearth') { const extra = Math.min(6, 12 - amount); if (extra) { target.ward = Math.max(target.ward, extra); target.wardUntil = battle.round + 1; text += ` ${extra} excess healing becomes ward.`; } } break;
    }
    if (tradition) caster.lastSpell = spell.id;
    if (battle.variant === 'hand' && caster.hand && caster.drawPile) {
      const nextPage = caster.drawPile[(caster.drawIndex ?? 0) % caster.drawPile.length]!;
      if (spell.id === 'spark') {
        // A free attack can always advance a stranded hand, at the visible cost of its leftmost page.
        const turned = caster.hand.shift()!;
        caster.hand.push(nextPage);
        text += ` Turned ${getSpell(battle, caster.id, turned).name}; drew ${getSpell(battle, caster.id, nextPage).name}.`;
      } else {
        const index = caster.hand.indexOf(spell.id);
        if (index >= 0) caster.hand[index] = nextPage;
      }
      caster.drawIndex = (caster.drawIndex ?? 0) + 1;
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
      if (a.wardUntil < battle.round) { a.ward = 0; if (a.counter) a.counter = 0; }
      if (a.markedUntil < battle.round) a.markedUntil = 0;
      if (a.staggeredUntil < battle.round) a.staggeredUntil = 0;
    }
    if (battle.variant && battle.variant !== 'baseline') battle.intentions = stateIntentions(battle);
  }
  return { battle, events, queue };
}
/** Full deterministic preview includes fallback targets after earlier predicted kills. Partial plans preview the selected actions plus enemy intentions. */
export function previewQueue(battle: Battle, plans: Plan[]): QueueEntry[] {
  const mages = battle.actors.filter(a => a.team === 'mage' && a.hp > 0);
  if (plans.length === mages.length && plans.every(p => validatePlan(battle, p) === null)) return execute(battle, plans).queue;
  return [...plans.filter(p => !validatePlan(battle, p)).map(p => { const spell = getSpell(battle, p.actorId, p.spellId); return { ...p, name: spell.name, tier: spell.tier, amount: 0, text: spell.description }; }), ...getIntentions(battle)]
    .sort((a, b) => a.tier - b.tier || Number(!a.actorId.startsWith('mage')) - Number(!b.actorId.startsWith('mage')) || a.actorId.localeCompare(b.actorId));
}
export function resolveRound(battle: Battle, plans: Plan[]): { battle: Battle; events: BattleEvent[] } {
  const result = execute(battle, plans);
  return { battle: result.battle, events: result.events };
}
