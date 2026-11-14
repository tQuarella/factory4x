# Bot suite: PASS

Data version 13, 3 seeds, field mode, 6 strategies (adaptive, greedy, static, idle, drones-only, adaptive-no-raids). Cap 45 game minutes, softlock after 5 minutes with no ship start and no delivery, tick budget p95 ≤ 2 ms. Runs 62.3 s. Times are game minutes (m:ss). Gated for softlock and timeout: adaptive, greedy; the others are controls and are reported only.

## Failures

None.

## Per run

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 20:02 | 7 mustered: 4 beaten / 2 hit / 0 turned back | 7 (4e 3h) | 17 | 58 | 10e 12h 22d 5l 10f | 0.0044 / 0.0084 |
| adaptive | 2 | 20:02 | 7 mustered: 4 beaten / 2 hit / 0 turned back | 7 (4e 3h) | 17 | 58 | 10e 12h 22d 5l 10f | 0.0040 / 0.0079 |
| adaptive | 3 | 20:02 | 7 mustered: 4 beaten / 2 hit / 0 turned back | 7 (4e 3h) | 17 | 58 | 10e 12h 22d 5l 10f | 0.0040 / 0.0072 |
| greedy | 1 | 30:16 | 11 mustered: 6 beaten / 4 hit / 0 turned back | 11 (7e 4h) | 16 | 75 | 12e 14h 36d 6l 10f | 0.0040 / 0.0074 |
| greedy | 2 | 30:16 | 11 mustered: 6 beaten / 4 hit / 0 turned back | 11 (7e 4h) | 16 | 75 | 12e 14h 36d 6l 10f | 0.0041 / 0.0078 |
| greedy | 3 | 30:16 | 11 mustered: 6 beaten / 4 hit / 0 turned back | 11 (7e 4h) | 16 | 75 | 12e 14h 36d 6l 10f | 0.0040 / 0.0068 |
| idle | 1 | timeout 45:00 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 5 | 3 | 3e 2h 25d 0l 0f | 0.0037 / 0.0063 |
| idle | 2 | timeout 45:00 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 5 | 3 | 3e 2h 25d 0l 0f | 0.0037 / 0.0062 |
| idle | 3 | timeout 45:00 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 5 | 3 | 3e 2h 25d 0l 0f | 0.0037 / 0.0063 |
| drones-only | 1 | softlock 28:12 | 8 mustered: 1 beaten / 7 hit / 0 turned back | 24 (13e 11h) | 12 | 22 | 13e 12h 22d 0l 0f | 0.0038 / 0.0065 |
| drones-only | 2 | softlock 28:12 | 8 mustered: 1 beaten / 7 hit / 0 turned back | 24 (13e 11h) | 12 | 22 | 13e 12h 22d 0l 0f | 0.0038 / 0.0068 |
| drones-only | 3 | softlock 28:12 | 8 mustered: 1 beaten / 7 hit / 0 turned back | 24 (13e 11h) | 12 | 22 | 13e 12h 22d 0l 0f | 0.0038 / 0.0064 |
| adaptive-no-raids | 1 | 11:10 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 14 | 46 | 6e 10h 10d 7l 11f | 0.0039 / 0.0070 |
| adaptive-no-raids | 2 | 11:10 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 14 | 46 | 6e 10h 10d 7l 11f | 0.0038 / 0.0070 |
| adaptive-no-raids | 3 | 11:10 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 14 | 46 | 6e 10h 10d 7l 11f | 0.0038 / 0.0067 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 13 hit / 1 turned back | 17 (15e 2h) | 10 | 5 | 20e 7h 17d 1l 5f | 0.0042 / 0.0061 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 13 hit / 1 turned back | 17 (15e 2h) | 10 | 5 | 20e 7h 17d 1l 5f | 0.0042 / 0.0064 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 13 hit / 1 turned back | 17 (15e 2h) | 10 | 5 | 20e 7h 17d 1l 5f | 0.0043 / 0.0079 |

## The static sweep (the best shape per seed is the `static` row above: a win, then the earlier hive, then the fewer economy ships lost)

Shapes (extractor / hauler / drone / lancer / flak weights): econ-lean 4/3/1/1/1; even 3/2/2/2/2; drone-heavy 3/2/4/1/1; flak-heavy 3/2/1/1/4; lancer-heavy 3/2/1/4/1; war-lean 2/1/3/2/3.

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static (econ-lean 4/3/1/1/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 16 hit / 0 turned back | 34 (24e 10h) | 25 | 5 | 32e 25h 7d 0l 0f | 0.0045 / 0.0068 |
| static (even 3/2/2/2/2) | 1 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 24 (18e 6h) | 17 | 3 | 26e 15h 11d 1l 5f | 0.0044 / 0.0068 |
| static (drone-heavy 3/2/4/1/1) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 19 (13e 6h) | 12 | 3 | 19e 11h 18d 0l 2f | 0.0042 / 0.0065 |
| static (flak-heavy 3/2/1/1/4) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 28 (23e 5h) | 22 | 3 | 31e 19h 7d 0l 2f | 0.0044 / 0.0067 |
| static (lancer-heavy 3/2/1/4/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 29 (23e 6h) | 23 | 3 | 31e 20h 8d 0l 1f | 0.0044 / 0.0066 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 13 hit / 1 turned back | 17 (15e 2h) | 10 | 5 | 20e 7h 17d 1l 5f | 0.0042 / 0.0061 |
| static (econ-lean 4/3/1/1/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 16 hit / 0 turned back | 34 (24e 10h) | 25 | 5 | 32e 25h 7d 0l 0f | 0.0045 / 0.0067 |
| static (even 3/2/2/2/2) | 2 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 24 (18e 6h) | 17 | 3 | 26e 15h 11d 1l 5f | 0.0043 / 0.0062 |
| static (drone-heavy 3/2/4/1/1) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 19 (13e 6h) | 12 | 3 | 19e 11h 18d 0l 2f | 0.0041 / 0.0064 |
| static (flak-heavy 3/2/1/1/4) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 28 (23e 5h) | 22 | 3 | 31e 19h 7d 0l 2f | 0.0044 / 0.0067 |
| static (lancer-heavy 3/2/1/4/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 29 (23e 6h) | 23 | 3 | 31e 20h 8d 0l 1f | 0.0044 / 0.0066 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 13 hit / 1 turned back | 17 (15e 2h) | 10 | 5 | 20e 7h 17d 1l 5f | 0.0042 / 0.0064 |
| static (econ-lean 4/3/1/1/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 16 hit / 0 turned back | 34 (24e 10h) | 25 | 5 | 32e 25h 7d 0l 0f | 0.0045 / 0.0067 |
| static (even 3/2/2/2/2) | 3 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 24 (18e 6h) | 17 | 3 | 26e 15h 11d 1l 5f | 0.0043 / 0.0063 |
| static (drone-heavy 3/2/4/1/1) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 19 (13e 6h) | 12 | 3 | 19e 11h 18d 0l 2f | 0.0041 / 0.0062 |
| static (flak-heavy 3/2/1/1/4) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 28 (23e 5h) | 22 | 3 | 31e 19h 7d 0l 2f | 0.0044 / 0.0066 |
| static (lancer-heavy 3/2/1/4/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 29 (23e 6h) | 23 | 3 | 31e 20h 8d 0l 1f | 0.0045 / 0.0067 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 13 hit / 1 turned back | 17 (15e 2h) | 10 | 5 | 20e 7h 17d 1l 5f | 0.0043 / 0.0079 |

## H7 capability flags (report lines, not gates)

1. MET: Splitting matters: static either loses at least half the economy ships it built to raids or fails to take the hive within the cap, and adaptive takes the hive
   - static/1 (war-lean 2/1/3/2/3) timeout, lost 17 of 27 economy ships ok; static/2 (war-lean 2/1/3/2/3) timeout, lost 17 of 27 economy ships ok; static/3 (war-lean 2/1/3/2/3) timeout, lost 17 of 27 economy ships ok; adaptive/1 won, adaptive/2 won, adaptive/3 won
2. MET: Greed is answered by raids: greedy's first hitting raid kills at least 2 economy ships, and greedy still wins after responding
   - greedy/1 first hit killed 4, won ok; greedy/2 first hit killed 4, won ok; greedy/3 first hit killed 4, won ok
3. MET: Waiting is safe: idle is raided at most once
   - idle/1 raids mustered 0 (hit 0, beaten 0, turned back 0) ok; idle/2 raids mustered 0 (hit 0, beaten 0, turned back 0) ok; idle/3 raids mustered 0 (hit 0, beaten 0, turned back 0) ok
4. MET: The counter-attack window is real: the hive's smallest winning wave with a full-size raid out is at least 30% smaller than at full strength
   - best mix at full strength 16; with a raid of 4 Thorns and 8 Spores out 11
5. MET: Counters matter: drones-only can't take the hive within field.fleetCap minus 10 economy ships (its best drone wave doesn't fit)
   - smallest drone wave none within 30 against 20 warship slots (field.fleetCap 30 minus 10)
6. MET: Economy against offence is a trade in slots: the hive's best mix plus a full economy is more than field.fleetCap, and the best mix plus 10 economy ships fits
   - best mix 16; full economy 23 (13 Mine slots plus 10 haulers at adaptive's peak); field.fleetCap 30; best mix + full economy = 39, best mix + 10 = 26
7. MET: No free first win: every guarded node needs more drones than the opening stock buys
   - p1 needs more than 3 drones (2 buyable from the opening stock) ok; p2 needs more than 3 drones (2 buyable from the opening stock) ok; heart needs more than 3 drones (2 buyable from the opening stock) ok

## Designer: targets on v13 (see DESIGN.md "Calibration result (h7-design-data, data v13)")

- Pace: adaptive 20:02, greedy 30:16 (targets 15–30, ≤ 40); adaptive-no-raids 11:10.
- First raid musters at 2:53 (tick 5191).
- Undefended full-economy raid on a5 (11: 4T 7S at econ 22) kills all 5 economy ships there; 3 lancers + 5 flak beat it losing 2 (2 + 5 lose 3).
- Hive best mix 16 (7 lancers, 9 flak), 4 spare under field.fleetCap − 10; with a full-size raid (12) out, 11 (31%).
- Pockets: p1 6 drones; p2 8 drones, or 5 with Flak (2 drones, 3 Flak).
- Order check: every min-wave number above is unchanged with ships placed flak-first and the raid-away hive keeping its highest guard ids.
- Note: drones-only's softlock rows are the bot idling with every weight at 0 after its economy is wiped (probe mining kept running); a control, not gated.
