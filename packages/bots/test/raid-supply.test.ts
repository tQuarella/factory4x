import { describe, expect, it } from 'vitest';
import { createWorld, defaultData, guardianStatus, isRootCut, rootIndex, shipCounts, step, type Input, type World } from '@factory4x/sim';
import { computeDepthFlags, runGame, type GameResult } from '../src/runner.ts';
import { bloomWave, raidSupplyDecide, rootWave, rushDecide, strategies, turtleDecide } from '../src/strategies.ts';

const N = { probe: 0, a5: 5, rich: 6, root: 7 } as const;
const raid = strategies.find((s) => s.name === 'raid-supply')!;
const TICKS = 54000;

/** A world (variant by seed) played until the economy plan is finished and the shipyard is on. */
function planned(seed: number): World {
  const w = createWorld(seed, defaultData);
  for (let i = 0; i < TICKS && !(w.shipyard.on && w.tick > 0); i++) step(w, defaultData, raidSupplyDecide(w));
  if (!w.shipyard.on) throw new Error('plan did not finish');
  return w;
}

function park(world: World, node: number, count: number): void {
  for (let i = 0; i < count; i++) world.ships.push({ id: world.nextId++, hp: 10, at: node, transit: null, engagedIn: -1 });
}

const sendsTo = (inputs: Input[], to: number): Input[] => inputs.filter((i) => i.type === 'sendShips' && i.to === to);

describe('wave sizes', () => {
  it('root wave is ceil(thorns*5/2)+5: 15, 28, 40 for 4, 9 and 14 thorns', () => {
    expect([4, 9, 14].map(rootWave)).toEqual([15, 28, 40]);
    expect(rootWave(5)).toBe(18);
  });
  it('bloom wave is ceil(thorns*9/4): 18 at 8 thorns', () => {
    expect(bloomWave(8)).toBe(18);
    expect(bloomWave(7)).toBe(16);
  });
});

describe('raid-supply decisions', () => {
  it('is a real strategy, not a stub', () => {
    expect(raid.stub).toBeUndefined();
    expect(strategies.filter((s) => s.stub).map((s) => s.name)).toEqual(['greedy-expansion']);
  });

  it('plays the same economy plan as turtle: yard off, same orders', () => {
    const w = createWorld(1, defaultData);
    expect(raidSupplyDecide(w)).toEqual(turtleDecide(w));
  });

  it('waits at the probe until the Root wave is ready, then sends every ship to the Root', () => {
    const w = planned(3);
    expect(w.rally).toBe(N.probe);
    const need = rootWave(guardianStatus(w, N.root).thorns);
    const have = shipCounts(w).at[N.probe]!;
    park(w, N.probe, Math.max(0, need - 1 - have));
    expect(sendsTo(raidSupplyDecide(w), N.root)).toEqual([]);
    park(w, N.probe, 1);
    expect(sendsTo(raidSupplyDecide(w), N.root)).toEqual([{ type: 'sendShips', from: N.probe, to: N.root, count: 0 }]);
  });

  it('sends no second wave while ships are at or heading to the Root', () => {
    const w = planned(3);
    park(w, N.probe, 60);
    step(w, defaultData, raidSupplyDecide(w));
    park(w, N.probe, 60);
    expect(sendsTo(raidSupplyDecide(w), N.root)).toEqual([]);
  });

  it('never goes for the Bloom while the Root stands', () => {
    const w = planned(3);
    park(w, N.a5, 60);
    expect(sendsTo(raidSupplyDecide(w), N.rich)).toEqual([]);
  });

  it('after the cut: rallies at a5, moves survivors there, and sends the Bloom wave only when ready', () => {
    const w = planned(3);
    park(w, N.probe, 20);
    for (let i = 0; i < 4000 && !isRootCut(w); i++) step(w, defaultData, raidSupplyDecide(w));
    expect(isRootCut(w)).toBe(true);
    expect(rootIndex(w)).toBe(N.root);
    const inputs = raidSupplyDecide(w);
    expect(inputs).toContainEqual({ type: 'setRally', node: N.a5 });
    expect(inputs).toContainEqual({ type: 'sendShips', from: N.root, to: N.a5, count: 0 });
    expect(sendsTo(inputs, N.rich)).toEqual([]);
    // Settle: survivors have moved, then hand-park a wave one short of ready and then ready.
    for (let i = 0; i < 100; i++) step(w, defaultData, raidSupplyDecide(w));
    const thorns = guardianStatus(w, N.rich).thorns;
    const need = bloomWave(thorns);
    // Hand-built: clear a5, then park one ship short of the wave.
    w.ships = w.ships.filter((s) => s.at !== N.a5 || s.transit !== null);
    park(w, N.a5, need - 1);
    expect(sendsTo(raidSupplyDecide(w), N.rich)).toEqual([]);
    park(w, N.a5, 1);
    expect(sendsTo(raidSupplyDecide(w), N.rich)).toEqual([{ type: 'sendShips', from: N.a5, to: N.rich, count: 0 }]);
  });
});

describe('raid-supply over a run', () => {
  it('cuts the Root, then captures the Bloom, on knotted, deep and thin', () => {
    const variants = ['knotted', 'deep', 'thin'];
    for (const seed of [1, 2, 3]) {
      const r = runGame(raid, seed, defaultData, TICKS);
      expect(r.variantId).toBe(variants[seed - 1]);
      expect(r.outcome).toBe('won');
      expect(r.rootCutSec).not.toBeNull();
      expect(r.rootCutSec!).toBeLessThan(r.captureSec!);
      expect(r.rootWavesSent).toBeGreaterThanOrEqual(1);
      expect(r.thornsWithered).toBeGreaterThan(0);
    }
  });

  it('counts a repelled Root wave in addition to the Bloom waves (per-node battle tracking)', () => {
    const base = runGame({ name: 'rush', description: '', decide: rushDecide }, 1, defaultData, TICKS);
    // Rush plus one small, doomed wave at the Root before its first Bloom wave.
    let sent = false;
    const withRoot = {
      name: 'rush+root',
      description: '',
      decide: (w: Readonly<World>): Input[] => {
        const inputs = rushDecide(w);
        if (!sent && shipCounts(w).at[N.probe]! >= 3) {
          sent = true;
          return [...inputs.filter((i) => i.type !== 'sendShips'), { type: 'sendShips', from: N.probe, to: N.root, count: 3 }];
        }
        return inputs;
      },
    };
    const r = runGame(withRoot, 1, defaultData, TICKS);
    expect(r.rootWavesSent).toBe(1);
    // Every wave but the capturing one was repelled; a Root battle must not hide a Bloom one.
    expect(r.wavesRepelled).toBe(r.wavesSent - 1);
    expect(base.wavesRepelled).toBe(base.wavesSent - 1);
  });
});

function res(strategy: string, variantId: string, captureSec: number | null, shipsLost: number): GameResult {
  return { strategy, variantId, captureSec, shipsLost, wavesSent: 1 } as GameResult;
}

function set(turtle: [number | null, number][], raidS: [number | null, number][]): GameResult[] {
  const ids = ['knotted', 'deep', 'thin'];
  return [
    ...ids.map((id, i) => res('turtle', id, turtle[i]![0], turtle[i]![1])),
    ...ids.map((id, i) => res('raid-supply', id, raidS[i]![0], raidS[i]![1])),
  ];
}

const T588: [number, number][] = [[588, 5], [588, 5], [588, 5]];
const byName = (rs: GameResult[], start: string) => computeDepthFlags(rs).find((f) => f.name.startsWith(start))!;

describe('depth flags', () => {
  it('are all met for the intended shape', () => {
    const rs = set([[588, 11], [588, 11], [588, 11]], [[570, 14], [636, 17], [534, 11]]);
    expect(computeDepthFlags(rs).map((f) => f.pass)).toEqual([true, true, true, true, true, true]);
  });

  it('capture window is 8-13 min inclusive; a missing capture fails', () => {
    expect(byName(set(T588, [[479, 1], [588, 1], [588, 1]]), 'both').pass).toBe(false);
    expect(byName(set(T588, [[781, 1], [588, 1], [588, 1]]), 'both').pass).toBe(false);
    expect(byName(set(T588, [[480, 1], [780, 1], [588, 1]]), 'both').pass).toBe(true);
    expect(byName(set(T588, [[588, 1], [588, 1], [null, 1]]), 'both').pass).toBe(false);
  });

  it('thin and deep need a 30 s gap in the right direction', () => {
    const rs = (thinRaid: number, deepRaid: number) => set(T588, [[588, 5], [deepRaid, 5], [thinRaid, 5]]);
    expect(byName(rs(558, 618), 'thin').pass).toBe(true);
    expect(byName(rs(559, 618), 'thin').pass).toBe(false);
    expect(byName(rs(558, 618), 'deep').pass).toBe(true);
    expect(byName(rs(558, 617), 'deep').pass).toBe(false);
  });

  it('knotted tolerates 45 s either way, not 46', () => {
    const rs = (k: number) => set(T588, [[k, 5], [588, 5], [588, 5]]);
    expect(byName(rs(543), 'knotted').pass).toBe(true);
    expect(byName(rs(633), 'knotted').pass).toBe(true);
    expect(byName(rs(634), 'knotted').pass).toBe(false);
    expect(byName(rs(542), 'knotted').pass).toBe(false);
  });

  it('flags strict dominance: one strategy at least as good on time and losses everywhere', () => {
    const f = byName(set(T588, [[500, 4], [500, 4], [500, 4]]), 'no dominance');
    expect(f.pass).toBe(false);
    expect(f.detail).toContain('strict dominance: raid-supply');
  });

  it('also requires each to capture first somewhere and turtle to lose fewer somewhere', () => {
    expect(byName(set([[600, 9], [560, 9], [600, 9]], [[560, 4], [600, 4], [560, 4]]), 'no dominance').pass).toBe(false);
    expect(byName(set([[600, 3], [560, 9], [600, 9]], [[560, 4], [600, 4], [560, 4]]), 'no dominance').pass).toBe(true);
  });

  it('turtle regression: 588 s +/- 10 and exactly one wave', () => {
    const mk = (c: number, waves = 1): GameResult[] =>
      set([[c, 5], [588, 5], [588, 5]], T588).map((r) => (r.strategy === 'turtle' ? { ...r, wavesSent: waves } : r));
    expect(byName(mk(598), 'turtle matches').pass).toBe(true);
    expect(byName(mk(599), 'turtle matches').pass).toBe(false);
    expect(byName(mk(578), 'turtle matches').pass).toBe(true);
    expect(byName(mk(577), 'turtle matches').pass).toBe(false);
    expect(byName(mk(588, 2), 'turtle matches').pass).toBe(false);
  });
});
