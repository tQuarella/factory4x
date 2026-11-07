# Status

Updated by the Director and Engineers. A new session reads this right after `CLAUDE.md`.

**Milestone:** 1 — First playable (iteration 2, hypothesis H2: decision depth)
**State:** Owner chose "Depth first" for H2. H2 specced (DESIGN.md → H2: cut the Root vs overwhelm the Bloom, three variants). Building h2-sim and h2-art; h2-client and h2-bots follow h2-sim.
**Public URL:** https://factory4x.pages.dev (production, `main`). Branch previews: `https://<branch>.factory4x.pages.dev`.
**Repo:** https://github.com/tQuarella/factory4x (private)
**Last build:** build-20261106-2 (M1 first playable), live and passing the live smoke test at desktop and phone sizes.
**Last updated:** 2026-11-06

## Iteration 2 (H2) ledger

| # | Agent | Task | Launch / resume | Why |
| --- | --- | --- | --- | --- |
| 1 | designer | H2 triage + spec | launch | Plan + Spec (done) |
| 2 | core-engineer | h2-sim | launch | Build (committed d9563ff; session dropped before its report) |
| r3 | core-engineer | h2-sim | resume | After session restart: merge main, re-run gates, report |
| 3 | art-direction | h2-art | launch | Build (green, 0365ede) |
| 4 | critic | h2-art | launch | Review round 1: REJECT (vine/rock contrast, glow bounds, palette table) |
| r1 | art-direction | h2-art | resume | Fix round 1 (77e159d) |
| r2 | critic | h2-art | resume | Review round 2: APPROVE; merged 6176e1f after green branch CI. Critic saw one flaky `test` gate run (28.5 s, passed on rerun) |

Launches: 4 / 12. Resumes: 3.

## Iteration 1 (H1) plan, closed

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

When h2-sim merges, launch h2-client and h2-bots in parallel. Review each task with the Critic as it reports green.
