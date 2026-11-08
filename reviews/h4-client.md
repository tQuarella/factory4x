# Review: h4-client

## Round 1 · 2026-11-08

Pillar fit: Good. The change builds what DESIGN.md H4 "Client: screens and phone UI" asks for and nothing more: the paused overworld with six areas and seven lanes, the area sheet (haul, export, guarded nodes, heart tags with "(not researched)", Land), the research sheet (core card with per-resource progress, design cards, grind rows with effect now → next, disabled reasons from `researchStatus`), the landing notice naming every research effect, return, withdraw and reclaim notices, the Shipments line and the two new yard states, the area result panel, the win panel, and New system behind a confirm. The deviations are small and logged in DECISIONS.md: a secondary "Keep playing here" on the area result panel (free play after a reclaim is in the spec), "+N/min" on the stockpile chips with "while you play" moved to the tooltip and the research sheet note (it does not fit at 375 px), and icon-only Overworld and pause buttons. None changes how the game plays. The temporary INTERIM_START hook from h4-sim is gone, and a constructed start is now part of the replay and save, which is the right way to keep the dev hooks honest.

Quality: Clear and consistent with the codebase. Numbers come from selectors (`areaStatus`, `campaignStatus`, `researchStatus`, `landingEffects`, `campaignSummary`) or live tunables; `MIN_BUILD_TICKS` and `RIG_NODES` come from the sim, not copied. The client pauses the overworld in `Session` (no ticking, one step per input), which matches "Pause on the overworld" and keeps the log short. Unit tests in `packages/client/test/h4-client.test.ts` cover the session on the overworld, the replay with and without a constructed start, save round-trips (including `shippedAtLanding`), the v5 discard, every notice and research text function, `openedByReclaim`, lane ordering toward Landfall, and the 375 px fit. The smoke suite covers every item in acceptance 4 at desktop and phone, and reads expected numbers from `defaultData` or the page, not pinned values.

Problems found:

1. **Phone bug: the pause button is blank while paused.** In `packages/client/src/style.css`, inside `@media (max-width: 480px) and (max-aspect-ratio: 1/1)`:
   ```css
   #controls .ctl#b-pause .i-play, #b-pause.on .i-pause { display: none; }
   #b-pause.on .i-play { display: block; }
   ```
   The first selector has specificity (2,2,0) and the second (1,2,0), so the play icon is never shown in phone portrait. When paused, the pause icon is hidden too, and the button is empty. I checked it in Chromium against the built client after `startCampaign({land: 'landfall'})` and one tap on `#b-pause`: at 375x667 the computed `display` of `.i-pause` / `.i-play` is `none` / `none`; at 1200x800 it is `none` / `block`. H3 showed the word "Play" here, so this is a regression on the owner's main device. The block is also mis-indented and repeats the two global rules above it, which is how the bug got in.
2. **Hard-coded colours that already exist in the palette.** `worldview.ts` draws label text with `'#707b90'` and `'#cfe8ff'`; these are `palette.areaLocked` and `palette.starBright`. Use the palette names so a palette change reaches the overworld labels.

Gates: `npm run gates -- --base main` run by me on `task/h4-client` (2aa138a): typecheck, lint, test, determinism, bots and protected-files all PASS. I also ran `npm run build && npm run smoke`: 70 of 70 passed (desktop and phone). Branch CI run 42490943117 was still in progress when I checked; acceptance 5 needs it green. No protected files touched; no data or `dataVersion` change (none needed).

Required changes:
- [ ] Fix the phone-portrait pause button so it shows the play icon while paused and the pause icon while running. Remove the duplicated, mis-indented rules from the `max-width: 480px` media block rather than adding more specificity.
- [ ] Add a smoke assertion at 375x667 (phone project or the portrait describe) that after tapping `#b-pause` the button shows a visible icon (for example `#b-pause .i-play` is visible and `.i-pause` is hidden), and the reverse after a second tap.
- [ ] Replace `'#707b90'` and `'#cfe8ff'` in `packages/client/src/worldview.ts` with `palette.areaLocked` and `palette.starBright`.
- [ ] Branch CI green on the fixed commit.

VERDICT: REJECT

## Round 2 · 2026-11-08

Reviewed 2246c80 (round 1 fixes), compared with 124155c.

Round 1 items:
- [x] Pause button on phone: the duplicated, mis-indented rules are gone from the `max-width: 480px` block. Only `#controls .ctl { width: 46px; }` and `#controls .ctl#b-research { width: auto; }` remain. The research override now beats `#controls .ctl` on specificity, which it did not before. The global `#b-pause` icon rules apply at every width.
- [x] Smoke check: `375x667 portrait › pause and play icons swap on each tap of the pause button` checks computed display and box size of both icons over two pause/play cycles. It passes on desktop and phone.
- [x] `worldview.ts` label colours now use `palette.areaLocked` and `palette.starBright`.
- [ ] Branch CI: the Director runs it after merging main. It still has to be green before `merge-task`.

New problem found (not from the round 1 diff, but in this branch's code, and it makes the release smoke suite flaky):

1. **A tap on the overworld in the first ~100 ms after a withdraw or return gets undone.** When the game is running, `leaveArea` is queued and applied inside `Session.advance()` in `frame()`. `refreshUi()`, and so `modeTransition()`, runs only on the 100 ms UI cadence (`uiAcc >= 100` in `main.ts`). In that gap `session.onOverworld` is already true, so the canvas click handler opens the area sheet. Then the next `refreshUi()` sees the screen changed and runs `closeWorldSheets()`, `resizeViews()` and shows the return notice, which also resizes the canvas. The sheet the player just opened disappears, and a tap in that window used positions from before the re-fit.
   - **Reproduced:** `npm run smoke` on 2246c80 failed `[desktop] withdraw asks first; Stay keeps the area; Withdraw resets it` (71 passed, 1 failed). Rerunning it with `--repeat-each 5` failed 1 of 10. The failure: `#sheet button.land` resolved, then "element was detached from the DOM, retrying" until the 30 s timeout. The page snapshot shows the sheet closed and the "Withdrew from Landfall" toast up, so the transition closed the sheet after the tap opened it. The test taps right after `onOverworld()` turns true, which is exactly that window.
   - For a player this is a lost tap now and then. For the team it is a release-smoke flake, which is the kind of thing cw-flaky-test was raised to stamp out. Hiding it with CI's single retry is not acceptable.

Gates: `npm run gates -- --base main` on 2246c80: typecheck, lint, test, determinism, bots and protected-files all PASS. `npm run build && npm run smoke`: 71 of 72 passed. The one failure is the flake above, and it reproduces 1 in 10.

Required changes:
- [ ] Run the screen-change handling as soon as the active area changes, not on the next 100 ms UI tick. For example, call `refreshUi()` (or `modeTransition()`) from `frame()` right after `advance()` whenever `session.world.campaign.active` differs from what was last seen. Then no tap can reach a screen whose transition has not yet run. Do not fix this by adding a wait to the smoke test.
- [ ] Add a regression check: withdraw while the game is running, then tap Landfall as soon as `onOverworld()` is true. The sheet must stay open, and Land must work. Run the withdraw smoke test with `--repeat-each 10` on both projects and report all passing in the commit message or in DECISIONS.md.
- [ ] Branch CI green on the fixed commit.

Note for the Director: this is round 2. If round 3 is rejected, the task is parked per PROCESS.md.

VERDICT: REJECT
