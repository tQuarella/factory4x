import { isSimTunableKey, type SimData, type TunableKey } from './data.ts';
import { ceilDiv } from './math.ts';
import { PROBE, nodeDistance, richIndex, routeFrom, type World } from './world.ts';

/**
 * Player intent (DESIGN.md H1 "Player inputs"). Node parameters are node
 * indices. Inputs are the only way the outside world changes the sim, and
 * every one is recorded in a replay's input log.
 */
export type Input =
  | { type: 'buildExtractor'; node: number }
  | { type: 'buildRoute'; from: number; to: number }
  | { type: 'upgradeRoute'; from: number }
  | { type: 'cancelBuild'; index: number }
  | { type: 'setShipyard'; on: boolean }
  /** count 0 = all ships at `from`. */
  | { type: 'sendShips'; from: number; to: number; count: number }
  | { type: 'setRally'; node: number }
  | { type: 'setTunable'; key: TunableKey; value: number };

function isIndex(world: Readonly<World>, v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < world.nodes.length;
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

function shipsAtCount(world: Readonly<World>, node: number): number {
  let n = 0;
  for (const s of world.ships) if (s.at === node) n++;
  return n;
}

/** True if `input` would change the world this tick. Invalid inputs are ignored by `step`; the client greys them out. */
export function isValidInput(world: Readonly<World>, data: SimData, input: Input): boolean {
  switch (input.type) {
    case 'buildExtractor': {
      if (!isIndex(world, input.node) || queueFull(world)) return false;
      const node = world.nodes[input.node]!;
      const allowedKind = node.kind === 'asteroid' || (node.kind === 'rich' && !world.guardian.alive);
      return allowedKind && extractorsCommitted(world, input.node) < node.slots;
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
      return typeof input.on === 'boolean';
    case 'sendShips':
      return (
        isIndex(world, input.from) &&
        isIndex(world, input.to) &&
        input.from !== input.to &&
        typeof input.count === 'number' &&
        Number.isInteger(input.count) &&
        input.count >= 0 &&
        shipsAtCount(world, input.from) > 0
      );
    case 'setRally':
      return isIndex(world, input.node);
    case 'setTunable': {
      if (!isSimTunableKey(input.key)) return false;
      if (typeof input.value !== 'number' || !Number.isInteger(input.value)) return false;
      const range = data.tunables[input.key];
      return input.value >= range.min && input.value <= range.max;
    }
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
      world.shipyard.on = input.on;
      return;
    case 'sendShips': {
      const rich = richIndex(world);
      let left = input.count === 0 ? Number.MAX_SAFE_INTEGER : input.count;
      for (const s of world.ships) {
        if (left === 0) break;
        if (s.at !== input.from) continue;
        startTransit(world, s, input.to);
        left--;
      }
      if (input.to === rich && world.guardian.alive) world.stats.wavesSent++;
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
