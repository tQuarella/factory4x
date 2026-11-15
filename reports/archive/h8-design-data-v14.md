# Bot suite: PASS

Data version 14, 3 seeds, field mode, 6 strategies (adaptive, greedy, static, idle, drones-only, adaptive-no-raids). Cap 45 game minutes, softlock after 5 minutes with no ship start and no delivery, tick budget p95 ≤ 2 ms. Runs 116.0 s. Times are game minutes (m:ss). Gated for softlock and timeout: adaptive, greedy; the others are controls and are reported only.

## Failures

None.

## Per run

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 15:53 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 6 (6e 0h) | 17 | 50 | 14e 9h 16d 5l 9f | 0.0071 / 0.0165 |
| adaptive | 2 | 15:53 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 6 (6e 0h) | 17 | 50 | 14e 9h 16d 5l 9f | 0.0064 / 0.0139 |
| adaptive | 3 | 15:53 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 6 (6e 0h) | 17 | 50 | 14e 9h 16d 5l 9f | 0.0062 / 0.0127 |
| greedy | 1 | 15:45 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 17 | 54 | 13e 10h 16d 5l 10f | 0.0063 / 0.0128 |
| greedy | 2 | 15:45 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 17 | 54 | 13e 10h 16d 5l 10f | 0.0062 / 0.0128 |
| greedy | 3 | 15:45 | 6 mustered: 2 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 17 | 54 | 13e 10h 16d 5l 10f | 0.0063 / 0.0125 |
| idle | 1 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0049 / 0.0094 |
| idle | 2 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0049 / 0.0098 |
| idle | 3 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0049 / 0.0093 |
| drones-only | 1 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 49 | 11e 5h 48d 0l 0f | 0.0064 / 0.0136 |
| drones-only | 2 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 49 | 11e 5h 48d 0l 0f | 0.0064 / 0.0132 |
| drones-only | 3 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 49 | 11e 5h 48d 0l 0f | 0.0064 / 0.0132 |
| adaptive-no-raids | 1 | 9:46 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 42 | 8e 9h 7d 8l 10f | 0.0063 / 0.0134 |
| adaptive-no-raids | 2 | 9:46 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 42 | 8e 9h 7d 8l 10f | 0.0063 / 0.0133 |
| adaptive-no-raids | 3 | 9:46 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 16 | 42 | 8e 9h 7d 8l 10f | 0.0065 / 0.0133 |
| static (drone-heavy 3/2/4/1/1) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0121 / 0.0200 |
| static (drone-heavy 3/2/4/1/1) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0121 / 0.0195 |
| static (drone-heavy 3/2/4/1/1) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0124 / 0.0196 |

## The static sweep (the best shape per seed is the `static` row above: a win, then the earlier hive, then the fewer economy ships lost)

Shapes (extractor / hauler / drone / lancer / flak weights): econ-lean 4/3/1/1/1; even 3/2/2/2/2; drone-heavy 3/2/4/1/1; flak-heavy 3/2/1/1/4; lancer-heavy 3/2/1/4/1; war-lean 2/1/3/2/3.

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static (econ-lean 4/3/1/1/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 23 (23e 0h) | 25 | 5 | 35e 13h 7d 1l 0f | 0.0134 / 0.0232 |
| static (even 3/2/2/2/2) | 1 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 17 (17e 0h) | 17 | 3 | 26e 8h 10d 4l 2f | 0.0127 / 0.0211 |
| static (drone-heavy 3/2/4/1/1) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0121 / 0.0200 |
| static (flak-heavy 3/2/1/1/4) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 24 | 3 | 33e 12h 8d 2l 0f | 0.0101 / 0.0175 |
| static (lancer-heavy 3/2/1/4/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 20 | 3 | 32e 9h 7d 7l 0f | 0.0131 / 0.0218 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0113 / 0.0184 |
| static (econ-lean 4/3/1/1/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 23 (23e 0h) | 25 | 5 | 35e 13h 7d 1l 0f | 0.0133 / 0.0227 |
| static (even 3/2/2/2/2) | 2 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 17 (17e 0h) | 17 | 3 | 26e 8h 10d 4l 2f | 0.0128 / 0.0209 |
| static (drone-heavy 3/2/4/1/1) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0121 / 0.0195 |
| static (flak-heavy 3/2/1/1/4) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 24 | 3 | 33e 12h 8d 2l 0f | 0.0100 / 0.0180 |
| static (lancer-heavy 3/2/1/4/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 20 | 3 | 32e 9h 7d 7l 0f | 0.0134 / 0.0222 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0116 / 0.0181 |
| static (econ-lean 4/3/1/1/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 23 (23e 0h) | 25 | 5 | 35e 13h 7d 1l 0f | 0.0137 / 0.0227 |
| static (even 3/2/2/2/2) | 3 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 17 (17e 0h) | 17 | 3 | 26e 8h 10d 4l 2f | 0.0131 / 0.0215 |
| static (drone-heavy 3/2/4/1/1) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 16d 2l 1f | 0.0124 / 0.0196 |
| static (flak-heavy 3/2/1/1/4) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 24 | 3 | 33e 12h 8d 2l 0f | 0.0102 / 0.0172 |
| static (lancer-heavy 3/2/1/4/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 20 | 3 | 32e 9h 7d 7l 0f | 0.0134 / 0.0215 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 0 turned back | 15 (15e 0h) | 10 | 5 | 20e 5h 15d 2l 6f | 0.0116 / 0.0182 |

## Staffing and the shield (H8)

Per run: idle haulers at the probe (peak, and game minutes with more than 1 idle outside raids); backed-up seconds per rock while its hauler target was met (total, with the longest run in brackets); economy ships lost in a tick that began with a warship at the raid target (must be 0: raid.shieldEcon is 1 and h8-raids is merged); the longest run with ore for the dearest unlocked warship in stock, room under the fleet limit and no bay running (the no-idle measure).

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

## Designer probe and order check on v14 (h8-design-data, the shipped result)

From `reports/archive/h8-design-data-v14.mts` (run from the repo root with no overrides), on shipped data: the winners' first raid, the hauler need on a full field, raid fights at a5 (3 docked extractors and 3 haulers there at launch, the raid flying from the hive, nothing else running), the min-wave estimate (bots field-estimate), and the order check.

- adaptive: won at 15:53; first raid musters at 2:42 (tick 4862, 1T 2S); raids 6 (2 beaten / 3 hit / 0 turned back); economy lost 6e 0h; peak haulers 9
- greedy: won at 15:45; first raid musters at 2:42 (tick 4862, 1T 2S); raids 6 (2 beaten / 3 hit / 0 turned back); economy lost 5e 0h; peak haulers 9
- Hauler need on a full field (13 extractors): a1 1, a2 1, a3 1, a4 1, a5 3, a6 2, a7 2; total 11. Full economy 24, so its raid is 12.
- The full-economy raid (econ 24): 4T 8S (12). Fights at a5 (3 extractors docked, 3 haulers there at launch):
  - undefended: hit, killed 3 extractors and 0 haulers
  - smallest defence that wins losing ≤ 2: 5 lancers + 2 flak (7) beat it losing 2 warships, economy lost 0e 0h
  - half-size matched defence 2 lancers + 4 flak (6): BEATS the raid; warships lost 3, economy lost 0e 0h
  - neighbours: 2L+3F: hit (warships lost 5, econ 3e 0h); 3L+4F: beaten (warships lost 2, econ 0e 0h)
- Hive best mix 16 ({"drone":0,"lancer":7,"flak":9}); with a full raid out 11 ({"drone":0,"lancer":5,"flak":6}); pockets: p1 6 drones, p2 5 drones.
- Order check, min-wave (estimate order / second order): hive 16 / 16; hive with the full raid out 11 / 11; p1 drones 6 / 6; p2 drones 5 / 5.
- Order check, a5 fights against 4T 8S (estimate order / second order): undefended: hit (warships lost 0, econ 3e 0h) / hit (warships lost 0, econ 3e 0h); 3L+4F: beaten (warships lost 2, econ 0e 0h) / beaten (warships lost 2, econ 0e 0h); 5L+2F: beaten (warships lost 2, econ 0e 0h) / beaten (warships lost 2, econ 0e 0h); half 2L+4F: beaten (warships lost 3, econ 0e 0h) / beaten (warships lost 3, econ 0e 0h); 2L+3F: hit (warships lost 5, econ 3e 0h) / hit (warships lost 5, econ 3e 0h); 3L+4F: beaten (warships lost 2, econ 0e 0h) / beaten (warships lost 2, econ 0e 0h).
