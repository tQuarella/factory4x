import { BUILD_TYPES, ECON_TYPES, RAW_RESOURCES, RESOURCES, SHIP_TYPES, SIM_TUNABLE_KEYS, YARD_ROTATION, runMode, type SimData } from './data.ts';
import type { World } from './world.ts';

/**
 * Autosave format: a JSON envelope around the plain world (H4: the campaign
 * included). The world is already plain data, so a save is exact:
 * deserialize(serialize(w)) hashes identically to w. A save from another
 * dataVersion (an H3 save is v5) is refused before any shape check.
 */

const SAVE_FORMAT = 1;

export type LoadResult =
  | { ok: true; world: World }
  /** 'dataVersion': the save was made with other data (discard it and say so). 'corrupt': unreadable or not a save. */
  | { ok: false; reason: 'dataVersion' | 'corrupt'; saveDataVersion: number | null };

/** The world as a save string. */
export function serializeWorld(world: Readonly<World>): string {
  return JSON.stringify({ format: SAVE_FORMAT, dataVersion: world.dataVersion, world });
}

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

const isIntOrNull = (v: unknown): boolean => v === null || isInt(v);
const isTriple = (v: unknown): boolean => isObj(v) && RAW_RESOURCES.every((r) => isInt(v[r]));

/** The campaign's shape (H4): every field present, typed, and consistent with the data's areas and research. */
function campaignOk(c: unknown, data: SimData): c is Record<string, unknown> {
  if (!isObj(c)) return false;
  const n = data.map.areas.length;
  const totals = c.totals;
  const research = c.research;
  return (
    (c.active === null || (isInt(c.active) && c.active >= 0 && c.active < n)) &&
    isInt(c.areaStartTick) &&
    isInt(c.deepLayout) &&
    c.deepLayout >= 0 &&
    c.deepLayout < data.map.layouts.length &&
    Array.isArray(c.areas) &&
    c.areas.length === n &&
    c.areas.every(
      (a: unknown) =>
        isObj(a) &&
        isIntOrNull(a.reclaimedTick) &&
        isIntOrNull(a.reclaimPlayTicks) &&
        (a.haulPaid === null || isTriple(a.haulPaid)) &&
        ['entries', 'withdrawals', 'playTicks', 'shipsBuilt', 'shipsLost', 'shipsRecycled', 'oreRefunded'].every((k) => isInt(a[k])),
    ) &&
    Array.isArray(c.reclaimOrder) &&
    c.reclaimOrder.every((a: unknown) => isInt(a) && a >= 0 && a < n) &&
    isObj(research) &&
    data.research.every((it) => isInt(research[it.id]) && (research[it.id] as number) >= 0 && (research[it.id] as number) <= it.levels.length) &&
    Array.isArray(c.researchLog) &&
    c.researchLog.every((e: unknown) => isObj(e) && typeof e.item === 'string' && isInt(e.level) && isInt(e.tick)) &&
    isTriple(c.stockpile) &&
    isTriple(c.shipAccum) &&
    isObj(totals) &&
    isTriple(totals.hauled) &&
    isTriple(totals.shipped) &&
    isIntOrNull(c.wonTick)
  );
}

const isIntRecord = (v: unknown, keys: readonly string[]): boolean => isObj(v) && keys.every((k) => isInt(v[k]));

/** H7: `world.field` is null in a campaign save (nodes === null), else the field state with per-node arrays of that length. */
function fieldOk(f: unknown, nodes: number | null): boolean {
  if (nodes === null) return f === null;
  if (!isObj(f)) return false;
  const perNode = (v: unknown): boolean => Array.isArray(v) && v.length === nodes;
  const bays = f.bays;
  return (
    isIntRecord(f.alloc, BUILD_TYPES) &&
    isIntRecord(f.share, BUILD_TYPES) &&
    isIntRecord(f.allocCur, BUILD_TYPES) &&
    isObj(bays) &&
    ECON_TYPES.every((t) => isObj(bays[t]) && isInt(bays[t].ticksLeft)) &&
    Array.isArray(f.econ) &&
    f.econ.every((s: unknown) => econShipOk(s, nodes)) &&
    perNode(f.mine) &&
    (f.mine as unknown[]).every((m) => typeof m === 'boolean') &&
    perNode(f.free) &&
    (f.free as unknown[]).every((v) => isInt(v) && v >= 0) &&
    perNode(f.rockBuckets) &&
    (f.rockBuckets as unknown[]).every((ring) => Array.isArray(ring) && ring.length > 0 && ring.every((v: unknown) => isInt(v) && v >= 0)) &&
    perNode(f.haulerSet) &&
    (f.haulerSet as unknown[]).every((v) => v === null || (isInt(v) && v >= 0)) &&
    perNode(f.extractorSet) &&
    (f.extractorSet as unknown[]).every((v) => v === null || (isInt(v) && v >= 1))
  );
}

const isNodeIndex = (v: unknown, nodes: number): boolean => isInt(v) && v >= 0 && v < nodes;
const isNodeOrNull = (v: unknown, nodes: number): boolean => v === null || isNodeIndex(v, nodes);

/**
 * H7: one economy ship: integer id and hp, a known type, parked at a node (`at`, no transit) or in transit between
 * two nodes (`at` null), a node or null target, and a cargo that is 0 with no resource or positive with one.
 */
function econShipOk(s: unknown, nodes: number): boolean {
  if (!isObj(s) || !isInt(s.id) || !isInt(s.hp) || (s.type !== 'extractor' && s.type !== 'hauler')) return false;
  if (!isNodeOrNull(s.target, nodes) || !isInt(s.cargo) || s.cargo < 0) return false;
  if (s.cargo === 0 ? s.cargoRes !== null : !(RAW_RESOURCES as readonly unknown[]).includes(s.cargoRes)) return false;
  const tr = s.transit;
  if (tr === null) return isNodeIndex(s.at, nodes);
  return (
    s.at === null &&
    isObj(tr) &&
    isNodeIndex(tr.from, nodes) &&
    isNodeIndex(tr.to, nodes) &&
    isInt(tr.ticksLeft) &&
    isInt(tr.totalTicks) &&
    tr.ticksLeft >= 0 &&
    tr.ticksLeft <= tr.totalTicks
  );
}

const PRONG_PHASES: readonly unknown[] = ['muster', 'out', 'fight', 'home', 'done'];
const PRONG_OUTCOMES: readonly unknown[] = ['beaten', 'hit', 'turnedBack'];
const RESULT_OUTCOMES: readonly unknown[] = ['beaten', 'hit', 'turnedBack', 'withered'];

/** H9: a prong's counters (`lostEcon`, `lostShips`, `killed`) are integer records. */
function prongCountersOk(p: Record<string, unknown>): boolean {
  return isIntRecord(p.lostEcon, ECON_TYPES) && isIntRecord(p.lostShips, ['drone', 'lancer', 'flak']) && isIntRecord(p.killed, ['thorn', 'spore']);
}

/**
 * H9 W1-W6: one prong (prong 0 is the raid object itself, prongs 1 and up are `raid.others`): a known phase, an integer
 * target, the flight fields, a guard list and the counters, with an outcome only once it is done.
 */
function prongOk(p: unknown): boolean {
  return (
    isObj(p) &&
    PRONG_PHASES.includes(p.phase) &&
    isInt(p.target) &&
    p.target >= 0 &&
    Array.isArray(p.guards) &&
    isInt(p.ticksLeft) &&
    isInt(p.flightTicks) &&
    isInt(p.from) &&
    typeof p.retargeted === 'boolean' &&
    isIntRecord(p.planned, ['thorn', 'spore']) &&
    prongCountersOk(p) &&
    (p.phase === 'done' ? PRONG_OUTCOMES.includes(p.outcome) : p.outcome === undefined)
  );
}

/**
 * H7 R1: `world.raid` null or a well-formed raid (an integer id, prong 0's fields, and `others` absent or a non-empty
 * list of well-formed prongs), and `nextRaidTick` an integer. H9: each `lastRaid.prongs` entry has an integer target, a
 * known outcome and the counters, and there is at least one.
 */
function raidOk(raid: unknown, next: unknown, last: unknown): boolean {
  const live =
    raid === null ||
    (isObj(raid) &&
      isInt(raid.id) &&
      prongOk(raid) &&
      (raid.others === undefined || (Array.isArray(raid.others) && raid.others.length > 0 && raid.others.every(prongOk))));
  const result =
    last === null ||
    (isObj(last) &&
      typeof last.outcome === 'string' &&
      Array.isArray(last.prongs) &&
      last.prongs.length > 0 &&
      last.prongs.every((p: unknown) => isObj(p) && isInt(p.target) && RESULT_OUTCOMES.includes(p.outcome) && prongCountersOk(p)));
  return isInt(next) && live && result;
}

/** H7 F14: the stats additions (H9: `raidProngs`). */
function h7StatsOk(stats: unknown): boolean {
  if (!isObj(stats)) return false;
  return (
    ['econBuilt', 'econLost', 'econRecycled'].every((k) => isIntRecord(stats[k], ECON_TYPES)) &&
    isIntRecord(stats.raids, ['mustered', 'beaten', 'hit', 'turnedBack']) &&
    isIntRecord(stats.raidProngs, ['beaten', 'hit', 'turnedBack']) &&
    isInt(stats.allocChanges) &&
    isInt(stats.peakEcon)
  );
}

/** Restores a save made by `serializeWorld`. Refuses a save whose dataVersion differs from `data`, or one that isn't a well-formed save. */
export function deserializeWorld(text: string, data: SimData): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'corrupt', saveDataVersion: null };
  }
  if (parsed === null || typeof parsed !== 'object') return { ok: false, reason: 'corrupt', saveDataVersion: null };
  const env = parsed as Record<string, unknown>;
  const saveDataVersion = isInt(env.dataVersion) ? env.dataVersion : null;
  if (env.format !== SAVE_FORMAT || saveDataVersion === null) return { ok: false, reason: 'corrupt', saveDataVersion };
  if (saveDataVersion !== data.dataVersion) return { ok: false, reason: 'dataVersion', saveDataVersion };
  const w = env.world as Record<string, unknown> | null;
  if (w === null || typeof w !== 'object') return { ok: false, reason: 'corrupt', saveDataVersion };
  const tun = w.tun as Record<string, unknown> | null;
  const stock = w.stock as Record<string, unknown> | null;
  const yards = w.yards as Record<string, unknown> | null;
  const camp = w.campaign;
  if (!campaignOk(camp, data)) return { ok: false, reason: 'corrupt', saveDataVersion };
  // The area fields hold the active area's nodes and guardians, or nothing on the overworld. H7: a field-mode save
  // (the data's run mode) holds the field's nodes, with no area active.
  const fieldIds = runMode(data) === 'field' ? data.map.field!.nodes : null;
  if (fieldIds !== null && camp.active !== null) return { ok: false, reason: 'corrupt', saveDataVersion };
  const area = camp.active === null ? null : data.map.areas[camp.active as number]!;
  const ids = fieldIds ?? (area === null ? [] : area.nodes);
  const nodeCount = ids.length;
  const guarded = data.map.nodes.filter((n) => ids.includes(n.id) && (n.kind === 'pocket' || n.kind === 'root' || n.kind === 'heart')).length;
  if (!fieldOk(w.field, fieldIds === null ? null : nodeCount) || !raidOk(w.raid, w.nextRaidTick, w.lastRaid) || !h7StatsOk(w.stats)) {
    return { ok: false, reason: 'corrupt', saveDataVersion };
  }
  const wellFormed =
    w.dataVersion === data.dataVersion &&
    isInt(w.tick) &&
    stock !== null &&
    typeof stock === 'object' &&
    RESOURCES.every((r) => isInt(stock[r])) &&
    yards !== null &&
    typeof yards === 'object' &&
    SHIP_TYPES.every((t) => yards[t] !== null && typeof yards[t] === 'object') &&
    isInt(w.yardTurn) &&
    w.yardTurn >= 0 &&
    w.yardTurn < YARD_ROTATION.length &&
    w.assemblers !== null &&
    typeof w.assemblers === 'object' &&
    Array.isArray(w.nodes) &&
    w.nodes.length === nodeCount &&
    Array.isArray(w.routes) &&
    Array.isArray(w.ships) &&
    Array.isArray(w.queue) &&
    Array.isArray(w.guardians) &&
    w.guardians.length === guarded &&
    w.system !== null &&
    typeof w.system === 'object' &&
    w.stats !== null &&
    typeof w.stats === 'object' &&
    (w.stats as Record<string, unknown>).haulPaid !== undefined &&
    ((w.stats as Record<string, unknown>).haulPaid === null || isTriple((w.stats as Record<string, unknown>).haulPaid)) &&
    tun !== null &&
    typeof tun === 'object' &&
    SIM_TUNABLE_KEYS.every((k) => isInt(tun[k]));
  if (!wellFormed) return { ok: false, reason: 'corrupt', saveDataVersion };
  return { ok: true, world: w as unknown as World };
}
