# cw-smoke-sim-time

## Round 1 · 2026-11-14

Reviewed head c199647 on `task/cw-smoke-sim-time`.

Pillar fit: test-only change (`tests/smoke/**`). No sim, client, data or replay change, so no effect on play or feel and no `dataVersion` question. It unblocks H8 browser work by taking CI out of the danger zone.

Quality:
- New `stepSimUntil` in `tests/smoke/helpers.ts` steps the sim 30 ticks at a time via the existing `advanceTicks` hook up to a tick cap, then resumes play through the real `#b-pause` button only if the game was running when called, and asserts it resumed. Pausing is client-only (`session.paused`, not an input), so `replayMatchesLive` checks after a step stay valid. Speed is untouched by pause, so a 1x or 4x test resumes at the same speed.
- Every original assertion stays in place after its step: I checked each hunk in boot, buffer-warning, overworld and h7-economy. Nothing is loosened. The flicker tests in `buffer-warning.spec.ts` still sample every frame in real play, because the helper resumes before `record`. Only the wait to reach the backed-up state is stepped.
- `resume = false` is used once, in `landfallRun`, where the wait ends on the result panel. That is correct: nothing after it needs a running game, and landing resets `paused`.
- `reclaimRime` loop: the first attack goes in while running, and later presses go in while paused (one tick each). The loop's exit condition and the final `#result` assertion are unchanged.
- h7-economy top-bar test: `setSpeed(4)` and the 400 ms sleeps are replaced by 48-tick steps plus `settled`. All 12 samples are now taken paused. The comparison is still like-for-like, because every sample is in the same state and the fleet and ore chips still change between samples.
- The h7-art gallery wait is left as it is. It waits on dev-page drawing, not sim time, so `advanceTicks` cannot replace it. The commit message says why. This is reasonable, but it departs from the task's file list. A future speed-up there belongs in the gallery itself.
- Remaining `waitForTimeout` calls are short settle waits (≤600 ms) or the deliberate "nothing ticks on the overworld" check. The task said settle waits stay.
- Minor, not blocking: `h7-economy.spec.ts` keeps its own `stepUntil`, which now duplicates `stepSimUntil`. The `stepSimUntil` doc comment has one over-long line. The original `expect.poll(..., 30_000)` calls after each step are now near-instant re-checks. They are kept on purpose so no assertion is removed.

Acceptance:
- No assertion loosened, no test dropped: per-hunk review above. The CI smoke count is 232 on both main (run 43643887738) and this branch (run 43645327666).
- Full smoke `--repeat-each 5` green: I ran the four changed specs locally with `--repeat-each 5` and no retries. Result: 1080 passed (3.8 min), desktop and phone. CI on the exact head c199647 ran the full suite twice (gates and live deploy): 232 passed each time, with none marked flaky.
- CI gates job under 14 min: run 43645327666 gates job took 12 min 3 s (main baseline 43643887738: 15 min 53 s). The smoke step went from 11.3 min to 6.5 min.
- CI deploy job under 11 min: the same run's deploy job took 8 min 34 s (baseline 12 min 48 s). The live smoke went from 11.4 min to 6.8 min.

Determinism: no sim code touched; determinism gate passes.
Phone: the phone project and the 375 px tests pass; no UI change.
Protected files: none touched (protected-files gate passes).

Gates: `npm run gates -- --base main` run by me on c199647: typecheck, lint, test, determinism, bots and protected-files all PASS.

Required changes:
- None.

Notes for the Director (not blocking): log the h7-art exception in DECISIONS.md when you record the merge. Folding `h7-economy`'s `stepUntil` into the shared helper is a small Can-wait cleanup.

VERDICT: APPROVE
