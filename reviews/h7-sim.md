# h7-sim review

## Round 1 · 2026-11-14

Reviewed `git diff main...task/h7-sim` (a511610, e8d9dff) against DESIGN.md H7 "One field, live enemy" (F1–F14, Tunables, Save/replay, Selectors) and the BACKLOG h7-sim acceptance.

**Pillar fit.** This is the engine for the H7 claim: allocation by weights, economy ships, Mine marks, a shared fleet limit and a raid hook. The rules follow the spec closely, and nothing player-facing goes beyond it. There is one exception, below: Stop on a captured pocket or hive doesn't do what F12 says. That defect hits the H7 claim directly, because Stop is how a player pulls haulers off a rock under raid threat.

**Gates (run by me on e8d9dff, `npm run gates -- --base main`).**
- typecheck, lint, determinism (30 checkpoints over 9000 ticks, final 648970fd) and protected-files all PASS.
- test FAILS with 41 failures in 7 files, all outside h7-sim's files:
  - `packages/bots/test/{needs-driven,runner,waves}.test.ts`;
  - `packages/client/test/{h4-client,h5-client,h6-client,session}.test.ts`.
- bots FAILS fast with the `runCampaign` field-mode error.
- `npx vitest run packages/sim`: 22 files and 376 tests, all pass.

This is the stack's expected red set (BACKLOG "Gate expectations"). Nothing in `packages/sim` is red.

**Acceptance.**
1. Data v12: met. `run.mode` is "field", and `map.field` matches the spec table, including `mine`. All 24 keys have their defaults and ranges. `parseSimData` validates `map.field` and both field checks, and the pin is 12. `data-h7.test.ts` covers each of these.
2. Campaign untouched: met. The fleet-off H4 golden hashes are unchanged. The H6 replay lives on as `campaign-replay.test.ts` on `shippedCampaign` with its 10 tests unchanged, and the shipped-data campaign tests use `withRunMode`. No assertion was dropped that I could find.
3. Rules and the required cases: covered by tests, except that the Stop defect below has no test.
4. F13: met. The landing state is tested, and the no-free-first-win test runs on shipped data. It uses its own `dronesWin` loop on the real sim, not the `min-wave` helper, but the method is the same.
5. Raid hook: met. `raidStep` is called after F7 and before F10, and the order is tested. `guardPools` and `guardStrike` are exported, with the economy strike order haulers then extractors, and tested.
6. Selectors: `allocStatus`, `rockStatus` (`raidRank` 0), the `fleetStatus` additions and `fieldSummary` are each tested.
7. Reference replay: met. It runs in field mode and covers every pre-raid item, and `reference-replay.test.ts` asserts each one rather than just running it.
8. Gates: as above.

**Determinism.** Integer only, with no RNG and no wall clock. Fixed orders throughout: types in `BUILD_TYPES` order, ships in id order, nodes sorted by integer distance then index. All new state lives in `world.field`, `world.raid` and `world.nextRaidTick`. Save validates it and a round-trip test covers it.

**Data.** Every new tunable is in `data/sim.json`, and `dataVersion` is 12.

**Code quality.** Good overall:
- The separate `field.econ` array keeps every warship path untouched, and DECISIONS explains why.
- The derived `node.extractors` via `syncExtractors` is the right call.
- The `ships.ts` extraction is clean.
- The out-of-list `runCampaign` guard is small, logged and needed, so the suite fails rather than hangs.

**Defect: Stop on a captured pocket (or the hive) doesn't take haulers off it.** F12 says that turning the mark off means "its haulers finish their trip and reassign". Here, a hauler drops the unmarked node at the probe (`runHaulers`). Then `haulTarget` picks it straight back, because:
- `isWorked` counts the node's free extractors and ignores the mark;
- with its haulers just dropped, the node has the best ratio (0 ÷ 1).

I checked this with a scratch script on the v12 fixture:
- p1 captured, one hauler, then `setMine p1 off`: the hauler never leaves p1, and 40 ice is delivered over the next 6000 ticks.
- With a1 and a2 also worked (three extractors, three haulers), a hauler still stays on p1 after Stop. So "it may pick the same node again if it is the only one worked" (DECISIONS) understates this. It isn't limited to the only worked node.

For the player, Stop on a pocket or hive does nothing visible to its haulers. Under h7-raids' R5 ("a docked extractor or assigned hauler"), the rock also stays a raid target after Stop. That breaks the very response H7 wants players to make.

**Non-blocking notes (no change required this round):**
- `fieldOk` in save.ts checks `id`, `type`, `hp`, `target` and `cargo` on economy ships, but not `at`, `transit`, `cargoRes`, or the inner `rockBuckets` arrays. A hand-edited save could load malformed. Tighten it if you're in there anyway.
- `reference-replay.test.ts`, recycle case: `econBefore: recycle!.econBefore` is a tautology. The `econAfter` and `refund` checks carry the test.
- `allocStatus` casts `world as World` for `bayOf`. A `Readonly` overload of `bayOf` would avoid the cast.

**Required changes:**
- [ ] F6 assignment (`haulTarget`) and the hauler-keep rule never assign a hauler to a node that is not Mine-marked and still has free extractors (a captured pocket or the hive after Stop). After `setMine off` on such a node, its haulers finish their current trip and then go elsewhere or idle; they never pick it again while it stays unmarked.
- [ ] Choose how an unmarked asteroid's leftover buffer is treated: either it is drained, or Mine-marked nodes only are assignable. Apply the choice consistently.
- [ ] Add a test in `field.test.ts`: capture p1, run until a hauler is on it, turn its mark off, and assert that no hauler targets p1 once the in-flight trip ends and that ice deliveries stop. Add a test for the asteroid-buffer choice as well.
- [ ] Correct the F6 spec-reading bullet in DECISIONS.md ("may pick the same node again if it is the only one worked") to the rule actually implemented.
- [ ] Re-run the gates. The red set must stay exactly the 7 bots and client files listed above.

VERDICT: REJECT

## Round 2 · 2026-11-14

Reviewed `git diff 325356f..d828ea5`.

**Pillar fit.** Stop now means stop. Only Mine-marked rocks can be assigned haulers (`isHaulable`), and the assignment and keep rules both use it. A hauler waiting at a rock whose mark goes off loads what is there and flies home at once. An unmarked rock's leftover buffer waits until the rock is marked again. The Director made the buffer choice, and DECISIONS records it with the reason: a rock with assigned haulers stays a raid target (R5). The immediate departure is a reasonable reading of F12's "finish their trip" and is logged too. Neither changes the game beyond the spec's intent.

**Verification.** I re-ran my round 1 scratch script on d828ea5:
- p1 is captured with one hauler, then Stopped. Only the 4 ice already in the hold is delivered after Stop, and the hauler's target goes to null.
- With a1 and a2 also worked (three haulers), every hauler moves to a1 or a2 and p1 delivers nothing more.

Before the fix, the single-hauler case delivered 40 ice over the same 6000 ticks. The four new `field.test.ts` cases cover the following, and the author reports all four fail on a511610:
- Stop on p1 alone;
- Stop on p1 with other rocks worked;
- Stop on the hive;
- an unmarked asteroid's buffer.

`raid-hook.test.ts` now marks p2 for its pin. That is a correct consequence of the new rule, not a loosened test.

**Round 1 required changes:**
- [x] Haulers are never assigned to, or kept on, an unmarked rock with free extractors.
- [x] The asteroid-buffer rule: only marked rocks are assignable, and it is tested.
- [x] Tests for both.
- [x] The DECISIONS F6 bullet is corrected (struck through, with the correction beside it) and a round 2 entry added.
- [x] Gates re-run: same red set (below).

The round 1 non-blocking notes are also done:
- Save validation now covers each economy ship's `at`, `transit` and cargo, plus `mine`, `free` and the `rockBuckets` rings, with 13 corruption cases and two valid baselines.
- The replay's recycle check no longer compares a value with itself.
- A `Readonly` overload of `bayOf` removes the cast.

**Gates (run by me on d828ea5, `npm run gates -- --base main`):**
- typecheck, lint, determinism and protected-files pass. The determinism final hash is still 648970fd: the replay's only Stop already ended that wait the same tick, so the hash is unchanged.
- The test gate fails with 41 failures out of 673 tests, in exactly the same 7 files as round 1:
  - bots: `needs-driven`, `runner`, `waves`;
  - client: `h4-client`, `h5-client`, `h6-client`, `session`.
- The bots gate fails fast on the `runCampaign` field-mode guard.

That is the stack's expected red set, and nothing in `packages/sim` is red.

**Note for the stack (not an h7-sim change).** h7-raids' R5 counts "assigned hauler". A hauler flying home from a Stopped rock keeps its target until it reaches the probe. h7-raids should decide whether that hauler still makes the rock a raid target, and test it.

Required changes: none. This merges only as part of the stack, through `merge-task h7-client`.

VERDICT: APPROVE
