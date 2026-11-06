# Factory4X — Von Neumann Probe

A real-time 4X/factory game built by an autonomous Claude Code agent team. The owner (Tony) holds the vision and judges fun; the team makes every technical decision. The full charter is [docs/HANDOFF_PLAN.md](docs/HANDOFF_PLAN.md).

**Owner's time is the scarcest resource.** Ask the owner to do something only when it has to be them (their accounts, credentials, or a permission prompt) or the decision is theirs alone (vision, fun, approving a protected change). Everything else, the team does. When the owner must act, make it one step: a yes/no, a prompt to accept, or a single command to run.

## Every session starts here

1. Read this file, then [STATUS.md](STATUS.md). Continue from what STATUS says is in flight.
2. If you are the main session, you are the **Director**. Follow [PROCESS.md](PROCESS.md) and the slash commands: `/resume` to pick up, `/iterate` to run a loop iteration, `/handoff` to ship a build to the owner, `/retro` after a handoff.
3. Coordinate only through files in this repo. Never rely on memory from an earlier conversation.

## Where things live

| Need | File |
| --- | --- |
| Owner's intent and pillars (read-only for agents) | [VISION.md](VISION.md) |
| Current mechanics and fun hypotheses | [DESIGN.md](DESIGN.md) |
| Tasks, owners, acceptance criteria | [BACKLOG.md](BACKLOG.md) |
| What's in flight right now | [STATUS.md](STATUS.md) |
| Questions for the owner | [QUESTIONS.md](QUESTIONS.md) |
| Playtest feedback | [PLAYTEST_LOG.md](PLAYTEST_LOG.md) |
| Why things are the way they are | [DECISIONS.md](DECISIONS.md) |
| Run loop, gates, budgets, guardrails | [PROCESS.md](PROCESS.md) |
| Visual style | [ART_STYLE.md](ART_STYLE.md) |
| Player-facing changes | [CHANGELOG.md](CHANGELOG.md) |
| Agent definitions | `.claude/agents/` |
| Critic reviews | `reviews/<task-id>.md` |
| Gate and bot output | `reports/` |

## Code layout

- `packages/sim` — pure deterministic game logic. No DOM, no Node, no wall clock, no floating-point transcendental math (lint enforces it). Integer or fixed-point only.
- `packages/client` — Vite web client: renderer, UI, input. Imports the sim.
- `packages/bots` — headless strategy runner, determinism check, reference replay.
- `data/` — every tunable number, with a `dataVersion` stamp.
- `scripts/` — gates (`scripts/gates/`, protected), worktree and merge tooling, changelog.
- `tests/smoke` — Playwright release smoke test (desktop and phone).

## Commands

```bash
npm run gates                      # all merge gates except Critic approval
npm run release-gates              # gates + build + browser smoke test
npm run dev                        # local client
npm run bots -- --seeds 3          # bot suite only
npm run worktree -- new <task-id>  # manual worktree for a task
npm run merge-task -- <task-id>    # Critic-approved, gate-checked merge into main
```

## Rules that never bend

- Never edit protected files: `VISION.md`, `.claude/agents/critic.md`, `.claude/settings.json`, `scripts/gates/*`, `.github/workflows/*`, `eslint.config.js`. Ask in `QUESTIONS.md` instead. Exception: the Director may edit `VISION.md` in a live session after the owner approves the change, through the per-edit permission prompt.
- Never merge without Critic approval and passing gates. Use `npm run merge-task`.
- Never weaken a gate, skip a gate, or trade quality for activity. Pausing is fine.
- Broken `main` is the top priority and halts other merges.
- Log every non-obvious decision in `DECISIONS.md`, and every prompt or process change with its reason.
- No secrets in the repo.
