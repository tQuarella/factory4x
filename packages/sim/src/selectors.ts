import {
  COMPONENTS,
  COMPONENT_INPUT,
  GUARD_TYPES,
  SHIP_COMPONENT,
  SHIP_TYPES,
  type Component,
  type GuardType,
  type NodeKind,
  type Prize,
  type RawResource,
  type Resource,
  type ShipType,
  type Tunables,
} from './data.ts';
import { designResearched, extractPct, yardBuildTicks } from './campaign.ts';
import { isFleetFull } from './fleet.ts';
import { shipsAtByType } from './inputs.ts';
import { counterPct, deliveredInWindow, perExtractorPerMin, prizeInWindow, reservedOre } from './step.ts';
import {
  capEff,
  countGuards,
  guardCaps,
  guardRegrowTicks,
  guardRepair,
  guardianAt,
  heartIndex,
  rootIndex,
  routeFrom,
  ticksPerMin,
  type BattleResult,
  type BuildKind,
  type BuildOrder,
  type GuardCounts,
  type Guardian,
  type ShipTypeCounts,
  type World,
} from './world.ts';

/**
 * Read-only views for the HUD, node sheets, bots and tests (DESIGN.md H1, H2
 * and H3 "Observable values"). None of them change the world. Rates that
 * need a decimal place are returned in tenths (`…X10`) to stay integer.
 */

/** True once the heart (the Bloom) has been captured. */
export function isCaptured(world: Readonly<World>): boolean {
  return world.capturedTick !== null;
}

/** True once the Root has been captured (cut). */
export function isRootCut(world: Readonly<World>): boolean {
  return world.stats.rootCutTick !== null;
}

/** Ore delivered by routes over the last 60 game seconds (the HUD's headline number). Ore only. */
export function throughputPerMin(world: Readonly<World>): number {
  return deliveredInWindow(world);
}

/** Ice and crystal delivered by routes over the last 60 game seconds (shown small under their chips). */
export function prizePerMin(world: Readonly<World>): { ice: number; crystal: number } {
  return { ice: prizeInWindow(world, 'ice'), crystal: prizeInWindow(world, 'crystal') };
}

/** Total ore income per minute: route deliveries plus probe mining. */
export function incomePerMin(world: Readonly<World>): number {
  return deliveredInWindow(world) + world.tun['economy.probeOrePerMin'];
}

/**
 * Ships per minute ×10 that one yard sustains at the current ore income:
 * min(income / cost, T / buildTicks). 0 when that yard is off. Components are
 * not counted (see assemblerStatus for the component throttle).
 */
export function shipsPerMinX10(world: Readonly<World>, type: ShipType = 'drone'): number {
  if (!world.yards[type].on) return 0;
  const byOre = Math.floor((incomePerMin(world) * 10) / world.tun[`ship.${type}.cost`]);
  const byYard = Math.floor((ticksPerMin(world) * 10) / yardBuildTicks(world, type));
  return Math.min(byOre, byYard);
}

export interface ShipCounts {
  /** Ships parked at each node, by node index. */
  at: number[];
  /** Ships in transit toward each node, by node index. */
  enRoute: number[];
  /** The same, by type. */
  atByType: ShipTypeCounts[];
  enRouteByType: ShipTypeCounts[];
  total: number;
  /** Every ship anywhere, by type (HUD ship chips). */
  byType: ShipTypeCounts;
}

const zeroShips = (): ShipTypeCounts => ({ drone: 0, lancer: 0, flak: 0 });

/** Ship counts per node and per type (badges, "From A5 · 8" buttons, the send panel, HUD chips). */
export function shipCounts(world: Readonly<World>): ShipCounts {
  const n = world.nodes.length;
  const at = new Array<number>(n).fill(0);
  const enRoute = new Array<number>(n).fill(0);
  const atByType = Array.from({ length: n }, zeroShips);
  const enRouteByType = Array.from({ length: n }, zeroShips);
  const byType = zeroShips();
  for (const s of world.ships) {
    byType[s.type] += 1;
    if (s.at !== null) {
      at[s.at] = at[s.at]! + 1;
      atByType[s.at]![s.type] += 1;
    } else if (s.transit) {
      enRoute[s.transit.to] = enRoute[s.transit.to]! + 1;
      enRouteByType[s.transit.to]![s.type] += 1;
    }
  }
  return { at, enRoute, atByType, enRouteByType, total: world.ships.length, byType };
}

export { shipsAtByType };

export interface UnlockStatus {
  /** Show the resource's HUD chip: ore always; ice and crystal once first delivered; lens and plating once their prize has been delivered. */
  resources: Record<Resource, boolean>;
  /** Show the ship type's yard row and chip: drone always; lancer once crystal has been delivered; flak once ice has. */
  ships: Record<ShipType, boolean>;
}

/** What the player has unlocked so far: chips and yard rows for resources not yet owned stay hidden (DESIGN.md H3 "HUD"). */
export function unlockStatus(world: Readonly<World>): UnlockStatus {
  const first = world.stats.firstDeliveredTick;
  const ice = first.ice !== null;
  const crystal = first.crystal !== null;
  return {
    resources: { ore: true, ice, crystal, lens: crystal || world.stock.lens > 0, plating: ice || world.stock.plating > 0 },
    ships: { drone: true, lancer: crystal, flak: ice },
  };
}

export interface RouteStatus {
  level: number;
  maxLevel: number;
  /** level × podOrePerLevel × T / podIntervalTicks (units of the node's prize). */
  capacityPerMin: number;
  /** Upgrades queued or under construction. */
  pendingUpgrades: number;
  podsInFlight: number;
}

export interface NodeStatus {
  /** What it yields (ore, ice or crystal), or null for the probe and the Root. */
  prize: RawResource | null;
  extractors: number;
  slots: number;
  /** Built + under construction + queued. */
  extractorsCommitted: number;
  /** Units per minute one extractor yields here with Extraction research applied, whole units (floor). */
  perExtractorPerMin: number;
  /** The same in tenths of a unit per minute, rounded down: 12.5 -> 125, but the heart's 31.25 shows as 31.2. Totals below are not built from this rounded figure. */
  perExtractorPerMinX10: number;
  /** extractors x per-extractor rate with research applied, whole units (floor). */
  extractPerMin: number;
  /** The total in tenths, from the unrounded product (4 heart extractors at +25%: 1250). */
  extractPerMinX10: number;
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

/** Units per minute a route of this level carries at current tunables. */
export function routeCapacityPerMin(world: Readonly<World>, level: number): number {
  return Math.floor((level * world.tun['route.podOrePerLevel'] * ticksPerMin(world)) / world.tun['route.podIntervalTicks']);
}

/** Tenths of a unit per minute one extractor yields at a node of this kind, with Extraction research (what `extraction` in step.ts adds). */
function boostedX10(world: Readonly<World>, kind: World['nodes'][number]['kind']): number {
  return Math.floor((perExtractorPerMin(world.tun, kind) * extractPct(world)) / 10);
}

/** Extraction, buffer and route state for one node (asteroid, captured pocket and heart sheets). */
export function nodeStatus(world: Readonly<World>, node: number): NodeStatus {
  const n = world.nodes[node]!;
  const perX10 = boostedX10(world, n.kind);
  // Totals come from the unrounded product, as `extraction` in step.ts accumulates it.
  const totalX100 = n.extractors * perExtractorPerMin(world.tun, n.kind) * extractPct(world);
  const route = routeFrom(world, node);
  const bufferCap = world.tun['node.bufferCap'];
  return {
    prize: n.prize,
    extractors: n.extractors,
    slots: n.slots,
    extractorsCommitted: n.extractors + pendingOf(world, 'extractor', node),
    perExtractorPerMin: Math.floor(perX10 / 10),
    perExtractorPerMinX10: perX10,
    extractPerMin: Math.floor(totalX100 / 100),
    extractPerMinX10: Math.floor(totalX100 / 10),
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
  /** Ore held back from the assemblers and yards for queued orders. */
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

/**
 * A yard's state for its status line, first match wins: 'building' (a ship in
 * progress); H4 'needsDesign' (lancer or flak design not researched: it can't
 * run, on or off); H4 'noSource' (no component in stock and no node in this
 * area yields its input, so it can never get one here: "No crystal here");
 * 'off'; H5 'fleetFull' (on and idle, but the fleet is at its limit: "idle:
 * fleet full (12/12)", before any component or ore reason); 'needsComponent'
 * ("idle: needs lens"; the scarce input);
 * 'needsOre' ("idle: needs ore"); 'ready' (on, idle and affordable: it starts
 * on the next tick).
 */
export type YardState = 'building' | 'needsDesign' | 'noSource' | 'off' | 'fleetFull' | 'needsComponent' | 'needsOre' | 'ready';

export interface YardRow {
  type: ShipType;
  on: boolean;
  /** Its resource has been delivered in this area (DESIGN.md H3: lancer and flak rows were hidden until then). H4 shows a row if `unlocked || researched`. */
  unlocked: boolean;
  /** H4: its design is researched (always true for drones). */
  researched: boolean;
  /** 0 when idle. */
  ticksLeft: number;
  /** For a progress bar: the build time at current tunables and research (Fast yards, floor 15). */
  totalTicks: number;
  /** Ore per ship. */
  cost: number;
  /** The component it also consumes (1 per ship), or null for drones. */
  component: Component | null;
  hp: number;
  damage: number;
  state: YardState;
}

export interface YardStatus {
  /** Drone, lancer, flak (display order). */
  yards: YardRow[];
  rally: number;
  /** Probe mining, ore per minute. */
  probeOrePerMin: number;
}

/** The probe's Yards block: one row per ship type, plus the rally point and probe mining. */
export function yardStatus(world: Readonly<World>): YardStatus {
  const t = world.tun;
  const free = world.stock.ore - reservedOre(world);
  const unlocked = unlockStatus(world).ships;
  const full = isFleetFull(world);
  const yards = SHIP_TYPES.map((type): YardRow => {
    const y = world.yards[type];
    const cost = t[`ship.${type}.cost`];
    const component = SHIP_COMPONENT[type];
    const researched = designResearched(world, type);
    const source = component === null || world.stock[component] > 0 || world.nodes.some((n) => n.prize === COMPONENT_INPUT[component]);
    let state: YardState;
    if (y.ticksLeft > 0) state = 'building';
    else if (!researched) state = 'needsDesign';
    else if (!source) state = 'noSource';
    else if (!y.on) state = 'off';
    else if (full) state = 'fleetFull';
    else if (component !== null && world.stock[component] < 1) state = 'needsComponent';
    else if (free < cost) state = 'needsOre';
    else state = 'ready';
    return {
      type,
      on: y.on,
      unlocked: unlocked[type],
      researched,
      ticksLeft: y.ticksLeft,
      totalTicks: Math.max(y.ticksLeft, yardBuildTicks(world, type)),
      cost,
      component,
      hp: t[`ship.${type}.hp`],
      damage: t[`ship.${type}.damage`],
      state,
    };
  });
  return { yards, rally: world.rally, probeOrePerMin: t['economy.probeOrePerMin'] };
}

/** An assembler's state: 'making', 'full' (stock at the cap), 'needsInput' ("needs crystal"), 'needsOre', or 'ready' (starts next tick). */
export type AssemblerState = 'making' | 'full' | 'needsInput' | 'needsOre' | 'ready';

export interface AssemblerRow {
  component: Component;
  stock: number;
  stockCap: number;
  ticksLeft: number;
  totalTicks: number;
  /** Recipe: `ore` ore + `inputAmount` of `input`. */
  ore: number;
  input: Prize;
  inputAmount: number;
  /** Its row is shown: the input has been delivered at least once. */
  unlocked: boolean;
  state: AssemblerState;
}

/** The probe's Assembly block: lens, then plating. */
export function assemblerStatus(world: Readonly<World>): AssemblerRow[] {
  const t = world.tun;
  const free = world.stock.ore - reservedOre(world);
  const res = unlockStatus(world).resources;
  return COMPONENTS.map((c): AssemblerRow => {
    const a = world.assemblers[c];
    const input = COMPONENT_INPUT[c];
    const ore = t[`component.${c}.ore`];
    const inputAmount = c === 'lens' ? t['component.lens.crystal'] : t['component.plating.ice'];
    const stockCap = t['component.stockCap'];
    let state: AssemblerState;
    if (a.ticksLeft > 0) state = 'making';
    else if (world.stock[c] >= stockCap) state = 'full';
    else if (world.stock[input] < inputAmount) state = 'needsInput';
    else if (free < ore) state = 'needsOre';
    else state = 'ready';
    return {
      component: c,
      stock: world.stock[c],
      stockCap,
      ticksLeft: a.ticksLeft,
      totalTicks: Math.max(a.ticksLeft, t['component.buildTicks']),
      ore,
      input,
      inputAmount,
      unlocked: res[c],
      state,
    };
  });
}

export type Tag = 'strong' | 'even' | 'weak';

export interface CounterTag {
  /** The guard-hp-weighted multiplier, percent: Σ count × hp × mult / Σ count × hp (integer, division last). 100 with no guards. */
  multPct: number;
  /** Strong at ≥ 150, Weak at ≤ 75, Even otherwise. Drones are always Even. */
  tag: Tag;
}

/** Strong/Even/Weak thresholds on the weighted multiplier (DESIGN.md H3 "Pocket, Root and heart sheets"). */
export const TAG_STRONG_PCT = 150;
export const TAG_WEAK_PCT = 75;

/**
 * The guard-hp-weighted damage multiplier of a ship type against a guard mix:
 * Σ over guard types of count × hp × mult / Σ count × hp, in percent, integer
 * with the division last. 100 for drones and for an empty mix. Bots may pass
 * the effective caps instead of the live counts.
 */
export function weightedMultPct(t: Readonly<Tunables>, ship: ShipType, counts: Readonly<GuardCounts>): number {
  if (ship === 'drone') return 100;
  let num = 0;
  let den = 0;
  for (const gt of GUARD_TYPES) {
    const w = counts[gt] * t[`guard.${gt}.hp`];
    num += w * counterPct(t, ship, gt);
    den += w;
  }
  return den === 0 ? 100 : Math.floor(num / den);
}

/** The Strong/Even/Weak tag for a weighted multiplier. */
export function tagFor(ship: ShipType, multPct: number): Tag {
  if (ship === 'drone') return 'even';
  if (multPct >= TAG_STRONG_PCT) return 'strong';
  if (multPct <= TAG_WEAK_PCT) return 'weak';
  return 'even';
}

/** The tag for a ship type against a mix (bots: pass the caps; sheets: use guardianStatus().tags, which uses live counts). */
export function counterTag(t: Readonly<Tunables>, ship: ShipType, counts: Readonly<GuardCounts>): CounterTag {
  const multPct = weightedMultPct(t, ship, counts);
  return { multPct, tag: tagFor(ship, multPct) };
}

export interface GuardRow {
  type: GuardType;
  count: number;
  /** Effective cap now (capEff of the layout count, or of the starved count for the starved heart). */
  cap: number;
  /** Ticks toward the next guard of this type, and the period (regrow "1 / 2.0 s"). 0 at cap. */
  regrowProgress: number;
  regrowTicks: number;
  hp: number;
  damage: number;
  repairPerRound: number;
}

export interface GuardianStatus {
  /** The guarded node. */
  node: number;
  kind: NodeKind;
  alive: boolean;
  /** What capturing it yields (pockets: ice or crystal; the heart: ore; the Root: null), its slots and per-extractor rate. */
  prize: RawResource | null;
  slots: number;
  prizePerMinPerExtractor: number;
  /** The same in tenths, with Extraction research applied. */
  prizePerMinPerExtractorX10: number;
  /** One row per guard type: Thorns, then Spores. */
  guards: Record<GuardType, GuardRow>;
  /** Living guards and effective caps, both types. */
  total: number;
  totalCap: number;
  /** Each living guard in id order (ring drawing). */
  guardHps: Array<{ type: GuardType; hp: number }>;
  /** The heart: 'fed' while the Root lives, 'starved' once it is cut. Others: null. */
  supply: 'fed' | 'starved' | null;
  /** Strong/Even/Weak per ship type against the live guard mix. */
  tags: Record<ShipType, CounterTag>;
}

function guardianOrThrow(world: Readonly<World>, node: number): Guardian {
  const g = guardianAt(world, node);
  if (g === null) throw new Error(`node ${node} is not a guarded node`);
  return g;
}

/** A guarded node's sheet: prize, guard rows per type, and the counter tags per ship type. */
export function guardianStatus(world: Readonly<World>, node: number): GuardianStatus {
  const g = guardianOrThrow(world, node);
  const t = world.tun;
  const n = world.nodes[node]!;
  const caps = guardCaps(world, g);
  const counts = countGuards(g);
  const row = (type: GuardType): GuardRow => ({
    type,
    count: counts[type],
    cap: caps[type],
    regrowProgress: g.regrowProgress[type],
    regrowTicks: guardRegrowTicks(world, g, type),
    hp: t[`guard.${type}.hp`],
    damage: t[`guard.${type}.damage`],
    repairPerRound: guardRepair(world, g, type),
  });
  const tags = {} as Record<ShipType, CounterTag>;
  for (const s of SHIP_TYPES) tags[s] = counterTag(t, s, counts);
  return {
    node,
    kind: n.kind,
    alive: g.alive,
    prize: n.prize,
    slots: n.slots,
    prizePerMinPerExtractor: Math.floor(boostedX10(world, n.kind) / 10),
    prizePerMinPerExtractorX10: boostedX10(world, n.kind),
    guards: { thorn: row('thorn'), spore: row('spore') },
    total: counts.thorn + counts.spore,
    totalCap: caps.thorn + caps.spore,
    guardHps: g.guards.map((gd) => ({ type: gd.type, hp: gd.hp })),
    supply: g.fed === null ? null : g.fed ? 'fed' : 'starved',
    tags,
  };
}

/** The heart's values per guard type in one supply state. */
export interface HeartParams {
  caps: GuardCounts;
  regrowTicks: GuardCounts;
  repairPerRound: GuardCounts;
}

export interface SupplyStatus {
  heartNode: number;
  /** -1 when the area has no Root (H4). */
  rootNode: number;
  /** H4: false in an area without a Root (its heart is always fed and can't starve). */
  hasRoot: boolean;
  /** The Root still stands (false when there is none). */
  rootAlive: boolean;
  /** The heart is fed (false once the Root is cut). */
  fed: boolean;
  /** Tick the Root was cut, or null. */
  rootCutTick: number | null;
  /** The heart's values while fed and once starved, from live tunables ("10 Thorns 14 Spores → 6 Thorns 7 Spores, regrows 5× slower"). */
  fedHeart: HeartParams;
  starvedHeart: HeartParams;
}

/** The supply link: Root status, fed or starved, and the heart's fed and starved values (Root and heart sheets, the wilt toast). */
export function supplyStatus(world: Readonly<World>): SupplyStatus {
  const t = world.tun;
  const heart = guardianOrThrow(world, heartIndex(world));
  const rootNode = rootIndex(world);
  const pct = t['guard.capPct'];
  const starved = heart.starvedCounts ?? heart.counts;
  const mul = t['bloom.starvedRegrowMul'];
  const regrow = { thorn: t['guard.thorn.regrowTicks'], spore: t['guard.spore.regrowTicks'] };
  const sr = t['bloom.starvedRepairPerRound'];
  return {
    heartNode: heart.node,
    rootNode,
    hasRoot: rootNode >= 0,
    rootAlive: rootNode >= 0 && guardianOrThrow(world, rootNode).alive,
    fed: heart.fed !== false,
    rootCutTick: world.stats.rootCutTick,
    fedHeart: {
      caps: { thorn: capEff(heart.counts.thorn, pct), spore: capEff(heart.counts.spore, pct) },
      regrowTicks: regrow,
      repairPerRound: { thorn: t['guard.thorn.repairPerRound'], spore: t['guard.spore.repairPerRound'] },
    },
    starvedHeart: {
      caps: { thorn: capEff(starved.thorn, pct), spore: capEff(starved.spore, pct) },
      regrowTicks: { thorn: regrow.thorn * mul, spore: regrow.spore * mul },
      repairPerRound: { thorn: sr, spore: sr },
    },
  };
}

export interface SystemStatus {
  /** Index into data map.layouts. */
  variant: number;
  /** "frost" | "glass" | "twin" in the shipped data. */
  id: string;
  /** Player-facing name ("Frost Gate"). */
  name: string;
  rootCutTick: number | null;
  /** Whole game seconds from the landing to the Root cut, or null. */
  rootCutSec: number | null;
}

/** Which layout this run is, and when its Root was cut (probe sheet, result panel). */
export function systemStatus(world: Readonly<World>): SystemStatus {
  const cut = world.stats.rootCutTick;
  return {
    variant: world.system.variant,
    id: world.system.id,
    name: world.system.name,
    rootCutTick: cut,
    rootCutSec: cut === null ? null : Math.floor((cut - world.campaign.areaStartTick) / world.tickRate),
  };
}

export interface CombatRates {
  /**
   * Guards per second ×10 the fleet strips at full damage against the live
   * mix: Σ ships × damage × weighted multiplier, over the mix's average guard
   * hp, per round. 0 when no guards are alive.
   */
  killPerSecX10: number;
  /** Guards per second ×10 regrown while below cap, summed over the types with a cap above 0. */
  regrowPerSecX10: number;
  /** The same per guard type (0 for a type with cap 0). */
  regrowByTypeX10: GuardCounts;
}

/** Kill rate vs regrowth for a fleet at `node`: "you strip 2.4 guards/s · it regrows 0.5/s". */
export function combatRates(world: Readonly<World>, node: number, fleet: Readonly<ShipTypeCounts>): CombatRates {
  const t = world.tun;
  const g = guardianOrThrow(world, node);
  const counts = countGuards(g);
  const caps = guardCaps(world, g);
  let dmgX100 = 0;
  for (const s of SHIP_TYPES) dmgX100 += fleet[s] * t[`ship.${s}.damage`] * weightedMultPct(t, s, counts);
  let n = 0;
  let hp = 0;
  for (const gt of GUARD_TYPES) {
    n += counts[gt];
    hp += counts[gt] * t[`guard.${gt}.hp`];
  }
  const killPerSecX10 = hp === 0 ? 0 : Math.floor((dmgX100 * n * world.tickRate * 10) / (100 * hp * t['combat.roundTicks']));
  const regrowByTypeX10 = { thorn: 0, spore: 0 };
  for (const gt of GUARD_TYPES) {
    if (caps[gt] > 0) regrowByTypeX10[gt] = Math.floor((world.tickRate * 10) / guardRegrowTicks(world, g, gt));
  }
  return { killPerSecX10, regrowPerSecX10: regrowByTypeX10.thorn + regrowByTypeX10.spore, regrowByTypeX10 };
}

export interface BattleStatus extends CombatRates {
  /** The guarded node it is fought at. */
  node: number;
  startTick: number;
  /** Living guards now, by type (banner "6 Thorn 2 Spore"). */
  guards: GuardCounts;
  shipsPresent: number;
  presentByType: ShipTypeCounts;
  shipsEngaged: number;
  shipsLost: number;
  guardsKilled: number;
}

function statusOf(world: Readonly<World>, g: Readonly<Guardian>): BattleStatus | null {
  const b = g.battle;
  if (b === null) return null;
  const present = shipsAtByType(world, g.node);
  return {
    node: b.node,
    startTick: b.startTick,
    guards: countGuards(g),
    shipsPresent: present.drone + present.lancer + present.flak,
    presentByType: present,
    shipsEngaged: b.shipsEngaged,
    shipsLost: b.shipsLost,
    guardsKilled: b.guardsKilled,
    ...combatRates(world, g.node, present),
  };
}

/** The battle running at `node` with live rates, or null. The finished one is `lastBattle(world, node)`. */
export function battleStatus(world: Readonly<World>, node: number): BattleStatus | null {
  return statusOf(world, guardianOrThrow(world, node));
}

/** Every battle running now, in node order: the banner shows one line each. */
export function activeBattles(world: Readonly<World>): BattleStatus[] {
  const out: BattleStatus[] = [];
  for (const g of world.guardians) {
    const st = statusOf(world, g);
    if (st !== null) out.push(st);
  }
  return out;
}

/**
 * The last finished battle at `node`, for the capture and repelled toasts, or null.
 * It carries guards at start and ships engaged and lost by type; a Root capture carries `wilt`.
 * `world.lastBattle` is the latest at any node.
 */
export function lastBattle(world: Readonly<World>, node: number): BattleResult | null {
  return guardianOrThrow(world, node).lastBattle;
}

export interface CaptureEntry {
  node: number;
  /** Map id ("p1", "root", "heart"). */
  id: string;
  kind: NodeKind;
  /** What it yields, or null (the Root). */
  prize: RawResource | null;
  tick: number;
  sec: number;
}

export interface TargetSummary {
  node: number;
  id: string;
  wavesSent: number;
  shipsLost: number;
  guardsKilled: number;
  /** Tick it was captured, or null. */
  capturedTick: number | null;
}

export interface RunSummary {
  /** H4: the tick this area was landed in. Every `…Sec` below is area-relative (seconds since the landing); `…Tick` fields are world ticks. */
  areaStartTick: number;
  /** Tick the heart was captured, or null. */
  capturedTick: number | null;
  /** Whole game seconds from the landing to the heart capture, or null. */
  captureSec: number | null;
  peakPerMin: number;
  shipsBuilt: number;
  shipsBuiltByType: ShipTypeCounts;
  shipsLost: number;
  shipsLostByType: ShipTypeCounts;
  /** H5: ships recycled in this visit (total and by type) and the ore they refunded ("Recycled: 5 ships (+40 ore)"). */
  shipsRecycled: number;
  shipsRecycledByType: ShipTypeCounts;
  oreRefunded: number;
  wavesSent: number;
  firstShipTick: number | null;
  oreSpentShips: number;
  oreSpentEconomy: number;
  oreSpentComponents: number;
  componentsBuilt: Record<Component, number>;
  /** The layout: index, id and name. */
  variant: number;
  variantId: string;
  variantName: string;
  /** When the Root was cut, or null ("Root left standing"). */
  rootCutTick: number | null;
  rootCutSec: number | null;
  /** Heart guards removed by the wilt. */
  guardsWithered: number;
  guardsKilled: GuardCounts;
  /** Capture order ("Ice (P1) 4:10 → Crystal (P4) 11:30 → Root 15:02 → Heart 19:45"). */
  captures: CaptureEntry[];
  delivered: Record<RawResource, number>;
  /** Whole game seconds each resource was first delivered, or null. */
  firstDeliveredSec: Record<RawResource, number | null>;
  /** Per guarded node (node order): waves sent, ships lost, guards killed, capture tick. */
  targets: TargetSummary[];
  /** Shortcuts into `targets` (the Root's are 0 in an area without one). */
  heartWavesSent: number;
  heartShipsLost: number;
  rootWavesSent: number;
  rootShipsLost: number;
}

const sumShips = (c: ShipTypeCounts): number => c.drone + c.lancer + c.flak;

/** Result panel and bot report numbers, for the active area. Seconds are area-relative (H4). */
export function runSummary(world: Readonly<World>): RunSummary {
  const st = world.stats;
  const start = world.campaign.areaStartTick;
  const toSec = (tick: number): number => Math.floor((tick - start) / world.tickRate);
  const sec = (tick: number | null): number | null => (tick === null ? null : toSec(tick));
  const heart = guardianOrThrow(world, heartIndex(world));
  const rootNode = rootIndex(world);
  const root = rootNode >= 0 ? guardianOrThrow(world, rootNode) : null;
  const capTick = (node: number): number | null => {
    for (const c of st.captures) if (c.node === node) return c.tick;
    return null;
  };
  return {
    areaStartTick: start,
    capturedTick: world.capturedTick,
    captureSec: sec(world.capturedTick),
    peakPerMin: st.peakPerMin,
    shipsBuilt: sumShips(st.shipsBuilt),
    shipsBuiltByType: { ...st.shipsBuilt },
    shipsLost: sumShips(st.shipsLost),
    shipsLostByType: { ...st.shipsLost },
    shipsRecycled: sumShips(st.shipsRecycled),
    shipsRecycledByType: { ...st.shipsRecycled },
    oreRefunded: st.oreRefunded,
    wavesSent: st.wavesSent,
    firstShipTick: st.firstShipTick,
    oreSpentShips: st.oreSpentShips,
    oreSpentEconomy: st.oreSpentEconomy,
    oreSpentComponents: st.oreSpentComponents,
    componentsBuilt: { ...st.componentsBuilt },
    variant: world.system.variant,
    variantId: world.system.id,
    variantName: world.system.name,
    rootCutTick: st.rootCutTick,
    rootCutSec: sec(st.rootCutTick),
    guardsWithered: st.guardsWithered,
    guardsKilled: { ...st.guardsKilled },
    captures: st.captures.map((c) => {
      const n = world.nodes[c.node]!;
      return { node: c.node, id: n.id, kind: n.kind, prize: n.prize, tick: c.tick, sec: toSec(c.tick) };
    }),
    delivered: { ...st.delivered },
    firstDeliveredSec: { ore: sec(st.firstDeliveredTick.ore), ice: sec(st.firstDeliveredTick.ice), crystal: sec(st.firstDeliveredTick.crystal) },
    targets: world.guardians.map((g) => ({
      node: g.node,
      id: world.nodes[g.node]!.id,
      wavesSent: g.wavesSent,
      shipsLost: g.shipsLost,
      guardsKilled: g.guardsKilled,
      capturedTick: capTick(g.node),
    })),
    heartWavesSent: heart.wavesSent,
    heartShipsLost: heart.shipsLost,
    rootWavesSent: root === null ? 0 : root.wavesSent,
    rootShipsLost: root === null ? 0 : root.shipsLost,
  };
}
