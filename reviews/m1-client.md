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
