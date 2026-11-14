# Design

Owned by the Designer. Current mechanics, open fun hypotheses, and the tunable parameters behind them. Every number named here lives in `data/`.

## Constraints from VISION.md

- Phone-first: every interaction works by touch at 375 px wide. Logistics are routes drawn between nodes.
- Real-time with pause and 1x/2x/4x.

## Owner direction (design session, 2026-11-06)

Answers from the owner, in their words where possible. These shape everything below; the proposed `VISION.md` wording is in `QUESTIONS.md` Q7.

| Topic | Direction |
| --- | --- |
| Shape | *(Run length superseded by the 2026-11-07 asteroid-field direction, pending QUESTIONS.md Q14.)* **Roguelite campaign.** Each star system is one run of **20–40 minutes**. The campaign of systems spans many sessions. "Shorter sessions but more capability each time." |
| Carry-forward (NG+) | **Research** carries over, **probe design choices** set your next start, and each new system is **harder** (richer resources, tougher guardians). |
| Ship control | **Orders to nodes.** Tap a node, assign a fleet to attack, guard or escort a route. Ships act on their own. No unit micro. |
| Mobs | ~~**Defend only.** They never come for you.~~ *Superseded 2026-11-14 (Q21, pillar 3 rewritten): mobs raid what you build. See H7.* |
| Mob factories | Repair and replace defenders **up to a cap**. You take a node by out-producing their replacement rate, or by cutting their supply first. Waiting doesn't make it worse; under-committing wastes ships. |
| Losing | **No fail state.** You can lose ships and time, never the run. |
| Tension | ~~**Optimization puzzle.** No clock, no pressure. The challenge is building an efficient network.~~ *Superseded 2026-11-14 (Q21, pillar 4 rewritten): pressure, not a clock. Raids grow with what you build, never with time. See H7.* |
| Production chains | **3–4 tiers**: ore → refined → components → ships / probe parts. |
| Saves | **Autosave** to the browser every few seconds; a run survives the tab being killed. Campaign progress persists between systems. |
| Mob flavor | Team decides (Designer + Art Direction propose). |

### Consequences the team should design around

- **No fail state + no clock** means the measure of a good run is efficiency, not survival. A per-system result screen (time to probe, ships lost, peak throughput) gives the puzzle a score to beat without adding pressure. Proposal only; confirm with the owner before building.
- **Risk = ship cost.** "Risk scales with reward" now means a richer node costs more ships to take, and a bad commitment wastes production. Losses must read clearly so a failed attack feels like a lesson, not a punishment.
- **Guardian factory math is the core puzzle.** Taking a node means beating `replaceRate × cap` with your delivered fleet, or first raiding the guardian's own supply node to drop its replace rate. Every tunable here goes in `data/`.
- **Short first system.** System 1 should be small enough to finish in ~20 minutes with a 2–3 tier chain; later systems unlock tiers and length via research and harder maps.
- **Saves:** the sim is deterministic, so a save can be a compact state snapshot (or seed + command log). Engineering picks; the requirement is that killing a phone tab loses at most a few seconds.
- **Bots:** with no fail state, bot reports measure time-to-probe and throughput curves instead of win rate. Strategies to keep: rush (attack early), turtle (build economy, attack late), greedy expansion, raid-supply-first.

## Owner direction 2026-11-07: the asteroid field (steelman)

The owner's answer to Q13 (verbatim in QUESTIONS.md) asks for a more radical change, then says "Steelman this". It covers: a longer, persistent game across a large asteroid field; several resource types that combine into components; components that unlock new ship types; Bloom pockets across the field, with stronger Bloom over better resources; progression that feels varied, not a straight line; rock/paper/scissors between ship types and guard types; and deeper logistics (factories outside the probe, a maximum route distance, more). The H3 candidates below are superseded. A lives on as "most of the field is guarded", and B as "a prize is a new resource, not more ore".

This section is the strongest version of that game, the tensions it raises, and the order in which to build it (Milestone 2). It is a direction, not a spec. Each H in the M2 plan gets its own spec when it comes up.

### The pitch

Your probe lands at the edge of a big asteroid field. Plain ore is free. Everything better sits in pockets guarded by the Bloom, and every pocket is guarded differently. The prize in a pocket is a new kind of resource, not just more ore. A new resource lets you make a new component, a component unlocks a new ship type, and each ship type is good against one kind of guard and bad against another. So every pocket you take changes which pockets you can take next. You spread across the field by building outposts, refineries and relays, because routes have a maximum length and components are made where their resources meet. The game is long and persistent, played in short sessions, and it ends when you have the components to launch a new probe.

### The core loop

1. **Scout** a pocket: see its prize and its guard mix.
2. **Choose** a pocket that your current ship types can crack.
3. **Build the supply** for that fleet: extract, route, refine, assemble.
4. **Crack it**: send the right mix, or cut its Root first.
5. **Connect the prize** to your network. The new resource opens a component, the component opens a ship type, and that ship type changes which pockets are cheap. Back to 1.

H1 and H2 had one loop per run, and it ended at the only prize. Here the loop runs many times per game, and each pass changes what the next one offers. That is what attacks the "max economy, then ships, then attack" sequence: the economy can't be maxed without fighting, and you can't build the right fleet without the economy the last fight gave you.

### The progression web (not a line)

- **Resources by tier.**
  - Tier 0, free: **ore**.
  - Tier 1, in light pockets: **ice** and **crystal**.
  - Tier 2, in heavy pockets: **sap** (taken from Bloom Roots) and **heavy metal**.
  - The end goal is the **probe core**, which needs both tier 2 resources.
- **Components are pairs of resources.** For example, plating = ore + ice, lenses = ore + crystal, and later cores from tier 2 pairs. Each ship type needs one component, so which resource you take first decides which ship you can build first.
- **Why it's a web.**
  - **Two doors per tier.** Each tier 1 resource sits in at least two pockets with different guard mixes. Each tier 2 pocket can be cracked by at least two fleet mixes, one of which can be built from either tier 1 branch.
  - **Seeded fields.** The guard mix and position of each pocket are shuffled by the seed, so the cheap first door differs between games.
  - **Scarcity.** You can't afford every ship type at once, so you specialise, and your specialisation decides which part of the field is cheap for you.

### The counter triangle

- **Ships.** Three ship types, each needing a different component, plus the basic **drone** (ore only), which is weak and neutral:
  - **Lancer:** heavy single shots. It pierces Thorn armour but is swamped by Spores.
  - **Flak:** area bursts. It clears Spore swarms but bounces off Thorn armour.
  - **Warden:** shielded and slow. It outlasts Lash strikes but is ground down by Spores.
- **Guards.** Three types:
  - **Thorn:** few, armoured.
  - **Spore:** many, fragile, fast to replace.
  - **Lash:** hard-hitting, long reach.
- **The rule.** Each ship type does about 2× damage against the guard it counters and ½× against the guard that counters it. Exact pairings and numbers are decided at spec time.
- **Mixed pockets.** Pockets are mixed (for example 70% Thorn, 30% Spore), so the answer is a fleet mix, not one ship type. Guard factories regrow each type separately, and a Root can feed one type.
- **Reading a pocket before you commit.**
  - On the map, each pocket wears a ring split into the three guard colours by share. It reads at a glance, even zoomed out.
  - The pocket's sheet lists guards by type with counts, and marks each of your ship types as *strong here*, *even* or *weak here*.
  - There is still no "ships needed" number, because estimating is the puzzle. The counter tags make it an informed estimate.
- **Sending a fleet.** You still pick a target and tap Attack. The send sheet has one +/− stepper per ship type, with "all" shortcuts, so choosing a mix stays a few taps and needs no micro.

### The logistics layer ("where do I build")

- **Factories outside the probe.**
  - **Refineries and assemblers are built on asteroids**, each with a slot cost. A component is made where its inputs arrive.
  - **Shipyards are buildings too.** They start at the probe; more can be built at outposts near the front.
- **Maximum route length.** Routes can't be longer than `route.maxLengthSu`. To reach further you chain through nodes. Empty rocks (no ore, cheap) can hold a **relay**, so the field has a mesh of stepping stones and there are only a few ways to get far.
- **Route capacity is shared.** A route carries every resource flowing along it, up to its level's capacity, so a busy trunk route becomes the bottleneck you upgrade or bypass. Routes are drawn by tapping two nodes, as now.
- **Living pockets block routes.** No route may pass through a living pocket's radius. Pockets carve the field into regions, and cracking one opens new paths as well as its prize. That is a payoff you see on the map, not a time saving.
- **Depots (optional, later).** A depot is a buffer node that smooths lumpy flows. It's useful but not needed for the first slices.
- **The decision.**
  - Put the assembler near the probe, and you need long routes for the rare input.
  - Put it at the frontier, and you need a forward shipyard and relays.
  - Both work, they cost different things, and the choice shows up on the map.

### H2 lessons applied

- **Choices must differ in what you get, not in minutes.**
  - Picking a pocket picks a resource, a component and a ship type.
  - Picking a factory site picks which region you can reach.
  - Sending the wrong mix loses ships that took a scarce component to build. That loss is felt, because you can't rebuild them at once with ore.
- **Readable trade-offs, no answer key.** The guard ring and counter tags make the choice informed. There is no ships-needed number.
- **Keep the cut.** Roots stay. Some pockets are fed by a Root, and cutting it wilts one guard type or a whole cluster. Sap comes from Roots, so cutting is also a prize.
- **Many decisions per session, not one per run.** Each pocket is a decision. If the field ever offers only one sensible next pocket, that's the H2 failure again. The bots check that at least two first moves are viable on every seed.

### Tensions with VISION.md, and proposed resolutions

| Tension | Resolution | VISION change? |
| --- | --- | --- |
| Fixed decision: "A roguelite campaign: each star system is one 20–40 minute run; the campaign spans many sessions." The owner now asks for "a longer, persistent game". | A star system becomes one long game (several hours) played across many short sessions, kept by autosave, ending when you launch the new probe. New game+ still follows: the next system is richer and harder. The owner's earlier "shorter sessions but more capability each time" survives as short sessions within one long game, each with a natural stopping point (a pocket taken). | **Yes.** Proposed wording in QUESTIONS.md Q14. |
| Pillar 1: "Delivery rate **to the probe** gates everything else." Factories outside the probe break the "to the probe" part. | Throughput still throttles everything, measured into factories and shipyards. | **Yes, a wording change.** Proposed in Q14. |
| Pillar 5: "Research and probe design carry forward, and each new system is richer and harder." | Unchanged. It works between long games. Within a game, progression is the component web. Research can wait until after M2. | No. |
| Pillar 4: no clock, no pressure. A long game risks waiting. | No offline progress, so there's no reason to log in on a timer. 4x speed already exists. Every wait should have a decision next to it (scouting, the next site). If waiting dominates, add 8x. | No. |
| Phone portrait and a large field. | Pinch to zoom and drag to pan (standard touch gestures, not precision dragging). Zoomed out, pockets and regions show as large icons with the guard ring and prize icon. Taps snap to the nearest node, so targets stay at least 44 px at any zoom. A "next decision" list (pockets you can scout or crack, idle factories) lets you play from a list without hunting the map. | No (the fixed decision already says routes between nodes). |
| Owner's original note: "build components that go back to the probe". | It is a historical note, so leave it. The new direction supersedes it in practice. | No. |
| "Ships take orders at nodes; no unit micro." | Choosing a fleet mix in the send sheet is an order, not micro. | No. |
| DESIGN.md "Owner direction (2026-11-06)": run length 20–40 minutes, 3–4 tiers. | Run length superseded by this section, pending Q14. Tiers fit (ore → refined resource → component → ship or probe core). | DESIGN.md only. |

### Biggest risks

1. **The counter triangle gets solved.** "See Thorns, bring Lancers" is obvious again. Mitigations: mixed pockets, scarce components (you can't field everything), and two doors per tier.
2. **Scope.** This is a new game, not a feature. Hence the thin slices below, each playable on its own.
3. **Phone readability** of a big field with many resource types. Each new resource or ship type has to pass the 24 px silhouette test.
4. **A long game is still a fixed sequence**, just a longer one. The bots must show at least two viable first moves and different tier 2 orders across seeds.

### Milestone 2 plan (ordered, one hypothesis per build)

*Rows H4–H6 are superseded by "Owner direction 2026-11-08: the overworld (steelman)" below: H4 is absorbed at overworld scale, H5 is replaced by many one-screen areas, H6 becomes the top of the overworld. Kept for the record.*

Riskiest claim first: that **pockets + counters + resource prizes make "which pocket next" a real, felt choice that isn't a straight line**. Everything else (big field, factories, route limits, endgame) only matters if that holds.

| H | Build | Fun claim tested | Fun question |
| --- | --- | --- | --- |
| **H3** | **Counter web** (below) | Choosing which pocket to take next, given your ship types, is a real choice, and the game doesn't play as one fixed sequence | "After your first pocket, did you have more than one sensible next target? What decided it?" |
| H4 | **Factories and reach:** refineries, assemblers and shipyards on asteroids; max route length; relays; shared route capacity; pockets block routes | "Where do I build" is a puzzle you enjoy, and the network looks like *your* network | "Did you place a factory somewhere for a reason you could name? Did a route limit ever change your plan?" |
| H5 | **The big field:** a seeded field of about 40–60 nodes with pan and zoom, scouting, regions, tier 2 pockets and the "next decision" list; a multi-session game | A long, persistent game stays fresh across sessions, and a large field reads on a phone | "Did you want to come back for another session? Could you find your way around the field?" |
| H6 | **The new probe:** the probe core from tier 2 components, the endgame and win screen, the first new game+ hook | Building toward the probe gives the long game a satisfying arc | "Did launching the probe feel like the end of a story? Do you want the next system?" |

#### H3 slice: Counter web

*Owner chose this as H3 (2026-11-07). The full spec is "H3 (Milestone 2, iteration 3, spec ready): Counter web" under Hypotheses; where the two differ, the spec wins.*

- **Contains:**
  - **The field.** One field of about 16 nodes that fits a phone screen with light pan, or none. Three hand-made layouts, shuffled by seed: the H2 lesson was that hand-made layouts compare cleanly.
  - **Resources:** ore (free), ice and crystal (each only in pockets).
  - **Components:** two, made at the probe for now: plating (ore + ice) and lenses (ore + crystal).
  - **Ships:** drone (ore only, neutral), lancer (lenses) and flak (plating).
  - **Guards and pockets:** two guard types, Thorn and Spore, so it's a counter pair, not yet a triangle. Four or five pockets, each with a guard mix and a prize. There are two doors to each tier 1 resource.
  - **The finale:** one final mixed pocket (the Bloom heart, fed by a Root) that needs both counters or a lot of drones.
  - **Readouts:** the guard ring, the counter tags, and the per-type send steppers.
- **Leaves out:** factories outside the probe, max route length, relays, the big field and zoom, Warden and Lash (the full triangle), tier 2 resources, the new probe, research and new game+.
- **Why a pair, not the triangle:** two ships against two guards already tests whether counters plus prizes make a choice, and it halves the art and the UI. The third type joins in H4 or H5 if the pair works.
- **Expected tasks:** about 5.
  - h3-sim: resources, components, ship types, guard types, counter combat, pockets.
  - h3-client: multi-resource HUD, build queue per ship type, send steppers, pocket sheet and ring.
  - h3-art: three ship silhouettes, two guard types, resource icons and the guard ring.
  - h3-bots: lancer-first, flak-first and drones-only strategies, plus a no-dominance check across layouts.
  - h3-design-data: the Designer's calibration of costs and counters.

  Four builders, four Critic reviews and one design launch come to 9 of the 12 launches, which leaves room for fix rounds.
- **Tunables to name at spec time** (proposed defaults, finalised in calibration):
  - `counter.strongPct` (200, range 100–400)
  - `counter.weakPct` (50, range 25–100)
  - `component.<name>.cost` (per resource)
  - `ship.<type>.hp`, `ship.<type>.damage` and `ship.<type>.component`
  - `guard.<type>.hp`, `guard.<type>.damage` and `guard.<type>.regrowTicks`
  - `pocket.<id>.mix` and `pocket.<id>.prizePerMin` (map data, per layout)
- **Success (one session, about 30–40 minutes):**
  - the owner takes at least three pockets;
  - before the second pocket, they can name two sensible targets and why they picked one;
  - on a second game, their first pick differs or they can say why it shouldn't;
  - they don't describe the run as "build economy, then ships, then attack".

## Owner direction 2026-11-08: the overworld (steelman)

The owner's feedback on build-20261108-2 (PLAYTEST_LOG.md, 2026-11-08) proposes the progression loop for the whole game: many areas connected on an overworld; a reclaimed area's resources can be sent elsewhere; you manage logistics on the overworld and choose which area to reclaim next; persistent research makes heavier areas reclaimable; you start with nothing (only an undefended area), grow stronger, reclaim richer areas, and repeat until you can build the new probe; the climb is a "miner grind" punctuated by meatier steps (new ship types, which still need their resources locally, extraction speed, starting resources). They also said in-area logistics "may be fine at the scope of a small area".

This section is the strongest version of that game, how it absorbs H3 and the rest of the Milestone 2 plan, and its risks. It is a direction, not a spec. The owner picked "Reclaim ladder" as the first slice (Q16); its spec is "H4 (Milestone 2, iteration 4, spec ready): Reclaim ladder" under Hypotheses, and where the two differ, the spec wins.

### The pitch

Your probe arrives at the edge of a system broken into **areas**, asteroid clusters joined by **lanes** on an overworld map. One area is empty of Bloom; every other one is held, and the richer the area, the heavier the hold. You reclaim the empty one with nothing but drones and ore. Every area you reclaim keeps working for you: its extractors keep running, and its output flows along the lanes into your **stockpile**. The stockpile pays for **research**, and research makes you permanently stronger: new ship designs, faster extraction, a bigger opening stock in the next area. Stronger means a heavier, richer area is now within reach. You pick which one, go in, and crack it. The game ends when your network can afford the **probe core** and you launch the new probe.

### Two loops, two scales

- **The inner loop is an area, and it is H3.** You land with starting resources, build extractors and routes, read each pocket's guard mix, take the pocket whose prize unlocks the counter you need, then take the area's heart. Capturing the heart reclaims the area. The owner's "the heart is spore-heavy so go win the easiest flak node" is exactly the decision we keep. In-area logistics stays as simple as H3: routes to the area's probe, no factories elsewhere.
- **The outer loop is the overworld.** Between areas you choose what to research and which area to reclaim next, and (in a later slice) where reclaimed areas send their output. The overworld is one screen of about 6–10 area nodes joined by lanes. It is a node graph, so it obeys the same phone rules as an area.
- **Sizes.** An area must fit one phone session, so it should take 5–15 minutes, not the 20–30 of the H3 field. The first areas are small (6–8 nodes, one pocket or none). The H3 field, as built, is about the size of a late area.

### Local resources and overworld shipments

- **Local** means what is in the active area's probe stock: what its asteroids and pockets deliver, plus the opening stock (`area.startOre`, raised by research), plus imports. Yards only ever spend local stock. This is the owner's "still need the required resources locally": researching the Lancer design lets you build Lancers anywhere, but each one still needs a lens made from crystal in this area. Research opens the door; the area's pockets, or an import, pay for each ship.
- **Shipments** are what reclaimed areas produce. A reclaimed area isn't simulated tick by tick. It becomes a summary: one integer rate per resource, taken from the network you built there. That output can go to:
  - **the stockpile** (research and the probe core), or
  - **the active area**, arriving at its probe as an import stream. This is how a crystal area lets you build Lancers in an area with no crystal pocket.
- **Overworld logistics** is where the "logistics is still very simple" complaint gets its answer. Lanes join neighbouring areas only, so far areas are reached by chaining through reclaimed ones. Each lane has a capacity, so a trunk lane becomes the bottleneck you upgrade or route around. A held area blocks every lane through it, so reclaiming opens paths as well as resources. Pillar 1 now holds at two scales: delivery inside an area throttles ships; delivery across the overworld throttles research and the probe.
- **Imports are weaker than a local pocket** (a tunable share), so a local prize is still worth fighting for and the H3 choice survives.

### What persists and what resets

| Scope | Kept | Reset |
| --- | --- | --- |
| Entering a new area | research levels; the stockpile; every reclaimed area's output | local stocks (you start with `area.startOre`), extractors and routes (each area is built fresh, and research shortens that), ships (fleets belong to their area in the first slices) |
| Leaving an area before reclaiming it | as above | that area returns to its starting state. You lose time, never the run. Only one area is in progress at a time, which also keeps the save small. |
| The whole system (one long game) | which areas are reclaimed, their output rates, lanes, research, stockpile | nothing until the probe launches |
| New game+ (next system) | the research tree (pillar 5) and probe design choices | areas, stockpile, lanes. The next system's areas start heavier. Decided in the slice that builds the probe. |

### The grind and the meatier steps

- **The grind** is small, repeatable progress you can see. Each reclaim adds a little output. Research has small levelled items: extraction +25%, opening ore +40, faster yards, cheaper route upgrades. Their reward lands where the chore would be: the next area's opening (build extractors, wait for ore) gets visibly shorter. The owner's pun fits: the grind is a minor one, and research keeps it minor.
- **The meatier steps** change what you can attempt, not how fast:
  - a new ship design (Lancer, Flak; later Warden);
  - a new resource tier (heavy areas give sap or heavy metal, which unlock tier 2 components);
  - a lane upgrade that opens a far region;
  - the probe core itself.

  Each meaty step costs a resource that only some areas give, so you take it by choosing an area, not by waiting. Target rhythm: a meaty step every 2–3 areas, and never more than 3 areas in a row that only grind.
- **Keep it a web, not a ladder.** The owner describes a ladder ("reclaim richer area, get stronger, repeat"); the 2026-11-07 direction says the climb must not be a straight line. Both hold if every tier of areas has at least two doors with different prizes and guard mixes, and research is a small tree, so the order you climb in is yours. The bots check this, as in H3.
- **No waiting (pillar 4).** Research never runs on a timer. The stockpile fills while you play the next area, so when you return to the overworld there is something to buy. While the overworld screen is open, the game is paused; there is nothing to wait for there. An area far below your strength should be quick: an "overwhelm" option (one tap sends the opening fleet, or easy areas auto-reclaim) is the main anti-chore valve, deferred until play shows it's needed.

### What happens to the Milestone 2 plan

- **H3 (Counter web) is kept whole** as the inner loop. Its field, counters, pockets, Root and heart become the template for every area.
- **H4 "Factories and reach" is absorbed at overworld scale and dropped inside an area.** Factories outside the probe become reclaimed areas whose output you direct. Max route length becomes lane adjacency. "Pockets block routes" becomes "held areas block lanes". Shared route capacity becomes lane capacity. Relays become empty or poor areas worth taking as waypoints. In-area factory placement is dropped, because the owner says simple is fine at that scope.
- **H5 "The big field" is replaced.** Many one-screen areas plus a one-screen overworld read better on a phone than one large field with pan and zoom. Multi-session play arrives on its own, since an area is a session.
- **H6 "The new probe" becomes the top of the overworld:** the probe core costs tier 2 resources from the heaviest areas. New game+ follows.
- **Warden, Lash and tier 2 resources** arrive later as meaty steps in research.

### Check against VISION.md, line by line

| VISION.md line | Fit |
| --- | --- |
| Fantasy: "Everything you will ever have starts with what you can pull out of the rocks around you. Grow from one probe into an industrial presence... then build a new probe" | Fits, and gets stronger: start with nothing, grow across areas, end with the probe. |
| Original note: "Extract resources and build components that go back to the probe, which builds ships" | Fits. Shipments go back to the stockpile at home; ships are built in areas from local stock. |
| Original note: "Better stuff means harder mobs" / pillar 2 "Risk scales with reward" | Fits. Richer areas are held more heavily. |
| Original note: "Research components and ships." | Fits. This is the first slice where research appears. |
| Original note: "Mobs have their own factories" / pillar 3 | Fits. Every area's guards regrow up to caps, as in H3. An opportunity for later: an area's guards fed from a neighbouring area, an overworld Root you can cut. |
| Original note: "You win when you build a new von Neumann probe. Then new game+." | Fits. The probe core is the top of the overworld. |
| Fixed: "Real-time, with pause and 1x/2x/4x speed." | Fits. Areas play in real time; the overworld screen is paused. |
| Fixed: "Playable on a phone browser. Logistics are abstract routes between nodes, not tile-by-tile belts." | Fits. Lanes are routes between area nodes; each screen is one node graph. |
| Fixed: "Each star system is one long game, played across many short sessions and kept by autosave. It ends when you launch a new probe; then new game+ in a richer, harder system." | Fits. The overworld is the star system; an area is a natural session. |
| Fixed: "No fail state. You can lose ships and time, never the run." | Fits. Leaving an area early costs time; nothing is lost from the overworld. |
| Fixed: "Ships take orders at nodes (attack, guard, escort); no unit micro." | Fits, unchanged inside areas. |
| Fixed: "Autosave, so a run survives a closed tab." | Fits, if reclaimed areas are summaries (see risks). |
| Pillar 1 "Throughput is the throttle." | Fits, at two scales (see above). |
| Pillar 4 "A puzzle, not a race. No clock and no pressure." | No conflict in wording. The grind is the risk to this pillar (see risks), not a clock. |
| Pillar 5 "Every system makes the next one stronger. Research and probe design carry forward" | Fits. Research now also carries from area to area inside a system, which the pillar doesn't forbid. |

**No VISION.md edit is needed.** If the owner later wants pillar 5 to name areas as well as systems, that is a wording choice, not a conflict.

### Real risks

1. **Scope.** This is a second game layer: an overworld screen, a research screen, an area lifecycle and a new save shape. Mitigation: the first slice reuses the H3 sim unchanged inside each area, areas are data (layouts on the existing 16-node frame, with some nodes left out), and the overworld state is tiny.
2. **The grind feels like a chore (pillar 4).** Every area starts with the same build-out. If the third area feels like the first with bigger numbers, the loop has failed. Mitigations: research aims at the opening; every area differs in prize and mix; the overwhelm valve. Measurable: the bots report each area's time to first attack, which should fall from area to area.
3. **The ladder is a line.** "Always take the easiest available area" could be the whole strategy, which is H1's "obvious" again. Mitigations: two doors per tier, prizes that differ in kind, a research tree that branches, and a bot check that at least two area orders are viable.
4. **Session length on a phone.** An area must finish in 5–15 minutes, so most areas are smaller than the H3 field. A 30–40 minute playtest should reach 3–5 areas, including at least one meaty step.
5. **Autosave size and sim cost.** Simulating every reclaimed area would multiply both. Reclaimed areas are summaries (integer rates per resource), one area at most is in progress, and research is a list of levels. The save should be the H3 save plus about 2 KB (measured about 1.7 KB in h4-sim; a test caps the growth at 2 KB). Overworld accrual uses integer per-tick accumulators, so determinism holds.
6. **Two gates on one ship can confuse.** "Why can't I build Lancers here?" can now mean "not researched" or "no crystal in this area". The yard row has to name which one.
7. **Bot runs get long.** A whole campaign is many areas, longer than the 30-minute tick cap. Bots play area by area with the summary carried over, and report per area; the per-tick budget is unchanged.

*Tested on build-20261108-3 (2026-11-08): risks 2 and 3 happened. The owner found later areas a repeat and the overworld too linear. See PLAYTEST_LOG.md and the next section.*

## Owner direction 2026-11-08b: open world and a fleet cap (steelman)

The owner's feedback on build-20261108-3 (PLAYTEST_LOG.md, 2026-11-08) proposes two changes:
- **A ship limit:** "Consider a ship limit so you need to build the right composition within that limit rather than just swarming drones. Could increase the limit with research."
- **An open world:** "The overworld feels too linear. Consider going more open-world. Panning is fine, it doesn't need to all fit on the same screen. (steelman that before agreeing). That'd give the player the option to continue reclaiming and build strength before tackling the next challenge."

This section argues for each as strongly as I can, then against, then says what would have to be true for each to work. It is a direction, not a spec. The owner picked the fleet cap (Q17); its spec is "H5 (Milestone 2, iteration 5, spec ready): Fleet cap" under Hypotheses, and where the two differ, the spec wins.

### The root cause both proposals attack

H2, H3 and H4 failed the same way. Every difference in the game is paid in **time**: ships are unlimited, a ship is ore, and ore is minutes. So:
- a counter makes a fight faster, not possible;
- research makes an area faster, not possible;
- a heavier area takes longer, and is never closed to you.

Pillar 4 says time doesn't matter, so none of these differences is felt. The proof is in the H4 calibration: the medium hearts grew 42–55%, and mean area times moved by 6 s and 32 s ("Calibration result (h4-design-data, data v7)"). "Max economy, then swarm" is not a strategy the player chose. It is the only strategy a time-only game has.

So a fix has to make some choices about **what you can do**, not how fast you do it. The fleet cap does that directly. The open world does it only if it is built on something like the cap.

### The fleet cap

**The mechanic.** Each area has a limit on how many of your ships can be alive at once (all types count). At the limit, yards pause ("idle: fleet full 12/12"). A **Recycle** order at the probe scraps ships for part of their ore, so you can change your mix. Research raises the limit.

**The case for it.**
- **It changes the currency from ore to slots.** Arithmetic from `data/sim.json` (v7):
  - a drone slot does 2 damage to anything;
  - a matched counter slot does 4 × 200% = 8 (a lancer on Thorns, a flak on Spores), four drones' worth;
  - a mismatched counter slot does 4 × 25% = 1, half a drone.

  With unlimited ships, the 4× edge is only a time saving. Under a cap it's the difference between a fleet that fits and one that doesn't.
- **There is a window where only a mix wins.** On the frozen v4 fixture, `packages/sim/test/min-waves.test.ts` pins the smallest winning simultaneous wave for each H3 heart (drones / lancers / flak / best mix):

  | Heart | Drones | Lancers | Flak | Best mix |
  | --- | --- | --- | --- | --- |
  | Frost Gate | 33 | 25 | 39 | 14 |
  | Glass Thicket | 37 | 23 | 46 | 16 |
  | Twin Seams | 30 | 28 | 30 | 13 |

  The best mix needs 42–43% of the drone wave. A cap between the mix and the best single type means only a mix wins. A cap between the best single type and the drones means a counter is required. The shipped data roughly doubled every guard count (H3 calibration, "about x2.1"). The shipped single-type waves are in the H3 layout tables (for example, Frost Gate's heart 63 / 42 / 70). The shipped mix minimum isn't in any committed report yet; measuring it is the first job of the H5 calibration task.

  *Updated 2026-11-08 by h6-combat-target (H6 "Combat amendment"):* guards now strike the ship type they counter first, so the best mixes were re-derived on the same fixture: Frost Gate 15, Glass Thicket 18, Twin Seams 12 (were 14, 16 and 13, found with every lancer built before every flak). The single-type columns can't depend on order and are unchanged. The best mix now needs 40–49% of the drone wave. The argument above still holds.
- **A trickle doesn't beat the cap.** Guards regrow faster than you can rebuild:
  - one Spore every 20 ticks and one Thorn every 60 ticks per guarded node, both at once;
  - one ship every 90–120 ticks per yard.

  So a failed wave can't be topped up while the node recovers, and each wave has to win on its own. Under the cap, "attack once the fleet is twice the regrowth" stops working, because you can't build twice.
- **It breaks "max economy first".** A cap of about a dozen ships fills from a modest economy. Past that point, more economy only refills losses faster and feeds the components. The incentive becomes "get the right components, fill the cap with the right mix, attack", early and often.
- **Heavier areas feel stronger, because some are closed to you.** If a heart's best mix doesn't fit your cap, you can't take it yet. That is a wall you can see on the area sheet, not a longer wait.
- **Cap raises are felt steps.** Going from 12 to 18 slots opens areas that were closed. It's the "big step" H4 lacked, and the owner proposed it.
- **It gives the Root a job.** H3 showed a starved heart needs about half the fleet of a fed one (H3 calibration headline; `min-waves.test.ts` asserts it on the fixture). Under a cap, cutting the Root is how you take a heart that's too big for your fleet. The owner's favourite moment becomes a gate, not an option.
- **Phone cost is small:** one "Fleet 9/12" chip, one yard state and one Recycle stepper row, using the existing send-panel pattern.

**The case against.**
- **It touches pillar 1.** "Throughput... gates everything else." A cap is a ceiling that throughput doesn't set. Throughput still gates how fast you fill and refill, and which components you can make, but no longer how big your fleet is. See "Check against VISION.md" below.
- **It can make the economy feel pointless.** If 12 ships fill in two minutes, the network you build matters less. This is real. Mitigations: components stay throughput-bound (a light pocket makes a handful a minute); losses are refilled from throughput; and Recycle refunds only part of the cost.
- **"Wait for the next cap level" could become the new swarm.** If cap raises are cheap ore, the dominant plan is to grind ore, buy the cap and overwhelm. Mitigation: each cap level costs a resource that only a heavier area gives, so you earn a raise by taking an area, not by waiting.
- **Counters stay a lookup.** With the cap, "Spores, so Flak" is still one step. It just becomes mandatory. A cap only creates thought when nodes are mixed and the area can't build every counter locally. Then the question is "which 12, from what I can make here". In H4, light areas have one pocket, so you can build drones and one counter there. That's fine for light areas, if the calibration makes the mediums need both.
- **Drones become filler.** On a mixed node, a matched pair beats two drones by 16 to 4, so once you have both designs, drones only fill slots when components run short. That's acceptable: drones are the "no components yet" ship.

**Does it break "swarm drones"?** Yes, if three things hold, and the calibration task must show all three:
1. At each tier's expected cap, drones alone can't take the tier's hearts.
2. The best mix you can build from that area's local resources fits the cap with a few slots to spare.
3. The cap rises more slowly than area strength, so drones never fit again later.

Below the window, nothing fits and the area is a wall. Above it, drones fit and the swarm is back.

**Proposed numbers** (finalised by the calibration task):

| Key | Default | Range | Feels like (low / high) |
| --- | --- | --- | --- |
| `fleet.cap` | 12 | 0–60 | 0: off, H4 as built (the in-build A/B) / 6: every ship is precious, fights are tiny / 60: no real limit, the swarm returns |
| `research.fleet.step` | 6 | 2–12 | per level, 3 levels, so 12 → 30 at defaults. 2: raises go unnoticed / 12: one level doubles the fleet |
| `fleet.recycleRefundPct` | 50 | 0–100 | 0: a wrong build is wasted until it dies / 100: free respec, so composition is never a commitment |

`research.fleet` ("Command limit") costs are data, not tunables. Each level needs ice or crystal in amounts only a tier-2 or tier-3 haul covers.

**What the in-area decision becomes.**
1. **Which pocket first:** it decides which counter you can make here. Without it, some nodes are closed, not slower.
2. **Which mix fills the cap for this node.**
3. **Cut the Root or not:** forced when the fed heart's mix doesn't fit.
4. **Recycle and refit** between targets with different mixes.

The economy decision shrinks to "enough to make components and refill".

### The open world

**The mechanic, at its strongest.** The overworld is bigger than one screen: about 12–16 areas, which you pan. Areas beyond your border are scouted, so you see their guard ring and prize, not their numbers, until a neighbour is reclaimed. There are more areas than you need, so the probe core needs only a subset. You choose which areas to take, which to leave, and when to push into a heavier one.

**The case for it.**
- **It makes the set a choice, not just the order.** H4's six areas were all needed: hauls cover research with 20 ore spare (1680 against 1660), and no bot skipped one. With more areas than you need, which ones you take shapes your build, and two runs can end with different maps.
- **The pacing is yours.** "Continue reclaiming and build strength before tackling the next challenge" is the owner's own wish. A linear ladder forces the next challenge on you; an open map lets you stop and prepare.
- **It finally builds "explore".** VISION's original note names "explore, expand, exterminate". Nothing so far explores. Scouting and a map you uncover add a real X.
- **Room for areas that differ in kind**, which "like a repeat" asks for:
  - an overworld Root area whose cut starves the hearts of its lane neighbours (the owner's favourite moment, at map scale, foreseen in the H4 VISION check);
  - a choke area that opens a region;
  - a rich, far area held far beyond your cap, as a visible long-term goal.
- **Pillar 2 at map scale:** the rich areas are far and heavy, and you can see them from the start.
- **Panning is fine** on a phone, says the owner. That lifts our self-imposed one-screen limit, and a node graph still pans and taps cleanly.

**The case against.**
- **Without a cap, it amplifies the swarm.** If strength is ore, then "keep reclaiming to build strength" means "clear every easy area, buy every grind level, then swarm the hard ones until they're trivial". That is "max economy then swarm" at map scale: the owner's complaint, made bigger.
- **More of the same loop is more repetition.** "Like a repeat" was about inside areas: the same frame, the same two guards, the same build-out. Twelve such areas feel like a repeat twice as often. An open map doesn't fix this; areas that differ in kind do, and they cost design and art per kind.
- **The difficulty curve is uncontrolled.** With a free order, an area is either trivial (you came late) or a wall (you came early). The bots measure one of many paths.
- **Scope.** A bigger map is mostly data, but scouting, pan, a "next decision" list, new area kinds and their calibration are more than one iteration of about 5 tasks.
- **Bots, save and replay.** The best bot campaign is already 45:47–50:47 of play for the researching strategies (`reports/archive/h4-design-data-v7.md`). Twice the areas pushes past the 120-minute campaign cap. The save stays small (summaries), but the replay log grows with play time; area-boundary checkpoints, deferred in H4, would become needed.
- **Phone.** Panning is fine, but finding the next decision on a map bigger than the screen needs the "next decision" list from the 2026-11-07 direction. That is more UI.

**What would have to be true for it to fix "no big step" and "didn't feel stronger"** rather than amplify them:
1. **Strength is a capability, not an amount.** Getting stronger means a higher cap, a new design or a new kind of prize. More ore alone opens nothing. The fleet cap is the natural unit.
2. **Easy areas run out of value.** Hauls are one-off (as in H4); the same prize kind pays less each time (`areas.repeatHaulPct`); and cap raises need resources only heavier areas give. Grinding easy areas can buy grind research, never the next step.
3. **Heavy areas are visibly closed, and you know why.** The sheet says "best mix needs about 18 slots; you have 12" or "fed: cut its Root first". The goal is concrete.
4. **Areas differ in kind.** At least one new kind per tier (a Root area, a choke, a lone-counter area), so the fifth area isn't the first with bigger numbers.
5. **You need fewer areas than exist.** For example, 12 areas with the core needing about 7, so leaving areas untaken is normal.

**Mechanisms I rule out:**
- **Guards that escalate over time:** they break pillar 4 and the owner's "waiting doesn't make it worse".
- ~~**Guards that come for you:** they break pillar 3 ("mobs only defend").~~ *Superseded 2026-11-14: the owner asked for an active enemy and pillar 3 now reads "raid what you build" (Q21). H7 builds raids, paced by the player's economy, not by time.*
- **Areas that toughen as you reclaim others:** this is allowed by the wording, but it punishes exactly the "build strength first" play the owner asked for.
- **Guards that adapt to your fleet** (a heart that leans against your newest design): possible, and visible on the sheet before you commit. But it turns reading into guessing, so it stays an idea, not a proposal.

### Order: the cap first

The cap is cheap: one limit, one research item, one order and one recalibration. It goes straight at fun questions 1 and 3, and it creates the "strength" that an open world would let you build up. An open world without it would make the swarm bigger. With it, the open world becomes "choose where to earn your next cap raise". So: test the cap alone (H5-A); if it holds, the open map is H6 on top of it.

### Check against VISION.md

| VISION.md line | Fit |
| --- | --- |
| Fantasy: "grow from one probe into an industrial presence that can fight for the system's best resources" | Both fit. The open world shows the best resources from the start. |
| Original note: "explore, expand, exterminate" | The open world adds explore. |
| Original note: "The rate of resources delivered to the probe sets the rate of ship production." | A cap still lets throughput set the rate, up to the limit. It's a historical note, so leave it. |
| Fixed: "Playable on a phone browser. Logistics are abstract routes between nodes" | Fits. The owner OK'd panning; the overworld stays a node graph. |
| Fixed: "Each star system is one long game, played across many short sessions" | Fits both. |
| Fixed: "No fail state" | Fits. An area too big for your cap is a wall you come back to, not a loss. Withdraw stays free. |
| Fixed: "Ships take orders at nodes; no unit micro." | Fits. Recycle is an order at the probe. |
| Pillar 1: "Throughput is the throttle. The rate your network delivers resources to your factories and shipyards gates everything else." | **Tension with the cap.** The cap is a ceiling throughput doesn't set. Proposed wording in QUESTIONS.md Q18 (only if a cap ships). |
| Pillar 2: "Risk scales with reward... a bad commitment wastes production" | Stronger with the cap: a lost ship is a lost slot, so a bad commitment stings. |
| Pillar 3: "Guardians have factories. Mobs only defend... Win a node by out-producing their replacement, or cut their supply first." | The cap shifts "out-produce" toward "out-compose" for big nodes, and makes "cut their supply" necessary for some. This fits the pillar's either/or. No edit. |
| Pillar 4: "A puzzle, not a race. No clock and no pressure. The challenge is building an efficient network." | Fits. Time-based escalation is ruled out above. The challenge widens from "an efficient network" to "the right fleet from your network". I read that as within the pillar, so I propose no edit. |
| Pillar 5: "Every system makes the next one stronger." | Fits. Cap research is a natural thing to carry into new game+ later. |

## Current mechanics

Built in Milestone 1 (build-20261106-2, spec H1 below):

- One star system with a probe, five asteroids and one rich node guarded by a guardian hive (the Bloom).
- Extractors on asteroids, ore routes to the probe with pods you can see moving, and route upgrades.
- A single build queue at the probe, paid from delivered ore.
- A shipyard that turns stock into one ship type, so its rate follows throughput. It can be switched off.
- Ships ordered between nodes (send, rally), with deterministic wave combat at the guarded node.
- Capture of the rich node, a result panel, then free play.
- Pause, 1x/2x/4x, a tuning panel, a feedback button, and autosave.

H2 (build-20261108-1, spec below) added the Root, a second guarded node that feeds the Bloom, and three system variants that differ only in the Root.

H3 (build-20261108-2, spec below) replaced the map with a 16-node field and three layouts: ice and crystal pockets, lens and plating made at the probe, lancer and flak yards next to the drone yard, Thorn and Spore guards with counter combat, the guard ring and Strong/Even/Weak tags, and a capture-order result panel.

H4 (build-20261108-3, spec below) wrapped the field in a campaign:
- an overworld of six areas cut from the H3 frame, starting at Landfall;
- area landing, reclaim and withdraw;
- a stockpile filled by hauls and shipments;
- seven research items, including the Lancer and Flak designs and the probe core, which wins the game.

H5 (build-20261108-4, spec below) added a fleet limit per area (12, raised to 18, 24 and 30 by the Command limit research), the Recycle order and the `fleetFull` yard state, with areas recalibrated so drones alone can't take a medium or The Deep.

H6 (build-20261108-5, spec below) opened the overworld to 10 areas in four bands, with command relays that raise the fleet limit and open the next band, and the combat amendment (guards strike their counter first). The Root was removed.

H7 (build-20261114-1, spec below) is the current build. Data `run.mode` `"field"` parks the overworld, research and relays. A run is one field:
- Extractor and Hauler ships built at the probe; Mine marks; haulers assigned by haulers ÷ extractors;
- an allocation of weights 0–5 per type, shown as a radar, in place of the build queue and yards;
- hive raids paced by your economy ships and aimed at the mined rock nearest the hive;
- a shared fleet limit of 30 that counts economy ships.

## Hypotheses

### H8 candidates (iteration 8): A and B picked

*The owner picked B, then added A (QUESTIONS.md Q22). The spec is "H8 (Milestone 2, iteration 8, spec ready): Hold the front" below. Where they differ, the spec wins: drag is the primary gesture, tap-Move-tap is the fallback, and `hauler.rebalance` is folded into `hauler.autoNeed`.*

*Iteration 8, 2026-11-14. The triage is in PLAYTEST_LOG.md (build-20261114-1, 2026-11-14). **H7 is supported**: the owner defended a raid ("That felt pretty good"), endorsed the shared limit ("That's good"), pivoted from economy to offence and took the hive. The friction is the hauler layer and the speed of the controls. QUESTIONS.md Q22 asks for the pick. No spec until then.*

#### Ride-alongs (fixes that ship with A, B or C)

These are the H7 rule gaps and the regression from the triage. Each holds whichever option is picked. Together they are about a third of an iteration.

1. **Haulers by need, not per extractor.** Each worked rock gets a hauler need:
   - `need = max(1, ceil(yieldPerMin × roundTripTicks × hauler.needPct ÷ (100 × T × cargo)))`, where `roundTripTicks = 2 × distance ÷ ship.hauler.speedSu`. All integer.
   - At v13 values and 110%, the needs are a1 1, a2 1, a3 1, a4 1, a5 3, a6 2, a7 2, so 11 for the full field. H7's ratio rule tends toward 13, with 2 on a1 and a2 where 0.73 is enough. This answers "Two haulers ended up at A1 when it looks like only one is needed".
   - Assignment picks the rock with the largest shortfall (need − assigned). Ties go to the rock nearest the probe, then the lower index.
2. **Haulers rebalance at the probe.** After each delivery, a hauler whose rock has more haulers assigned than its need moves to the rock with the largest shortfall, if one exists. At most one hauler moves per delivery, and only from over-need to under-need, so it can't thrash. This answers "The haulers should redistribute once they drop at home."
3. **No surplus haulers.** The hauler type is eligible for the allocation only while the field's total shortfall is above 0 (Σ need − haulers alive − haulers in the bay). The hauler weight becomes a priority ("how soon"), not an amount, and its state line reads "enough haulers". This answers "the extra haulers sitting around feel much worse". *(Superseded 2026-11-14: extractors did not stop at the free slots, since H8 measured 25 built against 13 slots. See "H4b. No surplus extractors".)*
4. **Raid target badge.** From muster to the raid's end, the target rock carries the raiders' two-colour ring as a badge, and the rock's sheet says "Raid coming". This answers "an icon designation on the asteroid that's going to be raided".
5. **Fleet panel with Recycle.** The top bar's "Fleet 18/30" chip opens a panel:
   - five rows (icon, count alive, how many idle at the probe), plus Recycle with a −/+ count per type;
   - Recycle takes idle ships first, then the highest ids, wherever they are; a recycled docked extractor frees its slot; the refund is `fleet.recycleRefundPct` as now;
   - the panel fits 375x667, and every button is ≥ 44 px.

   This answers "Can't see at a glance how many of which ships I have" and "recycle from… the fleet comp window".
6. **Reproduce "A2 just got a third hauler. A1 has no haulers."** This is a rule test plus a field-opening replay check (see the triage). It's a bug if A1 was marked and worked at that moment. Ride-alongs 1–3 replace F6's pick, but the cause should still be known first.

Tunables (ride-alongs; all integers):

| Key | Default | Range | Feels like (low / high) |
| --- | --- | --- | --- |
| `hauler.autoNeed` | 1 | 0–1 | 0: H7's per-extractor ratio, and haulers built while their weight is above 0 (the comparison) / 1: by need, no surplus |
| `hauler.needPct` | 110 | 100–200 | 100: exactly enough; buffers creep up when trips bunch / 200: double staffing, idle haulers again |
| `hauler.rebalance` | 1 | 0–1 | 0: H7's sticky haulers / 1: rebalance at the probe after a delivery |

Note for calibration: fewer haulers means fewer economy ships, and R4 sizes raids by economy ships. A full field has about 2 fewer haulers (11 against about 13), so its raids are about one raider smaller, and the first raid (at 6 economy ships) may come a little later. The raid-threat and pace targets need a rerun whichever option ships.

#### A. A front worth holding (recommended)

- **Claim:** when the economy staffs itself and warships visibly protect it, the player's attention moves to where to mine and how much force holds the front, and the economy-against-offence decision becomes the whole game.
- **What it changes, beyond the ride-alongs:**
  1. **A hauler count per rock.** The rock sheet gets "Haulers: Auto (2)" with −/+ (44 px), from 0 to `rock.haulerMax`. A set count overrides the need for that rock (ride-along 1), and "Auto" restores it. New input: `setHaulers(node, count | auto)`.
  2. **The military shields the economy (R7 change).** In a round where at least one warship is at the rock when the round starts, the raiders strike warships only, and their overflow is lost. Economy ships die only in rounds with no warship standing. A token defence buys one round, not safety. (`raid.shieldEcon`)
  3. **Haulers hold back.** From launch until the raid ends, haulers bound to the target rock wait at the probe, and they resume afterwards. Extractors stay: they are the stake. This promotes Can wait `cw-h7-hauler-raid-wait`. (`raid.haulersHold`)
  4. **Mine mode.** A Mine button in the bottom bar. While it is on (tap to toggle, or hold it), tapping a rock toggles its mark without opening the sheet. That's one tap per rock instead of two.
  5. **Clearer weights.** Each probe-sheet row shows its share of income next to the weight ("3 · 30%"). One line under the radar reads "Income is split by these weights."
- **Why, from the quotes:**
  - "Some ability to determine how many haulers should be at an asteroid."
  - "it'd be better if it had to fight through the military first. So if the military units are there, they keep the economy units alive."
  - "hold a button, click, rather than have to click and then say mine this rock."
  - "kind of unclear how this one to five… works."
  - Shielding plus a front the owner already likes ("You can kind of build a front") makes defence a standing commitment of slots, which is the trade H7 wants felt.
- **Rough size:** one iteration, smaller than H7:
  - core-engineer: ride-alongs 1–3, `setHaulers`;
  - faction-ai: shield and hold-back;
  - engineer: fleet panel, badge, Mine mode, rows;
  - a recalibration.
- **Leaves out:** moving ships by drag or hand-moving economy ships (B), raids at more than one rock, and the overworld (C).
- **Risk:** shielding and hold-back weaken raids against a defended rock. Calibration keeps "a defence no larger than the raid wins, losing ≤ 2" and adds "a defence of half the raid falls, and then the raid hits", so a token guard isn't enough. "Only one asteroid to defend" gets easier still. If the owner says defence became trivial, H9 tests more than one raid target.

Tunables (A, beyond the ride-alongs):

| Key | Default | Range | Feels like (low / high) |
| --- | --- | --- | --- |
| `rock.haulerMax` | 6 | 2–10 | the top of the per-rock stepper. 2: little room to over-staff a far rock / 10: a long, fiddly stepper |
| `raid.shieldEcon` | 1 | 0–1 | 0: H7's overflow onto economy ships / 1: the economy is safe while a warship stands |
| `raid.haulersHold` | 1 | 0–1 | 0: haulers fly into the raid (H7) / 1: they wait at the probe until it ends |

Draft success criteria (one 20–30 minute phone session):
1. They don't mention haulers in the wrong place, or extra haulers.
2. They use the hauler stepper at least once, or says Auto was right.
3. At least one raid is beaten with no economy ships lost, and they notice.
4. They mark rocks in Mine mode.
5. They can say what a weight of 3 means.

Draft fun questions:
1. How much force did you leave on the front, and did that feel like a choice?
2. Did you set a rock's hauler count, or leave it on Auto?
3. With the economy running itself, what did you spend your attention on?

#### B. Move ships by hand

- **Claim:** moving ships rock to rock directly (any type, with a split) makes defence and logistics feel responsive enough that the field plays like the "simplified StarCraft" the owner asked for.
- **What it changes, beyond the ride-alongs:**
  - **A move order from any node to any node.** The phone-first form is three taps: tap the source rock, tap "Move", tap the destination. Dragging from rock to rock is the same order as an in-build A/B (`input.dragMove`).
  - **Hold to split.** Pressing and holding Move counts ships up one per `input.holdStepMs`, and the release sends that many.
  - **Economy ships can be moved by hand**, which reverses F12. A moved hauler is pinned to its rock, and auto staffing skips pinned haulers. A moved extractor binds to the destination if it has a free slot.
- **Why, from the quotes:** "it feels a little clunky, I have to click the asteroid and send ships there, like a drag, from one asteroid to another… would be cool. Maybe hold the button to split them."
- **Rough size:** one iteration, mostly client gesture work and smoke tests on both viewports. The sim change is small.
- **Leaves out:** A's shield, hold-back, hauler stepper and Mine mode. Hauler counts are set by moving haulers instead.
- **Phone and VISION:**
  - A rock-to-rock drag isn't precision dragging when every rock is ≥ 44 px. But the known overlap of rings near the hive (H7 handoff) makes drops there unreliable, so the tap form stays primary.
  - Hand-placing economy ships is the closest the game has come to unit micro. "Ships take orders at nodes; no unit micro" still holds, because a move is an order between nodes, but the auto-staffing and the pins will compete.

#### C. The map returns

- **Claim:** H7's loop holds across a campaign. This is H7 candidate B: the H6 overworld (relays, bands, research) with the ship economy, allocation and raids in every area.
- **What it changes, beyond the ride-alongs:**
  - `run.mode` back to campaign, with the field rules in every area;
  - new meanings for the research tied to the old economy;
  - all ten areas recalibrated with raids.
- **Why:** H7's claim held, so the long game ("Each star system is one long game…") can come back on top of it. The owner didn't ask for this in the dictation, so this is the team's roadmap, not their request.
- **Rough size:** about two iterations.
- **Leaves out:** A's and B's controls. The hauler and raid friction they named would repeat in ten areas before it's fixed in one.

#### Recommendation

**A, with the ride-alongs.** Six of the owner's requests are hauler staffing, the fleet panel, the raid badge, military first, Mine marking and the weights. A and its ride-alongs answer all six, and the extra haulers were the one thing they called "rough". A keeps the H7 claim intact while removing the friction around it, so the next session tests the decision instead of the babysitting. B answers one request (the move gesture). It is the natural add if the owner wants it ("A, plus B"): about half an iteration more, mostly client work. C should wait until the in-field loop runs without friction.

#### VISION impact (VISION.md is protected; flagged, not edited)

| Option | Impact |
| --- | --- |
| A | None. A hauler count is an order at a node, shielding is a combat rule, and raids still never touch the probe ("No fail state"). |
| B | Stretches "Ships take orders at nodes (attack, guard, escort); no unit micro" for economy ships. Moves between nodes fit the wording, but hand-placed haulers lean toward micro. No edit proposed. If B ships and the owner likes it, the Director may want to confirm the line. |
| C | Restores the "one long game" fixed decision and brings pillar 5 back into play. No edit. |
| All | **Q18 (pillar 1 wording) is ripe.** The owner endorsed the shared limit ("That's good"), and Q18's answer was "revisit after play". Its proposed text mentions a limit "raised by research", which field mode doesn't have. Rewording it is the Director's call when bundling. I don't add it to Q22, to keep that question one reply. |

### H8 (Milestone 2, iteration 8, spec ready): Hold the front

The owner picked B (QUESTIONS.md Q22: "B, can we tap and drag to move ships?  Long-tap then drag to move half?"), then added A ("Do A at the same time"). The Director logged both in DECISIONS.md (048156b, 756a237). So H8 is **A and B together, with every ride-along**. The background is "H8 candidates" above. Where they differ, this spec wins, and where this spec and BACKLOG.md differ, the spec wins.

Everything not mentioned here is H7 as built (data v13): field mode, the allocation, extractors and Mine marks, raids R1–R9, the shared fleet limit, combat, and the client.

#### Claim

**When the economy staffs itself and the player commands the front directly, the economy-against-force decision becomes "where do my warships stand, and how many", and it is fun.** Commanding the front means dragging warships between nodes, with warships shielding the economy ships behind them. The player spends attention on that decision, not on correcting haulers.

Secondary: on a phone canvas, a drag between nodes and a long-press drag for half are reliable and fast.

What would disprove it:
- The owner still talks about haulers in the wrong place, or extra haulers.
- Drags misfire, going to the wrong node, or a tap becomes a move. Or they go back to the sheets to send ships.
- Holding a rock with warships feels like a chore, or defence stays trivial: "only need to defend one asteroid", with nothing to decide.
- They can't say what a weight does.

#### The smallest mechanics that test it

1. **Haulers by need** (ride-alongs 1–3): each worked rock has a hauler target. Haulers go where the shortfall is largest and rebalance when they get home. The probe never builds a hauler that no rock needs.
2. **A hauler count per rock** (A1): the target is Auto (the need), or a number the player sets on the rock sheet.
3. **Drag to move warships** (B): a drag from one node to another moves all its warships. A long-press, then a drag, moves half. It is a group order between nodes, never a selection of single ships.
4. **The military shields the economy** (A2), and **haulers wait at home while their rock is raided** (A3).
5. **Readability:**
   - a raid-target badge (ride-along 4);
   - a fleet panel with Recycle, opened from the Fleet chip (ride-along 5);
   - a Mine mode (A4);
   - each weight's share of income (A5).

New inputs: `moveShips`, `setHaulers`, `recycleFleet`. There are no others.

#### Which ships a drag carries: warships only

**A drag carries warships only:** Drone, Lancer and Flak. **Haulers are governed only by the per-rock count**, and extractors only by Mine marks, so the two controls never fight. A hauler moved by hand would either be pulled straight back by the auto rule, or need a pin, and the per-rock count already expresses that pin.

The owner's drag idea came while haulers were misplaced ("three haulers at A2… a drag, from one asteroid to another"). Staffing by need, plus the per-rock count, fixes that at the cause, which leaves the drag free to be the military order.

There is no A/B for this: a mode where the drag also carries haulers would bring back the pin problem. Economy ships stay unsendable by hand (H7 F12). DECISIONS.md logs this.

#### Rules (field mode): changes to H7

`T` = 1800 ticks per game minute. All integer, fixed orders, no RNG. Type order: extractor, hauler, drone, lancer, flak.

**H1. Hauler need and target.** For a **haulable** node `n` (worked and Mine-marked, as H7):
- `yieldPerMin(n)` = the node's extractors (docked plus free) × its rate per extractor: `extractor.orePerMin` for an asteroid, `pocket.resourcePerMin` for a pocket, `heart.orePerMin` for the hive. This is the rate F4 produces there now.
- `roundTrip(n)` = 2 × the leg ticks a hauler takes from the probe to `n` at `ship.hauler.speedSu` (the same leg as F7).
- `need(n) = max(1, ceilDiv(yieldPerMin × roundTrip × hauler.needPct, 100 × T × ship.hauler.cargo))`.
- `target(n)` = `haulerSet[n]` if the player set a count, else `need(n)`. A node that isn't haulable has a target of 0.
- The needs at v13 values with `hauler.needPct` 110, computed from the coordinates, are 1 each for a1–a4, 3 for a5, 2 each for a6 and a7, and 1 each for p1 and p2 once taken. h8-sim's test pins them.

**H1 amendment (Director, 2026-11-14, from h8-sim's report).** As first written, H1 left every target at 0 at the landing, because no rock is worked until its extractors dock. The Hauler bay couldn't take ore, all 40 opening ore went to extractors, and the first hauler came at 3:13 on v14 (H7: tick 90), with no ore delivered until minute 4. That breaks H7 criterion 1 and the "first minute is about mining" claim. So, for staffing only:
- A node is **staffed** if it is Mine-marked and either haulable (as H7) or has at least one extractor ship bound for it (docked or on its way).
- H1's need, target and shortfall, H2's pick and H4's bay use staffed nodes. `yieldPerMin` counts bound extractors (docked plus on their way) plus free ones, so a rock's need is known when its first extractor launches.
- A hauler assigned to a staffed node that isn't worked yet flies there and waits for cargo as in F6. The "no longer worked" release in F6 applies only once the node has been worked, or when it stops being staffed (Stop, or every bound extractor lost).
- Acceptance: on v14 with no inputs, the first hauler is built no later than H7's (tick 90 ± the build time), the first delivery is no later than H7's tick 1035, and ore delivered by minutes 1, 2 and 3 is at least H7's (8, 20, 40). The opening never builds a hauler beyond the staffed targets.

**H2. Assignment (replaces F6's pick).**
- A hauler at the probe with no haulable target picks the haulable node with the largest shortfall above 0, where shortfall = `target − assigned`.
- Ties go to the node nearest the probe, then to the lower index.
- If no node has a shortfall, the hauler **parks idle at the probe**.
- Haulers are processed in id order, and `assigned` is updated after each pick.

**H3. Rebalance at home.**
- When a hauler arrives at the probe and unloads: if its node's `assigned > target`, it leaves that node (`assigned` −1) and picks again by H2, which may mean parking idle.
- Otherwise it keeps its node, as in H7.
- So a lowered count takes effect as each hauler next reaches home, which is about 9–21 s at 1x on the field's rocks (a round trip of 262 to 633 ticks).
- H7's "keep while haulable, reassign when not" still holds.

**H4. No surplus haulers (allocation eligibility).**
- `haulerShortfall` = Σ over haulable nodes of `max(0, target − assigned)`, minus idle haulers at the probe, minus haulers in the bay.
- The Hauler type is **eligible** in F2 only while `haulerShortfall > 0`, on top of the H7 conditions.
- The hauler weight is now a priority (how fast), not an amount.
- While the type is ineligible, its share keeps what it holds, and `allocStatus` reports the new state `enough`.


**H1 amendment rulings (Director, 2026-11-14, from h8-sim).**
- **Committed extractors staff a rock.** The extractor in the probe's bay, and a full extractor share, count at the rock F5 would send them to (the nearest mineable rock with a free slot, then the lower index). A share with weight 0 doesn't count. F2 rereads the shortfall when the extractor share fills, so tick 0 splits as H7 did. Result on v14: first hauler at tick 90 and first delivery at tick 1035, the same as H7, and 52 ore by minute 3 against H7's 40.
- **A hauler at a staffed rock that isn't worked yet waits** while any extractor staffs it: docked, on its way, or committed (in the bay or a full share). It leaves on Stop, or once nothing docked, bound or committed is left at the rock. (Widened in h8-sim round 2: waiting only for bound extractors made haulers fly empty round trips to a rock whose committed extractor was held by the fleet limit.)

**H4b. No surplus extractors (Director, 2026-11-14; under `hauler.autoNeed` 1 only).**
- The Extractor gets no ore and its bay doesn't start while no Mine-marked, unguarded rock has a free slot.
- Free slots are counted after extractors docked, on their way, unbound (idle at the probe or flying home), and the one in the bay.
- While the Extractor is blocked, its share is kept and its row reads "enough extractors", the same way the Hauler's does.
- Marking a rock, capturing a pocket, or losing an extractor to a raid or a recycle reopens it.
- Why: with no inputs, H8 as first built made 25 extractors in 10 minutes against 13 slots. The owner's complaint about idle haulers applies to idle extractors as well.

**H5. `hauler.autoNeed` 0 restores H7's F6 exactly:** the ratio pick, haulers that stay on their rock, no rebalance and no H4 condition. The per-rock count is then ignored and its stepper hidden. This is the in-build comparison.

**H6. `moveShips`** (`from`, `to`, `part: 'all' | 'split'`). The sim computes the counts on the tick it applies the input:
- `all`: every warship of each type parked at `from` (not in transit), as `shipsAtByType` gives them.
- `split`: per type, `floor(count × move.splitPct ÷ 100)`. If that totals 0 while at least one warship is there, it takes 1 ship of the first type present, in type order.

Then:
- It is applied exactly as `sendShips` with those counts: the same validity (H5 and H7 rules, warships only) and the same effect (an attack if `to` is guarded, a guard order otherwise).
- It is invalid if the computed total is 0, or if `from` = `to`.
- Replays record the input, not the counts, so they replay identically.

**H7. `setHaulers`** (`node`, `count: number | null`):
- Valid for an asteroid, or a captured pocket or hive. `count` is null (Auto) or 0..`rock.haulerMax`.
- It sets `haulerSet[node]`. The setting is kept while the rock is unmarked and applies again when it is re-marked.
- 0 is allowed: the rock is mined, but its ore piles up ("Backed up").

**H8. `recycleFleet`** (`counts` for all five types). It recycles up to that many ships of each type, wherever they are.
- **Not eligible:** ships at a guarded node in battle, and ships at a raid's target while that raid is in its fight phase.
- **Order within a type:**
  1. idle at the probe;
  2. parked or docked at a node, by node index;
  3. in transit.

  The lowest id goes first within each group.
- **Refund:** each ship refunds `fleet.recycleRefundPct` of its ore cost, as `recycleShips` does.
- **Side effects:**
  - a recycled hauler's cargo is lost;
  - a recycled docked extractor frees its slot, and F5 re-dispatches that tick.
- It is valid if the clamped total is at least 1. `recycleShips` (per node) stays.

**H9. Shield (R7 amendment, `raid.shieldEcon`).**
- If at least one warship is `at` the target when a raid round starts, the raider pools strike **warships only**, and their overflow is lost.
- Economy ships are struck only in rounds that start with no warship there.
- At 0, R7 is as in H7: overflow goes on to haulers, then extractors.

**H10. Haulers hold (`raid.haulersHold`).** From launch (phase `out`) until the raid ends, this applies to haulers whose node is the raid's target:
- a hauler at the probe stays there and keeps its assignment;
- a hauler at the node loads `min(buffer, cargo)` and leaves at once, without waiting for a full cargo;
- a hauler flying out finishes its leg, then does the same.

The target stays mined (its docked extractors stay, and its haulers still count as assigned), so R5 and R6 are unchanged. H10 replaces Can wait `cw-h7-hauler-raid-wait`.

#### Save, data version and replay

- **`dataVersion` 14** (h8-sim): the new keys below, plus `haulerSet` in the field state. Old saves are discarded with the existing toast.
- **The reference replay** (h8-sim, then h8-raids) adds:
  - a need-based assignment;
  - a rebalance after `setHaulers` lowers a count;
  - the Hauler state `enough`;
  - `moveShips` all, and split, including the 1-ship fallback;
  - `recycleFleet` of a hauler in transit and of a docked extractor;
  - a shielded round: economy ships survive while a warship stands, then die after it falls;
  - haulers held during a raid, then resuming.

  The determinism hashes are re-baselined.

#### Tunables (H8, data v14, all integers)

| Key | Default | Range | Feels like (low / high) |
| --- | --- | --- | --- |
| `hauler.autoNeed` | 1 | 0–1 | 0: H7's haulers (per extractor, staying put, built while weighted), the comparison / 1: by need, rebalancing, no surplus |
| `hauler.needPct` | 110 | 100–200 | 100: just enough, but buffers creep up when trips bunch / 200: double staffing, idle haulers again |
| `rock.haulerMax` | 6 | 2–10 | the top of the per-rock stepper. 2: little room to over-staff a far rock / 10: a long stepper |
| `raid.shieldEcon` | 1 | 0–1 | 0: as H7, overflow kills economy ships while defenders stand / 1: the economy is safe while a warship stands |
| `raid.haulersHold` | 1 | 0–1 | 0: haulers fly into the raid (H7) / 1: they wait at home until it ends |
| `move.splitPct` | 50 | 25–75 | the long-press share. 25: a quarter peels off / 75: most go, a picket stays |
| `client.longPressMs` | 450 | 250–900 | client, this device. 250: a slow drag becomes a split by accident / 900: the split feels sluggish |
| `client.dragSlopPx` | 12 | 6–24 | client. 6: a shaky tap becomes a drag / 24: short drags read as taps |
| `client.moveGesture` | 1 | 0–1 | client. 1: drag / 0: the tap-Move-tap fallback (see the client section) |

The candidates' `hauler.rebalance` is folded into `hauler.autoNeed`, because rebalancing has nothing to aim at without need targets. The new `client.*` keys follow `client.autosaveSec`: they live in data, show in the tuning panel tagged "this device", are stored in settings, and never reach the sim.

#### Selectors (sim, read-only)

- **`rockStatus`** gains:
  - `haulerNeed` (H1's need, 0 when not haulable);
  - `haulerSet` (null, or the count);
  - `haulerTarget`;
  - `raidTarget` (true from muster to the raid's end);
  - `haulersHeld` (true while H10 applies).
- **`allocStatus`:**
  - The Hauler state can be `enough`.
  - Each type gains `incomePct`: its weight × 100 ÷ the sum of the weights of unlocked types with a weight above 0, rounded down; 0 for a type that is off or locked. It is the share of income that weight asks for. The state line says when a type isn't taking ore.
- **`fleetStatus`**, per type:
  - `alive`;
  - `idle` (at the probe: idle economy ships, or warships parked there);
  - `building`;
  - `recyclable` (eligible under H8).
- **`movePreview(world, from, part)`:** the warship counts a `moveShips` would carry now (H6). The client uses it for the drag ghost and to decide whether a drag can start.
- **`raidStatus`** gains `holding`: the number of haulers H10 is holding.

#### Client: phone UI (H8)

The H1–H7 rules hold: 375 px portrait, no hover, targets ≥ 44 px, at most 2 taps per action from its screen, and nothing in the HUD shifts.

**Drag to move (`client.moveGesture` 1).**
- **No competing gesture.** Field mode has no pan or zoom: the field is fitted (`fit.ts`), and the canvas has only a `click` handler today. The H6 overworld pan in `worldview.ts` is unused in field mode, so a drag on the field canvas has no other meaning. Set `touch-action: none` on the canvas in field mode, as world mode already does, so the browser doesn't scroll or zoom under a drag.
- **States**, for the primary pointer only. A second pointer cancels the gesture.
  1. **Down** on a node (by `hitTest`): remember the node and start the long-press timer.
  2. **Moved past `client.dragSlopPx` before `client.longPressMs`:** if `movePreview(from, 'all')` is above 0, start an **all-drag**. Otherwise the gesture ends, with no move and no tap.
  3. **Held within the slop for `client.longPressMs`:** if `movePreview(from, 'split')` is above 0, arm a **split**: the source ring pulses, the ghost shows the half counts, and `navigator.vibrate(10)` runs where it's available. Moving past the slop then starts a **split-drag**. Released without moving, it is a tap.
  4. **While dragging:**
     - a dashed line runs from the source to the finger;
     - the **ghost chip** (type icons and counts) sits 48 px above the finger, so the thumb doesn't hide it;
     - the **drop target** is `hitTest` at the finger, excluding the source. It gets a bright ring and its name, plus "Attack" and its Strong/Even/Weak tag if it is guarded;
     - over a sheet, the HUD or empty space there is no target, and the line turns grey.
  5. **Release** on a target sends `moveShips(from, to, part)`, with a toast: "Moved 6 → A5" or "Sent 6 to attack P2". Release anywhere else (empty space, the source, a sheet, off the canvas) **cancels**: no input and no change of sheet. `pointercancel` also cancels.
- **A plain tap** opens the node's sheet, as in H7. A tap is a release within the slop, before or after the long-press time. A tap on empty space closes the sheet. The `click` that follows any drag is suppressed, like `worldView.consumeDrag`.
- **Hit reliability:**
  - A drop uses the same `hitTest` as a tap: at least 44 px of reach, nearest centre wins.
  - Rings near the hive overlap (a known H7 issue). The live highlight shows exactly which node will receive the ships, so the player can adjust before lifting.
- **The sheet's Send panel stays,** as the precise path (counts per type).

**Fallback: tap-Move-tap (`client.moveGesture` 0).**
- Drags are off. A node sheet with warships shows "Move all" and "Move half" (44 px).
- Tapping one shows the fixed banner "Tap where to send 6 ships · Cancel". The next node tap sends `moveShips`; empty space or Cancel cancels.
- **Both modes are built.** If h8-client's smoke tests can't make the drag reliable (see BACKLOG), the engineer reports it, and the Director decides whether to ship with default 0.

- *Amended (Director, 2026-11-14):* the hold ends on the tick the raid's outcome is decided (beaten, hit, turned back or withered), not when the raiders reach home.

**Hauler count (rock sheet).**
- The Haulers row reads "2 · Auto", with −, + and Auto buttons (each 44 px).
- Once a count is set, it reads "3 · set (Auto 2)".
- The row is hidden when `hauler.autoNeed` is 0.

**Mine mode.**
- **Entering:** a **Mine** button in the bottom bar (44 px, pick icon). Tapping it turns the mode on: the button shows as pressed, and a one-line toast says "Tap rocks to mine or stop. Tap Mine to finish."
- **In the mode:**
  - a tap on an asteroid, or a captured pocket or hive, toggles its mark (`setMine`) with a badge pop, and opens no sheet;
  - taps elsewhere do nothing;
  - drags are off;
  - the raid banner still opens its rock.
- **Leaving:** tap Mine again.

That's one tap per rock, where H7 needed two.

**Weights.**
- Each probe-sheet row shows `weight · incomePct%`, for example "3 · 30%".
- One line under the radar reads "Income is split by these weights."
- In the `enough` state, the Hauler state line reads "enough haulers".

**Raid-target badge.**
- From muster to the raid's end, the target rock carries the raiders' two-colour ring as a badge (`drawRaidBadge`). It is distinct from the Mine badge and sits on the opposite side.
- The rock sheet shows "Raid coming: 4 Spores, 1 Thorn", and adds "Haulers waiting at the probe" while H10 holds them.

**Fleet panel.** Tapping the "Fleet 18/30" chip opens it.
- It has five rows. Each shows the type's icon, name, alive count, "idle N" and a building dot.
- Each row also has a recycle count with −/+ and a "Recycle N (+X ore)" button that sends `recycleFleet`.
- It fits 375x667 without scrolling, and every button is at least 44 px.

**Phone checks.**
- Each of these fits 375x667 without scrolling, including under the wide-font stress: the probe sheet with the % column, the rock sheet with the hauler row and raid lines, and the fleet panel.
- The badge, the Mine-mode state and the drag highlight shift nothing in the HUD.

#### Art needs (folded into h8-client, within ART_STYLE.md)

- `drawRaidBadge(ctx, r, mix)`: small, reusing the raid marker's ring.
- The drag line, ghost chip and drop-target highlight, in the panel style, with hot pink for an attack target.
- The split-armed pulse on the source.
- The Mine button's pick icon, reusing `drawMineBadge`.

Any new colour gets a palette key and an ART_STYLE.md row.

#### Bots (H8): changes only where the new rules need them

Bots keep H7's strategies and selectors. They don't use the drag (it's a client gesture), `setHaulers` (they stay on Auto), `moveShips` or `recycleFleet`. Sim tests and the replay cover those, and the report says so.

**Changes:**
1. **Economy weights.** The Hauler weight no longer stops at "one hauler per slot". It stays at its lean or start value while any rock has a shortfall (`rockStatus.haulerTarget > haulers`); H4 makes the sim stop building on its own. The taken-pocket hauler rule becomes "any rock with a shortfall".
2. **Economy wiped** (this folds in Can wait `cw-h7-bots-post-wipe-idle`). When economy ships alive plus economy ships in the bays fall below 2, every strategy except `idle` and `static` sets Extractor and Hauler back to their `alloc.start.*` weights. It keeps them there until `econ` reaches `raid.firstAtEcon − 1`, then resumes its own rules.
3. **Nothing to build.** This applies when no bay starts for 2 game minutes, while `stockOre` is at least the ore cost of the dearest unlocked warship and all the strategy's warship weights are 0. Then `adaptive`, `greedy` and `drones-only` set their counter type's weight to 1 (Drone before any pocket is taken).
   - `idle` is exempt: it is the control for waiting.
   - `static` can't reach this state, because every one of its shapes weights at least one warship type.

**What each strategy does when no plan fits** (designer.md), walked for H8:

| State | `adaptive` | `greedy` | `static` | `idle` | `drones-only` | `adaptive-no-raids` |
| --- | --- | --- | --- | --- | --- | --- |
| The hive wave doesn't fit the limit | recycles economy ships, as in H7 (Director rule, h7-bots r1) | as adaptive, after its first hit | waits (a control; may time out) | n/a (never attacks) | can't fit, by design (flag 5); keeps building drones up to the limit (a control) | as adaptive |
| The counter is locked | takes the other pocket, as in H7 | as adaptive | n/a | n/a | n/a | as adaptive |
| A wave failed | H7's rule (recycle for the next wave) | as adaptive | attacks again when the estimate fits | n/a | as adaptive | as adaptive |
| The economy is wiped | change 2 | change 2 | keeps its shape (the sim rebuilds through it) | holds below the threshold | change 2 | n/a (no raids) |
| Haulers `enough`, every warship weight 0, ore piling up | change 3 | change 3 | can't happen | allowed (a control) | change 3 | change 3 |

**Inherited assumptions, checked:**
- **`static` (flag 1) may get stronger.** In H7, static's fixed hauler weight built haulers beyond need, and they ate fleet slots. Under H4 they don't, so static fields more warships. If static now takes the hive while losing less than half its economy, flag 1 fails. **That is a finding about the claim ("set and forget works"), not a number to tune around.** h8-design-data reports it to the Director.
- **Flag 2** (greedy's first hit kills at least 2 economy ships): under H10, held haulers survive, so the kills must come from docked extractors. Greedy fills a5's 3 slots and has no warships, so a hit should still kill 2 or more. Calibration confirms it.
- **Flag 6** (the slot trade) uses the number of haulers at adaptive's peak, which under need staffing drops toward 11. Both halves still hold if the best mix stays at v13's 16 (an arithmetic check; calibration reruns it):
  - 13 Mine slots + 11 haulers + 16 = 40, still more than 30;
  - 16 + 10 = 26, which fits in 30.
- **Raid size** (R4) counts economy ships alive. Fewer haulers make raids a little smaller and the first raid a little later, so the "first raid at 2–6 minutes" target is rechecked.
- **No new order-dependence.** The shield (H9) depends only on which ships are at the node when the round starts, not on any build or id order. The need (H1) depends only on data and positions. Neither adds a measurement that depends on order. The `min-wave` estimate is unchanged.

#### Calibration targets (H8, h8-design-data)

H7's targets carry over with the same values. Two are new:
- **A token guard isn't enough.** Against the full-economy raid on a5, a defence of half the raid's size (matched types) is beaten, and the raid then kills at least 1 economy ship. H7's "a matched defence no larger than the raid wins, losing at most 2" still holds.
- **Staffing is right.** On `adaptive`:
  - no rock's buffer sits at `node.bufferCap` for more than 30 game seconds in a row while its hauler target is met;
  - outside raids and Stops, at most 1 hauler is idle at the probe.

Flags 1–7 must stay met. A flag that values alone can't meet is a rule finding for the Director. Values only, in `data/sim.json`; `dataVersion` goes to 15 if any value changes.

#### Success criteria (H8; the owner, one 20–30 minute phone session; 4x is fine)

1. They don't mention haulers in the wrong place, or extra haulers sitting around.
2. They move warships by drag at least three times, including one long-press half move. They don't report a drag going to the wrong node, or a tap turning into a move.
3. At least one raid is beaten with no economy ship lost (the result panel shows it), and they notice that warships protected the economy.
4. They mark rocks with Mine mode, or says marking is quick enough.
5. They check the fleet panel, or recycles from it.
6. They can say what a weight of 3 does.
7. As in H7, they don't call raids a timer or a punishment.
8. The phone checks above hold: the sheets and the fleet panel fit, and nothing in the HUD shifts.

Optional: they try `client.moveGesture` 0 or `hauler.autoNeed` 0, and says which they prefer.

#### Fun questions for the handoff (H8)

1. When a raid came, did you drag ships to meet it? Did moving ships feel quick, and did you use the long-press half move?
2. Did keeping warships on a rock feel like holding a front worth the slots, or like a chore?
3. Did you set any rock's hauler count, or did Auto get it right?

#### Left out of H8 (hard limit)

- Drags that carry economy ships, selecting single ships, drags across several nodes, and drawn paths.
- Raids at more than one rock, raids that retarget to undefended rocks, and the "wider front" idea (a later hypothesis).
- The overworld, research and new game+, which stay parked.
- New ship or guard types.
- Pan or zoom in field mode.

### H7 candidates (iteration 7): A picked

*The owner picked A and approved the pillar 3 and 4 wording (QUESTIONS.md Q21, "A, yes"). The spec is "H7 (Milestone 2, iteration 7, tested on build-20261114-1): One field, live enemy" below; where they differ, the spec wins.*

*Iteration 7, 2026-11-14. Triage in PLAYTEST_LOG.md (build-20261108-5, 2026-11-14). The owner stopped at the start of Frost Shelf and proposed a new direction ("let's try the spider graph idea"). That direction is the baseline here, not one option among equals. QUESTIONS.md Q21 asks the owner to confirm the scope and the pillar wording. No spec until then.*

#### The direction, in one paragraph

The probe builds every ship, including the economy. **Extractor ships** fly to asteroids and mine them, and **hauler ships** run the routes home. There is no build queue. The probe's delivered ore is **split across ship types by an allocation** that the player reshapes at any time, shown as a spider (radar) graph. The enemy is **active**: the hive raids what you build, so you need a little force to protect the economy, and from then on you keep choosing between more economy and more offence. In the owner's words: "a simplified game of StarCraft… econ first, but you need to build a little bit of force to ward off incursions, and then at some point you're deciding whether you go more econ or more offense."

**Why it's the baseline.** Since H2, every difference in this game has been paid in time, and pillar 4 says time doesn't matter, so no trade-off is felt (H4 triage). The fleet limit (H5) fixed that for composition by making slots the currency. Raids fix it for the economy: an unguarded extractor can be lost, and an early army is economy you didn't build. "Max economy, then attack" becomes the greedy line with a visible risk, instead of the only line.

#### First-run fixes (ride along with A or B)

These come from the same feedback, and each holds whichever slice is picked.
1. **The first area teaches extraction.** Today Landfall's heart has no guards and the opening stock (40) buys a drone (18), so one drone wins it without mining. In H7 the opening stock buys economy ships only (about one extractor and one hauler), and the first target needs more combat ships than the opening stock can pay for.
2. **A landing starts on the economy.** Today H4 landing rule 4 turns the drone yard on at once. In H7 the landing allocation is economy only (`alloc.start.*`), and combat ships are built only once the player turns them up.
3. **No build queue.** It's removed by construction: there's nothing to queue, and no `build.queueMax`.

#### A. One field, live enemy (recommended)

- **Claim:** when the probe's output is split across ship types by an allocation the player can reshape at any time, and a hive raids what the player builds, the player keeps re-deciding economy against force, and that running decision is fun. Secondary: a ship-based economy reads at least as well on a phone as extractors and routes did.
- **What would disprove it:**
  - The owner sets the allocation once and leaves it ("set and forget"), or can't say why they changed it.
  - Raids feel like a timer, a nuisance or a punishment for growing.
  - The run still reads as "max economy, then build a fleet and attack".
  - The owner asks how to mine or haul.

**The smallest mechanics that test it:**
1. **One field, one run.** A run is one H3-sized field: the probe, about six asteroids (two of them far and rich), one ice pocket, one crystal pocket and the hive. Taking the hive wins the run, with the result panel and New run as in H1–H3. The overworld, research, relays and band locks are **parked**: dormant in data, as the Root was in H6, and not deleted.
2. **Five ship types on the allocation:** Extractor, Hauler, Drone, Lancer, Flak.
   - **Extractor:** flies to an asteroid, docks and mines `ship.extractor.orePerMin` into the rock's buffer. A rock holds as many as its `slots`.
   - **Hauler:** shuttles from a rock's buffer to the probe, `ship.hauler.cargo` per trip. A route's capacity is its haulers × cargo ÷ round trip, so distance still costs.
   - **No per-ship micro.** A new extractor docks at the nearest rock marked **Mine** that has a free slot. A new hauler joins the mined rock with the fullest buffer. The logistics choice is which rocks to mine (tap a rock: Mine / Stop), and the far rich rocks are the ones raids reach first. A send order can still move any ship.
   - **Lancer and Flak** unlock when their pocket's resource first reaches the probe (as in H3), and cost ore plus crystal or ice directly. The lens and plating step goes, to keep the slice small.
3. **The allocation.** Each type has a weight from 0 to `alloc.maxWeight`. Delivered ore flows into each type's share in proportion to its weight (integer accumulators, fixed type order). A ship launches when its share covers its cost and its resource, and the fleet limit allows it. Weight 0 means "not built". There is no queue and nothing to cancel. The landing allocation is `alloc.start.*` (economy only). **The input is a −/+ stepper (≥ 44 px) per axis, with the radar graph as the readout**, on the probe sheet. Dragging radar points is precision dragging on a phone (under 30 px per step on a five-axis radar at 375 px), so it isn't the input.
4. **The hive raids.** The field's heart is a hive with Thorn and Spore guards, as today, and it also sends raids:
   - **Trigger: what you build, never the clock.** The first raid leaves when you have `raid.firstAtEcon` economy ships. After that, at most one raid per `raid.gapTicks`, and only while you still have that many. A small economy is never raided after the first raid, and waiting never makes anything worse.
   - **Size:** one raider per `raid.econPerRaider` of your economy ships, up to `raid.maxSize`, drawn from the hive's own guards in its Thorn/Spore mix. At least `raid.hiveKeepPct` of the guards stay home. So counters matter in defence too, and a raid that is out (or beaten) leaves the hive weaker. That is a counter-attack window, and it makes pillar 3's "factories" visible.
   - **Target:** the mined rock nearest the hive. Raiders fight anything there under the normal combat rules (the combat amendment included), kill extractors and haulers, then fly home. They never touch the probe or its own mining, and a raided rock stays yours. **"No fail state" holds.**
   - **Warning:** when a raid leaves, a notice and a lane marker appear ("Raid: 4 Spores → A5, 25 s"). The flight time is the warning.
   - **Defence:** ships sent to a rock guard it (the existing send-as-guard). Taking the hive ends the raids.
5. **Fleet limit: the A/B.** `fleet.countsEconomy` 1 makes every ship count, extractors and haulers included. That is StarCraft's supply, and it makes economy against army a trade in slots, not only in ore. 0 is H5's army-only limit. Recycle stays (50% back); under a shared limit it is how you turn economy ships into army late.
6. **Removed from play:** the build queue and its inputs (`buildExtractor`, `buildRoute`, `upgradeRoute`, `cancelBuild`), route pods and upgrades, yard switches and their round-robin order, and the assemblers. Probe mining stays, as the floor against a softlock. Whether the dead code is deleted or left dormant is the core engineer's call at spec time.

**Tunables (proposed defaults; Engineers wire them, calibration sets them; all integers):**

| Key | Default | Range | Feels like (low / high) |
| --- | --- | --- | --- |
| `alloc.maxWeight` | 5 | 3–10 | 3: coarse, a few shapes / 10: fine but fiddly on a phone |
| `alloc.start.extractor`, `alloc.start.hauler` | 3, 2 | 0–5 | the landing allocation (the others start at 0). 0 and 0: you set it yourself |
| `ship.extractor.cost` | 20 | 5–60 | 5: the economy is free / 60: every extractor is a commitment |
| `ship.extractor.orePerMin` | 10 | 2–40 | replaces `extractor.orePerMin` |
| `ship.hauler.cost` | 15 | 5–60 | as for the extractor |
| `ship.hauler.cargo` | 10 | 2–40 | 2: far rocks need a swarm of haulers / 40: one hauler per rock, and logistics vanish |
| `ship.extractor.hp`, `ship.hauler.hp` | 6 | 1–40 | 1: any raider wipes a rock / 40: raids barely scratch |
| `fleet.countsEconomy` | 1 | 0–1 | 0: the limit counts warships only (H5) / 1: every ship counts (supply) |
| `fleet.cap` | 24 with a shared limit | 0–60 | 0: no limit / 60: the swarm returns. Calibration sets it; 12 if `fleet.countsEconomy` is 0 |
| `raid.enabled` | 1 | 0–1 | 0: no raids, a peaceful field (the in-build A/B) / 1: raids |
| `raid.firstAtEcon` | 6 | 2–20 | 2: raided almost at once / 20: raids only at a full economy |
| `raid.econPerRaider` | 3 | 1–10 | 1: every miner needs a guard / 10: raids are a nuisance |
| `raid.maxSize` | 10 | 2–30 | 2: never a threat / 30: a raid can empty the field |
| `raid.gapTicks` | 2700 (90 s) | 900–9000 | 900: a siege / 9000: about one raid per run |
| `raid.hiveKeepPct` | 50 | 25–90 | 25: raids gut the hive, so counter-attacks are easy / 90: raids are tiny and the hive never opens |

**Success criteria (the owner, one 20–30 minute phone session; 4x is fine):**
1. In the first minute, the first ships are economy ships, and the owner doesn't mention unwanted drones.
2. The owner changes the allocation at least three times, and can name why for at least one change (a raid warning, a loss, a target).
3. At least one raid is met by ships built or moved after its warning, and the owner can say whether a raid hurt.
4. The owner names a moment of choosing more economy or more offence.
5. They don't call raids a timer, rushed or a punishment for waiting, and don't describe the run as "max economy then attack".
6. They never ask how to mine or haul.
7. Every action is ≤ 2 taps from its screen; the probe sheet with the radar and five steppers fits 375x667; raid notices don't shift the HUD.

**Fun questions (draft; final at spec):**
1. Did you change the spider graph during the run? What made you change it?
2. Did the raids make you build a little force, or did they feel like a timer or a nuisance?
3. Was there a moment you chose between more economy and more offence? Which way did you go, and did it pay off?

**Capability flags for the bots (draft; each measures what can or can't be done, never minutes):**
1. A `static` bot (the best fixed allocation from a sweep) either loses at least half its economy ships to raids or can't take the hive within the limit. An `adaptive` bot (economy, defence on a warning, then offence) takes the hive on every seed.
2. A `greedy` bot (no warships until every rock is mined) has at least one rock wiped by a raid on every seed.
3. An `idle` bot that stays below `raid.firstAtEcon` economy ships is never raided: waiting makes nothing worse.
4. While a raid is out or just beaten, the hive's smallest winning wave is at least 30% smaller than at full strength: the counter-attack window is real.

**Risks:**
- **A continuous allocation can remove decisions instead of adding them.** If one shape is always right, the player sets it once and stops deciding. Raids, counters per target and the landing preset are what force a reshape, and flag 1 checks that a fixed shape fails. If it still plays as set-and-forget, the fallback is the owner's own alternative, "just a simple build queue" of discrete orders ("build 4 Flak"), as the next A/B.
- **Raids as a timer.** Raids are paced by what you build, not by time; the flight time is the warning; they never touch the probe; and a small economy isn't raided after the first time. `raid.enabled` 0 is the in-build comparison.
- **Punished for growing.** Raids that scale with your economy can feel like rubber-banding. They grow more slowly than your economy (one raider per three ships), are capped by the hive's own guards, and leave the hive open while they're out, so a beaten raid pays you back.
- **Auto-assignment hides the logistics.** The owner said simple logistics may be fine at a small scale (H3). The logistics choice that's left is which rocks to mine, weighed against their exposure.
- **Scope.** It's the biggest change since H3: the sim's economy core, raids, the probe sheet, new bots and a calibration. One field keeps it to one iteration. The H4–H6 campaign bots retire for this slice.
- **The progression is parked.** The overworld was the owner's idea (build-2). It returns on top of A if A holds, which is B's scope.
- **Determinism.** Raid triggers, raid targets and auto-assignment need fixed orders and integer shares, and no RNG.
- **Ownership.** Raid behaviour is Faction AI work, and that agent is dormant until the Director activates it in DECISIONS.md.

#### B. The same, on the H6 overworld (the alternative)

- **Claim:** A's claim, held across a campaign: the ship economy, the allocation and raids in every area, with relays, bands and research carried over.
- **What changes beyond A:** every area's hive raids; the research items tied to the old economy (Opening ore, Extraction, Seed rigs, Fast yards) need new meanings; all ten areas are recalibrated with raids.
- **Why not first:** it's about two iterations, and it doesn't isolate the claim. If it fails, we won't know whether the allocation, the raids or the map failed. If A isn't fun in one field, it won't be fun across ten.

#### What happens to H6

- **H6's three fun questions are dropped.** All three are about the overworld (relay steps, choosing areas, an open map), which A parks. Asking the owner to finish the H6 run would spend a session on mechanics we're setting aside. If the overworld returns on top of H7 (B, or a later H8), the questions return with it.
- The H6 spec stays below as the record of what's built. H6 is neither supported nor failed.

#### Check against VISION.md

| VISION.md line | Fit |
| --- | --- |
| Original note: "The rate of resources delivered to the probe sets the rate of ship production." "Mobs have their own factories, so you must outpace and overpower them." | Fits better than any build so far: the allocation splits exactly that rate, and raids come out of the mobs' factories. |
| Fixed: "Logistics are abstract routes between nodes, not tile-by-tile belts." | Fits. Haulers run node-to-node routes. |
| Fixed: "No fail state." | Fits if raids kill ships and never the probe or its mining, and a raided rock stays yours. |
| Fixed: "Ships take orders at nodes (attack, guard, escort); no unit micro." | Fits. Defence is a guard order, and extractors and haulers assign themselves. |
| Fixed: "Each star system is one long game…" | A is one field, so a run is short. It's a test slice, like H3, and the long game returns with the overworld. No edit. |
| Pillar 1: "Throughput is the throttle…" | Fits: delivered ore is the one number the allocation splits. Q18 (the fleet limit) stays open as before. A shared limit sharpens it but adds nothing new to ask. |
| Pillar 2: "Risk scales with reward…" | Fits, and grows: the far rich rocks are the most exposed. |
| **Pillar 3:** "Guardians have factories. Mobs only defend, but they repair and replace up to a cap. Win a node by out-producing their replacement, or cut their supply first." | **Conflicts** with "only defend". Proposed wording in Q21 (it also settles Q20's Root clause). |
| **Pillar 4:** "A puzzle, not a race. No clock and no pressure. The challenge is building an efficient network." | **Conflicts** with "no pressure": raids are pressure by intent. What survives is "no clock", because raids grow with what you build and never with time. Proposed wording in Q21. |
| Pillar 5: "Every system makes the next one stronger." | Untouched (parked with the overworld). |
| DESIGN.md "Mobs: defend only. They never come for you" (2026-11-06) and "Guards that come for you: ruled out" (2026-11-08b) | Superseded by the owner's direction. The pillars stand until Q21 is answered, and A ships with `raid.enabled` either way. |

#### Considered, not proposed

- **A literal drag-the-points radar.** It's precision dragging on a phone. It can be an A/B later (handles snapped to weights) if the owner asks.
- **Preset buttons** ("Economy", "Defend", "Attack"). They're phone-friendly, but they'd reduce the graph to three choices before we know whether the graph itself is fun.
- **Raids on a timer, or raids that grow with time.** They break "no clock", and the owner's own "waiting doesn't make it worse" (2026-11-06).
- **Raids that hit the probe or retake rocks.** They break "No fail state".
- **Node rigs** (H6 candidate C): still later.

### H7 (Milestone 2, iteration 7, tested on build-20261114-1): One field, live enemy

*Tested 2026-11-14: supported, with hauler and control friction. See PLAYTEST_LOG.md (build-20261114-1) and "H8 candidates (iteration 8)" above.*

The owner picked A and approved the pillar 3 and 4 wording (QUESTIONS.md Q21, "A, yes", dda12d7). The Director activated Faction AI for raid behaviour (DECISIONS.md, 2026-11-14). The background is "H7 candidates" above. Where this spec and the candidates differ, the spec wins. Where this spec and BACKLOG.md differ, the spec wins.

Everything not mentioned here is H3 inside a field (nodes, pockets, guards, counter combat with the H6 combat amendment, the guard ring, Strong/Even/Weak tags, send and recycle orders) and H1 for time controls, autosave, the tuning panel and the feedback button.

#### Claim

**When the probe's output is split across ship types by an allocation the player can reshape at any time, and a hive raids what the player builds, the player keeps re-deciding economy against force, and that running decision is fun.** Secondary: a ship-based economy (extractor and hauler ships) reads at least as well on a phone as extractors and routes did.

What would disprove it:
- The owner sets the allocation once and leaves it, or can't say why they changed it.
- Raids feel like a timer, a nuisance or a punishment for growing.
- The run still reads as "max economy, then build a fleet and attack".
- The owner asks how to mine or haul.

#### The smallest mechanics that test it

1. **One field, one run.** A new run lands straight in one field. Taking its hive wins the run. The overworld, research, relays and band locks are parked (see "What is parked, and how").
2. **Five ship types, all built by the probe:** Extractor, Hauler (economy ships) and Drone, Lancer, Flak (warships).
3. **The allocation** replaces the build queue and the yard switches: a weight per type, set with −/+ steppers and shown as a radar graph.
4. **Mine marks:** the player picks which rocks are mined. Extractors and haulers assign themselves.
5. **Raids:** the hive musters raiders from its own guards and sends them at the mined rock nearest to it, paced by the player's economy, never by the clock.
6. **A shared fleet limit:** economy ships count against it (`fleet.countsEconomy`, the A/B).
7. **First-run fixes:** a landing builds economy only, and no guarded node falls to what the opening stock can buy.

New inputs: `setAlloc`, `setMine`. No other new inputs.

#### What is parked, and how

- **A data switch, not a code deletion.** New top-level data key `run.mode`: `"field"` or `"campaign"`. Absent means `"campaign"`, so the frozen fixtures (`sim-v4.json`, `sim-v8.json`) and every existing rule test keep running the H1–H6 rules unchanged. Shipped data sets `"field"`.
- **In field mode,** `createWorld` lands straight in `map.field` (below). The campaign state is still created, but no area is active, and the overworld, research and stockpile are never shown or used. `isWon` is true once the field's hive is captured.
- **Kept in data and code, unused in field mode:** `map.areas`, `map.lanes`, `research`, the H1 economy keys (`extractor.cost`, `extractor.buildTicks`, `route.*`, `build.queueMax`), `component.*`, `research.*`, `shipments.pct`, `areas.repeatHaulPct`, `overworld.bandLock`, `fleet.relayStep`, `fleet.cap`, `bloom.starved*`. The tuning panel hides them in field mode.
- **Why not delete:** the H4–H6 data tests, the campaign rule tests and the overworld client paths would all have to be rewritten for no player-visible gain, and the overworld is meant to come back on top of H7 if it holds. Deleting the dead paths is a later Can wait item, as with the Root.

#### The field (data `map.field`)

Frame nodes from the H3 frame (positions unchanged). The heart is the **hive**.

| Node | Kind | Slots | Prize | Guards (T/S) | Mine at start | Distance to hive (su) |
| --- | --- | --- | --- | --- | --- | --- |
| `probe` | probe | – | – | – | – | 960 |
| `a1`, `a2` | asteroid | 2 each | ore | – | yes | 814 |
| `a3`, `a4` | asteroid | 1 each | ore | – | yes | 735 |
| `a5` | asteroid | 3 | ore | – | yes | 430 |
| `a6`, `a7` | asteroid | 2 each | ore | – | yes | 534 |
| `p1` | pocket | 2 | ice | 0 / 4 | after capture | 645 |
| `p2` | pocket | 2 | crystal | 1 / 2 | after capture | 645 |
| `heart` | the hive | 4 | ore | 12 / 18 | after capture | 0 |

The guard counts are data v13, calibrated by h7-design-data to "Calibration targets (H7)" (v12 had p1 0 / 6, p2 4 / 2 and the hive 12 / 24; see "Calibration result (h7-design-data, data v13)"). Data shape: `map.field = { nodes: [ids], mine: [ids], layout: { pockets: {...}, heart: {thorns, spores} } }`, in the H4 area layout format (no Root, no starved counts). `parseSimData` checks that every id is a frame node, `probe` is first, `heart` is present, `mine` holds asteroids only, and in field mode that `ship.hauler.cargo ≤ node.bufferCap` and `economy.probeOrePerMin ≥ 1` (the softlock floor).

What this means in play: the far rocks (a5, a6, a7: 7 of the 13 asteroid slots) are the closest to the hive, so the richest economy is also the most exposed. The near rocks (a1–a4, 6 slots) are safe longest.

#### Ship types

| Type | Kind | Cost | Built in (ticks) | hp | Damage | Speed (su/tick) | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Extractor | economy | `ship.extractor.cost` ore | `ship.extractor.buildTicks` | `ship.extractor.hp` | 0 | `ship.speedSu` | always |
| Hauler | economy | `ship.hauler.cost` ore | `ship.hauler.buildTicks` | `ship.hauler.hp` | 0 | `ship.hauler.speedSu` | always |
| Drone | warship | `ship.drone.cost` ore | `ship.drone.buildTicks` | as H3 | as H3 | `ship.speedSu` | always |
| Lancer | warship | `ship.lancer.cost` ore + `ship.lancer.crystal` crystal | `ship.lancer.buildTicks` | as H3 | as H3 | `ship.speedSu` | crystal first delivered |
| Flak | warship | `ship.flak.cost` ore + `ship.flak.ice` ice | `ship.flak.buildTicks` | as H3 | as H3 | `ship.speedSu` | ice first delivered |

There is no lens or plating step in field mode: the assemblers don't run, and the resource is paid directly when a build starts. "Unlock" uses the existing `stats.firstDeliveredTick`, as in H3.

#### Rules (field mode), per tick in this order

`T` = ticks per game minute (1800). All integer. Fixed orders. No RNG. Type order everywhere: extractor, hauler, drone, lancer, flak.

- **F1. Inputs.** Apply this tick's inputs in order. An invalid input is ignored with no state change.
- **F2. Allocation (replaces the build queue and rule 5b's payment).**
  - State: `alloc[type]` (weight, 0 to `alloc.maxWeight`), `share[type]` (ore set aside, 0 to the type's ore cost) and `allocCur[type]` (the round-robin counter).
  - A type is **eligible** if its weight is above 0, it is unlocked, and `share < cost`.
  - While `stock.ore ≥ 1` and any type is eligible, move 1 ore from stock into one share, picked by smooth weighted round robin:
    1. add each eligible type's weight to its `allocCur`;
    2. pick the eligible type with the highest `allocCur` (ties go to type order);
    3. subtract the sum of the eligible weights from the picked type's `allocCur`;
    4. `share += 1`.
  - Set a type's `allocCur` to 0 whenever it is not eligible.
  - Ore no share can take (every weighted share full, or every weight 0) stays in stock.
  - **Testable property:** with every type eligible and N ore moved, each type gets within 1 of N × weight ÷ Σweights.
- **F3. Probe bays (replaces rule 5b's start and finish).** Each type has one bay (`yards[type]`, `ticksLeft`; the `on` flag is unused in field mode).
  - **Finish:** decrement `ticksLeft`. At 0 the ship spawns at the probe:
    - an extractor is dispatched (F5);
    - a hauler is assigned (F6);
    - a warship flies to the rally point as now.
  - **Start**, in type order: a bay starts if it is idle, its share equals its ore cost, the stock covers its resource cost (lancer crystal, flak ice), and the fleet limit allows it (F9). Starting pays the resource, sets `share = 0` and `ticksLeft = buildTicks`.
- **F4. Extraction.** As rule 3. A node's `extractors` is the number of extractor ships docked there, plus its free extractors after capture (`pocket.freeExtractors`, `heart.freeExtractors`; these are not ships and can't be killed). Yields: `extractor.orePerMin` for asteroids, `pocket.resourcePerMin` for pockets, `heart.orePerMin` for the captured hive. Buffers cap at `node.bufferCap`, and overflow is lost (the H1 "backed up" state). Probe mining (`economy.probeOrePerMin`) goes straight into stock.
- **F5. Extractors.**
  - A node is **mineable** if it is Mine-marked and not guarded.
  - An extractor is **bound** to its target node from dispatch on, so slots are reserved in flight.
  - **Dispatch:** a new or freed extractor flies to the mineable node nearest the probe whose bound extractors plus free extractors are below its slots. Ties go to the lower node index. If no node qualifies, it parks at the probe as **idle**.
  - On arrival it **docks**: it counts in that node's `extractors`.
  - Idle extractors re-dispatch on any tick a slot opens (a mark turned on, an extractor lost, a pocket captured).
  - **Unmarking a node** unbinds its extractors, which re-dispatch from where they are.
- **F6. Haulers.**
  - A node is **worked** if it has at least one docked or free extractor, or a buffer of at least 1.
  - **Assignment:** a hauler at the probe with no worked target picks the worked node with the lowest (assigned haulers ÷ working extractors), compared by cross-multiplication. Ties go to the nearest to the probe, then the lower node index. If no node is worked, it parks idle at the probe.
  - **Trip:** fly to the node. Wait until `buffer ≥ ship.hauler.cargo`, or until the node is no longer worked, then load `min(buffer, cargo)`. Fly to the probe. On arrival, add the load to stock and to the delivered stats and buckets (the headline ore/min, the ice and crystal chips, `firstDeliveredTick`).
  - A hauler keeps its node while the node is worked and reassigns at the probe when it isn't.
  - A hauler destroyed with cargo loses the cargo.
- **F7. Movement.** As rule 6, for every ship. A ship's speed is its type's speed.
- **F8. Raids** (Faction AI; see "Raids", R1–R9). This runs after movement and before guarded-node combat.
- **F9. Fleet limit.**
  - `fieldCap = field.fleetCap` (0 means no limit).
  - The **counted** ships are every type when `fleet.countsEconomy` is 1, and warships only when it is 0.
  - `fleetCount` = counted ships alive + counted bays with `ticksLeft > 0`.
  - A counted bay may start only if `fleetCount < fieldCap`. The count is recomputed after each start within the tick.
  - Ships are never removed to meet the limit.
- **F10. Combat at guarded nodes.** As H3 rule 7 with the H6 combat amendment. Economy ships never go to guarded nodes: they can't be sent (F12), and a guarded node is never mineable.
- **F11. Capture.**
  - As now. A captured pocket or hive becomes Mine-marked automatically, gets its free extractor, and its prize unlocks on first delivery.
  - Capturing the hive wins the run: `capturedTick` is set, the result panel shows, and free play continues.
  - Capturing the hive also ends raids: every raider away from the hive is removed (R9).
- **F12. Inputs (field mode).**

| Input | Parameters | Valid when | Effect |
| --- | --- | --- | --- |
| `setAlloc` | `type`, `weight` | 0 ≤ weight ≤ `alloc.maxWeight` | Set the weight. If the weight becomes 0, the type's share goes back to stock (switching away from a type never strands ore). |
| `setMine` | `node`, `on` | the node is an asteroid, or a captured pocket or hive | Set the mark. Off: F5 unbinds its extractors. Its haulers finish their trip and reassign. |
| `sendShips` | as H5 | as H5, counting **warships only** | Economy ships are never sent by hand. |
| `recycleShips` | as H5, with `extractor` and `hauler` counts | ships of those types at the node | Refund `fleet.recycleRefundPct` of each ship's ore cost into stock. A recycled extractor frees its slot. |
| `setRally`, `setTunable` | as now | as now | Rally applies to warships only. |
| `buildExtractor`, `buildRoute`, `upgradeRoute`, `cancelBuild`, `setShipyard`, `enterArea`, `withdraw`, `buyResearch`, `leaveArea` | – | **never** in field mode | – |

- **F13. Landing (the run start; first-run fixes).**
  - The stock is `economy.startStock` ore.
  - The weights are `alloc.start.extractor` and `alloc.start.hauler`, with **drone, lancer and flak at 0**: a run starts on the economy, and warships are built only once the player turns them up.
  - Mine marks are as `map.field.mine`, and the rally point is the probe.
  - **No free first win:** every guarded node's smallest winning wave of drones (with `min-wave`) is more than `floor(economy.startStock ÷ ship.drone.cost)`, so the opening stock can't buy a capture. That's 2 drones at defaults. A shipped-data test asserts it.
- **F14. Stats additions:** `econLost` (economy ships lost, by type), `raids` (mustered, beaten, hit; see R8), `allocChanges` (count of `setAlloc` inputs that changed a weight), `peakEcon` (most economy ships alive at once).

#### Raids (Faction AI, module `packages/sim/src/factions/`)

The hive is the field's heart guardian. Raiders are hive guards (Thorn and Spore, same hp and damage) that leave and come back.
- **R1. State:** `world.raid` = null, or `{ id, phase: 'muster' | 'out' | 'fight' | 'home', target, guards: Guard[], ticksLeft, planned: {thorn, spore} }`. Also `world.nextRaidTick` (starts at 0).
- **R2. Economy count:** `econ` = extractor and hauler ships alive (not counting ships in the bays).
- **R3. Muster starts** when all of these hold:
  - `raid.enabled` is 1, the hive is alive, `world.raid` is null, and `tick ≥ nextRaidTick`;
  - `econ ≥ raid.firstAtEcon`;
  - no battle is running at the hive;
  - a target exists (R5);
  - the planned size (R4) is at least 1.

  The raid then enters `muster` for `raid.musterTicks`. Its size and target are fixed for the raid. The raiders stay in the hive's guard list while mustering, so they still defend it.
- **R4. Size.**
  - `want = min(raid.maxSize, ceil(econ ÷ raid.econPerRaider))`.
  - `keep = ceil((thorn cap + spore cap) × raid.hiveKeepPct ÷ 100)`, using the hive's caps after `guard.capPct`.
  - `size = min(want, max(0, hive guards alive − keep))`.
  - The mix follows the hive's current mix: `thorn = floor(size × thornsAlive ÷ guardsAlive)`, `spore = size − thorn`. If a type runs short, the other type makes up the difference.
- **R5. Target:** the mined node (an asteroid or captured pocket with at least one docked extractor or assigned hauler) nearest the hive. Ties go to the lower node index. It is never the probe.
- **R6. Launch.**
  - If a battle at the hive started during the muster, the muster is cancelled (`world.raid = null`, `nextRaidTick = tick`) and R3 checks again once the battle ends.
  - Otherwise, at the end of the muster, take the planned raiders out of the hive's guard list (lowest id of each type first, capped at what's alive above `keep`) and fly them to the target at `raid.speedSu`. The phase becomes `out`.
  - If the target is no longer mined on arrival, the raid retargets once to the R5 node from where it is. If there is none, it flies home.
- **R7. The fight at the target**, on round ticks (`tick mod combat.roundTicks = 0`), while raiders are there:
  - If no player ship is `at` the node at the start of a round, the raid leaves for home.
  - Otherwise both sides strike at once, from start-of-round state:
    - **Player damage:** warships present, using H3's `playerDamage` (counters apply). Economy ships do 0 damage.
    - **Raider damage:** the H6 amendment's pools and type orders across the warships present, then **haulers, then extractors** (id order within a type, with overflow).
  - Units at hp ≤ 0 are removed. A destroyed docked extractor leaves its node's `extractors` count. Warships that arrive mid-raid join from the next round.
  - When no raiders are left, the raid ends as **beaten**.
- **R8. Return and pacing.**
  - Raiders that leave fly home at `raid.speedSu` and rejoin the hive's guard list on arrival, with their hp and ids. Repair resumes (guard repair as H3).
  - The raid ends **hit** if it killed at least one economy ship, **beaten** if every raider died, and **turned back** otherwise. All three count in the stats.
  - When the raid ends, `world.raid = null` and `nextRaidTick = tick + raid.gapTicks`. So the gap runs from the end of a raid, and a small economy (below `raid.firstAtEcon`) is never raided.
- **R9. Hive regrowth with raiders out.**
  - Raiders away from the hive count against its caps, so the hive regrows only the guards that died, never the ones that are out.
  - The hive's regrow ticks are `guard.<type>.regrowTicks × hive.regrowPct ÷ 100`. Pockets are unchanged.
  - If the hive is captured while a raid is out, every raider is removed ("the raid withers") and raids end.

**Warning time** = `raid.musterTicks` + the flight time. At defaults that is 450 + 430 ÷ 3 ≈ 593 ticks (about 20 s of game time) for a5. Pause is always available.

#### Tunables (H7, data/sim.json, all integers)

New keys. The live flag follows the H1 rule (live unless noted).

| Key | Default | Range | Feels like (low / high) |
| --- | --- | --- | --- |
| `alloc.maxWeight` | 5 | 3–10 | 3: coarse, a few shapes / 10: fine but fiddly on a phone. Lowering it clamps the weights |
| `alloc.start.extractor` | 3 | 0–5 | the landing weight (new runs only). 0: you set it yourself |
| `alloc.start.hauler` | 2 | 0–5 | as above |
| `ship.extractor.cost` | 20 | 5–60 | 5: the economy is free / 60: every extractor is a commitment |
| `ship.extractor.buildTicks` | 120 | 15–900 | 15: instant economy / 900: a slow build-up |
| `ship.extractor.hp` | 6 | 1–40 | 1: any raider kills one per hit / 40: raids barely scratch |
| `ship.hauler.cost` | 15 | 5–60 | as for the extractor |
| `ship.hauler.buildTicks` | 90 | 15–900 | as for the extractor |
| `ship.hauler.hp` | 6 | 1–40 | as for the extractor |
| `ship.hauler.cargo` | 4 | 1–20 | 1: far rocks need a swarm of haulers / 20: one hauler per rock, and logistics vanish. Must be ≤ `node.bufferCap` |
| `ship.hauler.speedSu` | 2 | 1–10 | 1: distance dominates / 10: distance is free |
| `ship.lancer.crystal` | 4 | 1–40 | the crystal per Lancer (replaces lens in field mode) |
| `ship.flak.ice` | 4 | 1–40 | the ice per Flak (replaces plating in field mode) |
| `field.fleetCap` | 30 | 0–80 | 0: no limit / 80: the swarm returns |
| `fleet.countsEconomy` | 1 | 0–1 | 0: the limit counts warships only (H5) / 1: every ship counts (supply) |
| `raid.enabled` | 1 | 0–1 | 0: no raids, a peaceful field (the in-build A/B) / 1: raids |
| `raid.firstAtEcon` | 6 | 2–20 | 2: raided almost at once / 20: raids only at a full economy |
| `raid.econPerRaider` | 2 | 1–10 | 1: every miner needs a guard / 10: raids are a nuisance |
| `raid.maxSize` | 12 | 2–30 | 2: never a threat / 30: a raid can empty the field |
| `raid.gapTicks` | 3600 (120 s) | 900–9000 | 900: a siege / 9000: about one raid per run |
| `raid.hiveKeepPct` | 50 | 25–90 | 25: raids gut the hive, so counter-attacks are easy / 90: raids are tiny and the hive never opens |
| `raid.musterTicks` | 450 (15 s) | 0–1800 | 0: the flight is the only warning / 1800: raids are telegraphed for a minute |
| `raid.speedSu` | 3 | 1–10 | 1: you can always intercept / 10: raids land before you react |
| `hive.regrowPct` | 200 | 100–1000 | 100: dead raiders come back as fast as heart guards / 1000: a beaten raid leaves the hive open for minutes |

Reused with their meaning in field mode: `economy.startStock`, `economy.probeOrePerMin`, `extractor.orePerMin` (per docked extractor), `node.bufferCap`, `pocket.resourcePerMin`, `pocket.freeExtractors`, `heart.orePerMin`, `heart.freeExtractors`, `ship.drone|lancer|flak.*`, `ship.speedSu`, `counter.*`, `guard.*`, `combat.roundTicks`, `fleet.recycleRefundPct`, `system.variant` (unused by the field). The candidates' `fleet.cap` 24 became `field.fleetCap` 30, a new key, so the H5 and H6 tables and their tests stay as they are. Calibration kept 30 at data v13 (see "Calibration result (h7-design-data, data v13)").

#### Save, data version and replay

- **`dataVersion` 12** (h7-sim, which also flips `run.mode` to `"field"`). h7-design-data bumps it to 13 if it changes any value. Old saves are discarded with the existing toast.
- **The reference replay** is regenerated in field mode (h7-sim), then extended by h7-raids. It covers:
  - a landing;
  - two `setAlloc` changes, including one to 0 that returns a share to stock;
  - an extractor dispatched and docked, and an idle extractor re-dispatched;
  - a hauler delivery;
  - a `setMine` off;
  - a pocket capture that unlocks a Lancer or Flak;
  - a bay held by the fleet limit;
  - a `recycleShips` of an economy ship;
  - a raid mustered, launched, beaten by defenders;
  - a raid that hits an undefended rock;
  - the hive captured, with a raid out that withers.

  The determinism hashes are re-baselined.

#### Selectors (sim, read-only)

- **`allocStatus(world)`:** per type: `weight`, `share`, `cost` (ore and resource), `unlocked`, `building` (progress 0–100), and `state`. The state is one of `off` (weight 0), `locked` (needs crystal or ice first), `filling`, `waitingResource`, `fleetFull` or `building`. It also gives `stockOre` (unallocated ore) and `incomePerMin`.
- **`rockStatus(world, node)`:** `mine`, `mineable`, `docked`, `bound`, `slots`, `freeExtractors`, `haulers`, `buffer`, `backedUp`, `deliveredPerMin` (over the stats window), and `raidRank` (1 if this is the current R5 target, else its position by distance to the hive among mined nodes).
- **`raidStatus(world)`:** `phase`, `planned` and current raiders by type, `target`, `ticksToLaunch`, `ticksToArrival`, `econ`, `nextRaidAtEcon` (the threshold), `ticksToNextAllowed`, and `last` (the outcome, with economy ships lost and raiders killed by type).
- **`fleetStatus`:** gains `countsEconomy` and the counts by type for all five.
- **`fieldSummary(world)`:** for the result panel: time to the hive, peak ore/min, ships built and lost by type, raids (mustered, beaten, hit, turned back), economy ships lost to raids, `allocChanges` and `peakEcon`.

#### Client: screens and phone UI (H7)

The H1–H6 rules hold: 375 px portrait, no hover, every target ≥ 44 px, every action ≤ 2 taps from its screen (confirms and panels excepted), and nothing in either HUD wraps or shifts under the wide-font stress.

- **No overworld in field mode.** The run opens on the field. "New run" (result panel and tuning panel) starts a fresh field. Research, withdraw and the overworld screens are unreachable.
- **Top bar:** ore/min (the headline), stock chips (ore, plus ice and crystal once delivered), "Fleet 18/30" with the fleet icon, and the raid chip (below). Fixed widths, so nothing shifts as numbers change.
- **Probe sheet:**
  - A **radar readout** of the five weights: a pentagon, one axis per type with its icon, filled to each weight. It's display only, and tapping it does nothing.
  - Under it, **five rows**: icon, name, `−` weight `+` (44 px buttons), and a state line ("building 40%", "saving 12/20", "fleet full", "needs crystal pocket" or "needs ice pocket", "off").
  - The rally line, and Recycle (the H5 panel with extractor and hauler rows added).
- **Rock sheet** (asteroid, or captured pocket or hive):
  - a **Mine / Stop** toggle;
  - extractors as pips (docked / slots, with in-flight ones hollow);
  - haulers N;
  - buffer and "Backed up: add haulers" when full;
  - delivered per minute;
  - and, when `raidRank` is 1: "Nearest mined rock to the hive: raids hit here first."
- **Raid readability:**
  - **Muster:** the hive pulses, and a banner in the fixed banner slot reads "Raid gathering: 4 Spores, 1 Thorn → A5 in 15 s". Tapping it opens A5's sheet. The banner never pushes the HUD.
  - **Out:** a raid marker (the raiders' ring colours) moves along a dashed line to the target, with a countdown to arrival.
  - **At the target:** the rock flashes. The battle line is "Raid at A5: 3 left".
  - **End:** a toast: "Raid beaten at A5: 5 killed, 0 lost", "Raid hit A5: lost 2 extractors, 1 hauler", or "Raid turned back".
  - The raid chip in the top bar shows the phase and the time ("Raid 0:12"). When no raid is possible it reads "Raids at 6 ships" until the first threshold is reached, and it hides when `raid.enabled` is 0.
- **Map:** docked extractors drawn on their rock, and haulers drawn moving along a probe–rock line that appears when a rock has haulers (thicker for more haulers). Idle economy ships sit at the probe.
- **Result panel:** `fieldSummary`, plus New run.
- **Tuning:** the H7 keys, with field-mode hiding of the parked keys. "New system" becomes "New run".
- **Phone checks:** the probe sheet (radar plus five rows) fits 375x667 without scrolling. The raid banner and chip don't shift the HUD. Every rock is tappable at ≥ 44 px.

#### Art needs (H7, folded into h7-client, within ART_STYLE.md)

- **Extractor:** a squat amber hull with a drill prong. **Hauler:** a boxy amber hull with a cargo pod. Both must read at 24 px against the drone, lancer and flak silhouettes, and against a rock.
- **Raid marker:** the raiders' two-colour ring on a hot-pink chevron, plus the dashed raid line.
- **Hive muster pulse** and **rock under raid flash:** draw states.
- **Radar readout:** a pentagon grid in the panel style, filled amber.
- **Mine mark:** a small pick badge on a mined rock, distinct from the lock badge and the "!" badge.

Any new colour gets a palette key and an ART_STYLE.md row. Draw functions: `drawExtractor(ctx, r)`, `drawHauler(ctx, r)`, `drawRaidMarker(ctx, r, mix)`, `drawRadar(ctx, w, h, weights, max)`, `drawMineBadge(ctx, r)`, and a `'raided'` state for the asteroid draw.

#### Bots (H7): strategies

Bots see only what a player sees: the selectors, including `raidStatus`. No pre-send battle simulation beyond the existing `min-wave` estimate the H6 bots use.

| Strategy | Expected to win (gate) | What it does |
| --- | --- | --- |
| `adaptive` | **yes** | Opens economy only. On a muster, it raises the counter weight for the raid's majority type (Flak against Spores, Lancer against Thorns, Drone before either is unlocked), sends warships to the target and sets the rally there. After the raid, it drops warships back to a standing guard of ⌈planned ÷ 2⌉. It takes the pocket that unlocks the counter for the hive's majority. At `econ ≥ 12` it shifts to offence (economy weights to 1) and attacks the hive when the best-mix estimate fits, preferring the moment a raid is out. |
| `greedy` | **yes** | The over-investor that has to respond. All economy until every Mine slot is filled, with no warships, ignoring musters. After its **first raid that hits**, it switches to `adaptive`'s rules for the rest of the run. |
| `static` | no (control) | The best of ≤ 6 fixed allocations from a small sweep (fixed in the code, listed in the report). It never changes weights after its first second, and attacks when the estimate fits. |
| `idle` | no (control) | Holds `econ` at `raid.firstAtEcon − 1`, then builds warships only. |
| `drones-only` | no (control) | `adaptive`, but it never sets Lancer or Flak above 0. |
| `adaptive-no-raids` | no (control) | `adaptive` with `raid.enabled` 0 (the A/B comparison, report only). |

**Run cap:** a run stops with `timeout` after `FIELD_CAP_MIN` = 45 game minutes of play.

**Softlock:** a run is a softlock if, before the hive falls, no ship starts and no hauler delivers for 5 game minutes in a row (with probe mining at least 1/min, this can only come from a rule bug).

**The bots gate fails on** (and only on, with flags reported but never failing):
- a crash of any strategy;
- a tick p95 over budget;
- a winner (`adaptive`, `greedy`) that softlocks or times out on any seed.

The seed doesn't change the field. The gate still runs every seed it's given, which also checks that a run doesn't depend on the seed.

**Capability flags** (reported; each measures what can or can't be done, never minutes):
1. **Splitting matters:** `static` either loses at least half the economy ships it built to raids, or fails to take the hive within the cap. `adaptive` takes the hive.
2. **Greed is answered by raids:** `greedy`'s first hitting raid kills at least 2 economy ships, and `greedy` still wins after responding.
3. **Waiting is safe:** `idle` is raided at most once.
4. **The counter-attack window is real:** the hive's smallest winning wave (`min-wave` best mix, on the hive's guards at home) with a full-size raid out is at least 30% smaller than at full strength.
5. **Counters matter:** `drones-only` can't take the hive within `field.fleetCap` minus 10 economy ships (its best drone wave doesn't fit).
6. **Economy against offence is a trade in slots:** the hive's best mix plus a full economy (every Mine slot filled, plus the haulers `adaptive` ran at its peak) is more than `field.fleetCap`, and the best mix plus 10 economy ships fits.
7. **No free first win:** F13's property, reported per guarded node.

#### Calibration targets (H7, h7-design-data; the flags measure them)

- **Pace:** `adaptive` takes the hive in 15–30 game minutes, and `greedy` in at most 40.
- **The first raid** musters between 2 and 6 game minutes into an `adaptive` run.
- **Raid threat:** an undefended full-economy raid on a5 kills at least 2 economy ships. A defence of matched warships at the target, no larger than the raid, beats it while losing at most 2 ships, so defending is cheaper than being raided.
- **The hive:** flags 4, 5 and 6 hold. The best mix fits `field.fleetCap − 10` with at least 2 slots to spare.
- **The pockets:** each falls to drones alone within 6 drones and not within 2 (F13).
- Calibration changes only values in `data/sim.json` (guard counts, the H7 keys and the reused keys above), never rules. A rule finding goes to the Director.

#### Calibration result (h7-design-data, data v13)

Probe on v12: `reports/archive/h7-probe-v12.md`. Result on v13: `reports/archive/h7-design-data-v13.md` (3 seeds; the field doesn't depend on the seed, and every seed gives the same run). Values only; no rule changed.

**Changes (v12 → v13):**

| Value | v12 | v13 | Why |
| --- | --- | --- | --- |
| Hive guards (T / S) | 12 / 24 | 12 / 18 | The best mix was 19 against `field.fleetCap − 10` = 20 (1 spare; the target is 2). Now 16 (4 spare). |
| `raid.econPerRaider` | 3 | 2 | Flag 4 missed (26%). Realistic raids were too small to open the hive: at econ 12 / 18 / 22 they took 4 / 6 / 8 guards and cut the best wave by 11% / 16% / 21%. Now 6 / 9 / 11 guards. |
| `raid.maxSize` | 10 | 12 | So a full economy (22–23 ships) reaches the full-size raid flag 4 measures (`ceil(23 ÷ 2)` = 12). Flag 4 is met with a raid that occurs in play, not a size no run reaches. |
| `hive.regrowPct` | 100 | 200 | A beaten raid leaves the hive open twice as long, and the hive's own regrowth during an attack weighs less, so the raid-out window (11 against 16, 31%) is real for a wave already on its way. |
| `raid.gapTicks` | 2700 (90 s) | 3600 (120 s) | Bigger raids at a 90 s gap pushed `greedy` to 39:20, 40 s inside its 40-minute target, and `adaptive` to 25:38. At 120 s: 20:02 and 30:16 with p2 at 1 / 3, and 24:54 and 30:12 with the final p2 1 / 2. |
| p1 (T / S) | 0 / 6 | 0 / 4 | 8 drones → 6. |
| p2 (T / S) | 4 / 2 | 1 / 2 | 15 drones → 5. It keeps one Thorn, so it stays the crystal (Lancer) door. Smallest drone wave on v13 by p2 layout (Critic's table, round 1): 0/4 6, 0/5 7, 0/6 8, 1/0 3, 1/1 4, 1/2 5, 1/3 8, 2/0 8, 2/1 9. One Thorn's repair is outrun by drones until a third Spore keeps it alive. |

**Targets on v13:**

| Target | v13 | Met |
| --- | --- | --- |
| Pace: adaptive 15–30, greedy ≤ 40 | 24:54 / 30:12 (no raids: 10:55) | yes |
| First raid musters at 2–6 game minutes | 2:53 (tick 5191) | yes |
| An undefended full-economy raid on a5 kills ≥ 2 economy ships | a raid of 11 (4T 7S, econ 22) kills all 5 there (3 extractors, 2 haulers) | yes |
| A matched defence no larger than the raid beats it losing ≤ 2 | 3 lancers + 5 flak (8) beat it, 2 lost; 2 + 5 lose 3 | yes |
| The hive: flags 4–6; the best mix fits `field.fleetCap − 10` with ≥ 2 spare | 16 (7 lancers, 9 flak); 4 spare | yes |
| Each pocket falls to drones alone within 6, not within 2 | p1 6; p2 5 | yes |
| Flags 1–7 | all met | yes |

**Order check (designer.md: what the spec inherits).** Every `min-wave` measurement above was rerun in a second arbitrary order: ships placed flak, lancer, drone (the estimate places drone, lancer, flak), and the raid-away hive keeping its highest guard ids (the estimate keeps the lowest), exhaustively over every mix of the best total and one less. Hive 16 / 16, hive with the raid out 11 / 11, p1 6 / 6, p2 5 / 5. Nothing moved.

**What no bot exercises, candidly.**
- No bot recycles economy ships to make room for the attack, so the slot trade (flag 6) is shown by arithmetic, not by a run.
- The bots never Stop a rock to dodge a raid. They defend or absorb.
- Raids on captured pockets: the R5 target is always a5, a6 or a7 while those are mined, so a pocket is raided only once the far rocks are stopped or empty. The h7-raids review noted that a captured pocket's free extractor keeps its buffer filling, so its haulers keep arriving into an undefended raid until the player Stops it or defends. This calibration doesn't tune around that. Whether haulers should hold back from a raided rock is a rule question for the Director.
- `drones-only` (a control) ends in the runner's softlock on every seed at 28:12. Its economy was wiped by the eighth raid, and its rules then set every weight to 0 and wait with ore piling up. That's bot behaviour, not a sim softlock: probe mining kept running. It's reported for the bots owner, because `greedy` and `adaptive` share those rules after a wipe.

#### Success criteria (H7; the owner, one 20–30 minute phone session; 4x is fine)

1. In the first minute, the first ships are economy ships, and the owner doesn't mention unwanted drones.
2. The owner changes the allocation at least three times and can name why for at least one change (a raid warning, a loss, a target).
3. At least one raid is met by ships built or moved after its warning, and the owner can say whether a raid hurt.
4. The owner names a moment of choosing more economy or more offence.
5. They don't call raids a timer, rushed or a punishment for waiting, and don't describe the run as "max economy then attack".
6. They never ask how to mine or haul.
7. Every action is ≤ 2 taps from its screen; the probe sheet fits 375x667; raid banners and chips don't shift the HUD.

Optional: they try `raid.enabled` 0 or `fleet.countsEconomy` 0 and say which they prefer.

#### Fun questions for the handoff (H7)

1. Did you change the spider graph during the run? What made you change it?
2. Did the raids make you build a little force, or did they feel like a timer or a nuisance?
3. Was there a moment you chose between more economy and more offence? Which way did you go, and did it pay off?

#### Left out of H7 (hard limit)

- The overworld, research, relays, band locks, hauls and new game+ (parked, not deleted).
- Field variants, seeded maps or more than one field.
- Drag input on the radar, and preset allocation buttons.
- Economy ships sent by hand, escorts, and auto-defence (warships guard only where they are sent or rallied).
- Raids that target the probe, retake rocks or grow with time; more than one raid at once; raids from pockets.
- New guard or ship types beyond Extractor and Hauler, and components or assemblers in field mode.
- Deleting the H1–H6 economy, campaign or Root code (a later Can wait item).
- Node rigs.

### H6 candidates (iteration 6): A picked, Root removed

*Iteration 6, 2026-11-08. The triage is in PLAYTEST_LOG.md (build-20261108-4). **The owner picked A, Open frontier, and chose to remove the Root rather than graft it** (QUESTIONS.md Q19). The spec is "H6 (Milestone 2, iteration 6, spec ready): Open frontier" below; where they differ, the spec wins. Q20 (the pillar 3 wording) is Can wait and changes nothing in the spec.*

H5 worked where it was meant to bite: the limit made the owner think about the mix, they recycled, and an area felt stronger (Q1, Q2). It failed on one claim: a limit raise didn't feel like a big step (Q3). The open map the owner asked for after build-3 was held back until strength was a capability; it now is.

#### Why +6 slots felt small (Q3)

All numbers are from "Calibration result (h5-design-data, data v9)" below.
1. **Most raises had a substitute.** Level 1 opens the mediums' fed hearts, which a Root cut already opened at 12 (starved best mix 9). Level 2 opens The Deep's fed heart, which a cut opens at 18 (starved 13–15). Level 3 opens nothing; the spec calls it comfort. The only thing in the ladder that nothing else opens is The Deep at level 1. So two raises out of three save a Root-cut fight, and a fight saved is time. That's the H2–H4 trap again, one level up.
2. **The key comes before the lock.** Level 1 costs 60 / 20 / 20 and needs one light area. The bots buy it at about 12:42, right after the light areas and before either medium. A player who buys it then never stands in front of the closed door it opens.
3. **The limit stops binding after level 1.** A player who cuts Roots never needs more than 15 slots (The Deep starved) against a limit of 18. Levels 2 and 3 raise a ceiling nobody is touching.
4. **Nothing changes on screen.** The purchase is a notice ("fleet limit now 18") and a bigger number on a chip. No area opens on the map, no new yard or ship appears, and an 18-ship wave looks like a 12-ship wave. A design, by contrast, adds a yard row and a new silhouette.
5. **It's an amount, not a kind.** +6, +6, +6 is a shrinking share each time (50%, 33%, 25%). The owner's own examples of meaty steps were new ship types: things you can now *do*.

**So a meaty step needs:**
- **a lock you've already hit**, so you feel the step from the closed side;
- **no other key**: no Root cut, grind level or waiting opens the same thing;
- **a visible opening** at the moment you take it, on the map;
- **a kind, not an amount**, where possible: a region, a ship type, a new area kind;
- **fewer, bigger steps**, each followed by fights that use the new limit, so it keeps binding.

#### The Root: remove it, or reward the heart taken with it alive (rides along with A or B)

The owner, after build-4: "either remove the root mechanic or give some reward for taking the heart without taking the root first. Right now, there's really no reasonable choice other than taking the root." The bots agree: every winner cut every Root (H5 calibration). A cut costs one small fight, and a fed heart pays exactly what a starved one does. So going for the heart directly is strictly worse. Worse still, the cut is the substitute that hollows out the limit raises (point 1 above).

**Remove the Root (the case for).**
- The bypass is gone, so a raise or a mix becomes the only key. That fixes Q3's point 1 by deletion.
- Simpler to read and to calibrate. One guarded node fewer in every medium.

**Remove the Root (the case against).**
- It deletes the owner's favourite moment ("Cutting the root was satisfying", H2) and half of pillar 3 ("or cut their supply first").
- A medium becomes one heart behind one lock. That's a gate, not a choice.

**Reward the intact take (the case for).**
- It keeps both ways and makes them a trade: cut now and take the heart with fewer slots, or fight the fed heart with a full, mixed fleet and get something the cut can never give.
- The intact path is the one that needs both counters at a higher limit, so the reward pulls the player into exactly the behaviour no bot used (mixes against fed hearts).
- It turns raises into keys to a prize. A raise no longer saves a cut; it opens the graft.

**Reward the intact take (the case against).**
- If the reward is only more ore or a bigger haul, it's time again (the H2–H4 trap), and players will still cut.
- If the reward is too strong, "never cut" becomes the new single line.

**The reward must change what you can do next, not how fast.** Proposal, **Graft:** take a heart while its Root is alive and the Root is grafted. It stays on the map in amber, and your fleet limit rises by `root.graftLimit` for the rest of the system (default 4, range 0–8; 0 is today's rules, the in-build A/B; 2 is barely worth a fed fight; 8 makes every Root a must-graft). A cut Root can't be grafted.
- **With the fleet cap:** a graft is a raise you earn by beating a lock the hard way. Each graft can open a heart that was closed (The Deep fed, a next band), so the choice at every medium is "cut and move on" or "graft and reach further".
- **With Q3:** it's the meaty-step pattern. You see the fed heart closed, raise the limit or bring the right mix, take it, and a visible change on the map pays you in capability.
- **Not the only key:** grafts add to, never replace, the relay steps (A) or Command limit levels (B). The calibration keeps every winning path possible with cuts alone, so a graft is an option, never a requirement. That keeps it a choice.
- **Considered for later:** a graft that yields **sap**, a new resource that pays for a third design. It's a step in kind, but it needs a new ship type, so not in H6.

**Recommendation:** Graft, not removal. **Capability flags** (added to A's or B's):
1. On every seed, a `graft` strategy (never cuts) wins and ends with a higher limit than `composer` with cuts.
2. With `root.graftLimit` at its default, at least one winning strategy per seed grafts at least one Root. At 0, `composer` cuts every Root (the control).
3. At least one heart per seed is open to a grafting player and closed at the same point to one who cut.

**Size:** small. One rule at capture, one tunable, a Root sprite state, a line on the heart's sheet ("Take it with the Root alive to graft: +4 fleet limit"), and a bot strategy.

#### A. Open frontier with locked regions (recommended)

- **Claim:** on an open map where each fleet-limit step is earned at a place you choose and opens a region you could already see, steps feel big and which areas you take is your choice.
- **What changes:**
  - About 10–12 areas in three bands on a taller overworld you pan (no zoom). Areas two lanes beyond your border show only their tier; neighbours show their ring and prize, as now.
  - **The limit comes from places, not the shop.** Each band has two **command relays** (a new area kind, one per side). Reclaiming either raises the limit by `fleet.relayStep` (default 8, range 4–12; 4 is barely felt, 12 makes the next band easy). Command limit research goes away.
  - **Band gates have no bypass.** The next band's hearts are calibrated closed at the current limit with any local mix, fed or starved. Reclaiming a relay lights up the lanes into the next band on the map, at once.
  - **More areas than you need.** The core still needs both designs and The Deep, so 3–4 areas are optional. A repeated prize pays less (`areas.repeatHaulPct`, default 50, range 0–100; 0 makes extra areas worthless, 100 lets you farm them).
  - Kept: the H5 cap at 12, Recycle, both designs, Roots inside bands (with Graft, above).
  - Left out: lane logistics, an overworld Root, the "next decision" list, new ship or guard types.
- **Capability flags:**
  1. The probe shows every next-band heart closed at the current limit (any local mix, fed and starved), and at least one fits at the new one.
  2. A `no-relay` strategy reclaims nothing beyond band 1 on any seed.
  3. Every winner leaves at least one area untaken, and at least two winners on each seed end with different sets of reclaimed areas.
  4. A `no-cut` strategy (never cuts a Root) wins on every seed, with at least one capturing wave per run that has two counter types at 30% or more each. This is the retro rule: the mix must be used, not only possible.
  5. `drones-only` and a grind-only bot reclaim nothing in band 2.
- **Size:** large, about H4: sim, client (pan, relay sheet, lane reveal), art (relay icon, band markings), bots, design-data. With the two bug fixes it fills the 12-launch budget, so the "left out" list is a hard limit.
- **Risks:**
  - Scope.
  - More areas on the same 16-node frame could read as "a repeat" (H4's Q3). Relays are the only new area kind.
  - Free order makes difficulty uneven: an area is trivial if you come late.
  - Bot campaigns get longer than today's 40 minutes; the 120-minute cap may need raising.

#### B. Keys, not amounts (the small fix on today's map)

- **Claim:** a limit raise feels big when it opens an area you've already found closed and that nothing else opens.
- **What changes:**
  - Command limit becomes two levels of +8 (12 → 20 → 28; `research.fleet.step` 8).
  - Recalibrate so each level is the only key: one medium and The Deep lose the Root-cut bypass (their starved hearts are also closed at the level below). The other medium keeps its cut, so cutting stays a tool. With Graft (above), going for a fed heart pays a few extra slots.
  - The overworld marks each area "beyond your command" or "within reach", from a calibrated per-area level in data. Buying a level pulses the areas it opened ("Command limit 1: Thorn Garden is within reach"). A tuning toggle hides the marks, as the A/B against estimating.
  - Same six areas.
- **Capability flags:**
  1. The probe shows each level opening at least one heart that was closed one level below with any local mix, fed and starved.
  2. In every winning run, each level is bought after the bot has recorded at least one area closed: the lock comes before the key.
  3. `no-command` reclaims none of the areas a level opens.
  4. `no-cut` wins, with a two-type capturing wave (as A's flag 4).
- **Size:** small to medium: sim and data, client (marks and the purchase pulse), bots, design-data. Little art.
- **Risks:** it leaves "too linear" (build-3) untouched; six areas is one session, so the owner judges one or two raises; the marks could turn the area choice into a lookup.

#### C. Node rigs (the owner's parked idea): later, not H6

- **Claim:** designing one node type's rig on a small tap grid is a satisfying puzzle, and because the result applies to every node of that type, a better rig is a felt step.
- **The case for it.**
  - It deepens pillar 1 and pillar 4 ("the challenge is building an efficient network") where the game is thinnest. The owner said "logistics is still very simple".
  - It turns the grind (Extraction +25%) into something you design instead of buy.
  - "Build once, applied everywhere" keeps it phone-sized: one puzzle per node type, not per node.
  - New parts change the shape of a good rig, not just its score, so unlocking a part is a step in kind.
  - On a phone, a 6×6 or 7×7 grid of 44 px cells fits 375 px, played by tap to place and tap to rotate, with no dragging.
- **The case against.**
  - **VISION conflict.** "Logistics are abstract routes between nodes, not tile-by-tile belts." Routes between nodes stay abstract, but a rig *is* tile-by-tile belts inside a node, so the letter conflicts. It needs an owner-approved VISION.md edit first, for example: "Logistics between nodes are abstract routes; a node's own rig is a small tap-to-place grid."
  - **Rates are time.** In a game with no clock and a fleet limit, a better rig refills you faster, which is the trap H2–H4 fell into. It is only a capability if a rig gates something: for example, a component rig with no valid layout makes no lenses at all.
  - **Scope.** It's a second game: a deterministic flow model, an editor screen, part art, and an optimizer so the bots and calibration can judge layouts. Two iterations or more.
  - **Focus.** The macro loop has only just started working. A sub-game now splits the next few builds.
- **Capability flag, if built:** a part unlock changes the optimizer's best layout's shape, not only its rate, and at least two layouts within 10% of the best exist for each part set. A rate gap alone doesn't count.
- **Verdict:** H7 or later, once A or B holds. If the owner wants it sooner, the cheapest test is one ore rig screen on today's map, after the VISION edit.

### H6 (Milestone 2, iteration 6, spec ready): Open frontier

**Result (owner, 2026-11-14): not judged.** The owner stopped at the start of Frost Shelf and proposed a new direction instead. The three fun questions are unanswered and dropped; see "H7 candidates" → "What happens to H6" and PLAYTEST_LOG.md.

The owner picked A and chose to remove the Root (QUESTIONS.md Q19, 2026-11-08). The background is "H6 candidates" above.

Everything not mentioned here is H5 (below), H4 on the overworld and H3 inside an area. Where this spec and BACKLOG.md differ, the spec wins.

#### Claim

**On an open map where each fleet-limit step is earned by reclaiming a command relay you choose, and opens a region you could already see, a step feels big, and which areas you take is your choice.**
- A relay is a lock you meet before you hold the key: it needs a design you don't start with, and the next band is visibly locked until you take it.
- Nothing else opens a band: no Root cut (the Root is gone), no grind level and no amount of waiting.
- You need about 6 of the 10 areas, so leaving areas untaken is normal and the set you take is yours.

What would disprove it:
- The owner says a relay "didn't feel like a big step" or "was just a bigger number", as with Command limit.
- The owner takes every area, or can't name why they took one over another.
- The owner calls the map "linear" or "the same path".
- The owner gets lost on the map or asks where to go next.

#### The smallest mechanics that test it

1. **Ten areas in four bands** on a taller overworld you pan. Band = the area's existing `tier` (0–3).
2. **Command relays:** four new areas, two in band 1 and two in band 2 (one per side). The first relay you reclaim in a band raises the fleet limit by `fleet.relayStep` and unlocks the next band.
3. **Band locks:** an area in band b ≥ 2 can be entered only once a relay in band b − 1 is reclaimed (`overworld.bandLock` 1). It's also calibrated so the lock tells the truth: the band's hearts don't fit the limit below.
4. **Scouting:** every area shows its band, kind (relay or not) and lock state from the start. Its ring, prize and haul show only once it is open (lane-joined to a reclaimed area) or reclaimed.
5. **Repeat hauls:** the second area reclaimed on the same band and side pays `areas.repeatHaulPct` of its haul.
6. **The Root is removed from play** (data only; the code stays dormant; see "Removing the Root").
7. **Command limit research is removed.** Relays are now the only way to raise the limit.

No new inputs. `enterArea` gains one validity condition (the band lock).

#### The overworld (data `map.areas`, `map.lanes`)

Frame x 0–1000, y 0–2100. Area nodes are drawn at radius 80 su, as in H4.

```
                    [The Deep]                      band 3
                   /          \
            (Mire Relay)    (Spire Relay)           band 2 relays
            /    |      \  /     |     \
  [Spore Veil] --|-------\/------|-- [Thorn Garden] band 2
     |    \      |       /\      |      /    |
     |    (Rime Relay) ---- (Glint Relay)    |      band 1 relays
     |    /                         \       |
  [Frost Shelf]                    [Glass Shoal]    band 1
            \                          /
                    [Landfall]                      band 0
```

*(h6-design-data, data v11: the relays moved inward (Rime 400 / 1270, Glint 600 / 1270, Mire 300 / 520, Spire 700 / 520) so the two new lanes and `rime–mire` / `glint–spire` clear every other node by at least 130 su. The diagram is schematic.)*

Lanes (undirected, 16):
- `landfall–shelf`, `landfall–shoal`;
- `shelf–rime`, `shoal–glint`, `rime–glint`;
- `shelf–veil`, `shoal–garden` (added at data v11: see "Calibration result (h6-design-data, data v11)");
- `rime–veil`, `rime–mire`, `glint–garden`, `glint–spire`, `veil–garden`, `veil–mire`, `garden–spire`;
- `mire–deep`, `spire–deep`.

What this means in play:
- The shortest win is about 6 areas: Landfall, one light area, its side's relay, a band 2 relay, The Deep, plus one area from the other side for the second design's resource. Either relay side works.
- The mediums (Spore Veil, Thorn Garden), the second relay of each band and the other light area are optional: 4 of 10. What they give is resources for grind research and a second route.
- `rime–mire` and `glint–spire` let you go from a band 1 relay straight to a band 2 relay, skipping the mediums.
- `shelf–veil` and `shoal–garden` put a medium next to each light area. With band locks on (the default), you see the medium's ring and guards before you can enter it: the lock from the closed side. With `overworld.bandLock` 0, you can land there at limit 12 and meet the wall in play.

#### Areas (H6, data `map.areas`)

`side` is `ice`, `crystal` or `none`, and decides repeat hauls. `relay` marks a command relay. Nodes are frame ids. **No area includes `root`.** Haul and export are ore / ice / crystal. The four relays are new. Values are data v11 (h6-design-data moved the four relays; hauls and exports are h6-sim's, unchanged).

| id | name | tier | side | relay | x | y | nodes | haul | export/min |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `landfall` | Landfall | 0 | none | no | 500 | 1940 | probe a1 a2 a3 a4 a5 heart | 100 / 0 / 0 | 4 / 0 / 0 |
| `shelf` | Frost Shelf | 1 | ice | no | 220 | 1640 | probe a1 a2 a3 a5 p1 heart | 130 / 80 / 0 | 3 / 2 / 0 |
| `shoal` | Glass Shoal | 1 | crystal | no | 780 | 1640 | probe a1 a2 a4 a5 p1 heart | 130 / 0 / 80 | 3 / 0 / 2 |
| `rime` | Rime Relay | 1 | ice | yes | 400 | 1270 | probe a1 a2 a3 a5 a6 p1 heart | 200 / 60 / 20 | 3 / 2 / 0 |
| `glint` | Glint Relay | 1 | crystal | yes | 600 | 1270 | probe a1 a2 a4 a5 a7 p2 heart | 200 / 20 / 60 | 3 / 0 / 2 |
| `veil` | Spore Veil | 2 | ice | no | 220 | 900 | probe a1 a2 a3 a4 a5 a6 a7 p1 p2 heart | 420 / 90 / 70 | 5 / 3 / 0 |
| `garden` | Thorn Garden | 2 | crystal | no | 780 | 900 | probe a1 a2 a3 a4 a5 a6 a7 p1 p2 heart | 420 / 70 / 90 | 5 / 0 / 3 |
| `mire` | Mire Relay | 2 | ice | yes | 300 | 520 | probe a1 a2 a3 a5 a6 a8 p1 p3 heart | 300 / 60 / 40 | 4 / 2 / 1 |
| `spire` | Spire Relay | 2 | crystal | yes | 700 | 520 | probe a1 a2 a4 a5 a7 a9 p2 p4 heart | 300 / 40 / 60 | 4 / 1 / 2 |
| `deep` | The Deep | 3 | none | no | 500 | 180 | probe a1 a2 a3 a4 a5 a6 a7 a8 a9 p1 p2 p3 p4 heart | 920 / 100 / 100 | 8 / 3 / 3 |

The Deep keeps `layout: "seed"` (the run's H3 layout). Its node list leaves out `root`, so the sim ignores that layout's `root` and starved counts (the existing no-Root path: `hasRoot` false, `fed` true for good).

**The haul invariant** (`parseSimData`, replacing H4's). For each resource, take Σ over areas of the haul, with every area in a band-and-side group of two or more counted at `floor(haul × areas.repeatHaulPct / 100)`. That's every area at its worst position. The result must be ≥ Σ research cost over every level. It's checked at the data's default `areas.repeatHaulPct`. The tuning panel can lower it live, which is a dev experiment, not a softlock guarantee. At the starting values above the bound is 2070 / 310 / 310 against 1660 / 220 / 220.

#### Area guards (H6)

T/S before `guard.capPct`, in the H4 layout format. Calibrated by h6-design-data to "Capability windows (H6)" under the combat amendment (data v11; see "Calibration result (h6-design-data, data v11)"). The four relays are new, and Spore Veil and Thorn Garden lose their Root and starved counts. Unchanged areas: Landfall, Frost Shelf and Glass Shoal as data v9.

| Area | Node | Prize | Slots | Guards (T/S) |
| --- | --- | --- | --- | --- |
| rime | p1 | ice | 2 | 0 / 5 |
| rime | heart | ore | 4 | 1 / 16 |
| glint | p2 | crystal | 2 | 0 / 5 |
| glint | heart | ore | 4 | 7 / 1 |
| veil | p1 | ice | 2 | 0 / 6 |
| veil | p2 | crystal | 2 | 3 / 3 |
| veil | heart | ore | 4 | 4 / 34 |
| garden | p1 | crystal | 2 | 0 / 5 |
| garden | p2 | ice | 2 | 4 / 3 |
| garden | heart | ore | 4 | 13 / 8 |
| mire | p1 | ice | 2 | 0 / 8 |
| mire | p3 | crystal | 3 | 5 / 2 |
| mire | heart | ore | 4 | 4 / 36 |
| spire | p2 | crystal | 2 | 0 / 8 |
| spire | p4 | ice | 3 | 5 / 2 |
| spire | heart | ore | 4 | 12 / 9 |
| deep | all | as H3 | as H3 | the H3 layout tables (heart: fed counts only) |

#### Fleet limit, relays and band locks

- **`fleetCap(world)`** = `fleet.cap + fleet.relayStep × commandedBands` when `fleet.cap > 0`, otherwise null. `commandedBands` is the number of bands b in {1, 2} with at least one relay of band b reclaimed (0–2). At defaults: 12, then 20, then 28. It's derived, never stored.
- **A second relay in the same band** pays its haul (decayed as a repeat) and adds nothing to the limit. Its sheet says so.
- **`bandOpen(world, b)`:** true for b ≤ 1. For b ≥ 2, true if `overworld.bandLock` is 0 or a relay of band b − 1 is reclaimed.
- **`enterArea`** is valid as in H4 (the area is held and lane-joined to a reclaimed area), **and** `bandOpen(world, tier)`. The status reason is `bandLocked` ("Locked: reclaim a band 1 relay (Rime Relay or Glint Relay)").
- **Raising the limit mid-area can't happen.** Relays are reclaimed inside an area, and the raise applies from the next landing. The H5 "over the limit" rule is unchanged.
- **With `fleet.cap` 0** there is no limit, but relays still unlock bands. That's the "H4 rules on the H6 map" comparison.

#### Repeat hauls

- An area's **group** is (`tier`, `side`). Groups with `side` `none` never decay.
- At reclaim, if another area of the same group is already reclaimed, the haul paid is `floor(haul[r] × areas.repeatHaulPct / 100)` per resource. No group has more than two areas, so there's one step of decay.
- Exports (shipments) don't decay.
- The area result panel and the overworld sheet show the haul actually paid ("Haul 65 / 40 / 0 (half: Frost Shelf already reclaimed)").

#### Scouting

- **Known** (ring, prize, haul and guards shown): reclaimed, or lane-joined to a reclaimed area (Landfall at the start).
- **Far** (everything else): drawn dim, with band, relay kind and lock state, but no ring, prize or numbers. Its sheet says "Unscouted: reclaim a neighbour to scout it" and shows the band's lock line.
- Scouting is display only. A far area is never enterable, because H4's lane rule already says so.

#### Research (H6, data `research`)

The H4 items are unchanged. The three `fleet` (Command limit) rows are removed, and so is `research.fleet.step`. Whether the `limit` kind and the `tier` requirement stay in the code unused is the core engineer's call, but no shipped item uses them, and the research sheet shows no Command limit card.

| id | name | kind | level | ore | ice | crystal | requires |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `lancer` | Lancer design | design | 1 | 60 | 0 | 40 | none |
| `flak` | Flak design | design | 1 | 60 | 40 | 0 | none |
| `opening` | Opening ore | grind | 1 | 50 | 0 | 0 | none |
| `opening` | Opening ore | grind | 2 | 100 | 0 | 0 | none |
| `opening` | Opening ore | grind | 3 | 150 | 0 | 0 | none |
| `extract` | Extraction | grind | 1 | 60 | 0 | 0 | none |
| `extract` | Extraction | grind | 2 | 120 | 0 | 0 | none |
| `extract` | Extraction | grind | 3 | 180 | 0 | 0 | none |
| `rigs` | Seed rigs | grind | 1 | 100 | 0 | 0 | extract 1 |
| `rigs` | Seed rigs | grind | 2 | 200 | 0 | 0 | extract 1 |
| `yards` | Fast yards | grind | 1 | 60 | 20 | 20 | none |
| `yards` | Fast yards | grind | 2 | 120 | 40 | 40 | none |
| `core` | Probe core | win | 1 | 400 | 120 | 120 | lancer 1, flak 1, The Deep reclaimed |

Totals over every level: 1660 ore, 220 ice, 220 crystal.

#### Removing the Root

The owner's call (Q19). **Removed from play through data; the code stays dormant.**
- **Data:** no area's `nodes` includes `root`; Spore Veil and Thorn Garden lose `layout.root` and the heart's starved counts. The frame keeps its `root` node and the H3 `map.layouts` keep their `root` entries, because the frame validation needs them and the frozen fixtures use them. `bloom.starved*` stay in data.
- **Sim:** no rule changes. The H2/H3 Root rules (the wilt, starved regrowth) stay, covered by their existing tests on the frozen fixtures (`sim-v4.json`, `sim-v8.json`). A new shipped-data test asserts that no area includes the Root. Any shipped-data test that cuts a Root moves to a frozen fixture or is removed. The reference replay drops its Root cut.
- **Bots:** the composer's "target the Root if the heart fails" step and the probe's starved rows become inert on shipped data. They print "n/a", and no flag uses them.
- **Client:**
  - No shipped area draws a Root, a vine or a wilt toast.
  - The repelled hint already checks `hasRoot`; it changes "raise the limit (Command limit)" to "reclaim a command relay".
  - The tuning panel hides `bloom.starved*` and drops `research.fleet.step`.
  - Smoke tests that need a Root on shipped data (boot.spec.ts: "the Root sheet opens with the Feeds the Heart box…" and the Root-cut battle test) are removed. The behaviour stays covered in the sim tests.
- **Why dormant, not deleted:** deleting touches rule code under determinism tests and nearly every package, for no player-visible gain, and it would collide with the parallel tasks. Deleting the dead client and bot paths is a Can wait item (`cw-root-code-removal`).

#### Capability windows (H6; the calibration targets; bot flags 2–6 measure them)

There are no starved states any more: every heart is fed.
- **Limits:** L0 = 12, L1 = 20, L2 = 28 at defaults.
- **Locally buildable:** as H5 (drones always; lancers with a crystal prize in the area, flak with an ice prize).
- **Fits at L:** the minimum winning simultaneous wave is ≤ L − 2.
- **Closed at L:** it is > L.
- **Binds at L:** the best mix is ≥ L − 6, so the new slots are used.

| Area | Window at defaults |
| --- | --- |
| Frost Shelf, Glass Shoal | The heart fits at L0 with drones alone (unchanged). |
| Rime, Glint (band 1 relays) | Closed to drones alone at L0. Fits at L0 with drones plus the side's counter. You need a design before you can take a relay. |
| Spore Veil, Thorn Garden, Mire, Spire (band 2) | Closed at L0 with any local mix. Fits at L1. No single type fits at L1. |
| Mire, Spire | Also bind at L1 (best mix ≥ 14). |
| The Deep (each layout) | Closed at L1 with any local mix. Fits at L2. No single type fits at L2. Binds at L2 (best mix ≥ 22). |
| Every band 2 area's first pocket | Falls to drones alone within L1 (you land with no components). |

#### Entities, inputs and rules: changes

- **Data:** areas gain `side` and `relay`. New lanes, positions and frame. Three tunables are added and one removed (next table). The three Command limit research rows are removed.
- **State:** none new. `campaign.research.fleet` goes, or stays at 0 (the core engineer's call). The limit, band locks, scouting and repeat decay are all derived.
- **`enterArea`:** the band lock.
- **Reclaim:** the haul decays for a repeat in the group. `stats` and the area record gain `haulPaid` (per resource).
- **Determinism:** integer only, fixed orders, no RNG.

#### Tunables (H6, data/sim.json, all integers)

| Key | Default | Range | Feels like (low / high) |
| --- | --- | --- | --- |
| `fleet.relayStep` | 8 | 4–12 | 4: a relay is barely felt / 12: the next band is easy |
| `areas.repeatHaulPct` | 50 | 0–100 | 0: the second area on a side pays nothing, so leave it / 100: no decay (the A/B off) |
| `overworld.bandLock` | 1 | 0–1 | 0: lanes alone decide, so you can land in a band you can't take yet and feel the wall / 1: a band opens only when a relay below it is reclaimed |

All three are live. Removed: `research.fleet.step`. Unchanged: `fleet.cap` (0 = no limit, the H5 A/B) and `fleet.recycleRefundPct`.

#### Save, data version and replay

- **`dataVersion` 10** (h6-sim). A v9 save is discarded with the existing toast.
- **h6-design-data bumps to 11** if it changes any value. The pin test changes with it.
- **The reference replay is regenerated** and covers:
  - Landfall;
  - a relay reclaim (from a `campaignWorld` start with both designs);
  - a landing in band 2 with the raised limit;
  - an `enterArea` refused by the band lock;
  - a repeat haul;
  - a yard at the limit;
  - a `recycleShips`;
  - a capture.

  The determinism hashes are re-baselined.
- **The H4 and H5 tables** ("Areas", "Area guards", "Research", "Tunables (H5)") describe data v9. h6-sim moves the shipped-data table tests to the H6 tables above, and adds a dated note under each H4/H5 table: "Superseded at data v10 by H6".

#### Client: screens and phone UI (H6)

The H1–H5 rules hold: 375 px portrait, no hover, every target ≥ 44 px, every action ≤ 2 taps from its screen (confirms and panels excepted), and nothing in either HUD wraps or shifts under the wide-font stress (the two bug fixes land first).

**Overworld map:**
- **Pan.** Scale so the frame's width fills the map width. On a wide screen that shows the whole frame, there's no pan. Area radius is ≥ 22 px. A one-finger drag pans vertically (and horizontally if the frame is wider than the view); a touch that moves < 10 px is a tap. No zoom and no momentum.
- **The view opens** centred on the area you just left (Landfall at the start), clamped to the frame.
- **Area states:** reclaimed, open, locked (a lock badge), and far (dim, no ring). Relays wear the relay icon in every state.
- **Band labels** at the left edge: "Band 2 · locked" (with the lock icon) or "Band 2".
- **Top row:** the stockpile chips plus "Fleet limit 20" with the fleet icon (hidden when `fleet.cap` is 0).

**Area sheet:**
- A relay: "Command relay: reclaim it to raise your fleet limit 12 → 20 and open band 2." If its band is already commanded: "Band 2 is already open: this relay pays its haul only."
- Locked: "Locked: reclaim a band 1 relay (Rime Relay or Glint Relay)." There's no Land button, only that line.
- Far: "Unscouted: reclaim a neighbour to scout it", plus band and relay kind.
- Haul: the decayed haul, with the reason ("half: Frost Shelf already reclaimed").
- "Your fleet limit: N" as H5. There's no ships-needed number.

**The step moment** (the claim's centre). On returning to the overworld after reclaiming the first relay of a band:
- The view pans to the newly opened band, the lock badges and the band's "locked" label fade out, and the lanes into it brighten. This takes about 1.5 s, is skippable by a tap, and is never replayed.
- A notice: "Command relay reclaimed: fleet limit 12 → 20. Band 2 is open."

**Research sheet:** no Command limit card. **Repelled hint:** "Change the mix, or reclaim a command relay to raise the limit." **Tuning:** the three keys ("Relay limit step", "Repeat haul %", "Band locks (0 = off)"); `bloom.starved*` hidden.

**Phone checks:** the overworld pans at 375x667, every area node is tappable at ≥ 44 px, the band labels never cover a node, and the area sheet with the relay line fits 375x667.

#### Art needs (H6, for Art Direction, within ART_STYLE.md)

- **Relay icon:** a command beacon (a mast with three concentric arcs) in the player-blue family. It's used on the overworld node, the area sheet and the notice. It must read at 24 px against the existing area node and the fleet icon.
- **Lock badge:** a small padlock, drawn over an area node's upper right, in a neutral grey with an amber shackle. It must be distinct from the H1 "!" badge.
- **Far area:** a dim, desaturated area node with no ring. It's a draw state, not a new icon.
- **Band label:** a text pill style and an optional faint band divider line.
- **Lane reveal:** a lane brightness state (dim, normal, revealing).

Any new colour gets a palette key and an ART_STYLE.md row. Draw contract (h6-client uses placeholders until h6-art merges):
- `drawRelayIcon(ctx, r)`;
- `drawLockBadge(ctx, r)`;
- `drawAreaNode(..., state)`, with `state` one of `'reclaimed' | 'open' | 'locked' | 'far'` (extend the existing overworld area draw; existing callers keep working);
- `drawLane(..., mode)`, with `mode` one of `'dim' | 'normal' | 'reveal'` and a reveal progress 0–100.

#### Selectors (H6, sim, read-only)

- **`overworldStatus(world)`:** per area `{ known, open, locked, relay, band, commanded, haulNow }`, plus `commandedBands` and `fleetCap`.
- **`areaStatus` / `enterArea` validity:** the `bandLocked` reason.
- **`fleetStatus`:** as H5, with `level` and `maxLevel` replaced by `commandedBands` and 2.
- **`campaignSummary` and the area result:** `haulPaid`.

#### Combat amendment: guards strike the ship type they counter (2026-11-08)

*From the h6-bots round 2 review (`reviews/h6-bots.md` on `task/h6-bots`, 95490c3). This replaces the guard-damage half of H3 rule 7, for every area. Player damage is unchanged.*

**The problem.** H3 rule 7 applies all guard damage to the ships present in id order, with overflow, so the oldest ship takes everything. Player damage is pooled per type and doesn't depend on order, so only this half matters. But it matters a lot. On v10, 8 of 9 probe minimum mixes win only when lancers were built before flak. In the yards' natural alternating order, 7 of 8 band 2 and Deep minimum mixes lose. With flak first, a win needs 3 to more than 12 extra lancers. So the same fleet wins or loses depending on which yard finished first, nothing on screen explains it, and building your counter first is what loses. The Critic tested 3,240 waves and found no case where adding ships to a winning wave made it lose; only the order matters.

**The options, judged.**

| Option | No micro | Readable on a phone | Counters matter | Deterministic, integer | Verdict |
| --- | --- | --- | --- | --- | --- |
| Keep id order; make the probe and bots measure the worst or round-robin order | yes | **no**: the player still meets a hidden build-order effect | yes | yes | Rejected. It fixes the measurement, not the game. |
| Spread each round's damage evenly across all ships (remainder by type order) | yes | yes ("damage is shared") | yes | yes | Rejected. Ships stop dying one at a time: a winning wave ends with every ship alive but damaged, and a losing one dies all together. Losses become all-or-nothing, which blurs pillar 2 ("a bad commitment wastes production"), and damaged ships carry hidden hp into the next fight. |
| **Each guard type strikes the ship type it counters first** | yes | yes: one line on the sheet | **more**: it adds the other half of the counter | yes | **Recommended.** |

**The rule (replaces "Guard damage" in H3 rule 7).**
- **Pools.** Split the guard damage by guard type, over the guards alive at the start of the round: `thornPool = Σ guard.thorn.damage` and `sporePool = Σ guard.spore.damage`. Guards at hp ≤ 0 still count (simultaneous rounds, as before).
- **Target order per pool:**
  - Thorns strike **flak**, then drones, then lancers. ("Flak bounces off Thorn armour.")
  - Spores strike **lancers**, then drones, then flak. ("Lancers are swamped by Spores.")

  So each guard type hits first the ship type that is Weak against it, and the ship type that counters it last. Drones, being neutral, sit in the middle.
- **Applying a pool.** Walk the pool's type order. Within a type, take ships `at` the node in id order. Apply damage with overflow, as H1: a ship absorbs up to its current hp and the rest goes to the next ship. If a type runs out, overflow goes to the next type.
- **Order of pools:** thorns first, then spores. Both pools are sized from start-of-round state; the spore pool continues on the ships that are left.
- **Integer only, fixed orders, no RNG.**

**Why order no longer matters.** Within one type, every fresh ship has the same hp, so which id is hit first doesn't change the hp each type is left with. Across types the order is fixed by the rule, not by build order. The battle outcome is therefore a function of the per-type counts (and the hp of any survivors from earlier rounds), not of ids. Rule 7's player-damage half already had this property.

**What the player sees and feels.**
- Matched counters survive longer, because the guard they counter aims elsewhere first. A mismatched or neutral ship soaks the fire of the guard it's weak against. A mix protects itself: flak shield lancers from Thorns, and lancers shield flak from Spores.
- The heart and pocket sheets gain one line under the Strong/Weak tags: "Thorns strike Flak first; Spores strike Lancers first." There's no other new UI, and the battle report is unchanged.
- No new input or order, and no micro.

**Owner question? No.** It's a mechanics fix the team owns, and I agree with the Director's read:
- The owner never chose the id-order rule and couldn't see it.
- The new rule makes the existing tags truer, not different, and fits VISION's counter web.
- Calibration retunes every window anyway.

The handoff's "What changed" says it in one line, so the owner can object if a fight feels different.

**The sim test that proves it** (`packages/sim/test/combat-order.test.ts`, on a frozen fixture with explicit premises, not shipped data; under about 5 s):
1. **Permutations give the same outcome.**
   - Take each of several hearts: a Thorn-heavy, a Spore-heavy and a balanced one, all fed, with fixture caps.
   - For each, take a set of mixes covering drones only, single counters, the minimum mix, one ship under it and two ships over it.
   - Build the same wave in at least six orders: lancers first, flak first, drones first, round-robin, reversed ids, and a fixed deterministic shuffle.
   - Run each to resolution. The outcome must be identical across orders: captured or repelled, the round it ended, and the surviving ships per type with their hp multiset.
   - Run on the pre-amendment rule, this test must fail; the engineer reports that fail-before run.
2. **A superset never loses where its subset won.**
   - For each fixture heart, take its minimum winning mix and add every combination of 0–3 extra drones, lancers and flak (64 waves per heart), with the extras built both before and after the base ships.
   - Every one must win.
   - Conversely, removing one ship from a losing wave never makes it win.
3. **Unit cases.**
   - A thorn pool kills flak before drones before lancers, with overflow across a ship boundary and across a type boundary.
   - A spore pool kills lancers first.
   - The two pools apply in order on the same start-of-round state.
   - One case where damage doesn't divide evenly into ship hp.

**Bots (decided by the Director in "Bots (H6)": accepted).** Drop the pre-send battle simulation (`shipsWin` / `waveWins`):
- With this rule, a wave that matches the probe's mix, sent together from the staging rock against guards at or below the probe's counts, wins by construction. That's the same deterministic combat from the same per-type counts, and the result is monotone in counts. So the check adds nothing true, and what it adds is foresight a player doesn't have, which hides problems like this one.
- The composer attacks when the parked fleet has at least the probe's mix per type.
- If a wave is repelled anyway (guards regrown past the probe's state, or a trickle), it follows H3's raise-the-threshold rule up to the limit, and `MAX_WAVES` then records the node closed.
- The report counts repelled waves per run, so any gap between the probe and play shows.

#### Bots (H6): strategies and the probe

**The engine:** the H5 composer engine, with one change (Director, 2026-11-08, from reviews/h6-bots.md): it builds toward a mix that wins when one exists at the current limit. The H5 engine maximised a power estimate that is linear in ship counts, so it always built a single type. With the Root gone, and the H6 windows requiring that no single type fits a band 2 heart at L1, it could never take one. The engine now allocates from the probe's own minimum winning mix for the target (cached per node, limit, buildable types and caps) and attacks when the parked fleet matches it. Its Root step is inert. **Decided (Director, 2026-11-08): no pre-send battle simulation.** The composer attacks when the ships parked at its staging rock include at least the probe's mix of each type. After a repel it raises its threshold as in H3, up to the limit. After two waves at a node it records the node closed. The report counts repelled waves. See "Combat amendment" above.

**Area choice, needs-driven** (replaces H4 greedy for H6 strategies):
1. Find the first unmet goal, in this order:
   1. the stockpile can afford both designs;
   2. a band 1 relay reclaimed;
   3. a band 2 relay reclaimed;
   4. The Deep reclaimed;
   5. the core is affordable.
2. Among enterable areas, land in the one that advances that goal, cheapest by the H5 estimate. For a resource goal, an area advances it if its haul (decayed) adds the missing resource. `ice-first` and `crystal-first` first narrow the candidates to their own side when any area there advances the goal, then take the cheapest; ties go to H4 order. (Director, 2026-11-08: a tie-break-only preference would almost never fire, which would make the three strategies near-identical and defeat flag 6.)
3. Areas recorded closed are skipped, as in H5.
4. Buy research by the H4 policy minus Command limit. Buy the core as soon as it's affordable.

**Strategies:**
- `composer`: no side preference.
- `ice-first` and `crystal-first`: prefer their side.
- `drones-only`: grind research only. Reported for where it stops; no flag depends on it.
- **Reference:** `composer` with `fleet.cap` 0, one row per seed.

**Trial visits** (new, in `waves.ts` next to the probe). A strategy that skips relays can't test the lock, because band 2 is lane-joined only to relays and so is never even reachable. So the bots land straight into areas from a `campaignWorld` start, as the probe already does. Each trial plays the composer engine for up to the 30-minute visit cap and records whether the heart fell:
- every band 2 area at L0 with both designs;
- every Deep layout at L1 with both designs;
- every band 1 relay at L0 with drones only.

**The probe:** H5's `waves.ts`, for every tier ≥ 1 heart (fed only) and every Deep layout. It gives single-type minima and the best local mix, marked against "Capability windows (H6)".

**H6 flags** (report lines, not merge gates). Each measures what can or can't be done, never a time gap:
1. **No softlock:** `composer`, `ice-first` and `crystal-first` buy the core on every seed within 120 game minutes.
2. **A relay opens a band:** the probe shows every band 2 heart closed at L0 and every Deep layout closed at L1, with any local mix, and each fitting at the next limit.
3. **The lock is real, not just a rule:** no trial visit reclaims its area. Band 2 at L0, The Deep at L1 and the band 1 relays with drones only all hold for a full visit of real play, not just the probe's arithmetic.
4. **The mix is used:** every winning run captures at least one band ≥ 2 heart with a wave in which two counter types are each ≥ 30% of the ships.
5. **The new limit is used:** in every winning run, the capturing wave at the band 2 relay it took and at The Deep has ≥ L − 6 ships, for the limit at that time.
6. **The set is a choice:** every winning run leaves at least one area untaken, and on each seed at least two winners end with different sets of reclaimed areas.
7. Determinism and the reference replay pass.

**Reported, not flagged:** run length and area times, areas left untaken per run, recycles, haul paid against nominal, and the cap-off reference.

**Tests must not pin tuned values** (fixtures with explicit premises, nothing over about 5 s, no runtime that grows with game length), as H5.

#### Calibration (h6-design-data, stacked on h6-bots)

1. Run the probe on v10 and commit it (`reports/archive/h6-probe-v10.*`). Every number cited comes from a committed report.
2. Retune in priority order: flag 1, then flags 2–5, then flag 6. The levers are area guards, The Deep's heart counts, hauls (keeping the haul invariant), exports, and the three H6 tunables.
3. Bump `dataVersion` to 11 if anything changed, update the H6 tables and the pin together, and search DESIGN.md for stale statements.
4. Name in the report any claim no bot exercises.
5. **After the combat amendment** (`h6-combat-target` merged), recompute everything combat touches before retuning. Don't reuse any v10 probe number:
   - the probe (single-type minima and best mix for every heart and Deep layout) and its committed report;
   - every capability window and flags 2–5;
   - the trial visits;
   - the counter-tag accuracy report in `min-waves.test.ts`;
   - the composer's cached mixes, which follow from the probe.

   Then retune. Tags may need the formula or the guard mixes adjusted if accuracy drops, because Weak now also means "draws that guard's fire first".

#### Calibration result (h6-design-data, data v11)

Sources (all `npm run bots -- --seeds 3`; the seeds pick The Deep's layout: 1 Glass Thicket, 2 Twin Seams, 3 Frost Gate; times are game minutes of play):
- **Before:** `reports/archive/h6-probe-v10.md`, data v10 on `task/h6-bots` 4ec2c71, which already has the combat amendment. So every number here is under the new rule; no pre-amendment number is reused.
- **After:** `reports/archive/h6-design-data-v11.md`.
- **Tags:** `reports/archive/h6-design-data-v11-tags.md`, every pocket and heart of every area.

**What changed (data v10 → v11).** Guards, two lanes and four positions. Hauls, exports, research and every tunable are unchanged, so the haul invariant's bound is still 2070 / 310 / 310 against 1660 / 220 / 220.

| Where | v10 → v11 | Why |
| --- | --- | --- |
| Spire Relay heart | 16 / 11 → 12 / 9 | Best mix 21 → 16. It missed "fits L1" (needs ≤ 18). |
| Twin Seams heart (The Deep) | 10 / 34 → 12 / 42 | Best mix 19 → 23. It missed "closed at L1" (needs > 20) and "binds at L2" (≥ 22). It also fixes flag 3: the seed 2 Deep trial at L1 had reclaimed it. |
| Thorn Garden heart | 14 / 9 → 13 / 8 | Best mix 18 → 17: one slot off the edge (see "Wounded arrivals"). |
| Mire Relay heart | 6 / 38 → 4 / 36 | Best mix 18 → 16, for the same margin. It also makes its lancer tag read true (it read Even where the waves said Weak). |
| Glass Thicket heart (The Deep) | 21 / 11 → 19 / 11 | Best mix 26 → 24: off the L2 − 2 edge, still ≥ 22. |
| Frost Gate heart (The Deep) | 18 / 21 → 17 / 21 | Best mix 25 → 23. |
| Rime Relay heart | 1 / 18 → 1 / 16 | Best mix 10 → 9 (flak), off the L0 − 2 edge; drones alone still need 18 (closed at 12). |
| Glint Relay heart | 7 / 2 → 7 / 1 | Best mix 10 → 8 (lancers); drones alone still need 19. |
| Twin Seams p1 / p2 | 2 / 6 and 2 / 6 → 0 / 8 and 3 / 3 | The two pockets read Even / Even where the waves said both counters were worse than drones (the old H3 misread). Now p1 reads Weak / Strong and p2 Strong / Weak, and both read true. |
| Spore Veil p2 | 2 / 6 → 3 / 3 | The same misread (Even / Even; the waves said Weak / Weak). Now Strong / Weak, true. |
| Mire Relay p3 | 4 / 4 → 5 / 2 | Its lancer tag read Strong where the waves said Even. Now Strong, true. |
| Lanes | + `shelf–veil`, + `shoal–garden` (14 → 16) | Band locks never refused a reachable area on the v10 lanes (band 2 touched only relays), so `overworld.bandLock` 0 changed nothing. See "Band locks" below. |
| Relay positions | Rime 220 / 1300 → 400 / 1270, Glint 780 / 1300 → 600 / 1270, Mire 220 / 560 → 300 / 520, Spire 780 / 560 → 700 / 520 | So that `shelf–veil` doesn't run through Rime, and every lane clears every other node by at least 130 su. |

**Probe after** (limits L0 12, L1 20, L2 28; "Best mix" is d / l / f):

| Heart | d / l / f | Best mix | Windows |
| --- | --- | --- | --- |
| Rime Relay | 18 / 23 / 9 | 9 (0 / 0 / 9) | drones closed at L0; fits L0 with flak |
| Glint Relay | 19 / 8 / 29 | 8 (0 / 8 / 0) | drones closed at L0; fits L0 with lancers |
| Spore Veil | 34 / 37 / 26 | 15 (0 / 7 / 8) | closed L0, fits L1, no single type fits L1 |
| Thorn Garden | 34 / 22 / 45 | 17 (0 / 9 / 8) | the same |
| Mire Relay | 35 / 39 / 27 | 16 (0 / 7 / 9) | the same, and binds at L1 |
| Spire Relay | 34 / 23 / 42 | 16 (0 / 9 / 7) | the same, and binds at L1 |
| The Deep, Glass Thicket | 47 / 28 / 59 | 24 (0 / 13 / 11) | closed L1, fits L2, no single type fits L2, binds |
| The Deep, Twin Seams | 52 / 47 / 47 | 23 (0 / 10 / 13) | the same |
| The Deep, Frost Gate | 49 / 34 / 55 | 23 (0 / 13 / 10) | the same |

Every window cell is met. Every best mix has both counters at 30% or more.

**Flags, v10 → v11:**

| Flag | v10 | v11 |
| --- | --- | --- |
| 1. No softlock | met | met: all 9 winning runs buy the core |
| 2. A relay opens a band | missed (Spire 21; Twin Seams 19) | met |
| 3. The lock is real | missed (the seed 2 Deep trial reclaimed The Deep at L1) | met: all 9 trials time out |
| 4. The mix is used | met | met |
| 5. The new limit is used | met | met |
| 6. The set is a choice | met (3 sets per seed) | met (2 sets per seed; see below) |
| 7. Determinism and replay | met | met |

**Runs after** (per-seed table in the report):
- `composer` 46:16–46:37 (v10: 52:08–54:12);
- `ice-first` 55:44–61:41 (52:28–54:32);
- `crystal-first` 52:13–58:10 (71:11–73:15);
- the cap-off reference 42:32–42:57 (43:07–44:04);
- `drones-only` softlocks at 79:10 with three areas, as designed.

**Tags:** 70 of 70 pocket and heart tags read true across every area and Deep layout (`h6-design-data-v11-tags.md`). The v10 misreads named in the table above came from scratch runs of the same script during tuning, so they aren't cited by number.

**Wounded arrivals (Critic note).** Ships never heal, so survivors of pocket fights reach the heart wounded, while the probe sends fresh ships. Every winning run is repelled once or more at its band 2 relay or The Deep (1–4 repelled waves per run in v11), and then wins with a larger wave inside the limit.
- **Decision: keep the probe on fresh ships, and keep the margin in the windows.** The probe measures what an area *is*, and a model of wounds would depend on the route each player took to the heart. The "fits at L − 2" rule already reserves two slots. I moved the edge cases (Garden, Mire, Glass Thicket, Frost Gate, both band 1 relays) one to two slots further inside.
- In a scratch check (not cited by number), the minimum mix with a few half-wounded ships loses, and the same mix plus two ships wins.
- **For the handoff:** if you send exactly what an area's heart needs right after your pocket fights, you may be repelled once. Bringing two spare ships, or recycling wounded ones, avoids it. The repel costs time, never the area.

**Band locks.** On the v10 lanes, band 2 was lane-joined only to the band 1 relays, so reclaiming the relay that made band 2 reachable also unlocked it. The lock never refused a reachable area, and `overworld.bandLock` 0 changed nothing. Two new lanes, `shelf–veil` and `shoal–garden`, make each medium a neighbour of a light area:
- With locks on (the default), the medium shows its ring and guards on the overworld before you can enter: you see the lock from the closed side.
- With locks off, you can land there at limit 12 and meet the wall in play (flag 3's trials show 12 can't take any band 2 area).
- Band 3 still touches only the band 2 relays, so the lock never refuses The Deep. That's accepted: a lane from a medium to The Deep would cross a relay node on this layout.

**What the bots don't exercise, candidly.**
- **No winner takes a medium** (Spore Veil, Thorn Garden). All three winning strategies go light area → its relay → the other light area → a band 2 relay → The Deep. `composer` and `crystal-first` take the same set on every seed, so flag 6 holds with two sets per seed, its minimum. The mediums pay only resources for grind research, and the needs-driven bots never need them. Whether a player takes them, and enjoys it, is the owner's judgement (fun question 2).
- **The bots buy no Recycle beyond the composer's surplus rule,** and never meet a band lock (they only land where they are allowed). Both are left to the owner.

#### Success criteria (H6; the owner, one 30–40 minute phone session; 4x is fine)

1. The owner reclaims at least 5 areas, including a command relay.
2. They can name the moment a relay opened a band, and call it a step (fun question 1).
3. They leave at least one area untaken by choice, or name why they took one area over another.
4. They don't describe the run as "linear" or "max economy then build a fleet and attack".
5. They never ask where to go next, or how to reach an area on the panned map.
6. Every action is ≤ 2 taps from its screen (confirms and panels excepted), and the top bar and sheets don't shift as numbers change.

Optional: they try `overworld.bandLock` 0 and say whether they prefer the locks.

#### Fun questions for the handoff (H6)

1. When you reclaimed a command relay and the next band opened, did that feel like a big step?
2. Did you skip an area, or pick one over another for a reason? Which, and why?
3. Did the map feel open, or still like one path? Did you miss the Root?

#### Left out of H6 (hard limit)

- Zoom, momentum panning and a "next decision" list.
- Lane logistics (capacity, imports), and ships or stock crossing areas.
- New ship or guard types (Warden, Lash), tier 2 resources, sap and grafts.
- An overworld Root, and guards that adapt, escalate or attack.
- Any "ships needed" number.
- More than 10 areas, and procedurally generated maps (positions are fixed data).
- Re-entering reclaimed areas, and research bought mid-area.
- Deleting the dormant Root code (`cw-root-code-removal`).
- New game+, and carrying the limit into it.
- Node rigs (candidate C).

### H5 (Milestone 2, iteration 5, tested on build-20261108-4): Fleet cap

**Result (owner, 2026-11-08):** mostly supported, on short answers. The limit made the owner think about the mix and they recycled (Q1); an area was closed until a raise, a mix or a Root cut, and it felt stronger (Q2). A limit raise did not feel like a big step (Q3); see "Why +6 slots felt small (Q3)" under "H6 candidates" above. The owner also found the Root cut the only reasonable choice; see "The Root" there. Keep the cap, Recycle and the capability windows. H6 removes the Command limit research (relays replace it) and the Root. See PLAYTEST_LOG.md.

The owner picked A, "Fleet cap" (QUESTIONS.md Q17, 2026-11-08), and asked for no VISION.md edit yet (Q18). The cap ships as an experiment under the current pillar 1 wording. The background is "Owner direction 2026-11-08b: open world and a fleet cap (steelman)" above.

**Not picked:**
- **B, Open frontier:** without a cap, "build strength" means a bigger swarm.
- **C, Cap and command areas:** over budget, and hard to read if it fails.

The open map is H6, on top of the cap, if this holds.

Everything not mentioned here is H4 (below) and H3 inside an area. Where this spec and BACKLOG.md differ, the spec wins.

#### Claim

**A limit on how many ships you can field in an area, raised by research, makes the composition of your fleet the answer instead of its size.**
- Heavier areas feel stronger, because some are closed until a limit raise, a better mix or a Root cut opens them.
- A limit raise is a step you feel, because it opens something.
- "Max economy, then swarm" stops working, because past the limit more ships aren't possible.

What would disprove it:
- The owner still describes the run as "max economy then build a fleet and attack".
- The owner fills the limit with whatever the yards make and never thinks about the mix.
- The limit feels like an arbitrary wall: they can't tell why a wave failed or what would fix it.
- The economy feels pointless once the limit is full.

#### The smallest mechanics that test it

1. **A fleet limit per area.** Ships alive in the area plus ships being built count against `fleetCap`. A yard can't start a ship at the limit.
2. **Recycle:** a new order. It scraps your ships parked at a node for part of their ore, so you can change your mix.
3. **Command limit:** a new research item, 3 levels. Each level raises the limit by `research.fleet.step`, and each needs a heavier area reclaimed first.
4. **The A/B switch:** `fleet.cap` 0 means no limit, which is H4's rules.
5. **Recalibration (h5-design-data):** areas are retuned to the capability windows below, measured by a minimum-wave probe on the real sim.

New input: `recycleShips`. Nothing else in the input set changes.

#### The fleet limit

- **`fleetCap(world)`** = `fleet.cap + level(fleet) × research.fleet.step` when `fleet.cap > 0`, otherwise null (no limit). It is derived from tunables and research, and never stored.
- **`fleetCount(world)`** = the ships in `world.ships`, plus the yards with `ticksLeft > 0`.
  - Every ship counts, whatever it's doing: parked at any node, in transit, or fighting. In H4 every ship in `world.ships` belongs to the active area.
  - A ship in a yard counts from the moment the yard starts it. This way the yards can never overshoot the limit.
- **Rule 5b (yards), start step:** a yard *can start* only if, in addition to the H4 conditions, `fleetCap` is null or `fleetCount < fleetCap`. The count is recomputed after each start within the tick, so with a limit of 12 and 11 counted, only the first yard in rotation order starts. Rotation order and `yardTurn` are unchanged. A yard that can't start because of the limit keeps its turn (as with "no component").
- **Over the limit.** Ships are never removed to meet the limit. Landing starts with no ships, and research is bought only on the overworld, where no ships exist, so a raise never meets a fleet. The only way to be over is lowering `fleet.cap` live in the tuning panel. Then existing ships stay, and yards don't start until the count is below the limit. Raising it live lets yards start on the next tick.
- **Leaving an area** loses its ships, as in H4.
- **Losses** free slots at once. The yards refill from throughput, so pillar 1 still sets how fast you rebuild.

#### Recycle

- **Input `recycleShips {node, counts: {drone, lancer, flak}}`.** Valid while an area is active and before the win, if all of the following hold:
  - `node` is a node index;
  - `node` is not a living guarded node (no recycling in a battle);
  - the clamped total is ≥ 1.

  Each count is clamped to the ships of that type parked `at` `node` (not in transit), and the lowest-id ships of each type go, as `sendShips` does.
- **Effect:** for each ship recycled, `stock.ore += floor(ship.<type>.cost × fleet.recycleRefundPct / 100)`. The component is lost. The ships are removed at once.
- **Stats:** `stats.shipsRecycled` per type and `stats.oreRefunded`. Recycled ships do not count as lost.
- **Valid when `fleet.cap` is 0:** harmless.
- **Rule order:** inputs (rule 1), as all orders.

#### Command limit (data `research`)

New rows for the H4 "Research" table, in the same format. h5-sim adds them to that table.

| id | name | kind | level | ore | ice | crystal | requires | effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fleet` | Command limit | limit | 1 | 60 | 20 | 20 | a tier 1 area reclaimed | fleet limit +`research.fleet.step` (6): 12 → 18 |
| `fleet` | Command limit | limit | 2 | 140 | 40 | 40 | a tier 2 area reclaimed | +6 more: 24 |
| `fleet` | Command limit | limit | 3 | 240 | 60 | 60 | two tier 2 areas reclaimed | +6 more: 30 |

- **A new requirement kind:** `{ "tier": T, "count": N }` holds when at least N reclaimed areas have tier ≥ T. `parseSimData` rejects T outside the data's tiers, and N < 1 or N greater than the number of areas with tier ≥ T. `unmetRequirements` and `researchStatus` report it ("Needs a medium area reclaimed", "Needs both medium areas reclaimed").
- **A new kind, `limit`:** a meaty step, drawn as a large card like the designs. The probe core doesn't require it.
- **With `fleet.cap` 0,** `buyResearch` of `fleet` is invalid, and `researchStatus` reports the reason `capOff` ("Fleet limit is off (tuning)"). That keeps the A/B clean.
- **"Only heavier areas give it".** Ice and crystal come from every tier today, so the gate is the reclaim requirement plus amounts the light hauls can't cover:
  - After both light areas and both designs, you hold 40 ice and 40 crystal: enough for level 1, not level 2.
  - Level 2 needs a medium's haul, and level 3 needs both mediums'.
- **Hauls rise to keep the invariant** Σ haul ≥ Σ research cost (enforced by `parseSimData`). h5-sim updates the H4 "Areas" table and its totals line with the data.

  | Area | Haul v7 (ore / ice / crystal) | Haul v8 |
  | --- | --- | --- |
  | `veil` | 300 / 60 / 40 | 420 / 90 / 70 |
  | `garden` | 300 / 40 / 60 | 420 / 70 / 90 |
  | `deep` | 720 / 60 / 60 | 920 / 100 / 100 |

  Totals at v8:
  - hauls: 2120 ore, 340 ice, 340 crystal;
  - research, every level: 2100 ore, 340 ice, 340 crystal (H4's 1660 / 220 / 220 plus Command limit's 440 / 120 / 120).

  Exports, the other hauls, and every area guard are unchanged at v8. h5-design-data retunes them.

*Superseded at data v10 by H6 (h6-sim, 2026-11-08):* H6 removed Command limit, its three rows and `research.fleet.step` (H6 "Research"). Relays raise the limit instead (H6 "Fleet limit, relays and band locks"). The `{tier, count}` requirement stays in the sim, but no shipped item uses it.

#### Root cuts, regrowth and trickling under the limit

- **Root cuts are unchanged** (H3 rule 8). Under the limit they become a gate. A medium's fed heart is calibrated not to fit the base limit while its starved heart does, so at Command limit 0 you take a medium by cutting its Root, and at level 1 you may skip the cut.
- **Regrowth is unchanged.** Guards regrow faster than yards rebuild: one Spore every 20 ticks and one Thorn every 60 per guarded node, against one ship every 90–120 ticks per yard. A failed wave can't be topped up while the node recovers.
- **Trickling.** Rally may still point at a living guarded node, so rebuilt ships stream into the fight. At most `fleetCap` ships can be in it, so a stream adds no more than the limit. Bot flag 2 checks that drones can't win this way either: the `drones-only` campaign plays with the rally at its staging rock and refills between waves.
- **No "ships needed" number.** Estimating stays the puzzle (H3). Instead:
  - the limit is on the HUD, the probe sheet and every area sheet;
  - a repelled wave that was sent at the limit gets a hint (see Client).

#### The A/B switch

`fleet.cap` 0 restores H4's rules: no limit, Command limit can't be bought, and Recycle still works. It keeps the H5 numbers (heavier hearts, higher hauls), so it is "H4's rules on H5's areas", which is the fair comparison. The tuning panel labels it "Fleet limit (0 = none)". Live: it applies on the next tick.

#### Capability windows (the calibration targets; bot flags 2–6 measure them)

Definitions:
- **The tier's limits:** L0 = `fleet.cap` (12), L1 = L0 + step (18), L2 = L0 + 2 × step (24), at defaults.
- **Locally buildable:** drones always; lancers if the area has a crystal prize; flak if it has an ice prize. Both designs are assumed. In H4's areas:
  - Frost Shelf: drones and flak;
  - Glass Shoal: drones and lancers;
  - mediums and The Deep: all three.
- **Fits at L:** the minimum winning simultaneous wave of locally buildable types is ≤ L − 2. Two spare slots allow for imperfect play.
- **Closed at L:** that minimum is > L.
- **The weakest state:** starved (Root cut) if the area has a Root; otherwise fed.

| Tier | Window at defaults |
| --- | --- |
| 1 (light) | The heart fits at L0, **with drones alone**. Your first light area comes before any design, so it must be drone-takeable. Light areas teach the limit; they don't gate. |
| 2 (medium) | Fed: closed at L0, fits at L1, and **no single type fits at L1** (both counters needed, so neither medium is "the Flak side"). Starved: fits at L0. Drones alone, starved: closed at L1. |
| 3 (The Deep, each layout) | Starved: fits at L1, closed at L0. Fed: closed at L1, fits at L2. Drones alone, starved: closed at L2. |

What these windows mean in play:
- At level 0, a medium needs its Root cut. At level 1 its fed heart opens.
- The Deep needs at least level 1 with a cut, or level 2 without.
- Drones never take a tier 2 or tier 3 heart at the limit you have when you get there.
- Level 3 (30) is comfort: it makes The Deep's fed heart easier.

#### Entities and state: changes

- `world.campaign.research.fleet`: the Command limit level (0–3).
- `stats.shipsRecycled` (per type) and `stats.oreRefunded`.
- The campaign area record gains `shipsRecycled` (the visit total).
- A battle or attack record gains `capAtSend`: the limit when the wave was sent, or null when off. The repelled hint uses it. The core engineer puts it where the battle report already lives.
- Nothing else. The limit and the count are derived.

#### Player inputs: changes

| Input | Rule |
| --- | --- |
| `recycleShips {node, counts}` | New (above). |
| `buyResearch {item}` | As H4, plus the `tier` requirement kind, and `fleet` is invalid while `fleet.cap` is 0. |
| `setTunable` | Accepts the H5 keys; all three are live. |

#### Rules per tick: changes

- **Rule 1 (inputs):** `recycleShips`.
- **Rule 5b (yards):** the limit check on start (above).
- **Determinism:** integer only, fixed orders, no RNG.

#### Tunables (H5, data/sim.json, all integers)

| Key | Default | Range | Feels like (low / high) |
| --- | --- | --- | --- |
| `fleet.cap` | 12 | 0–60 | 0: no limit (H4's rules, the A/B) / 6: every ship precious, tiny fights / 60: no real limit, the swarm returns |
| `research.fleet.step` | 6 | 2–12 | per Command limit level. 2: raises go unnoticed / 12: one level doubles the fleet |
| `fleet.recycleRefundPct` | 50 | 0–100 | 0: a wrong build is wasted until it dies / 100: free refits, so composition is never a commitment |

All three are live and sim-scoped.

*Superseded at data v10 by H6 (h6-sim, 2026-11-08):* `research.fleet.step` is removed. `fleet.cap` and `fleet.recycleRefundPct` are unchanged. The H6 keys are in "Tunables (H6 …)".

#### Save, data version and replay

- **`dataVersion` 8.** A v7 save fails the data-version check and is discarded with the existing toast. No migration: a v7 campaign has no Command limit level and was balanced without a limit.
- **h5-design-data bumps to 9** if it changes any value. h5-sim's v8 will already have deployed by then. The test that pins the version changes with it (`packages/sim/test/data-h4.test.ts`, "is data version 7", or wherever h5-sim moves it).
- **The save** grows by a few integers.
- **The reference replay** is regenerated. It covers:
  - Landfall;
  - a Command limit purchase (bought from a `campaignWorld` start with a tier 1 area reclaimed);
  - landing with the raised limit;
  - a yard paused at the limit (using `setTunable fleet.cap` to a small value to stay short);
  - a `recycleShips`;
  - a capture.

  The determinism hashes are re-baselined.

#### What changes for H4 content

- **The H4 tables in DESIGN.md** ("Areas" hauls and totals, "Research" and its totals line) are updated by h5-sim to the v8 values above, with a dated note under each. The data tests read them. The H4 prose stays as the record of what H4 tested.
- **The area result and win panels** gain "Recycled: N ships (+M ore)".
- **Landing** is unchanged, except that the landing notice names the limit.
- **Bots:** the H4 strategies are retired except `greedy`, which runs once per seed with `fleet.cap` 0 as the cap-off reference row.

#### Client: screens and phone UI

The H1–H4 rules hold: 375 px portrait, no hover, every target ≥ 44 px, every action ≤ 2 taps from its screen (confirms and panels excepted), nothing in either HUD wraps under the wide-font stress. All numbers come from sim selectors or live tunables.

**Inside an area:**
- **HUD:** a **fleet chip**, "Fleet 9/12", with the fleet icon, next to the ship chips.
  - It turns to the "full" style at the limit.
  - It is hidden when `fleet.cap` is 0.
- **Probe sheet, Yards block:**
  - a header line, "Fleet 9/12 · Command limit 1/3";
  - a new yard state, **`fleetFull`**, "idle: fleet full (12/12)". It comes after `off` and before `needsComponent`, so a capped yard never says "needs lens" when the real reason is the limit.
- **Recycle:**
  - Every node sheet where your ships are parked has a **Recycle…** button next to **Choose…**, except a living guarded node's sheet.
  - It opens the send-panel pattern: one row per type with a −/+ stepper (44 px), the count and "All". Every row defaults to **0**, not all.
  - Below the rows: a live refund preview ("+27 ore") from the `recycleRefund` selector, then **Recycle** (primary) and Cancel.
  - Confirming shows a notice: "Recycled 3 drones: +27 ore."
- **The first time the fleet fills in a visit,** a notice: "Fleet full (12/12): yards paused. Recycle ships at a node to change your mix."
- **Repelled hint:** if a repelled wave's sent count was ≥ `capAtSend` − 1, the H3 repelled toast adds: "You sent a full fleet. Change the mix, cut the Root, or raise the limit (Command limit)." If the heart is fed, "cut the Root" leads.
- **The landing notice** adds "fleet limit 18".

**Overworld:**
- **Area sheet:** a line "Your fleet limit: 18" under the heart's tags. There's no ships-needed number.
- **Research sheet:** a **Command limit card** in the meaty-step group, next to the designs:
  - the fleet icon and "Fleet limit 12 → 18";
  - level pips, "1/3";
  - cost chips;
  - the requirement line ("Needs a medium area reclaimed");
  - **Research**.

  Disabled reasons come from `researchStatus`, including "Fleet limit is off (tuning)".
- **Notice on purchase:** "Command limit 1: fleet limit now 18."

**Tuning panel:** the three keys. `fleet.cap` is labelled "Fleet limit (0 = none)".

**Phone checks:** the fleet chip and the ship chips fit one row at 375 px under the wide-font stress, and the Recycle panel fits 375x667 with the keyboard closed.

#### Art needs (for Art Direction, within ART_STYLE.md)

- **Fleet icon:** three small player-blue chevrons inside a bracket, meaning "a fleet of N". It's used on the chip, the sheet header and the research card. A `full` variant has a closed bracket, the bracket in amber.
- **Recycle icon:** a ship chevron inside a circular arrow, meaning "scrap back into ore", in the ore teal family.
- **Research icon `fleet`:** the fleet icon inside the dashed blueprint square used by the design icons.

All must be told apart at 24 px from each other and from the H4 research icons. Any new colour gets a palette key and an ART_STYLE.md row. Everything stays within r.

Draw contract (h5-client calls these before h5-art merges, with placeholders until then):
- `drawFleetIcon(ctx, r, full)`, with `full` a boolean;
- `drawRecycleIcon(ctx, r)`;
- `drawResearchIcon(ctx, r, id)` accepts `'fleet'`.

Existing draw functions keep working.

#### Selectors (sim, read-only)

- **`fleetStatus(world)`:** `{ cap: number | null, count, building, byType: {drone, lancer, flak}, full: boolean, level, maxLevel }`.
- **`recycleRefund(world, counts)`:** ore refunded, after clamping at no particular node. The panel passes the clamped counts.
- **`yardStatus`:** the `fleetFull` state.
- **`researchStatus`:** the `fleet` row (kind `limit`, effect now and next as limits), the `tier` requirement and the `capOff` reason.
- **`landingEffects`:** `fleetCap`.
- **`campaignSummary` and the area result:** ships recycled and ore refunded.

#### Bots: strategies and the probe

**The composer engine** (replaces the H3 in-area engine for every H5 strategy; deterministic, integer only):
1. **Economy:** as H4 (the economy plan, then build out captures). Rally at a5.
2. **Buildable types:** drones; plus lancer or flak if researched and the area has that type's prize, captured or not.
3. **Allocation** for a target and a limit C (when the cap is off, C = the H3 engine's current fleet):
   - Search every (lancers l, flak f) with l + f ≤ C over buildable types, with drones = C − l − f.
   - Pick the highest `fleetPower` estimate (H3 formula, at the target's caps).
   - Ties go to fewer component ships, then more lancers.
4. **Target:**
   - Among living guarded nodes, take the H3 `nextTarget` order, skipping nodes whose best allocation at the limit fails the H3 attack test (`power × 3 ≥ need + 20`).
   - If the heart fails and its Root is alive, target the Root.
   - If nothing passes, the area is **closed**: withdraw at once and record it.
5. **Yards:** a type's yard is on while its counted ships (alive + building) are below the allocation.
6. **Recycle:** when the fleet is full and a type at a5 is above its allocation, recycle the surplus at a5.
7. **Attack:** send everything at a5 when the ships at a5 match the allocation, or the H3 threshold is met with what is there. Repelled waves raise the threshold as in H3.

**Area choice:** greedy (H4) among open areas, skipping any area recorded closed at the current limit and designs. If every open area is closed, land in the cheapest by estimate anyway. The 30-minute visit cap and the softlock rule then apply. A closed record clears when the limit or designs change.

**Research policy** (all but `no-command` and `drones-only`): H4's list with Command limit inserted:
1. core;
2. lancer, flak;
3. fleet 1;
4. opening 1, extract 1;
5. fleet 2;
6. rigs 1, yards 1;
7. fleet 3;
8. then H4's remainder.

**Strategies:**
- `composer`: greedy area choice.
- `ice-first`: Landfall, Frost Shelf, then composer.
- `crystal-first`: Landfall, Glass Shoal, then composer.
- `no-command`: composer, but never buys Command limit.
- `drones-only`: the composer engine with drones as the only buildable type. It buys only grind research: no designs, no Command limit, no core.
- **Reference:** `greedy` (H4, unchanged) with `fleet.cap` 0, one row per seed.

**The probe** (new, `packages/bots/src/waves.ts`): the minimum-wave search from `packages/sim/test/min-wave.ts`, moved or copied into the bots package.
- It lands each area from `campaignWorld` (both designs), cuts the Root for the starved state, and finds:
  - the minimum single-type waves, drones / lancers / flak;
  - the best mix of locally buildable types, with that fleet.

  It does this for every tier ≥ 1 heart, fed and starved, and for The Deep on each seed's layout.
- The search is capped at 80 ships per type and at the tier's L2 + 6 for mixes. It prints progress per area.
- The full report runs it. The bot gate may skip it if it is slow, and DECISIONS.md says so.

**Report:**
- **Per strategy and seed:**
  - outcome and play time;
  - area order with visit times;
  - withdrawals marked "closed";
  - Command limit purchase times;
  - for each area, Root cut before the heart (yes/no);
  - ships built, lost and recycled;
  - the capturing wave's composition per heart;
  - tick p50/p95.
- **A probe table:** per heart, fed and starved: d / l / f / best mix (fleet), with the tier's L0, L1 and L2, and each window from "Capability windows" marked met or missed.
- **A per-seed comparison table.**

**H5 flags** (report lines, not merge gates). Each measures what can or can't be done, never a time gap:
1. **No softlock:** `composer`, `ice-first` and `crystal-first` buy the probe core on every seed within 120 game minutes of play.
2. **Drones don't fit:** the probe shows every tier 2 and tier 3 heart closed to drones alone at the tier's limit (starved: tier 2 at L1, tier 3 at L2). And `drones-only` reclaims no tier 2 or tier 3 area on any seed.
3. **The best local mix fits:** every window's "fits" cell holds in the probe: tier 1 at L0 with drones, tier 2 starved at L0 and fed at L1, tier 3 starved at L1 and fed at L2.
4. **Both counters needed:** no single type fits either medium's fed heart at L1, and the best mix does.
5. **A raise opens an area:** every medium's fed heart is closed at L0, and every Deep layout's fed heart is closed at L1 and fits at L2. And `no-command` does not buy the core on any seed.
6. **Composition varies:** on every seed, the lancer share of the best mix differs by at least 30 percentage points between at least two tier ≥ 2 hearts (fed or starved).
7. Determinism and the reference replay pass.

**Reported, not flagged:**
- run length and area times (no band; the owner judges pace);
- recycles per run;
- the cap-off reference time against `composer`.

The engineers report the numbers and don't retune; h5-design-data retunes.

**Tests must not pin tuned values.** Strategy, allocation and flag tests use `fixtureData` (or a frozen v8 fixture) with explicit premises. A shipped-data test asserts only calibration-proof facts. No test runs over about 5 s, and none has a runtime that grows with game length.

#### Calibration (h5-design-data)

**Assume fix-extract-rate is on `main`** (the bots read the true boosted extraction rate; per STATUS.md, the best H4 run fell to about 43:35).

1. **First job: measure.** Run the h5-bots probe on v8 and commit its report. That gives the minimum winning mixes per heart. Every mix number in DESIGN.md comes from that committed report, not from a scratch model.
2. **Retune, in priority order:**
   1. no softlock (flag 1);
   2. the windows (flags 2–5);
   3. composition varies (flag 6).

   The levers:
   - area guard counts (H4 "Area guards");
   - The Deep's layouts (H3 "Layouts" tables; the data tests read them);
   - hauls and Command limit costs (keeping Σ haul ≥ Σ cost);
   - the three H5 tunables.
3. **Bump `dataVersion` to 9** if any value changes, and update the pin.
4. **Update every table** the data tests read, with the data, and search DESIGN.md for stale statements of what changed.

#### Calibration result (h5-design-data, data v9)

Sources:
- **Before:** `reports/archive/h5-bots-data-v8.md`, the h5-bots report on v8, regenerated after the stranded-ship fix (5280732).
- **After:** `reports/archive/h5-design-data-v9.md`, the current data.
- **Tags and pocket waves:** the shipped-data report in `packages/sim/test/min-waves.test.ts`, run on v9.

Both bot reports are `npm run bots -- --seeds 3`. The seeds pick The Deep's layout: 1 Glass Thicket, 2 Twin Seams, 3 Frost Gate. Times are game minutes of play.

**What changed (guards only).** Hauls, exports, research costs and the three H5 tunables are unchanged from v8. `dataVersion` goes from 8 to 9.

| Where | Change (T/S) | Why |
| --- | --- | --- |
| Frost Shelf heart | 2/12 → 0/8 | Tier 1 must fall to drones alone at L0 (v8: 19 drones). A single-type heart keeps the area's theme (Spores on the ice side) and falls to 9. |
| Glass Shoal heart | 6/4 → 2/0 | The same, Thorns on the crystal side (v8: 20 drones; v9: 8). 2 Thorns also pass the bots' attack estimate with 12 drones: need 40 + 20 = 60 ≤ 3 × 24. |
| Spore Veil heart | 1/50 (starved 0/25) → 4/34 (4/20) | Fed: one type alone (Flak 16) no longer fits L1. Starved: drones alone need more than 18. |
| Thorn Garden heart | 24/13 (starved 11/5) → 14/9 (9/5) | Fed mix 25 → 16 (fits L1); starved mix 11 → 9 (fits L0). |
| Spore Veil p1 / Thorn Garden p1 | 2/6 → 0/6; 1/12 → 0/5 | You land with no components, so a medium's first pocket must fall to drones within L0. By the bots' attack estimate, 12 drones give 3 × 24 = 72 against need + 20: 96 for 2/6 and 112 for 1/12 fail, while 56 for 0/6 and 50 for 0/5 pass. |
| The Deep hearts (fed only) | Frost Gate 23/27 → 18/21; Glass Thicket 29/16 → 21/11; Twin Seams 12/42 → 10/34 | Fed: closed at L1, fits at L2. Starved caps unchanged. |
| The Deep pockets (all three layouts) | 2/21 → 1/15; 6/6 and 8/6 → 3/2; 4/10 → 2/6; 4/37 → 3/26; 18/8 → 13/6 | The first pocket falls to drones within L1: 18 drones give 3 × 36 = 108 against need + 20 of 92 (3/2) or 96 (2/6), and the shipped min-wave report gives 13 and 15 drones. The heavy pockets are about 30% smaller, so the composer's first wave at the limit is not repelled. |

**Flags, before → after** (each flag is judged across all three seeds; per-seed detail is in the reports):

| Flag | v8 (`h5-bots-data-v8`) | v9 (`h5-design-data-v9`) |
| --- | --- | --- |
| 1. No softlock | missed: all 9 winning runs softlock at 70.2 min, with only Landfall reclaimed | met: all 9 runs bought the core |
| 2. Drones don't fit | missed: Spore Veil starved, drones 15 against 18 | met: drones starved 20 / 20 (mediums) and 33 / 27 / 30 (The Deep); `drones-only` reclaims Landfall, Glass Shoal and Frost Shelf only, on every seed |
| 3. The best local mix fits | missed: Frost Shelf drones 19, Glass Shoal 20, Thorn Garden starved mix 11, Thorn Garden fed 25, The Deep fed 30 / 24 / 28 | met |
| 4. Both counters needed | missed: Spore Veil Flak alone 16; Thorn Garden mix 25 | met: Spore Veil d/l/f 34/37/26, mix 16; Thorn Garden 37/24/47, mix 16 |
| 5. A raise opens an area | missed: The Deep fed doesn't fit L2 | met; `no-command` softlocks on every seed with Landfall, Glass Shoal, Frost Shelf and Thorn Garden reclaimed |
| 6. Composition varies | met (gaps 93 / 88 / 88 pp) | met (gaps 43 / 38 / 38 pp) |
| 7. Determinism and replay | met | met |

**Probe after** (`h5-design-data-v9.md`, "Probe"; limits L0 12, L1 18, L2 24):

| Heart | State | d / l / f | Best mix (d/l/f) |
| --- | --- | --- | --- |
| Frost Shelf | fed | 9 / 15 / 3 | 3 (0/0/3) |
| Glass Shoal | fed | 8 / 3 / 15 | 3 (0/3/0) |
| Spore Veil | fed | 34 / 37 / 26 | 16 (0/8/8) |
| Spore Veil | starved | 20 / 18 / 14 | 9 (0/5/4) |
| Thorn Garden | fed | 37 / 24 / 47 | 16 (0/14/2) |
| Thorn Garden | starved | 20 / 11 / 23 | 9 (0/8/1) |
| The Deep, Glass Thicket | fed / starved | 50 / 29 / 63; 33 / 17 / 40 | 22 (0/20/2); 15 (0/14/1) |
| The Deep, Twin Seams | fed / starved | 45 / 40 / 41; 27 / 21 / 23 | 20 (0/13/7); 13 (0/9/4) |
| The Deep, Frost Gate | fed / starved | 50 / 35 / 58; 30 / 18 / 31 | 22 (0/19/3); 14 (0/11/3) |

**Runs after:**
- **The winners** (`composer`, `ice-first`, `crystal-first`) buy the core at 40:04–40:22 on every seed. Visits: Glass Shoal 5:59–6:03, Frost Shelf 6:27–6:32, Spore Veil 8:45, Thorn Garden 6:50, The Deep 11:44–12:01. Command limit levels 1, 2 and 3 land at about 12:42, 21:28 and 28:19.
- **The cap-off reference** (`greedy`, `fleet.cap` 0) takes 41:32, 40:10 and 40:51.
- **v8, for comparison:** greedy took 45:48, 44:01 and 43:56.

What the numbers say:
- **The windows hold, at the edges.** Spore Veil and Thorn Garden fed, and Glass Thicket and Frost Gate fed, sit exactly on "fits" (16 at L1, 22 at L2). A one-guard change can flip a flag.
- **Every winning run follows the same order after the light areas** (Spore Veil, Thorn Garden, The Deep), and cuts every Root before its heart. The bots solve the limit with Root cuts, not mixes. Their capturing waves are often one type: Spore Veil 15 flak and The Deep 19 lancers on seed 1. The "both counters needed" window applies to *fed* hearts, which the bots never fight. Whether a player fights fed hearts (to skip a cut) or cuts every time is the owner's call in play.
- **The bots' attack estimate is more pessimistic than the sim for mixed nodes.** `no-command` marks Spore Veil closed at L0 although its starved heart's best mix is 9. The probe, not the bot, is the measure of what is possible.
- **The H5 limit doesn't make the run longer than cap-off.** Winners take 40:04–40:22 against cap-off 40:10–41:32. The guards were lowered so drones take the first pockets, which helps both.
- **Pace, not flagged:** a full run is about 40 game minutes against H4's 45:47–50:47 (`reports/archive/h4-design-data-v7.md`).

#### Success criteria (the owner, one 30–40 minute phone session; 4x is fine)

1. The owner reclaims at least 4 areas, counting Landfall.
2. They can name one fight where the limit made them choose or change a mix (including a recycle).
3. They can name one area that was closed until a limit raise, a better mix or a Root cut.
4. They don't describe the run as "max economy then build a fleet and attack".
5. They never ask why a yard is idle; the row says "fleet full".
6. Every action is ≤ 2 taps from its screen (confirms and panels excepted), and nothing in either HUD wraps at 375 px.

Optional: they try `fleet.cap` 0 in the tuning panel and say which they prefer.

#### Fun questions for the handoff

1. Did the ship limit make you think about which ships to build? Did you ever recycle ships to change your mix?
2. Was there an area you couldn't take until a limit raise, a better mix or a Root cut? Did that area feel stronger?
3. Did a limit raise feel like a big step?

#### Out of scope for H5

- **The open map** (H6): pan, scouting, more areas than you need, `areas.repeatHaulPct`, an overworld Root, command areas.
- **New ship or guard types** (Warden, Lash), tier 2 resources and sap.
- **Lane logistics:** capacity, imports, ships or stock crossing areas.
- **A "ships needed" number** on any sheet.
- **Carrying the limit into new game+**, and new game+ itself.
- **Adaptive guards**, guards that escalate, and guards that attack.
- **Re-entering reclaimed areas,** and research bought mid-area.
- **The H3 and H4 follow-ups** in BACKLOG "Can wait".

### H4 (Milestone 2, iteration 4, tested on build-20261108-3): Reclaim ladder

**Result (owner, 2026-11-08):** not supported. Areas didn't feel stronger, the approach stayed "max economy then swarm", the counters didn't feel necessary, the ice side was obvious, and later areas were a repeat with no big step. The bots' flags 3, 5 and 6 were met but measured only time gaps and permutations. The owner proposed a ship limit and a more open world. See PLAYTEST_LOG.md, "Owner direction 2026-11-08b" and the H5 spec above.

The owner picked A, "Reclaim ladder" (QUESTIONS.md Q16, 2026-11-08). The direction is "Owner direction 2026-11-08: the overworld (steelman)" above. **Not picked:** B "Supply lines" (lane capacity, sending output into the active area), because routing only matters once there is progression to route for, and the owner rated in-area logistics "may be fine"; C "Area runs with research", because a card draft drops the overworld and the areas that keep producing. B is the likely next slice if A holds.

Everything inside an area is H3 ("Counter web", below). H1–H3 rules not mentioned here still apply. Where this spec and the BACKLOG differ, the spec wins.

#### Claim

**Persistent research, bought with what your reclaimed areas send home, plus a choice of which area to reclaim next, makes getting stronger feel good and makes heavier areas a goal.** The build-out at the start of every area reads as progress, not a chore, because research visibly shortens it. Which design you research first changes which area is cheap next, so the climb is a path you choose, not a fixed ladder.

What would disprove it:
- The owner calls a later area "the same as the first" or a chore.
- The owner can't name an upgrade they noticed when landing in a later area.
- The owner takes the areas in the only order that makes sense, without weighing two.
- Research reads as a shop of +% numbers with no moment that feels like a big step.

#### The smallest mechanics that test it

1. **An overworld of 6 areas on one screen**, joined by 7 lanes. Lanes only decide which areas are open: an area is open when it is still held and a lane joins it to a reclaimed area (Landfall is open at the start). There is no lane capacity and nothing travels along lanes in the sim.
2. **Areas are cut from the H3 field.** Each area is the 16-node frame with some nodes left out, plus its own small layout (pocket prizes and slots, guard counts for its pockets, Root and heart) in the H3 layout format. The Deep is the full H3 field with the run's H3 layout, so it plays exactly like an H3 game.
3. **Area lifecycle.** Land (enter), play H3 rules, then reclaim (capture the heart) or withdraw (the area resets). One area at a time. The overworld screen is paused.
4. **A stockpile** of ore, ice and crystal on the overworld. Reclaiming an area pays its **haul** into the stockpile once. While you play any area that isn't yet reclaimed, every reclaimed area **ships** its export rates into the stockpile, in game time.
5. **Research** (7 items, 13 levels), bought on the overworld from the stockpile: two ship designs (the meaty steps), four levelled grind items aimed at the opening, and the **probe core**, which wins the game.
6. **One rule change inside areas:** a lancer or flak yard needs its design researched **and** its component made locally. The yard row names which is missing.

New inputs: `enterArea`, `leaveArea`, `buyResearch`. Nothing else in the input set changes.

#### The overworld

Frame x 0–1000, y 0–1300, fitted like an area. Area nodes are drawn at radius 80 su (at least 44 px tall at 375x667).

```
                 [The Deep]            tier 3
                /          \
       [Spore Veil] ---- [Thorn Garden]   tier 2
            |                  |
       [Frost Shelf]      [Glass Shoal]   tier 1
                \          /
                 [Landfall]            tier 0 (start)
```

Lanes (data `map.lanes`, undirected): `landfall–shelf`, `landfall–shoal`, `shelf–veil`, `shoal–garden`, `veil–garden`, `veil–deep`, `garden–deep`.

What is open when:
- At the start only Landfall is open.
- After Landfall: Frost Shelf and Glass Shoal.
- Frost Shelf opens Spore Veil; Glass Shoal opens Thorn Garden. Either medium opens the other (the `veil–garden` lane) and The Deep.
- So the shortest path to The Deep is Landfall, one light area, one medium. The ice side (Shelf, Veil) and the crystal side (Shoal, Garden) are two doors to each tier.

#### Areas (data `map.areas`)

`nodes` are frame ids from `map.nodes` (positions unchanged; the client fits the present nodes, so small areas draw larger). Each area except The Deep carries its own guard counts (next table) in the H3 layout format: `pockets` (one per pocket node present), `root` (only if the Root is present) and `heart`. The Deep has `layout: "seed"`: the run's H3 layout, chosen as in H3 by `system.variant` or the seed. Caps are the H3 `capEff(n) = min(60, floor(n × guard.capPct / 100))`. Haul and export are ore / ice / crystal.

| id | name | tier | x | y | nodes | haul | export/min |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `landfall` | Landfall | 0 | 500 | 1150 | probe a1 a2 a3 a4 a5 heart | 100 / 0 / 0 | 4 / 0 / 0 |
| `shelf` | Frost Shelf | 1 | 220 | 870 | probe a1 a2 a3 a5 p1 heart | 130 / 80 / 0 | 3 / 2 / 0 |
| `shoal` | Glass Shoal | 1 | 780 | 870 | probe a1 a2 a4 a5 p1 heart | 130 / 0 / 80 | 3 / 0 / 2 |
| `veil` | Spore Veil | 2 | 220 | 520 | probe a1 a2 a3 a4 a5 a6 a7 p1 p2 root heart | 420 / 90 / 70 | 5 / 3 / 0 |
| `garden` | Thorn Garden | 2 | 780 | 520 | probe a1 a2 a3 a4 a5 a6 a7 p1 p2 root heart | 420 / 70 / 90 | 5 / 0 / 3 |
| `deep` | The Deep | 3 | 500 | 200 | all 16 | 920 / 100 / 100 | 8 / 3 / 3 |

Totals: haul 2120 / 340 / 340 (data v8), which covers every research level (2100 / 340 / 340; see "Research"). The sim's data validation enforces haul ≥ research cost per resource, so a player who takes every area can always afford the probe core, whatever they bought first. No softlock.

*Updated 2026-11-08 by h5-sim (data v8):* the `veil`, `garden` and `deep` hauls rose from 300 / 60 / 40, 300 / 40 / 60 and 720 / 60 / 60 (v7, calibrated by h4-design-data; totals then 1680 / 240 / 240 against 1660 / 220 / 220) to cover the H5 Command limit levels (H5 spec, "Command limit"). The prose below is the record of what H4 tested at v7.

*Superseded at data v10 by H6 (h6-sim, 2026-11-08):* this table, its totals line and the lanes above describe data v9. Data v10 has ten areas with `side` and `relay`, 14 lanes (16 from v11), the frame y 0–2100 and no Root (H6 "The overworld" and "Areas"). The no-softlock check is now H6's haul invariant, with repeat hauls at their worst position.

**Area guards** (data, before `guard.capPct`; T/S; "starved" is the heart after the Root is cut). First derived from the H3 layouts at about 20% (light) and 60% (medium) and pushed toward each side's theme, then calibrated by h4-design-data (see "Calibration result (h4-design-data, data v7)"), and recalibrated for the fleet limit by h5-design-data (data v9; see H5 "Calibration result (h5-design-data, data v9)"). The tag columns give the sheet's Strong/Even/Weak for lancer / flak at full caps (hp-weighted multiplier in brackets, worked from the H3 formula).

| Area | Node | Prize | Slots | Guards (T/S) | Tags l / f |
| --- | --- | --- | --- | --- | --- |
| landfall | heart | ore | 4 | 0 / 0 | none (no guards: the first ship to arrive reclaims it) |
| shelf | p1 | ice | 2 | 0 / 4 | Weak (25) / Strong (200) |
| shelf | heart | ore | 4 | 0 / 8 | Weak (25) / Strong (200) |
| shoal | p1 | crystal | 2 | 0 / 4 | Weak / Strong |
| shoal | heart | ore | 4 | 2 / 0 | Strong (200) / Weak (25) |
| veil | p1 | ice | 2 | 0 / 6 | Weak (25) / Strong (200) |
| veil | p2 | crystal | 2 | 2 / 6 | Even (117) / Even (107) |
| veil | root | none | 0 | 0 / 16 | Weak / Strong |
| veil | heart | ore | 4 | 4 / 34, starved 4 / 20 | Weak (74) / Strong (150); starved Even (95) / Even (130) |
| garden | p1 | crystal | 2 | 0 / 5 | Weak (25) / Strong (200) |
| garden | p2 | ice | 2 | 4 / 3 | Strong (167) / Weak (57) |
| garden | root | none | 0 | 9 / 0 | Strong / Weak |
| garden | heart | ore | 4 | 14 / 9, starved 9 / 5 | Strong (171) / Weak (53); starved Strong (175) / Weak (50) |
| deep | all | as H3 | as H3 | the H3 layout tables | as H3 |

*Superseded at data v10 by H6 (h6-sim, 2026-11-08):* the shipped guards are H6 "Area guards". Landfall, Frost Shelf and Glass Shoal keep these rows. Spore Veil and Thorn Garden lose their Root rows and starved counts, and The Deep plays its H3 layout without the Root (fed counts only).

How an H3 field is cut down:
- **Landfall** is the H3 frame's lower asteroids and an empty heart: a landing beat of under a minute (build one drone, send it). It gets the player to the overworld and the first research choice at once.
- **Light areas** keep 4 asteroids (8 slots, 80 ore/min at full build), one light pocket (a small Spore patch) and the heart; no Root. Target 5–9 game minutes.
- **Medium areas** keep the 7 near asteroids (13 slots), both light pockets, the Root and the heart; the far corners (a8, a9) and the heavy pockets (p3, p4) are left out. Target 7–12 game minutes.
- **The Deep** is the whole H3 field with the run's H3 layout, unchanged. Target 9–15 game minutes with research (the H3 bots took 19–22 without any).
- Areas without a Root: the heart is fed and can't be starved.

Why these areas:
- **Two doors per tier.** Ice comes first from the Shelf, crystal from the Shoal; each medium is reached from its own light area or from the other medium.
- **Each side has a theme.** The ice side (Frost Shelf, Spore Veil) is held by Spore swarms; the crystal side (Glass Shoal, Thorn Garden) by Thorns. Spore Veil's heart and Root are Flak Strong; Thorn Garden's are Lancer Strong.
- **Research decides the cheap medium.** The ice haul from the Shelf buys the Flak design, the crystal haul from the Shoal buys the Lancer design. So your first light area and your first design decide which medium is cheap. It's the owner's H3 read ("the heart is spore-heavy so go win the easiest flak node") one level up. Both mediums have both light pockets, so either design can be built in either.
- **The probe core needs both designs and The Deep** (see Research), so every run crosses sides at some point; the order is yours.
- **You can skip one area, if you go light on Fast yards.** Both designs and the core need 160 ice and 160 crystal. Skipping a medium leaves 180–200 of each from hauls alone; skipping a light area leaves exactly 160 of its resource. Fast yards costs 20 then 40 more of each, so a player who buys both levels needs all six areas (hauls total 240 of each, plus shipments). Skipping is a trade-off between yard speed and one fewer area. Four areas never do: one side's resource stops at 100. In the h4-design-data bot report every strategy buys both yard levels before the core and so takes all six areas (`reports/archive/h4-design-data-v7.md`, "Skipped" column).
  - *Superseded at data v8 (H5) and still true at v9:* hauls now total 340 ice and 340 crystal, exactly the cost of every research level, Command limit included. The core still needs only the two designs and The Deep (160 of each). Skipping one light area or one medium leaves at least 250 of each resource from hauls alone: enough for the designs, the core and Command limit 1 and 2 (60 of each), but not for every level. Skipping a medium also rules out Command limit 3, which needs both mediums. The Deep can't be skipped. Whether a bot skips is in the "Skipped" column of `reports/archive/h5-design-data-v9.md`.

#### Area lifecycle

**Landing (`enterArea`).** The area's state is built fresh from data, in this order:
1. Nodes: the frame nodes whose id is in the area's `nodes`, in frame order (so the probe is index 0). Pockets take prize and slots from the area's layout.
2. One guardian per present pocket, Root and heart (node order), with the area's counts (The Deep: the run's H3 layout); guards start full (H3 rule). If the area has no Root, the heart's `starvedCounts` is null and `fed` stays true.
3. Stock: `ore = economy.startStock + opening level × research.opening.step`; everything else 0. No ships, routes or queue; rally at the probe; assemblers idle; `yardTurn` 0.
4. Yards: drone on; lancer on if the Lancer design is researched; flak on if the Flak design is. (A researched yard waits for its component, so starting it on saves a tap.)
5. Seed rigs: at rigs level L, the first L of `a1`, `a2` start owned, with 1 extractor and a level-1 route to the probe, free.
6. Area stats reset; `areaStartTick = tick`; the area's entry count goes up by 1.

**Reclaim.** Capturing the area's heart (H3 rule 8) also:
- marks the area reclaimed at this tick and appends it to the reclaim order;
- pays its haul into the stockpile;
- records the visit's play time, ships built and lost.

The area stays on screen with the result panel. Shipments stop (rule 10). Free play is allowed but changes nothing in the campaign.

**Leaving (`leaveArea`).**
- From a reclaimed area: back to the overworld. The area becomes its summary (its export rates).
- From a held area (a withdraw): back to the overworld, the area resets to held and its visit counts as a withdrawal. Ships, buildings and local stock are lost. Research, the stockpile and other areas are untouched. You lose time, never the run.
- In both cases the area's own fields are cleared.

**What carries in:** research levels (opening ore, seed rigs, extraction, yard speed, designs). **What never carries:** local stock, ships, buildings. The stockpile is never spent inside an area.

**Pause on the overworld.** With no area active, `step` applies its inputs, advances `tick`, and runs no rules: nothing accrues, regrows or moves. The client steps only to apply overworld inputs, so the overworld is paused in effect and the log stays short.

#### Stockpile and shipments (all integer)

- `campaign.stockpile = {ore, ice, crystal}`, starting at 0.
- **Haul:** paid once, at reclaim.
- **Rule 10, shipments (new, after stats, only while an area is active and its heart isn't captured):** for each resource in the order ore, ice, crystal, `shipAccum[res] += Σ export[res] over reclaimed areas × shipments.pct`. While `shipAccum[res] ≥ ticksPerMin × 100`, subtract that and add 1 to `stockpile[res]` (and to the shipped total).
- Shipments don't run on the overworld, while an area's result panel is up, or after the win. There is no offline progress and no timer.
- Shipments are the grind texture (the stockpile visibly fills while you play); hauls are the backbone. Expected split over a full run: about 20–35% shipped, the rest hauled (bots report it).
- Known risk: a player could idle in a held area to farm shipments. At 4–8 ore/min per area it's slow, and `shipments.pct` 0 turns shipping off as an A/B if the owner reports it.

#### Research (data `research`)

Bought on the overworld only (not inside an area), one level at a time. Cost per level is `floor(cost × research.costPct / 100)` per resource. Kinds: **design** (a meaty step: it changes what you can attempt), **grind** (shortens the opening or the fight), **win**.

| id | name | kind | level | ore | ice | crystal | requires | effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `lancer` | Lancer design | design | 1 | 60 | 0 | 40 | none | lancer yards can run (each lancer still needs a lens made in the area) |
| `flak` | Flak design | design | 1 | 60 | 40 | 0 | none | flak yards can run (each flak still needs plating made in the area) |
| `opening` | Opening ore | grind | 1 | 50 | 0 | 0 | none | +`research.opening.step` (40) ore at every landing |
| `opening` | Opening ore | grind | 2 | 100 | 0 | 0 | none | +40 more |
| `opening` | Opening ore | grind | 3 | 150 | 0 | 0 | none | +40 more |
| `extract` | Extraction | grind | 1 | 60 | 0 | 0 | none | every extractor in an area yields +`research.extract.stepPct` (25)% |
| `extract` | Extraction | grind | 2 | 120 | 0 | 0 | none | +25% more |
| `extract` | Extraction | grind | 3 | 180 | 0 | 0 | none | +25% more |
| `rigs` | Seed rigs | grind | 1 | 100 | 0 | 0 | extract 1 | land with A1 already mined and routed (1 extractor) |
| `rigs` | Seed rigs | grind | 2 | 200 | 0 | 0 | extract 1 | and A2 |
| `yards` | Fast yards | grind | 1 | 60 | 20 | 20 | none | ship build time −`research.yards.stepPct` (20)% |
| `yards` | Fast yards | grind | 2 | 120 | 40 | 40 | none | −20% more |
| `core` | Probe core | win | 1 | 400 | 120 | 120 | lancer 1, flak 1, The Deep reclaimed | launches the new probe: the win panel |
| `fleet` | Command limit | limit | 1 | 60 | 20 | 20 | a tier 1 area reclaimed | fleet limit +`research.fleet.step` (6): 12 → 18 |
| `fleet` | Command limit | limit | 2 | 140 | 40 | 40 | a tier 2 area reclaimed | +6 more: 24 |
| `fleet` | Command limit | limit | 3 | 240 | 60 | 60 | two tier 2 areas reclaimed | +6 more: 30 |

Totals over every level: 2100 ore, 340 ice, 340 crystal.

*Updated 2026-11-08 by h5-sim (data v8):* the three Command limit rows are H5's (see the H5 spec, "Command limit"); a "tier T" requirement holds when enough reclaimed areas have tier ≥ T, and each of these applies only to its own level. Before them the totals were 1660 ore, 220 ice, 220 crystal. The H4 items are unchanged.

*Superseded at data v10 by H6 (h6-sim, 2026-11-08):* the shipped research is H6 "Research": these rows without the three Command limit rows, so the totals are 1660 ore, 220 ice, 220 crystal again.

Effects in the sim, all integer:
- **Extraction** (rule 3): a node's accumulator adds `extractors × perExtractorPerMin × (100 + level × research.extract.stepPct)` per tick, and yields a unit each time it reaches `ticksPerMin × 100`. Asteroids, pockets and the captured heart; not probe mining.
- **Fast yards** (rule 5b): a start sets `ticksLeft = max(15, floor(ship.<type>.buildTicks × (100 − level × research.yards.stepPct) / 100))`.
- **Designs** (rule 5b): a lancer or flak yard can start only if its design level is 1. `setShipyard` stays always valid.
- **Opening ore and seed rigs:** applied at landing (above).
- **Probe core:** buying it sets `campaign.wonTick`. After that every input is invalid except `setTunable`; the client shows the win panel. There is no new game+ in H4.

Which items are which:
- **Meaty steps:** Lancer design, Flak design, The Deep (an area, not research, but the biggest step in play), and the probe core. Seed rigs is the most visible grind item: you see the network already running when you land.
- **The grind:** Opening ore, Extraction, Seed rigs and Fast yards, 10 levels in all, all aimed at the opening and the yard rate. Each is cheap in ore, so most overworld visits buy something.
- **Rhythm at defaults:** Landfall's haul (100 ore) buys one grind level (Opening ore 1) before the first real area. The first light area's haul buys its design. The second design comes after area 3 or 4. The core comes after area 5 or 6. No stretch of more than two areas without a meaty step.

**Why it isn't a fixed ladder.** Two ice-side and two crystal-side runs, for example:
- Landfall → Frost Shelf (Flak) → Spore Veil (flak-cheap) → The Deep → Glass Shoal or Thorn Garden (for crystal) → core.
- Landfall → Glass Shoal (Lancer) → Thorn Garden (lancer-cheap) → Spore Veil → The Deep → core.
- Landfall → Frost Shelf → Glass Shoal (both designs) → either medium → The Deep → core, skipping a medium.

The design you buy first changes which medium is cheap (bot flag 4 checks this), and which area you skip is your call.

#### Entities and state: changes

- **`world.campaign`** (new, plain JSON, hashed and saved):
  - `active`: index into `map.areas` of the area being played, or null on the overworld.
  - `areaStartTick`: tick of the current landing (area times are `tick − areaStartTick`).
  - `deepLayout`: the H3 layout index for The Deep (chosen at world creation as H3 chose `variant`).
  - `areas[]`, one per `map.areas` entry: `reclaimedTick` (or null), `entries`, `withdrawals`, `playTicks` (all visits), `reclaimPlayTicks` (the reclaiming visit), `shipsBuilt`, `shipsLost`.
  - `reclaimOrder`: area indices in reclaim order.
  - `research`: one level per `research` item id.
  - `researchLog`: `{item, level, tick}` per purchase (at most 13 entries).
  - `stockpile` and `shipAccum`: `{ore, ice, crystal}`.
  - `totals`: `hauled` and `shipped` per resource.
  - `wonTick`: null until the probe core.
- **The area state** is the existing world fields (`stock`, `nodes`, `routes`, `ships`, `guardians`, `yards`, `assemblers`, `queue`, `stats`, `capturedTick`, …). They hold the active area. With no area active they are empty (no nodes, ships or guardians) and area selectors aren't called. The core engineer chooses the exact shape; the constraints are one `World`, plain JSON, one hash, and as little churn as possible for the client and bots (keeping the existing top-level fields is preferred to nesting them).
- **`system`** keeps naming the H3 layout, now The Deep's.
- **`createWorld(seed, data)`** returns a campaign on the overworld with nothing reclaimed; Landfall is open.
- **Test and tool helper:** `campaignWorld(seed, data, {reclaimed, research, stockpile})` builds a campaign as if those areas were reclaimed and those levels bought, without playing. Tests, the bots (flag 4 and the interim gate) and the client's dev hooks use it. It isn't reachable from the game.

#### Player inputs: changes

| Input | Rule |
| --- | --- |
| `enterArea {area}` | `area` is an index into `map.areas`. Valid if no area is active, the game isn't won, and the area is open (held, and Landfall or lane-joined to a reclaimed area). Lands as above. |
| `leaveArea {}` | Valid if an area is active. Returns to the overworld; withdraws if the heart isn't captured. |
| `buyResearch {item}` | `item` is an index into `research`. Valid if no area is active, the game isn't won, the item is below its max level, its requirements hold, and the stockpile covers the next level's cost. Pays it and raises the level. |
| area inputs | `buildExtractor`, `buildRoute`, `upgradeRoute`, `cancelBuild`, `setRally`, `setShipyard`, `sendShips`: valid only while an area is active (and otherwise as H3). |
| `setTunable` | Always valid (as H3). |

#### Rules per tick: changes

- **No area active:** rule 1 (inputs) only, then `tick += 1`.
- **Area active:** H3 rules 1–9 and stats, with the research effects above, then **rule 10 (shipments)**.
- **Rule 8 (capture), heart:** also reclaims the area (above).
- **Effective caps** are unchanged (H3 `capEff`), applied to the area's counts.
- **Determinism:** fixed orders everywhere (areas, lanes and research in data order; resources ore, ice, crystal); no RNG; integer only.

#### Tunables (H4, data/sim.json, all integers)

New keys, plus one changed default. Per-area numbers (guards, haul, export) and research costs are data in `map.areas` and `research`, not tunables. `guard.capPct` stays the live knob for every area's strength at once.

| Key | Default | Range | Feels like (low / high) |
| --- | --- | --- | --- |
| `economy.startStock` | 40 | 0–200 | changed from 30, and now read at every landing (live, not new-run-only). 0: every opening is a slow trickle / 200: openings are skipped |
| `research.opening.step` | 40 | 10–150 | 10: unnoticed / 150: one level erases the opening |
| `research.extract.stepPct` | 25 | 10–50 | 10: unnoticed / 50: two levels trivialise ore |
| `research.yards.stepPct` | 20 | 10–40 | 10: unnoticed / 40: two levels make ships nearly instant |
| `research.costPct` | 100 | 25–100 | the session-length knob. 25: research is a formality / 100: the calibrated climb. The max is 100 so hauls always cover costs |
| `shipments.pct` | 100 | 0–300 | 0: no passive income, hauls only (the A/B if idling to farm becomes a thing) / 300: reclaimed areas pay for everything |

`system.variant` keeps its range and label, and now picks The Deep's layout.

#### Save, data version and replay

- **`dataVersion` 7** (6 when h4-sim shipped; bumped by h4-design-data because the calibration changed area defaults, and a v6 save or replay must not load silently against different numbers). An H3 save (v5), or an H4 save made on v6 data, fails the data-version check and is discarded with the existing toast ("Saved run was from an older version; starting fresh"). **No migration:** an H3 save is one field mid-game, and there's no honest way to map it onto a campaign. The owner loses one H3 run, which is a finished test.
- **The save** is the world snapshot with `campaign` added (about 1.7 KB more than an H3 save, measured in h4-sim; a test caps it at 2 KB) plus the client's input log, as now. `deserializeWorld` also checks the campaign's shape.
- **The log grows over a campaign.** In the h4-design-data bot report (`reports/archive/h4-design-data-v7.md`) a full run takes 45:47–50:47 game minutes for the researching strategies and up to 67:46 for no-research, about 82–122k ticks at 30 ticks per second. The client stores inputs only (a few thousand), so the save stays well under 1 MB. A feedback replay re-runs the whole campaign; that's a few seconds in the browser. If it gets slow, area-boundary checkpoints are a follow-up, not H4 scope.
- **The reference replay** is regenerated. It covers: landing in Landfall and reclaiming it; buying research (opening, extraction); landing in Frost Shelf; a withdraw; landing again (the opening includes the research); a pocket capture and a heart capture; leaving. It may use `setTunable` (for example `guard.capPct` 25) to stay short. The probe core and the win are covered by unit tests from `campaignWorld`. The determinism gate's run must land in an area (not idle on the overworld), and its hashes are re-baselined.

#### What changes for H3 content

- **Inside an area:** H3 unchanged, except for the research effects, the design gate on yards and the area's node subset.
- **The result panel** becomes the **area result panel**. It shows the area name and time, capture order, ships lost, guards withered, and "Hauled to the stockpile: +300 ore +60 ice +30 crystal". Its one primary button is "Back to the overworld". There's no New run here.
- **New run** becomes **New system** (in the menu, behind a confirm: "Start a new system? This erases your campaign"). It uses seed + 1, as before, which changes The Deep's layout.
- **Tuning panel:** the new keys. `economy.startStock` is labelled "applies at the next landing".
- **Bots:** the H3 strategies become the in-area engine of the campaign strategies (below).

#### Client: screens and phone UI

The H1–H3 rules hold: 375 px portrait, no hover, every target at least 44 px, every action at most 2 taps from its screen (confirms excepted).

**Overworld screen** (the first screen of a new game, and the root screen):
- **Map:** 6 area nodes and 7 lanes on the starfield, fitted like an area. Each area node shows tier (its size and spike count), state, the prize icon of its main haul (ore, ice or crystal; The Deep shows the probe core) and its name label. Reclaimed areas are amber with their export as a small label ("+5 ore +3 ice/min"). Lanes between two reclaimed areas pulse slowly toward Landfall (shipments flowing home).
- **HUD, top row:** stockpile chips (ore, ice, crystal; ice and crystal hidden until first non-zero), each with its shipments rate when non-zero ("+11/min while you play"); "Reclaimed 3/6"; a **Research** button (44 px); the menu (tuning, feedback, New system). No speed or pause buttons: the overworld is paused.
- **Area sheet** (tap an area):
  1. Name, tier ("Medium"), state ("Open", "Held: reclaim a neighbour first" or "Reclaimed in 8:12").
  2. Haul ("Reclaim to haul 300 ore · 60 ice · 30 crystal") and export ("then ships 5 ore · 3 ice per minute while you play elsewhere").
  3. Guarded nodes: one row each with the guard ring, prize and T/S counts ("Heart · 7 Thorn 25 Spore · Root-fed").
  4. Counter tags for the heart: Lancer and Flak, Strong/Even/Weak from the sim selector, with "(not researched)" on a design you lack. This is how research visibly changes which area looks cheap.
  5. The primary button: **Land** (open areas only).
- **First-run hint** (notices strip): "Your probe has arrived. Tap Landfall, then Land."
- **Return notices** (the notices strip, after leaving an area): "Shipped while you were in Spore Veil: +56 ore +12 ice" (only if non-zero); after a reclaim, "Thorn Garden reclaimed: +300 ore +30 ice +60 crystal. Opened: The Deep."

**Research sheet** (from the Research button; a bottom sheet over the overworld, scrollable):
- **The probe core card** at the top: drawn probe core, cost chips with a progress bar per resource toward its cost, and a requirements line ("Needs: Lancer design ✓, Flak design, The Deep reclaimed").
- **Design cards** (Lancer, Flak): larger cards with the ship silhouette in a blueprint frame, "Strong vs Thorns, Weak vs Spores", cost chips, and **Research** (44 px).
- **Grind rows** (Opening ore, Extraction, Seed rigs, Fast yards): icon, name, level pips ("2/3"), effect as now → next ("Opening ore 80 → 120 per landing"; "Extractors 10 → 12.5 ore/min"; "Ship build 4.0 s → 3.2 s"; "Land with A1 mined"), cost chips, **Buy**.
- A disabled button says why: "Needs 40 crystal" (the shortest missing resource), "Needs Extraction 1", "Needs The Deep reclaimed", or "Max".
- Buying shows the new level at once and a short notice ("Extraction 2: extractors now yield +50%").

**Inside an area:**
- **HUD:** an **Overworld** button (44 px, top left). In a held area it opens a confirm: "Withdraw from Frost Shelf? Everything built here is lost and the area resets. Research and the stockpile are kept." [Withdraw] [Stay]. In a reclaimed area it goes straight back.
- **The landing notice:** "Landed in Glass Shoal · 120 ore · A1 rig running · extraction +25%". It names every research effect in play, so the upgrade is noticed where the chore would be.
- **The probe sheet:**
  - a "Shipments" line ("+11 ore +2 ice/min to the stockpile"; "paused: area reclaimed");
  - the Yards rows gain two states: "Design not researched (Research, on the overworld)" and "No crystal here: no lens source in this area" (no pocket of that prize in the area). These come before the H3 "idle: needs lens";
  - a yard row is shown if its design is researched or its resource was delivered here.
- **The area result panel:** as above.

**Win panel** (after the probe core): "The new probe launches." Total play time (game time), the area order with each area's time, the research order, ships lost, and hauled vs shipped totals. One button: **New system** (with the same confirm).

**Phone portrait checks:** the overworld fits 375x667 with the research sheet closed. Area labels don't clip at the top or bottom edge, and nothing in either HUD wraps at 375 px under the wide-font stress.

#### Art needs (for Art Direction, within ART_STYLE.md)

- **Area node:** an asteroid cluster (3–5 rocks inside radius r). Tier shows as size, set by the caller (r), and as Bloom spikes on the rim while held: 0 for Landfall, 1 for light, 2 for medium, 3 for The Deep. States:
  - `locked`: dim, desaturated, spikes in mob pink at low alpha;
  - `open`: full colour, spikes in mob pink, a soft pulsing outline that invites a tap;
  - `reclaimed`: the rocks in player amber, no spikes, a steady amber rim.
- **Lane:** a line between two area nodes, trimmed to their rims by the caller. States:
  - `closed`: dim dotted;
  - `open`: dashed, mid-brightness;
  - `owned` (both ends reclaimed): solid amber with small pulses moving from (x1, y1) to (x2, y2). The caller orders the ends so pulses flow toward Landfall.
- **Research icons:**
  - `lancer` and `flak`: the ship silhouette inside a dashed blueprint square;
  - `opening`: an ore chip with a plus;
  - `extract`: a drill bit;
  - `rigs`: a small extractor on a rock;
  - `yards`: a chevron with speed lines;
  - `core`: the probe core.

  All of them must be told apart at 24 px.
- **Probe core:** a compact, glowing seed of the probe shape. `frac` 0–1 fills it from outline to complete, for the research card and the win panel.
- **Stockpile icon:** a crate or hold, used as the stockpile chip's prefix.

Every new colour goes in the palette with a role row in ART_STYLE.md: for example `laneOwned`, `laneOpen`, `laneClosed`, `areaLocked`. Player amber stays the player's. Everything stays within its contract bounds: the area node within r including spikes; the lane within 4 px of its segment.

Draw contract, so h4-client can call these before h4-art merges, with placeholders until then:
- `drawAreaNode(ctx, r, t, tier, state)`, with `tier` 0–3 and `state` `'locked' | 'open' | 'reclaimed'`;
- `drawLane(ctx, x1, y1, x2, y2, t, state)`, with `state` `'closed' | 'open' | 'owned'`;
- `drawResearchIcon(ctx, r, id)`, with `id` `'lancer' | 'flak' | 'opening' | 'extract' | 'rigs' | 'yards' | 'core'`;
- `drawProbeCore(ctx, r, t, frac)`;
- `drawStockpileIcon(ctx, r)`.

The client draws the prize icon in the area node's centre with the existing `drawResourceIcon` (The Deep: `drawProbeCore(ctx, r × 0.45, t, 0)`), and the label itself. Existing draw functions keep working.

#### Selectors (sim, read-only)

- `campaignStatus(world, data)`: the active area, stockpile, shipments per minute per resource (what the reclaimed areas would ship now), reclaimed count, won tick, research levels.
- `areaStatus(world, data, area)`: id, name, tier, position, state (`locked | open | reclaimed | active`), lanes, haul, export, guarded nodes (kind, prize, slots, capEff per type, starved caps), Root present, heart counter tags for lancer and flak (with a researched flag), and the visit record.
- `researchStatus(world, data)`: per item: kind, level and max, the next level's cost after `research.costPct`, affordable, missing (resources with shortfalls, item requirements, area requirements), and effect now and next as numbers the client formats.
- `landingEffects(world, data)`: opening ore, rig nodes, extraction %, yard time % (for the landing notice and the sheet).
- `yardStatus`: adds the states `needsDesign` and `noSource`, ahead of `needsComponent`.
- `campaignSummary(world, data)`: area order with play times, entries and withdrawals; research order with ticks; total play ticks; ships built and lost; hauled and shipped totals. The win panel and the bots use it.
- `runSummary`: area-relative times.

#### Bots: campaign strategies

A **campaign runner** plays a whole system from `createWorld(seed)`.
- **On the overworld,** the strategy buys research, then lands.
- **In an area,** the H3 engine plays: the economy plan on the area's asteroids, rally at a5 (present in every area), cheapest target by estimate, every researched yard on. When the heart falls, it leaves.
- **Caps:** an area visit is capped at 30 game minutes (then withdraw; a second timeout on the same area is a softlock), and the whole campaign at 120 game minutes of play.

Strategies:
- **`ice-line`:** Landfall, Frost Shelf, Spore Veil, The Deep, then the cheapest open area until the core is bought.
- **`crystal-line`:** Landfall, Glass Shoal, Thorn Garden, The Deep, then the cheapest open area until the core is bought.
- **`full-kit`:** Landfall, Frost Shelf, Glass Shoal, Spore Veil, Thorn Garden, The Deep.
- **`greedy`:** after Landfall, always the open area with the lowest estimate: the heart's `need` divided by the best per-ship power among drones and the researched designs (H3 estimate), lowest area index on ties. It stops as soon as the core is bought.
- **`no-research`:** greedy's area choice, but buys only the designs and the core.

Research policy (all except `no-research`): on every overworld visit, buy repeatedly the first affordable item in this list:
1. core;
2. lancer, then flak;
3. opening 1, extract 1, rigs 1, yards 1;
4. extract 2, opening 2, rigs 2, yards 2;
5. extract 3, opening 3.

Report, per strategy and seed:
- total play time to the core;
- the area order with each visit's time, entries and withdrawals;
- each area's **opening time** (ticks from landing until area ore/min reaches 40);
- the research order with times;
- ships lost;
- hauled vs shipped;
- tick p50/p95.

Plus a per-seed comparison table.

**H4 flags** (report lines, not merge gates):
1. **No softlock:** every strategy buys the probe core on every seed within 120 game minutes of play.
2. **Run length:** the best strategy's full run is 45–75 game minutes on every seed. Area times: Landfall ≤ 1 min, light 4–9, medium 6–13, The Deep 8–16 (report per area, mean over strategies).
3. **Two viable sides:** `ice-line` and `crystal-line` finish within 15% of each other on at least 2 of 3 seeds.
4. **The design decides the cheap medium:** with the same grind levels (opening 1, extraction 1), from `campaignWorld` with Landfall, Frost Shelf and Glass Shoal reclaimed, the greedy engine reclaims Spore Veil at least 20% faster with Flak only than with Lancer only, and Thorn Garden at least 20% faster with Lancer only than with Flak only. Seed 1; four probe runs.
5. **Research matters:** `no-research` takes at least 25% longer than the best strategy on every seed, and every researching strategy's opening time in its last area is at most 60% of its opening time in its first light area.
6. **Order varies:** at least two different area orders finish within 15% of the best full-run time on every seed.
7. Determinism and the reference replay pass.

Reported, not flagged: the shipped share (target 20–35%), and areas skipped per strategy. If the numbers miss, the engineers report them and do not retune; h4-design-data retunes.

**Interim bot gate (h4-sim, before h4-bots):** the runner starts from `campaignWorld` with every area but The Deep reclaimed and both designs bought, lands in The Deep, and runs the H3 strategies. That is an H3 game with a 40-ore opening, a regression check against the H3 numbers.

#### Success criteria (the owner, one 30–40 minute phone session; 4x is fine)

1. The owner reclaims at least 4 areas, counting Landfall.
2. At least once, they can name a reason for picking one area over another.
3. They can name one upgrade they noticed when landing in a later area.
4. They don't call a later area a chore or a repeat of the first.
5. They never have to ask why a yard is idle: the row says design or local component.
6. Every action is at most 2 taps from its screen (confirms excepted), and nothing in either HUD wraps at 375 px.

Reaching the probe core is a bonus in this session, not a criterion. A second session to finish tests the autosave across a campaign.

#### Fun questions for the handoff

1. Did getting stronger between areas feel good? Which upgrade did you notice when you landed in the next area?
2. After each area, was there more than one sensible next area? What decided it: a design you had, a prize, or the guard mix?
3. Did your third or fourth area feel like a fresh puzzle or a repeat of the first? Was there a moment that felt like a big step?

#### Calibration result (h4-design-data, data v7)

Sources:
- **Before:** `reports/archive/h4-bots-data-v6.md`, the h4-bots report on the data as first specced.
- **After:** `reports/archive/h4-design-data-v7.md`, the current data (v7).

Both are `npm run bots -- --seeds 3`. Seeds pick The Deep's layout: 1 Glass Thicket, 2 Twin Seams, 3 Frost Gate. Times are game minutes of play.

Only data in `map.areas` changed. Research costs, tunables and the sim are unchanged. `dataVersion` goes from 6 to 7: the save format is the same, but the area defaults changed, and the deployed build already serves v6 with the old values. Without the bump, a v6 save or feedback replay would load silently against different data. With it, an old save is discarded with the existing toast.

| Area | Change | Why |
| --- | --- | --- |
| Spore Veil | haul crystal 30 → 40 | lets the ice side afford the Lancer design (40 crystal) before The Deep (flags 3 and 6) |
| Thorn Garden | haul ice 30 → 40 | the same for the crystal side and the Flak design |
| Spore Veil | heart 3/30 (starved 1/15) → 1/50 (0/25); Root 0/12 → 0/16 | Flak vs Lancer gap (flag 4) and a longer medium (flag 2) |
| Thorn Garden | heart 17/9 (starved 9/4) → 24/13 (11/5); Root 7/0 → 9/0 | a longer medium (flag 2), keeping the Lancer lead |
| Frost Shelf | heart 2/10 → 2/12 | a slightly longer light area (flag 2), staying inside the 4–9 min band |
| Glass Shoal | heart 5/3 → 6/4 | the same |
| Landfall, Frost Shelf, Glass Shoal | haul ore 150 → 100, 130, 130 | slows the early grind purchases, which lengthens the first areas (flag 2) |
| The Deep | haul ore 650 → 720 | keeps total ore hauls (1680) above total research ore (1660) |

**Flags, per seed (before → after):**

| Flag | Seed 1 | Seed 2 | Seed 3 | Result |
| --- | --- | --- | --- | --- |
| 1. No softlock | 15/15 runs bought the core → 15/15 | | | met → met |
| 2. Best run 45–75 min | 37.0 → 47.6 | 36.2 → 45.9 | 35.9 → 45.8 | missed → met |
| 2. Mean area times in band | The Deep 17:19 (over 16:00) → 15:42 | | | missed → met |
| 3. ice-line vs crystal-line gap | 24% → 1% | 22% → 1% | 19% → 1% | missed → met |
| 4. Veil: Flak faster than Lancer by | 15% → 44% | (seed 1 only) | | missed → met |
| 4. Garden: Lancer faster than Flak by | 31% → 35% | | | met → met |
| 5. no-research slower than best by | +83% → +42% | +81% → +43% | +83% → +44% | met → met |
| 6. Orders within 15% of best | 1 → 4 | 1 → 4 | 1 → 4 | missed → met |
| 7. Determinism and replay | met → met | | | met → met |

Per-seed best runs (after): seed 1 ice-line 47:36, seed 2 ice-line 45:54, seed 3 ice-line 45:47. crystal-line is 34 s behind on each seed.

Mean area times (after):

| Area | Band | Mean |
| --- | --- | --- |
| Landfall | ≤ 1:00 | 0:11 |
| Frost Shelf | 4:00–9:00 | 8:08 |
| Glass Shoal | 4:00–9:00 | 7:41 |
| Spore Veil | 6:00–13:00 | 9:04 |
| Thorn Garden | 6:00–13:00 | 10:29 |
| The Deep | 8:00–16:00 | 15:42 (seed 1, Glass Thicket: 16:50) |

The shipped share is 25–29% for the researching strategies and 36–37% for no-research.

What the numbers say:
- **Flags 3 and 6 were one problem: the ice side met The Deep without Lancers.** Before the change, ice-line's Deep took 22:27–25:32 against crystal-line's 14:01–15:05. Ten more crystal in Spore Veil's haul lets ice-line buy the Lancer design after Spore Veil. Its Deep now takes 14:31–16:20, the same as crystal-line's.
- **Medium areas are mostly economy-bound for the bots.** The medium hearts grew by 42% to 55%: Thorn Garden's from 26 to 37 guards (+42%) and Spore Veil's from 33 to 51 (+55%). Yet the mean times moved only from 8:58 to 9:04 (Spore Veil) and from 9:57 to 10:29 (Thorn Garden), comparing the two reports. That fits the bots building their economy first and then attacking. Intermediate runs (not committed) pointed the same way: the smaller early ore hauls, which delay the early grind, carried most of the run-length gain.
- **Margins are thin.**
  - The best run clears 45 min by 0.9 min on seed 2 (45:54) and 0.8 min on seed 3 (45:47).
  - The Deep's mean (15:42) is inside 16:00, but Glass Thicket alone is 16:50. The Deep is the H3 layouts unchanged; making it shorter would mean retuning the H3 tables, which I left alone.
- **No bot skips an area now.** The bots buy both Fast yards levels (60 ice and 60 crystal) before the core, so they need all six hauls. Skipping is still possible for a player who skips Fast yards; it isn't exercised by any strategy.
- **The reference replay wasn't re-recorded.** Flag 7 and the determinism gate pass on the new data as is.

#### Out of scope for H4

- **B, supply lines:** lane capacity, choosing where an area's output goes, imports into the active area, held areas blocking lanes beyond adjacency.
- **Random or seeded overworlds** and area order shuffles. Only The Deep's layout varies, by seed, as in H3.
- **New game+**, probe design choices, a richer next system.
- **Warden, Lash, tier 2 resources and sap.**
- **Ships or stock crossing areas.** Re-entering a reclaimed area. Research bought mid-area.
- **The "overwhelm" valve** (auto-reclaim of easy areas). Add it only if play shows a chore.
- **Offline progress, research timers,** and an overworld Root.
- **Area-boundary save checkpoints** (only if replay length becomes a problem).
- **The H3 follow-ups** in BACKLOG "Can wait" (the time-to-clear tag formula, fleet-aware bot targets).

### H3 (Milestone 2, iteration 3, tested on build-20261108-2): Counter web

**Result (owner, 2026-11-08):** the core claim is supported. The guard mix per node made the next target a real choice ("the heart is spore-heavy so go win the easiest flak node"). Unlock-as-payoff and fixed sequence vs chosen path were not answered. In-area logistics "may be fine" simple. The owner proposed the overworld; see PLAYTEST_LOG.md and "Owner direction 2026-11-08: the overworld (steelman)".

The owner chose "Build Counter web" as H3 (QUESTIONS.md Q14). The direction and the M2 plan are under "Owner direction 2026-11-07: the asteroid field (steelman)" above. This spec replaces the H1 map and the H2 variants. H1 and H2 rules not mentioned here still apply.

#### Claim

When every pocket's prize is a new resource, and that resource unlocks a ship type that counters one kind of guard, **"which pocket next" is a real choice that changes from game to game.** The run stops being one fixed sequence ("max economy, then ships, then attack").

What would disprove it:
- The owner takes pockets in the same order every game without weighing them.
- The owner says counters "just mean bring the right ship".
- The owner masses drones and ignores components.

#### The smallest mechanics that test it

1. **A 16-node field.** The probe, 9 ore asteroids, 4 resource pockets (2 light, 2 heavy), the Root and the Bloom heart. Positions are fixed. Each of three hand-made **layouts** changes what is in each pocket (prize, guard mix, slots), the Root's guard mix and the heart's mix. The layout is chosen by seed, as in H2.
2. **Three resources:** ore (asteroids), ice and crystal (pockets only, after capture). The heart's prize is ore, as the H1 rich node.
3. **Two components, assembled automatically at the probe:**
   - **lens** = ore + crystal;
   - **plating** = ore + ice.
4. **Three ship types, each with its own yard switch at the probe:**
   - **drone**: ore only, neutral against both guards;
   - **lancer**: ore + 1 lens; strong against Thorns, weak against Spores;
   - **flak**: ore + 1 plating; strong against Spores, weak against Thorns.
5. **Two guard types:**
   - **Thorn**: the H1 thorn: armoured, slow to regrow, repairs;
   - **Spore**: fragile, hits lightly, regrows fast, never repairs.

   Every guarded node (pockets, Root, heart) has a mix of the two. All of them use the H1/H2 strip, regrow and capture rules, generalised to two types.
6. **Readouts for an informed estimate:**
   - a guard ring on each pocket, split by type;
   - strong/even/weak tags per ship type on the pocket's sheet;
   - the prize named on the sheet.

   Still no "ships needed" number.

H3 adds no new kind of input. `setShipyard` and `sendShips` gain a ship-type parameter.

#### Map: fixed positions (data `map.nodes`)

The frame is the same as H1 (x 0–1000, y 0–1300; `fit.ts` fits the bounds). Every node is at least 160 su from every other.

| id | kind | x | y | r | slots | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `probe` | probe | 500 | 1180 | 70 | 0 | |
| `a1` | asteroid | 300 | 1010 | 45 | 2 | |
| `a2` | asteroid | 700 | 1010 | 45 | 2 | |
| `a3` | asteroid | 120 | 850 | 40 | 1 | |
| `a4` | asteroid | 880 | 850 | 40 | 1 | |
| `a5` | asteroid | 500 | 650 | 55 | 3 | central staging rock, as in H1 |
| `a6` | asteroid | 170 | 640 | 45 | 2 | |
| `a7` | asteroid | 830 | 640 | 45 | 2 | |
| `a8` | asteroid | 100 | 250 | 40 | 1 | far corner |
| `a9` | asteroid | 900 | 250 | 40 | 1 | far corner |
| `p1` | pocket | 360 | 850 | 50 | layout | light pocket, near |
| `p2` | pocket | 640 | 850 | 50 | layout | light pocket, near |
| `p3` | pocket | 250 | 440 | 60 | layout | heavy pocket, far |
| `p4` | pocket | 750 | 440 | 60 | layout | heavy pocket, far |
| `root` | root | 500 | 450 | 45 | 0 | feeds the heart; no prize |
| `heart` | heart | 500 | 220 | 90 | 4 | the Bloom heart (H1's `rich`) |

There are 15 asteroid slots, 150 ore/min at full build: the same ore ceiling as H1. Routes still run only to the probe. A pocket's route carries its prize resource.

#### Layouts (data `map.layouts`; chosen like the H2 variants)

Guard counts are written `Thorns T / Spores S`. "Starved" is the heart's cap per type after the Root is cut. Slots apply to the pocket after capture. **Calibrated by h3-design-data (data v5); the pockets and fed hearts were recalibrated by h5-design-data (data v9, see H5 "Calibration result").** The wave columns are measured on the real sim: the minimum simultaneous wave of one type that wins, as drones / lancers / flak. The tag columns give the sheet's Strong/Even/Weak for lancer / flak at full caps (weighted multiplier in brackets).

**Layout 0: Frost Gate**

| Node | Prize | Slots | Guards (T/S) | Min wave d / l / f | Tags l / f |
| --- | --- | --- | --- | --- | --- |
| p1 | ice | 2 | 1 / 15 | 17 / 22 / 9 | Weak (56) / Strong (168) |
| p2 | crystal | 2 | 3 / 2 | 13 / 10 / 19 | Strong (170) / Weak (54) |
| p3 | ice | 3 | 13 / 6 | 34 / 20 / 44 | Strong (178) / Weak (46) |
| p4 | crystal | 3 | 3 / 26 | 28 / 31 / 22 | Weak (73) / Strong (151) |
| root | none | 0 | 0 / 25 | 18 / 27 / 8 | Weak / Strong |
| heart | ore | 4 | 17 / 21, starved 12 / 14 | 49 / 34 / 55 (v11); starved: not measured since H6 | Strong / Weak |

**Layout 1: Glass Thicket**

| Node | Prize | Slots | Guards (T/S) | Min wave d / l / f | Tags l / f |
| --- | --- | --- | --- | --- | --- |
| p1 | crystal | 2 | 1 / 15 | 17 / 22 / 9 | Weak / Strong |
| p2 | ice | 2 | 3 / 2 | 13 / 10 / 19 | Strong (170) / Weak (54) |
| p3 | ice | 3 | 3 / 26 | 28 / 31 / 22 | Weak / Strong |
| p4 | crystal | 3 | 13 / 6 | 34 / 20 / 44 | Strong / Weak |
| root | none | 0 | 12 / 0 | 27 / 11 / 39 | Strong / Weak |
| heart | ore | 4 | 19 / 11, starved 16 / 8 | 47 / 28 / 59 (v11); starved: not measured since H6 | Strong / Weak |

**Layout 2: Twin Seams**

| Node | Prize | Slots | Guards (T/S) | Min wave d / l / f | Tags l / f |
| --- | --- | --- | --- | --- | --- |
| p1 | ice | 2 | 0 / 8 | 9 / 15 / 3 (v11) | Weak / Strong |
| p2 | crystal | 2 | 3 / 3 | 15 / 12 / 20 (v11) | Strong / Weak |
| p3 | crystal | 3 | 3 / 26 | 28 / 31 / 22 | Weak / Strong |
| p4 | ice | 3 | 13 / 6 | 34 / 20 / 44 | Strong / Weak |
| root | none | 0 | 6 / 12 | 26 / 22 / 28 | Even (134) / Even (90) |
| heart | ore | 4 | 12 / 42, starved 8 / 21 | 52 / 47 / 47 (v11); starved: not measured since H6 | Even / Even |

**Tag accuracy at these numbers (data v9).** Say a type's tag is "right" when Strong means it needs at most 80% of the drones' wave, Weak means it needs more than the drones, and Even is anything in between. By that test (the shipped-data report in `packages/sim/test/min-waves.test.ts`, run on v9), 31 of the 36 tags at full caps are right, and 36 of 42 when the starved heart is included (v5: 33 of 36 and 38 of 42). The six misreads, all in Twin Seams:
- **p1 lancer and p1 flak:** they need 16 and 17 against the drones' 15 and read Even; by the test both should read Weak. h5-design-data shrank p1 and p2 from 4 / 10 to 2 / 6, so the first pocket falls to drones within the fleet limit, and drones are relatively stronger against small mixed nodes.
- **p2 lancer and p2 flak:** the same mix as p1, so the same numbers and the same misreads.
- **Root flak:** needs 28 against the drones' 26 (8% more) and reads Even; it should read Weak. Unchanged since v5.
- **Starved heart lancer:** needs 21 against the drones' 27 (78%) and reads Even; it should read Strong. Unchanged since v5.

Twin Seams reads Even/Even for both counters at its Root and at its heart, fed and starved, so there the tags give no guidance in the final fight. Whether that is intended for the symmetric layout is a Designer follow-up (Critic note).

*Updated 2026-11-08 by h6-design-data (data v11):* the three Deep hearts, and Twin Seams' p1 and p2, were retuned under the H6 combat amendment (guards strike the ship type they counter). The "(v11)" wave cells are from `reports/archive/h6-design-data-v11.md` (probe) and `reports/archive/h6-design-data-v11-tags.md`. Every other wave cell, and the Root and starved columns, predate the amendment. The Root is out of play since H6, so those are kept as the record, not re-measured. At v11 every pocket and heart tag in every area reads true by the rule above: 70 of 70 (`reports/archive/h6-design-data-v11-tags.md`). That includes the Twin Seams misreads described above, which p1 0 / 8 and p2 3 / 3 fix.

The H2-era mixes are kept in git history (data v4).

Why these layouts:
- **Every first move is a light pocket taken with drones**, about 13–14 of them. There are two doors, one per resource. *At data v9 (H5), in The Deep: the Thorn-mixed light pocket falls to 13 drones, the Spore-heavy one to 17, and each Twin Seams light pocket to 15 (`min-waves.test.ts` shipped report), so one of them always fits the fleet limit at Command limit 1 (18).*
- **Each heavy pocket wants one counter.** In each layout, one tier 1 resource gives a cheap path to the heavy pocket holding the *other* resource, or to more of the same. Which path is cheap flips between layouts.
- **Light pockets are not all the same.**
  - In Frost Gate and Glass Thicket, one light pocket is Spore-heavy (flak-friendly) and the other is Thorn-mixed. The resource behind each is swapped between the two layouts.
  - In Twin Seams the light pockets are identical, so the first pick there depends on where it leads.
- **Hearts are mixed in every layout**, so the cheapest finale uses both counters. Owning both resources is felt as about half the fleet.
- **The Root's mix flips** (Thorn, Spore, mixed), so the cheap cut depends on what you own.

Selection:
- If `system.variant > 0`, use layout `variant − 1`; otherwise use `((seed mod 3) + 3) mod 3`.
- New run uses `seed + 1`, as in H2.
- Each layout has `id` and `name` (`frost`/"Frost Gate", `glass`/"Glass Thicket", `twin`/"Twin Seams") and, per pocket node, `{prize, slots, thorns, spores}`. The Root has `{thorns, spores}`, and the heart `{thorns, spores, starvedThorns, starvedSpores}`.

#### Entities and state: changes

- **Stock:** `stock` becomes `{ore, ice, crystal, lens, plating}`. Every field is an integer, kept at the probe. `probeAccum` still adds ore only.
- **Node:**
  - `kind` gains `pocket` and `heart` (`rich` is gone);
  - pockets carry `prize` (`ice | crystal`) from the layout;
  - the node's `buffer` holds its prize resource (asteroids: ore; heart: ore).
- **Pod:** gains `res` (`ore | ice | crystal`), copied from the source node. On delivery it adds to `stock[res]`.
- **Assemblers:** `assemblers: {lens: {ticksLeft}, plating: {ticksLeft}}`, at the probe. There is no input: they always run (see rules).
- **Yards:** `yards: {drone: {on, ticksLeft}, lancer: {on, ticksLeft}, flak: {on, ticksLeft}}`. They replace `shipyard`. `yardTurn` (0 or 1) says whether lancer or flak is tried first for the next start (rule 5b).
- **Ship:** gains `type` (`drone | lancer | flak`). The hp comes from its type.
- **Guardian:** one per guarded node (`p1`–`p4`, `root`, `heart`) in node-index order.
  - `thorns[]` becomes `guards[]` (`{id, type: thorn | spore, hp}`, ascending id).
  - `regrowProgress` becomes `{thorn, spore}`.
  - The heart's guardian has `fed` (true until the Root is cut).
- **Stats:**
  - `captures[]` (`{node, tick}` in capture order). The heart's capture still sets `capturedTick`;
  - `shipsBuilt` and `shipsLost` per type;
  - `delivered` per resource;
  - `guardsKilled` per type;
  - `guardsWithered` (renamed from `thornsWithered`);
  - `rootCutTick` and `variant` stay (`variant` is the layout index).

#### Rules per tick: changes from H1/H2

The rule numbers are H1's. Anything not listed is unchanged.

- **Effective caps.** `capEff(n) = min(60, floor(n × guard.capPct / 100))`, applied to every layout guard count, starved caps included. A guarded node whose effective caps are all 0 has no guards. The first ship to arrive takes it (rule 8).
- **2. Construction.** As H1, paid from `stock.ore`. `buildExtractor` is valid on asteroids, on captured pockets and on the captured heart.
- **3. Extraction.**
  - asteroids: `extractor.orePerMin` ore;
  - captured pockets: `pocket.resourcePerMin` of their prize;
  - captured heart: `heart.orePerMin` ore.

  The accumulator rule is unchanged.
- **4. Routes.** As H1. A pod carries `res` from its source and delivers to `stock[res]`. `deliveredBuckets` (the big ore/min number) counts **ore only**. Ice and crystal have their own per-minute buckets, shown small.
- **5a. Assemblers (new, before yards).** For each component, in the fixed order lens, then plating:
  - If `ticksLeft > 0`, decrement it. At 0, `stock[component] += 1`.
  - Then, if it is idle (`ticksLeft = 0` after any completion) and all of the following hold, pay both costs and set `ticksLeft = component.buildTicks`:
    - `stock[component] < component.stockCap`;
    - `stock.ore − reservedOre ≥ component.<c>.ore`, where `reservedOre = Σ queue[].cost`;
    - `stock[res] ≥ component.<c>.<res>`.
- **5b. Yards (replaces rule 5; starts round-robin since h3-design-data).**
  - **Finish.** For each type, in the fixed order lancer, flak, drone: if `ticksLeft > 0`, decrement it. At 0, spawn a ship of that type at `probe` with `ship.<type>.hp`. If `rally ≠ probe`, it starts transit to `rally`.
  - **Start.** A yard *can start* if it is on and idle, `stock.ore − reservedOre ≥ ship.<type>.cost` and (for lancer and flak) `stock[component] ≥ 1`. Starting pays both and sets `ticksLeft = ship.<type>.buildTicks`. Yards are tried in this order:
    1. lancer and flak, **round-robin**: starting with the one `yardTurn` names (0 lancer, 1 flak), then the other. Whenever one of them starts, `yardTurn` passes to the other. So the component yard that started least recently goes first, and a yard that can't start (no component, off, or no ore) keeps its turn until it does;
    2. then drone. A drone start never changes `yardTurn`.

  `yardTurn` is world state (an integer, 0 at the start, saved and hashed). Queued builds still reserve their ore ahead of assemblers and yards. Lancers and flak still go before drones, so a scarce component is never starved by drones. With ore for one ship at a time, lancer and flak now alternate, where the old fixed order gave every ship to the lancer yard and starved flak.
- **7. Combat** (per living guardian, on round ticks, ships `at` its node, resolved together from start-of-round state):
  - **Player damage.**
    - For each ship type present, in the order lancer, flak, drone, pool `base = count × ship.<type>.damage`.
    - Then walk that type's **target order**:
      - lancer: Thorns, then Spores;
      - flak: Spores, then Thorns;
      - drone: all guards in id order, with no type preference. For drones, `pct = 100` throughout, so convert per guard.
    - For each guard type group in that order, with `pct = mult(type, guardType)`:
      1. `eff = floor(base × pct / 100)`.
      2. Apply `eff` to the living guards of that type in id order, overflowing from one guard to the next (as H1).
      3. If guards of that type remain, `base = 0`. Otherwise `base = floor(effLeft × 100 / pct)`, and continue to the next group.
    - `mult` is `counter.strongPct` for (lancer, thorn) and (flak, spore), `counter.weakPct` for (lancer, spore) and (flak, thorn), and 100 for drones.
    - Damage from earlier types is already applied when later types act. Guards at hp ≤ 0 still count for the guard damage step (simultaneous rounds).
  - **Guard damage:** `Σ guard.<type>.damage` over the guards alive at the start of the round, applied to ships present in id order with overflow (as H1).
    *Superseded 2026-11-08 by H6 "Combat amendment: guards strike the ship type they counter": thorns strike flak, then drones, then lancers; spores strike lancers, then drones, then flak. Id order made the outcome depend on which yard finished first.*
  - Remove the dead on both sides. Then, on every round tick, each surviving guard heals its `repairPerRound` (`guard.thorn.repairPerRound` or `guard.spore.repairPerRound`; 0 for the starved heart) up to its type's hp.
- **8. Capture** (any guardian): it is alive, has no guards and at least one ship is `at` its node. Then:
  - `alive = false`, `owned = true`, and the battle ends `captured`. Push `{node, tick}` to `stats.captures`.
  - **Pocket:** `extractors = min(pocket.freeExtractors, slots)`. Its prize starts flowing once it has a route.
  - **Root:** `rootCutTick = tick`. If the heart is alive, it wilts: `fed = false`. Then, for each type, while its count is above `capEff(starved<Type>)`, remove the highest-id guard of that type and add 1 to `guardsWithered`. Reset both of the heart's regrow progresses to 0.
  - **Heart:** `extractors = min(heart.freeExtractors, slots)` and `capturedTick = tick`. This shows the result panel; free play continues.
- **9. Regrowth.** For each living guardian, each type is handled separately:
  - The cap is `capEff(layout count)`; for the heart while starved, `capEff(starved count)`.
  - The period is `guard.<type>.regrowTicks`, multiplied by `bloom.starvedRegrowMul` for the starved heart.
  - Below the cap, progress goes up by 1, and at the period a full-hp guard of that type is added with a new id from `nextId`. At or above the cap, progress is held at 0.
  - Guardians start full.
- **Determinism.** Everything stays integer, the type orders are fixed, and there is no RNG.

#### Player inputs: changes

| Input | Change |
| --- | --- |
| `setShipyard` | Becomes `setShipyard {shipType, on}`. Always valid. A ship already in progress finishes. |
| `sendShips` | Becomes `sendShips {from, to, counts: {drone, lancer, flak}}`. Each count is an integer ≥ 0 and is clamped to the ships of that type `at` `from`. It is valid if `from ≠ to` and the clamped total is ≥ 1. The lowest-id ships of each type go. It's an attack (counted in `wavesSent`) if `to` is a living guarded node. One attack per node per tick, as in H2. |
| `buildExtractor`, `buildRoute`, `upgradeRoute` | Also valid on captured pockets (and the heart, as H1's rich node). |
| `setTunable` | Accepts the new keys below. `system.variant` is `newRunOnly`. |

Assemblers need no input.

#### Tunables (data/, all integers)

New or renamed keys. H1 economy, route and build keys are unchanged.

| Key | Default | Range | Feels like (low / high) |
| --- | --- | --- | --- |
| `ship.drone.cost` | 18 | 5–60 | from `ship.cost` |
| `ship.drone.buildTicks` | 90 | 15–900 | from `ship.buildTicks` |
| `ship.drone.hp` | 10 | 1–100 | |
| `ship.drone.damage` | 2 | 1–20 | 1: drones are fodder / 4: counters don't matter |
| `ship.lancer.cost` | 18 | 5–60 | ore part; plus 1 lens |
| `ship.lancer.buildTicks` | 120 | 15–900 | |
| `ship.lancer.hp` | 12 | 1–100 | |
| `ship.lancer.damage` | 4 | 1–20 | |
| `ship.flak.cost` | 18 | 5–60 | ore part; plus 1 plating |
| `ship.flak.buildTicks` | 120 | 15–900 | |
| `ship.flak.hp` | 12 | 1–100 | |
| `ship.flak.damage` | 4 | 1–20 | |
| `counter.strongPct` | 200 | 100–400 | 100: no edge from the right ship / 400: one right ship equals four drones |
| `counter.weakPct` | 25 | 10–100 | 10: the wrong ship is useless / 100: no penalty, so lancers are simply better drones (counters vanish) |
| `guard.thorn.hp` | 20 | 1–200 | from `guardian.thornHp` |
| `guard.thorn.damage` | 3 | 0–30 | from `guardian.thornDamage` |
| `guard.thorn.repairPerRound` | 2 | 0–20 | from `guardian.repairPerRound` |
| `guard.thorn.regrowTicks` | 60 | 15–1800 | from `guardian.regrowTicks` |
| `guard.spore.hp` | 6 | 1–100 | 2: spores pop / 20: spores are Thorns that regrow fast |
| `guard.spore.damage` | 1 | 0–30 | |
| `guard.spore.repairPerRound` | 0 | 0–20 | 0: the swarm is replaced, not healed |
| `guard.spore.regrowTicks` | 20 | 5–1800 | 5: Spore pockets need a real counter / 300: Spores are a speed bump |
| `guard.capPct` | 100 | 25–300 | the live knob for overall guard strength (replaces `root.capBonus`). 25: everything is soft / 300: everything is a fortress |
| `bloom.starvedRegrowMul` | 5 | 1–30 | replaces `bloom.starvedRegrowTicks`. 1: cutting the Root only drops caps / 30: a starved heart barely regrows |
| `bloom.starvedRepairPerRound` | 0 | 0–20 | unchanged |
| `pocket.resourcePerMin` | 12 | 1–40 | per extractor. 2: a prize trickles, components throttle everything / 20: one pocket floods you |
| `pocket.freeExtractors` | 1 | 0–3 | 0: the prize waits for a build / 3: an instant payoff |
| `heart.orePerMin` | 25 | 10–80 | from `rich.orePerMin` |
| `heart.freeExtractors` | 1 | 0–4 | from `rich.freeExtractors` |
| `component.lens.ore` | 5 | 0–60 | |
| `component.lens.crystal` | 4 | 1–40 | 1: crystal is never the limit / 12: lancers are rare and precious |
| `component.plating.ore` | 5 | 0–60 | |
| `component.plating.ice` | 4 | 1–40 | as lens |
| `component.buildTicks` | 90 | 15–900 | |
| `component.stockCap` | 5 | 1–50 | 1: just-in-time / 50: components pile up and hide the throttle |
| `system.variant` | 0 | 0–3 | 0: by seed / 1–3: force Frost Gate, Glass Thicket or Twin Seams (new run only) |

- **Removed:** `ship.cost`, `ship.buildTicks`, `ship.hp`, `ship.damage`, every `guardian.*`, `root.capBonus`, `root.regrowTicks`, `bloom.starvedCap`, `bloom.starvedRegrowTicks`, and `rich.*`.
- **Kept:** `ship.speedSu` (shared by all types) and `combat.roundTicks`.
- **Map data:** `map.variants` is replaced by `map.layouts`.

**Calibration** (throwaway model at these defaults; the layout tables show the minimum waves). The headline:
- The right counter needs about half the ships of drones.
- The wrong counter needs more than drones.
- A two-type mix beats any single type on every mixed pocket.
- Each light pocket falls to about 13–14 drones.
- A starved heart needs about half the fleet of a fed one.

#### Save, data version and replay

- **`dataVersion` 4.** An H2 save fails the data-version check and is discarded with the existing toast ("Saved run was from an older version; starting fresh"). There is no migration.
- **The save format** is the world snapshot, as now, with the new fields.
- **The reference replay** in `packages/bots` is regenerated for the new inputs. The determinism gate's hashes are re-baselined in the same task.

#### What changes for H1/H2 content

- **Map:** the H1 map and the H2 variants are replaced by the 16-node field and three layouts. The node ids `a1`–`a5` are reused at new positions. `rich` becomes `heart`.
- **Asteroids, extractors, routes, upgrades and the build queue:** unchanged.
- **The Bloom heart:** H1's rich node, now with a Thorn/Spore mix. It is still fed by the Root, and capturing it still ends the run.
- **The Root:** the same feeding, cutting and wilt rules, with a guard mix per layout, and the vine is unchanged. The wilt removes guards of both types down to the starved caps. It still has no prize.
- **Shipyard:** the one toggle becomes three yard toggles, and drone is on at the start. As in H1, the shipyard starts on, because the first ship early matters.
- **Result panel:**
  - the layout name and the time to capture the heart;
  - **capture order**, for example "Ice (P1) 4:10 → Crystal (P4) 11:30 → Root 15:02 → Heart 19:45";
  - ships lost per type, guards withered, and the Root cut time.
- **New run:** seed + 1, which cycles the layouts.
- **Tuning panel:** the keys above; removed keys disappear. `system.variant` is labelled "0 · by seed / 1 Frost / 2 Glass / 3 Twin".
- **Bots:** rush, turtle and raid-supply are replaced (see Bot checks).

#### Observable values and phone UI

The rules from H1 and H2 hold: 375 px portrait, no hover, every target at least 44 px, and every action at most 2 taps from the map (confirm taps excepted).

- **HUD:**
  - **Top row:** ore/min stays the big number.
  - **Second row:** small icon+count chips for `ore`, `ice`, `crystal`, `lens` and `plating`, with ice/min and crystal/min under their chips once they are non-zero.
  - **Ship count chips:** drone, lancer and flak (ships anywhere).
  - Chips for resources not yet owned are hidden, not greyed, so the HUD starts as simple as H2.
- **Map:**
  - **Pockets:** a living pocket is a small Bloom growth on a rock, with its **prize icon** in the centre and a **guard ring**: a ring around it split into two arcs, Thorn colour and Spore colour, proportional to current counts. The ring shrinks as guards die and grows back as they regrow. It reads at 24 px.
  - **Captured pockets** become rock with the prize icon and extractor pips, like asteroids.
  - **The Root and the heart** get the same guard ring. Individual guards are drawn as now (Thorns are spiky; Spores are small round puffs).
  - **Ships:** three silhouettes (see Art).
- **Pocket, Root and heart sheets:**
  1. **Prize:** "Prize: Ice · 2 slots · 6/min each · unlocks Plating → Flak". The Root says "No prize · feeds the Heart", and the heart says "Ore · 4 slots".
  2. **Guards:** one row per type: icon, count/cap, regrow (as "1 / 2.0 s"), hp and damage.
  3. **Your ships here:** one tag per ship type you have unlocked: **Strong** (green check), **Even** or **Weak** (red cross). Each tag has its counter phrase: "Lancer · Strong vs Thorns, Weak vs Spores".
     - The tag is the guard-hp-weighted multiplier: Σ over types of `count × hp × mult` / Σ `count × hp`. It is Strong at ≥ 150, Weak at ≤ 75, and Even otherwise. Drones are always Even.
     - It is computed in the sim's selectors so that the client and the bots agree. It is integer, with the division last.
  4. **Ships present and en route**, by type.
  5. **Attack:**
     - The H2 target-first buttons stay: "Attack with all from Probe · 14", sending every type. That is one tap.
     - Each source also has a **"Choose…"** button. It opens a send panel with one row per type: icon, a −/+ stepper (44 px buttons), the count and "All". It defaults to all of each type. Then Send.
- **The probe sheet:**
  - The **Yards** block has three rows (Drone, Lancer, Flak). Each row has an on/off toggle (44 px), a cost line ("15 ore + 1 lens · 4.0 s") and a status: "building", "idle: needs lens" or "idle: needs ore".
  - The **Assembly** block has two rows (Lens, Plating), each with stock/cap, recipe, and a status: "making", "full" or "needs crystal".
  - The Lancer and Flak rows are hidden until their resource has first been delivered. The sheet still names them: "Take a crystal pocket to unlock Lancers".
- **The battle banner:** per node, with type counts: "P3 · 6 Thorn 2 Spore · strip 1.3/s · 4 lost".
- **Toasts:**
  - Capture: "Ice pocket taken: 12 sent, 3 lost. Plating and Flak unlocked." (the second sentence only on the first unlock).
  - Repelled: "P4 held: 10 sent, 10 lost. Mostly Spores; Lancers are weak here." This hint names the dominant guard type and any Weak tag among the ships sent.

#### Flavor and art needs (for Art Direction, within ART_STYLE.md)

- **Drone:** the existing blue arrowhead, slightly smaller.
- **Lancer:** a long, narrow needle or spear, player blue `#7ab8ff`, with one bright tip.
- **Flak:** a short, wide hull with a ring or burst motif, player blue.

  The three must be told apart **by shape** at 24 px, not by colour alone.
- **Spore:** a small round puff with a dotted halo, in the mob family but distinct from Thorns. Thorns are spikes; Spores are round. It needs its own palette entry (a mob-family hue clearly different from Thorn `#ff5d73`, at 4.5:1 or better on space). It must not be amber (reserved for the player), teal (ore) or player blue.
- **Guard ring:** two arcs, Thorn colour and Spore colour, around guarded nodes, within radius r plus the existing ring margin, readable at 24 px.
- **Pocket:** a rock with a small Bloom growth, smaller than the heart and not round coral. Its prize icon sits in the centre.
- **Resource icons:** ore (existing teal), **ice** (pale cyan-white, a hex flake) and **crystal** (light violet, a faceted shard). They are cool-family, distinct from each other and from mob pinks.
- **Component icons:** **lens** (a ring with a dot) and **plating** (a stacked plate).

Draw contract, so h3-client can call these before h3-art merges, with placeholders until then:
- `drawShip(ctx, r, heading, type)`, where `heading` is the ship's heading in radians (not the clock), as the existing caller passes it;
- `drawSpore(ctx, r, t, hpFrac)`;
- `drawGuardRing(ctx, r, thornShare, sporeShare, t)`;
- `drawPocket(ctx, r, t, alive, prize)`;
- `drawResourceIcon(ctx, r, kind)`, with kind `ore | ice | crystal | lens | plating`.

#### Bot checks: no single order dominates

Strategies (replacing rush, turtle and raid-supply):
- **`drones-only`:** the H1 turtle economy plan, then only the drone yard. It takes guarded nodes cheapest-first by estimate, the Root before the heart.
- **`ice-first`:** the economy plan, then it takes the light **ice** pocket with drones. It builds its extractors and route, turns on flak, and turns on lancer when crystal arrives. After that it is greedy (below).
- **`crystal-first`:** the same, with the light crystal pocket first.
- **`greedy`:** the economy plan, then always the cheapest next target by estimate, using whatever is unlocked.

Shared bot rules:
- **Staging:** rally at `a5`.
- **After a capture:** build the pocket's extractors up to its slots, a route, and up to 2 route upgrades.
- **Next target (greedy part):** the living guarded node with the lowest `estimate / prizeWeight`.
  - `prizeWeight`: heavy pockets 3, light 2, Root 2, heart 1. The heart goes last unless it is the only one left.
  - Estimate: `need = Σ capEff × hp` over guard types. A fleet's per-round power is `Σ n_t × damage_t × tag_t / 100`, where `tag_t` is the weighted multiplier from the sheet tag.
  - Attack with everything at `a5` when `power × 3 ≥ need + 20`.
  - If repelled, multiply the threshold by 5/4 and wait.
- **Yards:** all unlocked yards stay on.

Report, per strategy and layout:
- the heart capture time;
- the capture order with times;
- ships lost by type;
- waves sent and repelled;
- the time each resource was first delivered.

Plus a per-layout comparison table.

**H3 depth flags** (report lines, not merge gates):
1. Every strategy captures the heart in every layout within 15–45 game minutes. Nothing softlocks.
2. **Counters matter:** in every layout, `drones-only` loses at least 40% more ships than the best strategy, or captures at least 20% later.
3. **Two viable first doors:** in at least 2 of the 3 layouts, `ice-first` and `crystal-first` capture the heart within 15% of each other.
4. **No fixed best opening:** across the three layouts, the faster of `ice-first` and `crystal-first` is not the same in all three.
5. **Order varies:** `greedy`'s capture order is different in each layout.
6. Determinism and the reference replay pass.

If the numbers miss these, the engineers report them and do not retune. h3-design-data retunes the layouts and defaults.

#### Success criteria (the owner, one 30–40 minute phone session; 4x is fine)

1. The owner takes at least three guarded nodes in game 1.
2. Before their second pocket, they can name two sensible next targets and why they picked one.
3. They open at least one pocket sheet and use the Strong/Weak tags or the ring to choose ships, and can say so.
4. If they start a second game (a different layout), their first or second pick differs, or they can say why it shouldn't.
5. They do not describe the run as "build economy, then ships, then attack".
6. Every action is at most 2 taps from the map (confirms and the Choose… panel excepted). Nothing in the HUD wraps at 375 px.

#### Fun questions for the handoff

1. After your first pocket, did you have more than one sensible next target? What decided it?
2. Did the ring and the Strong/Weak tags tell you which ships to bring? Did you ever send the wrong ships, and did it sting?
3. Did unlocking a new ship type feel like a payoff? Did the game feel like one fixed sequence, or like a path you chose?

#### Calibration result (h3-design-data, data v5)

*Note 2026-11-08 (h6-combat-target):* every bot time and flag below was measured under H3's original guard-damage rule (all guard damage on the ships present in id order). H6's "Combat amendment" replaced it, so these are a record of what H3 measured, not what the current rule gives.

The changes from v4:
- every layout guard count is about x2.1;
- p1 in Frost Gate and Glass Thicket is more Spore-heavy;
- Frost Gate's heart is a little more Thorn-heavy;
- Glass Thicket's p2 has one more Thorn;
- the Root mixes of Frost Gate (now all Spore) and Glass Thicket (now all Thorn) are swapped;
- `ship.*.cost` goes from 15 to 18, and `pocket.resourcePerMin` from 6 to 12.

`guard.capPct` stays at 100, so it's still a neutral live knob. `counter.*` is unchanged.

Bot suite, `--seeds 3`, data v5 with the round-robin yards (current; `reports/bots-latest.md`), heart capture in game time (m:ss):

| Layout | drones-only | ice-first | crystal-first | greedy |
| --- | --- | --- | --- | --- |
| Frost Gate | 25:17 | 20:40 | 20:27 | 19:33 |
| Glass Thicket | 27:51 | 21:58 | 21:45 | 21:45 |
| Twin Seams | 25:27 | 19:42 | 19:16 | 19:42 |

Before round-robin (fixed yard order, same v5 data) ice-first / crystal-first were 18:54 / 21:08, 18:24 / 20:31 and 20:12 / 22:12; drones-only is unchanged.

| Flag | v4 | v5, before round-robin | v5, current (round-robin yards) |
| --- | --- | --- | --- |
| 1. All capture within 15-45 min | **missed** (12.0-15.7) | met (18:24-27:51) | met (19:16-27:51) |
| 2. Counters matter | met on time only (20-31% later) | met on time only (26-52% later) | met on time only (drones-only 28-32% later than the best); the "40% more losses" half still fails (52/57/51 lost against 42/47/38) |
| 3. Two viable doors | met (gaps 0-5%) | met (gaps 10-12%) | met in 3 of 3 (gaps 1-2%) |
| 4. No fixed best opening | met on knife edges (3 s, 17 s, 33 s gaps) | **missed**: ice-first faster everywhere by about 2 min | **missed**: crystal-first faster in all three layouts, by 13-26 s |
| 5. Order varies | met | met | met |
| 6. Determinism | met | met | met |

Answers to the open questions:
1. **Pacing.**
   - **Bots:** the first pocket falls at 10-11 min, because the bots finish their economy plan first. The heart falls at 19-22 min with counters and 25-28 min with drones only.
   - **Players:** they take decisions and attack late, so a session should land at about 25-35 min, inside the spec's 20-35 target.
   - **Why I didn't go slower:** drones-only would cross the bot suite's 30-minute tick cap and show as "never captured".
2. **Prize throughput.** At 6/min, the counter strategies built only about 10-15 component ships, so counters barely showed. At 12/min per extractor, a light pocket gives about 6 components/min. Components are visibly the main fleet. With the fixed yard order the counter fleets were lancer-heavy (see 3a). Since the round-robin yards, both types appear in every counter game: lancers / flak lost by heart capture are 5/6, 4/7 and 2/9 for ice-first and 9/6, 6/4 and 10/1 for crystal-first (before: 12/1, 23/3, 3/8 and 21/0, 34/0, 27/0). Each door still leans towards its own counter.
3. **Door balance.** Flag 3 holds. Flag 4 can't be held robustly with data, for two structural reasons:
   - **(a) Yard order (fixed since; see "Sim fix done" below).** Yards were served lancer, then flak, then drone (rule 5b as first written), so when ore is short, lancers take it all and flak is starved. Every counter strategy ends up lancer-heavy. A mixed heart then punishes the crystal-first path, which never gets flak going.
   - **(b) Bot target choice.** The bots pick targets by `need / prizeWeight` and ignore their own fleet's counters, so the order doesn't react to which door was taken.

   Every data lever I tried (Root swaps, light-pocket mixes, lens cost, Thorn repair, Spore regrowth) moved flag 4 by seconds, not structurally. Proposed sim fix: serve idle yards **round-robin** (the yard that started a ship least recently goes first), not in fixed order. Proposed bot fix: choose targets by the estimated fleet needed *with the current types*.

   **Sim fix done (h3-design-data, engineering):** rule 5b now serves lancer and flak round-robin. On the same v5 data, ice-first's lead of about 2 min is gone: the two doors finish within 13-26 s of each other in every layout (flag 3 gaps 1-2%), with crystal-first a hair faster in all three, so flag 4 is still missed, now on a knife edge. The bot fix is not done. Numbers are in DECISIONS.md.
4. **Drones as the fallback.** They finish every layout, 28-32% slower than the best strategy (26-52% before the round-robin yards). They lose about as many ships as the counter strategies, because the bots misuse counters too (all-in waves include lancers sent against Spores). `ship.drone.damage` stays at 2.
5. **Spore regrowth at 20 ticks.** Fine. No repelled-trickle problems, and no wave was repelled except one bot misread.
6. **Combat order.** The lancer-first combat order isn't the issue. The yard order (3a) is.
7. **The bot estimator.** Unchanged. It is good enough, with zero or one repel per game.

**The Strong/Even/Weak tag.** The Critic's two misreads came from mixes sitting on the 150/75 thresholds. They are fixed by the mixes above, not by changing the formula. The hp-weighted formula is still fragile: it ignores how fast Spores regrow, and new mixes near 150 or 75 can misread again. A sturdier formula (time-to-clear: sum of hp / sum of (hp / mult), compared against drones) would need sim code. It is suggested as a follow-up, and isn't needed for this build.

#### Out of scope for H3

Each is a later M2 hypothesis:
- factories outside the probe, max route length, relays and shared capacity (H4);
- the big field, zoom, scouting and multi-session play (H5);
- the third ship and guard type (Warden and Lash), tier 2 resources and sap (H4 or H5);
- the new probe and new game+ (H6);
- route blocking by living pockets (H4).

### H3 candidates (iteration 3): superseded

**Superseded (2026-11-07).** The owner didn't pick A, B or C and asked for a bigger direction instead. See "Owner direction 2026-11-07: the asteroid field (steelman)" above. A survives as "most of the field is guarded", B as "a prize is a new resource", and C as seeded fields in H5.

The H2 playtest (PLAYTEST_LOG.md, 2026-11-07) gave three signals. Cutting the Root first felt obvious. Both runs followed the same sequence: max economy, then ships, then attack. Cutting the Root was satisfying. These are the two mechanical causes, and each candidate below attacks one or both:
- **(a) Fixed sequence.** The economy is a closed, unguarded build-out, and fighting pays nothing until the final prize. So "economy first, fight last" is always right, whatever the guardians look like.
- **(b) Time-only trade-offs.** Every cost in H2 was time (ships are ore, ore is minutes). A 50 s gap in a 10-minute run with no clock is invisible, so close choices read as obvious.

All three keep the pillars: no fail state, no clock, defend-only guardians, and orders at nodes with no new kind of input. Only one will be specced, after the owner picks (QUESTIONS.md Q13).

#### H3-A: Fight to grow (recommended)

- **Claim:** when most of the economy sits behind small guards, fighting and building interleave from the first minutes. The order in which you take rocks then becomes the puzzle, and the run stops being "max economy, then attack". Cutting a Root that feeds several guards turns the satisfying moment into one that happens more than once and pays off in ore/min.
- **Attacks:** (a) directly, since you can't max the economy without fighting. Also (b), partly: each choice shows up as ore/min climbing sooner or later, and that compounds where the player can see it.
- **Smallest build:** the H2 map and rules. Two asteroids start free. The other three are **overgrown**, each with its own small guard (thorn counts such as 3 / 6 / 10). Reward does not track guard size: one is poor but close and lightly guarded, another is rich but far and heavily guarded. The Root feeds one overgrown rock as well as the Bloom, so one cut weakens two things. Guards reuse the H2 guardian, wilt and capture rules. No new inputs. The three Root variants become three layouts of the same pieces.
- **Risk:** it collapses into "take the smallest guard first", a new obvious ladder. The bot check: a greedy-cheapest, a greedy-richest and a Root-first strategy, where none may dominate across layouts. The early fights also use few ships, and might feel fiddly rather than meaningful.
- **Pillars:** 1 (throughput gates everything, now including how fast you can grow), 2 (better rocks are better guarded) and 3 (cut supply or out-produce, several times a run).

#### H3-B: Prizes that change your factory

- **Claim:** if each guarded node gives you something different rather than more of the same ore, which fight you pick first changes how the rest of the run plays, and two runs can go differently. One example: the cut Root drops a second material that builds a tougher ship, and the Bloom gives ore.
- **Attacks:** (b) directly, because choices differ in kind, not minutes. It only softens (a): the economy is still built first unless the new material changes that.
- **Smallest build:** one new material from one guarded node, one thing it unlocks (a tougher ship, or route upgrades past level 2), and a second stock line on the probe. The Bloom is unchanged.
- **Risk:** the biggest build of the three (a new resource, recipe and UI). One unlock may simply be best, which gives a new fixed order. It also starts the 3–4 tier chain earlier than planned.
- **Pillars:** 1 and 2, and it seeds 5 (research and probe design carry forward).

#### H3-C: A new system every run

- **Claim:** if every run deals a different map from its seed (how many rocks, where they are, how rich, where the Roots and guards sit), the plan has to be read fresh each time, and replay stops feeling deflating.
- **Attacks:** the "same exact setup" deflation from H1. It doesn't attack (a) or (b).
- **Smallest build:** a seeded generator within fixed bounds, using only existing pieces (asteroids, one Bloom, one Root), plus bot runs over many seeds.
- **Risk:** H2 already changed the Root between runs and the owner's plan didn't change. Variety without new decisions will probably give "the same plan on a different map". It also makes bot balance noisier. It fits better after A or B, once there are decisions worth varying.
- **Pillars:** 5 (each system different) and replay.

#### Considered, not proposed

- **Siege (the Root stays cut only while your ships hold it):** it adds a standing cost, but the cost is still idle ships, which means time. It doesn't break the sequence.
- **Retuning the Root variants for wider gaps:** moves the 50 s margins around without breaking the sequence.
- **Guardians that grow over time:** breaks "waiting doesn't make it worse" (owner direction) and pillar 4.

### H2 (Milestone 1, iteration 2, tested on build-20261108-1): cutting supply vs overwhelming is a real choice

**Result (owner, 2026-11-07):** not supported. Cutting the Root first felt obvious, and both runs followed the same sequence. Cutting the Root itself was satisfying. See PLAYTEST_LOG.md and H3 candidates above.

Owner's pick after the H1 playtest: "Depth first" (PLAYTEST_LOG.md, 2026-11-06). H1's single line was: build everything, mass ships, attack once. H2 tests whether a second, competing line turns the Bloom into a decision.

#### Claim

When a guardian can be beaten in two ways, by **overwhelming** it (one big wave against its full regrowth) or by **starving** it (taking the node that feeds it first, then a smaller wave), and the better way depends on the system, the player weighs the options. Taking the Bloom then feels like a choice, not the obvious line H1 had. This is VISION pillar 3 as written: "win a node by out-producing their replacement, or cut their supply first."

What would disprove it: the owner always takes the same line without looking at the numbers, or calls the Root "a chore on the way to the real fight."

#### The smallest mechanics that test it

Everything from H1 stays: map, economy, shipyard, inputs, combat round, regrowth and HUD. H2 adds four things and **no new input type**:

1. **The Root:** a second guarded node (`root`, map index 7) with its own thorns and regrowth. It uses the H1 combat, capture and regrowth rules. It has no ore and no extractor slots. Once taken, it is only a place where ships can stand.
2. **Supply link:** while the Root lives, the Bloom is **fed** and behaves exactly as in H1. When the Root is captured ("cut"), the Bloom is **starved**:
   - it **wilts** at once to `bloom.starvedCap` thorns, losing its newest thorns first;
   - from then on it regrows at `bloom.starvedRegrowTicks` and repairs `bloom.starvedRepairPerRound`.
3. **Three system variants**, chosen by the seed. They differ only in the Root's position and thorn count, so the best line changes from system to system. The Bloom and the economy are the same in every variant.
4. **Readouts that make the choice weighable:** the Root's sheet and the Bloom's sheet each show what cutting the Root does to the Bloom ("12 thorns, regrows 1 / 2 s → 8 thorns, 1 / 10 s, no repair"). The vine drawn from the Root to the Bloom goes grey when the Root is cut. The result panel names the system and when the Root was cut. **Ships needed is never shown**: estimating it is the puzzle.

Why these and nothing more:
- A permanent cut by capture needs no new input, since `sendShips` to the Root is already an attack. It is readable on a phone, and it reuses the H1 combat code.
- A garrison or siege rule (supply is cut only while your ships stand on the Root) has more depth, but it adds a hold rule and a split-fleet readout. It is the follow-up if H2 says the choice is still obvious.
- The wilt (cap drop) is what makes starving worth it. In the model, slower regrowth and no repair alone only cut the winning wave from about 27 ships to 22, which is too small to notice. With the wilt to 8 thorns, it drops to about 15.
- Starving does **not** make trickling viable. Waves of 6–12 ships every 30–60 s never beat a starved Bloom in the model. H1's lesson, commit enough at once, still holds for both lines.

#### Map variation: included, as three hand-made variants

Included, because the hypothesis needs it. On one fixed map, the better line is found once and then repeated, which is exactly the "obvious" the owner reported. Replay sameness ("deflating") is helped too, but it isn't what H2 measures.

To avoid confounding the test, the variants change **only the Root**. Asteroid positions, slots and yields, the Bloom and every other tunable are the same in each. Procedural jitter of rocks or yields is **excluded**: it would move economy timing, make bot comparisons between strategies noisy, and mix "variety is fun" into a test of "depth is fun".

| Variant | Index | Name | Root x | Root y | Root thorns (`rootCap`) | Model: better line |
| --- | --- | --- | --- | --- | --- | --- |
| `thin` | 0 | Thin Root | 820 | 110 | 4 | Cut the Root: about 50 s faster, same ships lost |
| `knotted` | 1 | Knotted Root | 850 | 420 | 9 | A judgement call: cutting is a few seconds faster but loses about 2 more ships |
| `deep` | 2 | Deep Root | 160 | 480 | 14 | Overwhelm: about 60 s faster, about 6 fewer ships lost |

- **Selecting the variant at world creation:**
  - If `system.variant > 0`, use variant `system.variant − 1`.
  - Otherwise use `((seed mod 3) + 3) mod 3`.

  Store the index in the world. The Root node takes `x`, `y` from the variant. Its effective thorn cap is `max(0, min(40, rootCap + root.capBonus))`.
- The Root's radius is 45, and every Root position is at least 280 su from every other node.
- `map.variants` in `data/sim.json` holds the table above. `map.nodes` gains the `root` entry (kind `root`, `r` 45, `slots` 0), with the `knotted` position as a placeholder.
- **New run** (client) uses `seed + 1`, so consecutive runs cycle through the three Roots and the owner's second run is always a different system. The first-ever run keeps its random seed.

#### Flavor (for Art Direction)

The **Root** is where the Bloom drinks from. It is a hot-pink stalk sunk into a small dark rock, with its own ring of thorns, and a living vine runs from it across space to the Bloom. Pulses travel along the vine toward the Bloom, slowly, so it reads as feeding. Cut the Root and the stalk greys and the vine goes slack and grey. The Bloom drops its newest thorns and dims a little, but stays pink until it is taken. It must stay distinguishable from the Bloom at 24 px: smaller, upright and stalk-like rather than round coral. It follows `ART_STYLE.md`.

Draw contract, which h2-client can call before h2-art merges:
- `drawRoot(ctx, r, t, cut)`;
- `drawVine(ctx, x1, y1, x2, y2, t, cut)`;
- `drawWiltingThorn(ctx, r, frac)`, a thorn falling and fading, with `frac` going 0→1;
- `drawThorn`, reused for the Root's thorns.

#### Rules per tick: changes from H1

The H1 rules stay as written. The changes:

- **Guardians.** The single `guardian` becomes one guardian per guarded node: `rich` (the Bloom) and `root`. Each guardian has `node`, `alive`, `thorns[]` and `regrowProgress`. All guardians loop in node-index order (Bloom 6, then Root 7). Thorn ids still come from `nextId`. The exact layout is the Core Engineer's call, logged in DECISIONS.md.
- **Effective parameters.** Thorn hp and damage are shared: `guardian.thornHp` and `guardian.thornDamage`.

  | Guardian | Cap | Regrow ticks | Repair per round |
  | --- | --- | --- | --- |
  | Bloom, fed (Root alive) | `guardian.cap` | `guardian.regrowTicks` | `guardian.repairPerRound` |
  | Bloom, starved (Root cut) | `bloom.starvedCap` | `bloom.starvedRegrowTicks` | `bloom.starvedRepairPerRound` |
  | Root | variant `rootCap + root.capBonus` (clamped 0–40) | `root.regrowTicks` | `guardian.repairPerRound` |

  The Root starts at its cap, like the Bloom.
- **Rule 7 (combat).** For each living guardian with thorns, fight the H1 round against the ships `at` its node, using its effective repair. Each guarded node has its own battle, so two battles can run at once if the player splits the fleet. `lastBattle` records which node it was.
- **Rule 8 (capture).** The capture condition is the same for each guardian.
  - **Bloom:** as in H1. `capturedTick` still means the Bloom.
  - **Root:** `alive = false`, `root.owned = true`, `stats.rootCutTick = tick`, and the Root battle ends `captured`. Then, if the Bloom is alive, it **wilts**: while its thorn count is above `bloom.starvedCap`, remove its highest-id thorn and add 1 to `stats.thornsWithered`. These are not kills. Set the Bloom's `regrowProgress = 0`.
  - Taking the Root after the Bloom has fallen does nothing more.
- **Rule 9 (regrowth).** Each living guardian regrows using its effective cap and regrow ticks. As in H1, a guardian at or above its cap holds `regrowProgress = 0`.
- **Inputs.** No new inputs.
  - `sendShips` to either guarded node while it is alive is an attack and counts in `wavesSent`. The one-wave-per-tick rule stays.
  - `setTunable` accepts the new keys below. `system.variant` is `newRunOnly`, like `economy.startStock`.
- **Stats.** New fields: `rootCutTick` (null until cut), `thornsWithered`, and `variant` (index).
- **Data version 3.**

#### Observable values: additions

- **Map:**
  - the Root node, a pink stalk drawn with its own thorn ring (reusing `drawThorn`);
  - a **vine** from the Root to the Bloom, pink and alive, or grey once cut;
  - when the Root is cut, the wilted thorns visibly drop off the Bloom (client-side animation, about 1 s).
- **Root sheet:**
  - thorns vs cap, regrowth, thorn and ship hp/damage, ships present and en route (the same block as the rich sheet);
  - Attack and Retreat buttons, as on the rich sheet;
  - a **"Feeds the Bloom"** box: "While the Root lives, the Bloom has 12 thorns, regrows 1 / 2.0 s, repairs 2. Cut it: 8 thorns, 1 / 10.0 s, no repair." All values come from live tunables.
- **Rich sheet:** one line under the thorn count, either "Fed by the Root (cut it: 8 thorns, 1 / 10.0 s)" or "Starved: Root cut".
- **Battle banner:** prefixed with the node name ("BLOOM · strip 1.3/s · regrow 0.5/s · 4 lost", "ROOT · …"). With two battles, show both on one line each.
- **Battle report toasts for the Root:**
  - captured: "Root cut: 15 sent, 3 lost. The Bloom wilts: 12 → 8 thorns, regrows 5× slower." The numbers come from the wilt and the tunables.
  - repelled: "Root held: 10 sent, 10 lost, 2 thorns stripped".
- **Result panel:** adds the system name ("Thin Root"), and "Root cut at 8:12" or "Root left standing". Ships lost includes the Root fight.
- **Probe sheet:** the system name in small text.
- **Tuning panel:** the new keys. `system.variant` shows "0 · by seed / 1 Thin / 2 Knotted / 3 Deep" and applies on New run.

#### Touch interactions

Nothing new to learn. The Root is a node: tap it to see its sheet, and attack it from there with the existing target-first buttons. Rally can be set on the Root once it is cut.

The Root's hit area is at least 44 px and covers its thorn ring. The same change applies to the Bloom, which closes the "thorns drawn outside the tap area" note.

Labels for nodes near the top edge (Thin Root at y 110, the Bloom) must not clip. This folds in cw-bloom-label-clip.

#### Tunables (new; data/, all integers)

| Key | Default | Range | Feels like (low / high) |
| --- | --- | --- | --- |
| `root.capBonus` | 0 | −14 to 20 | −14: every Root is unguarded and cutting is free (starve dominates) / 20: every Root is a fortress (overwhelm dominates) |
| `root.regrowTicks` | 60 | 15–1800 | 15: the Root needs a big wave of its own / 1800: chip it down at leisure |
| `bloom.starvedCap` | 8 | 1–40 | 1: cutting the Root nearly wins the Bloom / 12 or more: cutting removes no thorns, only slows regrowth |
| `bloom.starvedRegrowTicks` | 300 | 15–1800 | 60: no regrowth change / 1800: regrowth effectively stops |
| `bloom.starvedRepairPerRound` | 0 | 0–20 | 0: damage sticks / 2: same as fed |
| `system.variant` | 0 | 0–3 | 0: chosen by seed / 1–3: force Thin, Knotted or Deep (new run only) |

`map.variants` (positions, `rootCap`) is data that needs a restart, like `map.nodes`. `root.capBonus` is the live knob for the Root's strength. It is a bonus rather than a live `root.cap` because New run keeps live tuning, and a tuned `root.cap` would erase the difference between variants. In the "Feels like" column, the existing `guardian.*` keys now mean "the Bloom while fed", plus the thorn stats shared by both guardians.

**Calibration** (throwaway model of these rules in the scratchpad, using H1 economy timing: the asteroid network plateaus at about 6.6 min, then about 10.8 ships/min):

| Line | Ships sent | Ships lost | Model capture |
| --- | --- | --- | --- |
| Fed Bloom, overwhelm | 32 (min 27) | 11 | 9.7 min |
| Starved Bloom (8 thorns), after the Root | 18 (min 15) | 8 | — |
| Thin (Root 4), starve | Root 15 (min 13) | 3 | 8.9 min |
| Knotted (Root 9), starve | Root 28 (min 21) | 7 | 9.65 min |
| Deep (Root 14), starve | Root 40 (min 30) | 12 | 10.75 min |

Survivors of the Root fight join the Bloom wave. Focus fire leaves at most one wounded survivor.

#### Bot strategies (H2)

- **rush:** unchanged from H1. It ignores the Root.
- **turtle** (the overwhelm line): unchanged from H1. It ignores the Root. It doubles as a regression check, because a fed Bloom must behave exactly as in H1.
- **raid-supply** (the starve line; replaces the stub):
  1. Same economy plan as turtle, with the shipyard off until the plan is done.
  2. Then: shipyard on, rally `probe`.
  3. While the Root is alive, no ships are at or heading to `root`, and ships at `probe` ≥ `rootWave`: `sendShips(probe, root, 0)`.
     - `rootWave = ceil(rootThorns × 5 / 2) + 5`, where `rootThorns` is the Root's current thorn count. That gives 15, 28 and 40 for the three variants.
     - If repelled, it recomputes and waits again.
  4. On the tick after the Root is cut: `setRally a5`, then `sendShips(root, a5, 0)`.
  5. When ships at `a5` ≥ `bloomWave` and none are at or heading to `rich`: `sendShips(a5, rich, 0)`.
     - `bloomWave = ceil(bloomThorns × 9 / 4)`, where `bloomThorns` is the Bloom's current thorn count. That gives 18 at 8 thorns.
     - If repelled, it waits again.
  6. After capture: build out `rich`, like turtle.
- **Seeds.** The suite's seeds 1, 2 and 3 map to variants knotted, deep and thin, so the default `--seeds 3` covers all three. The report labels every row with its variant.
- **Report additions** (per strategy and seed):
  - the variant id;
  - the Root cut time (or null);
  - ships lost at the Root;
  - thorns withered;
  - waves sent per target.

  Plus a per-variant comparison table: turtle vs raid-supply capture time and ships lost at capture.

**Bot tuning targets** (report flags, not merge gates). Together they are the evidence that neither line dominates:
1. turtle and raid-supply capture in every variant, within 8–13 game minutes.
2. `thin`: raid-supply captures at least 30 s before turtle.
3. `deep`: turtle captures at least 30 s before raid-supply.
4. `knotted`: the two capture times are within 45 s of each other (a judgement call).
5. **No dominance:** neither strategy is at least as good as the other on both capture time and ships lost at capture in all three variants. In practice: each captures first in at least one variant, and turtle loses fewer ships in at least one.
6. Regression: turtle's capture matches the H1 report (9.8 min ± 10 s, 1 wave), because a fed Bloom is unchanged.
7. rush keeps its H1 targets, and nothing softlocks.

If the real numbers miss these, report them; the Designer retunes `map.variants` and the `bloom.starved*` defaults. The engineers do not retune.

#### Success criteria (the owner, one ~20 minute phone session, two runs)

Use 2x/4x freely once the economy is built. A run is about 10 game minutes.
1. In run 1, before the big attack, the owner has opened both the Root's and the Bloom's sheets and can say in one sentence why they did or didn't cut the Root.
2. Run 2 is a different Root (New run cycles them). The owner either changes plan, or can name what about this system would make the other line better.
3. Cutting the Root reads without explanation: the vine goes grey, thorns visibly fall off the Bloom, and the toast says by how much.
4. The owner does not call the solution "obvious" or "one-dimensional", and the answer to fun question 1 names a trade-off.
5. Each run still captures in about 8–15 minutes. Every action is at most 2 taps from the map, not counting the confirm tap on Cancel and New run. This rewords the H1 criterion, which conflicted with Cancel's confirm.

#### Fun questions for the handoff

1. Before your big attack, did you weigh cutting the Root against hitting the Bloom head-on? What tipped it, and did it feel like a real choice or an obvious one?
2. Your second run had a different Root. Did you change plan? Could you tell from the numbers on the sheets which way was better, or was it a guess? Did the new system make the replay feel fresh?
3. When the Root fell and the Bloom wilted, did that feel like a payoff in itself, or like a chore on the way to the real fight?

#### H1 carry-overs folded into H2 (client, small)

Decisions on `cw-m1-design-notes` and `cw-m1-client-notes`:
- **Tap areas:** the hit areas of guarded nodes cover their thorn rings (see Touch).
- **Tuning panel:** tick values also show seconds ("60 · 2.0 s").
- **First-run hint:** it moves into the notices strip, so it no longer covers the probe.
- **Banner wording:** "BATTLE · strip … · regrow … · N lost" is confirmed, with the node-name prefix above.
- **Kept as is:**
  - the shipyard starts on (the first ship by about 2 minutes matters more than a 25 s delay to the first extractor);
  - the map jump while a toast shows (cw-map-jump; the owner didn't mention it);
  - staggered "All" (unused by the owner; stays low priority).

#### Out of scope for H2

Each is a candidate for later:
- garrison or siege supply cuts;
- ore on the Root;
- overgrown asteroids that unlock when the Root is cut (this would make the economy order a decision too; candidate H2b if the plateau is still dull);
- more than one Root;
- a second ship type;
- procedural maps;
- research, tiers and NG+.

### H1 (Milestone 1, tested on build-20261106-2): growing throughput is satisfying, and taking a guarded node is a puzzle

**Result (owner, 2026-11-06):** claim 1 was weakly supported ("mildly satisfying"). Claim 2 was not supported ("obvious and one dimensional"). The result panel made the owner want to replay. See PLAYTEST_LOG.md. The H1 mechanics below stay as the base for H2.

#### Claims

1. **Throughput is satisfying on its own.** Watching delivered ore per minute climb, and seeing ship production speed up as a direct result, is fun before research, tiers or NG+ exist.
2. **The guardian is a puzzle, not a wait.** Taking the guarded node by building enough production to beat its regrowth in one committed wave feels like solving something. Failed early attacks read as lessons, and the payoff is a visible jump in throughput.

#### Scope decisions

- **One production tier.** Asteroids give ore, ore goes to the probe, and the probe builds ships and structures. Both claims are about the rate of delivery and the fight against regrowth. Refining and components add chain decisions, which are a different hypothesis (H2). If one tier isn't satisfying, more tiers won't fix it. The 2–3 tier first system and the 3–4 tier chain come after M1.
- **"Done with the run" = capture plus a result panel, then free play.** When the rich node falls, a dismissible panel shows the time to capture, peak throughput, ships built, ships lost and waves sent. The game keeps running so the owner can watch the throughput jump, and "New run" is in the menu. The HUD shows no clock during play. The panel gives the puzzle a score to beat without adding pressure. "Consequences" above asks to confirm a result screen with the owner first, so it ships behind a tuning-panel toggle (default on) and is asked as QUESTIONS.md Q11 and handoff question 3.
- **Autosave is in M1.** It is a fixed decision in VISION.md, and phone browsers kill background tabs. A 15-minute test run lost to an app switch would wreck the playtest. The sim state is already plain serializable data, so it is cheap: one slot, at most 5 s lost.
- **Out of scope for M1** (later hypotheses): attacking the hive directly, the hive's own supply line and raid-supply play (H2 candidate), escort orders, multiple resources, research, the new-probe win, NG+, more than one system, camera pan/zoom.

#### Mob flavor (proposal for Art Direction)

**The Bloom**: a hot-pink, coral-like hive grown into the richest rock in the system, glowing because it is alive. It buds **thorns**, spiky seed-pods that orbit the rock and lash any ship that comes close. It keeps regrowing them until the rock is ringed again. Taking the rock means stripping every thorn faster than it buds. When the last thorn falls, the Bloom withers to grey and the rock's teal ore shows through.

#### Map: the M1 system

The world is 1000 × 1400 sim units (su), with the origin at the top left and y pointing down. The whole map fits a 375 px wide portrait screen (about 0.375 px/su) with no pan or zoom. Node centers are at least 140 su apart, so the 44 px touch targets never overlap. The map is fixed (no RNG) and lives in data as `map.nodes`. Radii are for drawing; touch hit areas are at least 44 px no matter the radius.

| Id | Index | Kind | x | y | Radius | Extractor slots | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `probe` | 0 | probe | 500 | 1180 | 70 | 0 | Player core. Owned from the start. Every route ends here. |
| `a1` | 1 | asteroid | 330 | 1000 | 45 | 2 | Nearest, small. Route length 248, cost 9. |
| `a2` | 2 | asteroid | 700 | 1010 | 50 | 3 | Near. Route length 262, cost 10. |
| `a3` | 3 | asteroid | 220 | 760 | 50 | 3 | Mid. Route length 504, cost 15. |
| `a4` | 4 | asteroid | 790 | 720 | 55 | 3 | Mid. Route length 543, cost 15. |
| `a5` | 5 | asteroid | 480 | 560 | 60 | 4 | Forward rock and natural staging point; 330 su from `rich`. Route length 620, cost 17. |
| `rich` | 6 | rich | 500 | 230 | 90 | 4 | Guarded by the Bloom (the hive is part of this node, not a separate node). Ore yield 2.5× an asteroid once captured. Route length 950, cost 24. |

Route length is the integer square root (floor) of the squared center distance, computed once when the route is created. Ship travel uses the same lengths (probe→rich = 950 su, about 8 s at 1x).

#### Entities and state

Everything is an integer. Ore is counted in whole units. Per-minute rates turn into whole ore through accumulators (see Rules), so no fractional state exists anywhere and no ×1000 scale is needed. The map has no RNG; `rng` stays in the state for later milestones.

- **World:** `tick`, `rng`, `dataVersion`, `nextId`, `stock` (ore at the probe), `probeAccum`, `queue` (unpaid build orders, FIFO), `activeBuild` (`{kind, node, ticksLeft}` or null), `shipyard` (`{on, ticksLeft}`; `ticksLeft = 0` means idle), `rally` (node index, default `probe`), `nodes[]`, `routes[]`, `ships[]`, `guardian`, `battle` (current or null), `lastBattle`, `stats`, `capturedTick` (null until capture).
- **Node:** `index`, `kind` (`probe | asteroid | rich`), `x`, `y`, `r`, `slots`, `owned` (bool), `extractors` (built count), `buffer` (ore waiting for pickup, ≤ `node.bufferCap`), `accum`.
- **Build order:** `kind` (`extractor | route | upgrade`), `node` (the source node for routes and upgrades), `cost` (locked when queued, shown on screen).
- **Route:** `id`, `from` (node), `to` (always `probe` in M1), `length`, `level` (1..`route.maxLevel`), `cooldown` (ticks to the next pod launch), `pods[]` (`{amount, ticksLeft}`, oldest first). One route per source node.
- **Ship:** `id`, `hp`, and either `at` (node index) or `transit` (`{from, to, ticksLeft, totalTicks}`). The client interpolates the position from `transit`.
- **Guardian (the Bloom):** `alive` (bool), `thorns[]` (`{id, hp}`, oldest first), `regrowProgress` (ticks).
- **Battle:** `startTick`, `shipsEngaged` (distinct ships that fought in at least one round), `shipsLost`, `thornsKilled`. When it ends it is copied to `lastBattle` with `endTick` and `outcome` (`captured | repelled | withdrew`).
- **Stats:** `deliveredBuckets[60]` (ore delivered by routes per game second, ring buffer), `peakPerMin`, `shipsBuilt`, `shipsLost`, `thornsKilled`, `wavesSent`, `firstShipTick`, `oreSpentShips`, `oreSpentEconomy`.

#### Rules per tick (in this order)

`T` = `tickRate × 60` = 1800 ticks per game minute.

1. **Inputs.** Apply this tick's inputs in order. An invalid input is ignored with no state change. The client greys out actions that would be invalid, so this only guards against stale taps and bots.
2. **Construction.** If `activeBuild` exists, decrement `ticksLeft`. At 0, apply it:
   - extractor: `extractors += 1`, `owned = true`;
   - route: create it at level 1, with `cooldown = 0`;
   - upgrade: `level += 1`.

   Then, if there is no active build and `stock ≥ queue[0].cost`, pay the cost, pop the head and start it (`extractor.buildTicks` or `route.buildTicks`; upgrades use `route.buildTicks`). One build runs at a time.
3. **Extraction.** For each node with extractors, add `extractors × yield` to `accum`, where yield is `extractor.orePerMin` for asteroids and `rich.orePerMin` for the rich node. While `accum ≥ T`, subtract `T` and add 1 ore to `buffer` if `buffer < node.bufferCap`; otherwise the ore is lost. A full buffer is a visible "backed up" state, so the bottleneck shows on screen. Probe mining: `probeAccum += economy.probeOrePerMin`, and while `probeAccum ≥ T`, subtract `T` and add 1 to `stock`. This keeps a dead network from ever softlocking.
4. **Routes.** For each route: if `cooldown > 0`, decrement it. If `cooldown = 0` and the source buffer is above 0, launch a pod with `amount = min(buffer, level × route.podOrePerLevel)` and `ticksLeft = ceil(length / route.podSpeedSu)`, and set `cooldown = route.podIntervalTicks`. Decrement every pod's `ticksLeft`. Pods at 0 deliver their ore to `stock` and to `deliveredBuckets[(tick / tickRate) mod 60]`. Route capacity per minute = `level × podOrePerLevel × T / podIntervalTicks` (20 per level at defaults). Distance adds latency, not capacity limits.
5. **Shipyard.** If `ticksLeft > 0`, decrement it. At 0, a ship spawns at `probe` with `ship.hp`; if `rally ≠ probe`, it starts transit to `rally` at once. Then, if the yard is `on`, idle, and `stock − Σ queue[].cost ≥ ship.cost`, pay and start a ship with `ticksLeft = ship.buildTicks`. Queued builds reserve their ore, so they always take priority over ships. Ships per minute therefore follow `min(income / ship.cost, T / ship.buildTicks)`; at defaults the second term (20/min) does not bind before capture.
6. **Movement.** For each ship in transit, decrement `ticksLeft`. At 0 it arrives (`at = to`). `totalTicks = ceil(length(from, to) / ship.speedSu)`.
7. **Combat** (only while `guardian.alive`). On ticks where `tick mod combat.roundTicks = 0`, if any ship is `at` `rich` and thorns exist, fight one round, resolving both sides at the same time from counts at the start of the round:
   - Player damage = ships present × `ship.damage`. It is applied to thorns in id order (oldest first) and overflows to the next thorn.
   - Bloom damage = thorns × `guardian.thornDamage`. It is applied to ships present in id order and overflows the same way.
   - Units at hp ≤ 0 are removed. Update the battle and stats counters.

   Then, on every round tick whether or not there is a fight, each surviving thorn heals `guardian.repairPerRound` up to `guardian.thornHp`. A battle starts on the first round with ships present. It ends when no ships are present: `repelled` if the last ones died, `withdrew` if they left.
8. **Capture.** If `guardian.alive`, there are no thorns, and at least one ship is `at` `rich`:
   - `alive = false`, `rich.owned = true`;
   - `rich.extractors = min(rich.freeExtractors, slots)`;
   - `capturedTick = tick`, and the battle ends `captured`.

   The node is the player's for the rest of the run; mobs never retake it.
9. **Regrowth.** If `guardian.alive` and there are fewer than `guardian.cap` thorns, `regrowProgress += 1`. At `guardian.regrowTicks`, add a full-hp thorn with a new id and reset to 0. At the cap, `regrowProgress = 0`. The Bloom starts at the cap.
10. **Stats.** On the first tick of each game second, zero the bucket being entered. `throughputPerMin = Σ deliveredBuckets`, and update `peakPerMin`.
11. `tick += 1`.

Calibration at defaults, from a throwaway model of these rules (to be confirmed by the bots):
- A full Bloom (12 thorns) beats a simultaneous wave of 26 ships.
- About 28 ships win, losing about 15. 35 ships win losing about 10, so bigger waves are cheaper.
- A trickle (rally at `rich`) never wins.
- With regrowth every 30 ticks instead of 60, about 35 ships are needed; regrowth is the main lever on wave size.
- Asteroids max out at 150 ore/min, and capture adds 100/min (≈ +65 %).

#### Player inputs (the sim's `Input` union)

Node and route parameters are node indices. The placeholder `noop` and `boost` inputs are removed.

| Input | Parameters | Valid when | Effect |
| --- | --- | --- | --- |
| `buildExtractor` | `node` | node is an asteroid, or `rich` after capture; built + queued + active extractors < slots; queue length < `build.queueMax` | Queue an extractor at `extractor.cost`. |
| `buildRoute` | `from`, `to` | `to = probe`; `from` has no route and none queued; `from` has an extractor built, active or queued; queue not full | Queue a route at `route.costBase + floor(length × route.costPer100Su / 100)`. |
| `upgradeRoute` | `from` | route from `from` exists; level + queued upgrades < `route.maxLevel`; queue not full | Queue an upgrade at `route.upgradeCostPerLevel × (target level − 1)` (20, 40, 60, 80 at defaults). |
| `cancelBuild` | `index` | `0 ≤ index < queue.length` (unpaid orders only) | Remove that order. Nothing was paid, so nothing is refunded. |
| `setShipyard` | `on` (bool) | always | Turn ship production on or off. A ship already in progress finishes. |
| `sendShips` | `from`, `to`, `count` (0 = all) | `from ≠ to`; at least 1 ship `at` `from` | The lowest-id `count` ships at `from` start transit to `to`. Sending to `rich` while it is guarded is an attack and counts in `wavesSent`; anywhere else it is a move (they guard there). Leaving `rich` mid-battle is a retreat. |
| `setRally` | `node` | any node | Newly built ships fly here automatically. |
| `setTunable` | `key`, `value` (int) | `key` is a tunable listed below, not `map.*`, `tickRate` or `stats.*`; value in range | Change a tunable from the next tick on. It is recorded in the input log, so replays and feedback reproduce tuned sessions. If the Core Engineer prefers another mechanism (for example data snapshots in the replay), log it in DECISIONS.md; the requirement is that a replay reproduces a session with live tuning. |

Time controls (pause, 1x/2x/4x) are client-only and never enter the sim. At 2x and 4x the client steps the sim 2 or 4 times per frame tick.

#### Observable values (HUD and node sheets)

- **Top bar, always visible:**
  - delivered ore/min (`throughputPerMin`, the biggest number on screen), with an up or down arrow against 10 s ago;
  - stock;
  - total ships, and ships/min at the current income.
- **Probe sheet:**
  - shipyard on/off and its progress bar;
  - build queue (up to 4 icons with costs) and active build progress;
  - probe mining (+12/min);
  - rally point.
- **Asteroid sheet:**
  - extractors built/slots, shown as pips;
  - extraction ore/min;
  - route level and capacity ore/min;
  - buffer fill bar, with a "backed up" warning when full ("route at capacity: upgrade") and a "no route" warning when extracting with no route.
- **Rich node sheet, before capture:**
  - thorns alive vs cap ("9 / 12");
  - regrowth as "1 thorn / 2 s" plus a progress ring;
  - thorn hp and damage, and ship hp and damage, as plain numbers;
  - ships present and ships en route.
- **During a battle**, on the rich sheet and as a banner:
  - your kill rate vs regrowth ("you strip 2.4 thorns/s · Bloom regrows 0.5/s");
  - ships lost so far.
- **On the map:**
  - pods moving along routes, one dot per pod, sized by amount;
  - ships as small arrowheads in transit, and a count badge on nodes with ships;
  - the thorn ring around `rich`, one spike per thorn;
  - a flash on hits each combat round.
- **Battle report toast** when a battle ends: "Wave repelled: 18 sent, 18 lost, 5 thorns stripped" or "Captured: 30 sent, 12 lost". It stays until tapped.
- **Result panel on capture** (behind the toggle):
  - game time to capture;
  - peak ore/min;
  - ships built and lost;
  - waves sent.

  Buttons: "Keep playing" and "New run".
- **Throughput sparkline** of the last 10 minutes on the probe sheet (client-side history; it doesn't need to be sim state).

#### Touch interactions (375 px portrait, no hover, 44 px targets)

- **Layout:**
  - Top bar, row 1 (48 px): ore/min, stock, ships.
  - Top bar, row 2 (48 px): pause, 1x, 2x, 4x, tuning (gear), feedback. These are six 52 px buttons.
  - Map in the middle.
  - A bottom sheet (up to about 45 % of the height) opens when a node is selected.

  In landscape the bars move to the left edge; the client decides the details.
- **Select:** tap a node (hit area at least 44 px). Tap empty space or the sheet's close button to deselect. Routes are never tap targets; all route actions live on the source node's sheet.
- **Build extractor:** asteroid sheet → "Extractor · 20". One tap; it queues.
- **Build route:** asteroid sheet → "Route to probe · 9". One tap. The button is enabled as soon as an extractor is built or queued.
- **Upgrade route:** asteroid sheet → "Upgrade route → L2 · 20".
- **Cancel build:** probe sheet → tap a queued icon, then "Cancel" (a second tap, to prevent mistaps).
- **Shipyard:** probe sheet → on/off toggle.
- **Send ships (target-first, no drag):** select the destination, and the sheet lists one button per node that has ships: "From Probe · 14", "From A5 · 8", plus "All · 22". On `rich` the buttons read "Attack from …". One tap sends `sendShips(from, to, 0)`, and "All" sends one `sendShips` per source. To retreat, select `probe` (or `a5`) and tap "From Rich".
- **Rally:** any node's sheet → "New ships gather here". The current rally node shows a flag.
- **Tuning panel:** the gear opens a full-screen list grouped by section. Each tunable has −/+ steppers (44 px) and a value field, clamped to its range, with "Reset to default" per row and for all. Changes apply live through `setTunable`. Toggles: result panel on/off.
- **Feedback:** the speech-bubble button opens a text box plus "Send". The note carries the build version, data version and replay (seed, data, input log). Delivery follows Q4 (prefilled GitHub issue link, with copy to clipboard if it is too long or the user has no GitHub account). Opening feedback pauses the game.
- **First-run hint:** a one-line dismissible banner, "Tap an asteroid to build an extractor", and nothing else.
- **Autosave:** every 5 s of wall time and on `visibilitychange` to hidden, to one localStorage slot. On load, resume silently. "New run" (in the tuning panel menu) asks for confirmation. If the save's data version doesn't match, discard it and say so in a toast.

#### Tunables (data/, all integers)

Rates are whole ore per game minute; times are in ticks (30 = 1 s at 1x); distances are in su. In the "Feels like" column, the first part describes the low end of the range and the part after "/" the high end. Map node positions, radii and slots are in `map.nodes` (table above) and need a restart to change.

| Key | Default | Range | Feels like (low / high) |
| --- | --- | --- | --- |
| `economy.startStock` | 30 | 0–200 | 0: a slow cold start on probe mining / 200: skips the opening and the first decisions |
| `economy.probeOrePerMin` | 12 | 0–60 | 0: a bad start can stall for a long time / 60: asteroids feel optional |
| `extractor.cost` | 20 | 5–100 | 5: build everything at once, no choices / 100: each extractor is a big commitment |
| `extractor.buildTicks` | 300 | 30–1800 | 1 s: instant gratification / 60 s: sluggish, lots of waiting |
| `extractor.orePerMin` | 10 | 2–40 | 2: throughput barely moves / 40: routes are always the bottleneck |
| `node.bufferCap` | 40 | 10–200 | 10: bottlenecks show (and waste ore) quickly / 200: bottlenecks hide for minutes |
| `route.costBase` | 5 | 0–50 | 0: routes are free / 50: a route costs more than its extractor |
| `route.costPer100Su` | 2 | 0–20 | 0: distance is free / 20: far asteroids are rarely worth it |
| `route.buildTicks` | 300 | 30–1800 | as `extractor.buildTicks` |
| `route.podIntervalTicks` | 90 | 15–300 | 15: a near-continuous stream of dots / 300: sparse, lumpy deliveries |
| `route.podOrePerLevel` | 1 | 1–10 | sets capacity with the interval: 20/min per level at defaults |
| `route.podSpeedSu` | 6 | 1–30 | 1: far nodes take 30 s or more to start paying / 30: distance doesn't matter |
| `route.upgradeCostPerLevel` | 20 | 5–100 | 5: always upgrade / 100: live with bottlenecks |
| `route.maxLevel` | 5 | 1–10 | 1: no upgrades (slots are the only lever) / 10: never capped |
| `build.queueMax` | 4 | 1–8 | 1: one thing at a time, lots of tapping / 8: queue everything and forget |
| `ship.cost` | 15 | 5–60 | 5: ship swarms, the guardian is trivial / 60: few precious ships |
| `ship.buildTicks` | 90 | 15–900 | 0.5 s: production is pure throughput / 30 s: the shipyard, not throughput, is the throttle (bad for pillar 1) |
| `ship.hp` | 10 | 1–100 | 1: glass / 100: waves rarely lose ships |
| `ship.damage` | 2 | 1–20 | per round; sets the wave size needed |
| `ship.speedSu` | 4 | 1–20 | 1: about 30 s to reach the Bloom / 20: instant |
| `guardian.cap` | 12 | 1–40 | 1: a token guard / 40: a late-game wall |
| `guardian.thornHp` | 20 | 1–200 | how many ship-hits a thorn soaks |
| `guardian.thornDamage` | 3 | 0–30 | 0: free capture / 30: every wave is a massacre |
| `guardian.regrowTicks` | 60 | 15–1800 | 0.5 s: only huge waves win, trickles are hopeless / 60 s: regrowth irrelevant, chip it down over time (loses the puzzle) |
| `guardian.repairPerRound` | 2 | 0–20 | 0: damage sticks between rounds / 20: wounded thorns recover at once |
| `combat.roundTicks` | 30 | 10–90 | 10: fights are a blur / 90: slow, readable rounds |
| `rich.orePerMin` | 25 | 10–80 | per extractor: 10, capture barely matters / 80, capture dwarfs everything |
| `rich.freeExtractors` | 1 | 0–4 | 0: the payoff is delayed until you build / 4: instant full payoff |
| `stats.throughputWindowSec` | 60 | fixed | ring buffer size; not live-tunable |
| `client.autosaveSec` | 5 | 2–60 | client-only, not in the sim hash |

#### Success criteria (the owner, one ~20 minute phone session)

1. The first ship appears within about 2 minutes, with no help beyond the one-line hint.
2. Ore/min visibly climbs. By about 5 minutes the owner has upgraded a route because a node showed "backed up", and can say what the bottleneck was.
3. An attack before about 6–8 minutes (fewer than about 25 ships) visibly fails, and the battle report makes clear why: "regrowth outpaced me" or "too few ships".
4. A decent network takes the rich node at about 10–15 minutes, and ore/min then jumps by at least half within 2 minutes.
5. No mistaps or hunting for controls: every action is at most 2 taps from the map, and the owner never needs pinch, drag or hover.

**Bot tuning targets** (reports, not merge gates):
- turtle captures in 9–15 game minutes with 1–2 waves;
- rush's first wave fails;
- rush captures later than turtle, or loses at least 3× the ships;
- neither strategy softlocks;
- throughput is still rising at minute 10 for turtle.

#### Fun questions for the handoff

1. Watching ore/min climb and ships come faster: was that satisfying in itself, or did you only care about the attack?
2. When you took the rich node, did it feel like you worked out what it needed (how many ships, how much network), or like you just waited until you had a pile of ships?
3. Did the result panel (time to capture, ships lost) make you want to replay and beat it, or did it feel like a clock you didn't want?

#### Bot strategies (M1)

Both use only the inputs above. M1 has no randomness, so every seed gives the same game. That is expected; seeds still run for the determinism gate.

- **rush:** small economy, frequent waves, growing after each failure.
  1. Tick 0: `buildExtractor a1`, `buildRoute a1→probe`, then fill `a1` (2 slots).
  2. Fill `a2` (route plus 3 extractors), upgrading `a2`'s route when its extraction exceeds capacity.
  3. Shipyard on throughout; rally at `probe`.
  4. Whenever no ships are at or heading to `rich` and ships at `probe` ≥ `wave` (starting at 6), `sendShips(probe, rich, 0)`. Raise `wave` by 6 for each later wave.
  5. After capture, build out `rich` (extractors, route, upgrades).

  Model estimate: about 6 waves, about 78 ships lost, capture at about 25–30 minutes.
- **turtle:** economy first, one big wave.
  1. Tick 0: `setShipyard off`.
  2. For each node in order `a1, a2, a3, a4, a5`, keeping one queued item at a time: extractor, then route, then upgrade the route whenever extraction exceeds capacity, then fill the slots.
  3. When the plan is done: `setShipyard on` and `setRally a5`.
  4. When ships at `a5` ≥ 32, `sendShips(a5, rich, 0)`. If repelled, wait for 32 again.
  5. After capture, build out `rich`.

  Model estimate: capture at about 11 minutes in 1 wave, about 11 ships lost.

**Report** (per strategy and seed, in `reports/bots-latest.json` and the Markdown summary):
- capture time (game seconds, or null within the 30-minute cap) — this replaces win rate, and `outcome: won` means captured;
- first ship time;
- `throughputPerMin` at 2, 5, 10, 15 and 20 minutes, and peak;
- ships built and lost;
- waves sent and waves repelled;
- ore spent on ships vs economy;
- tick p50/p95.

The summary flags any strategy that never captures, and any whose capture time is outside the targets above.
