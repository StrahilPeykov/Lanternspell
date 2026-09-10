# Benchmark shared choices and discovery

The SQLite Durable Object remains the authority for the same chapter. Battle resolution still uses the pure shared module, commits state/events/acknowledgement together, and never waits for presentation. Per-seat plan revisions, current joint-plan readiness, stale-round rejection, bounded command deduplication, and Hibernation WebSockets are unchanged.

## Client contract

`client.configure({ variant?, tradition? })` prepares the next encounter. Variants are `baseline`, `book`, and `hand`; traditions are `margin` and `hearth`. The host (`mage1`) alone selects the common variant. Either player selects only their own tradition. A guest request containing a variant is rejected atomically, even if it also contains a valid personal tradition. Configuration is allowed while the other seat is absent, but only when no battle is active. There is no account/loadout service or additional transport.

New campaigns start with `variant: 'book'` and `{mage1:'margin',mage2:'hearth'}`. Every snapshot includes `variant`, `traditions`, `configRevision`, and `facts: {echo:boolean}`. Configuration changes increment `configRevision` and clear encounter consent and readiness; identical settings do not disturb consent. `client.consent()` automatically binds consent to the latest configuration revision. A delayed consent from before a choice change is rejected rather than silently approving a different encounter setup.

Both consenting players start one battle with the campaign variant, each personal tradition, and deterministic seed `1729 + battleSerial` before incrementing the encounter serial. The first encounter therefore uses 1729. The resulting battle stores the seeded state through normal authority persistence; the server does not reseed on a plan edit or reconnect. This is a small reproducible benchmark, not a deck/account system.

`client.interact('echo')` records the optional magical discovery at (-10,10), after the NPC introduction, within the existing 5 m server interaction tolerance. It sets the one shared `facts.echo` boolean without changing required chapter stage or battle rewards. Repeated interaction is rejected. It requires both participants connected and no battle, as existing shared quest decisions do. The bounded fact object has no arbitrary user-supplied keys.

## Existing sessions

`hydrateCampaign` supplies additive v1 defaults whenever a Durable Object reconstructs. A pre-benchmark session missing a variant remains `baseline`; its existing battle, plans, revision, committed events, reward IDs and credentials are preserved. New optional facts default false. Migration does not replay results or award anything and is idempotent. Defaults become part of the durable payload with the next important accepted/rejected-command acknowledgement or disconnect checkpoint. Existing baseline consent without a configuration revision is accepted only at revision zero; after configuration changes, clients must review the new revision.

## Verification

`npx vitest run tests/network.test.ts tests/network-benchmark.test.ts` runs the focused existing authority invariants plus benchmark configuration/fact tests. The added tests explicitly arrange marker positions: they are protocol fixtures, not browser gameplay evidence. They cover ownership, concurrent personal choices, stale configuration consent, old-session migration, optional fact replay, and serialized reconstruction of book/hand state with simultaneous legal plans. A small 100-sequence property diagnostic checks configuration ownership and obsolete consent.

Real local two-game-client UI/rejoin and process-reconstruction checks are scheduled after integration, separately from hardware rendering measurements. Do not run browser/GPU tests concurrently with the lead's performance sampling. Put new temporary captures and logs in ignored `evidence/local/`; curate milestone evidence through the lead. No public deployment or paid service is authorized.
