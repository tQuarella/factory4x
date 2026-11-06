# Review: m1-sim

## Round 1 · 2026-11-06

Reviewed `git diff main...task/m1-sim` (commit 6605c71) and all touched files in full: `packages/sim/src/*`, `packages/sim/test/*`, `data/sim.json`, `packages/bots/src/reference-replay.ts`, the one-line `packages/client/src/main.ts` fix and the `DECISIONS.md` entries. main has moved on (m1-art) since the branch was cut; that is not part of this review.

Pillar fit: This is the H1 rule book. It adds no mechanics beyond the spec. Every spec ambiguity is resolved toward the stated intent and logged in `DECISIONS.md`: a1's length is 247 by the floor rule (the table says 248, and the cost is 9 either way); the order in which the throughput bucket is cleared; battle-end timing; `wavesSent` counting only `sendShips` orders; and edge cases from live tuning. The scripted wave test checks pillar 2 ("risk scales with reward") and pillar 3 (guardian factories) against the model. At defaults, waves of 26 or fewer are repelled. 27 captures, one below the "about 28–35" estimate, and the test reports this without retuning. 28 ships lose 15 and 35 lose 10, which matches the Designer's model exactly. A trickle never captures. With `regrowTicks` 30, the smallest capturing wave is 32 (the model said about 35). Regrowth is still the lever.

Rule fidelity (checked line by line against "Rules per tick"):
- **Order.** Rules 1–11 run in the stated order in `step`. Combat, capture and regrowth are skipped once the Bloom is dead.
- **Construction.** The head of the queue is paid and started on the same tick a build finishes. Upgrades use `route.buildTicks`. Extractors set `owned`.
- **Extraction and routes.** Accumulators are integer, with T = 1800. Ore over the buffer cap is lost. Pods launch `min(buffer, level × podOrePerLevel)` and take `ceil(length / podSpeedSu)` ticks counting the launch tick, then deliver to stock and to bucket `(tick / tickRate) mod 60`.
- **Shipyard.** It reserves `Σ queue[].cost` before paying for a ship. A ship spawns and the next one starts on the same tick, so the yard caps at 20/min. A ship in progress finishes when the yard is switched off. Rally transit starts at once.
- **Combat.** Both sides resolve at once from counts at the start of the round. Overflow goes in id order, repair happens on every round tick, and distinct ships are counted with `engagedIn`. `repelled` and `withdrew` are distinguished correctly.
- **Capture and regrowth.** Free extractors are `min(rich.freeExtractors, slots)`. Regrowth progress resets at the cap.

Input validity matches the table, including "built, active or queued" for extractors, routes and upgrades. Upgrade cost uses the target level (20, 40, 60, 80).

Determinism: no wall clock, `Math.random` or transcendental math in the sim. Distance is an integer Newton `isqrt`, and division is `Math.floor` on exact integers. All entity storage is dense arrays kept in id order. The only `Map` (in `replayHashes`) is used for lookups and never iterated. Live tunables are in `world.tun`, so they are hashed, saved and in the input log. The hash canonicalizes sorted keys, and a test shows it doesn't depend on key insertion order. The reference replay uses every Input type plus one deliberately invalid input. It reaches a repelled wave at tick 1110 and a capture at tick 2040, before the 3000-tick browser check, and then builds out the rich node. So the determinism gate and the cross-engine smoke check now cover combat, capture and live tuning.

Data: all 30 tunables are in `data/sim.json` under their dotted keys, with their ranges and `map.nodes`. `dataVersion` is 2. `parseSimData` rejects missing or unknown keys, out-of-range defaults and a bad map. `tunableMeta` exposes key, section, default, min, max, live, scope and newRunOnly.

Public API: `index.ts` documents and exports `createWorld`, `step`, `worldHash`, `replayHashes`, `serializeWorld`/`deserializeWorld`, `isCaptured`, `isValidInput`/`inputCost` for greying out buttons, and selectors for every observable value in the sim: throughput, income, ships/min ×10, ship counts at and en route per node, node status (buffer, backedUp, noRoute, route level and capacity), queue, shipyard, guardian (thorns vs cap, regrow progress, per-thorn hp), combat rates, battle and last battle, and run summary. Values that need a decimal place are integer tenths, which is consistent and logged. `deserializeWorld` returns `{ok:false, reason:'dataVersion'}` instead of throwing, which suits the client's toast. `step` and `replayHashes` also refuse data from another version.

Tests: the tests are meaningful and pin exact numbers. Each validity rule has an ignored/applied pair, and the ignored case asserts that the hash is identical to a step with no inputs. The tests cover extraction and the buffer cap, pod timing and delivery, FIFO order and head blocking, ore reservation ahead of the yard, the shipyard's yard limit and income limit, combat round resolution and overflow, repair, regrowth to the cap, capture, a mutual wipe, the stats window, the autosave round trip (identical hash, then lockstep), and refusal of a mismatched version or a corrupt save.

Gates: I ran `npm run gates -- --base main` on the branch myself. All six passed: typecheck, lint, test (78/78), determinism (30 checkpoints over 9000 ticks, final hash 35d8f54c), bots, and protected-files (20 changed files, none protected).

Performance: the bot strategies are still no-op stubs (m1-bots fills them in), so the bot gate's p95 is measured on an idle world. To check the budget myself, I ran a busy scripted 30-minute game with the full network and a wave every 100 s: 244 ships built, 14 waves sent. Tick p95 was 0.0014 ms against the 2 ms budget, and the worst tick was 0.68 ms. On the same world, a mid-battle autosave round trip gave an identical hash, and a set of invalid inputs were all rejected.

Quality: the code is clear and compact, and each rule function maps to a numbered spec rule. There is no dead code beyond a harmless defensive `ship.at ?? PROBE` in `startTransit`. The client and bots edits are minimal, as scoped. Protected files are untouched. Phone: no UI in this task.

Notes. These are non-blocking. I am not deferring a defect: each one is spec-conformant or cosmetic. They are listed for the Director and the Designer:
- `Pod` has no `totalTicks`, so the client interpolates pods from the current `route.podSpeedSu`. If the speed is tuned live while pods are in flight, their progress fraction can fall outside 0..1, and the client must clamp it. `Ship.transit` carries `totalTicks`; `Pod` could do the same in a later task.
- The spec says an upgrade's cost is "locked when queued", so cancelling an earlier queued upgrade leaves a later one priced for the higher level. For example, after cancelling the L2 order, the remaining 40-ore order builds L2. This follows the spec. If the Designer considers it a trap, it is a new backlog item.
- In the reference replay, the comment on the first wave says `count: 4`, but only 3 ships are at a5. That is fine, because sending more ships than are present sends them all, and the test pins 3.

Required changes:
- None.

VERDICT: APPROVE
