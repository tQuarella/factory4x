# Status

Updated by the Director and Engineers. A new session reads this right after `CLAUDE.md`.

**Milestone:** 1 — First playable (iteration 1, hypothesis H1)
**State:** Plan/Spec step. The Designer is writing the H1 spec in `DESIGN.md`.
**Public URL:** https://factory4x.pages.dev (production, `main`). Branch previews: `https://<branch>.factory4x.pages.dev`.
**Repo:** https://github.com/tQuarella/factory4x (private)
**Last build:** build-20261106-1 (Milestone 0 placeholder); owner feedback received.
**Last updated:** 2026-11-06

## Iteration plan

The 12-launch budget can't fit ten small tasks plus a review for each, so M1 is four larger tasks:

1. `m1-sim` (core-engineer): all M1 sim mechanics and the Input API. Goes first; everything else depends on its API.
2. In parallel once `m1-sim` merges: `m1-client` (engineer), `m1-bots` (engineer), `m1-art` (art-direction).
3. One Critic review per task, then release gates and `/handoff`.

Expected launches: designer 1 + 4 builders + 4 critics = 9, leaving 3 for rework.

## In flight

| Task | Agent | Branch / worktree | State |
| --- | --- | --- | --- |
| H1 spec | designer | main working tree (`DESIGN.md`) | In progress |

## Usage budget (this iteration)

Subagent launches: 1 / 12 (designer)

## Next step

When the Designer reports: review the spec, write the four tasks into `BACKLOG.md`, commit, then launch `core-engineer` on `m1-sim`.
