# Review: h6-client

## Round 1 · 2026-11-08

I reviewed `task/h6-client` at 97d5390. This is the H6 slice's single merge (DECISIONS fc044d8): h6-sim, h6-combat-target, h6-bots and h6-design-data (v11), which are already approved, plus main. To isolate the client work, I diffed 97d5390 against a virtual merge of `origin/main` and `origin/task/h6-design-data` (`git merge-tree`). The client files are `fit.ts`, `owlayout.ts` (new), `worldview.ts`, `worldsheets.ts`, `report.ts`, `main.ts`, `hud.ts`, `panels.ts`, `sheet.ts`, `session.ts`, `persist.ts` and `style.css`. The tests are `h4-client`, `h5-client` and `h6-client` (new), and `boot`, `hud-stability` and `overworld` (new) under smoke. The branch is three docs-only commits behind main, and `git merge-tree` against `origin/main` is clean. All my checks ran in a clean detached worktree, with the build served on a private port.

**Gates:** `npm run gates -- --base origin/main` on 97d5390 passed all six (typecheck, lint, test, determinism, bots, protected-files). Build passed. Full smoke: 178/178. Branch CI on 97d5390 was still in progress.

### What the Director asked me to confirm

**1. The inherited client test failures from the h6-sim review.**
- **`h5-client.test.ts`: fixed.** It loads, and line 74 is gone, so typecheck passes. The file no longer lands Veil from `['landfall','shelf']`.
- **`h4-client` guarded rows: fixed, and stronger.** The test asserts Veil has no Root on shipped data. It then checks the dormant "Root-fed / Root cut" text on a constructed row with exact strings.
- **`h4-client` 44 px fit: fixed correctly.** It is rewritten to the pan rule:
  - nodes are at least 44 px at seven sizes, including 320x420 and phone landscape;
  - x stays inside the view when the frame fits the width;
  - there is label room at both ends of the pan;
  - the content holds every node.

  This is the rule h6-sim said only the pan could meet, not a looser one. Two further tests check label sides and band labels against every node and label at all seven sizes.
- **`h4-client` `openedByReclaim`: loosened.**
  - The old test used exact `toEqual` lists, plus an "already joined" case that returned `[]`.
  - The new test uses `toContain('Mire Relay')`, `toContain('Glint Relay')` and `not.toContain('Frost Shelf')`, and drops the already-joined case.
  - On v11 the exact values are easy to pin. I computed them through the real functions:
    - rime → `["Glint Relay","Mire Relay"]`;
    - glint after `['landfall','shelf','shoal','rime','glint']` → `["Spire Relay"]`. Thorn Garden is excluded there because Glass Shoal already joins it, which is exactly the "not ones already open" rule the test's title names.
- **`h4-client` hops: loosened.** The exact `deep === 3` became `deep > veil` and `deep > rime`. A wrong breadth-first search can satisfy two inequalities. The value on v11 is exact and pinnable, or a test can compute it independently.

DECISIONS says "none loosened". That is not true of these two, and both are fixed in required change 4.

**2. The retired tests cover only removed features. Mostly, with two exceptions.**
- **Correctly retired:**
  - the Root sheet smoke test;
  - the Root-cut variants of the repelled hint;
  - the Command limit smoke tests (bought, disabled reason, `fleet.cap` 0 on the card, card fit);
  - the h5 Command limit unit tests for effect wording, `capOff` and the purchase notice.

  The `capOff`/`limit` leftovers are in cw-sim-fleet-leftovers.
- **Not removed features:**
  - **The guarded-area sheet checks.** These were in the old "tap an area…; a held area cannot be landed on" test: guard rows visible, the "(not researched)" counter tag, the Strong/Weak badge. They are not a Root or Command limit feature. `worldsheets.ts` still renders `.area-guard`, `.area-tag` and `.not-researched`, and no smoke test anywhere checks them now.
  - **The 375 px area-sheet checks** in the deleted H4 "overworld: area nodes are 44 px targets…" test: the selected area clears the sheet, the sheet stays under 60% of the map, every area-sheet control is at least 44 px (`expectControlsFit`), and the Land button is on screen without scrolling. DECISIONS says these were "replaced by `overworld.spec.ts`", but that spec has none of them. I probed the behaviour myself at 375x667 with the wide font. For Landfall, Shoal, Rime, Veil (locked), The Deep (far) and Glint: the selected node clears the sheet, no control is under 44 px, Land's bottom is at 661 of 667, and nothing overflows. So the behaviour works; only the coverage is missing.
  - **`tierRequirementText`.** Its "words the tier requirement" test went with the Command limit block. The helper is generic and still live: `researchBlock` and `worldsheets.ts:391` render it for any item with a tier requirement, and the sim still computes `missing.tiers`.

**3. The `debugHudFrame` cap change (99 → 60): justified, not a loosening.** In v11, `fleetCap` = `fleet.cap` + `fleet.relayStep` × commanded bands. `fleet.cap` max is 60 and `relayStep` max is 12 over two relay bands, so the real maximum is 84, two digits. The test's start reclaims Rime and Mire, so 99 would have shown 115, a state the game can't reach. The landscape assertion also got stronger. The "no lower than main" snapshot I asked h6-client to replace is now "no chip overlaps any control button" in every frame, and screenshot 06 shows the two-column landscape bar clear of the buttons.

**4. The version tag over the lowest name label: minor, landscape only.** I centred on each area in turn and checked `#version` against `areaLabelRects()` and the node discs:
- 375x667, 390x844 and 1280x800: no overlap anywhere.
- 667x375: the tag (39x12 px) touches Spore Veil's label when centred on Mire or Spire, and Frost Shelf's disc in one opening view.

The player can pan it clear, and the tag is a dev stamp, so I don't block on it (see notes).

### Other findings

**A new smoke test is flaky.** "portrait: with a sheet open the other areas stay reachable by dragging…" passed on the phone project every time, but failed on the desktop project 4 of 20 runs, then 11 of 40 (6 workers). The failure is "Mire Relay reachable above the sheet: expected < 370, received 380", after the 16-drag loop runs out (4.5 s). The cause is the test, not the game:
- the loop only ever drags down (scroll toward 0), so an area that starts or ends below the window can only move further away;
- the test starts dragging right after `tapArea` returns, while `reveal()` is still easing, so where the first area lands depends on timing.

AC4 requires `--repeat-each 5` to pass on both projects, which this fails.

**`tapArea` retries the tap.** Both specs' `tapArea` centres the area with the `centerOnArea` hook, waits until it is stable and the canvas is under it, then clicks. If the sheet isn't open, it loops: re-centre, click again. A retry loop around a player action would hide a swallowed tap: a drag-end click, a step-moment skip, or a re-layout under the finger.
- I changed both helpers locally to click once and log whether the area was selected, then ran `overworld.spec` and `boot.spec` 3 times on both projects: 210 of 210 single taps selected the right area, with 492/492 tests passing.
- So the retry isn't needed, and the wait alone makes the tap reliable, which is what Director addition 8 asked for. The retry should go so that a real swallowed tap fails the test.

**The combat line (AC6).**
- `GUARD_TARGET_LINE` is a hand-written string, and the only test pins the same string. The rule lives in the sim as `GUARD_TARGET_ORDER`. If the order changes, the sheet will tell the player something false and no test will notice.
- AC6 says the line fits "at 375 px with the wide font". The test that checks its fit (`The Deep has no Root…`) runs at the project's default viewport (Pixel 7 is 412 px, desktop is 1280), not 375.

**Step moment (AC1, "skippable").** The smoke test skips it through the `skipStep()` hook. The player's path is a tap on the canvas during the moment: `stepActive`, then `skipStep`, then return without opening a sheet. That path is untested. Drag-to-skip goes through `pointermove`, also untested.

**What works, checked:**
- **Pan:** a drag over 10 px pans, and its closing click is swallowed. A 3 px touch is a tap. There is no zoom. `touch-action: none` applies only on the overworld.
- **Opening view:** centred on the last reclaimed area, or the start.
- **Area states and labels:** the four node states; relay and lock marks; band labels placed clear of nodes and names, across seven sizes (unit) and three layouts (smoke, wide font).
- **Fleet limit:** the top-row chip ("Fleet limit 20") is hidden at `fleet.cap` 0.
- **Sheet lines:** relay, already commanded, locked, far, and decayed haul with its reason, all built from `areaStatus` and the live tunables.
- **Step moment:** pan, fade, reveal in 1.5 s, once per band. `stepsShown` survives a save, and an old save reads as empty.
- **Removed and changed UI:** no Command limit card; the new repelled hint; tuning labels for the three H6 keys, with `bloom.starved*` hidden.
- **Saves:** a v9 save starts fresh.
- **Reachability with a sheet open:** the pan reaches under the sheet, which meets Director addition 7. My probe brought every area into view by dragging.

**Code quality.** It is clear, and the logic is in the right places: pure geometry in `owlayout.ts` and `fit.ts`, with unit tests. Small issues:
- `worldview.ts` has an orphaned doc comment ("An area to centre on at the next resize…") directly above the `focusTarget` doc comment.
- Two spacing slips: `overworldScroll:() =>` in `main.ts` and `const easeOut =(t` in `worldview.ts`.

Pillar fit: everything is within the H6 spec and the Director's additions. The pannable map, the locks and the step moment serve "Open frontier", and nothing changes the rules beyond the approved sim.

Gates: all six passed locally on 97d5390. Smoke: 178/178 single pass. The new overworld spec is flaky on the desktop project (above). Branch CI was in progress.

Required changes:
- [ ] 1. Make "with a sheet open the other areas stay reachable by dragging…" deterministic. Wait for the reveal to settle before measuring, and drag toward each target (up or down) rather than always down. Then show that `overworld.spec.ts --repeat-each 5` passes on both projects, plus 20 repeats of this test on the desktop project.
- [ ] 2. Remove the click retry from `tapArea` in `boot.spec.ts` and `overworld.spec.ts`. Wait as now, click once, and assert that the area's sheet opened.
- [ ] 3. Restore the lost smoke coverage at 375x667 with the wide font.
   - (a) A known, guarded area's sheet (Veil while locked, or Shoal) shows its guard rows, a counter tag reading "(not researched)" for a design you lack, and a Strong/Even/Weak badge.
   - (b) For an open area, a locked area, a relay, a far area and a decayed-haul area, run `expectControlsFit('#sheet')` and check three things: the selected area's node and label clear the sheet top, the Land button (where there is one) ends inside the viewport without scrolling, and the sheet is under 60% of the map.
- [ ] 4. `h4-client.test.ts`.
   - `openedByReclaim`: use exact `toEqual` again. Rime after `['landfall','shelf','rime']` is `['Glint Relay','Mire Relay']`. Add an already-joined case: Glint after `['landfall','shelf','shoal','rime','glint']` is `['Spire Relay']`.
   - Hops: assert The Deep's exact hop count, or one computed independently in the test, not inequalities.
   - Correct the DECISIONS line "none loosened" if anything stays relational, and say why.
- [ ] 5. Restore a `tierRequirementText` unit test (the four wordings from the retired test). The helper is still rendered by `researchBlock` and `worldsheets.ts`.
- [ ] 6. Tie the combat line to the rule. Either build `GUARD_TARGET_LINE` from the sim's `GUARD_TARGET_ORDER` (first target per guard type), or add a unit test asserting the line names `GUARD_TARGET_ORDER.thorn[0]` and `GUARD_TARGET_ORDER.spore[0]`. Then run the heart and pocket sheet fit check with the line at 375x667 with the wide font (AC6).
- [ ] 7. Skip the step moment with a real canvas tap in the smoke test. Assert that it stops (`stepActive` false), lands in its final state, and opens no area sheet.
- [ ] 8. Remove the orphaned doc comment above `focusTarget` in `worldview.ts`, and fix the two spacing slips.
- [ ] 9. Merge current `origin/main` (docs only; it merges cleanly), and re-run gates and full smoke. The final head must have green branch CI.

Notes (not blocking):
- Phone landscape: the version tag can sit on a name label (Spore Veil, when centred on Mire or Spire). Consider moving it into the left bar in the short-landscape layout, where it can't meet the map.
- Screenshot 07 (landscape overworld): a dashed lane runs through the "Band 2" pill. Band pills are drawn after lanes, so `drawBandPill` looks see-through. That is the art's call.

This is round 1.

VERDICT: REJECT

## Round 2 · 2026-11-08

I reviewed head 1cab655. Since round 1 there are two commits: 5c60fa6 merges `origin/main` (docs only, and `origin/main` e2a4a40 is now an ancestor of the branch), and 1cab655 is the rework. I ran all my checks in a clean detached worktree at 1cab655, with the build served on its own port.

**Gates:** `npm run gates -- --base origin/main` passed all six (typecheck, lint, test, determinism, bots, protected-files). The build passed.

**Smoke:**
- Full suite: 192/192.
- `overworld.spec.ts --repeat-each 5`, both projects: 180/180.
- The reachability test alone, 20 repeats on the desktop project (where it failed 11/40 in round 1): 20/20.
- The step-skip, area-tap, first-slice and combat-line tests, 5 repeats on both projects: 60/60.

**Required changes from round 1:**
1. **Reachability test: done.** It waits for the pan and the sheet to stop changing (`panSettled`: the same scroll and sheet box on three frames running). Each drag now goes toward its target, sized to land the target mid-way in the uncovered part. The targets are the three highest areas and the lowest. Its pass rate is above.
2. **Single tap: done.** `tapArea` moved to `tests/smoke/helpers.ts`, shared by both specs. It waits until the area is still and the canvas is under it, clicks once, and fails if the sheet didn't open. My round-1 experiment (210/210 single taps) said this would hold, and the repeat runs above confirm it.
3. **Lost coverage: done.**
   - (a) A known, guarded, locked area's sheet now shows guard rows, a lancer tag with "(not researched)" and a Strong/Even/Weak badge, plus the combat line within the sheet's width and `expectControlsFit`.
   - (b) Four 375x667 wide-font tests cover an open area (Shelf), a locked area (Veil), a relay with a decayed haul (Rime) and a far area (The Deep). Each checks that the selected node and its label clear the sheet, that the node is on the map, that the sheet is under 60% of the map, and `expectControlsFit`. Land ends inside 667 px where there is one, and is absent only for the locked and far areas.
4. **Exact unit assertions: done.**
   - `openedByReclaim` is `toEqual(['Glint Relay','Mire Relay'])` for Rime, and `toEqual(['Spire Relay'])` for Glint after Shoal (the already-joined case: Thorn Garden is excluded).
   - Hops are compared in full against an independent relaxation over the data's lanes, not the BFS under test, plus The Deep = min(Mire, Spire) + 1.
   - The DECISIONS line is corrected to say the round-1 version had become inequalities.
5. **`tierRequirementText`: done.** The four wordings are restored in `h5-client.test.ts`.
6. **Combat line: done.**
   - `GUARD_TARGET_LINE` is now built from the sim's `GUARD_TARGET_ORDER.thorn[0]` and `.spore[0]`, and a unit test checks the line against the same constants.
   - A new test in the 375x667 portrait block (wide font via `ready`) checks the line's width and `expectControlsFit` on both the heart and the pocket sheets.
   - It needed a one-line export in `packages/sim/src/index.ts`, outside the task's file list. It exports an existing constant, changes no behaviour, and is recorded in DECISIONS. I accept it.
7. **Step skip by a real tap: done.** A real `page.mouse.click` on Mire Relay's position during the moment stops it and opens no sheet. That position would have opened Mire's sheet if the tap hadn't been swallowed. The test then checks that the pan is at rest, the opened band is in view and band 2's padlocks are gone.
8. **Comment and spacing: done.**
9. **Main merged and gates re-run: done.** Branch CI run 42555067869 on 1cab655: the `gates` job (gates, build and smoke on Linux) passed. The `deploy` job (the branch preview) was still running when I wrote this; it is not a merge gate.

**New code since round 1:** test files, two spacing fixes, the derived `GUARD_TARGET_LINE` and the sim export. None of it changes how the game plays. The version-tag note stays a note; DECISIONS records why it was left.

**The whole slice.** This merge lands h6-sim, h6-combat-target, h6-bots and h6-design-data (v11), all already approved, with this client on top. Gates (including the bots gate's H6 checks on v11) and the full smoke suite pass together on one head, which was the point of DECISIONS fc044d8.

Pillar fit: within the H6 spec and the Director's additions, as in round 1. The open frontier reads and plays on a phone: you can pan, the locks and relays explain themselves, the step moment plays once, and every area stays reachable with a sheet open.

Gates: all six passed locally on 1cab655. Smoke: 192/192. Repeats are clean, as listed above. Branch CI `gates` job: green.

Required changes:
- none

This is round 2.

VERDICT: APPROVE
