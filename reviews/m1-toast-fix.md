# Review: m1-toast-fix

## Round 1 · 2026-11-06

I reviewed `git diff main...task/m1-toast-fix` at commit 25371ca, which branches from main 71cec57. The change touches `index.html`, `style.css`, `main.ts`, `tests/smoke/boot.spec.ts`, plus the new `DECISIONS.md` and `BACKLOG.md` entries. All changes stay inside the task's file list.

**The fix.** `#toast` moves out of the absolutely positioned overlay and into the `#notices` strip above the canvas, in normal flex flow. The canvas is fitted to whatever height remains, so where the notices sit no longer depends on text metrics, which is acceptance criterion 1.
- The strip is capped at 45% of the map height and clips anything beyond that.
- The toast shrinks to fit, never below 44 px, and scrolls inside.
- The dead `#hint ~ #toast` rule is gone.
- The toast is now a `div` with `role="button"` and `tabindex="0"`, with click, Enter and Space all dismissing it. The DECISIONS entry explains this choice (WebKit doesn't reliably scroll inside a `<button>`) and the alternatives that were rejected.

**Gates.** I ran them on the branch myself:
- `npm run gates -- --base main`: all six passed. Determinism is still 35d8f54c, and protected-files reports 6 files changed, none protected.
- `npm run build`: passed.
- `npm run smoke`: run twice, 32/32 passed both times.

**Reproducing the CI failure.** I temporarily checked out 71cec57's `style.css` and `index.html`, rebuilt, and ran only the new "even with a wide font" tests.
- Against the old layout, all four failed on Windows. Three failed with "#toast overlaps the Bloom", the same symptom as Linux CI, and one with "#toast sits above the map".
- With the branch files restored, all four passed. The working tree was clean afterwards.
- So the stress font makes the smoke test catch on Windows what only Linux CI caught before, which is acceptance criterion 3.

**Play.** I played a repelled wave, A5 staging, "Attack with all" and a capture, then reloaded and sent feedback, at 375×667, 375×812 and 812×375. The screenshots are `crit-tf-*.png` in the session scratchpad.
- The toast sits above the canvas at every size and never overlaps a node.
- The probe is no longer covered: tapping it with a toast up selects the probe.
- One tap on the toast dismisses it.
- Result panel, waves sent (2), reload, replay match and feedback all behave as in m1-client round 3.
- There were no console errors.

**How the map resizes.** This is the cost of the fix, and it is real.
- While a toast is up, the canvas loses the toast's height:

  | Size | Canvas height | Bloom moves | Probe moves |
  | --- | --- | --- | --- |
  | 375×667 | 270 → 203 px (−25%) | down 53 px | 7 px |
  | 375×812 | 350 → 283 px | down 53 px | — |
  | Landscape | 375 → 308 px | down 53 px | — |

- Everything moves back when the toast is dismissed.
- The toast stays until it is tapped, so the smaller map persists after every battle. At 375×667 with a sheet open, the labels crowd: A5's label sits on the Bloom's ring, PROBE overlaps the A1/A2 badges, and the BLOOM label is clipped at the top edge of the canvas (`crit-tf-p667-03-toast-repelled.png`).
- A tap aimed at A5 at the instant a toast appears can land on the Bloom. That only opens a sheet; no action fires.
- I accept this for a broken-main fix. It is logged as a trade-off and is no worse in kind than the banner jump already on the Designer's list. The jump is now larger, though.

**Accessibility.**
- Role, focusability and keyboard handling are correct.
- One regression: the static `aria-label="Battle report, tap to dismiss"` now names the button. Children of a `role="button"` are presentational, and an `aria-label` overrides them as the accessible name. Playwright's snapshot shows the name as only "Battle report, tap to dismiss", with the report text demoted to content that screen readers may not announce. The old `<button>` was named by its text, so the report was read.
- The fix is to drop the `aria-label`. The visible "(tap to dismiss)" suffix already carries the instruction.
- Neither version is a live region, so a report isn't announced when it appears.
- None of this affects touch play, the owner's playtest or any acceptance criterion, so I am not holding the fix to restore main on it.

**Pillars and determinism.** The change is layout only, with no sim or data change. It doesn't change how the game plays beyond the map resize described above.

**Acceptance.** All four criteria are met:
1. Placement is independent of metrics, and the stress tests prove it.
2. Targets are at least 44 px, and the toast still dismisses with one tap.
3. The stress font fails against the old layout on Windows and passes with the fix.
4. Gates, build and smoke (twice) are green.

### Follow-ups (Director: add to the backlog)

- **Toast accessible name.** Remove `aria-label` from `#toast` so its accessible name is the report text. Consider `aria-live="polite"` on `#notices`.
- **Map resize (Designer).** The map shrinks and jumps 53 px whenever a toast is up, and stays that way until it is dismissed. The options are:
  - keep this;
  - reserve a fixed notices strip so the canvas never resizes for the banner or the toast;
  - auto-dismiss the report after a while, which changes the spec's "stays until tapped".
- **BLOOM label clipped.** It is clipped at the top of the canvas when the map is short (375×667 with a sheet and a toast). `fitMap`'s top margin doesn't cover the label at small scales.

VERDICT: APPROVE
