# Bot suite: PASS

Data version 7, 3 seeds, 5 campaign strategies. Visit cap 30.0 min (a second timeout in one area is a softlock), campaign cap 120 game minutes of play, tick budget p95 ≤ 2 ms. Bots run time 16.5 s.
Times are game minutes of play (m:ss); the overworld is paused and costs none. A seed picks The Deep's layout (1 Glass Thicket, 2 Twin Seams, 3 Frost Gate). Opening time = ticks from landing until route deliveries reach 40 ore/min.

## Per run

| Strategy | Seed | Outcome | Play time | Area order | Visit times | Entries / withdrawals | Opening times | Research (play time) | Lost / built | Hauled vs shipped (o/i/c) | Shipped % | Skipped | Tick p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ice-line | 1 | won | 47:36 | landfall > shelf > veil > deep > shoal > garden | landfall 0:11 > shelf 8:42 > veil 9:08 > deep 16:20 > shoal 4:30 > garden 8:41 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:14, veil 2:07, deep 1:15, shoal 0:56, garden 0:56 | opening1 0:11, flak1 8:53, extract1 8:53, lancer1 18:02, rigs1 18:02, extract2 18:02, opening2 18:02, yards1 34:23, rigs2 34:23, yards2 34:23, extract3 34:23, opening3 34:23, core1 47:36 | 89 / 176 | 1680/240/240 vs 585/205/57 | 28% | - | 0.0022 / 0.0039 |
| ice-line | 2 | won | 45:54 | landfall > shelf > veil > deep > shoal > garden | landfall 0:11 > shelf 8:42 > veil 9:08 > deep 14:38 > shoal 4:30 > garden 8:41 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:14, veil 2:07, deep 1:15, shoal 0:56, garden 0:56 | opening1 0:11, flak1 8:53, extract1 8:53, lancer1 18:02, rigs1 18:02, extract2 18:02, opening2 18:02, yards1 32:41, rigs2 32:41, yards2 32:41, extract3 32:41, opening3 32:41, core1 45:54 | 82 / 170 | 1680/240/240 vs 564/197/57 | 27% | - | 0.0022 / 0.0036 |
| ice-line | 3 | won | 45:47 | landfall > shelf > veil > deep > shoal > garden | landfall 0:11 > shelf 8:42 > veil 9:08 > deep 14:31 > shoal 4:30 > garden 8:41 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:14, veil 2:07, deep 1:15, shoal 0:56, garden 0:56 | opening1 0:11, flak1 8:53, extract1 8:53, lancer1 18:02, rigs1 18:02, extract2 18:02, opening2 18:02, yards1 32:34, rigs2 32:34, yards2 32:34, extract3 32:34, opening3 32:34, core1 45:47 | 85 / 171 | 1680/240/240 vs 563/196/57 | 27% | - | 0.0022 / 0.0037 |
| crystal-line | 1 | won | 48:10 | landfall > shoal > garden > deep > shelf > veil | landfall 0:11 > shoal 9:53 > garden 10:39 > deep 16:20 > shelf 4:15 > veil 6:48 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shoal 2:14, garden 2:07, deep 1:15, shelf 0:56, veil 0:56 | opening1 0:11, lancer1 10:04, extract1 10:04, flak1 20:44, rigs1 20:44, extract2 20:44, opening2 20:44, yards1 37:05, rigs2 37:05, yards2 37:05, extract3 37:05, opening3 37:05, core1 48:10 | 89 / 178 | 1680/240/240 vs 552/46/191 | 26% | - | 0.0020 / 0.0035 |
| crystal-line | 2 | won | 46:28 | landfall > shoal > garden > deep > shelf > veil | landfall 0:11 > shoal 9:53 > garden 10:39 > deep 14:38 > shelf 4:15 > veil 6:48 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shoal 2:14, garden 2:07, deep 1:15, shelf 0:56, veil 0:56 | opening1 0:11, lancer1 10:04, extract1 10:04, flak1 20:44, rigs1 20:44, extract2 20:44, opening2 20:44, yards1 35:23, rigs2 35:23, yards2 35:23, extract3 35:23, opening3 35:23, core1 46:28 | 82 / 172 | 1680/240/240 vs 532/46/183 | 26% | - | 0.0020 / 0.0036 |
| crystal-line | 3 | won | 46:21 | landfall > shoal > garden > deep > shelf > veil | landfall 0:11 > shoal 9:53 > garden 10:39 > deep 14:31 > shelf 4:15 > veil 6:48 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shoal 2:14, garden 2:07, deep 1:15, shelf 0:56, veil 0:56 | opening1 0:11, lancer1 10:04, extract1 10:04, flak1 20:44, rigs1 20:44, extract2 20:44, opening2 20:44, yards1 35:16, rigs2 35:16, yards2 35:16, extract3 35:16, opening3 35:16, core1 46:21 | 85 / 173 | 1680/240/240 vs 530/46/182 | 25% | - | 0.0020 / 0.0037 |
| full-kit | 1 | won | 50:47 | landfall > shelf > shoal > veil > garden > deep | landfall 0:11 > shelf 8:42 > shoal 9:07 > veil 8:40 > garden 9:21 > deep 14:42 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:14, shoal 2:07, veil 1:22, garden 0:57, deep 0:56 | opening1 0:11, flak1 8:53, extract1 8:53, lancer1 18:01, rigs1 18:01, yards1 18:01, extract2 26:42, opening2 26:42, rigs2 26:42, yards2 36:04, extract3 36:04, opening3 36:04, core1 50:47 | 89 / 189 | 1680/240/240 vs 620/156/109 | 29% | - | 0.0021 / 0.0036 |
| full-kit | 2 | won | 49:21 | landfall > shelf > shoal > veil > garden > deep | landfall 0:11 > shelf 8:42 > shoal 9:07 > veil 8:40 > garden 9:21 > deep 13:16 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:14, shoal 2:07, veil 1:22, garden 0:57, deep 0:56 | opening1 0:11, flak1 8:53, extract1 8:53, lancer1 18:01, rigs1 18:01, yards1 18:01, extract2 26:42, opening2 26:42, rigs2 26:42, yards2 36:04, extract3 36:04, opening3 36:04, core1 49:21 | 81 / 184 | 1680/240/240 vs 591/148/102 | 28% | - | 0.0021 / 0.0036 |
| full-kit | 3 | won | 49:15 | landfall > shelf > shoal > veil > garden > deep | landfall 0:11 > shelf 8:42 > shoal 9:07 > veil 8:40 > garden 9:21 > deep 13:10 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:14, shoal 2:07, veil 1:22, garden 0:57, deep 0:56 | opening1 0:11, flak1 8:53, extract1 8:53, lancer1 18:01, rigs1 18:01, yards1 18:01, extract2 26:42, opening2 26:42, rigs2 26:42, yards2 36:04, extract3 36:04, opening3 36:04, core1 49:15 | 84 / 185 | 1680/240/240 vs 589/148/101 | 27% | - | 0.0021 / 0.0038 |
| greedy | 1 | won | 47:48 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 8:42 > veil 9:08 > shoal 5:40 > garden 9:21 > deep 14:42 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:14, veil 2:07, shoal 1:15, garden 0:57, deep 0:56 | opening1 0:11, flak1 8:53, extract1 8:53, lancer1 18:02, rigs1 18:02, extract2 18:02, opening2 18:02, yards1 23:43, rigs2 23:43, yards2 33:05, extract3 33:05, opening3 33:05, core1 47:48 | 89 / 175 | 1680/240/240 vs 601/167/92 | 28% | - | 0.0021 / 0.0036 |
| greedy | 2 | won | 46:22 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 8:42 > veil 9:08 > shoal 5:40 > garden 9:21 > deep 13:16 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:14, veil 2:07, shoal 1:15, garden 0:57, deep 0:56 | opening1 0:11, flak1 8:53, extract1 8:53, lancer1 18:02, rigs1 18:02, extract2 18:02, opening2 18:02, yards1 23:43, rigs2 23:43, yards2 33:05, extract3 33:05, opening3 33:05, core1 46:22 | 81 / 170 | 1680/240/240 vs 573/159/85 | 27% | - | 0.0021 / 0.0041 |
| greedy | 3 | won | 46:16 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 8:42 > veil 9:08 > shoal 5:40 > garden 9:21 > deep 13:10 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 2:14, veil 2:07, shoal 1:15, garden 0:57, deep 0:56 | opening1 0:11, flak1 8:53, extract1 8:53, lancer1 18:02, rigs1 18:02, extract2 18:02, opening2 18:02, yards1 23:43, rigs2 23:43, yards2 33:05, extract3 33:05, opening3 33:05, core1 46:16 | 84 / 171 | 1680/240/240 vs 571/159/84 | 27% | - | 0.0021 / 0.0038 |
| no-research | 1 | won | 67:46 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 10:17 > veil 11:32 > shoal 9:14 > garden 14:23 > deep 22:05 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 3:49, veil 3:49, shoal 3:49, garden 3:49, deep 3:49 | flak1 10:28, lancer1 22:01, core1 67:46 | 92 / 172 | 1680/240/240 vs 890/251/139 | 37% | - | 0.0021 / 0.0038 |
| no-research | 2 | won | 65:42 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 10:17 > veil 11:32 > shoal 9:14 > garden 14:23 > deep 20:01 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 3:49, veil 3:49, shoal 3:49, garden 3:49, deep 3:49 | flak1 10:28, lancer1 22:01, core1 65:42 | 84 / 165 | 1680/240/240 vs 849/241/128 | 36% | - | 0.0021 / 0.0036 |
| no-research | 3 | won | 65:48 | landfall > shelf > veil > shoal > garden > deep | landfall 0:11 > shelf 10:17 > veil 11:32 > shoal 9:14 > garden 14:23 > deep 20:07 | landfall 1/0, shelf 1/0, shoal 1/0, veil 1/0, garden 1/0, deep 1/0 | shelf 3:49, veil 3:49, shoal 3:49, garden 3:49, deep 3:49 | flak1 10:28, lancer1 22:01, core1 65:48 | 88 / 168 | 1680/240/240 vs 851/241/129 | 36% | - | 0.0022 / 0.0038 |

## Per-seed comparison (time to the core)

| Seed | ice-line | crystal-line | full-kit | greedy | no-research |
| --- | --- | --- | --- | --- | --- |
| 1 | 47:36 | 48:10 | 50:47 | 47:48 | 67:46 |
| 2 | 45:54 | 46:28 | 49:21 | 46:22 | 65:42 |
| 3 | 45:47 | 46:21 | 49:15 | 46:16 | 65:48 |

## Area times (reclaiming visit; mean over every strategy and seed that reclaimed it, then per seed)

| Area | Target | Mean | Seed 1 | Seed 2 | Seed 3 |
| --- | --- | --- | --- | --- | --- |
| landfall | 0:00-1:00 | 0:11 | 0:11 | 0:11 | 0:11 |
| shelf | 4:00-9:00 | 8:08 | 8:08 | 8:08 | 8:08 |
| shoal | 4:00-9:00 | 7:41 | 7:41 | 7:41 | 7:41 |
| veil | 6:00-13:00 | 9:04 | 9:04 | 9:04 | 9:04 |
| garden | 6:00-13:00 | 10:29 | 10:29 | 10:29 | 10:29 |
| deep | 8:00-16:00 | 15:42 | 16:50 | 15:10 | 15:06 |

## Visit times per run, by area (reclaiming visit)

| Strategy | Seed | landfall | shelf | shoal | veil | garden | deep |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ice-line | 1 | 0:11 | 8:42 | 4:30 | 9:08 | 8:41 | 16:20 |
| ice-line | 2 | 0:11 | 8:42 | 4:30 | 9:08 | 8:41 | 14:38 |
| ice-line | 3 | 0:11 | 8:42 | 4:30 | 9:08 | 8:41 | 14:31 |
| crystal-line | 1 | 0:11 | 4:15 | 9:53 | 6:48 | 10:39 | 16:20 |
| crystal-line | 2 | 0:11 | 4:15 | 9:53 | 6:48 | 10:39 | 14:38 |
| crystal-line | 3 | 0:11 | 4:15 | 9:53 | 6:48 | 10:39 | 14:31 |
| full-kit | 1 | 0:11 | 8:42 | 9:07 | 8:40 | 9:21 | 14:42 |
| full-kit | 2 | 0:11 | 8:42 | 9:07 | 8:40 | 9:21 | 13:16 |
| full-kit | 3 | 0:11 | 8:42 | 9:07 | 8:40 | 9:21 | 13:10 |
| greedy | 1 | 0:11 | 8:42 | 5:40 | 9:08 | 9:21 | 14:42 |
| greedy | 2 | 0:11 | 8:42 | 5:40 | 9:08 | 9:21 | 13:16 |
| greedy | 3 | 0:11 | 8:42 | 5:40 | 9:08 | 9:21 | 13:10 |
| no-research | 1 | 0:11 | 10:17 | 9:14 | 11:32 | 14:23 | 22:05 |
| no-research | 2 | 0:11 | 10:17 | 9:14 | 11:32 | 14:23 | 20:01 |
| no-research | 3 | 0:11 | 10:17 | 9:14 | 11:32 | 14:23 | 20:07 |

## H4 flags (report lines, not gates)

1. MET: No softlock: every strategy buys the probe core on every seed within 120 game minutes of play
   - all 15 runs bought the core
2. MET: Run length: the best strategy's full run is 45-75 game minutes on every seed, and mean area times are inside their windows
   - seed 1 best ice-line 47.6 min; seed 2 best ice-line 45.9 min; seed 3 best ice-line 45.8 min; run inside the window; mean area times landfall 0:11 (0:00-1:00), shelf 8:08 (4:00-9:00), shoal 7:41 (4:00-9:00), veil 9:04 (6:00-13:00), garden 10:29 (6:00-13:00), deep 15:42 (8:00-16:00)
3. MET: Two viable sides: ice-line and crystal-line finish within 15% of each other on at least 2 of 3 seeds
   - 3 of 3 within 15%; seed 1: ice 47.6, crystal 48.2, gap 1% (within); seed 2: ice 45.9, crystal 46.5, gap 1% (within); seed 3: ice 45.8, crystal 46.4, gap 1% (within)
4. MET: The design decides the cheap medium: Spore Veil is at least 20% faster with Flak only than Lancer only, Thorn Garden at least 20% faster with Lancer only than Flak only (seed 1, four probe runs)
   - Veil: flak 9:09, lancer 16:20 (flak 44% faster, met); Garden: lancer 10:39, flak 16:19 (lancer 35% faster, met)
5. MET: Research matters: no-research takes at least 25% longer than the best strategy on every seed, and every researching strategy opens its last area in at most 60% of the time of its first light area
   - seed 1: no-research 67.8 vs best ice-line 47.6 min (+42%); seed 2: no-research 65.7 vs best ice-line 45.9 min (+43%); seed 3: no-research 65.8 vs best ice-line 45.8 min (+44%); openings (last area vs first light area): ice-line/1 garden 0:56 vs shelf 2:14, ice-line/2 garden 0:56 vs shelf 2:14, ice-line/3 garden 0:56 vs shelf 2:14, crystal-line/1 veil 0:56 vs shoal 2:14, crystal-line/2 veil 0:56 vs shoal 2:14, crystal-line/3 veil 0:56 vs shoal 2:14, full-kit/1 deep 0:56 vs shelf 2:14, full-kit/2 deep 0:56 vs shelf 2:14, full-kit/3 deep 0:56 vs shelf 2:14, greedy/1 deep 0:56 vs shelf 2:14, greedy/2 deep 0:56 vs shelf 2:14, greedy/3 deep 0:56 vs shelf 2:14
6. MET: Order varies: at least two different area orders finish within 15% of the best full-run time on every seed
   - seed 1: 4 orders; seed 2: 4 orders; seed 3: 4 orders
7. MET: Determinism and the reference replay pass
   - reference replay matches over 9000 ticks; greedy seed 1 replayed to the same hash

Flag 4 probe runs (seed 1, from Landfall + Frost Shelf + Glass Shoal reclaimed, opening 1, extraction 1): Veil flak 9:09, Veil lancer 16:20, Garden lancer 10:39, Garden flak 16:19.

