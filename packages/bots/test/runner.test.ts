import { describe, expect, it } from 'vitest';
import { defaultData } from '@factory4x/sim';
import { SOFTLOCK_SEC, runGame, runSeeds } from '../src/runner.ts';
import { rushDecide, turtleDecide, type Strategy } from '../src/strategies.ts';

const TICKS_30_MIN = 54000;
const rush: Strategy = { name: 'rush', description: '', decide: rushDecide };
const turtle: Strategy = { name: 'turtle', description: '', decide: turtleDecide };

describe('runner', () => {
  it('reports a softlock when nothing is delivered and no ship is built for 5 game minutes', () => {
    // Yard off and no builds: probe mining alone changes the hash every tick, but nothing progresses.
    const idle: Strategy = {
      name: 'idle',
      description: '',
      decide: (w) => (w.shipyard.on ? [{ type: 'setShipyard', on: false }] : []),
    };
    const r = runGame(idle, 1, defaultData, TICKS_30_MIN);
    expect(r.outcome).toBe('softlock');
    expect(r.ticks).toBeGreaterThanOrEqual(SOFTLOCK_SEC * defaultData.tickRate);
    expect(r.ticks).toBeLessThan(SOFTLOCK_SEC * defaultData.tickRate + 120);
  });

  it('does not call a ship-building game a softlock even with no routes', () => {
    const yardOnly: Strategy = { name: 'yard', description: '', decide: () => [] };
    expect(runGame(yardOnly, 1, defaultData, TICKS_30_MIN).outcome).toBe('timeout');
  });

  it('turns a crash into outcome crash', () => {
    const boom: Strategy = {
      name: 'boom',
      description: '',
      decide: () => {
        throw new Error('kaboom');
      },
    };
    const r = runGame(boom, 1, defaultData, 100);
    expect(r.outcome).toBe('crash');
    expect(r.error).toContain('kaboom');
  });

  it('treats capture as won and fills every report field', () => {
    const r = runGame(turtle, 1, defaultData, TICKS_30_MIN);
    expect(r.outcome).toBe('won');
    expect(r.captureSec).not.toBeNull();
    expect(r.firstShipSec).not.toBeNull();
    for (const m of ['2', '5', '10', '12', '15', '20']) expect(r.throughputAtMin[m]).not.toBeNull();
    expect(r.peakPerMin).toBeGreaterThan(0);
    expect(r.shipsBuilt).toBeGreaterThan(0);
    expect(r.wavesSent).toBeGreaterThanOrEqual(1);
    expect(r.oreSpentShips).toBeGreaterThan(0);
    expect(r.oreSpentEconomy).toBeGreaterThan(0);
    expect(r.tickMsP95).toBeGreaterThanOrEqual(r.tickMsP50);
  });

  it('copies duplicate seeds instead of replaying them, and the copy matches a real replay', () => {
    const rs = runSeeds(turtle, 3, defaultData, TICKS_30_MIN);
    expect(rs.map((r) => r.seed)).toEqual([1, 2, 3]);
    expect(rs[0]!.duplicateOfSeed).toBeUndefined();
    expect(rs[1]!.duplicateOfSeed).toBe(1);
    expect(rs[2]!.captureSec).toBe(rs[0]!.captureSec);
    // The shortcut is only valid while the sim ignores the seed.
    const real = runGame(turtle, 2, defaultData, TICKS_30_MIN);
    expect(real.captureSec).toBe(rs[0]!.captureSec);
    expect(real.shipsLost).toBe(rs[0]!.shipsLost);
  });

  it('plays rush and turtle to capture: turtle first, rush losing at least 3x the ships', () => {
    const t = runGame(turtle, 1, defaultData, TICKS_30_MIN);
    const r = runGame(rush, 1, defaultData, TICKS_30_MIN);
    expect(t.outcome).toBe('won');
    expect(r.outcome).toBe('won');
    expect(r.captureSec!).toBeGreaterThan(t.captureSec!);
    expect(r.shipsLost).toBeGreaterThanOrEqual(3 * t.shipsLost);
    expect(r.firstWaveOutcome).toBe('repelled');
  });
});
