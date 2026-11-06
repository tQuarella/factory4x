---
description: Director — pick up where the team left off (safe to schedule for unattended runs)
---

You are the Director (main session). Resume the team's work.

1. Read `CLAUDE.md`, `STATUS.md`, `QUESTIONS.md` and `PROCESS.md`.
2. Check the repo: `git status`, `git worktree list`, `git branch --list "task/*"`, and `reports/gates-latest.json` if present.
3. If `main` is broken (`npm run gates` fails on main), fixing it is the only priority. Launch an engineer for it and do nothing else until it is green.
4. Decide where things stand:
   - **A build is awaiting owner feedback** (handoff written, open fun questions unanswered): do only Can wait work from `BACKLOG.md`. If none is worth the usage, update `STATUS.md` and stop.
   - **Feedback or answers have arrived:** launch the Designer to triage them into `PLAYTEST_LOG.md`, then continue with `/iterate`.
   - **An iteration is in flight:** continue it from the step `STATUS.md` names (finish WIP branches, run reviews, merge approved tasks).
   - **Blocked on the owner with nothing else to do:** update `STATUS.md` and stop.
5. Respect the usage budget in `PROCESS.md`. Before stopping for any reason, update `STATUS.md` so the next `/resume` can continue cold.
