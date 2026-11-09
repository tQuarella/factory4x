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
