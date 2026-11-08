# Art style

Owned by Art Direction. Every generated or procedural asset follows this guide. The palette here is mirrored in `packages/client/src/palette.ts`; change both together.

## Direction: "clean vector frontier"

Flat, readable vector shapes on deep space. Think engineering schematic meets bioluminescence: the player's industry is warm and geometric, the native mobs are hot-pink and organic. Readability on a 6-inch phone screen beats detail every time.

- **Silhouette first.** Every entity type is identifiable as a solid shape at 24 px.
- **Faction by color and geometry.** Player: amber and cyan, hard angles, hexagons and triangles. Mobs: red-pink, spikes and curves.
- **Glow means alive.** Soft radial glows mark active things (probe, mob factory). Inert things (rocks) have none.
- **Minimal texture.** At most one accent detail per sprite (an ore vein, a cockpit). No gradients except glows.
- **Top-down, no perspective.** Sprites face right (0 rad) so the renderer rotates them.

## Palette

| Role | Hex |
| --- | --- |
| Space background | `#05070d` |
| Dim star | `#3a4a66` |
| Bright star / UI text | `#cfe8ff` |
| Probe (player core) | `#ffd27a` |
| Probe glow | `rgba(255, 210, 122, 0.25)` |
| Asteroid rock | `#8a7d6b` |
| Ore / resources / routes | `#4fd1c5` |
| Player ships | `#7ab8ff` |
| Mobs | `#ff5d73` |
| Mob glow | `rgba(255, 93, 115, 0.25)` |
| Route line | `rgba(79, 209, 197, 0.6)` |
| Bloom body (alive) | `#ff4f8b` |
| Bloom highlight / core | `#ffb3cc` |
| Bloom glow | `rgba(255, 79, 139, 0.28)` |
| Withered Bloom rock (captured) | `#7a7f8a` |
| Withered Bloom outline (outline only, low contrast) | `#4a4e58` |
| Thorn | `#ff5d73` |
| Thorn core | `#ffd0d6` |
| Backed-up route | `#ffd27a` |
| Hit flash | `#ffffff` |
| Root rock fill (low contrast; always drawn with an edge) | `#4a3a47` |
| Root rock edge (5:1) | `#94788a` |
| Vine (alive) | `#d93d78` |
| Vine pulse | `#ffb3cc` |

Contrast check: every entity color must read against `#05070d` at 4.5:1 or better.

## Placeholders

Until an image service is chosen, `packages/client/src/placeholders.ts` draws each entity procedurally: probe (rotating double hexagon with glow), asteroid (seeded irregular polygon with an ore dot), ship (arrowhead), mob (spiked star with glow). Each draw function renders centered at the origin with radius `r`, so a sprite can replace it one for one.

## Prompt template (for when generation is wired up)

```
Top-down 2D game sprite of {subject}, flat vector style, clean hard edges,
{faction_palette}, single accent detail: {accent}, centered, facing right,
transparent background, no text, no shadow, no perspective, readable at 24px.
```

- `faction_palette` (player): "amber #ffd27a and cyan #4fd1c5 on dark"
- `faction_palette` (mob): "hot pink #ff5d73 with soft glow, organic spiked forms"

Generated assets go in `assets/<entity>/<name>.png` at 128×128 and 256×256, with the prompt and seed in `assets/<entity>/<name>.json` so they can be regenerated.

## M1 entities

Draw functions live in `packages/client/src/placeholders.ts`; `packages/client/gallery.html` (built, not linked from the game) shows each at 24, 48 and 96 px on the space background.

| Entity | Look | 24 px read |
| --- | --- | --- |
| Probe | amber double hexagon, soft glow | glowing amber hex |
| Asteroid | grey-brown seeded rock, one teal ore dot; pips below the rock, filled teal = extractor, hollow = free slot | rock with a row of dots |
| Bloom (alive) | hot-pink `#ff4f8b` coral: round body, 8 stubby arms, pale core, pink glow, slow breathing | pink round gear, big glow |
| Bloom (captured) | grey `#7a7f8a` rock, no glow, teal ore veins | grey with a teal Y |
| Thorn | red-pink 4-spike seed-pod, spins, stays within r; low hp shrinks and dims it (no ring, so 12 of them stay quiet) | spiky star, never a disc |
| Ship | blue arrowhead | unchanged |
| Pod | teal dot with halo | dot, rounder than a thorn |
| Route | teal line, 1.5 + 1.5 x level px; backed up = dashed amber | thin line vs dashes |
| Rally flag | amber pennant on a pale pole, centered within radius r (pole spans +0.9r to -0.9r) | flag |
| Hit flash | white ring plus core, fades with frac | ring |
| Root (alive) | upright hot-pink stalk with a bud and two leaf blades, sunk in a small dark rock, faint glow, slow sway; smaller than the Bloom. Its thorns are `drawThorn` | tall pink sprout, not a round gear |
| Root (cut) | same shape in grey `#7a7f8a` with a grey `#7a7f8a` rock edge (5:1), stalk drooped, leaves folded, no glow | grey drooping sprout |
| Vine (alive) | `#d93d78` line, 3.5 px, gentle wave, pale pulses (`#ffb3cc`) travelling Root to Bloom at about 0.22 of the length per second | pink line with moving dots |
| Vine (cut) | grey `#7a7f8a` at full opacity (5:1), 2.5 px, sagging, no pulses | thin grey slack line |
| Wilting thorn | a thorn drifting down, tumbling, shrinking and greying while fading (frac 0 to 1) | spiky star fading to grey |

H2 palette additions: `rootRock` `#4a3a47` (the Root's rock fill; low contrast on purpose, always drawn with an edge), `rootRockEdge` `#94788a` (rock outline, 5:1 on space), `vine` `#d93d78` (vine line), `vinePulse` `#ffb3cc` (same as Bloom highlight; pulses). Cut states reuse `withered`. The Root and its glow stay within radius r in both states.

Root vs Bloom: the Bloom is a round coral with a big glow; the Root is a tall, narrow, upright silhouette with a rock base. Never draw the Root round. The Root's draw is within radius r, with the stalk on the vertical axis (up is -y), so the renderer must not rotate it. The vine is drawn in world coordinates with an untranslated context.

Rules: pink glow and round coral mean the Bloom, spikes mean thorns (shape, not only color). Amber is reserved for the player's probe, rally flag and backed-up routes.
