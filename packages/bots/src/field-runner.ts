import { performance } from 'node:perf_hooks';
import {
  BUILD_TYPES,
  createWorld,
  fieldSummary,
  isWon,
  step,
  worldHash,
  type BuildType,
  type BuildTypeCounts,
  type Input,
  type SimData,
  type TunableKey,
  type World,
} from '@factory4x/sim';

/**
 * The field runner (DESIGN.md H7 "Bots (H7): strategies"): one run per strategy per seed on the field.
 *
 *   won      the hive was captured (isWon);
 *   timeout  FIELD_CAP_MIN game minutes of play passed first;
 *   softlock before the hive fell, no ship started and no hauler delivered for SOFTLOCK_MIN game minutes in a row;
 *   crash    the strategy or the sim threw.
 */
export type FieldOutcome = 'won' | 'timeout' | 'softlock' | 'crash';

/** A run stops with `timeout` after this many game minutes of play. */
export const FIELD_CAP_MIN = 45;
/** A run is a softlock after this many game minutes with no ship start and no delivery before the hive falls. */
export const SOFTLOCK_MIN = 5;

/** A strategy: a name, whether the gate expects it to win, and a factory (a bot carries its own memory, per run). */
export interface FieldBot {
  /** The inputs for this tick (read-only world; only selectors and plain reads). */
  decide(world: Readonly<World>, data: SimData): Input[];
}
export interface FieldStrategy {
  name: string;
  description: string;
  /** The gate expects this strategy to take the hive on every seed (a softlock or timeout fails the gate). */
  expectedWin: boolean;
  /** Tunables set with setTunable on the first tick (the A/B and the control runs). */
  tunables?: Readonly<Partial<Record<TunableKey, number>>>;
  make(data: SimData): FieldBot;
}

/** One raid, from its muster to its end. */
export interface RaidRecord {
  /** World tick the muster started, and the tick it ended. */
  startTick: number;
  endTick: number;
  outcome: 'beaten' | 'hit' | 'turnedBack';
  /** Economy ships lost while it lasted. */
  econLost: number;
  /** The planned size by type. */
  planned: { thorn: number; spore: number };
}

export interface FieldResult {
  strategy: string;
  /** The sweep shape for `static` (null for the others). */
  variant: string | null;
  seed: number;
  outcome: FieldOutcome;
  /** World ticks stepped (the time to the hive if won). */
  ticks: number;
  /** Tick the hive fell, or null. */
  hiveTick: number | null;
  raids: { mustered: number; beaten: number; hit: number; turnedBack: number };
  raidLog: RaidRecord[];
  /** Economy ships built and lost, by type. */
  econBuilt: { extractor: number; hauler: number };
  econLost: { extractor: number; hauler: number };
  peakEcon: number;
  /** The most haulers alive at once. */
  peakHaulers: number;
  allocChanges: number;
  built: BuildTypeCounts;
  lost: BuildTypeCounts;
  peakPerMin: number;
  tickMsP50: number;
  tickMsP95: number;
  finalHash: string;
  error?: string;
}

export interface FieldRunOptions {
  /** Cap in game ticks (default FIELD_CAP_MIN game minutes). */
  capTicks: number;
  /** Softlock window in game ticks (default SOFTLOCK_MIN game minutes). */
  softlockTicks: number;
  /** Extra tunables set on the first tick, after the strategy's own. */
  tunables?: Readonly<Partial<Record<TunableKey, number>>>;
  /** Called after every step with the world, read-only (tests and tools observe a run; it never changes one). */
  onTick?: (world: Readonly<World>) => void;
}

export function defaultFieldOptions(data: SimData): FieldRunOptions {
  return { capTicks: FIELD_CAP_MIN * 60 * data.tickRate, softlockTicks: SOFTLOCK_MIN * 60 * data.tickRate };
}

function percentile(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

const bayTicks = (w: Readonly<World>): number[] => BUILD_TYPES.map((t): number => (t === 'extractor' || t === 'hauler' ? w.field!.bays[t].ticksLeft : w.yards[t].ticksLeft));
const deliveredTotal = (w: Readonly<World>): number => w.stats.delivered.ore + w.stats.delivered.ice + w.stats.delivered.crystal;
const econLostTotal = (w: Readonly<World>): number => w.stats.econLost.extractor + w.stats.econLost.hauler;

/** Play one strategy on one seed. `variant` labels a `static` sweep shape. */
export function runField(strategy: FieldStrategy, seed: number, data: SimData, opts: FieldRunOptions = defaultFieldOptions(data), variant: string | null = null): FieldResult {
  const world = createWorld(seed, data);
  const times: number[] = [];
  const raidLog: RaidRecord[] = [];
  let outcome: FieldOutcome = 'timeout';
  let error: string | undefined;
  let peakHaulers = 0;
  let lastProgress = 0;
  let prevBay = bayTicks(world);
  let prevDelivered = deliveredTotal(world);
  let open: { startTick: number; lostAtStart: number; planned: { thorn: number; spore: number } } | null = null;
  let prevRaids = { beaten: 0, hit: 0, turnedBack: 0 };
  const first: Input[] = [];
  for (const src of [strategy.tunables, opts.tunables]) {
    if (src === undefined) continue;
    for (const key of Object.keys(src) as TunableKey[]) first.push({ type: 'setTunable', key, value: src[key]! });
  }
  try {
    const bot = strategy.make(data);
    while (!isWon(world)) {
      if (world.tick >= opts.capTicks) break;
      if (world.tick - lastProgress >= opts.softlockTicks) {
        outcome = 'softlock';
        break;
      }
      let inputs = bot.decide(world, data);
      if (first.length > 0) {
        inputs = [...first.splice(0), ...inputs];
      }
      const t0 = performance.now();
      step(world, data, inputs);
      times.push(performance.now() - t0);
      opts.onTick?.(world);
      // Progress: a bay started a ship, or a hauler delivered.
      const bay = bayTicks(world);
      for (let i = 0; i < bay.length; i++) if (prevBay[i] === 0 && bay[i]! > 0) lastProgress = world.tick;
      prevBay = bay;
      const d = deliveredTotal(world);
      if (d > prevDelivered) lastProgress = world.tick;
      prevDelivered = d;
      // Raids: a muster opens a record, the stats counter that moves closes it with its outcome. A muster
      // cancelled by a battle at the hive (R6) ends with no counter and leaves no record.
      const r = world.stats.raids;
      if (open === null && world.raid !== null) open = { startTick: world.tick, lostAtStart: econLostTotal(world), planned: { ...world.raid.planned } };
      if (open !== null) {
        const outcomeNow = r.hit > prevRaids.hit ? 'hit' : r.beaten > prevRaids.beaten ? 'beaten' : r.turnedBack > prevRaids.turnedBack ? 'turnedBack' : null;
        if (outcomeNow !== null) {
          raidLog.push({ startTick: open.startTick, endTick: world.tick, outcome: outcomeNow, econLost: econLostTotal(world) - open.lostAtStart, planned: open.planned });
          open = null;
        } else if (world.raid === null) open = null;
      }
      prevRaids = { beaten: r.beaten, hit: r.hit, turnedBack: r.turnedBack };
      let h = 0;
      for (const s of world.field!.econ) if (s.type === 'hauler') h++;
      if (h > peakHaulers) peakHaulers = h;
    }
    if (isWon(world)) outcome = 'won';
  } catch (e) {
    outcome = 'crash';
    error = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
  }
  const sorted = Float64Array.from(times).sort();
  const s = fieldSummary(world);
  const st = world.stats;
  const result: FieldResult = {
    strategy: strategy.name,
    variant,
    seed,
    outcome,
    ticks: world.tick,
    hiveTick: world.capturedTick,
    raids: { ...s.raids },
    raidLog,
    econBuilt: { ...st.econBuilt },
    econLost: { ...st.econLost },
    peakEcon: s.peakEcon,
    peakHaulers,
    allocChanges: s.allocChanges,
    built: s.built,
    lost: s.lost,
    peakPerMin: s.peakPerMin,
    tickMsP50: percentile(sorted, 50),
    tickMsP95: percentile(sorted, 95),
    finalHash: worldHash(world),
  };
  if (error !== undefined) result.error = error;
  return result;
}

/** Game ticks as m:ss. */
export function tickMmss(ticks: number | null, tickRate: number): string {
  if (ticks === null) return 'never';
  const sec = Math.floor(ticks / tickRate);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/**
 * The bots gate's failures from the runs: a crash of any strategy, a tick p95 over budget, and, for a strategy
 * the gate expects to win (`adaptive`, `greedy`), a softlock or a timeout on any seed. Missing a flag is never a failure.
 */
export function fieldGateFailures(results: readonly FieldResult[], winners: readonly string[], names: readonly string[], tickBudgetMsP95: number, tickRate: number): string[] {
  const out: string[] = [];
  const mins = (ticks: number): string => `${(ticks / tickRate / 60).toFixed(1)} min`;
  for (const name of names) {
    const rs = results.filter((r) => r.strategy === name);
    for (const r of rs) {
      if (r.outcome === 'crash') out.push(`${name} seed ${r.seed}: crash (${(r.error ?? '').split('\n')[0]})`);
      if (winners.includes(name) && r.outcome === 'softlock') out.push(`${name} seed ${r.seed}: softlock (no ship started and no delivery for ${SOFTLOCK_MIN} min, at ${mins(r.ticks)})`);
      if (winners.includes(name) && r.outcome === 'timeout') out.push(`${name} seed ${r.seed}: timeout (no hive after ${mins(r.ticks)}, the ${FIELD_CAP_MIN} minute cap)`);
    }
    const p95 = rs.length === 0 ? 0 : Math.max(...rs.map((r) => r.tickMsP95));
    if (p95 > tickBudgetMsP95) out.push(`${name}: tick p95 ${p95.toFixed(3)}ms exceeds budget ${tickBudgetMsP95}ms`);
  }
  return out;
}

/**
 * The runs the gate judges: every run of every strategy, and for `static` every shape of the sweep (not just the
 * best one the report shows), so a crash or a slow tick in any shape fails the gate.
 */
export function gateRuns(results: readonly FieldResult[], sweep: readonly FieldResult[]): FieldResult[] {
  return [...results.filter((r) => r.strategy !== 'static'), ...sweep];
}

/** The weights a bot sets, as a record. */
export type Weights = Record<BuildType, number>;
