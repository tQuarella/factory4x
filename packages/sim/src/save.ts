import { SIM_TUNABLE_KEYS, type SimData } from './data.ts';
import type { World } from './world.ts';

/**
 * Autosave format: a JSON envelope around the plain world. The world is
 * already plain data, so a save is exact: deserialize(serialize(w)) hashes
 * identically to w.
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
  const wellFormed =
    w.dataVersion === data.dataVersion &&
    isInt(w.tick) &&
    isInt(w.stock) &&
    Array.isArray(w.nodes) &&
    w.nodes.length === data.map.nodes.length &&
    Array.isArray(w.routes) &&
    Array.isArray(w.ships) &&
    Array.isArray(w.queue) &&
    w.guardian !== null &&
    typeof w.guardian === 'object' &&
    w.stats !== null &&
    typeof w.stats === 'object' &&
    tun !== null &&
    typeof tun === 'object' &&
    SIM_TUNABLE_KEYS.every((k) => isInt(tun[k]));
  if (!wellFormed) return { ok: false, reason: 'corrupt', saveDataVersion };
  return { ok: true, world: w as unknown as World };
}
