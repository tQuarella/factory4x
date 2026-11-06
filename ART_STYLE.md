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
| Asteroid rock | `#8a7d6b` |
| Ore / resources / routes | `#4fd1c5` |
| Player ships | `#7ab8ff` |
| Mobs | `#ff5d73` |

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
