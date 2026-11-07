/**
 * Data schema for data/sim.json: tunables (keyed by their dotted name, each
 * with default/min/max) and the fixed map. `parseSimData` validates a raw
 * JSON value against the schema, so bad data fails loudly at load time rather
 * than as a desync later.
 */

/** Every tunable in DESIGN.md H1 and H2 "Tunables", in display order. The order is fixed and is the only order the sim iterates in. */
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
  'ship.cost',
  'ship.buildTicks',
  'ship.hp',
  'ship.damage',
  'ship.speedSu',
  'guardian.cap',
  'guardian.thornHp',
  'guardian.thornDamage',
  'guardian.regrowTicks',
  'guardian.repairPerRound',
  'root.capBonus',
  'root.regrowTicks',
  'bloom.starvedCap',
  'bloom.starvedRegrowTicks',
  'bloom.starvedRepairPerRound',
  'combat.roundTicks',
  'rich.orePerMin',
  'rich.freeExtractors',
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

export type NodeKind = 'probe' | 'asteroid' | 'rich' | 'root';

export interface MapNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  r: number;
  slots: number;
}

/**
 * One hand-made system (DESIGN.md H2 "Map variation"). Variants differ only in
 * the Root: its position and its base thorn cap.
 */
export interface MapVariant {
  id: string;
  /** Player-facing system name ("Thin Root"). */
  name: string;
  x: number;
  y: number;
  /** Base Root thorn cap; the effective cap is clamp(rootCap + root.capBonus, 0, ROOT_CAP_MAX). */
  rootCap: number;
}

export interface SimData {
  dataVersion: number;
  tickRate: number;
  tunables: Record<TunableKey, TunableSpec>;
  /** `nodes`: the fixed map; the Root's x/y there are a placeholder overridden by the chosen variant. */
  map: { nodes: MapNode[]; variants: MapVariant[] };
}

/** Tunable metadata for the tuning panel. */
export interface TunableMeta {
  key: TunableKey;
  /** The part before the dot, for grouping ("ship"). */
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

/** The Root's effective thorn cap is clamped to 0..ROOT_CAP_MAX (DESIGN.md H2, "Effective parameters"). */
export const ROOT_CAP_MAX = 40;

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function fail(msg: string): never {
  throw new Error(`Invalid sim data: ${msg}`);
}

/** Validates raw JSON (data/sim.json or a replay's data) and returns it typed. Throws on any schema error. */
export function parseSimData(raw: unknown): SimData {
  if (raw === null || typeof raw !== 'object') fail('not an object');
  const r = raw as Record<string, unknown>;
  if (!isInt(r.dataVersion) || r.dataVersion < 1) fail('dataVersion must be a positive integer');
  if (!isInt(r.tickRate) || r.tickRate < 1) fail('tickRate must be a positive integer');
  const tun = r.tunables;
  if (tun === null || typeof tun !== 'object') fail('tunables missing');
  const tunRec = tun as Record<string, unknown>;
  const known = new Set<string>(TUNABLE_KEYS);
  for (const k of Object.keys(tunRec)) if (!known.has(k)) fail(`unknown tunable ${k}`);
  for (const k of TUNABLE_KEYS) {
    const spec = tunRec[k] as Record<string, unknown> | undefined;
    if (!spec || typeof spec !== 'object') fail(`tunable ${k} missing`);
    const { default: d, min, max } = spec;
    if (!isInt(d) || !isInt(min) || !isInt(max)) fail(`tunable ${k} needs integer default/min/max`);
    if (min > max || d < min || d > max) fail(`tunable ${k} default ${d} outside ${min}..${max}`);
  }
  const map = r.map as Record<string, unknown> | undefined;
  if (!map || !Array.isArray(map.nodes)) fail('map.nodes missing');
  const nodes = map.nodes as unknown[];
  const ids = new Set<string>();
  let probes = 0;
  let riches = 0;
  let roots = 0;
  nodes.forEach((n, i) => {
    const node = n as Record<string, unknown>;
    if (!node || typeof node !== 'object') fail(`map.nodes[${i}] not an object`);
    if (typeof node.id !== 'string' || ids.has(node.id)) fail(`map.nodes[${i}] needs a unique string id`);
    ids.add(node.id);
    if (node.kind !== 'probe' && node.kind !== 'asteroid' && node.kind !== 'rich' && node.kind !== 'root') fail(`map.nodes[${i}] bad kind`);
    for (const f of ['x', 'y', 'r', 'slots'] as const) {
      if (!isInt(node[f]) || (node[f] as number) < 0) fail(`map.nodes[${i}].${f} must be a non-negative integer`);
    }
    if (node.kind === 'probe') probes++;
    if (node.kind === 'rich') riches++;
    if (node.kind === 'root') roots++;
  });
  if (probes !== 1 || (nodes[0] as Record<string, unknown>).kind !== 'probe') fail('exactly one probe, at index 0');
  if (riches !== 1) fail('exactly one rich node');
  if (roots !== 1) fail('exactly one root node');
  if (!Array.isArray(map.variants) || map.variants.length < 1) fail('map.variants missing');
  const variants = map.variants as unknown[];
  const variantIds = new Set<string>();
  variants.forEach((v, i) => {
    const variant = v as Record<string, unknown>;
    if (!variant || typeof variant !== 'object') fail(`map.variants[${i}] not an object`);
    if (typeof variant.id !== 'string' || variantIds.has(variant.id)) fail(`map.variants[${i}] needs a unique string id`);
    variantIds.add(variant.id);
    if (typeof variant.name !== 'string' || variant.name === '') fail(`map.variants[${i}] needs a name`);
    for (const f of ['x', 'y', 'rootCap'] as const) {
      if (!isInt(variant[f]) || (variant[f] as number) < 0) fail(`map.variants[${i}].${f} must be a non-negative integer`);
    }
    if ((variant.rootCap as number) > ROOT_CAP_MAX) fail(`map.variants[${i}].rootCap above ${ROOT_CAP_MAX}`);
  });
  // system.variant: 0 = by seed, k = variant k − 1, so its range must stay inside the table.
  const forced = (tunRec['system.variant'] as TunableSpec).max;
  if ((tunRec['system.variant'] as TunableSpec).min !== 0 || forced > variants.length) {
    fail(`system.variant range must be 0..${variants.length} or narrower`);
  }
  return raw as SimData;
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
