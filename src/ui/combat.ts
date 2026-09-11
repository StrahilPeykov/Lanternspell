import { lessonView } from "./onboarding";
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
import { roundForecast } from "./forecast";
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
  lessonCompleted = true,
  expanded = false,
  detailed = false,
) {
  const seat = () => seatId,
    actor = battle.actors.find((a) => a.id === seatId)!,
    plans = client
      ? (Object.values(shared?.plans ?? {}).filter(Boolean) as Plan[])
      : plan
        ? [plan]
        : [];
  if (battle.phase !== "planning") {
    return `<div class="outcome"><div class="eyebrow">${battle.phase === "victory" ? "VICTORY" : "DEFEAT"}</div><h2>${battle.phase === "victory" ? (battle.kind === "lesson" ? "Practice complete" : "Bellweather wakes") : "Try again"}</h2><p>${battle.phase === "victory" ? (battle.kind === "lesson" ? "Read the field book beside the left garden." : "The observatory is open.") : "Protect yourself before a heavy strike. Recovery and protection can target you."}</p><button class="primary" data-action="leave-battle">${battle.phase === "victory" ? "Return to the path" : "Return and retry"} →</button></div>`;
  }
  const lesson = lessonView(battle, seatId, lessonCompleted, expanded);
  const intentions = getIntentions(battle);
  const enemy = battle.actors.find((a) => a.team === "enemy" && a.hp > 0);
  const contextual =
    lesson.hint ||
    (!lessonCompleted && battle.kind === "guardian"
      ? ""
      : battle.kind === "guardian" && battle.round === 1
        ? `The Atlas has ${enemy?.ward ?? 0} ward. ${getSpell(battle, seatId, "unseal").name} removes it.`
        : "");
  const forecast = roundForecast(battle, plans);
  const targetHtml = battle.actors
    .map(
      (a) =>
        `<button data-target="${a.id}" class="target ${plan?.targetId === a.id ? "selected" : ""} ${a.hp <= 0 ? "down" : ""}" ${a.hp <= 0 ? "disabled" : ""}><span>${escape(a.tradition ? (lesson.teaching ? "Mage" : TRADITIONS[a.tradition].name) : a.name)}${a.id === seat() ? " · You" : ""}</span><strong>${a.hp}<small> / ${a.maxHp}</small></strong><div class="health"><i style="width:${(a.hp / a.maxHp) * 100}%"></i></div><small>${a.ward ? `◈ ${a.ward} ward ${a.counter ? "↩ counter " : ""}` : ""}${a.markedUntil >= battle!.round ? `✧ Marked · signature bonus ` : ""}${a.team === "enemy" ? escape(intentions.find((i) => i.actorId === a.id)?.text ?? "Resting") : `✦ ${a.ember} Ember`}</small></button>`,
    )
    .join("");
  const queue = previewQueue(battle, plans);
  const forecastHtml = forecast
    ? `<div class="round-forecast"><b>After this round</b>${forecast.actors
        .filter((a) => battle.actors.find((old) => old.id === a.id)!.hp > 0)
        .map(
          (a) =>
            `<span class="${a.hp <= 0 ? "forecast-down" : a.healthChange < 0 ? "forecast-hurt" : ""}">${a.id === seat() ? "You" : a.id.startsWith("mage") ? "Friend" : escape(battle.actors.find((old) => old.id === a.id)!.name)}: <strong>${a.hp} HP</strong>${a.ward ? ` · ${a.ward} ward` : ""}${a.hp <= 0 ? " · down" : ""}</span>`,
        )
        .join(
          "",
        )}${forecast.phase !== "planning" ? `<strong>${forecast.phase === "victory" ? "Victory" : "Defeat"}</strong>` : ""}</div>`
    : `<div class="round-forecast muted">${client ? "Both mages choose a spell to preview the shared result." : "Choose a spell and target to preview the round."}</div>`;
  return `<div class="targets">${targetHtml}</div><section class="battle-tray ${lesson.teaching ? "teaching" : ""}"><div class="battle-heading"><div><span class="eyebrow">${battle.kind === "lesson" ? "THE PAPER LESSON" : "THE DROWSING ATLAS"}</span><h3>Round ${battle.round} <span>${lesson.teaching ? "Practice" : actor.tradition ? TRADITIONS[actor.tradition].name : "Original book"}</span></h3></div><div class="ember" ${lesson.teaching && battle.round === 1 ? "hidden" : ""}>✦ ${actor.ember}<small> / 7 Ember · +2 each round</small></div><button data-action="pace">${playbackSpeed}× playback</button><button class="disclosure" data-action="combat-details">${detailed ? "Hide" : "Show"} round details</button></div><div class="lesson-hint">${contextual}</div><div class="cards ${lesson.teaching && !expanded ? "teaching-cards" : ""}" style="grid-template-columns:repeat(${lesson.spells.length},1fr);${lesson.teaching && !expanded ? `width:${lesson.spells.length * 215}px;max-width:100%` : ""}">${lesson.spells
    .map(
      (s, i) =>
        `<button class="spell ${lesson.teaching && s.id === lesson.recommended ? "recommended" : ""} ${plan?.spellId === s.id ? "selected" : ""}" data-spell="${s.id}" ${actor.ember < s.cost || actor.hp <= 0 ? "disabled" : ""}><span class="card-top"><kbd>${i + 1}</kbd><span>${s.cost === 0 ? "Free" : `✦ ${s.cost}`}</span></span><span class="sigil">${{ spark: "✦", mark: "❧", unfold: "✧", shelter: "◈", unseal: "⌁", mend: "❋" }[s.id]}</span><strong>${s.name}</strong><span class="spell-description">${s.description}${s.id === "unfold" && battle.upgraded ? " Note: +3 damage." : ""}</span><small ${lesson.teaching ? "hidden" : ""}>${["WARD & REMEDY", "QUICK", "UNFOLDING", "HEAVY"][s.tier]}</small></button>`,
    )
    .join(
      "",
    )}</div>${battle.variant === "hand" ? `<div class="hand-note">Four pages · paid spell replaces its page; free spell turns the leftmost page · Next: <strong>${getSpell(battle, seat(), nextDraw(battle, seat())!).name}</strong> · Held: ${actor.hand?.map((id) => getSpell(battle!, seat(), id).name).join(" / ")}</div>` : ""}${lesson.teaching ? `<button class="disclosure" data-action="combat-expand">${expanded ? "Practice spells" : "All spells"}</button>` : ""}${detailed ? forecastHtml : ""}<div class="queue-row"><div class="queue" ${!client && !detailed ? "hidden" : ""}><span class="eyebrow">RESOLUTION ORDER</span><div>${queue.map((q) => `<span>${q.actorId === seat() ? "You" : q.actorId.startsWith("mage") ? "Friend" : escape(battle!.actors.find((a) => a.id === q.actorId)?.name ?? "Foe")}: ${escape(q.name)} → ${escape(battle!.actors.find((a) => a.id === q.targetId)?.name ?? "—")}${q.fallbackFrom ? " ↪ retarget" : ""}</span>`).join("<b> → </b>")}</div>${client ? `<small>${shared?.paused ? "Paused · a mage is disconnected" : shared?.ready[seat()] ? "Your plan is confirmed. Editing cancels readiness." : "Both mages confirm this plan."}</small>` : "<small>Change your spell or target before resolving.</small>"}</div><button class="primary" data-action="confirm" ${(!plan && actor.hp > 0) || shared?.paused ? "disabled" : ""}>${client ? (shared?.ready[seat()] ? "Ready ✓" : "Confirm plan ✓") : "Resolve round →"}</button></div></section>`;
}
