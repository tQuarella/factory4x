import {
  canBuyResearch,
  designResearched,
  isCapOff,
  extractPct,
  isAreaOpen,
  isReclaimed,
  isShipping,
  isWon,
  laneNeighbours,
  nextLevelCost,
  reclaimedExport,
  shortfall,
  unmetRequirements,
  yardTimePct,
  type TierShortfall,
} from './campaign.ts';
import { fleetCap } from './fleet.ts';
import {
  RAW_RESOURCES,
  RIG_NODES,
  type AreaHeart,
  type MapLayout,
  type AreaLayout,
  type NodeKind,
  type RawResource,
  type ResearchId,
  type ResearchKind,
  type ResourceTriple,
  type SimData,
} from './data.ts';
import { counterTag, type CounterTag } from './selectors.ts';
import { capEff, researchLevel, type AreaRecord, type GuardCounts, type World } from './world.ts';

/**
 * Read-only campaign views (DESIGN.md H4 "Selectors"): the overworld HUD, the
 * area sheet, the research sheet, the landing notice and the win panel. Like
 * the area selectors they never change the world; rates needing a decimal are
 * in tenths (`…X10`).
 */

export interface CampaignStatus {
  /** Index into data map.areas of the area being played, or null on the overworld. */
  active: number | null;
  activeId: string | null;
  stockpile: ResourceTriple;
  /** What the reclaimed areas ship per game minute now, ×10: Σ export × shipments.pct / 10 (they only ship while `shipping`). */
  shipPerMinX10: ResourceTriple;
  /** Rule 10 runs now: an area is active, its heart isn't captured, and the game isn't won. */
  shipping: boolean;
  reclaimed: number;
  areaCount: number;
  wonTick: number | null;
  /** Level per research item id. */
  research: Record<string, number>;
}

/** Overworld HUD: stockpile, shipment rates, reclaimed count, research levels. */
export function campaignStatus(world: Readonly<World>, data: SimData): CampaignStatus {
  const camp = world.campaign;
  const exp = reclaimedExport(world, data);
  const pct = world.tun['shipments.pct'];
  const x10 = (n: number): number => Math.floor((n * pct) / 10);
  return {
    active: camp.active,
    activeId: camp.active === null ? null : data.map.areas[camp.active]!.id,
    stockpile: { ...camp.stockpile },
    shipPerMinX10: { ore: x10(exp.ore), ice: x10(exp.ice), crystal: x10(exp.crystal) },
    shipping: isShipping(world),
    reclaimed: camp.areas.filter((a) => a.reclaimedTick !== null).length,
    areaCount: data.map.areas.length,
    wonTick: camp.wonTick,
    research: { ...camp.research },
  };
}

export type AreaState = 'locked' | 'open' | 'reclaimed' | 'active';

export interface AreaGuardedNode {
  /** Frame node id ("p1", "root", "heart"). */
  id: string;
  kind: NodeKind;
  /** Pockets: ice or crystal; the heart: ore; the Root: null. */
  prize: RawResource | null;
  slots: number;
  /** capEff of the area's counts at the live guard.capPct. */
  caps: GuardCounts;
  /** The heart's caps once the Root is cut; null for other nodes and for a heart with no Root. */
  starvedCaps: GuardCounts | null;
}

export interface HeartTag extends CounterTag {
  /** The design is researched (the sheet adds "(not researched)" otherwise). */
  researched: boolean;
}

export interface AreaStatus {
  index: number;
  id: string;
  name: string;
  tier: number;
  x: number;
  y: number;
  state: AreaState;
  /** Area indices joined by a lane, in lane order. */
  lanes: number[];
  haul: ResourceTriple;
  /** Export per game minute (before shipments.pct). */
  export: ResourceTriple;
  /** Guarded nodes in node order: pockets, the Root (if present), the heart. */
  guarded: AreaGuardedNode[];
  hasRoot: boolean;
  /** Lancer and Flak against the heart's full (fed) caps. */
  heartTags: { lancer: HeartTag; flak: HeartTag };
  /** The visit record. */
  record: AreaRecord;
}

function areaLayout(world: Readonly<World>, data: SimData, a: number): MapLayout | AreaLayout {
  const area = data.map.areas[a]!;
  return area.layout === 'seed' ? data.map.layouts[world.campaign.deepLayout]! : area.layout;
}

/** One area for the overworld map and its sheet. Works on the overworld and inside an area. */
export function areaStatus(world: Readonly<World>, data: SimData, a: number): AreaStatus {
  const area = data.map.areas[a];
  if (area === undefined) throw new Error(`no area ${a}`);
  const camp = world.campaign;
  const layout = areaLayout(world, data, a);
  const pct = world.tun['guard.capPct'];
  const caps = (thorns: number, spores: number): GuardCounts => ({ thorn: capEff(thorns, pct), spore: capEff(spores, pct) });
  const frame = data.map.nodes.filter((n) => area.nodes.includes(n.id));
  const hasRoot = frame.some((n) => n.kind === 'root');
  const guarded: AreaGuardedNode[] = [];
  for (const n of frame) {
    if (n.kind === 'pocket') {
      const p = layout.pockets[n.id]!;
      guarded.push({ id: n.id, kind: n.kind, prize: p.prize, slots: p.slots, caps: caps(p.thorns, p.spores), starvedCaps: null });
    } else if (n.kind === 'root') {
      const r = layout.root!;
      guarded.push({ id: n.id, kind: n.kind, prize: null, slots: 0, caps: caps(r.thorns, r.spores), starvedCaps: null });
    } else if (n.kind === 'heart') {
      const h: AreaHeart = layout.heart;
      const starved = hasRoot && h.starvedThorns !== undefined && h.starvedSpores !== undefined ? caps(h.starvedThorns, h.starvedSpores) : null;
      guarded.push({ id: n.id, kind: n.kind, prize: 'ore', slots: n.slots, caps: caps(h.thorns, h.spores), starvedCaps: starved });
    }
  }
  const heart = guarded[guarded.length - 1]!;
  const tag = (ship: 'lancer' | 'flak'): HeartTag => ({ ...counterTag(world.tun, ship, heart.caps), researched: designResearched(world, ship) });
  const state: AreaState = camp.active === a ? 'active' : isReclaimed(world, a) ? 'reclaimed' : isAreaOpen(world, data, a) ? 'open' : 'locked';
  return {
    index: a,
    id: area.id,
    name: area.name,
    tier: area.tier,
    x: area.x,
    y: area.y,
    state,
    lanes: laneNeighbours(data, a),
    haul: { ...area.haul },
    export: { ...area.export },
    guarded,
    hasRoot,
    heartTags: { lancer: tag('lancer'), flak: tag('flak') },
    record: { ...camp.areas[a]! },
  };
}

export interface ResearchRow {
  index: number;
  id: ResearchId;
  name: string;
  kind: ResearchKind;
  level: number;
  maxLevel: number;
  /** The next level's cost after research.costPct, or null at max. */
  cost: ResourceTriple | null;
  /** The stockpile covers `cost` (false at max). */
  affordable: boolean;
  /**
   * What blocks a purchase: per-resource shortfalls (0 where covered), items below their level, areas not
   * reclaimed, (H5) tier requirements short of reclaimed areas ("Needs a medium area reclaimed": tier 2, count 1;
   * "Needs both medium areas reclaimed": tier 2, count 2), and capOff: a limit item while fleet.cap is 0
   * ("Fleet limit is off (tuning)").
   */
  missing: { resources: ResourceTriple; items: Array<{ id: string; level: number }>; areas: string[]; tiers: TierShortfall[]; capOff: boolean };
  /** `buyResearch` would be valid now (also false inside an area and after the win). */
  canBuy: boolean;
  /**
   * The effect as a number, now and at the next level (null at max):
   * opening: ore at each landing (economy.startStock + level × step); extract: extraction percent (100 + level × stepPct);
   * yards: ship build time percent (100 − level × stepPct, before the 15-tick floor); rigs: nodes rigged at landing;
   * lancer, flak, core: 0 or 1; fleet (H5, kind limit): the fleet limit, fleet.cap + level × research.fleet.step,
   * or 0 when the limit is off (fleet.cap 0).
   */
  effect: number;
  nextEffect: number | null;
}

/** The effect number of `id` at `level` (see ResearchRow.effect). */
export function researchEffect(world: Readonly<World>, id: ResearchId, level: number): number {
  const t = world.tun;
  if (id === 'opening') return t['economy.startStock'] + level * t['research.opening.step'];
  if (id === 'extract') return 100 + level * t['research.extract.stepPct'];
  if (id === 'yards') return 100 - level * t['research.yards.stepPct'];
  if (id === 'fleet') return t['fleet.cap'] <= 0 ? 0 : t['fleet.cap'] + level * t['research.fleet.step'];
  return level;
}

/** The research sheet: every item in data order. */
export function researchStatus(world: Readonly<World>, data: SimData): ResearchRow[] {
  return data.research.map((item, index): ResearchRow => {
    const level = researchLevel(world, item.id);
    const cost = nextLevelCost(world, item);
    const unmet = unmetRequirements(world, data, item);
    const resources = cost === null ? { ore: 0, ice: 0, crystal: 0 } : shortfall(world, cost);
    const max = item.levels.length;
    return {
      index,
      id: item.id,
      name: item.name,
      kind: item.kind,
      level,
      maxLevel: max,
      cost,
      affordable: cost !== null && RAW_RESOURCES.every((r) => resources[r] === 0),
      missing: { resources, items: unmet.items, areas: unmet.areas, tiers: unmet.tiers, capOff: isCapOff(world, item) },
      canBuy: canBuyResearch(world, data, index),
      effect: researchEffect(world, item.id, level),
      nextEffect: level < max ? researchEffect(world, item.id, level + 1) : null,
    };
  });
}

export interface LandingEffects {
  /** Ore in stock at a landing now: economy.startStock + opening level × research.opening.step. */
  openingOre: number;
  /** Node ids that land rigged (1 extractor and a route): the first `rigs` of a1, a2. */
  rigNodes: string[];
  /** Extraction percent (100 = no research). */
  extractPct: number;
  /** Ship build time percent (100 = no research; builds never go under 15 ticks). */
  yardTimePct: number;
  /** Which designs are researched (their yards start on). */
  designs: { lancer: boolean; flak: boolean };
  /** H5: the fleet limit in an area now (fleet.cap + Command limit level × step), or null when the limit is off. */
  fleetCap: number | null;
}

/** What research does at the next landing (or did at this one): the landing notice and the probe sheet. */
export function landingEffects(world: Readonly<World>): LandingEffects {
  const t = world.tun;
  return {
    openingOre: t['economy.startStock'] + researchLevel(world, 'opening') * t['research.opening.step'],
    rigNodes: RIG_NODES.slice(0, Math.min(researchLevel(world, 'rigs'), RIG_NODES.length)),
    extractPct: extractPct(world),
    yardTimePct: yardTimePct(world),
    designs: { lancer: designResearched(world, 'lancer'), flak: designResearched(world, 'flak') },
    fleetCap: fleetCap(world),
  };
}

export interface ReclaimEntry {
  area: number;
  id: string;
  name: string;
  /** World tick of the reclaim. */
  tick: number;
  /** The reclaiming visit (landing to heart capture), and every visit's play ticks while held. */
  reclaimPlayTicks: number | null;
  playTicks: number;
  entries: number;
  withdrawals: number;
}

export interface CampaignSummary {
  /** Every area in data order with its record. */
  areas: Array<AreaRecord & { id: string; name: string }>;
  /** Reclaimed areas, in reclaim order. */
  reclaimOrder: ReclaimEntry[];
  /** Research purchases in order, with names. */
  research: Array<{ item: string; name: string; level: number; tick: number }>;
  /** Σ every area's held play ticks, plus the visit in progress if the active area is held. */
  totalPlayTicks: number;
  shipsBuilt: number;
  shipsLost: number;
  /** H5: ships recycled and ore refunded, over the recorded visits (as shipsBuilt). */
  shipsRecycled: number;
  oreRefunded: number;
  hauled: ResourceTriple;
  shipped: ResourceTriple;
  wonTick: number | null;
  won: boolean;
}

/** The win panel and the bots: the whole campaign so far. */
export function campaignSummary(world: Readonly<World>, data: SimData): CampaignSummary {
  const camp = world.campaign;
  let total = 0;
  let built = 0;
  let lost = 0;
  let recycled = 0;
  let refunded = 0;
  for (const r of camp.areas) {
    total += r.playTicks;
    built += r.shipsBuilt;
    lost += r.shipsLost;
    recycled += r.shipsRecycled;
    refunded += r.oreRefunded;
  }
  if (camp.active !== null && !isReclaimed(world, camp.active)) total += world.tick - camp.areaStartTick;
  return {
    areas: camp.areas.map((r, a) => ({ ...r, id: data.map.areas[a]!.id, name: data.map.areas[a]!.name })),
    reclaimOrder: camp.reclaimOrder.map((a) => {
      const r = camp.areas[a]!;
      const area = data.map.areas[a]!;
      return { area: a, id: area.id, name: area.name, tick: r.reclaimedTick!, reclaimPlayTicks: r.reclaimPlayTicks, playTicks: r.playTicks, entries: r.entries, withdrawals: r.withdrawals };
    }),
    research: camp.researchLog.map((e) => ({ ...e, name: data.research.find((it) => it.id === e.item)?.name ?? e.item })),
    totalPlayTicks: total,
    shipsBuilt: built,
    shipsLost: lost,
    shipsRecycled: recycled,
    oreRefunded: refunded,
    hauled: { ...camp.totals.hauled },
    shipped: { ...camp.totals.shipped },
    wonTick: camp.wonTick,
    won: isWon(world),
  };
}
