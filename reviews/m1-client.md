# Review: m1-client

## Round 1 · 2026-11-06

I reviewed `git diff main...task/m1-client` (commit 5b06972) and read every touched file in full: `main.ts`, `session.ts`, `persist.ts`, `sheet.ts`, `panels.ts`, `feedback.ts`, `view.ts`, `report.ts`, `format.ts`, `fit.ts`, `interp.ts`, `dom.ts`, `style.css`, `index.html`, `test/session.test.ts` and `tests/smoke/boot.spec.ts`. main has moved on since the branch was cut (m1-bots has merged). That is expected, and `git merge-tree` shows the branch still merges cleanly.

I played the built game myself with Playwright, by touch, at 375×812, 375×667, 667×375 and 812×375. I tapped nodes and buttons and used the tuning panel to speed things up. In each session I built extractors and routes on A1, A2, A3 and A5, watched ore/min climb from 0 to 60 with the ▲ arrow, saw the "backed up" warning and upgraded a route. I then sent a 14-ship wave that was repelled, lowered `guardian.cap`, staged ships at A5, attacked with "All" and captured. After that I kept playing, reloaded the page, and sent feedback. The screenshots (`crit-*.png`) are in the session scratchpad.

**Pillar fit.** This is a faithful H1 client, and most of it feels good. Ore/min is the biggest number on screen and visibly climbs. The sparkline and the "Backed up: route at capacity. Upgrade it." warning make the bottleneck obvious, which serves claim 1. The rich sheet's "All 13 ships together: strip 1.3 thorns/s vs Bloom regrows 0.5/s" line, and the repelled toast ("Too few ships to strip all 12 thorns before the wave was lost. Send more at once."), make a failed wave read as a lesson, which serves claim 2 and success criterion 3. Inputs are greyed out through `isValidInput`, and every sheet is built once and updated in place. Pause and the speed controls are client-only. Rendering interpolates ships and pods. Autosave, resume and the version mismatch path are right.

However, the moment H1 is about, the fight and the capture, is hidden behind the client's own overlays. There are also four functional defects, listed below.

**What I verified working:**
- **Taps and targets.** Every action except cancel takes at most 2 taps. No visible control is under 44 px at 375×667, at 375×812 with each sheet open, during a battle, in the tuning panel, or in landscape. There is no horizontal overflow in any of these.
- **Autosave.** Reload resumed at tick 11234 from a save at 11209. The `pagehide` save took the later state, and `replayMatchesLive()` was true after the resume.
- **Battle text.** The battle banner reads "BATTLE · you strip 0.8 thorns/s · Bloom regrows 0.5/s · 6 lost". The rich sheet shows the same plus thorns stripped. The repelled and captured toasts stay until tapped.
- **Result panel.** It shows 5:06, peak 60, 50 built, 25 lost and 3 waves, with "Keep playing" and "New run". "New run" has a confirmation.
- **Captured sheet.** After the capture, the rich sheet turns into a producer sheet with 1/4 extractors and "No route: this ore goes nowhere."
- **Version.** The HUD shows a 7-character sha, and the full version is in the feedback note.
- **Errors.** There were no console errors across all sessions.

**Determinism.**
- The client stays out of sim state. `Date.now()` only seeds a new run, and the map has no RNG.
- The input log records the tick each input was applied. Saves carry the seed and the full log, so a replay after a resume still reproduces the live hash. A unit test and a smoke test show this.
- The cross-engine replay check passes.

**Data.** There are no new sim tunables. `client.autosaveSec` is read from data.

**Tests.** The session, persist, feedback, format, interp, fit and report unit tests are meaningful: they cover replay after a resume, broken storage, the URL length fallback and the report reason. The smoke tests cover every item in acceptance criterion 7.

**Gates.** I ran them on the branch myself:
- `npm run gates -- --base main`: all six passed (typecheck, lint, test, determinism with final hash 35d8f54c, bots, and protected-files with 19 files changed, none protected).
- `npm run build`: passed.
- `npm run smoke`: run 3 times, 16/16 passed each time, in 14.5–15.6 s. I saw no flakiness.

### Required changes

1. **The battle banner and the battle toast cover the Bloom.**
   - **What I saw.** The rich node always sits at the top of the map, and so do `#banner` and `#toast`. At 375×812 and 375×667 with a sheet open, and in landscape, the banner covers the BLOOM label, the thorn ring and the ships-present badge for the whole fight (`crit-11-battle-banner.png`, `crit-26-battle-375x667.png`, `crit-27-battle-landscape-667x375.png`). The capture toast then covers the Bloom as it withers (`crit-15-after-capture-toast.png`). Thorns falling, and the Bloom turning grey, are the payoff H1 claim 2 depends on.
   - **Fix.** Place both overlays so they never overlap the rich node's thorn ring. For example, anchor them to the bottom of the map area, or reserve a top strip in `fitMap`.
   - **Check.** Add a smoke assertion at 375×667 with the rich sheet open: the banner's bounding box does not intersect the circle at `nodeScreenPos(6)` with the thorn-ring radius. Do the same for the toast.
2. **The Retreat button appears where the attack button was.**
   - **What I saw.** On the rich sheet, the battle section (with "Retreat N to Probe") is hidden until ships arrive at the rich node. It then appears above the "Attack from …" buttons and pushes them down about 150 px. "Retreat" lands where "Attack from Probe" just was (compare `crit-10-rich-sheet-before.png` with `crit-11-battle-banner.png`). A player tapping to reinforce just as the first wave arrives pulls the whole wave out, with no confirmation. That breaks success criterion 5 (no mistaps).
   - **Fix.** Either put the battle section and Retreat below the send section, or keep their space reserved so nothing moves under the finger.
   - **Log it.** The Retreat button goes beyond the spec, which only has retreat via the probe or A5 sheet ("From Rich"). It is a reasonable convenience, but log it in `DECISIONS.md`.
3. **Feedback "Send" always reports a blocked tab.**
   - **What I saw.** `window.open(url, '_blank', 'noopener')` returns `null` by spec, even when the tab opens. So the status line always says "Your browser blocked the new tab. Use "Copy note"…", even though the issue tab did open. I saw this in both sessions, and a popup page was created each time (`crit-19-feedback-sent.png`). On the owner's phone this tells them feedback failed when it didn't.
   - **Fix.** Detect a blocked tab correctly. For example, open without the `noopener` feature and set `win.opener = null`, or stop claiming the tab was blocked.
4. **`economy.startStock` is a dead control.**
   - **What I saw.** The panel tags it "new run only", but `newRun()` builds the new run from `defaultData`. I set it to 200, confirmed "New run", and the new run started with 30. The field also reset to 30. Every other tuned value is silently reset by New run too.
   - **Fix.** Either make `startStock` take effect on the next New run in a way the replay and feedback still reproduce (`replayMatchesLive()` true afterwards), or remove it from the panel.
   - **Also.** State in the panel whether other tuning survives New run, so the owner isn't surprised mid-comparison.
5. **"Reset all" sends every tunable.**
   - **What I saw.** It sends `setTunable` for all ~30 sim tunables, including unchanged ones. Each one is logged, and while paused each one steps the sim a tick (`Session.send` → `stepOnce`). This bloats the replay, which pushes feedback onto the clipboard fallback sooner, and makes "pause" advance about a second.
   - **Fix.** Send only the values that differ from their default.
   - **Check.** With one value changed, "Reset all" adds exactly one input to the log.
6. **Log the decisions in `DECISIONS.md`.** The branch makes several non-obvious decisions without logging them:
   - inputs sent while paused step one tick so the screen reflects them;
   - the save format (format 2, with the full log, pending inputs, history and flags);
   - the battle report's "sent" is `shipsEngaged`;
   - `MAX_URL_LENGTH` is 7500, and the clipboard is the fallback;
   - the Retreat button (item 2);
   - New run resets tuning (item 4).
7. **Smoke coverage at 375 px.**
   - **What I saw.** The "phone" project is Pixel 7, which is 412 px wide, so nothing automated checks the 375 px requirement in acceptance criterion 1.
   - **Fix.** Inside `tests/smoke/` (the config is outside this task's files), add a 375×667 `test.use({ viewport })` block that runs at least the load/no-overflow test and the 44 px target test, with a sheet open.
8. **Remove the dead `.confirm` rule** in `style.css`. Nothing uses it.

### Engineer's flags: my rulings

- **Cancel takes 3 taps from the map** (probe → icon → Cancel). The spec asks for exactly this ("a second tap, to prevent mistaps"), so I accept it. The Designer should reword the "at most 2 taps" rule to except confirmations.
- **The extra Retreat button.** I accept it in principle, subject to required changes 2 and 6.
- **"Sent" uses `shipsEngaged`.** I accept it. It counts ships that actually fought, which suits the lesson the report teaches.
- **"All" inflates `wavesSent`.** Confirmed: two attacks, one from the Probe and one "Attack with all" from Probe + A5, produced "Waves sent 3" on the result panel. The client follows the spec ("All" sends one `sendShips` per source), and the sim counts each one. The fix belongs in the sim, by counting one wave per tick per target, so it can't be done in this task's files. Staging at A5 is the designed play, so the owner will usually see an inflated number. The Director should open a sim task and land it before the handoff build.
- **Labels touch the selection ring at 375×667.** Confirmed. With a sheet open, the A5 label sits on the Bloom's thorn ring, and the A1 label is close to A3's pips (`crit-24-probe-sheet-375x667.png`). This is cosmetic and doesn't block the merge.
- **Smoke tests may be timing-flaky.** I didn't see it: 3 of 3 runs passed 16/16. The autosave test reads `savedTick` after `saveNow()`, which would race, but the `pagehide` save on reload masks it. Reading the tick inside the same `evaluate` as `saveNow` would make the test honest. Not required.

### Notes for the Designer (not blocking this task)

- **The yard spends the start stock.** The shipyard starts on and spends 15 of the 30 starting ore on tick 1. The first extractor then sits at "Waiting for ore…" for about 25 s at 1x. Judge this against success criterion 1. The rule is in the sim and design, not in this client.
- **Thorns outside the hit area.** The thorn ring is drawn outside the Bloom's hit radius, so tapping a thorn deselects the node instead of selecting the Bloom.
- **Raw ticks in the tuning panel.** The panel shows raw ticks (`buildTicks 15`). A seconds hint would help the owner tune.
- **First-run hint covers the probe.** At 375×667 the hint banner sits over the probe until it is dismissed.

This is round 1.

VERDICT: REJECT

## Round 2 · 2026-11-06

I reviewed `git diff c235c82..7e7a4c6` and the touched files in full: `session.ts`, `persist.ts`, `panels.ts`, `sheet.ts`, `main.ts`, `fit.ts`, `style.css`, `index.html`, `env.d.ts`, the new unit and smoke tests, `packages/sim/src/step.ts`, `packages/sim/test/inputs.test.ts` and the new `DECISIONS.md` entries. I checked them against the Director's two rulings (New run keeps live tuning; same-tick attack orders count as one wave) and did not re-argue either.

I played through a repelled wave and a capture again at 375×667, 375×812 and 812×375. Each run went: tuned economy, built a network, attacked from the Probe, staged at A5, then "Attack with all" to capture, reloaded and sent feedback. The screenshots are `crit-r2-*.png` in the session scratchpad: `-02b-banner-live`, `-03-toast-repelled`, `-05-result-panel` and `-06-capture-toast` for each of `p667`, `p812` and `land`.

**Gates.** I ran them on 7e7a4c6 myself:
- `npm run gates -- --base main`: all six passed. Determinism final hash is still 35d8f54c, so the sim change doesn't move the reference replay. Protected-files: 23 files changed, none protected.
- `npm run build`: passed.
- `npm run smoke`: run twice, 26/26 passed both times, including the new 375×667 project.

**Bots on the merged tree.** The branch was cut before m1-bots merged, so the bot gate here only runs stubs. To test the sim change against the real strategies, I merged main and this branch in a throwaway worktree, which I have since removed:
- **Bots:** PASS. turtle captures at 9.8 min with 1 wave and 11 lost; rush captures at 25.3 min with 5 waves, 4 repelled and 72 lost. "None: every target is met."
- **Tests:** 117/117 passed, and determinism still ends at 35d8f54c.
- **Merge conflict:** the merge conflicts in `DECISIONS.md` (both sides appended entries). Whoever runs `merge-task` must keep both blocks.

### Round 1 items

1. **Overlays over the Bloom: fixed.** The banner now has its own strip above the map, and the toast sits at the bottom of the map. The Bloom, its thorn ring, the ship badge and the withered grey capture state are all visible at every size (for example `crit-r2-p667-02b-banner-live.png` and `crit-r2-p667-06-capture-toast.png`). A smoke test checks this at both phone sizes. Side effects are under "Not blocking" below.
2. **Retreat mistap: fixed.** The battle section is always present, with a disabled "Retreat to Probe · 0". The gap from Retreat to "Attack from Probe" stayed at 78 px before and during a battle at every size, so nothing moves under the finger. It is logged in `DECISIONS.md`.
3. **Feedback "blocked" message: fixed.** The tab is opened without the `noopener` feature, and `opener` is cut by hand. The status now reads "Opened a prefilled GitHub issue in a new tab…" at all three sizes.
4. **startStock and New run: fixed per the Director's ruling.**
   - `dataWithDefaults` builds the new run from the current tuning, and `startTunables` goes into both the replay and the save.
   - A unit test covers stock 150 and cap 5 after New run, the replay hash and the save round trip. The smoke test covers New run and `replayMatchesLive`.
   - The confirmation dialog and the tuning panel both say that tuning is kept.
5. **Reset all: fixed.** It sends only the values that differ from the default. The smoke test asserts exactly +1 input.
6. **`DECISIONS.md`: fixed.** It now logs:
   - paused inputs stepping a tick;
   - the save format;
   - `shipsEngaged`;
   - the 7500-character URL limit;
   - the Retreat button;
   - New run keeping tuning;
   - the notice layout;
   - the wave-per-tick sim change.
7. **375 px smoke coverage: fixed.** It is a `test.describe` block with load/overflow checks, 44 px targets with the probe, A1 and rich sheets open, and the overlay check.
8. **`.confirm` CSS: removed.**

### Sim change

`step` caps the `wavesSent` increase from one tick's inputs at 1. It is minimal and integer-only, and a unit test covers it: two sources in one tick count 1, and a later tick counts 2. Unpaused, I confirmed in play that "Attack with all" from Probe + A5 now shows "Waves sent 2" for two attacks; in round 1 it showed 3.

### Required change

1. **"Attack with all" still counts several waves when the game is paused.**
   - **The cause.** `Session.send` steps one tick per input while paused. "All" calls `send` once per source, so each order lands on its own tick, and the new sim rule counts each as a wave.
   - **What I saw.** I checked it with a throwaway vitest (not committed): ships at Probe and A5, two `send` calls. Unpaused gives `wavesSent` 1. Paused gives `wavesSent` 2.
   - **Why it matters.** Pausing to plan an attack and then pressing "All" is exactly the puzzle behaviour H1 wants. On that path the result panel's "Waves sent", one of the numbers fun question 3 asks the owner about, is wrong again. This is the defect the sim change was brought into this task to fix, and it is only half fixed.
   - **Fix.** Make one "All" press land in one tick in every state. For example, give `Session` a way to send several inputs and step once while paused, and use it in the "All" handler.
   - **Check.** Add a unit test: paused, two sources, one "All" press, `wavesSent` is 1, and `replay()` still matches the live hash.

### Not blocking (Director: add to the backlog or Designer notes)

- **The toast now covers the probe.** At all three sizes the toast's box contains the probe's centre: at 375×667 the toast spans y 298–359 and the probe sits at y 335. Tapping the probe while a toast is up only dismisses the toast. This costs an extra tap after every battle, but no wrong action ever fires.
- **The map jumps when the banner appears and disappears.** At 375×667 the Bloom moves 29 px and the probe 5 px when the banner appears, and they move back when it goes. Every node stays within its tap radius, but the jolt is visible at the start and end of every fight. Reserving the banner strip permanently, or overlaying it on the reserved top margin `fitMap` now leaves, would remove it.
- **The banner text is shorter than the spec.** It reads "BATTLE · strip 1.3/s · regrow 0.5/s · 0 lost". It drops "thorns" and "you"; the sheet still has the full sentence. This is readable, but the Designer should confirm it.
- **Designer: "All" doesn't arrive as one wave.** From Probe + A5, the A5 ships arrive about 330 su earlier and fight alone until the Probe ships arrive. In my first try the A5 group died before the Probe group reached the Bloom. Players will likely read "Attack with all" as one simultaneous wave. That matters for claim 2 and is worth a Designer note before the handoff.
- **Test hooks with fake text.** `debugShowNotices` puts fake banner and toast text into the production `refreshUi` path through `forceBanner`. It is a test hook in the existing `__factory4x` style and is acceptable, but keep such hooks out of gameplay code paths where possible.

This is round 2 on m1-client. Under the deadlock rule in `PROCESS.md`, this second rejection moves the task to the Core Engineer. The only remaining work is the one required change above.

VERDICT: REJECT

## Round 3 · 2026-11-06

This is the third and final round under the deadlock rule. I reviewed `git diff baed07b..358b53f`, which is the Core Engineer's fix for the one round-2 required change, together with the touched files: `session.ts`, `sheet.ts`, `panels.ts`, `main.ts`, `env.d.ts`, the new unit and smoke tests, and the `DECISIONS.md` entry.

**The fix.**
- `Session.sendAll(inputs)` validates each input against the current world. It queues the valid ones together and drops the invalid ones without logging them. While paused it steps exactly one tick, and only if at least one input was valid.
- `send(input)` is now `sendAll([input])`, so single taps behave exactly as before.
- "Attack with all" builds its orders from one `shipCounts` snapshot and makes a single `sendAll` call. "Reset all" batches the sim tunables into one `sendAll`, and the client-scope `autosaveSec` goes through settings as before.
- The sim rule is unchanged.

**Batch validation and log semantics (the engineer's flag).** Every input in a batch is validated against the world before the batch, not after earlier inputs have applied. `step` then revalidates each input as it applies it. So a batch input that an earlier one makes invalid is logged but ignored by the sim. The replay ignores it the same way, so determinism holds, and the result matches the running path exactly (several taps in one frame behave the same). The logged ticks are correct: every input in one press records the same tick. I accept this, and it is logged in `DECISIONS.md` with the alternatives that were rejected.

**My own repro.** I wrote a throwaway vitest, not committed and since deleted. It stages ships at the Probe and A5 by play, then sends "All" as two valid orders plus one invalid order from A3, which has no ships:

| | Running | Paused |
| --- | --- | --- |
| Inputs queued | 2 | 2 |
| Ticks advanced | 1 | 1 |
| `wavesSent` | +1 | +1 |
| Inputs logged | 2 | 2 |
| Distinct log ticks | 1 | 1 |
| Replay matches live hash | yes | yes |

An empty batch while paused steps nothing. Round 2's paused case gave `wavesSent` +2; it now gives +1.

**Gates.** I ran them on 358b53f myself:
- `npm run gates -- --base main`: all six passed. Determinism final hash is 35d8f54c, unchanged. Protected-files: 23 files changed, none protected.
- `npm run build`: passed.
- `npm run smoke`: run twice, 28/28 passed both times. That includes the new smoke test "paused Attack with all from two sources is one press, one tick, one wave", which drives the real UI.

**Tests.** The new unit tests reach a two-source staging by play only, so their replays are valid. They cover:
- a paused batch: one tick, one wave, same log tick, replay matches;
- a running batch: applies on the next tick, one wave;
- invalid inputs dropped from a paused batch, and no step when none is valid.

These are meaningful tests.

**Regression check of the round-1 fixes.** I replayed the full scenario from round 2 at 375×667, 375×812 and 812×375 (repelled wave, A5 staging, "Attack with all", capture, reload, feedback). The screenshots are `crit-r3-*.png` in the session scratchpad.
- **Item 1:** the Bloom, its thorn ring and the badge stay clear of the banner and the toast. The withered Bloom is visible at capture.
- **Item 2:** Retreat sits 78 px above "Attack from Probe" both before and during a battle at every size, so nothing shifts under the finger.
- **Item 3:** Feedback reads "Opened a prefilled GitHub issue in a new tab…".
- **Items 4 and 5:** the smoke tests for New run keeping tuning, startStock and Reset all (+1 input) pass.
- **Items 6–8:** the `DECISIONS.md` entries are present, the 375×667 smoke project passes, and `.confirm` stays removed.
- **Result panel:** "Waves sent 2" for two attacks.
- **Reload:** resumes, and the replay matches.
- **Console:** no errors.
- **Nothing regressed.**

**Pillar fit.** This is unchanged from round 2. H1's loop is playable by touch at 375 px: throughput visibly climbs, the bottleneck shows on screen, a failed wave reads as a lesson, and capture pays off with a visible Bloom withering and a result panel. Nothing here changes how the game plays beyond the spec, apart from the Director's two logged rulings and the logged Retreat shortcut. I would be comfortable with the owner playing this tonight.

**Carried over from round 2, not blocking (Director: backlog or Designer notes).**
- **Toast covers the probe.** The bottom toast covers the probe until it is tapped. A tap there only dismisses the toast.
- **Map jumps.** The map shifts by about 29 px when the battle banner appears and disappears.
- **Shorter banner text.** The banner wording is shorter than the spec's ("strip 1.3/s · regrow 0.5/s"). The Designer should confirm it.
- **Staggered "All".** Ships sent with "All" from Probe + A5 arrive about 330 su apart, so A5's group fights alone first. This is for the Designer before the handoff.
- **Debug hook in a gameplay path.** The `debugShowNotices` test hook adds a branch to `refreshUi`.
- **Merge conflict.** Merging into main conflicts in `DECISIONS.md` (both sides appended). Keep both blocks when running `merge-task`.

VERDICT: APPROVE
