# h2-bots review

## Round 1 · 2026-11-07

Pillar fit: This change produces the evidence H2 needs, namely that neither line dominates. raid-supply follows DESIGN.md H2 "Bot strategies" step by step:
- It plays turtle's economy plan with the yard off. A test confirms its decisions match turtle's at the start of a run.
- It rallies at the probe, then sends `ceil(rootThorns*5/2)+5` from the probe only when no ships are at or heading to the Root.
- After the cut it rallies at a5 and moves the Root survivors there.
- It sends `ceil(bloomThorns*9/4)` from a5 only when nothing is at or heading to the Bloom, and builds out `rich` after the capture.

rush and turtle are byte-identical to main. Nothing changes how the game plays. Only the bot package and its report are touched, and the data and the reference replay are untouched.

Acceptance:
1. raid-supply matches the spec, and `rootWave`/`bloomWave` are tested at 15/28/40 and 18. Met.
2. The report has one row per strategy and seed, labelled with the variant, showing capture time, Root cut, ships lost, ships lost at the Root, thorns withered and Root/Bloom waves. A per-variant table compares turtle and raid-supply. Met.
3. All six depth flags print as MET/MISSED report lines, and a miss is pushed to `flags`, never to `failures`. Met.
4. Tests cover the decision logic. They check:
   - the threshold, one short and then exactly ready;
   - no second Root wave while one is in flight;
   - no Bloom wave while the Root stands;
   - the post-cut rally and regroup;
   - the Bloom-wave threshold;
   - a full-run capture on all three variants;
   - per-node repelled counting.

   The flag computation is tested at every boundary: 8/13 min inclusive, the 30 s gap at 29 and 30, 45 against 46 s, ±10 s around 588 with exactly one wave, strict dominance, and the "each first somewhere" rule. Met.
5. Gates pass, and the numbers are reported without retuning (below). Met.

Numbers (my gate run, data v3):

| Variant | turtle | raid-supply | Root cut | Lost T / R |
| --- | --- | --- | --- | --- |
| knotted | 9.8 min | 9.5 min (14 s faster) | 9.3 min | 11 / 14 |
| deep | 9.8 min | 10.6 min (52 s slower) | 10.5 min | 11 / 17 |
| thin | 9.8 min | 8.9 min (50 s faster) | 8.2 min | 11 / 11 |

All six depth flags are MET. turtle runs 585 s with one wave in every variant, so the fed Bloom is unchanged from H1. rush still captures (25.3 min, 72 lost) and keeps its H1 flags. Nothing softlocks. These figures sit very close to the Designer's calibration model (8.9 / 9.65 / 10.75 min).

Quality:
- Per-node battle tracking in the runner fixes a real hazard: `world.lastBattle` is global, so a Root battle could have hidden a Bloom repel. A test covers it with a doomed Root wave added to rush.
- The old turtle "9–15 min" flag was removed. Depth flags 1 and 6 replace it with tighter checks, which is correct.
- The markdown table dropped the ore-spent columns. They are still in the JSON, and the explanatory sentence was updated to match. That is acceptable.

Observations, not required changes:
- Rally only redirects new ships. Ships built at the probe between the Root send and the cut stay at the probe for the rest of the run. The spec doesn't ask the bot to move them. On these numbers the effect is at most a few ships, because the Bloom wave fires seconds after the cut from the survivors alone, so the flags are unaffected. If the Designer retunes toward weaker Roots or bigger starved Blooms, this could start to matter. A one-line follow-up (`sendShips(probe, a5, 0)` after the cut) would be the fix, specced by the Designer.
- The test in `raid-supply.test.ts` that adds a doomed Root wave to rush keeps a mutable `sent` flag in a closure. That's fine in a test, but it isn't a model for real strategies, which must stay stateless.

Determinism: The bots are outside the sim. The strategies are pure functions of world state, and their integer `Math.ceil` is not transcendental. The reference replay is untouched, and the determinism gate passes.

Data: no new tunables. The wave formulas are DESIGN constants for the bot, not game tunables. `dataVersion` is unchanged, which is correct.

Phone: no UI change.

Protected files: none touched (the protected-files gate reports PASS).

Gates: `npm run gates -- --base main` on `task/h2-bots` (7b74ca1) passed every gate:
- typecheck 9.7 s
- lint 4.5 s
- test 6.1 s
- determinism 1.6 s
- bots 3.6 s
- protected-files 1.8 s

Required changes:
- None.

VERDICT: APPROVE
