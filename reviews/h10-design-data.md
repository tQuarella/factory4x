# h10-design-data review

## Round 1 · 2026-11-17

Reviewed `task/h10-design-data` at a4c4b53, stacked on `task/h10-bots`. The branch contains h10-bots' approving review commit 8118a5d, which is acceptance 6. I checked it against:
- BACKLOG.md "### h10-design-data";
- DESIGN.md "Calibration targets (H10)" and "The roll-on fallback";
- DECISIONS.md "2026-11-17 · Director · H10 spec rulings".

**Pillar fit.** One value changes: `hive.rebuildTicks` goes from 0 to 600, and `dataVersion` goes to 18. That is the spec's starting value and inside the allowed 300–1200. "No faster refill" holds:
- 600 is above the 300 floor;
- no warship, repair or pocket value moved;
- the hive's guard counts are unchanged.

The result serves the H10 claim. `undefended` goes from 28% faster than adaptive (v16) to 20% slower. Adaptive's winning wave lands on a hive at 21 of 30 guards after 7 hive-damaging events. One-push is 40% slower than adaptive, and two-push beats one-push by 20%.

**Gates (my own run, `npm run gates -- --base main` at a4c4b53): all PASS.**

| Gate | Time |
| --- | --- |
| typecheck | 6.7 s |
| lint | 3.8 s |
| test | 49.6 s |
| determinism (final ea89d755) | 0.7 s |
| bots | 71.0 s |
| protected-files | 0.5 s |

Client tests are green too, so nothing waits on h10-client here.

**Acceptance.**
1. **The probe report is committed: met.**
   - The files are `reports/archive/h10-design-data-v18.md` and its script `h10-design-data-v18-sweep.mts`.
   - The script runs one seed per strategy, each run capped by the runner at 45 game minutes, and prints progress on stderr.
   - h10-bots' v17 sweep was already in the archive.
2. **Calibrated to the targets, values only: met.**
   - Only `hive.rebuildTicks` and `dataVersion` changed in `data/sim.json`.
   - Under Director ruling 5, the guard is measured from the first v18 candidate. 600 is that candidate, so nothing is measured against it.
3. **The roll-on: met.** The first condition fails, because allowed values meet targets 1 and 5, so nothing went to the Director and `raid.rollMax` stays 0.
4. **v18, pins and tables: met.**
   - The `dataVersion` pin and the H10 defaults pin in data-h10.test.ts are updated.
   - The "Calibration result (h10-design-data, data v18)" section has the targets table, the v16 → v18 table and a walk.
   - The derived claims are recomputed: a beaten raid of 12 rebuilds in 7200 ticks, an empty hive in 18,000, and flag 6's sums are 15 + 22 = 37 > 30 and 15 + 10 = 25.
   - The h9-bots edit adds `'hive.rebuildTicks': 0` to the setup of a test that pins H8-era hashes. That keeps the test on the hive rule it was written for. No literal or assertion changed. I accept it as allowed by the conventions.
5. **The suite and the gates: met.** I checked the claims against my own gate run:
   - My `reports/bots-latest.json` equals `reports/archive/h10-design-data-v18-bots.json` in `results` (including `finalHash`), `failures`, `flags`, `h9Lines`, `staticSweep` and `sweep`.
   - `h10Lines` differs only because the archive ran with `--sweep`, which feeds line 5.
   - The figures in DESIGN.md match the runs: adaptive 28920 ticks (16:04), greedy 28800 (16:00), undefended 34770 (19:19), one-push 40500 (22:30), two-push 32340 (17:58).
   - Adaptive's winning push lands at 21/30, after 7 events, with the first raid at 4862 ticks (2:42).
   - The per-minute guard track matches, and one-push's idle haulers are peak 3 for 6.37 minutes.
   - What no bot exercises is stated in the archived suite report.

**One claim I verified myself.** DECISIONS.md says "every target holds from 300 to 825". The probe table doesn't show greedy or two-push at 825. I ran them with the committed script (`STRATS=adaptive,greedy,one-push,two-push`, `hive.rebuildTicks=825`, seed 1):

| Strategy | Result at 825 |
| --- | --- |
| adaptive | won at 17:08 |
| greedy | won at 16:01 |
| one-push | won at 22:19 (+30%) |
| two-push | won at 17:13 |

So targets 3, 4 and 6 hold there, as do 1 and 2 from the table, and the claim is true. Add these rows the next time the probe report is touched.

**Determinism.** This is a data-only change. The replay sets `hive.rebuildTicks` itself from tick 0, so only `dataVersion` moves in its state, and the final goes from 3b20982a to ea89d755.

**For the Director (handoff notes, not blocking):**
- **`adaptive-concentrate` is now the fastest strategy that faces raids.** It wins at 15:55 against adaptive's 16:04 (−1%; it was +27% on v16). H9 target 4, a report line by ruling 4, now holds only on its economy-ship clause: 7 lost against 3.
  - Defending only prong 0 no longer costs time, only ships. The owner may notice.
  - The guard doesn't apply, because it is measured from v18 by ruling 5. The calibration table reports the change honestly.
- **Greedy finishes level with adaptive** (16:00 against 16:04). In the bots, greedy is a late defender rather than one that ignores raids. Finding 5a stays reported, unforced.
- **The band is not monotone.** At 900 and above, one-push beats adaptive. 600 has room on both sides (300–825), but calibration beyond 825 should not be tried without re-reading targets 1 and 3.
- **The H10 report lines still print REPORTED.** Switching them to MET or MISSED is a bots-source change, and that is your call.

**Non-blocking.** The committed script's header still says "Scratch sweep for h9-design-data", and one line holds two `console.log` statements. Neither affects the results.

Required changes: none.

VERDICT: APPROVE
