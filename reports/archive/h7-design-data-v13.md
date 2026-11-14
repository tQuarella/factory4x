# Bot suite: PASS

Data version 13, 3 seeds, field mode, 6 strategies (adaptive, greedy, static, idle, drones-only, adaptive-no-raids). Cap 45 game minutes, softlock after 5 minutes with no ship start and no delivery, tick budget p95 ≤ 2 ms. Runs 61.9 s. Times are game minutes (m:ss). Gated for softlock and timeout: adaptive, greedy; the others are controls and are reported only.

## Failures

None.

## Per run

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 24:54 | 9 mustered: 5 beaten / 3 hit / 0 turned back | 6 (4e 2h) | 17 | 122 | 10e 15h 19d 14l 20f | 0.0042 / 0.0082 |
| adaptive | 2 | 24:54 | 9 mustered: 5 beaten / 3 hit / 0 turned back | 6 (4e 2h) | 17 | 122 | 10e 15h 19d 14l 20f | 0.0039 / 0.0077 |
| adaptive | 3 | 24:54 | 9 mustered: 5 beaten / 3 hit / 0 turned back | 6 (4e 2h) | 17 | 122 | 10e 15h 19d 14l 20f | 0.0039 / 0.0071 |
| greedy | 1 | 30:12 | 11 mustered: 6 beaten / 4 hit / 0 turned back | 12 (7e 5h) | 19 | 75 | 12e 16h 35d 6l 11f | 0.0040 / 0.0073 |
| greedy | 2 | 30:12 | 11 mustered: 6 beaten / 4 hit / 0 turned back | 12 (7e 5h) | 19 | 75 | 12e 16h 35d 6l 11f | 0.0040 / 0.0072 |
| greedy | 3 | 30:12 | 11 mustered: 6 beaten / 4 hit / 0 turned back | 12 (7e 5h) | 19 | 75 | 12e 16h 35d 6l 11f | 0.0039 / 0.0069 |
| idle | 1 | timeout 45:00 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 5 | 3 | 3e 2h 25d 0l 0f | 0.0037 / 0.0064 |
| idle | 2 | timeout 45:00 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 5 | 3 | 3e 2h 25d 0l 0f | 0.0037 / 0.0063 |
| idle | 3 | timeout 45:00 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 5 | 3 | 3e 2h 25d 0l 0f | 0.0037 / 0.0061 |
| drones-only | 1 | softlock 28:12 | 8 mustered: 1 beaten / 7 hit / 0 turned back | 24 (13e 11h) | 12 | 22 | 13e 12h 22d 0l 0f | 0.0037 / 0.0065 |
| drones-only | 2 | softlock 28:12 | 8 mustered: 1 beaten / 7 hit / 0 turned back | 24 (13e 11h) | 12 | 22 | 13e 12h 22d 0l 0f | 0.0037 / 0.0067 |
| drones-only | 3 | softlock 28:12 | 8 mustered: 1 beaten / 7 hit / 0 turned back | 24 (13e 11h) | 12 | 22 | 13e 12h 22d 0l 0f | 0.0037 / 0.0063 |
| adaptive-no-raids | 1 | 10:55 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 14 | 44 | 6e 10h 8d 8l 10f | 0.0038 / 0.0067 |
| adaptive-no-raids | 2 | 10:55 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 14 | 44 | 6e 10h 8d 8l 10f | 0.0038 / 0.0066 |
| adaptive-no-raids | 3 | 10:55 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 14 | 44 | 6e 10h 8d 8l 10f | 0.0038 / 0.0065 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 4 hit / 11 turned back | 8 (6e 2h) | 10 | 5 | 10e 7h 17d 1l 6f | 0.0042 / 0.0061 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 4 hit / 11 turned back | 8 (6e 2h) | 10 | 5 | 10e 7h 17d 1l 6f | 0.0041 / 0.0060 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 4 hit / 11 turned back | 8 (6e 2h) | 10 | 5 | 10e 7h 17d 1l 6f | 0.0041 / 0.0060 |

## The static sweep (the best shape per seed is the `static` row above: a win, then the earlier hive, then the fewer economy ships lost)

Shapes (extractor / hauler / drone / lancer / flak weights): econ-lean 4/3/1/1/1; even 3/2/2/2/2; drone-heavy 3/2/4/1/1; flak-heavy 3/2/1/1/4; lancer-heavy 3/2/1/4/1; war-lean 2/1/3/2/3.

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static (econ-lean 4/3/1/1/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 16 hit / 0 turned back | 31 (24e 7h) | 25 | 5 | 33e 22h 7d 0l 0f | 0.0045 / 0.0068 |
| static (even 3/2/2/2/2) | 1 | timeout 45:00 | 16 mustered: 0 beaten / 15 hit / 1 turned back | 23 (18e 5h) | 15 | 3 | 25e 13h 11d 4l 3f | 0.0043 / 0.0063 |
| static (drone-heavy 3/2/4/1/1) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 16 (14e 2h) | 14 | 3 | 21e 9h 16d 2l 1f | 0.0043 / 0.0064 |
| static (flak-heavy 3/2/1/1/4) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 28 (22e 6h) | 25 | 3 | 31e 21h 8d 1l 0f | 0.0044 / 0.0063 |
| static (lancer-heavy 3/2/1/4/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 26 (21e 5h) | 21 | 3 | 29e 18h 6d 4l 0f | 0.0044 / 0.0068 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 4 hit / 11 turned back | 8 (6e 2h) | 10 | 5 | 10e 7h 17d 1l 6f | 0.0042 / 0.0061 |
| static (econ-lean 4/3/1/1/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 16 hit / 0 turned back | 31 (24e 7h) | 25 | 5 | 33e 22h 7d 0l 0f | 0.0046 / 0.0075 |
| static (even 3/2/2/2/2) | 2 | timeout 45:00 | 16 mustered: 0 beaten / 15 hit / 1 turned back | 23 (18e 5h) | 15 | 3 | 25e 13h 11d 4l 3f | 0.0043 / 0.0062 |
| static (drone-heavy 3/2/4/1/1) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 16 (14e 2h) | 14 | 3 | 21e 9h 16d 2l 1f | 0.0043 / 0.0061 |
| static (flak-heavy 3/2/1/1/4) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 28 (22e 6h) | 25 | 3 | 31e 21h 8d 1l 0f | 0.0044 / 0.0063 |
| static (lancer-heavy 3/2/1/4/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 26 (21e 5h) | 21 | 3 | 29e 18h 6d 4l 0f | 0.0044 / 0.0066 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 4 hit / 11 turned back | 8 (6e 2h) | 10 | 5 | 10e 7h 17d 1l 6f | 0.0041 / 0.0060 |
| static (econ-lean 4/3/1/1/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 16 hit / 0 turned back | 31 (24e 7h) | 25 | 5 | 33e 22h 7d 0l 0f | 0.0045 / 0.0066 |
| static (even 3/2/2/2/2) | 3 | timeout 45:00 | 16 mustered: 0 beaten / 15 hit / 1 turned back | 23 (18e 5h) | 15 | 3 | 25e 13h 11d 4l 3f | 0.0043 / 0.0065 |
| static (drone-heavy 3/2/4/1/1) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 16 (14e 2h) | 14 | 3 | 21e 9h 16d 2l 1f | 0.0043 / 0.0061 |
| static (flak-heavy 3/2/1/1/4) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 28 (22e 6h) | 25 | 3 | 31e 21h 8d 1l 0f | 0.0045 / 0.0066 |
| static (lancer-heavy 3/2/1/4/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 26 (21e 5h) | 21 | 3 | 29e 18h 6d 4l 0f | 0.0044 / 0.0066 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 4 hit / 11 turned back | 8 (6e 2h) | 10 | 5 | 10e 7h 17d 1l 6f | 0.0041 / 0.0060 |

## H7 capability flags (report lines, not gates)

1. MET: Splitting matters: static either loses at least half the economy ships it built to raids or fails to take the hive within the cap, and adaptive takes the hive
   - static/1 (war-lean 2/1/3/2/3) timeout, lost 8 of 17 economy ships ok; static/2 (war-lean 2/1/3/2/3) timeout, lost 8 of 17 economy ships ok; static/3 (war-lean 2/1/3/2/3) timeout, lost 8 of 17 economy ships ok; adaptive/1 won, adaptive/2 won, adaptive/3 won
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

- Pace: adaptive 24:54, greedy 30:12 (targets 15–30, ≤ 40); adaptive-no-raids 10:55.
- First raid musters at 2:53 (tick 5191).
- Undefended full-economy raid on a5 (11: 4T 7S at econ 22) kills all 5 economy ships there; 3 lancers + 5 flak beat it losing 2 (2 + 5 lose 3).
- Hive best mix 16 (7 lancers, 9 flak), 4 spare under field.fleetCap − 10; with a full-size raid (12) out, 11 (31%).
- Pockets: p1 (0/4) 6 drones; p2 (1/2) 5 drones. Neither falls to 2.
- Order check: every min-wave number above is unchanged with ships placed flak-first and the raid-away hive keeping its highest guard ids.
- Note: drones-only's softlock rows are the bot idling with every weight at 0 after its economy is wiped (probe mining kept running); a control, not gated.
