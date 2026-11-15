# h8-bots review

## Round 1 · 2026-11-14

I reviewed 8157c0a (`git diff task/h8-raids...task/h8-bots`: 87062ac, 821155a and 8157c0a, plus merges). The branch carries h8-sim's approval (0b72251) and h8-raids' approval (d45cca3). I checked it against DESIGN.md "Bots (H8)", the no-plan-fits table, "Inherited assumptions", and the BACKLOG h8-bots acceptance.

**Pillar fit.** Bots are measurement, not player-facing. The changes keep the strategies modelling a sensible player under H4 and H10, and the report gives h8-design-data what it needs. One change goes against a written acceptance criterion; see required change 1.

**Gates (run by me on 8157c0a, `npm run gates -- --base main`): all PASS.**
- typecheck, lint, and protected-files (45 files, none protected).
- test: 48 files, 1046 tests.
- determinism: final cdbdea56, unchanged.
- bots: adaptive wins at 15:53 and greedy at 15:45, and flags 1–7 are MET. Flag 1 holds: static's best shape doesn't take the hive and loses 15 of 29. Flag 2 holds narrowly: greedy's first hit kills exactly 2.

**Acceptance.**
1. **Bot changes 1–3, each with a unit test: not met.**
   - **Change 1:** `economyWeights` keeps the Hauler weight on while any rock is short. Good.
   - But at the fleet limit, `limitEconomy` still sets Hauler to 0 while an asteroid is short, unless `economy + max(smallest wave, waveTotal) < cap`. It also sets it to 0 while economy ships are being recycled toward a wave, except for a taken pocket with 0 haulers.
   - The acceptance says "Change 1 **never** sets the Hauler weight to 0 while a rock has a shortfall". The spec says "The taken-pocket hauler rule becomes 'any rock with a shortfall'".
   - The test "the hauler weight is not 0 while a rock has a shortfall … except at the fleet limit or while economy ships are being recycled" pins the deviation, with a tolerance of under 120 s (traced at 84 s).
   - The reason given, thrash at the limit (build a hauler, recycle it, build it again), is plausible and may well be better bot play. But it contradicts a written acceptance criterion and the spec, so it is the Director's call, not the engineer's. See required change 1.
   - **Change 2:** the `Backstops` latch ("after the economy has once had 2") and the release at `raid.firstAtEcon − 1` are tested on wiped worlds for adaptive, greedy and drones-only, with static and idle unmoved. But greedy has a handoff hole; see required change 2.
   - **Change 3:** tested, including the spec's state (haulers `enough`, every warship weight 0, ore piling up), the hold-and-release, drones-only getting only Drones, and idle exempt. Reading "no bay starts" as "no bay running" is reasonable and logged.
2. **No-plan-fits table: met.** Each cell is tested or shown in the trace. drones-only now keeps building Drones to the limit, as the table says; its ore piles up only with the fleet full, which is the control. The whole-run tests show that adaptive and greedy never sit 3 minutes with ore for a warship, room under the limit and no bay running. Their longest stretches are 0.43 and 0.16 minutes.
3. **The report: mostly met.**
   - It has idle haulers (peak, and minutes with more than 1), backed-up seconds with the target met, economy lost under a guard, the trace, and "What no bot exercises".
   - But "economy ships lost while a warship stood at the target … **must be 0** when `raid.shieldEcon` is 1" is reported and never checked. The test "raid.shieldEcon is reported, not asserted here" only checks `typeof … === 'number'`, which is padding.
   - The report text still says "(0 once raid.shieldEcon 1 is wired by h8-raids)", but h8-raids is merged on this branch. See required change 3.
4. **The seven flags: met.** They are reported as in H7, and flag 1 has no finding.
5. **Gates: met.** The bots gate is green even on v14.

**Determinism.** Bots only, with no RNG or clock. `Backstops` state lives in the bot's closure, as the existing bots' state does. The runner's `Map` (`runs`) is keyed by node id and read per key, never iterated.

**Code quality.** Mostly clear. `recycleEconToward` now sets `shrinking` before the `RECYCLE_EVERY` check, so the flag holds between orders. That is subtle but correct, and commented.

There is a small cleanup item: `h8-bots.test.ts` imports `weightInputs` without using it, and silences the lint with `void weightInputs;` on its last line. Remove both.

**Required changes:**
1. **Change 1 at the fleet limit.** Do one of these:
   - (a) implement the spec as written: in `limitEconomy`, Hauler is 1 whenever any rock has a shortfall, including while recycling toward a wave; or
   - (b) get a Director ruling that amends change 1 to "except at the fleet limit, where an asteroid shortfall gets a hauler only if the wave being built still fits, and none while economy ships are recycled toward a wave". It must be written into DESIGN.md "Bots (H8)" and DECISIONS.md, and the acceptance read against it.

   Either way, the whole-run test must pin the rule exactly: zero Hauler-0-with-shortfall ticks outside the stated exception, not "under 120 s".
2. **Greedy's handoff loses the wipe latch.** `GreedyBot` builds `new AdaptiveBot(...)` on the first hit, with a fresh `Backstops` whose `hadEcon` is false. `raids.hit` ticks up only when that raid ends. So if the first hit takes the economy below 2, which is exactly the wipe change 2 exists for, the new inner bot never latches `recovering`, and greedy doesn't recover. Carry greedy's `Backstops`, or at least its latch, into the inner bot. Add a test: greedy's first hit wipes the economy, and greedy then sets Extractor and Hauler to their start weights until econ reaches `raid.firstAtEcon − 1`.
3. **Assert the shield.** Replace the `typeof` test with an assertion that `econLostGuarded` is 0 in every whole run on v14, where `raid.shieldEcon` ships at 1, at least for adaptive and greedy. Fix the report's stale parenthesis.
4. Remove the unused `weightInputs` import and `void weightInputs;` from `h8-bots.test.ts`.

VERDICT: REJECT

## Round 2 · 2026-11-15

I reviewed 03252eb against round 1. Since a068a4c, the Director has amended change 1 (a5a4a6d, in DESIGN.md "Bots (H8)" and DECISIONS.md), and the fix commit 03252eb landed on top of it.

**Gates (run by me on 03252eb, `npm run gates -- --base main`): all PASS.**
- typecheck, lint and protected-files (46 files, none protected).
- test: 48 files, 1047 tests.
- determinism: final cdbdea56.
- bots: adaptive wins at 15:53 and greedy at 15:45, as before. All seven flags are MET. The suite takes about 107 s, against 80 s before h8-bots; the CI gates job limit is 20 minutes.

**Required changes from round 1:**
1. **Change 1: met under the Director's amendment.** DESIGN.md now gives exactly two exceptions: (a) an asteroid shortfall at the limit when economy plus the wave being built doesn't fit, and (b) while recycling toward a wave, except a taken pocket with no hauler.
   - The bot records why its final Hauler weight is 0 with a shortfall (`haulerBlock`).
   - The whole-run test wraps adaptive and greedy and checks, on the world each decision saw, that every such tick meets its exception's own condition:
     - (a) needs no pocket shortfall and load ≥ `field.fleetCap`;
     - (b) needs no bare taken pocket.
   - An unexplained tick counts as a failure, and the count must be exactly 0. That replaces "under 120 s".
   - It also asserts the exceptions are actually exercised in adaptive's run, so the check can't pass empty.
   - `blockLoad` is reported by the bot itself, but the test compares it to the tunable, not to the bot's own threshold. That is enough to catch a regression in the rule.
2. **Greedy's handoff: met.** The inner AdaptiveBot takes greedy's `Backstops`. The new test wipes the economy on the tick of the first hit and shows greedy holding Extractor and Hauler at their start weights until econ reaches `raid.firstAtEcon − 1`.
3. **Shield asserted: met.** `econLostGuarded` is 0 for adaptive and greedy over whole v14 runs, and the test checks first that `raid.shieldEcon` ships at 1. The report text is fixed.
4. **Unused import: met.**

**Also changed:** the bot's `haulerShortfall` now reads `haulerTarget` and the hauler assignments directly, instead of building a `rockStatus` per rock. It gives the same numbers and runs faster. The report was regenerated with the same results.

**Director, for headroom:** the bots gate has grown by about 25 s with h8-bots' per-tick metrics. That is fine against the 20-minute job, but keep an eye on it.

Required changes: none.

VERDICT: APPROVE
