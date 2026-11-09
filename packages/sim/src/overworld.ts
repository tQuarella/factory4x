import {
  bandOpen,
  canBuyResearch,
  commandedBands,
  designResearched,
  haulIfReclaimedNow,
  isBandCommanded,
  isCapOff,
  extractPct,
  isAreaOpen,
  isKnown,
  isLaneOpen,
  isReclaimed,
  isShipping,
  isWon,
  laneNeighbours,
  maxCommandedBands,
  nextLevelCost,
  reclaimedExport,
  repeatOf,
  shortfall,
  unmetRequirements,
  yardTimePct,
  type TierShortfall,
} from './campaign.ts';
import { fleetCap } from './fleet.ts';
import {
  RAW_RESOURCES,
  RIG_NODES,
  type AreaSide,
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

/** 'locked': not enterable now (see AreaStatus.lockReason: no lane to a reclaimed area, or H6's band lock). */
export type AreaState = 'locked' | 'open' | 'reclaimed' | 'active';

/**
 * H6: why a held area can't be entered from the overworld. 'lanes': not lane-joined to a reclaimed area (H4).
 * 'bandLocked': lane-joined, but its band is locked until a relay in the band below is reclaimed. When both hold,
 * 'lanes' (the far area's sheet still shows the band's lock line from `bandOpen` and `unlockRelays`).
 */
export type LockReason = 'lanes' | 'bandLocked';

/**
 * H6 "Selectors": one area's frontier facts for the overworld map and the area sheet. Everything is derived from
 * the reclaim records, data and live tunables.
 */
export interface AreaFrontier {
  /** Reclaimed, or lane-joined to a reclaimed area, or the tier-0 start: ring, prize, haul and guards may be shown. Otherwise far. */
  known: boolean;
  /** enterArea is valid for it from the overworld now (held, lane-joined, band open). */
  open: boolean;
  /** Its band is locked (overworld.bandLock on and no relay of the band below reclaimed), whatever its lanes. */
  locked: boolean;
  /** Why a held area isn't open, or null (open, reclaimed or active). */
  lockReason: LockReason | null;
  /** A command relay. */
  relay: boolean;
  /** The band (the area's tier). */
  band: number;
  side: AreaSide;
  /** Its band is commanded: a relay of this band is reclaimed (for a held relay: reclaiming it adds nothing to the limit). */
  commanded: boolean;
  /** Its band is open (bandOpen). */
  bandOpen: boolean;
  /** When locked: the relays (area indices, data order) of the band below; reclaiming any one opens it. Else empty. */
  unlockRelays: number[];
  /** The haul: what reclaiming it now pays (decayed when a group mate is reclaimed), or, once reclaimed, what it paid. */
  haulNow: ResourceTriple;
  /** True if haulNow is a decayed repeat (for a reclaimed area: if it was paid decayed). */
  haulDecayed: boolean;
  /** The reclaimed group mate that makes it a repeat ("half: Frost Shelf already reclaimed"), or null. */
  repeatOf: number | null;
  /** The fleet limit the next landing gets after reclaiming it (cap + relayStep for a relay of an uncommanded band), or null when the limit is off. */
  capAfter: number | null;
}

/** True if `paid` is less than the data haul in any resource. */
function lessThan(paid: Readonly<ResourceTriple>, haul: Readonly<ResourceTriple>): boolean {
  return RAW_RESOURCES.some((r) => paid[r] < haul[r]);
}

/** H6: one area's frontier facts (see AreaFrontier). */
export function areaFrontier(world: Readonly<World>, data: SimData, a: number): AreaFrontier {
  const area = data.map.areas[a];
  if (area === undefined) throw new Error(`no area ${a}`);
  const camp = world.campaign;
  const reclaimed = isReclaimed(world, a);
  const open = isAreaOpen(world, data, a);
  const bandIsOpen = bandOpen(world, data, area.tier);
  const lockReason: LockReason | null = reclaimed || camp.active === a || open ? null : !isLaneOpen(world, data, a) ? 'lanes' : !bandIsOpen ? 'bandLocked' : null;
  const unlockRelays: number[] = [];
  if (!bandIsOpen) data.map.areas.forEach((x, i) => x.relay && x.tier === area.tier - 1 && unlockRelays.push(i));
  const paid = camp.areas[a]!.haulPaid;
  const haulNow = reclaimed && paid !== null ? { ...paid } : haulIfReclaimedNow(world, data, a);
  const mate = repeatOf(world, data, a);
  const commanded = isBandCommanded(world, data, area.tier);
  const cap = fleetCap(world, data);
  // On the overworld fleetCap counts every reclaimed relay; reclaiming a relay of an uncommanded band adds one step.
  const capAfter = cap === null ? null : !reclaimed && area.relay && !commanded ? cap + world.tun['fleet.relayStep'] : cap;
  return {
    known: isKnown(world, data, a),
    open,
    locked: !bandIsOpen,
    lockReason,
    relay: area.relay,
    band: area.tier,
    side: area.side,
    commanded,
    bandOpen: bandIsOpen,
    unlockRelays,
    haulNow,
    haulDecayed: lessThan(haulNow, area.haul),
    repeatOf: mate,
    capAfter,
  };
}

export interface OverworldArea extends AreaFrontier {
  index: number;
  id: string;
  name: string;
  reclaimed: boolean;
}

export interface OverworldStatus {
  /** Every area in data order. */
  areas: OverworldArea[];
  /** Bands commanded by a reclaimed relay (0–2), and the most the data allows. */
  commandedBands: number;
  maxCommandedBands: number;
  /** The fleet limit (the next landing's, on the overworld), or null when fleet.cap is 0. */
  fleetCap: number | null;
  /** overworld.bandLock is on. */
  bandLock: boolean;
}

/** H6: the overworld map: per area {known, open, locked, relay, band, commanded, haulNow, …}, plus commandedBands and fleetCap. */
export function overworldStatus(world: Readonly<World>, data: SimData): OverworldStatus {
  return {
    areas: data.map.areas.map((area, index) => ({ index, id: area.id, name: area.name, reclaimed: isReclaimed(world, index), ...areaFrontier(world, data, index) })),
    commandedBands: commandedBands(world, data),
    maxCommandedBands: maxCommandedBands(data),
    fleetCap: fleetCap(world, data),
    bandLock: world.tun['overworld.bandLock'] > 0,
  };
}

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

export interface AreaStatus extends AreaFrontier {
  index: number;
  id: string;
  name: string;
  tier: number;
  x: number;
  y: number;
  state: AreaState;
  /** Area indices joined by a lane, in lane order. */
  lanes: number[];
  /** The data (nominal) haul. H6: what it pays or paid is `haulNow` (decayed for a repeat). */
  haul: ResourceTriple;
  /** Export per game minute (before shipments.pct). Exports never decay. */
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
    record: { ...camp.areas[a]!, haulPaid: camp.areas[a]!.haulPaid === null ? null : { ...camp.areas[a]!.haulPaid! } },
    ...areaFrontier(world, data, a),
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
   * "Needs both medium areas reclaimed": tier 2, count 2; no shipped item has one since H6), and capOff
   * (@deprecated: H5's Command limit while fleet.cap is 0; always false since H6 removed it).
   */
  missing: { resources: ResourceTriple; items: Array<{ id: string; level: number }>; areas: string[]; tiers: TierShortfall[]; capOff: boolean };
  /** `buyResearch` would be valid now (also false inside an area and after the win). */
  canBuy: boolean;
  /**
   * The effect as a number, now and at the next level (null at max):
   * opening: ore at each landing (economy.startStock + level × step); extract: extraction percent (100 + level × stepPct);
   * yards: ship build time percent (100 − level × stepPct, before the 15-tick floor); rigs: nodes rigged at landing;
   * lancer, flak, core: 0 or 1. (H6 removed Command limit, `fleet`, which data can no longer contain.)
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
  /** The fleet limit at the next landing, or in the area now (H6: fleet.cap + fleet.relayStep × commandedBands), or null when the limit is off. */
  fleetCap: number | null;
}

/** What research and relays do at the next landing (or did at this one): the landing notice and the probe sheet. */
export function landingEffects(world: Readonly<World>, data: SimData): LandingEffects {
  const t = world.tun;
  return {
    openingOre: t['economy.startStock'] + researchLevel(world, 'opening') * t['research.opening.step'],
    rigNodes: RIG_NODES.slice(0, Math.min(researchLevel(world, 'rigs'), RIG_NODES.length)),
    extractPct: extractPct(world),
    yardTimePct: yardTimePct(world),
    designs: { lancer: designResearched(world, 'lancer'), flak: designResearched(world, 'flak') },
    fleetCap: fleetCap(world, data),
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
  /** H6: the haul it paid (decayed for a repeat). */
  haulPaid: ResourceTriple | null;
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
  /** What hauls paid in (H6: decayed repeats included), and shipments. */
  hauled: ResourceTriple;
  shipped: ResourceTriple;
  /** H6: Σ data (nominal) haul over the reclaimed areas, to set against `hauled` (areas a campaignWorld start counts as reclaimed paid nothing). */
  haulNominal: ResourceTriple;
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
  const nominal: ResourceTriple = { ore: 0, ice: 0, crystal: 0 };
  for (const a of camp.reclaimOrder) for (const res of RAW_RESOURCES) nominal[res] += data.map.areas[a]!.haul[res];
  return {
    areas: camp.areas.map((r, a) => ({ ...r, haulPaid: r.haulPaid === null ? null : { ...r.haulPaid }, id: data.map.areas[a]!.id, name: data.map.areas[a]!.name })),
    reclaimOrder: camp.reclaimOrder.map((a) => {
      const r = camp.areas[a]!;
      const area = data.map.areas[a]!;
      return { area: a, id: area.id, name: area.name, tick: r.reclaimedTick!, reclaimPlayTicks: r.reclaimPlayTicks, playTicks: r.playTicks, entries: r.entries, withdrawals: r.withdrawals, haulPaid: r.haulPaid === null ? null : { ...r.haulPaid } };
    }),
    research: camp.researchLog.map((e) => ({ ...e, name: data.research.find((it) => it.id === e.item)?.name ?? e.item })),
    totalPlayTicks: total,
    shipsBuilt: built,
    shipsLost: lost,
    shipsRecycled: recycled,
    oreRefunded: refunded,
    hauled: { ...camp.totals.hauled },
    shipped: { ...camp.totals.shipped },
    haulNominal: nominal,
    wonTick: camp.wonTick,
    won: isWon(world),
  };
}
