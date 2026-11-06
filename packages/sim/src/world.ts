import { SIM_TUNABLE_KEYS, type NodeKind, type SimData, type Tunables } from './data.ts';
import { isqrt } from './math.ts';

/**
 * World state (DESIGN.md H1 "Entities and state"). Plain JSON data only: no
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
  /** startTick of the last battle this ship fought a round in, or -1. Used to count distinct ships engaged. */
  engagedIn: number;
}

export interface Thorn {
  id: number;
  hp: number;
}

export interface Guardian {
  alive: boolean;
  /** Oldest first. */
  thorns: Thorn[];
  regrowProgress: number;
}

export interface Battle {
  startTick: number;
  shipsEngaged: number;
  shipsLost: number;
  thornsKilled: number;
}

export type BattleOutcome = 'captured' | 'repelled' | 'withdrew';

export interface BattleResult extends Battle {
  endTick: number;
  outcome: BattleOutcome;
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
  guardian: Guardian;
  battle: Battle | null;
  lastBattle: BattleResult | null;
  stats: Stats;
  capturedTick: number | null;
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

function addThorn(world: World): void {
  world.guardian.thorns.push({ id: world.nextId++, hp: world.tun['guardian.thornHp'] });
}

/** A fresh world at tick 0 from the given (validated) data. */
export function createWorld(seed: number, data: SimData): World {
  const tun = {} as Tunables;
  for (const k of SIM_TUNABLE_KEYS) tun[k] = data.tunables[k].default;
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
      x: n.x,
      y: n.y,
      r: n.r,
      slots: n.slots,
      owned: n.kind === 'probe',
      extractors: 0,
      buffer: 0,
      accum: 0,
    })),
    routes: [],
    ships: [],
    guardian: { alive: true, thorns: [], regrowProgress: 0 },
    battle: null,
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
    },
    capturedTick: null,
  };
  for (let i = 0; i < tun['guardian.cap']; i++) addThorn(world);
  return world;
}

export { addThorn };
