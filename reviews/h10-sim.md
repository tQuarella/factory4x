# h10-sim review

## Round 1 · 2026-11-17

Reviewed `task/h10-sim` at ff91ae5 against BACKLOG.md "### h10-sim", DESIGN.md "H10 (Milestone 2, iteration 10, spec ready): Wear the hive down" and DECISIONS.md "2026-11-17 · Director · H10 spec rulings".

**Pillar fit.**
- The shipped data has both rule keys at 0, so the game plays exactly as v16. I confirmed this independently (see "Identical at 0" below).
- D1–D6 and L1–L5 follow the spec's rules. The rebuild queue is the claim's core mechanic and is built as specified: one counter, the D3 pick made at completion, raiders away never rebuilt, and pockets and the campaign untouched.
- Nothing changes how the game plays or feels beyond the spec, apart from the W5 reading below. That reading is inert at `raid.rollMax` 0.

**Acceptance criteria.**
1. **Data v17: met for everything this task owns.**
   - The three keys have the specified defaults and ranges. `client.raidSlowdown` is client-scoped and never reaches `world.tun` (data-h10.test.ts).
   - The `dataVersion` pin is 17.
   - `hive.regrowPct`'s description: the data has no description field. The tuning text is `packages/client/src/panels.ts`'s label map. DESIGN.md H10 "Client" item 6 and h10-client acceptance 6 both assign it to h10-client. Deferring it there is right, because it isn't a compile-only edit. **h10-client's review must check it.**
2. **D1–D6: met.** h10-rebuild.test.ts runs the whole `step` on the frozen v16 fixture. Its `map.field` is checked equal to the shipped one, and `hive.rebuildTicks` is 600 in the test. The tests cover:
   - exactly one guard on the deficit's R-th tick;
   - the D3 pick: the tie to Thorn, a type at its cap, a cap of 0, and the pick made at completion;
   - a single raid and a split raid: the hive plus the raiders out never exceed the caps, and only the dead are rebuilt;
   - a rejoin leaving the progress unchanged;
   - the queue during a long battle;
   - full, a `capPct` drop and capture;
   - all three D6 cases, including ≥ on a lowered value;
   - pockets compared tick by tick at 0 and 600;
   - the campaign compared hash by hash at 0 and 600.
3. **L1–L5: met.** h10-roll.test.ts covers:
   - the first eligible node in hive order, skipping hit rocks and other live targets (two prongs, `rollMax` 2);
   - the flight values, with no raider added;
   - the `rollMax` cap, and no roll without a kill or an eligible node;
   - the hold moving on the roll tick;
   - the outcome open through a roll, then hit, or beaten after a hit;
   - `hitRocks`, `rolls`, `rolledFrom` and `stats.raidRolls`;
   - the shield, `recycleFleet`'s exclusion, `raidTarget` and `raidMix` following the new target.

   Every H9 raid test passes. The only edits to them add the new fields with exact values.
4. **Identical at 0: met, and verified by me.**
   - (i) I compared the `reports/bots-latest.json` from my own gate run with `reports/archive/h9-design-data-v16-bots.json`. `results` (all 24), `failures`, `flags`, `h9Lines`, `staticSweep` and `sweep` are equal once the timings and `finalHash` are excluded. Only `generatedAt`, `dataVersion` and `runSeconds` differ.
   - (ii) `fixtures/replay-v16.ts` is byte-for-byte main's `referenceReplay` input list. Its only differences are the export name and the literal `dataVersion: 16`; I diffed it against `main:packages/bots/src/reference-replay.ts`.
   - `MAIN_V16` in h10-identical.test.ts is identical to main's `reports/determinism-latest.json` (final a8f4c2ff).
   - The strip list in `h10-strip.ts` holds exactly the state the Director's ruling allows, and nothing else:
     - the two rule tunables;
     - `dataVersion`, which is optional and unused on the v16 fixture;
     - `field.hiveRebuildProgress`;
     - each prong's `rolls` and `hitRocks`;
     - `lastRaid.prongs[i].hitRocks`;
     - `stats.raidRolls`.
   - `rolledFrom` and `hiveLost` are derived rather than stored. That keeps the list tight, and I agree with the choice.
5. **Save: met.**
   - A save at 2400 with progress 150 matches the uninterrupted run hash for hash over 2000 ticks.
   - A save mid-roll round-trips and plays on identically.
   - 13 malformed variants are each refused as corrupt.
6. **Selectors: met.** The tests cover:
   - `rebuild` with `nextType`, which is null for pockets, a dead hive and the campaign;
   - the hive `GuardRow` fix under R9: floored, the at-least-1 floor, and checked against the sim's actual regrow tick;
   - the D2 rows;
   - `hiveAfter`, compared tick by tick with stepping, for D2 mid-count, a lowered period, raiders away and R9;
   - `rolls` and `rolledFrom`;
   - `hitRocks` and `hiveLost`;
   - `fieldSummary.raidRolls` and `.hive`.

   `lostToRaids` is the total kills minus every guardian's battle kills. I checked that raiders killed at rocks increment only `stats.guardsKilled` (factions/index.ts), so the subtraction is sound.
7. **Replay (a)–(h): met.**
   - Each item has a test that the replay enters the state. They are thorough: every rebuilt guard is listed with its tick, type and the missing counts before it, and the D3 formula is re-checked on each.
   - The determinism final moves from a8f4c2ff to 3b20982a.
   - The pinned H9 values that moved are listed in DECISIONS.md: raid 3 ends at 6384, its result's target is a5, and `allocChanges` is 18. Each moved because of the new inputs, and no assertion was loosened.
8. **Gates: met.** These are from my own run of `npm run gates -- --base main` at ff91ae5:

   | Gate | Result | Time |
   | --- | --- | --- |
   | typecheck | PASS | 7.8 s |
   | lint | PASS | 5.1 s |
   | test (1301 tests) | PASS | 64.3 s |
   | determinism (final 3b20982a) | PASS | 0.8 s |
   | bots | PASS | 74.5 s |
   | protected-files (45 files changed, none protected) | PASS | 0.6 s |

   The edits outside the task's files are test-only literals: three bots tests and two client tests. They are listed in DECISIONS.md, and there are no `src` edits in client or bots beyond the replay.

**Readings I checked and accept:**
- **"Exactly `rebuildTicks` after the first death"** lands at death tick + R − 1. This is D2 as written: rule 9 runs after the raid hook and combat, so the tick of the death counts as 1. R9 counts the same way.
- **W5 after a roll skips rocks the prong has hit.** It is unreachable at `raid.rollMax` 0, where it is W5 exactly, and it matches L1's intent. If calibration ever asks for the roll-on, the Director's ruling should note this reading alongside the numbers.
- **A prong that hits, rolls and is then beaten is `beaten`.** That matches W6 in H9.
- **`hiveLost` lives on the `RaidReport` view.** It is on `raidStatus().last`, not on the stored `RaidResult`. The client reads results through the selector, and storing it would add a hashed field outside the strip list.

**Determinism.**
- Integer math only (`Math.max`/`Math.floor` on integers), with no clock and no RNG.
- `raidables` sorts with a total comparator.
- `hitRocks` is an ordered array. The `Set` in `save.ts` is used only for validation.
- All new state is in the world, saved and hashed. The reference replay reaches every new branch.

**Quality.** The code is clear, small and well placed. Rule 9 for the field hive, `fight` for the roll and `setTunable` for D6 each have one hook. Non-blocking nit: in `selectors.ts`, `guardianStatus` has a local `const fieldHive` that shadows the module function `fieldHive`. It is harmless, but worth renaming on a later touch.

**Process note.** By the BACKLOG's stack plan, this task must not merge alone. It lands with `merge-task h10-client` after h10-bots and h10-design-data are approved.

Required changes: none.

VERDICT: APPROVE
