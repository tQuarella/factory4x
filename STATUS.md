# Status

Updated by the Director and Engineers. A new session reads this right after `CLAUDE.md`.

**Milestone:** 1 — First playable (iteration 2, hypothesis H2: decision depth)
**State:** Awaiting owner feedback on build-20261108-1 (H2: cut the Root vs overwhelm the Bloom). Only Can wait work until feedback arrives.
**Public URL:** https://factory4x.pages.dev (production, `main`). Branch previews: `https://<branch>.factory4x.pages.dev`.
**Repo:** https://github.com/tQuarella/factory4x (private)
**Last build:** build-20261108-1 (H2 decision depth), commit 13201db, live and passing the live smoke test.
**Last updated:** 2026-11-07

## Iteration 2 (H2) ledger

| # | Agent | Task | Launch / resume | Why |
| --- | --- | --- | --- | --- |
| 1 | designer | H2 triage + spec | launch | Plan + Spec (done) |
| 2 | core-engineer | h2-sim | launch | Build (committed d9563ff; session dropped before its report) |
| r3 | core-engineer | h2-sim | resume | After session restart: merged main (4933aca), gates green, reported |
| 5 | critic | h2-sim | launch | Review round 1: APPROVE; merged dfdf62a after green branch CI |
| 6 | engineer | h2-client | launch | Build (green after resume r5; 238d38d) |
| 7 | engineer | h2-bots | launch | Build (green; all six H2 depth flags met) |
| 8 | critic | h2-bots | launch | Review round 1: APPROVE; merged 3f5d5d1 |
| r4 | critic | h2-bots | resume | Stalled 600 s waiting on background gates; told to run in foreground |
| r5 | engineer | h2-client | resume | Stalled 600 s at "Now tests"; told to WIP-commit and continue with time limits |
| 9 | critic | h2-client | launch | Review round 1 |
| r6 | critic | h2-client | resume | Stalled 600 s; resumed. Round 1: REJECT (wilt toast "faster" factor 10x off; missing tests) |
| r7 | engineer | h2-client | resume | Fix round 1 (e2a6d99) |
| r8 | critic | h2-client | resume | Review round 2: APPROVE; green branch CI on 149b655; merged 624b1e0 |

Stall cause (owner, 2026-11-07): the stalls in r4, r5 and r6 came from this computer losing its network connection or going to sleep, not from agent behaviour. The retro should not change agent prompts because of them.
| 3 | art-direction | h2-art | launch | Build (green, 0365ede) |
| 4 | critic | h2-art | launch | Review round 1: REJECT (vine/rock contrast, glow bounds, palette table) |
| r1 | art-direction | h2-art | resume | Fix round 1 (77e159d) |
| r2 | critic | h2-art | resume | Review round 2: APPROVE; merged 6176e1f after green branch CI. Critic saw one flaky `test` gate run (28.5 s, passed on rerun) |

Launches: 9 / 12. Resumes: 8.

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

Waiting on the owner's playtest of build-20261108-1 (handoff block at the top of QUESTIONS.md). When feedback arrives: record it verbatim in PLAYTEST_LOG.md, then the Designer triages it and picks H3. Retro for iteration 2 is done right after this handoff.

## Moving to another machine

From 2026-11-07 the owner runs sessions from their desktop instead of this laptop. Everything needed is on GitHub: `main` and every `task/*` branch, including `task/h2-client` with its review. Agent worktrees under `.claude/worktrees/` are local only, so check out `task/h2-client` fresh there.

One-time desktop setup, done by the Director in the first desktop session (the owner only accepts prompts):
- Node 26 (`.nvmrc`) and GitHub CLI (`gh auth login` is the owner's step);
- `git config --global user.name tquarella-ProviderSoft` and `user.email tquarella@providersoftllc.com`;
- `npm ci` and `npx playwright install chromium`.
