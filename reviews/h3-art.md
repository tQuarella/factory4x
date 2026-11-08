# Review: h3-art

## Round 1 · 2026-11-07

Reviewed commit 8847e96 on `task/h3-art` in a separate worktree. I built the gallery (`npm run build`), served it with Vite and screenshotted it in Chromium at 375 px wide (DPR 3). I looked at every row. I also rendered each new draw function at r = 50 on an offscreen canvas and measured the furthest painted pixel (alpha > 8) from the centre, as a multiple of r.

Pillar fit: good. The art serves the H3 claim: ship types differ by shape (chevron, needle, block), Spores are round and Thorns are spiky, and the guard ring shows the mix at a glance. Nothing changes how the game plays. The only in-game visual change is the drone at 0.85 scale, which the spec asks for ("slightly smaller").

Acceptance criteria:
1. Draw contract: met. `drawShip(ctx, r, heading, type = 'drone')`, `drawSpore`, `drawGuardRing`, `drawPocket`, and `drawResourceIcon` for all five kinds exist with the spec's parameter order. The existing caller (`view.ts:286`, three arguments) still compiles and draws a drone. Note: the spec writes `drawShip(ctx, r, t, type)`, but here the third argument is the heading, as it was in H1 and H2. ART_STYLE.md documents this, and keeping it is the right call for backward compatibility. Director: please make DESIGN.md's draw contract say "heading" so h3-client doesn't pass the clock and make the ships spin.
2. Ships by shape: met. In the greyscale 24 px strip, the chevron, needle-with-fins and ring block are clearly different. Spore `#e056d6` is a magenta in the mob family, about 6.2:1 on space (the contrast test passes), and is not amber, teal or blue. Spore and Thorn are clearly distinct, round versus spiky.
3. Icons and ring: met for the criterion as written. Ice (pale cyan flake), crystal (violet shard), ore (teal chunk) and the mob pinks are distinct in colour and shape. The guard ring's outer edge is at r (measured 1.01r at r = 50; 1.04r at r = 12, which is anti-aliasing) and its two colours read at 24 px.
4. Palette sync and contrast: met. 5 new keys, 5 rows, `palette-sync.test.ts` updated, 49/49 pass. No new allow-list entries.
5. Gallery and gates: partly met. Every new entity appears at 24, 48 and 96 px, the page is 375 px wide with no sideways scroll, and there are no console errors. However, two comparison rows overflow their cells (see required change 2). Branch CI was still running at review time and must be green before merge.

Quality:
- ART_STYLE.md says "Every draw is centred and stays within radius r", and the docstrings for `drawShip` and `drawResourceIcon` say the same. Three shapes break it. Measured furthest pixel: lancer 1.08r (tail fins at (-r, ±0.42r)), flak 1.21r (rear corners at (-0.8r, ±0.9r)), plating icon 1.18r (plate corners at (±0.78r, -0.9r)). Ice and crystal reach 1.05r because of round line caps (`lineCap = 'round'` is set for the whole icon function, including the crystal's centre stroke that ends at y = r). Drone 0.85r, spore 1.00r, pocket 0.98r and ore 0.91r are fine. h3-client will size HUD chips and ship spacing from this contract, so it has to be true.
- Gallery row "guard ring splits 100/0, 50/50, 25/25, 10/40": `ringSet` spans 3 × 1.1r + r = 4.3r, which is 206 px at the 96 px size, wider than its 180 px cell. At 96 px the 10/40 ring is cut off by the right edge of the canvas, and the 48 px cell's 10/40 ring collides with the 96 px cell's 100/0 ring. I was asked to inspect exactly these splits, and they can't be read reliably.
- Gallery row "pocket alive (left) vs bloom heart (right)": the 96 px heart (drawn at 0.9r, offset 0.9r) reaches past the canvas edge and is clipped, and the 48 px heart runs into the 96 px pocket.
- The two strip rows are labelled "(24 / 48 / 96)", but they show one size only.
- `gallery.ts`: the new code uses double quotes while the rest of the file uses single quotes. `strip(c, _r, grey)` takes a parameter it never uses. `type ResourceKind` is imported in the middle of the alphabetical function imports.

Non-blocking notes (no change required this round):
- The greyscale strip uses `ctx.filter`, which Safari does not support. On an iPhone that row shows in colour. The check is done in Chromium, so this is acceptable for a dev page.
- The plating icon (three slanted bars) looks like a "hamburger" menu glyph. In a HUD chip next to tappable controls, players might read it as a menu. Worth a look when h3-client places the chips.
- Ice `#bdf3ff` and lens (`starBright` `#cfe8ff`) are both near-white. Their shapes differ (flake versus ring), so this is fine.

Gates: `npm ci` then `npm run gates -- --base main` on the branch (Windows 11, Node 26): typecheck, lint, test, determinism, bots and protected-files all PASS. No protected files touched. No sim, data or determinism impact.

Required changes:
- [ ] Keep every new draw within radius r, as ART_STYLE.md and the docstrings promise: lancer, flak and the plating icon must measure ≤ 1.0r at any heading. Ice and crystal must not exceed r by more than anti-aliasing: pull in the stroke ends, or use butt caps for the crystal's centre line. Keep the three ships telling apart by shape in the greyscale strip.
- [ ] Fix the "guard ring splits" gallery row so all four rings sit fully inside their cell at 24, 48 and 96 px with no overlap between cells and no clipping at the canvas edge. For example, shrink the per-ring radius or the spacing, or give the row its own layout.
- [ ] Fix the "pocket alive vs bloom heart" row the same way: both shapes fully inside each cell at every size.
- [ ] Label the strip rows correctly (for example "24 px strip, colour"), without the "(24 / 48 / 96)" suffix.
- [ ] In `gallery.ts`, use single quotes like the rest of the file, remove the unused `_r` parameter from `strip`, and import `type ResourceKind` in a tidy place.
- [ ] Branch CI green on the fixed commit.

VERDICT: REJECT
