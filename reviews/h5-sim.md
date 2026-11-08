# Review: h5-sim

## Round 1 · 2026-11-08

Reviewed `task/h5-sim` at 93699f3 against main (fe7e41a): the H5 spec in DESIGN.md ("H5 ... Fleet cap"), the h5-sim backlog entry, and the full diff (28 files).

Pillar fit: This is the H5 engine slice the owner picked (Q17 "A. Fleet cap"). It adds no player-facing behaviour beyond the spec. The limit, Recycle and Command limit follow the spec's rules. `fleet.cap` 0 gives H4's rules, and I verified that claim myself (below). Until h5-client lands, the cap is on by default with only placeholder UI, but main between tasks is not a handoff build. The Director must not hand off before h5-client and h5-design-data merge.

Acceptance:
1. Rules, all in integer math with fixed orders and no RNG:
   - `fleetCap` is derived and returns null at 0. `fleetCount` is `ships.length` plus yards with `ticksLeft > 0`.
   - `startShip` checks `isFleetFull` before the ore and component checks, and the count is recomputed per start. A capped yard returns false, so `yardTurn` is not advanced (it keeps its turn).
   - Nothing removes ships.
   - `recycleShips`:
     - It is validated in `validAreaInput`, so it is only valid in an area and before the win.
     - It is refused at a living guarded node (`isGuarded` checks `alive`).
     - It clamps through `clampSendCounts`. That clamp uses `s.at === node`, and in-transit ships have `at === null`, so ships in transit are excluded.
     - It removes the lowest ids in order and refunds `floor(cost × pct / 100)` per ship.
     - It records `stats.shipsRecycled` and `stats.oreRefunded`, and does not count the ships as lost.
   - The `limit` kind is enforced both ways in `parseSimData`. `{tier, count}` is validated against the data's tiers and areas. `buyResearch` refuses a limit item while `fleet.cap` is 0.
   - `capAtSend` is set at `newBattle` and refreshed by attack orders into a running battle. It reaches `lastBattle`/`BattleResult`.
2. Data:
   - `data/sim.json` is v8, with the three tunables and their ranges and the three Command limit rows.
   - The v8 hauls match the spec table.
   - The Σ haul ≥ Σ cost check now covers Command limit; the totals are 2120/340/340 against 2100/340/340.
   - The version pin moved to `data-h5.test.ts` and is logged.
3. Data tests check `data/sim.json` against the updated H4 "Areas" and "Research" tables and both totals lines (the table parser now handles per-level requirements). A new test reads the H5 "Tunables" table. The H3 and H4 table tests still pass.
4. Selectors:
   - `fleetStatus` and `recycleRefund` are present.
   - `fleetFull` sits after `off` and before `needsComponent`, and a test pins the order.
   - The `researchStatus` row has `missing.tiers` and `missing.capOff`.
   - `landingEffects.fleetCap` is present.
   - `campaignSummary` and `runSummary` carry the recycle totals.
5. Unit tests (`fleet.test.ts`) cover every listed case with real assertions:
   - the yards stop at the limit, with an invariant check on every tick;
   - a ship being built counts;
   - one slot with two idle yards, including that the capped yard keeps its turn and starts first after a recycle;
   - losses free slots;
   - live lowering and raising of the limit;
   - cap 0 means no limit, and Command limit can't be bought (`capOff`);
   - each level raises the limit by the step, at three (cap, step) pairs;
   - every tier requirement case, including "tier ≥ T" counting The Deep;
   - recycle at a guarded node, in transit, with a zero total, and refund rounding over 7 (cost, pct) pairs;
   - the save round trip and a v7 save refused.
6. Reference replay:
   - It adds a Command limit purchase, landing with limit 10, `fleetFull` pauses, a 6-drone recycle and a Garden capture with `capAtSend` 10. Its test asserts each of these.
   - The `recycleShips` input type is in the every-input check.
   - The determinism gate is a self-consistency check with no stored hashes, so it needs no re-baseline. It passes.
   - Deviation: the purchase comes from the replay's own reclaimed Frost Shelf, not a `campaignWorld` start. It is logged in DECISIONS.md with a sound reason (the gate and the smoke test run the replay from `createWorld`).

The A/B claim, checked independently. `fleet-off.test.ts` compares 60 golden hashes (a 300-plus-ship Deep game and a campaign with research, reclaims and withdrawals) with the H5 fields stripped. I checked out f55f52f (main's code plus only this test file) in a scratch worktree and ran it. Both golden-hash tests pass on the H4 code. The only failure is the "fixture has no fleet limit" premise, which is expected because the tunable doesn't exist on main. HEAD has no diff to the file since f55f52f. So `fleet.cap` 0 reproduces H4 state exactly.

Determinism: `Math.floor` is used on integers only. Ship removal is an order-preserving `filter` over id-ordered ships. Tier counting walks areas in data order. There is no new state outside the world, and the limit and count are derived. Lint passes.

Data: Every new number is in `data/`, and `dataVersion` went from 7 to 8. The frozen v8 fixture is byte-identical (as JSON) to the shipped v8 data; I checked. The v4 fixture gained the three tunables with `fleet.cap` 0 and no Command limit, which keeps every older rule test on H4's rules. Making `fleet` an optional research id in `parseSimData` slightly loosens validation of shipped data. `data-h5.test.ts` pins that the shipped data has it, so this is acceptable.

Scope: The client edits are compile-only, as allowed. `runner.ts` runs the H4 strategies with `fleet.cap` 0, which is logged; the spec retires them to a cap-off reference anyway. The one-line smoke-test edit (`fleet.cap` 0 in the H3 play-through) is outside the listed files, but it is logged and justified, because the test is about H3 counters. DESIGN.md is edited only in the permitted tables, with dated notes. No protected files are touched.

Gates: I ran `npm run gates -- --base main` on 93699f3. Typecheck, lint, test, determinism, bots and protected-files all passed (28 changed files, none protected). In the bot report, all 15 H4-strategy runs bought the core with the cap off, and flag 7 (determinism and replay) is met. I also ran `npm run build && npm run smoke`, and all 76 tests passed on desktop and at 375x667. Branch CI: the run for the WIP commit failed (the smoke issue that 93699f3 fixes). Run 42503873670 on 93699f3 was still in progress at review time. It must be green before `merge-task`.

Phone: There is no new UI. Smoke passes at 375 px.

Required changes:
- None.

Non-blocking notes (for the Director and h5-client; not conditions of this approval):
- Interim research sheet on main until h5-client lands:
  - `fleet` is not in the sheet's `order` list, so `indexOf` returns -1 and the item sorts above Probe core.
  - It renders as a grind row with no icon.
  - `researchBlock` (`report.ts`) knows nothing about `missing.tiers` or `missing.capOff`, so a disabled Command limit button reads "Research" when a tier requirement is unmet.

  h5-client must fix all three (the card belongs in the meaty-step group), and must not hand off before then.
- `fleetStatus` takes `(world, data)` and returns an extra `buildingByType`, and the area record has an extra `oreRefunded`. Both are logged deviations, and h5-client and h5-bots should use them as written.
- The `capAtSend` expectation in `reference-replay.test.ts` uses `.replace('10', String(limit))` on literals where `limit` is already 10. It works, but it would read better built from `limit` directly. This is cosmetic.

VERDICT: APPROVE
