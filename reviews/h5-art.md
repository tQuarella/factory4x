# h5-art

## Round 1 · 2026-11-08

Scope: `git diff main...task/h5-art` (ee66b9f), one commit. It touches `placeholders.ts`, `gallery.ts`, `gallery.html`, `ART_STYLE.md` and a new `packages/client/test/h5-art.test.ts`. `palette.ts` is unchanged. Everything is inside the task's file list, and no protected file is touched. I checked it against BACKLOG "h5-art" and DESIGN.md "Art needs" and "Draw contract" (H5).

**Acceptance:**
1. **Met: draw contract.** `drawFleetIcon(ctx, r, full: boolean)`, `drawRecycleIcon(ctx, r)`, and `ResearchIconId` now includes `'fleet'`. Existing research ids take the same path as before: the `'fleet'` branch only swaps the inner drawing. typecheck passes on all packages.
2. **Met: told apart at 24 px, and the amber rule.** I loaded the gallery in Chromium and inspected the H5 24 px strip in colour and greyscale.
   - In greyscale the four new icons read by shape: open brackets round a trio (fleet); a closed box round a trio (full); a ring of arrows (recycle); a dashed square round a trio (research fleet).
   - The H4 research icons hold one ship (lancer and flak), a chip with a plus, a drill, a mast, speed lines or a hex core, so none is confused with the new ones.
   - The closest pair is fleet vs research fleet (brackets vs dashed square). They still separate at 24 px, and they never appear in the same context: one is the HUD chip, the other a research card.
   - Amber appears only in the full bracket. `h5-art.test.ts` records `fillStyle`/`strokeStyle` and checks that no amber key appears in the normal, recycle or research icons, and that the full icon has amber with blue chevrons.
3. **Met: bounds.** The gallery's pixel scan reads fleet and full 0.993 r, recycle 0.865 r, research fleet 0.933 r. The recording-context test measures exact geometry, line half-width included, at r = 50 and r = 12. All are within r.
4. **Met: palette.** There are no new palette keys, so this holds trivially. Reused colours (`ship`, `probe`, `starBright`, `asteroidOre`) keep their roles, and ART_STYLE.md's amber rule is extended to name the full bracket.
5. **Met: gallery and gates.** The gallery shows each icon at 24/48/96, the 24 px colour and greyscale strips, and a 375 px HUD mock. The mock has ship chips plus the fleet chip normal, full and at 16 px text, a Recycle chip and a Command limit card. It fits within 375 px (rightmost edge about 336 px), and the gallery logged no console errors.
   - Gates, run by me on the branch: `npm run gates -- --base main` passes (typecheck, lint, test, determinism, bots, protected-files).
   - Branch CI run 42501474896: green (gates and deploy).

**Pillars and vision.** Art only. Nothing changes how the game plays. The icons follow the spec's metaphors: a fleet in a bracket, scrap back into ore in teal, a blueprint square for research. The full state is told apart by shape (open vs closed bracket) as well as colour, which is the right call for colour-blind players and the greyscale check.

**Determinism.** Client draw code only. `Math.cos`/`Math.sin` in `drawRecycleIcon` are in the client, not the sim, and lint passes.

**Code quality.** Clear and small. `chevronPath` and `fleetChevrons` are shared by the fleet and research icons rather than duplicated. The comments match the geometry.

**Non-blocking notes (Director: backlog if wanted):**
- The gallery row "research icons, all eight" overflows its cells and overlaps the neighbouring sizes at 48 and 96. This is pre-existing: the old "all seven" row did the same, since its spacing at r × 4 is wider than a cell. It only affects the gallery, never the game, and the 24 px strips are the real check.
- The HUD mock is a canvas mock, not the real DOM chip, so the real wide-font fit is h5-client's phone check, as the spec assigns it.

Required changes: none.

VERDICT: APPROVE
