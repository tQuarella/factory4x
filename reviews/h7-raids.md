# h7-raids review

## Round 1 · 2026-11-14

Reviewed `git diff task/h7-sim...task/h7-raids` (head ed5e9ac, branched from 3c846b7, h7-sim's approving review) against DESIGN.md H7 "Raids" R1–R9, "Selectors" (`raidStatus`, `raidRank`) and "Save, data version and replay", and the BACKLOG h7-raids acceptance.

**Pillar fit.** Raids are paced by the player's economy, never by the clock:
- R3 requires `econ ≥ raid.firstAtEcon`;
- the gap runs from the end of a raid;
- a 60-minute test shows that holding the economy below the threshold is safe, and a paired control test shows the same world is raided again at the threshold.

The R5 reading (a rock must be Mine-marked to be raidable) follows from the Director's round 2 ruling on h7-sim that Stop means stop. It closes the gap I raised at the end of that round. It's logged and tested both ways: with the mark clause removed, five tests fail. Nothing goes beyond the spec. No data values changed.

**Director-accepted reading.** When the last raider dies in a round that also killed an economy ship, the raid is `beaten`, and `last` carries the losses. The test "beaten wins over hit …" pins this reading.

**Other readings (DECISIONS.md), all acceptable:**
- R7 "player ship" means any ship parked at the target, warship or economy. So an undefended raid stays while there is something to kill, and leaves when the rock is empty at the start of a round.
- `raidRank` is a pure function of the world: rank 1 is the next R5 pick, not the in-flight raid's fixed target. The rock-sheet line "raids hit here first" stays true under it.
- A cancelled muster counts in `mustered` but gets no outcome.
- `withered` is recorded in `lastRaid` but not in the three outcome counters.
- The raid id is the `mustered` count, so a muster never shifts entity ids.

**Code.**
- `factions/index.ts` is clear, small per function, and follows the R-rules one to one.
- Launch takes the lowest ids per type from the hive's id-ordered list. Returning raiders are merged back sorted by id.
- `hiveRegrow` counts raiders that are out against the caps. The regrow period is `floor(regrowTicks × hive.regrowPct ÷ 100)`, at least 1.
- `raidWither` is called in the capture branch.
- The fight reuses `guardPools`, `playerDamage` and `guardStrike`, and calls `syncExtractors` after kills.

**Edits outside the file list.** Each is justified in DECISIONS:
- `combat.ts`: I diffed the moved code against what `step.ts` lost, and it is identical apart from imports and the header. `step.ts` re-exports it, so the import cycle is gone without an API change.
- `world.ts`: `lastRaid`.
- `save.ts`: `raidOk` now checks `lastRaid`.
- The `regrowth` hive branch in `step.ts`, which R9 needs.
- `index.ts` exports.
- `field-selectors.test.ts`: `raidRank` 0 becomes 1. That's correct now, and the test is no weaker.
- `fleet-off.test.ts`: `h4View` strips `lastRaid`. The H4 golden hashes are unchanged.

**Acceptance.**
1. R1–R9: every required case has a named test in `raids.test.ts`, on the v12 fixture, whose `map.field` is the shipped one.
   - R3: no raid below the threshold, or with raids disabled.
   - R4: size from `econ` with the `maxSize` and keep caps, the mix rounding and the short-type fallback.
   - R5: target ties (a1 over a2, a6 over a7), never the probe or the hive, retarget once, then home.
   - R6: muster cancelled by a battle at the hive; raiders defend the hive while mustering.
   - R7: counters apply; raider damage hits warships, then haulers, then extractors; docked extractors come off the node count the same call; free extractors can't be killed.
   - R8: beaten, hit and turned back are all recorded; returning raiders keep their ids and hp.
   - R9: raiders out don't regrow; `hive.regrowPct` slows regrowth; capture with a raid out (or during a muster) withers it.
2. `raidStatus` is tested at each phase (none, muster, out, fight, home), and so is `raidRank`.
3. The 60-minute no-raid test is met, with its control.
4. The reference replay now covers a raid beaten by defenders at p1 (after a retarget), an undefended hit at p1, and the hive captured at tick 8010 with raid 3 out, which withers. The test asserts each of these, the totals and the captures. The final hash is re-baselined to df9ea7c5.
5. Determinism: integer only, sorts with integer comparators and an index tiebreak, no RNG; lint passes.
6. The raid sizes at econ 6, 12, 22 and 28+ and the flight ticks per rock are reported in DECISIONS.

**Gates (run by me on ed5e9ac, `npm run gates -- --base main`):**
- typecheck, lint, determinism (30 checkpoints, final df9ea7c5) and protected-files pass.
- The test gate fails with 41 failures out of 734 tests, in exactly the 7 stack-expected files:
  - bots: `needs-driven`, `runner`, `waves`;
  - client: `h4-client`, `h5-client`, `h6-client`, `session`.
- The bots gate fails fast on the `runCampaign` field-mode guard.

All sim tests pass, including the new `raids.test.ts`.

**Non-blocking notes (no change required):**
- `raidOk` in save.ts still checks only `phase` and `guards` on `world.raid`. The raid now has `flightTicks`, `from`, `retargeted` and the loss counters, and a hand-edited save with those malformed would load. Worth tightening the next time someone is in save.ts, as was done for economy ships in h7-sim round 2.
- The replay test for the undefended hit asserts `raids.hit` and no warships at the target, but not "a docked extractor killed" (`lastRaid.lostEcon` or `stats.econLost`) as its title says. The R7 unit tests cover the behaviour, so this is only about the replay assertion's strength.
- For h7-design-data: with free extractors, a captured pocket under an undefended raid stays worked. Its haulers keep arriving, so the raid can stay and kill them until the player Stops it or defends. That is consistent with the rules, but it belongs in the "raid threat" calibration.

Required changes: none. This lands with the stack through `merge-task h7-client`.

VERDICT: APPROVE
