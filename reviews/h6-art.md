# h6-art

## Round 1 · 2026-11-08

Scope: `git diff main...task/h6-art` (c99543f), one commit on top of f8fabe3. It touches `placeholders.ts`, `gallery.ts`, `ART_STYLE.md` and a new `packages/client/test/h6-art.test.ts`. `palette.ts` and `icons.ts` are unchanged. Every file is inside the task's file list, and no protected file is touched. I checked it against BACKLOG "h6-art" and DESIGN.md "Art needs (H6)", "Client: screens and phone UI (H6)" and "Areas (H6)".

**Gates (run by me on the branch):** `npm run gates -- --base main` passes: typecheck, lint, test (palette sync included), determinism, bots and protected-files.

**Gallery (loaded by me in Chromium via the Vite dev server, no console errors):** I looked at the H6 24 px strips in colour and greyscale and at every new 24/48/96 entry. Pixel-scan bounds: relay 0.877 r, lock 0.721 r.

**Acceptance:**
1. **Met: draw contract.**
   - `drawRelayIcon(ctx, r)` and `drawLockBadge(ctx, r)` exist.
   - `AreaNodeState` gains `'far'`.
   - `drawLane(..., mode = 'normal', reveal = 100)` takes `LaneMode` `'dim' | 'normal' | 'reveal'`, and reveal is clamped to 0..100.
   - The existing `worldview.ts` callers are unchanged and still type-check. A test asserts the old 7-argument `drawLane` call records exactly the same geometry as `'normal', 100`.
   - The band pill and divider are extras the spec asked for in prose, and they're fine.
2. **Partly met: gallery.** Each new draw is shown at 24 px and larger, beside the area node, the fleet icon and the "!" badge. The relay reads as a blue broadcast mast, distinct from the fleet brackets. The lock is a grey padlock with an amber hoop, distinct from the round amber "!" by shape and in greyscale. Far is a ring of hollow outlines, distinct from locked by shape. Two problems remain, both in the guidance that h6-client will build from (see required changes 1 and 2), plus a layout clip in the 24 px strip (required change 3).
3. **Met: within r, palette.** The recording-context test checks the relay and lock at r = 50 and r = 12, all four node states across tiers and `t`, and every lane mode, including out-of-range reveal values, within 4 px of its segment. No new colours, so there's no palette key to add.
4. **Met: gates.**

**Determinism / data.** Client draw code only. There are no tunables and no sim changes.

**Tests.** The tests are meaningful, not padding. They check bounds, the colour rules (no amber or pink in the relay, no amber in far), that dim lanes have no pulses, and that reveal keeps its pulses and spark inside the revealed length.

**Why I'm rejecting.** The draw functions are good. What's wrong is the caller guidance in ART_STYLE.md, which the gallery reinforces. It would make the H6 overworld show the player the wrong things, and h6-client is told to build from it. The core of H6 is choosing which area to go for next, and the ice-vs-crystal cue on each node is part of that choice.

**Required changes:**
1. **A relay node must still show what it hauls.** ART_STYLE "Callers" says "the relay icon replaces the prize icon". All four relays have a side and a haul: Rime and Mire are ice, Glint and Spire are crystal (`prizeOf` returns ice or crystal for them). Repeat hauls decay by side, so the node's ice/crystal cue matters most on exactly these nodes. Replacing it hides that on 4 of 10 nodes, and the spec doesn't ask for that ("Relays wear the relay icon in every state").
   - Change the guidance so the relay icon is added, not substituted. For example, a corner mark on the upper left (the lock owns the upper right), or the relay in the centre with the prize icon still visible.
   - Show it in the gallery: a relay node in the reclaimed, open, locked+lock and far states, at 24 px and at the overworld size (r ≥ 22 px).
   - Check that the relay mark and the lock badge don't collide on a locked relay, the common band-2 case.
2. **Say what a far node's centre shows, consistent with the spec.** The spec's far sheet shows only "Unscouted…", the band and the relay kind, with no haul. The gallery's "open / locked+lock / far" entry instead draws a far node with a full-brightness ore icon in its centre. That breaks the spec's "dim, desaturated" and shows a haul the sheet withholds. ART_STYLE says only "the centre icon is the caller's".
   - State the rule in ART_STYLE "Callers". My reading: no prize icon on a far node, and on a far relay only the relay mark, dimmed to the node's alpha.
   - Make the gallery's far examples follow that rule.
3. **Fix the clipped lane in the H6 24 px strip.** The 15th item, the `reveal` lane, wraps to a third row at x = 14 and starts at x = −6. Its left end is off the canvas, so the reveal mode isn't fully shown at 24 px. Lay the strip out so every item is fully on the canvas, for example by putting the three lane modes in a row of their own.

**Non-blocking notes:**
- The lock body reuses `plating` (#a8b3c7), which is also the plating resource icon's colour. The shapes differ (padlock vs stacked diamonds), so it's acceptable. If a locked plating-prize node ever looks muddled at real size, a neutral grey key would separate them.
- With the gallery's placement (badge r = 0.42 node r, centred at (0.7r, −0.7r)), the lock reaches about 1.3 node r diagonally, outside the node's circle. That's fine for a badge, but h6-client should keep it clear of the name labels and the selection ring at r + 6.

This is round 1.

VERDICT: REJECT

## Round 2 · 2026-11-08

Scope: `git diff 525d810 cf6da1b` (one commit on top of round 1). It touches `placeholders.ts`, which adds `drawRelayMark`, plus `gallery.ts`, `ART_STYLE.md` and `h6-art.test.ts`. All are inside the task's file list, and no protected file is touched.

**Gates (run by me on cf6da1b):** `npm run gates -- --base main` passes: typecheck, lint, test, determinism, bots and protected-files.

**Gallery:** the engineer didn't re-screenshot after the layout change, so I did. I loaded `gallery.html` in Chromium on cf6da1b and inspected the H6 strips (colour and greyscale), the four relay-node entries, the plain-node entry and the lane modes. There were no console errors.

**Round 1 required changes:**
1. **Met in code and gallery: a relay node keeps its haul.** `drawRelayMark` puts the relay icon on a dark disc at the node's upper left, and the prize icon stays in the centre. At 48 and 96 px the reclaimed relay reads "ice, amber rim, beacon top-left", and the open one reads "crystal, dashed ring, beacon". On a locked relay the mark and the lock sit on opposite corners. A new test checks they don't overlap at node r = 12, 22 and 50.
2. **Met in code and gallery: the far node centre.** The far examples show no prize. The far relay shows only the mark at 0.5 alpha, and ART_STYLE now states the rule.
3. **Met: the strip layout.** The three lane modes have their own row, and all three are fully on the canvas, in colour and in greyscale.

**New problems (all small, but they're in the contract h6-client builds from):**
- **ART_STYLE.md contradicts itself in three places.** Round 1 rejected the caller guidance specifically, so this has to be consistent.
  - Line 177 (Lock badge row) still says the badge is "drawn about 0.42 of the node's r". The new Callers rule (line 188) says `drawLockBadge(ctx, 0.5 * r)`.
  - Line 185 ("Relay is told apart") still says "A reclaimed node with the relay icon in the centre reads as 'amber rim, blue beacon'". The new rule puts the mark at the upper left and never in the centre.
  - Line 190 says both marks "reach about 1.3 of the node's r diagonally". At the new size, the relay mark's disc (centre (−0.7r, −0.7r), radius 0.5r) reaches about 1.49r from the node centre. The caller needs the right figure to keep labels and the selection ring clear.
- **`drawRelayMark` is over its bound by the gallery's own pixel check.** The gallery reports "relay mark: 1.024 r" against its stated limit of 1.002 r (antialiasing included). Every other entity is at or under the limit. The backing disc is filled at exactly r, so the antialiased edge spills past it. The recording test passes only because it measures exact geometry. ART_STYLE says it "stays within its own r", and acceptance 3 is "each stays within r".

**Required changes:**
1. In ART_STYLE.md line 177, change "about 0.42 of the node's r" to match the Callers rule (0.5).
2. In ART_STYLE.md line 185, replace the "relay icon in the centre" sentence with the corner-mark reading. For example: "a reclaimed relay reads as amber rim, haul icon in the centre, blue beacon at the upper left."
3. In ART_STYLE.md line 190, correct the reach to the real figure (about 1.5 of the node's r for the relay mark), or shrink or move the marks so the stated figure is true.
4. Bring `drawRelayMark` within the gallery's 1.002 r pixel limit, for example by filling the backing disc at about 0.96r. Show the gallery's "relay mark:" bounds line at or under 1.002 r.

**Unchanged from round 1:** determinism, data and tests are fine. The new non-overlap test is meaningful. At the overworld size (node r ≥ 22) the mark is about 22 px across, which is readable. At the 24 px node size it's only a tiny glyph, but no real node is drawn that small.

The next round on this task would be the third. If these four items aren't all met then, the Director parks it per `PROCESS.md`.

VERDICT: REJECT
