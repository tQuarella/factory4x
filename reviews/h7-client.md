# h7-client review

## Round 1 · 2026-11-14

Reviewed `git diff task/h7-raids...task/h7-client` (head 9a7f480; h7-raids merged at ee3ecbc) against DESIGN.md H7 "Client: screens and phone UI (H7)", "Art needs (H7)", the raid rules R1–R9 as the client draws them, and the BACKLOG h7-client acceptance. This is an intermediate round: h7-design-data isn't built yet, so acceptance 8 (merge design-data, gates and full smoke on v13 with `--repeat-each 5`, green branch CI on the merged commit) is out of scope here and is judged in the final round. No sim, bots or data file changes on this branch beyond the merged stack (checked: `git diff task/h7-raids HEAD -- packages/sim packages/bots data` is empty).

**Pillar fit.** This is the screen layer of the hypothesis, and it does what the spec asks. The radar and the five steppers make the allocation a running decision. The hint teaches only the probe ("Ships mine and haul on their own"). The muster banner warns ahead of the raid, and tapping it opens the target. Nothing in this branch changes how the game plays beyond the spec. Two client additions go beyond the spec text: the "Raid leaving" and "Next raid m:ss" / "Raids ready" chip states, and "Hive" for the heart in a field run. Both are consistent with the spec, and both are logged in DECISIONS.

**What is good.**
- The parked campaign is reached through data (`withRunMode`), and its replays and saves carry `mode: 'campaign'`. A field session's save and replay keep their shape, and both directions are unit-tested with hash checks.
- The moved tests switch to campaign data with no assertion removed. The three "old save starts fresh" smoke tests now assert something stronger than before.
- Every number on the sheets comes from `allocStatus`, `rockStatus`, `raidStatus` and `fieldSummary`.
- The rock sheet reserves room for its notes with a sizer (smoke-checked). The raid chip has a fixed width, and the raid smoke measures the HUD at every phase.
- Art: the bounds are checked twice (a recording context and the gallery pixel scan). The 24 px silhouette IoU check is real and was used to redraw the hulls. The palette key has its ART_STYLE row.

**Gates (run by me on 9a7f480, `npm run gates -- --base main`):**
- typecheck, lint, determinism (final df9ea7c5, unchanged from h7-raids) and protected-files pass.
- The test gate fails with 26 failures, all in `packages/bots/test/{needs-driven,runner,waves}.test.ts`. Those are h7-bots' files, as the stack note expects. Every client test passes.
- The bots gate fails fast on the `runCampaign` field-mode guard (h7-bots).
- Build plus full smoke: **220/220 passed** (desktop and phone, one pass).

**Findings that block.**

1. **The probe sheet scrolls in ordinary play (acceptance 2).** The smoke fit test opens the sheet at tick 0, paused, with nothing parked at the probe. In that state the Recycle button is hidden. Warships rally at the probe by default, so mid-run the Recycle button is nearly always shown. It stacks under Rally in the side column and makes the top block taller than the radar.
   - I measured on the phone project at 375x667, with drone weight 5, after 5400 ticks.
   - Normal font: `scrollHeight` 419 against `clientHeight` 413.
   - Wide-font stress: 453 against 413. The Flak row is cut off below the fold, and the Lancer row wraps to three lines ("Lancer 18 ore + 4 / crystal / off").
   - The spec's phone check is "the probe sheet (radar plus five rows) fits 375x667 without scrolling". This fails in the state the player sees it in most.

2. **The raid marker and dashed line are wrong after a retarget, and after a resume mid-flight (acceptance 4).** `MapView.drawRaid` always draws the out leg from the hive. It guesses the flight length as "the longest `ticksLeft` seen since this phase began", which is client state outside the world.
   - On R6's retarget, the sim keeps `phase: 'out'` and sets `raid.from` to the old target, then starts a new flight. The client still draws the line hive → new target. The marker restarts on that line, part way along, using the old leg's total.
   - After a resume mid-flight, the marker restarts at the hive.
   - The sim already exposes `raid.from` and `raid.flightTicks`, and h7-raids documented them as "the client draws progress from it".
   - Retargets happen whenever the player Stops the targeted rock during a muster or flight. That is exactly the counterplay the muster banner invites, so this happens in normal play.

3. **Acceptance 4's "the three end toasts, and the raid chip in each state" is not demonstrated.**
   - No test calls `raidChipText`, `raidEndText`, `raidMixText` or `raidMusterLine`.
   - The smoke reaches whichever end outcome happens. It never reaches the `home` phase ("Raid leaving", marker going home), "Next raid m:ss" or "Raids ready".
   - The withered text is untested.

4. **Acceptance 3's raid-rank line is untested.** `RAID_RANK_TEXT` is only used as the sizer in tests. No test shows the line on the rank-1 rock, or shows it absent elsewhere and on a Stopped rock.

5. **The real result-panel trigger is untested (acceptance 1).** The panel is only opened through `debugShowResult`. The new field branches in `transitionPending` and `refreshUi` (`isCaptured` → `showFieldResult`, once per run) never run under a test. A cheap path exists: tune the hive weak (or use a constructed start), capture it, and check that the panel opens once with New run.

6. **Small code-quality items (cheap, but they mislead):**
   - `ROW_SELECTOR` in `fieldsheets.ts` is exported, unused, and its comment describes something else;
   - `incomeText`'s doc says "Ore 14 unassigned · +36/min", but it returns "14 ore spare · +36/min";
   - `buildProbeSheet`'s doc says it "returns its per-refresh updaters", but it returns void and pushes to `ups`.

**Non-blocking notes (no change required this round):**
- With the probe sheet open (62 vh), the map gets about 145 CSS px at 375x667. The whole field is squeezed into it, and the node discs and labels pile up (A1, HIVE, A2 and PROBE overlap). The spec's "fits without scrolling" accepts a tall sheet, so this doesn't block. But the probe sheet is where the H7 decision is made, and during a raid the player loses the map while re-weighting. Worth a fun question at the handoff, or a Can wait item (for example, a radar-beside-rows landscape-style layout, or the map clipping instead of fitting).
- The raid smoke tunes `raid.musterTicks` to 600, not to 0 as acceptance 4 words it. That is the right call (at 0 there is no muster phase to check), and it is noted here for the record.
- The gallery smoke needs `deviceScaleFactor: 1` and a 120 s timeout because the gallery takes over a minute to draw at phone DPR. It's acceptable for a dev page, but the gallery is getting heavy.

Required changes:
- [ ] The probe sheet fits 375x667 with no scrolling, under the wide font, **with the Recycle button shown** (economy ships or warships parked at the probe) and the Lancer and Flak rows showing their longest state and cost text. Extend the acceptance 2 smoke test to measure that state, not only the empty landing.
- [ ] `drawRaid` draws each leg from `raid.from` to its destination, with progress `1 − ticksLeft ÷ flightTicks` (interpolated), and drops the client-side `flight` guess. Add a test (smoke or a recorded-draw unit test) that Stops the target during the out phase and asserts the line and marker start at the old target, and that a resumed mid-flight raid draws at the right point.
- [ ] Unit tests for `raidChipText` in every state (raids off → null, "Raids at N ships", "Next raid m:ss", "Raids ready", muster, out, "Raid on", "Raid leaving"), `raidEndText` for beaten, hit (each loss kind and the plural forms), turned back and withered, and `raidMixText` / `raidMusterLine` (order, singular and plural).
- [ ] A smoke or client test shows the rock sheet's raid-rank line on the rank-1 mined rock, and its absence on a rank > 1 rock and on a Stopped one.
- [ ] A test drives a real hive capture in a field run and sees the result panel open once, from the real trigger (not `debugShowResult`), with New run working.
- [ ] Remove `ROW_SELECTOR`, and fix the `incomeText` and `buildProbeSheet` doc comments.
- [ ] Re-run the gates and the full smoke, and list the results in the fix commit.

VERDICT: REJECT

## Round 2 · 2026-11-14 (final, top of the H7 stack)

Reviewed `git diff c74cb7d...task/h7-client` at head 9d022f9. The stack is now all on this branch:
- the fix round (3c9f761);
- h7-bots, merged with its approving review 9dff1c0 (4e0561f);
- h7-design-data, merged with its approving review c9656ef (cdea719);
- `main` (89be29d);
- two smoke-only commits (5802b2b, 9d022f9) that step the sim with `advanceTicks` instead of waiting in real time.

Every lower task's approving review commit is an ancestor.

**Round 1 required changes:**
1. **The probe sheet fits with Recycle shown.**
   - The radar is now the header (140x104). Rally and Recycle sit side by side beside it, so Recycle showing adds no height. The rows are one name line and one state line each.
   - The new smoke test is the state I flagged: ships parked at the probe, Recycle shown, Lancer and Flak on their locked lines. It runs at both fonts, asserts no scrolling, and checks that the map keeps 195+ px with the probe and hive above the sheet.
   - I re-measured with my own round 1 script, at 375x667 on the phone project, drone weight 5, after 5400 ticks. scrollHeight equals clientHeight: 353 / 353 with the normal font, 358 / 358 with the wide font. Every row is visible in my screenshots.
   - Done.
2. **The raid leg.** `drawRaid` draws from `raid.from` to the target (out) or to the hive (home), with progress `1 − ticksLeft ÷ flightTicks`. The client-side `flight` guess is gone. There are two smoke tests:
   - a retarget made by Stopping the target through its sheet: the new leg starts at the old target, with the new flight's progress;
   - a reload mid-flight: the marker is about half way along, not back at the hive.
   Done.
3. **Raid texts.** Unit tests cover:
   - `raidChipText` in all nine states, including off, "Next raid", "Raids ready" and "Raid leaving";
   - `raidEndText` for beaten (with and without losses), hit (every loss kind, singular and plural), turned back and withered;
   - `raidMixText`, `raidMusterLine`, `raidFightLine` and the clock rounding.
   Done.
4. **The raid-rank line.** A smoke test shows it on the rank-1 rock, absent on a rank > 1 rock, and gone after Stop. Done.
5. **The result panel.** A smoke test takes the hive with tuned values and real taps (Attack with all), and sees the panel open from the real trigger. Keep playing closes it, and it doesn't reopen as the run goes on. The campaign's win panel stays hidden, and New run asks first, then starts a fresh field. Done.
6. **Cleanup.** `ROW_SELECTOR` and `incomeText` are removed, and the `buildProbeSheet` doc is fixed. Done.

**Changes beyond my list, all logged in DECISIONS:**
- The probe sheet's money line is gone; the top bar already shows ore and ore/min.
- A row's cost moved to its tooltip, which a phone never shows. That is acceptable against the spec, which doesn't list a cost on the rows. The state line still shows the ore cost while saving ("saving 13/18") and the resource while waiting ("needs 4 crystal").
- The locked lines are shorter ("needs crystal pocket" / "needs ice pocket"). DESIGN.md matches since h7-design-data round 2.

**Determinism and data:** no sim or data code on this branch beyond the approved stack. Data is v13, and the client tests read the shipped values.

**Gates (run by me on 9d022f9):**
- `npm run gates -- --base main`: **every gate passes.**
  - typecheck, lint and protected-files;
  - test: 901 / 901;
  - determinism: final ad177b58;
  - bots: adaptive 24:54 and greedy 30:12, flags 1–7 met.
- Build plus full smoke: **232 / 232**.
- Full smoke with **`--repeat-each 5`** at the default worker count, desktop and phone: **1160 / 1160**, no flakes.
- Branch CI: run 43630983499 on 9d022f9 is **success**. This review commit only adds this file. If `merge-task` requires CI on the exact merged commit, it needs one more green CI run on the head that carries this review.

**Pillar fit.** Every decision the hypothesis needs fits one phone screen: the allocation (radar and five steppers), the Mine marks, and the raid warning with its target one tap away.

**Non-blocking notes, for the handoff:**
- With the probe sheet open, the map is about 200 px tall, and the rings round A1, A2 and the hive overlap at that scale. It stays readable, and the Director already holds it as a handoff question.
- Under the wide-font stress the "Recycle… N" label wraps, and its ellipsis touches the button edge. It's fine at the normal font, and the controls-fit check passes.
- `raidStatus` lacks `from` and `flightTicks`, so the map reads `world.raid` directly. The Can wait item for core is logged.

Required changes: none.

VERDICT: APPROVE
