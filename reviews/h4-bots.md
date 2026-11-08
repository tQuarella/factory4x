# h4-bots review

## Round 1 · 2026-11-08

Pillar fit: Good. The runner plays a whole campaign from `createWorld` and the five strategies follow DESIGN.md H4 "Bots: campaign strategies". `ice-line` and `crystal-line` take their lines and then the cheapest open area. `full-kit` uses the fixed six. `greedy` scores need / best per-ship power by cross-multiplying, with the lowest index winning ties. `no-research` buys only the designs and the core. The research policy is the spec's 13 entries, bought repeatedly as "the first affordable item", and the reading that an unaffordable earlier item doesn't block a later one is logged in DECISIONS.md. The 30-minute visit cap withdraws the area, and a second timeout there is a softlock. The 120-minute campaign cap is enforced. Gameplay is untouched: the change is bots and tests only. The numbers are reported, not retuned, as required: flags 1, 5 and 7 are met; 2, 3, 4 and 6 are missed. The report shows the misses clearly for h4-design-data. The best run is 36-37 min against 45-75. The Deep's mean is 17:19. Ice is 19-24% behind crystal. Veil-flak is only 15% faster. Each seed has one order.

Quality: The code is clear and follows the H3 engine's style. All math is integer (cross-multiplied comparisons). The only wall-clock use is `performance.now` for tick timing in the bots package, as before. `flags.test.ts` is a good pure test of every flag's thresholds at their edges (exact 20%, exact 25%, exact 60%, 14% vs 16%). `strategies.test.ts` covers the policy order, skip-when-unaffordable, max levels, designs-only, route following, greedy's estimate and design sensitivity, and the in-area engine reclaiming every area with only valid inputs. All of that runs on the frozen fixture, which is right. The report has every field the spec asks for, plus the per-seed comparison, shipped share and skipped areas. The committed archive matches what I regenerated.

The problem is `packages/bots/test/runner.test.ts`. It runs on `defaultData` (the shipped `data/sim.json`) and asserts outcomes that are not calibration invariants. DECISIONS.md (2026-11-07, h3-design-data) keeps `runner.test.ts` on shipped data only for assertions any calibration must keep ("every strategy wins every layout"). The `fixture.ts` header says outcome tests run on the fixture. The next task, h4-design-data, must retune with **no test changes** (BACKLOG acceptance 3), and its first job is to make runs longer (flag 2 has the best run at 36 min against 45-75). Raising the core cost or lowering hauls is the obvious lever, and it would break these tests. The designer couldn't fix them, because the designer's file scope excludes tests. So h4-design-data would be blocked or parked:
- `takes the areas in its own order and can skip some`: `expect(r.skipped.length).toBeGreaterThan(0)` holds only because ice-line can afford the core after five areas at v6 numbers.
- `withdraws a visit past the cap...`: this relies on Landfall taking more than 10 s at shipped numbers (11 s today).
- `plays a whole campaign...`: `reclaimVisit(r, 'shelf')!.openingTicks` not null relies on Frost Shelf reaching 40 ore/min at shipped numbers.
- `flag 4 probes reclaim the area...`: this expects all four probes non-null on shipped data. Yet `computeH4Flags` itself treats a null slow probe as a legitimate "infinitely slow" result, and a retune that makes Veil-with-lancer take longer than 30 minutes is a valid way to meet flag 4.

Gates: I ran `npm run gates -- --base main` on `task/h4-bots` and all six passed. Typecheck 4.4 s, lint 2.3 s, test 11.9 s, determinism 0.6 s, bots 16.9 s (full suite, 15 campaigns + 4 probes; the gate runs the full config, per DECISIONS.md), protected-files (9 files, none protected). Tick p95 is about 0.004 ms against the 2 ms budget. No protected files were touched.

Required changes:
- In `packages/bots/test/runner.test.ts`, run every assertion that depends on tuned numbers against `fixtureData` (`packages/sim/test/fixture.ts`), the same way `strategies.test.ts` does. At minimum this covers the four tests above: ice-line skipping an area, the Landfall 10 s cap softlock, the Frost Shelf opening being non-null, and the four flag 4 probes being non-null. If a test's premise doesn't hold on the fixture either, build the premise explicitly (for example, a `visitCapTicks` of 1 tick for the softlock test, or a `stopAfterReclaims` start) instead of relying on a tuned outcome.
- On shipped data, keep only assertions a calibration must keep: no crash, a won outcome for every strategy (flag 1 / priority 1), determinism, and report-shape checks that don't depend on values. Add one line to DECISIONS.md under the h4-bots entry saying which runner tests read shipped data and why.
- Re-run `npm run gates -- --base main` and confirm the test count and the bot report are unchanged.

VERDICT: REJECT

## Round 2 · 2026-11-08

Reviewed head 22c9396 (`git diff c82246d..22c9396`: `runner.test.ts` and one DECISIONS.md line).

Pillar fit: Unchanged from round 1. Bots and tests only, with no gameplay change.

Quality: Round 1's required changes are mostly done, and done well. The tuned outcomes now run on `fixtureData`. Their premises are built explicitly: a 1-tick visit cap for the withdraw/softlock case, and a constructed start with the stockpile full and Landfall, Shelf and Veil reclaimed for the "skips areas" case. The opening check moved to a fixture run, and so did the flag 4 probes. The shipped-data block now has only retune-proof assertions, and DECISIONS.md says which and why.

One new problem, which round 1's instructions invited ("a won outcome for every strategy"): the new shipped-data test `every strategy buys the probe core on every seed, with no crash or softlock` plays all 15 campaigns inside the unit-test gate. I measured it:
- 16.3 s alone (`npx vitest run packages/bots/test/runner.test.ts --reporter=verbose`);
- 16.9 s inside the full parallel suite;
- the per-test `testTimeout` is 30 s (`vitest.config.ts`);
- the test gate went from 11.9 s (round 1) to 27.7 s.

That makes the gate likely to fail, for two reasons:
- **Machine load.** `vitest.config.ts` itself records a loaded machine slowing a test run about 2.3x (12 s to 28 s, the cw-flaky-test incident). At that factor this one test passes 30 s and fails the gate for nothing. A flaky gate weakens the gate (BACKLOG cw-flaky-test).
- **The next retune.** The test's runtime scales with game length. h4-design-data's top job after softlocks is to stretch the best run from about 36 min to 45-75 min, and the slower strategies stretch with it. That pushes this test toward or past 30 s from a data change alone. The designer can't fix that without a test change, which is the round 1 problem again in another form.

It is also redundant. The `bots` gate already plays the same 15 campaigns on shipped data and fails on any crash or softlock, and flag 1 reports the 120-minute cap.

Gates: I ran `npm run gates -- --base main` on 22c9396 and all six passed:
- typecheck 4.4 s, lint 2.3 s, test 27.7 s (374 tests in 17 files);
- determinism 0.6 s;
- bots 16.6 s, with a report identical to round 1 and the archive;
- protected-files: 10 files changed, none protected.

Required changes:
- Remove the 15-campaign shipped-data test from `runner.test.ts`, and let the `bots` gate cover crash and softlock on shipped data. Alternatively, cut it to something whose runtime doesn't grow with run length. Check: no single test in `npx vitest run --reporter=verbose` takes more than about 5 s, and the `test` gate is back near its round 1 time (about 12-15 s).
- Keep the remaining shipped-data tests (determinism, report shape, per-seed games) as they are, or trim them the same way if they grow with run length. Update the DECISIONS.md line to say crash/softlock on shipped data is covered by the bots gate, not by a unit test.
- Re-run `npm run gates -- --base main`.

This is the second rejection. Per PROCESS.md, a third rejection parks the task.

VERDICT: REJECT
