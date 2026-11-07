import { ROOT_CAP_MAX, SIM_TUNABLE_KEYS, type NodeKind, type SimData, type Tunables } from './data.ts';
import { isqrt } from './math.ts';

/**
 * World state (DESIGN.md H1 "Entities and state", with the H2 changes). Plain JSON data only: no
 * classes, no Maps, no undefined fields (absent values are null), so
 * JSON.stringify round-trips it exactly and the hash covers all of it.
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
  slots: number;
  owned: boolean;
  extractors: number;
  /** Ore waiting for pickup, ≤ node.bufferCap. */
  buffer: number;
  /** Extraction accumulator in ore·ticks/min units; 1 ore per T. */
  accum: number;
}

export type BuildKind = 'extractor' | 'route' | 'upgrade';

/** An unpaid build order. `cost` is locked when queued. */
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
  hp: number;
  /** Node index when parked; null while in transit. */
  at: number | null;
  transit: Transit | null;
  /** Id of the last battle this ship fought a round in, or -1. Used to count distinct ships engaged. */
  engagedIn: number;
}

export interface Thorn {
  id: number;
  hp: number;
}

/** Combat state at one guarded node. */
export interface Battle {
  /** From `nextId`; ships remember the last battle they fought in (`Ship.engagedIn`). */
  id: number;
  /** The guarded node it is fought at. */
  node: number;
  startTick: number;
  shipsEngaged: number;
  shipsLost: number;
  thornsKilled: number;
}

export type BattleOutcome = 'captured' | 'repelled' | 'withdrew';

/** The Bloom's wilt when the Root is cut: thorn count before and after (from - to thorns withered). */
export interface Wilt {
  from: number;
  to: number;
}

export interface BattleResult extends Battle {
  endTick: number;
  outcome: BattleOutcome;
  /** Set on the Root's `captured` result when the Bloom was alive (to = from if it was already at or below the starved cap); otherwise null. */
  wilt: Wilt | null;
}

/**
 * One guardian per guarded node (DESIGN.md H2 "Guardians"): the Bloom on the
 * rich node and the Root on the root node. `world.guardians` is in node-index
 * order and never changes length, so the systems loop over it in that order.
 */
export interface Guardian {
  /** The node it guards. */
  node: number;
  alive: boolean;
  /** Oldest first (ascending id). */
  thorns: Thorn[];
  regrowProgress: number;
  /** The battle running at this node, or null. */
  battle: Battle | null;
  /** The last finished battle at this node, or null. */
  lastBattle: BattleResult | null;
  /** Attacks ordered at this node while it was guarded (at most one per tick). */
  wavesSent: number;
  /** Ships lost and thorns killed in battles at this node. */
  shipsLost: number;
  thornsKilled: number;
}

/** The system chosen at world creation (DESIGN.md H2 "Map variation"). Fixed for the run. */
export interface SystemInfo {
  /** Index into data `map.variants` (0 thin, 1 knotted, 2 deep in the shipped data). */
  variant: number;
  id: string;
  name: string;
  /** The variant's base Root cap, before `root.capBonus`. */
  rootCap: number;
}

export interface Stats {
  /** Ore delivered by routes per game second, ring buffer indexed by (tick / tickRate) mod length. */
  deliveredBuckets: number[];
  peakPerMin: number;
  shipsBuilt: number;
  shipsLost: number;
  thornsKilled: number;
  wavesSent: number;
  firstShipTick: number | null;
  oreSpentShips: number;
  oreSpentEconomy: number;
  /** Tick the Root was captured, or null. */
  rootCutTick: number | null;
  /** Bloom thorns removed by the wilt (not kills). */
  thornsWithered: number;
}

export interface World {
  tick: number;
  rng: number;
  dataVersion: number;
  tickRate: number;
  nextId: number;
  /** Live sim tunables. Starts from data defaults; `setTunable` changes it. */
  tun: Tunables;
  /** Ore at the probe. */
  stock: number;
  probeAccum: number;
  /** Unpaid build orders, FIFO. */
  queue: BuildOrder[];
  activeBuild: ActiveBuild | null;
  /** ticksLeft = 0 means idle. */
  shipyard: { on: boolean; ticksLeft: number };
  rally: number;
  nodes: Node[];
  routes: Route[];
  ships: Ship[];
  /** Bloom then Root (node-index order). */
  guardians: Guardian[];
  /** The most recent finished battle at any node (`node` says which). Per node: `guardians[i].lastBattle`. */
  lastBattle: BattleResult | null;
  stats: Stats;
  /** Tick the Bloom (rich node) was captured, or null. */
  capturedTick: number | null;
  system: SystemInfo;
}

/** The probe is always node 0 (enforced by parseSimData). */
export const PROBE = 0;

/** Index of the rich node. */
export function richIndex(world: Readonly<World>): number {
  const nodes = world.nodes;
  for (let i = 0; i < nodes.length; i++) if (nodes[i]!.kind === 'rich') return i;
  throw new Error('world has no rich node');
}

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

/** Index of the Root node. */
export function rootIndex(world: Readonly<World>): number {
  const nodes = world.nodes;
  for (let i = 0; i < nodes.length; i++) if (nodes[i]!.kind === 'root') return i;
  throw new Error('world has no root node');
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

/** True while the Root lives: the Bloom is fed and behaves as in H1. */
export function bloomFed(world: Readonly<World>): boolean {
  return guardianAt(world, rootIndex(world))!.alive;
}

/** Cap, regrowth and repair a guardian uses at the current tunables (DESIGN.md H2 "Effective parameters"). */
export interface GuardianParams {
  cap: number;
  regrowTicks: number;
  repairPerRound: number;
}

/** The Bloom's parameters while fed (`fed = true`) or starved. */
export function bloomParams(world: Readonly<World>, fed: boolean): GuardianParams {
  const t = world.tun;
  return fed
    ? { cap: t['guardian.cap'], regrowTicks: t['guardian.regrowTicks'], repairPerRound: t['guardian.repairPerRound'] }
    : { cap: t['bloom.starvedCap'], regrowTicks: t['bloom.starvedRegrowTicks'], repairPerRound: t['bloom.starvedRepairPerRound'] };
}

/** The Root's effective cap: clamp(variant rootCap + root.capBonus, 0, 40). */
export function rootCap(world: Readonly<World>): number {
  return Math.max(0, Math.min(ROOT_CAP_MAX, world.system.rootCap + world.tun['root.capBonus']));
}

/** Effective parameters of guardian `g` now. */
export function guardianParams(world: Readonly<World>, g: Readonly<Guardian>): GuardianParams {
  if (world.nodes[g.node]!.kind === 'root') {
    return { cap: rootCap(world), regrowTicks: world.tun['root.regrowTicks'], repairPerRound: world.tun['guardian.repairPerRound'] };
  }
  return bloomParams(world, bloomFed(world));
}

function addThorn(world: World, g: Guardian): void {
  g.thorns.push({ id: world.nextId++, hp: world.tun['guardian.thornHp'] });
}

/** The variant index a new world uses: `forced - 1` when `forced > 0` (system.variant), else ((seed mod n) + n) mod n. */
export function chooseVariant(seed: number, forced: number, variantCount: number): number {
  if (forced > 0) return Math.min(forced, variantCount) - 1;
  return (((seed | 0) % variantCount) + variantCount) % variantCount;
}

/** A fresh world at tick 0 from the given (validated) data. */
export function createWorld(seed: number, data: SimData): World {
  const tun = {} as Tunables;
  for (const k of SIM_TUNABLE_KEYS) tun[k] = data.tunables[k].default;
  const variantIndex = chooseVariant(seed, tun['system.variant'], data.map.variants.length);
  const variant = data.map.variants[variantIndex]!;
  const world: World = {
    tick: 0,
    rng: seed | 0,
    dataVersion: data.dataVersion,
    tickRate: data.tickRate,
    nextId: 1,
    tun,
    stock: tun['economy.startStock'],
    probeAccum: 0,
    queue: [],
    activeBuild: null,
    shipyard: { on: true, ticksLeft: 0 },
    rally: PROBE,
    nodes: data.map.nodes.map((n, index) => ({
      index,
      id: n.id,
      kind: n.kind,
      // The Root's position comes from the variant; map.nodes holds a placeholder.
      x: n.kind === 'root' ? variant.x : n.x,
      y: n.kind === 'root' ? variant.y : n.y,
      r: n.r,
      slots: n.slots,
      owned: n.kind === 'probe',
      extractors: 0,
      buffer: 0,
      accum: 0,
    })),
    routes: [],
    ships: [],
    guardians: [],
    lastBattle: null,
    stats: {
      deliveredBuckets: new Array<number>(data.tunables['stats.throughputWindowSec'].default).fill(0),
      peakPerMin: 0,
      shipsBuilt: 0,
      shipsLost: 0,
      thornsKilled: 0,
      wavesSent: 0,
      firstShipTick: null,
      oreSpentShips: 0,
      oreSpentEconomy: 0,
      rootCutTick: null,
      thornsWithered: 0,
    },
    capturedTick: null,
    system: { variant: variantIndex, id: variant.id, name: variant.name, rootCap: variant.rootCap },
  };
  // One guardian per guarded node, in node-index order (Bloom 6, Root 7).
  for (const n of world.nodes) {
    if (n.kind !== 'rich' && n.kind !== 'root') continue;
    world.guardians.push({
      node: n.index,
      alive: true,
      thorns: [],
      regrowProgress: 0,
      battle: null,
      lastBattle: null,
      wavesSent: 0,
      shipsLost: 0,
      thornsKilled: 0,
    });
  }
  // Each starts at its cap; thorn ids are handed out in guardian order.
  for (const g of world.guardians) {
    const cap = guardianParams(world, g).cap;
    for (let i = 0; i < cap; i++) addThorn(world, g);
  }
  return world;
}

export { addThorn };
