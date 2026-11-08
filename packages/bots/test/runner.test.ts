import { describe, expect, it } from 'vitest';
import { defaultData, type World } from '@factory4x/sim';
import { SOFTLOCK_SEC, runGame, runSeeds } from '../src/runner.ts';
import { strategies, type Strategy } from '../src/strategies.ts';

const TICKS_30_MIN = 54000;
const dronesOnly: Strategy = strategies.find((s) => s.name === 'drones-only')!;

describe('runner', () => {
  it('reports a softlock when nothing is delivered and no ship is built for 5 game minutes', () => {
    // Yard off and no builds: probe mining alone changes the hash every tick, but nothing progresses.
    const idle: Strategy = {
      name: 'idle',
      description: '',
      decide: (w) => (w.yards.drone.on ? [{ type: 'setShipyard', shipType: 'drone', on: false }] : []),
    };
    const r = runGame(idle, 1, defaultData, TICKS_30_MIN);
    expect(r.outcome).toBe('softlock');
    expect(r.ticks).toBeGreaterThanOrEqual(SOFTLOCK_SEC * defaultData.tickRate);
    expect(r.ticks).toBeLessThan(SOFTLOCK_SEC * defaultData.tickRate + 120);
  });

  it('fires at exactly 5 game minutes after the last delivery when an economy stalls mid-game', () => {
    const STALL = 9000;
    // drones-only's yard is off and its network is delivering at the stall tick. Then the economy dies
    // (extractors, buffers and pods vanish) while probe mining continues and no ship is built.
    const stalls: Strategy = {
      name: 'stalls',
      description: '',
      decide: (w) => {
        if (w.tick < STALL) return dronesOnly.decide(w);
        const m = w as World;
        for (const n of m.nodes) {
          n.extractors = 0;
          n.buffer = 0;
        }
        for (const r of m.routes) r.pods.length = 0;
        m.queue.length = 0;
        m.activeBuild = null;
        return m.yards.drone.on ? [{ type: 'setShipyard', shipType: 'drone', on: false }] : [];
      },
    };
    const r = runGame(stalls, 1, defaultData, TICKS_30_MIN);
    expect(r.outcome).toBe('softlock');
    // Last delivery was within one pod interval (90 ticks) before the stall; the old 60 s window added 1800 ticks.
    const limit = SOFTLOCK_SEC * defaultData.tickRate;
    expect(r.ticks).toBeGreaterThanOrEqual(STALL - 90 + limit);
    expect(r.ticks).toBeLessThanOrEqual(STALL + limit + 1);
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
    const r = runGame(dronesOnly, 1, defaultData, TICKS_30_MIN);
    expect(r.outcome).toBe('won');
    expect(r.captureSec).not.toBeNull();
    expect(r.variantId).toBe('glass');
    expect(r.rootCutSec).not.toBeNull();
    expect(r.guardsWithered).toBeGreaterThan(0);
    expect(r.heartWavesSent).toBeGreaterThanOrEqual(1);
    expect(r.firstShipSec).not.toBeNull();
    for (const m of ['2', '5', '10', '12', '15', '20']) expect(r.throughputAtMin[m]).not.toBeNull();
    expect(r.peakPerMin).toBeGreaterThan(0);
    expect(r.shipsBuilt).toBeGreaterThan(0);
    expect(r.wavesSent).toBeGreaterThanOrEqual(1);
    expect(r.oreSpentShips).toBeGreaterThan(0);
    expect(r.oreSpentEconomy).toBeGreaterThan(0);
    expect(r.tickMsP95).toBeGreaterThanOrEqual(r.tickMsP50);
  });

  it('runs every seed as its own game (hashes differ because the seed is in the state)', () => {
    const rs = runSeeds(dronesOnly, 3, defaultData, TICKS_30_MIN);
    expect(rs.map((r) => r.seed)).toEqual([1, 2, 3]);
    expect(rs.map((r) => r.variantId)).toEqual(['glass', 'twin', 'frost']);
    expect(new Set(rs.map((r) => r.finalHash)).size).toBe(3);
    expect(rs[1]!.finalHash).toBe(runGame(dronesOnly, 2, defaultData, TICKS_30_MIN).finalHash);
  });

  it('reports ships and ore as of capture, with whole-run totals labelled separately', () => {
    const r = runGame(dronesOnly, 1, defaultData, TICKS_30_MIN);
    expect(r.oreSpentShips).toBeLessThan(r.wholeRun.oreSpentShips);
    expect(r.shipsBuilt).toBeLessThan(r.wholeRun.shipsBuilt);
    expect(r.shipsLost).toBeLessThanOrEqual(r.wholeRun.shipsLost);
  });

  it('plays all four strategies to the heart in every layout', () => {
    for (const st of strategies) {
      const rs = runSeeds(st, 3, defaultData, TICKS_30_MIN);
      for (const r of rs) expect(r.outcome, `${st.name} ${r.variantId}`).toBe('won');
      expect(new Set(rs.map((r) => r.variantId)).size).toBe(3);
    }
  });

  it('reports the capture order, losses by type and first deliveries', () => {
    const r = runGame(strategies.find((s) => s.name === 'ice-first')!, 3, defaultData, TICKS_30_MIN);
    expect(r.captureOrder.at(-1)!.id).toBe('heart');
    expect(r.captureOrder.at(-1)!.sec).toBe(r.captureSec);
    expect(r.captureOrder.some((c) => c.id === 'root')).toBe(true);
    const l = r.shipsLostByType;
    expect(l.drone + l.lancer + l.flak).toBe(r.shipsLost);
    expect(r.firstDeliveredSec.ice).not.toBeNull();
    expect(r.firstDeliveredSec.crystal).not.toBeNull();
  });
});
