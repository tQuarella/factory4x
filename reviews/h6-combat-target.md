# h6-combat-target

## Round 1 · 2026-11-08

Scope: `git diff task/h6-sim...task/h6-combat-target` at dda930c (2550e89 and dda930c). It touches `packages/sim/src/step.ts`, `packages/sim/test/{combat-order,min-waves,reference-replay}.test.ts`, `packages/bots/src/reference-replay.ts`, and a DECISIONS entry and two dated DESIGN notes. That matches the BACKLOG file list: no `data/sim.json`, no bot logic, no protected file. I checked it against DESIGN.md H6 "Combat amendment" (3d3f889), the Director's acceptance (0552809) and BACKLOG "### h6-combat-target". It's stacked on h6-sim and merges with h6-sim and h6-client (a948a53).

**Gates (run by me on dda930c):**
- PASS lint, PASS determinism (30 checkpoints, final **67e5632c**), PASS bots, PASS protected-files.
- FAIL typecheck and FAIL test, only on the five inherited client failures I listed in reviews/h6-sim.md: `h5-client.test.ts` (TS error and suite load) and four `h4-client.test.ts` tests. Expected under a948a53. 527 other tests pass.
- The bot suite here is still h6-sim's H5 strategies, and its winners time out. That's expected on this branch, and the campaign-timeout rule arrives with h6-bots.

**Acceptance:**
1. **Met: the rule, exactly as amended.**
   - In `step.ts` `combat`, pools are summed per guard type from the guards present at the start of the round, before `playerDamage`, so guards killed this round still hit.
   - `GUARD_TARGET_ORDER` is thorn: flak, drone, lancer; spore: lancer, drone, flak.
   - Within a type, ships are taken in id order (`present` is in `world.ships` order). Damage overflows across ships and types, and dead ships are skipped by the spore pool.
   - `GUARD_TYPES` is `['thorn', 'spore']`, so thorns go first. Player damage is untouched. It's integer only, with no RNG.
2. **Met: `combat-order.test.ts`.**
   - Permutation invariance over six orders (lancers first, flak first, drones first, round-robin, reversed ids, and an integer-LCG shuffle) for drones only, each single counter, the minimum mix, one under and two over. It runs on a Thorn-heavy (14/8), a Spore-heavy (6/20) and a balanced (10/14) fixture heart. The comparison covers the result, the end tick, and the surviving hp multiset per type.
   - The superset test: 0–3 extras of each type, built before and after the base wave, 128 waves per heart. Plus the converse: removing a ship from a losing wave never makes it win.
   - Unit cases: overflow across a ship and a type boundary, spore-first, pools from start-of-round guards that die in the round, and a remainder that doesn't divide evenly.
   - **Fail-before, verified by me:** with `step.ts` from task/h6-sim swapped in, 12 of its 15 tests fail. All three permutation tests, three superset/converse tests and all four unit cases fail. Then I restored the file, and the tree is clean.
3. **Met: fixture numbers re-derived, not loosened.**
   - Only `min-waves.test.ts`'s best-mix column moved, to exact new values. Single-type minima can't depend on order, and they're unchanged, which is a good consistency check.
   - The engineer's reason holds: the old search built lancers before flak.
   - Dated notes are in DESIGN.md: the min-wave table in "Owner direction 2026-11-08b" and H3 "Calibration result".
4. **Met: replay and determinism.**
   - The engineer showed the existing replay never exercised the rule (all 30 old checkpoints matched), so it adds a mixed fight in The Deep that spans the 5400 checkpoint: lancers and flak against Thorns and Spores, with wounded ships at the checkpoint and losses on both types.
   - `reference-replay.test.ts` asserts that premise, so a later edit can't quietly drop it.
   - The re-baselined hash is 67e5632c; the old rule on the same inputs gives 97899c76.
   - The golden-hash test is unchanged, correctly, because its battles are drones only.
5. **Met: `dataVersion` stays 10,** and DECISIONS logs that a v10 replay recorded before this commit won't reproduce.

**Pillars and vision.** This is the Designer's and Director's amendment, implemented exactly as written. It removes a hidden build-order effect and makes Strong/Weak truer, and it adds no input and no micro. It's logged as a team-owned mechanics fix, to be named in the handoff.

**Code quality.** Small and clear, with the target order as a named constant.

**Non-blocking notes:**
- `reference-replay.test.ts`, in the new mixed-fight test: two consecutive comment blocks say nearly the same thing ("More than one ship lost…" and "The heart's battle: …"). The first is a leftover and can go next time the file is touched.
- **For the Director (routing):** the amendment adds one sheet line, "Thorns strike Flak first; Spores strike Lancers first", under the Strong/Weak tags on heart and pocket sheets. BACKLOG's h6-client entry doesn't mention it yet. Add it to h6-client's acceptance.
- The H6 counter tags and the tag-accuracy report need recomputing under the new rule. That's already on h6-design-data's list (DESIGN "Calibration" step 5).

Required changes: none.

VERDICT: APPROVE
