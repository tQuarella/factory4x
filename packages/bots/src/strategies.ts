import {
  GUARD_TYPES,
  PROBE,
  RAW_RESOURCES,
  SEND_ALL,
  SHIP_TYPES,
  areaStatus,
  designResearched,
  fleetCap,
  fleetCount,
  fleetStatus,
  guardianStatus,
  isFleetFull,
  researchLevel,
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
  type ResourceTriple,
  type ShipType,
  type ShipTypeCounts,
  type SimData,
  type World,
} from '@factory4x/sim';

/**
 * Strategies are stateless: every decision is derived from the world they are
 * given (read-only, through the sim's selectors), so a strategy is a pure
 * function of the state. They issue Input commands only.
 *
 * H5 (DESIGN.md "Bots: strategies and the probe"): a campaign strategy chooses what to buy on the overworld and which area to
 * land in (`decideOverworld`, with the runner's closed records); inside an area the composer engine (`decideComposer`)
 * plays under the fleet limit. The cap-off reference `greedy` plays the H3 engine (`decideArea`: the economy plan, rally at a5,
 * build out captures, attack the cheapest living target by estimate) at fleet.cap 0.
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


// ---------------------------------------------------------------------------------------------------------------------
// H5: the composer engine (DESIGN.md H5 "Bots: strategies and the probe"). It plays under the fleet limit: the
// answer to "what do I build" is a composition for a target at the limit, not a bigger fleet.
// ---------------------------------------------------------------------------------------------------------------------

/** Ship types the strategy can build in this area: drones; a lancer if its design is researched and the area has a crystal prize, flak likewise with ice (captured or not). */
export function buildableTypes(world: Readonly<World>, dronesOnly: boolean): ShipType[] {
  const out: ShipType[] = ['drone'];
  if (dronesOnly) return out;
  const prizes = new Set<string | null>();
  for (const n of world.nodes) if (n.kind === 'pocket') prizes.add(n.prize);
  if (designResearched(world, 'lancer') && prizes.has('crystal')) out.push('lancer');
  if (designResearched(world, 'flak') && prizes.has('ice')) out.push('flak');
  return out;
}

export interface Allocation {
  fleet: ShipTypeCounts;
  /** fleetPower (the H3 estimate) of that fleet at the target. */
  power: number;
}

const allocationCache = new Map<string, Allocation>();

/**
 * The best fleet of exactly `limit` ships over the buildable types against `node`: every (lancers l, flak f) with
 * l + f ≤ limit, drones = limit − l − f, the highest fleetPower at the node's caps. Ties go to fewer component
 * ships, then more lancers. A target with no guards needs one drone. Pure in its arguments (cached by the
 * per-type damage × multiplier it depends on).
 */
export function bestAllocation(world: Readonly<World>, node: number, limit: number, buildable: readonly ShipType[]): Allocation {
  const zero: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
  if (guardNeed(world, node) === 0) return { fleet: { ...zero, drone: Math.min(1, limit) }, power: Math.min(1, limit) };
  const g = guardianStatus(world, node).guards;
  const caps = { thorn: g.thorn.cap, spore: g.spore.cap };
  const unit = {} as Record<ShipType, number>;
  for (const t of SHIP_TYPES) unit[t] = world.tun[`ship.${t}.damage`] * weightedMultPct(world.tun, t, caps);
  const canL = buildable.includes('lancer');
  const canF = buildable.includes('flak');
  const key = `${limit}|${canL ? 1 : 0}${canF ? 1 : 0}|${unit.drone},${unit.lancer},${unit.flak}`;
  const hit = allocationCache.get(key);
  if (hit) return { fleet: { ...hit.fleet }, power: hit.power };
  const p = (t: ShipType, n: number): number => Math.floor((n * unit[t]) / 100);
  let best: Allocation | null = null;
  for (let l = 0; l <= (canL ? limit : 0); l++) {
    for (let f = 0; f <= (canF ? limit - l : 0); f++) {
      const d = limit - l - f;
      const power = p('drone', d) + p('lancer', l) + p('flak', f);
      const better =
        best === null ||
        power > best.power ||
        (power === best.power && (l + f < best.fleet.lancer + best.fleet.flak || (l + f === best.fleet.lancer + best.fleet.flak && l > best.fleet.lancer)));
      if (better) best = { fleet: { drone: d, lancer: l, flak: f }, power };
    }
  }
  if (allocationCache.size > 4000) allocationCache.clear();
  allocationCache.set(key, best!);
  return { fleet: { ...best!.fleet }, power: best!.power };
}

/** Living guarded nodes in the H3 target order: lowest need / prize weight first, the heart last. */
export function targetOrder(world: Readonly<World>): number[] {
  const rows: { node: number; need: number; w: number }[] = [];
  let heart: number | null = null;
  for (const g of world.guardians) {
    if (!g.alive) continue;
    if (world.nodes[g.node]!.kind === 'heart') heart = g.node;
    else rows.push({ node: g.node, need: guardNeed(world, g.node), w: prizeWeight(world, g.node) });
  }
  // Cross-multiplied need / weight (integers); equal scores keep node order.
  rows.sort((a, b) => a.need * b.w - b.need * a.w || a.node - b.node);
  const out = rows.map((r) => r.node);
  if (heart !== null) out.push(heart);
  return out;
}

export interface Target {
  node: number;
  fleet: ShipTypeCounts;
  /** The allocation passes the H3 attack test at this limit. */
  passes: boolean;
}

/**
 * The composer's target at `limit`: the first node in the H3 order whose best allocation passes the attack test
 * (power × 3 ≥ need + 20, raised per wave already sent). Null if none passes. `fallback` returns the first node
 * in the order with its best allocation instead (passes false) when none passes, for a visit that must be played.
 */
export function chooseTarget(world: Readonly<World>, limit: number, buildable: readonly ShipType[], fallback = false): Target | null {
  const order = targetOrder(world);
  for (const node of order) {
    const a = bestAllocation(world, node, limit, buildable);
    if (readyToAttack(world, node, a.power)) return { node, fleet: a.fleet, passes: true };
  }
  if (fallback && order.length > 0) return { node: order[0]!, fleet: bestAllocation(world, order[0]!, limit, buildable).fleet, passes: false };
  return null;
}

export interface ComposerOptions {
  dronesOnly: boolean;
  /** Play the visit even when nothing passes the attack test (every open area was closed): no withdrawal as closed. */
  forced: boolean;
}

export interface ComposerDecision {
  inputs: Input[];
  /** Nothing passes the attack test at the limit and no wave is in flight: the runner withdraws and records the area closed. */
  closed: boolean;
}

/** Ships of a type alive plus being built. */
function counted(world: Readonly<World>, data: SimData): ShipTypeCounts {
  const s = fleetStatus(world, data);
  return { drone: s.byType.drone + s.buildingByType.drone, lancer: s.byType.lancer + s.buildingByType.lancer, flak: s.byType.flak + s.buildingByType.flak };
}

/**
 * The composer engine: the H3 economy plan and rally at a5, then allocation, target, yards by allocation, recycle
 * of the surplus at a5, and the attack rule. Stateless; the runner records closed areas.
 */
export function decideComposer(world: Readonly<World>, data: SimData, opts: ComposerOptions): ComposerDecision {
  const inputs: Input[] = [];
  const a5 = nodeIndex(world, 'a5');
  const inFlight = waveInFlight(world);
  const trivial = world.guardians.length > 0 && world.guardians.every((g) => guardNeed(world, g.node) === 0);
  const buildable = buildableTypes(world, opts.dronesOnly);
  const cap = fleetCap(world, data);
  const limit = cap ?? Math.max(1, fleetCount(world));
  const target = chooseTarget(world, limit, buildable, opts.forced);
  const livingGuarded = world.guardians.some((g) => g.alive);
  if (target === null && !inFlight && livingGuarded && !opts.forced) return { inputs, closed: true };

  const econ = trivial
    ? { done: true, order: null }
    : buildPlan(
        world,
        ECONOMY_NODES.map((id) => nodeIndex(world, id)).filter((n) => n >= 0),
      );
  // Rally at a5 from the landing, so a ship a yard starts before the economy plan turns it off doesn't park at the probe.
  if (a5 >= 0 && world.rally !== a5) inputs.push({ type: 'setRally', node: a5 });
  if (!econ.done) {
    if (world.yards.drone.on) inputs.push({ type: 'setShipyard', shipType: 'drone', on: false });
    if (econ.order) inputs.push(econ.order);
    return { inputs, closed: false };
  }
  // The plan builds what can be built now: a type whose component hasn't been delivered here yet waits for its prize
  // (the target test above is optimistic about it, as the capability windows are), so the first waves are drones.
  const unlocked = unlockStatus(world).ships;
  const planTypes = buildable.filter((t) => unlocked[t]);
  const plan = target === null ? null : planTypes.length === buildable.length ? target.fleet : bestAllocation(world, target.node, limit, planTypes).fleet;
  const have = counted(world, data);
  for (const t of SHIP_TYPES) {
    // A wave in flight with no passing target keeps the yards as they are.
    const want = plan === null ? world.yards[t].on : planTypes.includes(t) && have[t] < plan[t];
    if (world.yards[t].on !== want) inputs.push({ type: 'setShipyard', shipType: t, on: want });
  }
  const owned = world.stats.captures.map((c) => c.node).filter((n) => world.nodes[n]!.kind !== 'root');
  const out = buildPlan(world, owned);
  if (out.order) inputs.push(out.order);
  const c = shipCounts(world);
  // Every idle ship regroups at a5: from captured nodes, the probe, or anywhere else that isn't a living guarded node (a wave).
  for (const n of world.nodes) {
    if (n.index !== a5 && c.at[n.index]! > 0 && !isGuarded(world, n.index)) inputs.push({ type: 'sendShips', from: n.index, to: a5, counts: SEND_ALL });
  }
  if (target === null || a5 < 0) return { inputs, closed: false };
  const at = c.atByType[a5]!;
  // Recycle: the fleet is full and a type parked at a5 is above its allocation.
  if (isFleetFull(world, data)) {
    const surplus: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
    let n = 0;
    for (const t of SHIP_TYPES) {
      surplus[t] = Math.max(0, at[t] - plan![t]);
      n += surplus[t];
    }
    if (n > 0) inputs.push({ type: 'recycleShips', node: a5, counts: surplus });
  }
  if (inFlight) return { inputs, closed: false };
  // Attack: the ships at a5 match the allocation, or the H3 threshold is met with what is there.
  const total = at.drone + at.lancer + at.flak;
  const matches = SHIP_TYPES.every((t) => at[t] >= plan![t]);
  if (total > 0 && (matches || readyToAttack(world, target.node, fleetPower(world, target.node, at)))) {
    inputs.push({ type: 'sendShips', from: a5, to: target.node, counts: SEND_ALL });
  }
  return { inputs, closed: false };
}

// ---------------------------------------------------------------------------------------------------------------------
// Research policy, area choice, strategies
// ---------------------------------------------------------------------------------------------------------------------

/** The research policy's order, as (item, level): H4's list without Command limit, which H6 removed (relays raise the limit; DESIGN.md H6 "Bots (H6)"). */
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

/** 'full' buys the whole policy; 'grind' only the four grind items (no core or designs); 'none' nothing. */
export type ResearchKit = 'full' | 'grind' | 'none';

const GRIND_ITEMS: readonly ResearchId[] = ['opening', 'extract', 'rigs', 'yards'];

/** The policy entries a kit buys, in order. */
export function kitEntries(kit: ResearchKit): ReadonlyArray<readonly [ResearchId, number]> {
  switch (kit) {
    case 'full':
      return RESEARCH_POLICY;
    case 'grind':
      return RESEARCH_POLICY.filter(([item]) => GRIND_ITEMS.includes(item));
    case 'none':
      return [];
  }
}

/** The first item the policy would buy now: the first in the kit's list whose next level the sim says can be bought. Null if none. */
export function nextPurchase(world: Readonly<World>, data: SimData, kit: ResearchKit): ResearchId | null {
  const rows = researchStatus(world, data);
  for (const [item, level] of kitEntries(kit)) {
    const row = rows.find((r) => r.id === item);
    if (row !== undefined && row.level === level - 1 && row.canBuy) return item;
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

/** Open (enterable) areas in data order. */
export function openAreas(world: Readonly<World>, data: SimData): number[] {
  const out: number[] = [];
  for (let a = 0; a < data.map.areas.length; a++) if (isAreaOpen(world, data, a)) out.push(a);
  return out;
}

/** The area with the lowest estimate (need / power, compared by cross-multiplying), the lowest index on ties; null if `areas` is empty. */
function cheapestOf(world: Readonly<World>, data: SimData, areas: readonly number[]): number | null {
  let best: number | null = null;
  let be = { need: 0, powerX100: 1 };
  for (const a of areas) {
    const e = areaEstimate(world, data, a);
    if (best === null || e.need * be.powerX100 < be.need * e.powerX100) {
      best = a;
      be = e;
    }
  }
  return best;
}

/** The open area with the lowest estimate, the lowest index on ties; null if none is open. */
export function cheapestOpenArea(world: Readonly<World>, data: SimData): number | null {
  return cheapestOf(world, data, openAreas(world, data));
}

/** What a closed record is valid for: the fleet limit and the designs. A record clears when either changes. */
export function closedKey(world: Readonly<World>, data: SimData): string {
  return `${fleetCap(world, data) ?? 0}|${researchLevel(world, 'lancer')}|${researchLevel(world, 'flak')}`;
}

/** Area index -> closedKey when it was recorded closed. */
export type ClosedRecords = ReadonlyMap<number, string>;

/** Which side of the map a strategy prefers when choosing between areas that advance its goal. */
export type SidePreference = 'ice' | 'crystal';

/**
 * A campaign strategy: what to buy on the overworld and which area to land in. Both are functions of the
 * world (and the closed records). Inside the area the composer engine plays, or the H3 engine for the cap-off reference.
 */
export interface CampaignStrategy {
  name: string;
  description: string;
  kit: ResearchKit;
  /** The side to prefer among areas that advance the goal (none: only the estimate and data order decide). */
  side?: SidePreference;
  /** 'composer' (default) or 'h3' (the cap-off reference). */
  engine?: 'composer' | 'h3';
  /** Build drones only, and choose areas by the H4 greedy rule (the drones-only strategy: it has no designs to save for). */
  dronesOnly?: boolean;
  /** Set `fleet.cap` to this on the first step (0 = the A/B reference); undefined keeps the data's default. */
  fleetCap?: number;
}

/** The first unmet goal of the needs-driven area choice (DESIGN.md H6 "Bots (H6)"). */
export type Goal =
  | { kind: 'designs'; missing: ResourceTriple }
  | { kind: 'relay'; band: number }
  | { kind: 'area'; id: string }
  | { kind: 'core'; missing: ResourceTriple };

/** The bands (tier values) that have a command relay in the data, ascending. */
function relayBands(data: SimData): number[] {
  const out: number[] = [];
  for (const a of data.map.areas) if (a.relay && !out.includes(a.tier)) out.push(a.tier);
  return out.sort((x, y) => x - y);
}

/** The area ids the core needs reclaimed (the data's win item). */
function coreAreas(data: SimData): string[] {
  const core = data.research.find((r) => r.kind === 'win');
  const out: string[] = [];
  for (const q of core?.requires ?? []) if ('area' in q) out.push(q.area);
  return out;
}

const isMissing = (t: ResourceTriple): boolean => RAW_RESOURCES.some((r) => t[r] > 0);

/**
 * The first unmet goal, in order: (1) the stockpile can afford the designs not yet bought, (2) a band 1 relay is
 * reclaimed, (3) a band 2 relay, (4) The Deep (each area the core needs), (5) the core is affordable. A relay goal
 * the data has no relay for is skipped. Null when all are met (the core is then bought, which ends the game).
 */
export function firstUnmetGoal(world: Readonly<World>, data: SimData): Goal | null {
  const rows = researchStatus(world, data);
  const stock = world.campaign.stockpile;
  const short = (cost: ResourceTriple | null): ResourceTriple => ({
    ore: cost === null ? 0 : Math.max(0, cost.ore - stock.ore),
    ice: cost === null ? 0 : Math.max(0, cost.ice - stock.ice),
    crystal: cost === null ? 0 : Math.max(0, cost.crystal - stock.crystal),
  });
  // 1. Both designs affordable together (or already bought).
  const need: ResourceTriple = { ore: 0, ice: 0, crystal: 0 };
  for (const id of ['lancer', 'flak'] as const) {
    const row = rows.find((r) => r.id === id);
    if (row === undefined || row.level >= row.maxLevel || row.cost === null) continue;
    for (const r of RAW_RESOURCES) need[r] += row.cost[r];
  }
  const designs = short(need);
  if (isMissing(designs)) return { kind: 'designs', missing: designs };
  // 2-3. A relay in each band that has one.
  for (const band of relayBands(data)) {
    const reclaimed = data.map.areas.some((a, i) => a.relay && a.tier === band && world.campaign.areas[i]!.reclaimedTick !== null);
    if (!reclaimed) return { kind: 'relay', band };
  }
  // 4. The areas the core needs.
  for (const id of coreAreas(data)) {
    const i = data.map.areas.findIndex((a) => a.id === id);
    if (i >= 0 && world.campaign.areas[i]!.reclaimedTick === null) return { kind: 'area', id };
  }
  // 5. The core affordable.
  const core = rows.find((r) => r.id === 'core');
  if (core === undefined || core.level >= core.maxLevel) return null;
  const missing = short(core.cost);
  return isMissing(missing) ? { kind: 'core', missing } : null;
}

/** Area indices lane-joined to `a`, in lane order. */
function neighboursOf(data: SimData, a: number): number[] {
  const id = data.map.areas[a]!.id;
  const out: number[] = [];
  for (const [x, y] of data.map.lanes) {
    const other = x === id ? y : y === id ? x : null;
    if (other !== null) out.push(data.map.areas.findIndex((z) => z.id === other));
  }
  return out;
}

/**
 * The enterable areas that advance `goal`. A resource goal: areas whose haul now (decayed for a repeat) adds a missing
 * resource. A relay or area goal: the target itself if enterable, else the enterable areas lane-joined to a target
 * (the step toward it). Empty if none does.
 */
export function advancingAreas(world: Readonly<World>, data: SimData, goal: Goal, enterable: readonly number[]): number[] {
  if (goal.kind === 'designs' || goal.kind === 'core') {
    return enterable.filter((a) => {
      const h = areaStatus(world, data, a).haulNow;
      return RAW_RESOURCES.some((r) => goal.missing[r] > 0 && h[r] > 0);
    });
  }
  const targets: number[] = [];
  data.map.areas.forEach((area, i) => {
    if (goal.kind === 'relay' ? area.relay && area.tier === goal.band : area.id === goal.id) targets.push(i);
  });
  const direct = enterable.filter((a) => targets.includes(a));
  if (direct.length > 0) return direct;
  return enterable.filter((a) => neighboursOf(data, a).some((n) => targets.includes(n)));
}

export interface AreaChoice {
  area: number;
  /** Every open area is recorded closed: land in the cheapest anyway and play it out (visit cap and softlock rule apply). */
  forced: boolean;
}

/**
 * The area the strategy lands in next, or null if none is open. The candidates are the enterable areas not recorded
 * closed at the current limit and designs, narrowed to those that advance the first unmet goal (if any do), then to
 * the strategy's side (if any is on it): the cheapest by estimate, ties to data order. `drones-only` has no goal and
 * takes the cheapest. If every open area is closed, the cheapest of them, forced.
 */
export function chooseArea(world: Readonly<World>, data: SimData, s: CampaignStrategy, closed: ClosedRecords = new Map()): AreaChoice | null {
  const key = closedKey(world, data);
  const open = openAreas(world, data);
  const live = open.filter((a) => closed.get(a) !== key);
  let pool = live;
  const goal = s.dronesOnly === true ? null : firstUnmetGoal(world, data);
  if (goal !== null) {
    const adv = advancingAreas(world, data, goal, live);
    if (adv.length > 0) pool = adv;
  }
  if (s.side !== undefined) {
    const preferred = pool.filter((a) => data.map.areas[a]!.side === s.side);
    if (preferred.length > 0) pool = preferred;
  }
  const pick = cheapestOf(world, data, pool);
  if (pick !== null) return { area: pick, forced: false };
  const any = cheapestOf(world, data, open);
  return any === null ? null : { area: any, forced: true };
}

export interface OverworldDecision {
  input: Input | null;
  /** The landing is forced (see AreaChoice). */
  forced: boolean;
}

/** The next overworld input: buy the policy's next item, else land in the chosen area, else nothing (stuck). */
export function decideOverworld(world: Readonly<World>, data: SimData, s: CampaignStrategy, closed: ClosedRecords = new Map()): OverworldDecision {
  const item = nextPurchase(world, data, s.kit);
  if (item !== null) return { input: { type: 'buyResearch', item: data.research.findIndex((r) => r.id === item) }, forced: false };
  const choice = chooseArea(world, data, s, closed);
  return choice === null ? { input: null, forced: false } : { input: { type: 'enterArea', area: choice.area }, forced: choice.forced };
}

export const strategies: CampaignStrategy[] = [
  {
    name: 'composer',
    description: 'Needs-driven area choice (designs, band 1 relay, band 2 relay, The Deep, the core), no side preference, the composer engine.',
    kit: 'full',
  },
  {
    name: 'ice-first',
    description: 'The composer, preferring ice-side areas among those that advance its goal.',
    kit: 'full',
    side: 'ice',
  },
  {
    name: 'crystal-first',
    description: 'The composer, preferring crystal-side areas among those that advance its goal.',
    kit: 'full',
    side: 'crystal',
  },
  {
    name: 'drones-only',
    description: 'The composer engine with drones as the only buildable type, H4 greedy area choice. Buys only grind research: no designs, no core.',
    kit: 'grind',
    dronesOnly: true,
  },
  {
    name: 'cap-off',
    description: 'Cap-off reference (fleet.cap 0): the composer strategy, the H3 engine inside areas. Relays still open bands.',
    kit: 'full',
    engine: 'h3',
    fleetCap: 0,
  },
];

/** Strategies meant to win: the bot gate's no-softlock check covers only these (flag 1). */
export const WINNING_STRATEGIES: readonly string[] = ['composer', 'ice-first', 'crystal-first'];
