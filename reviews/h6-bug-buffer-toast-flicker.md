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
