import { performance } from 'node:perf_hooks';
import { createWorld, step, worldHash, type SimData } from '@factory4x/sim';
import type { Strategy } from './strategies.ts';

export type Outcome = 'won' | 'lost' | 'timeout' | 'softlock' | 'crash';

export interface GameResult {
  strategy: string;
  seed: number;
  outcome: Outcome;
  ticks: number;
  /** Ticks to win, in game seconds; null if not won. */
  timeToWinSec: number | null;
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

/** How many ticks of no state change count as a softlock. */
const SOFTLOCK_TICKS = 30 * 60 * 5;

export function runGame(strategy: Strategy, seed: number, data: SimData, maxTicks: number): GameResult {
  const world = createWorld(seed, data);
  const times = new Float64Array(maxTicks);
  // Widened explicitly: 'won'/'lost' are set by win detection, which lands in Milestone 1.
  let outcome = 'timeout' as Outcome;
  let error: string | undefined;
  let lastHash = '';
  let unchangedSince = 0;

  try {
    for (let i = 0; i < maxTicks; i++) {
      const t0 = performance.now();
      step(world, data, strategy.decide(world));
      times[i] = performance.now() - t0;

      // Softlock check is sampled to keep it cheap.
      if (i % 300 === 0) {
        const h = worldHash(world);
        if (h === lastHash) {
          if (world.tick - unchangedSince >= SOFTLOCK_TICKS) {
            outcome = 'softlock';
            break;
          }
        } else {
          lastHash = h;
          unchangedSince = world.tick;
        }
      }
      // Milestone 1 adds win/loss detection here.
    }
  } catch (e) {
    outcome = 'crash';
    error = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
  }

  const measured = times.slice(0, world.tick).sort();
  const result: GameResult = {
    strategy: strategy.name,
    seed,
    outcome,
    ticks: world.tick,
    timeToWinSec: outcome === 'won' ? world.tick / data.tickRate : null,
    tickMsP50: percentile(measured, 50),
    tickMsP95: percentile(measured, 95),
    finalHash: worldHash(world),
  };
  if (error !== undefined) result.error = error;
  return result;
}
