# Von Neumann Probe — Agent Team Handoff Plan

Nov 6, 2026 · @Tony Quarella · Revision 2 (review fixes applied; see "Revision notes" at the end)

## Purpose

Claude Code should use this doc to bootstrap an autonomous multi-agent team that builds a real-time 4X/factory game, with the owner acting only as vision holder and fun-validator. Read it fully, then execute Milestone 0 (bootstrap the repo, agents and process) before any game code.

The owner is a software developer but wants to stay hands-off. The team makes all technical and implementation decisions itself and brings the owner only builds to play and questions about fun and direction.

Where this doc is silent, the Director decides, logs the decision in `DECISIONS.md`, and moves on.

## Game concept

You are a von Neumann probe arriving in a new star system: a real-time blend of 4X and Factorio. This section seeds `VISION.md`; game design beyond it belongs to the team.

The owner's original note:

- Extract resources and build components that go back to the probe, which builds ships to do the other 3X (explore, expand, exterminate).
- The system has inhabitants (mobs) that guard the good stuff. Better stuff means harder mobs.
- The rate of resources delivered to the probe sets the rate of ship production.
- Research components and ships.
- Mobs have their own factories, so you must outpace and overpower them to gain ground.
- You win when you build a new von Neumann probe. Then new game+.

Fixed decisions:

- **Real-time**, with pause and speed controls.
- **Audience:** a fun prototype for the owner and close friends, not a commercial release.
- **Access:** builds are a public link; no password.
- **Art:** generated assets, coherent with a style guide. Procedural placeholders until the owner picks an image service (after Milestone 0).
- **Phone-first input:** logistics are abstract routes drawn between nodes, not tile-by-tile belts. Every interaction must work by touch.

Candidate design pillars, to be revisited with the owner after Milestone 0 and confirmed before Milestone 1 gameplay work: delivery throughput is the throttle on everything; risk scales with reward; rivals have economies you can attack; every run ends in a new probe and carries something forward.

## Operating model

The team runs unattended for long stretches and surfaces to the owner only when a build is ready to play.

| Decision | Answer |
| --- | --- |
| Owner check-ins | Only when a build is ready |
| Playtesting | Every build auto-deploys to a public URL, playable on a phone |
| Autonomy | Long unattended runs, including overnight |
| Parallelism | Yes: 2–3 engineers in separate git worktrees |
| Plan | Claude Team premium; usage limits are the bottleneck |
| Quality vs. pace | Never trade quality for continuous activity; pausing is fine |
| Self-improvement | Yes, with guardrails |
| Escalation | `QUESTIONS.md` |
| Audience | Owner plus close friends |

**Decision authority.** Agents decide architecture, tooling, code structure, tests and implementation details on their own. Anything that changes how the game plays or feels, or contradicts `VISION.md`, goes to the owner as a question or as an A/B choice in the next build.

**Escalation via QUESTIONS.md.** Questions are split into Blocking and Can wait. A blocked agent records its question and switches to other backlog work rather than idling. The Director bundles open questions into each build handoff.

**Build handoff.** Each ready build includes the URL, a three-line changelog, what to try, and two or three specific questions about fun (for example, "Does losing a convoy feel fair or cheap?").

**Unattended mechanics.** Long runs depend on:

- Project permission settings in `.claude/settings.json` that allow the build, test and git commands the loop needs, so agents never stall on a prompt. Destructive commands and pushes to `main` outside the merge script stay denied.
- The main session acting as Director and launching every other agent. Subagents cannot launch subagents, so all fan-out goes through the Director.
- Engineers launched as worktree-isolated subagents (one worktree and branch per task).
- A scheduled `/resume` (via the owner's scheduler or a cron routine) that restarts the loop after a usage-limit pause.
- A usage budget per iteration in `PROCESS.md`: at most 12 subagent launches and at most 2 Opus reviews per task. Hitting the budget means checkpoint and pause, not cut corners.

## Agent roster

Agents are Claude Code subagents in `.claude/agents/`. Fixed procedures are scripts, not agents, so judgment is the only thing that spends model usage. The main session acts as the Director.

**Active from Milestone 0**

| Agent | Model tier | Owns | Writes to |
| --- | --- | --- | --- |
| Director | Opus (main session) | Milestone plans, task assignment, merges, deciding when a build is ready | `BACKLOG.md`, `STATUS.md`, handoff notes |
| Designer | Opus | Turning vision and feedback into hypotheses, specs and tunable parameters; triaging feedback | `DESIGN.md`, `PLAYTEST_LOG.md` |
| Critic | Opus | Reviewing every merge against pillars and quality bar; veto power | Review notes, `DECISIONS.md` |
| Retrospective | Opus | Post-build review; improving agent prompts and process docs | `.claude/agents/*` (except protected), `PROCESS.md`, `DECISIONS.md` |
| Engineer (×2–3) | Sonnet | Implementing tasks in vertical slices, with tests | Code, tests |
| Core Engineer | Opus | Simulation architecture and anything touching determinism; tasks reassigned after two Critic rejections | Code, tests |
| Art Direction | Sonnet | Style guide, asset prompts, procedural placeholders, consistency of art | `ART_STYLE.md`, `assets/` |

**Dormant until Milestone 2** (their work is small enough for Designer and Engineers until then; the Director activates them by logging it in `DECISIONS.md`)

| Agent | Model tier | Owns |
| --- | --- | --- |
| Balance | Sonnet | Economy model, production chains, tuning from sim data |
| Faction AI | Sonnet | Mob behavior, mob factories, pacing pressure |

**Scripts instead of agents**

| Former agent | Replaced by |
| --- | --- |
| Bot runner | `npm run bots`: plays every strategy headless, writes `reports/bots-latest.json` and a Markdown summary |
| Release | CI deploy workflow plus `npm run changelog`; the Director writes the player-facing lines |

**Bot strategies** to start with: rush, turtle, greedy expansion, and raiding mob supply. Report time-to-win, win rate, and tick-time per strategy so dominant or dead strategies are visible.

**Model use and deadlock.** If a Sonnet Engineer fails the Critic's review twice on the same task, the Director reassigns it to the Core Engineer. If the Core Engineer's version is rejected again (third rejection overall), the task is parked: the Director records the disagreement in `QUESTIONS.md` as Blocking and moves to other work.

## Shared files and repo layout

Agents coordinate through files in the repo, never through conversation memory, so any session can stop and another can resume.

| File | Purpose | Who edits |
| --- | --- | --- |
| `CLAUDE.md` | Entry point: project summary, rules, where everything lives | Director, Retrospective |
| `VISION.md` | Owner's intent and design pillars | Owner only (Milestone 0 writes the first draft from this doc, marked as awaiting owner sign-off) |
| `DESIGN.md` | Current mechanics and open fun hypotheses | Designer |
| `BACKLOG.md` | Prioritized tasks with owner agent and acceptance criteria | Director |
| `STATUS.md` | In-flight work, worktree assignments, current milestone, usage budget spent | Director, Engineers |
| `QUESTIONS.md` | Blocking and Can wait questions for the owner | Any agent; owner answers inline |
| `PLAYTEST_LOG.md` | Owner and friend feedback, verbatim, then interpreted; tagged by who said it | Designer |
| `DECISIONS.md` | Dated log of decisions and why, including every prompt change | Any agent |
| `PROCESS.md` | The run loop, gates, budgets and conventions | Retrospective |
| `ART_STYLE.md` | Visual style guide and prompt templates | Art Direction |
| `CHANGELOG.md` | Player-facing changes per build | Director (via `npm run changelog`) |

Code layout: `packages/sim` (pure game logic, no rendering), `packages/client` (renderer and UI), `packages/bots` (headless strategy runner), `data/` (tunable values), `assets/`, `reports/`, `scripts/` (gates and worktree tooling).

## Run loop

Each iteration goes from one fun hypothesis to one playable build, then the team improves itself before starting the next.

1. **Plan.** Director reads `VISION.md`, `PLAYTEST_LOG.md` and answered questions, then picks the next hypothesis with the Designer.
2. **Spec.** Designer writes the hypothesis, mechanics, tunable parameters and what would count as success.
3. **Split.** Director breaks it into tasks in `BACKLOG.md`, each with acceptance criteria and an owner agent.
4. **Build in parallel.** Engineers each take a task in their own git worktree and branch, writing tests alongside code.
5. **Verify.** `npm run gates` on each branch: types, lint, tests, determinism, bots, tick budget. Results go to `reports/`.
6. **Review.** Critic reviews each branch; it merges only on approval. Rejected work goes back with specific notes (see deadlock rule).
7. **Release.** Once the slice is complete and all gates pass on `main`, CI deploys and the Director writes the changelog.
8. **Hand off.** Director updates `QUESTIONS.md` with the build URL, what to try, and two or three fun questions, then stops.
9. **Retro.** Retrospective reviews the iteration and updates prompts or `PROCESS.md`, logging each change.

**Pausing and resuming.** When usage limits hit, agents finish or checkpoint their current task, commit work in progress to their branch, and update `STATUS.md`. Every new session starts by reading `CLAUDE.md` and `STATUS.md` and continues from there. A pause is always preferable to a rushed or skipped gate.

**Waiting for the owner.** While a build awaits feedback, the team may work only on Can wait items: tech debt, test coverage, performance, tooling and art. It does not start the next fun hypothesis until feedback arrives.

## Technical architecture

Stack: TypeScript monorepo (npm workspaces) with a pure, deterministic simulation package and a separate web renderer. The Director may change this if it logs the reason, but the principles below are fixed.

- **Deterministic fixed-tick sim.** Logic runs at a fixed rate (30 ticks per second) with a seeded RNG. Same seed plus same inputs gives the same game, so bugs replay exactly.
- **Cross-engine determinism.** The sim uses integer or fixed-point math only. `Math.sin`, `Math.cos`, `Math.pow`, `Math.sqrt`, `Math.random`, `Date` and floating-point division results stored in state are banned in `packages/sim` and enforced by lint. Anything needing trig uses lookup tables.
- **State fingerprints.** The sim can hash its full state. The determinism gate compares hashes every 300 ticks across two runs, not just the end state, so divergence is caught where it starts.
- **Replays.** A replay file is seed + data version + input log. The feedback button attaches one, so any reported moment can be replayed exactly.
- **Sim and rendering are separate.** `packages/sim` has no rendering or browser dependencies. The client renders and interpolates between ticks.
- **Headless at high speed.** The bots play full games without rendering, far faster than real time.
- **Data-oriented entities.** Entity-component style storage, since factory games are limited by entity count.
- **Everything tunable is data.** Numbers live in `data/`, which carries a version stamp included in every build, replay and feedback note. Every build includes a live tuning panel; values the owner settles on become new defaults.
- **Time controls.** Pause and 1x/2x/4x from the first playable build.
- **Web deploy.** Static build deployed to a public URL on every release; must be playable on a phone browser.
- **In-game feedback button.** Captures a note with the build version, data version and replay. Because the host is static, the note is delivered by a mechanism chosen in Milestone 1 (default: prefilled GitHub issue link, with copy-to-clipboard fallback for friends without GitHub). The Designer triages notes into `PLAYTEST_LOG.md`.
- **Renderer.** A lightweight 2D WebGL library such as Pixi or Phaser; the Engineers choose.

## Quality gates and guardrails

Nothing merges or ships unless every gate passes; during unattended runs these replace the owner's oversight.

**Merge gates** (`npm run gates`)

- Type check, lint and all tests pass.
- Determinism check: two fixed-seed runs produce identical state hashes at every checkpoint.
- Bot strategy suite completes without crashes or softlocks.
- Tick time stays within the performance budget (set in Milestone 0, recorded in `PROCESS.md`).
- Critic approval.

**Release gates**

- All merge gates pass on `main`.
- The build loads and runs a short scripted session in a headless browser, at desktop and phone sizes.
- The handoff note and questions are written.

**Guardrails**

- No agent edits `VISION.md`. Proposed changes to it go to `QUESTIONS.md`.
- **Protected files:** `VISION.md`, `.claude/agents/critic.md`, `scripts/gates/*`, the CI workflow files and the Guardrails section of `PROCESS.md`. No agent, including the Retrospective, may change them without owner approval recorded in `QUESTIONS.md`. A CI check fails any commit that touches them without a matching approved entry.
- The Retrospective may edit other agent prompts and `PROCESS.md`, but logs each change with a reason in `DECISIONS.md`. It may never weaken a gate or remove a guardrail without the owner's approval.
- Main is always deployable. Broken main is the top priority and halts other merges.
- The owner's feedback outranks friends' feedback when they conflict.
- No secrets in the repo; API keys come from environment variables or CI secrets.

## Milestones

Milestone 0 builds the team and pipeline with no gameplay; Milestone 1 is the first build the owner plays.

**Milestone 0: Bootstrap** (done when a placeholder page deploys through the full pipeline)

- [ ] Create the repo, monorepo structure and all shared files, with `VISION.md` drafted from the Game concept section.
- [ ] Write `CLAUDE.md` and `PROCESS.md` from this doc, including permission settings and usage budgets.
- [ ] Define the active agents in `.claude/agents/` (and the dormant ones, marked dormant), each with role, model, tools, files it owns and handoff rules.
- [ ] Set up the run loop as slash commands (`/iterate`, `/resume`, `/handoff`, `/retro`).
- [ ] Set up worktree tooling for parallel engineers.
- [ ] Set up the gate scripts and CI (stubs where there's no game yet), including the protected-files check.
- [ ] Set up auto-deploy to a public URL. *Needs the owner's deploy host and a GitHub repo.*
- [ ] Write `ART_STYLE.md` and procedural placeholder art.
- [ ] Add the first Can wait questions to `QUESTIONS.md`.

**Milestone 1: First playable** (done when the owner can play it on a phone)

The smallest version of the core loop. If it isn't fun at this scale, nothing layered on top will fix it. Starts only after the owner confirms the pillars.

- [ ] One asteroid field with extractors.
- [ ] A logistics route delivering resources to the probe, with throughput visible on screen.
- [ ] The probe building one ship type at a rate set by delivery throughput.
- [ ] One guarded high-value node with a mob factory producing defenders.
- [ ] Ships that can attack the mobs or their factory.
- [ ] Pause, speed controls, tuning panel and feedback button.
- [ ] Bots playing at least two strategies headless.

The handoff should ask whether growing throughput feels satisfying and whether taking the guarded node feels worth the risk.

## Open items for the owner

- [x] How friends get access: **public link**.
- [x] Choose a deploy host: **Cloudflare Pages**.
- [ ] Connect GitHub and Cloudflare (repo secrets). Blocks finishing Milestone 0.
- [ ] Revisit and confirm the design pillars. After Milestone 0, before Milestone 1.
- [ ] Choose an image generation service and supply an API key. After Milestone 0.

## Revision notes

Revision 2 applied these changes from review:

1. Slimmed the roster: Bot runner and Release became scripts; Balance and Faction AI are dormant until Milestone 2; a Core Engineer (Opus) handles determinism-sensitive work and escalations.
2. Cross-engine determinism: integer/fixed-point math, banned non-deterministic APIs, periodic state hashes.
3. Feedback button delivery on a static host is defined, with a default.
4. Milestone 0's dependence on a deploy host is called out.
5. Unattended-run mechanics and usage budgets are spelled out.
6. Critic deadlock rule: three rejections parks the task as a Blocking question.
7. Protected files, including the Critic's prompt and gate scripts, enforced by CI.
8. `VISION.md` first draft is an explicit, sign-off-pending exception.
9. Phone-first input: abstract logistics routes.
10. Replay files and a data version stamp.
