# Review: h3-design-data

## Round 1 · 2026-11-07

Reviewed `origin/task/h3-design-data` at 705c747 (calibration 12a8fca, fixture restructure 3e71b09, round-robin yards cb49da3, merge of main). The review is based on the diff against main, the files it touches, and my own runs in a detached worktree.

Pillar fit: the calibration supports the H3 hypothesis ("counters change your choice"). Doubling the prize rate means counter strategies now field real lancer and flak numbers. The ×2.1 guard counts move pace toward the spec without touching the live `guard.capPct` knob. The round-robin change to rule 5b (`yardTurn`) is a mechanic change outside the Designer's file scope. It is recorded as Director-approved (STATUS.md launch 10, DECISIONS.md "approved flag 4 fix 1"). I judge it within the team's authority and not an owner question. It removes a hidden starvation rule: with both yards on and ore for one ship, the old order built only lancers. Players will read alternation as the natural behavior. It does not change the pillars or the feel beyond what the spec intends ("a scarce component is never starved by drones" still holds and is tested).

Pace (Critic note b): bots went from 12-16 min to 19-22 min with counters and 25-28 min with drones only. That is still short of the spec's 20-35 min and 35-45 min for drones only, and the first pocket falls at 10-11 min against the spec's 4-6. The reason given (the bot suite's 30-minute cap) is a tooling limit, not a design reason. Still, the shortfall is disclosed, and "stop short" is a defensible Designer call before a human playtest. Accepted as reported.

Determinism and integer math: `yardTurn` is one integer in the world. The rotation is `(k + 1) % 2` over a fixed constant array, with no RNG, clock or unordered iteration. Splitting finish from start keeps behavior for one yard at a time identical, because spawning never touches stock. Save handling: `deserializeWorld` refuses a missing, negative, out-of-range, fractional or string `yardTurn` as corrupt (tested). The round trip preserves it, it is in the hash, and it decides the next start (tested). No stored hash baseline exists, so nothing else needed re-baselining. v4 saves are refused by `dataVersion` 5 with the existing toast.

Reference replay: regenerated, and it still asserts the repelled wave, the capture of p1 and p2, components assembled before flak, the Root cut with the wilt (now read from the shipped layout via `capEff`), and the starved heart taken by lancers and flak before tick 3000. Pinning the damage, `counter.strongPct` and regrowth values at tick 0 is a sensible hedge against future calibrations. I instrumented the replay myself. Between ticks 1949 and 2879 the lancer and flak yards alternate strictly (F, L, F, L…), with 5 ticks where one yard started while the other was idle with its component but no ore left. So the rotation really is under contention in the determinism hashes and in the browser cross-check (smoke "browser sim matches Node sim" passed).

Test restructure: I checked every touched rule test. Each one checks the same thing against the same v4 numbers through the fixture (`helpers.data`, `min-wave` defaults, guardians, strategies, client supply readouts). The "spec headline" exemption moved from hard-coded ids to `isMixed`, and a new test pins that `isMixed` gives exactly the old exemption set on v4. No rule test checks less than before. The shipped-data tests are sound. They check that the data parses, every default is inside its range, the version is newer than the fixture, and the node field is unchanged. They also parse the DESIGN.md H3 Tunables and Layouts tables and require equality, so data and spec cannot drift apart. The round-robin tests are meaningful: alternation, a blocked yard keeping its turn, both starting, drones never going ahead and never moving the turn.

Gates: `npm ci`; `npm run gates -- --base main` passed all 6 (typecheck, lint, test, determinism, bots, protected-files: 22 files, none protected). `npm run build` passed. `CI=1 npm run smoke` passed 42 of 42. `npm run bots -- --seeds 3` passed: flags 1, 2, 3, 5 and 6 MET, flag 4 MISSED (crystal-first faster in all three layouts by 13-26 s), tick p95 ≤ 0.005 ms. Branch CI: run 42440566369 (cb49da3) is green. Run 42440794995 for the head 705c747 was still in progress when I reviewed. The branch touches `packages/client/test/`, so the Director must see it green before merging.

Quality and honesty of the report. This is why I reject. The task asks for honest flag and tag reporting, and DESIGN.md is what the owner reads. In three places it describes a game that is no longer the one on the branch:

1. **The tag accuracy count is wrong.** DESIGN.md ("Tag accuracy at these numbers") and DECISIONS.md (Designer entry) say "35 of 36 tags are right", with the one exception "flak at Twin Seams p1 (and the identical p2)". By the Designer's own rule, the branch's own report test (`min-waves.test.ts`, "shipped data … (report)") prints **38 of 42** with the starved heart included, or 33 of 36 at full caps. The misreads are:
   - Twin Seams p1 flak: 23 against 20 drones, reads Even, waves say Weak.
   - Twin Seams p2 flak: the same.
   - Twin Seams Root flak: 28 against 26, reads Even, waves say Weak. The text does not mention this one.
   - Twin Seams starved heart lancer: 21 against 27, reads Even, waves say Strong. This is the fight the player actually has after the Root cut. It is not mentioned.

   None of these inverts Strong and Weak, and all four are near the threshold. I accept the substance of Critic note (a): the original misreads (flak needing 62% of the drones yet reading Even) are gone. The stated count must still be true.
2. **The calibration tables are from before round-robin.** The "Bot suite, `--seeds 3`" heart-capture table and the flag table's "v5 (after)" column still show the pre-round-robin numbers. They say flag 3 gaps of 10-12% and flag 4 "missed: ice-first is faster in every layout by about 2 min". The shipped code gives gaps of 1-2%, with crystal-first faster by 13-26 s. The "Sim fix done" paragraph corrects this only in prose, under a table that states the opposite.
3. **Answer 2 is outdated.** It still says "there are still far more lancers than flak (see below)", which describes the starvation that round-robin removed.

Required changes:
- [ ] DESIGN.md "Tag accuracy at these numbers": state the real count, consistent with the report test (38 of 42 with the starved heart, or 33 of 36 at full caps, saying which). List all four misreads, including Twin Seams Root flak and the starved heart lancer. If any count needs a Designer judgment ("close enough"), say so per item.
- [ ] DECISIONS.md: add a correction to the Designer entry's "35 of 36" (append a dated line; don't rewrite history) with the true count.
- [ ] DESIGN.md "Calibration result": replace the bot heart-capture table and the flag table's after column with the current numbers (after round-robin, as in DECISIONS.md and `reports/bots-latest.md`). Keep the pre-round-robin numbers only as a labelled "before round-robin" column, if at all.
- [ ] DESIGN.md answer 2 (and the 3a wording, if needed): remove or update "far more lancers than flak", so the text matches the current yard rule.

No code changes are required. After these edits, rerun `npm run gates -- --base main` (the DESIGN.md table tests parse this file) and wait for green branch CI on the new head.

Non-blocking notes (not conditions of approval):
- The shipped-data test "tunable metadata follows the shipped defaults and ranges" mostly restates `tunableMeta`. It is harmless.
- The pace targets in the spec's open questions (first pocket at 4-6 min, drones-only at 35-45 min) are now known misses. Worth a backlog line for after the playtest, together with the bot 30-minute cap that blocks calibrating to them.
- Twin Seams reads Even/Even at its Root and heart, fed and starved, so there the ring gives no guidance in the final fight. If that is intended for the symmetric layout, say so in "Why these layouts". Otherwise it is a Designer follow-up.

This is round 1 on this task.

VERDICT: REJECT
