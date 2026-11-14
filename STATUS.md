# Status

Updated by the Director and Engineers. A new session reads this right after `CLAUDE.md`.

**Milestone:** 2 — The asteroid field (iteration 7, hypothesis H7 A: One field, live enemy)
**State:** Iteration 7 in flight. Owner answered Q21 "A, yes" (dda12d7): ship economy, spider-graph allocation, raids; pillars 3 and 4 rewritten; faction-ai activated. Step: Build. Spec and split f2452cf; h7-sim (core-engineer) green at e8d9dff, in review; the rest of the stack waits on its approval.
**Public URL:** https://factory4x.pages.dev (production, `main`). Branch previews: `https://<branch>.factory4x.pages.dev`.
**Repo:** https://github.com/tQuarella/factory4x (private)
**Last build:** build-20261108-5 (H6 Open frontier), commit 626307f, live (CI gates and deploy green; site shows 626307f · data v11). Release gates passed locally (192/192 smoke).
**Last updated:** 2026-11-14, iteration 7 start

## Iteration 7 ledger

Launches: 3 / 12.

| # | Agent | Task | Launch / resume | Why |
| --- | --- | --- | --- | --- |
| 1 | designer | triage build-20261108-5 owner dictation; H7 candidates | launch | Plan (165e829); owner picked A (dda12d7) |
| r1 | designer | H7 spec + task split | resume | Spec done (f2452cf) |
| 2 | core-engineer | h7-sim | launch | Build: a511610; bots runner hung on field data |
| r2 | core-engineer | h7-sim | resume | Fail-fast guard in runCampaign (e8d9dff) |
| 3 | critic | h7-sim | launch | Review round 1 |

## Iteration 6 ledger

Launches: 9 / 12. Iteration 6 closed.

| # | Agent | Task | Launch / resume | Why |
| --- | --- | --- | --- | --- |
| 1 | designer | triage build-20261108-4; H6 candidates | launch | Plan (done, 62ac82b; owner picked A + remove the Root, f1c56f2) |
| r1 | designer | H6 spec + task split | resume | Spec done (f8fabe3) |
| 2 | core-engineer | h6-sim | launch | Build |
| 3 | art-direction | h6-art | launch | Build |
| 4 | engineer | h6-bug-topbar-oscillation | launch | Build (owner bug): green, 36f414e; smoke test fails before fix |
| 5 | critic | h6-art | launch | Review round 1 (art green, c99543f) |
| 6 | critic | h6-bug-topbar-oscillation | launch | Review round 1 |
| r3a | critic | h6-art | resume | (round 1 was launch 5): REJECT (relay icon hid the haul; far centre; clipped lane) |
| r2 | engineer | h6-bug-buffer-toast-flicker | resume | Build, branched from task/h6-bug-topbar-oscillation (merges after it): green, d869e14; smoke test fails before fix |
| r3 | art-direction | h6-art | resume | Fix round 1 (cf6da1b) |
| r4 | critic | h6-art | resume | Review round 2: REJECT (ART_STYLE contradictions, relay mark 1.024 r) |
| r5 | core-engineer | h6-art | resume | Fix round 3, reassigned per deadlock rule (resumed the h5-sim core-engineer) |
| r6 | engineer | h6-bug-topbar-oscillation | resume | Fix round 1 after Critic REJECT (counts drift from icons; landscape chips 8 px lower); then merge into the buffer branch |
| r7 | critic | h6-art | resume | Review round 3: APPROVE (bce9bb7); main merged (728a058), waiting for branch CI |
| r8 | critic | h6-sim | resume | Review round 1: APPROVE (7768a52), merges only together with h6-client. Gate gap: campaign timeouts of winners don't fail the bots gate; added to h6-bots. Don't hand off from a main without h6-bots |
| 7 | engineer | h6-bots | launch | Build, branched from task/h6-sim |
| r9 | critic | h6-bug-topbar-oscillation + h6-bug-buffer-toast-flicker | resume | Topbar round 2: APPROVE (ae6eb3e); buffer round 1: REJECT (test misses AC1-4) |
| r10 | critic | h6-bots | resume | Review round 1: REJECT (composer builds single-type fleets; can't win a band 2 heart by design). Director amended spec bde97b0 |
| r11 | engineer | h6-bots | resume | Fix round 1: composer builds the probe's winning mix |
| r12 | engineer | h6-bug-buffer-toast-flicker | resume | Fix round 1: tests for AC1-4, DECISIONS (e6b7f61) |
| r14 | engineer | h6-bots | resume | Fix round 1 (e91e033): bots gate green with no data change |
| r15 | critic | h6-bots | resume | Review round 2: REJECT (pre-send battle sim beyond spec; non-monotone claim false). Found: guard damage in ship-id order makes build order decide fights (H3 rule 7) |
| r16 | designer | combat order rule + pre-send check | resume | Combat amendment 3d3f889 (guards strike the type they counter); Director accepted, no pre-send sim (0552809) |
| r17 | critic | topbar round 3 + buffer round 2 | resume | Review (topbar test-only CI fix a4e791f; buffer 65bb543) |
| r18 | core-engineer | h6-combat-target | resume | Build (dda930c; replay now exercises the rule, final hash 67e5632c) |
| r19 | critic | h6-combat-target | resume | Review round 1: APPROVE (924f97d) |
| r20 | engineer | h6-bots | resume | Fix round 2 (6f9d01a): no pre-send sim; gate green on v10 |
| r21 | critic | h6-bots | resume | Review round 3: APPROVE (4ec2c71); flags 2-3 data only |
| r22 | designer | h6-design-data | resume | Calibrate v11, stacked on task/h6-bots |
| r23 | critic | h6-bug-topbar-oscillation r3 + buffer r2 | resume | APPROVE both; topbar merged b96f211, buffer merged 9a37ee2 |
| r24 | critic | h6-design-data | resume | Review round 1: APPROVE (9ceae09); v11, all 7 flags met |
| 8 | engineer | h6-client | launch | Build (97d5390): gates green, smoke 178/178, design-data merged in |
| r25 | critic | h6-client | resume | Review round 1: REJECT (flaky reachability test, tapArea retry, loosened/removed tests, combat line hard-coded) |
| r26 | engineer | h6-client | resume | Fix round 1 (1cab655) |
| 9 | retrospective | iteration 6 retro | launch | Retro after build-20261108-5: engineer test-strength, settle-before-act, parallel repeats, self-check; designer inherited-assumption check; art one-rule-once; PROCESS stack-top rule, deadlock departures logged, autocrlf |
| r27 | critic | h6-client | resume | Review round 2: APPROVE (652b143); branch CI gates green; whole H6 slice merged 626307f |
| r13 | engineer | h6-bug-topbar-oscillation | resume | Branch CI red on 91dab72: boot.spec:129 phone tap fails reliably on Linux (green on main). Fix cause, merge into buffer branch |

## Iteration 5 ledger

| # | Agent | Task | Launch / resume | Why |
| --- | --- | --- | --- | --- |
| 1 | designer | triage build-20261108-3 feedback; steelman ship cap and open world | launch | Plan (done, c13cd55; owner picked A) |
| 2 | engineer | fix-extract-rate (owner bug) | launch | Build (c7df834): display-only bug in nodeStatus/guardianStatus; bots now upgrade routes sooner, best run 43:35 (below H4's 45-min floor) |
| 3 | critic | fix-extract-rate | launch | Review round 1: REJECT (heart total rounds to 124.8 not 125) |
| r1 | engineer | fix-extract-rate | resume | Fix round 1 (369aaad) |
| r2 | critic | fix-extract-rate | resume | Review round 2: APPROVE (be4a68d); green branch CI on 67d13d2; merged 078806e |
| r3 | designer | H5 spec (Fleet cap) | resume | Spec done (b4830e7) |
| 4 | art-direction | h5-art | launch | Build (green, ee66b9f) |
| 5 | core-engineer | h5-sim | launch | Build (green, 93699f3). Director accepts its out-of-scope one-line smoke edit (H3 play-through sets fleet.cap 0) and the interim H4 bots at cap 0 |
| 6 | critic | h5-sim | launch | Review round 1: APPROVE; green branch CI on 93395d6; merged 8799be2 |
| 7 | engineer | h5-client | launch | Build (green, bd32246; smoke 96/96) |
| 9 | critic | h5-client | launch | Review round 1: REJECT (fleet chip wraps to its own HUD row at 375 px) |
| r5 | engineer | h5-client | resume | Fix round 1 (942fcd1): wide-font Deep still 3 rows |
| r8 | engineer | h5-client | resume | Director layout call before re-review: shorter phone resource chips, keep ≤2 rows (dc899e8) |
| r10 | critic | h5-client | resume | Review round 2: REJECT (ship chips off-screen in landscape/desktop) |
| r11 | core-engineer | h5-client | resume | Fix round 2, reassigned per deadlock rule (resumed the h5-sim core-engineer); 0f29bec, green branch CI 42509986848 |
| r14 | critic | h5-client | resume | Review round 3: APPROVE (00f424d); merged 0984b7f |
| 8 | engineer | h5-bots | launch | Build (41ef624): bots gate red only because v8 lights are closed at L0; merges together with h5-design-data (see DECISIONS) |
| 11 | retrospective | iteration 5 retro | launch | Retro after build-20261108-4: engineer 'test the state the criterion is about' and 'never loosen a criterion in a test'; designer flags must exercise the behaviour; PROCESS 'Gates that wait on calibration' and Critic resumes across tasks; BACKLOG cw-worktree-prune |
| 10 | critic | h5-bots | launch | Review round 1: REJECT (stranded probe ship freezes forced visits; red gate) |
| r7 | engineer | h5-bots | resume | Fix round 1 (5280732): stranded ship fixed; v8 red is data |
| r9 | critic | h5-bots | resume | Review round 2: APPROVE code (561a42b); merges only with h5-design-data |
| r6 | designer | h5-design-data | resume | Calibrated (f062009): data v9, all 7 flags met, bots gate green |
| r12 | critic | h5-design-data | resume | Review round 1: REJECT (record only: bring in the h5-bots approval); Director merged 561a42b, gates green (d6eb972) |
| r13 | critic | h5-design-data | resume | Review round 2: APPROVE (6f364ce); merged with h5-bots |
| r4 | critic | h5-art | resume | Review round 1: APPROVE (f522965); green branch CI on 29a12ee; merged |

Launches: 11 / 12. Iteration 5 closed. Plan: h5-sim, h5-client, h5-bots launches; Critics for h5-sim, h5-client, h5-bots launched; Critics for h5-art and h5-design-data as resumes; retro. Total 11, 1 spare. Resumes: 14.

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
| 10 | critic | h4-client | launch | Review round 1: REJECT (phone pause icon blank when paused; palette literals) |
| r8 | engineer | h4-client | resume | Fix round 1 (2246c80, smoke 72/72) |
| r10 | critic | h4-client | resume | Review round 2: REJECT (withdraw mode change lags 100 ms; flaky smoke 1 in 10) |
| r12 | core-engineer | h4-client | resume | Fix round 2, reassigned per deadlock rule; c0aab81, smoke 74/74, withdraw repeat-each 80/80 |
| r13 | critic | h4-client | resume | Review round 3: APPROVE (d7db3b5). main merged into branch (6c975b1), green branch CI run 42492196114; merged b84a080 |
| r14 | core-engineer | h4-design-data | resume | Fix round 2, reassigned per deadlock rule; 8705399 |
| r15 | critic | h4-design-data | resume | Review round 3 (reject parks it) |
| 9 | critic | h4-bots | launch | Review round 1: REJECT (runner tests pinned to shipped data) |
| r3 | engineer | h4-bots | resume | Fix round 1 (22c9396) |
| r4 | critic | h4-bots | resume | Review round 2: REJECT (15-campaign unit test ~16 s, near 30 s limit) |
| r5 | core-engineer | h4-bots | resume | Fix round 2, reassigned per deadlock rule (resumed the h4-sim core-engineer to stay within launch budget); 57d789f, test gate 6.4 s |
| r6 | critic | h4-bots | resume | Review round 3: APPROVE; merged ab8bd65 (not browser-facing) |
| r7 | designer | h4-design-data | resume | Calibrated (349b8b8): all 7 flags met |
| 12 | retrospective | iteration 4 retro | launch | Retro after build-20261108-3: merge-task uses origin/task/<id> when newer (with --dry-run); engineer test-speed/fixture and smoke repeat-each rules; designer data-task checklist; PROCESS deadlock resume, route out-of-scope leftovers, spec as triage resume, dataVersion on values-only |
| 11 | critic | h4-design-data | launch | Review round 1: REJECT (bump dataVersion to 7; unsourced numbers) |
| r9 | designer | h4-design-data | resume | Fix round 1 (scope widened to one test line for the v7 bump); bdaa801, dataVersion 7 |
| r11 | critic | h4-design-data | resume | Review round 2: REJECT (one false sentence in DESIGN.md; stale test title line 125). Queued for the core-engineer after its h4-client fix (deadlock rule); round 3 reject parks it |

Launches: 12 / 12. Resumes: 15. Iteration 4 closed. Leftover worktrees and alias branches (h4-bots-core, h4-client-core, h4-dd-core) can be cleaned up as Can wait. Plan: 12 (triage, spec, 4 builders, 5 Critics incl. design-data, retro); h4-design-data is a Designer resume.

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
