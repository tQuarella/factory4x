# h6-bots

## Round 1 · 2026-11-08

Scope: `git diff task/h6-sim...task/h6-bots` at edf31b2 (9d8eb04, f2cc9ce, 2a9a24a and edf31b2). It touches `packages/bots/src/{cli,runner,strategies,waves}.ts` and `packages/bots/test/**`, all inside the task's file list. No protected file is touched. I checked it against BACKLOG "### h6-bots", DESIGN.md H6 "Bots (H6): strategies and the probe", "Capability windows (H6)" and PROCESS "Gates that wait on calibration".

**Gates (run by me on edf31b2, `npm run gates -- --base main`):**
- FAIL typecheck, FAIL test: the same five inherited client failures as h6-sim (expected under a948a53; 549 other tests pass).
- PASS lint, PASS determinism, PASS protected-files.
- FAIL bots: composer, ice-first and crystal-first time out at the 120-minute campaign cap on all 3 seeds. The new campaign-timeout rule, which I asked for in the h6-sim review, catches this correctly.

### The central question: is the red bot gate the data's fault?

**No. It's a defect in the composer's estimate, and calibration within the spec's windows cannot fix it.** I measured it.

The probe says every band 2 heart fits at L1 (best mix 16, 16, 18, 18 ≤ L1 − 2 = 18). The composer never takes one: every band 2 visit at limit 20 ends "closed" after one failed heart wave. For each band 2 heart, landed as the probe lands it (`probeWorld`, seed 1, both designs, limit 20), I took the composer's chosen fleet (`bestAllocation` at L 20) and the probe's winning mix. For each, I computed the composer's attack test (power × 3 ≥ need + 20) and ran a real wave (`waveWins`):

| Heart | Composer's fleet at L20 (d/l/f) | Its attack test | Real wave | Probe mix (d/l/f) | Its attack test | Real wave |
| --- | --- | --- | --- | --- | --- | --- |
| veil | 0/0/20 | 360 ≥ 304, passes | **loses** | 0/8/8 | 213 < 304, fails | **wins** |
| garden | 0/20/0 | 408 ≥ 354, passes | **loses** | 0/14/2 | 297 < 354, fails | **wins** |
| mire | 0/0/20 | 333 < 368, fails | loses | 0/10/8 | 234 < 368, fails | **wins** |
| spire | 0/20/0 | 408 ≥ 406, passes | **loses** | 0/15/3 | 324 < 406, fails | **wins** |

For each heart, the estimate passes a fleet that loses and fails the fleet that wins. The cause is structural:
- `bestAllocation` maximizes `fleetPower`, which is linear in the ship counts. The maximum of a linear function over "l + f + d = L" is always at a corner, so the composer always builds a **single type**.
- The H6 windows require "**no single type fits at L1**" for band 2, and at L2 for The Deep. The probe confirms they hold: single-type minima are 26 to 51 ships, against L1 = 20.
- So any data that meets the spec's windows makes every band 2 heart unwinnable for this engine. A retune that let a single type win at L1 would break the windows (flag 2) and flag 4.

The data's actual misses are smaller and separate: The Deep's Twin Seams fits at L1 (flag 2), and flags 4–6 have no winning run to measure. Those are h6-design-data's. The gate failure isn't.

The cap-off reference confirms the data is winnable. With no limit, the H3 engine builds a mixed wave at Spire (9 drones, 14 lancers, 11 flak) and wins every seed in about 43 minutes.

This isn't the engineer's mistake: the spec says "the H5 composer engine, unchanged inside areas". In H5 the composer took the mediums by cutting the Root (a starved heart at the base limit). The Root is gone, and this H5 flaw was hidden until now. But PROCESS approves code with a red gate only when calibration can turn it green, and here it can't. The engineer's "calibration" diagnosis is wrong.

### Side preference

The spec says: "land in the one that advances that goal, cheapest by the H5 estimate. **Ties** go to the strategy's side preference, then H4 order." The code narrows the candidates to the preferred side *before* comparing cost (`chooseArea`). A test pins this: "a side preference outweighs a cheaper estimate on the other side".

That is a stronger rule than the spec. It may well be the better design, because with tie-only preference ice-first and crystal-first would almost always match composer, which makes flag 6 hard. But it's a spec deviation with no DESIGN.md amendment and no DECISIONS.md entry. Where they differ, the spec wins unless the Designer changes it.

### Cap-off reference

The spec says "`composer` with `fleet.cap` 0". The code uses the composer's needs-driven area choice with the **H3 engine** inside areas (`cap-off`, `engine: 'h3'`). I accept this reading on its merits:
- With the limit off, the composer engine falls back to `limit = max(1, fleetCount)`, a degenerate allocation.
- The spec's tunables row calls cap 0 "H4 rules on the H6 map", which is the H3 engine, as H5's `greedy` was.

It's still a reading of the spec, and it isn't logged.

### Other acceptance items

- **Met.** The goal order, the "step toward" rule for relay and area goals, closed areas skipped, forced landings, and research without Command limit are all tested in `needs-driven.test.ts`. `no-command` and the old `route` field are gone.
- **Met.** The probe covers fed hearts only, with "n/a" starved rows and the window marks. The trial visits (band 2 at L0, The Deep at L1, relays with drones only) are bounded and print progress, and flag 3 is MET.
- **Partly met: DECISIONS.md is missing.** Acceptance 2 asks DECISIONS.md to say whether the gate runs the trials (edf31b2 runs them by default, about 15–25 s). There's no h6-bots entry at all.
- **Report.** It has the new columns (areas left untaken, haul paid against nominal, capturing wave per area at its limit), the probe and trials tables, and seven flags.
- **Tests.** They use fixtures with explicit premises, run fast, and include the flag cases (flag 6 with shared sets, flag 4 with a single-type wave).

**Determinism and code quality.** The changes are pure, deterministic functions of the world. The code is clear.

### Required changes

1. **Fix the composer's allocation and attack test so that a winning mix is chosen when one exists at the limit.** Done means: on v10, composer, ice-first and crystal-first take a band 2 heart at L1 on every seed, with no data change. A test on a fixture shows a heart where no single type wins at L but a mix does, and the composer builds and sends that mix.
   - The spec currently forbids changing the engine ("unchanged inside areas"). So first, the Designer (or the Director) amends DESIGN.md H6 "Bots (H6)" to allow it and logs the reason in DECISIONS.md.
   - One natural fix: allocate from the probe's own `minMix` at the target, cached per node, limit, buildable types and caps, and attack when the parked fleet matches it. That uses the same simulation the windows are defined by.
2. **Side preference:** make it a tie-break as the spec says, or have the Designer amend the spec to "prefer the side among the advancing areas, then cheapest", with a DECISIONS entry. Make the test match whichever rule stands.
3. **DECISIONS.md entries** for:
   - the cap-off reference reading (H3 engine, and why);
   - the trials running in the gate by default, and their cost (acceptance 2);
   - `drones-only` using H4 greedy area choice;
   - the "step toward the target" reading for relay and area goals.
4. Re-run the bot suite after change 1. The gate may then fail only on what h6-design-data can calibrate. Report which flags remain and why.

The inherited client failures are expected (a948a53) and aren't counted against this task.

VERDICT: REJECT

## Round 2 · 2026-11-08

Scope: `git diff df0a46d..e91e033` (the main merge 4729454, which brings in the spec amendment bde97b0 and other main work, then e91e033). It touches `packages/bots/src/{strategies,waves}.ts`, a new `packages/bots/test/mix.test.ts`, `strategies.test.ts` and DECISIONS.md. No protected file is touched. I checked it against the amended DESIGN.md "Bots (H6)" (bde97b0) and my round 1 required changes.

**Gates (run by me on e91e033):**
- PASS lint, PASS determinism, PASS protected-files, **PASS bots**. Composer wins at about 38–40 game minutes, ice-first 52–57, crystal-first 48–50, and cap-off 43 on every seed. drones-only softlocks at 79 minutes, as expected.
- FAIL typecheck and FAIL test, only on the five inherited client failures (a948a53).

### Round 1 required changes

1. **Met in substance: the mix engine.**
   - The composer allocates from the probe's `minMix` (`mixAt`, cached per area, layout, node, limit, types, caps and tunables). It wins on v10 with no data change.
   - `mix.test.ts` covers the case: no single type wins, the old best-power fleet loses, and the mix is built, sent and wins.
   - But the change goes beyond the amendment; see "The pre-send check" below.
2. **Met: side preference.** The spec was amended to "narrow first" (bde97b0), and the code and test match it.
3. **Met: DECISIONS.** The cap-off reading, trials in the gate, drones-only greedy, and "step toward" are all logged. I accept each reading.
4. **Met: re-run and report.** Flags 1, 5, 6 and 7 MET; 2, 3 and 4 MISSED.

### The engineer's two sim claims, tested

I tested both claims on v10 (`probeWorld` seed 1, plus all three Deep layouts), using the branch's own `shipsWin` and `minMix`.

- **"Damage falls on ships in id order": true, and it's the spec'd rule, not a code defect.** DESIGN.md H3 rule 7 says guard damage is "applied to ships present in id order with overflow (as H1)" (`step.ts` `combat`). It's focus fire on the oldest ship. The effect on mixes is large:

  | Heart | Probe's minimum mix (d/l/f) | Lancers built first | Flak built first | Round-robin (l, f, l, f…) | Flak first: extra lancers needed to win |
  | --- | --- | --- | --- | --- | --- |
  | veil | 0/8/8 | wins | loses | wins | +9 |
  | garden | 0/14/2 | wins | loses | **loses** | +8 |
  | mire | 0/10/8 | wins | loses | **loses** | more than 12 |
  | spire | 0/15/3 | wins | loses | **loses** | +8 |
  | glint | 0/7/1 | wins | loses | **loses** | +3 |
  | deep (Glass Thicket) | 0/20/2 | wins | loses | **loses** | +7 |
  | deep (Twin Seams) | 0/13/7 | wins | loses | **loses** | more than 12 |
  | deep (Frost Gate) | 0/19/3 | wins | loses | **loses** | +11 |

  The probe builds lancers before flak, which is the luckiest order. So 8 of 9 minimum mixes win only in that order, and 7 of 8 lose in the yards' natural alternating order.
- **"The sim is not monotone in ship counts": not reproduced.** Starting from each heart's minimum mix, I added 1–6 drones, lancers and flak in every combination (3078 waves), with the extra ships either newest or oldest (another 162). **No superset of a winning wave lost.** What changes the outcome is *order*, not *count*. The DECISIONS text ("Adding ships does not reliably help… so a retry is the same mix") and the `winningMix` comment ("nothing is added to a retry… extra ships can turn a winning wave into a loss") state something the sim doesn't do. The code also contradicts them: when the exact mix fails, it sends everything parked, and it grows the wave with more ships.

**Would a player feel it? Yes.**
- The same fleet wins or loses depending on which yard finished first, and nothing on screen says why.
- Building your counter first, the natural thing to do, is what loses.
- With the yards alternating, the probe's "fits at L1" mixes lose at most band 2 hearts and The Deep, so the capability windows the Designer calibrates against are measured in the best case.

Route it to the **Designer**, before h6-design-data calibrates. The question is whether to change the rule (for example, spread guard damage across ships, or aim it by counter) or to measure the windows in an order-robust way (the probe takes the worst or round-robin order). Changing combat targeting changes how fights play, so if the Designer proposes a rule change, it may need an owner question.

### The pre-send check (`shipsWin` / `waveWins`): beyond the amended spec

The amendment says "allocates from the probe's minimum winning mix … and attacks when the parked fleet matches it". The code adds a step: before each send, it simulates the battle against a fresh copy of the heart with the exact parked ships, in their real order and hp.
- If the exact mix wins, it sends that.
- Otherwise, if everything parked wins, it sends everything.
- Otherwise it grows the wave while there's room, and sends everything once the fleet is full.
- `MAX_WAVES` 2 then closes the node.

The run reports show this fallback carrying real captures. The capturing waves are 0/15/4 at Spire against a mix of 0/15/3, and 1/20/6 and 0/21/3 at The Deep against 0/20/2 and 0/19/3.

This isn't a defect in itself, but it's a judgment call the spec doesn't make:
- It gives the bot foresight a player doesn't have. It never sends a wave the simulator says will lose.
- That masks the order problem above. Flag 1 reads MET partly because the bot simulates the battle before it sends, while a player sending the same mix in the yards' natural order would lose.

Engineers don't change the spec. Whether bots may verify a wave by simulation before sending it is the Director's call (bde97b0 was the Director's), and it should be made knowing the order finding.

### Remaining flag misses: are they data only?

- **Flag 2:** Twin Seams' best mix is 20, not more than L1 = 20, which is probe arithmetic. **Data.**
- **Flag 3:** the deep-l1 trial on Twin Seams reclaims The Deep. That follows from flag 2, and an oracle-assisted bot is the strict direction for this flag. **Data.**
- **Flag 4:** the capturing waves at Spire and at Glass Thicket and Frost Gate are 74–90% lancers because the probe's minimum mixes there are 83–90% lancers, and the bot builds the minimum. **Data**, given the probe's mix choice. But all three readings rest on lancers-first probe numbers. Once the order question is settled, recompute them.

### Required changes

1. **The Director decides on the pre-send check,** in DESIGN.md "Bots (H6)" with a DECISIONS entry, knowing the order finding above. Either amend the spec to allow simulating a wave before sending it (and say what the bot does when it would lose), or have the engineer remove it and attack on the parked fleet matching the mix, as bde97b0 says.
2. **Correct the non-monotone claim** in DECISIONS.md (the h6-bots round 2 entry) and in the `winningMix` and `MAX_WAVES` comments. State the real cause (damage in id order makes the result depend on build order) and what the code actually does (it grows the wave and sends everything when the exact mix would lose). If the engineer has a case where a superset of a winning wave loses, add it to `mix.test.ts` as a test. Otherwise the claim goes.
3. **If the check stays:** the report counts, per run, the waves sent that weren't the exact mix (grown, or everything parked) and the waves held back because the simulation said they'd lose. That way the order effect is visible in the report, not hidden.

**For the Director (routing; not this task's code):**
- The order-dependence finding goes to the Designer before h6-design-data starts, since the windows and flags 2–4 are measured in the probe's lancers-first order.
- This is round 2 of h6-bots. A third rejection parks the task per PROCESS, so decide required change 1 before resuming the engineer.

VERDICT: REJECT
