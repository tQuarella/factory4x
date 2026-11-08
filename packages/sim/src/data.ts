/**
 * Data schema for data/sim.json: tunables (keyed by their dotted name, each
 * with default/min/max), the fixed 16-node map and the hand-made layouts
 * (DESIGN.md H3 "Counter web"). `parseSimData` validates a raw JSON value
 * against the schema, so bad data fails loudly at load time rather than as a
 * desync later.
 */

/** Ship types, in display order. The sim iterates them only in the fixed orders below. */
export const SHIP_TYPES = ['drone', 'lancer', 'flak'] as const;
export type ShipType = (typeof SHIP_TYPES)[number];

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

/** Every tunable in DESIGN.md (H1 economy keys, H3 "Tunables" and H4 "Tunables"), in display order. The order is fixed and is the only order the sim iterates in. */
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
  'research.opening.step',
  'research.extract.stepPct',
  'research.yards.stepPct',
  'research.costPct',
  'shipments.pct',
  'system.variant',
  'stats.throughputWindowSec',
  'client.autosaveSec',
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

/** One overworld area (DESIGN.md H4 "Areas"). */
export interface MapArea {
  id: string;
  name: string;
  /** 0 Landfall (the start, open from the beginning), 1 light, 2 medium, 3 The Deep. */
  tier: number;
  /** Overworld position (frame x 0–1000, y 0–1300). */
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

/** The research item ids the sim gives effects to (DESIGN.md H4 "Research"). */
export const RESEARCH_IDS = ['lancer', 'flak', 'opening', 'extract', 'rigs', 'yards', 'core'] as const;
export type ResearchId = (typeof RESEARCH_IDS)[number];

export type ResearchKind = 'design' | 'grind' | 'win';

/** A research requirement: another item at a level, or an area reclaimed. */
export type ResearchRequirement = { item: string; level: number } | { area: string };

/** One research item: a cost per level (before research.costPct), and requirements that hold for every level. */
export interface ResearchItem {
  id: ResearchId;
  name: string;
  kind: ResearchKind;
  levels: ResourceTriple[];
  requires: ResearchRequirement[];
}

/** Seed rigs (H4): rig level L gives the first L of these nodes a free extractor and route at landing. */
export const RIG_NODES: readonly string[] = ['a1', 'a2'];

export interface SimData {
  dataVersion: number;
  tickRate: number;
  tunables: Record<TunableKey, TunableSpec>;
  map: { nodes: MapNode[]; layouts: MapLayout[]; areas: MapArea[]; lanes: MapLane[] };
  research: ResearchItem[];
}

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
const NEW_RUN_ONLY: ReadonlySet<string> = new Set(['system.variant']);

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
  for (const k of ['counter.strongPct', 'counter.weakPct', 'guard.thorn.regrowTicks', 'guard.spore.regrowTicks', 'bloom.starvedRegrowMul', 'combat.roundTicks'] as const) {
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
  const research = parseResearch(r.research, areaIds);
  // No softlock (DESIGN.md H4 "Areas"): taking every area always pays for every research level, at the costPct maximum.
  const costMax = (tunRec['research.costPct'] as unknown as TunableSpec).max;
  const areas = map.areas as MapArea[];
  for (const res of RAW_RESOURCES) {
    let haul = 0;
    for (const a of areas) haul += a.haul[res];
    let cost = 0;
    for (const item of research) for (const lv of item.levels) cost += Math.floor((lv[res] * costMax) / 100);
    if (haul < cost) fail(`total ${res} haul ${haul} is below the total research cost ${cost} (at research.costPct ${costMax})`);
  }
  return raw as unknown as SimData;
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
    for (const f of ['x', 'y'] as const) if (!isInt(a[f]) || a[f] < 0) fail(`${at}.${f} must be a non-negative integer`);
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
      if (present.length !== frame.length) fail(`${at} has layout "seed" (The Deep), so it must have every frame node`);
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

function parseResearch(raw: unknown, areaIds: readonly string[]): ResearchItem[] {
  if (!Array.isArray(raw)) fail('research missing');
  const ids: string[] = [];
  let wins = 0;
  raw.forEach((it: unknown, i: number) => {
    const at = `research[${i}]`;
    if (!isObj(it)) fail(`${at} not an object`);
    if (typeof it.id !== 'string' || !(RESEARCH_IDS as readonly string[]).includes(it.id)) fail(`${at}.id must be one of ${RESEARCH_IDS.join(', ')}`);
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
  for (const id of RESEARCH_IDS) if (!ids.includes(id)) fail(`research item ${id} missing`);
  if (wins !== 1) fail('research needs exactly one win item');
  const items = raw as ResearchItem[];
  items.forEach((it, i) => {
    it.requires.forEach((q: unknown, k) => {
      const at = `research[${i}].requires[${k}]`;
      if (!isObj(q)) fail(`${at} not an object`);
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
