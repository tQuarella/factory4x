# h9-raids review

## Round 1 · 2026-11-16

I reviewed c686385 (`git diff task/h9-sim...task/h9-raids`: 7cf62ce, ac111f0, bdbaf4c and c686385). It is stacked on h9-sim's approval (12924fa). I checked it against DESIGN.md H9 W1–W8, "Save, data version and replay" items (g)–(n), "Selectors", and the BACKLOG h9-raids acceptance.

**Pillar fit.** This is the H9 claim's mechanism: a full-size raid splits across the nearest mined rocks, and each prong is its own fight, with its own shield, hold, retarget and outcome. Nothing goes beyond W1–W8. No data value changed.

The finding that matters for the claim, reported correctly as a finding and not tuned around: on shipped v15, `adaptive` meets exactly **one** 2-prong raid, at econ 17 in minute 15.5. Greedy meets two. Calibration target 1 (at least 2 split raids) is therefore unmet on shipped data, and that is h9-design-data's problem to solve or escalate.

**Gates (run by me on c686385, `npm run gates -- --base main`).**
- PASS: typecheck, lint, determinism (final 9a2e957c, changed from 2141b502), bots (adaptive 15:53, greedy 15:55, flags 1–7 MET) and protected-files (33 files, none protected).
- FAIL: test, on 1 of 1167 tests: `packages/bots/test/h8-bots.test.ts` "the shield holds" (greedy 1 ≠ 0).
  - This is outside h9-raids' files and is disclosed in DECISIONS.md with its cause: `field-runner.ts` reads only prong 0's target, so a loss at the other prong's target counts as unshielded. A traced run shows no real violation.
  - BACKLOG's gate expectations allow it: on h9-raids, typecheck, lint, the sim tests and determinism must be green; the bots side is fixed by h9-bots.
  - **h9-bots must read every prong's target in that metric.** Every sim test is green, and every client test too.

**Acceptance.**
1. **W1: met.** The tests cover:
   - `prongCount` at every limit;
   - no target, one target, below and at the split;
   - `prongsMax` 3 giving 3 prongs of 4 at a5, a6 and a7;
   - hive order with the a6/a7 tie going to a6;
   - a captured pocket as a target, and never the hive or the probe;
   - the muster cancel.
2. **W2: met.** The tests cover both spec examples, the pointer carrying from Thorns into Spores, the launch re-deal (lowest id first), a trimmed launch dropping to 1 prong and clearing the dropped target, and a trimmed launch that still holds both prongs.
3. **W3–W5: met.** The tests cover:
   - the same-tick launch with different arrivals;
   - per-prong R7, the shield at one target while the other's economy is struck, and the go-home-on-empty for that prong only;
   - distinct live targets;
   - the hold ending at each prong's own outcome;
   - `haulersHold` 0;
   - W5 skipping the other prong's live target, going home rather than doubling up, `retargeted` per prong, and all rocks unmarked ending turned back.
4. **W6: met.** The tests cover:
   - a beaten prong done at once while the other fights;
   - beaten plus hit counting as a hit, with `raidProngs` counting one of each and the gap starting from the last prong;
   - the overall-outcome table;
   - a home prong rejoining the hive while the other is out, with raiders away counting against the caps (W7);
   - the wither over every prong, uncounted, with an earlier-done prong keeping its outcome;
   - no new muster while any prong is out.

   Counting `raidProngs` at the raid's end rather than at each prong's end keeps a withered raid entirely uncounted. That is the consistent reading.
5. **W8: met.** `raids.test.ts` and `raids-h8.test.ts` are unchanged and pass. Keeping the flat `Raid` shape (prong 0 is the raid object itself, other prongs in an `others` list) is what makes that true. The data-h9 opening chain (a48e6bea) passes with no edit. The W8 tests also show a one-prong raid has no `others` and no `outcome` while it lives.
6. **Siblings: met.** The `recycleFleet` exclusion now checks every prong in `fight` (tested, including out and done prongs not excluded). The save check validates the full prong shape, and the tests show a malformed raid, a bad `others`, an outcome before `done`, and a bad result entry are each refused, with round-trips at muster, out and fight with a done prong.
7. **Selectors: met.** `prongs` (with `done` prongs listed until the raid ends), totals, the summary `phase` (fight > out > home), the smallest `ticksToArrival`, `nextProngs` growing 0 → 1 → 2 → 3 with econ, `last.prongs`, and the rock fields are each tested at muster, out, fight and home.
8. **Replay: met.** Items (g)–(n) each have a test that the replay enters the state. The final hash changes.

   **The restructure is the right one.** Raids end when the hive falls at 8010, so the prong raids are set up before it with recorded `setTunable` inputs, as the spec allows. One sacrificial extractor docks at p1 to be the hit. Raids 1 and 2, and every H8 timing in them, are untouched. Every moved pinned value is listed in DECISIONS.md with the reason.

   One check is weaker, and the engineer flagged it: the H1-amendment item now checks that every hauler picked for a4 before the dock loads only after it (at least one does), instead of checking the first pick itself, because the first pick's own load now falls past tick 9000. The rule under test, "waits empty until the dock, then loads", is still asserted, including the first pick's unbroken wait. I accept it.
9. **Report for h9-design-data: met.** Adaptive's raid sizes and splits (#1–#6, with only #6 at econ 17 splitting 2T3S and 1T3S), and greedy's two split raids.

**Determinism.** Integer only, with no RNG and no clock.
- Prongs are processed in prong order.
- `raidables` sorts by hive distance, then index.
- The deal is a single pointer over `GUARD_TYPES`, then hive order.
- `dealGuards`' `Map` is used for lookups only, never iterated.
- All state is in `world.raid` and is saved and validated.

**Code quality.** Clear. `prongOutcome` derives `home` outcomes instead of storing them, and `outcome` exists only on `done` prongs, so live state stays minimal. Outside the file list, `index.ts` gains only re-exports (`raidProngs` and others), which h9-bots and h9-client need. That is reasonable and disclosed.

**For h9-client (no action here):** `world.raid.phase` is now prong 0's phase and can be `done` while another prong is still active. `view.ts` and `main.ts` read `world.raid.{phase,target,from,guards}` directly. h9-client must draw every prong through `raidProngs`/`raidStatus.prongs` and never assume `world.raid.phase` is the raid's phase.

Required changes: none.

VERDICT: APPROVE
