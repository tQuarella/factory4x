# h10-design-data: the probe beyond h10-bots' sweep (data v17 rules, seed 1)

Every seed is the same run. The script is `reports/archive/h10-design-data-v18-sweep.mts`; run it from the worktree root as `STRATS=adaptive,greedy,undefended,one-push,two-push npx tsx <script> "label:hive.rebuildTicks=N"`. Each run is capped by the runner (45 game minutes) and prints progress.

`reports/archive/h10-bots-v17-sweep.md` already covers 450, 600 and 750. This probe adds the rest of the allowed range (300–1200), plus 825 to find the edge.

| hive.rebuildTicks | adaptive | greedy | undefended | one-push | two-push | Targets 1 / 3 / 4 |
| --- | --- | --- | --- | --- | --- | --- |
| 300 | 16:04 | 15:53 (−1%) | 20:51 (+30%) | 23:06 (+44%) | 20:34 (−11% vs one-push) | hold / hold / hold |
| 450 (h10-bots) | 16:04 | 15:52 (−1%) | 21:06 (+31%) | 22:21 (+39%) | 18:01 | hold / hold / hold |
| **600 (shipped)** | 16:04 | 16:00 (0%) | 19:19 (+20%) | 22:30 (+40%) | 17:58 | hold / hold / hold |
| 750 (h10-bots) | 16:05 | 17:05 (+6%) | 19:09 (+19%) | 22:20 (+39%) | 17:08 | hold / hold / hold |
| 825 | 17:08 | – | 19:14 (+12%) | 22:19 (+30%) | – | hold / hold / – |
| 900 | 16:04 | 18:09 (+13%) | 17:46 (+11%) | 15:22 (**−4%**) | 18:34 | hold / **miss** / hold |
| 1050 | 17:43 | 17:34 (−1%) | 19:15 (**+9%**) | 15:21 (**−13%**) | 18:35 | **miss** / **miss** / hold |
| 1200 | 17:37 | 17:15 (−2%) | 17:58 (**+2%**) | 15:20 (**−13%**) | 18:35 | **miss** / **miss** / hold |

At every period, adaptive's winning wave lands with the hive at 13–21 of 30 guards (target 2 holds), after 7 events.

**Findings:**
- **Targets 1 and 3 hold from 300 to 825.** Target 3 breaks by 900: one-push finishes ahead of adaptive (15:22). At that period the hive stays low long enough after the beaten raids that one-push's full-caps wave is much larger than it needs to be, and it wins earlier than adaptive. Target 1 breaks from 1050.
- **The shipped 600 sits in the middle of that band.** Its ±25% points (450 and 750) hold, and so do −50% (300) and +37% (825).
- **Greedy is at least 10% slower than adaptive only at 900 (+13%), where target 3 fails.** No value in the range makes greedy at least 10% slower without breaking a target, so 5a stays a reported finding.
- **The roll-on condition fails at its first clause:** allowed values do meet targets 1 and 5. `raid.rollMax` stays 0.
