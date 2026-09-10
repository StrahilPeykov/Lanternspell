import {
  SPELLS,
  TRADITIONS,
  availableSpells,
  getSpell,
  nextDraw,
  getIntentions,
  previewQueue,
  type Battle,
  type Plan,
} from "../simulation/battle";
import type { SharedSnapshot } from "../network";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** Pure DOM markup. Authority, input and cinematic timing remain with the controller. */
export function combatMarkup(
  battle: Battle,
  plan: Plan | null,
  seatId: "mage1" | "mage2",
  shared: SharedSnapshot | null,
  client: boolean,
  playbackSpeed: number,
) {
  const seat = () => seatId,
    actor = battle.actors.find((a) => a.id === seatId)!,
    plans = client
      ? (Object.values(shared?.plans ?? {}).filter(Boolean) as Plan[])
      : plan
        ? [plan]
        : [];
  if (battle.phase !== "planning") {
    return `<div class="outcome"><div class="eyebrow">${battle.phase === "victory" ? "A LITTLE MAGIC, REMEMBERED" : "THE LIGHT RETREATS"}</div><h2>${battle.phase === "victory" ? (battle.kind === "lesson" ? "A lesson learned" : "Bellweather wakes") : "A chance to begin again"}</h2><p>${battle.phase === "victory" ? (battle.kind === "lesson" ? "The moth settles beside a forgotten field book. Find its margin note along the west garden." : "The observatory opens its golden eye. Its light belongs to the whole courtyard.") : "Try a ward before the heavy strike, or leave a seed for the following round."}</p><button class="primary" data-action="leave-battle">${battle.phase === "victory" ? "Return to the path" : "Take a breath & retry"} →</button></div>`;
  }
  const intentions = getIntentions(battle);
  const targetHtml = battle.actors
    .map(
      (a) =>
        `<button data-target="${a.id}" class="target ${plan?.targetId === a.id ? "selected" : ""} ${a.hp <= 0 ? "down" : ""}" ${a.hp <= 0 ? "disabled" : ""}><span>${escape(a.tradition ? TRADITIONS[a.tradition].name : a.name)}${a.id === seat() ? " · You" : ""}</span><strong>${a.hp}<small> / ${a.maxHp}</small></strong><div class="health"><i style="width:${(a.hp / a.maxHp) * 100}%"></i></div><small>${a.ward ? `◈ ${a.ward} ward ${a.counter ? "↩ counter " : ""}` : ""}${a.markedUntil >= battle!.round ? `✧ Inscribed to R${a.markedUntil} ` : ""}${a.team === "enemy" ? escape(intentions.find((i) => i.actorId === a.id)?.text ?? "Resting") : `✦ ${a.ember} Ember`}</small></button>`,
    )
    .join("");
  const queue = previewQueue(battle, plans);
  return `<div class="targets">${targetHtml}</div><section class="battle-tray"><div class="battle-heading"><div><span class="eyebrow">${battle.kind === "lesson" ? "THE PAPER LESSON" : "THE DROWSING ATLAS"}</span><h3>Round ${battle.round} <span>${actor.tradition ? TRADITIONS[actor.tradition].name : "Original book"}</span></h3></div><div class="ember">✦ ${actor.ember}<small> / 7 Ember · +2 each round</small></div><button data-action="pace">${playbackSpeed}× playback</button></div><div class="cards" style="grid-template-columns:repeat(${availableSpells(battle, seat()).length},1fr)">${availableSpells(
    battle,
    seat(),
  )
    .map(
      (s, i) =>
        `<button class="spell ${plan?.spellId === s.id ? "selected" : ""}" data-spell="${s.id}" ${actor.ember < s.cost || actor.hp <= 0 ? "disabled" : ""}><span class="card-top"><kbd>${i + 1}</kbd><span>${s.cost === 0 ? "Free" : `✦ ${s.cost}`}</span></span><span class="sigil">${["✦", "❧", "✧", "◈", "⌁", "❋"][i]}</span><strong>${s.name}</strong><span class="spell-description">${s.description.replace("Margin note adds 3 damage.", battle!.upgraded ? "Margin note: +3 damage." : "")}</span><small>${["WARD & REMEDY", "QUICK", "UNFOLDING", "HEAVY"][s.tier]}</small></button>`,
    )
    .join(
      "",
    )}</div>${battle.variant === "hand" ? `<div class="hand-note">Four pages + free spell · playing a page replaces one copy next round · Next: <strong>${getSpell(battle, seat(), nextDraw(battle, seat())!).name}</strong> · Held: ${actor.hand?.map((id) => getSpell(battle!, seat(), id).name).join(" / ")}</div>` : ""}<div class="queue-row"><div class="queue"><span class="eyebrow">RESOLUTION ORDER</span><div>${queue.map((q) => `<span>${q.actorId === seat() ? "You" : q.actorId.startsWith("mage") ? "Friend" : escape(battle!.actors.find((a) => a.id === q.actorId)?.name ?? "Foe")}: ${escape(q.name)} → ${escape(battle!.actors.find((a) => a.id === q.targetId)?.name ?? "—")}${q.fallbackFrom ? " ↪ retarget" : ""}</span>`).join("<b> → </b>")}</div>${client ? `<small>${shared?.paused ? "Paused · a mage is disconnected" : shared?.ready[seat()] ? "Your plan is confirmed. Edits reopen readiness." : "Both mages review the current queue before confirming."}</small>` : "<small>Pick a spell, then a target. You can change either before resolving.</small>"}</div><button class="primary" data-action="confirm" ${(!plan && actor.hp > 0) || shared?.paused ? "disabled" : ""}>${client ? (shared?.ready[seat()] ? "Ready ✓" : "Confirm plan ✓") : "Resolve round →"}</button></div></section>`;
}
