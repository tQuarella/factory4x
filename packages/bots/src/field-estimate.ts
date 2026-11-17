import {
  BUILD_TYPES,
  createWorld,
  countGuards,
  fnv1a,
  guardCaps,
  raidMix,
  raidSize,
  guardianAt,
  heartIndex,
  hiveAfter,
  nodeDistance,
  type GuardCounts,
  type ShipType,
  type ShipTypeCounts,
  type SimData,
  type World,
} from '@factory4x/sim';
import { minMix, minSingle, waveTicks, waveWins, type WinsFn } from './waves.ts';

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

let lastKey: { world: Readonly<World>; data: SimData; tick: number; names: string[]; values: number[]; key: string } | null = null;

/**
 * The cache key for a world's tunables and the field map, remembered for a world and tick and re-checked against a
 * snapshot of every tunable value (an integer compare per tunable, far cheaper than hashing them: the strategies
 * ask several times a tick, and hashing each time was a tenth of the bots gate). The map hash is recomputed once
 * per tick, so a map changed in place shows by the next tick.
 */
const tunKey = (world: Readonly<World>, data: SimData): string => {
  const tun = world.tun as unknown as Record<string, number>;
  const last = lastKey;
  if (last !== null && last.world === world && last.data === data && last.tick === world.tick) {
    // Tunables can be tuned in place without a step (tests, the probe scripts), so reuse the key only while every value is the one it was made from.
    let i = 0;
    let same = true;
    for (const name in tun) {
      if (name !== last.names[i] || tun[name] !== last.values[i]) {
        same = false;
        break;
      }
      i++;
    }
    if (same && i === last.names.length) return last.key;
  }
  const names = Object.keys(tun);
  const fh = fnv1a(JSON.stringify(data.map.field));
  const key = `${data.dataVersion}|${fh}|${fnv1a(JSON.stringify(world.tun))}`;
  lastKey = { world, data, tick: world.tick, names, values: names.map((n) => tun[n]!), key };
  return key;
};

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

const winsMemo = new Map<string, Map<number, boolean>>();

/**
 * `waveWins` remembered per base (tunables, node, guards at home) and fleet. The searches for different type sets
 * and limits on one base test many of the same fleets; a battle's result depends only on the base and the fleet,
 * so sharing them changes no answer. The memo is dropped whole when it grows large.
 */
function winsFor(world: Readonly<World>, data: SimData, node: number, counts: Readonly<GuardCounts> | null): WinsFn {
  const baseKey = `${tunKey(world, data)}|${node}|${guardKey(counts)}`;
  let memo = winsMemo.get(baseKey);
  if (memo === undefined) {
    if (winsMemo.size > 64) winsMemo.clear();
    memo = new Map();
    winsMemo.set(baseKey, memo);
  }
  const m = memo;
  return (base, n, fleet, d) => {
    const k = (fleet.drone * 1024 + fleet.lancer) * 1024 + fleet.flak;
    const hit = m.get(k);
    if (hit !== undefined) return hit;
    const r = waveWins(base, n, fleet, d);
    m.set(k, r);
    return r;
  };
}

/** A node's guards at home right now, by type (what a wave sent now would fight). */
export function guardsAtHome(world: Readonly<World>, node: number): GuardCounts {
  return countGuards(guardianAt(world, node)!);
}

/**
 * The guards a wave that flies from `from` to `node` finds there (H10 "Bots (H10)" change 1): at the hive, the hive's guards at home
 * after the flight (`hiveAfter`: the queue rebuilds one per `hive.rebuildTicks`), so a wave isn't short by the
 * guards rebuilt while it flies; anywhere else, the guards now (a pocket's rule 9 is unchanged by H10).
 */
export function guardsOnArrival(world: Readonly<World>, node: number, from: readonly number[]): GuardCounts {
  // At `hive.rebuildTicks` 0 the bots play H9: the hive is sized as it is (R9's timers are not read, so the decisions are the v16 ones).
  if (node !== heartIndex(world) || world.tun['hive.rebuildTicks'] === 0) return guardsAtHome(world, node);
  return hiveAfter(world, flightTicks(world, from, node));
}

/** The ticks a ship from the slowest of `from` needs to reach `node` (the latest arrival), the integer ceiling as the sim counts a flight. */
export function flightTicks(world: Readonly<World>, from: readonly number[], node: number): number {
  let t = 0;
  for (const n of from) t = Math.max(t, Math.floor((nodeDistance(world, n, node) + world.tun['ship.speedSu'] - 1) / world.tun['ship.speedSu']));
  return t;
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
  const m = minMix(b.world, node, types, upTo, b.data, winsFor(world, data, node, counts));
  if (mixCache.size > 4000) mixCache.clear();
  mixCache.set(key, m === null ? null : { total: m.total, fleet: { ...m.fleet } });
  return m === null ? null : { total: m.total, fleet: { ...m.fleet } };
}

/** The smallest single-type wave that takes `node` (at most `upTo` ships), or null. */
export function fieldSingle(world: Readonly<World>, data: SimData, node: number, type: ShipType, upTo: number, counts: Readonly<GuardCounts> | null = null): number | null {
  const key = `${tunKey(world, data)}|${node}|${guardKey(counts)}|${type}|${upTo}`;
  if (singleCache.has(key)) return singleCache.get(key)!;
  const b = baseFor(world, data, node, counts);
  const n = minSingle(b.world, node, type, b.data, upTo, winsFor(world, data, node, counts));
  if (singleCache.size > 4000) singleCache.clear();
  singleCache.set(key, n);
  return n;
}

/** True if exactly `fleet` arriving together takes `node`. */
export function fieldWins(world: Readonly<World>, data: SimData, node: number, fleet: Readonly<ShipTypeCounts>, counts: Readonly<GuardCounts> | null = null): boolean {
  const b = baseFor(world, data, node, counts);
  return waveWins(b.world, node, fleet, b.data);
}

const ticksCache = new Map<string, number | null>();

/**
 * How many ticks `fleet` arriving together needs to take `node` with `counts` guards at home (null: it loses), on the
 * inert field. A wave is exposed to a prong coming home for this long (H9).
 */
export function fieldBattleTicks(world: Readonly<World>, data: SimData, node: number, fleet: Readonly<ShipTypeCounts>, counts: Readonly<GuardCounts> | null = null): number | null {
  const key = `${tunKey(world, data)}|${node}|${guardKey(counts)}|${fleet.drone},${fleet.lancer},${fleet.flak}`;
  const hit = ticksCache.get(key);
  if (hit !== undefined) return hit;
  const b = baseFor(world, data, node, counts);
  const t = waveTicks(b.world, node, fleet, b.data);
  if (ticksCache.size > 4000) ticksCache.clear();
  ticksCache.set(key, t);
  return t;
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

/**
 * The hive's guards at home once the raid that `econ` economy ships would muster is out (R4: size from econ, the
 * tunables and the hive's guards alive; the mix follows the hive). What the bots plan the counter-attack window on.
 */
export function raidAwayAtEcon(world: Readonly<World>, node: number, econ: number): { home: GuardCounts; raid: GuardCounts } {
  const g = guardianAt(world, node)!;
  const alive = countGuards(g);
  const raid = raidMix(raidSize(world, econ, g), alive);
  return { home: { thorn: alive.thorn - raid.thorn, spore: alive.spore - raid.spore }, raid };
}

/** The hive's node index. */
export const hiveNode = (world: Readonly<World>): number => heartIndex(world);
