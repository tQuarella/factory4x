import { deliveredInWindow, reservedOre } from './step.ts';
import {
  bloomFed,
  bloomParams,
  guardianAt,
  guardianParams,
  richIndex,
  rootCap,
  rootIndex,
  routeFrom,
  ticksPerMin,
  type BattleResult,
  type BuildKind,
  type BuildOrder,
  type Guardian,
  type GuardianParams,
  type World,
} from './world.ts';

/**
 * Read-only views for the HUD, node sheets, bots and tests (DESIGN.md H1 and
 * H2 "Observable values"). None of them change the world. Rates that need a
 * decimal place are returned in tenths (`…X10`) to stay integer.
 */

/** True once the rich node (the Bloom) has been captured. */
export function isCaptured(world: Readonly<World>): boolean {
  return world.capturedTick !== null;
}

/** Ore delivered by routes over the last 60 game seconds (the HUD's headline number). */
export function throughputPerMin(world: Readonly<World>): number {
  return deliveredInWindow(world);
}

/** Total income per minute: route deliveries plus probe mining. */
export function incomePerMin(world: Readonly<World>): number {
  return deliveredInWindow(world) + world.tun['economy.probeOrePerMin'];
}

/** Ships per minute ×10 the shipyard sustains at the current income: min(income / cost, T / buildTicks). 0 when the yard is off. */
export function shipsPerMinX10(world: Readonly<World>): number {
  if (!world.shipyard.on) return 0;
  const byOre = Math.floor((incomePerMin(world) * 10) / world.tun['ship.cost']);
  const byYard = Math.floor((ticksPerMin(world) * 10) / world.tun['ship.buildTicks']);
  return Math.min(byOre, byYard);
}

export interface ShipCounts {
  /** Ships parked at each node, by node index. */
  at: number[];
  /** Ships in transit toward each node, by node index. */
  enRoute: number[];
  total: number;
}

/** Ship counts per node (badges, "From A5 · 8" buttons, rich sheet "present / en route"). */
export function shipCounts(world: Readonly<World>): ShipCounts {
  const at = new Array<number>(world.nodes.length).fill(0);
  const enRoute = new Array<number>(world.nodes.length).fill(0);
  for (const s of world.ships) {
    if (s.at !== null) at[s.at] = at[s.at]! + 1;
    else if (s.transit) enRoute[s.transit.to] = enRoute[s.transit.to]! + 1;
  }
  return { at, enRoute, total: world.ships.length };
}

export interface RouteStatus {
  level: number;
  maxLevel: number;
  /** level × podOrePerLevel × T / podIntervalTicks. */
  capacityPerMin: number;
  /** Upgrades queued or under construction. */
  pendingUpgrades: number;
  podsInFlight: number;
}

export interface NodeStatus {
  extractors: number;
  slots: number;
  /** Built + under construction + queued. */
  extractorsCommitted: number;
  extractPerMin: number;
  buffer: number;
  bufferCap: number;
  /** Buffer full: extraction is being lost ("route at capacity: upgrade", or no route). */
  backedUp: boolean;
  /** Extracting with no route built. */
  noRoute: boolean;
  /** A route from this node is queued or under construction. */
  routePending: boolean;
  route: RouteStatus | null;
}

function pendingOf(world: Readonly<World>, kind: BuildKind, node: number): number {
  let n = 0;
  const a = world.activeBuild;
  if (a && a.kind === kind && a.node === node) n++;
  for (const o of world.queue) if (o.kind === kind && o.node === node) n++;
  return n;
}

/** Ore per minute a route of this level carries at current tunables. */
export function routeCapacityPerMin(world: Readonly<World>, level: number): number {
  return Math.floor((level * world.tun['route.podOrePerLevel'] * ticksPerMin(world)) / world.tun['route.podIntervalTicks']);
}

/** Extraction, buffer and route state for one node (asteroid and rich sheets). */
export function nodeStatus(world: Readonly<World>, node: number): NodeStatus {
  const n = world.nodes[node]!;
  const perExtractor = n.kind === 'rich' ? world.tun['rich.orePerMin'] : n.kind === 'asteroid' ? world.tun['extractor.orePerMin'] : 0;
  const route = routeFrom(world, node);
  const bufferCap = world.tun['node.bufferCap'];
  return {
    extractors: n.extractors,
    slots: n.slots,
    extractorsCommitted: n.extractors + pendingOf(world, 'extractor', node),
    extractPerMin: n.extractors * perExtractor,
    buffer: n.buffer,
    bufferCap,
    backedUp: n.extractors > 0 && n.buffer >= bufferCap,
    noRoute: n.extractors > 0 && route === null,
    routePending: pendingOf(world, 'route', node) > 0,
    route: route
      ? {
          level: route.level,
          maxLevel: world.tun['route.maxLevel'],
          capacityPerMin: routeCapacityPerMin(world, route.level),
          pendingUpgrades: pendingOf(world, 'upgrade', node),
          podsInFlight: route.pods.length,
        }
      : null,
  };
}

export interface QueueStatus {
  /** Unpaid orders, FIFO (copies). */
  orders: BuildOrder[];
  queueMax: number;
  /** Ore held back from the shipyard for queued orders. */
  reserved: number;
  /** The build under construction, with its total for a progress bar (at current tunables). */
  active: { kind: BuildKind; node: number; ticksLeft: number; totalTicks: number } | null;
}

/** Build queue and active build (probe sheet). */
export function queueStatus(world: Readonly<World>): QueueStatus {
  const a = world.activeBuild;
  return {
    orders: world.queue.map((o) => ({ ...o })),
    queueMax: world.tun['build.queueMax'],
    reserved: reservedOre(world),
    active: a
      ? {
          kind: a.kind,
          node: a.node,
          ticksLeft: a.ticksLeft,
          totalTicks: Math.max(a.ticksLeft, a.kind === 'extractor' ? world.tun['extractor.buildTicks'] : world.tun['route.buildTicks']),
        }
      : null,
  };
}

export interface ShipyardStatus {
  on: boolean;
  /** 0 when idle. */
  ticksLeft: number;
  /** For a progress bar; at current tunables. */
  totalTicks: number;
  rally: number;
  /** Probe mining, ore per minute. */
  probeOrePerMin: number;
}

/** Shipyard, rally point and probe mining (probe sheet). */
export function shipyardStatus(world: Readonly<World>): ShipyardStatus {
  return {
    on: world.shipyard.on,
    ticksLeft: world.shipyard.ticksLeft,
    totalTicks: Math.max(world.shipyard.ticksLeft, world.tun['ship.buildTicks']),
    rally: world.rally,
    probeOrePerMin: world.tun['economy.probeOrePerMin'],
  };
}

export interface GuardianStatus {
  /** The guarded node. */
  node: number;
  alive: boolean;
  thorns: number;
  /** Effective cap now (the Bloom's depends on supply, the Root's on the variant and root.capBonus). */
  cap: number;
  /** Ticks toward the next thorn, and the total, for the progress ring. 0 at cap. */
  regrowProgress: number;
  regrowTicks: number;
  thornHp: number;
  thornDamage: number;
  repairPerRound: number;
  shipHp: number;
  shipDamage: number;
  /** Current hp of each thorn, oldest first (ring drawing). */
  thornHps: number[];
  /** The Bloom: 'fed' while the Root lives, 'starved' once it is cut. The Root: null. */
  supply: 'fed' | 'starved' | null;
}

function guardianOrThrow(world: Readonly<World>, node: number): Guardian {
  const g = guardianAt(world, node);
  if (g === null) throw new Error(`node ${node} is not a guarded node`);
  return g;
}

/** A guardian's state and the combat numbers its sheet shows, at its effective parameters. `node` defaults to the rich node (the Bloom). */
export function guardianStatus(world: Readonly<World>, node: number = richIndex(world)): GuardianStatus {
  const g = guardianOrThrow(world, node);
  const t = world.tun;
  const p = guardianParams(world, g);
  return {
    node,
    alive: g.alive,
    thorns: g.thorns.length,
    cap: p.cap,
    regrowProgress: g.regrowProgress,
    regrowTicks: p.regrowTicks,
    thornHp: t['guardian.thornHp'],
    thornDamage: t['guardian.thornDamage'],
    repairPerRound: p.repairPerRound,
    shipHp: t['ship.hp'],
    shipDamage: t['ship.damage'],
    thornHps: g.thorns.map((th) => th.hp),
    supply: world.nodes[node]!.kind === 'rich' ? (bloomFed(world) ? 'fed' : 'starved') : null,
  };
}

export interface SupplyStatus {
  bloomNode: number;
  rootNode: number;
  /** The Root still stands. */
  rootAlive: boolean;
  /** The Bloom is fed (same as rootAlive). */
  fed: boolean;
  /** Tick the Root was cut, or null. */
  rootCutTick: number | null;
  /** The Bloom's values while fed and once starved, from live tunables ("12 thorns, 1 / 2.0 s, repairs 2 → 8 thorns, 1 / 10.0 s, no repair"). */
  fedBloom: GuardianParams;
  starvedBloom: GuardianParams;
  /** The Root's effective cap, and its parts: the variant's base cap and root.capBonus. */
  rootCap: number;
  rootBaseCap: number;
  rootCapBonus: number;
}

/** The supply link: Root status, fed or starved, and the Bloom's fed and starved values (Root and rich sheets). */
export function supplyStatus(world: Readonly<World>): SupplyStatus {
  const rootNode = rootIndex(world);
  const rootAlive = guardianOrThrow(world, rootNode).alive;
  return {
    bloomNode: richIndex(world),
    rootNode,
    rootAlive,
    fed: rootAlive,
    rootCutTick: world.stats.rootCutTick,
    fedBloom: bloomParams(world, true),
    starvedBloom: bloomParams(world, false),
    rootCap: rootCap(world),
    rootBaseCap: world.system.rootCap,
    rootCapBonus: world.tun['root.capBonus'],
  };
}

/** True once the Root has been captured (cut). */
export function isRootCut(world: Readonly<World>): boolean {
  return world.stats.rootCutTick !== null;
}

export interface SystemStatus {
  /** Index into data map.variants. */
  variant: number;
  /** "thin" | "knotted" | "deep" in the shipped data. */
  id: string;
  /** Player-facing name ("Thin Root"). */
  name: string;
  rootCutTick: number | null;
  /** Whole game seconds when the Root was cut, or null. */
  rootCutSec: number | null;
}

/** Which system this run is, and when its Root was cut (probe sheet, result panel). */
export function systemStatus(world: Readonly<World>): SystemStatus {
  const cut = world.stats.rootCutTick;
  return {
    variant: world.system.variant,
    id: world.system.id,
    name: world.system.name,
    rootCutTick: cut,
    rootCutSec: cut === null ? null : Math.floor(cut / world.tickRate),
  };
}

export interface CombatRates {
  /** Thorns per second ×10 that `ships` strip at full damage: ships × damage / thornHp per round. */
  killPerSecX10: number;
  /** Thorns per second ×10 the guardian regrows while below cap, at its effective regrow ticks. */
  regrowPerSecX10: number;
}

/** Kill rate vs regrowth for a wave of `ships` at `node` (default the Bloom): "you strip 2.4 thorns/s · Bloom regrows 0.5/s". */
export function combatRates(world: Readonly<World>, ships: number, node: number = richIndex(world)): CombatRates {
  const t = world.tun;
  const p = guardianParams(world, guardianOrThrow(world, node));
  return {
    killPerSecX10: Math.floor((ships * t['ship.damage'] * world.tickRate * 10) / (t['guardian.thornHp'] * t['combat.roundTicks'])),
    regrowPerSecX10: Math.floor((world.tickRate * 10) / p.regrowTicks),
  };
}

export interface BattleStatus extends CombatRates {
  /** The guarded node it is fought at. */
  node: number;
  startTick: number;
  shipsPresent: number;
  shipsEngaged: number;
  shipsLost: number;
  thornsKilled: number;
}

function statusOf(world: Readonly<World>, g: Readonly<Guardian>): BattleStatus | null {
  const b = g.battle;
  if (b === null) return null;
  let present = 0;
  for (const s of world.ships) if (s.at === g.node) present++;
  return {
    node: b.node,
    startTick: b.startTick,
    shipsPresent: present,
    shipsEngaged: b.shipsEngaged,
    shipsLost: b.shipsLost,
    thornsKilled: b.thornsKilled,
    ...combatRates(world, present, g.node),
  };
}

/** The battle running at `node` (default the Bloom) with live rates, or null. The finished one is `lastBattle(world, node)`. */
export function battleStatus(world: Readonly<World>, node: number = richIndex(world)): BattleStatus | null {
  return statusOf(world, guardianOrThrow(world, node));
}

/** Every battle running now, in node order (Bloom, then Root): the banner shows one line each. */
export function activeBattles(world: Readonly<World>): BattleStatus[] {
  const out: BattleStatus[] = [];
  for (const g of world.guardians) {
    const st = statusOf(world, g);
    if (st !== null) out.push(st);
  }
  return out;
}

/**
 * The last finished battle at `node` (default the Bloom), for the battle report toast, or null.
 * A Root capture carries `wilt` ({from, to} Bloom thorns). `world.lastBattle` is the latest at any node.
 */
export function lastBattle(world: Readonly<World>, node: number = richIndex(world)): BattleResult | null {
  return guardianOrThrow(world, node).lastBattle;
}

export interface RunSummary {
  /** Tick of capture, or null. */
  capturedTick: number | null;
  /** Whole game seconds to capture, or null. */
  captureSec: number | null;
  peakPerMin: number;
  shipsBuilt: number;
  shipsLost: number;
  wavesSent: number;
  firstShipTick: number | null;
  oreSpentShips: number;
  oreSpentEconomy: number;
  /** The system (DESIGN.md H2): variant index, id and name. */
  variant: number;
  variantId: string;
  variantName: string;
  /** When the Root was cut, or null ("Root left standing"). */
  rootCutTick: number | null;
  rootCutSec: number | null;
  /** Bloom thorns removed by the wilt. */
  thornsWithered: number;
  /** Per target: waves sent and ships lost at the Bloom and at the Root. shipsLost is their sum. */
  bloomWavesSent: number;
  bloomShipsLost: number;
  rootWavesSent: number;
  rootShipsLost: number;
}

/** Result panel and bot report numbers. */
export function runSummary(world: Readonly<World>): RunSummary {
  const st = world.stats;
  const bloom = guardianOrThrow(world, richIndex(world));
  const root = guardianOrThrow(world, rootIndex(world));
  return {
    capturedTick: world.capturedTick,
    captureSec: world.capturedTick === null ? null : Math.floor(world.capturedTick / world.tickRate),
    peakPerMin: st.peakPerMin,
    shipsBuilt: st.shipsBuilt,
    shipsLost: st.shipsLost,
    wavesSent: st.wavesSent,
    firstShipTick: st.firstShipTick,
    oreSpentShips: st.oreSpentShips,
    oreSpentEconomy: st.oreSpentEconomy,
    variant: world.system.variant,
    variantId: world.system.id,
    variantName: world.system.name,
    rootCutTick: st.rootCutTick,
    rootCutSec: st.rootCutTick === null ? null : Math.floor(st.rootCutTick / world.tickRate),
    thornsWithered: st.thornsWithered,
    bloomWavesSent: bloom.wavesSent,
    bloomShipsLost: bloom.shipsLost,
    rootWavesSent: root.wavesSent,
    rootShipsLost: root.shipsLost,
  };
}
