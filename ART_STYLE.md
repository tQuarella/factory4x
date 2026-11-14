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
| Spore | `#e056d6` |
| Spore glow | `rgba(224, 86, 214, 0.28)` |
| Ice icon | `#bdf3ff` |
| Crystal icon | `#b79cff` |
| Plating icon | `#a8b3c7` |
| Locked area rock | `#707b90` |
| Closed lane | `#707b90` |
| Open lane | `#9fb4d4` |
| Owned lane | `#ffd27a` |
| Economy ship hull | `#f0a83a` |

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

## H3 entities

Counter-web content. Every draw is centred and stays within radius r (measured at r = 50 on an offscreen canvas, every shape is at most 1.01r, which is anti-aliasing). The gallery shows each at 24, 48 and 96 px at 375 px width, plus a 24 px strip in colour and in greyscale.

| Entity | Draw | Look | 24 px read |
| --- | --- | --- | --- |
| Drone | `drawShip(ctx, r, heading, 'drone')` | the blue arrowhead at 0.85 scale | small chevron |
| Lancer | `drawShip(..., 'lancer')` | long narrow blue needle, pale bright tip | thin line with a dot at the end |
| Flak | `drawShip(..., 'flak')` | short wide blue block, dark ring and pale centre dot | chunky block |
| Spore | `drawSpore(ctx, r, t, hpFrac)` | magenta round puff, pale highlight, ring of 8 dots orbiting at r; hp shrinks and dims it | round dotted disc, never spiky |
| Guard ring | `drawGuardRing(ctx, r, thornShare, sporeShare, t)` | ring of width 0.16r (min 2.5 px), outer edge at r: Thorn `#ff5d73` arc then Spore `#e056d6` arc, each a share of the full circle (a sum over 1 is scaled to fit), from 12 o'clock | two-colour ring |
| Pocket (alive) | `drawPocket(ctx, r, t, true, prize)` | dark rock with a pale edge, three pink pointed fronds, faint glow, prize icon on a dark centre; smaller than the heart | rock with pink spikes and a bright icon |
| Pocket (captured) | `drawPocket(ctx, r, t, false, prize)` | grey rock with the prize icon, no fronds, no glow | grey rock with an icon |
| Ore icon | `drawResourceIcon(ctx, r, 'ore')` | teal faceted chunk | teal chunk |
| Ice icon | `'ice'` | pale cyan six-spoke flake | pale snowflake |
| Crystal icon | `'crystal'` | violet tall faceted shard, pale top facet | violet diamond |
| Lens icon | `'lens'` | pale ring with a centre dot | ring |
| Plating icon | `'plating'` | three stacked flat steel-grey diamonds with dark edges | layered diamonds, not menu bars |

Notes:
- `drawShip`'s third argument is the heading in radians, as in H1 and H2, and the type defaults to `'drone'`, so old callers keep working. Ships are told apart by shape alone: chevron, needle, block.
- Spore `#e056d6` is a magenta in the mob family (bluer and hotter than Thorn `#ff5d73` and Bloom `#ff4f8b`); it is not amber, teal or player blue. Ice and crystal are the cool family; the crystal violet is lighter and bluer than the Spore magenta.
- New palette entries: `spore`, `sporeGlow`, `ice`, `crystal`, `plating`. Lens reuses `starBright`; ore reuses `asteroidOre`.

Rules: pink glow and round coral mean the Bloom, spikes mean thorns (shape, not only color). Amber is reserved for the player's probe, rally flag, backed-up routes, (H4) reclaimed areas and owned lanes, and (H5) the full fleet bracket.

## H4 entities

Overworld content for the Reclaim ladder. Draw functions are in `packages/client/src/placeholders.ts`; every draw is centred (lanes excepted) and its bounds are measured in the gallery (`packages/client/gallery.html`, a pixel scan at r = 50) and in `packages/client/test/h4-art.test.ts` (a recording context). The gallery also shows a 24 px strip in colour and greyscale and an overworld mock at 375x667.

| Entity | Draw | Look | 24 px read |
| --- | --- | --- | --- |
| Area node | `drawAreaNode(ctx, r, t, tier, state)` | four rocks round an open centre (the caller puts the prize icon there); `tier` 0-3 is the count of pink Bloom spikes on the rim while held | rock cluster, spikes count the tier |
| Area `locked` | `state 'locked'` | rocks in `areaLocked` at 0.6 alpha, spikes at 0.35 alpha, no ring | dim blue-grey cluster |
| Area `open` | `state 'open'` | tan rocks, full pink spikes, a pale dashed ring whose alpha breathes | cluster in a dashed ring |
| Area `reclaimed` | `state 'reclaimed'` | amber rocks, no spikes, a steady solid amber rim | amber cluster in a solid ring |
| Lane | `drawLane(ctx, x1, y1, x2, y2, t, state)` | `closed` dim dotted; `open` dashed `laneOpen`; `owned` solid amber with white comet pulses (head plus two fading tail dots) moving from (x1, y1) to (x2, y2) | dots, dashes, solid line with a moving head |
| Research lancer / flak | `drawResearchIcon(ctx, r, 'lancer' \| 'flak')` | the ship (`drawShip`) in a dashed pale blueprint square | needle vs ringed block in a square |
| Research opening | `'opening'` | teal ore chip with a pale plus top right | chip with a plus |
| Research extract | `'extract'` | steel drill bit pointing down, dark thread cuts, teal tip | spiral cone |
| Research rigs | `'rigs'` | teal extractor mast with a pump head on a flat rock | T on a mound |
| Research yards | `'yards'` | blue chevron with three pale speed lines | arrow with trailing lines |
| Research core | `'core'` | `drawProbeCore(ctx, r, 0, 1)` | amber hexagon |
| Probe core | `drawProbeCore(ctx, r, t, frac)` | hexagon round a smaller hexagon with a soft glow; `frac` 0 to 1 fills the hexagon from the bottom up, a pale outline turning amber at 1 | outlined hex, filling amber |
| Stockpile | `drawStockpileIcon(ctx, r)` | steel crate with a lid band and X brace, ore / ice / crystal pips on top | crate with three dots |

Rules:
- **Bounds.** The area node, spikes included, stays within r. Lanes stay within 4 px of their segment (line 3 px, pulse dots at most 3.2 px radius). Research icons, probe core and crate stay within r. The recording-context test checks these at several `t` and `frac`; the gallery shows the pixel-scan numbers.
- **Amber marks reclaimed areas only** on the overworld: the reclaimed rim and rocks, and the owned lane (which joins two reclaimed areas). An unreclaimed area never carries amber, so The Deep's centre `drawProbeCore(ctx, r * 0.45, t, 0)` draws its outline in pale `starBright`; amber appears only as `frac` rises.
- **Tier is shown by spikes and by the caller's r**, and only while held; a reclaimed area has no spikes, so its tier reads from size and position.
- **Locked and open differ by more than hue**: ring (open only), spike strength, rock tone. Checked in the greyscale strip.
- The caller trims lane ends to the node rims and orders them so pulses flow toward Landfall.
- New palette entries: `areaLocked` and `laneClosed` (`#707b90`, 4.7:1; the dimness comes from alpha, so the colour passes the contrast test), `laneOpen` (`#9fb4d4`), `laneOwned` (`#ffd27a`, same as the probe). Everything else reuses existing colours.

## H5 entities

Fleet cap icons. Draw functions are in `packages/client/src/placeholders.ts`; bounds are measured in the gallery (pixel scan at r = 50) and in `packages/client/test/h5-art.test.ts` (recording context, at r = 50 and r = 12). The gallery also shows a 24 px strip in colour and greyscale (the new icons beside the H4 research icons they must not be mistaken for) and a mock HUD row at 375 px (ship chips and the fleet chip, normal, full and at 16 px text). No new palette entries: everything reuses existing colours.

| Entity | Draw | Look | 24 px read |
| --- | --- | --- | --- |
| Fleet icon | `drawFleetIcon(ctx, r, full)` | three `ship` blue chevrons in a triangle (one ahead, two behind) between an open bracket "[ ]" in pale `starBright` (0.85 alpha) | blue trio between two brackets |
| Fleet icon, `full` | `full = true` | the same chevrons; the bracket closes into a rectangle and turns amber (`probe`) | blue trio in an amber box |
| Recycle icon | `drawRecycleIcon(ctx, r)` | two teal (`asteroidOre`) arrows chasing each other round a circle, one `ship` blue chevron in the middle | circular arrows round a point |
| Research `fleet` | `drawResearchIcon(ctx, r, 'fleet')` | the fleet's three chevrons (no bracket; the square is the frame) in the dashed pale blueprint square used by lancer and flak | blue trio in a dashed square |

Rules:
- **Bounds.** All three stay within r (measured: fleet 0.993 r, recycle 0.865 r, research fleet 0.933 r at r = 50).
- **Amber** appears only in the full fleet bracket (the fleet chip at the limit: amber means "yours, and at its limit"). The normal fleet icon, the recycle icon and the research icon use none, which the test checks. The chevrons stay blue in both states.
- **Full is told apart by shape as well as colour**: an open bracket vs a closed box, so it reads in greyscale and for colour-blind players. Callers should also change the chip text, not only the icon.
- **Told apart at 24 px** (greyscale strip): fleet = brackets round a trio; full = a closed box round a trio; recycle = a ring of arrows; research fleet = a dashed square round a trio (lancer and flak hold one ship, opening is a chip with a plus). The recycle icon is ore teal, since it turns ships into ore.
- **Callers.** The fleet chip draws `drawFleetIcon` at about r = 12 beside its text, with `full = true` when `fleetStatus.full`. The Command limit card uses `drawResearchIcon(ctx, r, 'fleet')` like the other research cards, or `drawFleetIcon` for the sheet header. The Recycle button uses `drawRecycleIcon`.

## H6 entities

Open frontier: the command relay, band locks, unscouted areas, lane reveal. Draw functions are in `packages/client/src/placeholders.ts`; bounds are checked in `packages/client/test/h6-art.test.ts` (recording context, at r = 50 and r = 12) and the gallery (`packages/client/gallery.html`: a 24 px strip in colour and greyscale with each new draw beside the area node, fleet icon and "!" badge, plus each at 24, 48 and 96 px). No new palette entries: everything reuses existing colours.

| Entity | Draw | Look | 24 px read |
| --- | --- | --- | --- |
| Relay icon | `drawRelayIcon(ctx, r)` | a mast on a small foot, a pale `starBright` lamp at its head, three concentric `ship` blue arcs fanning up from the lamp (a command beacon) | a blue broadcast mast, arcs over a stick |
| Lock badge | `drawLockBadge(ctx, r)` | a padlock: steel-grey (`plating`) chamfered body with a dark keyhole, an amber (`probe`) shackle, a dark outline; `r` is the badge's own half-size; callers pass 0.5 of the node's r and centre it at the node's upper right, (0.7 r, -0.7 r) (see Callers) | grey block under an amber hoop |
| Relay mark | `drawRelayMark(ctx, r, alpha = 1)` | the relay icon at 0.86 scale on a dark `space` disc of 0.96 r, the whole at `alpha`; callers pass 0.5 of the node's r and centre it at the node's upper left, (-0.7 r, -0.7 r) (see Callers) | a blue beacon on a dark dot |
| Area `far` | `drawAreaNode(..., 'far')` | the node's dark backing disc, then hollow `areaLocked` rock outlines at 0.5 alpha (no rock fill), no spikes, no ring; the centre stays empty (see Far node centre) | a ghost cluster of outlines |
| Lane modes | `drawLane(ctx, x1, y1, x2, y2, t, state, mode = 'normal', reveal = 100)` | `dim` the state at 0.32 alpha with no pulses; `normal` as H4; `reveal` the state (pulses too) growing from (x1, y1) to `reveal` percent (0..100, clamped) with a white (`flash`, 0.9 alpha, 3.2 px) spark at the front, the rest of the lane dim at 0.32 alpha | faint line; bright line; bright line with a bead running along it |
| Band pill | `drawBandPill(ctx, w, h)` | a dark `space` pill at 0.78 alpha with a faint `starDim` edge, centred at the origin; text `starBright`, or `areaLocked` for a locked band | label on a dark capsule |
| Band divider | `drawBandDivider(ctx, x1, y, x2)` | a dotted `starBright` hairline at 10% alpha | barely there |

Rules:
- **Bounds.** The relay icon, relay mark and lock badge stay within their own r; every area state stays within r; every lane mode stays within 4 px of its segment (the spark is a 3.2 px disc). The recording-context test checks these at several `t`, tiers and reveal values (including out-of-range).
- **Relay is told apart** from the area node (rocks, no arcs), the fleet icon (chevrons in brackets, no mast) and the "!" badge (a pill): by its vertical mast and the arcs, in blue only, with no amber and no pink (checked by test). A reclaimed relay reads as "amber rim, haul icon in the centre, blue beacon at the upper left".
- **Lock is told apart** from the "!" badge (an amber pill with a dark glyph, drawn at the upper left of in-area nodes only, so it never shares an overworld node with the relay mark): the lock has a grey body with an amber hoop on top, a different outline, and sits on the upper right. Amber appears only on the shackle, so a locked node stays free of amber rocks and rim, and the amber-marks-reclaimed rule for areas holds (checked: `locked`, `open` and `far` node draws use no amber).
- **Far is told apart from locked** by shape (hollow outlines vs filled rocks and faint spikes), not only by tone, so it reads in greyscale. Far has no ring, so it never invites a tap.
- **Callers: what a node shows.** The relay mark is added to the node, never a replacement for the haul icon. Layout, in draw order: the node; the prize icon (ice or crystal, ore, or the core) in the centre at about 0.4 of the node's r; the relay mark (`drawRelayMark(ctx, 0.5 * r)`, the relay icon on a dark backing disc) centred at the upper left, (-0.7 r, -0.7 r); the lock badge (`drawLockBadge(ctx, 0.5 * r)`) centred at the upper right, (0.7 r, -0.7 r). The two corner marks sit on opposite sides, so they never collide on a locked relay (checked by test at r = 12, 22 and 50). A relay in any of the four states wears the mark; its haul icon stays, so the ice or crystal cue survives on the four relay nodes.
- **Far node centre.** A far node shows no prize icon (the area sheet withholds the haul too). A far relay shows only the relay mark, dimmed with `drawRelayMark(ctx, 0.5 * r, 0.5)` to the node's own 0.5 alpha, at the same upper-left position. A far non-relay node is the bare hollow cluster. Far never carries a lock badge.
- **Keep the lock badge and relay mark clear of text and rings.** Placed as above, they reach outside the node's circle diagonally: the relay mark to about 1.49 of the node's r, the lock badge to about 1.31 (the gallery's bounds list measures both, "reach from the node centre"). At the overworld size (node r ≥ 22) that is up to about 33 px, past the selection ring at r + 6. Place name labels below the node (or clear of the corners) and keep the selection ring at r + 6 from covering them, drawing marks after the ring; the caller owns this.
- **`drawRelayMark` bounds.** Stays within its own r: the disc is 0.96 r so the antialiased edge does too (gallery pixel scan 0.984 r against the 1.002 r limit; exact geometry in the test). The relay icon alone is for the sheet and the notice.

## H7 entities

One field, live enemy: economy ships, the raid marker, the radar and the mine badge. Draw functions are in `packages/client/src/placeholders.ts`. Bounds are checked in `packages/client/test/h7-art.test.ts` (recording context) and the gallery's pixel scan (`tests/smoke/h7-art.spec.ts` reads it). The gallery shows a 24 px strip in colour and greyscale with the hulls beside the warships and a rock, and prints each hull's 24 px mask overlap (intersection over union) with the others. New palette entry: `econ` `#f0a83a` (the economy hull, an orange amber so it is not the probe's `#ffd27a`).

| Entity | Draw | Look | 24 px read |
| --- | --- | --- | --- |
| Extractor | `drawExtractor(ctx, r, heading)` | squat chamfered amber hull with a dark cab slot and a pale drill prong to the nose; faces right | short amber block with a pale spike |
| Hauler | `drawHauler(ctx, r, heading)` | amber chassis and cab behind a big square cargo pod with a dark cross brace, pale windscreen | amber box with an X |
| Raid marker | `drawRaidMarker(ctx, r, mix)` | the raiders' ring (Thorn arc `thorn`, Spore arc `spore`, each its share of the circle) round a hot-pink (`bloom`) chevron pointing right | pink arrow in a two-colour ring |
| Radar | `drawRadar(ctx, w, h, weights, max)` | pentagon grid in `starDim` (one ring per weight step), an axis to each type's icon (extractor, hauler, drone, lancer, flak, clockwise from the top), the weights filled in `probe` amber at 0.3 alpha with a solid edge | amber pentagon on a grid |
| Mine badge | `drawMineBadge(ctx, r)` | a teal pick on a dark disc with a teal ring | round teal pick |
| Rock under raid | `drawAsteroid(..., 'raided', t)` | the rock with a pulsing `mobGlow` and a jagged `mob` red rim | rock in a red burst |

Rules:
- **Bounds.** Extractor, hauler, raid marker and mine badge stay within r (measured 0.96, 0.98, 1.00 and 0.98 r in the gallery); the raided rock's glow and rim stay within 1.1 r; the radar, icons included, stays inside its w by h box.
- **Told apart at 24 px.** The extractor and hauler each overlap the other hull, the three warships and a rock by under 0.75 (gallery check, currently 0.35 to 0.60), and each covers over 80 px of its 24 px cell. The extractor is the small one with a spike; the hauler the big one with a box.
- **Amber.** The economy hull is `econ`, not the probe amber; the radar fill is the probe amber (it is the player's allocation). Neither hull uses player blue or any mob colour (tested). The mine badge is teal with no amber, so it is not the lock (amber shackle) or the "!" (amber pill).
- **Callers.** A docked extractor sits on its rock's upper arc with its drill toward the rock (about 6.5 px), idle ships wait in a row under the probe, a loaded hauler wears a teal dot, the mine badge sits at the rock's lower right, the raid marker rides a dashed `mob` line from the hive to its target with its seconds under it, and the hive pulses with a `mob` ring while a raid musters.


## H8 entities

Hold the front: the raid-target badge, the drag (line, ghost chip, drop highlight and tag), the split-armed pulse and the Mine button. Draw functions are in `packages/client/src/placeholders.ts`, shown in the gallery (a 24 px strip in colour and greyscale, then each at three sizes), and bounded in `packages/client/test/h8-art.test.ts` (recording context) and the gallery's pixel scan. **No new palette keys**: every H8 draw reuses an existing one (`thorn`, `spore`, `bloom`, `bloomHi`, `ship`, `starBright`, `laneClosed`, `asteroidOre`), so the palette table is unchanged.

| Entity | Draw | Look | 24 px read |
| --- | --- | --- | --- |
| Raid badge | `drawRaidBadge(ctx, r, mix)` | the raiders' ring (Thorn arc `thorn`, Spore arc `spore`, each its share of the circle, starting at the top) round a dark disc with two crossed `bloom` blades. No chevron and no amber | pink X in a two-colour ring |
| Drag line | `drawDragLine(ctx, x0, y0, x1, y1, aim, phase)` | a 3 px dashed line from the source to the finger with a dot at the finger: `ship` blue to a node, `bloom` at an enemy node, `laneClosed` grey over nothing | dashed line |
| Ghost chip | `drawDragGhost(ctx, entries, aim)` | a dark rounded panel (the toast's colour) edged in the aim colour, holding each carried type's icon and count; 30 px high, drawn 48 px above the finger | panel with ship icons and counts |
| Drop highlight | `drawDropHighlight(ctx, r, attack, t)` | a 3 px ring at the node's reach with a pulsing wider halo: `starBright` for a move, `bloom` for an attack | bright ring round a node |
| Drop tag | `drawDropTag(ctx, name, attackText)` | a pill with the node's name; on a guarded node it reads "Hive · Attack · Even" on a dark pink pill edged `bloom` | name pill |
| Split pulse | `drawSplitPulse(ctx, r, t)` | the source's ring in `ship` blue with two rings spreading out from it, a beat apart | blue ripples |
| Mine button | `drawMineBadge(ctx, r)` | the H7 mine badge, unchanged, drawn 24 px in the control bar's button | round teal pick |

Rules:
- **Bounds.** The raid badge stays within r (like the marker and the mine badge); the drop highlight within 1.2 r, the split pulse within 1.5 r (tested, and measured in the gallery).
- **Told apart.** The raid badge is a ring with an X, so it isn't the marker (a chevron that rides the line), the "!" (an amber pill) or the mine badge (a teal pick); the Raid badge and the Mine badge sit on opposite sides of a rock (lower left and lower right). The attack colour is `bloom` on the line, the highlight and the tag, so a pink line always ends on a pink ring.
- **Callers.** The badge is `max(8, 0.4 r)` px, from the muster to the raid's end. During a drag the highlight sits on the node the release would hit (the same hit test as a tap), the ghost chip 48 px above the finger (clamped inside the canvas), the tag above the target or below it near the top edge. The pulse sits 8 px outside the source rock while a split is armed.
