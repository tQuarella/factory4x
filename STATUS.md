# Status

Updated by the Director and Engineers. A new session reads this right after `CLAUDE.md`.

**Milestone:** 1 — First playable (iteration 1, hypothesis H1)
**State:** Build step. m1-art is merged. m1-sim is still building; m1-client and m1-bots wait for it.
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
| H1 spec | designer | main (`DESIGN.md`) | Done, committed 2e0614e |
| m1-sim | core-engineer | `task/m1-sim` (agent worktree) | Building |
| m1-art | art-direction | `task/m1-art` | Merged 7205468 after Critic round 2 (round 1 rejected: flag bounds, thorn ring, palette table, gallery width) |
| m1-client | engineer | — | Waits for m1-sim to merge |
| m1-bots | engineer | — | Waits for m1-sim to merge |

## Usage budget (this iteration)

Subagent launches: 4 / 12 (designer, core-engineer, art-direction, critic). Resumes (designer after a stall; art fix round; critic round 2) are not counted as new launches.

## Next step

When each builder reports green: launch the `critic` on that branch; on approval, `npm run merge-task -- <id>`. After m1-sim merges, launch `m1-client` and `m1-bots` in parallel.
