import {
  GUARD_TYPES,
  PROBE,
  SEND_ALL,
  SHIP_TYPES,
  guardianStatus,
  isGuarded,
  nodeStatus,
  routeCapacityPerMin,
  shipCounts,
  unlockStatus,
  weightedMultPct,
  type Input,
  type World,
} from '@factory4x/sim';

/**
 * A strategy looks at the world each tick and returns that tick's inputs.
 * Strategies are stateless: every decision is derived from the world they are
 * given (read-only, through the sim's selectors), so a strategy is a pure
 * function of the state. They issue Input commands only.
 *
 * The four H3 strategies (DESIGN.md H3 "Bot checks") share one engine
 * (`decideH3`): the H1 turtle economy plan on a1-a5, then rally at a5, build
 * out every captured node, and attack the cheapest living target by estimate.
 * They differ only in which yards they run and in the first door they take.
 */
export interface Strategy {
  name: string;
  description: string;
  /** Placeholder with no behavior; the report labels it and skips tuning flags. */
  stub?: boolean;
  decide(world: Readonly<World>): Input[];
}

/** Node index by map id ('a1', 'heart'); -1 if the map lacks it. */
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

/** All slots committed and built (none queued or under construction), and the route (with queued upgrades) carries the extraction or is at max level. */
export function nodeFinished(world: Readonly<World>, node: number): boolean {
  const s = nodeStatus(world, node);
  if (s.extractorsCommitted < s.slots || s.extractors < s.extractorsCommitted || s.routePending || s.route === null) return false;
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

/** Spec prize weights: heavy pockets 3, light pockets 2, Root 2, heart 1. */
function prizeWeight(world: Readonly<World>, node: number): number {
  const n = world.nodes[node]!;
  if (n.kind === 'pocket') return n.slots >= 3 ? 3 : 2;
  return n.kind === 'root' ? 2 : 1;
}

/** Spec estimate: need = Σ capEff × hp over guard types. */
export function guardNeed(world: Readonly<World>, node: number): number {
  const g = guardianStatus(world, node).guards;
  let need = 0;
  for (const t of GUARD_TYPES) need += g[t].cap * g[t].hp;
  return need;
}

/** Spec estimate: a fleet's per-round power at `node`, Σ n × damage × weighted multiplier / 100 (multiplier from the caps). */
export function fleetPower(world: Readonly<World>, node: number, fleet: Readonly<Record<(typeof SHIP_TYPES)[number], number>>): number {
  const g = guardianStatus(world, node).guards;
  const caps = { thorn: g.thorn.cap, spore: g.spore.cap };
  let p = 0;
  for (const t of SHIP_TYPES) p += Math.floor((fleet[t] * world.tun[`ship.${t}.damage`] * weightedMultPct(world.tun, t, caps)) / 100);
  return p;
}

/**
 * The first door: the light pocket (fewer than 3 slots) holding `prize`, while it is alive.
 * Every layout has exactly one light ice pocket and one light crystal pocket.
 */
export function firstDoor(world: Readonly<World>, prize: 'ice' | 'crystal'): number | null {
  for (const g of world.guardians) {
    const n = world.nodes[g.node]!;
    if (g.alive && n.kind === 'pocket' && n.slots < 3 && n.prize === prize) return g.node;
  }
  return null;
}

/** The living guarded node with the lowest need / prizeWeight; the heart only when it is the last one. */
export function nextTarget(world: Readonly<World>): number | null {
  let best: number | null = null;
  let bestScore = 0;
  let heart: number | null = null;
  for (const g of world.guardians) {
    if (!g.alive) continue;
    if (world.nodes[g.node]!.kind === 'heart') {
      heart = g.node;
      continue;
    }
    // Compare need/weight by cross-multiplying (integers only).
    const score = guardNeed(world, g.node);
    const w = prizeWeight(world, g.node);
    if (best === null || score * prizeWeight(world, best) < bestScore * w) {
      best = g.node;
      bestScore = score;
    }
  }
  return best ?? heart;
}

/** Ready to attack: power × 3 ≥ (need + 20) × (5/4)^(waves already sent there). */
export function readyToAttack(world: Readonly<World>, node: number, power: number): boolean {
  const k = Math.min(12, world.guardians.find((g) => g.node === node)!.wavesSent);
  return power * 3 * 4 ** k >= (guardNeed(world, node) + 20) * 5 ** k;
}

/** True while ships sit at, or fly to, a living guarded node (one wave at a time). */
function waveInFlight(world: Readonly<World>): boolean {
  const c = shipCounts(world);
  for (const g of world.guardians) if (g.alive && c.at[g.node]! + c.enRoute[g.node]! > 0) return true;
  return false;
}

export interface H3Plan {
  /** Run the lancer and flak yards once their component is unlocked (drones-only never does). */
  counters: boolean;
  /** Take the light pocket with this prize first, before the greedy rule applies. */
  door: 'ice' | 'crystal' | null;
}

export function decideH3(world: Readonly<World>, plan: H3Plan): Input[] {
  const inputs: Input[] = [];
  const a5 = nodeIndex(world, 'a5');
  const econ = buildPlan(world, ['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => nodeIndex(world, id)));
  if (!econ.done) {
    if (world.yards.drone.on) inputs.push({ type: 'setShipyard', shipType: 'drone', on: false });
    if (econ.order) inputs.push(econ.order);
    return inputs;
  }
  const unlocked = unlockStatus(world).ships;
  for (const t of SHIP_TYPES) {
    const want = t === 'drone' || (plan.counters && unlocked[t]);
    if (world.yards[t].on !== want) inputs.push({ type: 'setShipyard', shipType: t, on: want });
  }
  if (world.rally !== a5) inputs.push({ type: 'setRally', node: a5 });
  // After a capture: extractors up to the slots, a route, up to 2 upgrades (nextEconomyOrder), in capture order.
  const owned = world.stats.captures.map((c) => c.node).filter((n) => world.nodes[n]!.kind !== 'root');
  const out = buildPlan(world, owned);
  if (out.order) inputs.push(out.order);
  // Survivors parked at captured nodes regroup at a5.
  const c = shipCounts(world);
  for (const cap of world.stats.captures) {
    if (c.at[cap.node]! > 0) inputs.push({ type: 'sendShips', from: cap.node, to: a5, counts: SEND_ALL });
  }
  if (waveInFlight(world)) return inputs;
  const door = plan.door === null ? null : firstDoor(world, plan.door);
  const target = door ?? nextTarget(world);
  if (target === null || !isGuarded(world, target)) return inputs;
  const fleet = c.atByType[a5]!;
  if (fleet.drone + fleet.lancer + fleet.flak > 0 && readyToAttack(world, target, fleetPower(world, target, fleet))) {
    inputs.push({ type: 'sendShips', from: a5, to: target, counts: SEND_ALL });
  }
  return inputs;
}

export const strategies: Strategy[] = [
  {
    name: 'drones-only',
    description: 'Turtle economy a1-a5, then only the drone yard; takes the cheapest guarded node by estimate (need / prize weight, heart last) when power × 3 ≥ need + 20.',
    decide: (w) => decideH3(w, { counters: false, door: null }),
  },
  {
    name: 'ice-first',
    description: 'Economy plan, then drones take the light ice pocket first; flak on when ice arrives, lancer when crystal arrives; greedy after that.',
    decide: (w) => decideH3(w, { counters: true, door: 'ice' }),
  },
  {
    name: 'crystal-first',
    description: 'As ice-first, with the light crystal pocket first.',
    decide: (w) => decideH3(w, { counters: true, door: 'crystal' }),
  },
  {
    name: 'greedy',
    description: 'Economy plan, then always the cheapest next target by estimate with every unlocked yard on and the counter tags in the power estimate.',
    decide: (w) => decideH3(w, { counters: true, door: null }),
  },
];
