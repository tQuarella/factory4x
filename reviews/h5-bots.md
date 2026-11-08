# h5-bots review

## Round 1 · 2026-11-08

Pillar fit: The scope is right. The composer engine, the five strategies, the cap-off `greedy` row, the probe in `waves.ts`, the report and the seven H5 flags all follow DESIGN.md H5 "Bots: strategies and the probe". The probe's monotone `minMix` search is checked against brute force on the frozen fixture. Nothing is retuned, so the change doesn't affect how the game plays. The probe table is already useful: it shows that both light hearts are closed at L0 on v8 (shelf 19 drones, shoal 20, against a limit of 12), which is what h5-design-data needs to know.

Quality: The code is clear and integer-only. The allocation search, the tie-breaks, the closed records keyed by `limit|lancer|flak`, the kits, the forced landing and the flag computations are all tested on `fixtureV8`/`fixtureData` with stated premises. The shipped-data tests assert only shape and determinism, and no test runs over about 3 s. The allocation cache lives at module scope, but it memoises a pure function keyed by every input it reads, so it's safe. DECISIONS.md explains the non-obvious choices: planning only the types whose component flows, the closed test before the economy, and the vacuous strategy halves of flags 2 and 5.

**Engine bug: a stranded ship deadlocks every visit that needs the full allocation.** I traced composer seed 1's forced Frost Shelf visit, replaying `decideOverworld`/`decideComposer` tick by tick with a script in my scratchpad:
- On the landing tick the drone yard is still on and starts a ship (`fleetStatus.building` 1). One tick later the economy plan turns the yard off.
- The rally is still the probe (node 0) when that ship finishes, so it parks at the probe.
- `decideComposer` regroups only from captured nodes (`world.stats.captures`) to a5, never from the probe, so the ship stays there for the whole visit.
- From visit tick ~11056 on: `fleetCount` is 12 (10–11 at a5, 1 at the probe), the drone yard is off because 12 are counted, and at a5 there are only 11 of the allocated 12. So `matches` is never true. With 11 drones `readyToAttack` fails against the heart, so no wave is ever sent.
- This happens in every run in the report. Each forced visit shows `shipsBuilt 12, shipsLost 0` over 30:00, and the visit times out without one attack. (This is the regrouping hole noted in `cw-raid-regroup`, now fatal because the allocation is exactly the limit.)

On v8 the outcome is the same, since the shelf heart needs 19 drones. But the bot isn't doing what the spec says ("land in the cheapest anyway… play it out"). After the retune, any area where the attack depends on the full allocation will time out for engine reasons and look like a data failure. Every runner and strategy test that plays an area uses a raised limit (where the H3 threshold fires below C), so none of them catches this.

**The bot gate is red.** I ran `npm run gates -- --base main` on `task/h5-bots`. typecheck, lint, test (13.9 s), determinism and protected-files pass. **bots FAILS** (63.5 s): `composer`, `ice-first` and `crystal-first` softlock on all three seeds at 70:30. Acceptance criterion 5 says "Gates pass", and CLAUDE.md says never merge without passing gates. The author's DECISIONS entry correctly says the gate isn't weakened and that the softlock comes mostly from the v8 data. But I can't approve a branch whose gate is red, and I won't approve on the grounds that a later task fixes it.

Gates: typecheck PASS, lint PASS, test PASS, determinism PASS, **bots FAIL** (9 softlocks among the gated strategies), protected-files PASS (11 files changed, none protected). The committed `reports/archive/h5-bots-data-v8.md` matches my run.

Required changes:
- [ ] Fix the regrouping hole. Ships parked outside a5 must regroup there: at least ships at the probe, and in general any idle ship not at a living guarded node and not in a wave. Then a full allocation can gather and "matches" can fire. Another fix is fine if it makes the counted fleet reachable, e.g. never leaving a yard building on the landing tick before the rally moves.
- [ ] Add a test at the **base** limit, not a raised one. Land an area on the fixture so that the landing-tick yard start happens (or place a ship at the probe). Assert that the composer brings it to a5 and sends a wave once the full allocation has gathered. Also assert that a forced visit attacks at least once (waves sent > 0) before its visit cap.
- [ ] Re-run the suite and replace `reports/archive/h5-bots-data-v8.{md,json}`. Forced visits must now show waves sent and losses. Re-check the DECISIONS claim "the bot gate is red … that is the data, not the engine" against the new numbers, and keep it only if it still holds.
- [ ] Make the bot gate pass before the branch comes back for approval. This needs a merge path from the Director; I won't waive a red gate. The gate must not be weakened. My suggestion: let h5-design-data branch from `task/h5-bots` (stacked), retune there, and merge the two together, or h5-bots first in the same `merge-task` run, once `npm run gates` is green on the stacked branch. The Director should record that in DECISIONS.md and BACKLOG.md. If the Director picks this path, re-submit h5-bots with the fixes above and the stacked branch's green gate run. I'll review both.

Notes (not blocking):
- The per-run column heading says "closed = withdrawn at once", but both closed visits last about 5:00 because a pocket passes first, and the area is recorded closed only when the heart is all that's left. That matches the spec ("if nothing passes"). Word the heading as "closed = withdrawn when nothing passes the attack test".
- The spec says "If the heart fails and its Root is alive, target the Root". The implementation tries the Root only when the Root itself passes the attack test, and closes the area otherwise. That's a defensible reading, and DECISIONS.md covers it ("Root before heart is the H3 order"). Flag it to the Designer if the retune leaves Roots that fail the test at L0.

This is round 1.

VERDICT: REJECT

## Round 2 · 2026-11-08

Scope of this round: the Director chose the merge path (DECISIONS.md d68b8e7, BACKLOG.md 9f42873 on `main`). h5-design-data is stacked on `task/h5-bots`, and the two merge together through `merge-task h5-design-data` only when both are approved and every gate on the stacked branch is green. h5-bots is never merged alone. This round judges everything except the bots gate's softlock result on untuned v8. That result moves to the h5-design-data review, where the stacked branch must turn it green.

Pillar fit: unchanged from round 1. The bots follow the spec, and nothing is retuned.

Quality: the round 1 fix is small and correct (5280732).
- `decideComposer` sets the rally to a5 from the landing, before the economy return. A ship a yard starts on the landing tick now goes to a5 instead of the probe.
- Every idle ship regroups at a5 from any node except a5 and living guarded nodes. `isGuarded` means the guardian is alive, and `shipCounts().at` excludes ships in transit, so waves in progress aren't pulled back.
- The two new base-limit tests fail on the round 1 code. I checked by restoring the 2054918 `strategies.ts`: 2 failed, 53 passed. They pass on the fix.
- The forced-visit test kills the non-heart guardians directly to reach the heart-only state. That's acceptable for a premise, and it's stated.
- The report column heading is reworded as I suggested.

Evidence the engine now plays forced visits out: in my gate run, every gated run shows 176 built and 156 lost, against 31 and 0 in round 1. Every forced visit attacks and still can't take the Frost Shelf heart within the visit cap, as the probe predicts (best mix 13, drones alone 19, against a limit of 12). So the DECISIONS claim that the remaining red result comes from the data now holds.

Gates (`npm run gates -- --base main` on 5280732): typecheck PASS, lint PASS, test PASS (10.1 s), determinism PASS, protected-files PASS. bots FAIL (65.9 s), and every line under Failures is a softlock of `composer`, `ice-first` or `crystal-first` on v8. There's no crash and no tick-budget overrun (tick p95 at most 0.008 ms). The committed `reports/archive/h5-bots-data-v8.*` matches my run.

Required changes: none for h5-bots.

Conditions:
- This approval covers the h5-bots code only. It does **not** approve merging `task/h5-bots` on its own. The red bots gate still blocks that, and `merge-task` will refuse it.
- The bots gate's no-softlock result is judged on the stacked h5-design-data branch. h5-design-data's review must see `npm run gates` fully green there, the bots gate included, before either branch reaches `main`.

This is round 2.

VERDICT: APPROVE
