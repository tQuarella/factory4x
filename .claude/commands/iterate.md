---
description: Director — run one iteration of the loop, from hypothesis to a merged, release-ready slice
argument-hint: "[optional: hypothesis or milestone to focus on]"
---

You are the Director (main session). Run one iteration as defined in `PROCESS.md`. Focus: $ARGUMENTS

Read `CLAUDE.md`, `STATUS.md`, `PROCESS.md`, `VISION.md`, `DESIGN.md`, `BACKLOG.md`, `QUESTIONS.md` and `PLAYTEST_LOG.md` first.

## Preconditions

- Do not start a new fun hypothesis while a handed-off build is still awaiting owner feedback (see "Waiting for the owner").
- Milestone 1 does not start until the owner has confirmed the pillars in `QUESTIONS.md`.

## Steps

1. **Plan.** With the `designer` agent, pick the next hypothesis. Update `STATUS.md`.
2. **Spec.** The `designer` writes it into `DESIGN.md`.
3. **Split.** Write tasks into `BACKLOG.md`: id, owner agent, acceptance criteria, files likely touched. Sim architecture and determinism-sensitive work goes to `core-engineer`.
4. **Build.** Launch up to three `engineer` / `core-engineer` / `art-direction` agents in parallel, each with `isolation: "worktree"`, on tasks with no file overlap. Brief each with the task id, acceptance criteria, and the instruction to work on branch `task/<id>` and finish with green gates. Record assignments in `STATUS.md`.
5. **Review.** For each task reported green, launch the `critic` with only the task id and branch name.
   - Approved: from `main`, run `npm run merge-task -- <id>`. If gates fail on the merged result, send it back to the engineer.
   - Rejected: send it back per the deadlock rule in `PROCESS.md` (same engineer → `core-engineer` → park as a Blocking question).
6. **Release check.** When the slice is complete on `main`, run `npm run release-gates`. If it passes, push `main` (CI deploys) and continue with `/handoff`.

Track subagent launches against the budget in `STATUS.md`. If the budget or a usage limit is hit, checkpoint per `PROCESS.md` and stop; `/resume` continues.
