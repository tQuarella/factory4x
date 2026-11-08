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

/** Rule 5b (yards) and rule 7 (player damage) resolve ship types in this order, so a scarce component is never starved by drones. */
export const YARD_ORDER: readonly ShipType[] = ['lancer', 'flak', 'drone'];
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

/** Every tunable in DESIGN.md (H1 economy keys plus H3 "Tunables"), in display order. The order is fixed and is the only order the sim iterates in. */
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

export interface SimData {
  dataVersion: number;
  tickRate: number;
  tunables: Record<TunableKey, TunableSpec>;
  map: { nodes: MapNode[]; layouts: MapLayout[] };
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

/** Keys that are read only by `createWorld`. */
const NEW_RUN_ONLY: ReadonlySet<string> = new Set(['economy.startStock', 'system.variant']);

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
  return raw as unknown as SimData;
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
