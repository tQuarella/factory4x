/**
 * Autosave and client settings, in localStorage. Every storage access is in
 * try/catch (private mode, quota, blocked storage all just mean "no save").
 *
 * Save layout (one slot, key `fvn.save`), JSON:
 *   { format: 2, seed, dataVersion, world: <serializeWorld text>,
 *     log: [{tick, input}...]   the full input log since tick 0,
 *     startTunables: {key: value}  sim tunables the run started with (New system keeps tuning),
 *     start: CampaignStart      only for a constructed start (dev hooks, tests); a real game has none,
 *     mode: 'campaign'          only for a parked-campaign session (H7: shipped data is field mode; a real game has none),
 *     pending: [input...]       inputs sent but not yet stepped,
 *     history: [ore/min...]     sparkline samples, flags: {...} }
 * The seed and the whole log are saved next to the world, so after a resume
 * `session.replay()` still reproduces the live state hash and a feedback note
 * sent after a resume carries a replay of the entire session.
 */
import { deserializeWorld, runMode, serializeWorld, withRunMode, type CampaignStart, type Input, type ResourceTriple, type SimData } from '@factory4x/sim';
import { Session, dataWithDefaults, defaultsDiff, type LoggedInput, type RunFlags } from './session.ts';

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
    startTunables: defaultsDiff(session.data),
    start: session.start,
    ...(runMode(session.data) === 'campaign' ? { mode: 'campaign' } : {}),
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

function readTriple(v: unknown): ResourceTriple | null {
  if (!isObj(v) || !isInt(v.ore) || !isInt(v.ice) || !isInt(v.crystal)) return null;
  return { ore: v.ore, ice: v.ice, crystal: v.crystal };
}

export function decodeSave(text: string, shipped: SimData): LoadOutcome {
  let data = shipped;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'discarded', reason: 'corrupt', saveDataVersion: null };
  }
  if (!isObj(parsed) || parsed.format !== SAVE_FORMAT || typeof parsed.world !== 'string' || !isInt(parsed.seed)) {
    return { kind: 'discarded', reason: 'corrupt', saveDataVersion: null };
  }
  if (parsed.mode === 'campaign') data = withRunMode(data, 'campaign');
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
    shippedAtLanding: readTriple(f.shippedAtLanding),
    stepsShown: Array.isArray(f.stepsShown) ? f.stepsShown.filter(isInt) : [],
  };
  const start = isObj(parsed.start) ? (parsed.start as CampaignStart) : undefined;
  const tunables = isObj(parsed.startTunables) ? (parsed.startTunables as Record<string, number>) : {};
  const session = new Session(dataWithDefaults(data, tunables), {
    seed: parsed.seed,
    ...(start === undefined ? {} : { start }),
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
  /** H4: the overworld's first-run hint ("Tap Landfall, then Land") was dismissed (or the player has landed once). */
  worldHintDismissed: boolean;
  /** `client.autosaveSec`, seconds of wall time between autosaves. */
  autosaveSec: number;
  /** H8 `client.longPressMs`, `client.dragSlopPx` and `client.moveGesture` (1 drag, 0 tap-Move-tap): this device only, never in the sim. */
  longPressMs: number;
  dragSlopPx: number;
  moveGesture: number;
  /** H9 `client.haulerStepper` (1: H8's hauler stepper under the extractor row): this device only. */
  haulerStepper: number;
}

/** The client-scope keys and the setting each one is stored in. */
export const CLIENT_SETTING_KEYS = {
  'client.autosaveSec': 'autosaveSec',
  'client.longPressMs': 'longPressMs',
  'client.dragSlopPx': 'dragSlopPx',
  'client.moveGesture': 'moveGesture',
  'client.haulerStepper': 'haulerStepper',
} as const;
export type ClientKey = keyof typeof CLIENT_SETTING_KEYS;

export function defaultSettings(data: SimData): Settings {
  const d = (k: ClientKey): number => data.tunables[k].default;
  return {
    showResult: true,
    hintDismissed: false,
    worldHintDismissed: false,
    autosaveSec: d('client.autosaveSec'),
    longPressMs: d('client.longPressMs'),
    dragSlopPx: d('client.dragSlopPx'),
    moveGesture: d('client.moveGesture'),
    haulerStepper: d('client.haulerStepper'),
  };
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
    if (typeof p.worldHintDismissed === 'boolean') s.worldHintDismissed = p.worldHintDismissed;
    if (isInt(p.autosaveSec) && p.autosaveSec >= spec.min && p.autosaveSec <= spec.max) s.autosaveSec = p.autosaveSec;
    for (const key of Object.keys(CLIENT_SETTING_KEYS) as ClientKey[]) {
      const name = CLIENT_SETTING_KEYS[key];
      const v = p[name];
      const sp = data.tunables[key];
      if (isInt(v) && v >= sp.min && v <= sp.max) s[name] = v;
    }
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
