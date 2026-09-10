# Runtime and rules evidence

Evidence is recorded, not inferred from the concept art. The generated target under art/ is not a screenshot of the game.

## Named scenarios

- `actual-input-solo-full-loop`: starts at title; actual WASD, camera drag/zoom, remapping, modal input gate, NPC and lantern, lesson, discovered annotation, guardian, victory, changed world, save reload. No gameplay state fixture or WebSocket mock. Repeated Enter during playback and after skip leave the committed result unchanged. `tests/gameplay.spec.ts`; screenshots `evidence/runtime-01` through `runtime-09`; video under `evidence/playwright/`; data `evidence/solo-input-runtime.json`.
- `real-local-do-two-browser-protocol`: two independent Chromium contexts connected to actual local workerd/SQLite. Exercises simultaneous plans, edited readiness, duplicate confirmations, disconnect before/after commit, resumed seat, stale round, once-only reward, invitation validation. This calls the real protocol directly and is **not a gameplay-input UI claim**. `tests/network-real.mjs`; `evidence/network-real.json`.
- `process-restart-sqlite-reconstruction`: terminates and restarts the local server process, rejoins both persisted seats, checks committed battle/revision, progress and reward IDs. `evidence/network-reconstruction.json`.
- `application-delay`: same real local protocol with 250 ms delayed application receipt. This does **not** simulate physical packet loss or geographical latency. `evidence/network-delayed.json`.
- `production-preview-protocol`: real two-client protocol against the built Worker and static assets at port 5181. `evidence/network-production.json`.
- Battle and session unit/model tests use explicitly arranged states to test pure transitions, not pretend to be human input. 22 tests passed, including generated action sequences. See tests and docs/balance.md.

## Visual and motion review

Inspected actual screenshots for exploration, both planning screens, unfolding pages, victory and low graphics. Original findings fixed: Iona intersected a planter; initial camera cropped the dome; spell heading precedence showed the wrong name; signature UI covered the caster; final-world illumination was too subtle. Static environment geometry was batched after a measured high draw count. Motion frames inspect locomotion and the signature's expansion/rotation/cleanup. Character source inspection also corrected cape and staff intersections; remaining art caveats are in art.md.

## Performance limits

The first default headless browser selected **SwiftShader**, with very slow frame times; it is not representative of hardware rendering. A separate D3D11 run selected the actual **Intel UHD Graphics** adapter. A 1280×720 input-loop run recorded p50 approximately 16.7 ms, p95 approximately 16.8 ms, p99 approximately 33.3 ms across 1,800 samples. Exact latest values, viewport, drawing buffer, load time, draw calls, triangles, textures, geometry and errors are stored in the runtime JSON. Repeated test runs can differ due to other local browser activity. Startup samples include loading unless explicitly marked steady-state.

This is one machine and browser backend. No general 1080p60, weak-device30, human fun, two-device Internet stability or free deployed-account claim is made. Low graphics reduces drawing-buffer resolution while retaining the same materials and scene identity. No deployed performance or external networking evidence exists.

A separate final stationary courtyard sample (`scripts/performance.mjs`, `evidence/performance.json`) warms up before recording 12 seconds per setting. On Intel UHD/D3D11: 1920×1080 high had median16.7ms/p95 33.4ms/p99 33.4ms (599 frames); 1280×720 low, drawing buffer1088×612, had median16.7ms/p95 16.8ms/p99 16.8ms (720 frames). No page errors. An earlier overlapping-browser sample was discarded and rerun after other test browsers stopped. This supports only this local stationary scene; it does not meet or disprove every hardware/encounter acceptance target.
