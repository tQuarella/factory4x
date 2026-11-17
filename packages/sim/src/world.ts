import {
  BUILD_TYPES,
  GUARD_CAP_MAX,
  GUARD_TYPES,
  RIG_NODES,
  SIM_TUNABLE_KEYS,
  runMode,
  type AreaHeart,
  type BuildType,
  type EconType,
  type AreaLayout,
  type Component,
  type GuardType,
  type MapLayout,
  type NodeKind,
  type RawResource,
  type ResearchId,
  type Resource,
  type ResourceTriple,
  type ShipType,
  type SimData,
  type Tunables,
} from './data.ts';
import type { Raid, RaidResult } from './factions/index.ts';
import { isqrt } from './math.ts';

/**
 * World state (DESIGN.md H1 "Entities and state", with the H2, H3 and H4
 * changes). One World holds the campaign (`campaign`) and the one area being
 * played (the H3 fields, empty on the overworld). Plain JSON data only: no classes, no Maps, no undefined fields
 * (absent values are null), so JSON.stringify round-trips it exactly and the
 * hash covers all of it.
 *
 * Storage: each entity type is a dense array kept sorted by ascending id.
 * Ids come from one counter (`nextId`), new entities are appended, and dead
 * ones are removed with an order-preserving filter, so iteration order is
 * always id order. Nodes are indexed by their map position.
 */

export interface Node {
  index: number;
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  r: number;
  /** Extractor slots (pockets: from the layout). */
  slots: number;
  /** What the node yields and its buffer holds: ore for asteroids and the heart, ice or crystal for pockets, null for the probe and the Root. */
  prize: RawResource | null;
  owned: boolean;
  extractors: number;
  /** Units of `prize` waiting for pickup, ≤ node.bufferCap. */
  buffer: number;
  /** Extraction accumulator in units·ticks/min; 1 unit per T. */
  accum: number;
}

export type BuildKind = 'extractor' | 'route' | 'upgrade';

/** An unpaid build order. `cost` (ore) is locked when queued. */
export interface BuildOrder {
  kind: BuildKind;
  node: number;
  cost: number;
}

export interface ActiveBuild {
  kind: BuildKind;
  node: number;
  ticksLeft: number;
}

export interface Pod {
  /** What it carries, copied from the source node. */
  res: RawResource;
  amount: number;
  ticksLeft: number;
}

export interface Route {
  id: number;
  from: number;
  to: number;
  length: number;
  level: number;
  /** Ticks until the next pod may launch. */
  cooldown: number;
  /** In flight, oldest first. */
  pods: Pod[];
}

export interface Transit {
  from: number;
  to: number;
  ticksLeft: number;
  totalTicks: number;
}

export interface Ship {
  id: number;
  type: ShipType;
  hp: number;
  /** Node index when parked; null while in transit. */
  at: number | null;
  transit: Transit | null;
  /** Id of the last battle this ship fought a round in, or -1. Used to count distinct ships engaged. */
  engagedIn: number;
}

/**
 * H7: an economy ship (extractor or hauler). Kept apart from `world.ships` (the warships) in `world.field.econ`,
 * in id order; ids come from the same `nextId` counter, so ids are unique across both arrays.
 */
export interface EconShip {
  id: number;
  type: EconType;
  hp: number;
  /** Node index when parked; null while in transit. */
  at: number | null;
  transit: Transit | null;
  /**
   * Extractor: the node it is bound to (F5: from dispatch on, so its slot is reserved in flight), or null when
   * unbound (idle at the probe, or flying home). Hauler: its assigned node (F6), or null when idle.
   */
  target: number | null;
  /** Hauler: units carried (0 for extractors) and what they are (null when empty). */
  cargo: number;
  cargoRes: RawResource | null;
}

/** A count per economy ship type. */
export interface EconTypeCounts {
  extractor: number;
  hauler: number;
}

/** H7 R8 / F14: raids by outcome. `mustered` counts every raid that entered its muster. */
export interface RaidStats {
  mustered: number;
  beaten: number;
  hit: number;
  turnedBack: number;
}

/** H9 W6: raid prongs by outcome (`stats.raidProngs`). Counted per prong by h9-raids; zeros until then. */
export interface ProngStats {
  beaten: number;
  hit: number;
  turnedBack: number;
}

/**
 * H7 field-mode state (DESIGN.md H7 F2–F6). Null in a campaign world. Per-type records use BUILD_TYPES keys
 * and per-node arrays are indexed by node index.
 */
export interface FieldState {
  /** F2: the weight per type, 0..alloc.maxWeight. */
  alloc: Record<BuildType, number>;
  /** F2: ore set aside per type, 0..the type's ore cost. */
  share: Record<BuildType, number>;
  /** F2: the smooth weighted round-robin counters (0 while the type isn't eligible). */
  allocCur: Record<BuildType, number>;
  /** F3: the economy bays (the warship bays are `world.yards`; their `on` flag is unused in field mode). */
  bays: Record<EconType, Yard>;
  /** The economy ships, in id order. */
  econ: EconShip[];
  /** Per node: Mine-marked. */
  mine: boolean[];
  /** Per node: free extractors from a capture (F4: not ships, can't be killed). */
  free: number[];
  /** Per node: units delivered by haulers per game second, the same ring as stats.deliveredBuckets (rockStatus). */
  rockBuckets: number[][];
  /**
   * H8 H7 (`setHaulers`): per node, the hauler count the player set, or null for Auto (the H1 need). Kept while the
   * rock is unmarked; read through `haulerSetOf`, which caps it at rock.haulerMax.
   */
  haulerSet: (number | null)[];
  /**
   * H9 X1 (`setExtractors`): per node, the extractor count the player set, or null for All (the slots). Kept while
   * the rock is unmarked; read through `extCap` (field.ts), which is this or the node's slots.
   */
  extractorSet: (number | null)[];
  /**
   * H10 D2: ticks toward the hive's next rebuilt guard while `hive.rebuildTicks` > 0 (one counter for both types; D3
   * picks the type at completion). 0 while the hive is full, while `hive.rebuildTicks` is 0, and after the capture (D5).
   */
  hiveRebuildProgress: number;
}

export interface Guard {
  id: number;
  type: GuardType;
  hp: number;
}

/** A count per guard type. */
export interface GuardCounts {
  thorn: number;
  spore: number;
}

/** A count per ship type. */
export interface ShipTypeCounts {
  drone: number;
  lancer: number;
  flak: number;
}

/** Everything at the probe: one integer per resource. */
export type Stock = Record<Resource, number>;

/** Combat state at one guarded node. */
export interface Battle {
  /** From `nextId`; ships remember the last battle they fought in (`Ship.engagedIn`). */
  id: number;
  /** The guarded node it is fought at. */
  node: number;
  startTick: number;
  /** Guards alive when the battle started, by type (the repelled toast names the dominant one). */
  guardsAtStart: GuardCounts;
  /** Distinct ships that fought a round here, total and by type. */
  shipsEngaged: number;
  engagedByType: ShipTypeCounts;
  shipsLost: number;
  lostByType: ShipTypeCounts;
  guardsKilled: number;
  killedByType: GuardCounts;
  /**
   * H5: the fleet limit (fleetCap) when the wave was sent, or null when the limit is off (the repelled hint).
   * Set when the battle starts and refreshed by every attack order on this node while it runs; research is
   * never bought inside an area, so it differs from the limit at send time only after live tuning.
   */
  capAtSend: number | null;
}

export type BattleOutcome = 'captured' | 'repelled' | 'withdrew';

/** The heart's wilt when the Root is cut: guard counts per type before and after. */
export interface Wilt {
  from: GuardCounts;
  to: GuardCounts;
}

export interface BattleResult extends Battle {
  endTick: number;
  outcome: BattleOutcome;
  /** Set on the Root's `captured` result when the heart was alive (to = from if it was already at or below its starved caps); otherwise null. */
  wilt: Wilt | null;
}

/**
 * One guardian per guarded node (pockets, the Root, the heart), in
 * node-index order. `world.guardians` never changes length, so the systems
 * loop over it in that order.
 */
export interface Guardian {
  /** The node it guards. */
  node: number;
  alive: boolean;
  /** Ascending id (oldest first), both types mixed. */
  guards: Guard[];
  /** Ticks toward the next guard of each type. */
  regrowProgress: GuardCounts;
  /** The layout's guard counts for this node (before guard.capPct). */
  counts: GuardCounts;
  /** The heart's starved counts (before guard.capPct); null for other nodes. */
  starvedCounts: GuardCounts | null;
  /** The heart: true until the Root is cut. Other nodes: null. */
  fed: boolean | null;
  /** The battle running at this node, or null. */
  battle: Battle | null;
  /** The last finished battle at this node, or null. */
  lastBattle: BattleResult | null;
  /** Attacks ordered at this node while it was guarded (at most one per tick). */
  wavesSent: number;
  /** Ships lost and guards killed in battles at this node. */
  shipsLost: number;
  guardsKilled: number;
}

/** The layout chosen at world creation (DESIGN.md H3 "Layouts"). Fixed for the run. */
export interface SystemInfo {
  /** Index into data `map.layouts` (0 frost, 1 glass, 2 twin in the shipped data). */
  variant: number;
  id: string;
  name: string;
}

export interface Capture {
  node: number;
  tick: number;
}

export interface Stats {
  /** Ore delivered by routes per game second, ring buffer indexed by (tick / tickRate) mod length (the headline ore/min). */
  deliveredBuckets: number[];
  /** The same ring buffers for ice and crystal (shown small under their chips). */
  prizeBuckets: { ice: number[]; crystal: number[] };
  /** Total delivered by routes, per resource. */
  delivered: Record<RawResource, number>;
  /** Tick each resource was first delivered by a route, or null. Unlocks the chips and the lancer/flak rows. */
  firstDeliveredTick: Record<RawResource, number | null>;
  peakPerMin: number;
  shipsBuilt: ShipTypeCounts;
  shipsLost: ShipTypeCounts;
  componentsBuilt: Record<Component, number>;
  guardsKilled: GuardCounts;
  /** Heart guards removed by the wilt (not kills). */
  guardsWithered: number;
  wavesSent: number;
  firstShipTick: number | null;
  oreSpentShips: number;
  oreSpentEconomy: number;
  oreSpentComponents: number;
  /** H5: ships scrapped by recycleShips, by type (not counted as lost), and the ore they refunded. */
  shipsRecycled: ShipTypeCounts;
  oreRefunded: number;
  /** Tick the Root was captured, or null. */
  rootCutTick: number | null;
  /** Every capture, in order. The heart's also sets `world.capturedTick`. */
  captures: Capture[];
  /** H6: the haul this visit's reclaim paid into the stockpile (decayed for a repeat), or null before the reclaim. */
  haulPaid: ResourceTriple | null;
  /** H7 (field mode; always zero in a campaign): economy ships built, lost (F14 `econLost`) and recycled, by type. */
  econBuilt: EconTypeCounts;
  econLost: EconTypeCounts;
  econRecycled: EconTypeCounts;
  /** H7 F14: raids by outcome (R8; h7-raids counts them). */
  raids: RaidStats;
  /** H9 W6: raid prongs by their own outcome (`raids` keeps counting raids by the overall outcome). */
  raidProngs: ProngStats;
  /** H10 L3: raid prongs that rolled on to another rock (`raid.rollMax`); 0 while it is 0. */
  raidRolls: number;
  /** H7 F14: setAlloc inputs that changed a weight. */
  allocChanges: number;
  /** H7 F14: most economy ships alive at once. */
  peakEcon: number;
}

export interface Yard {
  on: boolean;
  /** 0 = idle. */
  ticksLeft: number;
}

export interface Assembler {
  /** 0 = idle. */
  ticksLeft: number;
}

/** One overworld area's record (DESIGN.md H4 "Entities and state"). Times are game ticks. */
export interface AreaRecord {
  /** Tick its heart was captured (the area was reclaimed), or null while held. */
  reclaimedTick: number | null;
  /** Landings, and landings that ended in a withdraw. */
  entries: number;
  withdrawals: number;
  /** Ticks played here while it was held, over every visit (a visit ends at the reclaim or the withdraw; free play after a reclaim isn't counted). */
  playTicks: number;
  /** Ticks of the reclaiming visit, landing to heart capture; null while held. */
  reclaimPlayTicks: number | null;
  /** Ships built and lost here while it was held, over every visit. */
  shipsBuilt: number;
  shipsLost: number;
  /** H5: ships recycled here while it was held, and the ore they refunded, over every visit (recorded as shipsBuilt is). */
  shipsRecycled: number;
  oreRefunded: number;
  /** H6: the haul the reclaim paid (decayed for a repeat in its group), or null while held. */
  haulPaid: ResourceTriple | null;
}

/** One research purchase, in order. `item` is the research item id. */
export interface ResearchPurchase {
  item: string;
  level: number;
  tick: number;
}

/**
 * The campaign (DESIGN.md H4): the overworld state around the one area being
 * played. Plain JSON; hashed and saved with the rest of the world.
 */
export interface Campaign {
  /** Index into data `map.areas` of the area being played, or null on the overworld. */
  active: number | null;
  /** Tick of the current landing (area times are tick − areaStartTick). */
  areaStartTick: number;
  /** The H3 layout index The Deep uses (chosen at world creation, as H3 chose its variant). Same as `world.system.variant`. */
  deepLayout: number;
  /** One per data `map.areas` entry, in data order. */
  areas: AreaRecord[];
  /** Area indices in the order they were reclaimed. */
  reclaimOrder: number[];
  /** Level per research item id (every data `research` id, 0 until bought). */
  research: Record<string, number>;
  /** Every purchase, in order. */
  researchLog: ResearchPurchase[];
  /** The overworld stockpile: what hauls and shipments paid in, minus research spent. */
  stockpile: ResourceTriple;
  /** Rule 10 accumulators, in units·ticks/min × 100: a unit ships each time one reaches ticksPerMin × 100. */
  shipAccum: ResourceTriple;
  totals: { hauled: ResourceTriple; shipped: ResourceTriple };
  /** Tick the probe core was bought (the win), or null. */
  wonTick: number | null;
}

export interface World {
  tick: number;
  rng: number;
  dataVersion: number;
  tickRate: number;
  nextId: number;
  /** Live sim tunables. Starts from data defaults; `setTunable` changes it. */
  tun: Tunables;
  /** Resources at the probe. */
  stock: Stock;
  /** Probe mining accumulator (ore only). */
  probeAccum: number;
  /** Unpaid build orders, FIFO. */
  queue: BuildOrder[];
  activeBuild: ActiveBuild | null;
  /** Rule 5a; run in the order lens, plating. */
  assemblers: Record<Component, Assembler>;
  /** Rule 5b; ships finish in the order lancer, flak, drone. */
  yards: Record<ShipType, Yard>;
  /**
   * Rule 5b round-robin: index into YARD_ROTATION (0 lancer, 1 flak) of the
   * component yard tried first for the next start. When a component yard
   * starts a build it moves to the yard after it, so the one that started
   * least recently goes first. Starts at 0.
   */
  yardTurn: number;
  rally: number;
  nodes: Node[];
  routes: Route[];
  ships: Ship[];
  /** One per guarded node, in node-index order. */
  guardians: Guardian[];
  /** The most recent finished battle at any node (`node` says which). Per node: `guardians[i].lastBattle`. */
  lastBattle: BattleResult | null;
  stats: Stats;
  /** Tick the heart was captured, or null. */
  capturedTick: number | null;
  /** The H3 layout The Deep uses (H4: chosen at world creation, fixed for the campaign). */
  system: SystemInfo;
  /**
   * The overworld (H4). Every field above from `stock` to `capturedTick` is
   * the active area's state; on the overworld they are empty (no nodes,
   * guardians, ships or routes; zero stock).
   */
  campaign: Campaign;
  /**
   * H7: the field-mode state, or null in a campaign world. A field-mode world (`createWorld` on data with
   * run.mode 'field') holds the field in the area fields above with `campaign.active` null, and this is set.
   */
  field: FieldState | null;
  /** H7 R1: the raid in progress, or null. Always null in a campaign world. */
  raid: Raid | null;
  /** H7 R1: no raid musters before this tick (R8 sets it from the end of a raid). */
  nextRaidTick: number;
  /** H7 R8: what the last finished raid did (raidStatus().last), or null. */
  lastRaid: RaidResult | null;
}

/** H7: true for a field-mode world. */
export function isField(world: Readonly<World>): boolean {
  return world.field !== null;
}

/** H7: the field state; throws in a campaign world. */
export function fieldOf(world: Readonly<World>): FieldState {
  if (world.field === null) throw new Error('not a field-mode world');
  return world.field;
}

/** The probe is always node 0 (enforced by parseSimData). */
export const PROBE = 0;

/** Integer distance between two node centers: floor(sqrt(dx² + dy²)). Routes and ship travel use it. */
export function nodeDistance(world: Readonly<World>, a: number, b: number): number {
  const na = world.nodes[a]!;
  const nb = world.nodes[b]!;
  const dx = na.x - nb.x;
  const dy = na.y - nb.y;
  return isqrt(dx * dx + dy * dy);
}

/** The route whose source is `from`, or null. */
export function routeFrom(world: Readonly<World>, from: number): Route | null {
  for (const r of world.routes) if (r.from === from) return r;
  return null;
}

/** Ticks per game minute. */
export function ticksPerMin(world: Readonly<World>): number {
  return world.tickRate * 60;
}

/** Units per minute one extractor at a node of this kind yields (0 for nodes that never extract). Moved from step.ts (h8-sim). */
export function perExtractorPerMin(t: Readonly<Tunables>, kind: NodeKind): number {
  if (kind === 'asteroid') return t['extractor.orePerMin'];
  if (kind === 'pocket') return t['pocket.resourcePerMin'];
  if (kind === 'heart') return t['heart.orePerMin'];
  return 0;
}

function indexOfKind(world: Readonly<World>, kind: NodeKind): number {
  const nodes = world.nodes;
  for (let i = 0; i < nodes.length; i++) if (nodes[i]!.kind === kind) return i;
  return -1;
}

/** Index of the Bloom heart (H1's rich node). Every area has one; throws on the overworld (no area active). */
export function heartIndex(world: Readonly<World>): number {
  const i = indexOfKind(world, 'heart');
  if (i < 0) throw new Error('world has no heart node (no area is active)');
  return i;
}

/** Index of the Root, or -1 when the active area has none (H4: light areas and Landfall have no Root). */
export function rootIndex(world: Readonly<World>): number {
  return indexOfKind(world, 'root');
}

/** True for the kinds that have a guardian: pockets, the Root and the heart. */
export function isGuardedKind(kind: NodeKind): boolean {
  return kind === 'pocket' || kind === 'root' || kind === 'heart';
}

/** The guardian at `node`, or null if the node isn't a guarded node. */
export function guardianAt(world: Readonly<World>, node: number): Guardian | null {
  for (const g of world.guardians) if (g.node === node) return g;
  return null;
}

/** True while `node` has a living guardian (sending ships there is an attack). */
export function isGuarded(world: Readonly<World>, node: number): boolean {
  const g = guardianAt(world, node);
  return g !== null && g.alive;
}

/** Effective cap for a layout count n: min(60, floor(n × guard.capPct / 100)). */
export function capEff(n: number, capPct: number): number {
  return Math.min(GUARD_CAP_MAX, Math.floor((n * capPct) / 100));
}

/** True while `g` is the heart's guardian and the Root has been cut. */
export function isStarved(g: Readonly<Guardian>): boolean {
  return g.fed === false;
}

/** The counts `g` regrows to now (before capEff): the layout's, or the heart's starved counts once the Root is cut. */
function baseCounts(g: Readonly<Guardian>): GuardCounts {
  return isStarved(g) && g.starvedCounts !== null ? g.starvedCounts : g.counts;
}

/** Effective cap per type for guardian `g` now (rule 9). */
export function guardCaps(world: Readonly<World>, g: Readonly<Guardian>): GuardCounts {
  const b = baseCounts(g);
  const pct = world.tun['guard.capPct'];
  return { thorn: capEff(b.thorn, pct), spore: capEff(b.spore, pct) };
}

/** Regrowth period of one guard type at `g` now: guard.<type>.regrowTicks, × bloom.starvedRegrowMul for the starved heart. */
export function guardRegrowTicks(world: Readonly<World>, g: Readonly<Guardian>, type: GuardType): number {
  const base = world.tun[`guard.${type}.regrowTicks`];
  return isStarved(g) ? base * world.tun['bloom.starvedRegrowMul'] : base;
}

/** Repair per round of one guard type at `g` now: guard.<type>.repairPerRound, or bloom.starvedRepairPerRound for the starved heart. */
export function guardRepair(world: Readonly<World>, g: Readonly<Guardian>, type: GuardType): number {
  return isStarved(g) ? world.tun['bloom.starvedRepairPerRound'] : world.tun[`guard.${type}.repairPerRound`];
}

/** Living guards of `g` by type. */
export function countGuards(g: Readonly<Guardian>): GuardCounts {
  const c: GuardCounts = { thorn: 0, spore: 0 };
  for (const gd of g.guards) c[gd.type] += 1;
  return c;
}

/** Appends a full-hp guard of `type` with a new id. */
export function addGuard(world: World, g: Guardian, type: GuardType): void {
  g.guards.push({ id: world.nextId++, type, hp: world.tun[`guard.${type}.hp`] });
}

/** The layout index a new world uses: `forced - 1` when `forced > 0` (system.variant), else ((seed mod n) + n) mod n. */
export function chooseVariant(seed: number, forced: number, layoutCount: number): number {
  if (forced > 0) return Math.min(forced, layoutCount) - 1;
  return (((seed | 0) % layoutCount) + layoutCount) % layoutCount;
}

/** The guard counts of one guarded node, from an H3 layout or an area layout (H4). */
function guardianFor(layout: MapLayout | AreaLayout, n: Node, hasRoot: boolean): Pick<Guardian, 'counts' | 'starvedCounts' | 'fed'> {
  if (n.kind === 'pocket') {
    const p = layout.pockets[n.id]!;
    return { counts: { thorn: p.thorns, spore: p.spores }, starvedCounts: null, fed: null };
  }
  if (n.kind === 'root') {
    const r = layout.root!;
    return { counts: { thorn: r.thorns, spore: r.spores }, starvedCounts: null, fed: null };
  }
  const h: AreaHeart = layout.heart;
  // With no Root in the area the heart can't starve: no starved counts, and `fed` stays true for good.
  const starved =
    hasRoot && h.starvedThorns !== undefined && h.starvedSpores !== undefined ? { thorn: h.starvedThorns, spore: h.starvedSpores } : null;
  return { counts: { thorn: h.thorns, spore: h.spores }, starvedCounts: starved, fed: true };
}

const zeroShips = (): ShipTypeCounts => ({ drone: 0, lancer: 0, flak: 0 });
const zeroTriple = (): ResourceTriple => ({ ore: 0, ice: 0, crystal: 0 });
const zeroEcon = (): EconTypeCounts => ({ extractor: 0, hauler: 0 });

/** Fresh area statistics (every visit starts its own). */
function freshStats(data: SimData): Stats {
  const window = data.tunables['stats.throughputWindowSec'].default;
  const ring = (): number[] => new Array<number>(window).fill(0);
  return {
    deliveredBuckets: ring(),
    prizeBuckets: { ice: ring(), crystal: ring() },
    delivered: { ore: 0, ice: 0, crystal: 0 },
    firstDeliveredTick: { ore: null, ice: null, crystal: null },
    peakPerMin: 0,
    shipsBuilt: zeroShips(),
    shipsLost: zeroShips(),
    componentsBuilt: { lens: 0, plating: 0 },
    guardsKilled: { thorn: 0, spore: 0 },
    guardsWithered: 0,
    wavesSent: 0,
    firstShipTick: null,
    oreSpentShips: 0,
    oreSpentEconomy: 0,
    oreSpentComponents: 0,
    shipsRecycled: zeroShips(),
    oreRefunded: 0,
    rootCutTick: null,
    captures: [],
    haulPaid: null,
    econBuilt: zeroEcon(),
    econLost: zeroEcon(),
    econRecycled: zeroEcon(),
    raids: { mustered: 0, beaten: 0, hit: 0, turnedBack: 0 },
    raidProngs: { beaten: 0, hit: 0, turnedBack: 0 },
    raidRolls: 0,
    allocChanges: 0,
    peakEcon: 0,
  };
}

/** The world fields that hold the active area. */
type AreaFields = Pick<
  World,
  | 'stock'
  | 'probeAccum'
  | 'queue'
  | 'activeBuild'
  | 'assemblers'
  | 'yards'
  | 'yardTurn'
  | 'rally'
  | 'nodes'
  | 'routes'
  | 'ships'
  | 'guardians'
  | 'lastBattle'
  | 'stats'
  | 'capturedTick'
>;

/** The area fields with no area active: nothing on the map, nothing in stock, every yard off. */
function emptyAreaFields(data: SimData): AreaFields {
  return {
    stock: { ore: 0, ice: 0, crystal: 0, lens: 0, plating: 0 },
    probeAccum: 0,
    queue: [],
    activeBuild: null,
    assemblers: { lens: { ticksLeft: 0 }, plating: { ticksLeft: 0 } },
    yards: { drone: { on: false, ticksLeft: 0 }, lancer: { on: false, ticksLeft: 0 }, flak: { on: false, ticksLeft: 0 } },
    yardTurn: 0,
    rally: PROBE,
    nodes: [],
    routes: [],
    ships: [],
    guardians: [],
    lastBattle: null,
    stats: freshStats(data),
    capturedTick: null,
  };
}

/** Clears the area fields (H4 "Leaving"): ships, buildings and local stock are gone; the map is empty. */
export function clearArea(world: World, data: SimData): void {
  Object.assign(world, emptyAreaFields(data));
}

/** The level of a research item (0 if never bought). */
export function researchLevel(world: Readonly<World>, id: ResearchId): number {
  return world.campaign.research[id] ?? 0;
}

/**
 * Builds area `a` fresh from data as the active area (DESIGN.md H4
 * "Landing", steps 1-6): its nodes in frame order, one full guardian per
 * pocket, Root and heart, the opening stock, the yards per researched design,
 * and the seed rigs. Used by `enterArea` and by `campaignWorld` with `land`.
 */
export function landArea(world: World, data: SimData, a: number): void {
  const area = data.map.areas[a]!;
  const camp = world.campaign;
  const t = world.tun;
  const layout: MapLayout | AreaLayout = area.layout === 'seed' ? data.map.layouts[camp.deepLayout]! : area.layout;
  Object.assign(world, emptyAreaFields(data));
  // 1-2. Nodes and full guardians.
  placeNodes(world, data, area.nodes, layout);
  // 3. Opening stock: economy.startStock (read now, so it is live) plus the Opening ore research.
  world.stock.ore = t['economy.startStock'] + researchLevel(world, 'opening') * t['research.opening.step'];
  // 4. Yards: drones on (the first ship early matters); a researched design's yard starts on and waits for its component.
  world.yards.drone.on = true;
  world.yards.lancer.on = researchLevel(world, 'lancer') >= 1;
  world.yards.flak.on = researchLevel(world, 'flak') >= 1;
  // 5. Seed rigs: the first L of a1, a2 start owned, each with one extractor and a level-1 route to the probe, free.
  const rigs = Math.min(researchLevel(world, 'rigs'), RIG_NODES.length);
  for (let k = 0; k < rigs; k++) {
    const node = world.nodes.find((n) => n.id === RIG_NODES[k]);
    if (node === undefined) continue;
    node.owned = true;
    node.extractors = 1;
    world.routes.push({ id: world.nextId++, from: node.index, to: PROBE, length: nodeDistance(world, node.index, PROBE), level: 1, cooldown: 0, pods: [] });
  }
  // 6. The visit starts.
  camp.active = a;
  camp.areaStartTick = world.tick;
  camp.areas[a]!.entries += 1;
}

/**
 * Landing steps 1-2, shared by landArea and the H7 field: the frame nodes listed in `ids`, in frame order (so the
 * probe is index 0), and one full guardian per guarded node, in node order (ids in guardian order, Thorns before
 * Spores).
 */
function placeNodes(world: World, data: SimData, ids: readonly string[], layout: MapLayout | AreaLayout): void {
  // 1. Nodes: the frame nodes present, in frame order (so the probe is index 0).
  const frame = data.map.nodes.filter((n) => ids.includes(n.id));
  world.nodes = frame.map((n, index) => {
    const pocket = n.kind === 'pocket' ? layout.pockets[n.id]! : null;
    return {
      index,
      id: n.id,
      kind: n.kind,
      x: n.x,
      y: n.y,
      r: n.r,
      slots: pocket ? pocket.slots : n.slots,
      prize: pocket ? pocket.prize : n.kind === 'asteroid' || n.kind === 'heart' ? 'ore' : null,
      owned: n.kind === 'probe',
      extractors: 0,
      buffer: 0,
      accum: 0,
    };
  });
  // 2. One guardian per guarded node, in node order. They start full: ids in guardian order, Thorns before Spores.
  const hasRoot = world.nodes.some((n) => n.kind === 'root');
  for (const n of world.nodes) {
    if (!isGuardedKind(n.kind)) continue;
    world.guardians.push({
      node: n.index,
      alive: true,
      guards: [],
      regrowProgress: { thorn: 0, spore: 0 },
      ...guardianFor(layout, n, hasRoot),
      battle: null,
      lastBattle: null,
      wavesSent: 0,
      shipsLost: 0,
      guardsKilled: 0,
    });
  }
  for (const g of world.guardians) {
    const caps = guardCaps(world, g);
    for (const type of GUARD_TYPES) for (let i = 0; i < caps[type]; i++) addGuard(world, g, type);
  }
}

/** H7: a fresh per-type record (BUILD_TYPES keys). */
function perBuildType(f: (t: BuildType) => number): Record<BuildType, number> {
  const r = {} as Record<BuildType, number>;
  for (const t of BUILD_TYPES) r[t] = f(t);
  return r;
}

/**
 * H7 F13, the landing of a field-mode run (DESIGN.md H7 "The field"): the nodes of `map.field` with its guards,
 * `economy.startStock` ore, the allocation at alloc.start.extractor / alloc.start.hauler with every warship at 0
 * (clamped to alloc.maxWeight), the Mine marks of `map.field.mine`, and the rally at the probe. No area is active
 * (`campaign.active` stays null): the overworld, research and stockpile are never used.
 */
function landField(world: World, data: SimData): void {
  const fm = data.map.field;
  if (fm === undefined) throw new Error('field mode needs map.field');
  const t = world.tun;
  Object.assign(world, emptyAreaFields(data));
  placeNodes(world, data, fm.nodes, fm.layout);
  world.stock.ore = t['economy.startStock'];
  const max = t['alloc.maxWeight'];
  const start = (type: BuildType): number => {
    if (type === 'extractor') return Math.min(t['alloc.start.extractor'], max);
    if (type === 'hauler') return Math.min(t['alloc.start.hauler'], max);
    return 0;
  };
  const window = data.tunables['stats.throughputWindowSec'].default;
  world.field = {
    alloc: perBuildType(start),
    share: perBuildType(() => 0),
    allocCur: perBuildType(() => 0),
    bays: { extractor: { on: false, ticksLeft: 0 }, hauler: { on: false, ticksLeft: 0 } },
    econ: [],
    mine: world.nodes.map((n) => fm.mine.includes(n.id)),
    free: world.nodes.map(() => 0),
    rockBuckets: world.nodes.map(() => new Array<number>(window).fill(0)),
    haulerSet: world.nodes.map(() => null),
    extractorSet: world.nodes.map(() => null),
    hiveRebuildProgress: 0,
  };
  world.rally = PROBE;
}

/**
 * A fresh world at tick 0. Campaign data (DESIGN.md H4): on the overworld, nothing reclaimed or researched,
 * Landfall open. H7 field data (run.mode 'field'): the campaign state is created as well, but the world lands
 * straight in the field (F13) and `world.field` is set.
 */
export function createWorld(seed: number, data: SimData): World {
  const world = createCampaignWorld(seed, data);
  if (runMode(data) === 'field') landField(world, data);
  return world;
}

function createCampaignWorld(seed: number, data: SimData): World {
  const tun = {} as Tunables;
  for (const k of SIM_TUNABLE_KEYS) tun[k] = data.tunables[k].default;
  const variant = chooseVariant(seed, tun['system.variant'], data.map.layouts.length);
  const layout = data.map.layouts[variant]!;
  const research: Record<string, number> = {};
  for (const item of data.research) research[item.id] = 0;
  return {
    tick: 0,
    rng: seed | 0,
    dataVersion: data.dataVersion,
    tickRate: data.tickRate,
    nextId: 1,
    tun,
    ...emptyAreaFields(data),
    system: { variant, id: layout.id, name: layout.name },
    campaign: {
      active: null,
      areaStartTick: 0,
      deepLayout: variant,
      areas: data.map.areas.map(() => ({
        reclaimedTick: null,
        entries: 0,
        withdrawals: 0,
        playTicks: 0,
        reclaimPlayTicks: null,
        shipsBuilt: 0,
        shipsLost: 0,
        shipsRecycled: 0,
        oreRefunded: 0,
        haulPaid: null,
      })),
      reclaimOrder: [],
      research,
      researchLog: [],
      stockpile: zeroTriple(),
      shipAccum: zeroTriple(),
      totals: { hauled: zeroTriple(), shipped: zeroTriple() },
      wonTick: null,
    },
    field: null,
    raid: null,
    nextRaidTick: 0,
    lastRaid: null,
  };
}
