> **Values tried, not shipped.** The Director kept data v14 (DECISIONS.md, "Director: h8-design-data stays on v14", 2026-11-15). This report is the record of the v15 exploration (`guard.spore.damage` 2, p1 0 / 3). The shipped result is `reports/archive/h8-design-data-v14.md`.

# Bot suite: PASS

Data version 15, 3 seeds, field mode, 6 strategies (adaptive, greedy, static, idle, drones-only, adaptive-no-raids). Cap 45 game minutes, softlock after 5 minutes with no ship start and no delivery, tick budget p95 ≤ 2 ms. Runs 135.5 s. Times are game minutes (m:ss). Gated for softlock and timeout: adaptive, greedy; the others are controls and are reported only.

## Failures

None.

## Per run

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 25:54 | 10 mustered: 3 beaten / 6 hit / 0 turned back | 10 (10e 0h) | 20 | 132 | 22e 10h 23d 19l 19f | 0.0075 / 0.0181 |
| adaptive | 2 | 25:54 | 10 mustered: 3 beaten / 6 hit / 0 turned back | 10 (10e 0h) | 20 | 132 | 22e 10h 23d 19l 19f | 0.0067 / 0.0150 |
| adaptive | 3 | 25:54 | 10 mustered: 3 beaten / 6 hit / 0 turned back | 10 (10e 0h) | 20 | 132 | 22e 10h 23d 19l 19f | 0.0067 / 0.0150 |
| greedy | 1 | 15:57 | 6 mustered: 1 beaten / 4 hit / 0 turned back | 6 (6e 0h) | 17 | 53 | 14e 9h 16d 7l 10f | 0.0071 / 0.0152 |
| greedy | 2 | 15:57 | 6 mustered: 1 beaten / 4 hit / 0 turned back | 6 (6e 0h) | 17 | 53 | 14e 9h 16d 7l 10f | 0.0062 / 0.0144 |
| greedy | 3 | 15:57 | 6 mustered: 1 beaten / 4 hit / 0 turned back | 6 (6e 0h) | 17 | 53 | 14e 9h 16d 7l 10f | 0.0064 / 0.0145 |
| idle | 1 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0049 / 0.0106 |
| idle | 2 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0049 / 0.0106 |
| idle | 3 | timeout 45:00 | 1 mustered: 0 beaten / 1 hit / 0 turned back | 2 (2e 0h) | 6 | 9 | 5e 2h 25d 0l 0f | 0.0050 / 0.0108 |
| drones-only | 1 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 50 | 11e 5h 65d 0l 0f | 0.0072 / 0.0154 |
| drones-only | 2 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 50 | 11e 5h 65d 0l 0f | 0.0071 / 0.0153 |
| drones-only | 3 | timeout 45:00 | 18 mustered: 15 beaten / 3 hit / 0 turned back | 5 (5e 0h) | 13 | 50 | 11e 5h 65d 0l 0f | 0.0073 / 0.0166 |
| adaptive-no-raids | 1 | 10:20 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 15 | 34 | 8e 7h 7d 10l 11f | 0.0065 / 0.0157 |
| adaptive-no-raids | 2 | 10:20 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 15 | 34 | 8e 7h 7d 10l 11f | 0.0062 / 0.0155 |
| adaptive-no-raids | 3 | 10:20 | 0 mustered: 0 beaten / 0 hit / 0 turned back | 0 (0e 0h) | 15 | 34 | 8e 7h 7d 10l 11f | 0.0063 / 0.0131 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 3 hit / 11 turned back | 4 (4e 0h) | 11 | 5 | 9e 5h 15d 1l 6f | 0.0112 / 0.0215 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 3 hit / 11 turned back | 4 (4e 0h) | 11 | 5 | 9e 5h 15d 1l 6f | 0.0113 / 0.0184 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 3 hit / 11 turned back | 4 (4e 0h) | 11 | 5 | 9e 5h 15d 1l 6f | 0.0112 / 0.0182 |

## The static sweep (the best shape per seed is the `static` row above: a win, then the earlier hive, then the fewer economy ships lost)

Shapes (extractor / hauler / drone / lancer / flak weights): econ-lean 4/3/1/1/1; even 3/2/2/2/2; drone-heavy 3/2/4/1/1; flak-heavy 3/2/1/1/4; lancer-heavy 3/2/1/4/1; war-lean 2/1/3/2/3.

| Strategy | Seed | Time to the hive | Raids by outcome | Economy ships lost | Peak economy | Allocation changes | Ships built (e/h/d/l/f) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| static (econ-lean 4/3/1/1/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 25 | 5 | 34e 12h 7d 0l 0f | 0.0129 / 0.0222 |
| static (even 3/2/2/2/2) | 1 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 17 (17e 0h) | 18 | 3 | 26e 9h 11d 1l 4f | 0.0126 / 0.0228 |
| static (drone-heavy 3/2/4/1/1) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 15d 1l 2f | 0.0121 / 0.0223 |
| static (flak-heavy 3/2/1/1/4) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 24 | 3 | 33e 11h 8d 0l 4f | 0.0129 / 0.0218 |
| static (lancer-heavy 3/2/1/4/1) | 1 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 23 | 3 | 33e 11h 8d 0l 1f | 0.0099 / 0.0204 |
| static (war-lean 2/1/3/2/3) | 1 | timeout 45:00 | 15 mustered: 0 beaten / 3 hit / 11 turned back | 4 (4e 0h) | 11 | 5 | 9e 5h 15d 1l 6f | 0.0112 / 0.0215 |
| static (econ-lean 4/3/1/1/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 25 | 5 | 34e 12h 7d 0l 0f | 0.0132 / 0.0284 |
| static (even 3/2/2/2/2) | 2 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 17 (17e 0h) | 18 | 3 | 26e 9h 11d 1l 4f | 0.0127 / 0.0231 |
| static (drone-heavy 3/2/4/1/1) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 15d 1l 2f | 0.0121 / 0.0199 |
| static (flak-heavy 3/2/1/1/4) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 24 | 3 | 33e 11h 8d 0l 4f | 0.0130 / 0.0228 |
| static (lancer-heavy 3/2/1/4/1) | 2 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 23 | 3 | 33e 11h 8d 0l 1f | 0.0100 / 0.0191 |
| static (war-lean 2/1/3/2/3) | 2 | timeout 45:00 | 15 mustered: 0 beaten / 3 hit / 11 turned back | 4 (4e 0h) | 11 | 5 | 9e 5h 15d 1l 6f | 0.0113 / 0.0184 |
| static (econ-lean 4/3/1/1/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 25 | 5 | 34e 12h 7d 0l 0f | 0.0130 / 0.0227 |
| static (even 3/2/2/2/2) | 3 | timeout 45:00 | 16 mustered: 0 beaten / 16 hit / 0 turned back | 17 (17e 0h) | 18 | 3 | 26e 9h 11d 1l 4f | 0.0126 / 0.0224 |
| static (drone-heavy 3/2/4/1/1) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 14 hit / 1 turned back | 15 (15e 0h) | 14 | 3 | 22e 7h 15d 1l 2f | 0.0120 / 0.0198 |
| static (flak-heavy 3/2/1/1/4) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 24 | 3 | 33e 11h 8d 0l 4f | 0.0130 / 0.0217 |
| static (lancer-heavy 3/2/1/4/1) | 3 | timeout 45:00 | 17 mustered: 0 beaten / 17 hit / 0 turned back | 22 (22e 0h) | 23 | 3 | 33e 11h 8d 0l 1f | 0.0100 / 0.0192 |
| static (war-lean 2/1/3/2/3) | 3 | timeout 45:00 | 15 mustered: 0 beaten / 3 hit / 11 turned back | 4 (4e 0h) | 11 | 5 | 9e 5h 15d 1l 6f | 0.0112 / 0.0182 |

## Staffing and the shield (H8)

Per run: idle haulers at the probe (peak, and game minutes with more than 1 idle outside raids); backed-up seconds per rock while its hauler target was met (total, with the longest run in brackets); economy ships lost in a tick that began with a warship at the raid target (must be 0: raid.shieldEcon is 1 and h8-raids is merged); the longest run with ore for the dearest unlocked warship in stock, room under the fleet limit and no bay running (the no-idle measure).

| Strategy | Seed | Idle haulers peak | Minutes with more than 1 idle | Backed up with target met (s, longest) | Economy lost under a guard | Longest idle with ore (min) |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | 1 | 1 | 0 | none | 0 | 0.35 |
| adaptive | 2 | 1 | 0 | none | 0 | 0.35 |
| adaptive | 3 | 1 | 0 | none | 0 | 0.35 |
| greedy | 1 | 1 | 0 | none | 0 | 0.25 |
| greedy | 2 | 1 | 0 | none | 0 | 0.25 |
| greedy | 3 | 1 | 0 | none | 0 | 0.25 |
| idle | 1 | 1 | 0 | none | 0 | 0 |
| idle | 2 | 1 | 0 | none | 0 | 0 |
| idle | 3 | 1 | 0 | none | 0 | 0 |
| drones-only | 1 | 1 | 0 | none | 0 | 0.33 |
| drones-only | 2 | 1 | 0 | none | 0 | 0.33 |
| drones-only | 3 | 1 | 0 | none | 0 | 0.33 |
| adaptive-no-raids | 1 | 0 | 0 | a5 3 (3) | 0 | 0.24 |
| adaptive-no-raids | 2 | 0 | 0 | a5 3 (3) | 0 | 0.24 |
| adaptive-no-raids | 3 | 0 | 0 | a5 3 (3) | 0 | 0.24 |
| static (war-lean 2/1/3/2/3) | 1 | 0 | 0 | a1 4 (4), p2 2 (2) | 0 | 0 |
| static (war-lean 2/1/3/2/3) | 2 | 0 | 0 | a1 4 (4), p2 2 (2) | 0 | 0 |
| static (war-lean 2/1/3/2/3) | 3 | 0 | 0 | a1 4 (4), p2 2 (2) | 0 | 0 |

## Trace at 15, 30 and 45 game minutes (seed 1)

Economy alive (extractors / haulers), warships alive (drones / lancers / flak), ore in stock, the weights (e/h/d/l/f) and the bays running. A run that ended earlier has fewer rows.

| Strategy | Minute | Extractors / haulers | Warships d/l/f | Stock ore | Weights e/h/d/l/f | Bays running |
| --- | --- | --- | --- | --- | --- | --- |
| adaptive | 15 | 6 / 6 | 0/2/2 | 1 | 1/1/0/5/5 | none |
| greedy | 15 | 8 / 8 | 0/6/7 | 1 | 0/0/0/5/5 | none |
| idle | 15 | 3 / 2 | 25/0/0 | 37 | 0/0/5/0/0 | none |
| idle | 30 | 3 / 2 | 25/0/0 | 669 | 0/0/5/0/0 | none |
| idle | 45 | 3 / 2 | 25/0/0 | 1297 | 0/0/5/0/0 | none |
| drones-only | 15 | 6 / 5 | 19/0/0 | 52 | 0/0/5/0/0 | none |
| drones-only | 30 | 6 / 5 | 19/0/0 | 859 | 0/0/1/0/0 | none |
| drones-only | 45 | 6 / 5 | 19/0/0 | 1620 | 0/0/5/0/0 | none |
| static (war-lean 2/1/3/2/3) | 15 | 6 / 4 | 11/0/3 | 1 | 2/1/3/2/3 | flak |
| static (war-lean 2/1/3/2/3) | 30 | 5 / 5 | 13/1/6 | 592 | 2/1/3/2/3 | none |
| static (war-lean 2/1/3/2/3) | 45 | 5 / 5 | 13/1/6 | 1372 | 2/1/3/2/3 | none |

## What no bot exercises

Bots stay on Auto haulers and use only `sendShips` and `recycleShips`. No bot uses: the drag gesture (a client gesture), `setHaulers`, `moveShips`, `recycleFleet`, or Mine mode (a client mode; the bots never send `setMine` and play with the marks the map starts with). Sim tests and the reference replay cover `setHaulers`, `moveShips` and `recycleFleet`; h8-client smoke tests cover the drag and Mine mode.

## H7 capability flags (report lines, not gates)

1. MET: Splitting matters: static either loses at least half the economy ships it built to raids or fails to take the hive within the cap, and adaptive takes the hive
   - static/1 (war-lean 2/1/3/2/3) timeout, lost 4 of 14 economy ships ok; static/2 (war-lean 2/1/3/2/3) timeout, lost 4 of 14 economy ships ok; static/3 (war-lean 2/1/3/2/3) timeout, lost 4 of 14 economy ships ok; adaptive/1 won, adaptive/2 won, adaptive/3 won
2. MET: Greed is answered by raids: greedy's first hitting raid kills at least 2 economy ships, and greedy still wins after responding
   - greedy/1 first hit killed 2, won ok; greedy/2 first hit killed 2, won ok; greedy/3 first hit killed 2, won ok
3. MET: Waiting is safe: idle is raided at most once
   - idle/1 raids mustered 1 (hit 1, beaten 0, turned back 0) ok; idle/2 raids mustered 1 (hit 1, beaten 0, turned back 0) ok; idle/3 raids mustered 1 (hit 1, beaten 0, turned back 0) ok
4. MET: The counter-attack window is real: the hive's smallest winning wave with a full-size raid out is at least 30% smaller than at full strength
   - best mix at full strength 18; with a raid of 4 Thorns and 8 Spores out 12
5. MET: Counters matter: drones-only can't take the hive within field.fleetCap minus 10 economy ships (its best drone wave doesn't fit)
   - smallest drone wave none within 30 against 20 warship slots (field.fleetCap 30 minus 10)
6. MET: Economy against offence is a trade in slots: the hive's best mix plus a full economy is more than field.fleetCap, and the best mix plus 10 economy ships fits
   - best mix 18; full economy 23 (13 Mine slots plus 10 haulers at adaptive's peak); field.fleetCap 30; best mix + full economy = 41, best mix + 10 = 28
7. MET: No free first win: every guarded node needs more drones than the opening stock buys
   - p1 needs more than 3 drones (2 buyable from the opening stock) ok; p2 needs more than 3 drones (2 buyable from the opening stock) ok; heart needs more than 3 drones (2 buyable from the opening stock) ok

## Designer probe and order check on v15 (h8-design-data)

From `reports/archive/h8-design-data-v15.mts` (run from the repo root with no overrides), on shipped data: the winners' first raid, the hauler need on a full field, raid fights at a5 (3 docked extractors and 3 haulers there at launch, the raid flying from the hive, nothing else running), the min-wave estimate (bots field-estimate), and the order check.

- adaptive: won at 25:54; first raid musters at 2:42 (tick 4862, 1T 2S); raids 10 (3 beaten / 6 hit / 0 turned back); economy lost 10e 0h; peak haulers 10
- greedy: won at 15:57; first raid musters at 2:42 (tick 4862, 1T 2S); raids 6 (1 beaten / 4 hit / 0 turned back); economy lost 6e 0h; peak haulers 9
- Hauler need on a full field (13 extractors): a1 1, a2 1, a3 1, a4 1, a5 3, a6 2, a7 2; total 11. Full economy 24, so its raid is 12.
- The full-economy raid (econ 24): 4T 8S (12). Fights at a5 (3 extractors docked, 3 haulers there at launch):
  - undefended: hit, killed 3 extractors and 0 haulers
  - smallest defence that wins losing ≤ 2: 5 lancers + 4 flak (9) beat it losing 2 warships, economy lost 0e 0h
  - half-size matched defence 2 lancers + 4 flak (6): beaten, raid hits; warships lost 6, economy lost 3e 0h
  - neighbours: 2L+3F: hit (warships lost 5, econ 3e 0h); 3L+4F: beaten (warships lost 3, econ 0e 0h)
- Hive best mix 18 ({"drone":0,"lancer":9,"flak":9}); with a full raid out 12 ({"drone":0,"lancer":5,"flak":7}); pockets: p1 6 drones, p2 6 drones.
- Order check, min-wave (estimate order / second order): hive 18 / 18; hive with the full raid out 12 / 12; p1 drones 6 / 6; p2 drones 6 / 6.
- Order check, a5 fights against 4T 8S (estimate order / second order): undefended: hit (warships lost 0, econ 3e 0h) / hit (warships lost 0, econ 3e 0h); 5L+4F: beaten (warships lost 2, econ 0e 0h) / beaten (warships lost 2, econ 0e 0h); half 2L+4F: hit (warships lost 6, econ 3e 0h) / hit (warships lost 6, econ 3e 0h).

## Values tried from v14 (h8-design-data)

The same script with `QUICK=1` (fights and min-waves only, no bot runs) and overrides that restore v14 (`guard.spore.damage=1 guards.p1=0/4`) plus one value each. Each block is one command line.

### Probe (dataVersion 15; overrides: guard.spore.damage=1 guards.p1=0/4)
- The full-economy raid (econ 24): 4T 8S (12). Fights at a5 (3 extractors docked, 3 haulers there at launch):
  - undefended: hit, killed 3 extractors and 0 haulers
  - smallest defence that wins losing ≤ 2: 5 lancers + 2 flak (7) beat it losing 2 warships, economy lost 0e 0h
  - half-size matched defence 2 lancers + 4 flak (6): BEATS the raid; warships lost 3, economy lost 0e 0h
  - neighbours: 2L+3F: hit (warships lost 5, econ 3e 0h); 3L+4F: beaten (warships lost 2, econ 0e 0h)
- Hive best mix 16 ({"drone":0,"lancer":7,"flak":9}); with a full raid out 11 ({"drone":0,"lancer":5,"flak":6}); pockets: p1 6 drones, p2 5 drones.

### Probe (dataVersion 15; overrides: guard.spore.damage=1 guards.p1=0/4 guard.spore.hp=7)
- The full-economy raid (econ 24): 4T 8S (12). Fights at a5 (3 extractors docked, 3 haulers there at launch):
  - undefended: hit, killed 3 extractors and 0 haulers
  - smallest defence that wins losing ≤ 2: 6 lancers + 2 flak (8) beat it losing 2 warships, economy lost 0e 0h
  - half-size matched defence 2 lancers + 4 flak (6): BEATS the raid; warships lost 5, economy lost 0e 0h
  - neighbours: 2L+3F: hit (warships lost 5, econ 3e 0h); 3L+4F: beaten (warships lost 3, econ 0e 0h)
- Hive best mix 17 ({"drone":0,"lancer":7,"flak":10}); with a full raid out 11 ({"drone":0,"lancer":5,"flak":6}); pockets: p1 7 drones, p2 7 drones.

### Probe (dataVersion 15; overrides: guard.spore.damage=1 guards.p1=0/4 guard.spore.hp=8)
- The full-economy raid (econ 24): 4T 8S (12). Fights at a5 (3 extractors docked, 3 haulers there at launch):
  - undefended: hit, killed 3 extractors and 0 haulers
  - smallest defence that wins losing ≤ 2: 5 lancers + 3 flak (8) beat it losing 2 warships, economy lost 0e 0h
  - half-size matched defence 2 lancers + 4 flak (6): BEATS the raid; warships lost 5, economy lost 0e 0h
  - neighbours: 2L+3F: hit (warships lost 5, econ 3e 0h); 3L+4F: beaten (warships lost 3, econ 0e 0h)
- Hive best mix 17 ({"drone":0,"lancer":7,"flak":10}); with a full raid out 11 ({"drone":0,"lancer":5,"flak":6}); pockets: p1 8 drones, p2 7 drones.

### Probe (dataVersion 15; overrides: guard.spore.damage=1 guards.p1=0/4 guard.thorn.damage=4)
- The full-economy raid (econ 24): 4T 8S (12). Fights at a5 (3 extractors docked, 3 haulers there at launch):
  - undefended: hit, killed 3 extractors and 0 haulers
  - smallest defence that wins losing ≤ 2: 4 lancers + 4 flak (8) beat it losing 2 warships, economy lost 0e 0h
  - half-size matched defence 2 lancers + 4 flak (6): BEATS the raid; warships lost 5, economy lost 0e 0h
  - neighbours: 2L+3F: hit (warships lost 5, econ 3e 0h); 3L+4F: beaten (warships lost 3, econ 0e 0h)
- Hive best mix 18 ({"drone":0,"lancer":8,"flak":10}); with a full raid out 12 ({"drone":0,"lancer":5,"flak":7}); pockets: p1 6 drones, p2 5 drones.

### Probe (dataVersion 15; overrides: guard.spore.damage=1 guards.p1=0/4 guard.spore.damage=2)
- The full-economy raid (econ 24): 4T 8S (12). Fights at a5 (3 extractors docked, 3 haulers there at launch):
  - undefended: hit, killed 3 extractors and 0 haulers
  - smallest defence that wins losing ≤ 2: 5 lancers + 4 flak (9) beat it losing 2 warships, economy lost 0e 0h
  - half-size matched defence 2 lancers + 4 flak (6): beaten, raid hits; warships lost 6, economy lost 3e 0h
  - neighbours: 2L+3F: hit (warships lost 5, econ 3e 0h); 3L+4F: beaten (warships lost 3, econ 0e 0h)
- Hive best mix 18 ({"drone":0,"lancer":9,"flak":9}); with a full raid out 12 ({"drone":0,"lancer":5,"flak":7}); pockets: p1 7 drones, p2 6 drones.
