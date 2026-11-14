# h8-sim review

## Round 1 · 2026-11-14

Reviewed `git diff main...task/h8-sim` at 0246e00 (9 commits from 0291294). I checked it against DESIGN.md "H8 (Milestone 2, iteration 8, spec ready): Hold the front", including the H1 amendment, the Director's rulings in DECISIONS.md (140553c: committed extractors, waiting haulers, no surplus extractors), and the BACKLOG h8-sim acceptance.

**Pillar fit.** This is the engine for the H8 claim, "the economy staffs itself". It covers need-based targets, the pick by shortfall, rebalance at home, no surplus haulers and the per-rock count, plus the fleet orders that the drag sits on. Nothing player-facing goes beyond the spec and the Director's logged rulings.

No-surplus-extractors is a Director addition. It answers the owner's own complaint ("the extra haulers sitting around feel much worse") for the other economy type, and it sits behind the same `hauler.autoNeed` A/B switch. I don't think it needs an owner question.

**Gates (run by me on 0246e00, `npm run gates -- --base main`): all PASS.**
- typecheck, lint and protected-files (34 files, none protected).
- test: 46 files, 990 tests.
- determinism: 30 checkpoints over 9000 ticks, final b8d34d88.
- bots: adaptive and greedy win, flags 1–7 MET, tick p95 at most about 0.013 ms.

Nothing outside the task's files is red at this commit. The stack plan allowed bots and client tests to be red here, and they aren't.

**Acceptance.**
1. **Repro first: met.** 0291294 holds only the test, the v13 fixture and DECISIONS.md, before any rule change. Two cases fail on the v13 rules, and the cause is named: H7 ranks a buffer-only rock after every producing rock, and a raid after a Stop can leave a3 in that state. Under H2 the two failing cases pass. Under `hauler.autoNeed` 0, all of `hauler-repro.test.ts` pins H7's outcomes, word for word.
2. **Data v14: met.** The nine keys are in the Tunables table, with their defaults and ranges. `data-h8.test.ts` parses the DESIGN table itself, so the data can't drift from it. The `client.*` keys are client-scoped. `haulerSet` is saved and validated, a corrupt or missing one is refused, and the version pin is 14.
3. **H1–H5: met.** Each listed case has a test on shipped `map.field`: the need table, `max(1, …)`, set and Auto, both tie-breaks, idle at the probe, rebalance (including after `setHaulers`), H4's `enough` with its share kept, and resumption on a mark or a dock.
   - The strongest test is `h8-autoneed-off.test.ts`. It replays 6 minutes of the v13 opening, with a Stop, a re-mark, a weight change and a recycle, and matches the pre-H8 code hash for hash. That is real proof that `autoNeed` 0 is H7.
   - The amendment's acceptance is pinned on the frozen v14 fixture. First hauler 90, first delivery 1035, and ore by minutes 1–3 of 8, 24 and 52 (H7: 8, 20, 40). `data-h8.test.ts` re-checks that order on shipped data, so calibration can't silently break it.
4. **Inputs: met.**
   - `moveShips`: all, split at 25, 50 and 75, the fallback, lowest ids, an attack counted as a wave, economy ships never carried, and the invalid cases (from = to, empty, only in transit, bad index or part, campaign). It also checks that the counts are taken on the tick the input applies.
   - `setHaulers`: the range, node kinds, kept while unmarked, and 0 leading to "Backed up".
   - `recycleFleet`: the order across groups, the refund including an uneven `recycleRefundPct`, cargo lost, a docked extractor whose slot is re-dispatched the same tick, the guarded-node and raid-fight exclusions, and the invalid cases.
5. **Selectors: met.**
   - `rockStatus` gains the three hauler fields. `raidTarget` is false, and `haulersHeld` reads the stub.
   - `allocStatus` gains `enough` and `incomePct`, with floor rounding tested at 3/2/1.
   - `fleetStatus.types` and `movePreview` are added.
6. **Reference replay: the spec's six H8 items are present and each is asserted,** not just run. Running H7's items under `autoNeed` 0 and the H8 items from 8100 under `autoNeed` 1 is a reasonable call, and DECISIONS.md logs it.

   **But it misses the rules that change the shipped default most.** DECISIONS.md says it outright: the determinism final is "b8d34d88, unchanged", both after the H1 amendment and after the no-surplus-extractors rule. Neither rule touches the replay. I confirmed this with a scratch run of the replay on 0246e00 (file deleted afterwards). Over every tick with `hauler.autoNeed` 1:
   - no node is staffed without being haulable;
   - no hauler waits at its node while no extractor works it;
   - `extractorShortfall` never reaches 0 or below (the extractor weight is 0 throughout).

   The determinism gate, and the browser smoke's cross-engine hash check, are the only cross-run guards. Today they don't exercise `staffCounts` with bound or committed extractors, the wait at an unworked rock, or the Extractor `enough` gate. Those are the rules the owner meets in the first minute of every game.
7. **Gates: met.**

**Determinism.** The code is integer only, with `ceilDiv` and `Math.floor`/`min`/`max` on integers. There is no RNG and no wall clock. Orders are fixed:
- `byProbeDistance` and `recycleOrder` sort with total comparators that end on the index or id;
- types follow `BUILD_TYPES`/`SHIP_TYPES`;
- haulers are processed in id order, and `assigned` is updated after each pick.

The `Set` in `applyRecycleFleet` is only checked for membership. The derived-not-stored design (only `haulerSet` is new state) is the right call, for the reasons h7-sim derived `node.extractors`.

**Data.** Every new number is in `data/sim.json`. `dataVersion` is 14. The older fixtures carry the H8 keys at their H7 values, so the old rule tests keep their rules.

**Code quality.** Clear, with comments that cite the spec rule. The new `orders.ts` module avoids an import cycle cleanly. Moving `shipsAtByType` and `perExtractorPerMin` keeps the old exports, so no caller changed. The client edits are compile-only and logged. The second `enough` string ("enough extractors") is needed so the Extractor row doesn't read "enough haulers".

Small points, not required:
- `isEligible`'s new default parameters (`haulersWanted(world)`, `extractorsWanted(world)`) are never used: the only caller passes both. Making them required would avoid an expensive hidden default for a future caller.
- `staffCounts` places committed extractors without first placing unbound extractors (idle or flying home), which F5 dispatches before the bay's. Under no-surplus-extractors these are rare, so it's harmless. A comment would help.

**For the Director (not h8-sim's files).** DESIGN.md doesn't yet describe the rulings h8-sim built:
- committed extractors staff a rock;
- haulers wait at an unworked staffed rock;
- no surplus extractors, with the Extractor `enough` state.

Its "H8 candidates" background (line 458) still says "Extractors don't need this rule". h8-design-data and h8-client will read the spec, so it should carry these before they start.

**Required changes:**
1. **Extend the reference replay** (`packages/bots/src/reference-replay.ts`), within its 9000 ticks and with `hauler.autoNeed` 1, so that it exercises and `reference-replay.test.ts` asserts:
   - (a) A hauler assigned to a rock that is staffed but not yet haulable, because its extractor is on its way: assert `isStaffed` true and `isHaulable` false at the pick. The hauler waits at the rock until the extractor docks, then loads.
   - (b) The Extractor reaches `enough` with a weight above 0 (every marked slot docked, bound or in the bay). Its bay does not start while in that state, and its share is kept.
   - (c) The bay starts again once a slot opens (a mark, a recycle or a raid kill).

   For example: after 8100, give the extractor a weight, then mark one of the rocks the script unmarks at tick 0. Re-baseline the hashes, and record the new final in DECISIONS.md. Check: the determinism final changes from b8d34d88. Re-running my probe (count ticks with `isStaffed && !isHaulable`, haulers waiting at an unworked rock, and Extractor `enough`) gives non-zero counts for all three.
2. Gates stay green after the change.

VERDICT: REJECT

## Round 2 · 2026-11-14

I reviewed cb74dbc against round 1. Since 43236ca the branch has two merges from main, which bring in cw-smoke-sim-time and the Director's DESIGN.md update (3c6b43e), plus one fix commit. I reviewed the fix commit in full.

**Required change 1 (the replay): met.** The new items at 8660, 8670 and 8720 run with `hauler.autoNeed` 1. `reference-replay.test.ts` asserts each part, and the assertions are concrete:
- (a) The first pick at a4 is at 8720, with `isStaffed` true and `isHaulable` false. Its hauler waits on every tick from its arrival to the tick before the dock, then loads 2 after the dock.
- (b) On every `enough` tick, the Extractor has weight 3 and an idle bay. Before 8720 its share is held at 5.
- (c) The bay restarts at 8720 on the `setMine`, after `enough` at 8719, and the share goes into it.

I re-ran my probe on cb74dbc (scratch file, deleted). Over the ticks with `autoNeed` 1:

| Probe count | Value |
| --- | --- |
| Extractor `enough` ticks | 280 |
| Node-ticks staffed but not haulable | 155 |
| Hauler-ticks waiting at an unworked rock | 125 |

All three were 0 in round 1. My staffed count differs from DECISIONS.md's 499, probably because the probe definitions differ. It doesn't change the conclusion. The determinism final moved from b8d34d88 to 958a2f1d.

**Required change 2 (gates): met.** I ran `npm run gates -- --base main` on cb74dbc and every gate passed:
- typecheck, lint and protected-files (35 files, none protected);
- test: 46 files, 993 tests;
- determinism: final 958a2f1d;
- bots: flags 1–7 MET.

**What else changed, judged:**
- **Haulers now wait for committed extractors too** (`runHaulers` uses `staffCounts`, not `boundCounts`, for the wait).
  - It follows from the accepted committed-extractors ruling. A rock that is staffed by a committed extractor no longer sends its hauler home empty and back on a loop while the Extractor bay is held.
  - The release is unchanged: Stop, or nothing docked, bound or committed there. If the commitment moves to another rock, this one stops being staffed and the hauler leaves with what is there.
  - The opening's first hauler (tick 90) and first delivery (1035) are unchanged, minutes 1–3 are unchanged, and minute 10 is 1 ore lower (592). The pinned curve was updated, not loosened.
  - I accept it. But DESIGN.md's ruling still reads "waits while an extractor is docked there or on its way". **Director:** add "or committed (in the bay, or a full share)" so that the spec and the code agree before h8-client and h8-design-data build from it. The engineer logged this in DECISIONS.md for you.
- **The replay's H2 pick check now uses a different baseline.** It takes the targets after the tick, minus the haulers assigned before F6, instead of the state at the start of the tick. The reason given holds: F2 can raise a target in the same tick when the extractor share fills. The assertion is unchanged (every pick takes the largest shortfall, above 0), so this is a more accurate measure, not a looser one.
- **p1's capture check** moved to the moment of capture, because the script now unmarks p1. It is the same assertion.
- **Both optional notes from round 1 were taken.** `isEligible`'s parameters are now required, and `staffCounts` has a comment on why unbound extractors aren't placed first.
- **DESIGN.md (Director, 3c6b43e)** now carries the amendment rulings and "H4b. No surplus extractors", which answers my round-1 note. The only gap left is the committed-wait wording above.

**Pillar fit:** unchanged from round 1. Nothing goes beyond the spec and the Director's logged rulings.

Required changes: none.

VERDICT: APPROVE
