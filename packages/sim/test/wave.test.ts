import { describe, expect, it } from 'vitest';
import { shipCounts, step, throughputPerMin, type BattleResult, type Input, type World } from '../src/index.ts';
import { N, clone, data, fresh, networkDone, networkStep } from './helpers.ts';

// The sim tsconfig has no DOM or Node types; vitest provides console at runtime.
declare const console: { log(...args: unknown[]): void };

/**
 * Acceptance 6 (m1-sim): a scripted game (not a bot) builds the full asteroid
 * network at defaults, gathers ships at a5, then, from that one snapshot with
 * the Bloom at full strength, sends waves of each size and records the result.
 */

interface WaveResult {
  size: number;
  outcome: BattleResult['outcome'];
  lost: number;
  thornsKilled: number;
  rounds: number;
}

function prepare(): { world: World; networkDoneSec: number; readySec: number; throughput: number } {
  const w = fresh();
  step(w, data, [
    { type: 'setShipyard', on: false },
    { type: 'setRally', node: N.a5 },
  ]);
  let networkDoneSec = -1;
  while (shipCounts(w).at[N.a5]! < 40) {
    const inputs: Input[] = [];
    const next = networkStep(w);
    if (next) inputs.push(next);
    else if (networkDoneSec < 0 && networkDone(w)) {
      networkDoneSec = Math.floor(w.tick / w.tickRate);
      inputs.push({ type: 'setShipyard', on: true });
    }
    step(w, data, inputs);
    if (w.tick > 30 * 60 * 40) throw new Error('network script stalled');
  }
  step(w, data, [{ type: 'setShipyard', on: false }]);
  return { world: w, networkDoneSec, readySec: Math.floor(w.tick / w.tickRate), throughput: throughputPerMin(w) };
}

function wave(snapshot: World, size: number, extra: Input[] = []): WaveResult {
  const w = clone(snapshot);
  if (extra.length) {
    // Tuning applies one tick before the wave is sent; the Bloom is already at its cap.
    step(w, data, extra);
  }
  step(w, data, [{ type: 'sendShips', from: N.a5, to: N.rich, count: size }]);
  let guard = 0;
  while (w.lastBattle === null) {
    step(w, data, []);
    if (++guard > 30 * 60 * 5) throw new Error('battle did not end');
  }
  const b = w.lastBattle;
  return {
    size,
    outcome: b.outcome,
    lost: b.shipsLost,
    thornsKilled: b.thornsKilled,
    rounds: Math.floor((b.endTick - b.startTick) / w.tun['combat.roundTicks']) + 1,
  };
}

describe('scripted waves at defaults (acceptance 6)', () => {
  const prep = prepare();
  const results: WaveResult[] = [];
  for (let size = 20; size <= 40; size++) results.push(wave(prep.world, size));

  it('reports the real numbers', () => {
    console.log(
      `network done at ${prep.networkDoneSec}s, 40 ships at a5 by ${prep.readySec}s, throughput ${prep.throughput}/min\n` +
        results.map((r) => `${r.size} ships: ${r.outcome}, lost ${r.lost}, thorns ${r.thornsKilled}, rounds ${r.rounds}`).join('\n'),
    );
    expect(prep.world.guardian.thorns.length).toBe(data.tunables['guardian.cap'].default);
    expect(prep.throughput).toBe(150);
  });

  it('a wave of 26 at full Bloom is repelled, and so is every smaller one', () => {
    const at26 = results.find((r) => r.size === 26)!;
    expect(at26.outcome).toBe('repelled');
    expect(at26.lost).toBe(26);
    expect(results.filter((r) => r.size <= 26).every((r) => r.outcome === 'repelled')).toBe(true);
  });

  it('every wave of 27 to 40 captures (model said about 28-35), and bigger waves lose fewer ships', () => {
    const big = results.filter((r) => r.size >= 27);
    expect(big.every((r) => r.outcome === 'captured')).toBe(true);
    // Measured: 27 loses 16, 28 loses 15, 35 loses 10, 40 loses 8.
    expect(results.find((r) => r.size === 28)!.lost).toBe(15);
    expect(results.find((r) => r.size === 35)!.lost).toBe(10);
    for (let i = 1; i < big.length; i++) expect(big[i]!.lost).toBeLessThanOrEqual(big[i - 1]!.lost);
  });

  it('a trickle (rally at rich, yard on) never captures in 20 game minutes', () => {
    const w = clone(prep.world);
    step(w, data, [
      { type: 'setRally', node: N.rich },
      { type: 'setShipyard', on: true },
      { type: 'sendShips', from: N.a5, to: N.probe, count: 0 },
    ]);
    for (let i = 0; i < 30 * 60 * 20; i++) step(w, data, []);
    expect(w.capturedTick).toBeNull();
    expect(w.stats.shipsLost).toBeGreaterThan(50);
  });

  it('with regrowth every 30 ticks, the smallest capturing wave is larger (model said about 35)', () => {
    const tuned = (size: number) => wave(prep.world, size, [{ type: 'setTunable', key: 'guardian.regrowTicks', value: 30 }]);
    let smallest = -1;
    for (let size = 20; size <= 40; size++) {
      if (tuned(size).outcome === 'captured') {
        smallest = size;
        break;
      }
    }
    console.log(`regrowTicks 30: smallest capturing wave ${smallest}`);
    // Measured 32 (model said about 35): regrowth still moves the needed wave size.
    expect(smallest).toBe(32);
  });
});
