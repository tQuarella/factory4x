import {
  PROBE,
  isCaptured,
  nodeStatus,
  richIndex,
  routeCapacityPerMin,
  shipCounts,
  type Input,
  type World,
} from '@factory4x/sim';

/**
 * A strategy looks at the world each tick and returns that tick's inputs.
 * Strategies are stateless: every decision is derived from the world they are
 * given (read-only, through the sim's selectors), so a strategy is a pure
 * function of the state. They issue Input commands only.
 *
 * rush and turtle follow DESIGN.md H1 "Bot strategies (M1)". greedy-expansion
 * and raid-supply are STUBS (no behavior, `stub: true`); raid-supply needs mob
 * supply lines, which are out of scope for M1.
 */
export interface Strategy {
  name: string;
  description: string;
  /** Placeholder with no behavior; the report labels it and skips tuning flags. */
  stub?: boolean;
  decide(world: Readonly<World>): Input[];
}

const NONE: Input[] = [];

/** Node index by map id ('a1', 'rich'); -1 if the map lacks it. */
function nodeIndex(world: Readonly<World>, id: string): number {
  for (const n of world.nodes) if (n.id === id) return n.index;
  return -1;
}

/**
 * The next economy order that grows `node` toward a full network, or null when
 * it is finished or an order is already waiting. Preference: first extractor,
 * route, upgrade the route when extraction exceeds its capacity, then fill the
 * remaining slots. It orders only when the queue is empty, so each node is
 * built one item at a time.
 */
export function nextEconomyOrder(world: Readonly<World>, node: number): Input | null {
  if (world.queue.length > 0) return null;
  const s = nodeStatus(world, node);
  if (s.extractorsCommitted === 0) return { type: 'buildExtractor', node };
  if (s.route === null) return s.routePending ? null : { type: 'buildRoute', from: node, to: PROBE };
  const target = s.route.level + s.route.pendingUpgrades;
  if (s.extractPerMin > routeCapacityPerMin(world, target) && target < s.route.maxLevel) {
    return { type: 'upgradeRoute', from: node };
  }
  if (s.extractorsCommitted < s.slots) return { type: 'buildExtractor', node };
  return null;
}

/** All slots committed, and the route (with queued upgrades) carries the extraction or is at max level. */
export function nodeFinished(world: Readonly<World>, node: number): boolean {
  const s = nodeStatus(world, node);
  if (s.extractorsCommitted < s.slots || s.routePending || s.route === null) return false;
  const target = s.route.level + s.route.pendingUpgrades;
  return s.extractPerMin <= routeCapacityPerMin(world, target) || target >= s.route.maxLevel;
}

/** Build the nodes in order; `done` when every one is finished, else the next order (or null while waiting). */
function buildPlan(world: Readonly<World>, nodes: number[]): { done: boolean; order: Input | null } {
  for (const n of nodes) {
    if (nodeFinished(world, n)) continue;
    return { done: false, order: nextEconomyOrder(world, n) };
  }
  return { done: true, order: null };
}

/** Ships at or heading to the rich node. */
function shipsAtOrHeadingRich(world: Readonly<World>): number {
  const c = shipCounts(world);
  const r = richIndex(world);
  return c.at[r]! + c.enRoute[r]!;
}

const RUSH_FIRST_WAVE = 6;
const RUSH_WAVE_STEP = 6;

/** rush: small economy, frequent waves, growing after each failure. */
export function rushDecide(world: Readonly<World>): Input[] {
  const inputs: Input[] = [];
  const rich = richIndex(world);
  if (!world.shipyard.on) inputs.push({ type: 'setShipyard', on: true });
  if (world.rally !== PROBE) inputs.push({ type: 'setRally', node: PROBE });

  const captured = isCaptured(world);
  const plan = buildPlan(world, captured ? [rich] : [nodeIndex(world, 'a1'), nodeIndex(world, 'a2')]);
  if (plan.order) inputs.push(plan.order);

  if (!captured && shipsAtOrHeadingRich(world) === 0) {
    const wave = RUSH_FIRST_WAVE + RUSH_WAVE_STEP * world.stats.wavesSent;
    if (shipCounts(world).at[PROBE]! >= wave) inputs.push({ type: 'sendShips', from: PROBE, to: rich, count: 0 });
  }
  return inputs;
}

const TURTLE_WAVE = 32;

/** turtle: economy first (shipyard off), then one big wave from a5. */
export function turtleDecide(world: Readonly<World>): Input[] {
  const inputs: Input[] = [];
  const rich = richIndex(world);
  const a5 = nodeIndex(world, 'a5');
  const captured = isCaptured(world);
  const plan = buildPlan(world, ['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => nodeIndex(world, id)));

  if (!plan.done) {
    if (world.shipyard.on) inputs.push({ type: 'setShipyard', on: false });
    if (plan.order) inputs.push(plan.order);
    return inputs;
  }
  if (!world.shipyard.on) inputs.push({ type: 'setShipyard', on: true });
  if (world.rally !== a5) inputs.push({ type: 'setRally', node: a5 });
  if (captured) {
    const out = buildPlan(world, [rich]);
    if (out.order) inputs.push(out.order);
  } else if (shipsAtOrHeadingRich(world) === 0 && shipCounts(world).at[a5]! >= TURTLE_WAVE) {
    inputs.push({ type: 'sendShips', from: a5, to: rich, count: 0 });
  }
  return inputs;
}

export const strategies: Strategy[] = [
  {
    name: 'rush',
    description: 'Small economy (a1, a2), shipyard always on, a wave whenever the probe holds enough ships; each wave is 6 bigger.',
    decide: rushDecide,
  },
  {
    name: 'turtle',
    description: 'Shipyard off until a1-a5 are fully built, then rally at a5 and send one wave of 32.',
    decide: turtleDecide,
  },
  { name: 'greedy-expansion', description: 'STUB (no behavior): claim as many resource nodes as fast as possible.', stub: true, decide: () => NONE },
  { name: 'raid-supply', description: 'STUB (no behavior, out of scope for M1): target mob logistics instead of defenders.', stub: true, decide: () => NONE },
];
