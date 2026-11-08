# Bot suite: PASS

Data version 6, 3 seeds, 5 campaign strategies. Visit cap 30.0 min (a second timeout in one area is a softlock), campaign cap 120 game minutes of play, tick budget p95 ≤ 2 ms. Bots run time 15.0 s.
Times are game minutes of play (m:ss); the overworld is paused and costs none. A seed picks The Deep's layout (1 Glass Thicket, 2 Twin Seams, 3 Frost Gate). Opening time = ticks from landing until route deliveries reach 40 ore/min.

## Per run

| Strategy | Seed | Outcome | Play time | Area order | Visit times | Entries / withdrawals | Opening times | Research (play time) | Lost / built | Hauled vs shipped (o/i/c) | Shipped % | Skipped | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ice-line | 1 | won | 45:56 | landfall > shelf > veil > deep > shoal | landfall 0:11 > shelf 7:43 > veil 8:12 > deep 25:32 > shoal 4:15 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, deep 1/0 | shelf 2:07, veil 1:22, deep 1:15, shoal 0:56 | opening1 0:11, extract1 0:11, flak1 7:54, rigs1 7:54, yards1 16:07, extract2 16:07, opening2 16:07, lancer1 41:40, rigs2 41:40, extract3 41:40, opening3 41:40, core1 45:56 | 84 / 185 | 1400/200/170 vs 480/178/12 | 27% | garden | 0.0023 / 0.0041 |
| ice-line | 2 | won | 44:09 | landfall > shelf > veil > deep > shoal | landfall 0:11 > shelf 7:43 > veil 8:12 > deep 23:45 > shoal 4:15 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, deep 1/0 | shelf 2:07, veil 1:22, deep 1:15, shoal 0:56 | opening1 0:11, extract1 0:11, flak1 7:54, rigs1 7:54, yards1 16:07, extract2 16:07, opening2 16:07, lancer1 39:53, rigs2 39:53, extract3 39:53, opening3 39:53, core1 44:09 | 73 / 175 | 1400/200/170 vs 458/169/12 | 26% | garden | 0.0020 / 0.0035 |
| ice-line | 3 | won | 42:51 | landfall > shelf > veil > deep > shoal | landfall 0:11 > shelf 7:43 > veil 8:12 > deep 22:27 > shoal 4:15 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, deep 1/0 | shelf 2:07, veil 1:22, deep 1:15, shoal 0:56 | opening1 0:11, extract1 0:11, flak1 7:54, rigs1 7:54, yards1 16:07, extract2 16:07, opening2 16:07, lancer1 38:35, rigs2 38:35, extract3 38:35, opening3 38:35, core1 42:51 | 76 / 171 | 1400/200/170 vs 443/162/12 | 25% | garden | 0.0020 / 0.0036 |
| crystal-line | 1 | won | 36:58 | landfall > shoal > garden > deep > shelf | landfall 0:11 > shoal 8:14 > garden 9:10 > deep 15:05 > shelf 4:15 | landfall 1/0, shelf 1/0, shoal 1/0, garden 1/0, deep 1/0 | shoal 2:07, garden 1:22, deep 1:15, shelf 0:56 | opening1 0:11, extract1 0:11, lancer1 8:25, rigs1 8:25, yards1 17:36, extract2 17:36, opening2 17:36, flak1 32:42, rigs2 32:42, extract3 32:42, opening3 32:42, core1 36:58 | 78 / 135 | 1400/170/200 vs 363/12/127 | 22% | veil | 0.0019 / 0.0035 |
| crystal-line | 2 | won | 36:13 | landfall > shoal > garden > deep > shelf | landfall 0:11 > shoal 8:14 > garden 9:10 > deep 14:20 > shelf 4:15 | landfall 1/0, shelf 1/0, shoal 1/0, garden 1/0, deep 1/0 | shoal 2:07, garden 1:22, deep 1:15, shelf 0:56 | opening1 0:11, extract1 0:11, lancer1 8:25, rigs1 8:25, yards1 17:36, extract2 17:36, opening2 17:36, flak1 31:57, rigs2 31:57, extract3 31:57, opening3 31:57, core1 36:13 | 84 / 135 | 1400/170/200 vs 354/12/124 | 21% | veil | 0.0019 / 0.0035 |
| crystal-line | 3 | won | 35:54 | landfall > shoal > garden > deep > shelf | landfall 0:11 > shoal 8:14 > garden 9:10 > deep 14:01 > shelf 4:15 | landfall 1/0, shelf 1/0, shoal 1/0, garden 1/0, deep 1/0 | shoal 2:07, garden 1:22, deep 1:15, shelf 0:56 | opening1 0:11, extract1 0:11, lancer1 8:25, rigs1 8:25, yards1 17:36, extract2 17:36, opening2 17:36, flak1 31:38, rigs2 31:38, extract3 31:38, opening3 31:38, core1 35:54 | 76 / 136 | 1400/170/200 vs 350/12/122 | 21% | veil | 0.0019 / 0.0039 |
| full-kit | 1 | won | 46:38 | landfall > shelf > shoal > veil > garden > deep | landfall 0:11 > shelf 7:43 > shoal 7:24 > veil 8:00 > garden 8:34 > deep 14:42 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:07, shoal 1:22, veil 1:22, garden 0:57, deep 0:56 | opening1 0:11, extract1 0:11, flak1 7:54, rigs1 7:54, lancer1 15:19, yards1 15:19, extract2 15:19, opening2 23:20, rigs2 23:20, yards2 31:55, extract3 31:55, opening3 31:55, core1 46:38 | 85 / 178 | 1700/230/230 vs 585/147/106 | 27% | - | 0.0019 / 0.0037 |
| full-kit | 2 | won | 45:12 | landfall > shelf > shoal > veil > garden > deep | landfall 0:11 > shelf 7:43 > shoal 7:24 > veil 8:00 > garden 8:34 > deep 13:16 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:07, shoal 1:22, veil 1:22, garden 0:57, deep 0:56 | opening1 0:11, extract1 0:11, flak1 7:54, rigs1 7:54, lancer1 15:19, yards1 15:19, extract2 15:19, opening2 23:20, rigs2 23:20, yards2 31:55, extract3 31:55, opening3 31:55, core1 45:12 | 77 / 173 | 1700/230/230 vs 557/140/99 | 26% | - | 0.0020 / 0.0036 |
| full-kit | 3 | won | 45:06 | landfall > shelf > shoal > veil > garden > deep | landfall 0:11 > shelf 7:43 > shoal 7:24 > veil 8:00 > garden 8:34 > deep 13:10 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:07, shoal 1:22, veil 1:22, garden 0:57, deep 0:56 | opening1 0:11, extract1 0:11, flak1 7:54, rigs1 7:54, lancer1 15:19, yards1 15:19, extract2 15:19, opening2 23:20, rigs2 23:20, yards2 31:55, extract3 31:55, opening3 31:55, core1 45:06 | 80 / 174 | 1700/230/230 vs 555/139/99 | 26% | - | 0.0020 / 0.0037 |
| greedy | 1 | won | 46:00 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 7:43 > veil 8:12 > shoal 6:34 > garden 8:34 > deep 14:42 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:07, veil 1:22, shoal 1:15, garden 0:57, deep 0:56 | opening1 0:11, extract1 0:11, flak1 7:54, rigs1 7:54, yards1 16:07, extract2 16:07, opening2 16:07, lancer1 22:42, rigs2 22:42, yards2 31:17, extract3 31:17, opening3 31:17, core1 46:00 | 86 / 177 | 1700/230/230 vs 590/165/90 | 28% | - | 0.0019 / 0.0036 |
| greedy | 2 | won | 44:34 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 7:43 > veil 8:12 > shoal 6:34 > garden 8:34 > deep 13:16 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:07, veil 1:22, shoal 1:15, garden 0:57, deep 0:56 | opening1 0:11, extract1 0:11, flak1 7:54, rigs1 7:54, yards1 16:07, extract2 16:07, opening2 16:07, lancer1 22:42, rigs2 22:42, yards2 31:17, extract3 31:17, opening3 31:17, core1 44:34 | 78 / 172 | 1700/230/230 vs 561/158/83 | 27% | - | 0.0019 / 0.0036 |
| greedy | 3 | won | 44:28 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 7:43 > veil 8:12 > shoal 6:34 > garden 8:34 > deep 13:10 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:07, veil 1:22, shoal 1:15, garden 0:57, deep 0:56 | opening1 0:11, extract1 0:11, flak1 7:54, rigs1 7:54, yards1 16:07, extract2 16:07, opening2 16:07, lancer1 22:42, rigs2 22:42, yards2 31:17, extract3 31:17, opening3 31:17, core1 44:28 | 81 / 173 | 1700/230/230 vs 559/158/83 | 27% | - | 0.0019 / 0.0037 |
| no-research | 1 | won | 67:38 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 9:54 > veil 11:26 > shoal 10:29 > garden 13:29 > deep 22:05 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 3:49, veil 3:49, shoal 3:49, garden 3:49, deep 3:49 | flak1 10:05, lancer1 32:02, core1 67:38 | 86 / 175 | 1700/230/230 vs 890/253/137 | 37% | - | 0.0019 / 0.0035 |
| no-research | 2 | won | 65:34 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 9:54 > veil 11:26 > shoal 10:29 > garden 13:29 > deep 20:01 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 3:49, veil 3:49, shoal 3:49, garden 3:49, deep 3:49 | flak1 10:05, lancer1 32:02, core1 65:34 | 78 / 168 | 1700/230/230 vs 848/243/127 | 36% | - | 0.0019 / 0.0036 |
| no-research | 3 | won | 65:40 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 9:54 > veil 11:26 > shoal 10:29 > garden 13:29 > deep 20:07 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 3:49, veil 3:49, shoal 3:49, garden 3:49, deep 3:49 | flak1 10:05, lancer1 32:02, core1 65:40 | 82 / 171 | 1700/230/230 vs 850/243/127 | 36% | - | 0.0019 / 0.0037 |

## Per-seed comparison (time to the core)

| Seed | ice-line | crystal-line | full-kit | greedy | no-research |
| --- | --- | --- | --- | --- | --- |
| 1 | 45:56 | 36:58 | 46:38 | 46:00 | 67:38 |
| 2 | 44:09 | 36:13 | 45:12 | 44:34 | 65:34 |
| 3 | 42:51 | 35:54 | 45:06 | 44:28 | 65:40 |

## Area times (reclaiming visit; mean over every strategy and seed that reclaimed it, then per seed)

| Area | Target | Mean | Seed 1 | Seed 2 | Seed 3 |
| --- | --- | --- | --- | --- | --- |
| landfall | 0:00-1:00 | 0:11 | 0:11 | 0:11 | 0:11 |
| shelf | 4:00-9:00 | 7:28 | 7:28 | 7:28 | 7:28 |
| shoal | 4:00-9:00 | 7:24 | 7:24 | 7:24 | 7:24 |
| veil | 6:00-13:00 | 8:58 | 8:58 | 8:58 | 8:58 |
| garden | 6:00-13:00 | 9:57 | 9:57 | 9:57 | 9:57 |
| deep | 8:00-16:00 | 17:19 | 18:26 | 16:56 | 16:35 |

## Visit times per run, by area (reclaiming visit)

| Strategy | Seed | landfall | shelf | shoal | veil | garden | deep |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ice-line | 1 | 0:11 | 7:43 | 4:15 | 8:12 | - | 25:32 |
| ice-line | 2 | 0:11 | 7:43 | 4:15 | 8:12 | - | 23:45 |
| ice-line | 3 | 0:11 | 7:43 | 4:15 | 8:12 | - | 22:27 |
| crystal-line | 1 | 0:11 | 4:15 | 8:14 | - | 9:10 | 15:05 |
| crystal-line | 2 | 0:11 | 4:15 | 8:14 | - | 9:10 | 14:20 |
| crystal-line | 3 | 0:11 | 4:15 | 8:14 | - | 9:10 | 14:01 |
| full-kit | 1 | 0:11 | 7:43 | 7:24 | 8:00 | 8:34 | 14:42 |
| full-kit | 2 | 0:11 | 7:43 | 7:24 | 8:00 | 8:34 | 13:16 |
| full-kit | 3 | 0:11 | 7:43 | 7:24 | 8:00 | 8:34 | 13:10 |
| greedy | 1 | 0:11 | 7:43 | 6:34 | 8:12 | 8:34 | 14:42 |
| greedy | 2 | 0:11 | 7:43 | 6:34 | 8:12 | 8:34 | 13:16 |
| greedy | 3 | 0:11 | 7:43 | 6:34 | 8:12 | 8:34 | 13:10 |
| no-research | 1 | 0:11 | 9:54 | 10:29 | 11:26 | 13:29 | 22:05 |
| no-research | 2 | 0:11 | 9:54 | 10:29 | 11:26 | 13:29 | 20:01 |
| no-research | 3 | 0:11 | 9:54 | 10:29 | 11:26 | 13:29 | 20:07 |

## H4 flags (report lines, not gates)

1. MET: No softlock: every strategy buys the probe core on every seed within 120 game minutes of play
   - all 15 runs bought the core
2. MISSED: Run length: the best strategy's full run is 45-75 game minutes on every seed, and mean area times are inside their windows
   - seed 1 best crystal-line 37.0 min; seed 2 best crystal-line 36.2 min; seed 3 best crystal-line 35.9 min; run OUTSIDE the window; mean area times landfall 0:11 (0:00-1:00), shelf 7:28 (4:00-9:00), shoal 7:24 (4:00-9:00), veil 8:58 (6:00-13:00), garden 9:57 (6:00-13:00), deep 17:19 (8:00-16:00 MISS)
3. MISSED: Two viable sides: ice-line and crystal-line finish within 15% of each other on at least 2 of 3 seeds
   - 0 of 3 within 15%; seed 1: ice 45.9, crystal 37.0, gap 24% (outside); seed 2: ice 44.2, crystal 36.2, gap 22% (outside); seed 3: ice 42.9, crystal 35.9, gap 19% (outside)
4. MISSED: The design decides the cheap medium: Spore Veil is at least 20% faster with Flak only than Lancer only, Thorn Garden at least 20% faster with Lancer only than Flak only (seed 1, four probe runs)
   - Veil: flak 9:03, lancer 10:42 (flak 15% faster, missed); Garden: lancer 10:03, flak 14:40 (lancer 31% faster, met)
5. MET: Research matters: no-research takes at least 25% longer than the best strategy on every seed, and every researching strategy opens its last area in at most 60% of the time of its first light area
   - seed 1: no-research 67.6 vs best crystal-line 37.0 min (+83%); seed 2: no-research 65.6 vs best crystal-line 36.2 min (+81%); seed 3: no-research 65.7 vs best crystal-line 35.9 min (+83%); openings (last area vs first light area): ice-line/1 shoal 0:56 vs shelf 2:07, ice-line/2 shoal 0:56 vs shelf 2:07, ice-line/3 shoal 0:56 vs shelf 2:07, crystal-line/1 shelf 0:56 vs shoal 2:07, crystal-line/2 shelf 0:56 vs shoal 2:07, crystal-line/3 shelf 0:56 vs shoal 2:07, full-kit/1 deep 0:56 vs shelf 2:07, full-kit/2 deep 0:56 vs shelf 2:07, full-kit/3 deep 0:56 vs shelf 2:07, greedy/1 deep 0:56 vs shelf 2:07, greedy/2 deep 0:56 vs shelf 2:07, greedy/3 deep 0:56 vs shelf 2:07
6. MISSED: Order varies: at least two different area orders finish within 15% of the best full-run time on every seed
   - seed 1: 1 order; seed 2: 1 order; seed 3: 1 order
7. MET: Determinism and the reference replay pass
   - reference replay matches over 9000 ticks; greedy seed 1 replayed to the same hash

Flag 4 probe runs (seed 1, from Landfall + Frost Shelf + Glass Shoal reclaimed, opening 1, extraction 1): Veil flak 9:03, Veil lancer 10:42, Garden lancer 10:03, Garden flak 14:40.

