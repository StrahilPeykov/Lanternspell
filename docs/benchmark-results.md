# Sleeping Orrery benchmark evidence

Current comparison controls, rules and limitations are documented in README.md, combat-benchmark.md and limitations.md. This is the same chapter, not a campaign expansion. No paid service, billed API, purchase or public deployment was used.

## Play and correctness

- 43 unit/model/diagnostic tests passed; typecheck and production build passed. Built-client offline-after-load movement, NPC outcome and spellbook smoke passed (`benchmark-production.json`); production exposes no debug surface. Existing baseline rules and authority tests remain. New properties cover seeded joint-plan determinism, legal affordable options, config ownership and obsolete consent; import checks reject malformed new state.
- `benchmark-solo.json`: actual inputs completed full-book Margin, seeded-hand Margin and full-book Hearth through both encounters and save reload. Optional chorus and sealed-archive interaction used the side route; the optional fact did not advance required stage. Scored choices are labelled automation, not enjoyment evidence.
- `benchmark-duo.json`: two independent real game clients completed mixed full-book and same-Margin seeded-hand chapters. Lesson/guardian took 2/6 and 3/7 rounds respectively under a detached-state diagnostic policy. Plans, targets, consent and confirmations used UI. Editing readiness, repeated confirm, skip, completed-seat reload and same-client reconnect passed. No mocked sockets or state fixtures.
- `benchmark-protocol.json`: real local SQLite/WebSockets, concurrent plans, edit/stale confirmation, duplicate command IDs, disconnect before/after commit, resumed seat and reward once. `benchmark-reconstruction.json`: actual server stop/restart restored committed battle/revision, stage, reward IDs and both credentials. This is local process reconstruction, not deployed eviction or internet verification.
- `signature-comparison.json`: identical actual inputs with pages, crane and eclipse produced identical authoritative battle states after normal playback. Temporary geometry/texture counts returned to their pre-effect levels; repeated confirmation did not change the result. Screenshot/recording overhead makes the recorded wall durations unsuitable as isolated spell timing measurements. Designed duration remains 3.4 seconds; ordinary spells 1.15 seconds.

The historical fixed-route browser suite predates the central basin and experimental rules. Its pure correctness coverage is retained, while current route completion evidence comes from the benchmark drivers. Screenshots and motion were inspected; a crane clipped above the camera and target panels covered Atlas, both corrected. Final target layout has a separate explicitly imported-save visual fixture (`benchmark-layout.json`), not fabricated progression evidence.

## Renderer findings

Confirmed and repaired: identical canvas surfaces were recreated; proxy characters were abandoned at GLB load; material-only batches discarded shadow exclusions; indexed stone boxes and a non-indexed arch made a stone batch fail. Materials now share a cache, initial proxies are only created on load failure, shadow flags remain part of the batch key, and only mixed index batches are normalized. Current console capture has no rendering warnings/errors. The old Three.js soft-shadow constant warned and fell back; the supported PCF setting now states that choice directly.

Low preserves the same authored scene and color treatment. It uses 1024px shadows instead of 2048, excludes environment shadow casters while retaining actor shadows, disables the secondary doorway point light, reduces selected decorative effect counts, and uses the existing .85 drawing-buffer ratio. It is not a new blur-only tier. No shader prewarm or custom renderer was added without isolated evidence of a first-use shader bottleneck.

## Hardware measurements and interference

All measurements below requested D3D11 and reported **ANGLE / Intel UHD Graphics (0x00009BC4), Direct3D11 vs_5_0 ps_5_0**. Chromium153.0.8010.12 headless. High:1920×1080 view/buffer. Low:1280×720 view,1088×612 buffer. Each stationary courtyard sample warms up, then records12 seconds. These are not worst-case battle or weak-device guarantees.

| Sample | High median / p95 / p99 ms | Low median / p95 / p99 ms |
|---|---|---|
| Initial original build |16.7 /33.4 /33.4|16.7 /16.7 /16.8|
| First final build, competing workload observed|50 /100 /133.2|16.7 /66.6 /66.7|
| Original build rechecked during late workload|33.4 /83.4 /116.6|33.3 /50 /66.6|
| Final build late repeat|50.1 /100 /116.7|16.7 /33.4 /66.7|

The final timing goal is **not established**. Late process inspection found another project's software-rendered browser recording sharing CPU plus substantial desktop-app activity. That other project was left untouched. The original build also became markedly slower when rechecked in the same late window. These windows cannot isolate how much of the final High slowdown is scene cost versus changing machine load; no speedup or uncontended60/30 FPS claim follows. Keep the recorded bad samples rather than selecting only favorable timings. A clean paused-workload retest remains the performance acceptance step.

Resource inventories are less sensitive to that timing interference:

| Build/setting | GPU geometries | Textures | Draw calls | Triangles including shadow passes |
|---|---:|---:|---:|---:|
| Original High/Low|116|88|204|292,640|
| Final High|60|79|142|380,050|
| Final Low|60|79|111|260,215|

The final scene includes the new facade, Atlas, accessories and moth assets; they were not hidden to lower counters. Hardware timings and exact inventories are in `benchmark-before.json`, `benchmark-after.json`, `benchmark-baseline-retest.json`, `benchmark-after-retest.json`. The intermediate resource-only pass is retained separately. Geometry reduction/material reuse demonstrate corrected resource handling, not proof of frame-rate targets.

## Curated visuals and next review

`benchmark-courtyard.png` is the running game after actual Begin input. `benchmark-guardian.png` is the labelled planning-layout fixture. `benchmark-signature.png` is the actual-input crane comparison. `benchmark-archive.png` is the actual-input optional branch. Raw videos, other frames and profiling material remain ignored under evidence/local.

Provisional choices: full book for deliberate tradition decisions; crane for a caster-to-target manifestation. Hand restrictions sometimes prompted different choices and sometimes denied the desired remedy. Pages are a quieter visual alternative. None of these conclusions establishes human fun. Personally compare Hearth keep/release versus Margin ward/setup; full book versus one repeated seeded hand; and crane versus pages with a friend reviewing the joint queue.
