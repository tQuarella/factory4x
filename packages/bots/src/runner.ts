import { performance } from 'node:perf_hooks';
import { createWorld, lastBattle, runSummary, type RunSummary, step, throughputPerMin, worldHash, type BattleOutcome, type SimData } from '@factory4x/sim';
import type { Strategy } from './strategies.ts';

/** won = the rich node was captured; timeout = still uncaptured at the tick cap. */
export type Outcome = 'won' | 'timeout' | 'softlock' | 'crash';

/** Game minutes at which throughput is sampled (the spec's 2, 5, 10, 15, 20, plus 12 for the "still rising at 10" check). */
export const SAMPLE_MINUTES = [2, 5, 10, 12, 15, 20] as const;

export interface GameResult {
  strategy: string;
  seed: number;
  outcome: Outcome;
  ticks: number;
  /** Game seconds to capture; null if not captured within the run. */
  captureSec: number | null;
  /** Game seconds when the first ship was built; null if none. */
  firstShipSec: number | null;
  /** throughputPerMin at each sample minute, keyed by minute; null if the run ended first. */
  throughputAtMin: Record<string, number | null>;
  /** Peak ore/min over the whole run. */
  peakPerMin: number;
  /** Ships built, ships lost and ore spent, as of capture (end of the run if never captured). */
  shipsBuilt: number;
  shipsLost: number;
  oreSpentShips: number;
  oreSpentEconomy: number;
  /** Waves sent and repelled as of capture (end of the run if never captured). */
  wavesSent: number;
  wavesRepelled: number;
  /** Outcome of the first wave's battle, or null if no battle finished. */
  firstWaveOutcome: BattleOutcome | null;
  /** The system (DESIGN.md H2): variant id ('knotted', 'deep', 'thin') and name. */
  variantId: string;
  variantName: string;
  /** Game seconds when the Root was cut; null if it was left standing. */
  rootCutSec: number | null;
  /** Ships lost at the Root, Bloom thorns withered by the cut, and waves sent per target (as of capture). */
  rootShipsLost: number;
  thornsWithered: number;
  rootWavesSent: number;
  bloomWavesSent: number;
  /** Whole-run totals (all ticks, including the post-capture build-out up to the tick cap). */
  wholeRun: { shipsBuilt: number; shipsLost: number; oreSpentShips: number; oreSpentEconomy: number };
  tickMsP50: number;
  tickMsP95: number;
  finalHash: string;
  error?: string;
}

function percentile(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

/** Softlock: this many game seconds without a route delivery or a ship built, before capture. */
export const SOFTLOCK_SEC = 60 * 5;

export function runGame(strategy: Strategy, seed: number, data: SimData, maxTicks: number): GameResult {
  const world = createWorld(seed, data);
  const times = new Float64Array(maxTicks);
  let outcome: Outcome = 'timeout';
  let error: string | undefined;
  let lastProgressTick = 0;
  let lastShipsBuilt = 0;
  let prevBucketIdx = -1;
  let prevBucketVal = 0;
  let atCapture: RunSummary | null = null;
  let wavesSentAtCapture = 0;
  let repelledAtCapture = 0;
  let wavesRepelled = 0;
  let firstWaveOutcome: BattleOutcome | null = null;
  const lastBattleEnd: number[] = [];
  const throughputAtMin: Record<string, number | null> = {};
  for (const m of SAMPLE_MINUTES) throughputAtMin[String(m)] = null;
  const sampleTicks = new Map<number, number>();
  for (const m of SAMPLE_MINUTES) sampleTicks.set(m * 60 * data.tickRate, m);

  try {
    for (let i = 0; i < maxTicks; i++) {
      const inputs = strategy.decide(world);
      const t0 = performance.now();
      step(world, data, inputs);
      times[i] = performance.now() - t0;

      // Per node: world.lastBattle is the latest at any node, so a Root battle would hide a Bloom one.
      for (const g of world.guardians) {
        const lb = lastBattle(world, g.node);
        if (lb !== null && lb.endTick !== (lastBattleEnd[g.node] ?? -1)) {
          lastBattleEnd[g.node] = lb.endTick;
          if (lb.outcome === 'repelled') wavesRepelled++;
          if (firstWaveOutcome === null) firstWaveOutcome = lb.outcome;
        }
      }
      const minute = sampleTicks.get(world.tick);
      if (minute !== undefined) throughputAtMin[String(minute)] = throughputPerMin(world);

      if (atCapture === null && world.capturedTick !== null) {
        atCapture = runSummary(world);
        wavesSentAtCapture = atCapture.wavesSent;
        repelledAtCapture = wavesRepelled;
      }

      // Probe mining changes the state hash every tick, so progress is what matters:
      // ore arriving by route (the per-second delivery bucket of the tick just run grew)
      // or a ship being built. Checked every tick, so the 5 minutes are exact.
      const buckets = world.stats.deliveredBuckets;
      const idx = Math.floor((world.tick - 1) / data.tickRate) % buckets.length;
      const val = buckets[idx]!;
      if (val > (idx === prevBucketIdx ? prevBucketVal : 0)) lastProgressTick = world.tick;
      prevBucketIdx = idx;
      prevBucketVal = val;
      if (world.stats.shipsBuilt !== lastShipsBuilt) {
        lastShipsBuilt = world.stats.shipsBuilt;
        lastProgressTick = world.tick;
      }
      if (world.capturedTick === null && world.tick - lastProgressTick >= SOFTLOCK_SEC * data.tickRate) {
        outcome = 'softlock';
        break;
      }
    }
    if (outcome === 'timeout' && world.capturedTick !== null) outcome = 'won';
  } catch (e) {
    outcome = 'crash';
    error = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
  }

  const measured = times.slice(0, world.tick).sort();
  const end = runSummary(world);
  const s = atCapture ?? end;
  const result: GameResult = {
    strategy: strategy.name,
    seed,
    outcome,
    ticks: world.tick,
    captureSec: outcome === 'won' ? end.captureSec : null,
    firstShipSec: end.firstShipTick === null ? null : Math.floor(end.firstShipTick / data.tickRate),
    throughputAtMin,
    peakPerMin: end.peakPerMin,
    shipsBuilt: s.shipsBuilt,
    shipsLost: s.shipsLost,
    wavesSent: atCapture ? wavesSentAtCapture : s.wavesSent,
    wavesRepelled: atCapture ? repelledAtCapture : wavesRepelled,
    firstWaveOutcome,
    variantId: end.variantId,
    variantName: end.variantName,
    rootCutSec: end.rootCutSec,
    rootShipsLost: s.rootShipsLost,
    thornsWithered: s.thornsWithered,
    rootWavesSent: s.rootWavesSent,
    bloomWavesSent: s.bloomWavesSent,
    oreSpentShips: s.oreSpentShips,
    oreSpentEconomy: s.oreSpentEconomy,
    wholeRun: { shipsBuilt: end.shipsBuilt, shipsLost: end.shipsLost, oreSpentShips: end.oreSpentShips, oreSpentEconomy: end.oreSpentEconomy },
    tickMsP50: percentile(measured, 50),
    tickMsP95: percentile(measured, 95),
    finalHash: worldHash(world),
  };
  if (error !== undefined) result.error = error;
  return result;
}

/** Play a strategy over several seeds. Every seed runs its own game and gets every check. */
export function runSeeds(strategy: Strategy, seeds: number, data: SimData, maxTicks: number): GameResult[] {
  const out: GameResult[] = [];
  for (let seed = 1; seed <= seeds; seed++) out.push(runGame(strategy, seed, data, maxTicks));
  return out;
}

/** One depth-flag line: `pass` is a report marker, never a gate. */
export interface DepthFlag {
  name: string;
  pass: boolean;
  detail: string;
}

/** The first (lowest-seed) result per variant for a strategy. */
function byVariant(results: readonly GameResult[], strategy: string): Map<string, GameResult> {
  const m = new Map<string, GameResult>();
  for (const r of results) if (r.strategy === strategy && !m.has(r.variantId)) m.set(r.variantId, r);
  return m;
}

const sec = (v: number | null): string => (v === null ? 'never' : `${v} s (${(v / 60).toFixed(1)} min)`);

/** Capture window, in game seconds, for the H2 depth flags. */
export const CAPTURE_MIN_SEC = 8 * 60;
export const CAPTURE_MAX_SEC = 13 * 60;
/** turtle's H1 capture time (9.8 min) and its tolerance, in game seconds. */
export const H1_TURTLE_SEC = 588;
export const H1_TURTLE_TOL_SEC = 10;

/** The variants the depth flags compare (seeds 1-3 cover them). */
export const VARIANT_IDS = ['knotted', 'deep', 'thin'] as const;

/**
 * DESIGN.md H2 "Bot tuning targets" 1-6 as report lines (each variant needs a
 * turtle and a raid-supply result; a missing or uncaptured one fails its flag).
 */
export function computeDepthFlags(results: readonly GameResult[]): DepthFlag[] {
  const t = byVariant(results, 'turtle');
  const r = byVariant(results, 'raid-supply');
  const ids = VARIANT_IDS;
  const cap = (m: Map<string, GameResult>, id: string): number | null => m.get(id)?.captureSec ?? null;
  const lost = (m: Map<string, GameResult>, id: string): number | null => {
    const g = m.get(id);
    return g && g.captureSec !== null ? g.shipsLost : null;
  };
  const flags: DepthFlag[] = [];

  const outside: string[] = [];
  for (const [name, m] of [['turtle', t], ['raid-supply', r]] as const) {
    for (const id of ids) {
      const c = cap(m, id);
      if (c === null || c < CAPTURE_MIN_SEC || c > CAPTURE_MAX_SEC) outside.push(`${name}/${id} ${sec(c)}`);
    }
  }
  flags.push({
    name: 'both strategies capture in every variant within 8-13 min',
    pass: outside.length === 0,
    detail: outside.length === 0 ? 'all six within the window' : `outside: ${outside.join('; ')}`,
  });

  /** Positive: turtle captured first, by that many seconds. */
  const gap = (id: string): number | null => {
    const a = cap(t, id);
    const b = cap(r, id);
    return a === null || b === null ? null : b - a;
  };
  const thin = gap('thin');
  flags.push({
    name: 'thin: raid-supply captures at least 30 s before turtle',
    pass: thin !== null && thin <= -30,
    detail: thin === null ? 'missing capture' : `raid-supply is ${thin >= 0 ? `${thin} s slower` : `${-thin} s faster`}`,
  });
  const deep = gap('deep');
  flags.push({
    name: 'deep: turtle captures at least 30 s before raid-supply',
    pass: deep !== null && deep >= 30,
    detail: deep === null ? 'missing capture' : `turtle is ${deep >= 0 ? `${deep} s faster` : `${-deep} s slower`}`,
  });
  const knotted = gap('knotted');
  flags.push({
    name: 'knotted: capture times within 45 s of each other',
    pass: knotted !== null && Math.abs(knotted) <= 45,
    detail: knotted === null ? 'missing capture' : `difference ${Math.abs(knotted)} s (${knotted >= 0 ? 'turtle' : 'raid-supply'} first)`,
  });

  // Strict dominance: at least as good on time and on losses in all three variants.
  const dominates = (a: Map<string, GameResult>, b: Map<string, GameResult>): boolean =>
    ids.every((id) => {
      const ca = cap(a, id);
      const cb = cap(b, id);
      const la = lost(a, id);
      const lb = lost(b, id);
      return ca !== null && cb !== null && la !== null && lb !== null && ca <= cb && la <= lb;
    });
  const raidFirst = ids.filter((id) => (gap(id) ?? 0) < 0);
  const turtleFirst = ids.filter((id) => (gap(id) ?? 0) > 0);
  const turtleFewer = ids.filter((id) => (lost(t, id) ?? Infinity) < (lost(r, id) ?? Infinity));
  const dom = dominates(t, r) ? 'turtle' : dominates(r, t) ? 'raid-supply' : 'none';
  flags.push({
    name: 'no dominance: each captures first in a variant, and turtle loses fewer ships in a variant',
    pass: dom === 'none' && raidFirst.length > 0 && turtleFirst.length > 0 && turtleFewer.length > 0,
    detail: `raid-supply first in [${raidFirst.join(', ')}], turtle first in [${turtleFirst.join(', ')}], turtle loses fewer in [${turtleFewer.join(', ')}], strict dominance: ${dom}`,
  });

  const off = ids.map((id) => ({ id, c: cap(t, id), w: t.get(id)?.wavesSent ?? null }));
  flags.push({
    name: 'turtle matches H1 (9.8 min +/- 10 s, 1 wave)',
    pass: off.every((o) => o.c !== null && Math.abs(o.c - H1_TURTLE_SEC) <= H1_TURTLE_TOL_SEC && o.w === 1),
    detail: off.map((o) => `${o.id} ${sec(o.c)}, ${o.w ?? '-'} wave(s)`).join('; '),
  });
  return flags;
}
