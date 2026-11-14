# h7-bots review

## Round 1 · 2026-11-14

Reviewed `git diff task/h7-raids...task/h7-bots` (head 5c35948, which merges h7-raids at c46e2b5) against DESIGN.md H7 "Bots (H7): strategies" and the BACKLOG h7-bots acceptance.

**Gates (run by me on 5c35948, `npm run gates -- --base main`):**
- typecheck, lint, determinism (df9ea7c5) and protected-files pass.
- The test gate fails with 15 failures, only in `packages/client/test/{h4-client,h5-client,h6-client,session}.test.ts`, which are h7-client's. The bots tests are all green, including the retired campaign tests on `withRunMode(…, 'campaign')`.
- The bots gate fails: every run of every strategy times out at 45:00, including adaptive and greedy on all 3 seeds.

The stack note allows a red bots gate here, to be judged on h7-design-data, so the red gate alone is not the issue. The issue is why it is red. I traced the runs, and two of the reasons are defects in the bots, not in the v12 data. Calibration exists to tune data so that competent bots meet the targets. If the bots are broken, h7-design-data would retune the field around bot bugs, which distorts the game the owner plays.

**What I found (scratch traces, adaptive and adaptive-no-raids on shipped v12, seed 1):**

1. **adaptive's economy fills the fleet limit during raids.** Branch 2 in `AdaptiveBot.decide` (answering a raid) applies `economyWeights(world, this.offence)` but never calls `limitEconomy`. In offence the lean weights are 1/1, so every muster, flight and fight re-opens the economy.
   - The trace shows econ go from 15 to 22 during the raid at ticks 23220 to 23669, then reach 27 of the 30-ship limit by tick 27000.
   - From then on there are 3 warship slots. The bot sits with every weight at 0 from about tick 36000 to the cap, with 226 to 1298 ore and up to 528 ice unspent.
   - Raids hit 16 of 20 times and it lost 50 economy ships.
   - adaptive is a gate winner, so this alone makes the gate unwinnable for reasons calibration shouldn't paper over.
2. **adaptive dead-ends instead of acting.** adaptive-no-raids takes p1 at about tick 13400 (econ 13, 7 drones). It then keeps every weight at 0 for the remaining 35 game minutes, while ore climbs to 2727 and ice to 452.
   - The hive plan (19) doesn't fit the room (30 − 13 = 17).
   - The raid-window plan can't happen with raids off, and its drone+flak mix doesn't fit either.
   - Nothing in the bot can open room: it never recycles economy ships and never takes the other pocket.
   - The same failure mode, "no plan fits, so idle forever", is what adaptive falls into in finding 1.
   - A control is allowed to lose. A bot that stops playing with resources piling up is not a meaningful A/B, and flag 1 ("adaptive takes the hive") becomes a measure of this bug.
3. **The gate ignores most of the static sweep.** `cli.ts` passes only `bestOf(runs)` per seed to `fieldGateFailures`, so a crash or a tick-p95 breach in any other shape never fails the gate. Acceptance 3 says the gate fails on "a crash of any strategy".
4. **greedy can build warships before its first hit.** `GreedyBot`'s inner bot latches offence once every open slot has an extractor, whether or not it has been hit. In offence, branch 3 takes the counter pocket and branch 4 builds for the hive.
   - Acceptance 2 says greedy switches to adaptive's rules "only after its first hit raid".
   - DECISIONS says greedy has "no response, no counter pocket" until the hit, which the code contradicts.
   - On v12 the first hit (tick 6573) comes before the slots fill, so no warship was built first. But a calibration that delays raids, such as a higher `raid.firstAtEcon`, would expose it.

**What's good:**
- The runner's outcomes (won, timeout, softlock, crash) are each tested, including a forced softlock.
- The estimate really is the existing `minMix`/`minSingle` on an inert copy, with a test that it matches.
- Flag 4 removes a full-size raid from the hive at home.
- The static shapes are fixed in code and printed in the report.
- The report has every requested column.
- The campaign bots' retirement from the gate is logged.
- The runs are deterministic, with no RNG and no wall clock in decisions; `performance.now` is used only for timing.

**Non-blocking notes:**
- The bots read `world.raid`, `world.field` and the guard lists directly rather than through `raidStatus`, `allocStatus` and the other selectors. The data is player-visible, and DECISIONS says so, but the spec says "the selectors". Prefer the selectors when you touch these lines.
- On v12, flag 4 is MISSED (14 vs 19 is a 26% cut, not 30%) and flags 1 and 2 miss because adaptive and greedy time out. Flags 4 and 5 to 7 are data questions for h7-design-data. Flags 1 and 2 can't be judged until findings 1 and 2 are fixed.

**Required changes:**
- [ ] In offence, every branch of `AdaptiveBot.decide` that sets economy weights applies the trade-in-slots limit, the raid-response branch included. Add a test: adaptive in offence, with a muster in progress and econ + margin + the smallest hive wave above the limit, sets extractor and hauler weights to 0.
- [ ] adaptive (and its variants) never sits with every weight at 0 and a growing stockpile while the hive is guarded and no plan fits. Give it a legal step towards a win and log the choice in DECISIONS:
  - for example, recycle economy ships down to the room its smallest hive plan needs (`recycleShips` with economy counts is a player input);
  - or, if you judge that this departs from the spec's adaptive, raise it with the Director instead of shipping the dead end.

  Add a test that reproduces the adaptive-no-raids dead end (offence latched, plan doesn't fit, stock growing) and shows the bot acts.
- [ ] Every `static` sweep run counts towards the gate's crash and tick-p95 checks, not just the best shape. Add a test with a crashing non-best shape.
- [ ] greedy builds no warships and takes no pocket until its first hit, even when every open slot is filled first. Add a test with a raid threshold above greedy's full economy, or with raids off, showing no warship weight and no send before a hit. Make DECISIONS match the code.
- [ ] Re-run the bots suite on v12. In your report, give adaptive's and greedy's econ, warships and stock at 15, 30 and 45 minutes, so the next round can see whether a remaining timeout is a data question (for h7-design-data) or still a bot one. The gate may stay red on v12.

VERDICT: REJECT
