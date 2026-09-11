# First-five-minutes refinement — 11 September 2026

Foundation: ae70c4b, Sleeping Orrery 0.2. No new chapter, tradition, spell, backend service or public deployment. Work is direct to main; Cloudflare build publication remains held with dry-run commands.

## What changed

- Title now offers Begin, Continue when a valid save exists, and secondary shared play. Color/tradition selection no longer precedes movement. First Iona dialogue is a short equipment-related request. The lamp responds directly to interaction.
- Movement hint disappears on demonstrated movement; a brief sprint hint appears later. Both are local preferences. No permanent control manual. Interaction buttons no longer rebuild every 150 ms, fixing interrupted clicks. Title modals now render above the title.
- New full-book practice shows basic → setup → signature choices across the opening rounds, with a relevant highlight. All spells is an explicit opt-out. This changes disclosure, not legal server plans. Existing saves/experienced profiles retain full choices. The field book introduces the reversible tradition choice after practice. Shared players keep their personal traditions and consent.
- Full-book solo practice moth is 24 HP (was 18). Basic 5 + Margin setup 4 leaves 15 HP, so the marked signature's 18 damage matters; its unmarked 9 would not finish. Baseline/seeded-page experiments and duo tuning are unchanged. No fake tutorial damage or animation authority.
- Detailed forecast is collapsible and remembered locally. The shared joint queue remains visible before confirmation. Help is revisitable in the spellbook. The Atlas introduces ward removal with a short contextual sentence.
- Snappy movement + Gentle Follow are provisional defaults. Shift sprint uses the exact free Standard non-root-motion Sprint clip, adjusted footstep cadence, faster follow and remote gait. Three movement and three camera profiles were compared using five combinations; see [traversal.md](traversal.md). Manual input has priority; brief reverse does not flip yaw; reduced motion disables auto-yaw. Scene-specific facade pull-in handles the reproduced wall issue. No jump physics was added.
- Equipment trolley, gloves, practical room/loan signs, a repaired bench, plaster patches and an actual kettle give ordinary purpose to the courtyard. Flowers are less dense. One 512px sign atlas is shared and static geometry is batched. Existing GLB architecture remains authoritative.

## Writing decisions

[writing-style.md](writing-style.md) separates UI, NPC and exceptional lore registers and retains the verified references. Removed the title's light/memory aphorism, the lantern's two-paragraph preamble, Iona's repeated directions and poetic job title, the margin-note constellation/promise quotation, lyrical victory/defeat headings, and ornate enemy intention explanations. Fixed inconsistent signature names in reward copy and replaced references to an unavailable “Unstitch” name with plain disruption guidance. Kept Bellweather, Paper Moth, Drowsing Atlas and personal spell names. The sealed archive has one concrete strange image; ordinary notices stay ordinary.

## Evidence and limits

Curated runtime images: [courtyard](../evidence/ftue-courtyard.png), [practice payoff choice](../evidence/ftue-practice.png). Both are browser screenshots, not concepts. Compact results: [ftue-refinement.json](../evidence/ftue-refinement.json). Raw captures and five motion videos remain ignored under evidence/local.

- 68 unit/property tests in 11 files pass; typecheck and production build pass.
- Fresh skimming journey passes on development and the production build: actual input, no debug reads/mutations, no save fixtures, no voluntary spellbook opening, natural playback; 1 → 2 → 3 cards, victory and field-book choice. This is a regression path, not human comprehension evidence.
- Both full-book traditions complete the solo chapter through actual controls, optional discovery, signature playback/skip, reward and save reload. Diagnostic policy: lesson 3 rounds each; guardian Margin 9, Hearth 8. It selects via detached rule snapshots; it is not a fresh-player or fun study.
- Mixed Margin/Hearth duo completes on the real local SQLite Durable Object with two independent browser contexts: lesson 2 rounds, guardian 6. Actual host/join, movement/sprint relay, local dialogue, shared consent, concurrent planning, edit-after-ready, repeated Enter, skip, reward and fresh-page/same-client rejoin pass. Remote inferred speed reached 6.23 m/s while local sprint remained capped at 6; interpolation can catch up. No movement correction occurred.
- Built-client offline-after-load movement/NPC/spellbook smoke passes. Production local protocol passes 25 commands, including stale/repeated confirmations, live seat replacement and disconnect before/after commit. No WebSocket mocking. The protocol driver now waits for the reconnecting client's own snapshot, fixing a reproduced test race. Process reconstruction was not repeated in this refinement; historical evidence remains labelled in the earlier report.
- No actual two-device/international test this pass. No paid services or public publication.

### Hardware guardrail

Headless Chromium with actual **ANGLE Intel UHD Graphics 0x9BC4 / Direct3D11**. Same machine and stationary 12-second courtyard method as the earlier September 11 result; not a randomized paired hardware study. High: viewport/buffer 1920×1080. Low: viewport 1280×720, buffer 1088×612, existing shadow tier retained.

| Tier | Before median / p95 / p99 ms | After median / p95 / p99 ms | Draw calls before → after |
|---|---|---|---|
| High | 33.4 / 66.7 / 83.3 | 33.3 / 66.6 / 66.8 | 140 → 141 |
| Low | 16.7 / 16.8 / 33.4 | 16.7 / 16.8 / 16.8 | 112 → 113 |

GPU geometry/texture counts: 61/80 → 62/81. High submitted triangles including shadows: 294,466 → 289,338; Low 232,935 → 226,487. Asset-ready time was 2.12 s in one local run; not a cold-network loading distribution. No substantial Low regression observed. High still does not meet reliable 1080p60; do not generalize to untested hardware or combat worst cases.

## Remaining uncertainty / blind human test

The held-world-heading convention during automatic yaw needs human feedback. Sustained reverse can still produce an unwanted view change; reduced motion disables it. Foliage can briefly occlude the mage, and the small facade solver is not general camera collision. Practice remains optional rather than forcibly constraining an experienced player's choices. The exact spell names may still be harder to retain than the actions themselves. Automated completion cannot settle these questions.

Open the local game in a fresh/private browser window. Play for five minutes without this document or coaching. Afterwards: where were you unsure what to do, and what text did you skip? What did the mark change, and when did the traditions make sense? Did movement or camera ever fight you? Which line or object felt artificial or overly cute? A second person can use the same test without being told the intended sequence.
