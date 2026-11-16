# Backlog

Owned by the Director. Highest priority first. Each task has an id (used for its branch `task/<id>` and review `reviews/<id>.md`), an owner agent, and acceptance criteria.

## Milestone 0: Bootstrap

| Id | Task | Owner | Status |
| --- | --- | --- | --- |
| m0-deploy | Auto-deploy `main` to a public URL (Cloudflare Pages) | Director | **Done** 2026-11-06: https://factory4x.pages.dev |

Acceptance for m0-deploy: a push to `main` that passes all gates publishes `packages/client/dist` to a public URL; the URL is in `STATUS.md`; the smoke test passes against it at desktop and phone sizes.

## Milestone 1: First playable (H1, spec in `DESIGN.md`)

Four tasks, sized to fit the 12-launch budget. `m1-sim` goes first, because the other three build on its API. Then `m1-client`, `m1-bots` and `m1-art` run in parallel on files that don't overlap. Renderer for M1: Canvas 2D (decided by the Director so client and art can work in parallel on one draw-function contract; see `DECISIONS.md`).

| Id | Task | Owner | Status |
| --- | --- | --- | --- |
| m1-sim | All H1 sim rules, inputs, data and the sim API | core-engineer | **Merged** 277e237 (approved round 1) |
| m1-client | Playable phone client: map, sheets, HUD, controls, tuning, feedback, autosave | engineer | Building |
| m1-bots | rush and turtle strategies plus the capture-based report | engineer | **Merged** 4afda2f (approved round 2) |
| m1-art | Draw functions and style for every M1 entity, including the Bloom | art-direction | **Merged** 7205468 (approved round 2) |
| m1-toast-fix | Broken main: battle toast covered the Bloom on Linux CI (font metrics) | core-engineer | **Merged** dfdf62a (approved round 1) |

### m1-sim (core-engineer)

**Files:** `packages/sim/**`, `data/sim.json`, `packages/bots/src/reference-replay.ts`. It may make the minimal edit needed to keep `packages/client/src/main.ts` and `packages/bots/src/*` compiling after the API change, and nothing more there.

**Acceptance:**
1. Every rule in DESIGN.md H1 "Rules per tick" is implemented in the stated order, with integer math only. The world is plain serializable data. The data-oriented layout is the Core Engineer's call, logged in `DECISIONS.md`.
2. The `Input` union is exactly the table in "Player inputs", including `setTunable`. Invalid inputs are ignored with no state change, and each validity rule has a unit test.
3. `data/sim.json` holds every tunable in the "Tunables" table under its dotted key, plus `map.nodes`. `dataVersion` is bumped to 2. The sim exports tunable metadata (key, default, min, max, live-tunable flag) for the tuning panel.
4. Public API, documented at the top of `packages/sim/src/index.ts`:
   - `createWorld`, `step`, `worldHash`, `replayHashes`;
   - selectors for every value in "Observable values" that comes from sim state (throughput/min, ships per node, thorns vs cap, regrowth progress, battle summary, kill rate vs regrowth, node buffer/backed-up state, route capacity, queue, stats);
   - `serializeWorld` / `deserializeWorld` that refuse a mismatched `dataVersion`;
   - `isCaptured(world)`.
5. Unit tests cover: extraction and buffer cap; pod launch, travel and delivery; build queue order and ore reservation; shipyard rate; combat round resolution; regrowth to cap; capture; autosave round trip (serialize → deserialize → identical hash).
6. A scripted test (not a bot) builds a network, and shows that a wave of 26 ships at full Bloom is repelled and a wave of about 28–35 captures, at defaults. If the real numbers differ from the Designer's model, report them; do not retune.
7. The reference replay uses the new inputs and reaches a capture, so the determinism gate and the browser cross-engine check cover combat.
8. `npm run gates` passes, and tick p95 stays within budget with the bot suite running a 30-minute game.

### m1-client (engineer)

**Files:** `packages/client/**` except `palette.ts` and `placeholders.ts` (owned by m1-art), plus `tests/smoke/**`. It consumes the draw functions from `placeholders.ts` through the contract in m1-art.

**Acceptance:**
1. "Touch interactions" and "Observable values" in DESIGN.md H1 are implemented at 375 px portrait, with landscape usable. Every action is at most 2 taps from the map, with 44 px minimum targets and no drag, pinch or hover.
2. Pause and 1x/2x/4x are client-only. The sim steps at a fixed tick and rendering interpolates ships and pods between ticks.
3. The tuning panel lists every live tunable from the sim's metadata with −/+ steppers clamped to range, per-row reset and reset-all, and the result-panel toggle. Changes go through `setTunable`.
4. The feedback button pauses the game and builds a note with build version, data version and replay (seed + data + input log). It opens a prefilled GitHub issue link for `tQuarella/factory4x`, falling back to copy-to-clipboard when the URL is too long. The note is never sent anywhere automatically.
5. Autosave per DESIGN.md: every `client.autosaveSec` and on hidden, one localStorage slot, silent resume, a toast on data-version mismatch, and "New run" with confirmation. All storage access is wrapped in try/catch.
6. Includes cw-hud-version: show a short version (7-char sha) and keep the full one in feedback metadata.
7. The smoke tests are updated and extended at desktop and phone sizes: the page loads with no console errors; tapping an asteroid opens its sheet; queuing an extractor changes the queue; pause stops the tick counter; the browser-vs-Node replay hash check still passes. `npm run gates` and `npm run build` pass.

### m1-bots (engineer)

**Files:** `packages/bots/src/strategies.ts`, `runner.ts`, `cli.ts`, `packages/bots/test/**`. Not the reference replay (owned by m1-sim).

**Acceptance:**
1. rush and turtle are implemented exactly as in "Bot strategies (M1)", using only `Input` commands. greedy-expansion and raid-supply stay as clearly labelled stubs.
2. The runner treats capture as `won`. The report has every field in the spec's "Report" list, and the summary flags strategies that never capture or miss the bot tuning targets. Missing a target is a flag in the report, not a failing gate.
3. Crash, softlock and the tick budget still fail the gate. Softlock detection is redesigned so constant probe mining can't hide a stalled game: no ore delivered and no ship built for 5 game-minutes before capture counts as a softlock.
4. Unit tests for strategy decisions on hand-built world states. `npm run gates` passes, and the report shows the actual capture times for both strategies, without retuning.

### m1-art (art-direction)

**Files:** `packages/client/src/palette.ts`, `packages/client/src/placeholders.ts`, `ART_STYLE.md`, `assets/`.

**Acceptance:**
1. Canvas 2D draw functions for every M1 entity, each centered at the origin with radius `r`:
   - `drawProbe(ctx, r, t)`;
   - `drawAsteroid(ctx, r, seed, extractors, slots)` with extractor pips;
   - `drawRichNode(ctx, r, t, captured)`, with the Bloom alive (pink coral) or withered (grey with teal ore showing);
   - `drawThorn(ctx, r, t, hpFrac)`;
   - `drawShip(ctx, r, heading)`;
   - `drawPod(ctx, r)`;
   - `drawRoute(ctx, x1, y1, x2, y2, level, backedUp)`;
   - `drawRallyFlag(ctx, r)`;
   - `drawHitFlash(ctx, r, frac)`.

   Signatures are exactly these, so m1-client can call them before m1-art merges.
2. The Bloom and thorns follow the Designer's flavor text and `ART_STYLE.md`. Every entity is distinguishable at 24 px on the space background. `ART_STYLE.md` gets a section for the M1 entities.
3. A static gallery page at `packages/client/gallery.html` (not linked from the game) draws every function at 24, 48 and 96 px, so the owner and the Critic can check readability.
4. `npm run gates` and `npm run build` pass.

### m1-toast-fix (core-engineer)

Broken main, top priority. On main 71cec57, CI on Linux fails "375x667 portrait › banner and toast never cover the rich node" on desktop and phone, with "#toast overlaps the Bloom". Linux's fallback monospace wraps the toast to more lines, so it grows up into the Bloom. It passes on Windows.

**Files:** `packages/client/index.html`, `packages/client/src/style.css`, `packages/client/src/main.ts`, `tests/smoke/boot.spec.ts`.

**Acceptance:**
1. Where the toast and banner sit doesn't depend on text metrics: with any font, wrap or text length, neither covers the Bloom or any other part of the map.
2. Controls stay at least 44 px. The toast is still dismissed with one tap.
3. The smoke test forces a wide font on the notices, so the check fails on Windows when the layout is wrong, matching Linux CI. It passes after the fix.
4. Gates, build and smoke (twice) are green.

## Milestone 1, iteration 2: H2 decision depth (spec in `DESIGN.md` → H2)

`h2-sim` and `h2-art` start together (art works only from the draw contract in DESIGN.md H2 "Flavor"). `h2-client` and `h2-bots` start once `h2-sim` merges, in parallel. If the bots miss the H2 targets, the Designer retunes the variants and starved defaults; engineers report numbers and do not retune.

| Id | Task | Owner | Status |
| --- | --- | --- | --- |
| h2-sim | Root node, supply link and wilt, starved Bloom, three variants, new tunables, data v3 | core-engineer | **Merged** dfdf62a (approved round 1) |
| h2-art | Root, vine and wilting-thorn draw functions; gallery; ART_STYLE | art-direction | **Merged** 6176e1f (approved round 2) |
| h2-client | Root sheet, vine and wilt on the map, banner and toasts, result panel, tuning, H1 carry-overs | engineer | **Merged** 624b1e0 (approved round 2) |
| h2-bots | raid-supply strategy, per-variant report and depth flags | engineer | **Merged** 3f5d5d1 (approved round 1) |

### h2-sim (core-engineer)

**Files:** `packages/sim/**`, `data/sim.json`, `packages/bots/src/reference-replay.ts`. It may make the minimal edits needed to keep `packages/client/src/*` and `packages/bots/src/*` compiling, and nothing more there.

**Acceptance:**
1. Every rule in DESIGN.md H2 "Rules per tick: changes from H1" is implemented in integer math. The Root is node index 7 and uses the H1 combat, capture and regrowth rules. Capturing it wilts the Bloom to `bloom.starvedCap` (newest first, counted as withered, not killed). After that the Bloom regrows and repairs at the starved values.
2. Variant selection: `((seed mod 3)+3) mod 3` unless `system.variant` forces one. `map.variants` and the `root` node entry are in `data/sim.json`, together with every new tunable from the H2 table, under its dotted key with its range. `dataVersion` is 3, and `root.capBonus` is clamped to 0–40.
3. Selectors exist for everything in H2 "Observable values" that comes from the sim:
   - Root status, fed or starved state, and the fed and starved Bloom values;
   - the variant id and name, and the Root cut tick;
   - per-node battle status and last battle, with the wilt count;
   - `runSummary` additions.

   Existing selectors keep working for the Bloom.
4. Unit tests cover:
   - the variant choice by seed and when forced;
   - the wilt on capture, newest first;
   - starved regrowth and repair;
   - Root regrowth while it is uncut;
   - fed behaviour identical to H1 when the Root is never touched;
   - the serialize round trip with the new state;
   - refusing a data-version-2 save.
5. A scripted test on Thin does three things: a 15-ship wave takes the Root, the Bloom wilts to 8, then 18 ships take the Bloom. A further check shows 18 ships against a fed Bloom are repelled. Report the real numbers; do not retune.
6. The reference replay cuts the Root and then captures the Bloom, so the determinism gate and the browser cross-engine check cover the wilt and starvation.
7. `npm run gates -- --base main` passes. The existing turtle bot still captures; report its time against H1's 9.8 min.

### h2-art (art-direction)

**Files:** `packages/client/src/palette.ts`, `packages/client/src/placeholders.ts`, `packages/client/gallery.html` (and gallery source if separate), `ART_STYLE.md`.

**Acceptance:**
1. Implements the H2 draw contract exactly:
   - `drawRoot(ctx, r, t, cut)`;
   - `drawVine(ctx, x1, y1, x2, y2, t, cut)`, with pulses travelling toward the Bloom while it is alive, and slack and grey once cut;
   - `drawWiltingThorn(ctx, r, frac)`.

   The Root reuses `drawThorn` for its thorns.
2. The Root reads as distinct from the Bloom at 24 px: smaller, upright and stalk-like. Its cut state is grey. Everything follows `ART_STYLE.md`, and new colours go in the palette with their roles documented.
3. The gallery shows the Root (alive and cut), the vine (alive and cut) and a wilting-thorn sequence, at map and sheet sizes, at 375 px wide.
4. Gates pass, along with `npm run build` and `npm run smoke`.

### h2-client (engineer, after h2-sim)

**Files:** `packages/client/**` except `palette.ts`, `placeholders.ts` and the gallery, plus `tests/smoke/**`.

**Acceptance:**
1. Everything in H2 "Observable values: additions" and "Touch interactions":
   - map: the Root, its thorn ring, the vine, and the roughly 1 s wilt animation;
   - the Root sheet with the "Feeds the Bloom" box, built from live tunables;
   - the rich sheet's fed or starved line;
   - the name-prefixed battle banner, with two lines when two battles run;
   - the Root toasts;
   - result panel additions, and the system name on the probe sheet;
   - the new tuning keys, with `system.variant` applying on New run.
2. New run uses `seed + 1`.
3. The H1 carry-overs in H2:
   - guarded-node hit areas cover the thorn rings and are at least 44 px;
   - tick values also show seconds;
   - the first-run hint moves into the notices strip;
   - labels near the top edge don't clip (includes cw-bloom-label-clip).
4. Touch at 375x667: tap the Root, attack it, see the wilt toast and the grey vine, then take the Bloom. Nothing covers the key moment.
5. The smoke tests are extended:
   - the Root sheet opens;
   - variant names show;
   - the wide-font layout check covers the new banner and toasts.

   The browser-vs-Node replay check still passes.
6. Gates, `npm run build` and `npm run smoke` pass, and green Linux CI on the pushed branch is required before merge.

### h2-bots (engineer, after h2-sim)

**Files:** `packages/bots/src/strategies.ts`, `runner.ts`, `cli.ts`, `packages/bots/test/**`. Not the reference replay.

**Acceptance:**
1. `raid-supply` replaces the stub, per DESIGN.md H2 "Bot strategies":
   - root wave `ceil(rootThorns*5/2)+5`;
   - stage at a5 after the cut;
   - Bloom wave `ceil(bloomThorns*9/4)`.

   rush and turtle are unchanged.
2. The report shows each strategy for each variant (seeds 1–3 cover knotted, deep and thin), with capture time, ships lost, and Root cut time.
3. It also prints the H2 depth flags as report lines, not gates:
   - both strategies capture in every variant within 8–13 min;
   - raid-supply is at least 30 s faster on Thin;
   - turtle is at least 30 s faster on Deep;
   - Knotted is within 45 s;
   - no strategy dominates on both time and losses in all three variants;
   - turtle matches H1 at 9.8 min ± 10 s.
4. Tests cover the raid-supply decision logic and the flag computation.
5. Gates pass. Report the actual numbers against the flags; do not retune data.

## Milestone 2, iteration 3: H3 Counter web (spec in `DESIGN.md` → "H3 (Milestone 2, iteration 3, spec ready): Counter web")

Owner chose this slice on 2026-11-07 (Q13, Q14). Where this backlog and the spec differ, the spec wins. Order: h3-sim and h3-art in parallel; after h3-sim merges, h3-client and h3-bots in parallel; then h3-design-data. Planned launches: 5 builders + 4 Critic reviews = 9 of 12.

### h3-sim (core-engineer)

**Files:** `packages/sim/**`, `data/sim.json`, `packages/bots/src/reference-replay.ts` and the determinism baselines. Only the minimal edits needed to keep `packages/client/src/*` (e.g. `sheet.ts`) and `packages/bots/src/*` (e.g. `strategies.ts`) compiling with the new input signatures; no feature work there.

**Acceptance:**
1. Every rule in the spec's "Entities and state: changes", "Rules per tick: changes from H1/H2" and "Player inputs: changes" is implemented in integer math with the fixed type orders and no RNG: stock of five resources, pods carrying `res`, assemblers (rule 5a), three yards (5b), two-type counter combat with target orders and overflow (7), capture for pockets/Root/heart including the wilt to starved caps (8), per-type regrowth (9), `capEff`.
2. `data/sim.json`: `dataVersion` 4, the 16-node `map.nodes`, the three layouts in `map.layouts` (Frost Gate, Glass Thicket, Twin Seams) exactly as the spec tables give them, and every tunable from the spec's Tunables table under its dotted key with its range. H1/H2 keys the spec removes are gone.
3. Selectors for everything in "Observable values" that comes from the sim, including the per-ship-type Strong/Even/Weak tag (guard-hp-weighted, integer, division last), yard and assembler status reasons, per-resource delivery buckets, capture order and `runSummary` additions.
4. Unit tests cover at least: counter damage with overflow across guard types for each ship type (and drones at 100); assembler and yard ordering and ore reservation; component scarcity (lancer/flak never start without a component); capture of a pocket starts prize flow once routed; Root cut wilts both heart guard types to the starved caps, newest first; per-type regrowth and the starved multiplier; `capEff` with `guard.capPct`; `sendShips` per-type clamping; serialize round trip; a dataVersion-3 save is refused.
5. A scripted test per layout shows the spec's minimum waves: report the real numbers against the spec's calibration table. Do not retune.
6. The reference replay is regenerated for the new inputs and exercises a pocket capture, a component build, a lancer or flak build, the Root cut and the heart capture. Determinism hashes re-baselined in this task; `npm run gates -- --base main` passes (bots gate may run temporary minimal strategies until h3-bots lands; it must not crash or softlock).

### h3-art (art-direction, parallel with h3-sim)

**Files:** `packages/client/src/placeholders.ts`, `packages/client/src/palette.ts`, the art gallery files, `ART_STYLE.md`. Nothing else in the client.

**Acceptance:**
1. The draw contract in the spec's "Flavor and art needs" exists with these exact signatures: `drawShip(ctx, r, heading, type)` (heading in radians), `drawSpore(ctx, r, t, hpFrac)`, `drawGuardRing(ctx, r, thornShare, sporeShare, t)`, `drawPocket(ctx, r, t, alive, prize)`, `drawResourceIcon(ctx, r, kind)` for `ore | ice | crystal | lens | plating`. Existing draw functions keep working.
2. Drone, lancer and flak are distinguishable by shape alone at 24 px (show a greyscale row in the gallery). Spore is round and clearly distinct from Thorn; its palette entry is in the mob family, at least 4.5:1 on `space`, and not amber, teal or player blue.
3. Ice and crystal icons are cool-family and distinct from each other, ore teal and mob pinks. The guard ring reads at 24 px and stays within radius r plus the existing ring margin.
4. Every new palette key has a matching row in the ART_STYLE.md Palette table (the palette-sync test enforces this) and passes the contrast test or is on its documented allow-list.
5. The gallery shows every new entity at 24 px and full size, at 375 px width. `npm run gates -- --base main` passes. Browser-facing: needs green branch CI before merge.

### h3-client (engineer, after h3-sim merges)

**Files:** `packages/client/src/**` except the h3-art files, and `tests/smoke/**`.

**Acceptance:** everything in the spec's "Observable values and phone UI" and "What changes for H1/H2 content" (HUD chips hidden until owned, guard rings and prize icons on the map, pocket/Root/heart sheets with prize line, guard rows and Strong/Even/Weak tags from the sim selector, the "Choose…" send panel with per-type steppers, probe Yards and Assembly blocks with status reasons, banner with type counts, capture and repelled toasts with the counter hint, result panel with capture order, tuning panel keys and layout label). 375 px portrait, targets ≥ 44 px, every action ≤ 2 taps from the map. Smoke tests at desktop and phone cover: sending a mixed fleet through the send panel, a pocket capture unlocking a ship row, and the result panel's capture order; every layout assertion runs under the wide-font stress. Old saves start fresh with the existing toast. Gates and green branch CI.

### h3-bots (engineer, after h3-sim merges; parallel with h3-client)

**Files:** `packages/bots/src/strategies.ts`, `runner.ts`, `cli.ts`, `packages/bots/test/**`.

**Acceptance:** the four strategies (`drones-only`, `ice-first`, `crystal-first`, `greedy`) and shared rules exactly as the spec's "Bot checks" describes; the per-strategy-per-layout report and per-layout comparison table; the six H3 depth flags reported as lines (not gates). Report the numbers; do not retune. Bot gate: no crash or softlock, tick p95 within budget. Gates pass.

### h3-design-data (designer, after h3-bots reports)

**Files:** `data/sim.json` (values only, bump `dataVersion` if a default changes), `DESIGN.md`.

**Acceptance:** answer the spec's open calibration questions using the h3-bots report; retune layouts and defaults so as many depth flags as possible are met, with the reasoning in `DECISIONS.md`. Re-run the bot suite and gates; report which flags hold. Also in scope (Critic notes on h3-sim): (a) at defaults the hp-weighted Strong/Even/Weak tag misleads, e.g. flak reads Even at Frost Gate p1 though it needs 8 ships vs 13 drones, and both counters read Even at the Frost Gate heart; success criterion 3 relies on the tags, so fix the thresholds, the weighting or the mixes until the tag matches the real minimum waves; (b) interim bots take the heart in 12–16 min against the spec's 20–35, so calibrate pace too. The reference replay still passes (re-baseline only if the sim engineer's tooling requires it, and say so).

## Milestone 2, iteration 4: H4 Reclaim ladder (spec in `DESIGN.md` → "H4 (Milestone 2, iteration 4, spec ready): Reclaim ladder")

The owner chose this slice on 2026-11-08 (Q16: "A. Reclaim ladder"). Where this backlog and the spec differ, the spec wins.

Order:
- h4-sim and h4-art run in parallel.
- After h4-sim merges, h4-client and h4-bots run in parallel.
- h4-design-data starts after h4-bots merges. It may overlap h4-client, whose tests must not pin data values.

Planned launches: 11 of 12. That is the Designer spec (1), 4 builders, 5 Critic reviews (one per task, h4-design-data included) and the Retrospective. h4-design-data is a **resume** of this iteration's Designer, not a launch, which leaves 1 spare.

| Id | Task | Owner | Depends on | Status |
| --- | --- | --- | --- | --- |
| h4-sim | Campaign state, areas, lanes, enter/leave/reclaim, stockpile and shipments, research and its effects, design gate on yards, selectors, data v6, save, reference replay, interim bot gate | core-engineer | none | Ready |
| h4-art | Area node, lane, research icons, probe core, stockpile icon; palette; gallery; ART_STYLE | art-direction | none (draw contract in the spec) | Ready |
| h4-client | Overworld screen, area sheet, research sheet, landing and withdraw, area result and win panels, notices, yard reasons, New system | engineer | h4-sim merged | Blocked |
| h4-bots | Campaign runner, five strategies, per-area report, H4 flags | engineer | h4-sim merged | Blocked |
| h4-design-data | Calibrate area guards, hauls, exports, research costs and the H4 tunables against the flags | designer (resume) | h4-bots merged | Blocked |

### h4-sim (core-engineer)

**Files:**
- `packages/sim/**`, including a new frozen v6 test fixture if the rule tests need one;
- `data/sim.json`;
- `packages/bots/src/reference-replay.ts` and the determinism baselines;
- minimal edits to `packages/bots/src/runner.ts` for the interim gate.

Only the minimal edits needed to keep `packages/client/src/*` and `packages/bots/src/*` compiling and the smoke test booting. The client may land straight in Landfall through a temporary hook until h4-client. No feature work there. Not `placeholders.ts`, `palette.ts` or the gallery.

**Acceptance:**
1. Every rule in the spec's "Area lifecycle", "Stockpile and shipments", "Research" (effects), "Entities and state: changes", "Player inputs: changes" and "Rules per tick: changes" is implemented in integer math, with fixed orders and no RNG:
   - one `World` with `campaign`;
   - `enterArea`, `leaveArea` and `buyResearch`;
   - landing with opening ore, seed rigs, and yards on per design;
   - a reclaim pays the haul;
   - a withdraw resets the area;
   - rule 10 shipments;
   - the extraction and yard-speed effects;
   - the design gate on lancer and flak yards;
   - the probe core sets `wonTick`;
   - the overworld runs rule 1 only;
   - in areas without a Root, the heart can't starve.
2. `data/sim.json` has `dataVersion` 6, plus `map.areas`, `map.lanes` and `research` exactly as the spec tables give them, and the H4 tunables with their ranges. `parseSimData` validates:
   - area node lists are frame ids, and include the probe and the heart;
   - pocket and Root entries match the nodes present;
   - The Deep has every node;
   - lanes join known areas;
   - research requirements name known items and areas;
   - **Σ haul ≥ Σ every research level's cost, per resource** (at the `research.costPct` max).
3. Data tests compare `data/sim.json` with the spec tables, as the H3 test does:
   - the "Areas" table;
   - the "Area guards" table;
   - the "Research" table;
   - "Tunables (H4, data/sim.json, all integers)".

   The existing H3 table tests keep passing; the H3 tables are unchanged.
4. The spec's selectors exist: `campaignStatus`, `areaStatus`, `researchStatus`, `landingEffects` and `campaignSummary`, the `yardStatus` states `needsDesign` and `noSource`, and area-relative `runSummary`. A test shows `counterTag` on each area's guard caps reproduces the spec's "Area guards" tag column.
5. `campaignWorld(seed, data, {reclaimed, research, stockpile})` is exported for tests, bots and dev hooks.
6. Unit tests cover at least:
   - only Landfall is open at the start, and lanes open areas on reclaim;
   - each input's validity rules, including "no research inside an area" and "nothing after the win";
   - landing with each research effect: opening ore, rigs on a1/a2, yards on, extraction exact over a minute, and yard time with its floor of 15;
   - a withdraw resets the area and keeps research and the stockpile;
   - a reclaim pays the haul once;
   - shipments accrue exactly (integer, ×`shipments.pct`), only while a held area is active and never on the overworld;
   - `research.costPct` rounding;
   - the core needs both designs and The Deep;
   - a heart with no Root never starves;
   - Landfall's empty heart falls to the first ship;
   - The Deep at defaults plays like H3 (the min-wave helper gives the H3 numbers from `campaignWorld`);
   - the serialize round trip with `campaign`;
   - a v5 save is refused.
7. The reference replay is regenerated as the spec describes: Landfall reclaimed, research bought, a withdraw, a re-landing, a pocket capture and a heart capture. The determinism gate lands in an area. Hashes are re-baselined in this task.
8. Interim bot gate: the runner starts from `campaignWorld` (every area but The Deep reclaimed, both designs bought) and plays The Deep with the H3 strategies. Report the times against the H3 table; do not retune. `npm run gates -- --base main` passes.

### h4-art (art-direction, parallel with h4-sim)

**Files:** `packages/client/src/placeholders.ts`, `packages/client/src/palette.ts`, the art gallery files, `ART_STYLE.md`. Nothing else in the client.

**Acceptance:**
1. The spec's draw contract ("Art needs") exists with these exact signatures, and existing draw functions keep working:
   - `drawAreaNode(ctx, r, t, tier, state)`;
   - `drawLane(ctx, x1, y1, x2, y2, t, state)`;
   - `drawResearchIcon(ctx, r, id)`;
   - `drawProbeCore(ctx, r, t, frac)`;
   - `drawStockpileIcon(ctx, r)`.
2. Readability:
   - the three area states and four tiers are told apart at 24 px (show a greyscale row);
   - the seven research icons are told apart at 24 px;
   - `owned` lanes visibly pulse in one direction;
   - player amber marks reclaimed areas only.
3. Bounds are measured and shown in the gallery: the area node within r including spikes, the lane within 4 px of its segment, and icons within r.
4. Every new palette key has a matching row in the ART_STYLE.md Palette table (the palette-sync test). It passes the contrast test or is on the documented allow-list.
5. The gallery shows every new entity at 24 px and at full size, plus an overworld mock (6 areas, 7 lanes, mixed states) at 375x667. `npm run gates -- --base main` passes. Browser-facing: green branch CI before merge.

### h4-client (engineer, after h4-sim merges; parallel with h4-bots)

**Files:** `packages/client/src/**` except the h4-art files, and `tests/smoke/**`.

**Acceptance:**
1. Everything in the spec's "Client: screens and phone UI" and "What changes for H3 content":
   - the overworld screen, paused (the client steps only to apply overworld inputs);
   - the area sheet with haul, export, guarded nodes, and heart tags marked "(not researched)";
   - the research sheet with the probe core card, design cards, grind rows, and disabled reasons from `researchStatus`;
   - Land, and the in-area Overworld button with the withdraw confirm;
   - the landing notice from `landingEffects`, and the return and reclaim notices;
   - the probe sheet's Shipments line and the new yard states;
   - the area result panel with the haul and "Back to the overworld";
   - the win panel;
   - New system behind a confirm;
   - the new tuning keys.
2. Every displayed number comes from sim selectors or live tunables, never from client constants. Smoke tests don't pin data values, because h4-design-data will retune them.
3. 375 px portrait, targets ≥ 44 px, every action ≤ 2 taps from its screen. Nothing in either HUD wraps under the wide-font stress.
4. Smoke tests at desktop and phone cover:
   - the first screen is the overworld: land in Landfall, reclaim it, return;
   - buy a research level and see it in the next landing's notice;
   - withdraw from an area;
   - reach the win panel from a dev-hook `campaignWorld` with the core affordable.
5. An H3 save starts fresh with the existing toast. The browser-vs-Node replay check passes on a campaign log. Gates pass, with green branch CI.

### h4-bots (engineer, after h4-sim merges; parallel with h4-client)

**Files:** `packages/bots/src/strategies.ts`, `runner.ts`, `cli.ts`, `packages/bots/test/**`. Not the reference replay.

**Acceptance:**
1. The campaign runner and the five strategies (`ice-line`, `crystal-line`, `full-kit`, `greedy`, `no-research`), with the research policy, exactly as the spec's "Bots: campaign strategies" describes. This includes the per-visit 30-minute cap with withdraw and the 120-minute campaign cap.
2. The report:
   - per strategy and seed: area order with visit times, opening times, research order, ships lost, hauled vs shipped, and tick p50/p95;
   - a per-seed comparison table;
   - the seven H4 flags as report lines (not gates). Flag 4 runs its four probe games from `campaignWorld`.
3. Bot gate: no crash or softlock, and tick p95 within budget. If the campaign suite is too slow for the gate at `--seeds 3`, the gate runs a shorter configuration and the full report runs separately; say which in DECISIONS.md.
4. Tests cover the research policy, the area-choice logic and the flag computation. Report the numbers; do not retune. Gates pass.

### h4-design-data (designer, resume; after h4-bots merges)

**Files:** `data/sim.json` (values only; bump `dataVersion` if a default changes), `DESIGN.md`, `DECISIONS.md`.

**Acceptance:**
1. Using the h4-bots report, retune the area guards, hauls, exports, research costs and the H4 tunables so that as many H4 flags as possible hold. Put the reasoning in DECISIONS.md. Keep the Σ haul ≥ Σ cost invariant.
2. Priorities, in order:
   1. no softlock;
   2. a run length of 45–75 min, with area times in their bands;
   3. flag 4 (the design decides the cheap medium);
   4. flags 3 and 6 (two sides, several orders);
   5. flag 5 (research matters, and openings shrink).
3. Update the DESIGN.md H4 tables to match. The data tests read them, so `data/sim.json` and DESIGN.md change together and no test changes.
4. Every number written in DESIGN.md or DECISIONS.md is copied from a committed report or test output and names its source.
5. Re-run the bot suite and gates, and report which flags hold. The reference replay still passes (re-baseline only if the tooling requires it, and say so).

## Milestone 2, iteration 5: H5 Fleet cap (spec in `DESIGN.md` → "H5 (Milestone 2, iteration 5, spec ready): Fleet cap")

> **Merge path (Director, 2026-11-08):** h5-bots' bots gate is red on untuned v8 by design. h5-design-data branches from `task/h5-bots`, calibrates there, and `merge-task h5-design-data` merges both together once both have Critic approval and every gate is green. h5-bots is not merged alone. See DECISIONS.md.

The owner chose this slice on 2026-11-08 (Q17: "A. Fleet cap"; Q18: no VISION edit yet). Where this backlog and the spec differ, the spec wins.

Order:
- h5-sim and h5-art run in parallel.
- After h5-sim merges, h5-client and h5-bots run in parallel.
- h5-design-data starts after h5-bots merges. It may overlap h5-client, whose tests must not pin data values.
- fix-extract-rate (in review) should merge before h5-bots starts, because calibration assumes it.

Planned launches: 4 builders and 5 Critic reviews (one per task, h5-design-data included), plus the Retrospective. h5-design-data is a **resume** of this iteration's Designer. The Director reconciles this with the ledger; fix-extract-rate has already used launches this iteration.

| Id | Task | Owner | Depends on | Status |
| --- | --- | --- | --- | --- |
| h5-sim | Fleet limit and yard check, `recycleShips`, Command limit item with the `tier` requirement and `limit` kind, `capAtSend`, selectors, data v8 (tunables, research rows, hauls), DESIGN.md H4 tables, save, reference replay | core-engineer | none | Ready |
| h5-art | Fleet icon (normal and full), recycle icon, `fleet` research icon; gallery; ART_STYLE | art-direction | none (draw contract in the spec) | Ready |
| h5-client | Fleet chip, `fleetFull` yard state, Recycle panel, Command limit card, area-sheet limit line, notices, repelled hint, tuning labels | engineer | h5-sim merged | Blocked |
| h5-bots | Composer engine, five strategies plus the cap-off reference, the probe (`waves.ts`), report, H5 flags | engineer | h5-sim merged (and fix-extract-rate) | Blocked |
| h5-design-data | Measure the minimum mixes with the probe, then retune to the capability windows | designer (resume) | h5-bots merged | Blocked |

### h5-sim (core-engineer)

**Files:**
- `packages/sim/**` (new tests, plus a frozen v8 fixture if rule tests need one);
- `data/sim.json`;
- `DESIGN.md`: only the H4 "Areas" table and its "Totals: haul" line, and the H4 "Research" table and its "Totals over every level" line, each with a dated note under it;
- `packages/bots/src/reference-replay.ts` and the determinism baselines.

Only the minimal edits needed to keep `packages/client/src/*` and `packages/bots/src/*` compiling and the smoke test booting. No feature work there, and not `placeholders.ts`, `palette.ts` or the gallery.

**Acceptance:**
1. The spec's "The fleet limit", "Recycle", "Command limit", "Entities and state: changes", "Player inputs: changes" and "Rules per tick: changes" are implemented in integer math, with fixed orders and no RNG:
   - `fleetCap` and `fleetCount` (ships in all states, plus yards building);
   - the yard start check, recomputed after each start, with the turn kept when capped;
   - ships are never removed when over the limit;
   - `recycleShips` validity, clamping, lowest-id first, the refund, and stats;
   - the `fleet` research item, the `{tier, count}` requirement, the `limit` kind, and `fleet` invalid while `fleet.cap` is 0;
   - `capAtSend` on the attack or battle record.
2. `data/sim.json` is `dataVersion` 8, with:
   - the three H5 tunables and their ranges;
   - the Command limit rows;
   - the v8 hauls for `veil`, `garden` and `deep` (spec table).

   `parseSimData` validates the `tier` requirement and keeps Σ haul ≥ Σ research cost per resource. Bump the version pin in `packages/sim/test/data-h4.test.ts` (or move it to a new `data-h5.test.ts` and say so).
3. Data tests compare `data/sim.json` with:
   - the updated H4 "Areas" and "Research" tables and both totals lines;
   - the new "Tunables (H5, data/sim.json, all integers)" table (a new test).

   The H3 and H4 table tests keep passing.
4. Selectors: `fleetStatus`, `recycleRefund`, the `yardStatus` state `fleetFull` (after `off`, before `needsComponent`), the `researchStatus` fleet row with the `tier` and `capOff` reasons, `landingEffects.fleetCap`, and recycle totals in `campaignSummary`.
5. Unit tests cover at least:
   - the yards stop at the limit, a building ship counts, and two idle yards with one slot start only one;
   - losses free slots;
   - lowering `fleet.cap` live keeps ships and pauses yards; raising it resumes them;
   - `fleet.cap` 0 means no limit, and Command limit can't be bought;
   - each Command level raises the limit by the step;
   - each `tier` requirement case;
   - `recycleShips` on a living guarded node, in transit, with a zero total, and the refund rounding;
   - the serialize round trip, and a v7 save refused.
6. The reference replay is regenerated as the spec describes (Command limit purchase, a capped yard, a recycle, a capture), and the determinism hashes are re-baselined. `npm run gates -- --base main` passes.

### h5-art (art-direction, parallel with h5-sim)

**Files:** `packages/client/src/placeholders.ts`, `packages/client/src/palette.ts`, the art gallery files, `ART_STYLE.md`. Nothing else in the client.

**Acceptance:**
1. The spec's draw contract exists with these exact signatures, and existing draw functions keep working:
   - `drawFleetIcon(ctx, r, full)`;
   - `drawRecycleIcon(ctx, r)`;
   - `drawResearchIcon(ctx, r, 'fleet')`.
2. At 24 px:
   - the fleet icon, its full variant, the recycle icon and the `fleet` research icon are told apart from each other and from every H4 research icon (show a greyscale row);
   - player amber appears only in the full variant's bracket.
3. Bounds are measured and shown in the gallery (each icon within r).
4. Every new palette key has a matching ART_STYLE.md row and passes the contrast test, or is on the allow-list.
5. The gallery shows each icon at 24 px and full size, plus a mock HUD row (ship chips and the fleet chip) at 375 px. Gates pass, with green branch CI.

### h5-client (engineer, after h5-sim merges; parallel with h5-bots)

**Files:** `packages/client/src/**` except the h5-art files, and `tests/smoke/**`.

**Acceptance:**
1. Everything in the spec's "Client: screens and phone UI":
   - the fleet chip (with a full style; hidden when `fleet.cap` is 0);
   - the Yards header line and the `fleetFull` row text;
   - Recycle… on every eligible node sheet, opening a panel that defaults to 0 per type, with a live refund preview from `recycleRefund`;
   - the notices (first fleet-full in a visit, recycle, purchase);
   - the repelled hint from `capAtSend`;
   - the landing-notice limit;
   - the area-sheet limit line;
   - the Command limit card with its disabled reasons;
   - recycle totals on the area result and win panels;
   - the tuning labels.
2. Every number comes from sim selectors or live tunables. Smoke tests don't pin data values.
3. 375 px portrait, targets ≥ 44 px, every action ≤ 2 taps from its screen (confirms and panels excepted). The fleet chip and the ship chips stay on one row under the wide-font stress.
4. Smoke tests at desktop and phone cover:
   - fill the fleet (a dev hook sets a small `fleet.cap`) and see "fleet full" on a yard row;
   - recycle from a node sheet and see the stock rise by the preview;
   - buy Command limit from a dev-hook `campaignWorld` and see the new limit in the next landing notice;
   - `fleet.cap` 0 hides the chip.

   New smoke tests pass `--repeat-each 5` on both projects.
5. A v7 save starts fresh with the existing toast. Gates pass, with green branch CI.

### h5-bots (engineer, after h5-sim merges; parallel with h5-client)

**Files:** `packages/bots/src/strategies.ts`, `runner.ts`, `cli.ts`, a new `packages/bots/src/waves.ts`, and `packages/bots/test/**`. Not the reference replay.

**Acceptance:**
1. The composer engine (allocation, target with closed areas, yards by allocation, recycle at a5, attack rule), the area choice with closed records, the research policy with Command limit, and the five strategies (`composer`, `ice-first`, `crystal-first`, `no-command`, `drones-only`), all exactly as the spec's "Bots: strategies and the probe" says. Plus the cap-off `greedy` reference row.
2. The probe in `waves.ts`: minimum single-type waves and the best locally buildable mix, for every tier ≥ 1 heart, fed and starved, and The Deep per seed's layout. It is bounded as the spec says and prints progress.
3. The report: the per-run columns, the probe table with the windows marked, the per-seed table, and the seven H5 flags as report lines (not gates).
4. Bot gate: no crash, tick p95 within budget, and no softlock **for `composer`, `ice-first` and `crystal-first` only**. `drones-only` and `no-command` are expected to fail, and are reported, not gated. If the probe or the suite is too slow for the gate, the gate runs a shorter configuration and the full report runs separately; say which in DECISIONS.md.
5. Tests cover the allocation (ties included), closed-area handling, the research policy and the flag computations, on `fixtureData` or a frozen fixture with explicit premises. No tuned value is pinned, no test runs over about 5 s, and none grows with game length. Report the numbers; don't retune. Gates pass.

### h5-design-data (designer, resume; after h5-bots merges)

**Files:**
- `data/sim.json` (values only);
- `DESIGN.md`;
- `DECISIONS.md`;
- the `dataVersion` pin test (`packages/sim/test/data-h4.test.ts`, or the `data-h5.test.ts` h5-sim moved it to): the version line and its title only;
- the committed reports `reports/archive/h5-probe-v8.{md,json}` and `reports/archive/h5-design-data-v9.{md,json}`.

**Acceptance:**
1. **First,** run the h5-bots probe on v8 and commit it as `reports/archive/h5-probe-v8.*`. Every mix number cited comes from a committed report.
2. Retune the area guards, The Deep's layouts, hauls, Command limit costs and the H5 tunables toward the spec's capability windows, in its priority order:
   1. flag 1;
   2. flags 2–5;
   3. flag 6.

   Keep Σ haul ≥ Σ cost. Put the reasoning in DECISIONS.md.
3. Bump `dataVersion` to 9 if any value changed, and update the pin and its test title together.
4. Update every DESIGN.md table the data tests read (H3 "Layouts", H4 "Area guards", "Areas", "Research", H5 "Tunables") together with the data. Search DESIGN.md for stale statements of what changed. Recompute every derived claim from its table.
5. Re-run the bot suite and the gates, commit the report as `reports/archive/h5-design-data-v9.*`, and report which flags hold. Put any out-of-scope leftover at the top of the report as a blocker.

## Milestone 2, iteration 6: H6 Open frontier (spec in `DESIGN.md` → "H6 (Milestone 2, iteration 6, spec ready): Open frontier")

The owner picked A, Open frontier, and chose to remove the Root (Q19, 2026-11-08). Where this backlog and the spec differ, the spec wins. The two owner bugs from build-20261108-4 ship in this iteration too.

**Parallel groups:**
1. **Now:** `h6-sim` (core-engineer), `h6-art` (art-direction) and the bug engineer. The bug engineer does `h6-bug-topbar-oscillation`, then `h6-bug-buffer-toast-flicker` as a resume. The three file sets don't overlap. The bug tasks are client-only on purpose (no `packages/sim`), so they can't collide with h6-sim.
2. **After h6-sim merges and both bug tasks merge:** `h6-client` and `h6-bots`. h6-client waits for the bugs because they share `hud.ts`, `sheet.ts` and `style.css`.
3. **After h6-bots has Critic approval:** `h6-design-data`, stacked on `task/h6-bots` (PROCESS "Gates that wait on calibration"). The bot gate's no-softlock check is judged on the stacked branch, and `merge-task h6-design-data` merges both together. h6-bots is never merged alone. It may overlap h6-client.

**Planned launches (12):**
- Designer: 1, done (triage); the spec and h6-design-data are resumes.
- Builders: 5 (h6-sim, h6-art, the bug engineer, h6-client, h6-bots).
- Critics: 4 launches (h6-sim, bugs, h6-client, h6-bots). The bugs Critic is resumed for h6-art, and the h6-bots Critic for h6-design-data.
- Retrospective: 1.

That's 11, with 1 spare.

| Id | Task | Owner | Depends on | Status |
| --- | --- | --- | --- | --- |
| h6-bug-topbar-oscillation | The top bar holds still while resources change | engineer | none | Ready |
| h6-bug-buffer-toast-flicker | The "backed up" warning holds steady while a buffer sits at full | engineer (resume) | none (after the first bug, same engineer) | Ready |
| h6-sim | Ten-area map and lanes, relays, `fleetCap` from relays, band locks, scouting and repeat-haul selectors, Command limit removed, Root out of shipped data, data v10, H6 table tests, reference replay | core-engineer | none | Ready |
| h6-art | Relay icon, lock badge, far area state, band label, lane modes; gallery; ART_STYLE | art-direction | none (draw contract in the spec) | Ready |
| h6-client | Panned overworld, area states, band labels, relay and lock sheet lines, decayed haul, the step moment, research and tuning changes, Root smoke tests removed | engineer | h6-sim merged; both bug tasks merged | Blocked |
| h6-bots | Needs-driven area choice, four strategies plus the cap-off reference, probe on fed hearts, trial visits, H6 flags | engineer | h6-sim merged | Blocked |
| h6-combat-target | Guard damage by type (DESIGN.md H6 "Combat amendment"), the order and superset tests, fixture-pinned combat numbers re-derived, replay re-baselined | core-engineer (resume of h6-sim) | none; merges before h6-bots resumes and before h6-design-data | Ready |
| h6-design-data | Probe on v10, retune to the H6 windows, data v11 | designer (resume) | h6-bots Critic-approved (stacked) | Blocked |

### h6-bug-topbar-oscillation (engineer)

Owner: "The top bar content started oscillating while gaining and spending resources." The likely cause is chip widths changing as counts change digit count or glyph width (`#chips` wraps with `justify-content: flex-end`), but the engineer diagnoses. The fix may not hide or truncate digits.

**Files:**
- `packages/client/src/hud.ts`, `packages/client/src/style.css`;
- a new `tests/smoke/hud-stability.spec.ts` (not `boot.spec.ts`, which h6-client edits later);
- a dev hook in `main.ts` only if needed.

No `packages/sim`.

**Acceptance (test the state the bug is about):**
1. A smoke test holds the fullest realistic HUD: The Deep, all five resource chips, all three ship chips and the fleet chip. It changes the counts **every tick** for at least 200 frames at 4x, crossing digit boundaries both ways (0↔1, 9↔10, 99↔100, 999↔1000 for ore). Ice and crystal rates appear and disappear, and lens and plating rise and fall through 0.
2. Across those frames, every HUD element (each chip, each chip row, the stat blocks and the buttons) keeps its x, y, width and height within 1 px, and the bar's row count doesn't change.
3. The test runs at 375x667 portrait under the wide-font stress, and in the landscape and desktop layouts.
4. No chip shows or hides while its count passes through 0 within a visit.
5. It still fits the H5 rule (at most two rows at 375 px).
6. The new test fails on current `main` (run and reported) and passes after the fix. It passes `--repeat-each 5` on both projects, and gates pass with green branch CI.

### h6-bug-buffer-toast-flicker (engineer, resume)

Owner: "When an asteroid buffer is full the toast warning shows and hides rapidly, shifting the buttons under them." Today:
- The asteroid sheet's warning ("Backed up: route at capacity. Upgrade it.", `packages/client/src/sheet.ts`) and the map's "!" badge and dashed route (`view.ts`) follow `nodeStatus(...).backedUp`. That flag is `buffer >= bufferCap`, so it flips each time a pod leaves.
- **Fix it in the client.** For example, derive a steady flag from `extractPerMinX10` against `route.capacityPerMin` (both already in `nodeStatus`), or hold the flag over a window. Reserve the line's space so showing it never moves anything.
- A sim selector change would collide with h6-sim. If the engineer finds it necessary, they report it as a blocker instead of making it.

**Files:** `packages/client/src/sheet.ts`, `view.ts`, `style.css` and `tests/smoke/hud-stability.spec.ts` (or a new `tests/smoke/sheet-stability.spec.ts`). No `packages/sim`.

**Acceptance (test the state the bug is about):**
1. A test builds an asteroid whose extraction exceeds its route capacity, so the buffer hovers at full (alternating cap and cap − 1). It keeps the sheet open for at least 10 game seconds at 1x and again at 4x.
2. Across every frame, the warning is shown continuously (no hidden frame), the map badge and the dashed backed-up route don't blink, and every button below the warning keeps its position within 1 px.
3. After the route is upgraded so its capacity covers extraction, the warning clears within 2 game seconds and stays cleared. Clearing it doesn't move the buttons either.
4. The no-route warning still works.
5. At 375x667 under the wide-font stress. The new test fails on current `main` (run and reported). New smoke tests pass `--repeat-each 5` on both projects, and gates pass with green branch CI.

### h6-sim (core-engineer)

**Files:**
- `packages/sim/**` (tests included; frozen fixtures as needed);
- `data/sim.json`;
- `packages/bots/src/reference-replay.ts`;
- DESIGN.md: only the dated "Superseded at data v10" notes under the H4 and H5 tables, plus H6 table cells if a value must differ, with the reason.

**Acceptance:**
1. **Data v10:** the H6 "Areas", "Area guards", "Research" and "Tunables (H6 …)" tables exactly, plus the 14 lanes and the frame. Areas gain `side` and `relay`. No area includes `root`. Command limit rows and `research.fleet.step` are removed. `parseSimData` validates the new fields and the H6 haul invariant (worst-position decay), and rejects a relay outside tiers 1–2.
2. **Rules:**
   - `fleetCap` from `commandedBands`; a second relay in a band adds nothing;
   - `bandOpen` and the `enterArea` band lock, with the `bandLocked` reason;
   - the repeat haul decay at reclaim, with `haulPaid` recorded.

   Each has unit tests at defaults and at the edges: `overworld.bandLock` 0, `areas.repeatHaulPct` 0 and 100, and `fleet.cap` 0 (relays still unlock bands). Include one test with a haul that doesn't divide evenly.
3. **Selectors:** `overworldStatus` (known, open, locked, relay, band, commanded, `haulNow`), `fleetStatus` (`commandedBands`), and the `haulPaid` fields. Test a far area two lanes out, and a known but locked area (with locks on and no relay).
4. **The Root:**
   - a shipped-data test asserts no area includes it;
   - the H2/H3 Root rule tests still pass on the frozen fixtures;
   - shipped-data tests that cut a Root move to a fixture or go;
   - The Deep without `root` uses its layout's fed counts only (tested).
5. **Data tests:** the shipped-data table tests read the H6 tables, and the H4/H5 table tests stop checking shipped data (fixtures only, or retired), with the dated notes. The `dataVersion` pin is 10.
6. **The reference replay** covers the spec's list, and the hashes are re-baselined.
7. Gates pass. Not browser-facing beyond the replay and data.

### h6-art (art-direction, parallel with h6-sim)

**Files:** `packages/client/src/placeholders.ts`, `icons.ts`, `gallery.ts`, `palette.ts` and `ART_STYLE.md`. Not `view.ts`, `worldview.ts`, `hud.ts`, `sheet.ts` or `style.css`.

**Acceptance:**
1. Everything in the spec's "Art needs (H6)" draw contract: `drawRelayIcon`, `drawLockBadge`, `drawAreaNode` with the four states, and `drawLane` with three modes and reveal progress. Existing callers keep working.
2. The gallery shows each at 24 px and at the overworld size, beside the area node, the fleet icon and the "!" badge, and each is told apart from them.
3. Each stays within `r`. Any new colour gets a palette key and an ART_STYLE.md row, and the palette sync test passes.
4. Gates pass.

### h6-client (engineer, after h6-sim and both bug tasks merge; parallel with h6-bots)

**Files:** `packages/client/src/**` except the h6-art files, and `tests/smoke/**`.

**Acceptance:**
1. Everything in the spec's "Client: screens and phone UI (H6)":
   - pan (drag pans, a touch under 10 px is a tap, no zoom), and the opening view;
   - the four area states and relay icons, the band labels, and the top-row fleet limit;
   - the area sheet lines (relay, already commanded, locked, far, decayed haul with its reason);
   - the step moment (pan, fade, lane reveal, about 1.5 s, skippable, shown once) and its notice;
   - no Command limit card, the new repelled hint, and the tuning labels with `bloom.starved*` hidden.
2. **Remove the Root smoke tests** that need a Root on shipped data, and say which in the report.
3. Every number comes from sim selectors or live tunables. Smoke tests don't pin data values.
4. **Smoke at desktop and phone, in the fullest realistic state:**
   - On the 10-area map at 375x667, pan to The Deep and tap it.
   - Every area node is at least 44 px and no band label overlaps a node, under the wide-font stress, in portrait, landscape and desktop.
   - A locked area's sheet has no Land button.
   - A far area's sheet says unscouted.
   - Reclaim a relay through a dev-hook `campaignWorld`, see the reveal and the notice once, and see the limit on the next landing notice.
   - A repeat haul shows the decayed amount.
   - With `overworld.bandLock` 0, the locked badges are gone.

   New smoke tests pass `--repeat-each 5` on both projects.
5. A v9 save starts fresh with the existing toast. Gates pass, with green branch CI.
6. **Added by the Director (from the h6-combat-target review):** heart and pocket sheets show the combat amendment's line "Thorns strike Flak first; Spores strike Lancers first" under the Strong/Weak tags. It fits at 375 px with the wide font. h6-client branches from `task/h6-combat-target` (which carries h6-sim), with main merged in.
7. **Added by the Director (from the h6-bug-topbar-oscillation round 3 review):** on phones, opening an area's sheet pans the overworld so far areas (Veil, Garden, The Deep) sit above the map. On the pannable map, other areas must stay reachable while a sheet is open, either by panning or without closing the sheet.
8. **Added by the Director (from the h6-bug-topbar-oscillation review):**
   - In phone landscape (667x375) with the full HUD, no HUD chip may overlap the control buttons. On main today, the plating, ship and fleet chips render under them by 15–123 px.
   - Fix the flaky phone test `boot.spec.ts:129` ("held area cannot be landed on"): the tap on area 3 lands on `#hint-text`. It fails 2 of 5 runs on main under parallel load. The new pannable map rewrites this test anyway; make the new version tap reliably.

### h6-bots (engineer, after h6-sim merges; parallel with h6-client)

**Files:** `packages/bots/src/strategies.ts`, `runner.ts`, `cli.ts`, `waves.ts` and `packages/bots/test/**`. Not the reference replay.

**Acceptance:**
1. The needs-driven area choice, the four strategies (`composer`, `ice-first`, `crystal-first` and `drones-only`) and the cap-off reference, exactly as the spec's "Bots (H6)" says.
2. The probe on fed hearts for every tier ≥ 1 area and every Deep layout, marked against "Capability windows (H6)". Starved rows print "n/a". Also the trial visits: band 2 at L0, The Deep at L1 and band 1 relays with drones only, each a full composer visit up to the 30-minute cap, landed from `campaignWorld`. Both are bounded and print progress, as H5. The bot gate may skip the trials if they are slow; the full report runs them, and DECISIONS.md says which.
3. The report: H5's per-run columns plus areas left untaken, haul paid against nominal and each capturing wave's composition. Also the probe table, the per-seed table, and the seven H6 flags as report lines.
4. **Bot gate:** no crash, tick p95 in budget, and no softlock for `composer`, `ice-first` and `crystal-first`. It is judged on the stacked `h6-design-data` branch, because v10 is uncalibrated. Don't loosen it.
5. Tests cover:
   - the goal order and tie-breaks, a closed area skipped, and the side preferences;
   - each flag computation, including one where two winners share a set (flag 6 fails) and one where a capturing wave is single-type (flag 4 fails).

   Tests use fixtures with explicit premises, pin no tuned value, run under about 5 s each and don't grow with game length. Report the numbers; don't retune.

### h6-combat-target (core-engineer, resume of h6-sim; added 2026-11-08 from the h6-bots round 2 review)

**Files:**
- `packages/sim/src/step.ts` (combat) and `packages/sim/test/**`;
- `packages/bots/src/reference-replay.ts` (re-baseline only);
- DESIGN.md: dated notes on tables whose fixture numbers change (H3 "Calibration result", and the min-wave table in "Owner direction 2026-11-08b"), and nothing else.

No `data/sim.json` and no `packages/bots/src` logic.

**Acceptance:**
1. Rule 7's guard damage exactly as the amendment says: pools by guard type, the per-pool type order, id order within a type, overflow, and thorns then spores.
2. `combat-order.test.ts` with the permutation, superset and unit cases, as the amendment says. The permutation test is run on the pre-change code and fails (reported).
3. Fixture-pinned combat outcomes (for example `min-waves.test.ts` on the v4 and v8 fixtures) are re-derived, never loosened, and the DESIGN.md tables that cite them get dated notes.
4. Determinism hashes and the reference replay are re-baselined. Gates pass.
5. `dataVersion` stays 10, because no data value changes. A v10 feedback replay recorded before the change won't reproduce; log that in DECISIONS. h6-design-data bumps to 11 anyway.

### h6-design-data (designer, resume; stacked on `task/h6-bots` after its Critic approval)

**Files:**
- `data/sim.json` (values only);
- `DESIGN.md`, `DECISIONS.md`;
- the `dataVersion` pin test (version line and title only);
- `reports/archive/h6-probe-v10.*` and `reports/archive/h6-design-data-v11.*`.

**Acceptance:**
1. **First,** commit the probe on v10.
2. Retune to "Capability windows (H6)" in the spec's priority order, keeping the haul invariant. Put the reasoning in DECISIONS.md.
3. Bump `dataVersion` to 11 if any value changed, and update the pin, its title and every H6 table together. Search DESIGN.md for stale statements, and recompute every derived claim.
4. Re-run the suite and the gates, commit the report, and say which flags hold and which claim no bot exercises. Put any out-of-scope leftover at the top of the report as a blocker.
5. Before the Critic round, merge h6-bots' approving review commit into this branch.

## Milestone 2, iteration 7: H7 One field, live enemy (spec in `DESIGN.md` → "H7 (Milestone 2, iteration 7, spec ready): One field, live enemy")

The owner picked A and approved the pillar 3 and 4 wording (Q21, 2026-11-14). Faction AI is active for raid behaviour (DECISIONS.md, 2026-11-14). Where this backlog and the spec differ, the spec wins.

**Four build tasks plus a Designer calibration resume.** Art is folded into h7-client (two silhouettes, a raid marker, a radar and a badge). The Director may split it out to art-direction if the budget allows.

**One stack; the top is `h7-client`.** h7-sim flips shipped data to `run.mode: "field"` (data v12), so `createWorld` on shipped data lands in the field. Tests outside h7-sim's files that build worlds from shipped data break at that commit:
- `packages/bots/test/{runner,strategies,needs-driven,waves}.test.ts` and the bots gate (the H6 campaign strategies can't run in field mode): fixed by h7-bots;
- `packages/client/test/{h4,h5,h6}-client.test.ts`, `session.test.ts`, and `tests/smoke/{boot,overworld}.spec.ts` (Landfall and the overworld): fixed by h7-client.

So nothing in the stack merges alone. **`merge-task h7-client` lands the whole stack** once every task in it is approved. Before h7-client's final Critic round, merge the approving review commits of h7-sim, h7-raids, h7-bots and h7-design-data into `task/h7-client` (PROCESS "Gates that wait on calibration").

**Order:**
1. **Now:** `h7-sim` (core-engineer).
2. **After h7-sim has Critic approval:**
   - `h7-raids` (faction-ai), branched from `task/h7-sim`;
   - `h7-client` (engineer), branched from `task/h7-sim`. It builds the economy UI first, then merges `task/h7-raids` once that is approved and adds the raid UI;
   - `h7-bots` (engineer), branched from `task/h7-sim`. It writes the economy strategies first, then merges `task/h7-raids` once approved, for the raid response and the flags.

   h7-client and h7-bots don't share files, and h7-raids touches only `packages/sim/src/factions/**`, its tests, one call site and the reference replay.
3. **After h7-bots has Critic approval:** `h7-design-data` (Designer resume), stacked on `task/h7-bots`.
4. **Last:** h7-client merges `task/h7-design-data` (which carries everything below it), re-runs the gates and the full smoke on v13, gets its final Critic approval, and lands the stack. It is browser-facing, so it needs green branch CI on the exact merged commit.

**Gate expectations below the top:** on h7-sim, h7-raids and h7-bots, typecheck, lint, the sim tests and determinism must be green. The bots gate may be red on h7-sim and h7-raids, and it is judged green on h7-design-data. Client tests and smoke may be red until h7-client. The Critic reviews each lower task as code against its acceptance, and reviews the top with every gate green.

**Planned launches (12):**
- Designer: 1, done (triage). The spec and h7-design-data are resumes.
- Builders: 4 (h7-sim core-engineer, h7-raids faction-ai, h7-client engineer, h7-bots engineer).
- Critics: 2 launches (h7-sim, h7-client). The h7-sim Critic is resumed for h7-raids and h7-bots, and the h7-client Critic for h7-design-data.
- Retrospective: 1.

That's 8, with 4 spare (rework, a split-out art task, or a broken `main`).

| Id | Task | Owner | Depends on | Status |
| --- | --- | --- | --- | --- |
| h7-sim | Field mode (`run.mode`, `map.field`), ship economy (bays, allocation, extractors, haulers, Mine marks), shared fleet limit, first-run fixes, new inputs and selectors, every H7 tunable in data, raid hook stub, data v12, field reference replay | core-engineer | none | Ready |
| h7-raids | Raids R1–R9 in `packages/sim/src/factions/`: muster, size, target, launch, fight, return, hive regrowth with raiders out, withering at capture; `raidStatus`; replay extended | faction-ai | h7-sim Critic-approved (stacked) | Blocked |
| h7-bots | Field runner (cap, softlock), six strategies, seven capability flags, gate failures for winners, campaign bots retired from the gate | engineer | h7-sim Critic-approved (stacked); merges h7-raids when approved | Blocked |
| h7-design-data | Probe on v12, calibrate to "Calibration targets (H7)", data v13 | designer (resume) | h7-bots Critic-approved (stacked) | Blocked |
| h7-client | Field-mode client: probe sheet radar and steppers, rock sheet and Mine toggle, ship and hauler drawing, raid banner, marker, chip and toasts, result panel, tuning; art for the new entities; smoke and client tests rewritten. **Top of the stack** | engineer | h7-sim Critic-approved; merges h7-raids, then h7-design-data | Blocked |

### h7-sim (core-engineer)

**Files:**
- `packages/sim/**` (tests included). `packages/sim/src/factions/` gets only an `index.ts` stub with the raid hook (a no-op) and the `world.raid` / `nextRaidTick` state;
- `data/sim.json`;
- `packages/bots/src/reference-replay.ts`;
- **compile-only** edits in `packages/client/src` and `packages/bots/src` if a widened type breaks the build, with no behaviour change (list them in DECISIONS.md);
- `DECISIONS.md`.

**Acceptance:**
1. **Data v12:**
   - `run.mode` set to `"field"`; `map.field` exactly as the spec's field table, with its `mine` list;
   - every key in "Tunables (H7 …)" with its default and range, including the `raid.*` and `hive.regrowPct` keys (wired here, used by h7-raids);
   - `parseSimData` validates `map.field` and the two field-mode checks (cargo ≤ buffer cap, probe mining ≥ 1);
   - the `dataVersion` pin is 12.
2. **The campaign is untouched:** with `run.mode` absent or `"campaign"`, every existing rule test on the frozen fixtures passes unchanged. Tests that built campaign worlds from shipped data use shipped data with `run.mode: "campaign"` (a test helper), not deleted assertions (engineer.md: a test changed for new data keeps its strength).
3. **Rules F2–F7, F9, F11–F14,** each with unit tests on shipped `map.field`. Required cases:
   - the allocation's proportional property (within 1 over N ore) and the tie order;
   - a share returned to stock at weight 0;
   - a full share that waits on the fleet limit while the others keep filling;
   - a Lancer waiting on crystal, and locked before crystal is first delivered;
   - extractor dispatch to the nearest free mineable rock, slot reservation in flight, idle at the probe, and re-dispatch when a slot opens or a mark is turned off;
   - hauler assignment by the haulers-per-extractor ratio, with ties; a full-cargo wait; the partial load when a node stops being worked; delivery into stats and `firstDeliveredTick`;
   - `fleet.countsEconomy` 0 and 1, and `field.fleetCap` 0;
   - recycling an extractor frees its slot;
   - pocket capture auto-marks the pocket; hive capture wins the run;
   - every invalid input in F12's table.
4. **First-run fixes (F13):** a landing has drone, lancer and flak at weight 0 and the `alloc.start.*` weights. A shipped-data test asserts that every guarded node's smallest drone wave (with `min-wave`) is more than `floor(economy.startStock ÷ ship.drone.cost)`. If shipped values fail it, report the node; don't retune (calibration does).
5. **The raid hook:** `step` calls the factions entry point at F8's position, a no-op here. The guard-damage function used by F10 is exported so a raid fight can reuse it with economy ships after warships.
6. **Selectors:** `allocStatus`, `rockStatus` (all fields except `raidRank`, which h7-raids fills; return 0 here), `fleetStatus` additions, `fieldSummary`. Each is tested.
7. **The reference replay** runs in field mode and covers the spec's list up to, but not including, the raid items. The hashes are re-baselined.
8. **Gates:** typecheck, lint, sim tests and determinism are green on the branch. The bots gate, client tests and smoke are expected red (see "Gate expectations"). Name every red test outside your files in your report.

### h7-raids (faction-ai; stacked on `task/h7-sim` after its Critic approval)

**Files:**
- `packages/sim/src/factions/**`;
- `packages/sim/test/raids*.test.ts`;
- the F8 call site and the F11/R9 capture hook in `packages/sim/src/step.ts` (only those lines);
- `rockStatus.raidRank` in `selectors.ts`;
- `packages/bots/src/reference-replay.ts` (the raid items);
- `DECISIONS.md`.

No data value changes. If one is needed, report it rather than making it: h7-design-data owns values.

**Acceptance:**
1. **R1–R9 exactly,** each with unit tests on shipped `map.field`. Required cases:
   - no raid below `raid.firstAtEcon` or with `raid.enabled` 0;
   - the gap counts from the raid's end;
   - size from `econ`, capped by `raid.maxSize` and by `raid.hiveKeepPct`, with the mix rounding and the short-type fallback;
   - target tie-break by node index, never the probe, and the retarget on arrival;
   - a muster cancelled by a battle at the hive;
   - raiders defend the hive while mustering;
   - a defended fight (counters apply; raider damage hits warships before haulers before extractors);
   - an undefended hit that removes docked extractors from the node count;
   - beaten, hit and turned back recorded;
   - returning raiders keep their ids and hp;
   - the hive doesn't regrow raiders that are out, and `hive.regrowPct` slows regrowth;
   - hive capture with a raid out removes every raider.
2. **`raidStatus`** and `rockStatus.raidRank` match the spec, tested at each phase.
3. **No time pressure:** a test runs 60 game minutes with `econ` held below the threshold after one raid and asserts no further raid.
4. **The reference replay** adds the raid items (defended, undefended, withering at capture). The hashes are re-baselined.
5. **Determinism:** integer only, fixed orders, no RNG; the lint rules pass.
6. **Gates:** as h7-sim. Report the raid-related numbers the flags will need (raid sizes at econ 6, 12 and 22 on shipped data).

### h7-bots (engineer; stacked on `task/h7-sim` after its Critic approval, then merges `task/h7-raids`)

**Files:**
- `packages/bots/src/**` except `reference-replay.ts`;
- `packages/bots/test/**`;
- `reports/`;
- `DECISIONS.md`.

**Acceptance:**
1. **The field runner:**
   - one run per strategy per seed;
   - `won` at hive capture; `timeout` at `FIELD_CAP_MIN` (45) game minutes; `softlock` when no ship starts and no hauler delivers for 5 game minutes in a row before the hive falls; `crash`.
   - Each is tested, including a forced softlock (probe mining 0 and no economy, set through tunables).
2. **The six strategies** from "Bots (H7): strategies", using only selectors and the existing `min-wave` estimate. No other battle simulation.
   - `static`'s sweep shapes are fixed in the code and printed in the report.
   - `greedy` switches to `adaptive`'s rules only after its first `hit` raid.
3. **The gate** fails exactly on: a crash, tick p95 over budget, or a softlock or timeout of `adaptive` or `greedy` on any seed. The H6 campaign strategies leave the gate. Their code may stay (their unit tests run on shipped data with `run.mode: "campaign"`), or go, with the choice logged in DECISIONS.md.
4. **The seven capability flags** are reported with pass, fail and detail. Flags never fail the gate. Flag 4 uses `min-wave` on the hive's at-home guards with a full-size raid removed.
5. **Report:** per strategy, time to the hive, raids by outcome, economy ships lost, peak economy, allocation changes and ships by type, plus the flag lines.
6. **Gates:** the bots gate is judged on the stacked h7-design-data branch, and may be red here on v12. Everything else is green.

### h7-design-data (designer, resume; stacked on `task/h7-bots` after its Critic approval)

**Files:**
- `data/sim.json` (values only);
- `DESIGN.md`, `DECISIONS.md`;
- the `dataVersion` pin test (version line and title only);
- `reports/archive/h7-probe-v12.*` and `reports/archive/h7-design-data-v13.*`.

**Acceptance:**
1. **First,** commit the probe report on v12.
2. Retune to "Calibration targets (H7)", in the spec's order. Put the reasoning in DECISIONS.md. Values only: a rule finding goes to the Director.
3. Bump `dataVersion` to 13 if any value changed, and update the pin, its title and every H7 table together. Recompute every derived claim in the spec (distances, warning time, raid sizes).
4. Before calibrating, check what the spec inherits (designer.md): rerun the hive's `min-wave` measurements in a second arbitrary order and treat any movement as a rule finding.
5. Re-run the suite and the gates (the bots gate must be green here), commit the report, and say which flags hold and what no bot exercises.
6. Before the Critic round, merge h7-bots' approving review commit into this branch.

### h7-client (engineer; branched from `task/h7-sim` after its Critic approval; top of the stack)

**Files:**
- `packages/client/**` (tests included; `placeholders.ts`, `icons.ts`, `gallery.ts` and `palette.ts` for the art);
- `tests/smoke/**`;
- `ART_STYLE.md`;
- `DECISIONS.md`.

**Acceptance:**
1. **Field mode end to end:** the run opens on the field; the result panel offers New run; the overworld, research and withdraw are unreachable; the tuning panel shows the H7 keys and hides the parked ones; "New system" reads "New run".
2. **The probe sheet:** the radar readout (display only) and five rows with −/+ buttons ≥ 44 px and the state line for each `allocStatus` state. It fits 375x667 without scrolling, including under the wide-font stress. A smoke test taps + and − and checks the input log and the radar.
3. **The rock sheet:** the Mine / Stop toggle, extractor pips (docked and in flight), haulers, buffer and "Backed up: add haulers", delivered per minute, and the raid-rank line. A smoke test turns a rock off and sees its extractors leave.
4. **Raid readability:**
   - the muster banner (tap opens the target's sheet), the moving raid marker with its dashed line and countdown, the target flash, the battle line, the three end toasts, and the raid chip in each state;
   - nothing in the HUD shifts when the banner, chip or toasts appear (measured, as in the H6 bug tests);
   - smoke tests drive a raid with tunables (`raid.firstAtEcon` 2, `raid.musterTicks` 0) and check each phase.
5. **The map:** docked extractors, haulers moving on probe–rock lines (thicker for more), idle economy ships at the probe, the Mine badge.
6. **Art:** `drawExtractor`, `drawHauler`, `drawRaidMarker`, `drawRadar`, `drawMineBadge` and the `'raided'` rock state, in the gallery. The extractor and hauler pass the 24 px silhouette check against the warships and a rock, with bounds checked against the gallery's pixel scan. New palette keys get ART_STYLE.md rows.
7. **Tests:** the old client and smoke tests that depend on the overworld or Landfall are moved to campaign-mode data (if their feature still exists in code) or retired with their feature, each listed in DECISIONS.md. No assertion is loosened.
8. **The stack:** merge `task/h7-raids` once it is approved, then `task/h7-design-data` once that is approved. Before the final Critic round, merge every lower task's approving review commit. Run the gates and the full smoke on v13 at desktop and phone sizes, with `--repeat-each 5` at the default worker count. Branch CI must be green on the exact commit that `merge-task h7-client` merges.

## Milestone 2, iteration 8: H8 Hold the front (spec in `DESIGN.md` → "H8 (Milestone 2, iteration 8, spec ready): Hold the front")

The owner picked B, then added A (Q22). Where this backlog and the spec differ, the spec wins.

**Four build tasks, plus a Designer calibration resume.** The art is small (a badge, the drag line and ghost, a pulse and an icon), so it is folded into h8-client.

**One stack, topped by `h8-client`.** h8-sim changes how haulers are staffed (H1–H5) on shipped data (v14). Tests outside its files that count haulers on shipped data may go red at that commit:
- `packages/bots/test/*` and the bots gate are fixed by h8-bots;
- `packages/client/test/*` and `tests/smoke/h7-*.spec.ts` are fixed by h8-client.

So nothing in the stack merges alone. **`merge-task h8-client` lands the whole stack** once every task in it is approved. Before h8-client's final Critic round, merge the approving review commits of h8-sim, h8-raids, h8-bots and h8-design-data into `task/h8-client` (PROCESS "Gates that wait on calibration").

**Order (at most three builders at once, with no file overlap):**
1. **Now:** `h8-sim` (core-engineer). Its first commit is the hauler repro (acceptance 1), made before any rule changes.
2. **After h8-sim has Critic approval, in parallel:**
   - `h8-raids` (faction-ai), on `packages/sim/src/factions/**`, its tests and the replay's raid items;
   - `h8-bots` (engineer), on `packages/bots/src/**` except the replay, the bots tests and `reports/`. It merges `task/h8-raids` once that is approved;
   - `h8-client` (engineer), on `packages/client/**`, `tests/smoke/**` and `ART_STYLE.md`. It builds everything that doesn't need H9 or H10 first, then merges `task/h8-raids` for the hold line.
3. **After h8-bots has Critic approval:** `h8-design-data` (Designer resume), stacked on `task/h8-bots`.
4. **Last:** h8-client merges `task/h8-design-data`, which carries everything below it. It re-runs the gates and the full smoke on the final data, gets its final Critic approval, and lands the stack. It is browser-facing, so it needs green branch CI on the exact commit merged, with the Critic's verdict committed before that CI run (PROCESS "Before merging").

`reference-replay.ts` is touched by h8-sim and then by h8-raids. That's sequential within the stack, so nothing overlaps.

**Gate expectations below the top:**
- On h8-sim and h8-raids, typecheck, lint, the sim tests and determinism must be green.
- The bots gate may be red on h8-sim and h8-raids, and is judged green on h8-design-data.
- Client tests and smoke may be red until h8-client.

**CI headroom:** h8-client adds smoke tests while both CI jobs are already past 80% of their limits (Can wait `cw-smoke-sim-time`, marked do-first). Land that task before h8-client's final round, or fold it into h8-client.

**Planned launches (12):**
- Designer: triage (done). The spec and h8-design-data are resumes.
- Builders: 4 (core-engineer, faction-ai, engineer ×2).
- Critics: 2 launches, each resumed across the tasks it reviews.
- Retrospective: 1.

That's 7 new launches, with 5 spare for rework, `cw-smoke-sim-time`, or a broken `main`.

| Id | Task | Owner | Depends on | Status |
| --- | --- | --- | --- | --- |
| h8-sim | Hauler repro first. Then hauler need, target, assignment, rebalance and no surplus (H1–H5); `setHaulers`, `moveShips`, `recycleFleet`; selectors; the H10 hold hook stub; data v14 with every H8 key; replay items | core-engineer | none | Ready |
| h8-raids | Shield (H9) and haulers hold (H10) in `factions/`; `rockStatus.raidTarget` and `haulersHeld`; `raidStatus.holding`; replay raid items | faction-ai | h8-sim Critic-approved (stacked) | Blocked |
| h8-bots | Bot changes 1–3 (economy weights by shortfall, wipe recovery, nothing-to-build), the no-plan-fits table, flags and report on v14 | engineer | h8-sim Critic-approved (stacked); merges h8-raids when approved | Blocked |
| h8-design-data | Probe on v14; calibrate to "Calibration targets (H8)"; v15 if any value changes | designer (resume) | h8-bots Critic-approved (stacked) | Blocked |
| h8-client | Drag and long-press split, tap-Move-tap fallback, hauler stepper, Mine mode, weight %, raid badge, fleet panel with Recycle, `client.*` keys, art, smoke tests. **Top of the stack** | engineer | h8-sim Critic-approved; merges h8-raids, then h8-design-data | Blocked |

### h8-sim (core-engineer)

**Files:**
- `packages/sim/**` (tests included), except `packages/sim/src/factions/**`. The one exception is a single stub in `factions/index.ts`: `haulersHeld(world, node): boolean` returning false, plus its call site in `runHaulers`;
- `data/sim.json`;
- `packages/bots/src/reference-replay.ts`;
- **compile-only** edits in `packages/client/src` and `packages/bots/src` if a widened type breaks the build, with no change in behaviour (list them in DECISIONS.md);
- `DECISIONS.md`.

**Acceptance:**
1. **Repro first, as its own commit, before any H8 rule change.** Owner, build-20261114-1: "A2 just got a third hauler. A1 has no haulers." On v13 rules and shipped `map.field`, write:
   - (a) a rule test: two worked, Mine-marked rocks, one with 0 haulers assigned; the next hauler assigned at the probe must go to the one with 0;
   - (b) a scripted run of the field opening at the shipped allocation for 6 game minutes, asserting on every tick that no new hauler is assigned to a rock with a higher ratio while a worked, marked rock has 0 haulers.

   If either fails, the commit message and DECISIONS.md name the cause, and the cause is fixed or shown to be gone under H2. If both pass, record the states that can produce the owner's observation (A1 Stopped, or worked but not marked, or no docked extractor with an empty buffer, or a rock-sheet count that lags), and keep both tests: with `hauler.autoNeed` 0 they guard H7's rule.
2. **Data v14:**
   - every key in "Tunables (H8 …)" with its default and range. The `client.*` keys are client-scoped like `client.autosaveSec`. `raid.shieldEcon` and `raid.haulersHold` are wired here and used by h8-raids;
   - `haulerSet` in the field state, saved;
   - the `dataVersion` pin is 14.
3. **H1–H5,** each with unit tests on shipped `map.field`:
   - the need table in the spec (a1–a7, p1, p2), pinned;
   - `max(1, …)` for a rock with only a buffer;
   - a set count overrides the need, and Auto restores it;
   - assignment by largest shortfall, with both tie-breaks;
   - idle at the probe when there is no shortfall;
   - rebalance on arrival when a node is over its target (including after `setHaulers` lowers it), and no move when a node is at its target;
   - H4: Hauler ineligible and in state `enough` while the shortfall ≤ 0; the share is kept; building resumes when a rock is marked or an extractor docks;
   - `hauler.autoNeed` 0 reproduces H7's F6 behaviour on the frozen v13 fixture (the H7 hauler tests pass unchanged under it).
4. **Inputs,** each with every invalid case tested:
   - `moveShips` (all, split, the 1-ship fallback, from = to, an empty source, an attack on a guarded node, economy ships never carried);
   - `setHaulers` (range, node kinds, kept while unmarked);
   - `recycleFleet` (the order across idle, parked and in transit; the exclusions; refunds; cargo lost; a recycled docked extractor frees its slot and re-dispatches the same tick).
5. **Selectors:**
   - `rockStatus` gains `haulerNeed`, `haulerSet` and `haulerTarget` (`raidTarget` and `haulersHeld` return false here; h8-raids fills them);
   - `allocStatus` gains `enough` and `incomePct` (tested rounding);
   - `fleetStatus` gains `alive`, `idle`, `building` and `recyclable`;
   - `movePreview` is new.
6. **The reference replay** adds the spec's H8 items up to, but not including, the raid items. The hashes are re-baselined.
7. **Gates:** typecheck, lint, the sim tests and determinism are green. Name every red test outside your files in your report.

### h8-raids (faction-ai; stacked on `task/h8-sim` after its Critic approval)

**Files:**
- `packages/sim/src/factions/**`;
- `packages/sim/test/raids*.test.ts`;
- the `raidTarget` and `haulersHeld` fields of `rockStatus` and `raidStatus.holding` in `selectors.ts` (only those lines);
- `packages/bots/src/reference-replay.ts` (the raid items);
- `DECISIONS.md`.

No data value changes. If one is needed, report it rather than making it.

**Acceptance:**
1. **H9, the shield,** with tests:
   - a round that starts with one warship at the target strikes warships only, and its overflow is lost;
   - the next round, after that warship fell, strikes haulers and then extractors;
   - a warship that arrives mid-round counts from the next round;
   - `raid.shieldEcon` 0 is H7's R7 exactly (H7's raid tests pass unchanged under it).
2. **H10, haulers hold,** implemented behind h8-sim's `haulersHeld` stub, with tests:
   - from `out` to the end: at the probe, the hauler stays; at the node, it loads what is there and leaves; flying out, it finishes its leg, then loads and leaves;
   - haulers resume when the raid ends, whatever the outcome (beaten, hit or turned back);
   - the target stays mined, so R5 and the R6 retarget are unchanged;
   - the hold doesn't apply during muster;
   - `raid.haulersHold` 0 is H7.
3. **Selectors:** `rockStatus.raidTarget` (muster to end), `haulersHeld`, and `raidStatus.holding`, tested at each phase.
4. **The reference replay** adds the shielded round and the held haulers. The hashes are re-baselined.
5. **Determinism and gates:** as h8-sim. Report the full-economy raid's size on v14 at the econ `adaptive` peaks at, and whether greedy's first hit still kills 2 or more economy ships under H10 (h8-design-data needs both).

### h8-bots (engineer; stacked on `task/h8-sim` after its Critic approval, then merges `task/h8-raids`)

**Files:**
- `packages/bots/src/**` except `reference-replay.ts`;
- `packages/bots/test/**`;
- `reports/`;
- `DECISIONS.md`.

**Acceptance:**
1. **Bot changes 1–3** from "Bots (H8)", each with a unit test. Change 1 never sets the Hauler weight to 0 while a rock has a shortfall. Change 2 is tested on a wiped world. Change 3 is tested on a world with haulers `enough`, every warship weight 0 and ore piling up.
2. **The no-plan-fits table:** each cell has a test, or is shown in a traced shipped-data run in the report. No winner (`adaptive`, `greedy`) idles with resources growing over a whole run on shipped data (engineer.md: test no-idle over a whole run).
3. **The report** adds, per strategy:
   - idle haulers at the probe (peak, and minutes with more than 1);
   - backed-up seconds per rock with its target met;
   - economy ships lost while a warship stood at the target, which must be 0 when `raid.shieldEcon` is 1.

   It lists what no bot exercises: drag, `setHaulers`, `moveShips`, `recycleFleet`, Mine mode.
4. **The seven flags** are reported as in H7. If flag 1 fails because `static` got stronger (spec: "Inherited assumptions"), report it as a finding for the Director, not something to tune.
5. **Gates:** the bots gate is judged on the stacked h8-design-data branch, and may be red here on v14. Everything else is green.

### h8-design-data (designer, resume; stacked on `task/h8-bots` after its Critic approval)

**Files:**
- `data/sim.json` (values only);
- `DESIGN.md`, `DECISIONS.md`;
- the `dataVersion` pin test (the version line and title only);
- `reports/archive/h8-probe-v14.*` and `reports/archive/h8-design-data-v15.*`.

**Acceptance:**
1. **First,** commit the probe report on v14.
2. Calibrate to "Calibration targets (H8)", values only. A rule finding goes to the Director, including a failing flag 1 caused by `static`.
3. If any value changed, bump `dataVersion` to 15. Then update the pin and every H8 table, and recompute every derived claim in the spec (the need table, flag 6's sums, raid sizes).
4. Check what the spec inherits: rerun the hive and pocket `min-wave` measurements in a second order, and confirm the shield adds no order-dependence.
5. Re-run the suite and the gates; the bots gate must be green here. Commit the report, and say which flags hold and what no bot exercises.
6. Merge h8-bots' approving review commit into this branch before the Critic round.

### h8-client (engineer; branched from `task/h8-sim` after its Critic approval; top of the stack)

**Files:**
- `packages/client/**` (tests included; `placeholders.ts`, `icons.ts`, `gallery.ts` and `palette.ts` for the art);
- `tests/smoke/**`;
- `ART_STYLE.md`;
- `DECISIONS.md`.

**Acceptance:**
1. **Drag to move,** as in the spec's state list:
   - `touch-action: none` on the field canvas;
   - the all-drag and the split-drag; the ghost 48 px above the finger; the drop-target highlight with the Attack tag on a guarded node;
   - cancel on empty space, on the source, on a sheet, on `pointercancel` and on a second pointer;
   - the click after a drag is suppressed;
   - a plain tap (short or long) opens the sheet;
   - no drag starts from a node with no warships.

   Smoke tests at 375x667 and on desktop, with synthetic pointer events:
   - (a) for every pair of field nodes, an all-drag from a node holding warships lands `moveShips` on the intended target, including pairs next to the hive's rings;
   - (b) a long-press drag sends `split`;
   - (c) a tap within the slop opens the sheet and sends no input;
   - (d) each cancel case sends nothing.

   All four must pass with `--repeat-each 5`. **If (a) or (c) can't be made reliable, report it with the failing pairs.** The Director then decides whether `client.moveGesture` ships at 0.
2. **Tap-Move-tap** (`client.moveGesture` 0): "Move all" and "Move half" on the sheet, the banner with Cancel, and a smoke test of each.
3. **Hauler stepper** on the rock sheet ("2 · Auto", −, +, Auto; "3 · set (Auto 2)"). It is hidden when `hauler.autoNeed` is 0. A smoke test sets a count and sees the rock's haulers change after their next trip home.
4. **Mine mode,** as specified, with a smoke test that marks and unmarks two rocks in three taps and opens no sheet.
5. **Weights:** `weight · incomePct%` on each row, the line under the radar, and "enough haulers".
6. **Raid badge** from muster to the end, and the rock sheet's "Raid coming…" and "Haulers waiting at the probe" lines. Tested with `raid.firstAtEcon` 2 and `raid.musterTicks` 0, as in H7.
7. **Fleet panel** from the Fleet chip: the rows, the recycle steppers and the refund label, sending `recycleFleet`. A smoke test recycles an idle hauler.
8. **Fit and stability:**
   - the probe sheet, the rock sheet (with the hauler row and both raid lines) and the fleet panel each fit 375x667 without scrolling under the wide-font stress;
   - the badge, the Mine-mode state and the drag highlight shift nothing in the HUD (measured, as in the H6 bug tests).
9. **Art:** `drawRaidBadge`, the drag line, ghost and highlight, the split pulse and the Mine button icon, all in the gallery. New palette keys get ART_STYLE.md rows.
10. **Tuning:** the `client.*` keys show tagged "this device". The H8 sim keys are listed.
11. **Smoke time:** new smoke tests step the sim with `advanceTicks` and never wait in real time (engineer.md). Report the CI job times. Past 80% of a limit, `cw-smoke-sim-time` goes first.
12. **The stack:** merge `task/h8-raids` once it is approved, then `task/h8-design-data`. Before the final Critic round, merge every lower task's approving review commit. Run the gates and the full smoke on the final data at desktop and phone sizes with `--repeat-each 5`. Branch CI must be green on the exact commit merged.

## Can wait (allowed while waiting on the owner)

- **cw-smoke-sim-time** (engineer; added by the Retrospective after build-20261114-1; do this first): both CI jobs that run the smoke suite are past 80% of their limits (gates job 15.5–17.5 of 20 minutes, deploy job with the live smoke 13–14 of 15; runs 43630983499, 43635034312, 43638281605), so the next browser-facing task that adds smoke tests can cancel CI or the production deploy. Replace real-time waits with sim stepping (`advanceTicks` to a predicate with a tick cap, as `stepUntil` in `tests/smoke/h7-economy.spec.ts`): `boot.spec.ts` (`waitForTimeout` and 30 s polls on game state), `overworld.spec.ts` (lines ~398–407), `buffer-warning.spec.ts` (polls of up to 120 s), the remaining `setSpeed(4)` loop in `h7-economy.spec.ts`, and the gallery wait in `h7-art.spec.ts` (up to 100 s per project). Waits for motion to settle (`helpers.ts`) stay as they are. Acceptance: no assertion loosened and no test dropped; full smoke `--repeat-each 5` green; the CI gates job under 14 minutes and the deploy job under 11, with the run ids in the report.
- **cw-h7-hauler-raid-wait** (folded into H8 as rule H10, task h8-raids; 2026-11-14) (designer → core-engineer): a captured pocket's free extractor keeps its haulers flying into an undefended raid until Stop or defence. Possible rule: haulers wait at the probe while their node is the target of a raid that is out or fighting. Only if the owner finds it cheap in play.
- **cw-h7-bots-post-wipe-idle** (folded into H8 bot change 2, task h8-bots; 2026-11-14) (engineer): after raids wipe the economy, drones-only (and potentially adaptive/greedy at other values) sets every weight to 0 and ends in the runner softlock. Rebuild the economy floor after a wipe.
- **cw-bots-gate-time** (engineer; added by the Retrospective after build-20261116-1): the `bots` gate grew from about 78 s (h8-sim) and 86 s (before h8-bots) to 96–117 s. The latest gates run took 101.7 s for bots and 74.3 s for test (`reports/gates-latest.json`), and every builder and Critic runs `npm run gates` several times per round. h8-bots logged the cause as the per-tick staffing metrics and the backstops' `allocStatus` read. Profile one `npm run bots` run, then compute the metrics at a coarser step or only for the strategies whose flags read them, and replace per-tick selector reads in the bots with the direct reads h8-bots used for `haulerShortfall`. Acceptance: bot decisions are unchanged on v14 (same win times and flag results on every seed); any metric that is now sampled rather than read every tick says so in the report, and a metric a test asserts (such as economy lost under a guard, which must be 0) is still exact; the bots gate is under 80 s on this machine, with before and after times in the report. No gate threshold or tick count changes.
- **cw-h7-raidstatus-leg** (core-engineer): add `from` and `flightTicks` to `raidStatus` so the client stops reading `world.raid` directly.

- **cw-root-code-removal** (core-engineer; from the H6 spec): the Root is out of play through data only (owner, Q19). After H6 ships, and if the owner hasn't asked for it back, delete the dormant Root code: the sim's wilt and starved rules and their fixture tests, the client's vine, Root sheet and wilt toast, the bots' Root targeting, and the `bloom.starved*` tunables. Acceptance: no reference to the Root kind outside the frame data and frozen fixtures; gates pass; determinism hashes are unchanged for shipped data.
- **cw-sim-fleet-leftovers** (engineer; added by the Director from the h6-sim review): once h6-client has merged, remove the deprecated H5 leftovers that h6-sim kept only so the old client compiles: the `fleet` research id, the `limit` kind, `capOff`, and `FleetStatus.level`/`maxLevel` (which always return 0). Acceptance: no references remain in packages/sim, client or bots; gates pass; the reference replay is unchanged.
- **cw-worktree-prune** (engineer; added by the Retrospective after build-20261108-4): after H5 the repo has 14 worktrees besides the main checkout and 40 local branches besides `main`, every one already in `main` (`git branch --merged main`): agent worktrees under `.claude/worktrees/` (h3, h4 and h5 tasks), alias branches (`h4-bots-core`, `h4-client-core`, `h4-dd-core`, `h5-client-core`, `h5-art-merge`) and `worktree-agent-*` branches. `npm run worktree -- remove <id>` only knows `../Factory4X-wt/<id>`, so the reminder `merge-task` prints doesn't fit agent worktrees. Add `npm run worktree -- prune [--dry-run]` to `scripts/worktree.mjs`: remove every worktree and local branch whose head is already in `main` and has no local-only commits, skip locked worktrees and any with uncommitted changes (list them instead), and never touch `origin`. Acceptance: `--dry-run` lists exactly what would go and why each kept item stays; a test or scripted check with a temporary merged and unmerged branch. The Director then runs it after each handoff.
- **cw-veil-starved-tag** (designer): on data v9 the Root-cut Spore Veil heart's counter tags read Even/Even, but the minimum waves say Flak is Strong (14 flak vs 20 drones). Fix the tag or the guard mix so the sheet reads true (h5-design-data review, round 1).

- **cw-h3-review-notes** (Designer to judge, then engineer; from the H3 Critic reviews, 2026-11-07):
  - Pace: bots take the heart at 19–22 min with counters, short of the spec's 20–35 (and 35–45 for drones-only). The bot suite caps games at 30 min, which limits how slow calibration can go; raise the cap first if pace is retuned.
  - Twin Seams reads Even/Even for both counters at its Root and heart; 4 of 42 tags misread near the thresholds. A time-to-clear tag formula (sim selector) would be sturdier than the hp-weighted one.
  - Depth flag 4 still missed by 13–26 s (crystal-first faster on every layout). Bots pick targets without regard to their own fleet's counters; make target choice fleet-aware before trusting flag 4.
  - With a sheet open at 375x667 the map is ~190 px tall and label pills stack; a battle report replaces an untapped unlock notice.
  - Smoke test pins `extractor.cost` = 20 in the tuning panel check.
- **cw-palette-followups** (art-direction; Critic notes on cw-palette-sync-test): the palette test is one-way (a stale table row with no key isn't flagged), and the "Dim star" row isn't marked low-contrast though it's on the allow-list.
- **cw-gates-output** (needs owner approval: `scripts/gates/` is protected): have `reports/gates-latest.json` keep the tail of a failing gate's output, so a flaky test is named the first time (Critic note on cw-flaky-test).

- **cw-raid-regroup** (Designer to decide, then engineer): after cutting the Root, raid-supply moves the Root survivors to a5 but leaves ships built meanwhile at the probe. It is harmless at today's numbers, but would matter if Roots get weaker or starved Blooms stronger. The fix would be one `sendShips(probe, a5, 0)` after the cut (Critic note on h2-bots).

- **cw-flaky-test** (engineer): during the h2-art round 2 review, `npm run gates` failed the `test` gate once (28.5 s against the usual 10–14 s) and passed on rerun. Which test failed wasn't captured. Find it (likely a timing-sensitive test under load) and make it deterministic. A flaky gate weakens the gate.

- **cw-palette-sync-test** (art-direction or engineer; added by the Retrospective after build-20261108-1): add a unit test that parses the Palette table in `ART_STYLE.md` and fails if any key in `packages/client/src/palette.ts` has no row with the same value, or a row's value differs. The same miss caused a Critic rejection in both m1-art and h2-art round 1. A test catches it at `npm run gates`, before review. Optional in the same task: assert that each opaque entity colour reaches 4.5:1 against `space`, with an explicit allow-list for documented outline-only colours. Acceptance: removing one row from the table makes `npm run gates` fail with a message naming the missing key.

- cw-ci-hardening (needs owner approval: `.github/workflows/` is protected): bump `actions/*` to versions that run on Node 24 (GitHub warns Node 20 is deprecated), and have the live smoke step wait for the deployment URL to answer over HTTPS before testing. A new Pages subdomain's TLS certificate took about a minute on the first deploy and failed the first live smoke run.
- ~~cw-gate-windows~~ **Done** 2026-11-06 (Q9): `protected-files.mjs` now calls git without a shell, so it no longer skips on Windows.
- cw-bench: benchmark scenario with 10k entities for the tick budget once ECS lands
- cw-hud-version (Engineer; added by the Retrospective, 2026-11-06): the HUD shows `BUILD_VERSION` as `main-<run>-<40-char sha>` (set in `ci.yml`), which is long enough to wrap on a 375 px phone. Shorten the displayed version in the client to `<ref>-<run>-<first 7 of sha>` (`packages/client/src/main.ts`, no protected file needed). Keep the full version in the feedback/replay metadata. Acceptance: the smoke test at phone size shows the version on one line, and the full sha is still recoverable from the build.
- cw-upgrade-cost-lock (Designer to judge; noted by the Critic in reviews/m1-sim.md): upgrade costs lock when queued, as the spec says. So if you queue L2 and L3 and then cancel the L2 order, the remaining order upgrades to L2 at the L3 price (40 instead of 20). This only matters if players notice it; decide after the M1 playtest.
- cw-bots-peak-label (Engineer; Critic note in reviews/m1-bots.md): the "Peak ore/min" column in the bot Markdown report covers the whole run (turtle 250, vs 150 at capture) and its header doesn't say so. Label it, or add a peak-at-capture column.
- cw-m1-design-notes (Designer, after the M1 playtest; from the Critic's review of m1-client):
  - The shipyard starts on and spends 15 of the 30 starting ore at once, so the first extractor waits about 25 s.
  - Thorns are drawn outside the Bloom's tap area.
  - The tuning panel shows raw ticks instead of seconds.
  - The first-run hint covers the probe.
  - The "2 taps from the map" success criterion conflicts with the spec's own confirm tap for Cancel (3 taps); reword it.
- cw-m1-client-notes (from the Critic's round 2 of m1-client):
  - **Staggered "All" (ask the owner in the M1 handoff):** "Attack with all" from Probe and A5 arrives about 330 su apart, so the A5 group fights alone first. Players will probably read "All" as one simultaneous wave. Options: sources converge (closer groups wait), or a rally-then-attack flow. This is game feel, so it's the owner's call.
  - The battle-report toast covers the probe at all sizes. Tapping the probe only dismisses the toast: one extra tap, never a wrong action.
  - The map shifts when the banner appears and disappears (the Bloom moves 29 px at 375x667). Every node stays inside its tap radius.
  - The battle banner text was shortened to "BATTLE · strip 1.3/s · regrow 0.5/s · N lost"; the Designer should confirm the wording.
  - The `debugShowNotices` test hook adds a test-only branch to the production `refreshUi`.
- cw-toast-a11y (Engineer; Critic note in reviews/m1-toast-fix.md): drop the toast's fixed `aria-label` so screen readers read the battle report itself, and consider `aria-live="polite"` on the notices strip.
- cw-map-jump (Designer decision after the M1 playtest): the map shrinks while a battle toast is shown (−25% height at 375x667, the Bloom moves 53 px) until it's tapped. Options: keep it; reserve a fixed notices strip; or auto-dismiss the report (this changes the spec's "stays until tapped").
- cw-smoke-isolation (Engineer; added by the Retrospective after build-20261106-2): local smoke runs set `reuseExistingServer: true` (`playwright.config.ts`, not protected). Any server already on port 4173 gets reused, including a leftover preview from another worktree, which then tests the wrong build. Make local runs use their own server: either `reuseExistingServer: false`, or a port derived from the worktree path. Also move the wide-font stress into a shared fixture that every layout assertion uses, not only the notices tests. Acceptance: with a stale server on 4173, `npm run smoke` either fails clearly or starts its own server. Every overlap and bounds assertion runs under the wide font.
- cw-merge-ci-check (Engineer; added by the Retrospective after build-20261106-2): make the "Before merging" rule in `PROCESS.md` automatic. `scripts/merge-task.mjs` (not protected) refuses a task that touches `packages/client/`, `tests/smoke/` or `playwright.config.ts` unless `gh run list --branch task/<id>` shows a successful CI run for the branch's head commit. Allow an explicit override flag, and log it when used. Acceptance: merging an unpushed browser-facing branch fails with a message that says to push it and wait for CI.
- cw-bloom-label-clip (Engineer): on a short map (375x667 with a sheet open) the BLOOM label is clipped at the top edge. The map-fit margin doesn't count the label.
