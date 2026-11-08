# Decisions

Dated log of decisions and why. Newest at the bottom. Every prompt or process change goes here with its reason.

## 2026-11-06 · Director · Milestone 0 bootstrap

- **Handoff plan revised (rev 2)** after owner review: slimmer roster, cross-engine determinism rules, Critic deadlock rule, protected files, phone-first routes, replays and data versioning. Owner approved. Full text in `docs/HANDOFF_PLAN.md`.
- **Friends access:** public link, no password (owner).
- **Pillars and image generation:** deferred until after Milestone 0 (owner).
- **Stack:** TypeScript, npm workspaces (no extra package manager to install), Vite for the client, Vitest for unit tests, Playwright for the release smoke test, ESLint with typescript-eslint. Source-level workspace exports (`exports: ./src/index.ts`) so there is no build step for the sim.
- **Determinism:** mulberry32 PRNG (integer-only), FNV-1a over canonical sorted-key JSON for state hashes. Gate compares hashes every 300 ticks over 9,000 ticks. The smoke test also runs the reference replay inside the browser and compares with Node, which is the real cross-engine check.
- **Tick budget:** p95 ≤ 2.0 ms per tick on CI hardware. Reasoning: bots must play a 30-minute game (54,000 ticks) in about a minute; real-time play at 30 Hz leaves far more headroom. Revisit with a 10k-entity benchmark once ECS lands (cw-bench). Recorded in `scripts/gates/budgets.json`.
- **Softlock detection:** state hash unchanged for 5 game-minutes. Crude but deterministic; refine when there is real gameplay.
- **Renderer:** Milestone 0 placeholder uses Canvas 2D to avoid a dependency nobody has chosen yet. Engineers pick Pixi, Phaser or similar in Milestone 1 and log it here.
- **Entity storage:** Milestone 0 world is a plain object. ECS is the Core Engineer's first Milestone 1 task (m1-ecs).
- **Roster:** Bot runner and Release replaced by scripts (`npm run bots`, CI deploy + `npm run changelog`). Balance and Faction AI defined but dormant until Milestone 2. Core Engineer (Opus) added for determinism-sensitive work and escalations.
- **Protected-file enforcement:** Claude Code deny rules in `.claude/settings.json` (hard stop for agents' edit tools) plus `scripts/gates/protected-files.mjs` (CI tripwire). The tripwire can be forged, so it is not a security boundary; Q5 offers GitHub branch protection.
- **Worktrees:** engineers run as subagents with Agent isolation `worktree`, on branches `task/<id>`. `npm run worktree` exists for manual use. Merges go only through `npm run merge-task`, which requires `VERDICT: APPROVE` in `reviews/<id>.md` and re-runs all gates on the merged result.
- **Deploy host: Cloudflare Pages** (owner). Fly.io considered and rejected: it runs containers, so a static page would need a server image and a running machine, with no per-branch previews. Deploy is a job in `ci.yml` that runs only after all gates pass: `main` deploys to production (the public link), every other pushed branch to a preview URL. The smoke test then re-runs against the live URL. The job is skipped with a warning until the Cloudflare secrets exist. Project name `factory4x`.
- **Usage budget:** 12 subagent launches per iteration, at most 2 Opus reviews per task. Tunable by the Retrospective (not a gate).

## 2026-11-06 · Director · Design session with the owner

- **Campaign shape (owner):** roguelite. Each star system is a 20–40 minute run; the campaign spans sessions. The owner first chose multi-hour sessions, then switched after seeing the NG+ options: "shorter sessions but more capability each time."
- **NG+ carry-forward (owner):** research, probe design choices, and harder systems.
- **No fail state, no clock (owner):** mobs defend only, the run can't be lost, and tension comes from the optimization puzzle. Consequence: bots measure time-to-probe and throughput, not win rate.
- **Guardian factories replace defenders up to a cap (owner, Director's proposal):** keeps "outpace their factories" from the original note without adding time pressure.
- **Ship control by orders to nodes (owner).** **Autosave mid-run (owner).** **3–4 production tiers (owner).** **Mob flavor:** delegated to Designer and Art Direction.
- **Pillars:** revised wording proposed in QUESTIONS.md Q7, awaiting owner sign-off because `VISION.md` is protected. Milestone 1 spec waits on it.
- **Tick budget check:** the 2.0 ms p95 budget was sized for a 30-minute game, which still matches a 20–40 minute run. No change.
- **Pillars signed off (owner, in chat):** Q7 approved as written, with `APPROVED-PROTECTED: VISION.md` recorded in QUESTIONS.md. The agent edit to `VISION.md` was blocked by the protected-file guard, as intended, so the owner applies the prepared text. Milestone 1 spec (H1) can start once `VISION.md` is updated.
- **VISION.md guard changed from deny to ask (owner request and approval, Q8):** the Director may apply owner-approved changes to `VISION.md`, and each edit prompts the owner for permission. Subagents still can't edit it, because they have no live owner to answer the prompt. Updated the Guardrails section of `PROCESS.md` (protected section; owner approved in chat) and `CLAUDE.md`. Auto mode blocked the agent from editing `.claude/settings.json` itself, so the owner applies that one-line change.

## 2026-11-06 · Director · Owner involvement

- **Owner acts only when it must be them (owner):** "i don't want to do anything myself unless i have to or am the only decision maker." Added to `CLAUDE.md` so every session sees it. Consequence: protected-file approvals should be a prompt the owner accepts, not an edit the owner makes. Proposed moving the remaining protected-path `Edit` rules from `deny` to `ask` (Q9); the owner applies that once, because agents can't change their own permissions.

## 2026-11-06 · Retrospective · build-20261106-1 (Milestone 0)

Scope: commits 95baa06..00c150c (tagged), plus ea50f8c and its parents on `main`. No engineer or Critic agents ran. The Director built Milestone 0 directly with the owner present, so there are no reviews, rejections or escalations to analyze, and subagent launches were 0 / 12.

**Went well**
- The pipeline works end to end on day one: gates, CI, Cloudflare Pages deploy, and a live smoke test at desktop and phone sizes against https://factory4x.pages.dev.
- The guardrails held. The protected-file deny rule blocked an agent edit to `VISION.md` as intended, and the owner's approval was recorded (Q7 `APPROVED-PROTECTED: VISION.md`) before the edit was applied.
- The live smoke test caught a real problem: the new subdomain's TLS cert wasn't ready yet. That gate stays. The fix is in the workflow, not the gate (cw-ci-hardening).
- Owner questions were mostly ones only the owner could answer (host, accounts, pillars, protected changes). The team made the stack, determinism, tick budget and renderer calls itself.

**Didn't go well**
- **Two sessions wrote the same shared files in one working tree, uncommitted.** The Director session and the design session both edited `STATUS.md`, `QUESTIONS.md`, `DECISIONS.md`, `CLAUDE.md` and `BACKLOG.md`. Once, `STATUS.md` said the pillars were signed off before `QUESTIONS.md` and `VISION.md` showed it. Nothing in `PROCESS.md` covered this case. This retro also ran while another session had uncommitted edits (`.claude/settings.json`, `scripts/gates/protected-files.mjs`), so it keeps happening.
- **A gate passed without checking anything.** On Windows, `protected-files.mjs` skipped silently (cmd.exe strips the `^` in `<ref>^{commit}`), and `reports/gates-latest.json` recorded `"ok": true`. CI on Linux was unaffected, but every local "PASS" on this machine meant nothing. The fix is cw-gate-windows, which another session is applying now. Lesson for the gates' owner: a skip should show up as a skip in the report, not as a pass. That needs a protected-file change, so it is not made here.
- **Deploy needed two re-runs.** First, the Cloudflare secrets were added after the CI job had already started, so the deploy step skipped. The Director couldn't check beforehand, because `Bash(gh secret *)` also denies `gh secret list`, which shows names only. Second, the TLS cert wasn't ready (see above).
- **Wrong commit author.** The first commit was made with a hand-set author name instead of the owner's git identity. It was fixed by amend before push.
- **HUD version too long for phones.** `main-<run>-<40-char sha>` wraps at 375 px.

**Changes made**
1. `PROCESS.md`: new section "Concurrent sessions in one working tree". It covers: treat uncommitted changes you didn't make as someone else's; commit your own shared-file edits promptly and stage paths explicitly; make targeted, append-only edits; `STATUS.md` claims need evidence in `QUESTIONS.md`/`VISION.md` first; commit with the configured git identity, never `--author` or `-c user.*`. Evidence: the STATUS/QUESTIONS mismatch, the concurrent uncommitted edits, and the hand-set author. Nothing about any gate or guardrail changes.
2. `BACKLOG.md`: Can wait item cw-hud-version, to shorten the displayed version to a 7-char sha in the client. No protected file needed.
3. `QUESTIONS.md`: Q10 (Can wait). Narrow the `gh secret` deny rule to `set`/`delete`/`remove` so agents can list secret names. It's a settings.json change, so the owner applies it, possibly together with Q9.

Not changed: the usage budget. With 0 launches there's no evidence to tune it yet. Revisit after the first iteration with engineers and the Critic.

## 2026-11-06 · Director · Protected-file prompts and gate fix

- **Protected files except settings.json are now ask, not deny (owner, Q9):** the owner applied the prepared `.claude/settings.json`. The Director edits a protected file only in a live session after the owner approves in `QUESTIONS.md`, and the owner accepts each edit at the prompt. `CLAUDE.md` updated. The `PROCESS.md` Guardrails line still describes the VISION.md-only exception, because another session was editing `PROCESS.md` at the time; widen it on the next pass.
- **cw-gate-windows fixed:** `protected-files.mjs` uses `execFileSync('git', args)`. Through cmd.exe, `^{commit}` lost its `^`, so the gate never found a base ref on Windows and skipped. Tested on Windows: it passes on approved changes (`--base 00c150c`), and in a throwaway repo it fails on an unapproved `VISION.md` change and passes once the approval line is added.

## 2026-11-06 · Designer · Milestone 1 spec (H1)

- **One production tier in M1** (ore → probe → ships and structures). H1's two claims are about delivery rate and beating guardian regrowth, and neither needs a chain. Refining and components get their own hypothesis (H2) once the core loop is shown to be fun. The owner's 2–3 tier first system comes after M1.
- **Run end in M1 = capture, a result panel, then free play.** This gives the puzzle a score with no clock during play. "Consequences" asked to confirm a result screen with the owner, so it ships behind a toggle (default on) and is asked as Q11 and in handoff question 3.
- **Autosave is in M1.** It is a VISION.md fixed decision, phone tabs get killed, and the state is already plain data. It is one slot, at most 5 s lost, and a save with a different data version is discarded.
- **The Bloom (guardian hive) is part of the rich node, not a separate attackable node.** Hive attacks and supply-cutting are deferred to an H2 candidate with the raid-supply bot. M1 tests the regrowth-vs-wave math alone.
- **Combat is simultaneous rounds with focus fire, oldest unit first.** Integer and deterministic, it behaves close to Lanchester's square law, so bigger waves lose fewer ships. That makes "commit enough at once" the lesson and trickling a visible mistake. Regrowth every 2 s (60 ticks) was picked because it moves the winning wave size (about 28 ships against 12 thorns, versus about 35 at 30 ticks), so the hive's replacement rate matters within a single fight.
- **Probe mining (12 ore/min) is a floor on income.** With no fail state, a player who spends everything badly can always recover, and the bot softlock check can't trip on a dead economy.
- **Queued builds reserve ore ahead of the shipyard, and the shipyard has an on/off toggle.** Without them, auto-built ships would eat every ore and the player could never save for an extractor. The toggle makes "economy first" a real choice (turtle uses it).
- **Ship orders are target-first** (select the destination, tap "From <node>") and **routes are never tap targets.** Phone rule: no drag, no thin-line taps, every action within 2 taps.
- **Live tuning is a `setTunable` input in the replay log**, so feedback replays reproduce tuned sessions. The Core Engineer may choose another mechanism if it logs why.
- **Default numbers came from a throwaway model of the spec's rules** (scratchpad only, not committed). Its estimates: turtle captures at about 11 minutes with 1 wave; rush at about 25–30 minutes after about 6 failed waves; throughput about 56/min at 5 minutes, 150/min at full asteroids and 250/min after capture. The bots are the real check.

## 2026-11-06 · Director · Milestone 1 split

- **Four tasks instead of ten** (`m1-sim`, `m1-client`, `m1-bots`, `m1-art`; see `BACKLOG.md`). Ten slices with one Critic review each would take about 21 launches against a 12-launch budget. Four tasks need about 9 launches, leaving 3 for rework.
- **Renderer for M1: Canvas 2D.** The plan let the Engineers pick Pixi or Phaser, but the art and client tasks run in parallel, and they need one fixed draw-function contract (the signatures are in `m1-art`). M1 draws at most a few hundred sprites, which Canvas 2D handles on a phone. Revisit if `cw-bench` or a later milestone needs more.
- **`m1-art` starts alongside `m1-sim`:** it depends only on the draw contract, not on the sim API. `m1-client` and `m1-bots` start when `m1-sim` merges.
- **Bot softlock rule redesigned in `m1-bots`:** constant probe mining changes the state hash every tick, so "hash unchanged" can never trigger. The new rule: no delivery and no ship for 5 game-minutes before capture.
- **Agent worktrees live in `.claude/worktrees/`, inside the repo** (that's where Agent isolation puts them). Added to `.gitignore`. ESLint doesn't read `.gitignore`, so `eslint .` on `main` was also linting 49 files from in-progress task branches, and one broken branch could fail `main`'s lint gate during a merge. The `lint` script now names the project's own paths (`packages scripts tests` plus the three root configs): the same 24 files as before, minus the worktree copies. This doesn't weaken the gate. The protected `eslint.config.js` would be the cleaner place (`ignores: ['.claude/**']`); proposed in QUESTIONS.md Q12.

## 2026-11-06: m1-art palette additions and gallery build entry (Art Direction)

Added Bloom pink (`#ff4f8b`, `#ffb3cc`), withered grey (`#7a7f8a`, `#4a4e58`), thorn core, backed-up route amber and flash white to `palette.ts`. Adds `gallery.html` as a second Vite build input in `vite.config.ts` so it ships in `dist` for `vite preview`. Small refinements within the approved direction.

## 2026-11-06 · Core Engineer · m1-sim architecture

- **Entity storage: dense arrays of plain records, kept in ascending id order** (`ships`, `routes`, `guardian.thorns`, pods per route), with one id counter (`nextId`). New entities are appended; dead ones go with an order-preserving filter. Nodes are indexed by map position. Every system loops over these arrays, so iteration order is always id order. Rejected: struct-of-arrays with typed arrays (typed arrays aren't plain JSON, so autosave and the hash would need a conversion layer, and M1 has at most a few hundred ships); a generic ECS with component maps keyed by entity id (object-key iteration risk and indirection with no M1 benefit). Measured: a scripted 30-minute game that captures and ends with 352 ships has tick p95 0.0016 ms against the 2.0 ms budget. Revisit with cw-bench at 10k entities.
- **Live tunables live in the world (`world.tun`, keyed by dotted name)**, start from data defaults, and change only through the `setTunable` input. So they are hashed, saved by autosave, and in the replay input log, which keeps the spec's mechanism: a replay reproduces a tuned session. Rejected: data snapshots in the replay, because they need a second channel and lose the tick at which a change was made.
- **`data/sim.json` schema:** `tunables` maps each dotted key to `{default, min, max}`. The ranges are tuning numbers too, so they live in data, not code. `map.nodes` holds the map. `parseSimData` validates all of it (no missing or unknown keys, integer defaults within range, the probe at index 0, exactly one rich node), and `defaultData` goes through it.
- **`step(world, data, inputs)` keeps its `data` argument.** `data` is the static rule book (tunable ranges for `setTunable` validation); `world` is the mutable state. `step` and `replayHashes` throw when the data version doesn't match. Rejected: copying the ranges into the world (static metadata in every hash and save) and a module-level registry (hidden global state).
- **Saves:** `serializeWorld` wraps the world in `{format, dataVersion, world}`. `deserializeWorld` returns a `LoadResult` (`ok`, or `reason: 'dataVersion' | 'corrupt'`) instead of throwing, so the client can show the mismatch toast without parsing exceptions.
- **Selectors return integers:** rates that need a decimal place come in tenths (`shipsPerMinX10`, `killPerSecX10`), so the sim stays integer-only and the client formats them.

## 2026-11-06 · Core Engineer · m1-sim spec readings (H1)

Places where DESIGN.md H1 was ambiguous or slightly inconsistent. Each one follows the reading closest to the intent.

- **a1 route length is 247, not 248.** floor(sqrt(170² + 180²)) = floor(247.59). The rule (floor) wins over the table; the cost is 9 either way.
- **Throughput buckets:** rule 10 says to zero "the bucket being entered", but rule 4 of the same tick has already delivered into the current bucket. Reading: at the end of the last tick of each game second, update `peakPerMin` from the full 60 s window, then clear the bucket the next tick will write to. Zeroing the current bucket would delete that tick's deliveries.
- **Battle end** is checked every tick after combat, not only on round ticks. It is `repelled` if this tick's round killed the last ships present; otherwise (they were ordered out) it is `withdrew`.
- **`wavesSent` counts `sendShips` orders to the guarded rich node only.** Ships that fly there on their own because the rally point is `rich` (a trickle) are not counted as waves.
- **`setTunable` takes effect in the tick it is logged in.** From the player's view, that is "from the next tick on".
- **"Queued" counts work under construction too.** `buildRoute` is invalid while a route from that node is active, and `upgradeRoute` counts active and queued upgrades toward `route.maxLevel`. Upgrade costs follow the target level.
- **`sendShips` with a count above the ships available sends them all.** It is valid as long as at least one ship is there.
- **`setTunable` rejects `client.*`** (client settings, not sim state; the client handles `client.autosaveSec` itself) **and `stats.*`.** It accepts `economy.startStock`, which only affects new worlds; the metadata marks it `newRunOnly`.
- **Live-tuning edge cases:** if `route.maxLevel` is lowered below a queued upgrade, the order is dropped unpaid when it reaches the head of the queue. Thorn repair never lowers a thorn above a reduced `guardian.thornHp`. Thorns above a reduced `guardian.cap` stay, and regrowth pauses until they fall below it.
- **Capture with no fought round:** if both sides wipe out in the same round and a ship then arrives before regrowth, the capture still records a `lastBattle` (outcome `captured`).
- **Travel times:** pods and ships are decremented on the tick they launch (rule 4 and rule 6 come after the launch), so a trip takes exactly ceil(length / speed) ticks, counting the launch tick.
- **`serializeWorld` doesn't check the version** (a world can't mismatch itself). The refusal happens on load (`deserializeWorld`), and also in `step` and `replayHashes`.
- **Kill-rate selector:** ships × damage / thornHp per round, converted to thorns per second. It ignores overkill waste and repair. It is the planning number for "you strip 2.4 thorns/s".
- **`stats.throughputWindowSec` is not in `world.tun`.** It sets the ring buffer length when the world is created, and `setTunable` rejects it.

## 2026-11-06 · Engineer · m1-bots: reading "throughput still rising at minute 10"

The bot tuning target says turtle's throughput should still be rising at minute 10. The report checks throughput at 12 min > throughput at 10 min. At defaults turtle's a1-a5 asteroid network plateaus at about 148 ore/min by about 6.5 min, so it is not rising at minute 10 by itself. The target passes (148 at 10 min, 231 at 12 min) only because turtle captures the rich node at about 9.7 min and the rich build-out adds ore afterwards. If the Designer meant the asteroid economy itself, the target is missed at defaults; this is a reading for the Designer to confirm, not a tuning change. Other bot decisions: softlock is 5 game minutes since the last route delivery or ship built (measured every tick from the per-second delivery buckets); ships built/lost and ore spent are reported as of capture, with whole-run totals labelled `wholeRun` in the JSON.
## 2026-11-06 · Engineer · m1-client decisions

- **Inputs sent while paused step one tick.** `Session.send` while paused applies the input by stepping exactly one tick, so the screen reflects the tap and the log records it like any other input. Rejected: holding the input until unpause (taps seem to do nothing) and letting the client mutate the world (breaks replay).
- **Save format (format 2, key `fvn.save`).** JSON `{format, seed, dataVersion, startTunables, world (serializeWorld text), log, pending, history, flags}`. The seed and the whole input log are saved with the world, so after a resume `seed + log` still replays to the live hash, and a feedback note sent after a resume carries the whole session. `pending` (inputs sent but not stepped yet) is saved so none are lost. Client settings (result toggle, hint dismissed, `client.autosaveSec`) live in a separate key, `fvn.settings`, and survive New run. A save from another dataVersion, or an unreadable one, is discarded with a toast.
- **Battle report "sent" is `shipsEngaged`** (distinct ships that fought at least one round), not ships dispatched. It matches what the wave actually did, which is the lesson the report teaches.
- **Feedback URL limit is 7500 characters.** Longer notes (replay included) go to the clipboard, and an "Open issue page, then paste" button opens a short prefilled issue. GitHub rejects very long URLs, and phones differ. The note is never sent automatically.
- **Retreat button on the rich sheet** ("Retreat to Probe · N"). The spec has retreat only via the probe or A5 sheet ("From Rich"). This is a one-tap shortcut for the same `sendShips` input. Its space is always reserved (disabled with 0 ships here), so it never appears under a finger where "Attack from …" was.
- **New run keeps the live tuning.** The Director's ruling: the new world is built from the shipped data with the current tuned values as its defaults (`dataWithDefaults`), so `economy.startStock` and `guardian.cap` apply. The replay and the save record these as `startTunables`, so the replay (`replayData(replay)`) still reproduces the session. The confirm dialog says tuning is kept, and "Reset all" restores defaults (it sends `setTunable` only for values that differ).
- **Notice layout.** The battle banner has its own strip above the map and the battle-report toast sits at the bottom of the map, so neither covers the Bloom at the top. A smoke test checks this at 375x667 and at the default phone size.

## 2026-11-06 · Engineer · wavesSent counts one wave per tick (m1-client scope, Director)

- **Several attack orders to the guarded rich node applied in the same tick count as one wave.** The client's "All" button sends one `sendShips` per source node, so each press used to inflate the wave count. `step` caps the `wavesSent` increase from one tick's inputs at 1. Orders on separate ticks still count separately. Bots send from one source, so rush and turtle behavior is unchanged.

## 2026-11-06 · Core Engineer · One press, one tick (m1-client, escalated)

- **Every input of one user action applies in the same tick, paused or running.** `Session.sendAll(inputs)` validates each input against the current world, queues the valid ones together and, while paused, steps exactly one tick; `send(input)` is `sendAll([input])`. "Attack with all" and "Reset all" each make one `sendAll` call. Before this, "All" called `send` once per source, and because a paused `send` steps a tick, a paused press spread its orders over several ticks: the sim's one-wave-per-tick rule then counted two waves, and Reset all advanced paused time by one tick per changed value. The log still records each input with the tick that applied it, so replay and autosave are unchanged.
- **Rejected:** widening the sim rule (for example "one wave per N ticks" or per target per battle), because the defect is that the client split one action, and a time-window rule in the sim would change what counts as a wave for bots and replays; a paused-only "hold inputs until the frame ends" queue in `Session`, because it makes a tap's effect depend on frame timing and hides when the tick happens; and validating later inputs in a batch against the earlier ones already applied, because `step` revalidates every input when it applies it, which matches the running path exactly.

## 2026-11-06 · Core Engineer · Notices sit in flow above the map (m1-toast-fix)

- **The battle-report toast moves out of the map overlay into the notices strip above the canvas, below the banner.** The strip is in normal flex flow and the canvas is fitted to whatever height is left, so no font, wrap or text length can put a notice over the Bloom or any other node. Before this, the toast was absolutely positioned at the bottom of the stage and grew upward. With Linux's wider fallback monospace it wrapped onto more lines and reached the Bloom, which broke CI on main 71cec57 while Windows' Consolas passed.
- **The strip is capped at 45% of the map's height and clips its content.** The banner keeps its natural height. The toast shrinks to what remains, but never below 44 px, and scrolls inside it. Tapping it anywhere still dismisses it. The toast is now a `div role="button" tabindex="0"`, with Enter and Space handled, instead of a `<button>`, because WebKit doesn't reliably scroll the contents of a button.
- **The smoke test forces a wide serif font** at 15 px with 0.25em letter spacing on the notices, at the default phone size and at 375x667. Local Windows runs therefore fail the way CI does if the layout ever depends on metrics again. The test also asserts that each notice ends above the canvas, that the canvas keeps at least 55% of the map height, and that the toast is at least 44 px tall.
- **Side effect:** the toast no longer covers the probe, which the round 2 review noted as non-blocking. The map now shrinks while a toast is up, so nodes move when it appears and when it's dismissed, the same trade-off as the banner. That jump is still on the Designer's list.
- **Rejected:**
  - Measuring the Bloom's screen rect in JS and setting the toast's `max-height` from it: it is more code on the resize path, it still overlays the probe, and it ties layout to node positions.
  - A line clamp with no scroll: it would hide the second half of the battle lesson ("Regrowth outpaced the wave…"), which is the point of the toast.
  - Bundling a webfont so metrics match everywhere: it treats the symptom, players can still zoom text, and it adds weight to the build.

## 2026-11-06 · Retrospective · build-20261106-2 (Milestone 1, first playable)

Scope: `git log build-20261106-1..build-20261106-2` (b86ac34..c11124b), the five reviews in `reviews/m1-*.md`, `STATUS.md`, `BACKLOG.md` and `PROCESS.md`. This was the first iteration with every role.

**Went well**
- **Splitting M1 into four tasks fit the budget.** The plan needed 9 launches. The iteration used 10, plus this retro, even with an escalation and an unplanned broken-`main` fix. m1-sim passed on its first review.
- **The Critic's play-throughs caught real defects** that gates and the engineer's own screenshots missed: the banner over the Bloom, Retreat appearing under the Attack finger, the false "blocked tab" message, and paused "All" counting two waves. It also caught a gate weakening in m1-bots (copied seeds skipped the crash and softlock checks) and a softlock timer that fired at 6 minutes instead of 5. All of these review checks stay.
- **The deadlock rule worked as written.** m1-client went to the Core Engineer after its second rejection, and the Core Engineer fixed the root cause with one tick per user action, rather than widening the sim rule.
- **The broken-`main` fix was well done.** m1-toast-fix took the layout out of font metrics. The Critic then reproduced the Linux failure on Windows by restoring the old files and running the new wide-font tests: they failed against the old layout and passed against the fix.

**Didn't go well**
- **Every merge of `main` into a task branch conflicted in `DECISIONS.md`** (c7777ca, e4d37b7, 20d59f3), because both sides append at the end. The Director resolved each one by hand. One resolution lost the blank line before "m1-client decisions".
- **`main` went red after m1-client merged.** The cause is the platform, not the review. Every check (gates, build, three Critic smoke runs) ran on Windows, whose Consolas fit the toast. Linux CI uses a wider fallback monospace, so the toast wrapped onto more lines and covered the Bloom. No task branch was ever pushed (`git branch -r` lists only `main`), so the Linux CI that runs on every pushed branch, with gates, build and smoke, never saw m1-client before the merge. Answer to "what local gate would have caught it": no Windows-only run catches platform font differences in general. The wide-font stress test catches this class of bug, but today it covers only the notices. The check that catches the whole category is the existing branch CI, which was never used.
- **Two agents stalled for 10 minutes**: the Designer during calibration, and the client engineer at its last step. A `vite preview` server from an earlier worktree was still listening and blocked deleting that folder. One related risk: `playwright.config.ts` reuses any server already on port 4173 for local runs, so a stale server can make a smoke run test another worktree's build.
- **The launch ledger lost track.** `STATUS.md` says 10 launches, itemized as core-engineer ×2 and critic ×4. But the Core Engineer ran three jobs (m1-sim, the m1-client escalation, m1-toast-fix), and five tasks were reviewed. The resume note still lists the first three resumes. The commits show at least five more: art round 2 review, bots fix and round 2, client fix round 2, client reviews in rounds 2 and 3. It may also have missed m1-toast-fix. Real agent runs were about 18, against a reported 10. Counting launches only, as the Director did, matches `PROCESS.md`'s wording. Resumes are the cheaper and better choice for fix rounds, because the agent keeps its context. But they used more usage than the reported number shows.
- **Rejection root causes.**
  - m1-art: the first rejection was about the contract and the palette, both already stated in the acceptance criteria and in `art-direction.md`. The agent hadn't checked its own gallery against them. A prompt change wouldn't have helped.
  - m1-bots: the rejection was about an untested boundary and a gate weakening the prompt already forbids.
  - m1-client round 1: mostly UX found by playing. That is the gap addressed below.
  - m1-client round 2: a sim fix ruled mid-task missed the paused path.
- **Owner questions.** Q11 and the staggered "All" are fun calls, correctly sent to the owner. Q12 (eslint ignore) is a protected-file change, so it correctly goes to the owner too. No owner question was one the team should have decided itself.

**Changes made**
1. **`.gitattributes`: `DECISIONS.md merge=union`.** This uses git's built-in union driver, so no config is needed on any machine or in CI. Evidence: the three conflicts above. I tested it in a throwaway repo. Two branches appending different entries merge cleanly, with both entries kept. Two caveats, both noted in the file and in `PROCESS.md`:
   - The blank line between the two appended entries can collapse. That is cosmetic.
   - If the same existing line is edited on both sides, both versions are kept, with no conflict marker. That is acceptable only because `DECISIONS.md` is append-only.

   `STATUS.md`, `BACKLOG.md` and `QUESTIONS.md` are edited in place, so they are deliberately not included. No gate changes: `merge-task` still re-runs every gate on the merged result.
2. **`PROCESS.md`: new "Before merging" section and Merge step.** A browser-facing task (client, smoke tests, Playwright config) has its branch pushed after approval and merges only when the Linux CI run on that exact commit is green. Evidence: m1-client. This adds a check and weakens nothing. Making it automatic is backlog item cw-merge-ci-check.
3. **`.claude/agents/engineer.md`** (inherited by core-engineer; art-direction follows it in worktrees):
   - A "Long-running commands" section: no hand-started servers; check port 4173 before `smoke`; time limits and no prompts; stop everything you started before reporting.
   - The Finish step now requires `npm run smoke` when the client or smoke tests changed.
   - Layout assertions must force a wide font.
   - UI tasks must be played through by touch at 375x667, at the spec's key moment.

   Evidence: the two stalls, the leftover server, m1-client's red `main`, and m1-client round 1. `.claude/agents/designer.md` gets one line: bound and print progress in calibration runs (the Designer stall).
4. **`PROCESS.md` usage budget accounting.** The budget stays 12 launches. M1 used 10, plus the retro, with an escalation and an unplanned fix, so 12 is right for a four-to-five-task iteration. The section now says:
   - the retro counts as a launch;
   - planning reserves 2 spare launches;
   - resumes are defined, preferred for fix rounds, and counted;
   - `STATUS.md` keeps a one-line-per-run ledger, because updating only the totals lost about 8 runs.

   I didn't add a resume cap: there is one iteration of data, and the counts above are reconstructed from commits. Revisit next retro with a real ledger.
5. **`BACKLOG.md` (Can wait):**
   - cw-smoke-isolation: no reuse of stale preview servers in local runs, and a shared wide-font fixture for every layout assertion.
   - cw-merge-ci-check: `merge-task` checks for green branch CI on browser-facing tasks.

**Not changed:** no gate, guardrail or protected file. A Linux smoke run in a container would be a stronger local gate, but it needs Docker or WSL on the owner's machine. Branch CI gives the same Linux check with no setup. Q12 stays open with the owner.

## 2026-11-06 · Designer · H2 spec (decision depth: cut the supply or overwhelm)

- **The second way to crack the Bloom is the Root**, a guarded node that feeds it (VISION pillar 3, "cut their supply first"). Taking the Root wilts the Bloom from 12 to 8 thorns, slows its regrowth from 2 s to 10 s, and stops its repair. No new input is needed: attacking the Root is a `sendShips`. Rejected for now: a garrison or siege rule, where supply is cut only while your ships hold the Root. It has more depth, but adds a hold rule and a split-fleet readout. It is the follow-up if H2 still reads as obvious.
- **The wilt (cap drop) is part of starving, not only slower regrowth.** In the model, slower regrowth and no repair alone lower the winning Bloom wave from 27 ships to 22, which is too small for a player to notice. The wilt to 8 thorns lowers it to about 15, and the thorns falling off the Bloom are a visible payoff.
- **Three hand-made variants, differing only in the Root (position and thorn count 4 / 9 / 14), chosen by `seed mod 3`. New run uses seed + 1.** On a fixed map, the better line gets solved once, which recreates "obvious". With the variants, the better line flips: starving wins on Thin, overwhelming wins on Deep, and Knotted is a judgement call. New run cycling guarantees run 2 is a different system. Rejected: procedural jitter of asteroid positions or yields. It would change economy timing and bot comparisons, and mix variety into a test of depth.
- **The Root's strength is per variant in data, plus a live `root.capBonus`, not a live `root.cap`.** New run keeps live tuning (the Director's M1 ruling), so a tuned absolute cap would erase the variant differences.
- **The Root has no ore.** Cutting it is a pure tactical investment, so the trade is ships for a weaker Bloom, with no second payoff that would make starving dominant. Overgrown asteroids that unlock when the Root falls are deferred to H2b.
- **No "ships needed" readout.** The sheets show the fed and starved Bloom side by side, and H1's kill-rate vs regrowth numbers. Estimating the wave is the puzzle. Showing the answer would make it obvious again.
- **The evidence that neither line dominates is per variant, not per measure.** Each of turtle (overwhelm) and raid-supply (starve) must capture first in at least one variant, and turtle must lose fewer ships in at least one. "Each wins on a different measure" alone would let one line dominate on the thing players care about.
- **Starving doesn't make trickling viable.** In the model, waves of 6–12 ships every 30–60 s never beat a starved Bloom. H1's lesson, commit enough at once, holds for both lines.
- **Reading of the H1 bot target "throughput still rising at minute 10":** the Engineer's reading is right. The asteroid network itself plateaus at about 6.5 minutes. That plateau is part of the owner's "one dimensional". H2 fills it with the Root decision rather than changing the economy, so the target is retired for H2 and replaced by the per-variant targets.
- **Calibration:** throwaway JS model in the scratchpad, not committed. It reproduces H1's 27-ship minimum wave against the fed Bloom. Estimates: starve vs overwhelm capture time −50 s (Thin), about −5 s with 2 more ships lost (Knotted), +60 s with 6 more lost (Deep). The bots are the real check.

## 2026-11-06 · Core Engineer · h2-sim: guardian layout, supply link, variants

- **`world.guardians: Guardian[]` replaces `world.guardian` and `world.battle`.** One entry per guarded node, in node-index order (Bloom 6, Root 7), fixed length. Each guardian owns its `battle`, `lastBattle` and per-target counters (`wavesSent`, `shipsLost`, `thornsKilled`). Rules 7, 8 and 9 each loop over every guardian before the next rule runs, matching "rules per tick, in this order". `world.lastBattle` stays as the latest finished battle at any node, with a `node` field. Rejected: keeping `world.guardian` and adding `world.root` (two code paths for one rule set, and a third guarded node would mean a third field); a keyed object `{ rich, root }` (key order is an iteration-order trap, and the spec asks for node order).
- **Battles get an id from `nextId`, and `Ship.engagedIn` stores it** instead of the battle's start tick. With two battles, both can start on the same tick, so a ship that fought at the Root and then joined the Bloom fight would not have been counted as engaged. Consuming ids doesn't change any order: every array is still sorted by id, and ids are only compared within one array. The H1 wave numbers (26 repelled, 27 captures, 28 loses 15, 35 loses 10) and both H1 bot results are unchanged.
- **The chosen system is stored as `world.system` `{ variant, id, name, rootCap }`, not `stats.variant`** as the spec's Stats line says. It is fixed configuration rather than a counter, and storing the base `rootCap` in the world means the effective Root cap, the selectors and a restored save don't need the data's variant table. It is part of the hash because `rootCap` affects future ticks. `runSummary` exposes `variant`, `variantId` and `variantName`. `stats` gains `rootCutTick` and `thornsWithered` as specified.
- **One wave per target per tick, not one per tick overall.** H1's rule existed so that "All" (one order per source node) counts as one wave. Orders to the Root and to the Bloom in the same tick are two attacks, and the result panel should count two. `stats.wavesSent` is the sum of the per-guardian counts.
- **Bloom parameters are evaluated live from the Root's state** (`guardianParams`), not stored. The Bloom's effective cap, regrow ticks and repair are a pure function of `rootAlive` and the tunables. That keeps one source of truth and nothing for the hash to double-count.
- **The wilt pops from the end of `thorns`**, which is the highest id because thorns are appended with fresh ids and removed with an order-preserving filter. The Root's `captured` result carries `wilt: { from, to }` so the toast can say "12 → 8" without re-deriving it. The Bloom's `regrowProgress` is reset to 0 at the cut; the same tick's regrowth rule then runs with starved values.
- **`system.variant` range is validated against the variants table** (`max ≤ variants.length`), and the seed rule is `((seed mod n) + n) mod n` with `n = variants.length` (3 in the shipped data, so it is the spec's mod 3).
- **Optional `node` parameters default to the rich node** (`guardianStatus`, `battleStatus`, `lastBattle`, `combatRates`), so every H1 caller keeps getting the Bloom. Until h2-client lands, the client draws the Root with the rich-node sprite and opens a producer-style sheet for it; Root battles produce no toast. That is h2-client's job.
- **Cost:** bot suite tick p95 0.013 ms against the 2 ms budget, the same as H1.
## 2026-11-07 · Director · Repaired git metadata after a crashed session

The Director session ended abruptly during a commit/push on 2026-11-06 23:37. Two files were left all zero bytes: `.git/config` and `.git/refs/heads/main`. Every object and every other ref was intact (`git fsck` was clean afterwards). `main` was restored to d7fa918, its last reflog entry. The config was rebuilt with the core settings, the `origin` remote and `main` tracking. The zeroed originals were kept in the session scratchpad. Nothing was lost. If git ever reports `bad config line 1`, check for zeroed files first, and restore refs from `.git/logs` rather than recloning.

## h2-client: banner lines, hint, fit margin (2026-11-07)

- Battle banner is one nowrap, ellipsised line per battle (a wrapped two-battle banner in a wide font pushed the toast out of the capped notices strip). The first-run hint moved into that strip and hides while a banner or toast shows. New run seeds with old seed + 1 (no wrap). fit.ts top margin grew by 40 su so the Bloom label does not clip; labels that would still clip go below the node.

## 2026-11-07 · Retrospective · build-20261108-1 (H2, decision depth)

Scope: `git log build-20261106-2..build-20261108-1` (f1b1b33..13201db), `reviews/h2-*.md`, the iteration-2 ledger in `STATUS.md`, `BACKLOG.md`, `PROCESS.md` and this file.

**Went well**
- **Budget held.** 10 launches out of 12, including this retro: the designer, four builders and four first-round Critic reviews. Fix rounds and later review rounds all used resumes, as `PROCESS.md` now prefers. There was no escalation and no broken `main`. The per-run ledger worked: every run can be traced to a commit. Its rows are out of order (the h2-art rows sit below the stall note), so keep rows in run order.
- **h2-sim and h2-bots passed on their first review.** For both, the acceptance criteria named exact numbers to report and said "do not retune".
- **Last retro's changes paid off.**
  - The `DECISIONS.md` union merge removed the hand-resolved conflicts. Four merges of `main` into task branches went through cleanly.
  - Every browser-facing merge waited for green branch CI first. `main` stayed green.
- **The Critic caught both real defects.** It worked out the effective contrast with alpha and the glow extents from the code. It reproduced the 10× toast error on the real sim with tuned values. It also reported the flaky `test` gate run instead of ignoring it. These checks stay.

**Didn't go well**
- **h2-art round 1 failed partly on the same miss as m1-art round 1: new colours missing from the ART_STYLE.md Palette table.** It also failed on a cut vine at 3.56:1 effective contrast (alpha 0.8) and a glow outside the stated radius. All three rules were already in ART_STYLE.md and the task's acceptance criteria. The M1 retro concluded that a prompt change wouldn't help. A second occurrence shows the agent doesn't check its own work against the guide before reporting, so this time a checklist is warranted, plus a test so the gates catch it.
- **h2-client round 1: a player-facing factor was 10× wrong in the "faster" branch** (`1000 / x10` instead of `100 / x10`). The engineer's tests covered only the default tuning, which takes the "slower" branch. The same review also found that an acceptance criterion (a forced `system.variant` applying on New run) had no lasting test.
- **Stalls (r4, r5, r6) and the dropped h2-sim run** were the laptop sleeping or losing its network (owner, 2026-11-07). That is not agent behaviour. No prompt change, as instructed. 4 of the 8 resumes were caused by this. The other 4 were productive fix and review rounds.
- **Git metadata zeroed by the crashed session.** Already repaired and logged above (Director, 2026-11-07). It came from the same host problem, and there is no process gap to fix.
- **A `gh run watch` network blip read as "CI failed"** until it was rechecked. That cost a recheck, not a wrong merge, but the opposite misreading of a CI result would be worse.
- **A flaky `test` gate run** (h2-art round 2). It is already tracked as cw-flaky-test.
- **Owner questions:** none were raised mid-iteration. The H2 direction (depth first) and the three fun questions in the handoff are the owner's calls. No team decision should have gone to the owner, and no owner decision was taken by the team.

**Changes made**
1. **`.claude/agents/art-direction.md`: new "Before you report" checklist.** It covers three checks: palette table vs `palette.ts`, compared by diff against `main`; contrast at the effective drawn colour in every state; and stated bounds, worked out with numbers. The results go in the report. Evidence: m1-art round 1 and h2-art round 1.
2. **`.claude/agents/engineer.md`** (also used by core-engineer, and by art-direction in worktrees):
   - Any player-facing number computed from tunables is unit-tested at the defaults and at non-default values that reach every branch, within the designed tuning range.
   - Each acceptance criterion is shown by a lasting test, and the report names it.

   Evidence: h2-client round 1.
3. **`PROCESS.md` "Before merging":** if `gh run watch` errors, recheck the run's own conclusion with `gh run view` or `gh run list` before acting. Evidence: the merge-time false "CI failed".
4. **`BACKLOG.md` (Can wait): cw-palette-sync-test.** A unit test that fails `npm run gates` when `palette.ts` and the ART_STYLE.md Palette table disagree. This makes change 1's first check mechanical. It adds a test and weakens nothing.

**Not changed:**
- The budget stays at 12 launches. H2 used 10 for four tasks with no escalation, which leaves room for one.
- Still no resume cap: half of the resumes were host stalls, so the data doesn't support one.
- No gate, guardrail or protected file was touched, and there is no new owner question.

## 2026-11-07 · Designer · H2 triage and H3 candidates

- **H2 is read as a structural failure, not a balance miss, so no retune is proposed.** The bots found the lines balanced (about 50 s apart on Thin and Deep), and the owner still found cutting the Root obvious and both runs the same. Retuning `map.variants` or `bloom.starved*` would only move small time margins around.
- **Trade-offs measured only in time don't register.** With no clock (pillar 4), and ships that are only ore, every H2 cost came down to minutes, and a 50 s gap in a 10-minute run is invisible. From H3 on, a choice should differ in what the player gets or can do next, or show up as visible compounding (ore/min), not only as a capture time.
- **The fixed sequence (economy, then ships, then attack) comes from an unguarded economy.** As long as growth needs no fighting, "economy first" is always right. This is why Fight to grow (H3-A) is recommended over variety (H3-C): H2 already changed the Root between runs, and the plan didn't change.
- **Siege supply cuts (the H2 follow-up named in the H2 spec) were dropped from the shortlist.** Holding the Root costs idle ships, which is time again, and it doesn't break the sequence.

## 2026-11-07 · Designer · Steelman of the owner's asteroid-field direction (Q13)

- **H3-A/B/C are superseded by the owner's direction.** A and B are absorbed: most of the field is guarded, and a prize is a new resource, not more ore. C becomes seeded fields in H5.
- **The core loop is "scout, choose, supply, crack, connect", run many times per game.** This attacks the fixed "economy, ships, attack" sequence from H1 and H2, because growth needs fighting and the right fleet needs the last prize.
- **Counters are ship type × guard type at about 2× and ½× damage, against mixed pockets.** Mixed pockets plus scarce components are the defence against the triangle being solved ("see Thorns, bring Lancers"). A pocket is read through a guard-colour ring on the map and strong/even/weak tags on its sheet. There is still no ships-needed number (the H2 decision stands).
- **Felt costs, from the H2 lesson.** Choices differ in what you get (resource, component, ship type, reachable region) and in losses of scarce, component-built ships, not in minutes.
- **Living pockets block routes, and routes have a maximum length with relays.** Cracking a pocket opens map space, a visible payoff. Factory placement trades route length against forward infrastructure.
- **Run length.** I resolved it as one long game per system played in short sessions, with no offline progress (pillar 4). This needs VISION.md approval (Q14), as does the pillar 1 wording ("to the probe" becomes "to factories and shipyards").
- **M2 ordering puts the riskiest fun claim first.** H3 Counter web tests "which pocket next is a real choice" with a counter pair (two ship types, two guard types), two tier 1 resources and components made at the probe. Factories and route limits (H4), the big field and persistence (H5) and the probe endgame (H6) follow, only if H3 holds. The pair comes before the triangle to halve art and UI cost while still testing counters.

## 2026-11-07 · Director · Milestone 2 starts; VISION edits applied; H3 is Counter web

- Owner approved both Q14 VISION.md edits ("Approve both", APPROVED-PROTECTED: VISION.md in QUESTIONS.md) in a live session; the Director applied them with the owner accepting the edit prompts. A star system is now one long game across many sessions, ending with a new probe; pillar 1 now measures throughput into factories and shipyards, not only the probe.
- Owner chose "Build Counter web" as H3, the first Milestone 2 slice (DESIGN.md → "Owner direction 2026-11-07: the asteroid field (steelman)" → H3 slice). Logistics (H4), the big field (H5) and the probe endgame (H6) follow, one hypothesis per build.
- Milestone 1 is closed: it proved the loop works but plays as one fixed sequence (PLAYTEST_LOG.md, both owner entries).
- Balance and Faction AI stay dormant for H3. H3 calibration is a Designer task (h3-design-data) and guard behaviour is still plain defend/regrow. Revisit at H4 split, when the counter numbers and pocket count grow.

## 2026-11-07 · Designer · H3 Counter web spec

- **Fixed node positions; layouts vary only the contents** (prize, slots and guard mix of each pocket, the Root's mix, the heart's mix). This keeps bot comparisons clean, as H2's Root-only variants did, while the "which pocket next" answer still changes between layouts. Rejected for H3: moving nodes per layout, and procedural fields (H5).
- **Counters multiply the ship's damage only**, with strong 200% and weak 25%. At weak 50% the model made lancers better than drones even against Spores, so counters vanished. At 25%, the wrong ship needs more ships than drones do, the right one about half, and a mix beats any single type on every mixed pocket. Guard-side multipliers (Spores hurting lancers more) were left out to keep one table. That is a calibration lever if the owner wants counters sharper.
- **Integer damage conversion with a fixed type order.** Each ship type pools base damage, converts it to effective damage per guard type with floor, and converts the leftover back with floor. The order is lancer, flak, then drone. This is deterministic, and a small rounding loss is accepted.
- **Assemblers run automatically up to a stock cap; there is no input.** On a phone a component should be visible, not micromanaged. The cap (5) stops a forgotten assembler from eating ore. H4 moves assemblers out of the probe.
- **One yard toggle per ship type, served in the order lancer, flak, drone,** so a scarce component is never starved by drones. Choosing a mix is a send-time decision (steppers), and "Attack with all" stays one tap.
- **A Strong/Even/Weak tag computed in sim selectors, with no ships-needed number.** One integer definition shared by client and bots. Estimating stays the player's puzzle (the H2 decision stands).
- **Drones stay a full fallback that can finish every layout,** to respect no fail state. The depth flags require them to be clearly worse (40% more losses or 20% slower), not impossible.
- **Calibration:** throwaway JS model in the scratchpad (not committed), bounded at 80 ships and 400 rounds. The per-pocket minimum waves are in the layout tables. The economy timing is unmodelled and left to h3-design-data.
