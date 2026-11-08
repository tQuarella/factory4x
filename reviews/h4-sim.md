# h4-sim review

## Round 1 · 2026-11-08

Pillar fit: The change does what the H4 spec ("Reclaim ladder") asks and nothing more.
- One `World` now holds `campaign`, which covers the overworld, areas, lanes, research, stockpile and shipments. The existing top-level fields hold the active area.
- Inside an area the H3 rules are unchanged, except for the research effects, the design gate and the area's node subset, as specced.
- The only change to a default is `economy.startStock` 30 → 40, as the spec says. It is now read at every landing and is no longer new-run-only.
- Nothing changes how the game plays beyond the spec. The interim client starts in The Deep through a constructed campaign. The BACKLOG allows a temporary hook, and DECISIONS.md explains why it is The Deep and not Landfall: the H3 UI and smoke suite assume the full field. h4-client removes it.

Acceptance:
1. Rules (`campaign.ts`, `world.ts` `landArea`/`clearArea`, `step.ts`, `inputs.ts`). All integer, with fixed data order and no RNG.
   - Landing follows steps 1–6 in spec order: frame-ordered nodes, full guardians, opening ore from live `startStock` plus Opening ore, yards on per design, seed rigs on a1/a2 with a level-1 route, and the visit record.
   - The reclaim pays the haul once from rule 8. A withdraw clears the area and keeps research and the stockpile.
   - Rule 10 runs after stats and only while `isShipping` is true. The extraction accumulator is rescaled to `×(100+L·step)` against `T·100`, which is identical at level 0. Fast yards has a floor of 15.
   - The design gate is in `startShip`, and `setShipyard` stays valid. The core sets `wonTick`, after which only `setTunable` is accepted.
   - The overworld step is rule 1 plus `tick+1`.
   - A heart with no Root gets `starvedCounts` null and `fed` true. The only place that sets `fed=false` is the Root capture, and these areas have no Root.
   - The wave-dedupe change in `step` handles a landing or a leave in the same tick, using a 0 baseline when the guardian array changed.
2. Data and validation. `data/sim.json` is at v6 with `map.areas`, `map.lanes`, `research` and the five new tunables with their ranges. `parseSimData` validates frame ids, probe and heart, pocket and Root entries against the nodes present, starved counts only with a Root, The Deep having every node, lanes, research requirements, and Σ haul ≥ Σ cost per resource at the `costPct` max. Each of these has a rejection test in `data-h4.test.ts`.
3. Spec tables. The data tests parse the DESIGN.md "Areas", "Area guards", "Research" and "Tunables (H4)" tables and both totals lines, the same way the H3 test does. The H3 table tests still pass.
4. Selectors. All of these exist: `campaignStatus`, `areaStatus`, `researchStatus`, `landingEffects`, `campaignSummary`, the `yardStatus` states `needsDesign` and `noSource` (ordered before `off`), and an area-relative `runSummary`. The tag-column test checks 14 cells, including both starved hearts and the bracketed percentages.
5. `campaignWorld` is exported. It throws on an unknown area or item, an out-of-range level, or a landing in an area that isn't open.
6. Unit tests (`campaign.test.ts`) cover every item on the list:
   - Landfall falls to one drone in under a minute.
   - Shipments are exact to the tick, carry their remainder, and work at 0%, 100% and 150%.
   - `costPct` rounding at 33% and 25%.
   - Save round trip, refusal of a v5 save, and refusal of a malformed campaign shape.
   - The tests are specific and check exact numbers.
   - The H3 suites (sim, bots, client) now run through `h3World`. The min-wave tables are unchanged, which shows The Deep at defaults plays as H3.
7. Reference replay. It plays a campaign: Landfall, buying research, Frost Shelf with a withdraw and a re-landing, Spore Veil (the design gate, a repel, the Root cut and wilt), Thorn Garden, then a landing in The Deep with rigs and Fast yards. It uses every input type and has exactly one invalid input. It is in an area at tick 3000, so the smoke test and the determinism gate both land. The hashes are re-baselined.
8. Interim bot gate. The runner starts from `INTERIM_DEEP_START`. My run, heart capture against the H3 v5 table:

   | Layout | drones-only | ice-first | crystal-first | greedy |
   | --- | --- | --- | --- | --- |
   | Frost Gate | 24:50 (H3 25:17) | 20:11 (20:40) | 20:01 (20:27) | 19:18 (19:33) |
   | Glass Thicket | 27:25 (27:51) | 21:31 (21:58) | 21:16 (21:45) | 21:16 (21:45) |
   | Twin Seams | 25:00 (25:27) | 19:27 (19:42) | 18:47 (19:16) | 19:27 (19:42) |

   Every game is 15–29 s faster. That is consistent with the 40-ore opening (10 more ore, about one drone sooner) and shows no regression. The depth flags are as on H3: flags 1, 2, 3, 5 and 6 are met, and flag 4 is missed on the same knife edge as before. No data was retuned.

Determinism: There is no wall clock, `Math.random` or transcendental math, and lint passes. Areas, lanes, research and resources are walked in data or fixed order. `Object.keys` appears only in validation and error paths. The hash covers `campaign`, and a test shows it. `nextId` carries across areas, which is deterministic. A landed Deep at tick 0 has the H3 ids.

Quality: The code is clear, follows the codebase's conventions, and has no dead code. DECISIONS.md logs every non-obvious reading.

Gates: I ran `npm run gates -- --base main` on `task/h4-sim` at 7cbdd29, and every gate passed: typecheck, lint, test (15.0 s), determinism, bots and protected-files (29 files changed, none protected). I also ran `npm run build && npm run smoke`, and all 42 tests passed on desktop and at 375x667, including the autosave and replay reload test and the H3 send-panel flow. Branch CI run 42487574177 was still in progress when I reviewed. It must be green before `merge-task`.

Phone: The only client UI change is two yard-state strings, and the smoke tests pass at 375 px.

Required changes:
- None.

Non-blocking notes (for the Director; not conditions of this approval):
- Spec text: the H4 spec says "7 items, 14 levels" and "at most 14 entries", but its own table has 13 levels. It also says the campaign adds "under 1 KB" to a save, but the spec's field list gives about 1.7 KB, and a test pins it under 2 KB. Both are reported in DECISIONS.md. The Designer should correct DESIGN.md. Neither changes play.
- `landingEffects(world)` doesn't take the `data` argument the spec lists. It has no use for it, so h4-client should call it without `data`.
- The reference replay runs on the shipped data. If h4-design-data changes area guards or research costs, the replay script may need re-recording. Its test says so, and h4-design-data should plan for it.
- `overworld.ts` `areaLayout` repeats the `layout === 'seed'` lookup from `landArea`. It is small, but a shared helper in `world.ts` would keep the two from drifting.

VERDICT: APPROVE
