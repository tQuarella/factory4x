# h10-bots review

## Round 1 · 2026-11-17

Reviewed `task/h10-bots` at 5f56994 (stacked on `task/h10-sim` at 98fbf86) against:
- BACKLOG.md "### h10-bots";
- DESIGN.md "Bots (H10)" and "Calibration targets (H10)";
- DECISIONS.md "2026-11-17 · Director · H10 spec rulings".

**Pillar fit.**
- The shipped rule keys are still 0. The old strategies play exactly as on v16, which I verified independently (below).
- The two new strategies are report-only controls. They measure the H10 claim, that attrition pays and a lost push isn't wasted, without changing what the player sees.
- The sweep gives h10-design-data a real starting point. On seed 1, targets 1–4 and 6 hold at 450, 600 and 750, and target 5 holds.

**Gates (my own run, `npm run gates -- --base main`): all PASS.**

| Gate | Time |
| --- | --- |
| typecheck | 6.7 s |
| lint | 3.9 s |
| test | 52.8 s |
| determinism | 0.7 s |
| bots | 80.9 s |
| protected-files (54 files changed, none protected) | 0.5 s |

**Identical at 0, verified by me.** I compared this run's `reports/bots-latest.json` with `reports/archive/h9-design-data-v16-bots.json`.
- All 24 archived results match by strategy, seed and variant, leaving out timings, `finalHash` and the two new fields (`hive`, `raidRolls`).
- `failures`, `flags`, `h9Lines`, `staticSweep` and `sweep` are equal.
- The six one-push and two-push rows are the only additions.

**Acceptance.**
1. **Change 1: met.**
   - `guardsOnArrival` reads `hiveAfter(world, flight)` at the hive and the guards now at a pocket.
   - It feeds `hiveAtLanding`, and through it `hiveWave`, the attack and the raid-window path. It also feeds `smallestHiveWave`, and so `limitEconomy`'s reserve, and the static bot.
   - Each use is tested on a world with a deficit at `hive.rebuildTicks` 600, with the queue 10 ticks from its next guard.
   - **Reading, accepted, and flagged to the Director:** at `hive.rebuildTicks` 0 the allowance is off. `hiveAfter` there would add R9's regrowth, which changes adaptive and undefended against the v16 archive. The acceptance says the decisions at 0 must match H9's, and the only effect is that the 0-period comparison is exactly H9's bot. If h10-design-data ever compares a v18 value against 0, the report should say that the bot at 0 doesn't count R9's in-flight regrowth.
2. **one-push and two-push: met.**
   - Both are registered and report-only, with descriptions from the spec.
   - one-push: ships covering the weakened hive stay home (adaptive sends the same ships), one ship short of W doesn't go, and W goes.
   - two-push: `twoThirds` is unit-tested, with ceil, floors and the remainder to the counter type. It waits one ship short and sends exactly the 2W/3 mix. It stays in `two-push` while the wave flies, and plays adaptive (live sizing) once no ship is at the hive or heading there.
3. **The no-plan-fits table: met.** Each cell has a test, and DECISIONS.md lists them. One test is misnamed; see required change 2.
4. **Report: met.**
   - Per run: lost to raids and to pushes, home/cap at the winning landing, events before the win, `raidRolls`, and the win time against adaptive.
   - Adaptive's guards per minute are reported.
   - The sweep section is behind `--sweep`, outside the gate. That is acceptable for a report-only section, and the probe report is committed as `reports/archive/h10-bots-v17-sweep.{json,md}`.
   - The runner's hive columns are checked against `fieldSummary` over a whole adaptive run at 600: the push kills sum to `lostToPushes`, and only the last push wins.
5. **Lines 1–6 read REPORTED: met.** They are never in `failures`.
6. **Gates green: met. Bots gate time before and after: NOT met.**
   - DECISIONS.md's h10-bots entry gives no bots gate time and no account of the growth.
   - My measurements on this machine: 74.5 s on `task/h10-sim` at ff91ae5, and 80.9 s here.
   - one-push and two-push take about 11 s of runs across 3 seeds (38.0 → 48.0 s in the runner's log).
   - So the growth is within the new runs' cost, but the acceptance asks the builder to report it.

**Determinism.** This change is bots-only, with no sim change. The decisions are integer, and `flightTicks` takes the integer ceiling as the sim does. The determinism final is unchanged (3b20982a). `generatedAt` uses the wall clock only in the report header, as before.

**Quality.** The code is clear and follows the existing `AdaptiveBot` structure. The `sizing` getter and the three-state `push` field are minimal. Problems in the tests:
- `h10-bots.test.ts` line 259, "adaptive, with a weakened hive and no raid, sizes the next wave for the weaker hive". The title says "it sends the smaller wave", but the test places no ships and asserts that nothing is sent. It ends with `void parkedWarships; void hiveWave;`, which exists only to silence imports the file doesn't use.
- Line 76, in the "at hive.rebuildTicks 0" test: `g.regrowProgress = { thorn: g.regrowProgress.thorn, spore: g.regrowProgress.spore };` is a no-op.

**Non-blocking.** `runField` records a push only when it sees a battle at the hive after a step. A battle that starts and captures in the same tick would be missed, and `winLanding` would then read "no winning push". The whole-run test would catch it as a mismatch with `lostToPushes`, and the shipped runs don't hit it. Worth a guard on a later touch.

Required changes:
1. Add the bots gate time before and after to the h10-bots entry in DECISIONS.md (acceptance 6). Give the time on `task/h10-sim` and on this branch, measured on one machine, and the share that is one-push's and two-push's runs.
2. In `packages/bots/test/h10-bots.test.ts`, the "adaptive, with a weakened hive…" test must test what its title says, or its title must change to match what it tests:
   - If you keep the title: place the live wave's ships and assert that adaptive sends that wave, smaller than the full-caps wave.
   - Either way: remove `void parkedWarships; void hiveWave;` and the imports they silence.
3. Remove the no-op `g.regrowProgress = …` line in the "at hive.rebuildTicks 0" test.

VERDICT: REJECT
