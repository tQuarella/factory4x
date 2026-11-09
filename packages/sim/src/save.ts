import { RAW_RESOURCES, RESOURCES, SHIP_TYPES, SIM_TUNABLE_KEYS, YARD_ROTATION, type SimData } from './data.ts';
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
  // The area fields hold the active area's nodes and guardians, or nothing on the overworld.
  const area = camp.active === null ? null : data.map.areas[camp.active as number]!;
  const nodeCount = area === null ? 0 : area.nodes.length;
  const guarded = area === null ? 0 : data.map.nodes.filter((n) => area.nodes.includes(n.id) && (n.kind === 'pocket' || n.kind === 'root' || n.kind === 'heart')).length;
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
