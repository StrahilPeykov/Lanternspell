# Sleeping Orrery refinement evidence — September 11

This pass continued `a14215b`; the first playable and prior benchmark were already integrated into main. Pushed checkpoints: `b7bb7f9` (chapter decisions/art/lifecycle), `61b6b93` (bounded movement/correction and full duo verification). The final handoff commit adds the remaining inspected evidence and resume notes. No new chapter, paid input, runtime service or public deployment. Both Cloudflare dashboard publishing commands were saved as dry runs before pushing. The September 10 public build remains separate.

## Game decisions

Full-book traditions remain the provisional normal mode. Marginweaver offers immediate through-ward inscription and later spread; Hearthbinder creates shelter now and can retain it, counter with it, or release it through the signature. Both keep all six essential roles. The new read-only HP/ward forecast computes the whole round through the same pure resolver only after every living mage has a legal plan. It exposes immediate opportunity costs without committing damage, spending resources or changing intentions.

Seeded pages now advance on the free spell: turn the leftmost page into the shown next page. Paid spells still replace their own slot. A stranded hand can advance without buying an unwanted spell, but a free attack can turn away a valuable page. In 330 controlled diagnostic rows, only 78 hand rows changed; all baseline/full-book rows were identical. Setup-policy wins rose 33→44 of 45 hand cases while greedy immediate damage fell 44→40. These are policy/fixture diagnostics, not optimal play or human enjoyment.

Actual-input solo completed Margin/book, Margin/hand, Hearth/book and Hearth/hand, both encounters plus save reload. Guardian rounds were 9/5/8/7 under the driver's separate one-round scoring policy. Different traditions/seeds make these unsuitable as a fair speed ranking. The optional reading pocket and inaccessible archive were inspected on the Margin/book route. Forecast text and unchanged post-skip committed state were checked through actual UI choices.

The travelling lantern crane remains the provisional signature choice for its emergence beside the caster, readable flight and arrival. Pages provide a quieter unfolding-book alternative; eclipse communicates scale but less personality. These are presentations of the same authoritative signature. The grand cast remains a slowed/held inherited gesture rather than a new animation asset.

## Art and hardware

Warm parchment study glazing, alternating curtains/bookshelves and a stronger instrument dial give existing facades a visible use. Courtyard GLB triangles fell 50,991→26,815 without adding materials/textures. Narrower paving joints and broad washes reduce foreground grid contrast. Varied flowers with paired folded leaves and low distant ridgelines improve composition. The earlier authored Atlas, manuscript moth, player/partner/Iona silhouettes, optional branch and nine original offline-designed sounds remain in this chapter.

Hardware: **ANGLE Intel UHD Graphics (0x00009BC4), D3D11 vs_5_0 ps_5_0**; Chromium 153.0.8010.12 headless, actual hardware identity rather than SwiftShader. Same Windows machine, 12-second warmed stationary courtyard samples. High: 1920×1080 view/buffer with MSAA. Low: 1280×720 view, 1088×612 buffer. Low retains the art, 1024px actor shadows, selected reduced effects and no secondary doorway light/environment shadow casters. Distant trees/hills and tiny flowers now neither cast nor receive shadows in either tier. Normal MSAA remains enabled.

| Setting | Before median / p95 / p99 ms | After median / p95 / p99 ms |
|---|---|---|
| High |50 / 66.7 / 66.8|33.4 / 66.7 / 83.3|
| Low |16.7 / 33.2 / 33.4|16.7 / 16.8 / 33.4|

| Setting | Before geometry / textures / calls / triangles | After geometry / textures / calls / triangles |
|---|---|---|
| High |60 / 79 / 142 / 380,050|61 / 80 / 140 / 294,466|
| Low |60 / 79 / 111 / 260,215|61 / 80 / 112 / 232,935|

The added shared mortar wash accounts for one additional material/texture/batch. Triangles include shadow passes. Asset-ready time was 4.86s before and 4.60s after in these two local runs, not a cold-download distribution. No rendering warnings/errors. High median improved; **High tail did not meet the target**, and p99 worsened in this sample. Low p95 improved. No general 1080p60, weak-device or worst-case combat guarantee follows. No concurrent agent browser recording ran during the successful final sample. Two source-HMR-interrupted attempts were discarded as invalid; historical September 10 timings remain preserved. The after sample precedes later network/dialogue fixes; renderer source and runtime art stayed unchanged afterward.

Development-only `?renderProbe=no-aa` and `?renderProbe=no-shadows` isolated expensive settings. With the newly reduced courtyard, High medians were 33.4/33.3ms respectively. These probes also used the revised asset, so comparison against the starting scene cannot independently quantify each optimization's gain. Raw probe reports remain ignored local evidence. The final before/after comparison retains normal MSAA and shadows with selective exclusions.

## Correctness and inspection

All **64 unit/model/diagnostic tests**, typecheck and the final production build passed. New cases cover stranded page access across 100 seeds, immutable forecast agreement, permanent shared departure, replaced sockets, bounded movement and corrections. Lifecycle tests use labelled fake transport/storage fixtures; their conclusions are narrower than real-network evidence.

- `refinement-protocol.json`: real local Durable Object, 23 commands, simultaneous plans, edit-after-ready, stale/duplicate confirmation, disconnect around commit and rewards once.
- `refinement-protocol-delayed.json`: 25 commands including live seat replacement, with 200ms application receipt delay. This is not link packet loss/geographic latency.
- `refinement-reconstruction.json`: full dev-server stop/restart restored battle/revision, stage, reward IDs and both stored credentials.
- `refinement-production.json`: built client exposed no debug surface and continued movement/NPC outcome/spellbook after browser networking was disabled.
- `refinement-production-protocol.json`: final packaged local Worker passed all 25 real protocol commands.
- `refinement-production-ui.json`: two independently loaded packaged clients hosted/joined through UI, used WASD and reconnected through the friend menu. These local sockets use WS on loopback, not public WSS.
- `refinement-duo.json`: both full chapters completed with the final bounded-movement client: mixed Margin/Hearth full book (lesson 2 / guardian 6 rounds) and identical Margin seeded hands (3 / 7). Every plan/target/confirmation used UI; both clients matched committed rounds; ready edits, repeated Enter, skip/natural completion, shared optional echo, completed-seat reload and same-client rejoin passed. These are diagnostic-policy walkthroughs, not human enjoyment or performance samples. The final non-recording walkthroughs retained rendered screenshots and motion frames; a previous mixed-book recording also completed.
- `refinement-signatures.json`: current pages/crane/eclipse comparison used identical actual inputs, normal playback and no state fixtures. All three committed outcomes matched. Early/middle motion frames were inspected: pages orbit the target, crane emerges beside the caster and travels, eclipse stays above the target and presses close to the upper frame edge. Geometry/texture counts returned to the same 68/81 before/after each treatment; temporary effect children returned to zero. Draw counts differ across the encounter transition. Recorded wall times include screenshots/recording and are not isolated spell durations; designed timing remains 1.15s ordinary / 3.4s signature.

The initial full duo recording exposed final-movement loss: a 65ms server packet gate discarded bunched updates, leaving the authoritative position several metres behind the visible mage. A renderer-free real-WebSocket burst reproduced it. Cumulative distance credit (initial 0.7m, cap 5m, refill 7m/s) repaired that loss, but a later longer stall still accumulated too much obsolete movement. The complete fix keeps one movement in flight plus one replaceable latest position, acknowledged without SQLite writes. Proximity actions wait for the final receipt; a rejected movement explicitly restores the visible mage and cancels unsent proximity actions. A 10-second watchdog pauses once for manual rejoin, without a resend loop. The 30-message/s guard remains.

The actual SharedClient and real local authority, with 600ms application receipt delay, converted 101 requested positions into two movement packets and then accepted the deferred NPC interaction. An invalid jump produced a correction, cleared pending work, and allowed subsequent legal walking. This harness uses Node WebSockets and small browser-global adapters, not a renderer or fake authority. The final 35 focused network tests passed, including 16 lifecycle/movement cases; TypeScript passed. Earlier renderer-free burst proof and all failed duo attempts remain available in ignored local evidence.

One intermediate hand-duo timeout occurred during overlapping preview startup; its scheduling cause is not established. Another failure was a driver race when natural playback removed Skip before its click. The driver now accepts that only if playback has actually ended, then still checks committed-state equality. Routine full-duo video is opt-in (`RECORD_VIDEO=1`); actual inputs, rendered screenshots and motion frames always remain.

Curated images: `refinement-courtyard.png` (actual Begin, High), `refinement-forecast.png` (actual solo guardian planning), `refinement-signature.png` (actual solo crane arrival against Atlas). All are runtime captures, not concept images. Other motion frames/videos and failed duo reports remain ignored under evidence/local. Human preferences, speaker/headphone quality, two-device internet play, real packet loss and deployed eviction remain unverified.

## Next human comparison

1. Full-book Hearth against Atlas: compare retaining ward versus releasing it; then play Margin's ward removal/inscription route. Does the new forecast clarify a real choice or make the round feel solved?
2. Replay seed 42 with seeded pages. Does turning the leftmost page on a free attack create useful adaptation, or does losing that page feel arbitrary? No deck editor is present.
3. Cast crane and pages twice each from the normal battle camera, ideally with a friend choosing the other action. Judge anticipation, repeated-use length and sound on ordinary speakers/headphones.
