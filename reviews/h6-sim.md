# h6-sim

## Round 1 · 2026-11-08

Scope: `git diff main...task/h6-sim` at 1a4c0fe (two commits: 821575f, the sim, and 1a4c0fe, out-of-scope call-site updates). I checked it against BACKLOG "### h6-sim" and DESIGN.md H6: "The overworld", "Areas", "Area guards", "Fleet limit, relays and band locks", "Repeat hauls", "Scouting", "Research", "Removing the Root", "Tunables (H6 …)" and "Save, data version and replay". This is on the stacked merge path (DECISIONS.md "h6-client stacks on h6-sim", a948a53), so this verdict is on h6-sim's own work and is not a merge on its own.

**Gates (run by me on 1a4c0fe, `npm run gates -- --base main`):**
- **FAIL typecheck** (one error), **FAIL test** (4 tests and 1 suite), PASS lint, PASS determinism (30 checkpoints over 9000 ticks, final 0ebc8bab), PASS bots, PASS protected-files (40 files, none protected).

**Are the client failures only the expected ones? Yes.** Every failure is in `packages/client/test`, and each one pins data v9's shape:
- typecheck: `h5-client.test.ts(74)` indexes `research.fleet.step`, which v10 removes.
- `h5-client.test.ts` fails at load: `campaignWorld` lands Spore Veil from `['landfall','shelf']`, which isn't lane-open on the v10 map. The whole file is unrun here, so h6-client has to make every test in it pass or retire its Command limit tests for the stated reason, not only the ones that fail now.
- `h4-client.test.ts`, 4 tests:
  - `openedByReclaim` expects Spore Veil after Frost Shelf; Rime Relay is the new neighbour.
  - guarded rows expect Spore Veil `hasRoot` (the Root was removed).
  - hops expect The Deep at 3 (it is 4 now).
  - "fits the six areas on 375x667 with nodes ≥ 44 px" measures 35 px on the 2100-tall frame. This is the real phone rule that only h6-client's pan can meet, as the decision says.
- None is a sim regression. Every sim, bots and other client test passes: 511 pass in total, including the H2/H3 Root rule tests on the frozen fixtures, `fleet-off.test.ts`'s golden hashes, and `session.test.ts`.

**Acceptance:**
1. **Met: data v10.**
   - I checked `data/sim.json` against every H6 table row by row: ten areas (positions, nodes, haul, export, `side`, `relay`), the 16 guard rows, the 14 lanes, research (no Command limit), and the tunables (`fleet.relayStep` 8 / 4–12, `areas.repeatHaulPct` 50 / 0–100, `overworld.bandLock` 1 / 0–1; `research.fleet.step` removed). It also matches the frame. No area lists `root`, and `dataVersion` is 10.
   - `parseSimData` validates `side` and `relay`, rejects a relay outside tiers 1–2, rejects an area outside the frame, enforces the H6 haul invariant with per-area flooring, and rejects the `fleet` item and kind `limit`. All of these are tested in `data-h6.test.ts`, including a 33% case that shows why per-area flooring matters.
   - One check goes beyond the spec: a band locked by default must have a relay in the band below. It's justified and logged in DECISIONS.
2. **Met: rules (`h6.test.ts`, on the frozen `sim-v10.json`).**
   - `fleetCap(world, data) = cap + relayStep × commandedBands`. A second relay in a band adds nothing, either side commands the band, and it follows `fleet.cap` and `fleet.relayStep` live across their ranges.
   - A relay reclaimed in an area raises the limit only from the next landing. I agree with the derivation (exclude the active area): you can't re-enter a reclaimed area, so the only reclaimed active area is the current visit's.
   - `bandOpen` and the `enterArea` lock work, with `lockReason: 'bandLocked'`, proven by a refused input and then an open one after a relay is reclaimed by play.
   - Repeat decay at reclaim records `haulPaid` (area record, visit stats, `runSummary`, `campaignSummary`). The first of a pair is never a repeat, and side `none` and a different band never decay. Exports don't decay.
   - Edges: `overworld.bandLock` 0 (live, both ways), `areas.repeatHaulPct` 0 and 100, `fleet.cap` 0 (relays still command and open bands), and a haul that doesn't divide evenly (33%: 66 / 19 / 6 and 99 / 19 / 13).
3. **Met: selectors.**
   - `overworldStatus` and `areaFrontier` give known, open, locked, relay, band, commanded and `haulNow`, plus lockReason, unlockRelays, haulDecayed, repeatOf and capAfter. `fleetStatus` gains commandedBands and maxCommandedBands.
   - Tested cases: a far area two lanes out (Rime Relay after Landfall: unknown, reason `lanes`, band 1 not locked); a known but locked area (Spore Veil with Thorn Garden held, locks on, no relay: `bandLocked`, naming Rime and Glint); capAfter before and after a band is commanded.
4. **Met: the Root.**
   - A shipped-data test asserts no area includes it, while the frame and H3 layouts keep it.
   - The Root rule tests pass on the v4 and v8 fixtures.
   - Command-limit and Root-cut shipped-data tests are retired or moved to fixtures.
   - The Deep without the Root, in all three layouts: no Root node, `rootIndex` −1, fed with no starved counts, held at fed caps over 3 minutes. Tested on the fixture and on shipped data.
5. **Met: data tests.**
   - `data-h6.test.ts` reads the H6 tables from DESIGN.md.
   - The H4 and H5 table tests check fixtures only, except the H4 Tunables table, which H6 doesn't change.
   - The dated "Superseded at data v10" notes are under the H4 and H5 tables, and the `dataVersion` pin is 10.
6. **Met: reference replay.** It covers every item in the spec's list:
   - Landfall;
   - a relay reclaim from a `campaignWorld` start with both designs (Glint, then Spire);
   - a band 2 landing at the raised limit (Spore Veil at 12, The Deep at 20 with `fleet.cap` 4);
   - a band-lock refusal at tick 272;
   - repeat hauls (Glint after Glass Shoal, Spire after Thorn Garden);
   - a yard at the limit;
   - `recycleShips`;
   - captures.

   `reference-replay.test.ts` asserts each of these rather than just running them. The hashes are re-baselined, and determinism passes.
7. **Met under the stacked path:** gates are green except the client tests above.

**Determinism.** Integer only. Areas, lanes and relays are walked in data order, and the repeat check walks `reclaimOrder`. There's no new stored state except `haulPaid`. Save validates it, and a round-trip test checks the hash and rejects a malformed record or missing stats. The new behaviour is in the reference replay.

**Data.** Every new tunable is in `data/`, and `dataVersion` was bumped to 10.

**Out-of-scope edits (1a4c0fe).** They're reported in the commit and in DECISIONS.
- The changes in `bots/src/{runner,strategies,waves}.ts`, `client/src/{main,sheet,worldsheets}.ts`, and the bots and client tests are mechanical. They follow the API change (`fleetCap`, `isFleetFull`, `yardStatus` and `landingEffects` now take `data`).
- Two probe changes are needed for correctness: `probeLimits` now uses `fleet.relayStep`, and `hasRoot` is read from the area's nodes because The Deep has no Root.
- No client test was loosened. `session.test.ts` now derives The Deep's heart index instead of hard-coding 15, and that index really changed.
- These files are h6-bots' and h6-client's, but both branch from this branch, so nothing collides. I accept them.

**Findings for the Director (not h6-sim defects, but they affect the merge plan):**
- **The bot gate's PASS here is not evidence.** H5 flag 1 is MISSED: composer, ice-first and crystal-first time out at 120 game minutes on every seed. The bands 2 areas are recorded closed, then a single forced timeout, then the campaign cap. Only `greedy` wins. The gate fails only on a *softlock*, a second visit timeout, so a campaign-cap timeout of a winning strategy passes. That's expected before h6-bots and h6-design-data. But under a948a53, h6-sim and h6-client merge to main *before* h6-bots, so main will have a green bot gate while no winning strategy can finish.
  - Don't hand off a build from that state.
  - I recommend a backlog item to make a campaign-cap timeout of a `WINNING_STRATEGIES` run a bot-gate failure. That strengthens the gate rather than weakening it, and it's not protected (`packages/bots/src/cli.ts`).
- **Deprecated shims to remove later.** `RESEARCH_IDS` keeps `fleet`, `ResearchKind` keeps `limit`, `missing.capOff` stays, and `FleetStatus.level` and `maxLevel` are always 0. They're kept, marked `@deprecated`, so the H5 client compiles. h6-client can't delete them, because they're in `packages/sim`. They need a backlog item once h6-client stops using them, alongside `cw-root-code-removal`. The bots' Command-limit policy entries, now inert, belong to h6-bots.
- **The band lock never refuses a reachable area on the shipped lanes.** Band 2 touches only band 1 relays, and The Deep only band 2 relays. It's already logged for the Designer in a948a53. I note it because it means `overworld.bandLock` 0 is a display-only A/B on this map.

**Code quality.** Clear and consistent with the codebase. The derivations are small and documented. `isAreaOpen` now means enterable, and `isLaneOpen` keeps H4's rule, which is a good split. The index.ts API notes are updated. There's no dead code apart from the deprecated shims above.

**Phone.** Not browser-facing beyond data and the replay. The 44 px node rule is h6-client's, and it's the expected failing test above.

Required changes: none for h6-sim. Merge only with h6-client, per a948a53. h6-client's review has to confirm that the five client test failures listed above are fixed without loosening.

VERDICT: APPROVE
