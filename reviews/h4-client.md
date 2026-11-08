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
