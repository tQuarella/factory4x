import { BUILD_TYPES, type BuildType, type EconType, type Prize, type RawResource, type SimData } from './data.ts';
import { haulersHeld } from './factions/index.ts';
import { isCountedType, isFleetFull } from './fleet.ts';
import { ceilDiv } from './math.ts';
import { advance, newShip, startTransit } from './ships.ts';
import {
  PROBE,
  fieldOf,
  isGuarded,
  nodeDistance,
  perExtractorPerMin,
  ticksPerMin,
  type EconShip,
  type EconTypeCounts,
  type World,
  type Yard,
} from './world.ts';

/**
 * H7 field mode (DESIGN.md H7 "Rules (field mode), per tick in this order", F2–F7, F9, F11 and F14): the
 * allocation, the probe's bays, extractor and hauler ships, Mine marks and hauler deliveries. Integer only.
 * Fixed orders: types in BUILD_TYPES order (extractor, hauler, drone, lancer, flak), ships in id order, nodes in
 * index order, and every "nearest" tie goes to the lower node index. No RNG.
 */

/** A type's ore cost now (`ship.<type>.cost`). */
export function oreCost(world: Readonly<World>, type: BuildType): number {
  return world.tun[`ship.${type}.cost`];
}

/** The second resource a build pays when its bay starts (no lens or plating step in field mode). */
export interface ResourceCost {
  res: Prize;
  amount: number;
}

/** A type's resource cost now: crystal for a Lancer (`ship.lancer.crystal`), ice for a Flak (`ship.flak.ice`), else null. */
export function resourceCost(world: Readonly<World>, type: BuildType): ResourceCost | null {
  if (type === 'lancer') return { res: 'crystal', amount: world.tun['ship.lancer.crystal'] };
  if (type === 'flak') return { res: 'ice', amount: world.tun['ship.flak.ice'] };
  return null;
}

/** "Unlock" (H7 "Ship types"): a Lancer once crystal is first delivered, a Flak once ice is; the rest always. */
export function isTypeUnlocked(world: Readonly<World>, type: BuildType): boolean {
  if (type === 'lancer') return world.stats.firstDeliveredTick.crystal !== null;
  if (type === 'flak') return world.stats.firstDeliveredTick.ice !== null;
  return true;
}

/** True for the economy types. */
export function isEconType(type: BuildType): type is EconType {
  return type === 'extractor' || type === 'hauler';
}

/** The probe's bay for `type` (F3): the economy bays live in world.field, the warship bays are world.yards. */
export function bayOf(world: World, type: BuildType): Yard;
export function bayOf(world: Readonly<World>, type: BuildType): Readonly<Yard>;
export function bayOf(world: Readonly<World>, type: BuildType): Readonly<Yard> {
  return isEconType(type) ? fieldOf(world).bays[type] : world.yards[type];
}

/**
 * F2: a type is eligible for the next ore if its weight is above 0, it is unlocked, and its share is below its cost.
 * H8 H4: with hauler.autoNeed 1, the Hauler is eligible only while some rock is short of haulers (haulersWanted).
 */
export function isEligible(world: Readonly<World>, type: BuildType, wanted: boolean = haulersWanted(world)): boolean {
  const f = fieldOf(world);
  if (type === 'hauler' && !wanted) return false;
  return f.alloc[type] > 0 && isTypeUnlocked(world, type) && f.share[type] < oreCost(world, type);
}

/**
 * F2, the allocation. Weights above alloc.maxWeight are clamped first (lowering it live clamps them), and a share
 * above its type's cost (the cost was tuned down live) returns the excess to stock. Then, while stock has ore and
 * a type is eligible, one ore moves from stock into one share, picked by smooth weighted round robin: every
 * eligible type adds its weight to its counter; the highest counter wins (ties in type order) and gives back the
 * sum of the eligible weights. A type that isn't eligible has its counter at 0.
 */
export function allocate(world: World): void {
  const f = fieldOf(world);
  const max = world.tun['alloc.maxWeight'];
  for (const t of BUILD_TYPES) {
    if (f.alloc[t] > max) f.alloc[t] = max;
    const cost = oreCost(world, t);
    if (f.share[t] > cost) {
      world.stock.ore += f.share[t] - cost;
      f.share[t] = cost;
    }
  }
  // H8 H4: nothing inside F2 changes the shortfall (no bay starts, no hauler moves), so it is read once.
  let wanted = haulersWanted(world);
  const eligible: BuildType[] = [];
  for (;;) {
    eligible.length = 0;
    let sum = 0;
    for (const t of BUILD_TYPES) {
      if (isEligible(world, t, wanted)) {
        eligible.push(t);
        sum += f.alloc[t];
      } else f.allocCur[t] = 0;
    }
    if (world.stock.ore < 1 || eligible.length === 0) return;
    let pick: BuildType = eligible[0]!;
    for (const t of eligible) {
      f.allocCur[t] += f.alloc[t];
      if (f.allocCur[t] > f.allocCur[pick]) pick = t;
    }
    f.allocCur[pick] -= sum;
    f.share[pick] += 1;
    world.stock.ore -= 1;
    // H1 amendment (extended): a full extractor share is a committed extractor, which can open a hauler shortfall.
    if (pick === 'extractor' && f.share.extractor === oreCost(world, 'extractor')) wanted = haulersWanted(world);
  }
}

/** Spawns a finished economy ship at the probe (F3). It is dispatched (F5) or assigned (F6) later this tick. */
function newEconShip(world: World, type: EconType): EconShip {
  const f = fieldOf(world);
  const ship: EconShip = { id: world.nextId++, type, hp: world.tun[`ship.${type}.hp`], at: PROBE, transit: null, target: null, cargo: 0, cargoRes: null };
  f.econ.push(ship);
  world.stats.econBuilt[type] += 1;
  return ship;
}

/**
 * F3 (with F9), the probe's bays. Finish: in type order, a building bay ticks down and at 0 its ship spawns at the
 * probe (a warship flies to the rally point, as rule 5b). Start: in type order, an idle bay starts when its share
 * equals its ore cost, the stock covers its resource cost, and (for a counted type) the fleet is below the limit,
 * the count rising with each start this tick. Starting pays the resource, empties the share and sets
 * ticksLeft = ship.<type>.buildTicks. H8 H4: the Hauler bay also needs a rock short of haulers (haulersWanted).
 */
export function runBays(world: World, data: SimData): void {
  const f = fieldOf(world);
  for (const t of BUILD_TYPES) {
    const bay = bayOf(world, t);
    if (bay.ticksLeft <= 0) continue;
    bay.ticksLeft -= 1;
    if (bay.ticksLeft > 0) continue;
    if (isEconType(t)) newEconShip(world, t);
    else newShip(world, t);
  }
  for (const t of BUILD_TYPES) {
    const bay = bayOf(world, t);
    if (bay.ticksLeft !== 0) continue;
    const cost = oreCost(world, t);
    if (f.share[t] !== cost) continue;
    // H8 H4: a full Hauler share waits (kept) while no rock is short; the probe never builds a hauler no rock needs.
    if (t === 'hauler' && !haulersWanted(world)) continue;
    const rc = resourceCost(world, t);
    if (rc !== null && world.stock[rc.res] < rc.amount) continue;
    if (isCountedType(world, t) && isFleetFull(world, data)) continue;
    if (rc !== null) world.stock[rc.res] -= rc.amount;
    f.share[t] = 0;
    world.stats.oreSpentShips += cost;
    bay.ticksLeft = world.tun[`ship.${t}.buildTicks`];
  }
}

/** F5: Mine-marked and not guarded. */
export function isMineable(world: Readonly<World>, node: number): boolean {
  return fieldOf(world).mine[node] === true && !isGuarded(world, node);
}

/** F12 `setMine`: an asteroid, or a captured pocket or hive. */
export function isMarkable(world: Readonly<World>, node: number): boolean {
  const kind = world.nodes[node]!.kind;
  if (kind === 'asteroid') return true;
  return (kind === 'pocket' || kind === 'heart') && !isGuarded(world, node);
}

/** An extractor docked at its bound node (parked there, not in transit). */
export function isDocked(s: Readonly<EconShip>): boolean {
  return s.type === 'extractor' && s.transit === null && s.at !== null && s.at === s.target;
}

/** Per node: extractors bound there (docked or in flight; F5 reserves the slot from dispatch on). */
export function boundCounts(world: Readonly<World>): number[] {
  const out = world.nodes.map(() => 0);
  for (const s of fieldOf(world).econ) if (s.type === 'extractor' && s.target !== null) out[s.target] = out[s.target]! + 1;
  return out;
}

/** Per node: haulers assigned there (anywhere on their trip). */
export function assignedHaulers(world: Readonly<World>): number[] {
  const out = world.nodes.map(() => 0);
  for (const s of fieldOf(world).econ) if (s.type === 'hauler' && s.target !== null) out[s.target] = out[s.target]! + 1;
  return out;
}

/** Node indices other than the probe, nearest the probe first, ties to the lower index (F5 dispatch, F6 ties). */
export function byProbeDistance(world: Readonly<World>): number[] {
  const d = world.nodes.map((n) => nodeDistance(world, PROBE, n.index));
  const out: number[] = [];
  for (const n of world.nodes) if (n.index !== PROBE) out.push(n.index);
  return out.sort((a, b) => d[a]! - d[b]! || a - b);
}

/**
 * H7: `node.extractors` in field mode is derived: the node's free extractors (F4, from a capture) plus the
 * extractor ships docked there. Called after the inputs, after movement and after captures; a system that removes
 * a docked extractor (a recycle, a raid) must call it before extraction reads the count.
 */
export function syncExtractors(world: World): void {
  const f = world.field;
  if (f === null) return;
  for (const n of world.nodes) n.extractors = f.free[n.index]!;
  for (const s of f.econ) if (isDocked(s)) world.nodes[s.at!]!.extractors += 1;
}

/**
 * F5, extractors. First, an extractor bound to a node that is no longer mineable (its mark was turned off) is
 * unbound. Then every unbound extractor that is parked (idle at the probe, at the node it was unbound from, or
 * just built), in id order, is dispatched to the mineable node nearest the probe whose bound plus free extractors
 * are below its slots (ties to the lower index), and binds to it at once. With no such node it flies home and parks
 * at the probe as idle. An unbound extractor in flight finishes its leg first and is dispatched from where it lands.
 */
export function runExtractors(world: World): void {
  const f = fieldOf(world);
  const bound = boundCounts(world);
  for (const s of f.econ) {
    if (s.type !== 'extractor' || s.target === null || isMineable(world, s.target)) continue;
    bound[s.target] = bound[s.target]! - 1;
    s.target = null;
  }
  const order = byProbeDistance(world);
  for (const s of f.econ) {
    if (s.type !== 'extractor' || s.target !== null || s.at === null) continue;
    const node = order.find((n) => isMineable(world, n) && bound[n]! + f.free[n]! < world.nodes[n]!.slots);
    if (node !== undefined) {
      s.target = node;
      bound[node] = bound[node]! + 1;
      if (s.at !== node) startTransit(world, s, node);
    } else if (s.at !== PROBE) startTransit(world, s, PROBE);
  }
}

/** F6: a node is worked if it has at least one docked or free extractor, or a buffer of at least 1. */
export function isWorked(world: Readonly<World>, node: number): boolean {
  const n = world.nodes[node]!;
  return node !== PROBE && (n.extractors > 0 || n.buffer >= 1);
}

/**
 * F6 assignment order: true if `a` is a better pick than `b`. The lower (assigned haulers ÷ working extractors)
 * first, compared by cross-multiplication. A worked node with no working extractor (a buffer only) has no finite
 * ratio: it comes after every node with one, and among such nodes the one with fewer haulers first. Then the
 * nearest to the probe, then the lower node index.
 */
function betterHaulTarget(world: Readonly<World>, assigned: readonly number[], a: number, b: number): boolean {
  const ea = world.nodes[a]!.extractors;
  const eb = world.nodes[b]!.extractors;
  const ha = assigned[a]!;
  const hb = assigned[b]!;
  if ((ea > 0) !== (eb > 0)) return ea > 0;
  const cross = ea > 0 ? ha * eb - hb * ea : ha - hb;
  if (cross !== 0) return cross < 0;
  const da = nodeDistance(world, PROBE, a);
  const db = nodeDistance(world, PROBE, b);
  if (da !== db) return da < db;
  return a < b;
}

/**
 * F6: a node a hauler may be assigned to: worked and Mine-marked. Director, 2026-11-14 (h7-sim review round 1):
 * only Mine-marked rocks can be assigned haulers, so Stop means stop (raids target rocks with assigned haulers,
 * R5). An unmarked rock's leftover buffer stays on the rock until it is marked again.
 */
export function isHaulable(world: Readonly<World>, node: number): boolean {
  return fieldOf(world).mine[node] === true && isWorked(world, node);
}

/**
 * The pick for a hauler at the probe with no haulable target, or null (it parks idle). H7 F6 (hauler.autoNeed 0):
 * the best worked, Mine-marked node by betterHaulTarget. H8 H2 (autoNeed 1): needPick.
 */
export function haulTarget(world: Readonly<World>, assigned: readonly number[], staff?: readonly number[]): number | null {
  if (isAutoNeed(world)) return needPick(world, assigned, staff);
  let best: number | null = null;
  for (const n of world.nodes) {
    if (!isHaulable(world, n.index)) continue;
    if (best === null || betterHaulTarget(world, assigned, n.index, best)) best = n.index;
  }
  return best;
}

/** H8 H5: hauler.autoNeed 1 staffs rocks by need (H1–H4); 0 is H7's F6 exactly (the in-build comparison). */
export function isAutoNeed(world: Readonly<World>): boolean {
  return world.tun['hauler.autoNeed'] >= 1;
}

/** H8 H1: the ticks a hauler takes from the probe to `node` at ship.hauler.speedSu (F7's leg), there and back. */
export function haulRoundTrip(world: Readonly<World>, node: number): number {
  return 2 * ceilDiv(nodeDistance(world, PROBE, node), world.tun['ship.hauler.speedSu']);
}

/**
 * Per node, the extractors staffing counts (H1 amendment, with h8-sim's extension): the extractor ships bound there
 * (docked or on their way), plus the committed extractors, at the node F5 would send them to now. Committed means
 * the one in the probe's bay and a full extractor share (it starts in F3 as soon as the bay is free). They fill the
 * mineable nodes nearest the probe with a free slot, ties to the lower index, as F5 dispatches; with no free slot
 * they count nowhere. Without them, the landing's first 40 ore all go to extractor shares before any extractor
 * launches (tick 120), and the first hauler waits for probe mining (h8-sim, DECISIONS.md).
 */
export function staffCounts(world: Readonly<World>): number[] {
  const f = fieldOf(world);
  const out = boundCounts(world);
  let pending = (f.bays.extractor.ticksLeft > 0 ? 1 : 0) + (f.alloc.extractor > 0 && f.share.extractor >= oreCost(world, 'extractor') ? 1 : 0);
  if (pending === 0) return out;
  for (const n of byProbeDistance(world)) {
    if (!isMineable(world, n)) continue;
    const slots = world.nodes[n]!.slots;
    while (pending > 0 && out[n]! + f.free[n]! < slots) {
      out[n] = out[n]! + 1;
      pending -= 1;
    }
    if (pending === 0) break;
  }
  return out;
}


/**
 * H8 H1 amendment (Director, 2026-11-14): a node is staffed if it is Mine-marked and either haulable (as H7) or has
 * at least one extractor ship bound for it, docked or on its way. H1's need and target, H2's pick and H4's
 * shortfall and bay work from staffed nodes, so a rock's need is known when its first extractor launches.
 */
export function isStaffed(world: Readonly<World>, node: number, staff: readonly number[] = staffCounts(world)): boolean {
  if (fieldOf(world).mine[node] !== true) return false;
  return isHaulable(world, node) || staff[node]! > 0;
}

/**
 * H8 H1 (amended): what `node` will yield per game minute: its bound extractor ships (docked plus on their way)
 * plus its free extractors, × its kind's rate per extractor (F4).
 */
export function yieldPerMin(world: Readonly<World>, node: number, staff: readonly number[] = staffCounts(world)): number {
  const n = world.nodes[node]!;
  return (staff[node]! + fieldOf(world).free[node]!) * perExtractorPerMin(world.tun, n.kind);
}

/**
 * H8 H1, the need: for a staffed node, max(1, ceilDiv(yieldPerMin × roundTrip × hauler.needPct, 100 × T ×
 * ship.hauler.cargo)), T = ticks per game minute. So a rock with only a buffer (no extractor bound) needs 1.
 * 0 for a node that isn't staffed.
 */
export function haulerNeed(world: Readonly<World>, node: number, staff: readonly number[] = staffCounts(world)): number {
  if (!isStaffed(world, node, staff)) return 0;
  const num = yieldPerMin(world, node, staff) * haulRoundTrip(world, node) * world.tun['hauler.needPct'];
  const den = 100 * ticksPerMin(world) * world.tun['ship.hauler.cargo'];
  return Math.max(1, ceilDiv(num, den));
}

/**
 * H8 H7: the count the player set for `node` (`setHaulers`), or null for Auto. A count above rock.haulerMax (the
 * max was tuned down live) reads as rock.haulerMax, as alloc.maxWeight caps the weights; the stored count is kept.
 */
export function haulerSetOf(world: Readonly<World>, node: number): number | null {
  const set = fieldOf(world).haulerSet[node] ?? null;
  return set === null ? null : Math.min(set, world.tun['rock.haulerMax']);
}

/** H8 H1: the target: the set count if there is one, else the need; 0 for a node that isn't staffed. */
export function haulerTarget(world: Readonly<World>, node: number, staff: readonly number[] = staffCounts(world)): number {
  if (!isStaffed(world, node, staff)) return 0;
  return haulerSetOf(world, node) ?? haulerNeed(world, node, staff);
}

/**
 * H8 H2: the staffed node (H1 amendment) with the largest shortfall (target − assigned) above 0; ties to the node nearest the
 * probe, then the lower index. Null if no node is short (the hauler parks idle at the probe).
 */
export function needPick(world: Readonly<World>, assigned: readonly number[], staff: readonly number[] = staffCounts(world)): number | null {
  let best: number | null = null;
  let bestShort = 0;
  let bestDist = 0;
  for (const n of world.nodes) {
    const short = haulerTarget(world, n.index, staff) - assigned[n.index]!;
    if (short <= 0) continue;
    const d = nodeDistance(world, PROBE, n.index);
    // Nodes are visited in index order, so the strict comparisons keep the lower index on a full tie.
    if (best === null || short > bestShort || (short === bestShort && d < bestDist)) {
      best = n.index;
      bestShort = short;
      bestDist = d;
    }
  }
  return best;
}

/** A hauler parked at the probe with no node: idle. */
export function isIdleHauler(s: Readonly<EconShip>): boolean {
  return s.type === 'hauler' && s.transit === null && s.at === PROBE && s.target === null;
}

/**
 * H8 H4: haulerShortfall = Σ over staffed nodes (H1 amendment) of max(0, target − assigned), minus the idle haulers at the probe,
 * minus a hauler in the bay.
 */
export function haulerShortfall(world: Readonly<World>): number {
  const f = fieldOf(world);
  const assigned = assignedHaulers(world);
  const staff = staffCounts(world);
  let short = 0;
  for (const n of world.nodes) short += Math.max(0, haulerTarget(world, n.index, staff) - assigned[n.index]!);
  for (const s of f.econ) if (isIdleHauler(s)) short -= 1;
  if (f.bays.hauler.ticksLeft > 0) short -= 1;
  return short;
}

/** H8 H4: the probe may fill and start a Hauler: always with hauler.autoNeed 0, else while haulerShortfall > 0. */
export function haulersWanted(world: Readonly<World>): boolean {
  return !isAutoNeed(world) || haulerShortfall(world) > 0;
}

/** The per-second ring index of the current tick (stats.deliveredBuckets and the rock rings). */
function bucketIndex(world: Readonly<World>): number {
  return Math.floor(world.tick / world.tickRate) % world.stats.deliveredBuckets.length;
}

/**
 * A delivery into the probe's stock (H1 rule 4 for route pods; H7 F6 for haulers): stock, the delivered totals,
 * `firstDeliveredTick` (the unlocks) and the per-second ring of the headline ore/min or the ice/crystal chips.
 */
export function recordDelivery(world: World, res: RawResource, amount: number): void {
  const st = world.stats;
  world.stock[res] += amount;
  st.delivered[res] += amount;
  if (st.firstDeliveredTick[res] === null) st.firstDeliveredTick[res] = world.tick;
  const b = res === 'ore' ? st.deliveredBuckets : st.prizeBuckets[res];
  const i = bucketIndex(world);
  b[i] = b[i]! + amount;
}

/**
 * F6, a hauler's delivery on arrival at the probe: the load goes into stock, the delivered stats and buckets
 * (recordDelivery) and the source rock's ring (rockStatus.deliveredPerMin). The hauler's target is its source: it
 * changes only at the probe, after this.
 */
function unload(world: World, s: EconShip): void {
  const f = fieldOf(world);
  if (s.cargo > 0 && s.cargoRes !== null && s.target !== null) {
    recordDelivery(world, s.cargoRes, s.cargo);
    const ring = f.rockBuckets[s.target]!;
    const i = bucketIndex(world);
    ring[i] = ring[i]! + s.cargo;
  }
  s.cargo = 0;
  s.cargoRes = null;
}

/**
 * F6, haulers, in id order (ships in transit skip; the unload happens on arrival, in F7):
 *  - at the probe: keep the node while it is haulable (worked and Mine-marked; F12: a hauler of an unmarked
 *    node finishes its trip and reassigns). A hauler whose node is held for a raid (H8 H10, `haulersHeld`) stays
 *    there and keeps it. H8 H3 (hauler.autoNeed 1): a hauler whose node has more haulers assigned than its target
 *    leaves it. Without a node it picks by haulTarget (H7 F6's ratio, or H8 H2's shortfall), or parks idle. Then
 *    it flies to the node at ship.hauler.speedSu, unless that node is held.
 *  - at its node: once the buffer holds a full cargo, or the node has no working extractor left (so the buffer
 *    can't grow), or its mark is off (Stop ends the trip now), or the node is held (H10), load min(buffer, cargo)
 *    and fly to the probe.
 *
 * H3's "when a hauler arrives at the probe and unloads" is this at-probe pass: a hauler reaches the probe and
 * unloads in F7, and its next F6 (the following tick) is its first pass here. Haulers with a node are at the probe
 * only on that pass (they leave in it) or while held, so the rebalance reaches arriving haulers and no others.
 */
export function runHaulers(world: World): void {
  const f = fieldOf(world);
  const assigned = assignedHaulers(world);
  const cargoCap = world.tun['ship.hauler.cargo'];
  const speed = world.tun['ship.hauler.speedSu'];
  const auto = isAutoNeed(world);
  // Nothing in F6 binds or commits an extractor, so the staffing counts hold for the whole pass.
  const staff = auto ? staffCounts(world) : [];
  const bound = boundCounts(world);
  for (const s of f.econ) {
    if (s.type !== 'hauler' || s.transit !== null || s.at === null) continue;
    if (s.at === PROBE) {
      // A hauler placed at the probe with cargo (never in play: it unloads on arrival) unloads here.
      unload(world, s);
      // H7 keeps the node while it is haulable; H8 (amended) while it is staffed, so a hauler sent to a rock whose
      // extractors are still flying in keeps it.
      if (s.target !== null && !(auto ? isStaffed(world, s.target, staff) : isHaulable(world, s.target))) {
        assigned[s.target] = assigned[s.target]! - 1;
        s.target = null;
      }
      if (s.target !== null && haulersHeld(world, s.target)) continue;
      if (s.target !== null && auto && assigned[s.target]! > haulerTarget(world, s.target, staff)) {
        assigned[s.target] = assigned[s.target]! - 1;
        s.target = null;
      }
      if (s.target === null) {
        const n = haulTarget(world, assigned, auto ? staff : undefined);
        if (n === null) continue;
        s.target = n;
        assigned[n] = assigned[n]! + 1;
      }
      if (haulersHeld(world, s.target)) continue;
      startTransit(world, s, s.target, speed);
    } else if (s.at === s.target) {
      const node = world.nodes[s.at]!;
      // H7: wait for a full cargo while an extractor works the node. H8 (amended): also while one is on its way, so
      // a hauler at a rock that isn't worked yet waits for its first extractor instead of leaving empty.
      const working = node.extractors > 0 || (auto && bound[s.at]! > 0);
      if (node.buffer < cargoCap && working && f.mine[s.at] === true && !haulersHeld(world, s.at)) continue;
      const load = Math.min(node.buffer, cargoCap);
      node.buffer -= load;
      s.cargo = load;
      s.cargoRes = load > 0 ? node.prize : null;
      startTransit(world, s, PROBE, speed);
    } else startTransit(world, s, PROBE, speed);
  }
}

/** F7 for the economy ships (warships move in rule 6's loop). A hauler arriving at the probe unloads at once (F6). */
export function moveEcon(world: World): void {
  for (const s of fieldOf(world).econ) {
    if (advance(s) && s.type === 'hauler' && s.at === PROBE) unload(world, s);
  }
}

/** F11 in field mode: a captured pocket or hive is Mine-marked and gets its free extractors (min(free, slots)). */
export function captureField(world: World, node: number): void {
  const f = fieldOf(world);
  const n = world.nodes[node]!;
  const free = n.kind === 'pocket' ? world.tun['pocket.freeExtractors'] : n.kind === 'heart' ? world.tun['heart.freeExtractors'] : 0;
  f.free[node] = Math.min(free, n.slots);
  f.mine[node] = true;
  syncExtractors(world);
}

/** Field stats (after rule 10's stats): the peak economy (F14), and the rock rings clear the slot the next tick writes. */
export function fieldStats(world: World): void {
  const f = fieldOf(world);
  if (f.econ.length > world.stats.peakEcon) world.stats.peakEcon = f.econ.length;
  const next = world.tick + 1;
  if (next % world.tickRate === 0) {
    const i = Math.floor(next / world.tickRate) % world.stats.deliveredBuckets.length;
    for (const ring of f.rockBuckets) ring[i] = 0;
  }
}

/** F12 `setAlloc`: set the weight; at 0 the type's share goes back to stock. Counts a change in stats.allocChanges. */
export function applySetAlloc(world: World, type: BuildType, weight: number): void {
  const f = fieldOf(world);
  if (f.alloc[type] !== weight) world.stats.allocChanges += 1;
  f.alloc[type] = weight;
  if (weight === 0) {
    world.stock.ore += f.share[type];
    f.share[type] = 0;
    f.allocCur[type] = 0;
  }
}

/** F12 `setMine`: set the mark. Turning it off unbinds the node's extractors in F5 this tick. */
export function applySetMine(world: World, node: number, on: boolean): void {
  fieldOf(world).mine[node] = on;
}

/** H8 H7 `setHaulers`: the node's hauler count, or null for Auto. Kept while the rock is unmarked. */
export function applySetHaulers(world: World, node: number, count: number | null): void {
  fieldOf(world).haulerSet[node] = count;
}

/** Economy ships of each type parked at `node` (not in transit). */
export function econAtByType(world: Readonly<World>, node: number): EconTypeCounts {
  const c: EconTypeCounts = { extractor: 0, hauler: 0 };
  if (world.field === null) return c;
  for (const s of world.field.econ) if (s.at === node) c[s.type] += 1;
  return c;
}

/** The economy counts a recycleShips order would really recycle: each given count clamped to the ships parked there. */
export function clampEconCounts(world: Readonly<World>, node: number, counts: Readonly<Partial<EconTypeCounts>>): EconTypeCounts {
  const at = econAtByType(world, node);
  return { extractor: Math.min(counts.extractor ?? 0, at.extractor), hauler: Math.min(counts.hauler ?? 0, at.hauler) };
}

/**
 * F12 `recycleShips`, economy part: the lowest-id parked economy ships of each type at `node` go, each refunding
 * floor(ship.<type>.cost × fleet.recycleRefundPct / 100) ore. A recycled extractor frees its slot (it is no
 * longer bound). Returns the ore refunded.
 */
export function recycleEcon(world: World, node: number, counts: Readonly<Partial<EconTypeCounts>>, refundEach: (t: EconType) => number): number {
  const f = fieldOf(world);
  const left = clampEconCounts(world, node, counts);
  let refund = 0;
  f.econ = f.econ.filter((s) => {
    if (s.at !== node || left[s.type] === 0) return true;
    left[s.type] -= 1;
    refund += refundEach(s.type);
    world.stats.econRecycled[s.type] += 1;
    return false;
  });
  syncExtractors(world);
  return refund;
}

/** Economy ships alive (R2's `econ`: extractors and haulers, not counting the bays). */
export function econAlive(world: Readonly<World>): number {
  return world.field === null ? 0 : world.field.econ.length;
}
