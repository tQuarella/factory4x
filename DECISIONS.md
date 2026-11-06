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
