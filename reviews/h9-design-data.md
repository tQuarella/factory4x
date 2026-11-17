# h9-design-data review

## Round 1 · 2026-11-16

I reviewed c6794bb (`git diff task/h9-bots...task/h9-design-data`: bbee93f, 0a2ec0b and c6794bb). The branch carries h9-bots' approving review (be6ede0). I checked it against DESIGN.md "Calibration targets (H9)", the "No faster refill" note, the designer.md guard, and the BACKLOG h9-design-data acceptance.

**What the branch does.**
- It probes v15 and sweeps 16 variants. No value meets target 1 without moving adaptive by more than 10%, so per the guard it reports to the Director rather than committing.
- It then applies the Director's rulings, recorded in DECISIONS.md "Director: h9-design-data rulings":
  - `raid.prongMinSize` 4 → 3, as data v16;
  - target 4 reworded to "2 more ships lost, **or** at least 10% slower";
  - target 5 (5a greedy, 5b undefended) made report-only for H9, with the rule options recorded as "H10 candidates" and a fourth fun question for the owner.

**Gates (run by me on c6794bb, `npm run gates -- --base main`): all PASS.**
- typecheck, lint and protected-files (54 files, none protected).
- test: 57 files, 1204 tests.
- determinism: final a8f4c2ff, changed with the data.
- bots: data v16. adaptive 18:20, greedy 18:18, adaptive-concentrate 23:13, undefended 13:09. Flags 1–7 MET, H9 target 4 MET, and 5a and 5b REPORTED.

**Acceptance.**
1. **Probe first: met.** bbee93f holds the v15 probe and sweep, with no value shipped.
2. **Values only, under the guard: met.** The one value change was routed to the Director before it was committed, because it moves adaptive +15% and puts greedy level with it. "No faster refill" is respected: no regrowth, repair, warship build time or warship cost was moved, in any variant or in the shipped value.
3. **v16 and the derived claims: met.**
   - The pin is 16.
   - The H9 Tunables table and its heading are updated, and data-h9.test.ts reads the table.
   - The walk of `prongMinSize` 3 covers the opening (the first raid, of 3 raiders, is still 1 prong at 2:42), every phase, the limits and the siblings.
   - The per-prong fights are unchanged, because a raid of 12 still splits 6 and 6.
4. **Fights and min-waves in a second order: met** (`h9-design-data-v15-fights.mts`, in the v15 report). The results are identical.
5. **Suite and gates: met.** The bots gate is green here, as required. The table in DESIGN.md "Calibration result (h9-design-data, data v16)" shows every target with its v15 and v16 values, and says what no bot exercises.
6. **h9-bots' approval merged: met.**

**Edits outside the Designer's files.** DECISIONS.md says the Director authorised them in the brief:
- reference-replay "H9 (n)": the literal pin moves from 4 to 3, and the check is unchanged;
- the bots' H9 report lines, implementing the reworded target 4 and the REPORTED status for 5a and 5b. Bot behaviour is unchanged, and the report test covers both halves of target 4 and both reported lines.

Both are the minimum the rulings require. I accept them.

**Judgment.** Shipping `prongMinSize` 3 is right. On v15 adaptive never finished a split raid, so the build couldn't test H9's claim at all. v16 gives it 4, the first at 7:53.

But the owner must hear this plainly. **The bots predict H9's own disproof condition.** The claim says it is disproved if "ignoring raids costs under 10% of the run". On v16, `undefended` takes the hive 28% *faster* than `adaptive`, and it was faster in all 16 variants tried. The Director made this a reported finding and a fun question rather than a target. That is a legitimate call: it is a rule question, and the H10 candidates record the options. But it is the most important thing the owner should know before playing.

**Director:** in the handoff, put this up front, next to the owner's attrition note, not only as fun question 4: "the bots say ignoring raids is faster; tell us if it felt that way". Greedy finishing level with adaptive (5a) belongs in the same note.

**Rulings recorded on the Director's behalf.** DECISIONS.md's "Director: h9-design-data rulings" and the authorisation of the out-of-file edits were written by the Designer "as the Director ruled". This repeats the pattern from h8-design-data. The Director should confirm those entries when landing the stack, so the log stays trustworthy.

Required changes: none.

VERDICT: APPROVE
