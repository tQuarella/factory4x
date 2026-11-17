# Bot suite: PASS

Data version 18, 3 seeds, field mode, 10 strategies (adaptive, greedy, static, idle, drones-only, adaptive-no-raids, adaptive-concentrate, undefended, one-push, two-push). Cap 45 game minutes, softlock after 5 minutes with no ship start and no delivery, tick budget p95 ≤ 2 ms. Runs 96.2 s. Times are game minutes (m:ss). Gated for softlock and timeout: adaptive, greedy; the others are controls and are reported only.

## Failures

None.

## Per run

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 16:04 | 6 mustered: 3 beaten / 2 hit / 1 turned back | 3 (3e 0h) | 18 | 62 | 12e 10h 24d 6l 9f | 0.0067 / 0.0134 |
| adaptive | 2 | 16:04 | 6 mustered: 3 beaten / 2 hit / 1 turned back | 3 (3e 0h) | 18 | 62 | 12e 10h 24d 6l 9f | 0.0058 / 0.0124 |
| adaptive | 3 | 16:04 | 6 mustered: 3 beaten / 2 hit / 1 turned back | 3 (3e 0h) | 18 | 62 | 12e 10h 24d 6l 9f | 0.0058 / 0.0120 |
| greedy | 1 | 16:00 | 6 mustered: 3 beaten / 3 hit / 0 turned back | 4 (4e 0h) | 18 | 67 | 14e 9h 24d 6l 8f | 0.0057 / 0.0108 |
| greedy | 2 | 16:00 | 6 mustered: 3 beaten / 3 hit / 0 turned back | 4 (4e 0h) | 18 | 67 | 14e 9h 24d 6l 8f | 0.0058 / 0.0108 |
| greedy | 3 | 16:00 | 6 mustered: 3 beaten / 3 hit / 0 turned back | 4 (4e 0h) | 18 | 67 | 14e 9h 24d 6l 8f | 0.0056 / 0.0100 |
| idle | 1 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0044 / 0.0078 |
| idle | 2 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0044 / 0.0077 |
| idle | 3 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0044 / 0.0081 |
| drones-only | 1 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 46 | 11e 5h 39d 0l 0f | 0.0056 / 0.0098 |
| drones-only | 2 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 46 | 11e 5h 39d 0l 0f | 0.0056 / 0.0090 |
| drones-only | 3 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 46 | 11e 5h 39d 0l 0f | 0.0056 / 0.0096 |
| adaptive-no-raids | 1 | 9:42 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 34 | 8e 8h 7d 8l 10f | 0.0054 / 0.0099 |
| adaptive-no-raids | 2 | 9:42 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 34 | 8e 8h 7d 8l 10f | 0.0053 / 0.0090 |
| adaptive-no-raids | 3 | 9:42 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 34 | 8e 8h 7d 8l 10f | 0.0055 / 0.0092 |
| adaptive-concentrate | 1 | 15:55 | 6 mustered: 1 beaten / 4 hit / 0 turned back | 7 (7e 0h) | 16 | 50 | 13e 8h 19d 7l 8f | 0.0055 / 0.0103 |
| adaptive-concentrate | 2 | 15:55 | 6 mustered: 1 beaten / 4 hit / 0 turned back | 7 (7e 0h) | 16 | 50 | 13e 8h 19d 7l 8f | 0.0055 / 0.0097 |
| adaptive-concentrate | 3 | 15:55 | 6 mustered: 1 beaten / 4 hit / 0 turned back | 7 (7e 0h) | 16 | 50 | 13e 8h 19d 7l 8f | 0.0055 / 0.0096 |
| undefended | 1 | 19:19 | 7 mustered: 0 beaten / 3 hit / 3 turned back | 7 (7e 0h) | 16 | 94 | 14e 9h 18d 7l 19f | 0.0055 / 0.0106 |
| undefended | 2 | 19:19 | 7 mustered: 0 beaten / 3 hit / 3 turned back | 7 (7e 0h) | 16 | 94 | 14e 9h 18d 7l 19f | 0.0054 / 0.0097 |
| undefended | 3 | 19:19 | 7 mustered: 0 beaten / 3 hit / 3 turned back | 7 (7e 0h) | 16 | 94 | 14e 9h 18d 7l 19f | 0.0054 / 0.0095 |
| one-push | 1 | 22:30 | 7 mustered: 4 beaten / 2 hit / 1 turned back | 3 (3e 0h) | 14 | 69 | 10e 8h 24d 14l 22f | 0.0058 / 0.0115 |
| one-push | 2 | 22:30 | 7 mustered: 4 beaten / 2 hit / 1 turned back | 3 (3e 0h) | 14 | 69 | 10e 8h 24d 14l 22f | 0.0060 / 0.0102 |
| one-push | 3 | 22:30 | 7 mustered: 4 beaten / 2 hit / 1 turned back | 3 (3e 0h) | 14 | 69 | 10e 8h 24d 14l 22f | 0.0057 / 0.0098 |
| two-push | 1 | 17:58 | 6 mustered: 4 beaten / 2 hit / 0 turned back | 3 (3e 0h) | 16 | 61 | 11e 8h 27d 7l 21f | 0.0056 / 0.0105 |
| two-push | 2 | 17:58 | 6 mustered: 4 beaten / 2 hit / 0 turned back | 3 (3e 0h) | 16 | 61 | 11e 8h 27d 7l 21f | 0.0055 / 0.0102 |
| two-push | 3 | 17:58 | 6 mustered: 4 beaten / 2 hit / 0 turned back | 3 (3e 0h) | 16 | 61 | 11e 8h 27d 7l 21f | 0.0054 / 0.0086 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0101 / 0.0124 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0103 / 0.0124 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0103 / 0.0123 |

## The static sweep (the best shape per seed is the `static` row above: a win, then the earlier hive, then the fewer economy ships lost)

Shapes (extractor / hauler / drone / lancer / flak weights): econ-lean 4/3/1/1/1; even 3/2/2/2/2; drone-heavy 3/2/4/1/1; flak-heavy 3/2/1/1/4; lancer-heavy 3/2/1/4/1; war-lean 2/1/3/2/3.

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static (econ-lean 4/3/1/1/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 32 (30e 2h) | 24 | 5 | 38e 13h 9d 4l 1f | 0.0132 / 0.0156 |
| static (even 3/2/2/2/2) | 1 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 19 (19e 0h) | 15 | 3 | 26e 7h 11d 5l 3f | 0.0109 / 0.0133 |
| static (drone-heavy 3/2/4/1/1) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 17 (17e 0h) | 13 | 3 | 23e 7h 17d 2l 1f | 0.0082 / 0.0111 |
| static (flak-heavy 3/2/1/1/4) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 26 (26e 0h) | 23 | 3 | 34e 11h 9d 3l 2f | 0.0107 / 0.0150 |
| static (lancer-heavy 3/2/1/4/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 24 (24e 0h) | 20 | 3 | 32e 10h 7d 8l 0f | 0.0098 / 0.0143 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0101 / 0.0124 |
| static (econ-lean 4/3/1/1/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 32 (30e 2h) | 24 | 5 | 38e 13h 9d 4l 1f | 0.0134 / 0.0233 |
| static (even 3/2/2/2/2) | 2 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 19 (19e 0h) | 15 | 3 | 26e 7h 11d 5l 3f | 0.0108 / 0.0130 |
| static (drone-heavy 3/2/4/1/1) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 17 (17e 0h) | 13 | 3 | 23e 7h 17d 2l 1f | 0.0082 / 0.0106 |
| static (flak-heavy 3/2/1/1/4) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 26 (26e 0h) | 23 | 3 | 34e 11h 9d 3l 2f | 0.0113 / 0.0177 |
| static (lancer-heavy 3/2/1/4/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 24 (24e 0h) | 20 | 3 | 32e 10h 7d 8l 0f | 0.0097 / 0.0125 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0103 / 0.0124 |
| static (econ-lean 4/3/1/1/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 32 (30e 2h) | 24 | 5 | 38e 13h 9d 4l 1f | 0.0132 / 0.0153 |
| static (even 3/2/2/2/2) | 3 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 19 (19e 0h) | 15 | 3 | 26e 7h 11d 5l 3f | 0.0110 / 0.0136 |
| static (drone-heavy 3/2/4/1/1) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 17 (17e 0h) | 13 | 3 | 23e 7h 17d 2l 1f | 0.0084 / 0.0150 |
| static (flak-heavy 3/2/1/1/4) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 26 (26e 0h) | 23 | 3 | 34e 11h 9d 3l 2f | 0.0107 / 0.0129 |
| static (lancer-heavy 3/2/1/4/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 24 (24e 0h) | 20 | 3 | 32e 10h 7d 8l 0f | 0.0097 / 0.0117 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0103 / 0.0123 |

## Staffing and the shield (H8)

Per run: idle haulers at the probe (peak, and game minutes with more than 1 idle outside raids); backed-up seconds per rock while its hauler target was met (total, with the longest run in brackets); economy ships lost in a tick that began with a warship at the raid target (must be 0: raid.shieldEcon is 1 and h8-raids is merged); the longest run with ore for the dearest unlocked warship in stock, room under the fleet limit and no bay running (the no-idle measure).

| Strategy | Seed | Idle haulers peak | Minutes with more than 1 idle | Backed up with target met (s, longest) | Economy lost under a guard | Longest idle with ore (min) |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 1 | 0 | none | 0 | 0.32 |
| adaptive | 2 | 1 | 0 | none | 0 | 0.32 |
| adaptive | 3 | 1 | 0 | none | 0 | 0.32 |
| greedy | 1 | 0 | 0 | none | 0 | 0.37 |
| greedy | 2 | 0 | 0 | none | 0 | 0.37 |
| greedy | 3 | 0 | 0 | none | 0 | 0.37 |
| idle | 1 | 1 | 0 | none | 0 | 0 |
| idle | 2 | 1 | 0 | none | 0 | 0 |
| idle | 3 | 1 | 0 | none | 0 | 0 |
| drones-only | 1 | 1 | 0 | none | 0 | 0.43 |
| drones-only | 2 | 1 | 0 | none | 0 | 0.43 |
| drones-only | 3 | 1 | 0 | none | 0 | 0.43 |
| adaptive-no-raids | 1 | 1 | 0 | none | 0 | 0.12 |
| adaptive-no-raids | 2 | 1 | 0 | none | 0 | 0.12 |
| adaptive-no-raids | 3 | 1 | 0 | none | 0 | 0.12 |
| adaptive-concentrate | 1 | 1 | 0 | none | 0 | 0.41 |
| adaptive-concentrate | 2 | 1 | 0 | none | 0 | 0.41 |
| adaptive-concentrate | 3 | 1 | 0 | none | 0 | 0.41 |
| undefended | 1 | 1 | 0 | none | 0 | 0.34 |
| undefended | 2 | 1 | 0 | none | 0 | 0.34 |
| undefended | 3 | 1 | 0 | none | 0 | 0.34 |
| one-push | 1 | 3 | 6.37 | none | 0 | 0.4 |
| one-push | 2 | 3 | 6.37 | none | 0 | 0.4 |
| one-push | 3 | 3 | 6.37 | none | 0 | 0.4 |
| two-push | 1 | 1 | 0 | none | 0 | 0.37 |
| two-push | 2 | 1 | 0 | none | 0 | 0.37 |
| two-push | 3 | 1 | 0 | none | 0 | 0.37 |
| static (war-lean 2/1/3/2/3) | 1 | 0 | 0 | a1 4 (4), p2 6 (6) | 0 | 0 |
| static (war-lean 2/1/3/2/3) | 2 | 0 | 0 | a1 4 (4), p2 6 (6) | 0 | 0 |
| static (war-lean 2/1/3/2/3) | 3 | 0 | 0 | a1 4 (4), p2 6 (6) | 0 | 0 |

## Trace at 15, 30 and 45 game minutes (seed 1)

Economy alive (extractors / haulers), warships alive (drones / lancers / flak), ore in stock, the weights (e/h/d/l/f) and the bays running. A run that ended earlier has fewer rows.

| Strategy | Minute | Extractors / haulers | Warships d/l/f | Stock ore | Weights e/h/d/l/f | Bays running |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | 15 | 9 / 9 | 2/4/5 | 1 | 0/0/0/3/5 | none |
| greedy | 15 | 9 / 9 | 3/4/4 | 1 | 0/0/0/2/5 | none |
| idle | 15 | 3 / 2 | 25/0/0 | 37 | 0/0/5/0/0 | none |
| idle | 30 | 3 / 2 | 25/0/0 | 669 | 0/0/5/0/0 | none |
| idle | 45 | 3 / 2 | 25/0/0 | 1297 | 0/0/5/0/0 | none |
| drones-only | 15 | 4 / 3 | 23/0/0 | 29 | 0/0/5/0/0 | none |
| drones-only | 30 | 4 / 3 | 23/0/0 | 757 | 0/0/1/0/0 | none |
| drones-only | 45 | 4 / 3 | 23/0/0 | 1445 | 0/0/5/0/0 | none |
| adaptive-concentrate | 15 | 8 / 8 | 0/7/7 | 32 | 0/0/0/0/0 | none |
| undefended | 15 | 7 / 5 | 3/0/4 | 1 | 1/1/2/0/5 | none |
| one-push | 15 | 7 / 7 | 2/5/8 | 1 | 0/0/0/5/5 | none |
| two-push | 15 | 7 / 7 | 6/0/0 | 19 | 0/0/0/0/0 | none |
| static (war-lean 2/1/3/2/3) | 15 | 5 / 4 | 10/1/3 | 1 | 2/1/3/2/3 | none |
| static (war-lean 2/1/3/2/3) | 30 | 5 / 5 | 12/2/6 | 487 | 2/1/3/2/3 | none |
| static (war-lean 2/1/3/2/3) | 45 | 5 / 5 | 12/2/6 | 1147 | 2/1/3/2/3 | none |

## Prongs (H9)

Per run: raids by prong count (a raid that did not split is 1 prong), prongs by outcome (`stats.raidProngs`: beaten / hit / turned back), economy ships lost per prong target (the rock the prong went to, from `lastRaid.prongs`), and the win time against `adaptive` on the same seed (+12% is 12% slower; "-" when either did not win).

| Strategy | Seed | Raids by prong count | Prongs beaten / hit / turned back | Economy ships lost per prong target | Win time against adaptive |
| --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 1: 2, 2: 4 | 7 / 2 / 1 | a1 2, a3 1, a5 0, p1 0 | base |
| adaptive | 2 | 1: 2, 2: 4 | 7 / 2 / 1 | a1 2, a3 1, a5 0, p1 0 | base |
| adaptive | 3 | 1: 2, 2: 4 | 7 / 2 / 1 | a1 2, a3 1, a5 0, p1 0 | base |
| greedy | 1 | 1: 2, 2: 4 | 7 / 3 / 0 | a1 2, a3 1, a5 1, p1 0 | +0% |
| greedy | 2 | 1: 2, 2: 4 | 7 / 3 / 0 | a1 2, a3 1, a5 1, p1 0 | +0% |
| greedy | 3 | 1: 2, 2: 4 | 7 / 3 / 0 | a1 2, a3 1, a5 1, p1 0 | +0% |
| idle | 1 | 1: 1 | 0 / 1 / 0 | a1 2 | - |
| idle | 2 | 1: 1 | 0 / 1 / 0 | a1 2 | - |
| idle | 3 | 1: 1 | 0 / 1 / 0 | a1 2 | - |
| drones-only | 1 | 1: 16, 2: 2 | 17 / 3 / 0 | a1 2, a3 1, a4 0, a5 2 | - |
| drones-only | 2 | 1: 16, 2: 2 | 17 / 3 / 0 | a1 2, a3 1, a4 0, a5 2 | - |
| drones-only | 3 | 1: 16, 2: 2 | 17 / 3 / 0 | a1 2, a3 1, a4 0, a5 2 | - |
| adaptive-no-raids | 1 | none | 0 / 0 / 0 | none | -40% |
| adaptive-no-raids | 2 | none | 0 / 0 / 0 | none | -40% |
| adaptive-no-raids | 3 | none | 0 / 0 / 0 | none | -40% |
| adaptive-concentrate | 1 | 1: 2, 2: 3 | 4 / 4 / 0 | a1 2, a3 1, a4 1, a5 0, p1 1 | -1% |
| adaptive-concentrate | 2 | 1: 2, 2: 3 | 4 / 4 / 0 | a1 2, a3 1, a4 1, a5 0, p1 1 | -1% |
| adaptive-concentrate | 3 | 1: 2, 2: 3 | 4 / 4 / 0 | a1 2, a3 1, a4 1, a5 0, p1 1 | -1% |
| undefended | 1 | 1: 5, 2: 1 | 0 / 4 / 3 | a1 2, a3 1, a5 2, p1 1 | +20% |
| undefended | 2 | 1: 5, 2: 1 | 0 / 4 / 3 | a1 2, a3 1, a5 2, p1 1 | +20% |
| undefended | 3 | 1: 5, 2: 1 | 0 / 4 / 3 | a1 2, a3 1, a5 2, p1 1 | +20% |
| one-push | 1 | 1: 4, 2: 3 | 7 / 2 / 1 | a1 2, a3 1, a5 0, p1 0 | +40% |
| one-push | 2 | 1: 4, 2: 3 | 7 / 2 / 1 | a1 2, a3 1, a5 0, p1 0 | +40% |
| one-push | 3 | 1: 4, 2: 3 | 7 / 2 / 1 | a1 2, a3 1, a5 0, p1 0 | +40% |
| two-push | 1 | 1: 3, 2: 3 | 7 / 2 / 0 | a1 2, a3 1, a5 0, p1 0 | +12% |
| two-push | 2 | 1: 3, 2: 3 | 7 / 2 / 0 | a1 2, a3 1, a5 0, p1 0 | +12% |
| two-push | 3 | 1: 3, 2: 3 | 7 / 2 / 0 | a1 2, a3 1, a5 0, p1 0 | +12% |
| static (war-lean 2/1/3/2/3) | 1 | 1: 14 | 0 / 14 / 0 | a1 2, p1 13 | - |
| static (war-lean 2/1/3/2/3) | 2 | 1: 14 | 0 / 14 / 0 | a1 2, p1 13 | - |
| static (war-lean 2/1/3/2/3) | 3 | 1: 14 | 0 / 14 / 0 | a1 2, p1 13 | - |

## The hive (H10)

Per run, at hive.rebuildTicks 600 (the shipped value): the hive's guards lost to raids (raiders killed at rocks) and to pushes (killed in battles at the hive); its guards at home when the winning wave landed, against its caps; the hive-damaging events before the win (a prong beaten with 3 or more raiders killed, or a lost push that killed 5 or more guards); the prongs that rolled on (`raidRolls`); and the win time against adaptive on the same seed.

| Strategy | Seed | Lost to raids | Lost to pushes | At home when the winning wave landed | Events before the win | Raid rolls | Win time against adaptive |
| --- | --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 28 | 21 | 21/30 (70%) | 7 | 0 | base |
| adaptive | 2 | 28 | 21 | 21/30 (70%) | 7 | 0 | base |
| adaptive | 3 | 28 | 21 | 21/30 (70%) | 7 | 0 | base |
| greedy | 1 | 29 | 21 | 21/30 (70%) | 7 | 0 | +0% |
| greedy | 2 | 29 | 21 | 21/30 (70%) | 7 | 0 | +0% |
| greedy | 3 | 29 | 21 | 21/30 (70%) | 7 | 0 | +0% |
| idle | 1 | 0 | 0 | - | 0 | 0 | - |
| idle | 2 | 0 | 0 | - | 0 | 0 | - |
| idle | 3 | 0 | 0 | - | 0 | 0 | - |
| drones-only | 1 | 65 | 0 | - | 17 | 0 | - |
| drones-only | 2 | 65 | 0 | - | 17 | 0 | - |
| drones-only | 3 | 65 | 0 | - | 17 | 0 | - |
| adaptive-no-raids | 1 | 0 | 30 | 30/30 (100%) | 0 | 0 | -40% |
| adaptive-no-raids | 2 | 0 | 30 | 30/30 (100%) | 0 | 0 | -40% |
| adaptive-no-raids | 3 | 0 | 30 | 30/30 (100%) | 0 | 0 | -40% |
| adaptive-concentrate | 1 | 13 | 22 | 22/30 (73%) | 4 | 0 | -1% |
| adaptive-concentrate | 2 | 13 | 22 | 22/30 (73%) | 4 | 0 | -1% |
| adaptive-concentrate | 3 | 13 | 22 | 22/30 (73%) | 4 | 0 | -1% |
| undefended | 1 | 0 | 40 | 17/30 (57%) | 1 | 0 | +20% |
| undefended | 2 | 0 | 40 | 17/30 (57%) | 1 | 0 | +20% |
| undefended | 3 | 0 | 40 | 17/30 (57%) | 1 | 0 | +20% |
| one-push | 1 | 25 | 44 | 18/30 (60%) | 7 | 0 | +40% |
| one-push | 2 | 25 | 44 | 18/30 (60%) | 7 | 0 | +40% |
| one-push | 3 | 25 | 44 | 18/30 (60%) | 7 | 0 | +40% |
| two-push | 1 | 21 | 35 | 19/30 (63%) | 8 | 0 | +12% |
| two-push | 2 | 21 | 35 | 19/30 (63%) | 8 | 0 | +12% |
| two-push | 3 | 21 | 35 | 19/30 (63%) | 8 | 0 | +12% |
| static (war-lean 2/1/3/2/3) | 1 | 0 | 0 | - | 0 | 0 | - |
| static (war-lean 2/1/3/2/3) | 2 | 0 | 0 | - | 0 | 0 | - |
| static (war-lean 2/1/3/2/3) | 3 | 0 | 0 | - | 0 | 0 | - |

Adaptive's hive guards at home at each game minute, seed 1 (from minute 1):

30 30 27 30 30 27 30 30 29 30 23 27 30 24 27 21

### The sweep (H10, report only)

Seed 1 only: every seed is the same run. Strategies: the gated ones (adaptive, greedy) and the controls undefended, one-push and two-push, at hive.rebuildTicks 450, 600, 750. Win time against adaptive at the same period. This is h10-design-data's starting point.

| hive.rebuildTicks | Strategy | Time to the hive | Against adaptive | Raids by outcome | Economy ships lost | Lost to raids | Lost to pushes | At home when the winning wave landed | Events before the win | Raid rolls |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 450 | adaptive | 16:04 | base | 6 mustered: 3 beaten / 2 hit / 1 turned back | 3 | 28 | 21 | 21/30 (70%) | 7 | 0 |
| 450 | greedy | 15:52 | -1% | 6 mustered: 2 beaten / 3 hit / 0 turned back | 6 | 20 | 21 | 21/30 (70%) | 5 | 0 |
| 450 | undefended | 21:06 | +31% | 8 mustered: 0 beaten / 4 hit / 3 turned back | 8 | 0 | 46 | 23/30 (77%) | 1 | 0 |
| 450 | one-push | 22:21 | +39% | 7 mustered: 4 beaten / 2 hit / 1 turned back | 3 | 25 | 52 | 28/30 (93%) | 7 | 0 |
| 450 | two-push | 18:01 | +12% | 7 mustered: 4 beaten / 2 hit / 0 turned back | 3 | 21 | 40 | 24/30 (80%) | 8 | 0 |
| 600 | adaptive | 16:04 | base | 6 mustered: 3 beaten / 2 hit / 1 turned back | 3 | 28 | 21 | 21/30 (70%) | 7 | 0 |
| 600 | greedy | 16:00 | 0% | 6 mustered: 3 beaten / 3 hit / 0 turned back | 4 | 29 | 21 | 21/30 (70%) | 7 | 0 |
| 600 | undefended | 19:19 | +20% | 7 mustered: 0 beaten / 3 hit / 3 turned back | 7 | 0 | 40 | 17/30 (57%) | 1 | 0 |
| 600 | one-push | 22:30 | +40% | 7 mustered: 4 beaten / 2 hit / 1 turned back | 3 | 25 | 44 | 18/30 (60%) | 7 | 0 |
| 600 | two-push | 17:58 | +12% | 6 mustered: 4 beaten / 2 hit / 0 turned back | 3 | 21 | 35 | 19/30 (63%) | 8 | 0 |
| 750 | adaptive | 16:05 | base | 6 mustered: 3 beaten / 2 hit / 1 turned back | 3 | 28 | 20 | 20/30 (67%) | 7 | 0 |
| 750 | greedy | 17:05 | +6% | 6 mustered: 3 beaten / 3 hit / 0 turned back | 4 | 29 | 21 | 6/30 (20%) | 8 | 0 |
| 750 | undefended | 19:09 | +19% | 6 mustered: 0 beaten / 3 hit / 3 turned back | 6 | 0 | 44 | 20/30 (67%) | 1 | 0 |
| 750 | one-push | 22:20 | +39% | 6 mustered: 3 beaten / 2 hit / 1 turned back | 3 | 20 | 43 | 19/30 (63%) | 6 | 0 |
| 750 | two-push | 17:08 | +7% | 5 mustered: 3 beaten / 2 hit / 0 turned back | 3 | 20 | 30 | 14/30 (47%) | 8 | 0 |

Targets per period (1: undefended at least 10% slower or no win; 2: adaptive at most 75% of caps when the winning wave landed, with at least 2 events; 3: one-push at least 10% slower or no win; 4: two-push no more than 10% behind one-push, or wins where one-push does not; 6: adaptive 15 to 30 min, greedy at most 40, first raid 2 to 6 min):

| hive.rebuildTicks | 1 | 2 | 3 | 4 | 6 |
| --- | --- | --- | --- | --- | --- |
| 450 | holds | holds | holds | holds | holds |
| 600 | holds | holds | holds | holds | holds |
| 750 | holds | holds | holds | holds | holds |

## What no bot exercises

Bots stay on Auto haulers and use only `sendShips` and `recycleShips` (and the weights and the rally). No bot uses: `setExtractors` (they stay on All), the drag gesture (a client gesture), `setHaulers`, `moveShips`, `recycleFleet`, or Mine mode (a client mode; the bots never send `setMine` and play with the marks the map starts with). Sim tests and the reference replay cover `setExtractors`, `setHaulers`, `moveShips` and `recycleFleet`; h8-client smoke tests cover the drag and Mine mode.

## H7 capability flags (report lines, not gates)

1. MET: Splitting matters: static either loses at least half the economy ships it built to raids or fails to take the hive within the cap, and adaptive takes the hive
   - static/1 (war-lean 2/1/3/2/3) timeout, lost 15 of 25 economy ships ok; static/2 (war-lean 2/1/3/2/3) timeout, lost 15 of 25 economy ships ok; static/3 (war-lean 2/1/3/2/3) timeout, lost 15 of 25 economy ships ok; adaptive/1 won, adaptive/2 won, adaptive/3 won
2. MET: Greed is answered by raids: greedy's first hitting raid kills at least 2 economy ships, and greedy still wins after responding
   - greedy/1 first hit killed 2, won ok; greedy/2 first hit killed 2, won ok; greedy/3 first hit killed 2, won ok
3. MET: Waiting is safe: idle is raided at most once
   - idle/1 raids mustered 1 (hit 1, beaten 0, turned back 0) ok; idle/2 raids mustered 1 (hit 1, beaten 0, turned back 0) ok; idle/3 raids mustered 1 (hit 1, beaten 0, turned back 0) ok
4. MET: The counter-attack window is real: the hive's smallest winning wave with a full-size raid out is at least 30% smaller than at full strength
   - best mix at full strength 15; with a raid of 4 Thorns and 8 Spores out 9
5. MET: Counters matter: drones-only can't take the hive within field.fleetCap minus 10 economy ships (its best drone wave doesn't fit)
   - smallest drone wave none within 30 against 20 warship slots (field.fleetCap 30 minus 10)
6. MET: Economy against offence is a trade in slots: the hive's best mix plus a full economy is more than field.fleetCap, and the best mix plus 10 economy ships fits
   - best mix 15; full economy 22 (13 Mine slots plus 9 haulers at adaptive's peak); field.fleetCap 30; best mix + full economy = 37, best mix + 10 = 25
7. MET: No free first win: every guarded node needs more drones than the opening stock buys
   - p1 needs more than 3 drones (2 buyable from the opening stock) ok; p2 needs more than 3 drones (2 buyable from the opening stock) ok; heart needs more than 3 drones (2 buyable from the opening stock) ok

## H9 report lines (report lines, not gates)

Calibration target 4 (reworded) and targets 5a and 5b, which are reported findings for H9, not targets (Director, 2026-11-16; DECISIONS.md).

1. MET: Splitting matters: adaptive-concentrate loses at least 2 more economy ships to raids than adaptive, or finishes at least 10% slower, on every seed
   - seed 1: adaptive lost 3, concentrate lost 7, concentrate -1% ok; seed 2: adaptive lost 3, concentrate lost 7, concentrate -1% ok; seed 3: adaptive lost 3, concentrate lost 7, concentrate -1% ok
2. REPORTED: Ignoring raids costs (5a, reported finding): greedy against adaptive
   - greedy: seed 1 +0% (under 10% slower), seed 2 +0% (under 10% slower), seed 3 +0% (under 10% slower)
3. REPORTED: Ignoring raids costs (5b, report-only rule finding): undefended against adaptive (undefended may fail to win)
   - undefended: seed 1 +20% (at least 10% slower), seed 2 +20% (at least 10% slower), seed 3 +20% (at least 10% slower)

## H10 report lines (report lines, not gates)

Calibration targets 1 to 6. They read REPORTED until h10-design-data says they hold; the "ok" and "MISS" in each line are the measure against the target, at hive.rebuildTicks 600.

1. REPORTED: H10 target 1, defending pays: undefended finishes at least 10% slower than adaptive, or does not win
   - seed 1: undefended +20% against adaptive ok; seed 2: undefended +20% against adaptive ok; seed 3: undefended +20% against adaptive ok
2. REPORTED: H10 target 2, attrition shows: the hive is at most 75% of its caps when the winning wave lands in adaptive's run, after at least 2 hive-damaging events (a prong beaten with 3 or more raiders killed, or a push that kills 5 or more guards)
   - seed 1: 21/30 guards at home when the winning wave landed (70%, at most 75%: yes), 7 hive-damaging events before the win (at least 2: yes) ok; seed 2: 21/30 guards at home when the winning wave landed (70%, at most 75%: yes), 7 hive-damaging events before the win (at least 2: yes) ok; seed 3: 21/30 guards at home when the winning wave landed (70%, at most 75%: yes), 7 hive-damaging events before the win (at least 2: yes) ok
3. REPORTED: H10 target 3, one push is slower: one-push finishes at least 10% slower than adaptive, or does not win
   - seed 1: one-push +40% against adaptive ok; seed 2: one-push +40% against adaptive ok; seed 3: one-push +40% against adaptive ok
4. REPORTED: H10 target 4, a lost push is not wasted: two-push finishes no more than 10% behind one-push, or wins where one-push does not
   - seed 1: two-push -20% against one-push ok; seed 2: two-push -20% against one-push ok; seed 3: two-push -20% against one-push ok
5. REPORTED: H10 target 5, robust: targets 1 and 3 still hold at 0.75 and 1.25 times the shipped hive.rebuildTicks
   - hive.rebuildTicks 450: target 1 holds, target 3 holds; hive.rebuildTicks 750: target 1 holds, target 3 holds (shipped 600, sweep on seed 1)
6. REPORTED: H10 target 6, pace: adaptive takes 15 to 30 game minutes, greedy at most 40, and the first raid comes at 2 to 6 minutes
   - seed 1: adaptive 16.1 min (15 to 30: yes), greedy 16.0 min (at most 40: yes), first raid at 2.7 min (2 to 6: yes) ok; seed 2: adaptive 16.1 min (15 to 30: yes), greedy 16.0 min (at most 40: yes), first raid at 2.7 min (2 to 6: yes) ok; seed 3: adaptive 16.1 min (15 to 30: yes), greedy 16.0 min (at most 40: yes), first raid at 2.7 min (2 to 6: yes) ok
