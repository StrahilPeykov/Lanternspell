# Battle rules, format 1

The simulation is pure TypeScript. A complete result and event list are computed before playback. Clients may skip, speed up, replay, or abandon animation without applying any state again. A finalized battle ignores further resolution calls. The network layer additionally deduplicates commands and commits quest rewards once.

Each living mage prepares one spell. Ember starts at 3, gains 2 at each new round, and caps at 7. Wick Spark costs zero, guaranteeing an available action. Plans must name a living mage, a known affordable spell, and a target on the correct team. Incomplete, duplicate, or invalid plans reject the whole round.

| Spell | Ember | Timing | Effect |
| --- | ---: | --- | --- |
| Wick Spark | 0 | Steady / 1 | 5 damage |
| Inkseed | 1 | Steady / 1 | 2 damage; inscribe through the end of round N+2 |
| Folded Sky | 4 | Grand / 2 | 9 damage, or 18 to an inscribed foe; consumes inscription. Discovered margin note adds 3 |
| Hearthveil | 2 | Swift / 0 | Self or living ally gains 11 ward through end of N+1 |
| Unstitch | 2 | Swift / 0 | Remove all target ward; 4 damage; halve its heavy attack this round |
| Mending Light | 3 | Swift / 0 | Restore 12 HP to self or living ally, capped at maximum |

Timing tiers resolve in ascending order. Mages precede enemies at equal timing. Stable actor IDs break remaining ties. Arrival time never determines order. Enemy intentions are visible during planning. The guardian alternates Brass Sweep (6), Pendulum Fall (12, slow tier 3), and Brass Rebinding (restore 4 ward, no attack). Moths attack at tier 2. Unstitch reduces Pendulum Fall to 6 before ward mitigation; it does not cancel ordinary attacks or future rounds.

Damage consumes ward before HP. Ward never stacks: protection refreshes to at least 11 and refreshes expiry. Enemy rebinding refreshes to at least 4. Healing cannot revive. Inscription never stacks: casting it again refreshes expiry. Folded Sky consumes inscription once even when ward absorbs the damage. No critical hits, misses, random draws, or cooldowns exist.

Expiry occurs at the start of the first round after the stated final round. An Inkseed cast in round 1 remains usable in rounds 2 and 3, supporting solo follow-up. Defeated actors lose their pending action. A spell whose target was defeated earlier redirects to the first living enemy in stable actor order; support aimed at a defeated ally redirects to its caster, then the first living mage. Full joint previews simulate these choices and expose `fallbackFrom`. No available hostile target ends combat immediately; unused friendly actions cost no Ember.

Solo and duo have distinct encounter data. Solo: one 38-HP mage, lesson moth 18 HP / 4 damage; guardian 36 HP with 8 ward. Duo: two 38-HP mages, lesson moth 28 HP; guardian 62 HP with 8 ward plus a 14-HP, 3-damage moth. Enemy attacks rotate deterministically between living mages. A surviving mage can complete a fight after the other falls; a disconnected required seat is handled separately by authority pause.

Reward emission occurs once on transition to victory. Lesson unlocks the path objective; the margin-note exploration reward upgrades Folded Sky. Guardian victory wakes the orrery. Defeat offers a fresh encounter without granting rewards. Personal color identity has no mechanical bonus. Ordinary setup/exploit interactions work identically with one or two participating players.
