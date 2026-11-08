# Status

Updated by the Director and Engineers. A new session reads this right after `CLAUDE.md`.

**Milestone:** 2 — The asteroid field (iteration 3, hypothesis H3: Counter web)
**State:** Iteration 4 started 2026-11-08. Owner feedback on build-20261108-2 is in PLAYTEST_LOG.md (overworld idea). Owner picked H4 = A. Reclaim ladder (Q16). Spec done (ba817ea). Build: h4-art merged (5ca6921). h4-sim merged (caa81b1). h4-client and h4-bots building in parallel. Carry to h4-design-data: fix DESIGN.md "14 levels" (table has 13) and "under 1 KB" save growth (actual ~1.7 KB, test caps 2 KB); re-record the reference replay if guards/costs change. Can wait: Deep layout lookup duplicated in overworld.ts areaLayout and world.ts landArea. Then h4-client + h4-bots after h4-sim merges; h4-design-data as a Designer resume after h4-bots.
**Public URL:** https://factory4x.pages.dev (production, `main`). Branch previews: `https://<branch>.factory4x.pages.dev`.
**Repo:** https://github.com/tQuarella/factory4x (private)
**Last build:** build-20261108-2 (H3 Counter web), commit a4096a7, live (CI gates and deploy green; site shows a4096a7).
**Last updated:** 2026-11-08 (desktop)

## Iteration 4 ledger

| # | Agent | Task | Launch / resume | Why |
| --- | --- | --- | --- | --- |
| 1 | designer | triage build-20261108-2 feedback + overworld steelman | launch | Plan (done, e782443; owner picked A) |
| 2 | designer | H4 spec (Reclaim ladder) | launch | Spec (done, ba817ea) |
| 3 | core-engineer | h4-sim | launch | Build |
| 4 | art-direction | h4-art | launch | Build (green, 08f1399) |
| 5 | critic | h4-art | launch | Review round 1: REJECT (probe core amber at frac 0) |
| r1 | art-direction | h4-art | resume | Fix round 1 (cb67a8f) |
| r2 | critic | h4-art | resume | Review round 2: APPROVE; green branch CI on 34cae84; merged 5ca6921 |
| 6 | critic | h4-sim | launch | Review round 1: APPROVE; green branch CI on 4f01607; merged caa81b1 |
| 7 | engineer | h4-client | launch | Build |
| 8 | engineer | h4-bots | launch | Build (green, 234c1b0; flags 1,5,7 met, 2,3,4,6 missed on uncalibrated data) |
| 9 | critic | h4-bots | launch | Review round 1: REJECT (runner tests pinned to shipped data) |
| r3 | engineer | h4-bots | resume | Fix round 1 (22c9396) |
| r4 | critic | h4-bots | resume | Review round 2: REJECT (15-campaign unit test ~16 s, near 30 s limit) |
| r5 | core-engineer | h4-bots | resume | Fix round 2, reassigned per deadlock rule (resumed the h4-sim core-engineer to stay within launch budget) |

Launches: 9 / 12. Resumes: 5. Plan: 12 (triage, spec, 4 builders, 5 Critics incl. design-data, retro); h4-design-data is a Designer resume.

## Iteration 2 (H2) ledger (closed)

In run order.

| # | Agent | Task | Launch / resume | Why |
| --- | --- | --- | --- | --- |
| 1 | designer | H2 triage + spec | launch | Plan + Spec (done) |
| 2 | core-engineer | h2-sim | launch | Build (committed d9563ff; session dropped before its report) |
| 3 | art-direction | h2-art | launch | Build (green, 0365ede) |
| 4 | critic | h2-art | launch | Review round 1: REJECT (vine/rock contrast, glow bounds, palette table) |
| r1 | art-direction | h2-art | resume | Fix round 1 (77e159d) |
| r2 | critic | h2-art | resume | Review round 2: APPROVE; merged 6176e1f after green branch CI. Critic saw one flaky `test` gate run (28.5 s, passed on rerun) |
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
| 10 | retrospective | retro | launch | Retro after build-20261108-1 |

Launches: 10 / 12. Resumes: 8.

Stall cause (owner, 2026-11-07): the stalls in r4, r5 and r6 came from this computer losing its network connection or going to sleep, not from agent behaviour. The retro should not change agent prompts because of them.

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


## Waiting period (Can wait) ledger

Started 2026-11-07 on the desktop, while build-20261108-1 awaits feedback.

| # | Agent | Task | Launch / resume | Why |
| --- | --- | --- | --- | --- |
| w1 | engineer | cw-palette-sync-test | launch | Build (worktree, branch `task/cw-palette-sync-test`) |
| w2 | engineer | cw-flaky-test | launch | Build (worktree, branch `task/cw-flaky-test`) |
| w3 | critic | cw-palette-sync-test | launch | Round 1: APPROVE; green CI on 4ba678f; merged a61824b. Also added 3 missing palette rows to ART_STYLE.md |
| w4 | critic | cw-flaky-test | launch | Round 1: APPROVE. Critic reproduced the flake: two ~0.5 s bot tests hit vitest's 5 s timeout under heavy load; 30 s timeout fixes it. Merged c3adac2 |

Launches: 4. Resumes: 0. Both tasks done. Follow-ups from the reviews (not blocking): palette test is one-way (stale table rows not flagged); "Dim star" row not marked low-contrast; `reports/gates-latest.json` should keep a failing gate's output tail (protected `scripts/gates/`, needs owner approval).

## Iteration 3 (H3) ledger

| # | Agent | Task | Launch / resume | Why |
| --- | --- | --- | --- | --- |
| 1 | designer | H2 triage + H3 candidates | launch | Plan (triage done; candidates A/B/C, commit ab31453) |
| r1 | designer | H3 steelman of owner direction | resume | Owner asked for the asteroid-field direction instead (Q13); steelman + M2 plan + Q14 (1159e74) |
| r2 | designer | H3 spec | resume | Owner approved Q14 and Counter web; full spec (e83c3aa) |
| 2 | core-engineer | h3-sim | launch | Build (worktree, branch `task/h3-sim`) |
| 3 | art-direction | h3-art | launch | Build (worktree, branch `task/h3-art`), parallel with h3-sim; green 8847e96 |
| 4 | critic | h3-art | launch | Round 1: REJECT (draw bounds on lancer/flak/plating, gallery rows overflow, labels, tidy) |
| r3 | art-direction | h3-art | resume | Fix round 1 |
| 5 | critic | h3-sim | launch | Round 1: APPROVE (reviewed local 2104a1a). Force-push of the cleaned history is denied by settings, so origin's WIP history was kept via an ours-merge (tree unchanged); green CI on 14634e4; merged 9bb36ae |
| 6 | engineer | h3-client | launch | Build (worktree, `task/h3-client`); may use `h3-art-shim.ts` until h3-art merges |
| 7 | engineer | h3-bots | launch | Build (worktree, `task/h3-bots`); green e0a2997. Flags 2–6 met, flag 1 (pace) missed: heart at 12–16 min |
| r4 | critic | h3-art | resume | Round 2: APPROVE (79b9393). Fix commit c8fed7a pushed by art-direction, which never sent a final report |
| 8 | critic | h3-bots | launch | Round 1: APPROVE (85effbe); merged 3585322 |
| r5 | designer | h3-design-data | resume | Calibration to data v5 (12a8fca): pace met (18–28 min), tags 35/36 accurate; flag 4 now missed (ice-first wins every layout ~2 min, yard order starves flak); 42 tests pinned to v4 values fail the `test` gate |
| 9 | critic | h3-client | launch | Round 1 review of 357e85d |
| 10 | core-engineer | h3-design-data | launch | Decouple tests from shipped data (frozen fixture); round-robin yard service (rule 5b) for flag 4 (cb49da3) |
| r6 | engineer | h3-client | resume | Fix round 1 after Critic REJECT (ring size, wide-font stress, unlock notice, text) (f9ea031) |
| r7 | critic | h3-client | resume | Round 2: APPROVE; green CI on 8edf987; merged 76186f6 |
| r8 | core-engineer | h3-design-data | resume | Merged main (705c747) |
| 11 | critic | h3-design-data | launch | Round 1: REJECT (docs only: stale numbers, tag count) |
| r9 | core-engineer | h3-design-data | resume | Doc fix round (97afe69) |
| r10 | critic | h3-design-data | resume | Round 2: APPROVE; green CI on 1dbe987; merged a4096a7. Release gates passed; deployed; handed off as build-20261108-2 |

| 12 | retrospective | iteration 3 retro | launch | Retro after build-20261108-2 (92e07f4): engineer/designer prompt changes, PROCESS.md rules (keep main still during branch CI, Critic for every task, new-machine checklist), Q15 |

Launches: 12 / 12. Resumes: 10. Iteration 3 closed. h3-art merged 4929fe6 after green CI on 31d61a2. Remaining: Critic h3-design-data (launch 11). One spare. Follow-up (not this build): bots pick targets without regard to their own counters (Designer note). Planned: Critic h3-sim, Critic h3-art, then h3-client + h3-bots (after h3-sim merges) and their Critics, then h3-design-data (designer resume or launch). Plan: one Critic review per task, then `merge-task`. If a change touches `packages/client/` or smoke files, it is browser-facing: get green CI on the pushed branch head first.

## Next step

Waiting on the owner's playtest of build-20261108-2 (handoff block at the top of QUESTIONS.md). When feedback arrives: record it verbatim in PLAYTEST_LOG.md, then the Designer triages it and plans H4 (Factories and reach, per DESIGN.md M2 plan). The iteration 3 retro is done (92e07f4). Can wait candidates are in BACKLOG.md.

## Moving to another machine

From 2026-11-07 the owner runs sessions from their desktop instead of this laptop. Everything needed is on GitHub: `main` and every `task/*` branch, including `task/h2-client` with its review. Agent worktrees under `.claude/worktrees/` are local only, so check out `task/h2-client` fresh there.

Desktop setup **done** 2026-11-07: repo cloned at `C:/Users/tquar/Documents/Factory4X`, Node 26.13 LTS installed (winget), `gh` signed in as tQuarella (`gh auth setup-git` run), git identity already set, `npm ci` and Playwright Chromium installed. Original checklist:
- Node 26 (`.nvmrc`) and GitHub CLI (`gh auth login` is the owner's step);
- `git config --global user.name tquarella-ProviderSoft` and `user.email tquarella@providersoftllc.com`;
- `npm ci` and `npx playwright install chromium`.
