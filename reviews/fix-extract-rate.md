# fix-extract-rate

## Round 1 · 2026-11-08

Scope: `git diff main...task/fix-extract-rate` (c7df834). Owner bug from PLAYTEST_LOG (build-20261108-3): "the extraction rate didn't update to match the current research." There is no BACKLOG entry, so I judged it against the bug report and the author's own claim in DECISIONS.md: the shown rate is "what `extraction` in step.ts adds".

**Diagnosis: correct.** `extraction` in `step.ts` already applies `extractPct`. `nodeStatus` and `guardianStatus` returned the base rate, so the node sheet never moved. Fixing it in the selectors is the right layer, and it also corrects the bots' route-upgrade check (`strategies.ts` compares `extractPerMin` with route capacity). The bot timing shift is explained and logged. The sim rules, data and reference replay are untouched (determinism and replay PASS).

**Pillars.** Display fix only. It doesn't change how the game plays for a human. Bots upgrade routes a little sooner with research, which is the correct behaviour.

**Gates (run by me on the branch).** `npm run gates -- --base main`: typecheck, lint, test (398), determinism, bots (all criteria MET), protected-files all PASS. I also ran the new smoke test, `npx playwright test -g "Extraction-boosted"`, and it passes on desktop and on phone (375 px), with no horizontal overflow under the wide-font stress.

**Defect: the shown rate is still wrong for the heart at shipped defaults.** `boostedX10` floors the per-extractor rate to tenths first, and `extractPerMinX10` then multiplies that floored value by the extractor count. For any base rate where `base × pct` is not a multiple of 10, the error grows with each extractor. `heart.orePerMin` defaults to 25, and the heart is extractable in every area (Landfall's heart is unguarded, `heart.freeExtractors` = 1, 4 slots). I checked it with a script against the fixture data: a heart with 4 extractors and no route, buffer cap raised, 1800 ticks.

| Extraction level | Sheet shows | `extractPerMin` | Actual ore in a minute |
| --- | --- | --- | --- |
| 1 | +124.8/min (31.2 each) | 124 | 125 |
| 3 | +174.8/min (43.7 each) | 174 | 175 |

So the owner's exact complaint, a displayed rate that doesn't match the research, still applies on the heart sheet. The selector comment "exact for the shipped steps (12.5 -> 125)" is also false for the heart. The same error appears on asteroids and pockets whenever the tuning panel sets an odd base rate (e.g. `extractor.orePerMin` 9 gives 11.25 each). The regression test only pins asteroid and pocket rates, where `base × pct` happens to be a multiple of 10, so it can't catch this.

**Minor.** `extractPerMinX10: Math.floor(n.extractors * perX10)`: the `Math.floor` of an integer product is a no-op.

Required changes:
- [ ] Compute the node totals from the unfloored product: `extractPerMinX10 = floor(extractors × perExtractorPerMin × extractPct / 10)` and `extractPerMin = floor(extractors × perExtractorPerMin × extractPct / 100)`. With 4 heart extractors at Extraction 1 that gives 1250 and 125, matching `extraction` in step.ts.
- [ ] Add a heart case to the regression test in `campaign.test.ts`: 4 extractors at Extraction 1 (or 3) show `extractPerMinX10` 1250 (1750), and `extractPerMin` equals the ore actually produced over T ticks with no route and a buffer cap that doesn't bind.
- [ ] Fix or remove the "exact for the shipped steps" comment on `perExtractorPerMinX10`. The per-extractor heart rate (31.25) can't be shown in tenths. Either state that it floors to 31.2, or show it differently. I accept the floor if the comment says so honestly.
- [ ] Drop the no-op `Math.floor` on `extractPerMinX10`, or make it meaningful as in the first item.
- [ ] Update the DECISIONS.md entry if any of these numbers change. Re-run the gates and the new smoke test.

VERDICT: REJECT

## Round 2 · 2026-11-08

Scope: `git diff 030da04 369aaad` (round 1 fixes), with the whole branch re-checked against main.

**Required changes from round 1:**
- [x] **Totals from the unrounded product.** `nodeStatus` now computes `totalX100 = extractors × base × extractPct` and floors it over 10 and over 100. This matches how `extraction` in step.ts accumulates.
- [x] **Heart regression test.** The new test checks 4 heart extractors at Extraction 1 and 3: it expects `extractPerMinX10` 1250 and 1750, and that `extractPerMin` equals the ore produced over T ticks with a cap that doesn't bind.
- [x] **Comment.** `perExtractorPerMinX10` now states that it floors (31.25 shows as 31.2) and that the totals aren't built from it. I accept the floor on the per-extractor figure.
- [x] **No-op floor.** It is gone. Both totals now floor a real quotient.
- [x] **DECISIONS.md.** The entry has a round 1 correction note.

**Fail-before check (done by me, since the engineer didn't).** I put back the c7df834 `selectors.ts` and ran only the new test. It fails on the heart case with `extractPerMin` 124 and `extractPerMinX10` 1248, where 125 and 1250 were expected. With the branch's `selectors.ts` restored, it passes. The working tree was clean after the restore.

**Note, non-blocking.** The odd-base-rate half of the test (asteroid 9/min × 3, pocket 7/min × 2) doesn't tell the old code from the new in whole units: both give 33/40/47 and 17/24. It is still a valid property check, that the shown total equals one minute's output, across levels 0 to 3. The heart half carries the regression.

**Gates (run by me on 369aaad).** `npm run gates -- --base main`: typecheck, lint, test, determinism, bots, protected-files all PASS. The new smoke test passes on desktop and on phone (375 px). No sim rule, data or protected file changed. The reference replay and determinism pass.

**Pillars.** Display fix only. The sheets now show the rate the owner actually gets with research. I'm comfortable with the owner playing this tonight.

Required changes: none.

VERDICT: APPROVE
