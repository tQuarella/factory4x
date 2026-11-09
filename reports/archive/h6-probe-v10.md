# Bot suite: PASS

Data version 10, 3 seeds, 5 strategies (composer, ice-first, crystal-first, drones-only, cap-off). Visit cap 30.0 min (a second timeout in one area is a softlock), campaign cap 120 game minutes of play, tick budget p95 ≤ 2 ms. Campaigns 42.2 s, probe 3.5 s, trials 17.7 s.
Times are game minutes of play (m:ss); the overworld is paused and costs none. A seed picks The Deep's layout (1 Glass Thicket, 2 Twin Seams, 3 Frost Gate). `cap-off` is the reference (fleet.cap 0, the H3 engine). Gated for softlock and campaign timeout: composer, ice-first, crystal-first; `drones-only` is expected to stall and is reported only.

## Failures

None.

## Per run

| Strategy | Seed | Outcome | Play time | Area order | Untaken | Visits (closed = withdrawn when nothing passes the attack test, timeout = visit cap) | Capturing wave per heart (d/l/f at limit) | Haul paid of nominal (o/i/c) | Built / lost / recycled | Repelled waves (per visit) | Research (play time) | Hauled vs shipped (o/i/c) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| composer | 1 | won | 54:12 | landfall > shoal > glint > shelf > rime > mire > deep | 3: veil, garden, spire | landfall 0:11 > shoal 5:56 > glint 7:20 > shelf 4:55 > spire 5:50 (closed) > rime 5:54 > mire 8:28 > deep 15:32 | shoal 8d/0l/0f at L12, glint 0d/10l/0f at L12, shelf 9d/0l/0f at L20, rime 8d/0l/10f at L20, mire 0d/8l/10f at L20, deep 0d/14l/14f at L28 | 1780/280/260 of 1980/320/300 (decayed: glint, rime) | 190 / 101 / 21 | 1 (deep 1) | opening1 0:11, lancer1 6:07, extract1 6:07, rigs1 13:28, extract2 13:28, flak1 18:24, yards1 18:24, opening2 24:15, rigs2 30:10, yards2 38:39, extract3 38:39, opening3 38:39, core1 54:12 | 1780/280/260 vs 724/150/193 | 0.0023 / 0.0052 |
| composer | 2 | won | 52:08 | landfall > shoal > glint > shelf > rime > mire > deep | 3: veil, garden, spire | landfall 0:11 > shoal 5:56 > glint 7:20 > shelf 4:55 > spire 5:50 (closed) > rime 5:54 > mire 8:28 > deep 13:28 | shoal 8d/0l/0f at L12, glint 0d/10l/0f at L12, shelf 9d/0l/0f at L20, rime 8d/0l/10f at L20, mire 0d/8l/10f at L20, deep 0d/12l/11f at L28 | 1780/280/260 of 1980/320/300 (decayed: glint, rime) | 179 / 84 / 28 | 1 (deep 1) | opening1 0:11, lancer1 6:07, extract1 6:07, rigs1 13:28, extract2 13:28, flak1 18:24, yards1 18:24, opening2 24:15, rigs2 30:10, yards2 38:39, extract3 38:39, opening3 38:39, core1 52:08 | 1780/280/260 vs 682/138/182 | 0.0023 / 0.0050 |
| composer | 3 | won | 52:59 | landfall > shoal > glint > shelf > rime > mire > deep | 3: veil, garden, spire | landfall 0:11 > shoal 5:56 > glint 7:20 > shelf 4:55 > spire 5:50 (closed) > rime 5:54 > mire 8:28 > deep 14:19 | shoal 8d/0l/0f at L12, glint 0d/10l/0f at L12, shelf 9d/0l/0f at L20, rime 8d/0l/10f at L20, mire 0d/8l/10f at L20, deep 0d/12l/15f at L28 | 1780/280/260 of 1980/320/300 (decayed: glint, rime) | 184 / 92 / 26 | 1 (deep 1) | opening1 0:11, lancer1 6:07, extract1 6:07, rigs1 13:28, extract2 13:28, flak1 18:24, yards1 18:24, opening2 24:15, rigs2 30:10, yards2 38:39, extract3 38:39, opening3 38:39, core1 52:59 | 1780/280/260 vs 699/143/187 | 0.0022 / 0.0050 |
| ice-first | 1 | won | 54:32 | landfall > shelf > rime > shoal > mire > deep | 4: glint, veil, garden, spire | landfall 0:11 > shelf 6:13 > rime 7:20 > veil 5:36 (closed) > mire 6:17 (closed) > shoal 4:06 > mire 8:57 > deep 15:46 | shelf 9d/0l/0f at L12, rime 0d/0l/10f at L12, shoal 8d/0l/0f at L20, mire 0d/8l/10f at L20, deep 0d/14l/14f at L28 | 1680/270/230 of 1780/300/240 (decayed: rime) | 189 / 104 / 21 | 1 (deep 1) | opening1 0:11, flak1 6:24, extract1 6:24, rigs1 13:45, extract2 13:45, opening2 25:40, lancer1 29:47, yards1 29:47, rigs2 38:45, yards2 38:45, extract3 38:45, core1 54:32 | 1680/270/230 vs 621/209/65 | 0.0023 / 0.0056 |
| ice-first | 2 | won | 52:28 | landfall > shelf > rime > shoal > mire > deep | 4: glint, veil, garden, spire | landfall 0:11 > shelf 6:13 > rime 7:20 > veil 5:36 (closed) > mire 6:17 (closed) > shoal 4:06 > mire 8:57 > deep 13:42 | shelf 9d/0l/0f at L12, rime 0d/0l/10f at L12, shoal 8d/0l/0f at L20, mire 0d/8l/10f at L20, deep 0d/12l/11f at L28 | 1680/270/230 of 1780/300/240 (decayed: rime) | 178 / 87 / 28 | 1 (deep 1) | opening1 0:11, flak1 6:24, extract1 6:24, rigs1 13:45, extract2 13:45, opening2 25:40, lancer1 29:47, yards1 29:47, rigs2 38:45, yards2 38:45, extract3 38:45, core1 52:28 | 1680/270/230 vs 586/196/59 | 0.0024 / 0.0067 |
| ice-first | 3 | won | 53:20 | landfall > shelf > rime > shoal > mire > deep | 4: glint, veil, garden, spire | landfall 0:11 > shelf 6:13 > rime 7:20 > veil 5:36 (closed) > mire 6:17 (closed) > shoal 4:06 > mire 8:57 > deep 14:34 | shelf 9d/0l/0f at L12, rime 0d/0l/10f at L12, shoal 8d/0l/0f at L20, mire 0d/8l/10f at L20, deep 0d/12l/15f at L28 | 1680/270/230 of 1780/300/240 (decayed: rime) | 183 / 95 / 26 | 1 (deep 1) | opening1 0:11, flak1 6:24, extract1 6:24, rigs1 13:45, extract2 13:45, opening2 25:40, lancer1 29:47, yards1 29:47, rigs2 38:45, yards2 38:45, extract3 38:45, core1 53:20 | 1680/270/230 vs 601/202/61 | 0.0026 / 0.0067 |
| crystal-first | 1 | won | 73:15 | landfall > shoal > glint > shelf > garden > rime > mire > deep | 2: veil, spire | landfall 0:11 > shoal 5:56 > glint 7:20 > garden 5:30 (closed) > spire 5:51 (closed) > shelf 4:23 > spire 5:18 (closed) > garden 10:22 > rime 4:50 > mire 7:53 > deep 15:32 | shoal 8d/0l/0f at L12, glint 0d/10l/0f at L12, shelf 9d/0l/0f at L20, garden 0d/10l/10f at L20, rime 8d/0l/10f at L20, mire 0d/8l/10f at L20, deep 0d/14l/14f at L28 | 2200/350/350 of 2400/390/390 (decayed: glint, rime) | 268 / 139 / 27 | 2 (garden 1, deep 1) | opening1 0:11, lancer1 6:07, extract1 6:07, rigs1 13:28, extract2 13:28, opening2 24:51, flak1 29:15, yards1 29:15, yards2 34:34, rigs2 44:57, extract3 44:57, opening3 44:57, core1 73:15 | 2200/350/350 vs 1078/165/354 | 0.0024 / 0.0065 |
| crystal-first | 2 | won | 71:11 | landfall > shoal > glint > shelf > garden > rime > mire > deep | 2: veil, spire | landfall 0:11 > shoal 5:56 > glint 7:20 > garden 5:30 (closed) > spire 5:51 (closed) > shelf 4:23 > spire 5:18 (closed) > garden 10:22 > rime 4:50 > mire 7:53 > deep 13:28 | shoal 8d/0l/0f at L12, glint 0d/10l/0f at L12, shelf 9d/0l/0f at L20, garden 0d/10l/10f at L20, rime 8d/0l/10f at L20, mire 0d/8l/10f at L20, deep 0d/12l/11f at L28 | 2200/350/350 of 2400/390/390 (decayed: glint, rime) | 257 / 122 / 34 | 2 (garden 1, deep 1) | opening1 0:11, lancer1 6:07, extract1 6:07, rigs1 13:28, extract2 13:28, opening2 24:51, flak1 29:15, yards1 29:15, yards2 34:34, rigs2 44:57, extract3 44:57, opening3 44:57, core1 71:11 | 2200/350/350 vs 1027/153/337 | 0.0024 / 0.0068 |
| crystal-first | 3 | won | 72:02 | landfall > shoal > glint > shelf > garden > rime > mire > deep | 2: veil, spire | landfall 0:11 > shoal 5:56 > glint 7:20 > garden 5:30 (closed) > spire 5:51 (closed) > shelf 4:23 > spire 5:18 (closed) > garden 10:22 > rime 4:50 > mire 7:53 > deep 14:19 | shoal 8d/0l/0f at L12, glint 0d/10l/0f at L12, shelf 9d/0l/0f at L20, garden 0d/10l/10f at L20, rime 8d/0l/10f at L20, mire 0d/8l/10f at L20, deep 0d/12l/15f at L28 | 2200/350/350 of 2400/390/390 (decayed: glint, rime) | 262 / 130 / 32 | 2 (garden 1, deep 1) | opening1 0:11, lancer1 6:07, extract1 6:07, rigs1 13:28, extract2 13:28, opening2 24:51, flak1 29:15, yards1 29:15, yards2 34:34, rigs2 44:57, extract3 44:57, opening3 44:57, core1 72:02 | 2200/350/350 vs 1048/158/344 | 0.0023 / 0.0052 |
| drones-only | 1 | softlock | 79:10 (not won) | landfall > shoal > shelf | 7: rime, glint, veil, garden, mire, spire, deep | landfall 0:11 > shoal 5:56 > shelf 5:18 > rime 3:51 (closed) > glint 3:51 (closed) > rime 30:00 (timeout) (forced) > rime 30:00 (timeout) (forced) | shoal 8d/0l/0f at L12, shelf 9d/0l/0f at L12 | 360/80/80 of 360/80/80 | 236 / 203 / 0 | 32 (rime 16, rime 16) | opening1 0:11, extract1 6:07, rigs1 6:07, yards1 11:26, extract2 11:26, opening2 19:10, rigs2 49:10 | 360/80/80 vs 738/135/146 | 0.0016 / 0.0033 |
| drones-only | 2 | softlock | 79:10 (not won) | landfall > shoal > shelf | 7: rime, glint, veil, garden, mire, spire, deep | landfall 0:11 > shoal 5:56 > shelf 5:18 > rime 3:51 (closed) > glint 3:51 (closed) > rime 30:00 (timeout) (forced) > rime 30:00 (timeout) (forced) | shoal 8d/0l/0f at L12, shelf 9d/0l/0f at L12 | 360/80/80 of 360/80/80 | 236 / 203 / 0 | 32 (rime 16, rime 16) | opening1 0:11, extract1 6:07, rigs1 6:07, yards1 11:26, extract2 11:26, opening2 19:10, rigs2 49:10 | 360/80/80 vs 738/135/146 | 0.0016 / 0.0032 |
| drones-only | 3 | softlock | 79:10 (not won) | landfall > shoal > shelf | 7: rime, glint, veil, garden, mire, spire, deep | landfall 0:11 > shoal 5:56 > shelf 5:18 > rime 3:51 (closed) > glint 3:51 (closed) > rime 30:00 (timeout) (forced) > rime 30:00 (timeout) (forced) | shoal 8d/0l/0f at L12, shelf 9d/0l/0f at L12 | 360/80/80 of 360/80/80 | 236 / 203 / 0 | 32 (rime 16, rime 16) | opening1 0:11, extract1 6:07, rigs1 6:07, yards1 11:26, extract2 11:26, opening2 19:10, rigs2 49:10 | 360/80/80 vs 738/135/146 | 0.0016 / 0.0035 |
| cap-off | 1 | won | 44:04 | landfall > shoal > glint > shelf > spire > deep | 4: rime, veil, garden, mire | landfall 0:11 > shoal 6:15 > glint 7:27 > shelf 5:15 > spire 10:48 > deep 14:04 | shoal 10d/0l/0f at Loff, glint 11d/5l/0f at Loff, shelf 12d/0l/0f at Loff, spire 10d/14l/10f at Loff, deep 12d/17l/15f at Loff | 1680/230/270 of 1780/240/300 (decayed: glint) | 148 / 51 / 0 | 0 | opening1 0:11, lancer1 6:26, extract1 6:26, rigs1 13:54, extract2 13:54, flak1 19:10, yards1 19:10, opening2 29:59, rigs2 29:59, yards2 29:59, core1 44:04 | 1680/230/270 vs 509/63/163 | 0.0020 / 0.0046 |
| cap-off | 2 | won | 43:07 | landfall > shoal > glint > shelf > spire > deep | 4: rime, veil, garden, mire | landfall 0:11 > shoal 6:15 > glint 7:27 > shelf 5:15 > spire 10:48 > deep 13:07 | shoal 10d/0l/0f at Loff, glint 11d/5l/0f at Loff, shelf 12d/0l/0f at Loff, spire 10d/14l/10f at Loff, deep 14d/14l/12f at Loff | 1680/230/270 of 1780/240/300 (decayed: glint) | 142 / 46 / 0 | 0 | opening1 0:11, lancer1 6:26, extract1 6:26, rigs1 13:54, extract2 13:54, flak1 19:10, yards1 19:10, opening2 29:59, rigs2 29:59, yards2 29:59, core1 43:07 | 1680/230/270 vs 493/61/158 | 0.0019 / 0.0039 |
| cap-off | 3 | won | 43:54 | landfall > shoal > glint > shelf > spire > deep | 4: rime, veil, garden, mire | landfall 0:11 > shoal 6:15 > glint 7:27 > shelf 5:15 > spire 10:48 > deep 13:54 | shoal 10d/0l/0f at Loff, glint 11d/5l/0f at Loff, shelf 12d/0l/0f at Loff, spire 10d/14l/10f at Loff, deep 15d/18l/11f at Loff | 1680/230/270 of 1780/240/300 (decayed: glint) | 147 / 49 / 0 | 0 | opening1 0:11, lancer1 6:26, extract1 6:26, rigs1 13:54, extract2 13:54, flak1 19:10, yards1 19:10, opening2 29:59, rigs2 29:59, yards2 29:59, core1 43:54 | 1680/230/270 vs 507/63/162 | 0.0019 / 0.0040 |

## Per-seed comparison (time to the core)

| Seed | composer | ice-first | crystal-first | drones-only | cap-off |
| --- | --- | --- | --- | --- | --- |
| 1 | 54:12 | 54:32 | 73:15 | softlock 79:10 (3 areas) | 44:04 |
| 2 | 52:08 | 52:28 | 71:11 | softlock 79:10 (3 areas) | 43:07 |
| 3 | 52:59 | 53:20 | 72:02 | softlock 79:10 (3 areas) | 43:54 |

## Visit times per run, by area (reclaiming visit)

| Strategy | Seed | landfall | shelf | shoal | rime | glint | veil | garden | mire | spire | deep |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| composer | 1 | 0:11 | 4:55 | 5:56 | 5:54 | 7:20 | - | - | 8:28 | - | 15:32 |
| composer | 2 | 0:11 | 4:55 | 5:56 | 5:54 | 7:20 | - | - | 8:28 | - | 13:28 |
| composer | 3 | 0:11 | 4:55 | 5:56 | 5:54 | 7:20 | - | - | 8:28 | - | 14:19 |
| ice-first | 1 | 0:11 | 6:13 | 4:06 | 7:20 | - | - | - | 8:57 | - | 15:46 |
| ice-first | 2 | 0:11 | 6:13 | 4:06 | 7:20 | - | - | - | 8:57 | - | 13:42 |
| ice-first | 3 | 0:11 | 6:13 | 4:06 | 7:20 | - | - | - | 8:57 | - | 14:34 |
| crystal-first | 1 | 0:11 | 4:23 | 5:56 | 4:50 | 7:20 | - | 10:22 | 7:53 | - | 15:32 |
| crystal-first | 2 | 0:11 | 4:23 | 5:56 | 4:50 | 7:20 | - | 10:22 | 7:53 | - | 13:28 |
| crystal-first | 3 | 0:11 | 4:23 | 5:56 | 4:50 | 7:20 | - | 10:22 | 7:53 | - | 14:19 |
| drones-only | 1 | 0:11 | 5:18 | 5:56 | - | - | - | - | - | - | - |
| drones-only | 2 | 0:11 | 5:18 | 5:56 | - | - | - | - | - | - | - |
| drones-only | 3 | 0:11 | 5:18 | 5:56 | - | - | - | - | - | - | - |
| cap-off | 1 | 0:11 | 5:15 | 6:15 | - | 7:27 | - | - | - | 10:48 | 14:04 |
| cap-off | 2 | 0:11 | 5:15 | 6:15 | - | 7:27 | - | - | - | 10:48 | 13:07 |
| cap-off | 3 | 0:11 | 5:15 | 6:15 | - | 7:27 | - | - | - | 10:48 | 13:54 |

## Probe: minimum winning waves per heart

Limits at the shipped tunables: L0 12, L1 20, L2 28. d / l / f are the smallest single-type waves that capture the heart from full strength (">80" = none within 80 ships). Mix is the smallest winning total over the locally buildable types (search cap L2 + 6 = 34), with one such fleet (fewest drones, then fewest lancers). "Fits at L" means mix ≤ L − 2; "closed at L" means mix > L; "tight" is between (L − 2 < mix ≤ L). Every heart is fed (no area has a Root). Pocket d is the smallest drones-alone wave at a tier 2 area's first pocket. The Deep is probed per seed (its layout).

| Heart | Tier | Relay | Buildable | d | l | f | Mix | Mix fleet (d/l/f) | Lancer share | Pocket d | Best mix at L0 / L1 / L2 | Windows (met / missed) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shelf | 1 | no | drone, flak | 9 | 15 | 3 | 3 | 0/0/3 | 0% | - | fits / fits / fits | MET: fits L0 (12) with drones |
| shoal | 1 | no | drone, lancer | 8 | 3 | 15 | 3 | 0/3/0 | 100% | - | fits / fits / fits | MET: fits L0 (12) with drones |
| rime | 1 | yes | drone, flak | 19 | 24 | 10 | 10 | 0/0/10 | 0% | - | fits / fits / fits | MET: drones closed at L0 (12); MET: fits L0 (12) with its counter |
| glint | 1 | yes | drone, lancer | 20 | 10 | 30 | 10 | 0/10/0 | 100% | - | fits / fits / fits | MET: drones closed at L0 (12); MET: fits L0 (12) with its counter |
| veil | 2 | no | drone, lancer, flak | 34 | 37 | 26 | 15 | 0/7/8 | 46% | 8 | closed / fits / fits | MET: closed at L0 (12); MET: fits L1 (20); MET: no single type fits L1; MET: first pocket falls to drones within L1 (20) |
| garden | 2 | no | drone, lancer, flak | 37 | 24 | 47 | 18 | 0/10/8 | 55% | 7 | closed / fits / fits | MET: closed at L0 (12); MET: fits L1 (20); MET: no single type fits L1; MET: first pocket falls to drones within L1 (20) |
| mire | 2 | yes | drone, lancer, flak | 40 | 41 | 32 | 18 | 0/8/10 | 44% | 9 | closed / fits / fits | MET: closed at L0 (12); MET: fits L1 (20); MET: no single type fits L1; MET: binds at L1 (mix >= 14); MET: first pocket falls to drones within L1 (20) |
| spire | 2 | yes | drone, lancer, flak | 41 | 26 | 51 | 21 | 0/10/11 | 47% | 9 | closed / closed / fits | MET: closed at L0 (12); MISSED: fits L1 (20); MET: no single type fits L1; MET: binds at L1 (mix >= 14); MET: first pocket falls to drones within L1 (20) |
| deep (Glass Thicket) | 3 | no | drone, lancer, flak | 50 | 29 | 63 | 26 | 0/15/11 | 57% | - | closed / closed / fits | MET: closed at L1 (20); MET: fits L2 (28); MET: no single type fits L2; MET: binds at L2 (mix >= 22) |
| deep (Twin Seams) | 3 | no | drone, lancer, flak | 45 | 40 | 41 | 19 | 0/8/11 | 42% | - | closed / tight / fits | MISSED: closed at L1 (20); MET: fits L2 (28); MET: no single type fits L2; MISSED: binds at L2 (mix >= 22) |
| deep (Frost Gate) | 3 | no | drone, lancer, flak | 50 | 35 | 58 | 25 | 0/10/15 | 40% | - | closed / closed / fits | MET: closed at L1 (20); MET: fits L2 (28); MET: no single type fits L2; MET: binds at L2 (mix >= 22) |

## Trial visits (a forced composer visit up to the visit cap, landed from campaignWorld behind the lock)

| Trial | Area | Seed | Limit (expected) | Result | Play time |
| --- | --- | --- | --- | --- | --- |
| band2-l0 | veil | 1 | 12 (12) | timeout | 30:00 |
| band2-l0 | garden | 1 | 12 (12) | timeout | 30:00 |
| band2-l0 | mire | 1 | 12 (12) | timeout | 30:00 |
| band2-l0 | spire | 1 | 12 (12) | timeout | 30:00 |
| deep-l1 | deep | 1 | 20 (20) | timeout | 30:00 |
| deep-l1 | deep | 2 | 20 (20) | RECLAIMED | 22:02 |
| deep-l1 | deep | 3 | 20 (20) | timeout | 30:00 |
| relay-drones | rime | 1 | 12 (12) | timeout | 30:00 |
| relay-drones | glint | 1 | 12 (12) | timeout | 30:00 |

## H6 flags (report lines, not gates)

1. MET: No softlock: composer, ice-first, crystal-first buy the probe core on every seed within 120 game minutes of play
   - all 9 runs bought the core
2. MISSED: A relay opens a band: every band 2 heart is closed at L0 and every Deep layout is closed at L1 with any local mix, and each fits at the next limit
   - veil mix 15 vs L0 12 / L1-2 18 ok; garden mix 18 vs L0 12 / L1-2 18 ok; mire mix 18 vs L0 12 / L1-2 18 ok; spire mix 21 vs L0 12 / L1-2 18 MISS; deep/Glass Thicket mix 26 vs L1 20 / L2-2 26 ok; deep/Twin Seams mix 19 vs L1 20 / L2-2 26 MISS; deep/Frost Gate mix 25 vs L1 20 / L2-2 26 ok
3. MISSED: The lock is real: no trial visit reclaims its area (band 2 at L0, The Deep at L1, band 1 relays with drones only, a full composer visit each)
   - band2-l0 veil timeout (limit 12); band2-l0 garden timeout (limit 12); band2-l0 mire timeout (limit 12); band2-l0 spire timeout (limit 12); deep-l1 deep/seed 1 timeout (limit 20); deep-l1 deep/seed 2 RECLAIMED at 22:02 (limit 20); deep-l1 deep/seed 3 timeout (limit 20); relay-drones rime timeout (limit 12); relay-drones glint timeout (limit 12)
4. MET: The mix is used: every winning run captures a band 2 or higher heart with a wave in which lancers and flak are each at least 30% of the ships
   - composer/1 band 2+ waves mire 0d/8l/10f, deep 0d/14l/14f ok; composer/2 band 2+ waves mire 0d/8l/10f, deep 0d/12l/11f ok; composer/3 band 2+ waves mire 0d/8l/10f, deep 0d/12l/15f ok; ice-first/1 band 2+ waves mire 0d/8l/10f, deep 0d/14l/14f ok; ice-first/2 band 2+ waves mire 0d/8l/10f, deep 0d/12l/11f ok; ice-first/3 band 2+ waves mire 0d/8l/10f, deep 0d/12l/15f ok; crystal-first/1 band 2+ waves garden 0d/10l/10f, mire 0d/8l/10f, deep 0d/14l/14f ok; crystal-first/2 band 2+ waves garden 0d/10l/10f, mire 0d/8l/10f, deep 0d/12l/11f ok; crystal-first/3 band 2+ waves garden 0d/10l/10f, mire 0d/8l/10f, deep 0d/12l/15f ok
5. MET: The new limit is used: in every winning run the capturing wave at the band 2 relay it took and at The Deep has at least L - 6 ships
   - composer/1 mire 18 ships vs limit 20, deep 28 ships vs limit 28 ok; composer/2 mire 18 ships vs limit 20, deep 23 ships vs limit 28 ok; composer/3 mire 18 ships vs limit 20, deep 27 ships vs limit 28 ok; ice-first/1 mire 18 ships vs limit 20, deep 28 ships vs limit 28 ok; ice-first/2 mire 18 ships vs limit 20, deep 23 ships vs limit 28 ok; ice-first/3 mire 18 ships vs limit 20, deep 27 ships vs limit 28 ok; crystal-first/1 mire 18 ships vs limit 20, deep 28 ships vs limit 28 ok; crystal-first/2 mire 18 ships vs limit 20, deep 23 ships vs limit 28 ok; crystal-first/3 mire 18 ships vs limit 20, deep 27 ships vs limit 28 ok
6. MET: The set is a choice: every winning run leaves at least one area untaken, and on each seed at least two winners end with different sets of reclaimed areas
   - composer/1 untaken 3: veil, garden, spire ok; composer/2 untaken 3: veil, garden, spire ok; composer/3 untaken 3: veil, garden, spire ok; ice-first/1 untaken 4: glint, veil, garden, spire ok; ice-first/2 untaken 4: glint, veil, garden, spire ok; ice-first/3 untaken 4: glint, veil, garden, spire ok; crystal-first/1 untaken 2: veil, spire ok; crystal-first/2 untaken 2: veil, spire ok; crystal-first/3 untaken 2: veil, spire ok; seed 1: 3 winners, 3 distinct sets; seed 2: 3 winners, 3 distinct sets; seed 3: 3 winners, 3 distinct sets
7. MET: Determinism and the reference replay pass
   - reference replay matches over 9000 ticks; composer seed 1 replayed to the same hash
