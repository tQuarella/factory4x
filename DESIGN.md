# Design

Owned by the Designer. Current mechanics, open fun hypotheses, and the tunable parameters behind them. Every number named here lives in `data/`.

## Constraints from VISION.md

- Phone-first: every interaction works by touch at 375 px wide. Logistics are routes drawn between nodes.
- Real-time with pause and 1x/2x/4x.

## Owner direction (design session, 2026-11-06)

Answers from the owner, in their words where possible. These shape everything below; the proposed `VISION.md` wording is in `QUESTIONS.md` Q7.

| Topic | Direction |
| --- | --- |
| Shape | **Roguelite campaign.** Each star system is one run of **20–40 minutes**. The campaign of systems spans many sessions. "Shorter sessions but more capability each time." |
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

## Current mechanics

Nothing playable is built yet. Milestone 0 ships a placeholder page only. Milestone 1 (spec below, H1) will add:

- One star system with a probe, five asteroids and one rich node guarded by a guardian hive (the Bloom).
- Extractors on asteroids, ore routes to the probe with pods you can see moving, and route upgrades.
- A single build queue at the probe, paid from delivered ore.
- A shipyard that turns stock into one ship type, so its rate follows throughput. It can be switched off.
- Ships ordered between nodes (send, rally), with deterministic wave combat at the guarded node.
- Capture of the rich node, a result panel, then free play.
- Pause, 1x/2x/4x, a tuning panel, a feedback button, and autosave.

## Hypotheses

### H1 (Milestone 1, spec ready): growing throughput is satisfying, and taking a guarded node is a puzzle

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
