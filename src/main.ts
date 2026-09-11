import { lessonView } from "./ui/onboarding";
import { shell } from "./ui/shell";
import { combatMarkup } from "./ui/combat";
import "./style.css";
import { World } from "./render/world";
import { Sound } from "./audio";
import {
  SPELLS,
  getSpell,
  availableSpells,
  nextDraw,
  TRADITIONS,
  type Tradition,
  type BattleVariant,
  createBattle,
  resolveRound,
  previewQueue,
  getIntentions,
  validatePlan,
  type Battle,
  type Plan,
  type SpellId,
  type BattleEvent,
} from "./simulation/battle";
import { SharedClient, type SharedSnapshot, type Credential } from "./network";

import { validateSave, type Save } from "./saves";
const ui = document.querySelector<HTMLDivElement>("#ui")!;
ui.innerHTML = shell;
const el = (id: string) => document.getElementById(id)!;
const sound = new Sound();
let movedHint = localStorage.getItem("orrery-moved-v1") === "yes";
let lessonCompleted = localStorage.getItem("orrery-lesson-v1") === "yes";
let expandedCombat = false;
let detailedCombat = false;

let tradition: Tradition = "margin",
  variant: BattleVariant = "book",
  seed = 42,
  facts = { echo: false };
const bookView = () =>
  battle ??
  createBattle("lesson", "solo", stage >= 4, {
    variant,
    traditions: { mage1: tradition },
    seed,
  });
const spellView = (id: SpellId) =>
  getSpell(bookView(), battle ? seat() : "mage1", id);

let stage = 0,
  identity = "teal",
  started = false,
  modal = "",
  battle: Battle | null = null,
  plan: Plan | null = null,
  client: SharedClient | null = null,
  shared: SharedSnapshot | null = null,
  connection = "",
  playing = false,
  playbackSpeed = 1,
  playbackToken = 0,
  lastEvents: BattleEvent[] = [],
  toastUntil = 0,
  invitation = "",
  lastStage = -1;
const world = new World(document.querySelector("#world")!, (p) => {
  if (client) client.move(p);
  if (world.moving) {
    sound.step(world.sprinting);
    if (!movedHint) {
      movedHint = true;
      localStorage.setItem("orrery-moved-v1", "yes");
      el("controls").textContent = `${[world.bindings.forward, world.bindings.left, world.bindings.back, world.bindings.right].map(k => k.replace("Key", "")).join("")} · Move`;
  el("controls").style.display = "none";
    }
  }
});
world.active = false;
const points = [
  { x: -3, z: 6, label: "Speak with Keeper Iona", verb: "Talk", type: "npc" },
  {
    x: 4,
    z: 1,
    label: "Wake the seed-lantern",
    verb: "Wake lantern",
    type: "lantern",
  },
  {
    x: 0,
    z: -4,
    label: "Meet the Paper Moth",
    verb: "Begin practice",
    type: "lesson",
  },
  {
    x: -5,
    z: -9,
    label: "Read the field book",
    verb: "Read field book",
    type: "discovery",
  },
  {
    x: 0,
    z: -14,
    label: "Wake the observatory guardian",
    verb: "Approach guardian",
    type: "guardian",
  },
  {
    x: 0,
    z: -19,
    label: "Bellweather is awake",
    verb: "Visit the orrery",
    type: "end",
  },
];
const seat = () => client?.credential.seat ?? "mage1";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function toast(message: string) {
  el("toast").textContent = message;
  toastUntil = performance.now() + 5500;
  el("toast").classList.add("shown");
}
function gate() {
  world.active =
    started &&
    world.loadedAt > 0 &&
    !modal &&
    !playing &&
    (!client || (connection === "connected" && !shared?.paused)) &&
    !battle;
  world.keys.clear();
  if (!world.active) world.traversal.stop();
}
function paintIdentity() {
  world.partnerColor = seat() === "mage2" ? "#2b7f88" : "#bc745e";
  world.partner.traverse((o) => {
    const mesh = o as any;
    if (mesh.isMesh)
      for (const m of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material])
        if (m.name?.toLowerCase().includes("identity"))
          m.color?.set(world.partnerColor);
  });
  world.identityColor = identity === "teal" ? "#2b7f88" : "#b8675c";
  world.player.traverse((o) => {
    const mesh = o as any;
    if (mesh.isMesh) {
      for (const m of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material])
        if (m.name?.toLowerCase().includes("identity"))
          m.color?.set(identity === "teal" ? "#2b7f88" : "#b8675c");
    }
  });
}
function update() {
  world.setEcho(facts.echo);
  world.actorTraditions = client
    ? { ...shared?.traditions }
    : { mage1: tradition, mage2: "hearth" };
  if (stage !== lastStage && !playing) {
    world.setStage(stage);
    lastStage = stage;
  }
  el("objective").textContent = points[stage].label;
  el("subobjective").textContent = client
    ? shared?.paused
      ? "Shared visit · waiting for your friend"
      : `Shared visit · ${TRADITIONS[tradition].name}`
    : stage === 5
      ? "Chapter complete"
      : stage >= 4
        ? TRADITIONS[tradition].name
        : "";
  el("hud").style.display = started ? "flex" : "none";
  el("nav").style.display = started ? "flex" : "none";
  el("controls").style.display =
    started && !battle && !modal && !movedHint ? "block" : "none";
  renderCombat();
  gate();
}
function save() {
  if (client) return;
  const data: Save = {
    version: 1,
    mode: "solo",
    stage,
    identity,
    tradition,
    variant,
    seed,
    facts,
    position: { ...world.position },
    battle,
  };
  localStorage.setItem("orrery-solo-v1", JSON.stringify(data));
}

function restore(v: Save) {
  tradition = v.tradition ?? "margin";
  variant = v.variant ?? "baseline";
  seed = v.seed ?? 42;
  facts = v.facts ?? { echo: false };
  stage = v.stage;
  identity = v.identity;
  world.position = { ...v.position };
  battle = v.battle;
  plan = null;
  paintIdentity();
  world.setStage(stage);
  world.setBattle(battle, seat());
  update();
}
function begin(resume = false) {
  sound.start();
  if (resume) {
    try {
      const s = JSON.parse(localStorage.getItem("orrery-solo-v1") ?? "null");
      if (validateSave(s)) restore(s);
      else toast("No solo save found. Starting a new visit.");
    } catch {
      toast("The saved visit could not be read.");
    }
  }
  started = true;
  el("opening").hidden = true;
  update();
  paintIdentity();

  save();
}
function panel(
  title: string,
  body: string,
  footer = '<button class="primary" data-action="close">Back to the courtyard</button>',
) {
  sound.book();
  el("modal").innerHTML =
    `<div class="scrim"><section class="paper-panel" role="dialog" aria-modal="true" aria-label="${title}"><button class="close" data-action="close" aria-label="Close">×</button><div class="eyebrow">BELLWEATHER COLLEGE</div><h2>${title}</h2>${body}<footer>${footer}</footer></section></div>`;
  gate();
}
function close() {
  modal = "";
  el("modal").innerHTML = "";
  update();
}
function nearbyPoint() {
  if (stage > 0 && world.position.x < -8 && world.position.z > 7)
    return world.position.x < -11.3
      ? {
          x: -12.5,
          z: 10,
          label: "The west archive",
          verb: "Examine sealed arch",
          type: "archive",
        }
      : {
          x: -10,
          z: 10,
          label: "The kettle chorus",
          verb: facts.echo
            ? "Listen to the kettle"
            : "Listen beside the reading bench",
          type: "echo",
        };
  return points[stage];
}
function interact() {
  if (!started || modal || battle || playing || shared?.paused) return;
  const p = nearbyPoint();
  if (Math.hypot(world.position.x - p.x, world.position.z - p.z) > 3.3) return;
  modal = p.type;
  if (p.type === "echo") {
    panel(
      "The staff kettle",
      facts.echo
        ? "<p>The kettle hums your borrowed tune. Someone has put a second cup beside it.</p>"
        : `<p>A kettle sits on a heatproof tile. A label on its handle reads <em>Return to staff room</em>. Its lid taps a rhythm.</p><p>You tap the table. The kettle answers in the same rhythm.</p><p class="note">Optional discovery: the kettle answers you.</p>`,
      facts.echo
        ? undefined
        : '<button class="primary" data-action="accept">Tap the table</button>',
    );
    return;
  }
  if (p.type === "archive") {
    panel(
      "West Archive",
      `<p>Behind the sealed arch, a staircase hangs sideways. Dust falls toward its steps.</p><p>A notice reads: <strong>WEST ARCHIVE CLOSED — stair repairs. Return books at the main desk.</strong></p><p class="note">You cannot open this seal yet.</p>`,
    );
    return;
  }
  if (stage === 0)
    panel(
      "Iona",
      `<div class="speaker">OBSERVATORY KEEPER</div><p>“The telescope's stopped again. Could you start the lamp across the courtyard? The round one by the flower bed.”</p><p>“I'd do it, but it keeps burning my gloves.”</p>`,
      `<button class="primary" data-action="accept">I'll try</button>`,
    );
  else if (stage === 1) {
    accept();
  } else if (stage === 2 || stage === 4)
    panel(
      stage === 2 ? "Paper Moth practice" : "The Drowsing Atlas",
      stage === 2
        ? `<p>The college's practice moth is ready.</p>`
        : `<p>The guardian is blocking the observatory. Its brass shield absorbs damage.</p>`,
      `<button class="primary" data-action="accept">${client ? "Ready to begin" : "Begin encounter"} →</button>`,
    );
  else if (stage === 3)
    panel(
      "The field book",
      `<p><strong>Signature spell: +3 damage.</strong> Someone has corrected the diagram in the margin.</p><h3>Choose your approach</h3><div class="tradition-picker">${Object.values(
        TRADITIONS,
      )
        .map(
          (t) =>
            `<button data-tradition="${t.id}" class="${t.id === tradition ? "selected" : ""}"><b>${t.name}</b><small>${t.description}</small></button>`,
        )
        .join(
          "",
        )}</div><p class="note">Change this later in your spellbook.</p>`,
      `<button class="primary" data-action="accept">Keep the note</button>`,
    );
  else
    panel(
      "The observatory is open",
      `<p>“Good. We can take tonight's measurements.” Iona checks her watch. “And I can finally put the kettle on.”</p><p class="note">Chapter complete. You can keep exploring or start again in Settings.</p>`,
    );
}
function accept() {
  const type = modal;
  toastUntil = 0;
  el("toast").classList.remove("shown");
  close();
  sound.cast(type === "lantern" ? "mend" : "mark");
  if (type === "lesson" || type === "guardian") {
    toastUntil = 0;
    el("toast").classList.remove("shown");
    if (client) {
      client.consent(type);
      toast("Ready sent. Waiting for your friend nearby.");
    } else {
      battle = createBattle(type, "solo", stage >= 4, {
        variant,
        traditions: { mage1: tradition },
        seed,
      });
      battle.id = crypto.randomUUID();
      plan = null;
      world.setBattle(battle);
      update();
      save();
    }
  } else if (type === "echo") {
    if (client) client.interact("echo");
    else {
      facts.echo = true;
      save();
      world.setEcho(true);
    }
    toast("Field note kept · The Kettle Chorus");
  } else if (type === "npc" || type === "lantern" || type === "discovery") {
    if (client) client.interact(type);
    else {
      stage++;
      update();
      save();
    }
    if (type === "lantern") world.effect("mend", "mage1", "mage1", 2);
    if (type === "discovery") toast("Signature spell upgraded: +3 damage");
  }
}
function chooseSpell(id: SpellId) {
  if (!battle || playing) return;
  if (
    !lessonView(battle, seat(), lessonCompleted, expandedCombat).spells.some(
      (s) => s.id === id,
    )
  )
    return;
  const spell = getSpell(battle, seat(), id),
    actor = battle.actors.find((a) => a.id === seat())!;
  if (
    actor.ember < spell.cost ||
    !availableSpells(battle, seat()).some((s) => s.id === id)
  )
    return;
  const target =
    battle.actors.find(
      (a) => a.id === plan?.targetId && a.team === spell.target && a.hp > 0,
    ) ?? battle.actors.find((a) => a.team === spell.target && a.hp > 0);
  if (!target) return;
  plan = { actorId: seat(), spellId: id, targetId: target.id };
  if (client) client.plan(plan);
  renderCombat();
}
function chooseTarget(id: string) {
  if (!battle || !plan || playing) return;
  const a = battle.actors.find((a) => a.id === id);
  if (!a || a.team !== SPELLS[plan.spellId].target) return;
  plan = { ...plan, targetId: id };
  if (client) client.plan(plan);
  renderCombat();
}
async function confirm() {
  if (!battle || playing) return;
  if (client) {
    client.ready();
    return;
  }
  if (!plan) return;
  const error = validatePlan(battle, plan);
  if (error) {
    toast(error);
    return;
  }
  const result = resolveRound(battle, [plan]);
  battle = result.battle;
  if (battle.phase === "victory") stage = battle.kind === "lesson" ? 3 : 5;
  plan = null;
  save();
  await present(result.events);
  update();
}
async function present(events: BattleEvent[]) {
  lastEvents = events;
  const token = ++playbackToken;
  playing = true;
  gate();
  renderCombat();
  for (const event of events) {
    if (token !== playbackToken) break;
    if (!["cast", "attack", "status"].includes(event.kind)) continue;
    el("combat").innerHTML =
      `<div class="resolution"><div class="eyebrow">THE ROUND UNFOLDS</div><h3>${escape((SPELLS[event.spellId as SpellId] && battle ? getSpell(battle, event.actorId, event.spellId as SpellId).name : undefined) ?? (event.spellId === "heavy" ? "Pendulum Fall" : event.text.split(" — ")[0]))}</h3><p>${escape(event.text)}</p><button data-action="skip">Skip presentation →</button></div>`;
    const seconds = (event.spellId === "unfold" ? 3.4 : 1.15) / playbackSpeed;
    world.effect(event.spellId, event.actorId, event.targetId, seconds);
    sound.cast(event.spellId);
    await new Promise((r) => setTimeout(r, seconds * 1000));
  }
  if (token !== playbackToken) return;
  playing = false;
  world.clearEffect();
  world.setBattle(battle, seat());
  update();
}
function skip() {
  sound.stopSpell();
  playbackToken++;
  playing = false;
  world.clearEffect();
  world.setBattle(battle, seat());
  update();
}
function renderCombat() {
  if (!battle) {
    el("combat").innerHTML = "";
    return;
  }
  if (playing) return;
  if (client) plan = shared?.plans[seat()] ?? null;
  world.setIntentions(getIntentions(battle));
  el("combat").innerHTML = combatMarkup(
    battle,
    plan,
    seat(),
    shared,
    !!client,
    playbackSpeed,
    lessonCompleted,
    expandedCombat,
    detailedCombat,
  );
}

function journal() {
  modal = "journal";
  panel(
    "Spellbook",
    `<p><strong>${TRADITIONS[tradition].name}</strong> · ${TRADITIONS[tradition].description}</p>${
      !battle && (stage >= 3 || import.meta.env.DEV)
        ? `<div class="tradition-picker">${Object.values(TRADITIONS)
            .map(
              (t) =>
                `<button data-tradition="${t.id}" class="${t.id === tradition ? "selected" : ""}"><b>${t.name}</b><small>${t.description}</small></button>`,
            )
            .join(
              "",
            )}</div><p class="note">Changes apply to your next encounter. Your friend chooses separately.</p>`
        : ""
    }<div class="journal-grid">${Object.values(SPELLS)
      .map((base) => {
        const s = spellView(base.id);
        return `<article><h3>${s.name} <small>✦ ${s.cost}</small></h3><p>${s.description}</p></article>`;
      })
      .join(
        "",
      )}</div><p class="note">${stage >= 4 ? "Margin note learned: signature +3." : "A margin note waits along the west garden."} ${facts.echo ? "Optional field note: The Kettle Chorus. A tune for tea, not combat." : "The west reading pocket is worth a detour."}</p>${import.meta.env.DEV ? `<details class="laboratory"><summary>Development comparison</summary><label>Combat model <select id="combat-model" ${battle || (client && seat() !== "mage1") ? "disabled" : ""}><option value="baseline" ${variant === "baseline" ? "selected" : ""}>Original baseline</option><option value="book" ${variant === "book" ? "selected" : ""}>Traditions · full book</option><option value="hand" ${variant === "hand" ? "selected" : ""}>Traditions · seeded pages</option></select></label><label>Solo deck seed <input id="deck-seed" type="number" value="${seed}" ${battle || client ? "disabled" : ""}></label><label>Signature presentation <select id="signature-treatment"><option value="spirit" ${world.effects.treatment === "spirit" ? "selected" : ""}>Lantern crane</option><option value="pages" ${world.effects.treatment === "pages" ? "selected" : ""}>Unfolding pages</option><option value="eclipse" ${world.effects.treatment === "eclipse" ? "selected" : ""}>Borrowed eclipse</option></select></label><p>Models apply next encounter. Presentations use the identical committed result.</p></details>` : ""}`,
  );
}

function settings() {
  modal = "settings";
  panel(
    "Settings",
    `<div class="settings"><label>Camera sensitivity <input id="sensitivity" type="range" min="0.3" max="2" step="0.1" value="${world.sensitivity}"></label><label>Reduced camera motion <input id="reduced" type="checkbox" ${world.reduced ? "checked" : ""}></label><label>Low graphics <input id="quality" type="checkbox" ${world.low ? "checked" : ""}></label><label>Mute sound <input id="mute" type="checkbox" ${sound.muted ? "checked" : ""}></label></div><h3>Essential controls</h3><p class="note">Hold Shift to sprint. Drag the world to orbit; scroll to zoom. Recenter follows your facing direction.</p><p class="note">Select a binding, then press a key. Escape closes panels. Number keys 1–6 select spells; Enter confirms a round.</p><div class="bindings">${Object.entries(
      world.bindings,
    )
      .map(
        ([a, k]) =>
          `<button data-bind="${a}">${a} <kbd>${k.replace("Key", "")}</kbd></button>`,
      )
      .join(
        "",
      )}</div><div class="save-actions"><button data-action="export" ${client ? "disabled" : ""}>Export solo save</button><label class="file-button">Import solo save<input type="file" id="import" accept="application/json" ${client ? "disabled" : ""}></label><button data-action="restart" ${client ? "disabled" : ""}>New solo visit</button></div>`,
  );
}
let binding: string | null = null;
function updateSharedStatus() {
  const status = document.getElementById("shared-status");
  if (status)
    status.textContent = `Connection: ${connection}. ${shared?.paused ? "Waiting for your friend." : ""}`;
}
function sharedPanel() {
  modal = "shared";
  let saved: Credential | null = null;
  try {
    saved = JSON.parse(localStorage.getItem("orrery-shared-seat-v1") ?? "null");
  } catch {}
  panel(
    "Play with a friend",
    `<p>Two mages, one shared visit. Each chooses a spell; both confirm before a round starts.</p>${client ? `<p id="shared-status" class="note" role="status">Connection: ${connection}. ${shared?.paused ? "Waiting for your friend." : ""}</p>${invitation ? `<label>Private invitation<input id="invite-output" readonly value="${escape(invitation)}"></label>` : ""}<button data-action="rejoin">Reconnect this seat</button><button data-action="solo">Return to local solo</button>` : `<button class="primary" data-action="host">Start a shared visit</button><p>Have an invitation?</p><input id="join-input" placeholder="Paste private invitation link" aria-label="Private invitation"><button data-action="join">Join your friend</button>${saved ? '<button data-action="resume-shared">Rejoin saved seat</button>' : ""}`}<p class="note">Both friends must open this same site. Share the private invitation above; shared and solo saves stay separate.</p>`,
  );
}
function connect(credential: Credential) {
  client?.close();
  localStorage.setItem("orrery-shared-seat-v1", JSON.stringify(credential));
  identity = credential.seat === "mage1" ? "teal" : "coral";
  paintIdentity();
  invitation = credential.invitation
    ? `${location.origin}/#join=${credential.sessionId}.${credential.invitation}`
    : "";
  let first = true;
  client = new SharedClient(credential, {
    onSnapshot: (s) => {
      const incomingResult =
        !first && !!s.lastResult && s.lastResult.id !== shared?.lastResult?.id;
      const entering = !battle && !!s.battle;
      if (incomingResult) playing = true;
      shared = s;
      updateSharedStatus();
      variant = s.variant;
      tradition = s.traditions[credential.seat];
      facts = { ...s.facts };
      world.setEcho(facts.echo);
      stage = s.stage;
      battle = s.battle;
      if (entering) {
        toastUntil = 0;
        el("toast").classList.remove("shown");
      }
      plan = s.plans[seat()] ?? null;
      if (first) {
        world.position = { ...s.positions[credential.seat] };
        first = false;
      }
      const other = s.seats.find((a) => a.id !== seat());
      world.partner.visible = !!other?.connected;
      if (other) world.remote = { ...other.position };
      if (!playing) world.setBattle(battle, seat());
      update();
    },
    onConnection: (s) => {
      connection = s;
      updateSharedStatus();
      if (s === "connecting") {
        first = true;
        playbackToken++;
        playing = false;
        world.clearEffect();
      }
      if (s === "disconnected") {
        toast("Shared play paused. Use the friend menu to rejoin your seat.");
        world.active = false;
      }
    },
    onError: toast,
    onNotice: toast,
    onMovementCorrection: (position, reason) => {
      world.position = { ...position };
      toast(reason);
    },
    onResult: (events) => {
      void present(events);
    },
    onMovement: (id, p) => {
      if (id !== seat()) world.remote = p;
    },
  });
  client.connect();
  paintIdentity();
  started = true;
  el("opening").hidden = true;
  close();
  toast("Shared visit opened. Invite your friend from the ♧ menu.");
}
ui.addEventListener("click", async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-action],[data-spell],[data-target],[data-bind],[data-tradition]",
  );
  if (!button) return;
  sound.start();
  if (button.dataset.tradition && !battle) {
    tradition = button.dataset.tradition as Tradition;
    if (client) client.configure({ tradition });
    paintIdentity();
    document
      .querySelectorAll("[data-tradition]")
      .forEach((b) =>
        b.classList.toggle(
          "selected",
          (b as HTMLElement).dataset.tradition === tradition,
        ),
      );
    if (modal === "journal") journal();
    update();
    save();
    return;
  }
  if (button.dataset.spell) {
    chooseSpell(button.dataset.spell as SpellId);
    return;
  }
  if (button.dataset.target) {
    chooseTarget(button.dataset.target);
    return;
  }
  if (button.dataset.bind) {
    binding = button.dataset.bind;
    button.textContent = "Press a key…";
    return;
  }
  try {
    switch (button.dataset.action) {
      case "begin":
        begin();
        break;
      case "continue":
        begin(true);
        break;
      case "teal":
      case "coral":
        identity = button.dataset.action;
        document
          .querySelectorAll(".swatch")
          .forEach((b) =>
            b.classList.toggle(
              "selected",
              (b as HTMLElement).dataset.action === identity,
            ),
          );
        paintIdentity();
        break;
      case "journal":
        journal();
        break;
      case "settings":
        settings();
        break;
      case "shared":
        sharedPanel();
        break;
      case "close":
        close();
        break;
      case "interact":
        interact();
        break;
      case "accept":
        accept();
        break;
      case "combat-expand":
        expandedCombat = !expandedCombat;
        renderCombat();
        break;
      case "combat-details":
        detailedCombat = !detailedCombat;
        renderCombat();
        break;
      case "confirm":
        void confirm();
        break;
      case "skip":
        skip();
        break;
      case "pace":
        playbackSpeed = playbackSpeed === 1 ? 2 : 1;
        renderCombat();
        break;
      case "leave-battle":
        if (battle?.kind === "lesson" && battle.phase === "victory") {
          lessonCompleted = true;
          localStorage.setItem("orrery-lesson-v1", "yes");
        }
        if (client) client.leaveBattle();
        else {
          battle = null;
          world.setBattle(null);
          update();
          save();
        }
        break;
      case "restart":
        close();
        battle = null;
        stage = 0;
        facts = { echo: false };
        world.setEcho(false);
        world.position = { x: 0, z: 10, yaw: Math.PI };
        world.setBattle(null);
        update();
        save();
        break;
      case "export":
        save();
        {
          const blob = new Blob(
            [localStorage.getItem("orrery-solo-v1") ?? ""],
            { type: "application/json" },
          );
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "sleeping-orrery-solo.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 500);
        }
        break;
      case "host":
        connect(await SharedClient.create());
        sharedPanel();
        break;
      case "join": {
        const raw = (el("join-input") as HTMLInputElement).value;
        const part = raw.includes("#join=") ? raw.split("#join=")[1] : raw;
        const [id, invite] = part.split(".");
        if (!id || !invite)
          throw Error("Paste the complete private invitation.");
        connect(await SharedClient.join(id, invite));
        break;
      }
      case "rejoin":
        client?.connect();
        close();
        break;
      case "resume-shared": {
        const c = JSON.parse(
          localStorage.getItem("orrery-shared-seat-v1") ?? "null",
        );
        if (c) connect(c);
        break;
      }
      case "solo":
        client?.close();
        client = null;
        shared = null;
        world.partner.visible = false;
        close();
        begin(true);
        break;
    }
  } catch (err) {
    toast(err instanceof Error ? err.message : String(err));
  }
});
ui.addEventListener("input", (e) => {
  const input = e.target as HTMLInputElement;
  if (input.id === "combat-model" && !battle) {
    variant = input.value as BattleVariant;
    if (client) client.configure({ variant });
    save();
    journal();
  }
  if (input.id === "deck-seed" && !battle) seed = Number(input.value) >>> 0;
  if (input.id === "signature-treatment")
    world.setSignature(input.value as "pages" | "spirit" | "eclipse");
  if (input.id === "sensitivity") world.sensitivity = Number(input.value);
  if (input.id === "reduced") world.reduced = input.checked;
  if (input.id === "quality") world.setQuality(input.checked);
  if (input.id === "mute") sound.muted = input.checked;
  localStorage.setItem(
    "orrery-settings-v1",
    JSON.stringify({
      sensitivity: world.sensitivity,
      reduced: world.reduced,
      low: world.low,
      muted: sound.muted,
      bindings: world.bindings,
    }),
  );
});
ui.addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement;
  if (input.id === "import" && input.files?.[0] && !client) {
    try {
      if (input.files[0].size > 50000) throw Error("Save file is too large.");
      const data = JSON.parse(await input.files[0].text());
      if (!validateSave(data))
        throw Error("This is not a supported solo save.");
      restore(data);
      save();
      close();
      toast("Your solo visit is restored.");
    } catch (err) {
      toast(String(err));
    }
  }
});
window.addEventListener("keydown", (e) => {
  if (binding) {
    e.preventDefault();
    if (e.code !== "Escape") {
      const existing = Object.entries(world.bindings).find(
        ([, k]) => k === e.code,
      );
      if (existing) {
        toast("That key already has a binding.");
        return;
      }
      (world.bindings as any)[binding] = e.code;
    }
    binding = null;
    settings();
    localStorage.setItem(
      "orrery-settings-v1",
      JSON.stringify({
        sensitivity: world.sensitivity,
        reduced: world.reduced,
        low: world.low,
        muted: sound.muted,
        bindings: world.bindings,
      }),
    );
    return;
  }
  if ((e.target as HTMLElement).matches("input,textarea,select")) return;
  if (e.code === "Escape") {
    close();
    return;
  }
  if (modal || !started) return;
  if (Object.values(world.bindings).includes(e.code) || e.code === "Enter")
    e.preventDefault();
  world.keys.add(e.code);
  if (e.repeat) return;
  if (e.code === world.bindings.journal) journal();
  else if (e.code === world.bindings.recenter) world.recenter();
  else if (e.code === world.bindings.interact) interact();
  else if (e.code === world.bindings.confirm && battle) void confirm();
  else if (/^Digit[1-6]$/.test(e.code)) {
    const id = battle
      ? lessonView(battle, seat(), lessonCompleted, expandedCombat).spells[
          Number(e.code.slice(-1)) - 1
        ]?.id
      : undefined;
    if (id) chooseSpell(id);
  }
});
window.addEventListener("keyup", (e) => world.keys.delete(e.code));
try {
  const s = JSON.parse(localStorage.getItem("orrery-settings-v1") ?? "null");
  if (s) {
    world.sensitivity = s.sensitivity ?? 1;
    world.reduced = !!s.reduced;
    world.setQuality(!!s.low);
    sound.muted = !!s.muted;
    if (s.bindings) world.bindings = { ...world.bindings, ...s.bindings };
  }
} catch {}
if (matchMedia("(prefers-reduced-motion: reduce)").matches)
  world.reduced = true;
setInterval(() => {
  if (!started) return;
  const p = nearbyPoint(),
    near = Math.hypot(world.position.x - p.x, world.position.z - p.z) < 3.3;
  const promptHtml =
    near && !modal && !battle && !shared?.paused
      ? `<button data-action="interact"><kbd>${world.bindings.interact.replace("Key", "")}</kbd> ${p.verb} <span>✧</span></button>`
      : "";
  if (el("prompt").innerHTML !== promptHtml)
    el("prompt").innerHTML = promptHtml;
  if (performance.now() > toastUntil) el("toast").classList.remove("shown");
}, 150);
setInterval(() => {
  if (started && !client) save();
}, 3000);
window.addEventListener("pagehide", save);
if (import.meta.env.DEV)
  Object.defineProperty(window, "__orrery", {
    get: () =>
      Object.freeze({
        version: 1,
        build: "0.2.0-benchmark",
        tradition,
        variant,
        seed,
        facts: { ...facts },
        signature: world.effects.treatment,
        stage,
        battle: structuredClone(battle),
        plan: structuredClone(plan),
        playing,
        modal,
        started,
        shared: shared
          ? structuredClone({
              stage: shared.stage,
              variant: shared.variant,
              traditions: shared.traditions,
              facts: shared.facts,
              paused: shared.paused,
              roundId: shared.roundId,
              planRevisions: shared.planRevisions,
              ready: shared.ready,
              positions: shared.positions,
            })
          : null,
        metrics: client ? { ...client.metrics } : null,
        ...world.diagnostics(),
      }),
  });
if (location.hash.startsWith("#join=")) {
  const value = location.href;
  begin();
  sharedPanel();
  (el("join-input") as HTMLInputElement).value = value;
}
update();
for (const name of ["begin", "continue"])
  (
    document.querySelector(`[data-action="${name}"]`) as HTMLButtonElement
  ).disabled = true;
const beginButton = document.querySelector<HTMLButtonElement>(
  '[data-action="begin"]',
)!;
beginButton.textContent = "Loading…";
const loadingTimer = setInterval(() => {
  if (world.loadedAt) {
    clearInterval(loadingTimer);
    for (const name of ["begin", "continue"])
      (
        document.querySelector(`[data-action="${name}"]`) as HTMLButtonElement
      ).disabled = false;
    beginButton.innerHTML = "Begin playing <span>→</span>";
    paintIdentity();
    if (world.loadingErrors.length)
      toast("Some artwork could not load. Reload to try again.");
    update();
  }
}, 150);

try {
  const saved = JSON.parse(localStorage.getItem("orrery-solo-v1") ?? "null");
  (
    document.querySelector('[data-action="continue"]') as HTMLButtonElement
  ).hidden = !validateSave(saved);
} catch {}
