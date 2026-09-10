# Battle diagnostics, September 10 2026

These deterministic policies diagnose rules and tuning; they are not claims about human enjoyment. Reproduce using `npx vitest run tests/battle.test.ts --silent=false --reporter=verbose`. The same file runs invariant/property tests over 150 generated action sequences (up to 40 rounds each), seed 9182026. A seed reproduces this covered sample, not untested combinations.

The policies use the discovered +3 Folded Sky modification and target the first living enemy. Basic always uses Wick Spark. Strongest uses Folded Sky whenever affordable, otherwise Spark. Setup prioritizes removing ward, exploiting a present seed, placing a missing seed, then Spark. Defensive uses the setup policy but heals at 22 HP or lower, and shelters before a heavy strike at 18 HP or lower if healing is unavailable. Duo diagnostic players independently use the same policy, intentionally exposing redundant planning. A separate test proves same-round Inkseed → Folded Sky has the same 18 damage as a solo follow-up, with no participant-count bonus.

States: opening is the actual guardian opening. Heavy is a labelled fixture starting at round 2 with full initial resources and health, for testing changed priorities. Vulnerable is a labelled fixture with guardian HP 26, zero ward, an inscription through round 3. These fixtures do not represent playthrough evidence.

| Mode / state | Basic | Strongest affordable | Setup / exploit | Defensive |
| --- | --- | --- | --- | --- |
| Solo opening | Defeat R7 | Win R6, 2 HP | Win R6, 2 HP | Win R18, 20 HP |
| Solo heavy | Defeat R7 | Win in 7 rounds, 2 HP | Win in 6 rounds, 14 HP | Win in 7 rounds, 20 HP |
| Solo vulnerable | Win R6, 2 HP | Win R2, 32 HP | Win R2, 32 HP | Win R2, 32 HP |
| Duo opening | Win R10, 0/8 HP | Win R6, 26/11 HP | Win R8, 8/11 HP | Win R10, 32/32 HP |
| Duo heavy | Defeat in 9 rounds | Win in 6 rounds, 17/14 HP | Win in 8 rounds, 17/14 HP | Win in 10 rounds, 29/26 HP |
| Duo vulnerable | Win R5, 29/17 HP | Win R3, 29/35 HP | Win R3, 29/35 HP | Win R3, 29/35 HP |

Earlier opening values (solo guardian 54 HP, sweep 8 / heavy 17, rebinding 8) defeated all four solo policies, including defense. The shipped draft lowers solo HP to 36, sweep/heavy to 6/12, and rebinding to 4. Duo retains an additional weak moth and 62 guardian HP rather than doubling solo HP. This makes two different offensive policies viable without forcing a specific spell.

Remaining design questions: opening setup currently ties brute-force affordable casts in solo, while disruption matters more before the heavy strike. Independent identical duo setup wastes inscriptions, as intended; the UI must make partner intent clear enough to avoid that trap. Conservative healing can prolong a solo fight to 18 rounds, longer than the intended brisk experience. A human timing/playability pass should evaluate this pacing before adding mechanics or changing resource rules. The normal mixed sequence can finish in six rounds; no claim of fun or optimality follows from these measurements.

Current narrow verification: all 12 battle tests pass and project TypeScript typecheck passed when executed at this checkpoint. Network delivery, animation duration, real input, and renderer performance are separate integration evidence owned by the lead.
