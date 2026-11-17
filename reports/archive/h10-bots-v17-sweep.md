# Bot suite: PASS

Data version 17, 3 seeds, field mode, 10 strategies (adaptive, greedy, static, idle, drones-only, adaptive-no-raids, adaptive-concentrate, undefended, one-push, two-push). Cap 45 game minutes, softlock after 5 minutes with no ship start and no delivery, tick budget p95 ≤ 2 ms. Runs 173.8 s. Times are game minutes (m:ss). Gated for softlock and timeout: adaptive, greedy; the others are controls and are reported only.

## Failures

None.

## Per run

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 18:20 | 7 mustered: 3 beaten / 2 hit / 1 turned back | 5 (5e 0h) | 16 | 73 | 12e 8h 24d 9l 14f | 0.0072 / 0.0151 |
| adaptive | 2 | 18:20 | 7 mustered: 3 beaten / 2 hit / 1 turned back | 5 (5e 0h) | 16 | 73 | 12e 8h 24d 9l 14f | 0.0104 / 0.0153 |
| adaptive | 3 | 18:20 | 7 mustered: 3 beaten / 2 hit / 1 turned back | 5 (5e 0h) | 16 | 73 | 12e 8h 24d 9l 14f | 0.0093 / 0.0142 |
| greedy | 1 | 18:18 | 7 mustered: 3 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 17 | 74 | 14e 8h 24d 6l 12f | 0.0103 / 0.0150 |
| greedy | 2 | 18:18 | 7 mustered: 3 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 17 | 74 | 14e 8h 24d 6l 12f | 0.0063 / 0.0125 |
| greedy | 3 | 18:18 | 7 mustered: 3 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 17 | 74 | 14e 8h 24d 6l 12f | 0.0103 / 0.0145 |
| idle | 1 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0071 / 0.0094 |
| idle | 2 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0048 / 0.0101 |
| idle | 3 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0083 / 0.0112 |
| drones-only | 1 | timeout 45:00 | 17 mustered: 12 beaten / 5 hit / 0 turned back | 7 (7e 0h) | 14 | 48 | 11e 6h 50d 0l 0f | 0.0071 / 0.0140 |
| drones-only | 2 | timeout 45:00 | 17 mustered: 12 beaten / 5 hit / 0 turned back | 7 (7e 0h) | 14 | 48 | 11e 6h 50d 0l 0f | 0.0077 / 0.0137 |
| drones-only | 3 | timeout 45:00 | 17 mustered: 12 beaten / 5 hit / 0 turned back | 7 (7e 0h) | 14 | 48 | 11e 6h 50d 0l 0f | 0.0118 / 0.0145 |
| adaptive-no-raids | 1 | 9:46 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 42 | 8e 9h 7d 8l 10f | 0.0107 / 0.0142 |
| adaptive-no-raids | 2 | 9:46 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 42 | 8e 9h 7d 8l 10f | 0.0105 / 0.0141 |
| adaptive-no-raids | 3 | 9:46 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 42 | 8e 9h 7d 8l 10f | 0.0086 / 0.0133 |
| adaptive-concentrate | 1 | 23:13 | 9 mustered: 3 beaten / 4 hit / 1 turned back | 6 (6e 0h) | 14 | 124 | 15e 10h 19d 16l 21f | 0.0099 / 0.0139 |
| adaptive-concentrate | 2 | 23:13 | 9 mustered: 3 beaten / 4 hit / 1 turned back | 6 (6e 0h) | 14 | 124 | 15e 10h 19d 16l 21f | 0.0101 / 0.0144 |
| adaptive-concentrate | 3 | 23:13 | 9 mustered: 3 beaten / 4 hit / 1 turned back | 6 (6e 0h) | 14 | 124 | 15e 10h 19d 16l 21f | 0.0056 / 0.0117 |
| undefended | 1 | 13:09 | 5 mustered: 0 beaten / 2 hit / 2 turned back | 5 (5e 0h) | 13 | 58 | 12e 8h 9d 8l 10f | 0.0097 / 0.0142 |
| undefended | 2 | 13:09 | 5 mustered: 0 beaten / 2 hit / 2 turned back | 5 (5e 0h) | 13 | 58 | 12e 8h 9d 8l 10f | 0.0105 / 0.0147 |
| undefended | 3 | 13:09 | 5 mustered: 0 beaten / 2 hit / 2 turned back | 5 (5e 0h) | 13 | 58 | 12e 8h 9d 8l 10f | 0.0093 / 0.0142 |
| one-push | 1 | 24:52 | 10 mustered: 5 beaten / 2 hit / 2 turned back | 3 (3e 0h) | 14 | 83 | 10e 8h 24d 19l 26f | 0.0109 / 0.0142 |
| one-push | 2 | 24:52 | 10 mustered: 5 beaten / 2 hit / 2 turned back | 3 (3e 0h) | 14 | 83 | 10e 8h 24d 19l 26f | 0.0104 / 0.0132 |
| one-push | 3 | 24:52 | 10 mustered: 5 beaten / 2 hit / 2 turned back | 3 (3e 0h) | 14 | 83 | 10e 8h 24d 19l 26f | 0.0083 / 0.0130 |
| two-push | 1 | 23:06 | 9 mustered: 5 beaten / 2 hit / 1 turned back | 4 (4e 0h) | 18 | 133 | 16e 10h 24d 13l 23f | 0.0064 / 0.0133 |
| two-push | 2 | 23:06 | 9 mustered: 5 beaten / 2 hit / 1 turned back | 4 (4e 0h) | 18 | 133 | 16e 10h 24d 13l 23f | 0.0087 / 0.0131 |
| two-push | 3 | 23:06 | 9 mustered: 5 beaten / 2 hit / 1 turned back | 4 (4e 0h) | 18 | 133 | 16e 10h 24d 13l 23f | 0.0080 / 0.0127 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0104 / 0.0199 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0110 / 0.0196 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0104 / 0.0191 |

## The static sweep (the best shape per seed is the `static` row above: a win, then the earlier hive, then the fewer economy ships lost)

Shapes (extractor / hauler / drone / lancer / flak weights): econ-lean 4/3/1/1/1; even 3/2/2/2/2; drone-heavy 3/2/4/1/1; flak-heavy 3/2/1/1/4; lancer-heavy 3/2/1/4/1; war-lean 2/1/3/2/3.

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static (econ-lean 4/3/1/1/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 32 (30e 2h) | 24 | 5 | 38e 13h 9d 4l 1f | 0.0139 / 0.0251 |
| static (even 3/2/2/2/2) | 1 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 19 (19e 0h) | 15 | 3 | 26e 7h 11d 5l 3f | 0.0193 / 0.0218 |
| static (drone-heavy 3/2/4/1/1) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 17 (17e 0h) | 13 | 3 | 23e 7h 17d 2l 1f | 0.0084 / 0.0158 |
| static (flak-heavy 3/2/1/1/4) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 26 (26e 0h) | 23 | 3 | 34e 11h 9d 3l 2f | 0.0119 / 0.0200 |
| static (lancer-heavy 3/2/1/4/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 24 (24e 0h) | 20 | 3 | 32e 10h 7d 8l 0f | 0.0105 / 0.0186 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0104 / 0.0199 |
| static (econ-lean 4/3/1/1/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 32 (30e 2h) | 24 | 5 | 38e 13h 9d 4l 1f | 0.0216 / 0.0246 |
| static (even 3/2/2/2/2) | 2 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 19 (19e 0h) | 15 | 3 | 26e 7h 11d 5l 3f | 0.0138 / 0.0211 |
| static (drone-heavy 3/2/4/1/1) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 17 (17e 0h) | 13 | 3 | 23e 7h 17d 2l 1f | 0.0097 / 0.0167 |
| static (flak-heavy 3/2/1/1/4) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 26 (26e 0h) | 23 | 3 | 34e 11h 9d 3l 2f | 0.0127 / 0.0204 |
| static (lancer-heavy 3/2/1/4/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 24 (24e 0h) | 20 | 3 | 32e 10h 7d 8l 0f | 0.0100 / 0.0187 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0110 / 0.0196 |
| static (econ-lean 4/3/1/1/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 32 (30e 2h) | 24 | 5 | 38e 13h 9d 4l 1f | 0.0136 / 0.0245 |
| static (even 3/2/2/2/2) | 3 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 19 (19e 0h) | 15 | 3 | 26e 7h 11d 5l 3f | 0.0112 / 0.0206 |
| static (drone-heavy 3/2/4/1/1) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 17 (17e 0h) | 13 | 3 | 23e 7h 17d 2l 1f | 0.0090 / 0.0162 |
| static (flak-heavy 3/2/1/1/4) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 26 (26e 0h) | 23 | 3 | 34e 11h 9d 3l 2f | 0.0113 / 0.0202 |
| static (lancer-heavy 3/2/1/4/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 24 (24e 0h) | 20 | 3 | 32e 10h 7d 8l 0f | 0.0111 / 0.0188 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0104 / 0.0191 |

## Staffing and the shield (H8)

Per run: idle haulers at the probe (peak, and game minutes with more than 1 idle outside raids); backed-up seconds per rock while its hauler target was met (total, with the longest run in brackets); economy ships lost in a tick that began with a warship at the raid target (must be 0: raid.shieldEcon is 1 and h8-raids is merged); the longest run with ore for the dearest unlocked warship in stock, room under the fleet limit and no bay running (the no-idle measure).

| Strategy | Seed | Idle haulers peak | Minutes with more than 1 idle | Backed up with target met (s, longest) | Economy lost under a guard | Longest idle with ore (min) |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 1 | 0 | none | 0 | 0.32 |
| adaptive | 2 | 1 | 0 | none | 0 | 0.32 |
| adaptive | 3 | 1 | 0 | none | 0 | 0.32 |
| greedy | 1 | 1 | 0 | none | 0 | 0.37 |
| greedy | 2 | 1 | 0 | none | 0 | 0.37 |
| greedy | 3 | 1 | 0 | none | 0 | 0.37 |
| idle | 1 | 1 | 0 | none | 0 | 0 |
| idle | 2 | 1 | 0 | none | 0 | 0 |
| idle | 3 | 1 | 0 | none | 0 | 0 |
| drones-only | 1 | 4 | 29.18 | none | 0 | 0.45 |
| drones-only | 2 | 4 | 29.18 | none | 0 | 0.45 |
| drones-only | 3 | 4 | 29.18 | none | 0 | 0.45 |
| adaptive-no-raids | 1 | 2 | 0.08 | none | 0 | 0.13 |
| adaptive-no-raids | 2 | 2 | 0.08 | none | 0 | 0.13 |
| adaptive-no-raids | 3 | 2 | 0.08 | none | 0 | 0.13 |
| adaptive-concentrate | 1 | 2 | 0.69 | none | 0 | 1.2 |
| adaptive-concentrate | 2 | 2 | 0.69 | none | 0 | 1.2 |
| adaptive-concentrate | 3 | 2 | 0.69 | none | 0 | 1.2 |
| undefended | 1 | 1 | 0 | none | 0 | 0.34 |
| undefended | 2 | 1 | 0 | none | 0 | 0.34 |
| undefended | 3 | 1 | 0 | none | 0 | 0.34 |
| one-push | 1 | 2 | 7.43 | none | 0 | 0.43 |
| one-push | 2 | 2 | 7.43 | none | 0 | 0.43 |
| one-push | 3 | 2 | 7.43 | none | 0 | 0.43 |
| two-push | 1 | 2 | 0 | none | 0 | 1.12 |
| two-push | 2 | 2 | 0 | none | 0 | 1.12 |
| two-push | 3 | 2 | 0 | none | 0 | 1.12 |
| static (war-lean 2/1/3/2/3) | 1 | 0 | 0 | a1 4 (4), p2 6 (6) | 0 | 0 |
| static (war-lean 2/1/3/2/3) | 2 | 0 | 0 | a1 4 (4), p2 6 (6) | 0 | 0 |
| static (war-lean 2/1/3/2/3) | 3 | 0 | 0 | a1 4 (4), p2 6 (6) | 0 | 0 |

## Trace at 15, 30 and 45 game minutes (seed 1)

Economy alive (extractors / haulers), warships alive (drones / lancers / flak), ore in stock, the weights (e/h/d/l/f) and the bays running. A run that ended earlier has fewer rows.

| Strategy | Minute | Extractors / haulers | Warships d/l/f | Stock ore | Weights e/h/d/l/f | Bays running |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | 15 | 7 / 8 | 3/5/6 | 1 | 0/0/0/4/5 | none |
| greedy | 15 | 7 / 8 | 4/4/6 | 1 | 0/0/0/4/5 | none |
| idle | 15 | 3 / 2 | 25/0/0 | 37 | 0/0/5/0/0 | none |
| idle | 30 | 3 / 2 | 25/0/0 | 669 | 0/0/5/0/0 | none |
| idle | 45 | 3 / 2 | 25/0/0 | 1297 | 0/0/5/0/0 | none |
| drones-only | 15 | 6 / 6 | 18/0/0 | 129 | 0/0/5/0/0 | none |
| drones-only | 30 | 4 / 6 | 20/0/0 | 777 | 0/0/5/0/0 | none |
| drones-only | 45 | 4 / 6 | 20/0/0 | 1395 | 0/0/5/0/0 | none |
| adaptive-concentrate | 15 | 5 / 7 | 0/0/1 | 1 | 1/1/0/5/4 | none |
| one-push | 15 | 7 / 7 | 1/7/7 | 1 | 0/0/0/3/5 | none |
| two-push | 15 | 9 / 9 | 0/4/6 | 1 | 0/0/0/0/5 | flak |
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
| greedy | 1 | 1: 2, 2: 4 | 7 / 3 / 0 | a1 2, a3 1, a5 1, p1 0, p2 0 | +0% |
| greedy | 2 | 1: 2, 2: 4 | 7 / 3 / 0 | a1 2, a3 1, a5 1, p1 0, p2 0 | +0% |
| greedy | 3 | 1: 2, 2: 4 | 7 / 3 / 0 | a1 2, a3 1, a5 1, p1 0, p2 0 | +0% |
| idle | 1 | 1: 1 | 0 / 1 / 0 | a1 2 | - |
| idle | 2 | 1: 1 | 0 / 1 / 0 | a1 2 | - |
| idle | 3 | 1: 1 | 0 / 1 / 0 | a1 2 | - |
| drones-only | 1 | 1: 10, 2: 7 | 19 / 5 / 0 | a1 2, a3 2, a4 1, a5 2 | - |
| drones-only | 2 | 1: 10, 2: 7 | 19 / 5 / 0 | a1 2, a3 2, a4 1, a5 2 | - |
| drones-only | 3 | 1: 10, 2: 7 | 19 / 5 / 0 | a1 2, a3 2, a4 1, a5 2 | - |
| adaptive-no-raids | 1 | none | 0 / 0 / 0 | none | -47% |
| adaptive-no-raids | 2 | none | 0 / 0 / 0 | none | -47% |
| adaptive-no-raids | 3 | none | 0 / 0 / 0 | none | -47% |
| adaptive-concentrate | 1 | 1: 4, 2: 4 | 7 / 4 / 1 | a1 2, a3 1, a4 1, a5 0, p1 1, p2 0 | +27% |
| adaptive-concentrate | 2 | 1: 4, 2: 4 | 7 / 4 / 1 | a1 2, a3 1, a4 1, a5 0, p1 1, p2 0 | +27% |
| adaptive-concentrate | 3 | 1: 4, 2: 4 | 7 / 4 / 1 | a1 2, a3 1, a4 1, a5 0, p1 1, p2 0 | +27% |
| undefended | 1 | 1: 3, 2: 1 | 0 / 3 / 2 | a1 2, a3 1, a5 2, p1 0 | -28% |
| undefended | 2 | 1: 3, 2: 1 | 0 / 3 / 2 | a1 2, a3 1, a5 2, p1 0 | -28% |
| undefended | 3 | 1: 3, 2: 1 | 0 / 3 / 2 | a1 2, a3 1, a5 2, p1 0 | -28% |
| one-push | 1 | 1: 6, 2: 3 | 8 / 2 / 2 | a1 2, a3 1, a5 0, p1 0 | +36% |
| one-push | 2 | 1: 6, 2: 3 | 8 / 2 / 2 | a1 2, a3 1, a5 0, p1 0 | +36% |
| one-push | 3 | 1: 6, 2: 3 | 8 / 2 / 2 | a1 2, a3 1, a5 0, p1 0 | +36% |
| two-push | 1 | 1: 5, 2: 3 | 8 / 2 / 1 | a1 2, a3 1, a5 0, p1 0 | +26% |
| two-push | 2 | 1: 5, 2: 3 | 8 / 2 / 1 | a1 2, a3 1, a5 0, p1 0 | +26% |
| two-push | 3 | 1: 5, 2: 3 | 8 / 2 / 1 | a1 2, a3 1, a5 0, p1 0 | +26% |
| static (war-lean 2/1/3/2/3) | 1 | 1: 14 | 0 / 14 / 0 | a1 2, p1 13 | - |
| static (war-lean 2/1/3/2/3) | 2 | 1: 14 | 0 / 14 / 0 | a1 2, p1 13 | - |
| static (war-lean 2/1/3/2/3) | 3 | 1: 14 | 0 / 14 / 0 | a1 2, p1 13 | - |

## The hive (H10)

Per run, at hive.rebuildTicks 0 (the shipped value): the hive's guards lost to raids (raiders killed at rocks) and to pushes (killed in battles at the hive); its guards at home when the winning wave landed, against its caps; the hive-damaging events before the win (a prong beaten with 3 or more raiders killed, or a lost push that killed 5 or more guards); the prongs that rolled on (`raidRolls`); and the win time against adaptive on the same seed.

| Strategy | Seed | Lost to raids | Lost to pushes | At home when the winning wave landed | Events before the win | Raid rolls | Win time against adaptive |
| --- | --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 27 | 26 | 22/30 (73%) | 7 | 0 | base |
| adaptive | 2 | 27 | 26 | 22/30 (73%) | 7 | 0 | base |
| adaptive | 3 | 27 | 26 | 22/30 (73%) | 7 | 0 | base |
| greedy | 1 | 28 | 26 | 22/30 (73%) | 7 | 0 | +0% |
| greedy | 2 | 28 | 26 | 22/30 (73%) | 7 | 0 | +0% |
| greedy | 3 | 28 | 26 | 22/30 (73%) | 7 | 0 | +0% |
| idle | 1 | 0 | 0 | - | 0 | 0 | - |
| idle | 2 | 0 | 0 | - | 0 | 0 | - |
| idle | 3 | 0 | 0 | - | 0 | 0 | - |
| drones-only | 1 | 73 | 0 | - | 19 | 0 | - |
| drones-only | 2 | 73 | 0 | - | 19 | 0 | - |
| drones-only | 3 | 73 | 0 | - | 19 | 0 | - |
| adaptive-no-raids | 1 | 0 | 34 | 30/30 (100%) | 0 | 0 | -47% |
| adaptive-no-raids | 2 | 0 | 34 | 30/30 (100%) | 0 | 0 | -47% |
| adaptive-no-raids | 3 | 0 | 34 | 30/30 (100%) | 0 | 0 | -47% |
| adaptive-concentrate | 1 | 26 | 64 | 25/30 (83%) | 8 | 0 | +27% |
| adaptive-concentrate | 2 | 26 | 64 | 25/30 (83%) | 8 | 0 | +27% |
| adaptive-concentrate | 3 | 26 | 64 | 25/30 (83%) | 8 | 0 | +27% |
| undefended | 1 | 0 | 34 | 30/30 (100%) | 0 | 0 | -28% |
| undefended | 2 | 0 | 34 | 30/30 (100%) | 0 | 0 | -28% |
| undefended | 3 | 0 | 34 | 30/30 (100%) | 0 | 0 | -28% |
| one-push | 1 | 35 | 53 | 30/30 (100%) | 10 | 0 | +36% |
| one-push | 2 | 35 | 53 | 30/30 (100%) | 10 | 0 | +36% |
| one-push | 3 | 35 | 53 | 30/30 (100%) | 10 | 0 | +36% |
| two-push | 1 | 34 | 41 | 25/30 (83%) | 10 | 0 | +26% |
| two-push | 2 | 34 | 41 | 25/30 (83%) | 10 | 0 | +26% |
| two-push | 3 | 34 | 41 | 25/30 (83%) | 10 | 0 | +26% |
| static (war-lean 2/1/3/2/3) | 1 | 0 | 0 | - | 0 | 0 | - |
| static (war-lean 2/1/3/2/3) | 2 | 0 | 0 | - | 0 | 0 | - |
| static (war-lean 2/1/3/2/3) | 3 | 0 | 0 | - | 0 | 0 | - |

Adaptive's hive guards at home at each game minute, seed 1 (from minute 1):

30 30 27 30 30 30 30 30 30 30 26 30 30 30 30 29 30 30

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
   - best mix at full strength 16; with a raid of 4 Thorns and 8 Spores out 11
5. MET: Counters matter: drones-only can't take the hive within field.fleetCap minus 10 economy ships (its best drone wave doesn't fit)
   - smallest drone wave none within 30 against 20 warship slots (field.fleetCap 30 minus 10)
6. MET: Economy against offence is a trade in slots: the hive's best mix plus a full economy is more than field.fleetCap, and the best mix plus 10 economy ships fits
   - best mix 16; full economy 21 (13 Mine slots plus 8 haulers at adaptive's peak); field.fleetCap 30; best mix + full economy = 37, best mix + 10 = 26
7. MET: No free first win: every guarded node needs more drones than the opening stock buys
   - p1 needs more than 3 drones (2 buyable from the opening stock) ok; p2 needs more than 3 drones (2 buyable from the opening stock) ok; heart needs more than 3 drones (2 buyable from the opening stock) ok

## H9 report lines (report lines, not gates)

Calibration target 4 (reworded) and targets 5a and 5b, which are reported findings for H9, not targets (Director, 2026-11-16; DECISIONS.md).

1. MET: Splitting matters: adaptive-concentrate loses at least 2 more economy ships to raids than adaptive, or finishes at least 10% slower, on every seed
   - seed 1: adaptive lost 5, concentrate lost 6, concentrate +27% ok; seed 2: adaptive lost 5, concentrate lost 6, concentrate +27% ok; seed 3: adaptive lost 5, concentrate lost 6, concentrate +27% ok
2. REPORTED: Ignoring raids costs (5a, reported finding): greedy against adaptive
   - greedy: seed 1 +0% (under 10% slower), seed 2 +0% (under 10% slower), seed 3 +0% (under 10% slower)
3. REPORTED: Ignoring raids costs (5b, report-only rule finding): undefended against adaptive (undefended may fail to win)
   - undefended: seed 1 -28% (under 10% slower), seed 2 -28% (under 10% slower), seed 3 -28% (under 10% slower)

## H10 report lines (report lines, not gates)

Calibration targets 1 to 6. They read REPORTED until h10-design-data says they hold; the "ok" and "MISS" in each line are the measure against the target, at hive.rebuildTicks 0.

1. REPORTED: H10 target 1, defending pays: undefended finishes at least 10% slower than adaptive, or does not win
   - seed 1: undefended -28% against adaptive MISS; seed 2: undefended -28% against adaptive MISS; seed 3: undefended -28% against adaptive MISS
2. REPORTED: H10 target 2, attrition shows: the hive is at most 75% of its caps when the winning wave lands in adaptive's run, after at least 2 hive-damaging events (a prong beaten with 3 or more raiders killed, or a push that kills 5 or more guards)
   - seed 1: 22/30 guards at home when the winning wave landed (73%, at most 75%: yes), 7 hive-damaging events before the win (at least 2: yes) ok; seed 2: 22/30 guards at home when the winning wave landed (73%, at most 75%: yes), 7 hive-damaging events before the win (at least 2: yes) ok; seed 3: 22/30 guards at home when the winning wave landed (73%, at most 75%: yes), 7 hive-damaging events before the win (at least 2: yes) ok
3. REPORTED: H10 target 3, one push is slower: one-push finishes at least 10% slower than adaptive, or does not win
   - seed 1: one-push +36% against adaptive ok; seed 2: one-push +36% against adaptive ok; seed 3: one-push +36% against adaptive ok
4. REPORTED: H10 target 4, a lost push is not wasted: two-push finishes no more than 10% behind one-push, or wins where one-push does not
   - seed 1: two-push -7% against one-push ok; seed 2: two-push -7% against one-push ok; seed 3: two-push -7% against one-push ok
5. REPORTED: H10 target 5, robust: targets 1 and 3 still hold at 0.75 and 1.25 times the shipped hive.rebuildTicks
   - hive.rebuildTicks 450: target 1 holds, target 3 holds; hive.rebuildTicks 750: target 1 holds, target 3 holds (shipped is 0 here, so centred on 600, sweep on seed 1)
6. REPORTED: H10 target 6, pace: adaptive takes 15 to 30 game minutes, greedy at most 40, and the first raid comes at 2 to 6 minutes
   - seed 1: adaptive 18.3 min (15 to 30: yes), greedy 18.3 min (at most 40: yes), first raid at 2.7 min (2 to 6: yes) ok; seed 2: adaptive 18.3 min (15 to 30: yes), greedy 18.3 min (at most 40: yes), first raid at 2.7 min (2 to 6: yes) ok; seed 3: adaptive 18.3 min (15 to 30: yes), greedy 18.3 min (at most 40: yes), first raid at 2.7 min (2 to 6: yes) ok
