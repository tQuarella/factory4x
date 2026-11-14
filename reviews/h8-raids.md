# h8-raids review

## Round 1 · 2026-11-14

I reviewed 3af6c0e, the one h8-raids commit, stacked on `task/h8-sim`. Its base includes h8-sim's approving review commit 0b72251. I checked it against DESIGN.md H8 H9 ("Shield") and H10 ("Haulers hold"), R6–R8, and the BACKLOG h8-raids acceptance.

**Pillar fit.** This is the "warships shield the economy" half of the H8 claim. Under H9, a warship standing at the target makes the economy safe. Under H10, haulers stop flying into a raid. Both sit behind their own 0/1 switch, and at 0 each is H7 exactly. Nothing player-facing goes beyond the spec. No data value changed.

**Gates (run by me on 3af6c0e, `npm run gates -- --base main`): all PASS.**
- typecheck, lint, and protected-files (37 files, none protected).
- test: 47 files, 1019 tests.
- determinism: 30 checkpoints over 9000 ticks, final f9325835.
- bots: adaptive and greedy win, and flags 1–7 are MET. Flag 2 reads "greedy first hit killed 2", the answer h8-design-data needs.

**Acceptance.**
1. **H9: met.** `fight` passes no economy ships to `guardStrike` when `raid.shieldEcon` is 1 and some warship is `at` the target at the round. So every pool's overflow is lost, and the warships are counted from the same start-of-round list R7 already uses. Tests:
   - a round with one warship strikes it only, with the overflow lost;
   - the next round strikes the hauler, then the extractor;
   - a warship arriving between rounds counts from the next round;
   - a warship at another node doesn't shield;
   - both pools lose their overflow;
   - a standing defence keeps the economy safe every round;
   - at 0 the same fight kills the hauler and then the extractor.

   `raids.test.ts` (the v12 fixture, both keys 0) passes with only the new `holding: 0` field added to its exact-shape check.
2. **H10: met.** `haulersHeld` is true for `raid.target` from `out` to `world.raid === null`, not during `muster`, and only with `raid.haulersHold` 1. The tests cover:
   - at the probe, the hauler stays through `out`, `fight` and `home`;
   - at the node it loads a partial cargo, or an empty one, and leaves;
   - flying out, it finishes its leg, then loads and leaves;
   - it resumes after a beaten, hit or turned-back raid, and after a withered one;
   - the target stays mined, and the R6 retarget moves the hold to the new target;
   - muster doesn't hold;
   - at 0, the hauler flies into the raid.
3. **Selectors: met.** `rockStatus.raidTarget` (muster to end), `haulersHeld`, and `raidStatus.holding` are each tested at none, muster, out, fight, home, and after the end, plus the case with hold 0.
4. **Replay: met.** It adds a lone Drone at p1 for raid 2, with the raiders' damage raised for one round. The test pins round 4290: the Drone falls, `lostEcon` is 0 and the extractor stands. Round 4320 then kills the extractor with no warship there. That is exactly "economy ships survive while a warship stands, then die after it falls".

   It also covers the held haulers: none leaves for p1 from raid 2's launch to its end, the `holding` peak is above 0, and they leave within a tick of the end. The hashes are re-baselined.

   The 8440 Flak recycle restores h8-sim's 1-ship-fallback premise without weakening it. The a4 pick moving to 8750 comes from the hold, which DECISIONS.md measured on the unchanged script. The a4 load assertion now accepts the first load by any hauler; it keeps "after the dock, cargo 2", and the waiting assertions for the first picked hauler are unchanged. Neither is a loosening.
5. **Numbers reported (DECISIONS.md):** the full-economy raid at adaptive's peak is 7 planned (peak economy 17). Greedy's first hit under H10 kills 2 extractors on all three seeds.

**Spec calls, judged:**
- **The hold lasts through `home`.** This is R8's literal "raid ends" (`world.raid = null`), so it is the spec as written. It does mean haulers wait while the raiders fly home. That's a few seconds at 1x, and the client shows "Haulers waiting at the probe" during it. **Director:** worth watching in the owner's session, given success criterion 1 ("extra haulers sitting around"). It isn't a reason to deviate from the spec now.
- **A warship landing on the round tick counts** (R7's existing reading). **A held hauler arriving on a round tick can be struck if no warship stands** (the spec's "finishes its leg"). Both are logged and consistent.

**Determinism.** `haulersHeld`, `isRaidTargetNode` and `haulersHolding` are pure reads. The shield reuses the existing id-ordered lists. There is no new state, RNG or clock.

**Files outside the list.** All are minimal and logged:
- the `selectors.ts` import, plus two doc comments next to the permitted lines;
- `raids.test.ts`, which gains the new field;
- `h8-haulers.test.ts`, where the opening-curve test sets `raid.haulersHold` 0 because it compares hauler rules, not the hold. Its pinned numbers are unchanged, and `data-h8.test.ts`'s shipped-data opening check still runs with the hold on and passes.

**Code quality.** Clear and small, and comments cite the rule.

Small point, not required: the test "a warship that arrives after a round started does not shield that round" only shows that nothing is struck on a non-round tick. Its name promises more than it checks. The test before it covers the real case, so rename or drop it when convenient.

Required changes: none.

VERDICT: APPROVE

## Round 2 · 2026-11-14

I reviewed def6c5f against round 1. Two things changed since round 1: the Director's H10 amendment (ec04b17, DESIGN.md and DECISIONS.md) and its implementation (def6c5f).

**The change.** `haulersHeld` is now true only in phases `out` and `fight`. The hold ends on the tick the outcome is decided:
- beaten or withered: the raid ends;
- hit or turned back: `goHome` switches the phase to `home`.

`rockStatus.raidTarget` still runs from muster to the raid's end, so the badge stays while the raiders fly home. That is correct under "Raid-target badge: from muster to the raid's end". During `home` the raiders don't fight (R7 runs only in `fight`), so a hauler that leaves then is not at risk. This answers my round-1 note, and the Director logged it with its reason.

**Tests.**
- `raids-h8.test.ts` steps each outcome one tick at a time until the hold drops. For hit and turned back, it asserts the raid is still in `home` with `lastRaid` null, so the hold didn't wait for the raiders to land. For beaten and withered, it asserts the raid has ended.
- A new test shows that in `home` a hauler at the probe leaves the next tick, `haulersHeld` is false, `raidTarget` is true and `holding` is 0.
- The selector test now checks `home` separately.
- The replay pins raid 2's outcome at tick 4350, 215 ticks before the raiders land. p1's haulers leave within a tick of it.
- With the shorter hold, h8-sim's original a4 assertions come back exactly: the first pick at 8720, and that hauler is the first to load. So round 1's two re-baselines are reverted, not carried.

**Gates (run by me on def6c5f, `npm run gates -- --base main`): all PASS.**
- typecheck, lint, and protected-files (38 files, none protected).
- test: 47 files, 1020 tests.
- determinism: final cdbdea56.
- bots: flags 1–7 MET, and flag 2 is still "greedy first hit killed 2".

**Director, needs fixing (not in h8-raids' files): the DESIGN.md amendment is in the wrong section.** ec04b17 put the line "*Amended (Director, 2026-11-14):* the hold ends on the tick the raid's outcome is decided …" in the client section, between "Fallback: tap-Move-tap" and "Hauler count (rock sheet)" (about line 764). "H10. Haulers hold" (about line 681) still reads "From launch (phase `out`) until the raid ends". Anyone reading H10 gets the old rule, and the tap-Move-tap section gains an unrelated line. Move the line under H10, or reword H10, before h8-client builds the "Haulers waiting at the probe" line. The code, tests and DECISIONS.md all agree on the amended rule, so this is a spec-text fix, not a defect in this task.

Everything else from round 1 stands.

Required changes (h8-raids): none.

VERDICT: APPROVE
