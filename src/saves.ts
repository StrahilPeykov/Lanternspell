import {
  SPELLS,
  type Battle,
  type BattleVariant,
  type Tradition,
} from "./simulation/battle";
export type Save = {
  version: 1;
  mode: "solo";
  stage: number;
  identity: string;
  tradition?: Tradition;
  variant?: BattleVariant;
  seed?: number;
  facts?: { echo: boolean };
  position: { x: number; z: number; yaw: number };
  battle: Battle | null;
};
const finite = (n: unknown, min = 0, max = 10000) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const spell = (s: unknown) => typeof s === "string" && Object.hasOwn(SPELLS, s);
/** Validate the complete data consumed by rules/UI before a manual local import. No shared merge. */
export function validateSave(v: any): v is Save {
  if (
    v?.version !== 1 ||
    v.mode !== "solo" ||
    !Number.isInteger(v.stage) ||
    v.stage < 0 ||
    v.stage > 5 ||
    !["teal", "coral"].includes(v.identity)
  )
    return false;
  if (
    (v.tradition !== undefined &&
      !["margin", "hearth"].includes(v.tradition)) ||
    (v.variant !== undefined &&
      !["baseline", "book", "hand"].includes(v.variant)) ||
    (v.seed !== undefined &&
      (!Number.isInteger(v.seed) || !finite(v.seed, 0, 4294967295))) ||
    (v.facts !== undefined && typeof v.facts?.echo !== "boolean")
  )
    return false;
  if (
    !v.position ||
    !finite(v.position.x, -14, 14) ||
    !finite(v.position.z, -21, 16) ||
    !finite(v.position.yaw, -1000, 1000)
  )
    return false;
  const b = v.battle;
  if (b === null) return true;
  if (
    !b ||
    b.version !== 1 ||
    b.mode !== "solo" ||
    !["lesson", "guardian"].includes(b.kind) ||
    !["planning", "victory", "defeat"].includes(b.phase) ||
    !Array.isArray(b.actors) ||
    b.actors.length !== 2 ||
    typeof b.id !== "string" ||
    b.id.length > 120 ||
    !Number.isSafeInteger(b.round) ||
    !finite(b.round, 1) ||
    !Number.isSafeInteger(b.revision) ||
    !finite(b.revision) ||
    typeof b.upgraded !== "boolean" ||
    typeof b.rewardGranted !== "boolean"
  )
    return false;
  if (
    b.variant !== undefined &&
    !["baseline", "book", "hand"].includes(b.variant)
  )
    return false;
  const ids = b.actors.map((a: any) => a.id);
  if (
    new Set(ids).size !== 2 ||
    !ids.includes("mage1") ||
    !ids.includes(b.kind === "lesson" ? "moth1" : "guardian")
  )
    return false;
  for (const a of b.actors) {
    if (
      typeof a.name !== "string" ||
      a.name.length > 100 ||
      a.team !== (a.id === "mage1" ? "mage" : "enemy") ||
      ![
        "hp",
        "maxHp",
        "ember",
        "ward",
        "wardUntil",
        "markedUntil",
        "staggeredUntil",
      ].every((k) => finite(a[k])) ||
      a.maxHp <= 0 ||
      a.hp > a.maxHp ||
      a.ember > 7 ||
      a.ward > 11
    )
      return false;
    if (
      (a.tradition !== undefined &&
        !["margin", "hearth"].includes(a.tradition)) ||
      (a.counter !== undefined && !finite(a.counter, 0, 5)) ||
      (a.lastSpell !== undefined && !spell(a.lastSpell))
    )
      return false;
    if (
      b.variant === "hand" &&
      a.team === "mage" &&
      (!Array.isArray(a.hand) ||
        a.hand.length !== 4 ||
        !a.hand.every(spell) ||
        !Array.isArray(a.drawPile) ||
        a.drawPile.length !== 8 ||
        !a.drawPile.every(spell) ||
        !Number.isSafeInteger(a.drawIndex) ||
        !finite(a.drawIndex))
    )
      return false;
  }
  if (
    b.intentions !== undefined &&
    (!Array.isArray(b.intentions) ||
      b.intentions.length > 2 ||
      !b.intentions.every(
        (i: any) =>
          i &&
          ids.includes(i.actorId) &&
          i.actorId !== "mage1" &&
          ids.includes(i.targetId) &&
          typeof i.text === "string" &&
          i.text.length < 500 &&
          typeof i.name === "string" &&
          i.name.length < 100 &&
          ["strike", "heavy", "rebind", "purge"].includes(i.spellId) &&
          finite(i.amount, 0, 100) &&
          finite(i.tier, 0, 3),
      ))
  )
    return false;
  return true;
}
