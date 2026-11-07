## Round 1 · 2026-11-06

Pillar fit: Good. The Root reads as the H2 flavor text describes it: an upright pink stalk with a bud and two leaf blades in a small rock. At 24 px it is clearly not the round coral gear of the Bloom, and in game it is also half the Bloom's radius (45 vs 90 su). The vine is pink with a pale pulse travelling from Root to Bloom, and it goes thin, grey and slack when cut. The wilting thorn drifts, tumbles, shrinks and greys. The three signatures match the DESIGN.md H2 draw contract exactly (`drawRoot(ctx, r, t, cut)`, `drawVine(ctx, x1, y1, x2, y2, t, cut)`, `drawWiltingThorn(ctx, r, frac)`), so h2-client can code against them. The change doesn't alter how the game plays: client art only, no sim or data change, and the game doesn't call the new functions yet.

Quality: The change is small and touches only the four files listed for the task. The trig is client-only, as with the M1 placeholders, so determinism isn't affected. Problems:

1. **The cut vine fails the ART_STYLE contrast rule.** ART_STYLE says "every entity color must read against `#05070d` at 4.5:1 or better". `drawVine` draws the cut line in `withered` (5.02:1) but at `globalAlpha = 0.8`, so the colour you see is about `#636771`, which is **3.56:1**. It is also only 2 px wide. The grey vine is one of the four H2 readouts that make the choice weighable (DESIGN.md H2 item 4, "the vine ... goes grey when the Root is cut"), so it has to read on a phone. ART_STYLE.md doesn't mention the alpha either; it says "grey `#7a7f8a`, 2 px".
2. **The cut Root's rock contradicts the new ART_STYLE text.** The diff documents `rootRock` (1.91:1) as "low contrast on purpose, always drawn with an edge", with `rootRockEdge` at 5:1 carrying the contrast. When cut, the code swaps the edge to `witheredDark` (2.42:1), so neither the fill nor the edge reaches 4.5:1. In the 24 px gallery cell the cut rock almost disappears, and only the grey hook is left.
3. **The `drawRoot` doc comment says "Stays within r", but the alive glow doesn't.** The glow disc is centred at y = -0.1r with a radius of up to 0.99r, so it reaches about -1.09r. h2-client will place the thorn ring, label and hit area from r, as it does for the Bloom, so the stated bound has to be true.
4. **The new colours are missing from the ART_STYLE.md Palette table.** This is the same issue as m1-art round 1. The guide says the table is "mirrored in `palette.ts`; change both together". `rootRock`, `rootRockEdge`, `vine` and `vinePulse` appear only in a prose paragraph, not in the table.

Not required (noted for h2-client or later):
- `drawWiltingThorn` copies the star path from `drawThorn` and takes no `t`, so it starts at angle 0. A thorn handed over from the spinning ring would snap. The caller should rotate by the thorn's current angle (`t * 0.8`) before calling. A shared star-path helper would remove the duplication.
- At in-game vine lengths (Root to Bloom is about 128 to 158 screen px), `round(len / 110)` gives one pulse, crossing every 4.5 s or so. That fits "slowly", but the owner may find it sparse. Judge it in the h2-client build.
- The gallery's "root vs bloom" row draws both at the same r. In game the Root is half the Bloom's size, so a row at the true 1:2 ratio would be the honest comparison. At 96 px the two glows touch.

Phone: At 375x667 (DPR 2) the built `gallery.html` has scrollWidth 375 and no sideways scroll. All seven new rows render at 24, 48 and 96 px, and I inspected the screenshot. Root alive vs Bloom is distinct at 24 px. The cut vine is visibly dimmer than the M1 route lines.

Gates: I ran `npm run gates -- --base main` on `task/h2-art` (0365ede): PASS on typecheck, lint, test, determinism, bots and protected-files (4 changed files, none protected). `npm run build` passes and emits `dist/gallery.html`. `npm run smoke` passed 32 of 32 (desktop and phone).

Required changes:
- [ ] The cut vine's effective colour on `#05070d` is at least 4.5:1. For example, drop the 0.8 alpha (`withered` alone is 5.02:1). Update the ART_STYLE.md "Vine (cut)" row if the look changes.
- [ ] In the cut state, the Root's rock has an edge (or fill) at 4.5:1 or better, for example `withered` instead of `witheredDark`. That makes the "always drawn with an edge" note true in both states. Update the "Root (cut)" row to say so.
- [ ] `drawRoot` stays within radius r in both states, glow included, so it matches its doc comment and ART_STYLE ("The Root's draw is within radius r"). One way: glow radius at most 0.9r when centred at y = -0.1r.
- [ ] Add `rootRock`, `rootRockEdge`, `vine` and `vinePulse` to the ART_STYLE.md Palette table with their roles, matching `palette.ts`. The prose paragraph can stay or go.

VERDICT: REJECT
