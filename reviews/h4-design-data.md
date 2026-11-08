# h4-design-data review

## Round 1 · 2026-11-08

Reviewed head 349b8b8 (`git diff main...task/h4-design-data`: `data/sim.json`, `DESIGN.md`, `DECISIONS.md`, `reports/archive/h4-design-data-v6.{md,json}`).

Pillar fit: The calibration itself is good and serves the H4 hypothesis. All seven flags hold in my own gate run. Each change has a clear reason:
- The cross-hauls of 40 (Veil crystal, Garden ice) fix flags 3 and 6 at their root. The ice side reached The Deep without Lancers. Now ice-line and crystal-line are 34 s apart on every seed, and each seed has 4 orders within 15% of the best.
- The Spore Veil heart at 1/50 makes "the design decides the cheap medium" true on the overworld sheet, and the Flak lead is 44%.
- Smaller early ore hauls are the run-length lever. That is an honest finding: medium areas are economy-bound for the bots.

No rules, research costs or tunables changed. The H3 Deep layouts are untouched. The skip trade-off is documented honestly: no bot skips an area now, so the "Why these areas" text was rewritten instead of being left as a false claim. Priorities are met in the specified order:
- no softlock, 15/15;
- best runs of 47.6, 45.9 and 45.8 min, with every mean area time in band;
- flag 4;
- flags 3 and 6;
- flag 5, at +42 to 44%, with openings shrinking from 2:14 to 0:56.

The thin margins (0.8 min over 45, Glass Thicket's Deep at 16:50) are disclosed, not hidden. The play feel is within what was specced.

Quality: The DESIGN.md tables match the data, and the data and tag tests pass with no test changes. I checked these numbers against `reports/archive/h4-bots-data-v6.md` and `reports/archive/h4-design-data-v6.md`, and the regenerated report matches the archive:
- every before and after flag value;
- the Deep times (22:27–25:32 against 14:01–15:05 before, 14:31–16:20 after);
- the 34 s gap;
- the shipped shares;
- the per-area means.

The skip arithmetic is correct: medium 180–200, light exactly 160, four areas stop at 100, and Fast yards costs 20 + 40 per side. The h4-sim doc fixes (13 levels, about 1.7 KB with a 2 KB test cap) cite DECISIONS.md h4-sim and `campaign.test.ts`.

Problems:
1. **`dataVersion` was not bumped, and defaults changed.** PROCESS.md says "Bump `dataVersion` in `data/sim.json` whenever a default changes", and this task's own files line says the same. The reason given ("the save format didn't change") is not the rule. The only precedent for skipping a bump (DECISIONS.md, rule 5b) needed both "no default changed" and "had not shipped". Neither holds here:
   - Hauls and guards changed.
   - Since the h4-sim and h4-bots merges, `main` has deployed v6 with the pre-calibration values to production. The CI run "Status: h4-bots merged" succeeded, and deploy runs on green `main`.

   A v6 save or feedback note made there would load, or replay, against different hauls and guards with no warning. `replayHashes` and the save loader guard only by `dataVersion`, so this is exactly the case the bump exists for.
2. **An unsourced number (acceptance 4).** "3/12 pushed it to 10:37, past its band" (DESIGN.md calibration table, Frost Shelf row; repeated without the number in DECISIONS.md) comes from an exploratory run that isn't committed. "Moved the bot times by under a minute" / "well under a minute" (DECISIONS.md and DESIGN.md) is also a numeric claim with no committed source.
3. **A small arithmetic slip.** "The best run clears 45 min by 0.8 min on seeds 2 and 3" is wrong for seed 2: the report gives 45.9 min (45:54), a 0.9 min margin.
4. **Stale prose.** DESIGN.md "Save, data version and replay" still says "A full run is about 60–75 game minutes, or 110–135k ticks". The calibrated best runs are about 46–51 min, and no-research takes about 66–68 min (h4-design-data report). Either restate the sentence from the report, or say it is a player estimate and why.

Gates: I ran `npm run gates -- --base main` on `task/h4-design-data` (349b8b8). All six passed: typecheck 4.3 s, lint 2.2 s, test 6.4 s, determinism 0.6 s, bots 18.0 s and protected-files (5 files, none protected). The bot report gives flags 1 to 7 all MET, matching the archived copy. The reference replay was not re-recorded and still matches over 9000 ticks. It reads `defaultData.dataVersion`, so a version bump alone doesn't force a re-baseline.

Required changes:
- [ ] Set `dataVersion` to 7 in `data/sim.json`. Update the one test that pins it, `packages/sim/test/data-h4.test.ts:126` (`toBe(6)` → `toBe(7)`). That file is outside the Designer's scope, so the Director must route this one-line change to an engineer, or widen the task's file scope in BACKLOG.md and log it in DECISIONS.md. A version bump is not a "test change" to calibrated values.
- [ ] DESIGN.md: in "Save, data version and replay", say that a v6 save (pre-calibration H4 data) is discarded with the existing toast, like v5. In the calibration section, replace "`dataVersion` stays 6 (the save format didn't change)" with the bump and its reason. Rename the section heading's "data v6" to match.
- [ ] DECISIONS.md: correct the h4-design-data entry ("no `dataVersion` bump") and give the reason for the bump.
- [ ] Re-run `npm run bots -- --seeds 3` and archive the report as `reports/archive/h4-design-data-v7.{md,json}`, per the `<dataVersion>` naming in DECISIONS.md h4-bots. Point DESIGN.md and DECISIONS.md at the new file. Remove `reports/archive/h4-design-data-v6.{md,json}`, because no shipped data matches it.
- [ ] Remove "3/12 pushed it to 10:37", or commit the report it came from and cite it. Do the same for "under a minute" / "well under a minute": remove it, or cite a committed report.
- [ ] Fix "by 0.8 min on seeds 2 and 3" to match the report (0.9 min on seed 2, 0.8 min on seed 3).
- [ ] Fix the stale "about 60–75 game minutes, or 110–135k ticks" sentence in DESIGN.md, as in problem 4.
- [ ] Re-run `npm run gates -- --base main`. Confirm all flags still hold, with the same numbers. The values are unchanged, so they should be identical.

VERDICT: REJECT

## Round 2 · 2026-11-08

Reviewed head bdaa801 (`git diff 65cdea5..bdaa801`: `data/sim.json`, `packages/sim/test/data-h4.test.ts`, `DESIGN.md`, `DECISIONS.md`, the archive renamed from v6 to v7).

Pillar fit: Unchanged from round 1. The calibrated values are identical, and only the version stamp and the docs changed.

Quality: Most of round 1's required changes are done well:
- `dataVersion` is 7. The one test pin follows it, in the scope the Director widened.
- DESIGN.md "Save, data version and replay" says why the version was bumped, and that a v6 save is discarded with the existing toast.
- The calibration section and DECISIONS.md give the reason for the bump. The new DECISIONS.md entry supersedes the old one instead of rewriting it.
- The report of record is `reports/archive/h4-design-data-v7.{md,json}`, and the v6 copies are gone.
- "3/12 pushed it to 10:37" is gone.
- The margin line reads 0.9 / 0.8 min.
- The stale run-length sentence now quotes the v7 report. I checked 45:47–50:47 and 67:46, and about 82–122k ticks at 30 ticks per second is correct.

I regenerated the bot report on the branch. Every game result in it matches the committed v7 archive. Only the wall-clock tick timing columns differ, by a few microseconds.

Two defects remain. Both are in text this round wrote or touched:
1. **A false derived claim (acceptance 4).** The new "What the numbers say" bullet in DESIGN.md says: "Both medium hearts grew by more than half." Spore Veil's heart did, from 3/30 (33 guards) to 1/50 (51). Thorn Garden's grew from 17/9 (26) to 24/13 (37). That is +42%, not more than half, by the calibration table directly above the bullet.
2. **A test title that contradicts its assertion.** In `packages/sim/test/data-h4.test.ts`, line 125 reads `it('is data version 6', ...)` and line 126 now asserts `toBe(7)`. A test whose name states the wrong version is misleading code that this change produced. DECISIONS.md calls it "a later one-word fix", which is the kind of approve-and-fix-later I may not accept. It belongs to this change.

Gates: I ran `npm run gates -- --base main` on bdaa801, and all six passed: typecheck 4.3 s, lint 2.2 s, test 6.4 s, determinism 0.6 s, bots 18.3 s, and protected-files (7 files, none protected). The report header says "Data version 7". All seven H4 flags are MET with the round 1 numbers. The reference replay passes without re-recording.

Required changes:
- [ ] DESIGN.md, "What the numbers say", the economy-bound bullet: correct "Both medium hearts grew by more than half". For example: "Spore Veil's heart grew from 33 to 51 guards and Thorn Garden's from 26 to 37", with figures taken from the calibration table.
- [ ] `packages/sim/test/data-h4.test.ts:125`: rename the test to `'is data version 7'`. The Director should widen the scope to this line as well. It is the same test as line 126.
- [ ] Re-run `npm run gates -- --base main`.

If round 3 is rejected, that is this task's third rejection, and PROCESS.md parks it. Both fixes are one line each.

VERDICT: REJECT
