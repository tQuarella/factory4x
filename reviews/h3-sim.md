# Review: h3-sim

## Round 1 · 2026-11-07

Reviewed commit 2104a1a (local `task/h3-sim`: cecf3db, 070acc0, 095b6ba, 2104a1a) against `main`, in a fresh detached worktree with `npm ci`.

Pillar fit: The change implements the H3 "Counter web" sim as specced. It covers the 16-node field, the three layouts, five resources, the assemblers, three yards, two-type counter combat and the Strong/Even/Weak readout. It adds no player-facing behaviour beyond the spec. The client and bots were changed only enough to keep main playable and the gates honest. The client still has only the drone yard and draws pockets as asteroids and Spores as Thorns. That is a playable, drones-only interim until h3-client lands, not a design change.

Quality:
- **Rule fidelity (step.ts, world.ts).** I checked every rule against the spec:
  - 5a: lens, then plating. Decrement, complete, then restart on the same tick. Ore check is `stock.ore − Σ queue.cost`. The stock cap is respected.
  - 5b: lancer, flak, drone. A ship spawns with its type's hp and flies to the rally. A yard starts only with free ore and, for lancer and flak, a component.
  - 7: per-type pools in the order lancer, flak, drone. Target orders, overflow in id order, the conversion back with `floor(effLeft × 100 / pct)`, drones at 100 over all guards in id order. Guard damage is from start-of-round state. Repair is per type and starved for the heart.
  - 8: pocket, Root and heart captures. The wilt removes the newest guard of each type down to `capEff(starved)` and resets both regrow progresses. Zero-cap nodes fall to the first ship.
  - 9: regrowth per type, with the starved multiplier on the period.
  - `capEff = min(60, floor(n × capPct / 100))`, live from the stored layout counts.

  The input changes (`setShipyard {shipType,on}`, and `sendShips {counts}` with per-type clamping, the lowest ids first, and one wave per node per tick) match the spec table.
- **Declared departure (empty type group passes the pool on unconverted).** Accepted. At the shipped defaults it is behaviour-identical. The strong group is always first in the target order, and 200% round-trips exactly. The weak group is always last, so its conversion back is never used. The departure only differs at non-default `counter.strongPct` values such as 150, where the literal spec would silently lose damage through a group it never touched. It is logged in DECISIONS.md and has a test (combat.test.ts).
- **Determinism / integer math.** No RNG use (`world.rng` is untouched), no wall clock, no transcendental math. Every division is floored integer division with the division last. Every per-type loop runs over a fixed const order (`YARD_ORDER`, `COMBAT_ORDER`, `GUARD_TYPES`, `COMPONENTS`). Entities live in id-ordered dense arrays. No object-key iteration affects state. Both the save format and the hash cover all of the new state.
- **Data.** `dataVersion` is 4. The 16 nodes, the three layouts and every tunable key, default and range match the spec tables. data.test.ts checks this and the 160 su spacing. All removed keys are gone, and `map.variants` is replaced. `parseSimData` rejects zero divisors and malformed layouts.
- **Selectors.** All present: `weightedMultPct` / `counterTag` (hp-weighted, integer, division last, drones always Even), `yardStatus` and `assemblerStatus` with reasons, `prizePerMin`, `unlockStatus`, and `runSummary.captures`. The rest are by-type stats and first-delivered times.
- **Edits outside the file list** are minimal and justified:
  - client: renames and signature fixes, with interim strings marked for h3-client;
  - `tests/smoke`: node indices and names only;
  - bots: the two interim strategies the backlog allows; the H2 depth flags and the raid-supply test were removed because their strategies can't play H3.

  Nits, not blocking: `VARIANT_IDS` in runner.ts is now exported but unused, and the bots report prints an empty "Stubs …: ." line. h3-bots rewrites both.

Tests (acceptance 4): every listed case is covered with exact hand-computed numbers, not coverage padding:
- counter damage with overflow for lancer, flak and drone, plus resolution order and non-default multipliers (combat.test.ts);
- assembler and yard ordering, reservation and component scarcity (economy.test.ts);
- a pocket capture, then prize flow once routed and the unlocks (economy.test.ts);
- the wilt, newest first, including interleaved ids (guardians.test.ts);
- per-type and starved regrowth, and `capEff` (guardians.test.ts);
- `sendShips` clamping (inputs.test.ts);
- the save round trip mid-game with a starved heart and a mixed fleet, and refusal of a v3 save (guardians.test.ts).

Acceptance 5, the minimum waves, comes from the real sim at defaults (min-waves.test.ts). Each minimum is also verified as a real threshold: one ship fewer is repelled. Compared with the spec model, it matches everywhere except these cells (spec → sim):

| Layout | Node | Unit | Spec | Sim |
| --- | --- | --- | --- | --- |
| Frost Gate | p1 | drones | 14 | 13 |
| Frost Gate | p2 | drones | 13 | 15 |
| Frost Gate | heart | drones | 32 | 33 |
| Glass Thicket | p1 | drones | 14 | 13 |
| Glass Thicket | p2 | drones | 13 | 15 |
| Glass Thicket | heart | drones | 36 | 37 |
| Twin Seams | p1 | drones | 14 | 15 |
| Twin Seams | p2 | drones | 14 | 15 |
| Twin Seams | root | drones | 16 | 17 |

Every lancer, flak and best-mix number matches the model exactly. The spec headline still holds:
- a mix beats every single type on mixed nodes;
- the right counter beats drones;
- a starved heart needs about half the fleet.

Nothing was retuned.

Acceptance 6: the reference replay is Frost Gate at `guard.capPct` 50. Before tick 3000 it shows:
- a wave repelled at p2;
- p1 captured and routed, with ice delivered;
- plating assembled, then flak built;
- the Root cut with the wilt (10/14 → 3/3);
- the starved heart captured with flak in the wave.

Every input type applies, and exactly one input is invalid on purpose (reference-replay.test.ts).

Notes for the Director (not required changes for this task):
- **Tag readout vs the hypothesis.** The tag formula is implemented exactly as specced. But at defaults it reads Even for flak at Frost Gate p1 (148), where flak needs 8 ships to the drones' 13. It reads Even for both counters at the Frost Gate heart (148 / 76). The spec's success criterion 3 relies on these tags to guide ship choice. The engineer logged this in DECISIONS.md. Please add it explicitly to h3-design-data's scope: the thresholds, the weighting, or the layouts.
- **Pacing.** The interim bots capture the heart at 12–16 min, against the spec's 20–35 target. Light pockets take 13–15 drones. Both are calibration inputs for h3-bots and h3-design-data.
- **Branch CI.** This branch touches `packages/client/` and `tests/smoke/`, so per PROCESS.md branch CI must be green on the pushed head before `merge-task`.

Gates: `npm run gates -- --base main` passes on 2104a1a:
- typecheck and lint pass;
- tests: 222/222;
- determinism: 30 checkpoints over 9000 ticks, final hash 49fac464;
- bots: PASS, with every strategy and seed capturing the heart and no softlock. Tick p95 is at most 0.0034 ms against the 2 ms budget;
- protected-files: PASS, with no protected file touched.

`npm run build` passes, and `npm run smoke` passes 38/38 at desktop and phone (375x667), including the wide-font notices checks and the cross-engine determinism check.

Required changes:
- None.

VERDICT: APPROVE
