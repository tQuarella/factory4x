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
