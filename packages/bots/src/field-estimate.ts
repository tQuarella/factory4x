import {
  BUILD_TYPES,
  createWorld,
  countGuards,
  fnv1a,
  guardCaps,
  guardianAt,
  heartIndex,
  type GuardCounts,
  type ShipType,
  type ShipTypeCounts,
  type SimData,
  type World,
} from '@factory4x/sim';
import { minMix, minSingle, waveWins } from './waves.ts';

/**
 * The field's min-wave estimate (DESIGN.md H7 "Bots (H7): strategies": "no pre-send battle simulation beyond the
 * existing `min-wave` estimate"). It is the same estimate the H6 bots use (waves.ts minMix / minSingle): the
 * smallest simultaneous wave that takes a guarded node from full strength, from the real sim rules, on a copy of
 * the field in which nothing else happens (no raids, no economy, every weight 0). The one field-mode addition is
 * `counts`: the guards left at home at the node (the hive with a raid out, flag 4), kept as the lowest ids of each
 * type.
 */

/** The inert field the estimate fights in: this world's live tunables, no income, no raids, nothing building. */
export function inertField(world: Readonly<World>, data: SimData): { data: SimData; world: World } {
  const liveData = { ...data, tunables: Object.fromEntries(Object.entries(data.tunables).map(([k, v]) => [k, { ...v, default: world.tun[k as keyof typeof world.tun] }])) } as unknown as SimData;
  const w = createWorld(1, liveData);
  w.tun['raid.enabled'] = 0;
  w.tun['economy.probeOrePerMin'] = 0;
  w.stock.ore = 0;
  const f = w.field!;
  for (const t of BUILD_TYPES) {
    f.alloc[t] = 0;
    f.share[t] = 0;
  }
  f.mine = f.mine.map(() => false);
  f.econ = [];
  return { data: liveData, world: w };
}

const cache = new Map<string, { data: SimData; world: World }>();
const mixCache = new Map<string, { total: number; fleet: ShipTypeCounts } | null>();
const singleCache = new Map<string, number | null>();

const tunKey = (world: Readonly<World>, data: SimData): string => `${data.dataVersion}|${fnv1a(JSON.stringify(data.map.field))}|${fnv1a(JSON.stringify(world.tun))}`;

/** The inert field, with `node`'s guards cut to `counts` when given (the lowest ids of each type stay). Cached per tunables. */
function baseFor(world: Readonly<World>, data: SimData, node: number, counts: Readonly<GuardCounts> | null): { data: SimData; world: World } {
  const key = tunKey(world, data);
  let b = cache.get(key);
  if (b === undefined) {
    b = inertField(world, data);
    if (cache.size > 16) cache.clear();
    cache.set(key, b);
  }
  if (counts === null) return b;
  const w = JSON.parse(JSON.stringify(b.world)) as World;
  const g = guardianAt(w, node)!;
  const left: GuardCounts = { thorn: counts.thorn, spore: counts.spore };
  g.guards = g.guards.filter((x) => left[x.type]-- > 0);
  return { data: b.data, world: w };
}

const guardKey = (c: Readonly<GuardCounts> | null): string => (c === null ? 'full' : `${c.thorn}t${c.spore}s`);

/** A node's guards at home right now, by type (what a wave sent now would fight). */
export function guardsAtHome(world: Readonly<World>, node: number): GuardCounts {
  return countGuards(guardianAt(world, node)!);
}

/** A node's guard caps by type under this world's tunables (the full-strength guard counts). */
export function guardFull(world: Readonly<World>, node: number): GuardCounts {
  return guardCaps(world, guardianAt(world, node)!);
}

/** The smallest winning mix of `types` for `node` against `counts` (null: full strength), at most `upTo` ships; null if none wins. */
export function fieldMix(world: Readonly<World>, data: SimData, node: number, types: readonly ShipType[], upTo: number, counts: Readonly<GuardCounts> | null = null): { total: number; fleet: ShipTypeCounts } | null {
  if (upTo < 1) return null;
  const key = `${tunKey(world, data)}|${node}|${guardKey(counts)}|${types.join(',')}|${upTo}`;
  if (mixCache.has(key)) {
    const hit = mixCache.get(key)!;
    return hit === null ? null : { total: hit.total, fleet: { ...hit.fleet } };
  }
  const b = baseFor(world, data, node, counts);
  const m = minMix(b.world, node, types, upTo, b.data);
  if (mixCache.size > 4000) mixCache.clear();
  mixCache.set(key, m === null ? null : { total: m.total, fleet: { ...m.fleet } });
  return m === null ? null : { total: m.total, fleet: { ...m.fleet } };
}

/** The smallest single-type wave that takes `node` (at most `upTo` ships), or null. */
export function fieldSingle(world: Readonly<World>, data: SimData, node: number, type: ShipType, upTo: number, counts: Readonly<GuardCounts> | null = null): number | null {
  const key = `${tunKey(world, data)}|${node}|${guardKey(counts)}|${type}|${upTo}`;
  if (singleCache.has(key)) return singleCache.get(key)!;
  const b = baseFor(world, data, node, counts);
  const n = minSingle(b.world, node, type, b.data, upTo);
  if (singleCache.size > 4000) singleCache.clear();
  singleCache.set(key, n);
  return n;
}

/** True if exactly `fleet` arriving together takes `node`. */
export function fieldWins(world: Readonly<World>, data: SimData, node: number, fleet: Readonly<ShipTypeCounts>, counts: Readonly<GuardCounts> | null = null): boolean {
  const b = baseFor(world, data, node, counts);
  return waveWins(b.world, node, fleet, b.data);
}

/**
 * The hive's guards at home after a raid of the largest size R4 allows from a hive at full strength
 * (`size = min(raid.maxSize, total - keep)`, mixed like the hive): what flag 4 and the bots' "ready for the raid
 * window" plan fight. Integer arithmetic only, as R4.
 */
export function fullRaidAwayCounts(world: Readonly<World>, node: number): { home: GuardCounts; raid: GuardCounts } {
  const full = guardFull(world, node);
  const total = full.thorn + full.spore;
  const keep = Math.ceil((total * world.tun['raid.hiveKeepPct']) / 100);
  const size = Math.min(world.tun['raid.maxSize'], Math.max(0, total - keep));
  const thorn = total === 0 ? 0 : Math.floor((size * full.thorn) / total);
  const spore = size - thorn;
  return { home: { thorn: full.thorn - thorn, spore: full.spore - spore }, raid: { thorn, spore } };
}

/** The hive's node index. */
export const hiveNode = (world: Readonly<World>): number => heartIndex(world);
