import { performance } from 'node:perf_hooks';
import { createWorld, runSummary, type RunSummary, step, throughputPerMin, worldHash, type BattleOutcome, type SimData } from '@factory4x/sim';
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
  let lastBattleEnd = -1;
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

      const lb = world.lastBattle;
      if (lb !== null && lb.endTick !== lastBattleEnd) {
        lastBattleEnd = lb.endTick;
        if (lb.outcome === 'repelled') wavesRepelled++;
        if (firstWaveOutcome === null) firstWaveOutcome = lb.outcome;
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
