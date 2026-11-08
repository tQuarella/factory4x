# Review: h4-art

## Round 1 · 2026-11-08

Pillar fit: This is art only, inside the spec's "Art needs" draw contract. It doesn't change any rule or tunable. All five functions exist with the contract signatures and the contract state and id unions. The existing draw functions are untouched (only additions to `placeholders.ts`). The overworld reads well: in the 375x667 mock I rendered headless, reclaimed areas and owned lanes are clearly the player's, open areas invite a tap, and locked ones recede. The tier spike count reads at 24 px in colour.

Quality: The code is clear, sits inside the files it was given, and has no dead code. Editing `palette-sync.test.ts` falls outside the listed files, but it is required: acceptance 4 needs that test and its `roles` record is keyed by the palette. The new `h4-art.test.ts` is a real test. The recording context measures bounds across states, tiers, `t` and `frac`, and the pulse-direction test checks the motion. I rendered `gallery.html` in headless Chromium with no page errors. The bounds panel reports every area node at 1.000 r or less except tier 3 open at 1.002 r, every icon at 1.000 r or less, and lanes at 2.24, 2.24 and 4.00 px. The two 1.002 r and 4.00 px readings are antialiasing on spike tips and pulse dots that sit exactly on the limit, and the recording test, which uses exact geometry, passes them.

Defect: acceptance 2, "player amber marks reclaimed areas only", is not met, and the change's own documents say it is. ART_STYLE.md says: "An unreclaimed area never carries amber, so The Deep's centre `drawProbeCore(ctx, r * 0.45, t, 0)` draws its outline in pale `starBright`; amber appears only as `frac` rises." DECISIONS.md says the same. In `drawProbeCore`, at `frac` 0:
- the glow disc is filled with `palette.probeGlow` (`rgba(255, 210, 122, 0.25)`, the probe amber) at `globalAlpha` 0.25;
- the inner seed hexagon is filled with `palette.probeGlow` at full alpha, which is amber at 25%.
In the rendered mock and in the 24 px strip, the locked Deep's centre is a visible gold-brown seed on a warm halo. So an unreclaimed area carries amber, against both the criterion and the documented rule. The research card's core icon is fine, because it draws at `frac` 1.

Gates: I ran `npm run gates -- --base main` on `task/h4-art` at 08f1399, and every gate passed: typecheck, lint, test, determinism, bots and protected-files. No protected files changed. The depth flag "no fixed best opening" was missed, but that is an existing tuning flag, not a gate. Branch CI run 42485900524 was still in progress when I reviewed. It must be green before merge.

Required changes:
- [ ] `drawProbeCore` draws no amber (`probe`/`probeGlow` or any `#ffd27a`-derived colour) when `frac` is 0. That covers both the glow disc and the inner seed. Use a cool or neutral colour (for example `starBright` or `starDim` at low alpha) for the empty state, or scale the amber in with `frac` so that at 0 it contributes nothing. The documented behaviour already describes this; make the code match it.
- [ ] Add a test that records `fillStyle`/`strokeStyle` and asserts that `drawProbeCore(ctx, r, t, 0)` never uses `palette.probe` or `palette.probeGlow`. It should also assert that `drawAreaNode` in the `locked` and `open` states never uses `palette.probe`, `palette.probeGlow` or `palette.laneOwned`. That turns acceptance 2's amber rule into a checked property, not a claim.
- [ ] Re-render the gallery and confirm that The Deep's centre in the overworld mock shows no warm tint while it is locked or open.

Non-blocking notes (no action required for approval):
- The bounds panel prints "1.002 r (limit 1.000 r)" for tier 3 open. A reader may take that for a failure. A one-line note that the pixel scan includes antialiasing would help.
- At 24 px in greyscale, the locked-state spikes (0.35 alpha) almost vanish. In colour they still read, and the spec asks for "low alpha", so this is acceptable.

VERDICT: REJECT

## Round 2 · 2026-11-08

Pillar fit: The scope and the look are the same as in round 1. The only rendering change is to the empty probe core. On an unreclaimed Deep it now reads as a cool, pale outlined seed. Before, it was a gold-brown seed, so amber now marks only reclaimed areas and owned lanes, as the criterion requires.

Quality: The round 1 items are resolved.
- `drawProbeCore` at `frac` 0 draws its glow disc in `starBright` at 0.12 alpha and its inner seed in `starBright` at 0.3 alpha. It uses no `probe` or `probeGlow`. Amber appears once `frac` is above 0, which matches ART_STYLE.md and DECISIONS.md.
- `h4-art.test.ts` now records `fillStyle`/`strokeStyle` and checks four cases:
  - `drawProbeCore(..., 0)` never uses `probe`, `probeGlow` or `laneOwned` at several `t`;
  - locked and open area nodes, at every tier, never use them either;
  - a full core does use amber;
  - a reclaimed node does use amber.

  The positive cases keep the negative checks from passing on an empty style list.
- I re-rendered `gallery.html` in headless Chromium with no page errors. In the 375x667 mock, the locked Deep's centre has no warm tint. In the 24 px strip, the frac 0 core is cool and the 0.5 and 1 cores are amber.
- The bounds panel now notes that the pixel scan includes antialiasing.

The fix is small and has no dead code. It changed no other draw function, and the bounds tests still pass.

Gates: I ran `npm run gates -- --base main` on `task/h4-art` at cb67a8f, and every gate passed: typecheck, lint, test, determinism, bots and protected-files. No protected files changed. Branch CI run 42486320645 was in progress when I reviewed. Per acceptance 5, it must be green before `merge-task`. That is a precondition of the merge, not deferred work.

Required changes:
- None.

VERDICT: APPROVE
