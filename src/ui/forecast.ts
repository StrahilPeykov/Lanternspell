import {
  resolveRound,
  validatePlan,
  type Battle,
  type Plan,
} from "../simulation/battle";

/** Read-only forecast from the shared rules, only when every living mage has a legal plan. */
export function roundForecast(battle: Battle, plans: Plan[]) {
  const living = battle.actors.filter(
    (actor) => actor.team === "mage" && actor.hp > 0,
  );
  if (
    battle.phase !== "planning" ||
    plans.length !== living.length ||
    living.some(
      (actor) => plans.filter((plan) => plan.actorId === actor.id).length !== 1,
    ) ||
    plans.some((plan) => validatePlan(battle, plan) !== null)
  )
    return null;
  const result = resolveRound(battle, plans);
  return {
    phase: result.battle.phase,
    actors: result.battle.actors.map((after) => {
      const before = battle.actors.find((actor) => actor.id === after.id)!;
      return {
        id: after.id,
        hp: after.hp,
        ward: after.ward,
        healthChange: after.hp - before.hp,
        wardChange: after.ward - before.ward,
      };
    }),
  };
}
