# Process

Owned by the Retrospective (except the Guardrails section, which is protected). The run loop, gates, budgets and conventions. The charter behind this is `docs/HANDOFF_PLAN.md`.

## Run loop

One iteration takes one fun hypothesis to one playable build, then the team improves itself.

| Step | Who | Output |
| --- | --- | --- |
| 1. Plan | Director + Designer | Next hypothesis chosen from `VISION.md`, `PLAYTEST_LOG.md`, answered questions |
| 2. Spec | Designer | `DESIGN.md`: hypothesis, mechanics, tunables (in `data/`), success criteria |
| 3. Split | Director | `BACKLOG.md`: tasks with ids, owner agent, acceptance criteria |
| 4. Build | Engineers in parallel | One worktree and branch `task/<id>` per task; tests alongside code |
| 5. Verify | Engineer runs `npm run gates` | `reports/` on the branch |
| 6. Review | Critic | `reviews/<id>.md` ending in `VERDICT: APPROVE` or `VERDICT: REJECT` |
| 7. Merge | Director | Browser-facing tasks: green Linux CI on the pushed task branch first (see "Before merging"). Then `npm run merge-task -- <id>` (re-runs gates on the merged result) |
| 8. Release | CI | Deploy on green `main`; Director writes `CHANGELOG.md` lines |
| 9. Hand off | Director | `QUESTIONS.md` handoff block; then stop |
| 10. Retro | Retrospective | Prompt and process changes, each logged in `DECISIONS.md` |

Slash commands: `/resume`, `/iterate`, `/handoff`, `/retro`.

## Launching agents

- Only the main session (Director) launches agents. Subagents cannot launch subagents.
- Engineers: launch with Agent isolation `worktree`. The brief names the task id, acceptance criteria, files to read, and says: create branch `task/<id>`, commit there, run `npm install` then `npm run gates` before reporting.
- Up to 3 engineers at once, never two on overlapping files. The Director checks file overlap from the task descriptions before launching.
- Critic: launch after an engineer reports green gates. Give it the branch name and task id, not the engineer's summary, so its review is not anchored on the author's view.
- Dormant agents (Balance, Faction AI) are not launched until the Director activates them in `DECISIONS.md`.

## Review cycle and deadlock

1. Critic rejects → task goes back to the same engineer with the review file.
2. Second rejection → Director reassigns the task to the Core Engineer (Opus). If a Core Engineer from this iteration has finished its own task, resume it (a resume, not a launch) rather than launching a new one; in H4 one resumed core-engineer fixed h4-bots, h4-client and h4-design-data, and all three passed round 3. The brief names the task id, the branch, `reviews/<id>.md`, and how to commit: if `task/<id>` is checked out in another worktree, the agent works on a local alias branch started from `origin/task/<id>` and pushes with `git push origin HEAD:task/<id>`. `merge-task` merges `origin/task/<id>` when the local ref is behind it, so the Director doesn't move local refs by hand.
3. Third rejection → task is parked. Director writes a Blocking question in `QUESTIONS.md` summarizing the disagreement and moves on.

Before launching or resuming the Critic, the Director reads the author's report for anything it left undone because it was outside its files, and routes it first (widen the scope in `BACKLOG.md` and resume the author, or hand it to the agent with that scope). h4-design-data round 2 was rejected for a one-word test title the Designer had logged as "a later fix".

## Before merging

- **Browser-facing tasks** (any change under `packages/client/`, including its Vite config, or under `tests/smoke/`, or to `playwright.config.ts`): after Critic approval, merge `main` into the task branch if `main` has moved, push `task/<id>`, and wait for the CI run on that exact commit to pass. Only then run `merge-task`. CI runs the smoke test on Linux, whose fallback fonts differ from Windows. A local pass on Windows doesn't prove the layout holds there: m1-client passed every local check and still turned `main` red. The push also deploys a branch preview. Pushing a task branch never deploys production.
- **Keep `main` still while branch CI runs.** Every commit to `main` while a browser-facing branch waits for CI means merging `main` again, pushing again and waiting about 4 minutes again. In H3, h3-art merged `main` three times (aef335a, 5f06ea9, 31d61a2) because `main` moved in between: once for the h3-bots merge, once for a Director status commit. So the Director:
  1. commits its pending `STATUS.md` / `BACKLOG.md` edits before merging `main` into the branch;
  2. while that branch's CI runs, keeps further edits to its own shared files uncommitted in the working tree, and does not run `merge-task` for any other task;
  3. after `merge-task`, commits the held edits in one commit.

  If two browser-facing tasks are approved close together, merge them one after the other in this way; the second one needs a fresh CI run anyway, because the first changed code on `main`. CI must be green on the exact commit that is merged, apart from the docs-only exception below.
- **Docs-only moves on `main` don't need a new branch CI run** (owner, Q15). If the only files changed on `main` since the branch's green CI run are `STATUS.md`, `BACKLOG.md`, `QUESTIONS.md`, `DECISIONS.md`, `CHANGELOG.md`, `PLAYTEST_LOG.md` or files under `reviews/`, merge `main` into the branch (or let `merge-task` do it) and merge without waiting for another branch CI run. Check with `git diff --name-only <green-commit> main` against that list before relying on it. Anything else, including `DESIGN.md` and `ART_STYLE.md` (tests read them), still needs a fresh green run on the exact commit. `merge-task` still runs every gate on the merged result, and CI runs again on `main` after the push.
- **Reading the CI result:** if `gh run watch` exits with an error, that is not yet a CI failure. A network blip can end the watch. Before acting, recheck the run itself with `gh run view <run-id>` (or `gh run list --branch task/<id>`), and treat the run's own conclusion as the result. In H2 a dropped watch looked like a failed CI until it was rechecked.
- **DECISIONS.md conflicts:** `.gitattributes` merges it with git's union driver, so entries appended on both sides are both kept with no conflict. A task branch cut before that line existed gets it the first time it merges `main`. Check the merged file once for an entry that lost its blank line, and keep the file append-only, because union merging would silently keep both versions of a line edited in place.

## Usage budget

- Per iteration: at most 12 subagent launches. The Retrospective counts as one. Plan for the Designer, one builder and one Critic per task, the Retrospective, and 2 spare for rework or a broken-`main` fix. Every task gets a Critic in the plan, including a Designer data or calibration task. H3's plan counted 9 launches because it left out the h3-design-data review; with that review and one rework launch, the iteration used all 12. With five tasks there is no spare, so plan follow-on work as a resume of an agent that already has the context (as the Designer was resumed for h3-design-data), or split into at most four tasks. The Plan and Spec steps are one Designer: the spec is a resume of the Designer that did the triage, not a new launch. H3 did this; H4 launched the spec Designer fresh, which spent the one spare launch the plan had kept. Per task: at most 2 Critic reviews before escalation per the deadlock rule.
- A launch is a new agent (the Agent tool). A resume is any later turn sent to a running or finished agent with SendMessage (a stall nudge, a fix round, a later review round). Resumes are not launches, but they still use usage, so count them too. Resuming is preferred over a fresh launch for fix rounds and later review rounds, because the agent keeps its context.
- Track spend in `STATUS.md` as a ledger with one line per run (agent, task, launch or resume, and why), plus the totals. Updating the totals alone hid runs in M1. When the budget or a usage limit is hit: checkpoint (commit WIP to the task branch with a `WIP:` prefix, update `STATUS.md`), then stop. Never rush a gate to fit the budget.

## Pausing and resuming

- Any session can stop at any time. State lives in git and the shared files.
- `/resume` reads `CLAUDE.md`, `STATUS.md`, `QUESTIONS.md`, checks `git worktree list` and open `task/*` branches, and continues.
- **A new machine** needs, before the first session: Node at the major version in `.nvmrc` (26); `gh auth login` with the GitHub account that owns the repo (tQuarella), then `gh auth setup-git`, and `gh repo view tQuarella/factory4x` to confirm access; `npm ci`; `npx playwright install chromium`. The git commit identity (`user.name` / `user.email`) is a separate setting and stays as configured. On the desktop move (2026-11-07) the owner had to install Node 26 and switch the GitHub login to tQuarella in separate steps. Give the owner this whole list in one message, and run every step that isn't a login yourself.
- For overnight runs the owner schedules `/resume` (Claude Code scheduled task or routine) at an interval longer than the usage-limit reset.

## Concurrent sessions in one working tree

Sometimes two main sessions share the same checkout, for example the Director and a design session with the owner. The shared files (`STATUS.md`, `QUESTIONS.md`, `DECISIONS.md`, `BACKLOG.md`, `CLAUDE.md`) then have more than one writer.

- At session start, run `git status`. Uncommitted changes you did not make belong to another session. Never revert, reformat or commit them.
- Commit your own shared-file edits soon after making them, in small commits. Stage paths explicitly (`git add <path>`), never `git add -A` or `commit -a`. If a file holds both your edits and another session's, leave it for that session or ask the owner. Don't commit someone else's half-finished text.
- Make targeted insertions, not rewrites. `DECISIONS.md` is append-only. In `STATUS.md`, change only the lines you own.
- `STATUS.md` reports what the source files show. A "signed off", "approved" or "done" claim needs the evidence in place first: the owner's answer and any `APPROVED-PROTECTED` line in `QUESTIONS.md`, and for vision changes the edit applied to `VISION.md`.
- Commit with the repo's configured git identity. Never pass `--author` or `-c user.name`/`user.email`.

## Waiting for the owner

While a build awaits feedback, only Can wait work is allowed: tech debt, test coverage, performance, tooling, art. No new fun hypothesis until feedback arrives.

## Conventions

- Branches: `task/<id>`. Commits: imperative, one logical change. WIP commits prefixed `WIP:` and never merged as-is.
- Every tunable number goes in `data/`. Bump `dataVersion` in `data/sim.json` whenever a default changes, including a values-only calibration: every green `main` deploys, so the old version has shipped. A data task's file list in `BACKLOG.md` includes the test that pins `dataVersion` (in H4, `packages/sim/test/data-h4.test.ts`, the "is data version N" test), so the bump doesn't need a scope change. h4-design-data round 1 was rejected for skipping the bump, and rounds 1 and 2 needed the scope widened for that test.
- Every sim change that alters behavior updates the reference replay if needed, and the inline RNG snapshot only if the RNG itself changed (which breaks all old replays; log it).
- Build tags: `build-YYYYMMDD-<n>` on the commit that was handed off.

## Gates

**Merge gates** (`npm run gates`, plus Critic approval): typecheck, lint (including sim determinism rules), unit tests, determinism (hash every 300 ticks over 9,000), bot suite (no crash or softlock; tick p95 ≤ budget), protected-files check.

**Release gates** (`npm run release-gates` locally, the CI workflow on `main`): all merge gates, production build, Playwright smoke test at desktop and phone sizes including the browser-vs-Node determinism check, and the handoff note written.

Thresholds live in `scripts/gates/budgets.json` (protected).

## Guardrails (protected: changes need owner approval)

- No agent edits `VISION.md` on its own. Proposed changes go to `QUESTIONS.md`. Only the Director, in a live session with the owner, may apply a change the owner has approved there: the edit triggers a permission prompt (`ask` rule in `.claude/settings.json`) that the owner must accept each time.
- Protected files: `VISION.md`, `.claude/agents/critic.md`, `.claude/settings.json`, `scripts/gates/*`, `.github/workflows/*`, `eslint.config.js`, and this Guardrails section. No agent may change them without `APPROVED-PROTECTED: <path>` from the owner.
- The Retrospective may edit other agent prompts and the rest of this file, logging each change with a reason in `DECISIONS.md`. It may never weaken a gate or remove a guardrail.
- `main` is always deployable. Broken `main` is the top priority and halts other merges.
- The owner's feedback outranks friends' feedback when they conflict.
- No secrets in the repo; keys come from environment variables or CI secrets.
- Never trade quality for continuous activity. Pausing is always acceptable.
