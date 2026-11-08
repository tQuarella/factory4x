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

## Can wait (allowed while waiting on the owner)

- **cw-raid-regroup** (Designer to decide, then engineer): after cutting the Root, raid-supply moves the Root survivors to a5 but leaves ships built meanwhile at the probe. It is harmless at today's numbers, but would matter if Roots get weaker or starved Blooms stronger. The fix would be one `sendShips(probe, a5, 0)` after the cut (Critic note on h2-bots).

- **cw-flaky-test** (engineer): during the h2-art round 2 review, `npm run gates` failed the `test` gate once (28.5 s against the usual 10–14 s) and passed on rerun. Which test failed wasn't captured. Find it (likely a timing-sensitive test under load) and make it deterministic. A flaky gate weakens the gate.

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
