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
