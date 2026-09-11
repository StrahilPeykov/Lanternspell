# September 11 combat refinement

The current benchmark already contains distinct traditions, state-driven intentions, and full-book/seeded-hand experiments. This pass addresses a reproduced denial problem without adding spells or changing encounter tuning.

Previously, a seeded hand could remain unchanged forever when the player chose the free Spark. A player missing setup, disruption or recovery had to pay for an unwanted held spell to reach the next page. The seed-17 setup diagnostic stalled into six or seven consecutive free attacks and lost both solo tradition encounters.

In the hand experiment, Spark still deals 5 damage for zero Ember, but now turns the **leftmost held page** into the **visible next page**. The other three pages shift left; the new page enters at the right. Paid spells still replace only their used slot. Preview describes the outgoing and incoming page; resolution applies the same rotation once. Holding a useful leftmost page now creates a reason to spend a different page instead of attacking for free.

The eight-page cycle, four held slots, personal seeds, serializable format and authority API are unchanged. No discard control, random hit outcome, new resource, or enemy rule was added. Existing saved hands continue naturally. Original baseline and full-book rules are unchanged, including spell text outside the hand variant.

## Controlled comparison

Run `npx vitest run tests/battle-refinement.test.ts tests/battle-variants.test.ts tests/battle.test.ts tests/combat-benchmark.test.ts`. The September 11 run passed all 25 tests across these four files. The benchmark evaluates 330 deterministic policy/seed/arranged-state combinations. Before/after raw reports are ignored local evidence (`evidence/local/combat-refinement-before.json` and `evidence/local/combat-benchmark.json`). Of 330 rows, 78 changed, all in the hand variant. Every baseline and full-book row remained identical.

Across the hand model's 45 cases per diagnostic policy:

| Policy | Previous wins | Revised wins |
| --- | ---: | ---: |
| Spark only | 18 | 18 |
| Strongest immediate damage | 44 | 40 |
| Setup/exploit heuristic | 33 | 44 |
| Defensive heuristic | 45 | 45 |
| One-round adaptive joint search | 45 | 45 |

Seed-17 solo guardian with learned annotation:

| Tradition / policy | Previous outcome | Revised outcome |
| --- | --- | --- |
| Margin / setup | defeat, round 8 | win, 9 rounds, 2 HP |
| Hearth / setup | defeat, round 9 | win, 10 rounds, 18 HP |
| Margin / strongest | win, 5 rounds, 26 HP | unchanged |
| Hearth / strongest | win, 10 rounds, 12 HP | win, 8 rounds, 24 HP |
| Margin / adaptive | win, 7 rounds, 14 HP | unchanged |
| Hearth / adaptive | win, 7 rounds, 38 HP | unchanged |

Spark-only outcomes are unchanged because card rotation adds no damage or protection. Greedy immediate damage sometimes does worse because it turns away a useful page. The setup policy can now escape missing-page states. These are scripted diagnostics, not optimal play, human enjoyment evidence, or a guarantee that a badly timed free attack will be safe. Free turning is mandatory in this experiment, so the player must weigh damage/resource saving against losing the leftmost page.

New focused tests verify preview immutability and agreement with resolution; four-slot preservation; reachability of every paid role within eight free attacks across 100 seeds using labelled endurance fixtures; paid-slot replacement; and unchanged non-hand behavior. Existing arbitrary joint-plan property coverage still checks deterministic resolution, reversed submission order, serialization and resource bounds. Browser and real shared-authority evidence is recorded by the integrated benchmark, not inferred from these rule tests.

## Why no broad rebalance

The slow full-book Hearth setup/defensive policies automatically remove any enemy ward before considering a signature. Their long fights partly reflect that heuristic. Full-book adaptive Hearth already wins the representative opening in 7 rounds at 38 HP, compared with 8 rounds at 12 HP for immediate damage. Buffing the tradition solely to rescue the naive heuristic would obscure its existing ward-retention/release choice.

Full book remains the provisional normal-play recommendation. Human comparison should focus on whether losing a leftmost page makes the hand model satisfyingly deliberate or merely aggravating, and whether seeing exact immediate consequences makes full-book ward/setup choices clearer. The fixed cycle remains small and predictable; this pass does not claim to establish long-term deckbuilding depth.
