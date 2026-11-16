# cw-bots-gate-time review

## Round 1 · 2026-11-16

I reviewed 77b3e47 (`git diff main...task/cw-bots-gate-time`: ad19837 and 77b3e47) against the BACKLOG Can wait entry.

**Gates (run by me on 77b3e47, `npm run gates -- --base main`): all PASS.**
- typecheck, lint, and protected-files (6 files, none protected).
- test: 51 files, 1074 tests.
- determinism: final cdbdea56, unchanged.
- bots: PASS in 47.1 s ("Runs 46.2 s").

**Decisions unchanged: verified independently.** Main's `packages/` and `data/` are identical to this branch's merge base, so I ran `npm run bots` on main for the baseline. It took 97 s. The two reports match:
- `bots-latest.md` is identical once the timing columns are masked;
- in `bots-latest.json`, all 18 runs have the same `outcome` and `finalHash` (seed 1 adaptive: 867193e9 on both).

So the gate time halves, from 97 s to 47 s on this machine, under the 80 s target, with bit-identical results. No gate threshold or tick count changed. Nothing is sampled, so the asserted metrics (economy lost under a guard) stay exact.

**What's good.**
- The profile-led cuts are well chosen, and DECISIONS.md explains each one with its share of the cost.
- The direct reads are each covered by `direct-reads.test.ts`, which compares them with the selectors on every 7th tick of a 12-minute adaptive run, so a sim change that moves one and not the other fails loudly.
- The battle memo is keyed correctly, by base (tunables, node, guards at home) and fleet. A test holds `fieldMix` to a fresh `minMix`.
- The sim-side `byProbeDistance` cost is left as a note rather than reached for outside the task's files.

**The defect: the tunables key is cached per world and tick, and it goes stale.** `tunKey` in `field-estimate.ts` caches by world object, data object and `world.tick`, on the stated assumption that "the tunables only change inside `step`". The assumption doesn't hold, and nothing enforces it:
- tests set `w.tun[...]` directly;
- the Designer's probe scripts (`reports/archive/*.mts`) tune worlds in place to explore values, and h9-design-data will do the same.

I confirmed it with a scratch script (deleted afterwards):
- `fieldMix(w, …, hive, all types, 60)` gives 16.
- Then `w.tun['guard.thorn.damage'] *= 4` on the same tick, and `fieldMix` again: still **16**.
- A fresh world with the same tuning gives **28**.

Main's code returns 28 in both cases. The battle memo inherits the stale key too, so this is a silent wrong-answer regression for any caller that tunes a world without stepping. That is exactly the calibration workflow.

**Required changes:**
1. **Make `tunKey` correct whenever the tunables change, not only across ticks.** For example, keep the cached key together with a snapshot of the tunable values, and reuse it only if every value is equal. That is a loop of integer compares, still far cheaper than `JSON.stringify` + `fnv1a`. Or key on a value-derived signature computed cheaply.
2. **Add a test that fails on 77b3e47:** call `fieldMix` (or `fieldSingle`) on a world, change a guard tunable in place on the same tick, call again, and expect the same answer as a fresh world with that tuning.
3. **Re-run the gates.** Report the bots time (it must stay under 80 s) and confirm the report is still identical to main's.

VERDICT: REJECT

## Round 2 · 2026-11-16

I reviewed 591ea28 against round 1 (23bb566 and 591ea28).

**Required change 1 (the stale key): met.** The world and tick cache is still there, but `tunKey` now reuses the cached key only if every tunable name and value matches a snapshot taken when the key was made. That is an in-order loop of integer compares with no allocation, and the key is rebuilt on any difference. Tuning a world in place now changes the key at once.

The field-map hash is now recomputed on each cache miss instead of being kept per map object. A map edited in place on the same tick would still be missed until the next tick. That is acceptable: no caller edits `data.map` in place, since probes build new data, and the code comment says so.

**Required change 2 (the test): met.** "the estimate follows a tunable changed in place" does three things:
- it asserts the tuning really changes the answer;
- it checks `fieldMix` on the same tick against a fresh, equally tuned world;
- it does the same for `fieldSingle`.

This is my round-1 scenario, and it would fail on 77b3e47.

**Required change 3 (gates and identity): met.** I ran `npm run gates -- --base main` on 591ea28 and every gate passed:
- typecheck, lint, and protected-files (7 files, none protected);
- test: 51 files, 1075 tests;
- determinism: final cdbdea56.

The bots gate passed in 56.4 s ("Runs 55.4 s"), against 97 s on main and under the 80 s target. I compared the run with my main baseline from round 1. `bots-latest.md` is identical once timings are masked, and all 18 runs have the same `outcome` and `finalHash`.

**Small point, not required:** the DECISIONS.md entry still says the key is "computed once per world and tick (tunables only change inside `step`)". The code comment is now correct, but append one line to the log when convenient so the reason stays true.

Required changes: none.

VERDICT: APPROVE
