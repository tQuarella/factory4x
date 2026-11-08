/**
 * @factory4x/sim — the deterministic game simulation (DESIGN.md H1, H2's Root and supply, H3 "Counter web"
 * and H4 "Reclaim ladder": the campaign of areas around them).
 *
 * PUBLIC API. The client, bots and tests depend only on what this file
 * exports. Treat it as stable: add, don't rename or remove, without a
 * DECISIONS.md entry (the H3 changes are logged under "h3-sim", the H4 ones under "h4-sim").
 *
 * Lifecycle
 *   defaultData                     validated data/sim.json (tunables, map.nodes, map.layouts, map.areas, map.lanes, research).
 *   parseSimData(raw)               validate other data (e.g. a feedback replay's) → SimData; throws on bad data
 *                                   (including Σ haul < Σ research cost per resource at the research.costPct max).
 *   createWorld(seed, data)         fresh campaign at tick 0, ON THE OVERWORLD (no area active: world.nodes is empty).
 *                                   The Deep's layout is system.variant − 1 if that tunable's default is > 0, else
 *                                   ((seed mod 3) + 3) mod 3 (chooseVariant); world.system and campaign.deepLayout name it.
 *   campaignWorld(seed, data, start)   TEST/TOOL/DEV-HOOK ONLY: a campaign as if `start.reclaimed` (area ids) were
 *                                   reclaimed and `start.research` ({id: level}) bought, with `start.stockpile`;
 *                                   `start.land` (an open area id) lands there at tick 0. Not reachable by inputs.
 *   step(world, data, inputs)       advance one tick (mutates world); inputs apply first, invalid ones are ignored.
 *                                   No area active: inputs only, then tick + 1 (the overworld is paused).
 *   worldHash(world)                8-hex fingerprint of all state (the campaign included).
 *   replayHashes(replay, data, ticks, every)   hashes every `every` ticks of a replay (replay.start, if set, starts it
 *                                   from campaignWorld instead of createWorld; tools and dev hooks only).
 *   serializeWorld(world)           save string (plain JSON).
 *   deserializeWorld(text, data)    LoadResult; refuses a different dataVersion ('dataVersion') or a malformed save
 *                                   ('corrupt', which includes a bad campaign shape).
 *
 * Campaign (H4; world.campaign, plain JSON). Areas, lanes and research are indexed in data order.
 *   campaign.active                 index into data.map.areas of the area being played, or null on the overworld.
 *   campaign.areaStartTick          tick of the current landing; area times are tick − areaStartTick.
 *   campaign.areas[i]               {reclaimedTick, entries, withdrawals, playTicks, reclaimPlayTicks, shipsBuilt, shipsLost}.
 *   campaign.reclaimOrder, research {id: level}, researchLog [{item, level, tick}], stockpile, shipAccum,
 *   totals {hauled, shipped}, wonTick (non-null after the probe core: only setTunable is valid then).
 *   The area fields (stock, nodes, routes, ships, guardians, yards, stats, capturedTick, ...) hold the active
 *   area, with its node subset in frame order (probe = 0); on the overworld they are empty.
 *   Capturing the heart reclaims the area (pays its haul once). Rule 10 ships Σ export × shipments.pct of the
 *   reclaimed areas into the stockpile while a held area is played (integer accumulators).
 *
 * Inputs (the `Input` union; node params are node indices, see world.nodes)
 *   enterArea{area}                 H4: land in an open area (held, and the tier-0 start or lane-joined to a reclaimed
 *                                   area). Valid on the overworld, before the win.
 *   leaveArea{}                     H4: back to the overworld; a withdraw (the area resets) if its heart isn't captured.
 *   buyResearch{item}               H4: next level of data.research[item], paid from the stockpile. Overworld only,
 *                                   before the win, below max, requirements met, affordable.
 *   Every input below except setTunable is valid only while an area is active.
 *   buildExtractor{node}            asteroids, captured pockets, the captured heart.
 *   buildRoute{from,to} upgradeRoute{from} cancelBuild{index} setRally{node} setTunable{key,value}
 *   setShipyard{shipType,on}        one yard per ship type ('drone' | 'lancer' | 'flak'); valid in any area. A lancer or
 *                                   flak yard only starts builds once its design is researched (H4 design gate).
 *   sendShips{from,to,counts}       counts = {drone, lancer, flak}, each an integer ≥ 0, clamped to the ships of
 *                                   that type at `from` (pass shipsAtByType(world, from) or SEND_ALL to send all).
 *                                   Valid if from ≠ to and the clamped total is ≥ 1.
 *   isValidInput(world, data, input)   would `step` accept it now? (grey out buttons with this)
 *   inputCost(world, input)            ore the build order would lock if queued now (0 for non-builds).
 *   clampSendCounts(world, from, counts)   what a sendShips order would really send.
 *
 * Map (H3; H4 areas use a subset in the same frame order): node 0 probe, a1-a9 asteroids, p1-p4 pockets, root, heart.
 *   Outside The Deep, find nodes by id (world.nodes[i].id), not by fixed index. world.guardians has one guardian
 *   per pocket, the Root and the heart, in node order. Each guardian holds Thorns and Spores (`guards`,
 *   id order) and its layout counts; caps are capEff(count) = min(60, floor(count × guard.capPct / 100)).
 *   Capturing the Root starves the heart (guardian.fed = false): it wilts to its starved caps, newest first.
 *   world.stock = {ore, ice, crystal, lens, plating}; world.yards and world.assemblers are at the probe.
 *   Yards (rule 5b): lancer and flak start before drones and take turns (world.yardTurn indexes YARD_ROTATION:
 *   the component yard tried first; each start passes the turn on), so neither starves the other when ore is short.
 *
 * Selectors (read-only; rates needing a decimal are in tenths, `…X10`)
 *   isCaptured(world), isRootCut(world)   heart captured? / Root cut?
 *   throughputPerMin(world)         ore delivered by routes over the last 60 s (headline HUD number, ore only).
 *   prizePerMin(world)              {ice, crystal} delivered over the last 60 s (small, under their chips).
 *   incomePerMin(world)             ore throughput + probe mining.
 *   shipsPerMinX10(world, type?)    ships/min ×10 one yard sustains at current ore income (0 if off).
 *   unlockStatus(world)             which resource chips and ship rows to show (hidden until first delivered).
 *   shipCounts(world)               ships at / en route to each node, total and by type; byType = HUD ship chips.
 *   shipsAtByType(world, node)      ships of each type parked at a node (send panel defaults).
 *   nodeStatus(world, node)         prize, extractors, extraction/min, buffer, backedUp, noRoute, route level/capacity.
 *   routeCapacityPerMin(world, lvl) units/min a route of that level carries.
 *   queueStatus(world)              unpaid orders, reserved ore, active build progress.
 *   yardStatus(world)               Yards block: per type on/off, unlocked (resource delivered here), researched (design),
 *                                   progress, cost, component, state ('building' | 'needsDesign' | 'noSource' | 'off' |
 *                                   'needsComponent' | 'needsOre' | 'ready'); rally; probe mining.
 *   assemblerStatus(world)          Assembly block: per component stock/cap, recipe, progress, state
 *                                   ('making' | 'full' | 'needsInput' | 'needsOre' | 'ready').
 *   guardianStatus(world, node)     a guarded node's sheet: prize, slots, rate, guard rows per type (count, cap,
 *                                   regrow, hp, damage, repair), guard hps for the ring, supply, and `tags`:
 *                                   Strong/Even/Weak per ship type (guard-hp-weighted, integer, division last).
 *   weightedMultPct(tun, ship, counts), counterTag(tun, ship, counts), tagFor(ship, pct)
 *                                   the tag math for any guard mix (bots pass capEff counts).
 *   supplyStatus(world)             hasRoot, Root alive, fed/starved, Root cut tick, the heart's fed and starved caps/regrow/repair.
 *   systemStatus(world)             layout index, id and name ("Frost Gate"), Root cut tick and second.
 *   combatRates(world, node, fleet) guards stripped per s ×10 for a fleet {drone, lancer, flak} vs regrowth per s ×10.
 *   battleStatus(world, node)       the battle running at that node with live guard counts and rates, or null.
 *   activeBattles(world)            every running battle, node order (banner lines).
 *   lastBattle(world, node)         the last finished battle there (toasts): guards at start, ships engaged/lost
 *                                   by type, guards killed by type; a Root capture carries `wilt` {from, to}.
 *                                   world.lastBattle is the latest at any node.
 *   runSummary(world)               heart capture time, capture order, ships built/lost by type, waves, ore spent,
 *                                   layout, Root cut, withered, delivered and first-delivered per resource, per target.
 *                                   Every `…Sec` is area-relative (since the landing); `…Tick` fields are world ticks.
 *   campaignStatus(world, data)     overworld HUD: active area, stockpile, shipPerMinX10, shipping, reclaimed count,
 *                                   wonTick, research levels.
 *   areaStatus(world, data, area)   area sheet: id, name, tier, x/y, state ('locked' | 'open' | 'reclaimed' | 'active'),
 *                                   lanes, haul, export, guarded nodes (caps, starved caps), hasRoot, heartTags
 *                                   {lancer, flak} with `researched`, and the visit record.
 *   researchStatus(world, data)     research sheet rows: level/max, next cost (after research.costPct), affordable,
 *                                   missing {resources, items, areas}, canBuy, effect and nextEffect (numbers).
 *   landingEffects(world)           openingOre, rigNodes, extractPct, yardTimePct, designs (the landing notice).
 *   campaignSummary(world, data)    win panel / bots: per area records, reclaim order, research order, total play
 *                                   ticks, ships built/lost, hauled and shipped.
 *   isAreaOpen(world, data, area), isWon(world), yardBuildTicks(world, type), extractPct(world), yardTimePct(world).
 *   nodeDistance(world, a, b)       integer distance used for routes and travel.
 *   heartIndex(world), rootIndex(world), PROBE   node index of the heart / the Root / the probe (always 0).
 *   guardianAt(world, node), isGuarded(world, node)   the guardian at a node (or null) / is it alive.
 *   capEff(n, capPct), guardCaps(world, g), countGuards(g)   effective caps and live counts per guard type.
 *   counterPct(tun, ship, guard)    the raw damage multiplier (strongPct, weakPct, or 100 for drones).
 *
 * Constants: SHIP_TYPES, GUARD_TYPES, RESOURCES, RAW_RESOURCES, COMPONENTS, COMPONENT_INPUT, SHIP_COMPONENT,
 *   YARD_ORDER, YARD_ROTATION, COMBAT_ORDER, TAG_STRONG_PCT, TAG_WEAK_PCT, GUARD_CAP_MAX, SEND_ALL.
 *
 * Tuning
 *   TUNABLE_KEYS, tunableMeta(data) every tunable: key, section, default, min, max, live, scope, newRunOnly.
 *   setTunable inputs change world.tun from that tick on; they are in the replay log, so replays reproduce tuned sessions.
 *   client.* tunables are client settings (scope 'client'): setTunable ignores them.
 *
 * Reading `World` fields directly is fine (it is plain data); never mutate it outside `step`.
 * Time: `world.tickRate` ticks per game second (30). Ships in transit: interpolate from
 * `ship.transit.{from,to,ticksLeft,totalTicks}`; pods from `route.pods[].ticksLeft` and
 * ceil(route.length / route.podSpeedSu).
 */
import simData from '../../../data/sim.json' with { type: 'json' };
import { parseSimData, type SimData } from './data.ts';
import type { ShipTypeCounts } from './world.ts';

export {
  COMBAT_ORDER,
  COMPONENTS,
  COMPONENT_INPUT,
  GUARD_CAP_MAX,
  GUARD_TYPES,
  RAW_RESOURCES,
  RESEARCH_IDS,
  RESOURCES,
  RIG_NODES,
  SHIP_COMPONENT,
  SHIP_TYPES,
  TUNABLE_KEYS,
  YARD_ORDER,
  YARD_ROTATION,
  parseSimData,
  tunableMeta,
} from './data.ts';
export type {
  AreaHeart,
  AreaLayout,
  Component,
  GuardMix,
  MapArea,
  MapLane,
  ResearchId,
  ResearchItem,
  ResearchKind,
  ResearchRequirement,
  ResourceTriple,
  GuardType,
  LayoutHeart,
  LayoutPocket,
  MapLayout,
  MapNode,
  NodeKind,
  Prize,
  RawResource,
  Resource,
  ShipType,
  SimData,
  SimTunableKey,
  TunableKey,
  TunableMeta,
  TunableSpec,
  Tunables,
} from './data.ts';
export {
  MIN_BUILD_TICKS,
  areaIndex,
  campaignWorld,
  designResearched,
  extractPct,
  isAreaOpen,
  isReclaimed,
  isWon,
  laneNeighbours,
  researchIndex,
  scaledCost,
  yardBuildTicks,
  yardTimePct,
} from './campaign.ts';
export type { CampaignStart } from './campaign.ts';
export { areaStatus, campaignStatus, campaignSummary, landingEffects, researchEffect, researchStatus } from './overworld.ts';
export type {
  AreaGuardedNode,
  AreaState,
  AreaStatus,
  CampaignStatus,
  CampaignSummary,
  HeartTag,
  LandingEffects,
  ReclaimEntry,
  ResearchRow,
} from './overworld.ts';
export {
  PROBE,
  capEff,
  chooseVariant,
  countGuards,
  createWorld,
  guardCaps,
  guardianAt,
  heartIndex,
  isGuarded,
  nodeDistance,
  researchLevel,
  rootIndex,
} from './world.ts';
export type {
  ActiveBuild,
  AreaRecord,
  Campaign,
  ResearchPurchase,
  Assembler,
  Battle,
  BattleOutcome,
  BattleResult,
  BuildKind,
  BuildOrder,
  Capture,
  Guard,
  GuardCounts,
  Guardian,
  Node,
  Pod,
  Route,
  Ship,
  ShipTypeCounts,
  Stats,
  Stock,
  SystemInfo,
  Transit,
  Wilt,
  World,
  Yard,
} from './world.ts';
export { clampSendCounts, inputCost, isValidInput } from './inputs.ts';
export type { Input } from './inputs.ts';
export { counterPct, step } from './step.ts';
export { replayHashes, worldHash } from './replay.ts';
export type { Replay } from './replay.ts';
export { deserializeWorld, serializeWorld } from './save.ts';
export type { LoadResult } from './save.ts';
export {
  TAG_STRONG_PCT,
  TAG_WEAK_PCT,
  activeBattles,
  assemblerStatus,
  battleStatus,
  combatRates,
  counterTag,
  guardianStatus,
  incomePerMin,
  isCaptured,
  isRootCut,
  lastBattle,
  nodeStatus,
  prizePerMin,
  queueStatus,
  routeCapacityPerMin,
  runSummary,
  shipCounts,
  shipsAtByType,
  shipsPerMinX10,
  supplyStatus,
  systemStatus,
  tagFor,
  throughputPerMin,
  unlockStatus,
  weightedMultPct,
  yardStatus,
} from './selectors.ts';
export type {
  AssemblerRow,
  AssemblerState,
  BattleStatus,
  CaptureEntry,
  CombatRates,
  CounterTag,
  GuardRow,
  GuardianStatus,
  HeartParams,
  NodeStatus,
  QueueStatus,
  RouteStatus,
  RunSummary,
  ShipCounts,
  SupplyStatus,
  SystemStatus,
  Tag,
  TargetSummary,
  UnlockStatus,
  YardRow,
  YardState,
  YardStatus,
} from './selectors.ts';
export { nextInt, nextU32 } from './rng.ts';
export { canonicalize, fnv1a, hashState } from './hash.ts';

/** data/sim.json, validated. */
export const defaultData: SimData = parseSimData(simData);

/** A sendShips `counts` that sends every ship at the source (each count is clamped to what is there). */
export const SEND_ALL: Readonly<ShipTypeCounts> = Object.freeze({ drone: 1_000_000, lancer: 1_000_000, flak: 1_000_000 });
