import { RAW_RESOURCES, RESEARCH_IDS, appliesAtLevel, isTierRequirement, type ResearchId, type ResearchItem, type ResourceTriple, type ShipType, type SimData } from './data.ts';
import { clearArea, createWorld, landArea, researchLevel, ticksPerMin, type World } from './world.ts';

/**
 * The campaign rules (DESIGN.md H4 "Reclaim ladder"): which areas are open,
 * landing and leaving, the reclaim, research and its effects, and rule 10
 * (shipments). Integer only; areas, lanes and research are always walked in
 * data order and resources in the order ore, ice, crystal.
 */

/** Index of an area id in data `map.areas`, or -1. */
export function areaIndex(data: SimData, id: string): number {
  return data.map.areas.findIndex((a) => a.id === id);
}

/** Index of a research item id in data `research`, or -1. */
export function researchIndex(data: SimData, id: string): number {
  return data.research.findIndex((r) => r.id === id);
}

/** True once area `a` has been reclaimed (its heart captured). */
export function isReclaimed(world: Readonly<World>, a: number): boolean {
  const rec = world.campaign.areas[a];
  return rec !== undefined && rec.reclaimedTick !== null;
}

/** Area indices joined to `a` by a lane, in lane (data) order. */
export function laneNeighbours(data: SimData, a: number): number[] {
  const id = data.map.areas[a]!.id;
  const out: number[] = [];
  for (const [x, y] of data.map.lanes) {
    if (x === id) out.push(areaIndex(data, y));
    else if (y === id) out.push(areaIndex(data, x));
  }
  return out;
}

/** Open: still held, and either the start area (tier 0) or lane-joined to a reclaimed area. */
export function isAreaOpen(world: Readonly<World>, data: SimData, a: number): boolean {
  const area = data.map.areas[a];
  if (area === undefined || isReclaimed(world, a)) return false;
  if (area.tier === 0) return true;
  return laneNeighbours(data, a).some((n) => isReclaimed(world, n));
}

/** True after the probe core is bought: every input but setTunable is refused. */
export function isWon(world: Readonly<World>): boolean {
  return world.campaign.wonTick !== null;
}

/** One level's cost after research.costPct: floor(cost × costPct / 100) per resource. */
export function scaledCost(world: Readonly<World>, cost: Readonly<ResourceTriple>): ResourceTriple {
  const pct = world.tun['research.costPct'];
  return { ore: Math.floor((cost.ore * pct) / 100), ice: Math.floor((cost.ice * pct) / 100), crystal: Math.floor((cost.crystal * pct) / 100) };
}

/** The next level's cost of `item` (after costPct), or null at its max level. */
export function nextLevelCost(world: Readonly<World>, item: ResearchItem): ResourceTriple | null {
  const level = researchLevel(world, item.id);
  const raw = item.levels[level];
  return raw === undefined ? null : scaledCost(world, raw);
}

/** An unmet H5 tier requirement: `count` reclaimed areas of tier ≥ `tier` are needed, `have` are reclaimed. */
export interface TierShortfall {
  tier: number;
  count: number;
  have: number;
}

/** Reclaimed areas of tier ≥ `tier`. */
export function reclaimedAtTier(world: Readonly<World>, data: SimData, tier: number): number {
  let n = 0;
  data.map.areas.forEach((area, a) => {
    if (area.tier >= tier && isReclaimed(world, a)) n++;
  });
  return n;
}

/** What blocks a research item's requirements. */
export interface Unmet {
  items: Array<{ id: string; level: number }>;
  areas: string[];
  /** H5: tier requirements not met yet. */
  tiers: TierShortfall[];
}

/**
 * What still blocks buying the next level of `item` (in requirement order):
 * items below their level, areas not reclaimed, and (H5) too few reclaimed
 * areas of a tier. A requirement with an `atLevel` counts only for that level,
 * so at max level only the requirements without one are checked.
 */
export function unmetRequirements(world: Readonly<World>, data: SimData, item: ResearchItem): Unmet {
  const items: Array<{ id: string; level: number }> = [];
  const areas: string[] = [];
  const tiers: TierShortfall[] = [];
  const next = researchLevel(world, item.id) + 1;
  for (const q of item.requires) {
    if (!appliesAtLevel(q, next)) continue;
    if (isTierRequirement(q)) {
      const have = reclaimedAtTier(world, data, q.tier);
      if (have < q.count) tiers.push({ tier: q.tier, count: q.count, have });
    } else if ('area' in q) {
      if (!isReclaimed(world, areaIndex(data, q.area))) areas.push(q.area);
    } else if (researchLevel(world, q.item as ResearchId) < q.level) items.push({ id: q.item, level: q.level });
  }
  return { items, areas, tiers };
}

/** H5: the fleet limit is off (fleet.cap 0), so a `limit` item (Command limit) can't be bought: the `capOff` reason. */
export function isCapOff(world: Readonly<World>, item: ResearchItem): boolean {
  return item.kind === 'limit' && world.tun['fleet.cap'] <= 0;
}

/** Per resource, how much the stockpile lacks for `cost` (0 where it covers it). */
export function shortfall(world: Readonly<World>, cost: Readonly<ResourceTriple>): ResourceTriple {
  const s = world.campaign.stockpile;
  return { ore: Math.max(0, cost.ore - s.ore), ice: Math.max(0, cost.ice - s.ice), crystal: Math.max(0, cost.crystal - s.crystal) };
}

/** True if `buyResearch {item}` is valid now (on the overworld, not won, below max, not a limit item while fleet.cap is 0, requirements met, affordable). */
export function canBuyResearch(world: Readonly<World>, data: SimData, i: number): boolean {
  const item = data.research[i];
  if (item === undefined || world.campaign.active !== null || isWon(world)) return false;
  const cost = nextLevelCost(world, item);
  if (cost === null) return false;
  if (isCapOff(world, item)) return false;
  const unmet = unmetRequirements(world, data, item);
  if (unmet.items.length > 0 || unmet.areas.length > 0 || unmet.tiers.length > 0) return false;
  const short = shortfall(world, cost);
  return short.ore === 0 && short.ice === 0 && short.crystal === 0;
}

/** Pays for and raises one research level. The win item sets `wonTick`. Assumes canBuyResearch. */
export function buyResearch(world: World, data: SimData, i: number): void {
  const item = data.research[i]!;
  const cost = nextLevelCost(world, item)!;
  const camp = world.campaign;
  for (const res of RAW_RESOURCES) camp.stockpile[res] -= cost[res];
  const level = researchLevel(world, item.id) + 1;
  camp.research[item.id] = level;
  camp.researchLog.push({ item: item.id, level, tick: world.tick });
  if (item.kind === 'win') camp.wonTick = world.tick;
}

/** Ships built / lost / recycled and ore refunded so far in this visit's stats. */
function shipTotals(world: Readonly<World>): { built: number; lost: number; recycled: number; refunded: number } {
  const b = world.stats.shipsBuilt;
  const l = world.stats.shipsLost;
  const r = world.stats.shipsRecycled;
  return { built: b.drone + b.lancer + b.flak, lost: l.drone + l.lancer + l.flak, recycled: r.drone + r.lancer + r.flak, refunded: world.stats.oreRefunded };
}

/** Rule 8, heart: the active area is reclaimed. Records the visit and pays its haul into the stockpile, once. */
export function reclaimActive(world: World, data: SimData): void {
  const camp = world.campaign;
  const a = camp.active;
  if (a === null) return;
  const rec = camp.areas[a]!;
  if (rec.reclaimedTick !== null) return;
  const visit = world.tick - camp.areaStartTick;
  const ships = shipTotals(world);
  rec.reclaimedTick = world.tick;
  rec.reclaimPlayTicks = visit;
  rec.playTicks += visit;
  rec.shipsBuilt += ships.built;
  rec.shipsLost += ships.lost;
  rec.shipsRecycled += ships.recycled;
  rec.oreRefunded += ships.refunded;
  camp.reclaimOrder.push(a);
  const haul = data.map.areas[a]!.haul;
  for (const res of RAW_RESOURCES) {
    camp.stockpile[res] += haul[res];
    camp.totals.hauled[res] += haul[res];
  }
}

/** `leaveArea`: back to the overworld. From a held area this is a withdraw: the visit is recorded and the area resets. */
export function leaveActive(world: World, data: SimData): void {
  const camp = world.campaign;
  const a = camp.active;
  if (a === null) return;
  const rec = camp.areas[a]!;
  if (rec.reclaimedTick === null) {
    const ships = shipTotals(world);
    rec.withdrawals += 1;
    rec.playTicks += world.tick - camp.areaStartTick;
    rec.shipsBuilt += ships.built;
    rec.shipsLost += ships.lost;
    rec.shipsRecycled += ships.recycled;
    rec.oreRefunded += ships.refunded;
  }
  clearArea(world, data);
  camp.active = null;
}

/** True while rule 10 runs: an area is active, its heart isn't captured, and the game isn't won. */
export function isShipping(world: Readonly<World>): boolean {
  return world.campaign.active !== null && world.capturedTick === null && !isWon(world);
}

/** Σ export over the reclaimed areas, per resource (per game minute, before shipments.pct). */
export function reclaimedExport(world: Readonly<World>, data: SimData): ResourceTriple {
  const sum: ResourceTriple = { ore: 0, ice: 0, crystal: 0 };
  data.map.areas.forEach((area, a) => {
    if (!isReclaimed(world, a)) return;
    for (const res of RAW_RESOURCES) sum[res] += area.export[res];
  });
  return sum;
}

/**
 * Rule 10, shipments (after stats, only while shipping): per resource in the
 * order ore, ice, crystal, shipAccum += Σ export × shipments.pct; while it
 * reaches ticksPerMin × 100, one unit goes to the stockpile.
 */
export function shipments(world: World, data: SimData): void {
  if (!isShipping(world)) return;
  const camp = world.campaign;
  const unit = ticksPerMin(world) * 100;
  const pct = world.tun['shipments.pct'];
  const exp = reclaimedExport(world, data);
  for (const res of RAW_RESOURCES) {
    camp.shipAccum[res] += exp[res] * pct;
    while (camp.shipAccum[res] >= unit) {
      camp.shipAccum[res] -= unit;
      camp.stockpile[res] += 1;
      camp.totals.shipped[res] += 1;
    }
  }
}

/** Extraction research (rule 3): 100 + level × research.extract.stepPct, percent. */
export function extractPct(world: Readonly<World>): number {
  return 100 + researchLevel(world, 'extract') * world.tun['research.extract.stepPct'];
}

/** Fast yards research (rule 5b): 100 − level × research.yards.stepPct, percent (before the 15-tick floor). */
export function yardTimePct(world: Readonly<World>): number {
  return 100 - researchLevel(world, 'yards') * world.tun['research.yards.stepPct'];
}

/** The fewest ticks a ship build can take after Fast yards. */
export const MIN_BUILD_TICKS = 15;

/** A ship build's ticks at the yard now: max(15, floor(ship.<type>.buildTicks × yardTimePct / 100)). */
export function yardBuildTicks(world: Readonly<World>, type: ShipType): number {
  return Math.max(MIN_BUILD_TICKS, Math.floor((world.tun[`ship.${type}.buildTicks`] * yardTimePct(world)) / 100));
}

/** The design gate (rule 5b): drones always; a lancer or flak yard only once its design is researched. */
export function designResearched(world: Readonly<World>, type: ShipType): boolean {
  return type === 'drone' || researchLevel(world, type) >= 1;
}

/** A start for tests, tools, bots and dev hooks: see campaignWorld. */
export interface CampaignStart {
  /** Area ids treated as already reclaimed (at tick 0, in this order; no haul is paid). */
  reclaimed?: string[];
  /** Research levels, by item id. */
  research?: Partial<Record<ResearchId, number>>;
  /** The stockpile to start with. */
  stockpile?: Partial<ResourceTriple>;
  /** Land at once in this area (it must be open), at tick 0, as `enterArea` would. */
  land?: string;
}

/**
 * Test and tool helper (DESIGN.md H4): a campaign at tick 0 as if `reclaimed`
 * were reclaimed and `research` bought, with `stockpile`, without playing;
 * optionally landed in `land`. Not reachable from the game's inputs. Throws on
 * an unknown area or item, a level past the max, or a landing that isn't open.
 */
export function campaignWorld(seed: number, data: SimData, start: Readonly<CampaignStart> = {}): World {
  const world = createWorld(seed, data);
  const camp = world.campaign;
  for (const id of start.reclaimed ?? []) {
    const a = areaIndex(data, id);
    if (a < 0) throw new Error(`campaignWorld: unknown area ${id}`);
    if (camp.areas[a]!.reclaimedTick !== null) throw new Error(`campaignWorld: area ${id} listed twice`);
    camp.areas[a]!.reclaimedTick = 0;
    camp.areas[a]!.reclaimPlayTicks = 0;
    camp.reclaimOrder.push(a);
  }
  for (const id of RESEARCH_IDS) {
    const level = start.research?.[id];
    if (level === undefined) continue;
    const item = data.research[researchIndex(data, id)];
    if (item === undefined) throw new Error(`campaignWorld: research ${id} is not in this data`);
    if (!Number.isInteger(level) || level < 0 || level > item.levels.length) throw new Error(`campaignWorld: research ${id} level ${level} out of 0..${item.levels.length}`);
    camp.research[id] = level;
  }
  for (const k of Object.keys(start.research ?? {})) if (!(RESEARCH_IDS as readonly string[]).includes(k)) throw new Error(`campaignWorld: unknown research ${k}`);
  for (const res of RAW_RESOURCES) camp.stockpile[res] = start.stockpile?.[res] ?? 0;
  if (start.land !== undefined) {
    const a = areaIndex(data, start.land);
    if (!isAreaOpen(world, data, a)) throw new Error(`campaignWorld: area ${start.land} is not open`);
    landArea(world, data, a);
  }
  return world;
}
