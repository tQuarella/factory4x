# Bot suite: PASS

Data version 11, 3 seeds, 5 strategies (composer, ice-first, crystal-first, drones-only, cap-off). Visit cap 30.0 min (a second timeout in one area is a softlock), campaign cap 120 game minutes of play, tick budget p95 ≤ 2 ms. Campaigns 36.6 s, probe 2.8 s, trials 15.6 s.
Times are game minutes of play (m:ss); the overworld is paused and costs none. A seed picks The Deep's layout (1 Glass Thicket, 2 Twin Seams, 3 Frost Gate). `cap-off` is the reference (fleet.cap 0, the H3 engine). Gated for softlock and campaign timeout: composer, ice-first, crystal-first; `drones-only` is expected to stall and is reported only.

## Failures

None.

## Per run

| Strategy | Seed | Outcome | Play time | Area order | Untaken | Visits (closed = withdrawn when nothing passes the attack test, timeout = visit cap) | Capturing wave per heart (d/l/f at limit) | Haul paid of nominal (o/i/c) | Built / lost / recycled | Repelled waves (per visit) | Research (play time) | Hauled vs shipped (o/i/c) | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| composer | 1 | won | 46:22 | landfall > shoal > glint > shelf > spire > deep | 4: rime, veil, garden, mire | landfall 0:11 > shoal 5:56 > glint 7:02 > shelf 4:55 > spire 11:55 > deep 16:19 | shoal 8d/0l/0f at L12, glint 0d/8l/0f at L12, shelf 9d/0l/0f at L20, spire 0d/11l/9f at L20, deep 0d/14l/14f at L28 | 1680/230/270 of 1780/240/300 (decayed: glint) | 164 / 99 / 18 | 2 (spire 1, deep 1) | opening1 0:11, lancer1 6:07, extract1 6:07, rigs1 13:10, extract2 13:10, flak1 18:06, yards1 18:06, opening2 30:02, rigs2 30:02, yards2 30:02, core1 46:22 | 1680/230/270 vs 555/72/179 | 0.0023 / 0.0053 |
| composer | 2 | won | 46:16 | landfall > shoal > glint > shelf > spire > deep | 4: rime, veil, garden, mire | landfall 0:11 > shoal 5:56 > glint 7:02 > shelf 4:55 > spire 11:55 > deep 16:13 | shoal 8d/0l/0f at L12, glint 0d/8l/0f at L12, shelf 9d/0l/0f at L20, spire 0d/11l/9f at L20, deep 0d/13l/15f at L28 | 1680/230/270 of 1780/240/300 (decayed: glint) | 164 / 95 / 22 | 2 (spire 1, deep 1) | opening1 0:11, lancer1 6:07, extract1 6:07, rigs1 13:10, extract2 13:10, flak1 18:06, yards1 18:06, opening2 30:02, rigs2 30:02, yards2 30:02, core1 46:16 | 1680/230/270 vs 553/72/178 | 0.0022 / 0.0049 |
| composer | 3 | won | 46:37 | landfall > shoal > glint > shelf > spire > deep | 4: rime, veil, garden, mire | landfall 0:11 > shoal 5:56 > glint 7:02 > shelf 4:55 > spire 11:55 > deep 16:34 | shoal 8d/0l/0f at L12, glint 0d/8l/0f at L12, shelf 9d/0l/0f at L20, spire 0d/11l/9f at L20, deep 0d/15l/13f at L28 | 1680/230/270 of 1780/240/300 (decayed: glint) | 168 / 96 / 24 | 2 (spire 1, deep 1) | opening1 0:11, lancer1 6:07, extract1 6:07, rigs1 13:10, extract2 13:10, flak1 18:06, yards1 18:06, opening2 30:02, rigs2 30:02, yards2 30:02, core1 46:37 | 1680/230/270 vs 559/73/181 | 0.0021 / 0.0045 |
| ice-first | 1 | won | 59:22 | landfall > shelf > rime > shoal > mire > deep | 4: glint, veil, garden, spire | landfall 0:11 > shelf 6:13 > rime 7:09 > veil 5:29 (closed) > mire 9:32 (closed) > shoal 4:06 > mire 11:07 > deep 15:29 | shelf 9d/0l/0f at L12, rime 0d/0l/9f at L12, shoal 8d/0l/0f at L20, mire 0d/7l/9f at L20, deep 0d/14l/14f at L28 | 1680/270/230 of 1780/300/240 (decayed: rime) | 223 / 129 / 24 | 3 (mire 1, mire 1, deep 1) | opening1 0:11, flak1 6:24, extract1 6:24, rigs1 13:34, extract2 13:34, opening2 28:37, lancer1 32:44, yards1 32:44, rigs2 43:52, yards2 43:52, extract3 43:52, core1 59:22 | 1680/270/230 vs 674/228/68 | 0.0022 / 0.0053 |
| ice-first | 2 | won | 55:44 | landfall > shelf > rime > shoal > mire > deep | 4: glint, veil, garden, spire | landfall 0:11 > shelf 6:13 > rime 7:09 > veil 5:29 (closed) > mire 9:32 (closed) > shoal 4:06 > mire 11:07 > deep 11:51 | shelf 9d/0l/0f at L12, rime 0d/0l/9f at L12, shoal 8d/0l/0f at L20, mire 0d/7l/9f at L20, deep 0d/10l/13f at L28 | 1680/270/230 of 1780/300/240 (decayed: rime) | 197 / 111 / 27 | 2 (mire 1, mire 1) | opening1 0:11, flak1 6:24, extract1 6:24, rigs1 13:34, extract2 13:34, opening2 28:37, lancer1 32:44, yards1 32:44, rigs2 43:52, yards2 43:52, extract3 43:52, core1 55:44 | 1680/270/230 vs 613/206/57 | 0.0022 / 0.0053 |
| ice-first | 3 | won | 61:41 | landfall > shelf > rime > shoal > mire > deep | 4: glint, veil, garden, spire | landfall 0:11 > shelf 6:13 > rime 7:09 > veil 5:29 (closed) > mire 9:32 (closed) > shoal 4:06 > mire 11:07 > deep 17:48 | shelf 9d/0l/0f at L12, rime 0d/0l/9f at L12, shoal 8d/0l/0f at L20, mire 0d/7l/9f at L20, deep 0d/15l/13f at L28 | 1680/270/230 of 1780/300/240 (decayed: rime) | 242 / 142 / 29 | 4 (mire 1, mire 1, deep 2) | opening1 0:11, flak1 6:24, extract1 6:24, rigs1 13:34, extract2 13:34, opening2 28:37, lancer1 32:44, yards1 32:44, rigs2 43:52, yards2 43:52, extract3 43:52, core1 61:41 | 1680/270/230 vs 714/242/75 | 0.0022 / 0.0049 |
| crystal-first | 1 | won | 55:51 | landfall > shoal > glint > shelf > spire > deep | 4: rime, veil, garden, mire | landfall 0:11 > shoal 5:56 > glint 7:02 > spire 5:51 (closed) > garden 5:29 (closed) > shelf 4:23 > spire 11:24 > deep 15:29 | shoal 8d/0l/0f at L12, glint 0d/8l/0f at L12, shelf 9d/0l/0f at L20, spire 0d/11l/9f at L20, deep 0d/14l/14f at L28 | 1680/230/270 of 1780/240/300 (decayed: glint) | 195 / 106 / 20 | 2 (spire 1, deep 1) | opening1 0:11, lancer1 6:07, extract1 6:07, rigs1 13:10, extract2 13:10, opening2 24:32, flak1 28:56, yards1 28:56, rigs2 40:21, yards2 40:21, extract3 40:21, core1 55:51 | 1680/230/270 vs 642/69/215 | 0.0020 / 0.0043 |
| crystal-first | 2 | won | 52:13 | landfall > shoal > glint > shelf > spire > deep | 4: rime, veil, garden, mire | landfall 0:11 > shoal 5:56 > glint 7:02 > spire 5:51 (closed) > garden 5:29 (closed) > shelf 4:23 > spire 11:24 > deep 11:51 | shoal 8d/0l/0f at L12, glint 0d/8l/0f at L12, shelf 9d/0l/0f at L20, spire 0d/11l/9f at L20, deep 0d/10l/13f at L28 | 1680/230/270 of 1780/240/300 (decayed: glint) | 169 / 88 / 23 | 1 (spire 1) | opening1 0:11, lancer1 6:07, extract1 6:07, rigs1 13:10, extract2 13:10, opening2 24:32, flak1 28:56, yards1 28:56, rigs2 40:21, yards2 40:21, extract3 40:21, core1 52:13 | 1680/230/270 vs 580/58/193 | 0.0020 / 0.0045 |
| crystal-first | 3 | won | 58:10 | landfall > shoal > glint > shelf > spire > deep | 4: rime, veil, garden, mire | landfall 0:11 > shoal 5:56 > glint 7:02 > spire 5:51 (closed) > garden 5:29 (closed) > shelf 4:23 > spire 11:24 > deep 17:48 | shoal 8d/0l/0f at L12, glint 0d/8l/0f at L12, shelf 9d/0l/0f at L20, spire 0d/11l/9f at L20, deep 0d/15l/13f at L28 | 1680/230/270 of 1780/240/300 (decayed: glint) | 214 / 119 / 25 | 3 (spire 1, deep 2) | opening1 0:11, lancer1 6:07, extract1 6:07, rigs1 13:10, extract2 13:10, opening2 24:32, flak1 28:56, yards1 28:56, rigs2 40:21, yards2 40:21, extract3 40:21, core1 58:10 | 1680/230/270 vs 681/76/229 | 0.0020 / 0.0046 |
| drones-only | 1 | softlock | 79:10 (not won) | landfall > shoal > shelf | 7: rime, glint, veil, garden, mire, spire, deep | landfall 0:11 > shoal 5:56 > shelf 5:18 > rime 3:51 (closed) > glint 3:51 (closed) > rime 30:00 (timeout) (forced) > rime 30:00 (timeout) (forced) | shoal 8d/0l/0f at L12, shelf 9d/0l/0f at L12 | 360/80/80 of 360/80/80 | 236 / 203 / 0 | 32 (rime 16, rime 16) | opening1 0:11, extract1 6:07, rigs1 6:07, yards1 11:26, extract2 11:26, opening2 19:10, rigs2 49:10 | 360/80/80 vs 738/135/146 | 0.0015 / 0.0033 |
| drones-only | 2 | softlock | 79:10 (not won) | landfall > shoal > shelf | 7: rime, glint, veil, garden, mire, spire, deep | landfall 0:11 > shoal 5:56 > shelf 5:18 > rime 3:51 (closed) > glint 3:51 (closed) > rime 30:00 (timeout) (forced) > rime 30:00 (timeout) (forced) | shoal 8d/0l/0f at L12, shelf 9d/0l/0f at L12 | 360/80/80 of 360/80/80 | 236 / 203 / 0 | 32 (rime 16, rime 16) | opening1 0:11, extract1 6:07, rigs1 6:07, yards1 11:26, extract2 11:26, opening2 19:10, rigs2 49:10 | 360/80/80 vs 738/135/146 | 0.0015 / 0.0032 |
| drones-only | 3 | softlock | 79:10 (not won) | landfall > shoal > shelf | 7: rime, glint, veil, garden, mire, spire, deep | landfall 0:11 > shoal 5:56 > shelf 5:18 > rime 3:51 (closed) > glint 3:51 (closed) > rime 30:00 (timeout) (forced) > rime 30:00 (timeout) (forced) | shoal 8d/0l/0f at L12, shelf 9d/0l/0f at L12 | 360/80/80 of 360/80/80 | 236 / 203 / 0 | 32 (rime 16, rime 16) | opening1 0:11, extract1 6:07, rigs1 6:07, yards1 11:26, extract2 11:26, opening2 19:10, rigs2 49:10 | 360/80/80 vs 738/135/146 | 0.0015 / 0.0031 |
| cap-off | 1 | won | 42:32 | landfall > shoal > glint > shelf > spire > deep | 4: rime, veil, garden, mire | landfall 0:11 > shoal 6:15 > glint 7:26 > shelf 5:15 > spire 9:45 > deep 13:36 | shoal 10d/0l/0f at Loff, glint 11d/5l/0f at Loff, shelf 12d/0l/0f at Loff, spire 10d/11l/7f at Loff, deep 12d/15l/14f at Loff | 1680/230/270 of 1780/240/300 (decayed: glint) | 139 / 48 / 0 | 0 | opening1 0:11, lancer1 6:26, extract1 6:26, rigs1 13:53, extract2 13:53, flak1 19:09, yards1 19:09, opening2 28:55, rigs2 28:55, yards2 28:55, core1 42:32 | 1680/230/270 vs 488/60/156 | 0.0020 / 0.0045 |
| cap-off | 2 | won | 42:57 | landfall > shoal > glint > shelf > spire > deep | 4: rime, veil, garden, mire | landfall 0:11 > shoal 6:15 > glint 7:26 > shelf 5:15 > spire 9:45 > deep 14:01 | shoal 10d/0l/0f at Loff, glint 11d/5l/0f at Loff, shelf 12d/0l/0f at Loff, spire 10d/11l/7f at Loff, deep 12d/18l/16f at Loff | 1680/230/270 of 1780/240/300 (decayed: glint) | 140 / 44 / 0 | 0 | opening1 0:11, lancer1 6:26, extract1 6:26, rigs1 13:53, extract2 13:53, flak1 19:09, yards1 19:09, opening2 28:55, rigs2 28:55, yards2 28:55, core1 42:57 | 1680/230/270 vs 495/61/159 | 0.0019 / 0.0040 |
| cap-off | 3 | won | 42:41 | landfall > shoal > glint > shelf > spire > deep | 4: rime, veil, garden, mire | landfall 0:11 > shoal 6:15 > glint 7:26 > shelf 5:15 > spire 9:45 > deep 13:45 | shoal 10d/0l/0f at Loff, glint 11d/5l/0f at Loff, shelf 12d/0l/0f at Loff, spire 10d/11l/7f at Loff, deep 15d/18l/10f at Loff | 1680/230/270 of 1780/240/300 (decayed: glint) | 140 / 46 / 0 | 0 | opening1 0:11, lancer1 6:26, extract1 6:26, rigs1 13:53, extract2 13:53, flak1 19:09, yards1 19:09, opening2 28:55, rigs2 28:55, yards2 28:55, core1 42:41 | 1680/230/270 vs 490/60/157 | 0.0019 / 0.0037 |

## Per-seed comparison (time to the core)

| Seed | composer | ice-first | crystal-first | drones-only | cap-off |
| --- | --- | --- | --- | --- | --- |
| 1 | 46:22 | 59:22 | 55:51 | softlock 79:10 (3 areas) | 42:32 |
| 2 | 46:16 | 55:44 | 52:13 | softlock 79:10 (3 areas) | 42:57 |
| 3 | 46:37 | 61:41 | 58:10 | softlock 79:10 (3 areas) | 42:41 |

## Visit times per run, by area (reclaiming visit)

| Strategy | Seed | landfall | shelf | shoal | rime | glint | veil | garden | mire | spire | deep |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| composer | 1 | 0:11 | 4:55 | 5:56 | - | 7:02 | - | - | - | 11:55 | 16:19 |
| composer | 2 | 0:11 | 4:55 | 5:56 | - | 7:02 | - | - | - | 11:55 | 16:13 |
| composer | 3 | 0:11 | 4:55 | 5:56 | - | 7:02 | - | - | - | 11:55 | 16:34 |
| ice-first | 1 | 0:11 | 6:13 | 4:06 | 7:09 | - | - | - | 11:07 | - | 15:29 |
| ice-first | 2 | 0:11 | 6:13 | 4:06 | 7:09 | - | - | - | 11:07 | - | 11:51 |
| ice-first | 3 | 0:11 | 6:13 | 4:06 | 7:09 | - | - | - | 11:07 | - | 17:48 |
| crystal-first | 1 | 0:11 | 4:23 | 5:56 | - | 7:02 | - | - | - | 11:24 | 15:29 |
| crystal-first | 2 | 0:11 | 4:23 | 5:56 | - | 7:02 | - | - | - | 11:24 | 11:51 |
| crystal-first | 3 | 0:11 | 4:23 | 5:56 | - | 7:02 | - | - | - | 11:24 | 17:48 |
| drones-only | 1 | 0:11 | 5:18 | 5:56 | - | - | - | - | - | - | - |
| drones-only | 2 | 0:11 | 5:18 | 5:56 | - | - | - | - | - | - | - |
| drones-only | 3 | 0:11 | 5:18 | 5:56 | - | - | - | - | - | - | - |
| cap-off | 1 | 0:11 | 5:15 | 6:15 | - | 7:26 | - | - | - | 9:45 | 13:36 |
| cap-off | 2 | 0:11 | 5:15 | 6:15 | - | 7:26 | - | - | - | 9:45 | 14:01 |
| cap-off | 3 | 0:11 | 5:15 | 6:15 | - | 7:26 | - | - | - | 9:45 | 13:45 |

## Probe: minimum winning waves per heart

Limits at the shipped tunables: L0 12, L1 20, L2 28. d / l / f are the smallest single-type waves that capture the heart from full strength (">80" = none within 80 ships). Mix is the smallest winning total over the locally buildable types (search cap L2 + 6 = 34), with one such fleet (fewest drones, then fewest lancers). "Fits at L" means mix ≤ L − 2; "closed at L" means mix > L; "tight" is between (L − 2 < mix ≤ L). Every heart is fed (no area has a Root). Pocket d is the smallest drones-alone wave at a tier 2 area's first pocket. The Deep is probed per seed (its layout).

| Heart | Tier | Relay | Buildable | d | l | f | Mix | Mix fleet (d/l/f) | Lancer share | Pocket d | Best mix at L0 / L1 / L2 | Windows (met / missed) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shelf | 1 | no | drone, flak | 9 | 15 | 3 | 3 | 0/0/3 | 0% | - | fits / fits / fits | MET: fits L0 (12) with drones |
| shoal | 1 | no | drone, lancer | 8 | 3 | 15 | 3 | 0/3/0 | 100% | - | fits / fits / fits | MET: fits L0 (12) with drones |
| rime | 1 | yes | drone, flak | 18 | 23 | 9 | 9 | 0/0/9 | 0% | - | fits / fits / fits | MET: drones closed at L0 (12); MET: fits L0 (12) with its counter |
| glint | 1 | yes | drone, lancer | 19 | 8 | 29 | 8 | 0/8/0 | 100% | - | fits / fits / fits | MET: drones closed at L0 (12); MET: fits L0 (12) with its counter |
| veil | 2 | no | drone, lancer, flak | 34 | 37 | 26 | 15 | 0/7/8 | 46% | 8 | closed / fits / fits | MET: closed at L0 (12); MET: fits L1 (20); MET: no single type fits L1; MET: first pocket falls to drones within L1 (20) |
| garden | 2 | no | drone, lancer, flak | 34 | 22 | 45 | 17 | 0/9/8 | 52% | 7 | closed / fits / fits | MET: closed at L0 (12); MET: fits L1 (20); MET: no single type fits L1; MET: first pocket falls to drones within L1 (20) |
| mire | 2 | yes | drone, lancer, flak | 35 | 39 | 27 | 16 | 0/7/9 | 43% | 9 | closed / fits / fits | MET: closed at L0 (12); MET: fits L1 (20); MET: no single type fits L1; MET: binds at L1 (mix >= 14); MET: first pocket falls to drones within L1 (20) |
| spire | 2 | yes | drone, lancer, flak | 34 | 23 | 42 | 16 | 0/9/7 | 56% | 9 | closed / fits / fits | MET: closed at L0 (12); MET: fits L1 (20); MET: no single type fits L1; MET: binds at L1 (mix >= 14); MET: first pocket falls to drones within L1 (20) |
| deep (Glass Thicket) | 3 | no | drone, lancer, flak | 47 | 28 | 59 | 24 | 0/13/11 | 54% | - | closed / closed / fits | MET: closed at L1 (20); MET: fits L2 (28); MET: no single type fits L2; MET: binds at L2 (mix >= 22) |
| deep (Twin Seams) | 3 | no | drone, lancer, flak | 52 | 47 | 47 | 23 | 0/10/13 | 43% | - | closed / closed / fits | MET: closed at L1 (20); MET: fits L2 (28); MET: no single type fits L2; MET: binds at L2 (mix >= 22) |
| deep (Frost Gate) | 3 | no | drone, lancer, flak | 49 | 34 | 55 | 23 | 0/13/10 | 56% | - | closed / closed / fits | MET: closed at L1 (20); MET: fits L2 (28); MET: no single type fits L2; MET: binds at L2 (mix >= 22) |

## Trial visits (a forced composer visit up to the visit cap, landed from campaignWorld behind the lock)

| Trial | Area | Seed | Limit (expected) | Result | Play time |
| --- | --- | --- | --- | --- | --- |
| band2-l0 | veil | 1 | 12 (12) | timeout | 30:00 |
| band2-l0 | garden | 1 | 12 (12) | timeout | 30:00 |
| band2-l0 | mire | 1 | 12 (12) | timeout | 30:00 |
| band2-l0 | spire | 1 | 12 (12) | timeout | 30:00 |
| deep-l1 | deep | 1 | 20 (20) | timeout | 30:00 |
| deep-l1 | deep | 2 | 20 (20) | timeout | 30:00 |
| deep-l1 | deep | 3 | 20 (20) | timeout | 30:00 |
| relay-drones | rime | 1 | 12 (12) | timeout | 30:00 |
| relay-drones | glint | 1 | 12 (12) | timeout | 30:00 |

## H6 flags (report lines, not gates)

1. MET: No softlock: composer, ice-first, crystal-first buy the probe core on every seed within 120 game minutes of play
   - all 9 runs bought the core
2. MET: A relay opens a band: every band 2 heart is closed at L0 and every Deep layout is closed at L1 with any local mix, and each fits at the next limit
   - veil mix 15 vs L0 12 / L1-2 18 ok; garden mix 17 vs L0 12 / L1-2 18 ok; mire mix 16 vs L0 12 / L1-2 18 ok; spire mix 16 vs L0 12 / L1-2 18 ok; deep/Glass Thicket mix 24 vs L1 20 / L2-2 26 ok; deep/Twin Seams mix 23 vs L1 20 / L2-2 26 ok; deep/Frost Gate mix 23 vs L1 20 / L2-2 26 ok
3. MET: The lock is real: no trial visit reclaims its area (band 2 at L0, The Deep at L1, band 1 relays with drones only, a full composer visit each)
   - band2-l0 veil timeout (limit 12); band2-l0 garden timeout (limit 12); band2-l0 mire timeout (limit 12); band2-l0 spire timeout (limit 12); deep-l1 deep/seed 1 timeout (limit 20); deep-l1 deep/seed 2 timeout (limit 20); deep-l1 deep/seed 3 timeout (limit 20); relay-drones rime timeout (limit 12); relay-drones glint timeout (limit 12)
4. MET: The mix is used: every winning run captures a band 2 or higher heart with a wave in which lancers and flak are each at least 30% of the ships
   - composer/1 band 2+ waves spire 0d/11l/9f, deep 0d/14l/14f ok; composer/2 band 2+ waves spire 0d/11l/9f, deep 0d/13l/15f ok; composer/3 band 2+ waves spire 0d/11l/9f, deep 0d/15l/13f ok; ice-first/1 band 2+ waves mire 0d/7l/9f, deep 0d/14l/14f ok; ice-first/2 band 2+ waves mire 0d/7l/9f, deep 0d/10l/13f ok; ice-first/3 band 2+ waves mire 0d/7l/9f, deep 0d/15l/13f ok; crystal-first/1 band 2+ waves spire 0d/11l/9f, deep 0d/14l/14f ok; crystal-first/2 band 2+ waves spire 0d/11l/9f, deep 0d/10l/13f ok; crystal-first/3 band 2+ waves spire 0d/11l/9f, deep 0d/15l/13f ok
5. MET: The new limit is used: in every winning run the capturing wave at the band 2 relay it took and at The Deep has at least L - 6 ships
   - composer/1 spire 20 ships vs limit 20, deep 28 ships vs limit 28 ok; composer/2 spire 20 ships vs limit 20, deep 28 ships vs limit 28 ok; composer/3 spire 20 ships vs limit 20, deep 28 ships vs limit 28 ok; ice-first/1 mire 16 ships vs limit 20, deep 28 ships vs limit 28 ok; ice-first/2 mire 16 ships vs limit 20, deep 23 ships vs limit 28 ok; ice-first/3 mire 16 ships vs limit 20, deep 28 ships vs limit 28 ok; crystal-first/1 spire 20 ships vs limit 20, deep 28 ships vs limit 28 ok; crystal-first/2 spire 20 ships vs limit 20, deep 23 ships vs limit 28 ok; crystal-first/3 spire 20 ships vs limit 20, deep 28 ships vs limit 28 ok
6. MET: The set is a choice: every winning run leaves at least one area untaken, and on each seed at least two winners end with different sets of reclaimed areas
   - composer/1 untaken 4: rime, veil, garden, mire ok; composer/2 untaken 4: rime, veil, garden, mire ok; composer/3 untaken 4: rime, veil, garden, mire ok; ice-first/1 untaken 4: glint, veil, garden, spire ok; ice-first/2 untaken 4: glint, veil, garden, spire ok; ice-first/3 untaken 4: glint, veil, garden, spire ok; crystal-first/1 untaken 4: rime, veil, garden, mire ok; crystal-first/2 untaken 4: rime, veil, garden, mire ok; crystal-first/3 untaken 4: rime, veil, garden, mire ok; seed 1: 3 winners, 2 distinct sets; seed 2: 3 winners, 2 distinct sets; seed 3: 3 winners, 2 distinct sets
7. MET: Determinism and the reference replay pass
   - reference replay matches over 9000 ticks; composer seed 1 replayed to the same hash
