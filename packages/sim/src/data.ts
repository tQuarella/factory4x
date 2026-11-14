/**
 * Data schema for data/sim.json: tunables (keyed by their dotted name, each
 * with default/min/max), the fixed 16-node map and the hand-made layouts
 * (DESIGN.md H3 "Counter web"), and the H4 overworld: areas (node subsets of
 * the map with their own guards, haul and export), lanes and research. H6
 * ("Open frontier"): areas gain `side` and `relay`, the frame grows to
 * 1000 × 2100, and the haul invariant counts repeat hauls at their worst.
 * `parseSimData` validates a raw JSON value against the schema, so bad data
 * fails loudly at load time rather than as a desync later.
 */

/** Ship types, in display order. The sim iterates them only in the fixed orders below. These are the warships: H7's economy ships are ECON_TYPES. */
export const SHIP_TYPES = ['drone', 'lancer', 'flak'] as const;
export type ShipType = (typeof SHIP_TYPES)[number];

/** H7 economy ships (DESIGN.md H7 "Ship types"): built by the probe, never sent by hand, 0 damage. */
export const ECON_TYPES = ['extractor', 'hauler'] as const;
export type EconType = (typeof ECON_TYPES)[number];

/**
 * H7: every type the probe builds in field mode, in the spec's type order ("Type order everywhere: extractor,
 * hauler, drone, lancer, flak"). The allocation, the bays and their starts and finishes all walk this order.
 */
export const BUILD_TYPES = ['extractor', 'hauler', 'drone', 'lancer', 'flak'] as const;
export type BuildType = (typeof BUILD_TYPES)[number];

/** H7: how a new run starts (DESIGN.md H7 "What is parked, and how"). Data without `run` is a campaign. */
export const RUN_MODES = ['campaign', 'field'] as const;
export type RunMode = (typeof RUN_MODES)[number];

/**
 * Rule 5b: finished ships spawn in this order. Starts: the component yards
 * (YARD_ROTATION) go before the drone yard, so a scarce component is never
 * starved by drones; among themselves they take turns (world.yardTurn).
 * Rule 7 (player damage) uses COMBAT_ORDER.
 */
export const YARD_ORDER: readonly ShipType[] = ['lancer', 'flak', 'drone'];
/** Rule 5b: the yards served round-robin, before the drone yard. `world.yardTurn` indexes this list. */
export const YARD_ROTATION: readonly ShipType[] = ['lancer', 'flak'];
export const COMBAT_ORDER: readonly ShipType[] = ['lancer', 'flak', 'drone'];

/** Guard types, in the fixed order every per-type loop uses (regrowth, wilt, initial fill). */
export const GUARD_TYPES = ['thorn', 'spore'] as const;
export type GuardType = (typeof GUARD_TYPES)[number];

/** Resources a node yields (asteroids and the heart: ore; pockets: their prize). */
export const RAW_RESOURCES = ['ore', 'ice', 'crystal'] as const;
export type RawResource = (typeof RAW_RESOURCES)[number];
/** What a pocket can hold. */
export type Prize = Exclude<RawResource, 'ore'>;

/** Components, in assembly order (rule 5a). */
export const COMPONENTS = ['lens', 'plating'] as const;
export type Component = (typeof COMPONENTS)[number];

/** Everything kept in `world.stock`, in display order (HUD chips). */
export const RESOURCES = ['ore', 'ice', 'crystal', 'lens', 'plating'] as const;
export type Resource = (typeof RESOURCES)[number];

/** The prize each component is assembled from: lens = ore + crystal, plating = ore + ice. */
export const COMPONENT_INPUT: Readonly<Record<Component, Prize>> = { lens: 'crystal', plating: 'ice' };

/** The component each ship type consumes (null: ore only). */
export const SHIP_COMPONENT: Readonly<Record<ShipType, Component | null>> = { drone: null, lancer: 'lens', flak: 'plating' };

/** Every tunable in DESIGN.md (H1 economy keys, H3, H4, H5 and H6 "Tunables"), in display order. H6 removed `research.fleet.step`. The order is fixed and is the only order the sim iterates in. */
export const TUNABLE_KEYS = [
  'economy.startStock',
  'economy.probeOrePerMin',
  'extractor.cost',
  'extractor.buildTicks',
  'extractor.orePerMin',
  'node.bufferCap',
  'route.costBase',
  'route.costPer100Su',
  'route.buildTicks',
  'route.podIntervalTicks',
  'route.podOrePerLevel',
  'route.podSpeedSu',
  'route.upgradeCostPerLevel',
  'route.maxLevel',
  'build.queueMax',
  'ship.drone.cost',
  'ship.drone.buildTicks',
  'ship.drone.hp',
  'ship.drone.damage',
  'ship.lancer.cost',
  'ship.lancer.buildTicks',
  'ship.lancer.hp',
  'ship.lancer.damage',
  'ship.flak.cost',
  'ship.flak.buildTicks',
  'ship.flak.hp',
  'ship.flak.damage',
  'ship.speedSu',
  'counter.strongPct',
  'counter.weakPct',
  'guard.thorn.hp',
  'guard.thorn.damage',
  'guard.thorn.repairPerRound',
  'guard.thorn.regrowTicks',
  'guard.spore.hp',
  'guard.spore.damage',
  'guard.spore.repairPerRound',
  'guard.spore.regrowTicks',
  'guard.capPct',
  'bloom.starvedRegrowMul',
  'bloom.starvedRepairPerRound',
  'combat.roundTicks',
  'pocket.resourcePerMin',
  'pocket.freeExtractors',
  'heart.orePerMin',
  'heart.freeExtractors',
  'component.lens.ore',
  'component.lens.crystal',
  'component.plating.ore',
  'component.plating.ice',
  'component.buildTicks',
  'component.stockCap',
  'fleet.cap',
  'fleet.recycleRefundPct',
  'fleet.relayStep',
  'research.opening.step',
  'research.extract.stepPct',
  'research.yards.stepPct',
  'research.costPct',
  'shipments.pct',
  'areas.repeatHaulPct',
  'overworld.bandLock',
  'system.variant',
  'alloc.maxWeight',
  'alloc.start.extractor',
  'alloc.start.hauler',
  'ship.extractor.cost',
  'ship.extractor.buildTicks',
  'ship.extractor.hp',
  'ship.hauler.cost',
  'ship.hauler.buildTicks',
  'ship.hauler.hp',
  'ship.hauler.cargo',
  'ship.hauler.speedSu',
  'ship.lancer.crystal',
  'ship.flak.ice',
  'field.fleetCap',
  'fleet.countsEconomy',
  'raid.enabled',
  'raid.firstAtEcon',
  'raid.econPerRaider',
  'raid.maxSize',
  'raid.gapTicks',
  'raid.hiveKeepPct',
  'raid.musterTicks',
  'raid.speedSu',
  'hive.regrowPct',
  'hauler.autoNeed',
  'hauler.needPct',
  'rock.haulerMax',
  'raid.shieldEcon',
  'raid.haulersHold',
  'move.splitPct',
  'stats.throughputWindowSec',
  'client.autosaveSec',
  'client.longPressMs',
  'client.dragSlopPx',
  'client.moveGesture',
] as const;

export type TunableKey = (typeof TUNABLE_KEYS)[number];

/** Tunables that live in the world and can change with `setTunable`. Excludes `stats.*` (fixed) and `client.*` (not sim state). */
export type SimTunableKey = Exclude<TunableKey, `stats.${string}` | `client.${string}`>;

export const SIM_TUNABLE_KEYS: readonly SimTunableKey[] = TUNABLE_KEYS.filter(
  (k): k is SimTunableKey => !k.startsWith('stats.') && !k.startsWith('client.'),
);

/** Current values of the sim tunables, keyed by dotted name. Stored in the world, so live tuning is part of the state and the hash. */
export type Tunables = Record<SimTunableKey, number>;

export interface TunableSpec {
  default: number;
  min: number;
  max: number;
}

export type NodeKind = 'probe' | 'asteroid' | 'pocket' | 'root' | 'heart';

export interface MapNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  r: number;
  /** Extractor slots. Pockets take theirs from the layout (the map value is ignored; 0 in the shipped data). */
  slots: number;
}

/** Guard counts per type, as written in a layout (before `guard.capPct`). */
export interface GuardMix {
  thorns: number;
  spores: number;
}

export interface LayoutPocket extends GuardMix {
  prize: Prize;
  slots: number;
}

export interface LayoutHeart extends GuardMix {
  starvedThorns: number;
  starvedSpores: number;
}

/**
 * One hand-made layout (DESIGN.md H3 "Layouts"): what each pocket holds and
 * how every guarded node is defended. Positions never change.
 */
export interface MapLayout {
  id: string;
  /** Player-facing name ("Frost Gate"). */
  name: string;
  /** One entry per pocket node, keyed by node id. */
  pockets: Record<string, LayoutPocket>;
  root: GuardMix;
  heart: LayoutHeart;
}

/** One integer per raw resource, in the fixed order ore, ice, crystal (hauls, exports, costs, the stockpile). */
export type ResourceTriple = Record<RawResource, number>;

/** An area's heart: its guard counts, plus starved counts only when the area has a Root. */
export interface AreaHeart extends GuardMix {
  starvedThorns?: number;
  starvedSpores?: number;
}

/**
 * An area's own guards (DESIGN.md H4 "Area guards"), in the H3 layout format:
 * one pocket entry per pocket node present, `root` only when the Root is
 * present, and the heart (with starved counts only when there is a Root).
 */
export interface AreaLayout {
  pockets: Record<string, LayoutPocket>;
  root?: GuardMix;
  heart: AreaHeart;
}

/**
 * H6: an area's side. With its tier (its band) it makes the area's repeat-haul
 * group: the second area reclaimed in a (tier, side) group pays
 * areas.repeatHaulPct of its haul. `none` never decays.
 */
export const AREA_SIDES = ['ice', 'crystal', 'none'] as const;
export type AreaSide = (typeof AREA_SIDES)[number];

/** H6: the overworld frame (DESIGN.md H6 "The overworld"). Every area's x and y lie inside it. */
export const OVERWORLD_FRAME: Readonly<{ width: number; height: number }> = Object.freeze({ width: 1000, height: 2100 });

/** H6: command relays stand in these bands (tiers) only; the first one reclaimed in a band commands it. */
export const RELAY_TIERS: readonly number[] = [1, 2];

/** One overworld area (DESIGN.md H4 "Areas", H6 "Areas"). */
export interface MapArea {
  id: string;
  name: string;
  /** 0 Landfall (the start, open from the beginning), 1 light, 2 medium, 3 The Deep. H6: the area's band. */
  tier: number;
  /** H6: the repeat-haul side (with `tier`, the group). */
  side: AreaSide;
  /** H6: a command relay (tiers 1–2 only). The first relay reclaimed in a band raises the fleet limit by fleet.relayStep and opens the next band. */
  relay: boolean;
  /** Overworld position (inside OVERWORLD_FRAME: x 0–1000, y 0–2100). */
  x: number;
  y: number;
  /** Frame node ids present in this area (map.nodes ids), any order; the area uses them in frame order. */
  nodes: string[];
  /** Paid into the stockpile once, at reclaim. */
  haul: ResourceTriple;
  /** Shipped per game minute (× shipments.pct / 100) while a held area is played. */
  export: ResourceTriple;
  /** The area's guards, or "seed": the run's H3 layout (The Deep). */
  layout: AreaLayout | 'seed';
}

/** An undirected lane between two areas, by area id. */
export type MapLane = [string, string];

/**
 * The research item ids the sim gives effects to (DESIGN.md H4 "Research").
 * @deprecated member `fleet`: H5's Command limit, removed at H6 (data v10). parseSimData rejects it; the id stays
 * in the type only so H5 client code still compiles until h6-client drops it.
 */
export const RESEARCH_IDS = ['lancer', 'flak', 'opening', 'extract', 'rigs', 'yards', 'core', 'fleet'] as const;
export type ResearchId = (typeof RESEARCH_IDS)[number];

/** Research ids that data may no longer use (H6 removed Command limit: relays are the only way to raise the limit). */
export const REMOVED_RESEARCH_IDS: readonly ResearchId[] = ['fleet'];

/**
 * H5 added 'limit' (Command limit). @deprecated member `limit`: removed at H6 with the `fleet` item; parseSimData
 * rejects it. Kept in the type only so H5 client code still compiles.
 */
export type ResearchKind = 'design' | 'grind' | 'win' | 'limit';

/**
 * A research requirement: another item at a level, an area reclaimed, or (H5)
 * at least `count` reclaimed areas of tier ≥ `tier`. `atLevel` (H5, optional)
 * limits it to buying that one level; without it, it holds for every level.
 */
export type ResearchRequirement = ({ item: string; level: number } | { area: string } | { tier: number; count: number }) & { atLevel?: number };

/** True for the H5 `{tier, count}` requirement. */
export function isTierRequirement(q: ResearchRequirement): q is { tier: number; count: number } & { atLevel?: number } {
  return 'tier' in q;
}

/** True if `q` applies to buying level `level` (1-based) of its item. */
export function appliesAtLevel(q: ResearchRequirement, level: number): boolean {
  return q.atLevel === undefined || q.atLevel === level;
}

/** One research item: a cost per level (before research.costPct), and requirements (each for every level, or for its `atLevel`). */
export interface ResearchItem {
  id: ResearchId;
  name: string;
  kind: ResearchKind;
  levels: ResourceTriple[];
  requires: ResearchRequirement[];
}

/** Seed rigs (H4): rig level L gives the first L of these nodes a free extractor and route at landing. */
export const RIG_NODES: readonly string[] = ['a1', 'a2'];

/**
 * H7: the one field a field-mode run plays (DESIGN.md H7 "The field"). Frame node ids (probe first, the heart
 * present, no Root), the asteroids Mine-marked at the landing, and its guards in the H4 area layout format
 * (no Root, no starved counts).
 */
export interface FieldMap {
  nodes: string[];
  mine: string[];
  layout: AreaLayout;
}

export interface SimData {
  dataVersion: number;
  tickRate: number;
  /** H7: absent means `{ mode: 'campaign' }` (the frozen fixtures and the H1–H6 rules). Read it with runMode(data). */
  run?: { mode: RunMode };
  tunables: Record<TunableKey, TunableSpec>;
  /** H7: `field` is required when run.mode is 'field'. */
  map: { nodes: MapNode[]; layouts: MapLayout[]; areas: MapArea[]; lanes: MapLane[]; field?: FieldMap };
  research: ResearchItem[];
}

/** H7: the data's run mode ('campaign' when `run` is absent). */
export function runMode(data: SimData): RunMode {
  return data.run?.mode ?? 'campaign';
}

/**
 * H7: the same data with `run.mode` set (a shallow copy; everything else is shared, and the copy is not
 * re-validated: switching to 'field' needs `map.field`). Tests and tools use it to play the parked campaign on the
 * shipped data (`withRunMode(defaultData, 'campaign')`).
 */
export function withRunMode(data: SimData, mode: RunMode): SimData {
  if (mode === 'field' && data.map.field === undefined) throw new Error('withRunMode: field mode needs map.field');
  return { ...data, run: { mode } };
}

/**
 * H7 "What is parked, and how": the tunables kept in data and code but unused in field mode (the tuning panel
 * hides them there). `route.*`, `component.*`, `research.*` and `bloom.starved*` are every key with that prefix.
 */
export const FIELD_PARKED_KEYS: readonly TunableKey[] = TUNABLE_KEYS.filter(
  (k) =>
    k.startsWith('route.') ||
    k.startsWith('component.') ||
    k.startsWith('research.') ||
    k.startsWith('bloom.starved') ||
    ['extractor.cost', 'extractor.buildTicks', 'build.queueMax', 'shipments.pct', 'areas.repeatHaulPct', 'overworld.bandLock', 'fleet.relayStep', 'fleet.cap'].includes(k),
);

/** Tunable metadata for the tuning panel. */
export interface TunableMeta {
  key: TunableKey;
  /** The part before the first dot, for grouping ("ship"). */
  section: string;
  default: number;
  min: number;
  max: number;
  /** True if `setTunable` accepts it (sim scope) or the client may change it live (client scope). */
  live: boolean;
  /** 'sim' values change through `setTunable`; 'client' values are client settings and never enter the sim. */
  scope: 'sim' | 'client';
  /** True if the value is only read when a world is created (it has no effect on a running game). */
  newRunOnly: boolean;
}

/** Keys that are read only by `createWorld`. (H4: economy.startStock is read at every landing, so it is live.) */
const NEW_RUN_ONLY: ReadonlySet<string> = new Set(['system.variant', 'alloc.start.extractor', 'alloc.start.hauler']);

/** capEff never exceeds this many guards of one type (DESIGN.md H3 "Effective caps"). */
export const GUARD_CAP_MAX = 60;

/** Largest guard count a layout may write for one type (before guard.capPct). */
export const LAYOUT_COUNT_MAX = 60;

const NODE_KINDS: readonly NodeKind[] = ['probe', 'asteroid', 'pocket', 'root', 'heart'];

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function fail(msg: string): never {
  throw new Error(`Invalid sim data: ${msg}`);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function checkCount(v: unknown, where: string): void {
  if (!isInt(v) || v < 0 || v > LAYOUT_COUNT_MAX) fail(`${where} must be an integer 0..${LAYOUT_COUNT_MAX}`);
}

/** Validates raw JSON (data/sim.json or a replay's data) and returns it typed. Throws on any schema error. */
export function parseSimData(raw: unknown): SimData {
  if (!isObj(raw)) fail('not an object');
  const r = raw;
  if (!isInt(r.dataVersion) || r.dataVersion < 1) fail('dataVersion must be a positive integer');
  if (!isInt(r.tickRate) || r.tickRate < 1) fail('tickRate must be a positive integer');
  if (!isObj(r.tunables)) fail('tunables missing');
  const tunRec = r.tunables;
  const known = new Set<string>(TUNABLE_KEYS);
  for (const k of Object.keys(tunRec)) if (!known.has(k)) fail(`unknown tunable ${k}`);
  for (const k of TUNABLE_KEYS) {
    const spec = tunRec[k];
    if (!isObj(spec)) fail(`tunable ${k} missing`);
    const { default: d, min, max } = spec;
    if (!isInt(d) || !isInt(min) || !isInt(max)) fail(`tunable ${k} needs integer default/min/max`);
    if (min > max || d < min || d > max) fail(`tunable ${k} default ${d} outside ${min}..${max}`);
  }
  // The combat conversion divides by both counter percentages and the regrow period by its ticks.
  // H7: the hauler and raid speeds, raid.econPerRaider, the bays' build ticks and alloc.maxWeight are divisors too.
  for (const k of [
    'counter.strongPct',
    'counter.weakPct',
    'guard.thorn.regrowTicks',
    'guard.spore.regrowTicks',
    'bloom.starvedRegrowMul',
    'combat.roundTicks',
    'ship.hauler.speedSu',
    'raid.speedSu',
    'raid.econPerRaider',
    'ship.extractor.buildTicks',
    'ship.hauler.buildTicks',
    'alloc.maxWeight',
  ] as const) {
    if ((tunRec[k] as unknown as TunableSpec).min < 1) fail(`tunable ${k} must have min >= 1`);
  }

  const map = r.map;
  if (!isObj(map) || !Array.isArray(map.nodes)) fail('map.nodes missing');
  const nodes = map.nodes as unknown[];
  const ids = new Set<string>();
  const pocketIds: string[] = [];
  const kindCount: Record<NodeKind, number> = { probe: 0, asteroid: 0, pocket: 0, root: 0, heart: 0 };
  nodes.forEach((n, i) => {
    if (!isObj(n)) fail(`map.nodes[${i}] not an object`);
    if (typeof n.id !== 'string' || ids.has(n.id)) fail(`map.nodes[${i}] needs a unique string id`);
    ids.add(n.id);
    if (!NODE_KINDS.includes(n.kind as NodeKind)) fail(`map.nodes[${i}] bad kind`);
    for (const f of ['x', 'y', 'r', 'slots'] as const) {
      if (!isInt(n[f]) || n[f] < 0) fail(`map.nodes[${i}].${f} must be a non-negative integer`);
    }
    kindCount[n.kind as NodeKind]++;
    if (n.kind === 'pocket') pocketIds.push(n.id);
  });
  if (kindCount.probe !== 1 || !isObj(nodes[0]) || nodes[0].kind !== 'probe') fail('exactly one probe, at index 0');
  if (kindCount.heart !== 1) fail('exactly one heart node');
  if (kindCount.root !== 1) fail('exactly one root node');

  if (!Array.isArray(map.layouts) || map.layouts.length < 1) fail('map.layouts missing');
  const layouts = map.layouts as unknown[];
  const layoutIds = new Set<string>();
  layouts.forEach((l, i) => {
    const at = `map.layouts[${i}]`;
    if (!isObj(l)) fail(`${at} not an object`);
    if (typeof l.id !== 'string' || layoutIds.has(l.id)) fail(`${at} needs a unique string id`);
    layoutIds.add(l.id);
    if (typeof l.name !== 'string' || l.name === '') fail(`${at} needs a name`);
    if (!isObj(l.pockets)) fail(`${at}.pockets missing`);
    const pockets = l.pockets;
    for (const k of Object.keys(pockets)) if (!pocketIds.includes(k)) fail(`${at}.pockets.${k} is not a pocket node`);
    for (const id of pocketIds) {
      const p = pockets[id];
      if (!isObj(p)) fail(`${at}.pockets.${id} missing`);
      if (p.prize !== 'ice' && p.prize !== 'crystal') fail(`${at}.pockets.${id}.prize must be ice or crystal`);
      if (!isInt(p.slots) || p.slots < 0) fail(`${at}.pockets.${id}.slots must be a non-negative integer`);
      checkCount(p.thorns, `${at}.pockets.${id}.thorns`);
      checkCount(p.spores, `${at}.pockets.${id}.spores`);
    }
    if (!isObj(l.root)) fail(`${at}.root missing`);
    checkCount(l.root.thorns, `${at}.root.thorns`);
    checkCount(l.root.spores, `${at}.root.spores`);
    if (!isObj(l.heart)) fail(`${at}.heart missing`);
    for (const f of ['thorns', 'spores', 'starvedThorns', 'starvedSpores'] as const) checkCount(l.heart[f], `${at}.heart.${f}`);
  });
  // system.variant: 0 = by seed, k = layout k − 1, so its range must stay inside the table.
  const forced = tunRec['system.variant'] as unknown as TunableSpec;
  if (forced.min !== 0 || forced.max > layouts.length) fail(`system.variant range must be 0..${layouts.length} or narrower`);
  const areaIds = parseAreas(map.areas, nodes as MapNode[]);
  parseLanes(map.lanes, areaIds);
  const research = parseResearch(r.research, map.areas as MapArea[]);
  const areas = map.areas as MapArea[];
  // No softlock (DESIGN.md H6 "The haul invariant", replacing H4's): taking every area, each at its worst
  // position (every area in a repeat group of two or more paid at the default areas.repeatHaulPct), always pays for
  // every research level, at the research.costPct maximum.
  const costMax = (tunRec['research.costPct'] as unknown as TunableSpec).max;
  const repeatPct = (tunRec['areas.repeatHaulPct'] as unknown as TunableSpec).default;
  const worst = worstHauls(areas, repeatPct);
  for (const res of RAW_RESOURCES) {
    let cost = 0;
    for (const item of research) for (const lv of item.levels) cost += Math.floor((lv[res] * costMax) / 100);
    if (worst[res] < cost) {
      fail(`total ${res} haul ${worst[res]} (every area at its worst position, areas.repeatHaulPct ${repeatPct}) is below the total research cost ${cost} (at research.costPct ${costMax})`);
    }
  }
  // H6 band locks: with the lock on by default, every band b ≥ 2 that has areas needs a relay in band b − 1, or it
  // could never open. Checked at the default, like the haul invariant (the tuning panel's live value is a dev experiment).
  if ((tunRec['overworld.bandLock'] as unknown as TunableSpec).default >= 1) {
    for (const a of areas) {
      if (a.tier >= 2 && !areas.some((x) => x.relay && x.tier === a.tier - 1)) {
        fail(`${a.id} is in band ${a.tier}, which overworld.bandLock keeps locked, but band ${a.tier - 1} has no relay to open it`);
      }
    }
  }
  parseRun(r.run, map.field, nodes as MapNode[], tunRec as Record<string, TunableSpec>);
  return raw as unknown as SimData;
}

/**
 * H7: `run` (optional; absent is a campaign) and `map.field` (required in field mode, checked whenever present):
 * every id a frame node, listed once, the probe first, the heart present, no Root; `mine` asteroids of the field
 * only; the layout in the area format with one entry per pocket present and no Root or starved counts. In field
 * mode, at the defaults: ship.hauler.cargo ≤ node.bufferCap (a full buffer always fills a hauler) and
 * economy.probeOrePerMin ≥ 1 (the softlock floor).
 */
function parseRun(run: unknown, field: unknown, frame: readonly MapNode[], tun: Record<string, TunableSpec>): void {
  let mode: RunMode = 'campaign';
  if (run !== undefined) {
    if (!isObj(run) || !(RUN_MODES as readonly unknown[]).includes(run.mode)) fail(`run.mode must be one of ${RUN_MODES.join(', ')}`);
    for (const k of Object.keys(run)) if (k !== 'mode') fail(`run.${k} is not a run setting`);
    mode = run.mode as RunMode;
  }
  if (field === undefined) {
    if (mode === 'field') fail('run.mode is "field" but map.field is missing');
    return;
  }
  const at = 'map.field';
  if (!isObj(field)) fail(`${at} must be an object`);
  const kindOf = new Map(frame.map((n) => [n.id, n.kind]));
  if (!Array.isArray(field.nodes) || field.nodes.length < 1) fail(`${at}.nodes missing`);
  const present: string[] = [];
  for (const id of field.nodes as unknown[]) {
    if (typeof id !== 'string' || !kindOf.has(id)) fail(`${at}.nodes: ${String(id)} is not a frame node id`);
    if (present.includes(id)) fail(`${at}.nodes: ${id} is listed twice`);
    if (kindOf.get(id) === 'root') fail(`${at}.nodes: the field has no Root (${id})`);
    present.push(id);
  }
  if (present[0] !== frame[0]!.id) fail(`${at}.nodes must start with the probe`);
  if (!present.some((id) => kindOf.get(id) === 'heart')) fail(`${at}.nodes must include the heart (the hive)`);
  if (!Array.isArray(field.mine)) fail(`${at}.mine missing`);
  const mine: string[] = [];
  for (const id of field.mine as unknown[]) {
    if (typeof id !== 'string' || !present.includes(id)) fail(`${at}.mine: ${String(id)} is not a node of the field`);
    if (kindOf.get(id) !== 'asteroid') fail(`${at}.mine: ${id} is not an asteroid (pockets and the hive are marked at capture)`);
    if (mine.includes(id)) fail(`${at}.mine: ${id} is listed twice`);
    mine.push(id);
  }
  const l = field.layout;
  if (!isObj(l)) fail(`${at}.layout missing`);
  if (!isObj(l.pockets)) fail(`${at}.layout.pockets missing`);
  const pocketsHere = present.filter((id) => kindOf.get(id) === 'pocket');
  for (const k of Object.keys(l.pockets)) if (!pocketsHere.includes(k)) fail(`${at}.layout.pockets.${k} is not a pocket node of the field`);
  for (const id of pocketsHere) {
    const p = l.pockets[id];
    if (!isObj(p)) fail(`${at}.layout.pockets.${id} missing`);
    if (p.prize !== 'ice' && p.prize !== 'crystal') fail(`${at}.layout.pockets.${id}.prize must be ice or crystal`);
    if (!isInt(p.slots) || p.slots < 0) fail(`${at}.layout.pockets.${id}.slots must be a non-negative integer`);
    checkCount(p.thorns, `${at}.layout.pockets.${id}.thorns`);
    checkCount(p.spores, `${at}.layout.pockets.${id}.spores`);
  }
  if (l.root !== undefined) fail(`${at}.layout.root given, but the field has no Root`);
  if (!isObj(l.heart)) fail(`${at}.layout.heart missing`);
  checkCount(l.heart.thorns, `${at}.layout.heart.thorns`);
  checkCount(l.heart.spores, `${at}.layout.heart.spores`);
  for (const f of ['starvedThorns', 'starvedSpores'] as const) {
    if (l.heart[f] !== undefined) fail(`${at}.layout.heart.${f} given, but the field has no Root to starve it`);
  }
  if (mode !== 'field') return;
  const cargo = tun['ship.hauler.cargo']!.default;
  const cap = tun['node.bufferCap']!.default;
  if (cargo > cap) fail(`field mode: ship.hauler.cargo ${cargo} is above node.bufferCap ${cap}, so a full buffer could never fill a hauler`);
  if (tun['economy.probeOrePerMin']!.default < 1) fail('field mode: economy.probeOrePerMin must be at least 1 (the softlock floor)');
}

/** True if two areas share a repeat-haul group: the same tier (band) and the same side, which isn't `none`. */
export function sameHaulGroup(a: Readonly<MapArea>, b: Readonly<MapArea>): boolean {
  return a.side !== 'none' && a.tier === b.tier && a.side === b.side;
}

/** A haul decayed as a repeat: floor(haul × pct / 100) per resource. */
export function decayedHaul(haul: Readonly<ResourceTriple>, pct: number): ResourceTriple {
  return { ore: Math.floor((haul.ore * pct) / 100), ice: Math.floor((haul.ice * pct) / 100), crystal: Math.floor((haul.crystal * pct) / 100) };
}

/**
 * The H6 haul invariant's left side: Σ over areas of the haul, with every area that has a group mate counted at
 * floor(haul × pct / 100) (each area at its worst position).
 */
export function worstHauls(areas: readonly MapArea[], pct: number): ResourceTriple {
  const sum: ResourceTriple = { ore: 0, ice: 0, crystal: 0 };
  for (const a of areas) {
    const repeat = areas.some((b) => b !== a && sameHaulGroup(a, b));
    const h = repeat ? decayedHaul(a.haul, pct) : a.haul;
    for (const res of RAW_RESOURCES) sum[res] += h[res];
  }
  return sum;
}

function checkTriple(v: unknown, where: string): void {
  if (!isObj(v)) fail(`${where} missing`);
  for (const k of Object.keys(v)) if (!(RAW_RESOURCES as readonly string[]).includes(k)) fail(`${where}.${k} is not a resource`);
  for (const res of RAW_RESOURCES) if (!isInt(v[res]) || v[res] < 0) fail(`${where}.${res} must be a non-negative integer`);
}

/** Validates map.areas against the frame; returns the area ids in data order. */
function parseAreas(raw: unknown, frame: readonly MapNode[]): string[] {
  if (!Array.isArray(raw) || raw.length < 1) fail('map.areas missing');
  const frameIds = frame.map((n) => n.id);
  const kindOf = new Map(frame.map((n) => [n.id, n.kind]));
  const ids: string[] = [];
  let starts = 0;
  let seeds = 0;
  raw.forEach((a: unknown, i: number) => {
    const at = `map.areas[${i}]`;
    if (!isObj(a)) fail(`${at} not an object`);
    if (typeof a.id !== 'string' || a.id === '' || ids.includes(a.id)) fail(`${at} needs a unique string id`);
    ids.push(a.id);
    if (typeof a.name !== 'string' || a.name === '') fail(`${at} needs a name`);
    if (!isInt(a.tier) || a.tier < 0 || a.tier > 3) fail(`${at}.tier must be an integer 0..3`);
    if (a.tier === 0) starts++;
    if (typeof a.side !== 'string' || !(AREA_SIDES as readonly string[]).includes(a.side)) fail(`${at}.side must be one of ${AREA_SIDES.join(', ')}`);
    if (typeof a.relay !== 'boolean') fail(`${at}.relay must be true or false`);
    if (a.relay && !RELAY_TIERS.includes(a.tier as number)) fail(`${at} is a relay in tier ${String(a.tier)}: relays stand in tiers ${RELAY_TIERS.join('–')} only`);
    for (const f of ['x', 'y'] as const) if (!isInt(a[f]) || a[f] < 0) fail(`${at}.${f} must be a non-negative integer`);
    if ((a.x as number) > OVERWORLD_FRAME.width || (a.y as number) > OVERWORLD_FRAME.height) {
      fail(`${at} at (${String(a.x)}, ${String(a.y)}) is outside the overworld frame ${OVERWORLD_FRAME.width} × ${OVERWORLD_FRAME.height}`);
    }
    if (!Array.isArray(a.nodes) || a.nodes.length < 1) fail(`${at}.nodes missing`);
    const present: string[] = [];
    for (const id of a.nodes as unknown[]) {
      if (typeof id !== 'string' || !frameIds.includes(id)) fail(`${at}.nodes: ${String(id)} is not a frame node id`);
      if (present.includes(id)) fail(`${at}.nodes: ${id} is listed twice`);
      present.push(id);
    }
    if (!present.includes(frameIds[0]!)) fail(`${at}.nodes must include the probe`);
    const heartId = frame.find((n) => n.kind === 'heart')!.id;
    if (!present.includes(heartId)) fail(`${at}.nodes must include the heart`);
    for (const rig of RIG_NODES) if (!present.includes(rig)) fail(`${at}.nodes must include the seed-rig node ${rig}`);
    checkTriple(a.haul, `${at}.haul`);
    checkTriple(a.export, `${at}.export`);
    const pocketsHere = present.filter((id) => kindOf.get(id) === 'pocket');
    const rootHere = present.some((id) => kindOf.get(id) === 'root');
    if (a.layout === 'seed') {
      seeds++;
      // The run's H3 layout covers every frame node; H6 lets The Deep leave out the Root (it is then fed for good, and
      // the layout's Root and starved counts are never read).
      const missing = frameIds.filter((id) => !present.includes(id) && kindOf.get(id) !== 'root');
      if (missing.length > 0) fail(`${at} has layout "seed" (The Deep), so it must have every frame node but the Root (missing ${missing.join(', ')})`);
      return;
    }
    const l = a.layout;
    if (!isObj(l)) fail(`${at}.layout must be "seed" or an object`);
    if (!isObj(l.pockets)) fail(`${at}.layout.pockets missing`);
    const pockets = l.pockets;
    for (const k of Object.keys(pockets)) if (!pocketsHere.includes(k)) fail(`${at}.layout.pockets.${k} is not a pocket node in this area`);
    for (const id of pocketsHere) {
      const p = pockets[id];
      if (!isObj(p)) fail(`${at}.layout.pockets.${id} missing`);
      if (p.prize !== 'ice' && p.prize !== 'crystal') fail(`${at}.layout.pockets.${id}.prize must be ice or crystal`);
      if (!isInt(p.slots) || p.slots < 0) fail(`${at}.layout.pockets.${id}.slots must be a non-negative integer`);
      checkCount(p.thorns, `${at}.layout.pockets.${id}.thorns`);
      checkCount(p.spores, `${at}.layout.pockets.${id}.spores`);
    }
    if (rootHere) {
      if (!isObj(l.root)) fail(`${at}.layout.root missing (the Root is present)`);
      checkCount(l.root.thorns, `${at}.layout.root.thorns`);
      checkCount(l.root.spores, `${at}.layout.root.spores`);
    } else if (l.root !== undefined) fail(`${at}.layout.root given, but the Root is not present`);
    if (!isObj(l.heart)) fail(`${at}.layout.heart missing`);
    checkCount(l.heart.thorns, `${at}.layout.heart.thorns`);
    checkCount(l.heart.spores, `${at}.layout.heart.spores`);
    for (const f of ['starvedThorns', 'starvedSpores'] as const) {
      if (rootHere) checkCount(l.heart[f], `${at}.layout.heart.${f}`);
      else if (l.heart[f] !== undefined) fail(`${at}.layout.heart.${f} given, but the area has no Root to starve it`);
    }
  });
  if (starts !== 1) fail('map.areas needs exactly one tier-0 area (the start, open from the beginning)');
  if (seeds !== 1) fail('map.areas needs exactly one area with layout "seed" (The Deep)');
  return ids;
}

function parseLanes(raw: unknown, areaIds: readonly string[]): void {
  if (!Array.isArray(raw)) fail('map.lanes missing');
  const seen: string[] = [];
  raw.forEach((l: unknown, i: number) => {
    if (!Array.isArray(l) || l.length !== 2) fail(`map.lanes[${i}] must be a pair of area ids`);
    const [a, b] = l as unknown[];
    if (typeof a !== 'string' || !areaIds.includes(a)) fail(`map.lanes[${i}]: ${String(a)} is not an area`);
    if (typeof b !== 'string' || !areaIds.includes(b)) fail(`map.lanes[${i}]: ${String(b)} is not an area`);
    if (a === b) fail(`map.lanes[${i}] joins an area to itself`);
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.includes(key)) fail(`map.lanes[${i}] repeats a lane`);
    seen.push(key);
  });
}


function parseResearch(raw: unknown, areas: readonly MapArea[]): ResearchItem[] {
  const areaIds = areas.map((a) => a.id);
  if (!Array.isArray(raw)) fail('research missing');
  const ids: string[] = [];
  let wins = 0;
  raw.forEach((it: unknown, i: number) => {
    const at = `research[${i}]`;
    if (!isObj(it)) fail(`${at} not an object`);
    if (typeof it.id !== 'string' || !(RESEARCH_IDS as readonly string[]).includes(it.id)) fail(`${at}.id must be one of ${RESEARCH_IDS.join(', ')}`);
    if ((REMOVED_RESEARCH_IDS as readonly string[]).includes(it.id)) fail(`${at}: ${it.id} (Command limit) was removed at H6: command relays raise the fleet limit`);
    if (ids.includes(it.id)) fail(`${at}.id ${it.id} is repeated`);
    ids.push(it.id);
    if (typeof it.name !== 'string' || it.name === '') fail(`${at} needs a name`);
    if (it.kind !== 'design' && it.kind !== 'grind' && it.kind !== 'win') fail(`${at}.kind must be design, grind or win`);
    if (it.kind === 'win') wins++;
    if (!Array.isArray(it.levels) || it.levels.length < 1) fail(`${at}.levels missing`);
    (it.levels as unknown[]).forEach((lv, k) => checkTriple(lv, `${at}.levels[${k}]`));
    if ((it.id === 'lancer' || it.id === 'flak' || it.id === 'core') && it.levels.length !== 1) fail(`${at} (${it.id}) has exactly one level`);
    if (it.id === 'rigs' && it.levels.length > RIG_NODES.length) fail(`${at} (rigs) has at most ${RIG_NODES.length} levels`);
    if (!Array.isArray(it.requires)) fail(`${at}.requires missing`);
  });
  for (const id of RESEARCH_IDS) if (!ids.includes(id) && !REMOVED_RESEARCH_IDS.includes(id)) fail(`research item ${id} missing`);
  if (wins !== 1) fail('research needs exactly one win item');
  const items = raw as ResearchItem[];
  const tiers = areas.map((a) => a.tier);
  items.forEach((it, i) => {
    it.requires.forEach((q: unknown, k) => {
      const at = `research[${i}].requires[${k}]`;
      if (!isObj(q)) fail(`${at} not an object`);
      if (q.atLevel !== undefined && (!isInt(q.atLevel) || q.atLevel < 1 || q.atLevel > it.levels.length)) fail(`${at}.atLevel must be 1..${it.levels.length}`);
      if ('tier' in q) {
        // H5: at least `count` reclaimed areas of tier ≥ `tier`.
        if (!isInt(q.tier) || !tiers.includes(q.tier)) fail(`${at}.tier must be one of the area tiers (${[...new Set(tiers)].sort().join(', ')})`);
        const available = tiers.filter((t) => t >= (q.tier as number)).length;
        if (!isInt(q.count) || q.count < 1 || q.count > available) fail(`${at}.count must be 1..${available} (areas of tier >= ${q.tier})`);
        return;
      }
      if ('area' in q) {
        if (typeof q.area !== 'string' || !areaIds.includes(q.area)) fail(`${at}: ${String(q.area)} is not an area`);
        return;
      }
      const target = items.find((x) => x.id === q.item);
      if (target === undefined || q.item === it.id) fail(`${at}: ${String(q.item)} is not another research item`);
      if (!isInt(q.level) || q.level < 1 || q.level > target.levels.length) fail(`${at}.level must be 1..${target.levels.length}`);
    });
  });
  return items;
}

/** Tunable metadata in display order, from the given data. */
export function tunableMeta(data: SimData): TunableMeta[] {
  return TUNABLE_KEYS.map((key) => {
    const spec = data.tunables[key];
    const scope = key.startsWith('client.') ? 'client' : 'sim';
    return {
      key,
      section: key.slice(0, key.indexOf('.')),
      default: spec.default,
      min: spec.min,
      max: spec.max,
      live: !key.startsWith('stats.'),
      scope,
      newRunOnly: NEW_RUN_ONLY.has(key),
    };
  });
}

/** True if `setTunable` may change this key: a sim tunable that isn't fixed. */
export function isSimTunableKey(key: unknown): key is SimTunableKey {
  return typeof key === 'string' && (SIM_TUNABLE_KEYS as readonly string[]).includes(key);
}
