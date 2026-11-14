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

## Round 2 · 2026-11-14

Reviewed `git diff a186071..a61cba3`.

**Director decision accepted.** The rule for a dead end (take the other pocket first, else recycle economy ships down to `raid.firstAtEcon`) is the Director's, and DECISIONS.md logs it. I judge the code against it.

**Gates (run by me on a61cba3, `npm run gates -- --base main`):**
- typecheck, lint, determinism (df9ea7c5), protected-files and **bots** pass.
- The test gate fails with 15 failures, only in h7-client's 4 client files (`h4-client`, `h5-client`, `h6-client`, `session`).

Runs on v12:
- adaptive wins in 19:01 (8 raids: 6 beaten, 1 hit; 4 economy ships lost).
- greedy wins in 19:49, inside the 15–30 minute pace target.
- Flags 1, 2, 3, 5, 6 and 7 are met. Flag 4 (14 vs 19) is h7-design-data's.

**Round 1 required changes:**
- [x] The trade in slots now ends every offence branch through `finish`, the raid response included. The new test covers a muster in progress.
- [ ] **Not met:** "adaptive (and its variants) never sits with every weight at 0 and a growing stockpile while the hive is guarded and no plan fits." Details below.
- [x] Every static shape counts for the gate's crash and tick-p95 checks (`gateRuns`). There is a test for a crash in a shape that isn't the best.
- [x] greedy is economy only until its first hit, then a fresh adaptive. Tested with raids off; DECISIONS matches the code.
- [x] Re-run done. adaptive and greedy now win on v12.

**Defect 1: the pocket assault sends a wounded ship in place of a sound one.**
- `pocketAssault` checks `covers(fit, mix.fleet)` with `fit = soundShips(world, stage)`, which counts only ships at half hp or more. It then sends `sendInput(stage, node, mix.fleet)` by counts.
- `sendShips` takes the lowest-id ships of each type, so a wounded ship with a low id goes and a sound one stays behind.
- Traced on shipped v12, adaptive-no-raids, seed 1. At tick 16879 it sends 15 drones from the probe to p2, with a drone at hp 2 among them, and one sound drone stays at the probe. The min-wave was 15 sound drones. The wave loses: p2 keeps 6 guards, and 16 drones are lost over the run.
- `recycleUnfit` would scrap the wounded ship only when the fleet is full, which it wasn't here.
- The hive attack doesn't have this problem, because it sends `here` (everything parked).

**Defect 2: the same run then dead-ends again.** After the failed wave, p2's `wavesSent` is 1, and the raised drone wave no longer fits the room (30 − 13 = 17), so `pocketAssault` returns null.
- Then `recycleStep` checks the smallest hive wave with drone and flak only (Lancer is still locked). That wave plus the floor of 6 is over the cap, so it returns null as well.
- From then on, ticks 18000 to 81000: every weight is 0, there are 2 drones, ore grows from 27 to 2547 and ice to 452, and the run times out.
- The Director's rule recycles only to fit the hive wave. Nothing recycles to fit the pocket wave that step (a) chose, so (a) to (b) has a gap.
- adaptive-no-raids is a report-only control, but it is the in-build A/B for `raid.enabled`. A run that idles for 35 minutes reports "no raids can't win", which is false and would mislead h7-design-data and the owner's A/B question.
- The new dead-end tests pass on constructed worlds. The shipped-data run still takes this path.

**Non-blocking:** `drones-only` times out as a control should (flag 5). I didn't check whether it also idles, because its loss is the expected result.

**Required changes:**
- [ ] A pocket wave sends the ships the estimate counted:
  - either send every ship parked at the stage, as the hive attack does;
  - or recycle or hold back wounded ships first, so the lowest-id ships that `sendShips` takes are sound.

  Add a test: a wounded lowest-id drone at the stage plus exactly the min-wave of sound drones; the wave that leaves contains at least the min-wave of sound drones, and it takes the pocket.
- [ ] When step (a) has chosen a pocket, the recycle step also makes room for that pocket's (raised) wave, down to the same floor. Then a failed pocket wave can't strand the bot. If this goes beyond the Director's rule as written, say so in DECISIONS.md.
- [ ] Add a test on the v12 fixture that plays `adaptive-no-raids` and `adaptive` to the cap or the win. Assert that neither spends 5 or more game minutes in a row with every weight at 0, the hive guarded, and `stock.ore` at or above the cheapest warship's cost.
- [ ] Re-run the gates. adaptive and greedy must still win on v12. Report adaptive-no-raids' outcome.

PROCESS.md: this is h7-bots' **second rejection**. Under PROCESS step 2, the Director reassigns round 3 to the Core Engineer (resume one if available), or logs a DECISIONS.md entry for keeping the original engineer. A third rejection parks the task.

VERDICT: REJECT

## Round 3 · 2026-11-14

Reviewed `git diff 488b4f9..ce6d659`. Under the deadlock rule (PROCESS step 2), the Director reassigned this round to the core-engineer.

**Director decision accepted.** Recycling may also free room for a pocket wave that is the plan, down to the same `raid.firstAtEcon` floor (DECISIONS.md, ed97343). I judge the code against it.

**Round 2 required changes:**
- [x] **Pocket waves send exactly the sound ships the estimate counted (`exactSend`).**
  - For each type it walks the parked ships in id order. It sends each run of sound ships, and recycles a wounded ship that would come next, which is by then the lowest id left.
  - All the orders go out in one tick, so they make one wave.
  - I checked the logic against `sendShips`' lowest-id rule and the in-tick input order, and it holds.
  - Tests cover a wounded lowest-id drone, a wounded drone between sound ones, the same case for `static`, and no send while the sound ships at the stage don't cover the wave.
  - The hive attack still sends everything parked.
- [x] **Recycling now also frees room for a pocket wave that is the plan.** It only happens in offence, with economy counted against the fleet limit, when the wave plus the floor fits, and never below the floor. A test covers it.
  - The engineer also found that a wave already in flight raised `wavesSent`, so the bot re-planned and recycled mid-flight. A pocket with a wave on the way, or a battle there, now counts as committed. That's a sound fix, and it's logged.
- [x] **No-idle invariant tests on the v12 fixture.** adaptive and adaptive-no-raids each play to the win or the cap. The tests assert no 5-minute stretch with every weight at 0, the hive guarded and ore for a warship. There is also a greedy win test.
- [x] **Re-run done.**

**My verification.** I re-ran my round 2 trace of adaptive-no-raids on shipped v12, seed 1. It now takes p1, p2 and the hive. Round 2 had a 35-minute idle with 2,547 ore.

**Gates (run by me on ce6d659, `npm run gates -- --base main`):**
- typecheck, lint, determinism (df9ea7c5), protected-files and **bots** pass.
- The test gate fails with 15 failures, only in h7-client's 4 client files (`h4-client`, `h5-client`, `h6-client`, `session`), as the stack expects.
- The bots report:

| Strategy | Result on v12 | Raids | Economy ships lost |
| --- | --- | --- | --- |
| adaptive | wins in 19:00 | 8: 6 beaten, 1 hit | 4 |
| greedy | wins in 19:49 | 9: 7 beaten, 1 hit | 6 |
| adaptive-no-raids | wins in 14:37 | none (raids off) | 0 |
| idle | times out (control) | none mustered | 0 |
| drones-only | times out (control) | 21: 19 beaten, 2 hit | 6 |
| static (best shape) | times out (control) | most of its raids hit | 21 of 34 built |

- Flags 1, 2, 3, 5, 6 and 7 are met. Flag 4 (14 vs 19, a 26% cut against 30%) is a data question for h7-design-data.

**Code quality.**
- `recycleEconToward` is now shared between the hive and the pocket, so the rule lives in one place.
- `onTick` is a read-only observer, and it doesn't change runs: the bots' hashes and outcomes are unchanged for the winners.
- Determinism is intact: integer arithmetic, id-ordered walks, no RNG.

**Non-blocking.** `static` now recycles wounded drones before a pocket wave. Its weights still never change, so it remains a fixed-allocation control.

Required changes: none. Note that this is the third round, but it is an approval, so PROCESS step 3 (parking) does not apply. h7-design-data can stack on this branch.

VERDICT: APPROVE
