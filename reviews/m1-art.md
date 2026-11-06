## Round 1 · 2026-11-06

Pillar fit: Good overall. The Bloom reads as the Designer's flavor text describes it: a glowing pink coral that withers to grey with teal ore showing. Thorns are spiky seed-pods, not discs. Player-side colors stay amber/teal/blue. All entity colors pass 4.5:1 against `#05070d` (Bloom 6.5, withered 5.0, thorn 6.8; `witheredDark` is 2.4 but only used as an outline). It doesn't change how the game plays. All nine signatures match AC1 exactly, so m1-client can code against them.

Quality: The code is clear and small, with sensible shared helpers (`disc`, `rockPath`). Edits outside the listed files are minimal and justified: `main.ts` (one call updated for the new `drawAsteroid` signature), `vite.config.ts` (gallery as a build input, needed for AC3), and `DECISIONS.md`. Three problems, two of them visible in the gallery itself:

1. **`drawRallyFlag` breaks the AC1 contract.** AC1 says every function draws "centered at the origin with radius r". The flag's base is at the origin and it extends to y = -2r and x = +1.4r. m1-client is built in parallel against the stated contract, so a node's flag will land off-center and twice the expected height. In the gallery the 96 px flag runs into the pod row.
2. **The thorn health arc hurts readability and breaks the radius contract.** At hp 1 every thorn carries a full pale ring at 1.15r plus line width, so it draws outside r. At 24 px "thorn hp 1" reads as a ringed token, and it looks a lot like "hit 0.5" (a pale ring with a center dot). On the map the Bloom carries 12 thorns, so 12 pale rings would outweigh the pink spikes that are supposed to say "thorns" (ART_STYLE: "spikes mean thorns (shape, not only color)"). DESIGN.md doesn't ask for per-thorn hp on the map (the map asks for "one spike per thorn"; thorn hp goes on the sheet as numbers). Shrinking and dimming already shows low hp.
3. **The palette table in ART_STYLE.md wasn't updated.** The guide says "The palette here is mirrored in `palette.ts`; change both together", and the Art Direction role is to keep them identical. Nine colors were added to `palette.ts`, but only two hex values appear in ART_STYLE.md (in the entity table prose), and the Palette table doesn't have them.

Phone: At 375 px the gallery canvas is 420 px wide (100 label + 64 + 96 + 160), so the 96 px column is clipped and needs a sideways scroll. AC3 exists so the owner can check readability on a phone, so it has to fit. Also, the 96 px pod halo (1.7r = 82 px) and the rally flag overlap neighbouring rows, which makes those cells hard to judge.

Gates: I ran `npm run gates -- --base main` on the branch: all PASS (typecheck, lint, test, determinism, bots, protected-files: 8 changed files, none protected). `npm run build` passes and emits `dist/gallery.html`. Screenshots (vite preview, Pixel 7 full-page and 375 px) were inspected; the server is stopped.

Required changes:
- [ ] `drawRallyFlag(ctx, r)` draws within radius r of the origin, centered (for example, pole from y = +r to y = -r, pennant in the upper half). Update the ART_STYLE.md row ("base at the origin") to match.
- [ ] `drawThorn` stays within radius r at every hpFrac, and a full-health thorn has no closed ring around it. Either remove the arc (shrink and dim already encode hp) or draw only a short arc that appears when damaged, inside r. Update the ART_STYLE.md thorn row to match. At 24 px, "thorn hp 1" must not look like "hit 0.5".
- [ ] Add every new `palette.ts` color (`bloom`, `bloomHi`, `bloomGlow`, `withered`, `witheredDark`, `thorn`, `thornCore`, `routeBackedUp`, `flash`) to the ART_STYLE.md Palette table with its role, so the two stay mirrored.
- [ ] The gallery shows all three size columns at true pixel size without horizontal scrolling at 375 px wide (for example, labels above each row instead of a 100 px label column). No sprite overlaps a neighbouring row (raise the row height or space rows by the largest drawn extent).

Not required (noted only): the old "Placeholders" paragraph in ART_STYLE.md still lists only the pre-M1 entities, and `drawMob` survives only for the current `main.ts` demo scene. m1-client will replace that scene; clean up `drawMob` then.

VERDICT: REJECT
