import { performance } from 'node:perf_hooks';
import { createWorld, runSummary, step, throughputPerMin, worldHash, type BattleOutcome, type SimData } from '@factory4x/sim';
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
  peakPerMin: number;
  shipsBuilt: number;
  shipsLost: number;
  wavesSent: number;
  wavesRepelled: number;
  /** Outcome of the first wave's battle, or null if no battle finished. */
  firstWaveOutcome: BattleOutcome | null;
  oreSpentShips: number;
  oreSpentEconomy: number;
  tickMsP50: number;
  tickMsP95: number;
  finalHash: string;
  /** Set when this result was copied from the first seed because the sim never consumed randomness. */
  duplicateOfSeed?: number;
  error?: string;
}

function percentile(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

/** Softlock: this many game seconds without a route delivery or a ship built, before capture. */
export const SOFTLOCK_SEC = 60 * 5;
/** How often (ticks) progress is sampled; throughput is a 60-game-second sum, so this is cheap. */
const CHECK_EVERY = 30;

export interface RunResult {
  result: GameResult;
  /** True if the simulation consumed its rng (so other seeds would play differently). */
  usedRandomness: boolean;
}

export function runGameDetailed(strategy: Strategy, seed: number, data: SimData, maxTicks: number): RunResult {
  const world = createWorld(seed, data);
  const initialRng = world.rng;
  const times = new Float64Array(maxTicks);
  let outcome: Outcome = 'timeout';
  let error: string | undefined;
  let lastProgressTick = 0;
  let lastShipsBuilt = 0;
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

      if (world.tick % CHECK_EVERY === 0) {
        // Probe mining changes the state hash every tick, so progress is measured
        // by what matters: ore arriving by route, or ships being built.
        const built = world.stats.shipsBuilt;
        if (built !== lastShipsBuilt || throughputPerMin(world) > 0) {
          lastShipsBuilt = built;
          lastProgressTick = world.tick;
        }
        if (world.capturedTick === null && world.tick - lastProgressTick >= SOFTLOCK_SEC * data.tickRate) {
          outcome = 'softlock';
          break;
        }
      }
    }
    if (outcome === 'timeout' && world.capturedTick !== null) outcome = 'won';
  } catch (e) {
    outcome = 'crash';
    error = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
  }

  const measured = times.slice(0, world.tick).sort();
  const s = runSummary(world);
  const result: GameResult = {
    strategy: strategy.name,
    seed,
    outcome,
    ticks: world.tick,
    captureSec: outcome === 'won' ? s.captureSec : null,
    firstShipSec: s.firstShipTick === null ? null : Math.floor(s.firstShipTick / data.tickRate),
    throughputAtMin,
    peakPerMin: s.peakPerMin,
    shipsBuilt: s.shipsBuilt,
    shipsLost: s.shipsLost,
    wavesSent: s.wavesSent,
    wavesRepelled,
    firstWaveOutcome,
    oreSpentShips: s.oreSpentShips,
    oreSpentEconomy: s.oreSpentEconomy,
    tickMsP50: percentile(measured, 50),
    tickMsP95: percentile(measured, 95),
    finalHash: worldHash(world),
  };
  if (error !== undefined) result.error = error;
  return { result, usedRandomness: world.rng !== initialRng };
}

export function runGame(strategy: Strategy, seed: number, data: SimData, maxTicks: number): GameResult {
  return runGameDetailed(strategy, seed, data, maxTicks).result;
}

/**
 * Play a strategy over several seeds. M1 has no randomness, so if the first
 * seed's game never touched the rng, the remaining seeds would repeat it
 * exactly: they are copied (marked `duplicateOfSeed`) instead of re-run. As
 * soon as the sim uses randomness this falls back to running every seed.
 */
export function runSeeds(strategy: Strategy, seeds: number, data: SimData, maxTicks: number): GameResult[] {
  const first = runGameDetailed(strategy, 1, data, maxTicks);
  const out: GameResult[] = [first.result];
  for (let seed = 2; seed <= seeds; seed++) {
    if (first.usedRandomness) out.push(runGame(strategy, seed, data, maxTicks));
    else out.push({ ...first.result, seed, duplicateOfSeed: 1 });
  }
  return out;
}
