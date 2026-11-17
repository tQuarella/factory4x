# h10-client review

## Round 1 · 2026-11-17 (the final round, at the top of the stack)

Reviewed `task/h10-client` at 735503a against:
- BACKLOG.md "### h10-client";
- DESIGN.md H10 "The auto-slowdown (S1–S6)", "Client: phone UI (H10)" and "Tunables (H10)".

This is the first review of h10-client. The stack is complete: the branch contains the approving review commits of h10-sim (98fbf86), h10-bots (8118a5d) and h10-design-data (c192566), and `main` up to cc7462d. So it runs on the final data, v18 with `hive.rebuildTicks` 600.

**Pillar fit.** Everything here is readout and speed, and nothing changes the rules.
- The slowdown is client session state. It never reaches the sim, the replay or a save, and `client.raidSlowdown` is a device setting.
- The readouts serve the H10 claim directly:
  - the hive count on its sheet and map label;
  - "Hive −N" in the raid report;
  - "Hive n / cap" after a push;
  - the two loss totals in the result panel.

  Each one tells the player the hive is wearing down. None of them goes beyond the spec.

**Gates and smoke, run by me on 735503a:**
- `npm run gates -- --base main`: all PASS.

  | Gate | Time |
  | --- | --- |
  | typecheck | 6.8 s |
  | lint | 4.1 s |
  | test | 49.8 s |
  | determinism (final ea89d755) | 0.7 s |
  | bots | 69.9 s |
  | protected-files | 0.6 s |

- `npm run build`, then the full smoke suite on both projects: **342 passed** (1.3 min).
- `h10-hive.spec.ts` and `h10-slowdown.spec.ts` with `--repeat-each 5`: **200 passed**, so no flake.
- Branch CI on the previous head a68e82c (run 44185757060): gates job 8m05s of 20 and deploy job 6m04s of 15, both about 40% of their limits. The CI run on 735503a was still in progress when I reviewed it. The merge run must be on the commit that carries this review (PROCESS "Before merging").

**Acceptance.**
1. **S1–S6: met.** `slowdown.ts` is a small state machine stepped once per frame, and after every tick of `advanceTicks`. Unit tests (h10-slowdown.test.ts) cover:
   - engaging above 1x, and at 1x with nothing remembered;
   - engaging while paused, without touching pause;
   - one engage per id, and an engage on load mid-raid;
   - restoring when every outcome is decided, on no raid (a cancelled muster or a wither), and on a changed id;
   - a speed tap that clears the restore with no re-engage;
   - pause and the tuning panel not counting as speed changes;
   - off at 0, and a new world forgetting everything.

   The toast carries the real speed. The smoke tests at 4x cover a beaten prong, a cancelled and re-mustered raid, a turned-back raid, a speed tap, pause, a reload and a split raid. They step the sim and never wait in real time. The Director's ruling that the engage note is never lost is built, and the cancelled-muster smoke test asserts it.
2. **The hive sheet: met.**
   - It reads "Guards n / cap · +1 Type in N s" in game seconds, counts down, and ends at "Guards 30 / 30".
   - The per-type regrow text and bars are hidden while the rebuild queue runs.
   - The line is absent at `hive.rebuildTicks` 0.
   - The sheet fits 375x667 with the wide font (smoke).
3. **The map label: met.**
   - "HIVE 18/30" shows only below the caps.
   - It is placed inside the map, clear of every other label and of the hive ring. A smoke test asserts this at phone size with the sheet open and closed, and on desktop.
   - The extra placements beside the hive came from a real clash found by the shipped-data test, and they are logged.
4. **Reports: met.**
   - "Hive −N" (with a no-break space) is the sum of `hiveLost` in the raid report toast.
   - "Hive n / cap" ends the battle report of a lost or withdrawn push at the hive.
   - The result panel lists `fieldSummary.hive`'s two totals.
   - **Reading, accepted:** a winning push's report stays "Hive taken: …" without "Hive 0 / 30", since the hive is gone. I read the spec's "win or lose" as the wave's outcomes that leave a hive to count.
5. **The roll banner: met.**
   - "A5 hit → A6" shows while a prong flies on after a roll, unit-tested and in a smoke test at `raid.rollMax` 1.
   - The badge moves on the roll tick, and the HUD doesn't move.
   - With no roll, the line is H9's exactly.
6. **Tuning: met.**
   - `client.raidSlowdown` is a client key, stored in settings and tagged "this device".
   - `hive.rebuildTicks` and `raid.rollMax` are listed.
   - `hive.regrowPct` reads "used only when Hive rebuild is 0". This closes the item deferred from h10-sim.
   - The panel shows the shipped 600.
7. **Fit and stability: met.** The sheet fits 375x667 under the wide-font stress. The toast and the roll segment are measured to shift nothing in the HUD, and the label lives inside the map.
8. **Smoke time: met.** The new smoke tests step the sim. CI headroom is about 40% on both jobs, well under 80%.
9. **The stack: met.** The lower approvals are merged. Gates and the full smoke pass on the final data at both sizes, and the H10 specs pass five times over. Branch CI green on the exact merged commit is the Director's step before `merge-task`.

**Determinism.** There is no sim change in this task, and the slowdown never enters the world. The determinism final is ea89d755, unchanged from h10-design-data.

**Quality.**
- The code is clear and small, and every number comes from a sim selector.
- The test hooks (`hiveLabel`, `nodeLabels`, `hiveStatus`) follow the existing pattern.
- Non-blocking nits:
  - `applySlowdown` tests `act.toast !== undefined` twice in a row.
  - The result panel's labels "Hive −, raiders killed at rocks" and "Hive −, guards killed in pushes" read awkwardly. "Hive guards lost to raids" and "… to pushes" would be plainer. That is a copy tweak for a later touch, not a defect.

**For the Director:**
- Push this review commit and wait for CI on it before `merge-task h10-client`, which lands the whole H10 stack (v18).
- The handoff notes from h10-design-data's review still stand:
  - adaptive-concentrate is now the fastest strategy that faces raids, by 1%;
  - greedy finishes level with adaptive;
  - the bots at `hive.rebuildTicks` 0 don't count R9's regrowth during a wave's flight.

Required changes: none.

VERDICT: APPROVE
