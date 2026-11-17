# H9 note for h9-design-data: read before calibrating (h9-bots round 1)

This report is the final one for h9-bots, with the raid-window rule below. An earlier version of this archive (commit 9d552d8) showed adaptive at 20:46 and greedy at 20:41. **Do not calibrate around those times.** They came from one event, traced by the Critic (reviews/h9-bots.md):

- **The trace (seed 1, every seed is the same run).** At tick 28320 raid 6 launches with two prongs, a5 and p1. Adaptive sent its 5-Lancer, 8-Flak hive wave in the raid window from p1, its standing post from the previous raid, so the wave reached the hive about 60 ticks after concentrate's (which stood at a5 and took the hive at about 28590, 15:53). The a5 prong found no player ship at its rock and turned home at once. Its 5 raiders rejoined the hive mid-battle (hive guards 2 → 4 → 6 → 7), and adaptive lost all 13 warships. It rebuilt for about 9000 ticks and won at 37380 (20:46).
- **What that means.** Targets 4 and 5 measured on v15 before the fix hinged on that one timing event (where the standing guard happened to stand, and a prong coming straight home), not on what splitting the defence costs or saves.
- **The Director's ruling (DECISIONS.md, "h9-bots round 1").** In a raid with more than one prong, a live prong counts as away only if the wave has taken the hive before that prong's earliest return. Otherwise its raiders are counted back in the hive, and the wave is held or resized. `raid.prongsMax` 1 and one-prong raids are H8 to the hash.
- **Results with the rule (v15, seeds 1-3, all identical):** adaptive 15:54 (its raid-window wave leaves at 28320 against a split raid whose prongs aim at p1 and p2, 215 ticks out each, and takes the hive), greedy 20:33 (it meets two split raids; its first hive wave at 28412 fails and its second, at 36750, takes the hive), adaptive-concentrate 15:54, undefended 12:03. Target 4 reads 6 lost against 7 lost, and it cannot show a difference because adaptive and concentrate play the same game until a split raid is fought. Target 5: greedy is +29% (met), undefended is -24% (missed).
- **Open for the Director:** the raid-window rule makes the bot hold when its guards stand on two rocks at different distances, and it will not send a wave from rocks more than one round apart (piecemeal arrival is not what the estimate fights). Both are bot rules, not sim rules.

---

# Bot suite: PASS

Data version 15, 3 seeds, field mode, 8 strategies (adaptive, greedy, static, idle, drones-only, adaptive-no-raids, adaptive-concentrate, undefended). Cap 45 game minutes, softlock after 5 minutes with no ship start and no delivery, tick budget p95 ≤ 2 ms. Runs 65.2 s. Times are game minutes (m:ss). Gated for softlock and timeout: adaptive, greedy; the others are controls and are reported only.

## Failures

None.

## Per run

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 15:54 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 6 (6e 0h) | 16 | 59 | 13e 11h 16d 6l 10f | 0.0064 / 0.0123 |
| adaptive | 2 | 15:54 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 6 (6e 0h) | 16 | 59 | 13e 11h 16d 6l 10f | 0.0057 / 0.0093 |
| adaptive | 3 | 15:54 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 6 (6e 0h) | 16 | 59 | 13e 11h 16d 6l 10f | 0.0056 / 0.0083 |
| greedy | 1 | 20:33 | 8 mustered: 4 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 16 | 132 | 16e 10h 16d 15l 19f | 0.0057 / 0.0085 |
| greedy | 2 | 20:33 | 8 mustered: 4 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 16 | 132 | 16e 10h 16d 15l 19f | 0.0057 / 0.0085 |
| greedy | 3 | 20:33 | 8 mustered: 4 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 16 | 132 | 16e 10h 16d 15l 19f | 0.0058 / 0.0086 |
| idle | 1 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0046 / 0.0074 |
| idle | 2 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0045 / 0.0068 |
| idle | 3 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0045 / 0.0067 |
| drones-only | 1 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 49 | 11e 5h 48d 0l 0f | 0.0056 / 0.0079 |
| drones-only | 2 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 49 | 11e 5h 48d 0l 0f | 0.0057 / 0.0113 |
| drones-only | 3 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 49 | 11e 5h 48d 0l 0f | 0.0056 / 0.0083 |
| adaptive-no-raids | 1 | 9:46 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 42 | 8e 9h 7d 8l 10f | 0.0055 / 0.0078 |
| adaptive-no-raids | 2 | 9:46 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 42 | 8e 9h 7d 8l 10f | 0.0055 / 0.0079 |
| adaptive-no-raids | 3 | 9:46 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 42 | 8e 9h 7d 8l 10f | 0.0054 / 0.0077 |
| adaptive-concentrate | 1 | 15:54 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 7 (7e 0h) | 16 | 59 | 13e 11h 16d 6l 10f | 0.0056 / 0.0084 |
| adaptive-concentrate | 2 | 15:54 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 7 (7e 0h) | 16 | 59 | 13e 11h 16d 6l 10f | 0.0055 / 0.0082 |
| adaptive-concentrate | 3 | 15:54 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 7 (7e 0h) | 16 | 59 | 13e 11h 16d 6l 10f | 0.0056 / 0.0080 |
| undefended | 1 | 12:03 | 4 mustered: 0 beaten / 3 hit / 1 turned back | 5 (5e 0h) | 14 | 48 | 12e 7h 8d 7l 9f | 0.0057 / 0.0109 |
| undefended | 2 | 12:03 | 4 mustered: 0 beaten / 3 hit / 1 turned back | 5 (5e 0h) | 14 | 48 | 12e 7h 8d 7l 9f | 0.0055 / 0.0081 |
| undefended | 3 | 12:03 | 4 mustered: 0 beaten / 3 hit / 1 turned back | 5 (5e 0h) | 14 | 48 | 12e 7h 8d 7l 9f | 0.0055 / 0.0079 |
| static (drone-heavy 3/2/4/1/1) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0111 / 0.0124 |
| static (drone-heavy 3/2/4/1/1) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0112 / 0.0121 |
| static (drone-heavy 3/2/4/1/1) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0112 / 0.0119 |

## The static sweep (the best shape per seed is the `static` row above: a win, then the earlier hive, then the fewer economy ships lost)

Shapes (extractor / hauler / drone / lancer / flak weights): econ-lean 4/3/1/1/1; even 3/2/2/2/2; drone-heavy 3/2/4/1/1; flak-heavy 3/2/1/1/4; lancer-heavy 3/2/1/4/1; war-lean 2/1/3/2/3.

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static (econ-lean 4/3/1/1/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 32 (30e 2h) | 24 | 5 | 38e 13h 9d 4l 1f | 0.0135 / 0.0145 |
| static (even 3/2/2/2/2) | 1 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 19 (19e 0h) | 15 | 3 | 26e 7h 12d 4l 3f | 0.0111 / 0.0119 |
| static (drone-heavy 3/2/4/1/1) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0111 / 0.0124 |
| static (flak-heavy 3/2/1/1/4) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 26 (26e 0h) | 23 | 3 | 34e 11h 9d 3l 2f | 0.0109 / 0.0125 |
| static (lancer-heavy 3/2/1/4/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 24 (24e 0h) | 20 | 3 | 32e 10h 7d 8l 0f | 0.0099 / 0.0108 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0104 / 0.0112 |
| static (econ-lean 4/3/1/1/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 32 (30e 2h) | 24 | 5 | 38e 13h 9d 4l 1f | 0.0134 / 0.0146 |
| static (even 3/2/2/2/2) | 2 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 19 (19e 0h) | 15 | 3 | 26e 7h 12d 4l 3f | 0.0112 / 0.0121 |
| static (drone-heavy 3/2/4/1/1) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0112 / 0.0121 |
| static (flak-heavy 3/2/1/1/4) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 26 (26e 0h) | 23 | 3 | 34e 11h 9d 3l 2f | 0.0109 / 0.0118 |
| static (lancer-heavy 3/2/1/4/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 24 (24e 0h) | 20 | 3 | 32e 10h 7d 8l 0f | 0.0099 / 0.0110 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0104 / 0.0112 |
| static (econ-lean 4/3/1/1/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 32 (30e 2h) | 24 | 5 | 38e 13h 9d 4l 1f | 0.0134 / 0.0149 |
| static (even 3/2/2/2/2) | 3 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 19 (19e 0h) | 15 | 3 | 26e 7h 12d 4l 3f | 0.0111 / 0.0120 |
| static (drone-heavy 3/2/4/1/1) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0112 / 0.0119 |
| static (flak-heavy 3/2/1/1/4) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 26 (26e 0h) | 23 | 3 | 34e 11h 9d 3l 2f | 0.0109 / 0.0118 |
| static (lancer-heavy 3/2/1/4/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 24 (24e 0h) | 20 | 3 | 32e 10h 7d 8l 0f | 0.0099 / 0.0111 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0104 / 0.0111 |

## Staffing and the shield (H8)

Per run: idle haulers at the probe (peak, and game minutes with more than 1 idle outside raids); backed-up seconds per rock while its hauler target was met (total, with the longest run in brackets); economy ships lost in a tick that began with a warship at the raid target (must be 0: raid.shieldEcon is 1 and h8-raids is merged); the longest run with ore for the dearest unlocked warship in stock, room under the fleet limit and no bay running (the no-idle measure).

| Strategy | Seed | Idle haulers peak | Minutes with more than 1 idle | Backed up with target met (s, longest) | Economy lost under a guard | Longest idle with ore (min) |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 1 | 0 | none | 0 | 0.43 |
| adaptive | 2 | 1 | 0 | none | 0 | 0.43 |
| adaptive | 3 | 1 | 0 | none | 0 | 0.43 |
| greedy | 1 | 1 | 0 | none | 0 | 0.16 |
| greedy | 2 | 1 | 0 | none | 0 | 0.16 |
| greedy | 3 | 1 | 0 | none | 0 | 0.16 |
| idle | 1 | 1 | 0 | none | 0 | 0 |
| idle | 2 | 1 | 0 | none | 0 | 0 |
| idle | 3 | 1 | 0 | none | 0 | 0 |
| drones-only | 1 | 1 | 0 | none | 0 | 0.41 |
| drones-only | 2 | 1 | 0 | none | 0 | 0.41 |
| drones-only | 3 | 1 | 0 | none | 0 | 0.41 |
| adaptive-no-raids | 1 | 2 | 0.08 | none | 0 | 0.13 |
| adaptive-no-raids | 2 | 2 | 0.08 | none | 0 | 0.13 |
| adaptive-no-raids | 3 | 2 | 0.08 | none | 0 | 0.13 |
| adaptive-concentrate | 1 | 1 | 0 | none | 0 | 0.43 |
| adaptive-concentrate | 2 | 1 | 0 | none | 0 | 0.43 |
| adaptive-concentrate | 3 | 1 | 0 | none | 0 | 0.43 |
| undefended | 1 | 1 | 0 | none | 0 | 0.15 |
| undefended | 2 | 1 | 0 | none | 0 | 0.15 |
| undefended | 3 | 1 | 0 | none | 0 | 0.15 |
| static (drone-heavy 3/2/4/1/1) | 1 | 0 | 0 | a1 4 (4) | 0 | 0 |
| static (drone-heavy 3/2/4/1/1) | 2 | 0 | 0 | a1 4 (4) | 0 | 0 |
| static (drone-heavy 3/2/4/1/1) | 3 | 0 | 0 | a1 4 (4) | 0 | 0 |

## Trace at 15, 30 and 45 game minutes (seed 1)

Economy alive (extractors / haulers), warships alive (drones / lancers / flak), ore in stock, the weights (e/h/d/l/f) and the bays running. A run that ended earlier has fewer rows.

| Strategy | Minute | Extractors / haulers | Warships d/l/f | Stock ore | Weights e/h/d/l/f | Bays running |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | 15 | 8 / 7 | 0/6/8 | 1 | 0/1/0/0/5 | none |
| greedy | 15 | 8 / 7 | 0/6/9 | 10 | 0/0/0/0/0 | none |
| idle | 15 | 3 / 2 | 25/0/0 | 37 | 0/0/5/0/0 | none |
| idle | 30 | 3 / 2 | 25/0/0 | 669 | 0/0/5/0/0 | none |
| idle | 45 | 3 / 2 | 25/0/0 | 1297 | 0/0/5/0/0 | none |
| drones-only | 15 | 6 / 4 | 20/0/0 | 63 | 0/0/5/0/0 | none |
| drones-only | 30 | 6 / 4 | 20/0/0 | 1013 | 0/0/1/0/0 | none |
| drones-only | 45 | 6 / 4 | 20/0/0 | 1934 | 0/0/5/0/0 | none |
| adaptive-concentrate | 15 | 8 / 7 | 0/6/8 | 1 | 0/1/0/0/5 | none |
| static (drone-heavy 3/2/4/1/1) | 15 | 7 / 6 | 12/0/0 | 1 | 3/2/4/1/1 | none |
| static (drone-heavy 3/2/4/1/1) | 30 | 7 / 7 | 14/1/1 | 701 | 3/2/4/1/1 | none |
| static (drone-heavy 3/2/4/1/1) | 45 | 7 / 7 | 14/1/1 | 1509 | 3/2/4/1/1 | none |

## Prongs (H9)

Per run: raids by prong count (a raid that did not split is 1 prong), prongs by outcome (`stats.raidProngs`: beaten / hit / turned back), economy ships lost per prong target (the rock the prong went to, from `lastRaid.prongs`), and the win time against `adaptive` on the same seed (+12% is 12% slower; "-" when either did not win).

| Strategy | Seed | Raids by prong count | Prongs beaten / hit / turned back | Economy ships lost per prong target | Win time against adaptive |
| --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 1: 5 | 2 / 3 / 0 | a1 2, a5 2, p1 1 | base |
| adaptive | 2 | 1: 5 | 2 / 3 / 0 | a1 2, a5 2, p1 1 | base |
| adaptive | 3 | 1: 5 | 2 / 3 / 0 | a1 2, a5 2, p1 1 | base |
| greedy | 1 | 1: 5, 2: 2 | 6 / 3 / 0 | a1 2, a3 1, a5 1, p1 1 | +29% |
| greedy | 2 | 1: 5, 2: 2 | 6 / 3 / 0 | a1 2, a3 1, a5 1, p1 1 | +29% |
| greedy | 3 | 1: 5, 2: 2 | 6 / 3 / 0 | a1 2, a3 1, a5 1, p1 1 | +29% |
| idle | 1 | 1: 1 | 0 / 1 / 0 | a1 2 | - |
| idle | 2 | 1: 1 | 0 / 1 / 0 | a1 2 | - |
| idle | 3 | 1: 1 | 0 / 1 / 0 | a1 2 | - |
| drones-only | 1 | 1: 18 | 15 / 3 / 0 | a1 2, a3 1, a5 2 | - |
| drones-only | 2 | 1: 18 | 15 / 3 / 0 | a1 2, a3 1, a5 2 | - |
| drones-only | 3 | 1: 18 | 15 / 3 / 0 | a1 2, a3 1, a5 2 | - |
| adaptive-no-raids | 1 | none | 0 / 0 / 0 | none | -39% |
| adaptive-no-raids | 2 | none | 0 / 0 / 0 | none | -39% |
| adaptive-no-raids | 3 | none | 0 / 0 / 0 | none | -39% |
| adaptive-concentrate | 1 | 1: 5 | 2 / 3 / 0 | a1 2, a5 2, p1 1 | +0% |
| adaptive-concentrate | 2 | 1: 5 | 2 / 3 / 0 | a1 2, a5 2, p1 1 | +0% |
| adaptive-concentrate | 3 | 1: 5 | 2 / 3 / 0 | a1 2, a5 2, p1 1 | +0% |
| undefended | 1 | 1: 4 | 0 / 3 / 1 | a1 2, a5 2, p1 1 | -24% |
| undefended | 2 | 1: 4 | 0 / 3 / 1 | a1 2, a5 2, p1 1 | -24% |
| undefended | 3 | 1: 4 | 0 / 3 / 1 | a1 2, a5 2, p1 1 | -24% |
| static (drone-heavy 3/2/4/1/1) | 1 | 1: 15 | 0 / 14 / 1 | a1 2, p1 12, p2 1 | - |
| static (drone-heavy 3/2/4/1/1) | 2 | 1: 15 | 0 / 14 / 1 | a1 2, p1 12, p2 1 | - |
| static (drone-heavy 3/2/4/1/1) | 3 | 1: 15 | 0 / 14 / 1 | a1 2, p1 12, p2 1 | - |

## What no bot exercises

Bots stay on Auto haulers and use only `sendShips` and `recycleShips` (and the weights and the rally). No bot uses: `setExtractors` (they stay on All), the drag gesture (a client gesture), `setHaulers`, `moveShips`, `recycleFleet`, or Mine mode (a client mode; the bots never send `setMine` and play with the marks the map starts with). Sim tests and the reference replay cover `setExtractors`, `setHaulers`, `moveShips` and `recycleFleet`; h8-client smoke tests cover the drag and Mine mode.

## H7 capability flags (report lines, not gates)

1. MET: Splitting matters: static either loses at least half the economy ships it built to raids or fails to take the hive within the cap, and adaptive takes the hive
   - static/1 (drone-heavy 3/2/4/1/1) timeout, lost 15 of 29 economy ships ok; static/2 (drone-heavy 3/2/4/1/1) timeout, lost 15 of 29 economy ships ok; static/3 (drone-heavy 3/2/4/1/1) timeout, lost 15 of 29 economy ships ok; adaptive/1 won, adaptive/2 won, adaptive/3 won
2. MET: Greed is answered by raids: greedy's first hitting raid kills at least 2 economy ships, and greedy still wins after responding
   - greedy/1 first hit killed 2, won ok; greedy/2 first hit killed 2, won ok; greedy/3 first hit killed 2, won ok
3. MET: Waiting is safe: idle is raided at most once
   - idle/1 raids mustered 1 (hit 1, beaten 0, turned back 0) ok; idle/2 raids mustered 1 (hit 1, beaten 0, turned back 0) ok; idle/3 raids mustered 1 (hit 1, beaten 0, turned back 0) ok
4. MET: The counter-attack window is real: the hive's smallest winning wave with a full-size raid out is at least 30% smaller than at full strength
   - best mix at full strength 16; with a raid of 4 Thorns and 8 Spores out 11
5. MET: Counters matter: drones-only can't take the hive within field.fleetCap minus 10 economy ships (its best drone wave doesn't fit)
   - smallest drone wave none within 30 against 20 warship slots (field.fleetCap 30 minus 10)
6. MET: Economy against offence is a trade in slots: the hive's best mix plus a full economy is more than field.fleetCap, and the best mix plus 10 economy ships fits
   - best mix 16; full economy 21 (13 Mine slots plus 8 haulers at adaptive's peak); field.fleetCap 30; best mix + full economy = 37, best mix + 10 = 26
7. MET: No free first win: every guarded node needs more drones than the opening stock buys
   - p1 needs more than 3 drones (2 buyable from the opening stock) ok; p2 needs more than 3 drones (2 buyable from the opening stock) ok; heart needs more than 3 drones (2 buyable from the opening stock) ok

## H9 report lines (not gate flags until h9-design-data says they hold)

Calibration targets 4 and 5. Greedy plays adaptive after its first hit, so its half of target 5 may move to `undefended` (Director ruling, DECISIONS.md).

1. MISSED: Splitting matters: adaptive-concentrate loses at least 2 more economy ships to raids than adaptive, on every seed
   - seed 1: adaptive lost 6, concentrate lost 7 MISS; seed 2: adaptive lost 6, concentrate lost 7 MISS; seed 3: adaptive lost 6, concentrate lost 7 MISS
2. MISSED: Ignoring raids costs: greedy and undefended each finish at least 10% slower than adaptive (undefended may fail to win)
   - greedy half met, undefended half MISSED. greedy: seed 1 +29% ok, seed 2 +29% ok, seed 3 +29% ok; undefended: seed 1 -24% MISS, seed 2 -24% MISS, seed 3 -24% MISS
