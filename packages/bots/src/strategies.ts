import {
  GUARD_TYPES,
  PROBE,
  SEND_ALL,
  SHIP_TYPES,
  areaStatus,
  designResearched,
  guardianStatus,
  isAreaOpen,
  isGuarded,
  nodeStatus,
  researchStatus,
  routeCapacityPerMin,
  shipCounts,
  unlockStatus,
  weightedMultPct,
  type Input,
  type ResearchId,
  type SimData,
  type World,
} from '@factory4x/sim';

/**
 * Strategies are stateless: every decision is derived from the world they are
 * given (read-only, through the sim's selectors), so a strategy is a pure
 * function of the state. They issue Input commands only.
 *
 * H4 (DESIGN.md "Bots: campaign strategies"): a campaign strategy chooses what to buy on the overworld and
 * which area to land in (`decideOverworld`); inside an area every strategy plays the same engine
 * (`decideArea`, the H3 engine): the economy plan, rally at a5, build out captured nodes, attack the
 * cheapest living target by estimate.
 */

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
  // An unguarded heart (Landfall) falls to the first ship.
  if (guardNeed(world, node) === 0) return power > 0;
  const k = Math.min(12, world.guardians.find((g) => g.node === node)!.wavesSent);
  return power * 3 * 4 ** k >= (guardNeed(world, node) + 20) * 5 ** k;
}

/** True while ships sit at, or fly to, a living guarded node (one wave at a time). */
function waveInFlight(world: Readonly<World>): boolean {
  const c = shipCounts(world);
  for (const g of world.guardians) if (g.alive && c.at[g.node]! + c.enRoute[g.node]! > 0) return true;
  return false;
}

/** The economy asteroids the plan builds on, in order (areas leave some out). */
const ECONOMY_NODES = ['a1', 'a2', 'a3', 'a4', 'a5'] as const;

/**
 * The in-area engine (the H3 engine): the economy plan on the area's asteroids, rally at a5 (present in every
 * area), build out every captured node, and attack the cheapest living target by estimate. A researched yard
 * runs once its component's resource has arrived. An area whose guards are all zero (Landfall) skips the
 * economy and sends the first ship.
 */
export function decideArea(world: Readonly<World>): Input[] {
  const inputs: Input[] = [];
  const a5 = nodeIndex(world, 'a5');
  const trivial = world.guardians.length > 0 && world.guardians.every((g) => guardNeed(world, g.node) === 0);
  const econ = trivial
    ? { done: true, order: null }
    : buildPlan(
        world,
        ECONOMY_NODES.map((id) => nodeIndex(world, id)).filter((n) => n >= 0),
      );
  if (!econ.done) {
    if (world.yards.drone.on) inputs.push({ type: 'setShipyard', shipType: 'drone', on: false });
    if (econ.order) inputs.push(econ.order);
    return inputs;
  }
  const unlocked = unlockStatus(world).ships;
  for (const t of SHIP_TYPES) {
    const want = t === 'drone' || (unlocked[t] && designResearched(world, t));
    if (world.yards[t].on !== want) inputs.push({ type: 'setShipyard', shipType: t, on: want });
  }
  if (a5 >= 0 && world.rally !== a5) inputs.push({ type: 'setRally', node: a5 });
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
  const target = nextTarget(world);
  if (target === null || !isGuarded(world, target)) return inputs;
  const fleet = c.atByType[a5]!;
  if (fleet.drone + fleet.lancer + fleet.flak > 0 && readyToAttack(world, target, fleetPower(world, target, fleet))) {
    inputs.push({ type: 'sendShips', from: a5, to: target, counts: SEND_ALL });
  }
  return inputs;
}

/** The research policy's order, as (item, level). */
export const RESEARCH_POLICY: ReadonlyArray<readonly [ResearchId, number]> = [
  ['core', 1],
  ['lancer', 1],
  ['flak', 1],
  ['opening', 1],
  ['extract', 1],
  ['rigs', 1],
  ['yards', 1],
  ['extract', 2],
  ['opening', 2],
  ['rigs', 2],
  ['yards', 2],
  ['extract', 3],
  ['opening', 3],
];
/** How many leading policy entries (the core and both designs) the no-research strategy buys. */
export const DESIGNS_ONLY_ENTRIES = 3;

export type ResearchKit = 'full' | 'designs' | 'none';

/** The first item the policy would buy now: the first in its list whose next level the sim says can be bought. Null if none. */
export function nextPurchase(world: Readonly<World>, data: SimData, kit: ResearchKit): ResearchId | null {
  const entries = kit === 'none' ? [] : kit === 'designs' ? RESEARCH_POLICY.slice(0, DESIGNS_ONLY_ENTRIES) : RESEARCH_POLICY;
  const rows = researchStatus(world, data);
  for (const [item, level] of entries) {
    const row = rows.find((r) => r.id === item)!;
    if (row.level === level - 1 && row.canBuy) return item;
  }
  return null;
}

/** The greedy estimate of an area: its heart's need (Σ caps × hp) and the best per-ship power ×100 among drones and the researched designs. */
export function areaEstimate(world: Readonly<World>, data: SimData, area: number): { need: number; powerX100: number } {
  const heart = areaStatus(world, data, area).guarded.find((g) => g.kind === 'heart')!;
  let need = 0;
  for (const t of GUARD_TYPES) need += heart.caps[t] * world.tun[`guard.${t}.hp`];
  let powerX100 = 0;
  for (const t of SHIP_TYPES) {
    if (!designResearched(world, t)) continue;
    powerX100 = Math.max(powerX100, world.tun[`ship.${t}.damage`] * weightedMultPct(world.tun, t, heart.caps));
  }
  return { need, powerX100 };
}

/** Open areas in data order. */
export function openAreas(world: Readonly<World>, data: SimData): number[] {
  const out: number[] = [];
  for (let a = 0; a < data.map.areas.length; a++) if (isAreaOpen(world, data, a)) out.push(a);
  return out;
}

/** The open area with the lowest estimate (need / power, compared by cross-multiplying), the lowest index on ties; null if none is open. */
export function cheapestOpenArea(world: Readonly<World>, data: SimData): number | null {
  let best: number | null = null;
  let be = { need: 0, powerX100: 1 };
  for (const a of openAreas(world, data)) {
    const e = areaEstimate(world, data, a);
    if (best === null || e.need * be.powerX100 < be.need * e.powerX100) {
      best = a;
      be = e;
    }
  }
  return best;
}

/**
 * A campaign strategy: what to buy on the overworld and which area to land in. Both are functions of the
 * world. Inside the area every strategy plays `decideArea`.
 */
export interface CampaignStrategy {
  name: string;
  description: string;
  /** 'full' buys by the research policy, 'designs' only the core and the designs, 'none' nothing (the flag 4 probes). */
  kit: ResearchKit;
  /** Area ids in the order to take them while open; after the list (or when the next isn't open) the cheapest open area. */
  route: readonly string[];
}

/** The area the strategy lands in next, or null if none is open. */
export function chooseArea(world: Readonly<World>, data: SimData, s: CampaignStrategy): number | null {
  for (const id of s.route) {
    const a = data.map.areas.findIndex((x) => x.id === id);
    if (a >= 0 && isAreaOpen(world, data, a)) return a;
  }
  return cheapestOpenArea(world, data);
}

/** The next overworld input: buy the policy's next item, else land in the chosen area, else nothing (stuck). */
export function decideOverworld(world: Readonly<World>, data: SimData, s: CampaignStrategy): Input | null {
  const item = nextPurchase(world, data, s.kit);
  if (item !== null) return { type: 'buyResearch', item: data.research.findIndex((r) => r.id === item) };
  const area = chooseArea(world, data, s);
  return area === null ? null : { type: 'enterArea', area };
}

export const strategies: CampaignStrategy[] = [
  {
    name: 'ice-line',
    description: 'Landfall, Frost Shelf, Spore Veil, The Deep, then the cheapest open area until the core is bought. Research policy.',
    kit: 'full',
    route: ['landfall', 'shelf', 'veil', 'deep'],
  },
  {
    name: 'crystal-line',
    description: 'Landfall, Glass Shoal, Thorn Garden, The Deep, then the cheapest open area until the core is bought. Research policy.',
    kit: 'full',
    route: ['landfall', 'shoal', 'garden', 'deep'],
  },
  {
    name: 'full-kit',
    description: 'Landfall, Frost Shelf, Glass Shoal, Spore Veil, Thorn Garden, The Deep. Research policy.',
    kit: 'full',
    route: ['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep'],
  },
  {
    name: 'greedy',
    description: 'After Landfall always the open area with the lowest estimate (heart need / best per-ship power). Research policy.',
    kit: 'full',
    route: [],
  },
  {
    name: 'no-research',
    description: "Greedy's area choice, but buys only the designs and the core.",
    kit: 'designs',
    route: [],
  },
];

