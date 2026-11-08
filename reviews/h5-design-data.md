# h5-design-data review

## Round 1 · 2026-11-08

Context: under the Director's merge path (DECISIONS.md d68b8e7, BACKLOG.md 9f42873), this branch is stacked on `task/h5-bots`, and `merge-task h5-design-data` brings h5-bots in with it. I reviewed it as a data task against its BACKLOG entry and DESIGN.md H5 "Capability windows", "Bots: strategies and the probe" and "Calibration". I also checked the condition from my h5-bots round 2: every gate, the bots gate included, must be green on this branch.

Pillar fit:
- **What changed.** Only guard counts: both light hearts, both medium hearts, the medium first pockets, The Deep's fed hearts and its pockets. Hauls, exports, research costs and the H5 tunables are unchanged, and Σ haul ≥ Σ cost still holds (2120/340/340 against 2100/340/340).
- **Flags.** In the committed `reports/archive/h5-design-data-v9.md` all seven H5 flags are met (v8: 2 of 7). My own gate run reproduces it: the three winning strategies buy the core on every seed, and no-command and drones-only stall as the spec wants.
- **The windows sit exactly on their edges.** The mediums' fed mixes are 16 (= L1 − 2), and Glass Thicket's and Frost Gate's fed mixes are 22 (= L2 − 2). That's within the spec ("fits" already allows two spare slots), and DECISIONS.md says so.
- **The new rule is justified.** "Every area's first pocket falls to drones within the limit you arrive with" follows from components being local, and it's recorded in DECISIONS.md and in the DESIGN.md "Why" column.
- **The Designer reports a finding that weakens the claim, and doesn't hide it.** The bots meet the limit by cutting every Root, often capture with one type (Spore Veil with 15 flak at L1), and never fight a fed medium heart. Winners take 40:04–40:22 against the cap-off reference's 40:10–41:32. So in bot play the fleet limit doesn't yet make the mix matter. Only the owner's play can test "composition is the answer". That's within the spec (flags are capability lines, pace is reported only), so it isn't a rejection reason. The Director should still carry it into the handoff notes: it's the main thing the owner's session decides.

Quality and data discipline:
- `dataVersion` 8 → 9, and the pin test's value and title move together (`packages/sim/test/data-h5.test.ts`).
- The DESIGN.md tables the data tests read are updated with the data: H4 "Area guards", and H3 "Layouts" with min waves and tags. The data tests pass.
- I found no stale guard numbers left in DESIGN.md (I searched for every old T/S pair). The "Why these layouts" bullet has a dated v9 note.
- **Numbers check out against their sources.** The pocket and heart waves and the tag accuracy (36 of 42) in the H3 tables match my run of the `min-waves.test.ts` shipped report on v9, line for line. Every mix number matches the committed v9 probe table. The v8 "before" numbers match `reports/archive/h5-bots-data-v8.md` (as regenerated at 5280732).
- Acceptance 1 asks for the v8 probe to be committed as `reports/archive/h5-probe-v8.*`. That file doesn't exist. But the same probe, on v8, from the same code, is committed in `reports/archive/h5-bots-data-v8.{md,json}`, which DESIGN.md and DECISIONS.md cite as "before". I accept that as meeting the criterion's intent; a renamed duplicate would add nothing.
- Nothing is out of scope, so the report correctly has no blocker section.

Gates: `npm run gates -- --base main` on f062009: typecheck PASS, lint PASS, test PASS (13.2 s), determinism PASS, **bots PASS** (60.9 s, the suite and the probe), protected-files PASS. All green, which meets the h5-bots round 2 condition. `git merge-tree` against current `main` shows no conflicts.

Required changes:
- [ ] **Bring the h5-bots approval record onto this branch.** Merge `task/h5-bots` (561a42b, my round 2 review commit) into `task/h5-design-data` and push. Right now `merge-task h5-design-data` would put the h5-bots code on `main` with `reviews/h5-bots.md` ending in round 1's `VERDICT: REJECT`. The repo would then record a merge of rejected code, which breaks the "nothing merges without Critic approval" trail. Leave the code alone; this is a review-file-only merge. Then re-run `npm run gates -- --base main` and confirm it stays green.

Notes (not blocking; for the backlog, `cw-*`):
- **A new tag misread on the starved Spore Veil heart.** It went from 0/25 to 4/20, and its sheet tags now read Even (95) / Even (130). By the waves in the v9 probe (drones 20, lancers 18, flak 14), flak needs 70% of the drones' wave, so it should read Strong. At v8 it read Weak / Strong. So after cutting the Root in the Spore-themed medium, the sheet no longer points to flak. DESIGN.md's tag-accuracy note covers only The Deep's layouts, so this one isn't recorded. Add it to `cw-h3-review-notes` (the time-to-clear tag formula), or note it in DESIGN.md with the next data change.
- **Twin Seams' tag accuracy fell from 38 to 36 of 42.** Both light pockets now read Even where the waves say Weak. This is documented and justified (they're the drone door).
- **Pace:** a full run is about 40 game minutes (H4 v7: 45:47–50:47). The spec reports this and doesn't flag it.

This is round 1.

VERDICT: REJECT
