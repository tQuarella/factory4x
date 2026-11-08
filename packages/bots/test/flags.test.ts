import { describe, expect, it } from 'vitest';
import { computeDepthFlags, layoutRows, type GameResult } from '../src/runner.ts';

const MIN = 60;
type Four = [number, number, number, number];
const NAMES = ['drones-only', 'ice-first', 'crystal-first', 'greedy'];
const LAYOUTS = ['frost', 'glass', 'twin'];

function fake(strategy: string, variantId: string, captureSec: number | null, shipsLost: number, order: string[]): GameResult {
  return {
    strategy,
    seed: LAYOUTS.indexOf(variantId) + 1,
    outcome: captureSec === null ? 'timeout' : 'won',
    variantId,
    variantName: variantId,
    captureSec,
    shipsLost,
    captureOrder: order.map((id) => ({ id, prize: null, sec: 0 })),
  } as unknown as GameResult;
}

interface Spec {
  times: Record<string, Four>;
  lost: Record<string, Four>;
  /** Greedy capture order per layout. */
  order: Record<string, string[]>;
}

const same = (v: Four): Record<string, Four> => ({ frost: v, glass: v, twin: v });
const base: Spec = {
  times: same([20 * MIN, 20 * MIN, 20 * MIN, 20 * MIN]),
  lost: same([14, 10, 10, 10]),
  order: { frost: ['p1', 'heart'], glass: ['p2', 'heart'], twin: ['p3', 'heart'] },
};

function results(over: Partial<Spec> = {}): GameResult[] {
  const s = { ...base, ...over };
  return LAYOUTS.flatMap((v) => NAMES.map((n, i) => fake(n, v, s.times[v]![i]!, s.lost[v]![i]!, n === 'greedy' ? s.order[v]! : ['p1', 'heart'])));
}
const pass = (rs: GameResult[], determinism = true) => computeDepthFlags(rs, determinism).map((f) => f.pass);
const withTimes = (layout: string, t: Four): Record<string, Four> => ({ ...base.times, [layout]: t });

describe('depth flags', () => {
  it('are six lines, and flags 1-5 need all four strategies on all three layouts', () => {
    expect(computeDepthFlags([], true)).toHaveLength(6);
    expect(pass([])).toEqual([false, false, false, false, false, true]);
    expect(pass(results().filter((r) => r.strategy !== 'greedy'))[0]).toBe(false);
  });

  it('a good set meets all but flag 4 (all ties), and flag 6 follows the determinism input', () => {
    expect(pass(results())).toEqual([true, true, true, false, true, true]);
    expect(pass(results(), false)[5]).toBe(false);
  });

  it('flag 1: the window is 15 to 45 minutes inclusive; never captured fails', () => {
    const f1 = (sec: number | null) => pass(results({ times: withTimes('twin', [sec as number, 20 * MIN, 20 * MIN, 20 * MIN]) }))[0];
    expect(f1(15 * MIN)).toBe(true);
    expect(f1(45 * MIN)).toBe(true);
    expect(f1(15 * MIN - 1)).toBe(false);
    expect(f1(45 * MIN + 1)).toBe(false);
    expect(f1(null)).toBe(false);
  });

  it('flag 2: drones-only loses 40% more ships (exactly) or captures 20% later (exactly), in every layout', () => {
    const f2 = (lost: Record<string, Four>, times: Record<string, Four> = base.times) => pass(results({ lost, times }))[1];
    expect(f2(same([14, 10, 10, 10]))).toBe(true);
    expect(f2(same([13, 10, 10, 10]))).toBe(false);
    // The best strategy is the minimum over the other three.
    expect(f2(same([14, 12, 10, 12]))).toBe(true);
    expect(f2(same([14, 11, 11, 11]))).toBe(false);
    // One layout failing the loss test is saved by capturing 20% later.
    const lost = { ...same([14, 10, 10, 10]), glass: [10, 10, 10, 10] as Four };
    expect(f2(lost)).toBe(false);
    expect(f2(lost, withTimes('glass', [24 * MIN, 20 * MIN, 20 * MIN, 20 * MIN]))).toBe(true);
    expect(f2(lost, withTimes('glass', [24 * MIN - 1, 20 * MIN, 20 * MIN, 20 * MIN]))).toBe(false);
  });

  it('flag 3: ice-first and crystal-first within 15% (of the faster) in at least 2 layouts', () => {
    const t = (frost: number, glass: number, twin: number) => ({
      frost: [20 * MIN, 20 * MIN, frost, 20 * MIN] as Four,
      glass: [20 * MIN, 20 * MIN, glass, 20 * MIN] as Four,
      twin: [20 * MIN, 20 * MIN, twin, 20 * MIN] as Four,
    });
    const f3 = (times: Record<string, Four>) => pass(results({ times }))[2];
    expect(f3(t(23 * MIN, 23 * MIN, 30 * MIN))).toBe(true); // exactly 15% twice
    expect(f3(t(23 * MIN + 1, 23 * MIN, 30 * MIN))).toBe(false);
    expect(f3(t(20 * MIN, 20 * MIN, 20 * MIN))).toBe(true);
    expect(f3(t(30 * MIN, 30 * MIN, 30 * MIN))).toBe(false);
  });

  it('flag 4: the faster of the two doors must not be the same in all three layouts; a tie is its own result', () => {
    const t = (frost: Four, glass: Four, twin: Four) => ({ frost, glass, twin });
    const iceWins: Four = [20 * MIN, 19 * MIN, 20 * MIN, 20 * MIN];
    const crystalWins: Four = [20 * MIN, 20 * MIN, 19 * MIN, 20 * MIN];
    const tie: Four = [20 * MIN, 20 * MIN, 20 * MIN, 20 * MIN];
    const f4 = (times: Record<string, Four>) => pass(results({ times }))[3];
    expect(f4(t(iceWins, iceWins, iceWins))).toBe(false);
    expect(f4(t(crystalWins, crystalWins, crystalWins))).toBe(false);
    expect(f4(t(iceWins, crystalWins, iceWins))).toBe(true);
    expect(f4(t(iceWins, iceWins, tie))).toBe(true);
  });

  it('flag 5: the greedy capture order must differ in every layout', () => {
    const f5 = (order: Record<string, string[]>) => pass(results({ order }))[4];
    expect(f5(base.order)).toBe(true);
    expect(f5({ frost: ['p1', 'heart'], glass: ['p1', 'heart'], twin: ['p3', 'heart'] })).toBe(false);
    expect(f5({ frost: ['p1', 'p2', 'heart'], glass: ['p2', 'p1', 'heart'], twin: ['p1', 'heart'] })).toBe(true);
  });

  it('the report lines carry the numbers', () => {
    const lines = computeDepthFlags(results(), true);
    expect(lines[1]!.detail).toContain('lost 14 vs best 10');
    expect(lines[4]!.detail).toContain('frost: p1 > heart');
  });
});

describe('layout rows', () => {
  it('group the lowest seed per layout, in layout order', () => {
    const rs = [{ ...fake('greedy', 'glass', 1, 1, []), seed: 1 }, { ...fake('greedy', 'glass', 2, 2, []), seed: 4 }, { ...fake('greedy', 'frost', 3, 3, []), seed: 3 }];
    expect(layoutRows(rs).map((r) => [r.variantId, r.seed, r.byStrategy['greedy']!.captureSec])).toEqual([
      ['frost', 3, 3],
      ['glass', 1, 1],
    ]);
  });
});
