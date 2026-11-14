# Bot suite: PASS

Data version 12, 3 seeds, field mode, 6 strategies (adaptive, greedy, static, idle, drones-only, adaptive-no-raids). Cap 45 game minutes, softlock after 5 minutes with no ship start and no delivery, tick budget p95 ≤ 2 ms. Runs 70.6 s. Times are game minutes (m:ss). Gated for softlock and timeout: adaptive, greedy; the others are controls and are reported only.

## Failures

None.

## Per run

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 19:00 | 8 mustered: 6 beaten / 1 hit / 0 turned back | 4 (2e 2h) | 14 | 58 | 8e 12h 22d 8l 10f | 0.0046 / 0.0089 |
| adaptive | 2 | 19:00 | 8 mustered: 6 beaten / 1 hit / 0 turned back | 4 (2e 2h) | 14 | 58 | 8e 12h 22d 8l 10f | 0.0041 / 0.0083 |
| adaptive | 3 | 19:00 | 8 mustered: 6 beaten / 1 hit / 0 turned back | 4 (2e 2h) | 14 | 58 | 8e 12h 22d 8l 10f | 0.0041 / 0.0077 |
| greedy | 1 | 19:49 | 9 mustered: 7 beaten / 1 hit / 0 turned back | 6 (2e 4h) | 14 | 74 | 8e 15h 22d 8l 10f | 0.0042 / 0.0080 |
| greedy | 2 | 19:49 | 9 mustered: 7 beaten / 1 hit / 0 turned back | 6 (2e 4h) | 14 | 74 | 8e 15h 22d 8l 10f | 0.0042 / 0.0077 |
| greedy | 3 | 19:49 | 9 mustered: 7 beaten / 1 hit / 0 turned back | 6 (2e 4h) | 14 | 74 | 8e 15h 22d 8l 10f | 0.0041 / 0.0072 |
| idle | 1 | timeout 45:00 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 5 | 3 | 3e 2h 25d 0l 0f | 0.0038 / 0.0069 |
| idle | 2 | timeout 45:00 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 5 | 3 | 3e 2h 25d 0l 0f | 0.0038 / 0.0071 |
| idle | 3 | timeout 45:00 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 5 | 3 | 3e 2h 25d 0l 0f | 0.0038 / 0.0070 |
| drones-only | 1 | timeout 45:00 | 21 mustered: 19 beaten / 2 hit / 0 turned back | 6 (3e 3h) | 12 | 44 | 8e 8h 59d 0l 0f | 0.0041 / 0.0078 |
| drones-only | 2 | timeout 45:00 | 21 mustered: 19 beaten / 2 hit / 0 turned back | 6 (3e 3h) | 12 | 44 | 8e 8h 59d 0l 0f | 0.0041 / 0.0074 |
| drones-only | 3 | timeout 45:00 | 21 mustered: 19 beaten / 2 hit / 0 turned back | 6 (3e 3h) | 12 | 44 | 8e 8h 59d 0l 0f | 0.0041 / 0.0074 |
| adaptive-no-raids | 1 | 14:37 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 13 | 43 | 6e 11h 18d 9l 12f | 0.0040 / 0.0073 |
| adaptive-no-raids | 2 | 14:37 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 13 | 43 | 6e 11h 18d 9l 12f | 0.0040 / 0.0073 |
| adaptive-no-raids | 3 | 14:37 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 13 | 43 | 6e 11h 18d 9l 12f | 0.0040 / 0.0071 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 18 mustered: 0 beaten / 16 hit / 2 turned back | 19 (18e 1h) | 11 | 5 | 23e 7h 18d 1l 7f | 0.0043 / 0.0067 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 18 mustered: 0 beaten / 16 hit / 2 turned back | 19 (18e 1h) | 11 | 5 | 23e 7h 18d 1l 7f | 0.0043 / 0.0066 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 18 mustered: 0 beaten / 16 hit / 2 turned back | 19 (18e 1h) | 11 | 5 | 23e 7h 18d 1l 7f | 0.0044 / 0.0067 |

## The static sweep (the best shape per seed is the `static` row above: a win, then the earlier hive, then the fewer economy ships lost)

Shapes (extractor / hauler / drone / lancer / flak weights): econ-lean 4/3/1/1/1; even 3/2/2/2/2; drone-heavy 3/2/4/1/1; flak-heavy 3/2/1/1/4; lancer-heavy 3/2/1/4/1; war-lean 2/1/3/2/3.

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static (econ-lean 4/3/1/1/1) | 1 | timeout 45:00 | 21 mustered: 0 beaten / 21 hit / 0 turned back | 34 (27e 7h) | 24 | 5 | 34e 24h 6d 0l 0f | 0.0044 / 0.0075 |
| static (even 3/2/2/2/2) | 1 | timeout 45:00 | 18 mustered: 0 beaten / 16 hit / 2 turned back | 32 (21e 11h) | 16 | 3 | 28e 20h 15d 0l 6f | 0.0041 / 0.0070 |
| static (drone-heavy 3/2/4/1/1) | 1 | timeout 45:00 | 19 mustered: 0 beaten / 17 hit / 1 turned back | 21 (17e 4h) | 13 | 3 | 23e 11h 16d 0l 2f | 0.0044 / 0.0071 |
| static (flak-heavy 3/2/1/1/4) | 1 | timeout 45:00 | 21 mustered: 0 beaten / 21 hit / 0 turned back | 33 (27e 6h) | 23 | 3 | 36e 20h 8d 0l 0f | 0.0046 / 0.0074 |
| static (lancer-heavy 3/2/1/4/1) | 1 | timeout 45:00 | 21 mustered: 0 beaten / 21 hit / 0 turned back | 33 (27e 6h) | 23 | 3 | 36e 20h 8d 0l 0f | 0.0046 / 0.0074 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 18 mustered: 0 beaten / 16 hit / 2 turned back | 19 (18e 1h) | 11 | 5 | 23e 7h 18d 1l 7f | 0.0043 / 0.0067 |
| static (econ-lean 4/3/1/1/1) | 2 | timeout 45:00 | 21 mustered: 0 beaten / 21 hit / 0 turned back | 34 (27e 7h) | 24 | 5 | 34e 24h 6d 0l 0f | 0.0044 / 0.0075 |
| static (even 3/2/2/2/2) | 2 | timeout 45:00 | 18 mustered: 0 beaten / 16 hit / 2 turned back | 32 (21e 11h) | 16 | 3 | 28e 20h 15d 0l 6f | 0.0040 / 0.0067 |
| static (drone-heavy 3/2/4/1/1) | 2 | timeout 45:00 | 19 mustered: 0 beaten / 17 hit / 1 turned back | 21 (17e 4h) | 13 | 3 | 23e 11h 16d 0l 2f | 0.0044 / 0.0069 |
| static (flak-heavy 3/2/1/1/4) | 2 | timeout 45:00 | 21 mustered: 0 beaten / 21 hit / 0 turned back | 33 (27e 6h) | 23 | 3 | 36e 20h 8d 0l 0f | 0.0046 / 0.0073 |
| static (lancer-heavy 3/2/1/4/1) | 2 | timeout 45:00 | 21 mustered: 0 beaten / 21 hit / 0 turned back | 33 (27e 6h) | 23 | 3 | 36e 20h 8d 0l 0f | 0.0046 / 0.0072 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 18 mustered: 0 beaten / 16 hit / 2 turned back | 19 (18e 1h) | 11 | 5 | 23e 7h 18d 1l 7f | 0.0043 / 0.0066 |
| static (econ-lean 4/3/1/1/1) | 3 | timeout 45:00 | 21 mustered: 0 beaten / 21 hit / 0 turned back | 34 (27e 7h) | 24 | 5 | 34e 24h 6d 0l 0f | 0.0045 / 0.0075 |
| static (even 3/2/2/2/2) | 3 | timeout 45:00 | 18 mustered: 0 beaten / 16 hit / 2 turned back | 32 (21e 11h) | 16 | 3 | 28e 20h 15d 0l 6f | 0.0040 / 0.0067 |
| static (drone-heavy 3/2/4/1/1) | 3 | timeout 45:00 | 19 mustered: 0 beaten / 17 hit / 1 turned back | 21 (17e 4h) | 13 | 3 | 23e 11h 16d 0l 2f | 0.0043 / 0.0070 |
| static (flak-heavy 3/2/1/1/4) | 3 | timeout 45:00 | 21 mustered: 0 beaten / 21 hit / 0 turned back | 33 (27e 6h) | 23 | 3 | 36e 20h 8d 0l 0f | 0.0046 / 0.0072 |
| static (lancer-heavy 3/2/1/4/1) | 3 | timeout 45:00 | 21 mustered: 0 beaten / 21 hit / 0 turned back | 33 (27e 6h) | 23 | 3 | 36e 20h 8d 0l 0f | 0.0046 / 0.0072 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 18 mustered: 0 beaten / 16 hit / 2 turned back | 19 (18e 1h) | 11 | 5 | 23e 7h 18d 1l 7f | 0.0044 / 0.0067 |

## H7 capability flags (report lines, not gates)

1. MET: Splitting matters: static either loses at least half the economy ships it built to raids or fails to take the hive within the cap, and adaptive takes the hive
   - static/1 (war-lean 2/1/3/2/3) timeout, lost 19 of 30 economy ships ok; static/2 (war-lean 2/1/3/2/3) timeout, lost 19 of 30 economy ships ok; static/3 (war-lean 2/1/3/2/3) timeout, lost 19 of 30 economy ships ok; adaptive/1 won, adaptive/2 won, adaptive/3 won
2. MET: Greed is answered by raids: greedy's first hitting raid kills at least 2 economy ships, and greedy still wins after responding
   - greedy/1 first hit killed 4, won ok; greedy/2 first hit killed 4, won ok; greedy/3 first hit killed 4, won ok
3. MET: Waiting is safe: idle is raided at most once
   - idle/1 raids mustered 0 (hit 0, beaten 0, turned back 0) ok; idle/2 raids mustered 0 (hit 0, beaten 0, turned back 0) ok; idle/3 raids mustered 0 (hit 0, beaten 0, turned back 0) ok
4. MISSED: The counter-attack window is real: the hive's smallest winning wave with a full-size raid out is at least 30% smaller than at full strength
   - best mix at full strength 19; with a raid of 3 Thorns and 7 Spores out 14
5. MET: Counters matter: drones-only can't take the hive within field.fleetCap minus 10 economy ships (its best drone wave doesn't fit)
   - smallest drone wave none within 30 against 20 warship slots (field.fleetCap 30 minus 10)
6. MET: Economy against offence is a trade in slots: the hive's best mix plus a full economy is more than field.fleetCap, and the best mix plus 10 economy ships fits
   - best mix 19; full economy 22 (13 Mine slots plus 9 haulers at adaptive's peak); field.fleetCap 30; best mix + full economy = 41, best mix + 10 = 29
7. MET: No free first win: every guarded node needs more drones than the opening stock buys
   - p1 needs more than 3 drones (2 buyable from the opening stock) ok; p2 needs more than 3 drones (2 buyable from the opening stock) ok; heart needs more than 3 drones (2 buyable from the opening stock) ok

## Designer probe against "Calibration targets (H7)" (v12, measured with the bots' `min-wave` estimate and direct raid fights at a5)

| Target | v12 | Met |
| --- | --- | --- |
| Pace: adaptive 15–30 min, greedy ≤ 40 | 19:00 / 19:49 (every seed) | yes |
| First raid musters at 2–6 game minutes (adaptive) | 2:53 (tick 5191) | yes |
| Undefended full-economy raid on a5 kills ≥ 2 economy ships | raid of 8 (2T 6S, econ 22) kills all 5 (3e 2h) | yes |
| A matched defence no larger than the raid beats it losing ≤ 2 | 1 lancer + 4 flak (5) beat it, 1 lost | yes |
| Flag 4: hive best wave ≥ 30% smaller with a full-size raid out | 19 → 14 (26%; raid 3T 7S) | **no** |
| Flags 5, 6: drones can't fit; best mix + full economy > cap; best mix + 10 fits | drones none within 30; 19 + 22 = 41 > 30; 19 + 10 = 29 | yes |
| The best mix fits `field.fleetCap − 10` with ≥ 2 spare | 19 against 20 (1 spare) | **no** |
| Each pocket falls to drones alone within 6, not within 2 | p1 (0/6) 8, p2 (4/2) 15 | **no** |
| Realistic raids (from econ): hive wave with the raid econ 12 / 18 / 22 would muster out | 17 / 16 / 15 (11% / 16% / 21%) | (context) |
