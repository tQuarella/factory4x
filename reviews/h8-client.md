# h8-client review

## Round 1 · 2026-11-14

Reviewed `task/h8-client` at 887155c. That is the client's three commits (2439980, 8d56df5, 887155c) on top of `task/h8-sim` at its approved head (0b72251), plus a main merge (ce2d572). I checked it against DESIGN.md "H8 … Client: phone UI (H8)" and "Art needs", and against BACKLOG h8-client acceptance 1–12.

`task/h8-raids` is approved (d45cca3) but **not merged** into this branch (`git merge-base --is-ancestor task/h8-raids HEAD` is false). Neither is h8-bots nor h8-design-data. So this round judges the client work as built, and acceptance 6 (held line), 11 and 12 can't be met yet.

**Pillar fit.** This is the player's half of the H8 claim: a drag between nodes as the military order, with the economy controls (hauler count, Mine mode, weight %) moved out of its way. The build follows the spec's state list closely:
- the drag carries warships only;
- the gesture is a small DOM-free state machine fed by a thin pointer layer;
- the drop goes through the same `hitTest` as a tap;
- `elementFromPoint` makes "over a sheet / the HUD" mean no target.

Each call it made beyond the spec is logged in DECISIONS.md, and I agree with all of them:
- the Mine button sits in the top bar, because the game has no bottom bar;
- a press that travelled past the slop is never a tap in Mine mode or during tap-Move-tap;
- the tag shows the lead type's Strong/Even/Weak;
- the tap-Move-tap banner closes the sheet.

Nothing changes how the game plays beyond the spec. `debugParkShips` mutates the world outside the input log, but it is a test hook on `window.__factory4x` like the existing debug hooks, and it is logged.

**Gates (run by me on 887155c, `npm run gates -- --base main`): all PASS.**
- typecheck, lint;
- test: 48 files, 1015 tests;
- determinism: 958a2f1d;
- bots: flags 1–7 MET;
- protected-files: 64 files, none protected.

**Smoke, run by me** on a fresh build: `h8-client.spec.ts` and `h7-economy.spec.ts` with `--repeat-each 2`, desktop and phone, 132/132 passed in 34 s. The every-pair drag test (a) runs 220 drags per project, at the centre and 8 px short, and all of them land.

I also probed a long tap with real CDP touch events (`Input.dispatchTouchEvent`, Pixel 7 emulation, held 700 ms, scratch spec deleted). Chromium armed the split, then sent `pointerup` and `click`, and the sheet opened. So relying on the browser's click after a long tap works in Chromium's gesture pipeline. I can't test a real Android or iOS device from here. That's a note for the handoff, not a required change.

**Acceptance.**
1. **Drag: mostly met.**
   - All-drag, split-drag, the 48 px ghost, the highlight and the Attack tag are each tested.
   - So are every cancel case (empty space, source, sheet, `pointercancel`, second pointer), click suppression, the plain short and long tap, and no drag from a node with no warships.
   - Gaps:
     - `touch-action: none` on the field canvas is in CSS (`#app[data-run='field'] #view`), but no test asserts it. overworld.spec.ts does assert it for world mode.
     - The spec's state 3 says that when a split is armed, "the source ring pulses, **the ghost shows the half counts**". `drawGesture` only draws the ghost while `dragging`, so while armed the player sees a pulse but not how many ships will go.
   - `--repeat-each 5` is for the final round (item 12).
2. **Tap-Move-tap: met.** Move all and Move half, the banner and Cancel, empty space, and the drags-off path all have smoke tests.
3. **Hauler stepper: met.** The row reads "2 · Auto" and "3 · set (Auto 2)". −, + and Auto send `setHaulers`. A smoke test sees a1's haulers drop to 0 after the trip home and come back on Auto. The row is hidden under `autoNeed` 0.
4. **Mine mode: met.** It takes three taps, opens no sheet, ignores taps elsewhere, turns drags off, and leaves again with the second tap. `aria-pressed` is set, and the HUD is measured.
5. **Weights: partly demonstrated.**
   - `weight · incomePct%` and the radar line are tested against `allocStatus`.
   - **"enough haulers" is not.** The smoke test accepts `/^(enough haulers|saving \d+\/\d+|building \d+%)$/`, so it passes whichever state the row is in. No unit test covers `allocStateText` for `enough` (fieldreport.ts:46–47, for either type).
6. **Raid badge: met for what is built.**
   - The badge is tested from muster through fight to the end, with "Raid coming" and "Raid here".
   - The "Haulers waiting at the probe" line is wired to `rockStatus.haulersHeld`, which is still the h8-sim stub, so it is untested until h8-raids is merged. DECISIONS.md says so.
   - After that merge, the `raidStatus` phase fallback in `raidBadgeMix` (view.ts) and in the rock sheet's `raidOn` (fieldsheets.ts) becomes redundant, by the engineer's own note. That's dead code.
7. **Fleet panel: met.** It has five rows with alive, idle and the building dot, steppers clamped to `recyclable`, and "Recycle N (+X ore)". A smoke test recycles an idle hauler and checks the input, the toast and the alive count. It fits under the wide font, and all buttons are 44 px.
8. **Fit and stability: partly met.**
   - The probe sheet, the rock sheet (hauler row and raid line) and the fleet panel are each tested for no scrolling under the wide font.
   - Mine mode and the drag are measured against the HUD. **The raid badge isn't:** the raid-badge test never measures the HUD.
   - **The rock sheet grew from the 45dvh cap to 62dvh** (`#sheet.rk`). The fit test computes `stage` (the map's height) but never asserts it. In `reports/h8-client/h8-rock-sheet-raid.png` the map behind a rock sheet during a raid is about 160 px tall, with labels stacked on each other. That is the moment the player most needs to see the field and drag to the target.
   - H7 set a rule for the probe sheet: the map keeps 195 px or more behind it at the normal font (h7-economy.spec.ts:309, DECISIONS.md "compact probe sheet"). The rock sheet now takes the same room, so it needs the same check. Part of its new height is the note box, which reserves three lines. The screenshot shows it as a large, mostly empty box.
9. **Art: met in substance, with three accuracy problems.**
   - **Raw colour literals.** `drawDragGhost` and `drawDropTag` fill with `'rgba(11, 22, 38, 0.94)'`, and the attack tag with `'rgba(70, 12, 36, 0.95)'` (placeholders.ts:1664, 1710). These are the only raw colours in placeholders.ts. ART_STYLE.md says "No new palette keys: every H8 draw reuses an existing one", but the dark pink tag fill is a new colour. The spec says "Any new colour gets a palette key and an ART_STYLE.md row."
   - **A wrong bound.** ART_STYLE.md says the drop highlight stays "within 1.2 r", and h8-art.test.ts checks this only at r = 50. The call site passes the node's reach, which can be as small as `MIN_HIT` = 22. There the halo reaches r + 3 + 4 = 29 px, which is 1.32 r. The guide states a bound the game breaks (the same kind of problem as h6-art r2, DECISIONS.md).
   - **A wrong comment.** `drawRaidBadge`'s doc comment says the badge "sits on the rock's upper left". The code and ART_STYLE.md put it at the lower left.
10. **Tuning: met.** The nine H8 keys are listed, the three `client.*` keys are tagged "this device", and the `client.*` keys are stored in settings and validated against the data ranges (unit-tested).
11. **Smoke time:** the new tests step with `advanceTicks` and `stepSimUntil`. I found no real-time waits beyond `expect.poll` for the long-press timer, which is set to 250 ms. **No CI job times are reported yet.** That is due with the final round.
12. **The stack: not yet.** h8-raids, h8-bots and h8-design-data aren't merged, and there's no full smoke at x5 on the final data and no branch CI.

**Code quality.**
- gesture.ts and gesturectl.ts are clear and match the spec's states.
- The late-timer handling (reading the long press from the move's timestamp) is a good touch, and it's tested.
- The persist refactor (`CLIENT_SETTING_KEYS`) generalises the H7 one-key special case cleanly.
- The test file's `drawnH8` hook follows the existing `drawnEconomy` pattern.
- The h7-economy.spec.ts:286 change states its premise and loosens no assertion. It is acceptable under the stack plan.

**Required changes:**
1. **Merge `task/h8-raids` (d45cca3).**
   - Add a smoke test with `raid.firstAtEcon` 2 and `raid.musterTicks` 0 in which the target rock's sheet shows "Haulers waiting at the probe" while the hold applies and clears after it.
   - Then delete the `raidStatus` phase fallback in `raidBadgeMix` (view.ts) and in the rock sheet's `raidOn` (fieldsheets.ts), reading `rockStatus.raidTarget` only, or log in DECISIONS.md why it must stay.
2. **Draw the ghost chip while a split is armed** (spec, Drag state 3), showing the split counts. Assert it in smoke test (b): `dragState().ghost.counts` is non-null while `armed`.
3. **Test the "enough haulers" text:**
   - add a unit test of `allocStateText` for `enough` for both Hauler and Extractor;
   - in smoke, state a premise that puts the Hauler row in `enough` (check `allocStatus` first) and assert the exact text "enough haulers", in place of the any-state regex.
4. **Assert `touch-action: none`** (computed style) on `#view` in field mode, in h8-client.spec.ts.
5. **Measure the HUD for the raid badge** (acceptance 8): HUD boxes unchanged from before the raid, through muster and fight, to after it ends, as the Mine-mode test does.
6. **The rock sheet keeps the map's room.** In the rock-sheet fit test, at the normal font, assert the map (`#stage`) keeps at least 195 px behind the rock sheet (H7's probe-sheet rule) with the hauler row and a raid line shown. Compact the sheet if it fails; the three-line reserved note box is the obvious place to look. If you believe 195 px can't hold, log it in DECISIONS.md for the Director instead.
7. **Palette:**
   - replace the two raw `rgba(...)` fills in placeholders.ts with palette keys;
   - add ART_STYLE.md rows for any colour that is new (the dark pink attack-tag fill is);
   - correct the "No new palette keys" sentence to match.
8. **Drop-highlight bound:**
   - make the draw meet the ART_STYLE bound at the reach sizes the game passes (down to 22 px), or restate the bound truthfully;
   - test it at r = 22 as well as 50.
9. **Fix `drawRaidBadge`'s doc comment** ("upper left" → lower left).
10. **For the final round (acceptance 11 and 12):**
    - merge h8-bots and h8-design-data;
    - run the gates and the full smoke at desktop and phone with `--repeat-each 5` on the final data, including (a)–(d);
    - report the CI gates and deploy job times with run ids, and have branch CI green on the exact commit to merge.

VERDICT: REJECT

## Round 2 · 2026-11-14

Reviewed `task/h8-client` at af0a91d: the fix commits 6ef946b and af0a91d, on top of the merge of `task/h8-raids` (bf44bad, which brings in h8-raids' approved d45cca3) and a main merge (b2861d8). I re-read the spec's client section and every round 1 item against the code.

**Stack state:**
- `task/h8-raids` is in.
- `task/h8-bots` is not (its round 1 was REJECT, a068a4c).
- `task/h8-design-data` doesn't exist yet.

**Gates (run by me on af0a91d, `npm run gates -- --base main`): all PASS.**
- typecheck, lint;
- test: 1045 tests;
- determinism: cdbdea56, h8-raids' baseline;
- bots: flags 1–7 MET;
- protected-files: none touched.

**Smoke, run by me** on a fresh build: `h8-client.spec.ts` and `h7-economy.spec.ts` with `--repeat-each 5`, desktop and phone, **360/360 passed** in 1.3 min. That includes (a)–(d) five times each on both projects. The rock-sheet test logs the map behind the sheet with the raid out and the hold shown: 210 px at the normal font and 185 px at the wide font, every repeat.

**Round 1 items:**
1. **Done.**
   - h8-raids is merged.
   - The raid-badge smoke test now walks muster, out (asserting `haulersHeld` and "Haulers waiting at the probe" on the target's sheet), fight, and the end (hold false, line empty).
   - `raidBadgeMix` and the rock sheet's `raidOn` read `rockStatus.raidTarget` only; the fallbacks are gone.
   - `raidTarget` also holds while the raiders fly home, so the sheet now reads "Raid leaving: …" in `home`. That's a small, truthful addition within "from muster to the raid's end", and it's logged and unit-tested.
2. **Done.** `drawGesture` draws the ghost while armed. Smoke (b) asserts the armed ghost shows `[{drone, 2}]` before the finger moves.
3. **Done.**
   - A unit test covers `allocStateText` for `enough` on both rows.
   - A new smoke test checks the `enough` premise in `allocStatus` first, then asserts the exact text "enough haulers".
4. **Done.** `#view` has `touch-action: none` (computed) in field mode.
5. **Done.** HUD boxes, the Mine button included, are compared at muster, fight and end against the frame before the raid.
6. **Done.**
   - The rock sheet is now compacted: Rally moved into the head as "Rally here" / "Rally set", and Buffer and Delivered share a line.
   - The fit test runs at both fonts in the tallest state (raid out, hold shown) and asserts the map keeps at least 195 px at the normal font. It holds 210.
   - Keeping the hauler stepper on its own line, so the buttons don't move when the value text grows, is the right call.
   - The new screenshot reads well.
7. **Done.**
   - `ghostFill` and `attackFill` are palette keys, with ART_STYLE.md Palette rows and palette-sync roles.
   - The H8 section's sentence now says so.
8. **Done (bound restated).**
   - ART_STYLE.md now says the bound is r + 7 px, and gives the 1.32 r figure at the smallest reach the game passes.
   - The art test checks reaches 22, 30 and 50, and the gallery line matches.
   - The test now has a stray blank line where the old assertion was. That's cosmetic.
9. **Done.**
10. **Not done, and can't be yet.** The final-round items in acceptance 11 and 12 depend on tasks that aren't approved:
    - merge h8-bots and h8-design-data;
    - run the gates and the full smoke at x5 on the final data;
    - report the CI job times with run ids;
    - get branch CI green on the exact commit to merge.

**Judgement.** The client work itself is now complete and of good quality. I have no remaining code or test changes to ask for on what is built.

I am not approving, because acceptance 11 and 12 belong to this task, and BACKLOG says h8-client "gets its final Critic approval, and lands the stack" only after h8-design-data is merged. An APPROVE line here would let `merge-task h8-client` land h8-sim, h8-raids and the client on main without h8-bots' fixes or calibrated data.

**Round count.** This is round 2, so the next round would be the third. The only open items are waiting on other tasks, not on rework here. The Director should log in DECISIONS.md how PROCESS's third-rejection rule applies, so this task isn't parked for waiting on its stack. I recommend that the next round be the final, stack-merged one.

**Required changes (final round only):**
- Merge `task/h8-bots` once it is approved, then `task/h8-design-data`, plus every lower task's approving review commit.
- Re-run `npm run gates -- --base main` and the full smoke at desktop and phone with `--repeat-each 5` on the final data. Report the counts.
- If the final data changes anything a client test or screenshot depends on (hauler counts, raid sizes or timing, the probe-sheet map room), update the premise, not the assertion, and refresh the `reports/h8-client/` shots.
- Report the CI gates-job and deploy-job times with run ids (acceptance 11), and have branch CI green on the exact commit to merge, with this verdict committed before that run.
- Make no client changes beyond those, or say what changed and why.

VERDICT: REJECT

## Round 3 (final, stack integration) · 2026-11-15

Reviewed `task/h8-client` at b2a091d.

**Round numbering.** This is the third review file round. Under the Director's ruling 5a47198, round 2's reject was held only for the stack and doesn't count toward the deadlock rule. So this is the stack-integration round the ruling names, not a third rework round.

**The stack is complete.** Each approving review commit is an ancestor of b2a091d, and each review file ends in APPROVE:
- h8-sim (0b72251);
- h8-raids (d45cca3);
- h8-bots (round 2, 6593008);
- h8-design-data (round 1, 35a4db7).

Design-data stays on data v14 by Director ruling. `data/sim.json` is unchanged since round 2 (`dataVersion` 14), and its review covers the v15 trial that was dropped.

**No client changes since round 2.** `git diff af0a91d b2a091d` touches nothing in `packages/client`, `tests/smoke`, `ART_STYLE.md` or `data/`. The merges bring only the bots, the design-data reports and archives, and docs, all reviewed in their own tasks. So round 2's judgement of the client stands: every round 1 item is done, and there are no open code or test changes.

**Gates (run by me on b2a091d, `npm run gates -- --base main`): all PASS.**
- typecheck, lint;
- test: 1072 tests;
- determinism: cdbdea56;
- bots: flags 1–7 MET;
- protected-files: none touched.

**Full smoke (run by me)** on a fresh build of b2a091d, the whole suite at desktop and phone with `--repeat-each 5`: **1370/1370 passed** in 7.9 min locally. That includes h8-client (a)–(d) five times on each project, the rock-sheet map-room check, and every H7 and earlier test, all on the final v14 data.

**Acceptance 11 and 12: CI.**
- **GitHub Actions has not run on this branch at all.** Runs 43653137152 (887155c), 43654796241 (af0a91d) and 43753735876 (b2a091d) each failed in 2 s. The gates job was never started, and the annotation reads: "The job was not started because recent account payments have failed or your spending limit needs to be increased." So no CI job times exist yet, and branch CI is not green.
- This is an owner-account blocker. It is not a defect in the task, and no agent can fix it. It also blocks every other merge and deploy.
- PROCESS puts the Critic's verdict before the merge CI run, so my approval comes first, and the merge waits on CI.
- This approval covers the code at b2a091d plus this review commit. **It does not waive CI.**

**Conditions on the merge** (merge preconditions under PROCESS, not deferred work):
- `merge-task h8-client` must not run until branch CI is green on the exact commit that carries this verdict.
- The Director records the gates and deploy job times, with the run id, in STATUS.md (acceptance 11).
- If either job is past 80% of its limit, or CI fails on anything, this verdict doesn't cover that commit. It goes back for a new round.

**Owner action needed, one step:** fix GitHub billing or the Actions spending limit for `tQuarella/factory4x` (Settings → Billing & plans). The Director should raise it in QUESTIONS.md if it isn't already there.

**Required changes:** none to the code. The merge waits on green branch CI, as above.

VERDICT: APPROVE
