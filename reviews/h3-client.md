# Review: h3-client

## Round 1 · 2026-11-07

Reviewed `task/h3-client` at 357e85d against BACKLOG.md "h3-client" and DESIGN.md H3 ("Observable values and phone UI", "What changes for H1/H2 content", "Save, data version and replay").

Gates: `npm ci`, then `npm run gates -- --base main`: all six PASS (typecheck, lint, test, determinism, bots, protected-files: 13 changed files, none protected). `npm run build` OK. `CI=1 npm run smoke`: 42/42 passed. The diff touches only `packages/client/src/**` (not placeholders.ts or palette.ts), `packages/client/index.html`, `packages/client/test/**` and `tests/smoke/**`. It does not touch packages/sim, packages/bots, the art files or any protected file.

Played it myself in Chromium at 375x667 (touch, DPR 2) and 1280x800, with a global wide serif font and letter-spacing stress. I compared it with a build of `main` (4929fe6) at the same sizes and seed. Flow: forced Frost Gate with cheap tuning; opened the probe, pocket, Root and heart sheets; took the crystal pocket with drones; routed it; watched the Lens chip, Assembly block and Lancer yard row appear; turned the Lancer yard on; built a mixed fleet; opened Choose… on the ice pocket; stepped the counts (−, +, All); sent 2 lancers only, and the input logged `counts {drone 0, lancer 2, flak 0}`; read the repelled toast; opened the result panel. No console errors, no control under 44 px in any state, no sideways scroll.

### Pillar fit

What it gets right:
- It adds no new kind of input, and the HUD starts as simple as H2: ore and drone chips only.
- The Strong/Even/Weak tags, unlock state, yard and assembler states, capture order and per-type counts all come from sim selectors (`guardianStatus().tags`, `counterTag`, `unlockStatus`, `yardStatus`, `assemblerStatus`, `runSummary`, `clampSendCounts`, `shipsAtByType`). I found no game logic recomputed in the client.
- The send panel clamps through the sim, so ships moving while it is open can't produce a bad order.
- Text matches the spec:
  - repelled toast: "P1 held: 2 sent, 2 lost. Mostly Spores; Lancers are weak here.";
  - banner: "P1 · 0 Thorn 2 Spore · strip 0.1/s · 1 lost";
  - result panel: layout name, capture order "Crystal (P2) 0:15", per-type built and lost, guards withered;
  - tuning: variant label;
  - prize line: "Prize: Crystal · 2 slots · 40/min each · unlocks Lens → Lancer";
  - yard cost and status lines.
- 2-tap rule: yard toggle is probe then toggle; a full send is node then "Attack with all…"; a chosen send is node, Choose…, then Send (the confirm tap). OK.

### Problems

1. **Map regression at 375 px: the guard rings hide node labels.** The client draws the ring outside the individual guards, at `(ringR + thornR + 2) / 0.84`. That is about 16% beyond the existing ring margin; the art contract asks for "within radius r plus the existing ring margin". On the default seed at 375x667 with no sheet open:
   - The heart's ring band runs over the "ROOT" label, so it is barely readable.
   - The Root's ring covers the "A5" label, which is almost invisible.
   - On `main`, both labels are readable at the same seed and size.

   At desktop the ROOT label also sits inside the heart's band. These are the two nodes the H2/H3 supply decision turns on, and A5 is the staging rock. The player must be able to read them.
2. **The smoke criterion "every layout assertion runs under the wide-font stress" is not met.** The new H3 play-through runs under stress, but these existing layout assertions still run unstressed:
   - "every visible control is at least 44 px with each sheet open" (375 px: probe, asteroid, pocket, Root and heart sheets);
   - "every control is at least 44 px" (desktop);
   - "loads without horizontal overflow" (375 px).

   So the Root and heart sheets, which now have new guard rows, tags and Choose… rows, are never layout-checked under the wide font.
3. **The unlock moment is silent, and the capture toast departs from the spec without a record.**
   - The spec's toast is "Ice pocket taken: … Plating and Flak unlocked." The branch says "Route its crystal to the Probe to unlock Lens and Lancers." That reading is consistent with "hidden until first delivered", which is fair.
   - But when the first delivery actually unlocks the ship, nothing tells the player. The Lancer and Flak yards start OFF (DECISIONS.md, h3-sim), so a player who never reopens the probe sheet never builds a counter. That undercuts the hypothesis this slice tests: success criterion 3 and "the owner masses drones and ignores components".
   - The departure is not in DECISIONS.md.
4. **Small text bugs:**
   - A captured ice or crystal pocket with no route says "No route: this ore goes nowhere." (`sheet.ts:280`).
   - The guard rows print "regrows 1 / 2 s" where the spec format is "1 / 2.0 s". The Feeds-the-Heart box on the same sheet does print "10.0 s".

Not blocking, but worth doing while in there:
- The send panel shows tags as lowercase "even" / "weak", while the sheet shows "✓ Strong" / "Even" / "✗ Weak". Use the same words and marks.
- "Attack the P1" reads oddly; use "Attack P1".

Determinism: the change is client only. It reads `world` and sends inputs through `Session`. The new smoke play-through checks `replayMatchesLive()` after the mixed send. Data: no new tunables, and `data/` is untouched. Old saves: the dataVersion-4 refusal and toast come from the existing path, unchanged.

### Required changes

- [ ] At 375x667, default seed (and each forced layout 1–3), with no sheet open, every node label (ROOT, HEART, A5, P1–P4, A1/A2) is drawn clear of any guard ring band. Either keep the ring within the existing ring margin, as the art contract says, or draw all labels in a final pass on top of the rings with a backing. Show it with a screenshot or a smoke assertion in the review reply.
- [ ] Every layout assertion in `tests/smoke/boot.spec.ts` runs under the wide-font stress. This covers at least the per-sheet 44 px test at 375 (probe, asteroid, pocket, Root, heart), the desktop 44 px test and the 375 overflow test. Use one shared stress style that covers `#sheet`, `#sendpanel`, `#result`, `#chips` and the notices.
- [ ] When a prize is first delivered, the player gets a toast or notice naming the unlock, e.g. "Crystal delivered: Lens and Lancers unlocked. Turn on the Lancer yard at the Probe." Keep or adjust the capture-toast wording, then record the reading (unlock on first delivery, not on capture) in DECISIONS.md. Add a unit test for the new text.
- [ ] The no-route line on a captured pocket names its prize ("this crystal goes nowhere").
- [ ] The guard-row regrow reads "1 / 2.0 s" (one decimal always), consistent with the spec and the Feeds box. Update the test.

VERDICT: REJECT

## Round 2 · 2026-11-07

Reviewed `task/h3-client` at f9ea031: the round-1 fixes plus a merge of origin/main 179ecbc. The diff against main still touches only `packages/client/src/**` (not placeholders.ts or palette.ts), `packages/client/index.html`, `packages/client/test/**`, `tests/smoke/**`, `DECISIONS.md` and this file. There are no sim, bots, data, art or protected-file changes.

Gates, from a fresh worktree after `npm ci`:
- `npm run gates -- --base main`: all six PASS.
- `npm run build`: OK.
- `CI=1 npm run smoke`: 42/42 passed.

Played it again at 375x667 (touch) and 1280x800 under a global wide serif font with letter spacing. I forced all three layouts through the tuning panel's `system.variant` and compared each with a build of main at 179ecbc. Then I repeated the round-1 flow at both sizes:
- took the crystal pocket;
- routed it, and the unlock notice appeared;
- tapped the notice, which opened the Probe sheet;
- turned on the Lancer yard;
- sent a lancers-only wave through Choose…, read the repelled toast, then opened the result panel.

No console errors, no control under 44 px in any state, no sideways scroll.

### Round-1 required changes

1. **Rings and labels: done.**
   - `guardRingOuter` for the Root and heart is now `ringR + thornR + 3`, the old selection or ring margin. So the ring stays within "r plus the existing ring margin", and the guards sit just inside the band.
   - In the screenshots, the outer extent matches main's thorn ring on Frost Gate, Glass Thicket and Twin Seams.
   - Labels are drawn in a last pass on a dark pill. ROOT, HEART, A5, P1–P4 and A1/A2 are all readable at 375 px and on desktop in all three layouts. On main they were partly covered by guard sprites.
   - The heart and Root rings still touch each other where the two nodes are close. They did the same on main, and neither covers a name now.
2. **Wide-font stress on every layout assertion: done.** `ready()` now adds one shared `WIDE_FONT` covering the sheet, send panel, result, chips, tuning, feedback, cards and notices. It applies to every test that uses `ready()`, including the per-sheet 44 px test at 375 (probe, asteroid, pocket, Root, heart), the desktop 44 px test and the overflow test.
3. **Unlock notice: done.**
   - On the first delivery, the toast adds "Crystal delivered: Lens and Lancers unlocked. Turn on the Lancer yard at the Probe. Tap here to open it." I saw it at both sizes.
   - One tap opens the Probe sheet, so the counter is 2 taps from the map.
   - A resumed or new run doesn't re-announce, because the snapshot is taken per world object.
   - The reading (unlock on first delivery, not on capture) is recorded in DECISIONS.md. There is a unit test for the text, and the smoke play-through asserts the notice and the tap.
4. **Text fixes: done.**
   - The no-route line now reads "No route: this crystal goes nowhere."
   - Regrow reads "1 / 2.0 s", via `regrowText`, with a test.
   - Send-panel tags use the sheet's ✓ Strong / Even / ✗ Weak.
   - "Attack P1" replaces "Attack the P1".

### Notes (not blocking)

- With a sheet open, the shrunken 16-node map is crowded, and the label pills stack over each other. Main is just as crowded there, and the pills are, if anything, easier to read. If the owner finds it noisy, a later design task could hide asteroid labels while a sheet is open.
- A battle report that arrives before the unlock notice is tapped replaces it. This is the existing toast behaviour for any two notices. The HUD chips and the Probe's Yards row still show the unlock.

The work meets the acceptance criteria, keeps to the spec (the one departure is recorded), and plays cleanly at both sizes.

VERDICT: APPROVE
