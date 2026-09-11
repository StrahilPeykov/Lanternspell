import { describe, expect, it } from "vitest";
import {
  createBattle,
  resolveRound,
  type Plan,
} from "../src/simulation/battle";
import { roundForecast } from "../src/ui/forecast";

describe("round forecast uses authoritative rules without committing", () => {
  it("previews a coordinated setup/exploit with identical resulting health and no mutation", () => {
    const battle = createBattle("guardian", "duo", true, {
      variant: "book",
      traditions: { mage1: "margin", mage2: "hearth" },
    });
    // Explicit resource fixture: both spells affordable in this arranged guardian round.
    battle.actors
      .filter((a) => a.team === "mage")
      .forEach((a) => (a.ember = 5));
    const plans: Plan[] = [
      { actorId: "mage1", spellId: "mark", targetId: "guardian" },
      { actorId: "mage2", spellId: "unfold", targetId: "guardian" },
    ];
    const before = JSON.stringify(battle),
      predicted = roundForecast(battle, plans)!;
    const actual = resolveRound(battle, plans).battle;
    expect(predicted.actors.map((a) => [a.id, a.hp, a.ward])).toEqual(
      actual.actors.map((a) => [a.id, a.hp, a.ward]),
    );
    expect(JSON.stringify(battle)).toBe(before);
    expect(roundForecast(battle, plans)).toEqual(predicted);
  });
  it("does not imply a complete result for missing, duplicate, or illegal plans", () => {
    const battle = createBattle("lesson", "duo");
    const one: Plan = { actorId: "mage1", spellId: "spark", targetId: "moth1" };
    expect(roundForecast(battle, [one])).toBeNull();
    expect(roundForecast(battle, [one, one])).toBeNull();
    expect(
      roundForecast(battle, [
        one,
        { actorId: "mage2", spellId: "unfold", targetId: "moth1" },
      ]),
    ).toBeNull();
  });
});
