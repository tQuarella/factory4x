import { buyResearch, canBuyResearch, isAreaOpen, isWon, leaveActive } from './campaign.ts';
import { BUILD_TYPES, ECON_TYPES, SHIP_TYPES, isSimTunableKey, type BuildType, type ShipType, type SimData, type TunableKey } from './data.ts';
import { applySetAlloc, applySetExtractors, applySetHaulers, applySetMine, clampEconCounts, extractorMinCount, isMarkable, recycleEcon, syncExtractors } from './field.ts';
import { fleetCap, recycleRefundEach } from './fleet.ts';
import { applyRecycleFleet, clampFleetCounts, isMovePart, moveCounts, type MovePart } from './orders.ts';
import { shipsAtByType, startTransit } from './ships.ts';
import { PROBE, guardianAt, isGuarded, landArea, nodeDistance, routeFrom, type EconTypeCounts, type ShipTypeCounts, type World } from './world.ts';

/** recycleShips counts: the warship counts, plus (H7 field mode) optional extractor and hauler counts. */
export type RecycleCounts = ShipTypeCounts & Partial<EconTypeCounts>;

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
  | { type: 'recycleShips'; node: number; counts: RecycleCounts }
  | { type: 'setRally'; node: number }
  | { type: 'setTunable'; key: TunableKey; value: number }
  /** H7 F12 (field mode only): set a type's allocation weight, 0..alloc.maxWeight. At 0 its share goes back to stock. */
  | { type: 'setAlloc'; shipType: BuildType; weight: number }
  /** H7 F12 (field mode only): Mine-mark an asteroid, or a captured pocket or hive, on or off. */
  | { type: 'setMine'; node: number; on: boolean }
  /**
   * H8 H6 (field mode only): move the warships parked at `from` to `to`: all of them, or per type
   * floor(count × move.splitPct ÷ 100) with a 1-ship fallback (moveCounts). The counts are computed on the tick it
   * applies, then it is a sendShips with them (an attack if `to` is guarded). Invalid if from = to or the count is 0.
   */
  | { type: 'moveShips'; from: number; to: number; part: MovePart }
  /**
   * H8 H7 (field mode only): an asteroid's, or a captured pocket's or hive's, hauler count: null (Auto: the need)
   * or 0..rock.haulerMax. Kept while the rock is unmarked.
   */
  | { type: 'setHaulers'; node: number; count: number | null }
  /**
   * H9 X1 (field mode only): an asteroid's, or a captured pocket's or hive's, extractor count: null (All: the slots)
   * or an integer from extractorMinCount (1; for a captured pocket or the hive, max(1, its free extractors)) to the
   * node's slots. 0 is not a count (Stop mining is). Kept while the rock is unmarked. Lowering unbinds the surplus
   * this tick (X3).
   */
  | { type: 'setExtractors'; node: number; count: number | null }
  /**
   * H8 H8 (field mode only): recycle up to counts[type] ships of each of the five types, wherever they are
   * (recycleOrder: idle at the probe, then parked or docked by node index, then in transit; lowest id first). Ships
   * at a living guarded node or at a fighting raid's target are excluded. Valid if the clamped total is ≥ 1.
   */
  | { type: 'recycleFleet'; counts: Record<BuildType, number> };

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

/** H7: optional economy counts, each absent or an integer ≥ 0. */
function validEconCounts(v: unknown): boolean {
  const c = v as Record<string, unknown>;
  return ECON_TYPES.every((t) => c[t] === undefined || (typeof c[t] === 'number' && Number.isInteger(c[t]) && (c[t] as number) >= 0));
}

function isBuildType(v: unknown): v is BuildType {
  return typeof v === 'string' && (BUILD_TYPES as readonly string[]).includes(v);
}

/**
 * True if `input` would change the world this tick. Invalid inputs are ignored by `step`; the client greys them out.
 * (A valid setAlloc or setMine that repeats the current value changes nothing, but is accepted.)
 */
export function isValidInput(world: Readonly<World>, data: SimData, input: Input): boolean {
  // After the win only live tuning is accepted; the area inputs need an area.
  if (input.type === 'setTunable') return validTunable(data, input.key, input.value);
  // H7: field mode has its own table (F12), and free play continues after the hive falls.
  if (world.field !== null) return validFieldInput(world, input);
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

/**
 * H7 F12, field mode: setAlloc, setMine, sendShips (warships only, as H5), recycleShips (with extractor and hauler
 * counts), setRally (rally applies to warships only). Every campaign input (build, route, upgrade, cancel, yard
 * switch, enterArea, leaveArea, buyResearch) is never valid here.
 */
function validFieldInput(world: Readonly<World>, input: Input): boolean {
  switch (input.type) {
    case 'setAlloc':
      return isBuildType(input.shipType) && Number.isInteger(input.weight) && input.weight >= 0 && input.weight <= world.tun['alloc.maxWeight'];
    case 'setMine':
      return isIndex(world, input.node) && typeof input.on === 'boolean' && isMarkable(world, input.node);
    case 'sendShips':
      return validAreaInput(world, input);
    case 'recycleShips': {
      if (!isIndex(world, input.node) || isGuarded(world, input.node) || !validCounts(input.counts) || !validEconCounts(input.counts)) return false;
      const c = clampSendCounts(world, input.node, input.counts);
      const e = clampEconCounts(world, input.node, input.counts);
      return c.drone + c.lancer + c.flak + e.extractor + e.hauler >= 1;
    }
    case 'setRally':
      return isIndex(world, input.node);
    case 'moveShips': {
      if (!isIndex(world, input.from) || !isIndex(world, input.to) || input.from === input.to || !isMovePart(input.part)) return false;
      return validAreaInput(world, { type: 'sendShips', from: input.from, to: input.to, counts: moveCounts(world, input.from, input.part) });
    }
    case 'setHaulers': {
      if (!isIndex(world, input.node) || !isMarkable(world, input.node)) return false;
      const c: unknown = input.count;
      return c === null || (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c <= world.tun['rock.haulerMax']);
    }
    case 'setExtractors': {
      if (!isIndex(world, input.node) || !isMarkable(world, input.node)) return false;
      const c: unknown = input.count;
      return c === null || (typeof c === 'number' && Number.isInteger(c) && c >= extractorMinCount(world, input.node) && c <= world.nodes[input.node]!.slots);
    }
    case 'recycleFleet': {
      const c: unknown = input.counts;
      if (c === null || typeof c !== 'object') return false;
      const rec = c as Record<string, unknown>;
      if (!BUILD_TYPES.every((t) => typeof rec[t] === 'number' && Number.isInteger(rec[t]) && (rec[t] as number) >= 0)) return false;
      const k = clampFleetCounts(world, input.counts);
      return BUILD_TYPES.reduce((n, t) => n + k[t], 0) >= 1;
    }
    default:
      return false;
  }
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

export { shipsAtByType, startTransit };

/**
 * sendShips' effect (H3, H5), shared by H8's moveShips: the lowest-id warships of each type parked at `from`, up to
 * `counts`, fly to `to`; a living guarded `to` is an attack.
 */
function applySend(world: World, data: SimData, from: number, to: number, counts: Readonly<ShipTypeCounts>): void {
  const left = clampSendCounts(world, from, counts);
  // Ships are in id order, so the first of each type found are the lowest ids.
  for (const s of world.ships) {
    if (s.at !== from || left[s.type] === 0) continue;
    startTransit(world, s, to);
    left[s.type] -= 1;
  }
  // Sending to a guarded node while it lives is an attack (step folds same-tick orders per node into one wave).
  const target = guardianAt(world, to);
  if (target !== null && target.alive) {
    target.wavesSent++;
    world.stats.wavesSent++;
    // H5: a running battle takes the limit this wave was sent at.
    if (target.battle !== null) target.battle.capAtSend = fleetCap(world, data);
  }
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
    case 'sendShips':
      applySend(world, data, input.from, input.to, input.counts);
      return;
    case 'moveShips':
      // H8 H6: the counts are computed now, on the tick the order applies; then it is exactly a sendShips.
      applySend(world, data, input.from, input.to, moveCounts(world, input.from, input.part));
      return;
    case 'setHaulers':
      applySetHaulers(world, input.node, input.count);
      return;
    case 'setExtractors':
      applySetExtractors(world, input.node, input.count);
      return;
    case 'recycleFleet':
      applyRecycleFleet(world, input.counts, (t) => recycleRefundEach(world, t));
      // A recycled docked extractor leaves its node's count now; F5 re-dispatches into the freed slot this tick.
      syncExtractors(world);
      return;
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
      // H7: then the economy ships (field mode only; a campaign world has none).
      if (world.field !== null) refund += recycleEcon(world, input.node, input.counts, (t) => recycleRefundEach(world, t));
      world.stock.ore += refund;
      world.stats.oreRefunded += refund;
      return;
    }
    case 'setAlloc':
      applySetAlloc(world, input.shipType, input.weight);
      return;
    case 'setMine':
      applySetMine(world, input.node, input.on);
      return;
    case 'setRally':
      world.rally = input.node;
      return;
    case 'setTunable':
      if (isSimTunableKey(input.key)) world.tun[input.key] = input.value;
      return;
  }
}
