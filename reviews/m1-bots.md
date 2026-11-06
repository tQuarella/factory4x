# Review: m1-bots

## Round 1 · 2026-11-06

Pillar fit: Good. The bots follow DESIGN.md H1 "Bot strategies (M1)" closely and use only `Input` commands. The report replaces win rate with capture time, as the no-fail-state decision requires. Real numbers at defaults: turtle captures at 9.7 min with 1 wave and 11 lost; rush captures at 25.3 min after 5 waves (4 repelled) with 72 lost. Both are close to the Designer's model, and no tuning was changed. Stubs are labelled. Missing a target is a flag, not a failure (acceptance 2). Nothing here changes how the game plays.

Quality: The code is clear and small, and the strategy tests run on hand-built worlds. But this is a gate, and three things in the runner either weaken it or make the report say false things. There is also one logic bug in the economy planner.

1. **The duplicate-seed shortcut weakens the gate, makes the report wrong, and saves nothing.** `runSeeds` copies seed 1's result into seeds 2..n when `world.rng` is untouched. `cli.ts` then skips the crash and softlock checks for those rows (`if (r.duplicateOfSeed !== undefined) continue;`). The copied `finalHash` is false: `rng` is part of world state, so the real seed 2 run ends at `05cc99dc`, but the report shows seed 1's `2c9baa0f` for seed 2. The shortcut also depends on the unstated rule that the seed only reaches `world.rng`. If a later change seeds anything else (map jitter, say), seeds 2..n would keep reporting seed 1's game and the gate would never run them. Running every seed for all four strategies takes about 0.4 s in total (measured), so the shortcut buys nothing.
2. **The softlock threshold is about 6 minutes, not 5, after a delivery.** Progress counts as `throughputPerMin(world) > 0`, which is a 60-second rolling sum. So the 5-minute countdown only starts once the window has drained, a full minute after the last delivery. I measured this: a turtle game whose economy I stalled by hand at tick 9000 reported softlock 358 game seconds later. Acceptance 3 says 5 game-minutes. The only softlock test (`idle`) covers a game with no deliveries ever, so it can't catch this. The case the redesign exists for (an economy that delivered, then stalled while probe mining continued) is untested.
3. **Turtle turns the shipyard on before the network is finished.** `nodeFinished` compares route capacity against `extractPerMin`, which counts *built* extractors. When a5's last extractor is committed but not yet built, a5 looks finished, so `plan.done` becomes true and turtle sends `setShipyard on` and `setRally a5` (tick 11177). When that extractor completes, a5 is unfinished again. Turtle turns the yard off, queues the upgrade (tick 11476), and turns it back on at 11477. At defaults no ship got built in that 300-tick window, but this contradicts "When the plan is done: setShipyard on" and depends on timing. Rush uses the same predicate, so it can also move on early.
4. **The report's spending figures cover the whole 30-minute run, not the run to capture.** Turtle shows "Built 362, Ore on ships 5445, Ore on economy 730", which says turtle spent 88% of its ore on ships. That inverts what turtle is. Nearly all of it comes after capture, while the bot builds out `rich` until the 30-minute cap. These figures go to the owner and the Designer for tuning, so they have to describe the run up to capture.

Smaller notes (not blocking):
- Rush's tick-0 order is extractor at tick 0 and route at tick 1. That is close enough to the spec.
- "Still rising at minute 10" is checked as throughput at 12 min > throughput at 10 min. For turtle the rise comes from building out `rich` after capture (capture at 9.7 min). The a1–a5 network had already levelled off near 148/min by about 6.5 min. That reading of the target is defensible, but the Designer should know about it. Log it in `DECISIONS.md`.
- The tick-budget failure path has no test. The logic is a single comparison, so I accept that.

Gates: I ran `npm run gates -- --base main` on `task/m1-bots` at 34682b9. Everything passed: typecheck, lint, test (99), determinism, bots (PASS, no flags) and protected-files. No protected files were touched.

Required changes:
- [ ] Remove the duplicate-seed shortcut (`runSeeds` copying, `duplicateOfSeed`, the `RunResult.usedRandomness` plumbing if nothing else uses it, and the Markdown line that describes copying). Every seed must actually run, and the crash, softlock and budget checks must apply to every seed's result.
- [ ] Make the softlock exact: the game is a softlock when no ore has been delivered by a route and no ship has been built for 5 game-minutes (±1 check interval), measured from the last delivery and not from when the 60 s window drained. Use the per-second delivery bucket or a cumulative counter you derive.
- [ ] Add a runner test for a mid-game stall: deliveries happen, then stop while probe mining continues and no ships are built. Assert `softlock` within `SOFTLOCK_SEC * tickRate` plus one check interval of the last delivery. Keep the existing never-started test.
- [ ] Fix `nodeFinished` (and therefore `buildPlan`) so a node is not finished while any committed extractor is still unbuilt. Add a strategy test: a5 with all slots committed but the last extractor still queued or active → `turtleDecide` does not turn the yard on or set rally to a5. Also confirm the full turtle game issues exactly one `setShipyard on` after its tick-0 `off`.
- [ ] Report ships built, ships lost and ore spent on ships vs economy as of capture (snapshot the values at `capturedTick`; for uncaptured games use the end of the run). You may also report whole-run totals, but they must be labelled as whole-run totals. Keep the rush-vs-turtle loss check on the at-capture numbers.
- [ ] Re-run the gates and paste the new bot summary table into the hand-back so the Director can see the corrected numbers.

VERDICT: REJECT

## Round 2 · 2026-11-06

This round reviews 013a21d against the round 1 required changes. I re-ran every check myself.

Pillar fit: No change from round 1. The strategies still follow the spec, and no tuning was changed. At-capture numbers at defaults: turtle captures at 9.8 min with 1 wave, 34 built, 11 lost, ore 525 on ships and 446 on economy. Rush captures at 25.3 min after 5 waves (4 repelled), 90 built, 72 lost, ore 1365 on ships and 139 on economy. Rush loses 6.5× the ships turtle does. No flags.

Required changes from round 1:
- [x] **Seed copying removed.** `runSeeds` now runs every seed, and `cli.ts` checks crash and softlock on every result. In `reports/bots-latest.json` each seed has its own `finalHash` (rush `f13f6c3f`, `dcd36992`, `1cbe24f5`, for example). A test asserts that the 3 hashes are distinct and that seed 2 matches a separate run. The whole suite takes 0.6 s.
- [x] **The softlock is exact.** Progress is now an increase in the per-second delivery bucket for the tick just run, or a ship built, checked every tick. I confirmed the indexing against `step.ts`: `stats()` runs before `world.tick += 1` and clears the next bucket before it is written. I repeated my stall experiment in a scratch script:
  - stall at tick 9000 → softlock 299.8 s later;
  - stall at 9017 → 299.2 s;
  - stall at 12345 → 299.3 s;
  - with pods left in flight, the last delivery was at tick 9083 and the softlock came at 18083, exactly 300 s later.

  Round 1 measured 358 s for the same stall.
- [x] **Mid-game stall test added.** The new runner test bounds the softlock tick between `STALL − 90 + limit` and `STALL + limit + 1`. The old 60-second window would fail that bound by 1800 ticks, so the test can actually fail. The never-started test is still there.
- [x] **`nodeFinished` waits for built extractors.** It now requires `extractors === extractorsCommitted`. A hand-built test (a5's last extractor active, then queued) shows turtle doesn't turn the yard on or rally. A full-game test asserts exactly two `setShipyard` inputs. My own 30-minute trace shows `0: off`, `11836: on`, `11836: rally a5`, and nothing else. Rush sends no toggles: the yard starts on and the rally starts at the probe.
- [x] **Figures are now at capture.** I took my own snapshot on the capture tick:
  - turtle (tick 17550): 34 built, 11 lost, 1 wave, 525 / 446;
  - rush (tick 45510): 90 built, 72 lost, 5 waves, 1365 / 139.

  Both match the report exactly. The 525 is 35 × 15, because the yard pays for a ship when it starts building it, so one ship was under construction at capture. That is consistent with the sim. `wavesRepelled` at capture is taken after the battle counter updates on the same tick. Whole-run totals are under `wholeRun` in the JSON, and the Markdown says so.
- [x] **Gates re-run.** The new summary table is above.

Regressions: none found. All of `npm run gates -- --base main` passes on 013a21d: typecheck, lint, test, determinism (`35d8f54c`, unchanged), bots (PASS, no flags) and protected-files (7 files, none protected). The stubs still time out without a softlock, because the default yard builds 25 ships from probe mining, and that counts as progress under the spec. Tick p95 is 0.0014 ms or less.

Housekeeping I did myself: the new `DECISIONS.md` entry heading had two raw Latin-1 `0xB7` bytes, which is invalid UTF-8 and shows as `�`. I rewrote them as UTF-8 `·`, matching the other headings. No wording changed. The entry also records the "rising at minute 10" reading I asked for.

Non-blocking notes for the Director (new backlog items if wanted, not conditions of this approval):
- "Peak ore/min" in the Markdown table is a whole-run figure: turtle 250, but 150 at capture. The JSON comment says so, but the column header doesn't.
- The Designer should confirm the "throughput still rising at minute 10" reading (see `DECISIONS.md`). Read strictly as the asteroid economy alone, turtle misses the target at defaults.

VERDICT: APPROVE
