import { deliveredInWindow, reservedOre } from './step.ts';
import { richIndex, routeFrom, ticksPerMin, type BuildOrder, type BuildKind, type BattleResult, type World } from './world.ts';

/**
 * Read-only views for the HUD, node sheets, bots and tests (DESIGN.md H1
 * "Observable values"). None of them change the world. Rates that need a
 * decimal place are returned in tenths (`…X10`) to stay integer.
 */

/** True once the rich node has been captured. */
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
  alive: boolean;
  thorns: number;
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
}

/** The Bloom's state and the combat numbers the rich sheet shows. */
export function guardianStatus(world: Readonly<World>): GuardianStatus {
  const g = world.guardian;
  const t = world.tun;
  return {
    alive: g.alive,
    thorns: g.thorns.length,
    cap: t['guardian.cap'],
    regrowProgress: g.regrowProgress,
    regrowTicks: t['guardian.regrowTicks'],
    thornHp: t['guardian.thornHp'],
    thornDamage: t['guardian.thornDamage'],
    repairPerRound: t['guardian.repairPerRound'],
    shipHp: t['ship.hp'],
    shipDamage: t['ship.damage'],
    thornHps: g.thorns.map((th) => th.hp),
  };
}

export interface CombatRates {
  /** Thorns per second ×10 that `ships` strip at full damage: ships × damage / thornHp per round. */
  killPerSecX10: number;
  /** Thorns per second ×10 the Bloom regrows while below cap. */
  regrowPerSecX10: number;
}

/** Kill rate vs regrowth for a wave of `ships` ("you strip 2.4 thorns/s · Bloom regrows 0.5/s"). */
export function combatRates(world: Readonly<World>, ships: number): CombatRates {
  const t = world.tun;
  return {
    killPerSecX10: Math.floor((ships * t['ship.damage'] * world.tickRate * 10) / (t['guardian.thornHp'] * t['combat.roundTicks'])),
    regrowPerSecX10: Math.floor((world.tickRate * 10) / t['guardian.regrowTicks']),
  };
}

export interface BattleStatus extends CombatRates {
  startTick: number;
  shipsPresent: number;
  shipsEngaged: number;
  shipsLost: number;
  thornsKilled: number;
}

/** The current battle with live rates, or null when none is running. The finished one is `world.lastBattle`. */
export function battleStatus(world: Readonly<World>): BattleStatus | null {
  const b = world.battle;
  if (b === null) return null;
  const rich = richIndex(world);
  let present = 0;
  for (const s of world.ships) if (s.at === rich) present++;
  return { ...b, shipsPresent: present, ...combatRates(world, present) };
}

/** The most recent finished battle, for the battle report toast. */
export function lastBattle(world: Readonly<World>): BattleResult | null {
  return world.lastBattle;
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
}

/** Result panel and bot report numbers. */
export function runSummary(world: Readonly<World>): RunSummary {
  const st = world.stats;
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
  };
}
