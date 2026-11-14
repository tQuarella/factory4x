# Bot suite: PASS

Data version 14, 3 seeds, field mode, 6 strategies (adaptive, greedy, static, idle, drones-only, adaptive-no-raids). Cap 45 game minutes, softlock after 5 minutes with no ship start and no delivery, tick budget p95 ≤ 2 ms. Runs 114.7 s. Times are game minutes (m:ss). Gated for softlock and timeout: adaptive, greedy; the others are controls and are reported only.

## Failures

None.

## Per run

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 15:53 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 6 (6e 0h) | 17 | 50 | 14e 9h 16d 5l 9f | 0.0063 / 0.0122 |
| adaptive | 2 | 15:53 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 6 (6e 0h) | 17 | 50 | 14e 9h 16d 5l 9f | 0.0058 / 0.0102 |
| adaptive | 3 | 15:53 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 6 (6e 0h) | 17 | 50 | 14e 9h 16d 5l 9f | 0.0058 / 0.0117 |
| greedy | 1 | 15:45 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 17 | 54 | 13e 10h 16d 5l 10f | 0.0060 / 0.0111 |
| greedy | 2 | 15:45 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 17 | 54 | 13e 10h 16d 5l 10f | 0.0059 / 0.0100 |
| greedy | 3 | 15:45 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 17 | 54 | 13e 10h 16d 5l 10f | 0.0057 / 0.0091 |
| idle | 1 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0046 / 0.0071 |
| idle | 2 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0046 / 0.0071 |
| idle | 3 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0046 / 0.0071 |
| drones-only | 1 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 49 | 11e 5h 48d 0l 0f | 0.0060 / 0.0097 |
| drones-only | 2 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 49 | 11e 5h 48d 0l 0f | 0.0060 / 0.0098 |
| drones-only | 3 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 49 | 11e 5h 48d 0l 0f | 0.0060 / 0.0094 |
| adaptive-no-raids | 1 | 9:46 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 42 | 8e 9h 7d 8l 10f | 0.0058 / 0.0091 |
| adaptive-no-raids | 2 | 9:46 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 42 | 8e 9h 7d 8l 10f | 0.0058 / 0.0093 |
| adaptive-no-raids | 3 | 9:46 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 42 | 8e 9h 7d 8l 10f | 0.0057 / 0.0087 |
| static (drone-heavy 3/2/4/1/1) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0111 / 0.0123 |
| static (drone-heavy 3/2/4/1/1) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0112 / 0.0134 |
| static (drone-heavy 3/2/4/1/1) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0112 / 0.0121 |

## The static sweep (the best shape per seed is the `static` row above: a win, then the earlier hive, then the fewer economy ships lost)

Shapes (extractor / hauler / drone / lancer / flak weights): econ-lean 4/3/1/1/1; even 3/2/2/2/2; drone-heavy 3/2/4/1/1; flak-heavy 3/2/1/1/4; lancer-heavy 3/2/1/4/1; war-lean 2/1/3/2/3.

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static (econ-lean 4/3/1/1/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 23 (23e 0h) | 25 | 5 | 35e 13h 7d 1l 0f | 0.0123 / 0.0143 |
| static (even 3/2/2/2/2) | 1 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 17 (17e 0h) | 17 | 3 | 26e 8h 10d 4l 2f | 0.0117 / 0.0128 |
| static (drone-heavy 3/2/4/1/1) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0111 / 0.0123 |
| static (flak-heavy 3/2/1/1/4) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 24 | 3 | 33e 12h 8d 2l 0f | 0.0092 / 0.0105 |
| static (lancer-heavy 3/2/1/4/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 20 | 3 | 32e 9h 7d 7l 0f | 0.0120 / 0.0139 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0104 / 0.0113 |
| static (econ-lean 4/3/1/1/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 23 (23e 0h) | 25 | 5 | 35e 13h 7d 1l 0f | 0.0123 / 0.0133 |
| static (even 3/2/2/2/2) | 2 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 17 (17e 0h) | 17 | 3 | 26e 8h 10d 4l 2f | 0.0117 / 0.0128 |
| static (drone-heavy 3/2/4/1/1) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0112 / 0.0134 |
| static (flak-heavy 3/2/1/1/4) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 24 | 3 | 33e 12h 8d 2l 0f | 0.0092 / 0.0110 |
| static (lancer-heavy 3/2/1/4/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 20 | 3 | 32e 9h 7d 7l 0f | 0.0119 / 0.0129 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0104 / 0.0113 |
| static (econ-lean 4/3/1/1/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 23 (23e 0h) | 25 | 5 | 35e 13h 7d 1l 0f | 0.0122 / 0.0131 |
| static (even 3/2/2/2/2) | 3 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 17 (17e 0h) | 17 | 3 | 26e 8h 10d 4l 2f | 0.0116 / 0.0127 |
| static (drone-heavy 3/2/4/1/1) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0112 / 0.0121 |
| static (flak-heavy 3/2/1/1/4) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 24 | 3 | 33e 12h 8d 2l 0f | 0.0092 / 0.0112 |
| static (lancer-heavy 3/2/1/4/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 20 | 3 | 32e 9h 7d 7l 0f | 0.0119 / 0.0129 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0105 / 0.0116 |

## Staffing and the shield (H8)

Per run: idle haulers at the probe (peak, and game minutes with more than 1 idle outside raids); backed-up seconds per rock while its hauler target was met (total, with the longest run in brackets); economy ships lost in a tick that began with a warship at the raid target (0 once raid.shieldEcon 1 is wired by h8-raids); the longest run with ore for the dearest unlocked warship in stock, room under the fleet limit and no bay running (the no-idle measure).

| Strategy | Seed | Idle haulers peak | Minutes with more than 1 idle | Backed up with target met (s, longest) | Economy lost under a guard | Longest idle with ore (min) |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 1 | 0 | none | 0 | 0.43 |
| adaptive | 2 | 1 | 0 | none | 0 | 0.43 |
| adaptive | 3 | 1 | 0 | none | 0 | 0.43 |
| greedy | 1 | 0 | 0 | none | 0 | 0.16 |
| greedy | 2 | 0 | 0 | none | 0 | 0.16 |
| greedy | 3 | 0 | 0 | none | 0 | 0.16 |
| idle | 1 | 1 | 0 | none | 0 | 0 |
| idle | 2 | 1 | 0 | none | 0 | 0 |
| idle | 3 | 1 | 0 | none | 0 | 0 |
| drones-only | 1 | 1 | 0 | none | 0 | 0.41 |
| drones-only | 2 | 1 | 0 | none | 0 | 0.41 |
| drones-only | 3 | 1 | 0 | none | 0 | 0.41 |
| adaptive-no-raids | 1 | 2 | 0.08 | none | 0 | 0.13 |
| adaptive-no-raids | 2 | 2 | 0.08 | none | 0 | 0.13 |
| adaptive-no-raids | 3 | 2 | 0.08 | none | 0 | 0.13 |
| static (drone-heavy 3/2/4/1/1) | 1 | 0 | 0 | a1 4 (4) | 0 | 0 |
| static (drone-heavy 3/2/4/1/1) | 2 | 0 | 0 | a1 4 (4) | 0 | 0 |
| static (drone-heavy 3/2/4/1/1) | 3 | 0 | 0 | a1 4 (4) | 0 | 0 |

## Trace at 15, 30 and 45 game minutes (seed 1)

Economy alive (extractors / haulers), warships alive (drones / lancers / flak), ore in stock, the weights (e/h/d/l/f) and the bays running. A run that ended earlier has fewer rows.

| Strategy | Minute | Extractors / haulers | Warships d/l/f | Stock ore | Weights e/h/d/l/f | Bays running |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | 15 | 9 / 8 | 0/5/7 | 1 | 0/0/0/0/5 | none |
| greedy | 15 | 9 / 8 | 0/5/8 | 39 | 0/0/0/0/0 | none |
| idle | 15 | 3 / 2 | 25/0/0 | 37 | 0/0/5/0/0 | none |
| idle | 30 | 3 / 2 | 25/0/0 | 669 | 0/0/5/0/0 | none |
| idle | 45 | 3 / 2 | 25/0/0 | 1297 | 0/0/5/0/0 | none |
| drones-only | 15 | 6 / 4 | 20/0/0 | 63 | 0/0/5/0/0 | none |
| drones-only | 30 | 6 / 4 | 20/0/0 | 1013 | 0/0/1/0/0 | none |
| drones-only | 45 | 6 / 4 | 20/0/0 | 1934 | 0/0/5/0/0 | none |
| static (drone-heavy 3/2/4/1/1) | 15 | 7 / 6 | 12/0/0 | 1 | 3/2/4/1/1 | none |
| static (drone-heavy 3/2/4/1/1) | 30 | 7 / 7 | 14/1/1 | 701 | 3/2/4/1/1 | none |
| static (drone-heavy 3/2/4/1/1) | 45 | 7 / 7 | 14/1/1 | 1509 | 3/2/4/1/1 | none |

## What no bot exercises

Bots stay on Auto haulers and use only `sendShips` and `recycleShips`. No bot uses: the drag gesture (a client gesture), `setHaulers`, `moveShips`, `recycleFleet`, or Mine mode (a client mode; the bots never send `setMine` and play with the marks the map starts with). Sim tests and the reference replay cover `setHaulers`, `moveShips` and `recycleFleet`; h8-client smoke tests cover the drag and Mine mode.

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
   - best mix 16; full economy 22 (13 Mine slots plus 9 haulers at adaptive's peak); field.fleetCap 30; best mix + full economy = 38, best mix + 10 = 26
7. MET: No free first win: every guarded node needs more drones than the opening stock buys
   - p1 needs more than 3 drones (2 buyable from the opening stock) ok; p2 needs more than 3 drones (2 buyable from the opening stock) ok; heart needs more than 3 drones (2 buyable from the opening stock) ok
