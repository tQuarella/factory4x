# Bot suite: PASS

Data version 9, 3 seeds, 6 strategies (composer, ice-first, crystal-first, no-command, drones-only, greedy). Visit cap 30.0 min (a second timeout in one area is a softlock), campaign cap 120 game minutes of play, tick budget p95 ≤ 2 ms. Campaigns 52.2 s, probe 2.2 s.
Times are game minutes of play (m:ss); the overworld is paused and costs none. A seed picks The Deep's layout (1 Glass Thicket, 2 Twin Seams, 3 Frost Gate). `greedy` is the cap-off reference (fleet.cap 0, the H3 engine). Gated for softlock: composer, ice-first, crystal-first; `drones-only` and `no-command` are expected to stall and are reported only.

## Per run

| Strategy | Seed | Outcome | Play time | Area order | Visits (closed = withdrawn when nothing passes the attack test, timeout = visit cap) | Command limit bought | Root cut before heart | Capturing wave per heart (d/l/f) | Built / lost / recycled | Research (play time) | Hauled vs shipped (o/i/c) | Skipped | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| composer | 1 | won | 40:11 | landfall > shoal > shelf > veil > garden > deep | landfall 0:11 > shoal 6:03 > shelf 6:27 > veil 8:45 > garden 6:50 > deep 11:51 | 1 12:42, 2 21:28, 3 28:19 | veil yes, garden yes, deep yes | shoal 10d/0l/0f, shelf 12d/0l/0f, veil 0d/0l/15f, garden 1d/11l/0f, deep 0d/19l/0f | 123 / 75 / 6 | opening1 0:11, lancer1 6:14, extract1 6:14, flak1 12:42, fleet1 12:42, rigs1 12:42, fleet2 21:28, yards1 21:28, extract2 21:28, opening2 21:28, yards2 21:28, fleet3 28:19, rigs2 28:19, core1 40:11 | 2120/340/340 vs 497/111/103 | - | 0.0035 / 0.0088 |
| composer | 2 | won | 40:21 | landfall > shoal > shelf > veil > garden > deep | landfall 0:11 > shoal 6:03 > shelf 6:27 > veil 8:45 > garden 6:50 > deep 12:01 | 1 12:42, 2 21:28, 3 28:19 | veil yes, garden yes, deep yes | shoal 10d/0l/0f, shelf 12d/0l/0f, veil 0d/0l/15f, garden 1d/11l/0f, deep 0d/20l/2f | 124 / 71 / 6 | opening1 0:11, lancer1 6:14, extract1 6:14, flak1 12:42, fleet1 12:42, rigs1 12:42, fleet2 21:28, yards1 21:28, extract2 21:28, opening2 21:28, yards2 21:28, fleet3 28:19, rigs2 28:19, core1 40:21 | 2120/340/340 vs 500/111/104 | - | 0.0033 / 0.0078 |
| composer | 3 | won | 40:04 | landfall > shoal > shelf > veil > garden > deep | landfall 0:11 > shoal 6:03 > shelf 6:27 > veil 8:45 > garden 6:50 > deep 11:44 | 1 12:42, 2 21:28, 3 28:19 | veil yes, garden yes, deep yes | shoal 10d/0l/0f, shelf 12d/0l/0f, veil 0d/0l/15f, garden 1d/11l/0f, deep 0d/16l/7f | 123 / 65 / 6 | opening1 0:11, lancer1 6:14, extract1 6:14, flak1 12:42, fleet1 12:42, rigs1 12:42, fleet2 21:28, yards1 21:28, extract2 21:28, opening2 21:28, yards2 21:28, fleet3 28:19, rigs2 28:19, core1 40:04 | 2120/340/340 vs 494/110/102 | - | 0.0020 / 0.0040 |
| ice-first | 1 | won | 40:12 | landfall > shelf > shoal > veil > garden > deep | landfall 0:11 > shelf 6:32 > shoal 5:59 > veil 8:45 > garden 6:50 > deep 11:51 | 1 12:43, 2 21:29, 3 28:20 | veil yes, garden yes, deep yes | shelf 12d/0l/0f, shoal 10d/0l/0f, veil 0d/0l/15f, garden 1d/11l/0f, deep 0d/19l/0f | 123 / 75 / 6 | opening1 0:11, flak1 6:43, extract1 6:43, lancer1 12:43, fleet1 12:43, rigs1 12:43, fleet2 21:29, yards1 21:29, extract2 21:29, opening2 21:29, yards2 21:29, fleet3 28:20, rigs2 28:20, core1 40:12 | 2120/340/340 vs 495/123/90 | - | 0.0020 / 0.0032 |
| ice-first | 2 | won | 40:22 | landfall > shelf > shoal > veil > garden > deep | landfall 0:11 > shelf 6:32 > shoal 5:59 > veil 8:45 > garden 6:50 > deep 12:01 | 1 12:43, 2 21:29, 3 28:20 | veil yes, garden yes, deep yes | shelf 12d/0l/0f, shoal 10d/0l/0f, veil 0d/0l/15f, garden 1d/11l/0f, deep 0d/20l/2f | 124 / 71 / 6 | opening1 0:11, flak1 6:43, extract1 6:43, lancer1 12:43, fleet1 12:43, rigs1 12:43, fleet2 21:29, yards1 21:29, extract2 21:29, opening2 21:29, yards2 21:29, fleet3 28:20, rigs2 28:20, core1 40:22 | 2120/340/340 vs 499/123/91 | - | 0.0020 / 0.0033 |
| ice-first | 3 | won | 40:05 | landfall > shelf > shoal > veil > garden > deep | landfall 0:11 > shelf 6:32 > shoal 5:59 > veil 8:45 > garden 6:50 > deep 11:44 | 1 12:43, 2 21:29, 3 28:20 | veil yes, garden yes, deep yes | shelf 12d/0l/0f, shoal 10d/0l/0f, veil 0d/0l/15f, garden 1d/11l/0f, deep 0d/16l/7f | 123 / 65 / 6 | opening1 0:11, flak1 6:43, extract1 6:43, lancer1 12:43, fleet1 12:43, rigs1 12:43, fleet2 21:29, yards1 21:29, extract2 21:29, opening2 21:29, yards2 21:29, fleet3 28:20, rigs2 28:20, core1 40:05 | 2120/340/340 vs 493/122/89 | - | 0.0020 / 0.0034 |
| crystal-first | 1 | won | 40:11 | landfall > shoal > shelf > veil > garden > deep | landfall 0:11 > shoal 6:03 > shelf 6:27 > veil 8:45 > garden 6:50 > deep 11:51 | 1 12:42, 2 21:28, 3 28:19 | veil yes, garden yes, deep yes | shoal 10d/0l/0f, shelf 12d/0l/0f, veil 0d/0l/15f, garden 1d/11l/0f, deep 0d/19l/0f | 123 / 75 / 6 | opening1 0:11, lancer1 6:14, extract1 6:14, flak1 12:42, fleet1 12:42, rigs1 12:42, fleet2 21:28, yards1 21:28, extract2 21:28, opening2 21:28, yards2 21:28, fleet3 28:19, rigs2 28:19, core1 40:11 | 2120/340/340 vs 497/111/103 | - | 0.0020 / 0.0032 |
| crystal-first | 2 | won | 40:21 | landfall > shoal > shelf > veil > garden > deep | landfall 0:11 > shoal 6:03 > shelf 6:27 > veil 8:45 > garden 6:50 > deep 12:01 | 1 12:42, 2 21:28, 3 28:19 | veil yes, garden yes, deep yes | shoal 10d/0l/0f, shelf 12d/0l/0f, veil 0d/0l/15f, garden 1d/11l/0f, deep 0d/20l/2f | 124 / 71 / 6 | opening1 0:11, lancer1 6:14, extract1 6:14, flak1 12:42, fleet1 12:42, rigs1 12:42, fleet2 21:28, yards1 21:28, extract2 21:28, opening2 21:28, yards2 21:28, fleet3 28:19, rigs2 28:19, core1 40:21 | 2120/340/340 vs 500/111/104 | - | 0.0020 / 0.0035 |
| crystal-first | 3 | won | 40:04 | landfall > shoal > shelf > veil > garden > deep | landfall 0:11 > shoal 6:03 > shelf 6:27 > veil 8:45 > garden 6:50 > deep 11:44 | 1 12:42, 2 21:28, 3 28:19 | veil yes, garden yes, deep yes | shoal 10d/0l/0f, shelf 12d/0l/0f, veil 0d/0l/15f, garden 1d/11l/0f, deep 0d/16l/7f | 123 / 65 / 6 | opening1 0:11, lancer1 6:14, extract1 6:14, flak1 12:42, fleet1 12:42, rigs1 12:42, fleet2 21:28, yards1 21:28, extract2 21:28, opening2 21:28, yards2 21:28, fleet3 28:19, rigs2 28:19, core1 40:04 | 2120/340/340 vs 494/110/102 | - | 0.0020 / 0.0039 |
| no-command | 1 | softlock | 111:43 (not won) | landfall > shoal > shelf > garden | landfall 0:11 > shoal 6:03 > shelf 6:27 > veil 11:15 (closed) > garden 12:36 > deep 15:07 (closed) > veil 30:00 (timeout) (forced) > veil 30:00 (timeout) (forced) | none | garden yes | shoal 10d/0l/0f, shelf 12d/0l/0f, garden 0d/11l/0f | 452 / 383 / 33 | opening1 0:11, lancer1 6:14, extract1 6:14, flak1 12:42, rigs1 12:42, yards1 12:42, extract2 23:58, opening2 36:35, rigs2 36:35, yards2 36:35, opening3 36:35, extract3 51:43 | 780/150/170 vs 1435/198/436 | veil, deep | 0.0024 / 0.0061 |
| no-command | 2 | softlock | 107:28 (not won) | landfall > shoal > shelf > garden | landfall 0:11 > shoal 6:03 > shelf 6:27 > veil 11:15 (closed) > garden 12:36 > deep 10:52 (closed) > veil 30:00 (timeout) (forced) > veil 30:00 (timeout) (forced) | none | garden yes | shoal 10d/0l/0f, shelf 12d/0l/0f, garden 0d/11l/0f | 390 / 323 / 33 | opening1 0:11, lancer1 6:14, extract1 6:14, flak1 12:42, rigs1 12:42, yards1 12:42, extract2 23:58, opening2 36:35, rigs2 36:35, yards2 36:35, opening3 36:35, extract3 77:28 | 780/150/170 vs 1371/189/415 | veil, deep | 0.0019 / 0.0034 |
| no-command | 3 | softlock | 114:43 (not won) | landfall > shoal > shelf > garden | landfall 0:11 > shoal 6:03 > shelf 6:27 > veil 11:15 (closed) > garden 12:36 > deep 18:07 (closed) > veil 30:00 (timeout) (forced) > veil 30:00 (timeout) (forced) | none | garden yes | shoal 10d/0l/0f, shelf 12d/0l/0f, garden 0d/11l/0f | 476 / 407 / 33 | opening1 0:11, lancer1 6:14, extract1 6:14, flak1 12:42, rigs1 12:42, yards1 12:42, extract2 23:58, opening2 36:35, rigs2 36:35, yards2 36:35, opening3 36:35, extract3 54:43 | 780/150/170 vs 1480/204/451 | veil, deep | 0.0020 / 0.0040 |
| drones-only | 1 | softlock | 80:28 (not won) | landfall > shoal > shelf | landfall 0:11 > shoal 6:03 > shelf 5:33 > veil 4:23 (closed) > garden 4:15 (closed) > veil 30:00 (timeout) (forced) > veil 30:00 (timeout) (forced) | none | - | shoal 10d/0l/0f, shelf 12d/0l/0f | 264 / 222 / 0 | opening1 0:11, extract1 6:14, rigs1 6:14, yards1 11:48, extract2 11:48, opening2 20:28, rigs2 50:28 | 360/80/80 vs 749/137/148 | veil, garden, deep | 0.0022 / 0.0052 |
| drones-only | 2 | softlock | 80:28 (not won) | landfall > shoal > shelf | landfall 0:11 > shoal 6:03 > shelf 5:33 > veil 4:23 (closed) > garden 4:15 (closed) > veil 30:00 (timeout) (forced) > veil 30:00 (timeout) (forced) | none | - | shoal 10d/0l/0f, shelf 12d/0l/0f | 264 / 222 / 0 | opening1 0:11, extract1 6:14, rigs1 6:14, yards1 11:48, extract2 11:48, opening2 20:28, rigs2 50:28 | 360/80/80 vs 749/137/148 | veil, garden, deep | 0.0021 / 0.0050 |
| drones-only | 3 | softlock | 80:28 (not won) | landfall > shoal > shelf | landfall 0:11 > shoal 6:03 > shelf 5:33 > veil 4:23 (closed) > garden 4:15 (closed) > veil 30:00 (timeout) (forced) > veil 30:00 (timeout) (forced) | none | - | shoal 10d/0l/0f, shelf 12d/0l/0f | 264 / 222 / 0 | opening1 0:11, extract1 6:14, rigs1 6:14, yards1 11:48, extract2 11:48, opening2 20:28, rigs2 50:28 | 360/80/80 vs 749/137/148 | veil, garden, deep | 0.0021 / 0.0033 |
| greedy | 1 | won | 41:32 | landfall > shoal > shelf > veil > garden > deep | landfall 0:11 > shoal 6:15 > shelf 6:36 > veil 8:56 > garden 6:53 > deep 12:37 | none | veil yes, garden yes, deep yes | shoal 10d/0l/0f, shelf 12d/0l/0f, veil 6d/5l/9f, garden 2d/9l/5f, deep 0d/15l/14f | 140 / 65 / 0 | opening1 0:11, lancer1 6:26, extract1 6:26, flak1 13:03, rigs1 13:03, yards1 13:03, extract2 22:00, opening2 22:00, rigs2 22:00, yards2 22:00, extract3 28:54, opening3 28:54, core1 41:32 | 2120/340/340 vs 516/115/108 | - | 0.0020 / 0.0034 |
| greedy | 2 | won | 40:10 | landfall > shoal > shelf > veil > garden > deep | landfall 0:11 > shoal 6:15 > shelf 6:36 > veil 8:56 > garden 6:53 > deep 11:15 | none | veil yes, garden yes, deep yes | shoal 10d/0l/0f, shelf 12d/0l/0f, veil 6d/5l/9f, garden 2d/9l/5f, deep 0d/12l/11f | 130 / 57 / 0 | opening1 0:11, lancer1 6:26, extract1 6:26, flak1 13:03, rigs1 13:03, yards1 13:03, extract2 22:00, opening2 22:00, rigs2 22:00, yards2 22:00, extract3 28:54, opening3 28:54, core1 40:10 | 2120/340/340 vs 489/108/101 | - | 0.0019 / 0.0032 |
| greedy | 3 | won | 40:51 | landfall > shoal > shelf > veil > garden > deep | landfall 0:11 > shoal 6:15 > shelf 6:36 > veil 8:56 > garden 6:53 > deep 11:56 | none | veil yes, garden yes, deep yes | shoal 10d/0l/0f, shelf 12d/0l/0f, veil 6d/5l/9f, garden 2d/9l/5f, deep 0d/13l/13f | 135 / 60 / 0 | opening1 0:11, lancer1 6:26, extract1 6:26, flak1 13:03, rigs1 13:03, yards1 13:03, extract2 22:00, opening2 22:00, rigs2 22:00, yards2 22:00, extract3 28:54, opening3 28:54, core1 40:51 | 2120/340/340 vs 503/112/104 | - | 0.0018 / 0.0033 |

## Per-seed comparison (time to the core)

| Seed | composer | ice-first | crystal-first | no-command | drones-only | greedy |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 40:11 | 40:12 | 40:11 | softlock 111:43 (4 areas) | softlock 80:28 (3 areas) | 41:32 |
| 2 | 40:21 | 40:22 | 40:21 | softlock 107:28 (4 areas) | softlock 80:28 (3 areas) | 40:10 |
| 3 | 40:04 | 40:05 | 40:04 | softlock 114:43 (4 areas) | softlock 80:28 (3 areas) | 40:51 |

## Visit times per run, by area (reclaiming visit)

| Strategy | Seed | landfall | shelf | shoal | veil | garden | deep |
| --- | --- | --- | --- | --- | --- | --- | --- |
| composer | 1 | 0:11 | 6:27 | 6:03 | 8:45 | 6:50 | 11:51 |
| composer | 2 | 0:11 | 6:27 | 6:03 | 8:45 | 6:50 | 12:01 |
| composer | 3 | 0:11 | 6:27 | 6:03 | 8:45 | 6:50 | 11:44 |
| ice-first | 1 | 0:11 | 6:32 | 5:59 | 8:45 | 6:50 | 11:51 |
| ice-first | 2 | 0:11 | 6:32 | 5:59 | 8:45 | 6:50 | 12:01 |
| ice-first | 3 | 0:11 | 6:32 | 5:59 | 8:45 | 6:50 | 11:44 |
| crystal-first | 1 | 0:11 | 6:27 | 6:03 | 8:45 | 6:50 | 11:51 |
| crystal-first | 2 | 0:11 | 6:27 | 6:03 | 8:45 | 6:50 | 12:01 |
| crystal-first | 3 | 0:11 | 6:27 | 6:03 | 8:45 | 6:50 | 11:44 |
| no-command | 1 | 0:11 | 6:27 | 6:03 | - | 12:36 | - |
| no-command | 2 | 0:11 | 6:27 | 6:03 | - | 12:36 | - |
| no-command | 3 | 0:11 | 6:27 | 6:03 | - | 12:36 | - |
| drones-only | 1 | 0:11 | 5:33 | 6:03 | - | - | - |
| drones-only | 2 | 0:11 | 5:33 | 6:03 | - | - | - |
| drones-only | 3 | 0:11 | 5:33 | 6:03 | - | - | - |
| greedy | 1 | 0:11 | 6:36 | 6:15 | 8:56 | 6:53 | 12:37 |
| greedy | 2 | 0:11 | 6:36 | 6:15 | 8:56 | 6:53 | 11:15 |
| greedy | 3 | 0:11 | 6:36 | 6:15 | 8:56 | 6:53 | 11:56 |

## Probe: minimum winning waves per heart

Limits at the shipped tunables: L0 12, L1 18, L2 24. d / l / f are the smallest single-type waves that capture the heart from full strength (">80" = none within 80 ships). Mix is the smallest winning total over the locally buildable types (search cap L2 + 6 = 30), with one such fleet (fewest drones, then fewest lancers). "Fits at L" means mix ≤ L − 2; "closed at L" means mix > L; "tight" is between (L − 2 < mix ≤ L). Starved = Root cut; areas without a Root have only a fed row. The Deep is probed per seed (its layout).

| Heart | State | Tier | Buildable | d | l | f | Mix | Mix fleet (d/l/f) | Lancer share | Best mix at L0 / L1 / L2 | Windows (met / missed) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shelf | fed | 1 | drone, flak | 9 | 15 | 3 | 3 | 0/0/3 | 0% | fits / fits / fits | MET: fits L0 (12) with drones |
| shoal | fed | 1 | drone, lancer | 8 | 3 | 15 | 3 | 0/3/0 | 100% | fits / fits / fits | MET: fits L0 (12) with drones |
| veil | fed | 2 | drone, lancer, flak | 34 | 37 | 26 | 16 | 0/8/8 | 50% | closed / fits / fits | MET: closed at L0 (12); MET: fits L1 (18); MET: no single type fits L1 |
| veil | starved | 2 | drone, lancer, flak | 20 | 18 | 14 | 9 | 0/5/4 | 55% | fits / fits / fits | MET: fits L0 (12); MET: drones closed at L1 (18) |
| garden | fed | 2 | drone, lancer, flak | 37 | 24 | 47 | 16 | 0/14/2 | 87% | closed / fits / fits | MET: closed at L0 (12); MET: fits L1 (18); MET: no single type fits L1 |
| garden | starved | 2 | drone, lancer, flak | 20 | 11 | 23 | 9 | 0/8/1 | 88% | fits / fits / fits | MET: fits L0 (12); MET: drones closed at L1 (18) |
| deep (Glass Thicket) | fed | 3 | drone, lancer, flak | 50 | 29 | 63 | 22 | 0/20/2 | 90% | closed / closed / fits | MET: closed at L1 (18); MET: fits L2 (24) |
| deep (Glass Thicket) | starved | 3 | drone, lancer, flak | 33 | 17 | 40 | 15 | 0/14/1 | 93% | closed / fits / fits | MET: fits L1 (18); MET: closed at L0 (12); MET: drones closed at L2 (24) |
| deep (Twin Seams) | fed | 3 | drone, lancer, flak | 45 | 40 | 41 | 20 | 0/13/7 | 65% | closed / closed / fits | MET: closed at L1 (18); MET: fits L2 (24) |
| deep (Twin Seams) | starved | 3 | drone, lancer, flak | 27 | 21 | 23 | 13 | 0/9/4 | 69% | closed / fits / fits | MET: fits L1 (18); MET: closed at L0 (12); MET: drones closed at L2 (24) |
| deep (Frost Gate) | fed | 3 | drone, lancer, flak | 50 | 35 | 58 | 22 | 0/19/3 | 86% | closed / closed / fits | MET: closed at L1 (18); MET: fits L2 (24) |
| deep (Frost Gate) | starved | 3 | drone, lancer, flak | 30 | 18 | 31 | 14 | 0/11/3 | 78% | closed / fits / fits | MET: fits L1 (18); MET: closed at L0 (12); MET: drones closed at L2 (24) |

## H5 flags (report lines, not gates)

Flags 2 and 5 include strategy halves (drones-only, no-command) that pass vacuously when a strategy never leaves tier 1; the details print the area orders.

1. MET: No softlock: composer, ice-first, crystal-first buy the probe core on every seed within 120 game minutes of play
   - all 9 runs bought the core
2. MET: Drones don't fit: every tier 2 and tier 3 heart is closed to drones alone at the tier's limit (starved: tier 2 at L1, tier 3 at L2), and drones-only reclaims no tier 2 or tier 3 area on any seed
   - veil starved drones 20 vs L1 18 ok; garden starved drones 20 vs L1 18 ok; deep/Glass Thicket starved drones 33 vs L2 24 ok; deep/Twin Seams starved drones 27 vs L2 24 ok; deep/Frost Gate starved drones 30 vs L2 24 ok; drones-only: no tier 2/3 area reclaimed (reclaimed: seed 1 landfall>shoal>shelf, seed 2 landfall>shoal>shelf, seed 3 landfall>shoal>shelf)
3. MET: The best local mix fits: tier 1 at L0 with drones, tier 2 starved at L0 and fed at L1, tier 3 starved at L1 and fed at L2
   - shelf fed drones 9 vs L0-2 10 ok; shoal fed drones 8 vs L0-2 10 ok; veil starved mix 9 vs L0-2 10 ok; garden starved mix 9 vs L0-2 10 ok; veil fed mix 16 vs L1-2 16 ok; garden fed mix 16 vs L1-2 16 ok; deep/Glass Thicket starved mix 15 vs L1-2 16 ok; deep/Twin Seams starved mix 13 vs L1-2 16 ok; deep/Frost Gate starved mix 14 vs L1-2 16 ok; deep/Glass Thicket fed mix 22 vs L2-2 22 ok; deep/Twin Seams fed mix 20 vs L2-2 22 ok; deep/Frost Gate fed mix 22 vs L2-2 22 ok
4. MET: Both counters needed: no single type fits either medium's fed heart at L1, and the best mix does
   - veil fed d/l/f 34/37/26, mix 16, fit means <= 16 ok; garden fed d/l/f 37/24/47, mix 16, fit means <= 16 ok
5. MET: A raise opens an area: every medium's fed heart is closed at L0, every Deep layout's fed heart is closed at L1 and fits at L2, and no-command does not buy the core on any seed
   - veil fed mix 16 vs L0 12 ok; garden fed mix 16 vs L0 12 ok; deep/Glass Thicket fed mix 22 vs L1 18 / L2-2 22 ok; deep/Twin Seams fed mix 20 vs L1 18 / L2-2 22 ok; deep/Frost Gate fed mix 22 vs L1 18 / L2-2 22 ok; no-command: seed 1 softlock, reclaimed landfall>shoal>shelf>garden, seed 2 softlock, reclaimed landfall>shoal>shelf>garden, seed 3 softlock, reclaimed landfall>shoal>shelf>garden
6. MET: Composition varies: on every seed, the lancer share of the best mix differs by at least 30 percentage points between at least two tier 2 or 3 hearts (fed or starved)
   - seed 1: 50% veil fed to 93% deep/Glass Thicket starved, gap 43 pp; seed 2: 50% veil fed to 88% garden starved, gap 38 pp; seed 3: 50% veil fed to 88% garden starved, gap 38 pp
7. MET: Determinism and the reference replay pass
   - reference replay matches over 9000 ticks; composer seed 1 replayed to the same hash

