import {
  availableSpells,
  getSpell,
  type Battle,
  type SpellId,
} from "../simulation/battle";

/** Local disclosure only. Never changes legal plans or authoritative outcomes. */
export function lessonView(
  battle: Battle,
  seat: string,
  completed: boolean,
  expanded: boolean,
) {
  const teaching =
    !completed && battle.kind === "lesson" && battle.variant === "book";
  const marked = battle.actors.some(
    (a) => a.team === "enemy" && a.hp > 0 && a.markedUntil >= battle.round,
  );
  const recommended: SpellId =
    battle.round === 1 ? "spark" : marked ? "unfold" : "mark";
  const visible: SpellId[] =
    battle.round === 1
      ? ["spark"]
      : battle.round === 2
        ? ["spark", "mark"]
        : ["spark", "mark", "unfold"];
  const spells = availableSpells(battle, seat).filter(
    (s) => !teaching || expanded || visible.includes(s.id),
  );
  const hint = !teaching
    ? ""
    : battle.round === 1
      ? `Try ${getSpell(battle, seat, "spark").name}. The moth is already targeted.`
      : marked
        ? `${getSpell(battle, seat, "unfold").name} gains bonus damage against the marked moth.`
        : `${getSpell(battle, seat, "mark").name} damages the moth and marks it for your next spell.`;
  return { teaching, spells, recommended, hint };
}
