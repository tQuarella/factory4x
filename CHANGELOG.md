# Changelog

Player-facing changes per build. Three plain lines per build, written by the Director from `npm run changelog`.

## Unreleased

Nothing yet.

## build-20261114-1 (2026-11-14, commit f565c11) · Milestone 2, H7: One field, live enemy

- One asteroid field, one run: no overworld for now. The probe builds Extractor ships that mine a rock and Hauler ships that fly the ore home. Tap a rock and choose "Mine this rock" or "Stop mining". You land with economy only, so the first minute is about mining.
- No build queue: on the probe sheet, set a weight from 0 to 5 for each ship type (Extractor, Hauler, Drone, Lancer, Flak). The spider graph shows the split, and the probe spends its income in that ratio. The fleet limit is 30 ships, economy ships included.
- The hive raids you. Raids grow with your economy, never with time. A banner warns while a raid musters, and the raiders fly to the mined rock nearest the hive. Meet them with warships, or stop mining that rock. Take the ice and crystal pockets for Flak and Lancers, then take the hive to win.

## build-20261108-5 (2026-11-08, commit 626307f) · Milestone 2, H6: Open frontier

- A bigger overworld you drag to pan: 10 areas in four bands, and you need only some of them to win. Command relays replace Command limit research. Reclaim the first relay in a band and your fleet limit rises (12, then 20, then 28) and the next band opens. Locked areas are visible but can't be entered until then. A second area of the same kind pays half its haul. The Root is gone.
- Combat change: guards now strike the ship type they counter first ("Thorns strike Flak first; Spores strike Lancers first", shown on the sheets). A fight's outcome depends only on how many of each type you send, not on which yard finished first.
- Fixed: the top bar no longer jitters as resources change, and the "Backed up" warning no longer flickers or shifts the buttons under it. In phone landscape the chips no longer sit under the buttons.

## build-20261108-4 (2026-11-08, commit f9ddf20) · Milestone 2, H5: Fleet cap

- A fleet limit: each area lets you field 12 ships at once (ships still being built count). A yard at the limit shows "idle: fleet full", and Recycle scraps parked ships for half their ore back so you can change your mix.
- New research, Command limit, raises the limit to 18, 24 and 30. Each level needs a harder area reclaimed first. Medium areas with their Root intact now need both Lancers and Flak at 18, and The Deep's intact heart needs 24.
- Fixed: the asteroid, pocket and heart sheets now show the extraction rate with your Extraction research applied. On phones the resource chips drop "/min" so the top bar fits in two rows.

## build-20261108-3 (2026-11-08, commit 631e4f9) · Milestone 2, H4: Reclaim ladder

- A new overworld of six areas. You start with nothing at Landfall, an undefended field your first ship reclaims. Each area you reclaim pays a haul and keeps shipping resources home while you play.
- Research between areas makes you stronger for good: Lancer and Flak designs, more opening ore, faster extraction, seed rigs that land with an extractor already running, and faster yards.
- Ice areas are held by Spores, crystal areas by Thorns. Pick your next area by its guards and the designs you own, take The Deep, and build the probe core to win the system.

## build-20261108-2 (2026-11-07, commit a4096a7) · Milestone 2, H3: Counter web

- A new 16-node field in three layouts (Frost Gate, Glass Thicket, Twin Seams). Ice and crystal sit in guarded pockets across it: take a pocket, route its prize to the Probe, and it unlocks a new component and ship type.
- Two counter ships join the drone. Lancers (built with lenses, from crystal) pierce armoured Thorns; Flak (built with plating, from ice) shreds Spore swarms. Each hits its prey twice as hard and the other guard type at a quarter strength.
- Read a pocket before you commit: a two-colour ring shows its Thorn/Spore mix, its sheet tags your ships Strong, Even or Weak, and "Choose…" sends exactly the mix you want. The Root still feeds the Heart.

## build-20261108-1 (2026-11-07, commit 13201db) · Milestone 1, H2: decision depth

- The Bloom now drinks from the Root, a smaller guarded stalk joined to it by a pink vine. Cut the Root first and the Bloom drops to 8 thorns and regrows 5× slower, so a smaller wave can take it. Or skip it and overwhelm the Bloom at full strength.
- Every run is one of three systems: Thin Root, Knotted Root and Deep Root. How strong the Root is changes which line is better, and New run moves you to the next system.
- Clearer battles: each battle line names its node, the Root and Bloom sheets show the Bloom fed and starved side by side, the result panel names the system and when you cut the Root, and taps on guarded nodes are easier to hit.

## build-20261106-2 (2026-11-06, commit c11124b) · Milestone 1: first playable

- Build extractors and ore routes on five asteroids. Delivered ore per minute is the big number at the top, and your shipyard speeds up with it.
- The richest rock is guarded by the Bloom, a hive that regrows its thorns. Take it with one big enough wave, and your ore per minute jumps.
- Pause, 1x/2x/4x, a tuning panel for every number, a feedback button, and autosave so a closed tab loses nothing.

## build-20261106-1 (2026-11-06, commit 00c150c)

- Placeholder page: the probe, an asteroid, a delivery route and a mob, drawn as procedural shapes.
- The simulation runs live in the page at 30 ticks per second.
- Build version shown in the corner so feedback can name the build.
