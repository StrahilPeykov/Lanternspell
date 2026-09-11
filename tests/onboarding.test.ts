import { describe, it, expect } from "vitest";
import {
  createBattle,
  resolveRound,
  type SpellId,
} from "../src/simulation/battle";
import { lessonView } from "../src/ui/onboarding";

describe("first practice disclosure", () => {
  it("uses normal rules for a basic/setup/payoff sequence whose mark matters", () => {
    let b = createBattle("lesson", "solo", false, {
      variant: "book",
      traditions: { mage1: "margin" },
    });
    const cast = (id: SpellId) => {
      b = resolveRound(b, [
        { actorId: "mage1", targetId: "moth1", spellId: id },
      ]).battle;
    };
    expect(
      lessonView(b, "mage1", false, false).spells.map((s) => s.id),
    ).toEqual(["spark"]);
    cast("spark");
    expect(lessonView(b, "mage1", false, false).recommended).toBe("mark");
    cast("mark");
    expect(b.actors[1].hp).toBeGreaterThan(9);
    expect(lessonView(b, "mage1", false, false).recommended).toBe("unfold");
    cast("unfold");
    expect(b.phase).toBe("victory");
  });
  it("keeps all legal spells available through the opt-out and for returning players", () => {
    const b = createBattle("lesson", "solo", false, { variant: "book" });
    expect(lessonView(b, "mage1", false, true).spells).toHaveLength(6);
    expect(lessonView(b, "mage1", true, false).spells).toHaveLength(6);
  });
});
