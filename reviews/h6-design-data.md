# h6-design-data

## Round 1 · 2026-11-08

Scope: `git diff 4ec2c71..aee4724` (one commit). It touches `data/sim.json`, DESIGN.md, DECISIONS.md, `packages/sim/test/data-h6.test.ts` (the version pin, plus the lane-count pin from 14 to 16, a scope widening the Director accepted), and the archived reports `h6-probe-v10.*`, `h6-design-data-v11.*` and `h6-design-data-v11-tags.md`. No protected file is touched. The branch is stacked on task/h6-bots 4ec2c71, whose last verdict is APPROVE, so acceptance 5 is met. I checked it against BACKLOG "### h6-design-data", DESIGN.md H6 "Capability windows (H6)", "Calibration" (including step 5, after the combat amendment) and "Bots (H6)" flags.

**Gates (run by me on aee4724):**
- PASS lint, PASS determinism (30 checkpoints, final 59901e2a), PASS protected-files.
- **PASS bots, with every gated strategy winning every seed:** composer 46:16–46:37, ice-first 55:44–61:41, crystal-first 52:13–58:10, cap-off 42:32–42:57. drones-only softlocks at 79:10, which is reported only.
- FAIL typecheck and FAIL test, on the expected inherited client failures (a948a53): the `h5-client.test.ts` TS error, plus 13 tests.
  - 4 in `h4-client.test.ts`, the same four as h6-sim.
  - 9 in `h5-client.test.ts`. That file now loads on v11, and its H5 Command-limit, Root-hint and H5-tuning-label tests fail.
  - Every one of them pins an H5 mechanic that H6 removed, or the six-area map. h6-client is rewriting both files. 610 other tests pass, including `data-h6.test.ts` against the updated H6 tables and the reference replay's premises on v11.

**Acceptance:**
1. **Met in substance: the probe on v10.**
   - `reports/archive/h6-probe-v10.{md,json}` is the full suite on data v10 at 4ec2c71, so it includes the combat amendment and no pre-amendment number is reused. That's DESIGN "Calibration" step 5.
   - It landed in the same commit as the retune rather than in a commit of its own, so "first" holds in method, not in history. I don't count that against it, because the report is clearly from unmodified v10 (its header says data version 10).
2. **Met: the retune, in priority order, with reasoning in DECISIONS.**
   - Flags 2 and 3 are fixed at their sources. Spire's heart 16/11 → 12/9 makes its best mix 21 → 16. Twin Seams' heart 10/34 → 12/42 makes it 19 → 23, which also fixes the seed 2 Deep trial.
   - Edge cases are moved one to two slots inside their windows. Each change has a stated reason in the DESIGN table.
   - The haul invariant is untouched, since no haul, export or research value changed.
   - The v11 probe meets every window cell, and every best mix has both counters at 30% or more.
3. **Met: version, pins, tables, stale statements.**
   - `dataVersion` is 11, the pin and its title are updated, and the H6 "Areas" and "Area guards" tables match the data (`data-h6.test.ts` enforces this).
   - The lane list and its count are updated, the diagram is redrawn with a "schematic" note, and dated notes were added under the H4 table and the H3 layout tables.
   - My grep found no remaining "14 lanes" or v10 relay coordinates outside the change table.
   - The Deep pocket cells left unchanged in the H3 layout tables (p3/p4 28/31/22 and 34/20/44) are labelled "predate the amendment". They do in fact equal the v11 values in `h6-design-data-v11-tags.md`, as single-type minima must, so they aren't stale.
4. **Met: re-run, report and flags.** `h6-design-data-v11.md` has all seven H6 flags MET, and my gate run reproduces that. The "What the bots don't exercise, candidly" section names the gaps:
   - no winner takes a medium, so flag 6 holds at its minimum of two sets per seed;
   - the mediums pay only grind resources;
   - the bots never meet a band lock.

   The only out-of-scope item, the lane-count pin, was raised as a blocker and accepted by the Director before this review.
5. **Met: the h6-bots approving review (4ec2c71) is in the branch.**

**Lanes and positions (beyond guards).** The task's "values only" covers data values, and the Director had already offered "add lanes that make the lock matter" (DECISIONS, a948a53).
- `shelf–veil` and `shoal–garden` make each medium a visible, locked neighbour of a light area. That serves the claim directly ("opens a region you could already see"), and it makes `overworld.bandLock` 0 a real comparison.
- Moving the relays inward also fixes a v10 flaw: `rime–mire` and `glint–spire` ran straight through Spore Veil and Thorn Garden.
- I accept the change.

**Tags.** 70 of 70 read true by the H3 rule on v11 (`h6-design-data-v11-tags.md`, script included). Twin Seams' heart still reads Even/Even, which is true by the rule but gives no guidance in that final fight. This is the existing Designer follow-up, unchanged.

**Pillars and vision.** The changes stay inside the H6 spec's levers plus the Director-sanctioned lanes, and no rule changes. "Wounded arrivals" (every winning run is repelled 1–4 times) is handled by margin in the windows rather than a model, and the handoff will tell the owner. That's a reasonable call, and the owner can judge it in play.

**Non-blocking notes:**
- **Phone spacing, for h6-client to verify:** Rime and Glint are now 200 su apart (400/1270 and 600/1270). At 375 px wide that's about 75 px between centres, with 30 px node radii and two "… Relay" labels about 65 px wide. Check the labels at 375x667 under the wide-font stress before the handoff. If they collide, the fix is a position change here.
- Twin Seams' heart Even/Even and the medium-taking gap are fun questions for the owner, already written up for the handoff.

Required changes: none.

VERDICT: APPROVE
