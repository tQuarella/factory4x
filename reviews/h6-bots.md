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
