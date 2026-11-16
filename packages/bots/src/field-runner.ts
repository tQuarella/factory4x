import { performance } from 'node:perf_hooks';
import {
  BUILD_TYPES,
  PROBE,
  allocStatus,
  createWorld,
  fieldSummary,
  fleetStatus,
  isFleetFull,
  isTypeUnlocked,
  isWon,
  oreCost,
  SHIP_TYPES,
  rockStatus,
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
  /** H9: each prong's result (`lastRaid.prongs`): the rock id it went to, its outcome, and the economy ships it killed. One entry for a raid that did not split. */
  prongs: { target: string; outcome: string; econLost: number }[];
}

/** One trace point: economy alive, warships alive, ore in stock, the weights, and the bays running. */
export interface TraceRow {
  minute: number;
  extractors: number;
  haulers: number;
  warships: { drone: number; lancer: number; flak: number };
  stockOre: number;
  weights: Record<BuildType, number>;
  bayRunning: BuildType[];
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
  /** H9 W6: prongs by outcome (`stats.raidProngs`). */
  raidProngs: { beaten: number; hit: number; turnedBack: number };
  raidLog: RaidRecord[];
  /** Economy ships built and lost, by type. */
  econBuilt: { extractor: number; hauler: number };
  econLost: { extractor: number; hauler: number };
  peakEcon: number;
  /** The most haulers alive at once. */
  peakHaulers: number;
  allocChanges: number;
  /** H8 staffing: haulers idle at the probe (fleetStatus.types.hauler.idle), sampled every tick. */
  idleHaulers: { peak: number; /** Game minutes with more than 1 idle, outside raids (mustering, out or fighting). */ minutesOver1: number };
  /** H8 staffing: per rock, game seconds backed up (buffer at node.bufferCap) with its hauler target met, and the longest run of them. Rocks with none are left out. */
  backedUp: Record<string, { seconds: number; longest: number }>;
  /** H8 shield: economy ships lost in a tick that began with a warship standing at the raid's target. Must be 0 when raid.shieldEcon is 1. */
  econLostGuarded: number;
  /** The longest run, in game minutes, with ore for the dearest unlocked warship in stock, room under the fleet limit and no bay running (what "idles with resources piling up" measures). */
  idleWithOreMin: number;
  /** The state at 15, 30 and 45 game minutes (those the run reached). */
  trace: TraceRow[];
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
  const idleHaulers = { peak: 0, minutesOver1: 0 };
  let idleTicks = 0;
  const backedUp: Record<string, { seconds: number; longest: number }> = {};
  const runs = new Map<string, number>();
  let econLostGuarded = 0;
  let idleOreRun = 0;
  let idleOreLongest = 0;
  const trace: TraceRow[] = [];
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
      // A warship standing at the raid's target as the tick begins (the shield's premise).
      const raidNode = world.raid === null ? null : world.raid.target;
      const guardedNow = raidNode !== null && world.ships.some((s) => s.at === raidNode);
      const lostBefore = econLostTotal(world);
      const t0 = performance.now();
      step(world, data, inputs);
      times.push(performance.now() - t0);
      if (guardedNow) econLostGuarded += econLostTotal(world) - lostBefore;
      // No-idle: ore for the dearest unlocked warship in stock while no bay runs (the cheap checks first).
      const bayNow = bayTicks(world);
      let noBay = true;
      for (const t of bayNow) if (t > 0) noBay = false;
      if (noBay && world.stock.ore >= world.tun['ship.drone.cost']) {
        // Read straight from the world: the same numbers as allocStatus rows' cost and unlocked, and fleetStatus.full, without the sheets.
        let dearest = 0;
        for (const t of SHIP_TYPES) if (isTypeUnlocked(world, t)) dearest = Math.max(dearest, oreCost(world, t));
        if (dearest > 0 && world.stock.ore >= dearest && !isFleetFull(world, data)) {
          idleOreRun++;
          if (idleOreRun > idleOreLongest) idleOreLongest = idleOreRun;
        } else idleOreRun = 0;
      } else idleOreRun = 0;
      // Trace: the state at 15, 30 and 45 game minutes.
      if (world.tick > 0 && world.tick % (15 * 60 * data.tickRate) === 0) {
        const f = fleetStatus(world, data);
        const rows = allocStatus(world, data).rows;
        const w = Object.fromEntries(rows.map((r) => [r.type, r.weight])) as Record<BuildType, number>;
        trace.push({ minute: world.tick / data.tickRate / 60, extractors: f.econByType.extractor, haulers: f.econByType.hauler, warships: { ...f.byType }, stockOre: world.stock.ore, weights: w, bayRunning: rows.filter((r) => r.ticksLeft > 0).map((r) => r.type) });
      }
      // Staffing: idle haulers at the probe (docked at no node, not in flight), and backed-up rocks whose hauler target is met.
      let idleH = 0;
      for (const s of world.field!.econ) if (s.type === 'hauler' && s.at === PROBE && s.transit === null && s.target === null) idleH++;
      if (idleH > idleHaulers.peak) idleHaulers.peak = idleH;
      if (idleH > 1 && world.raid === null) idleTicks++;
      for (const n of world.nodes) {
        if (n.kind === 'probe') continue;
        const key = n.id;
        const r = n.buffer >= world.tun['node.bufferCap'] ? rockStatus(world, n.index) : null;
        if (r !== null && r.haulerTarget > 0 && r.haulers >= r.haulerTarget) {
          const run = (runs.get(key) ?? 0) + 1;
          runs.set(key, run);
          const b = backedUp[key] ?? { seconds: 0, longest: 0 };
          b.seconds += 1 / data.tickRate;
          if (run / data.tickRate > b.longest) b.longest = run / data.tickRate;
          backedUp[key] = b;
        } else runs.set(key, 0);
      }
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
          const prongs = (world.lastRaid?.prongs ?? []).map((p) => ({ target: world.nodes[p.target]!.id, outcome: p.outcome, econLost: p.lostEcon.extractor + p.lostEcon.hauler }));
          raidLog.push({ startTick: open.startTick, endTick: world.tick, outcome: outcomeNow, econLost: econLostTotal(world) - open.lostAtStart, planned: open.planned, prongs });
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
    raidProngs: { ...s.raidProngs },
    raidLog,
    econBuilt: { ...st.econBuilt },
    econLost: { ...st.econLost },
    peakEcon: s.peakEcon,
    peakHaulers,
    allocChanges: s.allocChanges,
    idleHaulers: { peak: idleHaulers.peak, minutesOver1: Number((idleTicks / data.tickRate / 60).toFixed(2)) },
    backedUp,
    econLostGuarded,
    idleWithOreMin: Number((idleOreLongest / data.tickRate / 60).toFixed(2)),
    trace,
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
