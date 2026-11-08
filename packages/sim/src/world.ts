import {
  GUARD_CAP_MAX,
  GUARD_TYPES,
  SIM_TUNABLE_KEYS,
  type Component,
  type GuardType,
  type MapLayout,
  type NodeKind,
  type RawResource,
  type Resource,
  type ShipType,
  type SimData,
  type Tunables,
} from './data.ts';
import { isqrt } from './math.ts';

/**
 * World state (DESIGN.md H1 "Entities and state", with the H2 and H3
 * changes). Plain JSON data only: no classes, no Maps, no undefined fields
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
  /** Tick the Root was captured, or null. */
  rootCutTick: number | null;
  /** Every capture, in order. The heart's also sets `world.capturedTick`. */
  captures: Capture[];
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
  /** Rule 5b; run in the order lancer, flak, drone. */
  yards: Record<ShipType, Yard>;
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
  system: SystemInfo;
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

function indexOfKind(world: Readonly<World>, kind: NodeKind): number {
  const nodes = world.nodes;
  for (let i = 0; i < nodes.length; i++) if (nodes[i]!.kind === kind) return i;
  throw new Error(`world has no ${kind} node`);
}

/** Index of the Bloom heart (H1's rich node). */
export function heartIndex(world: Readonly<World>): number {
  return indexOfKind(world, 'heart');
}

/** Index of the Root. */
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

function guardianFor(layout: MapLayout, n: Node): Pick<Guardian, 'counts' | 'starvedCounts' | 'fed'> {
  if (n.kind === 'pocket') {
    const p = layout.pockets[n.id]!;
    return { counts: { thorn: p.thorns, spore: p.spores }, starvedCounts: null, fed: null };
  }
  if (n.kind === 'root') return { counts: { thorn: layout.root.thorns, spore: layout.root.spores }, starvedCounts: null, fed: null };
  const h = layout.heart;
  return {
    counts: { thorn: h.thorns, spore: h.spores },
    starvedCounts: { thorn: h.starvedThorns, spore: h.starvedSpores },
    fed: true,
  };
}

const zeroShips = (): ShipTypeCounts => ({ drone: 0, lancer: 0, flak: 0 });

/** A fresh world at tick 0 from the given (validated) data. */
export function createWorld(seed: number, data: SimData): World {
  const tun = {} as Tunables;
  for (const k of SIM_TUNABLE_KEYS) tun[k] = data.tunables[k].default;
  const variant = chooseVariant(seed, tun['system.variant'], data.map.layouts.length);
  const layout = data.map.layouts[variant]!;
  const window = data.tunables['stats.throughputWindowSec'].default;
  const ring = (): number[] => new Array<number>(window).fill(0);
  const world: World = {
    tick: 0,
    rng: seed | 0,
    dataVersion: data.dataVersion,
    tickRate: data.tickRate,
    nextId: 1,
    tun,
    stock: { ore: tun['economy.startStock'], ice: 0, crystal: 0, lens: 0, plating: 0 },
    probeAccum: 0,
    queue: [],
    activeBuild: null,
    assemblers: { lens: { ticksLeft: 0 }, plating: { ticksLeft: 0 } },
    // As in H1, the drone yard starts on (the first ship early matters); lancer and flak wait for their components.
    yards: { drone: { on: true, ticksLeft: 0 }, lancer: { on: false, ticksLeft: 0 }, flak: { on: false, ticksLeft: 0 } },
    rally: PROBE,
    nodes: data.map.nodes.map((n, index) => {
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
    }),
    routes: [],
    ships: [],
    guardians: [],
    lastBattle: null,
    stats: {
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
      rootCutTick: null,
      captures: [],
    },
    capturedTick: null,
    system: { variant, id: layout.id, name: layout.name },
  };
  for (const n of world.nodes) {
    if (!isGuardedKind(n.kind)) continue;
    world.guardians.push({
      node: n.index,
      alive: true,
      guards: [],
      regrowProgress: { thorn: 0, spore: 0 },
      ...guardianFor(layout, n),
      battle: null,
      lastBattle: null,
      wavesSent: 0,
      shipsLost: 0,
      guardsKilled: 0,
    });
  }
  // Guardians start full. Ids go in guardian order, Thorns before Spores.
  for (const g of world.guardians) {
    const caps = guardCaps(world, g);
    for (const type of GUARD_TYPES) for (let i = 0; i < caps[type]; i++) addGuard(world, g, type);
  }
  return world;
}
