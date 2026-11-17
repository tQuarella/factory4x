# h9-client review

## Round 1 (final) · 2026-11-16

I reviewed 24cac28 (`git diff task/h9-design-data...task/h9-client`: c7091b3, 6982899, a7b0762, ea946b5 and 24cac28, plus merges). It is the top of the H9 stack. It carries every lower approval: h9-sim 12924fa, h9-raids a34be08, h9-bots be6ede0 and h9-design-data a49e163, all merged, and origin/main. I checked it against DESIGN.md "Client: phone UI (H9)" and "Art needs", and the BACKLOG h9-client acceptance.

**Gates and smoke (run by me on 24cac28).**
- `npm run gates -- --base main`: all PASS.
  - typecheck, lint, and protected-files (71 files, none protected).
  - test: 58 files, 1219 tests.
  - determinism: final a8f4c2ff.
  - bots: data v16, flags 1–7 MET.
- `npm run build`: OK.
- Full smoke (`npx playwright test`): **302 passed**, desktop and phone.
- `tests/smoke/h9-client.spec.ts --repeat-each 5`: **140 passed**, with no flakes.

The engineer reported neither the `--repeat-each 5` run nor the CI job times (acceptances 8 and 9). I ran the repeat myself. CI is the Director's check before merging (see below).

**Acceptance.**
1. **The extractor row: met.**
   - "Extractors d / cap", with −, + and All at 44 px each, sends `setExtractors`. − is disabled at `extractorMinCount` and + at the slots, and each tap reads the current `extCap`, so a stale tap can't overshoot.
   - All is pressed (`aria-pressed`) while the count is null.
   - The pip row shows "+N on the way".
   - On an unmarked rock the row is dimmed with its buttons still enabled.
   - The read-only line reads "Haulers N (auto)" or "(set N)".
   - With `client.haulerStepper` 1, H8's hauler stepper is back.
   - The smoke test lowers a rock by stepping with `advanceTicks` and sees an extractor leave, the haulers drop after their trip home, and no rebuild.
2. **Per-prong map: met.** `raidlegs.ts` is now the only client file that reads `world.raid`, and it walks every prong through `raidProngs`. That answers my h9-raids note about prong 0's phase reading `done`. Each target wears its own badge with its `raidMix`, each prong flies its own leg with its own marker and countdown, and a finished prong draws nothing (smoke: "one prong beaten while the other is still out").
3. **Banner and chip: met.**
   - The multi-prong muster text matches the spec's form, and one prong keeps H7's text, word for word.
   - The chip adds "· 2" and shows the soonest time, from the sim's minimum.
   - The banner takes the spec's second option: two fixed lines of room. DECISIONS.md explains why one line can't fit under the wide font. The smoke test measures that nothing moves from the muster to the fight.
4. **Rock sheet raid lines: met, with one logged call.** "Raid coming" reads the per-rock `raidMix`. The rank line shows on every `raidNext` rock, *except* one already showing its own raid line, which says the same thing sooner. Before a raid it shows on both rocks a split would hit (smoke-tested, and on no other rock). I accept this: it keeps the spec's purpose without a fourth reserved line.
5. **Report: met.** The end toast reads "Raid: A5 beaten · A6 hit, 2 extractors lost", and the result panel adds a "Raid prongs" line from `raidProngs`.
6. **Fit and stability: met.** At 375x667 under the wide font, these all fit without scrolling, and the HUD is measured not to shift:
   - the rock sheet with the extractor row, the haulers line and the raid lines;
   - the same with the stepper on;
   - the two-prong banner;
   - two badges and the chip suffix.

   The map-height rule now counts H8's Recycle section, and DECISIONS.md explains it. The map plus Recycle (187 px) is no smaller than H8's 185 px, and the states without Recycle still assert 185 px and 210 px directly.
7. **Tuning: met.** `raid.prongsMax` and `raid.prongMinSize` are labelled. `client.haulerStepper` is stored as a device setting and tagged "this device".
8. **Smoke time:** the new tests step the sim with `advanceTicks`, with no real-time waits (only Playwright timeouts are raised). Locally the full smoke takes 1.3 min. The CI job times weren't reported.
9. **The stack: met** for the merges and the local runs above. One test value moved with data v16: the `prongMinSize` default pin went from 4 to 3, which is not a loosening. A smoke test also checks the shipped data with no tunables touched: a passive run reaches a raid with two live prongs, and the UI shows both.

**Art.** No new art and no new colour, as the spec says. ART_STYLE.md "H9 entities" says how prong badges, legs, the dimmed row and the pressed All reuse H7 and H8's art.

**Code quality.** Clean. `raidlegs.ts` is a good isolation point, and the H7 `drawn.raid` test record stays filled from the first leg, so the older smoke tests keep their meaning. There is no dead code. The `pipText` it replaced is gone from its callers and its test.

**Notes, not required:**
- The banner's two-line room uses the CSS `lh` unit (`min-height: 2lh`). Browsers without it (Safari before 16.4, Firefox before 120) fall back to one line, and the map would shift when a second line wraps. If the owner's phone is older, a fixed px height from the line height would be safer.
- In a normal font, a one-prong raid banner is now two lines tall while it shows, taking about 15 px of map. DECISIONS.md logs this.

**Director, before `merge-task h9-client`:**
- The branch CI run on 24cac28 was still in progress when I finished. Per PROCESS ("Before merging"), CI must be green on the exact commit merged, and that commit now includes this review. Record both job times against their 20 and 15 minute limits, and say so if either is past 80%.
- The H9 handoff must lead with the h9-design-data finding (the bots say defending split raids doesn't pay; greedy is level with adaptive), next to the owner's attrition note.

Required changes: none.

VERDICT: APPROVE
