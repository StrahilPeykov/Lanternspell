# The Sleeping Orrery

A small original wizard-adventure chapter at Bellweather College. Built with TypeScript, vanilla Three.js, Vite and DOM UI. The technical package name remains `wizard-adventure-prototype`.

## Play locally

Requires Node 22.14+ and npm. From this folder:

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5180**. The server includes a real local SQLite-backed Cloudflare Durable Object. Solo runs in the browser and needs no game server after code and assets load. No paid service, runtime AI, or account login is used.

WASD moves relative to the camera. Drag the world to orbit, scroll to zoom, R recenters, E interacts, J opens the spellbook. During battle, choose a spell card and a target, then confirm. Settings include remapping, camera sensitivity, reduced camera motion, low graphics, mute, and solo save export/import.

For shared play, choose **♧ → Start a shared visit** and copy its private invitation. Open it in a second browser profile/incognito window and choose Join. Both mages must be connected for shared progression and consent to encounters. Use the friend menu to rejoin a saved seat. Invitations are single-use; never share a seat credential. Localhost links work on this computer only. Internet play has not been published or verified.

## Build and verify

```powershell
npm test
npm run typecheck
npm run build
npx vite preview --host 127.0.0.1 --port 5181
```

With that production preview running, `node tests/production-smoke.mjs` checks solo interaction after disconnecting browser networking.

With the development server on 5180:

```powershell
npm run test:e2e
node tests/network-real.mjs
node tests/duo-ui.mjs
```

Playwright uses bundled Chromium. If missing, run `npx playwright install chromium`. The local Windows gameplay tests request D3D11; other systems should choose their available graphics backend and record the renderer. See [testing evidence](docs/testing.md), [network checks](docs/network.md), and [resume notes](docs/resume.md).

## Scope and provenance

One courtyard, a brief keeper conversation, a seed-lantern, two encounters, six prepared spells, a discoverable modification, two personal colors and a changed observatory. The 5–10 minute chapter length is a design target, not a measured human-play result. Art remains simpler than the concept target.

The wizard incorporates verified CC0 Quaternius Standard assets with original costume additions. Architecture, spell geometry, surface washes and synthesized sounds are original to this project. Editable Blender sources and scripts are preserved. See [asset manifest](docs/asset-manifest.md) and [art notes](docs/art.md).

Cloudflare configuration is prepared locally, with publication disabled. **Do not run deployment yet.** Actual account Free settings, public session-creation abuse controls, and explicit publication authorization are still required. No external resources were created.
