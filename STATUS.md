# Status

Updated by the Director and Engineers. A new session reads this right after `CLAUDE.md`.

**Milestone:** 1 — First playable (iteration 1, hypothesis H1)
**State:** Owner feedback on build-20261106-2 is in (PLAYTEST_LOG.md): H1 only weakly supported. Throughput was "mildly satisfying", the Bloom was "obvious and one dimensional", and replay was wanted but the identical map was "deflating". Waiting on the owner to choose the H2 direction (depth vs variety) before /iterate.
**Public URL:** https://factory4x.pages.dev (production, `main`). Branch previews: `https://<branch>.factory4x.pages.dev`.
**Repo:** https://github.com/tQuarella/factory4x (private)
**Last build:** build-20261106-2 (M1 first playable), live and passing the live smoke test at desktop and phone sizes.
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
| m1-sim | core-engineer | `task/m1-sim` | Merged 277e237 (Critic approved round 1) |
| m1-art | art-direction | `task/m1-art` | Merged 7205468 after Critic round 2 (round 1 rejected: flag bounds, thorn ring, palette table, gallery width) |
| m1-client | engineer → core-engineer | `task/m1-client` | Merged 71cec57 after Critic round 3 (escalated to core-engineer after round 2) |
| m1-toast-fix | core-engineer | `task/m1-toast-fix` | Merged c11124b (Critic approved round 1); main green |
| m1-bots | engineer | `task/m1-bots` | Merged 4afda2f after Critic round 2 (round 1 rejected: seed copying, softlock timing, early shipyard, whole-run spend) |

## Usage budget (this iteration)

Subagent launches: 11 / 12 (designer, core-engineer ×2, art-direction, critic ×4, engineer ×2, retrospective). Resumes were not counted, and there were about 8 (see the M1 retro in DECISIONS.md). Next iteration: keep the per-run ledger PROCESS.md now asks for.

## Next step

Ask the owner which matters more for H2: decision depth or run-to-run variety. Then the Designer triages the feedback and specs H2, and `/iterate` starts it. Keep a per-run launch ledger (PROCESS.md, Usage budget).
