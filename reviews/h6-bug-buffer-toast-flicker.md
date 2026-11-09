# Review: h6-bug-buffer-toast-flicker

## Round 1 · 2026-11-08

I reviewed `task/h6-bug-buffer-toast-flicker` at 3d85d58. It is d869e14 (the fix) merged with the top-bar branch at 27825f7, so its own change is `git diff 27825f7 3d85d58`:
- `report.ts`: a new `isBackedUp` helper.
- `sheet.ts` and `view.ts`: use the helper.
- `style.css`: the warning reserves its room.
- `tests/smoke/buffer-warning.spec.ts`: new.

`report.ts` is outside the task's file list. It is a client file and a reasonable shared home for a helper used by both `sheet.ts` and `view.ts`, but the deviation should be recorded (see required change 5). Nothing in `packages/sim` changed. I checked everything in clean detached worktrees, each build served on its own port.

**The fix.** `isBackedUp(world, node, st)` replaces `nodeStatus(...).backedUp` in the sheet's warning, the buffer bar's `full` class, the map's "!" badge and the dashed route. It is a latch, kept per world object in a `WeakMap`:
- off with no extractors;
- the sim's own flag when there is no route (that flag is steady there, because nothing drains the buffer);
- off as soon as `extractPerMinX10 <= capacityPerMin × 10`;
- on when the buffer is full;
- off again only when the buffer falls below half.

The logic is sound:
- `capacityPerMin` is floored, which can only make the client show "backed up" a little early, and only once the buffer is actually full.
- A route that can carry the extraction clears the warning at once.
- The latch is display-only client state. It never feeds the sim, so determinism is unaffected.
- The sheet now reserves the warning's room with a hidden sizer (the longest message) and toggles `visibility`. Showing or clearing the warning moves nothing.

**Gates:** `npm run gates -- --base main` on 3d85d58 passed all six (typecheck, lint, test, determinism, bots, protected-files). `npm run build` passed.

**Smoke:**
- Full suite on 3d85d58: 154/154.
- `buffer-warning.spec.ts --repeat-each 5`, both projects: 20/20 (4.1 min).
- **Fails on main:** I put only the new spec onto f8fabe3 and ran it. It fails at frame 16 with "the warning is not showing" and the action buttons jumping 63 px (`BUTTON5 moved 12,611 -> 12,548`). The test catches the bug.

**My own check at 375x667.** I backed up a1 at 4x and then upgraded the route.
- The warning came on, and the buttons kept their y relative to the sheet (598/648/698) before and while it showed.
- After the upgrade, the warning cleared and stayed cleared for 10 s of samples at 4x.
- The screenshots look right. With no warning, the sheet carries a blank gap of about 50 px above the buttons, which is the reserved room the spec asked for.

**Acceptance criteria.** Steps 1, 2 and the first half of 3 are shown by the test. Four parts the task spec asks for are not:
1. AC1 asks for the sheet held open "for at least 10 game seconds **at 1x and again at 4x**". The test only runs at 4x (20 s wall, about 80 game seconds). There is no 1x run.
2. AC2: "the **map badge and the dashed backed-up route** don't blink". Nothing in the test samples the map. The badge and the route do use the same latch, so I expect them to be steady, but the AC needs a test that shows it.
3. AC3: "clears within 2 game seconds **and stays cleared**. Clearing it doesn't move the buttons either." The test checks the clear (≤ 60 ticks after L2 shows). It checks neither that the warning stays cleared afterwards nor that the buttons hold their position across the clear. My probe suggests both hold, but the test must show it.
4. AC4: "The no-route warning still works." No test anywhere exercises the "No route: … goes nowhere" or "Backed up: no route" text. This change rewrote how that text is shown (sizer, `.msg`, `idle`), so it needs coverage.

There is also no DECISIONS entry. The latch rule (on at full, off below half or when the route covers extraction), the client-side placement (chosen to avoid colliding with h6-sim) and the reserved-room approach are all non-obvious.

**Code quality.** Clear and small. The `WeakMap` keyed by world identity is a tidy way to drop the latch when a new world loads. Two small observations, not required:
- The sizer text hardcodes "crystal" as the longest prize name. That holds today, but a comment saying why would help whoever adds a resource.
- The upgrade-clear check takes t0 after "L2/5" has appeared, so it measures from build completion, not from the tap. That matches the AC wording.

Pillar fit: a client-only fix, with no change to how the game plays. The warning now tells the player one steady thing.

Gates: all six passed locally on 3d85d58. Smoke: 154/154, and the new spec passes 20/20 with `--repeat-each 5`.

Required changes:
- [ ] 1. Add a 1x run: the sheet held open with the warning shown for at least 10 game seconds at 1x, with the same no-hidden-frame and no-movement checks (AC1). It can be shorter than the 4x run, but must cover at least two pod departures from the full buffer.
- [ ] 2. Assert in the same frames that the map's "!" badge and the dashed backed-up route for a1 stay on in every frame (AC2). A small dev hook that reports what `MapView` drew for a node is fine (`isBackedUp` as the view called it, for example), as long as it reads what the renderer used, not a recomputation.
- [ ] 3. After the clear, keep sampling for at least 10 game seconds. Assert that the warning stays hidden, the badge and the dashed route stay off, and every sheet button keeps its position within 1 px of where it was while the warning showed (AC3). Measure relative to the sheet (or pin `scrollTop`), because the "Upgrade route" click scrolls the sheet.
- [ ] 4. Test the no-route warning (AC4). An asteroid with an extractor and no route shows "No route: this <prize> goes nowhere. Build a route.", and once its buffer fills it shows "Backed up: no route. Build one." steadily. Neither state moves the buttons.
- [ ] 5. Add a `DECISIONS.md` entry for the latch rule and its thresholds, why it lives in the client (`report.ts`, outside the listed files) rather than in a sim selector, and the reserved-room approach.
- [ ] 6. Show that the new tests still fail on main (f8fabe3), and pass `--repeat-each 5` on both projects.

This is round 1.

VERDICT: REJECT

## Round 2 · 2026-11-08

I reviewed head 65bb543. The rework is d5ec75a. After it come two merges, which bring in main (e6b7f61) and the top-bar branch's area-tap test fix (a4e791f; I approved that separately in its round 3). The fix code from round 1 (`isBackedUp`, the sheet's reserved warning room) is unchanged. d5ec75a adds:
- a `drawn` record in `MapView`, cleared at the start of each frame and filled when the "!" badge or the dashed backed-up route is actually drawn, exposed as the `mapBackedUp` dev hook;
- a rewritten `buffer-warning.spec.ts`;
- a DECISIONS entry.

**Required changes from round 1:**
1. **A 1x run: done.** "375 px portrait, wide font, 1x" uses a pod every 150 ticks at 40/min, so the buffer sits at its cap with pods leaving. The test samples every frame for 15 game seconds (three pod departures) with the same checks.
2. **The map badge and route: done.** Every sample reads `mapBackedUp(a1)`, which reports what the renderer drew in its last frame rather than a recomputation. Every frame must show both the badge and the dashed route.
3. **Stays cleared, and nothing moves: done.** After the upgrade, the test samples 10 more game seconds and checks that the warning, badge and route stay off. Every sheet box is compared with its place before any warning, measured from the sheet's own top minus `scrollTop`, so the upgrade click's scroll can't hide a shift.
4. **No-route warnings: done.** A new test builds an extractor with no route. It checks that "No route: this ore goes nowhere. Build a route." holds for 5 game seconds with the badge on and no dashed route, then that "Backed up: no route. Build one." holds for 5 game seconds, with nothing moving in either state.
5. **DECISIONS: done.** The entry covers the cause, the latch thresholds and why half is safe, why the fix lives in the client and in `report.ts` (and that the Director accepted that deviation), the reserved room and its cost, and the tests.
6. **Fails without the fix, passes repeated: done, and I checked it myself.**
   - Round 1 already showed the sheet test failing on main (the warning hidden at frame 16, the buttons jumping 63 px).
   - The new map assertions need the new hook, which doesn't exist on main. So I built 65bb543 with a one-line change making `isBackedUp` return the sim's `st.backedUp` (no latch). All three backed-up tests fail, including the 1x one: "frame 7: warning is hidden", "map "!" badge not drawn", "dashed route not drawn".
   - The no-route test passes on that build too, as it should, because the sim's flag is already steady without a route. That test guards the reserved room and the text.
   - With the fix: `buffer-warning.spec.ts --repeat-each 5`, both projects: 40/40.

**Gates (clean detached worktree, private port):** `npm run gates -- --base main` on 65bb543 passed all six (typecheck, lint, test, determinism, bots, protected-files). Build passed. Full smoke: 158/158. Branch CI on 65bb543 was still running when I wrote this, so it is not checked here.

**Code quality.** The `drawn` record is two sets cleared once per frame, with negligible cost, and it reads exactly what was drawn, which is what the test needs. The test is well organised: one `record` and one `check` serve all four scenarios, the tunables are chosen and explained per speed, and failures name the frame and the element. My round-1 observation about the sizer hardcoding "crystal" is now recorded in DECISIONS.

Pillar fit: a client-only fix with no sim, data or determinism change. The warning, badge and route now tell the player one steady thing, and the sheet's buttons don't move under their thumb. I'm comfortable with the owner playing this.

Gates: all six passed locally on 65bb543. Smoke: 158/158, and the new spec passes 40/40 with `--repeat-each 5`. Branch CI was in progress when I wrote this.

Required changes:
- none

This is round 2.

VERDICT: APPROVE
