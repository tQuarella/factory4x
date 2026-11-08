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
| Mobs | **Defend only.** They never come for you. |
| Mob factories | Repair and replace defenders **up to a cap**. You take a node by out-producing their replacement rate, or by cutting their supply first. Waiting doesn't make it worse; under-committing wastes ships. |
| Losing | **No fail state.** You can lose ships and time, never the run. |
| Tension | **Optimization puzzle.** No clock, no pressure. The challenge is building an efficient network. |
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

## Hypotheses

### H3 (Milestone 2, iteration 3, spec ready): Counter web

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

Guard counts are written `Thorns T / Spores S`. "Starved" is the heart's cap per type after the Root is cut. Slots apply to the pocket after capture. The model columns come from the throwaway model (scratchpad, defaults below): the minimum simultaneous wave that wins, as drones / lancers / flak / best mix.

**Layout 0: Frost Gate**

| Node | Prize | Slots | Guards (T/S) | Model: drones / lancers / flak / best mix |
| --- | --- | --- | --- | --- |
| p1 | ice | 2 | 1 / 8 | 14 / 17 / 8 / 5 |
| p2 | crystal | 2 | 3 / 3 | 13 / 12 / 20 / 6 |
| p3 | ice | 3 | 9 / 4 | 25 / 17 / 35 / 11 |
| p4 | crystal | 3 | 2 / 18 | 22 / 25 / 18 / 10 |
| root | none | 0 | 6 / 0 | 16 / 6 / 25 / 6 |
| heart | ore | 4 | 10 / 14, starved 6 / 7 | 32 / 25 / 39 / 14; starved 16 / 10 / 17 / 7 |

**Layout 1: Glass Thicket**

| Node | Prize | Slots | Guards (T/S) | Model: drones / lancers / flak / best mix |
| --- | --- | --- | --- | --- |
| p1 | crystal | 2 | 1 / 8 | 14 / 17 / 8 / 5 |
| p2 | ice | 2 | 3 / 3 | 13 / 12 / 20 / 6 |
| p3 | ice | 3 | 2 / 18 | 22 / 25 / 18 / 10 |
| p4 | crystal | 3 | 9 / 4 | 25 / 17 / 35 / 11 |
| root | none | 0 | 0 / 12 | 11 / 17 / 4 / 4 |
| heart | ore | 4 | 14 / 8, starved 8 / 4 | 36 / 23 / 46 / 16; starved 17 / 9 / 21 / 8 |

**Layout 2: Twin Seams**

| Node | Prize | Slots | Guards (T/S) | Model: drones / lancers / flak / best mix |
| --- | --- | --- | --- | --- |
| p1 | ice | 2 | 2 / 5 | 14 / 15 / 17 / 5 |
| p2 | crystal | 2 | 2 / 5 | 14 / 15 / 17 / 5 |
| p3 | crystal | 3 | 2 / 18 | 22 / 25 / 18 / 10 |
| p4 | ice | 3 | 9 / 4 | 25 / 17 / 35 / 11 |
| root | none | 0 | 3 / 6 | 16 / 16 / 20 / 7 |
| heart | ore | 4 | 6 / 20, starved 4 / 10 | 30 / 28 / 30 / 13; starved 14 / 11 / 12 / 6 |

Why these layouts:
- **Every first move is a light pocket taken with drones**, about 13–14 of them. There are two doors, one per resource.
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
- **Yards:** `yards: {drone: {on, ticksLeft}, lancer: {on, ticksLeft}, flak: {on, ticksLeft}}`. They replace `shipyard`.
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
- **5b. Yards (replaces rule 5).** For each type, in the fixed order lancer, flak, drone:
  - If `ticksLeft > 0`, decrement it. At 0, spawn a ship of that type at `probe` with `ship.<type>.hp`. If `rally ≠ probe`, it starts transit to `rally`.
  - Then, if the yard is on and idle, `stock.ore − reservedOre ≥ ship.<type>.cost` and (for lancer and flak) `stock[component] ≥ 1`: pay both and set `ticksLeft = ship.<type>.buildTicks`.

  Queued builds still reserve their ore ahead of assemblers and yards. Lancers and flak go first, so a scarce component is never starved by drones.
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
| `ship.drone.cost` | 15 | 5–60 | from `ship.cost` |
| `ship.drone.buildTicks` | 90 | 15–900 | from `ship.buildTicks` |
| `ship.drone.hp` | 10 | 1–100 | |
| `ship.drone.damage` | 2 | 1–20 | 1: drones are fodder / 4: counters don't matter |
| `ship.lancer.cost` | 15 | 5–60 | ore part; plus 1 lens |
| `ship.lancer.buildTicks` | 120 | 15–900 | |
| `ship.lancer.hp` | 12 | 1–100 | |
| `ship.lancer.damage` | 4 | 1–20 | |
| `ship.flak.cost` | 15 | 5–60 | ore part; plus 1 plating |
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
| `pocket.resourcePerMin` | 6 | 1–40 | per extractor. 2: a prize trickles, components throttle everything / 20: one pocket floods you |
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

#### Open calibration questions (for h3-design-data, after h3-sim merges)

1. **Pacing.** With the H1 economy, do bots take the first light pocket at about 4–6 min and the heart at 20–35 min, or 35–45 for `drones-only`? If they're too slow, trim the asteroid build-out cost before trimming the guards.
2. **Prize throughput.** At 6/min per extractor and 4 per component, a light pocket gives about 3 components/min. Is the component, not ore, the visible throttle for lancers and flak, without the player waiting on it?
3. **Door balance.** Do flags 3 and 4 hold? Twin Seams is symmetric by design. If a layout fails, change its heavy pocket's mix before touching `counter.*`.
4. **Drones as the fallback.** Are they clearly worse (flag 2), yet able to finish? Is `ship.drone.damage` 2 too strong?
5. **Spore regrowth at 20 ticks.** Does it keep trickles from winning, as Thorns did in H1? The model says yes for waves under about 8.
6. **Combat order.** Lancers resolve before flak, so lancers soak the Thorns first in a mixed wave. Check that this doesn't make one type always better in mixes.
7. **The bot estimator.** The constant 3 and the +20 margin overestimate drones and underestimate wrong-type waves. Tune it only so the bots behave sensibly. It isn't shown to the player.

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
