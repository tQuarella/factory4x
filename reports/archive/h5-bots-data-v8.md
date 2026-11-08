# Bot suite: FAIL

Data version 8, 3 seeds, 6 strategies (composer, ice-first, crystal-first, no-command, drones-only, greedy). Visit cap 30.0 min (a second timeout in one area is a softlock), campaign cap 120 game minutes of play, tick budget p95 ≤ 2 ms. Campaigns 36.5 s, probe 2.7 s.
Times are game minutes of play (m:ss); the overworld is paused and costs none. A seed picks The Deep's layout (1 Glass Thicket, 2 Twin Seams, 3 Frost Gate). `greedy` is the cap-off reference (fleet.cap 0, the H3 engine). Gated for softlock: composer, ice-first, crystal-first; `drones-only` and `no-command` are expected to stall and are reported only.

## Per run

| Strategy | Seed | Outcome | Play time | Area order | Visits (closed = withdrawn at once, timeout = visit cap) | Command limit bought | Root cut before heart | Capturing wave per heart (d/l/f) | Built / lost / recycled | Research (play time) | Hauled vs shipped (o/i/c) | Skipped | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| composer | 1 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shelf 5:04 (closed) > shoal 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0011 / 0.0021 |
| composer | 2 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shelf 5:04 (closed) > shoal 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0012 / 0.0026 |
| composer | 3 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shelf 5:04 (closed) > shoal 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0011 / 0.0018 |
| ice-first | 1 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shelf 5:04 (closed) > shoal 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0011 / 0.0018 |
| ice-first | 2 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shelf 5:04 (closed) > shoal 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0011 / 0.0019 |
| ice-first | 3 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shelf 5:04 (closed) > shoal 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0011 / 0.0019 |
| crystal-first | 1 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shoal 5:04 (closed) > shelf 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0011 / 0.0018 |
| crystal-first | 2 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shoal 5:04 (closed) > shelf 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0011 / 0.0023 |
| crystal-first | 3 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shoal 5:04 (closed) > shelf 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0011 / 0.0023 |
| no-command | 1 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shelf 5:04 (closed) > shoal 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0011 / 0.0019 |
| no-command | 2 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shelf 5:04 (closed) > shoal 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0011 / 0.0021 |
| no-command | 3 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shelf 5:04 (closed) > shoal 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0011 / 0.0018 |
| drones-only | 1 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shelf 5:04 (closed) > shoal 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0011 / 0.0019 |
| drones-only | 2 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shelf 5:04 (closed) > shoal 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0011 / 0.0019 |
| drones-only | 3 | softlock | 70:30 (not won) | landfall | landfall 0:11 > shelf 5:04 (closed) > shoal 5:14 (closed) > shelf 30:00 (timeout) (forced) > shelf 30:00 (timeout) (forced) | none | - | - | 31 / 0 / 0 | opening1 0:11, extract1 5:15, rigs1 40:30 | 100/0/0 vs 281/0/0 | shelf, shoal, veil, garden, deep | 0.0011 / 0.0023 |
| greedy | 1 | won | 45:48 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 8:42 > veil 9:15 > shoal 5:31 > garden 8:25 > deep 13:40 | none | veil yes, garden yes, deep yes | shelf 22d/0l/0f, veil 8d/0l/6f, shoal 10d/6l/0f, garden 9d/9l/7f, deep 0d/15l/15f | 177 / 89 / 0 | opening1 0:11, flak1 8:53, extract1 8:53, lancer1 18:09, rigs1 18:09, yards1 18:09, extract2 18:09, opening2 18:09, rigs2 23:41, yards2 23:41, extract3 32:07, opening3 32:07, core1 45:48 | 2120/340/340 vs 566/156/85 | - | 0.0022 / 0.0050 |
| greedy | 2 | won | 44:01 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 8:42 > veil 9:15 > shoal 5:31 > garden 8:25 > deep 11:53 | none | veil yes, garden yes, deep yes | shelf 22d/0l/0f, veil 8d/0l/6f, shoal 10d/6l/0f, garden 9d/9l/7f, deep 0d/13l/14f | 170 / 82 / 0 | opening1 0:11, flak1 8:53, extract1 8:53, lancer1 18:09, rigs1 18:09, yards1 18:09, extract2 18:09, opening2 18:09, rigs2 23:41, yards2 23:41, extract3 32:07, opening3 32:07, core1 44:01 | 2120/340/340 vs 530/147/76 | - | 0.0021 / 0.0037 |
| greedy | 3 | won | 43:56 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 8:42 > veil 9:15 > shoal 5:31 > garden 8:25 > deep 11:48 | none | veil yes, garden yes, deep yes | shelf 22d/0l/0f, veil 8d/0l/6f, shoal 10d/6l/0f, garden 9d/9l/7f, deep 1d/15l/10f | 171 / 85 / 0 | opening1 0:11, flak1 8:53, extract1 8:53, lancer1 18:09, rigs1 18:09, yards1 18:09, extract2 18:09, opening2 18:09, rigs2 23:41, yards2 23:41, extract3 32:07, opening3 32:07, core1 43:56 | 2120/340/340 vs 528/147/75 | - | 0.0022 / 0.0038 |

## Per-seed comparison (time to the core)

| Seed | composer | ice-first | crystal-first | no-command | drones-only | greedy |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | softlock 70:30 (1 areas) | softlock 70:30 (1 areas) | softlock 70:30 (1 areas) | softlock 70:30 (1 areas) | softlock 70:30 (1 areas) | 45:48 |
| 2 | softlock 70:30 (1 areas) | softlock 70:30 (1 areas) | softlock 70:30 (1 areas) | softlock 70:30 (1 areas) | softlock 70:30 (1 areas) | 44:01 |
| 3 | softlock 70:30 (1 areas) | softlock 70:30 (1 areas) | softlock 70:30 (1 areas) | softlock 70:30 (1 areas) | softlock 70:30 (1 areas) | 43:56 |

## Visit times per run, by area (reclaiming visit)

| Strategy | Seed | landfall | shelf | shoal | veil | garden | deep |
| --- | --- | --- | --- | --- | --- | --- | --- |
| composer | 1 | 0:11 | - | - | - | - | - |
| composer | 2 | 0:11 | - | - | - | - | - |
| composer | 3 | 0:11 | - | - | - | - | - |
| ice-first | 1 | 0:11 | - | - | - | - | - |
| ice-first | 2 | 0:11 | - | - | - | - | - |
| ice-first | 3 | 0:11 | - | - | - | - | - |
| crystal-first | 1 | 0:11 | - | - | - | - | - |
| crystal-first | 2 | 0:11 | - | - | - | - | - |
| crystal-first | 3 | 0:11 | - | - | - | - | - |
| no-command | 1 | 0:11 | - | - | - | - | - |
| no-command | 2 | 0:11 | - | - | - | - | - |
| no-command | 3 | 0:11 | - | - | - | - | - |
| drones-only | 1 | 0:11 | - | - | - | - | - |
| drones-only | 2 | 0:11 | - | - | - | - | - |
| drones-only | 3 | 0:11 | - | - | - | - | - |
| greedy | 1 | 0:11 | 8:42 | 5:31 | 9:15 | 8:25 | 13:40 |
| greedy | 2 | 0:11 | 8:42 | 5:31 | 9:15 | 8:25 | 11:53 |
| greedy | 3 | 0:11 | 8:42 | 5:31 | 9:15 | 8:25 | 11:48 |

## Probe: minimum winning waves per heart

Limits at the shipped tunables: L0 12, L1 18, L2 24. d / l / f are the smallest single-type waves that capture the heart from full strength (">80" = none within 80 ships). Mix is the smallest winning total over the locally buildable types (search cap L2 + 6 = 30), with one such fleet (fewest drones, then fewest lancers). "Fits at L" means mix ≤ L − 2; "closed at L" means mix > L; "tight" is between (L − 2 < mix ≤ L). Starved = Root cut; areas without a Root have only a fed row. The Deep is probed per seed (its layout).

| Heart | State | Tier | Buildable | d | l | f | Mix | Mix fleet (d/l/f) | Lancer share | Best mix at L0 / L1 / L2 | Windows (met / missed) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shelf | fed | 1 | drone, flak | 19 | 20 | 16 | 13 | 8/0/5 | 0% | closed / fits / fits | MISSED: fits L0 (12) with drones |
| shoal | fed | 1 | drone, lancer | 20 | 15 | 28 | 14 | 7/7/0 | 50% | closed / fits / fits | MISSED: fits L0 (12) with drones |
| veil | fed | 2 | drone, lancer, flak | 36 | 47 | 16 | 16 | 0/0/16 | 0% | closed / fits / fits | MET: closed at L0 (12); MET: fits L1 (18); MISSED: no single type fits L1 |
| veil | starved | 2 | drone, lancer, flak | 15 | 19 | 7 | 7 | 0/0/7 | 0% | fits / fits / fits | MET: fits L0 (12); MISSED: drones closed at L1 (18) |
| garden | fed | 2 | drone, lancer, flak | 56 | 33 | 70 | 25 | 0/22/3 | 88% | closed / closed / closed | MET: closed at L0 (12); MISSED: fits L1 (18); MET: no single type fits L1 |
| garden | starved | 2 | drone, lancer, flak | 23 | 12 | 28 | 11 | 0/9/2 | 81% | tight / fits / fits | MISSED: fits L0 (12); MET: drones closed at L1 (18) |
| deep (Glass Thicket) | fed | 3 | drone, lancer, flak | 67 | 38 | >80 | 30 | 0/27/3 | 90% | closed / closed / closed | MET: closed at L1 (18); MISSED: fits L2 (24) |
| deep (Glass Thicket) | starved | 3 | drone, lancer, flak | 33 | 17 | 40 | 15 | 0/14/1 | 93% | closed / fits / fits | MET: fits L1 (18); MET: closed at L0 (12); MET: drones closed at L2 (24) |
| deep (Twin Seams) | fed | 3 | drone, lancer, flak | 52 | 47 | 47 | 24 | 0/16/8 | 66% | closed / closed / tight | MET: closed at L1 (18); MISSED: fits L2 (24) |
| deep (Twin Seams) | starved | 3 | drone, lancer, flak | 27 | 21 | 23 | 13 | 0/9/4 | 69% | closed / fits / fits | MET: fits L1 (18); MET: closed at L0 (12); MET: drones closed at L2 (24) |
| deep (Frost Gate) | fed | 3 | drone, lancer, flak | 63 | 42 | 70 | 28 | 0/24/4 | 85% | closed / closed / closed | MET: closed at L1 (18); MISSED: fits L2 (24) |
| deep (Frost Gate) | starved | 3 | drone, lancer, flak | 30 | 18 | 31 | 14 | 0/11/3 | 78% | closed / fits / fits | MET: fits L1 (18); MET: closed at L0 (12); MET: drones closed at L2 (24) |

## H5 flags (report lines, not gates)

Flags 2 and 5 include strategy halves (drones-only, no-command) that pass vacuously when a strategy never leaves tier 1; the details print the area orders.

1. MISSED: No softlock: composer, ice-first, crystal-first buy the probe core on every seed within 120 game minutes of play
   - not won: composer/1 softlock at 70.5 min, composer/2 softlock at 70.5 min, composer/3 softlock at 70.5 min, ice-first/1 softlock at 70.5 min, ice-first/2 softlock at 70.5 min, ice-first/3 softlock at 70.5 min, crystal-first/1 softlock at 70.5 min, crystal-first/2 softlock at 70.5 min, crystal-first/3 softlock at 70.5 min
2. MISSED: Drones don't fit: every tier 2 and tier 3 heart is closed to drones alone at the tier's limit (starved: tier 2 at L1, tier 3 at L2), and drones-only reclaims no tier 2 or tier 3 area on any seed
   - veil starved drones 15 vs L1 18 MISS; garden starved drones 23 vs L1 18 ok; deep/Glass Thicket starved drones 33 vs L2 24 ok; deep/Twin Seams starved drones 27 vs L2 24 ok; deep/Frost Gate starved drones 30 vs L2 24 ok; drones-only: no tier 2/3 area reclaimed (reclaimed: seed 1 landfall, seed 2 landfall, seed 3 landfall)
3. MISSED: The best local mix fits: tier 1 at L0 with drones, tier 2 starved at L0 and fed at L1, tier 3 starved at L1 and fed at L2
   - shelf fed drones 19 vs L0-2 10 MISS; shoal fed drones 20 vs L0-2 10 MISS; veil starved mix 7 vs L0-2 10 ok; garden starved mix 11 vs L0-2 10 MISS; veil fed mix 16 vs L1-2 16 ok; garden fed mix 25 vs L1-2 16 MISS; deep/Glass Thicket starved mix 15 vs L1-2 16 ok; deep/Twin Seams starved mix 13 vs L1-2 16 ok; deep/Frost Gate starved mix 14 vs L1-2 16 ok; deep/Glass Thicket fed mix 30 vs L2-2 22 MISS; deep/Twin Seams fed mix 24 vs L2-2 22 MISS; deep/Frost Gate fed mix 28 vs L2-2 22 MISS
4. MISSED: Both counters needed: no single type fits either medium's fed heart at L1, and the best mix does
   - veil fed d/l/f 36/47/16, mix 16, fit means <= 16 MISS; garden fed d/l/f 56/33/70, mix 25, fit means <= 16 MISS
5. MISSED: A raise opens an area: every medium's fed heart is closed at L0, every Deep layout's fed heart is closed at L1 and fits at L2, and no-command does not buy the core on any seed
   - veil fed mix 16 vs L0 12 ok; garden fed mix 25 vs L0 12 ok; deep/Glass Thicket fed mix 30 vs L1 18 / L2-2 22 MISS; deep/Twin Seams fed mix 24 vs L1 18 / L2-2 22 MISS; deep/Frost Gate fed mix 28 vs L1 18 / L2-2 22 MISS; no-command: seed 1 softlock, reclaimed landfall, seed 2 softlock, reclaimed landfall, seed 3 softlock, reclaimed landfall
6. MET: Composition varies: on every seed, the lancer share of the best mix differs by at least 30 percentage points between at least two tier 2 or 3 hearts (fed or starved)
   - seed 1: 0% veil fed to 93% deep/Glass Thicket starved, gap 93 pp; seed 2: 0% veil fed to 88% garden fed, gap 88 pp; seed 3: 0% veil fed to 88% garden fed, gap 88 pp
7. MET: Determinism and the reference replay pass
   - reference replay matches over 9000 ticks; composer seed 1 replayed to the same hash

## Failures

- composer seed 1: softlock (a second visit timeout or nothing to do, at 70.5 min of play)
- composer seed 2: softlock (a second visit timeout or nothing to do, at 70.5 min of play)
- composer seed 3: softlock (a second visit timeout or nothing to do, at 70.5 min of play)
- ice-first seed 1: softlock (a second visit timeout or nothing to do, at 70.5 min of play)
- ice-first seed 2: softlock (a second visit timeout or nothing to do, at 70.5 min of play)
- ice-first seed 3: softlock (a second visit timeout or nothing to do, at 70.5 min of play)
- crystal-first seed 1: softlock (a second visit timeout or nothing to do, at 70.5 min of play)
- crystal-first seed 2: softlock (a second visit timeout or nothing to do, at 70.5 min of play)
- crystal-first seed 3: softlock (a second visit timeout or nothing to do, at 70.5 min of play)