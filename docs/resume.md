# Resume / handoff

Root: `C:/Users/20211107/Desktop/Lanternspell`. Permanent branch **main**; direct commits and immediate pushes to origin/main are explicitly authorized. No branches, PRs, force pushes or paid services. Existing Cloudflare deployment repair was authorized and Workers Free verified on 2026-09-10. Commit `6fdf19c` deployed successfully; public WSS and host/join/reconnect UI checks passed. See docs/deployment.md for current settings and evidence. Two-device/country testing remains a human follow-up.

Launch: `npm ci`, `npm run dev`, http://127.0.0.1:5180. Do not stop unrelated projects. Production: `npm run build`, `npx vite preview --host 127.0.0.1 --port 5181`. The extra baseline comparison checkout under ignored tools/baseline is disposable diagnostic material, not a working branch.

Checks: `npm test` (43 unit/model/diagnostic tests), `npm run typecheck`, `npm run build`. Actual input: `node tests/benchmark-solo.mjs`, `node tests/benchmark-duo.mjs`, `node tests/signature-compare.mjs`. Real protocol: `node tests/network-real.mjs`; reconstruction commands remain in network.md. Production offline-after-load: `node tests/benchmark-production.mjs`. Run GPU tests sequentially and avoid competing recording workloads.

Normal new campaigns use full-book traditions; old data defaults baseline. Development comparison is in the spellbook. Margin/Hearth rules and diagnostic limits: combat-benchmark.md. Shared config/quest facts/migration: benchmark-network.md. Authoring and coordinate contracts: benchmark-art.md. Sound: audio.md. Renderer resource corrections and final evidence: benchmark-results.md.

Source boundaries: simulation/battle+traditions are pure; server owns durability/readiness. main is controller/dialogue glue; ui contains shell/combat markup; saves validates local import. render/environment builds repeated scenery, actors dresses the rig, effects owns disposable graphics, materials owns cached surfaces, world owns camera/render loop/load integration. No animation callback mutates gameplay.

Only curate milestone images and compact reports. New screenshots, videos and raw diagnostics go in evidence/local; no repeated .blend commits. Prettier is pinned project-locally for readable source. Old evidence and useful original .blend files remain unchanged in history.

Next human evaluation is the three focused comparisons in limitations.md. Do not add Chapter 2 to avoid resolving remaining pacing or visual weaknesses.

Performance retest after competing browser recording is paused: set `$env:PERF_OUTPUT='evidence/local/clean-performance.json'`, run `node scripts/benchmark-performance.mjs`, then clear that environment variable. Keep the renderer identity and view/buffer metadata; do not replace the bad late samples without explaining the changed conditions. Original source for the late A/B came from cd7b1c5 in ignored tools/baseline; its5184 server is stopped.
