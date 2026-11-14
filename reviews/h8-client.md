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
