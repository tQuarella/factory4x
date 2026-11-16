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
