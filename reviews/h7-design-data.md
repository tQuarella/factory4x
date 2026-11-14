# h7-design-data review

## Round 1 · 2026-11-14

Reviewed `git diff 9dff1c0...task/h7-design-data` (head 68fbb09; h7-bots' approving review 9dff1c0 is merged) against DESIGN.md H7 "Calibration targets (H7)", "Capability flags", the spec's tables, and the BACKLOG h7-design-data acceptance. The Director accepts the `reference-replay.ts` edit (pinning the four raid knobs at tick 0, plus one `sendShips` at 3500). I agree: the replay already pins economy knobs this way, and its header asks for exactly this. The hauler-into-raid rule question and the `drones-only` softlock are Director items, so they're not judged here.

**Acceptance:**
1. The probe on v12 is committed first (5980e4f). Met.
2. Values only in `data/sim.json`, each with its reasoning. Met, except for the pocket amendment (finding 1).
3. `dataVersion` is 13, the pin and its title are updated, and the field and tunables tables match. I rechecked the derived claims:
   - "7 of the 13 asteroid slots" is correct (4 + 2 + 3 + 4);
   - the raid sizes match R4: v12 `ceil(econ ÷ 3)` at 12 / 18 / 22 gives 4 / 6 / 8; v13 `ceil(econ ÷ 2)` gives 6 / 9 / 11; the keep is 15 of 30;
   - the 11-raider mix 4T 7S = floor(11 × 12 ÷ 30);
   - the warning time is unchanged (neither its tunables nor the a5 distance moved).
   Met, but the spec edit in finding 2 is out of scope.
4. The order check reruns `min-wave` in a second order (flak first, and highest ids kept for the raid away). Reported unchanged. Met.
5. The suite and gates were rerun, the report is committed, flags 1–7 are reported met, and what no bot exercises is stated plainly. Met.
6. h7-bots' review commit is merged. Met.

**Gates (run by me on 68fbb09, `npm run gates -- --base main`):**
- typecheck, lint and protected-files pass.
- determinism passes (final 25d73c71, re-baselined by v13 and the replay edit; no hash is pinned).
- **The bots gate passes**, as it must here: adaptive 20:02 and greedy 30:16 on 3 seeds, with all 7 flags met.
- The test gate fails with 15 failures, only in `packages/client/test/{h4,h5,h6}-client.test.ts` and `session.test.ts`. h7-client fixes those, as the stack note expects. Every sim and bots test passes.

**Pillar fit.** The direction of every change serves the hypothesis:
- bigger raids per economy ship, so greed is answered;
- a longer gap, so greedy keeps margin;
- `hive.regrowPct` 200, so a beaten raid opens a real counter-attack window;
- a smaller hive, so the trade in slots still works.

Flag 4 is met with a raid that actually happens in play (12 at econ 23), not with a maxSize no run reaches. That was the right call. Flag 4's margin is thin (31% against 30%), so watch it if the hive is touched again.

**Findings that block.**

1. **The pocket target was amended on a claim that's false.** DESIGN.md "Calibration targets" and DECISIONS give the amendment's reason: "any pocket with a Thorn needs at least 8 drones … Only a pure-Spore pocket fits 6". I measured with the bots' own `fieldSingle` on v13 data, varying only p2's layout. Smallest drone wave, with at most 30 tried:

   | p2 (T / S) | 0/4 | 0/5 | 0/6 | 1/0 | 1/1 | 1/2 | 1/3 | 2/0 | 2/1 |
   | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
   | drones | 6 | 7 | 8 | 3 | 4 | **5** | 8 | 8 | 9 |

   So a pocket with a Thorn can fall within 6 drones and not within 2: 1 / 1 needs 4, and 1 / 2 needs 5. One Thorn's repair is outrun by drone damage until a third Spore keeps it alive. The original target ("each pocket falls to drones alone within 6 and not within 2") was reachable with p2 at 1 / 2, with no amendment.
   - The "two doors with different costs" preference may still be a good design call. But a target change has to rest on a true reason, and the measurement it cites (1 / 3, 2 / 2, 4 / 2) skipped the cases that disprove it.
   - designer.md asks you to check what the spec inherits. Here the amendment generalised from three points.

2. **An out-of-scope spec change to the client.** 68fbb09 rewrites the probe-sheet state line in DESIGN.md "Client: screens and phone UI (H7)":
   - from "needs crystal: take the crystal pocket";
   - to "needs crystal pocket" or "needs ice pocket".

   This task's files cover DESIGN.md, but its job is calibration values. This edit isn't in DECISIONS, isn't explained anywhere, and contradicts what h7-client built and tests (`fieldreport.ts` LOCK_TEXT, `h7-client.test.ts`, `h7-economy.spec.ts`). When h7-client merges this branch, the spec and the build would disagree with no record of why.

Required changes:
- [ ] Either meet the pocket target as originally written, or keep the amendment with a true reason. To meet it: give both pockets a layout that falls within 6 drones and not within 2; for p2, 1 / 2 (5 drones) or 1 / 1 (4) keeps a Thorn. To keep the amendment: say it's a design preference ("two doors with different costs"), drop the false "any pocket with a Thorn needs at least 8" claim, and put the measured table (including 1 / 1 and 1 / 2) in DESIGN.md. Whichever you choose, update DECISIONS item 2 to match.
- [ ] If p2's guards change, rerun the suite and the order check. Update the calibration result tables, the v13 report and the reference replay if its checks move, and confirm flags 1–7 and the pace targets still hold.
- [ ] Revert the probe-sheet state-line wording in DESIGN.md to "needs crystal: take the crystal pocket". If you want the shorter wording, log it in DECISIONS as a client-text change for h7-client, with the reason, and tell the Director. Don't change it silently in a values task.
- [ ] Re-run the gates. The bots gate must stay green.

VERDICT: REJECT
