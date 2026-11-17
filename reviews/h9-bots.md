# h9-bots review

## Round 1 · 2026-11-16

I reviewed 9d552d8 (`git diff task/h9-raids...task/h9-bots`: bf3a5ad, 481d666 and 9d552d8, plus merges). The branch carries h9-sim's approval (12924fa), h9-raids' approval (a34be08) and cw-bots-gate-time (436d64e). I checked it against DESIGN.md "Bots (H9)", its no-plan-fits table, "Calibration targets (H9)" and the BACKLOG h9-bots acceptance.

**Gates (run by me on 9d552d8, `npm run gates -- --base main`): all PASS.**
- typecheck, lint and protected-files (42 files, none protected).
- test: 56 files, 1193 tests.
- determinism: final 9a2e957c.
- bots: adaptive 20:46 and greedy 20:41, with flags 1–7 MET.

The two H9 report lines are MISSED. They are report lines, not gates, so that is allowed here.

**Bots gate time.** I re-ran `npm run bots` on its own, because my gates run overlapped my trace scripts: 69.6 s, against 55.0 s on h9-raids.
- The static sweep is unchanged (about 32 s).
- The two new strategies cost about 4.9 s.
- Most of the other +10 s comes from adaptive and greedy now playing about 5 game minutes longer. That is a behaviour change, not code cost (see the trace below).
- Against the "no more than the new strategies' cost" rule, the excess comes from longer games, so I'm not making it a required change. The engineer's figure of 64.3 s understates it, though.

**What's good.**
- `place` generalises H8's `regroup` cleanly. With one post it is `regroup`, and the `raid.prongsMax` 1 equivalence is pinned by hash for adaptive, greedy and drones-only on both the stub sim and the real-prong sim.
- Change 1 has a unit test for each part on a two-prong world:
  - production;
  - largest first, with guards already at a target counted;
  - the `ceil(goal / 2)` floor;
  - ties to prong 0;
  - the rally to the neediest post;
  - the standing guard at half of each prong;
  - following a W5 retarget;
  - a done or homebound prong not answered;
  - the hive wave leaving from every post;
  - a wipe.
- `adaptive-concentrate` and `undefended` are registered as controls (`expectedWin: false`), with descriptions and a test of what each doesn't do.
- The report adds the prong table, the H9 lines and the expanded "What no bot exercises".
- The `raidView` test seam is narrow and production never sets it.

**Defect 1: the shield metric is no longer exact in two-prong raids.** `econLostGuarded` now counts a loss only in a tick that began with a warship at the target of **every** live prong.
- The h8-bots rule this metric enforces is "economy ships lost while a warship stood at the target … must be 0", asserted exactly.
- In a two-prong raid, adaptive by design often covers only the larger prong. In those ticks the metric counts nothing, so a shield failure at the guarded rock would go unseen exactly when the split matters.
- DECISIONS.md says "losses are not attributed per prong", but they are: every `Prong` carries its own `lostEcon` (h9-raids). A prong that finishes during the step is in `world.lastRaid.prongs` in the same order.

**Finding 2: adaptive's slowdown from 15:53 to 20:46 is one failed raid-window hive attack, not a measure of defending a split.** I traced seed 1 (scratch script, deleted; every seed gives the same run):
- At tick 28320, raid 6 (two prongs, a5 and p1) launches. Both `adaptive` and `adaptive-concentrate` send the same 5-Lancer, 8-Flak hive wave in the raid window.
- Concentrate's 13 ships stood at a5, so its wave reaches the hive at about 28440 and takes it at 28590.
- Adaptive's 13 stood at p1, its standing post from the previous raid, so its wave arrives about 60 ticks later.
- By then the a5 prong had found no player ship and turned for home. Its 5 raiders rejoin the hive mid-battle (hive guards 2 → 4 → 6 → 7), and adaptive loses all 13 warships.
- It then rebuilds for about 9000 ticks and wins at 37380.

So targets 4 and 5 on v15 currently measure one timing event: where the standing guard happened to be, and a prong that turns back at once reinforcing the hive. They don't measure what splitting the defence costs or saves. h9-design-data must not calibrate values around this unexplained.

The bot's raid-window attack (H7/H8 step 1) assumes raiders away stay away. Under H9, a prong aimed at an empty rock comes straight back. Whether the bot should account for that is a bot-rule question for the Director, not something to fix silently here.

**Accepted with reasons:**
- **The staffing bound loosened from 0 to under 0.25 min (adaptive: 0.07 min, once).** A two-prong hit kills extractors on two rocks at once. The need then drops, and the surplus haulers idle at the probe until the extractors are rebuilt. That is H8's H3/H4 working as specified, not a sim defect. Whether it breaks the H8 calibration target "at most 1 idle hauler outside raids" is h9-design-data's call to make and report.
- **The raid record's `planned` is the sum over prongs** (`world.raid.planned` is now prong 0's).

**Required changes:**
1. **Make the shield metric exact per prong.**
   - Before `step`, record for each live prong whether a warship stands at its target, and its `lostEcon` total.
   - After `step`, add the increase in `lostEcon` of each prong that was guarded at tick start. Read the prong from `world.raid`, or from `world.lastRaid.prongs` at the same index if the raid ended during the step.
   - Keep the whole-run assertion at exactly 0.
   - Add a unit test on a two-prong world: a loss at the unguarded prong's rock doesn't count, and a loss at the guarded prong's rock (forced, for example with `raid.shieldEcon` 0) does.
2. **Record the cause of adaptive's 15:53 → 20:46 in DECISIONS.md and in the archived report's H9 section**, as traced above (or as you trace it, if you find otherwise). Say plainly that targets 4 and 5 on v15 hinge on that one event. Flag the bot-rule question (the raid-window attack with a prong that will turn back at once) for the Director.
3. **Re-run the bots** and report the gate time measured on its own, with the breakdown: new strategies, versus longer winner games.

VERDICT: REJECT

## Round 2 · 2026-11-16

I reviewed 6f1aa47 against round 1, with the Director's ruling on the raid-window hive wave (STATUS.md, resend brief), which DECISIONS.md now records with the trace.

**Gates (run by me on 6f1aa47, `npm run gates -- --base main`, nothing else running): all PASS.**
- typecheck, lint and protected-files (46 files, none protected).
- test: 57 files, 1204 tests.
- determinism: final 9a2e957c. Unchanged, which is right: the bots add no sim state or inputs.
- bots: 66.1 s of runs, with adaptive at 15:54 and greedy at 20:33. Flags 1–7 MET.

The two H9 report lines are still MISSED: target 4, and target 5's `undefended` half. They are report lines, so that is allowed here.

**Required change 1 (the exact shield metric): met.**
- `ShieldMeter` records, before each step, whether each live prong's rock has a warship and the prong's own `lostEcon`.
- After the step, it adds the increase only for the prongs that were guarded. If the raid ended during the step, it reads the prong from `lastRaid.prongs` at the same index, checking the raid id.
- The unit tests cover four cases: a loss at the guarded prong counts (the round-1 metric read 0 there), a loss at the unguarded prong doesn't, a mixed tick counts only the guarded part, and a raid that ends in the step.
- Whole-run assertions at exactly 0 hold for adaptive and greedy (h8-bots), and for adaptive again in the new file.

**Required change 2 (the cause, and the ruling): met.** DECISIONS.md records my trace as confirmed and the Director's rule: in a raid with two or more prongs, a live prong counts as away only if the wave takes the hive before that prong's earliest return. The implementation (`hiveAtLanding`, `hiveWave`, `windowHome`):
- sizes the wave against the prongs that could come back;
- treats a prong pinned by a warship outside the wave as committed;
- holds a wave whose arrivals would spread over more than a round, instead of sending it piecemeal;
- with one prong or no raid, is H8's rule. The `raid.prongsMax` 1 hash pins in h9-bots.test.ts were re-run and are green.

The bot-level test shows a two-rock wave leaving only from the rock that arrives in time.

The results now make sense: adaptive 15:54 (was 20:46), concentrate 15:54, greedy 20:33 (+29%, target 5's greedy half met), undefended 12:03 (−24%, missed). DECISIONS.md and the archived report say plainly not to calibrate around the old 20:46.

**Required change 3 (gate time): met.** The engineer measured 66.5 s alone and I measured 66.1 s of runs. The breakdown is honest: the two new strategies cost about 4.8 s, and the rest of the growth over h9-raids' 55.0 s is longer winner games plus the rule's battle estimates.

**Notes, not required:**
- In "a wave built from two rocks … is held", the second assertion, `expect(near.from).toEqual(near.ok ? [a5] : near.from)`, repeats the same call as `both`, and it is tautological when `ok` is false. The bot-level test that follows proves the behaviour, so tighten or drop this assertion when convenient.
- `field-strategies.ts` defines its own `ceilDiv`. It is fine on integers and consistent with the sim's.

**For the Director and h9-design-data:**
- **Target 4 can't show a difference on v15 as things stand.** Adaptive and concentrate play the same game until a split raid is actually fought, and adaptive meets its only split raid at minute 15.5, just before it wins. Its losses are 6 against concentrate's 7. Calibration has to make splits come earlier (target 1), or the target needs the Director's reword option.
- **The greedy wave loss is still open.** Greedy loses one full-strength wave at tick 28412, sent with no raid out, and the new rule doesn't cover that case.
- **The staffing bound** (accepted in round 1) remains for h9-design-data to judge against H8's staffing target.

Required changes: none.

VERDICT: APPROVE
