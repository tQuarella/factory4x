/**
 * Autosave and client settings, in localStorage. Every storage access is in
 * try/catch (private mode, quota, blocked storage all just mean "no save").
 *
 * Save layout (one slot, key `fvn.save`), JSON:
 *   { format: 2, seed, dataVersion, world: <serializeWorld text>,
 *     log: [{tick, input}...]   the full input log since tick 0,
 *     pending: [input...]       inputs sent but not yet stepped,
 *     history: [ore/min...]     sparkline samples, flags: {...} }
 * The seed and the whole log are saved next to the world, so after a resume
 * `session.replay()` still reproduces the live state hash and a feedback note
 * sent after a resume carries a replay of the entire session.
 */
import { deserializeWorld, serializeWorld, type Input, type SimData } from '@factory4x/sim';
import { Session, type LoggedInput, type RunFlags } from './session.ts';

export const SAVE_KEY = 'fvn.save';
export const SETTINGS_KEY = 'fvn.settings';
const SAVE_FORMAT = 2;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export type LoadOutcome =
  | { kind: 'none' }
  | { kind: 'resumed'; session: Session }
  /** The save was made with other data (or is unreadable) and was discarded. */
  | { kind: 'discarded'; reason: 'dataVersion' | 'corrupt'; saveDataVersion: number | null };

export function encodeSave(session: Session): string {
  return JSON.stringify({
    format: SAVE_FORMAT,
    seed: session.seed,
    dataVersion: session.world.dataVersion,
    world: serializeWorld(session.world),
    log: session.log,
    pending: session.pending,
    history: session.history,
    flags: session.flags,
  });
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

function readLog(v: unknown): LoggedInput[] | null {
  if (!Array.isArray(v)) return null;
  const out: LoggedInput[] = [];
  for (const e of v) {
    if (!isObj(e) || !isInt(e.tick) || !isObj(e.input) || typeof e.input.type !== 'string') return null;
    out.push({ tick: e.tick, input: e.input as unknown as Input });
  }
  return out;
}

export function decodeSave(text: string, data: SimData): LoadOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'discarded', reason: 'corrupt', saveDataVersion: null };
  }
  if (!isObj(parsed) || parsed.format !== SAVE_FORMAT || typeof parsed.world !== 'string' || !isInt(parsed.seed)) {
    return { kind: 'discarded', reason: 'corrupt', saveDataVersion: null };
  }
  const loaded = deserializeWorld(parsed.world, data);
  if (!loaded.ok) return { kind: 'discarded', reason: loaded.reason, saveDataVersion: loaded.saveDataVersion };
  const log = readLog(parsed.log);
  const pending = readLog((Array.isArray(parsed.pending) ? parsed.pending : []).map((input: unknown) => ({ tick: 0, input })));
  if (!log || !pending) return { kind: 'discarded', reason: 'corrupt', saveDataVersion: data.dataVersion };
  const history = Array.isArray(parsed.history) ? parsed.history.filter(isInt) : [];
  const f = isObj(parsed.flags) ? parsed.flags : {};
  const flags: RunFlags = {
    seenBattleEnd: isInt(f.seenBattleEnd) ? f.seenBattleEnd : -1,
    resultShown: f.resultShown === true,
  };
  const session = new Session(data, {
    seed: parsed.seed,
    world: loaded.world,
    log,
    pending: pending.map((p) => p.input),
    history,
    flags,
  });
  return { kind: 'resumed', session };
}

/** Writes the autosave. Returns false if storage refused. */
export function writeSave(session: Session, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, encodeSave(session));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    /* nothing to do */
  }
}

/** Loads the save. A save from other data (or an unreadable one) is removed and reported. */
export function loadSave(data: SimData, storage: StorageLike | null = defaultStorage()): LoadOutcome {
  if (!storage) return { kind: 'none' };
  let text: string | null;
  try {
    text = storage.getItem(SAVE_KEY);
  } catch {
    return { kind: 'none' };
  }
  if (text === null) return { kind: 'none' };
  const out = decodeSave(text, data);
  if (out.kind === 'discarded') clearSave(storage);
  return out;
}

/** Client-only settings: not sim state, never in the hash or the replay. */
export interface Settings {
  showResult: boolean;
  hintDismissed: boolean;
  /** `client.autosaveSec`, seconds of wall time between autosaves. */
  autosaveSec: number;
}

export function defaultSettings(data: SimData): Settings {
  return { showResult: true, hintDismissed: false, autosaveSec: data.tunables['client.autosaveSec'].default };
}

export function loadSettings(data: SimData, storage: StorageLike | null = defaultStorage()): Settings {
  const s = defaultSettings(data);
  if (!storage) return s;
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (raw === null) return s;
    const p: unknown = JSON.parse(raw);
    if (!isObj(p)) return s;
    const spec = data.tunables['client.autosaveSec'];
    if (typeof p.showResult === 'boolean') s.showResult = p.showResult;
    if (typeof p.hintDismissed === 'boolean') s.hintDismissed = p.hintDismissed;
    if (isInt(p.autosaveSec) && p.autosaveSec >= spec.min && p.autosaveSec <= spec.max) s.autosaveSec = p.autosaveSec;
  } catch {
    /* fall back to defaults */
  }
  return s;
}

export function saveSettings(s: Settings, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* nothing to do */
  }
}
