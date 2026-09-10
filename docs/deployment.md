# Cloudflare deployment

2026-09-10: the owner requested repair of the existing Lanternspell Workers deployment and cross-network shared play. The signed-in account's Workers plans page showed **Free / Current plan** before any deployment change. Keep that plan; no paid services, billing changes, TURN, or new providers are required.

## Build settings

Existing Worker: `lanternspell`, repository `StrahilPeykov/Lanternspell`, production branch `main`, root `/`.

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Keep the committed lockfile and the platform's `npm ci` dependency install.

The original failure ran Wrangler immediately after dependency installation. With the Cloudflare Vite integration, `vite build` generates `dist/client`, `dist/lanternspell/wrangler.json` (including the correct assets directory), and `.wrangler/deploy/config.json`. Wrangler follows that generated configuration. Do not add `public/` as the assets directory: it omits the built application. Do not commit `dist` or the local redirect file. Source configuration must match the existing Worker name and enable `workers_dev` for its public address.

Locally, `npm run deploy:check` builds and performs a Wrangler dry run without publishing. `npm run deploy` builds before publishing and is reserved for authorized deployments after confirming the account remains Free. Dashboard build settings are external settings, not controlled by these package scripts.

## Shared play

The browser opens HTTPS and WSS connections to the same hostname. One SQLite Durable Object per campaign owns shared decisions; both players can use different countries/networks without a direct browser-to-browser connection. TURN serves WebRTC peer connections, which this game does not create. Ruinweavers uses a different, browser-hosted WebRTC architecture.

New campaign creation has a best-effort limit of six requests per minute per public IP per Cloudflare location. Existing plans, movement, and rejoin do not use that limiter. This anonymous prototype has no user-account identity; users behind a shared public IP share the creation allowance. This is a small abuse deterrent, not a global quota or comprehensive public-service protection. Campaigns remain durable and do not silently expire. Storage cleanup and large-scale abuse protection remain future work; Free plan limits stop operations rather than enabling paid overages.

## Verification boundaries

Local repair checks: all 43 unit/model tests passed; TypeScript + Vite production build + Wrangler dry run passed with 21 packaged asset files, the Campaign binding, and the creation limiter. The real local production protocol check passed all 23 commands. A bounded local HTTP check returned six successful creations followed by HTTP 429 with `Retry-After: 60`.

Use `GAME_URL=https://lanternspell.strahil-peykov.workers.dev` and a new `EVIDENCE_FILE` when running `node tests/network-real.mjs`. It uses real browser WSS connections and protocol commands, not mocked sockets or gameplay UI. Two browsers on one computer against the public endpoint are still not a two-device, two-country test. The normal friend menu supplies the private single-use invitation for that later human check.

Official references checked 2026-09-10: [Vite build/deploy](https://developers.cloudflare.com/workers/vite-plugin/get-started/), [Workers Builds settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [Durable Objects Free plan](https://developers.cloudflare.com/durable-objects/platform/pricing/), [rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [TURN purpose/pricing](https://developers.cloudflare.com/realtime/turn/).
