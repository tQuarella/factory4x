# h8-design-data review

## Round 1 · 2026-11-15

I reviewed 78b27ae (`git diff task/h8-bots...task/h8-design-data`: eb00081, 2158606 and 78b27ae). The branch carries h8-bots' approving review (6593008). I checked it against DESIGN.md "Calibration targets (H8)" and "Inherited assumptions", and the BACKLOG h8-design-data acceptance.

**What the branch does.**
- It commits the v14 probe.
- It calibrates to v15 (`guard.spore.damage` 2, p1 0/3), which meets the token-guard target as first written.
- On the Director's ruling ("h8-design-data stays on v14"), it reverts to v14 and records the reworded target: "a defence **under** half the raid's size is beaten, then the raid hits".
- Net, `data/sim.json`, the version pin and every package are unchanged against `task/h8-bots`, at `dataVersion` 14.
- The v15 report is kept, marked "values tried, not shipped".

**Gates (run by me on 78b27ae, `npm run gates -- --base main`): all PASS.**
- typecheck, lint and protected-files (56 files, none protected).
- test: 48 files, 1047 tests.
- determinism: final cdbdea56.
- bots: the suite passes. adaptive wins at 15:53, greedy at 15:45, and flags 1–7 are MET.

The bots gate is green on this branch, as the stack plan requires.

**Acceptance.**
1. **Probe first: met** (eb00081, `reports/archive/h8-probe-v14.*`).
2. **Values only: met.** The only value change, in 2158606, was values plus the pin. It was then withdrawn on a logged Director ruling.
3. **v15 if a value changes: met.** Net, nothing changed, so v14 stands. The derived claims in the spec hold on v14:
   - the need table: a1–a4 1, a5 3, a6 and a7 2, total 11;
   - flag 6's sums: 16 + 22 = 38 > 30, and 16 + 10 = 26 ≤ 30;
   - raid sizes: the full-economy raid is 12 (4T 8S), and the first raid at 2:42 is 1T 2S.

   These match the v14 report's Designer section, which I read against the table in DESIGN.md.
4. **The order check: met.** The min-waves (hive 16, hive with a raid out 11, p1 6, p2 5) and every a5 raid fight were rerun in a second order, with the defenders flak first and the raiders highest ids first. They give identical outcomes and losses, so the shield adds no order dependence.
5. **Suite and report: met.** The v14 result report says which flags hold (all seven, with flag 1's static numbers) and what no bot exercises. That list also names Stop-to-dodge and a defence sized to the raid's mix, which is a useful addition.
6. **h8-bots' approval merged: met.**

**Judgment on the ruling.** Staying on v14 is the right call, and the Director's reasons are sound:
- v15 moved adaptive's win to 25:54 while greedy stayed at 15:57, which makes defending the losing line, against pillar 2;
- it doubled every Spore fight for one target.

The reword is within the team's remit, because calibration targets are the team's measure, not the owner's success criteria. It is logged with the measured numbers.

**But note what the reword concedes.** On v14 a half-size guard (2 lancers + 4 flak) *beats* the full-economy raid, losing 3, and 7 ships win losing 2. That leans toward the claim's disproof condition, "defence stays trivial". It isn't a reason to block: the owner's session is the test, and fun question 2 ("holding a front worth the slots, or a chore?") asks it directly.

**Director:** carry two things into the handoff notes as risks to listen for:
- this half-size result;
- the watch item that greedy and adaptive finish 8 s apart.

**Minor (not required):**
- The shipped result is named `reports/archive/h8-design-data-v14.*`, outside the backlog's file list (`h8-probe-v14.*`, `h8-design-data-v15.*`). That follows from the ruling and is clearer than putting a v14 result under a v15 name.
- The `.mts` probe scripts live in `reports/archive/` beside their outputs, as in earlier iterations.

Required changes: none.

VERDICT: APPROVE
