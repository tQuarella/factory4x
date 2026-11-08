# Review: h3-bots

## Round 1 · 2026-11-07

Reviewed `e0a2997` against `main`, in a separate detached worktree. I ran `npm ci`, then `npm run gates -- --base main`, then `npm run bots -- --seeds 6`.

Scope: six files change, all in `packages/bots/src/{strategies,runner,cli}.ts` and `packages/bots/test/**`, which is exactly the task's file list. Nothing changes in `packages/sim`, `data/`, the reference replay, the determinism baselines or any protected file.

Pillar fit: this is tooling only. It does not change how the game plays or feels. It produces the evidence that h3-design-data needs to test the "no single order dominates" hypothesis.

Spec conformance (DESIGN.md H3 "Bot checks"):
- **The four strategies** share one engine, `decideH3(world, { counters, door })`.
  - `drones-only` runs only the drone yard. Its yard loop wants `t === 'drone'` only.
  - `ice-first` and `crystal-first` take the light pocket with that prize first. `firstDoor` picks the living pocket with fewer than 3 slots and that prize. Nothing is unlocked before the first pocket, so the door is taken with drones. After that they follow the greedy rule.
  - Flak and lancer come on through `unlockStatus().ships`, which in the sim is `flak: ice delivered` and `lancer: crystal delivered`. That matches "turns on flak, and turns on lancer when crystal arrives".
  - `greedy` turns on every unlocked yard and always takes `nextTarget`.
  - Tests show that each door strategy's first capture has the right prize in all three layouts, and that the flak and lancer yards stay off until their resource has been delivered.
- **Shared rules:**
  - Rally is at a5.
  - After a capture, `buildPlan` over the captured nodes in capture order (Root excluded) builds extractors up to the slots, a route, and upgrades up to max level. That is 2 upgrades at the current max level, so it fits "up to 2".
  - Next target is the lowest `need / prizeWeight`, compared by integer cross-multiplication. Prize weights are 3/2/2/1, and the heart comes only when it is last.
  - `need = Σ cap × hp`. Power is `Σ n × dmg × weightedMult / 100`.
  - The attack condition is `power × 3 × 4^k ≥ (need + 20) × 5^k`.
  - All unlocked yards stay on.
  - The estimator and threshold code was already reviewed in h3-sim and is unchanged here, apart from the rename.
- **Report:** the per-strategy table shows, for every seed, heart time, capture order with times, ships lost by type, waves sent and repelled, and the first ice and crystal delivery. The per-layout comparison table is present. Ore is the starting resource, so leaving its first-delivery time out is fine.
- **Each seed is its own game:** `runGame` creates a fresh world per seed. Seeds cycle through glass, twin and frost. With `--seeds 6`, seeds 4–6 reproduce seeds 1–3 exactly, which is expected because the sim has no RNG. The flags read the lowest seed per layout (`layoutRows`, which has a test).
- **Depth flags:** I checked each by hand against the report.
  - Flag 1 uses an inclusive 15–45 min window. 14:58 is correctly counted as outside.
  - Flag 2 compares drones-only with the best of the other three, taking the best on each metric separately. This is the stricter reading of "the best strategy" and I accept it. The 140% and 120% thresholds are integer and exact at the boundary, with tests.
  - Flag 3 measures the 15% gap against the faster time.
  - Flag 4 counts a tie as its own result.
  - Flag 5 compares the greedy capture order as node ids.
  - Flag 6 mirrors the determinism gate (replay hashed twice) and also replays greedy seed 1 to its final hash.
  - All six are only report lines. They append to `flags` and never to `failures`, so the gate exit code depends only on crash, softlock and tick budget.
- **Numbers (reported, not retuned):** flags 2–6 are MET and flag 1 is MISSED. All 12 games end too early: drones-only takes 14:58–15:42 and the others 11:59–12:32, against a 15–45 min window. This is the pace problem already handed to h3-design-data (b).

Notes for h3-design-data (not required here):
- Flag 4 holds only by small margins: twin is ice 12:10 vs crystal 12:13, and frost is crystal by 17 s. It will flip easily under retuning.
- Flag 2 currently holds on capture time alone. On losses, drones-only loses 27–28 against a best of 22, which is about 25% more and short of the 40%.
- No wave was repelled in any game, so the 5/4 back-off never fires in practice.
- `greedy` plays the same game as `ice-first` on frost and twin, and as `crystal-first` on glass. That is expected, since greedy's first pick is a light pocket.

Quality: the code is clear and small, with no needless abstraction. `flags.test.ts` tests each flag at its exact boundaries and checks that every report line carries its numbers. `runner.test.ts` plays all four strategies to the heart in all three layouts. Minor items, not blocking:
- `cli.ts` keeps a stale comment, "the H3 flags land with h3-bots".
- The throughput table reads seed 1 (glass) only and doesn't say so. This predates this task.
- Flag 2 treats a drones-only game that never captures as "not later". Flag 1 would still report that case.

Determinism: the change is bots-only. Strategies are pure functions of the world, with no wall clock and no RNG. The determinism gate and flag 6 both pass, and the reference replay is untouched.

Data: no tunables were added and `data/` is unchanged. Phone: no UI change.

Gates: all pass on my run.

| Gate | Result | Time |
| --- | --- | --- |
| typecheck | PASS | 4.4 s |
| lint | PASS | 2.3 s |
| test | PASS | 12.0 s |
| determinism | PASS | 0.7 s |
| bots | PASS | 6.7 s |
| protected-files | PASS | 0.5 s |

On the bot gate: there were no crashes or softlocks, the worst tick p95 was about 0.004 ms against a 2 ms budget, and the 6-seed run also passes.

Required changes:
- None.

VERDICT: APPROVE
