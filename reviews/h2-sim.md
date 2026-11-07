## Round 1 · 2026-11-07

Reviewed `task/h2-sim` at 4933aca (d9563ff plus a merge of main), against DESIGN.md H2 and the BACKLOG acceptance criteria. I read the full diff and the new tests, and ran the gates and the scripted tests myself.

Pillar fit: Good. This is VISION pillar 3 ("cut their supply first") as the H2 spec describes it, and nothing more. There is no new input. The Root uses the H1 combat, capture and regrowth code paths, now looped per guardian. Capture wilts the Bloom to `bloom.starvedCap`, newest thorns first, counted in `stats.thornsWithered` and not as kills. The Bloom then reads its cap, regrowth and repair live from the Root's state. Variants change only the Root's position and cap: the test checks that nodes 0–6 serialize identically in all three. "Ships needed" is not exposed anywhere. The fed Bloom is unchanged from H1. Turtle still captures at **9.8 min with 1 wave and 11 lost**, identical to H1. The scripted Thin test reproduces the H1 27-ship minimum against the fed Bloom. I checked that every Root position is at least 280 su from every node: the closest pairs are Deep–a3 at 286 and Knotted–a4 at 306.

Acceptance:
1. Rules: met. Rules 7, 8 and 9 each loop over `world.guardians` in node order. The Root's effective cap is `clamp(rootCap + root.capBonus, 0, 40)`. The wilt pops the highest ids and resets the Bloom's `regrowProgress`. Taking the Root after the Bloom has fallen only sets `rootCutTick`. Each case has a test, including "highest id after kills and regrowth reorder" and "a Bloom already below the starved cap".
2. Variants and data: met. `((seed mod 3)+3) mod 3` is tested with negative seeds, and forcing is tested for every value. `dataVersion` is 3. The six tunables are in data with the specced ranges. `map.variants` and the `root` placeholder (Knotted position) are in data. `parseSimData` validates the variants and keeps the `system.variant` range inside the table. Client seeds are below 2^31−1, so `seed | 0` matches the spec's modulo.
3. Selectors: met. `supplyStatus`, `systemStatus`, `isRootCut` and `activeBattles` are new. `guardianStatus`, `battleStatus`, `lastBattle` and `combatRates` take an optional `node` and default to the Bloom. `BattleResult.wilt` carries `{from, to}`. `runSummary` gains the system, the Root cut, the withered count, and waves and losses per target.
4. Unit tests: met, every listed case. The "fed behaviour = H1" test compares the Bloom's per-tick trace over 12 minutes across all three variants and at the Root strength extremes. It does not compare against an H1 build directly. The unchanged turtle report and the 27-ship minimum cover that.
5. Scripted Thin: met, with real numbers. 15 ships take the Root (3 lost, 12 survivors). The wilt is 12 → 8. 18 ships take the starved Bloom (8 lost). 18 against the fed Bloom are repelled (all lost). The smallest capturing waves are Root 13 (Thin), 21 (Knotted) and 30 (Deep), starved Bloom 15 and fed Bloom 27. All match the Designer's model exactly.
6. Reference replay: met. The fed Bloom repels a wave, the Root is cut (wilt 12 → 8, `root.capBonus` exercised live), and the starved Bloom is captured at tick 2340, inside the 3000-tick browser check. Starved regrowth and repair are tuned up so that both act during the fight, which is asserted (11 thorns killed against 8 present).
7. Gates: met (below). Turtle 9.8 min against H1's 9.8 min.

Determinism: integer math only. Every guardian loop runs over a fixed-length array in node order. Battle ids come from `nextId`, which shifts later ids but not any ordering. That was verified by the unchanged H1 wave numbers and bot results. `world.system` is in the hash and in the save, so a restored game doesn't need the variant table. The determinism gate passes on the new replay.

Quality: Clean and consistent with the M1 sim. The two deviations from the spec's wording are reasonable and logged in DECISIONS.md:
- the variant is kept in `world.system`, not `stats.variant`, and `runSummary` exposes it;
- waves are counted one per target per tick rather than one per tick overall. Attacking both nodes in one tick counts as two waves. That is a stat only and does not change play.

The client edits are the minimal compile fixes the task allows. Until h2-client merges, `main` draws the Root with the rich-node sprite and Root battles raise no toast. This is logged, and it is what the BACKLOG sequencing expects.

Phone: not applicable (no UI change).

Gates: I ran `npm run gates -- --base main` on 4933aca. PASS on typecheck, lint, test (157 tests), determinism (30 checkpoints, final 42798df0), bots (rush 25.3 min, turtle 9.8 min, no flags) and protected-files (23 changed files, none protected).

Required changes: none.

Notes, not required:
- In DECISIONS.md, the new Core Engineer entry has no blank line before the following `## 2026-11-07 · Director` heading. Fix it when that file is next touched.
- `deserializeWorld` checks that `guardians` is an array but not its length. That is harmless for saves the game wrote itself.
- No build with H2 can go to the owner until h2-client lands. Between the two merges, the Root looks like a second Bloom on the map.

VERDICT: APPROVE
