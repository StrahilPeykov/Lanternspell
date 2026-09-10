# Resume / handoff

Project root: `C:/Users/20211107/Desktop/Lanternspell`. Branch: `codex/first-playable`.

Run `npm ci`, `npm run dev`; open http://127.0.0.1:5180. Another unrelated local app used 5173 at preflight, so this project intentionally uses 5180. Do not stop or modify that other app.

Production: `npm run build`, then `npx vite preview --host 127.0.0.1 --port 5181`. Tests: `npm test`, `npm run test:e2e`, `node tests/network-real.mjs`, `node tests/duo-ui.mjs`. Asset rebuild commands and required acquired Standard archives are in art.md. No Blender process is needed at runtime.

Development `window.__orrery` is an inspection-only snapshot: no state-setting functions. Debug fields include battle, stage, position, presentation, network timings and renderer diagnostics. Production omits it. Local saves use `orrery-solo-v1`, settings `orrery-settings-v1`, shared rejoin credentials `orrery-shared-seat-v1`. No automatic save merge occurs.

Blockers before external publication: explicit user authorization, read-only verification of the actual Cloudflare Free account/configuration and quotas, and a small public creation/retention abuse-control review. Keep workers_dev and preview_urls disabled until that authorization. No deployment commands have been run.

Creative follow-up: evaluate setup versus direct damage with humans; watch conservative defensive pacing (18 diagnostic rounds in one solo policy); refine foliage/painted surfaces and casting transitions; validate another physical device and browser. Do not expand scope into a full RPG.
