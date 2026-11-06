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
| m1-sim | All H1 sim rules, inputs, data and the sim API | core-engineer | Ready |
| m1-client | Playable phone client: map, sheets, HUD, controls, tuning, feedback, autosave | engineer | Blocked on m1-sim |
| m1-bots | rush and turtle strategies plus the capture-based report | engineer | Blocked on m1-sim |
| m1-art | Draw functions and style for every M1 entity, including the Bloom | art-direction | Ready (no sim dependency; runs alongside m1-sim) |

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

## Can wait (allowed while waiting on the owner)

- cw-ci-hardening (needs owner approval: `.github/workflows/` is protected): bump `actions/*` to versions that run on Node 24 (GitHub warns Node 20 is deprecated), and have the live smoke step wait for the deployment URL to answer over HTTPS before testing. A new Pages subdomain's TLS certificate took about a minute on the first deploy and failed the first live smoke run.
- ~~cw-gate-windows~~ **Done** 2026-11-06 (Q9): `protected-files.mjs` now calls git without a shell, so it no longer skips on Windows.
- cw-bench: benchmark scenario with 10k entities for the tick budget once ECS lands
- cw-hud-version (Engineer; added by the Retrospective, 2026-11-06): the HUD shows `BUILD_VERSION` as `main-<run>-<40-char sha>` (set in `ci.yml`), which is long enough to wrap on a 375 px phone. Shorten the displayed version in the client to `<ref>-<run>-<first 7 of sha>` (`packages/client/src/main.ts`, no protected file needed). Keep the full version in the feedback/replay metadata. Acceptance: the smoke test at phone size shows the version on one line, and the full sha is still recoverable from the build.
