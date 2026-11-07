/**
 * @factory4x/sim — the deterministic game simulation (DESIGN.md H1, plus H2: the Root, supply and variants).
 *
 * PUBLIC API. The client, bots and tests depend only on what this file
 * exports. Treat it as stable: add, don't rename or remove, without a
 * DECISIONS.md entry.
 *
 * Lifecycle
 *   defaultData                     validated data/sim.json (tunables + map).
 *   parseSimData(raw)               validate other data (e.g. a feedback replay's) → SimData; throws on bad data.
 *   createWorld(seed, data)         fresh World at tick 0. The system variant is system.variant − 1 if
 *                                   that tunable's default is > 0, else ((seed mod 3) + 3) mod 3.
 *   step(world, data, inputs)       advance one tick (mutates world); inputs apply first, invalid ones are ignored.
 *   worldHash(world)                8-hex fingerprint of all state.
 *   replayHashes(replay, data, ticks, every)   hashes every `every` ticks of a replay.
 *   serializeWorld(world)           save string (plain JSON).
 *   deserializeWorld(text, data)    LoadResult; refuses a different dataVersion ('dataVersion') or a malformed save ('corrupt').
 *
 * Inputs (the `Input` union; node params are node indices, see world.nodes)
 *   buildExtractor{node} buildRoute{from,to} upgradeRoute{from} cancelBuild{index}
 *   setShipyard{on} sendShips{from,to,count(0=all)} setRally{node} setTunable{key,value}
 *   isValidInput(world, data, input)   would `step` accept it now? (grey out buttons with this)
 *   inputCost(world, input)            ore the build order would lock if queued now (0 for non-builds).
 *
 * Guarded nodes (H2): the Bloom guards `rich` (index 6), the Root guards `root` (index 7).
 *   world.guardians is [Bloom, Root] (node order); each has its own battle and lastBattle.
 *   Capturing the Root cuts the supply: the Bloom wilts to bloom.starvedCap and uses the starved values.
 *
 * Selectors (read-only; rates needing a decimal are in tenths, `…X10`)
 *   Selectors that take an optional `node` default to the rich node, so H1 callers get the Bloom.
 *   isCaptured(world)               rich node (Bloom) captured?
 *   isRootCut(world)                Root captured?
 *   throughputPerMin(world)         ore delivered by routes over the last 60 s (headline HUD number).
 *   incomePerMin(world)             throughput + probe mining.
 *   shipsPerMinX10(world)           ships/min ×10 the yard sustains at current income (0 if off).
 *   shipCounts(world)               ships parked at / en route to each node, and total.
 *   nodeStatus(world, node)         extractors, extraction/min, buffer, backedUp, noRoute, route level/capacity.
 *   routeCapacityPerMin(world, lvl) ore/min a route of that level carries.
 *   queueStatus(world)              unpaid orders, reserved ore, active build progress.
 *   shipyardStatus(world)           on/off, build progress, rally, probe mining/min.
 *   guardianStatus(world, node?)    thorns vs effective cap, regrowth progress, thorn and ship hp/damage, supply (Bloom: fed/starved).
 *   supplyStatus(world)             Root alive, fed or starved, Root cut tick, the Bloom's fed and starved values, Root cap.
 *   systemStatus(world)             variant index, id and name ("Thin Root"), Root cut tick and second.
 *   combatRates(world, ships, node?)  kill rate vs effective regrowth (thorns/s ×10) for a wave size.
 *   battleStatus(world, node?)      the battle running at that node with live rates, or null.
 *   activeBattles(world)            every running battle, Bloom first (banner lines).
 *   lastBattle(world, node?)        the last finished battle at that node (toast), or null; a Root capture carries `wilt` {from, to}.
 *                                   world.lastBattle is the latest at any node.
 *   runSummary(world)               capture time, peak ore/min, ships built/lost, waves, ore spent, system, Root cut, withered, per-target waves/losses.
 *   nodeDistance(world, a, b)       integer distance used for routes and travel.
 *   richIndex(world), rootIndex(world), PROBE   node index of the rich node / the Root / the probe (always 0).
 *   guardianAt(world, node), isGuarded(world, node)   the guardian at a node (or null) / is it alive.
 *   guardianParams(world, g), bloomParams(world, fed), rootCap(world)   effective cap, regrow ticks, repair.
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

export { TUNABLE_KEYS, parseSimData, tunableMeta } from './data.ts';
export { ROOT_CAP_MAX } from './data.ts';
export type { MapNode, MapVariant, NodeKind, SimData, SimTunableKey, TunableKey, TunableMeta, TunableSpec, Tunables } from './data.ts';
export {
  PROBE,
  bloomFed,
  bloomParams,
  chooseVariant,
  createWorld,
  guardianAt,
  guardianParams,
  isGuarded,
  nodeDistance,
  richIndex,
  rootCap,
  rootIndex,
} from './world.ts';
export type {
  ActiveBuild,
  Battle,
  BattleOutcome,
  BattleResult,
  BuildKind,
  BuildOrder,
  Guardian,
  GuardianParams,
  Node,
  Pod,
  Route,
  Ship,
  Stats,
  SystemInfo,
  Thorn,
  Transit,
  Wilt,
  World,
} from './world.ts';
export { inputCost, isValidInput } from './inputs.ts';
export type { Input } from './inputs.ts';
export { step } from './step.ts';
export { replayHashes, worldHash } from './replay.ts';
export type { Replay } from './replay.ts';
export { deserializeWorld, serializeWorld } from './save.ts';
export type { LoadResult } from './save.ts';
export {
  activeBattles,
  battleStatus,
  combatRates,
  guardianStatus,
  incomePerMin,
  isCaptured,
  isRootCut,
  lastBattle,
  nodeStatus,
  queueStatus,
  routeCapacityPerMin,
  runSummary,
  shipCounts,
  shipsPerMinX10,
  shipyardStatus,
  supplyStatus,
  systemStatus,
  throughputPerMin,
} from './selectors.ts';
export type {
  BattleStatus,
  CombatRates,
  GuardianStatus,
  NodeStatus,
  QueueStatus,
  RouteStatus,
  RunSummary,
  ShipCounts,
  ShipyardStatus,
  SupplyStatus,
  SystemStatus,
} from './selectors.ts';
export { nextInt, nextU32 } from './rng.ts';
export { canonicalize, fnv1a, hashState } from './hash.ts';

/** data/sim.json, validated. */
export const defaultData: SimData = parseSimData(simData);
