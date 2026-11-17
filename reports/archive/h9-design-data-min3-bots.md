# Bot suite: PASS

Data version 15, 1 seeds, field mode, 8 strategies (adaptive, greedy, static, idle, drones-only, adaptive-no-raids, adaptive-concentrate, undefended). Cap 45 game minutes, softlock after 5 minutes with no ship start and no delivery, tick budget p95 ≤ 2 ms. Runs 29.4 s. Times are game minutes (m:ss). Gated for softlock and timeout: adaptive, greedy; the others are controls and are reported only.

## Failures

None.

## Per run

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 18:20 | 7 mustered: 3 beaten / 2 hit / 1 turned back | 5 (5e 0h) | 16 | 73 | 12e 8h 24d 9l 14f | 0.0065 / 0.0115 |
| greedy | 1 | 18:18 | 7 mustered: 3 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 17 | 74 | 14e 8h 24d 6l 12f | 0.0057 / 0.0088 |
| idle | 1 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0045 / 0.0065 |
| drones-only | 1 | timeout 45:00 | 17 mustered: 12 beaten / 5 hit / 0 turned back | 7 (7e 0h) | 14 | 48 | 11e 6h 50d 0l 0f | 0.0067 / 0.0086 |
| adaptive-no-raids | 1 | 9:46 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 42 | 8e 9h 7d 8l 10f | 0.0055 / 0.0079 |
| adaptive-concentrate | 1 | 23:13 | 9 mustered: 3 beaten / 4 hit / 1 turned back | 6 (6e 0h) | 14 | 124 | 15e 10h 19d 16l 21f | 0.0054 / 0.0080 |
| undefended | 1 | 13:09 | 5 mustered: 0 beaten / 2 hit / 2 turned back | 5 (5e 0h) | 13 | 58 | 12e 8h 9d 8l 10f | 0.0053 / 0.0076 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0103 / 0.0110 |

## The static sweep (the best shape per seed is the `static` row above: a win, then the earlier hive, then the fewer economy ships lost)

Shapes (extractor / hauler / drone / lancer / flak weights): econ-lean 4/3/1/1/1; even 3/2/2/2/2; drone-heavy 3/2/4/1/1; flak-heavy 3/2/1/1/4; lancer-heavy 3/2/1/4/1; war-lean 2/1/3/2/3.

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static (econ-lean 4/3/1/1/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 32 (30e 2h) | 24 | 5 | 38e 13h 9d 4l 1f | 0.0133 / 0.0148 |
| static (even 3/2/2/2/2) | 1 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 19 (19e 0h) | 15 | 3 | 26e 7h 11d 5l 3f | 0.0110 / 0.0119 |
| static (drone-heavy 3/2/4/1/1) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 17 (17e 0h) | 13 | 3 | 23e 7h 17d 2l 1f | 0.0083 / 0.0094 |
| static (flak-heavy 3/2/1/1/4) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 26 (26e 0h) | 23 | 3 | 34e 11h 9d 3l 2f | 0.0109 / 0.0119 |
| static (lancer-heavy 3/2/1/4/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 24 (24e 0h) | 20 | 3 | 32e 10h 7d 8l 0f | 0.0099 / 0.0108 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0103 / 0.0110 |

## Staffing and the shield (H8)

Per run: idle haulers at the probe (peak, and game minutes with more than 1 idle outside raids); backed-up seconds per rock while its hauler target was met (total, with the longest run in brackets); economy ships lost in a tick that began with a warship at the raid target (must be 0: raid.shieldEcon is 1 and h8-raids is merged); the longest run with ore for the dearest unlocked warship in stock, room under the fleet limit and no bay running (the no-idle measure).

| Strategy | Seed | Idle haulers peak | Minutes with more than 1 idle | Backed up with target met (s, longest) | Economy lost under a guard | Longest idle with ore (min) |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 1 | 0 | none | 0 | 0.32 |
| greedy | 1 | 1 | 0 | none | 0 | 0.37 |
| idle | 1 | 1 | 0 | none | 0 | 0 |
| drones-only | 1 | 4 | 29.18 | none | 0 | 0.45 |
| adaptive-no-raids | 1 | 2 | 0.08 | none | 0 | 0.13 |
| adaptive-concentrate | 1 | 2 | 0.69 | none | 0 | 1.2 |
| undefended | 1 | 1 | 0 | none | 0 | 0.34 |
| static (war-lean 2/1/3/2/3) | 1 | 0 | 0 | a1 4 (4), p2 6 (6) | 0 | 0 |

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
| static (war-lean 2/1/3/2/3) | 15 | 5 / 4 | 10/1/3 | 1 | 2/1/3/2/3 | none |
| static (war-lean 2/1/3/2/3) | 30 | 5 / 5 | 12/2/6 | 487 | 2/1/3/2/3 | none |
| static (war-lean 2/1/3/2/3) | 45 | 5 / 5 | 12/2/6 | 1147 | 2/1/3/2/3 | none |

## Prongs (H9)

Per run: raids by prong count (a raid that did not split is 1 prong), prongs by outcome (`stats.raidProngs`: beaten / hit / turned back), economy ships lost per prong target (the rock the prong went to, from `lastRaid.prongs`), and the win time against `adaptive` on the same seed (+12% is 12% slower; "-" when either did not win).

| Strategy | Seed | Raids by prong count | Prongs beaten / hit / turned back | Economy ships lost per prong target | Win time against adaptive |
| --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 1: 2, 2: 4 | 7 / 2 / 1 | a1 2, a3 1, a5 0, p1 0 | base |
| greedy | 1 | 1: 2, 2: 4 | 7 / 3 / 0 | a1 2, a3 1, a5 1, p1 0, p2 0 | +0% |
| idle | 1 | 1: 1 | 0 / 1 / 0 | a1 2 | - |
| drones-only | 1 | 1: 10, 2: 7 | 19 / 5 / 0 | a1 2, a3 2, a4 1, a5 2 | - |
| adaptive-no-raids | 1 | none | 0 / 0 / 0 | none | -47% |
| adaptive-concentrate | 1 | 1: 4, 2: 4 | 7 / 4 / 1 | a1 2, a3 1, a4 1, a5 0, p1 1, p2 0 | +27% |
| undefended | 1 | 1: 3, 2: 1 | 0 / 3 / 2 | a1 2, a3 1, a5 2, p1 0 | -28% |
| static (war-lean 2/1/3/2/3) | 1 | 1: 14 | 0 / 14 / 0 | a1 2, p1 13 | - |

## What no bot exercises

Bots stay on Auto haulers and use only `sendShips` and `recycleShips` (and the weights and the rally). No bot uses: `setExtractors` (they stay on All), the drag gesture (a client gesture), `setHaulers`, `moveShips`, `recycleFleet`, or Mine mode (a client mode; the bots never send `setMine` and play with the marks the map starts with). Sim tests and the reference replay cover `setExtractors`, `setHaulers`, `moveShips` and `recycleFleet`; h8-client smoke tests cover the drag and Mine mode.

## H7 capability flags (report lines, not gates)

1. MET: Splitting matters: static either loses at least half the economy ships it built to raids or fails to take the hive within the cap, and adaptive takes the hive
   - static/1 (war-lean 2/1/3/2/3) timeout, lost 15 of 25 economy ships ok; adaptive/1 won
2. MET: Greed is answered by raids: greedy's first hitting raid kills at least 2 economy ships, and greedy still wins after responding
   - greedy/1 first hit killed 2, won ok
3. MET: Waiting is safe: idle is raided at most once
   - idle/1 raids mustered 1 (hit 1, beaten 0, turned back 0) ok
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
   - seed 1: adaptive lost 5, concentrate lost 6 MISS
2. MISSED: Ignoring raids costs: greedy and undefended each finish at least 10% slower than adaptive (undefended may fail to win)
   - greedy half MISSED, undefended half MISSED. greedy: seed 1 +0% MISS; undefended: seed 1 -28% MISS
