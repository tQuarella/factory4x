# Review: h5-client

## Round 1 · 2026-11-08

I reviewed `task/h5-client` at bd32246 against main (9e9ebd6, merge base 027220d). I checked it against the H5 spec in DESIGN.md ("Client: screens and phone UI", "What changes for H4 content", "Selectors"), the h5-client backlog entry, and the full diff (14 files).

Pillar fit: The change builds the H5 UI the owner picked (Q17) and nothing beyond it. The pieces:
- the fleet chip;
- the Yards header and the `fleetFull` row with counts;
- Recycle… with a panel that defaults to 0 and a `recycleRefund` preview;
- the fleet-full, recycle and purchase notices;
- the repelled hint;
- the landing-notice limit;
- the area-sheet limit line under the heart tags;
- the Command limit card with pips, cost chips, requirement and disabled reasons;
- the Recycled line on the result and win panels;
- the tuning labels.

DECISIONS.md logs the deviations, and each is a reasonable reading of the spec that does not change how the game plays:
- Recycle… sits on the parked node's own sheet.
- The repelled hint drops "cut the Root" when there is no fed Root, and drops "raise the limit" at the last level.
- The Recycled line is hidden when the count is 0.

Acceptance:
1. Everything listed in the spec exists, with one exception: the HUD row requirement fails (item 3).
2. Numbers come from `fleetStatus`, `recycleRefund`, `landingEffects`, `researchStatus` and live tunables, with one exception: the requirement line's ✓ for a `tier` requirement re-derives the sim's rule in the client (`worldsheets.ts`, `data.map.areas.filter((a, i) => a.tier >= q.tier && ...reclaimedTick != null)`). `researchStatus` already reports this as `missing.tiers`. The smoke tests read the limit and step from `defaultData`. They pin the palette amber `rgb(255, 210, 122)`, which is art, not data, so it is acceptable, but it would read better taken from `palette.probe`.
3. **Not met: "The fleet chip and the ship chips stay on one row under the wide-font stress."** I checked this myself at 375x667 on the built branch:
   - Method: a Playwright script, paused, with the HUD chips set to realistic in-area states inside one synchronous `evaluate`, then measured.
   - The fleet chip is about 133 px wide and wraps onto a row of its own, below the ship chips, in every realistic state:
     - Frost Shelf (ore, ice, plating, drone, flak, "Fleet 12/12"), wide font: drone on row 1, flak and fleet on row 2.
     - Frost Shelf, normal font: the five other chips on row 1, the fleet chip alone on row 2.
     - The Deep with everything unlocked (ore, ice, crystal, lens, plating, three ships, "Fleet 30/30"): three rows in both fonts, with the fleet chip alone on row 3 (tops 2 / 49 / 75 wide, 2 / 35 / 61 normal).
   - So the HUD grows to three rows on a phone exactly when the limit matters, and the chip sits apart from the ships it counts.
   - The smoke test named "the fleet chip and the ship chips fit the HUD under a wide font" doesn't catch this:
     - It runs at `DEEP_START`'s first frame, when only ore and the drone chip are visible (lancer and flak unlock on the first ice or crystal delivery).
     - It checks only that no text wraps inside an element and that every chip's right edge is ≤ 375. It never compares rows.

   The rest is met:
   - Targets: the Recycle panel, the Recycle… button and the research card pass `expectControlsFit` at 375 px.
   - The Recycle panel fits within 667 px.
   - Every action is ≤ 2 taps: node, then Recycle….
4. The smoke tests cover the four required flows: fill and see "fleet full" on a yard row; recycle and see the stock rise by the preview; buy Command limit and see the new limit in the next landing notice; and `fleet.cap` 0 hides the chip. They add the disabled reason, the tuning label and the v7 save. I ran the H5 smoke tests with `--repeat-each 5` on both projects against my own preview build of the branch: **100 passed**.
5. The v7 save smoke test passes. Branch CI was still in progress when I finished, so it is not yet confirmed green.

Determinism: The client sends `recycleShips` through `Session.sendAll`. The recycle smoke test checks that `replayMatchesLive` holds afterwards. The fleet-full notice state lives in the client and only affects UI. There is no new sim code.

Quality: The code is clear and follows the send-panel and sheet patterns. Unit tests in `h5-client.test.ts` cover the wording, the repelled-hint branches, the disabled reasons, and a Session recycle (preview equals refund). Two small points:
- `battleReport`'s optional `data?` parameter makes `fullFleetHint` silently assume "can raise" when it is omitted. Only `main.ts` calls it, and it passes `data`.
- The new CSS hex colours match colours already used in style.css.

Gates: I ran `npm run gates -- --base main` on the branch myself: all pass (typecheck, lint, test, determinism, bots, protected-files; 14 files changed, none protected). Release smoke: H5 tests 100/100 with `--repeat-each 5` on desktop and phone.

Required changes:
- [ ] At 375x667, under `WIDE_FONT` and with normal fonts, the fleet chip must sit on the same row as the drone, lancer and flak chips in both of these states:
  - Frost Shelf, mid-visit: ore, ice with its rate, plating, drone, flak, and "Fleet 12/12";
  - The Deep with everything unlocked: ore, ice and crystal with rates, lens, plating, all three ships, and "Fleet 30/30" (full).

  The HUD should also not grow past the two rows it had before H5. How is up to you, for example a no-wrap group for the ship and fleet chips, or a narrower chip. Keep the spec's "Fleet 9/12" text unless the chip still can't fit, and log any change to it in DECISIONS.md.
- [ ] Replace or extend the 375 px HUD smoke test so it would have caught this. Reach a state where lancer and flak are unlocked, either by playing to a delivery or through a dev-hook start that unlocks them. Assert that the fleet chip's top matches the visible ship chips' tops (the same row), with the fleet both normal and full, under `WIDE_FONT`.
- [ ] Take the requirement line's ✓ for a `tier` requirement from `researchStatus` (`r.missing.tiers`) instead of re-deriving the tier count in `worldsheets.ts`.
- [ ] Branch CI must be green on the final commit.

VERDICT: REJECT

## Round 2 · 2026-11-08

I reviewed `task/h5-client` at dc899e8: commits afa02dd, 942fcd1 and dc899e8 on top of my round 1 commit, 1420e4b.

Round 1 items:
- **Fleet chip on the ships' row at 375 px: met in portrait.** The ship chips and the fleet chip are now one no-wrap `.chip-row.ships`, and the resource chips flow before it.
  - I re-measured on my own preview build at 375x667 with values longer than the game produces: 3-digit counts, "+12" rates and "Fleet 30/30" (full).
  - Frost Shelf (ore, ice, plating, drone, flak, fleet) and The Deep with everything unlocked are both two rows, under `WIDE_FONT` and with normal fonts. The fleet chip shares the drone chip's row every time, and nothing scrolls sideways.
  - The Director's layout call (rates show "+3" without "/min" on the chips, the unit kept in the tooltip, and 2 px chip gaps at ≤ 480 px portrait) is presentation only. It is logged, and I accept it.
- **Row-aware smoke test: met.** The new `HUD chips: …` tests set realistic unlocked states and compare row positions, normal and full, in both fonts.
- **Tier ✓ from `researchStatus`: met.** It now reads `r.missing.tiers`.
- **CI:** run 42506161734 (bd32246) passed. The runs for 942fcd1 and dc899e8 were still in progress or queued when I finished.

New problem (a regression from this round): **in landscape and on desktop, the ship chips are drawn off-screen.**
- Cause: at `min-aspect-ratio: 1/1`, `#bars` is a 132 px column (156 px at ≥ 900 px wide), and `#chips` is `flex-direction: column`. The new `.chip-row.ships` is `flex-wrap: nowrap; justify-content: flex-end` inside that narrow column, so its overflow spills out of the left edge.
- Measured on the built branch, with every chip's position compared with `#bars`:
  - **1280x720 (the desktop smoke project's size), real game state, The Deep at landing:** the Drone chip is at x −51..2, almost entirely off-screen. Only "Fleet 1/30" shows under the ore chip. In my screenshot the Drone chip is missing and the fleet icon is clipped at x = 0.
  - **1280x720 with lancer and flak unlocked:** Drone −146..−98, Lancer −94..−46, Flak −42..5 (normal font). The player can't see their ship counts at all.
  - **667x375 (phone landscape):** the same. Drone, Lancer and Flak are all at negative x, and the fleet chip starts at x −15.
- In round 1 (bd32246) these chips sat in the column and were visible.
- No smoke test checks that the HUD chips are within `#bars` in the landscape and desktop layout, so the suite still passes. I ran the whole suite on both projects: 112/112. The H5 tests with `--repeat-each 5`: 180/180.

Minor:
- DECISIONS.md now has three h5-client round 2 bullets. The middle one ("the HUD shows three rows in that one combination … Not fixed here") is superseded by the third and contradicts the shipped behaviour. Fold them into one accurate entry.
- At 360 px wide (common Android), the wide font with The Deep fully unlocked still gives three rows. The fleet chip does stay with the ships. The criterion names 375 px, so this is not required.

Gates: I ran `npm run gates -- --base main` at dc899e8 myself. All pass: typecheck, lint, test, determinism, bots, protected-files.

Required changes:
- [ ] In the `min-aspect-ratio: 1/1` layout (phone landscape 667x375 and desktop 1280x720), every visible HUD chip (resources, the three ships and the fleet chip) lies fully inside `#bars` horizontally, in both fonts, with The Deep fully unlocked and the fleet full. For example, the ships group could wrap or stack in the column layout. The portrait two-row result must not regress.
- [ ] Add a smoke assertion for that landscape and desktop case: the visible `#chips .chip` elements stay within `#bars`' left and right edges in the realistic states the portrait tests already set up. It must fail on dc899e8.
- [ ] Fold the h5-client round 2 DECISIONS.md bullets into one entry that describes the shipped layout. Drop the superseded "three rows … not fixed here" text.
- [ ] Branch CI must be green on the final commit.

VERDICT: REJECT
