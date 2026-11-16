# h9-sim review

## Round 1 · 2026-11-16

I reviewed 64d9e1b (`git diff main...task/h9-sim`: 1abd054, 886b5f6 and 2ec2b27, plus merges of main). I checked it against DESIGN.md "H9 (Milestone 2, iteration 9, spec ready): A wider front" (X1–X4, "Save, data version and replay", Tunables, Selectors and the stub paragraph) and the BACKLOG h9-sim acceptance.

**Pillar fit.** This is the extractor dial: the "secondary" half of the H9 claim, with no new rule beyond X1–X4. The raid selectors land in their final shape as one-prong stubs, as the spec's "Stub for parallel work" asks. With no inputs, nothing about play changes: the bots on v15 give the same win times (adaptive 15:53, greedy 15:45) and the same flags as v14.

**Gates (run by me on 64d9e1b, `npm run gates -- --base main`): all PASS.**
- typecheck, lint and protected-files (30 files, none protected).
- test: 54 files, 1119 tests.
- determinism: final 2141b502, changed from cdbdea56.
- bots: data v15, 56.4 s, and flags 1–7 MET.

**Acceptance.**
1. **Data v15: met.**
   - `raid.prongsMax` (2, 1–3), `raid.prongMinSize` (4, 2–12) and the client-scoped `client.haulerStepper` (0, 0–1) are checked against the DESIGN table, as data-h8 did for H8.
   - `extractorSet` is saved and validated (null or an integer ≥ 1).
   - `stats.raidProngs` starts at zero and is validated.
   - `lastRaid.prongs` must be an array.
   - The pin is 15.
   - The older fixtures carry the H9 keys at H8 behaviour (`prongsMax` 1, which is W8).
2. **X1–X3: met.** Every listed case has its own test on shipped `map.field`:
   - the range for an asteroid and for a captured pocket or hive (`max(1, free)`, including the equal case);
   - the invalid inputs (0, above the slots, not an integer, guarded, the probe, a bad index, a campaign world);
   - kept while unmarked;
   - F5's cap, with free extractors counted;
   - H4b `enough`;
   - committed extractors picking by `extCap`;
   - the lowering order (in flight before docked, whatever the ids, highest id within a group);
   - the surplus re-dispatched or parked, with the buffer kept;
   - raising, or All, reopening F5 and H4b on the same tick;
   - null and the slots giving identical worlds over 3 minutes.

   `extCap` is the single read point. Lowering runs inside the input, so F2 and F3 see the surplus as unbound on the same tick. That ordering is correct, and DECISIONS.md explains it.
3. **X4: met.** After a lowering, the need and target fall, each hauler over its target leaves at its next delivery, and H4 builds none. A kept `haulerSet` overrides the dial.
4. **The opening is H8's: met, by the strongest available check.** The engineer ran the same 6-minute loop on archived main (2ceada1) on v14 and here on v15. It chains a per-tick hash of ships, delivered ore, bays and shares, plus whole-world hashes every 600 ticks with the H9 additions excluded. The results are pinned in data-h9.test.ts. The run includes two finished raids.
5. **Selectors: met, in their final shape.**
   - `rockStatus` gains `extractorSet`, `extCap`, `raidMix` and `raidNext`.
   - `raidStatus` gains `prongs` (including `done` in the type), `nextProngs` and `last.prongs`.
   - `fieldSummary.raidProngs` is added.

   The stub mapping is pinned in h9-selectors.test.ts for hit, turned back, beaten, withered, the prong count, `nextProngs` and the readouts that depend on it. That gives h9-raids a precise contract to replace.
6. **Replay: met.** Items (a)–(f) each have a test that the replay enters the state, and the final hash changes. Item (f)'s invalid inputs are listed exactly, and the "no input ignored" check narrows to exactly those four. One existing assertion now reads a1 on the tick of its unmark rather than at the end of the run, because a1 is re-marked at 8761. That checks the state the assertion is about, and doesn't loosen it.
7. **Gates: met.** No red tests. The client test edits are compile-only, adding the new required fields and the new client key, and are listed in DECISIONS.md.

**Readings I checked and accept:**
- An unbound in-flight extractor finishes its leg before re-dispatching, which is F5 as built.
- `raidNext` requires `raidRank ≥ 1`. Without it, every rock that can't be raided (rank 0) would read true.
- The stub never shows a live `beaten` prong, because a beaten raid ends at once.
- `ProngResult.outcome` includes `withered`, from W6's hive-falls limit.

**Determinism.** Integer only. The lowering sorts with total comparators by id, F5's order is unchanged, and there is no clock or RNG. All new state (`extractorSet`, `raidProngs`) is in the world, saved and hashed.

**For the Director (risk, already logged by the engineer):** the replay's tail after 8010 has no raids, and it is now used up to 8880. h9-raids items (g)–(n) will need raids before the hive falls, which means restructuring the replay and moving the H7/H8 raid timings its test pins, or a tail where the hive still stands. Plan h9-raids' replay work with that in mind. It is not a defect here.

Required changes: none.

VERDICT: APPROVE
