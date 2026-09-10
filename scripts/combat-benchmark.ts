/** Controlled deterministic policies, not a model of human enjoyment. Run via combat-benchmark.test.ts. */
import { availableSpells, createBattle, getIntentions, resolveRound, type Battle, type BattleMode, type BattleVariant, type Plan, type SpellId, type Tradition } from '../src/simulation/battle';

export type Policy = 'basic' | 'strongest' | 'setup' | 'defensive' | 'adaptive';
export type Fixture = 'opening' | 'broken-ward' | 'danger';
export interface DiagnosticRow { variant: BattleVariant; mode: BattleMode; traditions: string; seed: number; fixture: Fixture; policy: Policy; outcome: string; rounds: number; hp: string; firstPlan: string; sequence: string[]; restrictedRounds: number }

function choices(b: Battle, actorId: string): Plan[] {
  const actor = b.actors.find(a => a.id === actorId)!;
  return availableSpells(b, actorId).filter(s => s.cost <= actor.ember).flatMap(s => b.actors.filter(a => a.team === s.target && a.hp > 0).map(a => ({ actorId, spellId: s.id, targetId: a.id })));
}
function rawDamage(b: Battle, p: Plan): number {
  const mage = b.actors.find(a => a.id === p.actorId)!, foe = b.actors.find(a => a.id === p.targetId)!;
  const tradition = b.variant ? mage.tradition : undefined, seeded = foe.markedUntil >= b.round;
  if (p.spellId === 'unseal') return Math.min(foe.hp, 4);
  if (p.spellId === 'mark' && tradition === 'margin') return Math.min(foe.hp, 4);
  const damage = p.spellId === 'spark' ? 5 : p.spellId === 'mark' ? tradition === 'hearth' ? 3 : 2 : p.spellId === 'unfold' ? (tradition === 'hearth' ? 8 + (seeded ? 6 : 0) + Math.min(mage.ward, 8) : seeded ? 18 : 9) + (b.upgraded ? 3 : 0) : 0;
  return Math.min(foe.hp, Math.max(0, damage - foe.ward)) + (p.spellId === 'unfold' && tradition === 'margin' && seeded ? b.actors.filter(a => a.team === 'enemy' && a.id !== foe.id && a.hp > 0).reduce((n, a) => n + Math.min(a.hp, Math.max(0, 5 - a.ward)), 0) : 0);
}
function simplePlan(b: Battle, actorId: string, policy: Policy): Plan {
  const mage = b.actors.find(a => a.id === actorId)!, options = choices(b, actorId), foe = b.actors.find(a => a.team === 'enemy' && a.hp > 0)!;
  const find = (s: SpellId, target = foe.id) => options.find(p => p.spellId === s && p.targetId === target);
  if (policy === 'basic') return find('spark')!;
  if (policy === 'strongest') return [...options].sort((a, z) => rawDamage(b, z) - rawDamage(b, a) || a.spellId.localeCompare(z.spellId))[0]!;
  if (policy === 'defensive') {
    const endangered = b.actors.filter(a => a.team === 'mage' && a.hp > 0).sort((a, z) => a.hp - z.hp)[0]!;
    if (endangered.hp <= 22 && find('mend', endangered.id)) return find('mend', endangered.id)!;
    const incoming = getIntentions(b).filter(i => i.targetId === endangered.id).reduce((n, i) => n + i.amount, 0);
    if (incoming >= 10 && endangered.ward < incoming && find('shelter', endangered.id)) return find('shelter', endangered.id)!;
  }
  if (foe.ward && find('unseal')) return find('unseal')!;
  if ((foe.markedUntil >= b.round || mage.tradition === 'hearth' && mage.ward >= 6) && find('unfold')) return find('unfold')!;
  if (!foe.markedUntil && find('mark')) return find('mark')!;
  return find('spark')!;
}
function value(b: Battle): number {
  if (b.phase === 'victory') return 1000 + b.actors.filter(a => a.team === 'mage').reduce((n, a) => n + a.hp, 0);
  if (b.phase === 'defeat') return -1000;
  const enemyCost = b.actors.filter(a => a.team === 'enemy').reduce((n, a) => n + a.hp * 1.3 + a.ward * .25 - (a.hp > 0 && a.markedUntil >= b.round ? 4 : 0), 0);
  const mageValue = b.actors.filter(a => a.team === 'mage').reduce((n, a) => n + a.hp + a.ward * .45 + a.ember * .55 + (a.counter ? 1.5 : 0) - (a.hp === 0 ? 30 : 0), 0);
  const nextThreat = getIntentions(b).filter(i => b.actors.find(a => a.id === i.targetId)?.team === 'mage').reduce((n, i) => n + i.amount, 0);
  return mageValue - enemyCost - nextThreat * .35;
}
/** One-round exhaustive joint planner with explicit heuristic weights; knows rules, not future hand randomness. */
export function diagnosticPlans(b: Battle, policy: Policy): Plan[] {
  const mages = b.actors.filter(a => a.team === 'mage' && a.hp > 0);
  if (policy !== 'adaptive') return mages.map(a => simplePlan(b, a.id, policy));
  const first = choices(b, mages[0]!.id), second = mages.length > 1 ? choices(b, mages[1]!.id) : [null];
  let best = -Infinity, plans: Plan[] = [];
  for (const a of first) for (const z of second) {
    const candidate = z ? [a, z] : [a];
    const score = value(resolveRound(b, candidate).battle);
    if (score > best) { best = score; plans = candidate; }
  }
  return plans;
}
export function runDiagnostic(variant: BattleVariant, mode: BattleMode, traditions: [Tradition, Tradition], seed: number, fixture: Fixture, policy: Policy): DiagnosticRow {
  let b = createBattle('guardian', mode, true, { variant, traditions: { mage1: traditions[0], mage2: traditions[1] }, seed });
  if (fixture !== 'opening') {
    const guardian = b.actors.find(a => a.id === 'guardian')!;
    guardian.ward = 0;
    for (const mage of b.actors.filter(a => a.team === 'mage')) { mage.ember = 5; mage.hp = fixture === 'danger' ? 14 : 24; }
    if (fixture === 'danger') { guardian.hp = 18; guardian.markedUntil = 3; }
    delete b.intentions; // Labelled arranged fixture: choose fresh intentions for this starting state.
    if (variant !== 'baseline') b.intentions = getIntentions(b);
  }
  const row: DiagnosticRow = { variant, mode, traditions: mode === 'solo' ? traditions[0] : traditions.join('+'), seed, fixture, policy, outcome: 'planning', rounds: 0, hp: '', firstPlan: '', sequence: [], restrictedRounds: 0 };
  while (b.phase === 'planning' && row.rounds < 30) {
    if (b.actors.some(a => a.team === 'mage' && a.hp > 0 && availableSpells(b, a.id).length < 6)) row.restrictedRounds++;
    const plans = diagnosticPlans(b, policy);
    const summary = plans.map(p => `${p.actorId}:${p.spellId}>${p.targetId}`).join('|');
    if (!row.rounds) row.firstPlan = summary;
    row.sequence.push(summary);
    b = resolveRound(b, plans).battle;
    row.rounds++;
  }
  row.outcome = b.phase; row.hp = b.actors.filter(a => a.team === 'mage').map(a => a.hp).join('/');
  return row;
}
export function runBenchmark(): DiagnosticRow[] {
  const rows: DiagnosticRow[] = [];
  for (const variant of ['baseline', 'book', 'hand'] as const) {
    const configurations: [BattleMode, Tradition, Tradition][] = variant === 'baseline' ? [['solo', 'margin', 'hearth'], ['duo', 'margin', 'hearth']] : [['solo', 'margin', 'hearth'], ['solo', 'hearth', 'margin'], ['duo', 'margin', 'hearth'], ['duo', 'margin', 'margin'], ['duo', 'hearth', 'hearth']];
    for (const [mode, one, two] of configurations) for (const seed of variant === 'hand' ? [17, 123, 91026] : [17]) for (const fixture of ['opening', 'broken-ward', 'danger'] as const) for (const policy of ['basic', 'strongest', 'setup', 'defensive', 'adaptive'] as const) rows.push(runDiagnostic(variant, mode, [one, two], seed, fixture, policy));
  }
  return rows;
}
