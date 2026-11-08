import { buyResearch, canBuyResearch, isAreaOpen, isWon, leaveActive } from './campaign.ts';
import { SHIP_TYPES, isSimTunableKey, type ShipType, type SimData, type TunableKey } from './data.ts';
import { fleetCap, recycleRefundEach } from './fleet.ts';
import { ceilDiv } from './math.ts';
import { PROBE, guardianAt, isGuarded, landArea, nodeDistance, routeFrom, type ShipTypeCounts, type World } from './world.ts';

/**
 * Player intent (DESIGN.md H1 "Player inputs", with the H3 changes: the yard
 * toggle and the send order take ship types; H4: the three campaign
 * inputs; H5: recycleShips). Node parameters are node indices into the active area's nodes.
 * Inputs are the only way the outside world changes the sim, and every one is
 * recorded in a replay's input log.
 */
export type Input =
  /** H4: land in an open area (`area` indexes data map.areas). Valid on the overworld before the win. */
  | { type: 'enterArea'; area: number }
  /** H4: back to the overworld; a withdraw if the heart isn't captured. Valid while an area is active. */
  | { type: 'leaveArea' }
  /** H4: buy the next level of a research item (`item` indexes data research). Valid on the overworld before the win. */
  | { type: 'buyResearch'; item: number }
  | { type: 'buildExtractor'; node: number }
  | { type: 'buildRoute'; from: number; to: number }
  | { type: 'upgradeRoute'; from: number }
  | { type: 'cancelBuild'; index: number }
  /** Always valid; a ship already in progress finishes. */
  | { type: 'setShipyard'; shipType: ShipType; on: boolean }
  /** Each count is clamped to the ships of that type at `from`; the lowest-id ships of each type go. */
  | { type: 'sendShips'; from: number; to: number; counts: ShipTypeCounts }
  /**
   * H5: scrap ships parked at `node` for part of their ore. Each count is clamped to the ships of that type parked
   * there (not in transit); the lowest-id ships of each type go. Valid in an area, before the win, at a node that
   * isn't a living guarded node, if the clamped total is at least 1.
   */
  | { type: 'recycleShips'; node: number; counts: ShipTypeCounts }
  | { type: 'setRally'; node: number }
  | { type: 'setTunable'; key: TunableKey; value: number };

function isIndex(world: Readonly<World>, v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < world.nodes.length;
}

function isShipType(v: unknown): v is ShipType {
  return typeof v === 'string' && (SHIP_TYPES as readonly string[]).includes(v);
}

/** Extractors at `node` that are built, under construction or queued. */
function extractorsCommitted(world: Readonly<World>, node: number): number {
  let n = world.nodes[node]!.extractors;
  const a = world.activeBuild;
  if (a && a.kind === 'extractor' && a.node === node) n++;
  for (const o of world.queue) if (o.kind === 'extractor' && o.node === node) n++;
  return n;
}

/** Route upgrades from `from` that are under construction or queued. */
function upgradesPending(world: Readonly<World>, from: number): number {
  let n = 0;
  const a = world.activeBuild;
  if (a && a.kind === 'upgrade' && a.node === from) n++;
  for (const o of world.queue) if (o.kind === 'upgrade' && o.node === from) n++;
  return n;
}

function routePending(world: Readonly<World>, from: number): boolean {
  const a = world.activeBuild;
  if (a && a.kind === 'route' && a.node === from) return true;
  for (const o of world.queue) if (o.kind === 'route' && o.node === from) return true;
  return false;
}

function queueFull(world: Readonly<World>): boolean {
  return world.queue.length >= world.tun['build.queueMax'];
}

/** Ships of each type parked at `node`. */
export function shipsAtByType(world: Readonly<World>, node: number): ShipTypeCounts {
  const c: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
  for (const s of world.ships) if (s.at === node) c[s.type] += 1;
  return c;
}

/** The counts a `sendShips` order would really send: each requested count clamped to the ships of that type at `from`. */
export function clampSendCounts(world: Readonly<World>, from: number, counts: Readonly<ShipTypeCounts>): ShipTypeCounts {
  const at = shipsAtByType(world, from);
  return { drone: Math.min(counts.drone, at.drone), lancer: Math.min(counts.lancer, at.lancer), flak: Math.min(counts.flak, at.flak) };
}

function validCounts(v: unknown): v is ShipTypeCounts {
  if (v === null || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return SHIP_TYPES.every((t) => typeof c[t] === 'number' && Number.isInteger(c[t]) && (c[t] as number) >= 0);
}

/** True for a node that can hold extractors now: an asteroid, or a captured pocket or heart. */
function extractable(world: Readonly<World>, node: number): boolean {
  const kind = world.nodes[node]!.kind;
  if (kind === 'asteroid') return true;
  return (kind === 'pocket' || kind === 'heart') && !isGuarded(world, node);
}

/** True if `input` would change the world this tick. Invalid inputs are ignored by `step`; the client greys them out. */
export function isValidInput(world: Readonly<World>, data: SimData, input: Input): boolean {
  // After the win only live tuning is accepted; the area inputs need an area.
  if (input.type === 'setTunable') return validTunable(data, input.key, input.value);
  if (isWon(world)) return false;
  const active = world.campaign.active !== null;
  switch (input.type) {
    case 'enterArea':
      return !active && Number.isInteger(input.area) && isAreaOpen(world, data, input.area);
    case 'leaveArea':
      return active;
    case 'buyResearch':
      return typeof input.item === 'number' && Number.isInteger(input.item) && canBuyResearch(world, data, input.item);
    default:
      return active && validAreaInput(world, input);
  }
}

function validTunable(data: SimData, key: unknown, value: unknown): boolean {
  if (!isSimTunableKey(key)) return false;
  if (typeof value !== 'number' || !Number.isInteger(value)) return false;
  const range = data.tunables[key];
  return value >= range.min && value <= range.max;
}

/** The H3 rules for the area inputs (an area is active). */
function validAreaInput(world: Readonly<World>, input: Input): boolean {
  switch (input.type) {
    case 'buildExtractor': {
      if (!isIndex(world, input.node) || queueFull(world)) return false;
      return extractable(world, input.node) && extractorsCommitted(world, input.node) < world.nodes[input.node]!.slots;
    }
    case 'buildRoute': {
      if (!isIndex(world, input.from) || input.to !== PROBE || input.from === PROBE || queueFull(world)) return false;
      if (routeFrom(world, input.from) || routePending(world, input.from)) return false;
      return extractorsCommitted(world, input.from) > 0;
    }
    case 'upgradeRoute': {
      if (!isIndex(world, input.from) || queueFull(world)) return false;
      const route = routeFrom(world, input.from);
      return route !== null && route.level + upgradesPending(world, input.from) < world.tun['route.maxLevel'];
    }
    case 'cancelBuild':
      return typeof input.index === 'number' && Number.isInteger(input.index) && input.index >= 0 && input.index < world.queue.length;
    case 'setShipyard':
      return isShipType(input.shipType) && typeof input.on === 'boolean';
    case 'sendShips': {
      if (!isIndex(world, input.from) || !isIndex(world, input.to) || input.from === input.to || !validCounts(input.counts)) return false;
      const c = clampSendCounts(world, input.from, input.counts);
      return c.drone + c.lancer + c.flak >= 1;
    }
    case 'recycleShips': {
      if (!isIndex(world, input.node) || isGuarded(world, input.node) || !validCounts(input.counts)) return false;
      const c = clampSendCounts(world, input.node, input.counts);
      return c.drone + c.lancer + c.flak >= 1;
    }
    case 'setRally':
      return isIndex(world, input.node);
    default:
      return false;
  }
}

/** Ore the order would lock if queued now; 0 for inputs that aren't build orders. Meaningful only when the input is valid. */
export function inputCost(world: Readonly<World>, input: Input): number {
  const t = world.tun;
  switch (input.type) {
    case 'buildExtractor':
      return t['extractor.cost'];
    case 'buildRoute':
      return isIndex(world, input.from) && input.from !== PROBE
        ? t['route.costBase'] + Math.floor((nodeDistance(world, input.from, PROBE) * t['route.costPer100Su']) / 100)
        : 0;
    case 'upgradeRoute': {
      const route = isIndex(world, input.from) ? routeFrom(world, input.from) : null;
      if (!route) return 0;
      const target = route.level + upgradesPending(world, input.from) + 1;
      return t['route.upgradeCostPerLevel'] * (target - 1);
    }
    default:
      return 0;
  }
}

/** Starts transit for one ship. */
export function startTransit(world: World, ship: World['ships'][number], to: number): void {
  const from = ship.at ?? PROBE;
  const total = ceilDiv(nodeDistance(world, from, to), world.tun['ship.speedSu']);
  ship.at = null;
  ship.transit = { from, to, ticksLeft: total, totalTicks: total };
}

/** Rule 1: apply one input if valid; otherwise do nothing. */
export function applyInput(world: World, data: SimData, input: Input): void {
  if (!isValidInput(world, data, input)) return;
  switch (input.type) {
    case 'enterArea':
      landArea(world, data, input.area);
      return;
    case 'leaveArea':
      leaveActive(world, data);
      return;
    case 'buyResearch':
      buyResearch(world, data, input.item);
      return;
    case 'buildExtractor':
      world.queue.push({ kind: 'extractor', node: input.node, cost: inputCost(world, input) });
      return;
    case 'buildRoute':
      world.queue.push({ kind: 'route', node: input.from, cost: inputCost(world, input) });
      return;
    case 'upgradeRoute':
      world.queue.push({ kind: 'upgrade', node: input.from, cost: inputCost(world, input) });
      return;
    case 'cancelBuild':
      world.queue.splice(input.index, 1);
      return;
    case 'setShipyard':
      world.yards[input.shipType].on = input.on;
      return;
    case 'sendShips': {
      const left = clampSendCounts(world, input.from, input.counts);
      // Ships are in id order, so the first of each type found are the lowest ids.
      for (const s of world.ships) {
        if (s.at !== input.from || left[s.type] === 0) continue;
        startTransit(world, s, input.to);
        left[s.type] -= 1;
      }
      // Sending to a guarded node while it lives is an attack (step folds same-tick orders per node into one wave).
      const target = guardianAt(world, input.to);
      if (target !== null && target.alive) {
        target.wavesSent++;
        world.stats.wavesSent++;
        // H5: a running battle takes the limit this wave was sent at.
        if (target.battle !== null) target.battle.capAtSend = fleetCap(world);
      }
      return;
    }
    case 'recycleShips': {
      const left = clampSendCounts(world, input.node, input.counts);
      let refund = 0;
      // Ships are in id order, so the first of each type found are the lowest ids.
      const kept = world.ships.filter((s) => {
        if (s.at !== input.node || left[s.type] === 0) return true;
        left[s.type] -= 1;
        refund += recycleRefundEach(world, s.type);
        world.stats.shipsRecycled[s.type] += 1;
        return false;
      });
      world.ships = kept;
      world.stock.ore += refund;
      world.stats.oreRefunded += refund;
      return;
    }
    case 'setRally':
      world.rally = input.node;
      return;
    case 'setTunable':
      if (isSimTunableKey(input.key)) world.tun[input.key] = input.value;
      return;
  }
}
