# Review: cw-flaky-test

## Round 1 · 2026-11-07

Change (735a1ce): `vitest.config.ts` sets `testTimeout` and `hookTimeout` to 30 s (default 5 s), with a comment explaining why. No other file changes. `vitest.config.ts` is not protected.

Pillar fit: tooling only. No sim, data, client or gameplay change, so nothing reaches the player and there is no owner question.

Finding the flaky test (acceptance: "find it ... and make it deterministic"): the author's commit doesn't name the failing test, so I checked the hypothesis myself instead of taking it on trust.
- Every test is pure and deterministic. A grep of `packages/*/test` finds no `Date.now`, `performance.now`, timers, `Math.random`, env reads, ports or shared temp files. The only wall-clock dependency in the `test` gate is Vitest's per-test timeout, so a failure that goes away on rerun and comes with a slow run (28.5 s against 10–14 s) points to a timeout.
- Per-test durations (JSON reporter, unloaded, 181 tests): the slowest are `runner.test.ts > runs every seed as its own game` (0.51 s) and `raid-supply.test.ts > cuts the Root, then captures the Bloom, on knotted, deep and thin` (0.50 s). Everything else is under 0.27 s.
- **Reproduced:** with 48 CPU burners on this 16-core machine, `vitest run --testTimeout=5000` (the old config) failed. Exactly those two tests reported `Test timed out in 5000ms` (run took 78 s). Under the same load, the branch config passed 181/181 twice (80 s and 55 s wall). That load is heavier than the incident's (28.5 s). So the failure mode is identified, matches the incident's symptom, and the fix holds well beyond the observed load.

The tests themselves were already deterministic. The one non-deterministic input was the 5 s wall-clock limit, and raising it is the correct fix. Rewriting the tests would not help.

Does it weaken the gate? No. No test asserts on elapsed time, so every check is unchanged. The timeout only bounds a hang, and a hang still fails at 30 s. The bot games are tick-capped (`TICKS_30_MIN`), so a hang there would be a code bug that the 30 s bound still catches. A global setting is simpler than per-test overrides on the two bot tests and covers future whole-game tests. That's acceptable.

Determinism / data / phone: not applicable (no sim, data or UI change). Reference replay and bots gates unchanged and passing.

Quality: the comment is accurate and says why. One nit, not blocking: it says "~2 s with a dozen suites in parallel", but I measured ≤0.5 s unloaded on this machine. It is a rough figure from a different load, and harmless.

Gates (run myself on 735a1ce, Windows 11, Node 26, after `npm ci`): `npm run gates -- --base main` passed every gate: typecheck 3.7 s, lint 1.9 s, test 2.3 s (181/181), determinism 0.5 s, bots 1.2 s, protected-files 0.5 s (1 changed file, none protected). Main has moved since the branch point (998d1f5 → ab31453), but only in docs (QUESTIONS.md, STATUS.md etc.). `vitest.config.ts` is untouched there, so the merge is clean.

Non-blocking note for the Director (a new backlog item, not a condition of this approval): the incident was hard to diagnose because `reports/gates-latest.json` records only pass/fail and seconds. Storing the tail of a failing gate's output there would have named these two tests the first time. That change is in `scripts/gates/` (protected), so it would need owner approval.

Required changes: none.

VERDICT: APPROVE
