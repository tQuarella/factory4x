# Review: h6-bug-topbar-oscillation

## Round 1 · 2026-11-08

I reviewed `git diff main...task/h6-bug-topbar-oscillation` at commit 36f414e (base f8fabe3). The commit touches `env.d.ts`, `main.ts` (a `debugHudFrame` dev hook), `style.css` and the new `tests/smoke/hud-stability.spec.ts`. All four are within the task's file list, and nothing in `packages/sim` changed. The engineer has uncommitted work for the next bug (`h6-bug-buffer-toast-flicker`) in the same worktree. I did all my checks in clean detached worktrees: one at 36f414e, and one at f8fabe3 for the before-and-after comparison.

**Diagnosis and fix.** The diagnosis is correct. Counts changing digit length resized the right-aligned chips, and the ice/crystal rate line appearing and disappearing changed chip heights, so the whole bar shifted. The fix:
- Each `.chip b` and `.chip small` gets a hidden, zero-height `::before` sizer (`--num-pad`, `--rate-pad`), so the reserved room follows the font in use.
- The rate line always keeps its row (`\200b`).
- The ORE/MIN arrow keeps its room.
- The phone padding is trimmed to pay for the extra room.

The mechanism is sound, and digits are never hidden or truncated.

**Gates (run myself on the clean tree):** `npm run gates -- --base main` passed all six (typecheck, lint, test, determinism, bots, protected-files: 4 files changed, none protected). `npm run build` passed.

**Smoke.** I served each build on its own port, because port 4173 was taken by another agent's preview and `reuseExistingServer` would have tested the wrong build.
- Full suite on the branch: 149/150. The one failure is `boot.spec.ts` "overworld: tap an area for its sheet; a held area cannot be landed on" [phone]. It is pre-existing and load-dependent: on unmodified main it fails 2/5 under parallel load and 0/10 serially, and on the branch 1/10 serially. The tap on area 3 lands on `#hint-text` on both builds. It is not caused by this change, but it is an unfiled flake (see note 2).
- `hud-stability.spec.ts --repeat-each 5`, both projects: 30/30 passed.
- **Fails on main (AC6):** I applied only the hook and the test to f8fabe3, without the CSS, and rebuilt. All three layouts fail on frame 1, for example `#chip-ore.x 174.0 -> 183.8` and `#chip-ice.h 24.0 -> 45.0`. The test detects the bug.

**Acceptance criteria.**
1. Fullest HUD (The Deep, 5 resource + 3 ship + fleet chips, verified `visible.length === 9`). Counts change on every frame for 240 frames, crossing 0↔1, 9↔10, 99↔100 and 999↔1000. Rates appear and disappear, lens and plating pass through 0. The counts come from a cloned world through the hook, not from live ticks, but the HUD's real `update` path renders them, so this tests what the bug is about. Met.
2. Every element's box stays within 1 px, and the row count is constant. Met.
3. 375x667 with the wide font, landscape 667x375, desktop. Met.
4. No chip shows or hides through 0. Met for the test state. In the real game, lens and plating are sticky once crystal or ice has been delivered (`unlockStatus`).
5. At most two rows at 375. Met.
6. Fails on main, passes `--repeat-each 5`, gates pass. Met. I did not check branch CI.

**Why this is rejected: the counts no longer sit with their icons.** I took screenshots of the same HUD frame (ore 1234, ice 56 +5, crystal 7, lens 12, plating 3, ships 12/4/2, fleet 19/24) at 375x667 on both builds.
- `.chip b { text-align: right }` inside a four-digit reserve pushes short counts to the far edge of their box, against the next chip's icon.
- At 375 portrait the bar now reads "[ice] … 56 [crystal] … 7 [lens] 12 [plating] … 3". The "56" sits beside the crystal icon and the "7" beside the lens icon. At a glance, 56 reads as crystal and 7 as lens. On main every count hugs its own icon.
- The ship row has the same problem, to a lesser degree.
- The overworld stockpile chip has it too: the ore "0" now floats about 25 px from its icon, because of the `'+000.0/min'` pad. The overworld top row is paused and never oscillated, so it changed without cause.
- In landscape the counts are flush right across the 132 px column, far from their icons.

The bar is stable now but harder to read. That is a player-facing regression in the most-read part of the screen. I would not want the owner playing it tonight.

**Phone landscape (pre-existing, slightly worse).** At 667x375 with this fullest HUD, chips sit under `#controls` on main already: plating, drone, lancer, flak and fleet have bottoms 15 to 123 px below the controls' top. On the branch the taller crystal chip pushes each of them 8 px further. The new landscape test can't see this, because it only compares each frame with frame 0. I don't block on the pre-existing part (note 1), but required change 3 keeps the branch from adding to it.

**Code quality.** The hook is small and follows the existing `debug*` pattern. The test is clear and its walks are well chosen. Two smaller issues:
- The `--num-pad` caps ("ships and fleet capped near 60") are derived from current data, and h6-sim's relay-driven `fleetCap` may change them. Wider counts still grow the chip once, which the spec allows, so this is acceptable.
- There is no DECISIONS entry. The sizer technique, the per-chip caps and the 84→66 px ORE/MIN width on phones are non-obvious choices.

Pillar fit: a client-only layout fix, with no sim, data or determinism impact and no change to how the game plays. The only feel change is the readability regression above.

Gates: all six passed locally on 36f414e. Smoke: 149/150, with the one failure a pre-existing flake reproduced on main.

Required changes:
- [ ] 1. Keep each count attached to its own icon. Left-align the count inside its reserved room, or reserve the room some other way that keeps the text next to the icon. Then the gap between a chip's icon and its count text is the same for every value, and always smaller than the gap to the next chip. This applies to the area HUD in all three layouts and to the overworld stockpile chips.
- [ ] 2. Add an assertion to `hud-stability.spec.ts`, in every frame and every layout: the count text's rendered left edge, measured with a `Range` over the `<b>`'s text rather than the `<b>` box, is within 8 px of its icon's right edge. Show that it fails on 36f414e and passes after the fix.
- [ ] 3. In landscape 667x375 with the test's fullest HUD, no chip may end lower (relative to `#controls`' top) than it does on f8fabe3. Report the measured bottoms for both builds in the next round.
- [ ] 4. Add a short `DECISIONS.md` entry covering the sizer approach, the per-chip pad caps and where they come from, and the phone width trims.

Notes for the Director (not blocking this task):
1. New bug: on a phone in landscape (667x375), the in-area HUD's ship chips, fleet chip and plating render underneath the control buttons whenever the HUD is full, on main today. File it as its own task. Its test should assert that no visible chip overlaps `#controls` in the column layout.
2. New flake: `boot.spec.ts` "a held area cannot be landed on" [phone] fails intermittently on main under parallel load, because the tap on area 3 hits `#hint-text`. File it alongside cw-flaky-test.

This is round 1.

VERDICT: REJECT

## Round 2 · 2026-11-08

I reviewed commit 27825f7 against 36f414e and main (f8fabe3), in clean detached worktrees, each build served on its own port. 27825f7 touches only `style.css`, `hud-stability.spec.ts` and `DECISIONS.md`.

**The rework.**
- All of the H6 chip rules are now scoped to `#chips`, so the overworld stockpile chips are back to main's layout. I checked this in a screenshot: the ore "0" hugs its icon again.
- Counts are left-aligned inside their reserved room.
- The icon column is `max-content`, so the spanning rate line can't widen it.
- In the column layouts (landscape and desktop), the rate sits beside the count, so each chip is one 24 px row.

**Gates:** `npm run gates -- --base main` on 27825f7 passed all six (typecheck, lint, test, determinism, bots, protected-files). `npm run build` passed.

**Smoke:**
- Full suite on 27825f7: 150/150. The round-1 flake didn't recur this run, and it is filed in BACKLOG in any case.
- `hud-stability.spec.ts --repeat-each 5`, both projects: 30/30.

**Required changes from round 1:**
1. **Counts beside their icons: done.** At 375 portrait, landscape 667x375 and desktop, every count sits next to its own icon. The 375 bar now reads "[ice] 56 +5 · [crystal] 7 · [lens] 12 · [plating] 3", with no ambiguity about which count belongs to which icon. The ship row reads the same way.
2. **Icon-gap assertion: done.** The test measures a `Range` over each `<b>`'s text and requires it to start within 8 px of the icon, in every frame and layout. I ran the round-2 spec against a 36f414e build myself. It fails with "chip-ore: its count starts 32.3 px from its icon" and "chip-crystal … 12.8 px", and passes on 27825f7.
3. **Landscape no lower than main: done.** The test pins each chip's bottom (relative to `#controls`' top) to main's values in main's shortest state, with no rates showing, which is the stricter baseline. The chips are no lower than on main. The pre-existing overlap with the buttons is filed in BACKLOG (line 656, h6-client).
4. **DECISIONS entry: done.** It covers the cause, the sizer technique, the per-chip caps and their data sources, the phone trims, the one-row column chips and the untouched overworld.

All acceptance criteria from round 1 still hold:
- AC1–5: the same walks, frames and layouts, with the two new assertions added.
- AC6: the test fails on main (round 1), passes `--repeat-each 5` on both projects, and gates pass.
- I did not check branch CI.

**Code quality.** The CSS is tighter than in round 1: scoped, commented, and with no dead rules left (the overworld `--rate-pad` and the fleet `text-align` override are gone). One smaller issue, not blocking: the main baseline in the test (`MAIN_LANDSCAPE_BOTTOMS`) is a snapshot. When h6-client fixes the landscape overlap, it should replace that snapshot with a no-overlap assertion, not just edit the numbers.

Pillar fit: a client-only layout fix with no sim, data or determinism impact. The top bar holds still and reads as well as on main. I'm comfortable with the owner playing this.

Gates: all six passed locally on 27825f7. Smoke: 150/150.

Required changes:
- none

This is round 2.

VERDICT: APPROVE

## Round 3 · 2026-11-08

**Why there is a round 3.** After my round-2 approval, `main` was merged into the branch (d8b8d7b, then 91dab72). Linux CI on 91dab72 failed `boot.spec.ts:129` ("overworld: tap an area for its sheet; a held area cannot be landed on") on the phone project, on both the first attempt and its retry. The engineer then changed only that test, in a4e791f. The question for this round is whether that change fixes the cause or hides a real problem with player taps.

**The cause, measured on main (4d39f98).** Before the tap on Spore Veil, the test opens Landfall's sheet. That pans the map up about 290 px so Landfall clears the sheet. Positions of the six areas, settled 1 s after the tap:

| Viewport | Map top | Positions after the pan (y) |
| --- | --- | --- |
| Pixel 7 (412x839) | 149 | Veil and Garden at 128, The Deep at −29 |
| 375x667 | 149 | Veil and Garden at 78, The Deep at −48 |
| 390x844 | 149 | Veil and Garden at 154, The Deep at 8 |
| 430x932 | 149 | Veil and Garden at 203, The Deep at 38 |

So on two of these phones, once the pan settles, Veil is above the canvas (under the top bar and the hint strip). The old test tapped wherever `areaScreenPos` said Veil was:
- If the tap came before the pan finished (Veil at 331 at +0 ms, 144 at +100 ms), it hit Veil and passed.
- If it came after, it hit `#hint-text` and failed.

That timing race is why the test failed 2/5 on main under parallel load in round 1. Today I ran the old test 20 times on each project with 6 workers on main: it failed 10 of 40. It is also why it failed twice in a row on the Linux runner. Nothing on this branch caused it: the top-bar change only touches `#chips` in an area, never the overworld, and I measured identical positions on main.

**The change.**
- `tapArea` now waits until the area's position stops moving.
- It then asserts the area is on the visible map (`y > #view.top`), so an unreachable target now fails loudly instead of mis-tapping.
- The test closes Landfall's sheet (one tap on empty map, which pans back) before tapping Veil.

This fixes the cause, the race, and makes `tapArea` stricter for every caller.

**Does it hide a real player tap problem? No.** The tap lands on whatever is drawn under the finger. Veil is simply not on screen while Landfall's sheet is open on those phones, so a player can't see it to tap it, and nothing is mis-hit. Sheet switching (tapping another visible area with a sheet open) is still tested at 375x667 (Landfall to Frost Shelf, `boot.spec.ts` around line 812). What is real, and pre-existing, is that the "pan so the selected area clears the sheet" behaviour can hide the far areas while a sheet is open on a phone. That is a design property of the H5 overworld, not this task's bug. h6-client replaces that map with a pannable overworld, and BACKLOG already sends this test to h6-client for rewriting. See the note below.

**Checks (clean detached worktrees, private ports):**
- Gates on a4e791f: `npm run gates -- --base main` passed all six. Build passed.
- The changed test, 20 runs on each project with 6 workers: 40/40 passed. The old test on main under the same load failed 10/40.
- Full smoke on a4e791f: 150/150.
- Branch CI on a4e791f: success (GitHub Actions, completed).
- The round-2 HUD work is unchanged by the merges. Against its merge base with main, the branch changes only the round-2 files (`style.css`, `main.ts`, `env.d.ts`, `hud-stability.spec.ts`, `DECISIONS.md`, this review) plus `boot.spec.ts`.

Pillar fit: unchanged from round 2. This round adds a test-only fix and no player-facing change.

Gates: all six passed locally on a4e791f. Smoke: 150/150. Branch CI: green.

Required changes:
- none

Note for the Director (not blocking): when h6-client builds the pannable overworld, make sure a player with an area's sheet open on a phone can still see the other areas, or reach them without closing the sheet. Today, opening Landfall's sheet at 375x667 pans Veil, Garden and The Deep off the top of the map.

This is round 3. It is an approval, so the third-rejection parking rule in PROCESS.md does not apply.

VERDICT: APPROVE
