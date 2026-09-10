# Historical first-playable evidence

Current benchmark checks and limitations are in [benchmark-results.md](benchmark-results.md). The original gameplay suite predates the fountain collision and new default rules; do not treat its old fixed-route/policy assumptions as current benchmark assertions. Valuable pure-rule/protocol invariants remain in the normal test suite.

# Runtime and rules evidence

Evidence is recorded, not inferred from the concept art. The generated target under art/ is not a screenshot of the game.

## Named scenarios

- `actual-input-solo-full-loop`: starts at title; actual WASD, camera drag/zoom, remapping, modal input gate, NPC and lantern, lesson, discovered annotation, guardian, victory, changed world, save reload. No gameplay state fixture or WebSocket mock. Repeated Enter during playback and after skip leave the committed result unchanged. `tests/gameplay.spec.ts`; screenshots `evidence/runtime-01` through `runtime-09`; video under `evidence/playwright/`; data `evidence/solo-input-runtime.json`.
- `real-local-do-two-browser-protocol`: two independent Chromium contexts connected to actual local workerd/SQLite. Exercises simultaneous plans, edited readiness, duplicate confirmations, disconnect before/after commit, resumed seat, stale round, once-only reward, invitation validation. This calls the real protocol directly and is **not a gameplay-input UI claim**. `tests/network-real.mjs`; `evidence/network-real.json`.
- `process-restart-sqlite-reconstruction`: terminates and restarts the local server process, rejoins both persisted seats, checks committed battle/revision, progress and reward IDs. `evidence/network-reconstruction.json`.
- `application-delay`: same real local protocol with 250 ms delayed application receipt. This does **not** simulate physical packet loss or geographical latency. `evidence/network-delayed.json`.
- `production-preview-protocol`: real two-client protocol against the built Worker and static assets at port 5181. `evidence/network-production.json`.
- `production-client-offline-after-load`: built client on 5181, actual movement/NPC outcome and spellbook interaction with browser networking disabled after assets loaded. Production debug surface absent; no page errors. `node tests/production-smoke.mjs`; `evidence/production-smoke.json` and `production-offline-solo.png`. This is not offline installation coverage.
- Battle and session unit/model tests use explicitly arranged states to test pure transitions, not pretend to be human input. 22 tests passed, including generated action sequences. See tests and docs/balance.md.

## Visual and motion review

Inspected actual screenshots for exploration, both planning screens, unfolding pages, victory and low graphics. Original findings fixed: Iona intersected a planter; initial camera cropped the dome; spell heading precedence showed the wrong name; signature UI covered the caster; final-world illumination was too subtle. Static environment geometry was batched after a measured high draw count. Motion frames inspect locomotion and the signature's expansion/rotation/cleanup. Character source inspection also corrected cape and staff intersections; remaining art caveats are in art.md.

## Performance limits

The first default headless browser selected **SwiftShader**, with very slow frame times; it is not representative of hardware rendering. A separate D3D11 run selected the actual **Intel UHD Graphics** adapter. A 1280×720 input-loop run recorded p50 approximately 16.7 ms, p95 approximately 16.8 ms, p99 approximately 33.3 ms across 1,800 samples. Exact latest values, viewport, drawing buffer, load time, draw calls, triangles, textures, geometry and errors are stored in the runtime JSON. Repeated test runs can differ due to other local browser activity. Startup samples include loading unless explicitly marked steady-state.

This is one machine and browser backend. No general 1080p60, weak-device30, human fun, two-device Internet stability or free deployed-account claim is made. Low graphics reduces drawing-buffer resolution while retaining the same materials and scene identity. No deployed performance or external networking evidence exists.

A separate final stationary courtyard sample (`scripts/performance.mjs`, `evidence/performance.json`) warms up before recording 12 seconds per setting. On Intel UHD/D3D11: 1920×1080 high had median16.7ms/p95 33.4ms/p99 33.4ms (599 frames); 1280×720 low, drawing buffer1088×612, had median16.7ms/p95 16.8ms/p99 16.8ms (720 frames). No page errors. An earlier overlapping-browser sample was discarded and rerun after other test browsers stopped. This supports only this local stationary scene; it does not meet or disprove every hardware/encounter acceptance target.

## Final extended checks

The extended solo loop passed in a fresh browser, including unskipped ordinary/signature playback, real save download, reset, file import and malformed JSON rejection. The isolated defeat/retry scenario passed through the entire input-driven path: seven free-attack guardian rounds ended in defeat without reward, and a fresh encounter restored full health and a new battle ID. Evidence: `solo-input-runtime.json`, `solo-defeat-retry.json`, `solo-final-video.webm`, `runtime-10-defeat.png` and `runtime-11-retry.png`.

A sequential second browser context once stalled while receiving the observatory asset before reaching gameplay. Its report is retained as `solo-full-and-startup-results.json`; it is not counted as defeat coverage. The same asset was served directly in45ms and the isolated fresh-browser scenario then passed. The cause remains unconfirmed. A separate automation race waited for a transient Skip button that had already disappeared through natural completion; the bounded input test now permits either route while checking identical committed state.

`final-motion-*` frames correspond to the final solo video. The earlier `motion-*` frames are development inspection, not the latest presentation. Both kinds are labelled by filename. Latest shared UI evidence is in `duo-ui.json` and `docs/duo-ui-testing.md`; it exercises actual game inputs without protocol injection. Shared committed state is available immediately, while target disappearance and the world-light change wait until presentation ends. Reconnect cancels local playback and restores the first snapshot directly.

The final duo run passed nine actual-input checks, including the same-client Reconnect button, fresh received snapshot, unchanged committed result and no cinematic replay. Solo full-loop and defeat/retry passed individually in fresh browsers; the retained combined report includes the startup stall described above and is not a clean two-test-suite result.
