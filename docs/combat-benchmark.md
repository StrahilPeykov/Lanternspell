# Controlled combat comparison

The original baseline remains unchanged when `createBattle` has no options. New solo visits and shared sessions provisionally use traditions with the full book. Development spellbook → Development comparison selects baseline/full book/seeded pages for the next encounter; the shared host selects the model, each seat selects its tradition. Old saves/sessions remain baseline until changed deliberately.

## Traditions

Marginweaver: Living Marginalia deals 4 immediate HP damage through ward and inscribes. Cut the Binding removes ward and also inscribes if anything was removed. Atlas Unbound consumes an inscription for its stronger main hit plus 5 to other foes. This rewards finding openings and choosing which target to unfold.

Hearthbinder: Kindling Stitch deals 3 damage and grants 6 self ward. Hearthlash Mantle grants 11 ward and a once-only 5-damage return when it absorbs an attack. The Lantern Wakes consumes up to 8 remaining caster ward as damage; protection becomes an offensive choice with a real cost. Excess healing can become up to 6 ward. Both traditions retain free attack, setup, signature, protection, disruption and recovery; same-tradition partners function without mandatory roles.

Ordinary stacking/expiry/retarget rules remain in battle-rules.md. Experimental wards use maximum, not addition. Counter triggers once on an absorbed hit, then clears; it expires with ward. Signatures consume the target inscription. Margin splash deals 5 damage to other living enemies, with ward absorbing damage normally. Unseal bonuses use the ward actually removed at that point in the ordered round, so two casts cannot claim the same ward. Support remains self-usable.

## State-driven intentions and seeded availability

Experimental enemies select visible intentions at the planning boundary and store them in the serializable battle. Plan editing never changes those intentions. Atlas priorities consider broken ward, low health, inscriptions, strong mage shelter and its previous intention. It can gather its rings or polish an inscription instead of attacking. The moth seeks the least-warded reader. These are fair disclosed rules, not reactions to a secret current plan.

The hand variant uses eight pages: two each of setup/signature/shelter, one disruption and one recovery. Four page slots plus the free spell are available. A fixed seed shuffles the cycle once; the opening includes setup. Playing a paid page replaces its used copy from the visible next-page cycle at resolution. Duplicates share a button, with all held copies listed. Since the September 11 refinement, the free Spark also turns the leftmost held page into that visible next page: remaining pages shift left and the new page enters at the right. This gives stranded hands a free way forward, while risking a useful leftmost page. No hit/critical randomness, manual discard or reshuffle system. Existing saved hands remain valid; the new rule applies on their next resolved attack.

## Evidence and provisional choice

`scripts/combat-benchmark.ts`, run by `tests/combat-benchmark.test.ts`, compares 330 deterministic policy/seed/fixture combinations. Opening, broken-ward and danger fixtures are labelled arrangements. Full output goes to ignored evidence/local; curated seed-17 openings are in evidence/combat-benchmark-summary.json. Scorers are diagnostic tools, not models of enjoyment or proof of optimal play. Policies differ from the first-playable diagnostic; compare this run's internal baseline instead of mixing tables.

Representative solo guardian openings, with learned annotation:

| Model/tradition | Strongest immediate damage | Setup policy | Defensive policy | Adaptive policy |
|---|---|---|---|---|
| Baseline | win 6 rounds, 2 HP | win 6, 2 HP | win 21, 27 HP | win 10, 36 HP |
| Book / Margin | win 6, 14 HP | win 5, 26 HP | win 5, 26 HP | win 7, 32 HP |
| Book / Hearth | win 8, 12 HP | win 10, 36 HP | win 14, 32 HP | win 7, 38 HP |
| Hand / Margin, seed 17 | win 5, 26 HP | defeat 8 | win 8, 14 HP | win 7, 14 HP |
| Hand / Hearth, seed 17 | win 10, 12 HP | defeat 9 | win 10, 28 HP | win 7, 38 HP |

Strong damage still wins many cases; full-book setup now has useful immediate value and a measurable advantage in some Margin states. Hearth trades pacing for protection. Naive identical duo setup wastes opportunities; coordinated adaptive choices preserve more health. Defensive Hearth can remain too slow. Do not hide these weaknesses with extra systems.

Actual-input solo runs completed both models and both traditions (evidence/benchmark-solo.json). Full-book Margin took 9 guardian rounds under that separate one-round UI policy, hand Margin 5, book Hearth 8. Those different policies and seeds are not a fair timing ranking. The controlled diagnostics above provide the fairer rules comparison.

Recommend full book provisionally for the normal chapter: it exposes each tradition's decisions clearly and lets a player deliberately test shelter/release and ward/setup interactions. The seeded hand creates adaptation and can break rote setup habits, but duplicate slots and unavailable recovery can create friction. Keep it in development for human comparison; automated wins do not establish which feels better.

The table above records the September 10 hand model, before free Spark could turn a page. The September 11 comparison and its limits are in [combat-refinement.md](combat-refinement.md); baseline and full-book diagnostic rows remain identical.
