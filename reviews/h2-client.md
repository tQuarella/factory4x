# Review: h2-client

## Round 1 · 2026-11-07

Reviewed `task/h2-client` at 238d38d against `main` (merge base 74bbb89). The branch merges cleanly with current `main`, which now includes h2-bots.

Pillar fit: Good. This is the readout layer H2 depends on: the Root sheet's "Feeds the Bloom" box and the rich sheet's fed/starved line both come from live tunables, the vine greys, wilted thorns fall off, and the wilt toast states the change. It adds no new input type and never shows a ships-needed number, as DESIGN.md H2 requires. In the author's 375 px shots (`reports/shots-h2-client/`), the map, Root sheet, attack, cut toast, grey vine, wilting thorns and Bloom attack all read clearly. The toast and hint sit in the notices strip and cover nothing on the map. Nothing goes beyond the spec.

Quality: The code is clean and consistent with the codebase. `guardedSections` generalises the rich sheet without duplicating it. Hit areas now come from the same `ringGeom` the renderer uses, so tap areas and drawn thorns can't drift apart. The wilt animation is client-only wall-clock state that resets when the world changes, so a resume or New run doesn't replay it. The toast logic collects every battle that ended since the last look, across both guardians. Determinism is untouched: no sim changes, and `seed + 1` is safe because the sim takes `seed | 0`. New run cycles Thin → Knotted → Deep (smoke-tested). I also checked, with a throwaway Playwright spec that I deleted afterwards, that a forced `system.variant` of 3 and then 1 gives Deep and then Thin on New run, with `replayMatchesLive` still true, at both desktop and phone sizes.

One bug in new logic. `regrowChange` in `packages/client/src/report.ts` gets the "faster" case wrong by a factor of 10:

```ts
return x10 > 10 ? `regrows ${fmt10(x10)}× slower` : `regrows ${fmt10(Math.round(1000 / Math.max(1, x10)))}× faster`;
```

`x10` is ten times the ratio, so the faster factor in tenths is `100 / x10`, not `1000 / x10`. I reproduced it with a throwaway script on the real sim, cutting the Root with tuned values:

| `guardian.regrowTicks` | `bloom.starvedRegrowTicks` | Toast says | Should say |
| --- | --- | --- | --- |
| 60 | 30 | "regrows 20× faster" | 2× faster |
| 60 | 15 | "regrows 33.3× faster" | 4× faster |
| 60 | 300 (default) | "regrows 5× slower" | correct |

The bug is reachable through the tuning panel within the designed range (15–1800; DESIGN.md's "Feels like" column even names 60 as a reference point), and this toast is exactly the number H2 success criterion 3 asks the owner to read. Rounding `x10` first also loses precision (fed 60 / starved 45 → x10 = 8 → "1.3×"; that one is acceptable, but computing from the raw tick counts avoids the issue).

Acceptance:
1. Observable values and touch: met. Root, thorn ring, vine, wilt animation, Root sheet and box, fed/starved line, two-line prefixed banner, Root toasts, result panel additions, probe system name, and the new tuning keys. Unit tests cover the box, the line, the wilt toast, Root held and the two-line banner; smoke tests cover the sheet and tuning text. Not met: the "faster" wording of the wilt toast is wrong (above). Also not met: nothing in the branch shows a forced `system.variant` applying on New run. My throwaway check shows it works, but the criterion needs a test that stays.
2. New run uses `seed + 1`: met, smoke-tested.
3. H1 carry-overs: met. Hit reach covers the ring and is ≥ 22 px radius (unit test). Tick values show seconds (unit and smoke tests). The hint is in the notices strip. Top labels get a larger fit margin plus a fallback below the node (BLOOM and ROOT labels are clear in every shot).
4. 375x667 touch flow: met, shown by the seven shots. Root and Bloom crowd each other with a sheet open on Thin, but nearest-centre hit testing keeps taps on target, and the 44 px check includes the Root sheet.
5. Smoke extensions: met. The Root sheet opens, variant names show, and the wide-font check now covers the two-line banner, the Root toast and the hint, plus overlap against the Root. The cross-engine replay check passes.
6. Gates, build and smoke: met locally (below). Green Linux CI on the pushed branch is still a pre-merge step for the Director per PROCESS.md; the branch is not pushed yet.

Gates (run by me on the branch):
- `npm run gates -- --base main`: all PASS (typecheck, lint, test, determinism, bots, protected-files: 21 files, none protected).
- `npm run build`: OK.
- `npx playwright test`: 36/36 passed (desktop and phone).

Required changes:
- [ ] Fix `regrowChange` in `packages/client/src/report.ts` so the "faster" factor is right. For example, compute `Math.round(fed * 10 / starved)` from the raw tick counts for the faster case and `Math.round(starved * 10 / fed)` for the slower case. With fed 60 and starved 30 it must say "regrows 2× faster"; with fed 60 and starved 15, "regrows 4× faster".
- [ ] Add unit tests in `packages/client/test/session.test.ts` for the wilt toast with a faster starved regrowth (60/30 → "2× faster"), with equal values ("regrows at the same speed"), and with a non-integer slower factor (60/90 → "1.5× slower").
- [ ] Add a smoke assertion that a forced `system.variant` applies on New run. For example, set it to 3 in the tuning panel, confirm New run, check that `systemName()` is "Deep Root" and that `replayMatchesLive()` is still true.

Recommended (not blocking):
- In the result panel, the row reads "Root   Root cut at 8:12" because the label and value both say Root. Consider the label "Root" with the value "cut at 8:12" / "left standing", or no label at all.

VERDICT: REJECT
