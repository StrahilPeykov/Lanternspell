# Network lifecycle review — 2026-09-11

The existing deterministic rules, per-seat plan revisions, joint readiness key,
SQLite commit-before-presentation, and hibernating WebSockets remain appropriate.
This review did not replace those contracts or introduce TURN. Both clients talk
to the authority; they do not establish a direct WebRTC connection.

## Confirmed fixes

- **Leaving shared play could deliver stale callbacks into solo.**
  `SharedClient.close()` kept its socket identity, allowing a queued receive
  handler (particularly the development delayed handler), close, or error to
  update the controller after switching to solo or creating another client.
  Permanent close now invalidates the identity before closing and clears pending
  actions/movement. Current transport loss also invalidates delayed receive work.
  Reconnect preserves important retry IDs but resets movement bookkeeping; old
  open/error/close handlers cannot act on the new transport.
- **A replaced socket's delayed close could erase fresh readiness.** The server
  unconditionally cleared readiness and consent for every socket close. A late
  close from the replaced connection therefore affected the already rejoined
  seat. Replacement now clears old readiness/consent before accepting its new
  connection. Subsequent old closes do not clear newly reviewed readiness while a
  live same-seat replacement exists. Actual required-participant loss still
  clears both readiness and encounter consent. Committed results are retained.

`tests/network-lifecycle.test.ts` uses explicitly labelled transport/storage
fixtures for these event-order regressions. The replacement handshake fixture
does not establish a real HTTP upgrade. Root integration owns the real local
two-client and process-reconstruction runs; fixture tests are not internet or
two-device evidence. No rule or battle commit ordering changed.

## Focused integration checks

1. Ready one player, replace the other seat's live connection, ensure readiness
   is cleared before reconfirming, and ensure a late old close cannot clear the
   replacement's new confirmation.
2. Disconnect before a second ready, verify pause; rejoin and review the same
   plans. Disconnect after commit and ensure revision/reward IDs do not change.
3. With development receipt delay, leave shared play for solo while a snapshot
   is queued; solo must retain its own state and must not show a shared-loss
   toast. Reconnect still retries important commands using their original IDs.

Existing real protocol tests already cover simultaneous plans, stale-ready and
old-round rejection, duplicate IDs, before/after-commit reconnect, and a legal
teaching victory. Full chapter duo UI runs are separate evidence. The restart script now honors `EVIDENCE_FILE` in both branches, preserving historical evidence during this pass.

## Publication control during this assignment

Before this run the dashboard automatically built and deployed `main`; package
scripts alone did not disable that external trigger. Root reports changing both
dashboard production/version deploy commands to `npx wrangler deploy --dry-run`
for this assignment. This keeps required pushes from publishing new versions.
Do not restore publishing without explicit authorization.

A repository fallback could refuse a build when `WORKERS_CI=1`, the documented
[Workers Builds environment marker](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).
That is unnecessary while the dashboard dry-run control is verified, and would
make each Cloudflare check intentionally fail. It would also not cancel an
already running old-commit deployment or block direct manual Wrangler commands.
There was no `.github/workflows` directory at audit start; lightweight checks may
be added independently without deployment credentials or deploy steps.

No browser, GPU, public endpoint, paid service, credential file, dashboard, or Git
mutation was used by this audit. Only the named source/tests and this review were
edited; the lead owns integration and evidence claims.

## Bunched movement regression

The first integrated duo recording stopped at the lantern because the 65ms arrival gate lost final walking positions. A real Node WebSocket/DO probe reproduced eight 0.4m positions arriving together: only the first survived. The server now consumes cumulative distance credit (initial0.7m, cap5m, refill7m/s) for all ordered updates; the existing30-message/s ceiling remains. Movement attachments survive hibernation and ordinary movement still makes no SQLite writes. The same real probe accepts the final position and rejects a subsequent over5m jump. Run `node tests/network-movement-real.mjs`; it is a local protocol burst, not renderer, UI, geographic latency or packet-loss evidence.
