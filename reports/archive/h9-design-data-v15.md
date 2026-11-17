# h9-design-data on data v15: probe, sweep and per-prong fights

*Superseded 2026-11-16 by the Director's rulings: `raid.prongMinSize` 3 ships as data v16. The final suite is `reports/archive/h9-design-data-v16-bots.md`, and the final table is in DESIGN.md "Calibration result (h9-design-data, data v16)". This report stays as the v15 probe and sweep.*

**Result: no value changed. H9 ships on data v15.** Every value that met target 1 also moved a winner by more than 10% or changed the strategy order. Under the designer.md guard (and PROCESS), those go to the Director with the reword options, and aren't committed as shipped. See "For the Director" at the end.

Scripts (run from the repo root; bounded by the runner's 45-minute cap, with progress on stderr):
- `reports/archive/h9-design-data-v15-sweep.mts` runs adaptive, adaptive-concentrate, greedy and undefended on 1 seed per variant. Every seed is the same run (`reports/archive/h9-bots-v15.md`: seeds 1–3 identical).
- `reports/archive/h9-design-data-v15-fights.mts` runs the per-prong fights through the sim's own muster and launch (W1–W6), in two orders.
- `reports/archive/h9-design-data-min3-bots.md` is the full bot suite (`npm run bots -- --seeds 1`) with `raid.prongMinSize` 3, the only candidate value, for its flags and staffing.

Times are game minutes. "%" is the win time against adaptive in the same variant (+ is slower). `byProng` counts finished raids by prong count; a raid still out at the win isn't counted. `econLost` is economy ships lost over the run. `idleH` is idle haulers at the probe: peak / minutes with more than 1 outside raids. `guardedLoss` is economy ships lost under a guard (must be 0).

## Sweep output (verbatim)

```
v15            adaptive              won     15:54    0% | raids 6 byProng {"1":5} firstSplit - | econLost 6 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
v15            adaptive-concentrate  won     15:54    0% | raids 6 byProng {"1":5} firstSplit - | econLost 7 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
v15            greedy                won     20:33   29% | raids 8 byProng {"1":5,"2":2} firstSplit 13:00 | econLost 5 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
v15            undefended            won     12:03  -24% | raids 4 byProng {"1":4} firstSplit - | econLost 5 peakEcon 14 first 2:42 idleH 1/0 guardedLoss 0
min3           adaptive              won     18:20    0% | raids 7 byProng {"1":2,"2":4} firstSplit 7:53 | econLost 5 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
min3           adaptive-concentrate  won     23:13   27% | raids 9 byProng {"1":4,"2":4} firstSplit 7:53 | econLost 6 peakEcon 14 first 2:42 idleH 2/0.69 guardedLoss 0
min3           greedy                won     18:18    0% | raids 7 byProng {"1":2,"2":4} firstSplit 8:04 | econLost 5 peakEcon 17 first 2:42 idleH 1/0 guardedLoss 0
min3           undefended            won     13:09  -28% | raids 5 byProng {"1":3,"2":1} firstSplit 5:19 | econLost 5 peakEcon 13 first 2:42 idleH 1/0 guardedLoss 0
min2           adaptive              won     18:20    0% | raids 7 byProng {"1":2,"2":4} firstSplit 7:53 | econLost 5 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
min2           adaptive-concentrate  won     23:30   28% | raids 9 byProng {"1":2,"2":6} firstSplit 7:53 | econLost 7 peakEcon 14 first 2:42 idleH 2/0.69 guardedLoss 0
min2           greedy                won     18:26    1% | raids 7 byProng {"1":1,"2":5} firstSplit 5:19 | econLost 6 peakEcon 17 first 2:42 idleH 1/0 guardedLoss 0
min2           undefended            won     14:06  -23% | raids 5 byProng {"1":1,"2":4} firstSplit 5:19 | econLost 7 peakEcon 12 first 2:42 idleH 1/0 guardedLoss 0
min2max3       adaptive              won     23:25    0% | raids 9 byProng {"1":2,"2":4,"3":2} firstSplit 7:53 | econLost 10 peakEcon 16 first 2:42 idleH 3/4.91 guardedLoss 0
min2max3       adaptive-concentrate  won     20:59  -10% | raids 8 byProng {"1":2,"2":2,"3":3} firstSplit 7:53 | econLost 8 peakEcon 14 first 2:42 idleH 1/0 guardedLoss 0
min2max3       greedy                won     30:56   32% | raids 12 byProng {"1":1,"2":7,"3":3} firstSplit 5:19 | econLost 8 peakEcon 14 first 2:42 idleH 2/6.29 guardedLoss 0
min2max3       undefended            won     14:17  -39% | raids 5 byProng {"1":1,"2":3,"3":1} firstSplit 5:19 | econLost 7 peakEcon 12 first 2:42 idleH 2/0.94 guardedLoss 0
min3max3       adaptive              won     18:20    0% | raids 7 byProng {"1":2,"2":4} firstSplit 7:53 | econLost 5 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
min3max3       adaptive-concentrate  won     23:13   27% | raids 9 byProng {"1":4,"2":4} firstSplit 7:53 | econLost 6 peakEcon 14 first 2:42 idleH 2/0.69 guardedLoss 0
min3max3       greedy                won     18:18    0% | raids 7 byProng {"1":2,"2":4} firstSplit 8:04 | econLost 6 peakEcon 17 first 2:42 idleH 1/0 guardedLoss 0
min3max3       undefended            won     13:09  -28% | raids 5 byProng {"1":3,"2":1} firstSplit 5:19 | econLost 5 peakEcon 13 first 2:42 idleH 1/0 guardedLoss 0
m3gap2400      adaptive              won     20:01    0% | raids 10 byProng {"1":4,"2":5} firstSplit 8:44 | econLost 7 peakEcon 17 first 2:42 idleH 1/0 guardedLoss 0
m3gap2400      adaptive-concentrate  won     14:45  -26% | raids 7 byProng {"1":3,"2":3} firstSplit 8:44 | econLost 8 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
m3gap2400      greedy                won     21:33    8% | raids 11 byProng {"1":6,"2":4} firstSplit 8:27 | econLost 8 peakEcon 16 first 2:42 idleH 2/2.49 guardedLoss 0
m3gap2400      undefended            won     12:34  -37% | raids 6 byProng {"1":2,"2":3} firstSplit 6:32 | econLost 8 peakEcon 13 first 2:42 idleH 1/0 guardedLoss 0
m3gap4500      adaptive              won     18:24    0% | raids 6 byProng {"1":2,"2":3} firstSplit 8:50 | econLost 8 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
m3gap4500      adaptive-concentrate  won     15:19  -17% | raids 5 byProng {"1":2,"2":2} firstSplit 8:50 | econLost 6 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
m3gap4500      greedy                won     15:10  -18% | raids 5 byProng {"1":2,"2":2} firstSplit 8:49 | econLost 5 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
m3gap4500      undefended            won     12:52  -30% | raids 4 byProng {"1":1,"2":3} firstSplit 5:49 | econLost 7 peakEcon 13 first 2:42 idleH 1/0 guardedLoss 0
m3gap5400      adaptive              won     13:37    0% | raids 4 byProng {"1":2,"2":1} firstSplit 9:47 | econLost 3 peakEcon 17 first 2:42 idleH 1/0 guardedLoss 0
m3gap5400      adaptive-concentrate  won     13:43    1% | raids 4 byProng {"1":2,"2":1} firstSplit 9:47 | econLost 4 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
m3gap5400      greedy                won     13:55    2% | raids 4 byProng {"1":2,"2":1} firstSplit 10:03 | econLost 4 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
m3gap5400      undefended            won     12:35   -8% | raids 3 byProng {"1":2,"2":1} firstSplit 6:19 | econLost 5 peakEcon 12 first 2:42 idleH 0/0 guardedLoss 0
m3keep35       adaptive              won     18:20    0% | raids 7 byProng {"1":2,"2":4} firstSplit 7:53 | econLost 5 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
m3keep35       adaptive-concentrate  won     23:13   27% | raids 9 byProng {"1":4,"2":4} firstSplit 7:53 | econLost 6 peakEcon 14 first 2:42 idleH 2/0.69 guardedLoss 0
m3keep35       greedy                won     18:18    0% | raids 7 byProng {"1":2,"2":4} firstSplit 8:04 | econLost 5 peakEcon 17 first 2:42 idleH 1/0 guardedLoss 0
m3keep35       undefended            won     13:09  -28% | raids 5 byProng {"1":3,"2":1} firstSplit 5:19 | econLost 5 peakEcon 13 first 2:42 idleH 1/0 guardedLoss 0
m3max10        adaptive              won     18:20    0% | raids 7 byProng {"1":2,"2":4} firstSplit 7:53 | econLost 5 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
m3max10        adaptive-concentrate  won     23:13   27% | raids 9 byProng {"1":4,"2":4} firstSplit 7:53 | econLost 6 peakEcon 14 first 2:42 idleH 2/0.69 guardedLoss 0
m3max10        greedy                won     18:18    0% | raids 7 byProng {"1":2,"2":4} firstSplit 8:04 | econLost 5 peakEcon 17 first 2:42 idleH 1/0 guardedLoss 0
m3max10        undefended            won     13:09  -28% | raids 5 byProng {"1":3,"2":1} firstSplit 5:19 | econLost 5 peakEcon 13 first 2:42 idleH 1/0 guardedLoss 0
m3epr1         adaptive              won     31:39    0% | raids 9 byProng {"2":8} firstSplit 2:42 | econLost 10 peakEcon 16 first 2:42 idleH 2/1.63 guardedLoss 0
m3epr1         adaptive-concentrate  won     22:24  -29% | raids 7 byProng {"2":6} firstSplit 2:42 | econLost 12 peakEcon 14 first 2:42 idleH 2/0.4 guardedLoss 0
m3epr1         greedy                timeout 45:00     - | raids 10 byProng {"2":10} firstSplit 2:42 | econLost 27 peakEcon 7 first 2:42 idleH 3/22.45 guardedLoss 0
m3epr1         undefended            won     14:48  -53% | raids 5 byProng {"2":5} firstSplit 2:42 | econLost 10 peakEcon 13 first 2:42 idleH 1/0 guardedLoss 0
epr1           adaptive              won     37:04    0% | raids 14 byProng {"1":5,"2":8} firstSplit 10:38 | econLost 24 peakEcon 19 first 2:42 idleH 2/1.74 guardedLoss 0
epr1           adaptive-concentrate  timeout 45:00     - | raids 16 byProng {"1":8,"2":8} firstSplit 10:38 | econLost 40 peakEcon 8 first 2:42 idleH 2/0 guardedLoss 0
epr1           greedy                won     34:05   -8% | raids 13 byProng {"1":2,"2":10} firstSplit 5:18 | econLost 16 peakEcon 15 first 2:42 idleH 2/3.17 guardedLoss 0
epr1           undefended            won     12:59  -65% | raids 5 byProng {"1":1,"2":3} firstSplit 5:18 | econLost 5 peakEcon 12 first 2:42 idleH 1/0 guardedLoss 0
m3ehp4         adaptive              won     22:52    0% | raids 9 byProng {"1":4,"2":4} firstSplit 7:52 | econLost 4 peakEcon 16 first 2:42 idleH 2/1.05 guardedLoss 0
m3ehp4         adaptive-concentrate  won     15:52  -31% | raids 6 byProng {"1":2,"2":3} firstSplit 7:52 | econLost 7 peakEcon 16 first 2:42 idleH 1/0 guardedLoss 0
m3ehp4         greedy                won     20:46   -9% | raids 8 byProng {"1":4,"2":3} firstSplit 10:45 | econLost 5 peakEcon 16 first 2:42 idleH 2/1.68 guardedLoss 0
m3ehp4         undefended            won     12:59  -43% | raids 5 byProng {"1":3,"2":1} firstSplit 5:18 | econLost 5 peakEcon 12 first 2:42 idleH 1/0 guardedLoss 0
m3ec30         adaptive              won     20:38    0% | raids 7 byProng {"1":3,"2":3} firstSplit 12:46 | econLost 4 peakEcon 16 first 4:07 idleH 1/0 guardedLoss 0
m3ec30         adaptive-concentrate  won     25:35   24% | raids 9 byProng {"1":5,"2":3} firstSplit 12:46 | econLost 6 peakEcon 15 first 4:07 idleH 1/0 guardedLoss 0
m3ec30         greedy                won     34:26   67% | raids 13 byProng {"1":8,"2":4} firstSplit 11:57 | econLost 7 peakEcon 14 first 4:07 idleH 2/0.64 guardedLoss 0
m3ec30         undefended            won     15:24  -25% | raids 5 byProng {"1":2,"2":3} firstSplit 9:17 | econLost 6 peakEcon 12 first 4:07 idleH 2/0.24 guardedLoss 0
m3ec40         adaptive              won     35:51    0% | raids 12 byProng {"1":7,"2":4} firstSplit 15:44 | econLost 6 peakEcon 14 first 5:57 idleH 1/0 guardedLoss 0
m3ec40         adaptive-concentrate  won     28:31  -20% | raids 9 byProng {"1":5,"2":3} firstSplit 15:44 | econLost 6 peakEcon 15 first 5:57 idleH 1/0 guardedLoss 0
m3ec40         greedy                won     22:32  -37% | raids 7 byProng {"1":3,"2":3} firstSplit 14:35 | econLost 5 peakEcon 15 first 5:57 idleH 2/0 guardedLoss 0
m3ec40         undefended            won     19:13  -46% | raids 6 byProng {"1":2,"2":3} firstSplit 11:07 | econLost 8 peakEcon 13 first 5:57 idleH 2/0.02 guardedLoss 0
ec40           adaptive              won     23:30    0% | raids 7 byProng {"1":6} firstSplit - | econLost 4 peakEcon 16 first 5:57 idleH 1/0 guardedLoss 0
ec40           adaptive-concentrate  won     23:30    0% | raids 7 byProng {"1":6} firstSplit - | econLost 4 peakEcon 16 first 5:57 idleH 1/0 guardedLoss 0
ec40           greedy                won     27:05   15% | raids 9 byProng {"1":6,"2":2} firstSplit 19:32 | econLost 5 peakEcon 17 first 5:57 idleH 1/0 guardedLoss 0
ec40           undefended            won     18:00  -23% | raids 5 byProng {"1":5} firstSplit - | econLost 5 peakEcon 14 first 5:57 idleH 1/0 guardedLoss 0
```

## Per-prong fights (verbatim)

A full economy of 24 gives the raid of 12 (4 Thorns, 8 Spores). It splits into 2 prongs of 2T 4S, at a5 (3 extractors and 3 haulers) and a6 (2 and 2). The second order places defenders flak first.

```
econ 24; overrides: none
- undefended: overall hit; a5 hit (econ lost 3, warships lost 0, raiders killed 0) | a6 hit (econ lost 2, warships lost 0, raiders killed 0); warships lost total 0
  second order: overall hit; a5 hit (econ lost 3, warships lost 0, raiders killed 0) | a6 hit (econ lost 2, warships lost 0, raiders killed 0); warships lost total 0
- a5 2 (1L1F), a6 none: overall hit; a5 hit (econ lost 3, warships lost 2, raiders killed 3) | a6 hit (econ lost 2, warships lost 0, raiders killed 0); warships lost total 2
  second order: overall hit; a5 hit (econ lost 3, warships lost 2, raiders killed 3) | a6 hit (econ lost 2, warships lost 0, raiders killed 0); warships lost total 2
- a5 2 (0L2F): overall hit; a5 hit (econ lost 3, warships lost 2, raiders killed 4) | a6 hit (econ lost 2, warships lost 0, raiders killed 0); warships lost total 2
  second order: overall hit; a5 hit (econ lost 3, warships lost 2, raiders killed 4) | a6 hit (econ lost 2, warships lost 0, raiders killed 0); warships lost total 2
- a5 3 (1L2F) half: overall hit; a5 beaten (econ lost 0, warships lost 2, raiders killed 6) | a6 hit (econ lost 2, warships lost 0, raiders killed 0); warships lost total 2
  second order: overall hit; a5 beaten (econ lost 0, warships lost 2, raiders killed 6) | a6 hit (econ lost 2, warships lost 0, raiders killed 0); warships lost total 2
- a5 4 (1L3F): overall hit; a5 beaten (econ lost 0, warships lost 2, raiders killed 6) | a6 hit (econ lost 2, warships lost 0, raiders killed 0); warships lost total 2
  second order: overall hit; a5 beaten (econ lost 0, warships lost 2, raiders killed 6) | a6 hit (econ lost 2, warships lost 0, raiders killed 0); warships lost total 2
- a5 6 (2L4F) matched: overall hit; a5 beaten (econ lost 0, warships lost 1, raiders killed 6) | a6 hit (econ lost 2, warships lost 0, raiders killed 0); warships lost total 1
  second order: overall hit; a5 beaten (econ lost 0, warships lost 1, raiders killed 6) | a6 hit (econ lost 2, warships lost 0, raiders killed 0); warships lost total 1
- both 3 (1L2F): overall beaten; a5 beaten (econ lost 0, warships lost 2, raiders killed 6) | a6 beaten (econ lost 0, warships lost 2, raiders killed 6); warships lost total 4
  second order: overall beaten; a5 beaten (econ lost 0, warships lost 2, raiders killed 6) | a6 beaten (econ lost 0, warships lost 2, raiders killed 6); warships lost total 4
- both 6 (2L4F): overall beaten; a5 beaten (econ lost 0, warships lost 1, raiders killed 6) | a6 beaten (econ lost 0, warships lost 1, raiders killed 6); warships lost total 2
  second order: overall beaten; a5 beaten (econ lost 0, warships lost 1, raiders killed 6) | a6 beaten (econ lost 0, warships lost 1, raiders killed 6); warships lost total 2
- a5 12 (4L8F) concentrated: overall hit; a5 beaten (econ lost 0, warships lost 0, raiders killed 6) | a6 hit (econ lost 2, warships lost 0, raiders killed 0); warships lost total 0
  second order: overall hit; a5 beaten (econ lost 0, warships lost 0, raiders killed 6) | a6 hit (econ lost 2, warships lost 0, raiders killed 0); warships lost total 0
```

## Targets on v15 ("Calibration targets (H9)")

| # | Target | v15 | Met |
| --- | --- | --- | --- |
| 1 | adaptive meets at least 2 two-prong raids | 0 finished (`byProng {"1":5}`). Its one split raid launches at 28320, as its winning wave leaves (h9-bots report) | **missed** |
| 2 | each undefended prong kills ≥ 2 economy ships | a5 3, a6 2 | met |
| 3 | a guard under half its prong loses, then the prong hits; a matched guard wins losing ≤ 2 | 2 against 6 (1L1F or 0L2F): beaten, a5 hit for 3. 6 (2L4F): wins, loses 1. Half (3, 1L2F): wins, loses 2. The same in both orders | met |
| 4 | concentrate loses ≥ 2 more economy ships than adaptive | 7 against 6 (+1), same win time | **missed** |
| 5a | greedy ≥ 10% slower than adaptive | 20:33 against 15:54 (+29%) | met |
| 5b | undefended ≥ 10% slower than adaptive, or doesn't win | 12:03 (−24%) | **missed** |
| 6 | pace (adaptive 15–30, greedy ≤ 40); first raid at 2–6 min | 15:54, 20:33; 2:42 | met |
| H8 | staffing: at most 1 idle hauler outside raids; nothing backed up with its target met | adaptive peak 1, 0 min over 1; none backed up | met |
| flags 1–7 | | all MET (`reports/archive/h9-bots-v15.md`) | met |

## The one candidate: `raid.prongMinSize` 3 (in range 2–12)

From the sweep (`min3`) and the full suite (`h9-design-data-min3-bots.md`):
- **Target 1 met:** adaptive meets 4 two-prong raids, the first at 7:53.
- **Target 4 as worded: still missed.** Concentrate loses 6 economy ships against adaptive's 5. On time it is 27% slower (23:13 against 18:20).
- **Target 5:** the greedy half goes from met to **missed**: greedy finishes at 18:18, 2 s ahead of adaptive's 18:20. The undefended half is still missed (13:09, −28%).
- **Pace:** adaptive 18:20, inside 15–30.
- **Flags 1–7:** all MET. Staffing: adaptive idle peak 1, 0 min over 1.
- **Guard triggers.** Both apply, so the value isn't committed:
  - adaptive moves from 15:54 to 18:20 (+15%);
  - greedy now finishes ahead of adaptive, a change in strategy order.

`raid.prongMinSize` 2 gives the same adaptive run (18:20). `raid.prongsMax` 3 with min 2 moves adaptive to 23:25 (+47%).

## Target 5b: no in-range value found. This is a rule finding

Every lever tried that makes raids hurt more (`raid.econPerRaider` 1, `raid.gapTicks` 2400, `raid.hiveKeepPct` 35, `ship.extractor.hp` 4, `ship.extractor.cost` 30 or 40) slowed adaptive by as much as or more than undefended. Undefended was 8% to 65% faster than adaptive in every variant (8% only at `raid.gapTicks` 5400). Lowering `raid.gapTicks`, raising `ship.extractor.cost` and lowering `ship.extractor.hp` don't speed any refill, so they're allowed under "No faster refill". None was enough. The reasons, from the outputs above:
1. **Defending doesn't save economy ships in the bots.** Undefended loses 5 over the run on v15, adaptive 6. A prong kills at most the extractors docked at its rock (2–3), because haulers hold (H10) and the prong leaves once no player ship is left.
2. **The trade per prong is about even in ore.** A matched guard loses 1–2 warships (18 ore each) to save 2–3 extractors (20 ore each). Defending costs build time and slots that offence would use.
3. **Raids open the hive** (flag 4: the best mix drops from 16 to 11 with a full raid out). A player who never defends gets more windows with warships free to use them.
4. **Raids stay small for a lean economy** (pillar 4 as intended). Undefended's economy peaks at 12–14, so its raids rarely split.

## For the Director

1. **Target 1 and `raid.prongMinSize` 3.** It meets target 1 but trips both guard triggers (adaptive +15%; greedy 2 s ahead). Options:
   - (a) ship 3, accepting the slower adaptive and reading "greedy ≈ adaptive" as the order change it is;
   - (b) keep 4, and reword target 1 to "at least one two-prong raid is fought before the win, in adaptive's or greedy's run". On v15 greedy meets 2 (first split at 13:00).
2. **Target 4: reword proposed.** "`adaptive-concentrate` loses at least 2 more economy ships than `adaptive`, **or** finishes at least 10% slower." Concentrating costs time rather than ships, because a concentrated guard does save its own rock (fights: 12 at a5 wins with no losses, and a6 loses 2). With min 3 the time half is met (+27%); on v15 neither half is.
3. **Target 5b is a rule finding, not a value.** No in-range value makes ignoring raids at least 10% slower. If the Director wants it met, it needs a rule change. Candidates, for the Director or the owner (not proposed here as H9 scope):
   - a hit prong moves on to the next mined rock instead of going home;
   - a hit steals the rock's buffer, or the probe's stock;
   - a raid window that shrinks the hive less.

   Otherwise, reword it to report only: "undefended is reported; the claim it tests is left to the owner's session".
