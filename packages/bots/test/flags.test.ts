import { describe, expect, it } from 'vitest';
import { computeH4Flags, type CampaignResult, type Flag4Probes, type Visit } from '../src/runner.ts';

const TR = 30;
const MIN = 60 * TR;
const SEEDS = 3;
const NAMES = ['ice-line', 'crystal-line', 'full-kit', 'greedy', 'no-research'];
const data = { tickRate: TR };

/** Reclaim visits at the spec's mid-window times; `openings` overrides an area's opening ticks. */
function visits(order: string[], openings: Record<string, number | null> = {}): Visit[] {
  const mid: Record<string, number> = { landfall: 0.3, shelf: 6, shoal: 6, veil: 9, garden: 9, deep: 12 };
  const open: Record<string, number> = { landfall: -1, shelf: 120, shoal: 120, veil: 80, garden: 80, deep: 56 };
  return order.map((area) => ({
    area,
    startTick: 0,
    playTicks: Math.floor(mid[area]! * MIN),
    result: 'reclaimed' as const,
    openingTicks: area in openings ? openings[area]! : open[area] === -1 ? null : open[area]! * TR,
    shipsBuilt: 0,
    shipsLost: 0,
  }));
}

function fake(strategy: string, seed: number, minutes: number, order: string[], extra: Partial<CampaignResult> = {}): CampaignResult {
  return {
    strategy,
    seed,
    outcome: 'won',
    playTicks: Math.floor(minutes * MIN),
    visits: visits(order),
    reclaimOrder: order,
    ...extra,
  } as unknown as CampaignResult;
}

const ORDERS: Record<string, string[]> = {
  'ice-line': ['landfall', 'shelf', 'veil', 'deep'],
  'crystal-line': ['landfall', 'shoal', 'garden', 'deep'],
  'full-kit': ['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep'],
  greedy: ['landfall', 'shelf', 'veil', 'shoal', 'garden', 'deep'],
  'no-research': ['landfall', 'shelf', 'veil', 'shoal', 'garden', 'deep'],
};
const TIMES: Record<string, number> = { 'ice-line': 55, 'crystal-line': 58, 'full-kit': 52, greedy: 54, 'no-research': 80 };

function all(times: Record<string, number> = TIMES, tweak: (r: CampaignResult) => CampaignResult = (r) => r): CampaignResult[] {
  const out: CampaignResult[] = [];
  for (let seed = 1; seed <= SEEDS; seed++) for (const n of NAMES) out.push(tweak(fake(n, seed, times[n]!, ORDERS[n]!)));
  return out;
}

const GOOD_PROBES: Flag4Probes = { veilFlak: 600 * TR, veilLancer: 800 * TR, gardenLancer: 600 * TR, gardenFlak: 800 * TR };
const flagsOf = (rs: CampaignResult[], probes: Flag4Probes | null = GOOD_PROBES, det = true) => computeH4Flags(rs, probes, data, SEEDS, det, 'x');
const pass = (rs: CampaignResult[], probes: Flag4Probes | null = GOOD_PROBES, det = true): boolean[] => flagsOf(rs, probes, det).map((f) => f.pass);

describe('H4 flags', () => {
  it('reports seven flags, all met on a healthy set of results', () => {
    const f = flagsOf(all());
    expect(f).toHaveLength(7);
    expect(f.map((x) => x.pass)).toEqual([true, true, true, true, true, true, true]);
  });

  it('flag 1: a strategy that does not buy the core, or buys it past 120 minutes, fails', () => {
    expect(pass(all())[0]).toBe(true);
    expect(pass(all(TIMES, (r) => (r.strategy === 'greedy' && r.seed === 2 ? ({ ...r, outcome: 'softlock' } as CampaignResult) : r)))[0]).toBe(false);
    expect(pass(all(TIMES, (r) => (r.strategy === 'greedy' ? ({ ...r, outcome: 'timeout' } as CampaignResult) : r)))[0]).toBe(false);
    expect(pass(all({ ...TIMES, 'no-research': 121 }))[0]).toBe(false);
  });

  it('flag 2: the best full run is 45-75 minutes on every seed, and mean area times are inside their windows', () => {
    const fastest = (m: number) => all({ 'ice-line': 60, 'crystal-line': 60, 'full-kit': m, greedy: 60, 'no-research': 80 });
    expect(pass(fastest(45))[1]).toBe(true);
    expect(pass(fastest(44.9))[1]).toBe(false);
    expect(pass(fastest(75))[1]).toBe(true);
    // Every researching strategy under 45 minutes: the best is outside.
    expect(pass(all({ 'ice-line': 40, 'crystal-line': 41, 'full-kit': 42, greedy: 43, 'no-research': 80 }))[1]).toBe(false);
    // Every strategy over 75.
    expect(pass(all({ 'ice-line': 76, 'crystal-line': 77, 'full-kit': 78, greedy: 79, 'no-research': 90 }))[1]).toBe(false);
    // The Deep mean at 17 minutes is over its 16 minute window.
    const slowDeep = all(TIMES, (r) => ({ ...r, visits: r.visits.map((v) => (v.area === 'deep' ? { ...v, playTicks: 17 * MIN } : v)) }) as CampaignResult);
    expect(pass(slowDeep)[1]).toBe(false);
    // Landfall at 61 s is over its minute.
    const slowLanding = all(TIMES, (r) => ({ ...r, visits: r.visits.map((v) => (v.area === 'landfall' ? { ...v, playTicks: 61 * TR } : v)) }) as CampaignResult);
    expect(pass(slowLanding)[1]).toBe(false);
  });

  it('flag 3: ice-line and crystal-line within 15% on at least 2 of 3 seeds', () => {
    expect(pass(all({ ...TIMES, 'ice-line': 50, 'crystal-line': 57 }))[2]).toBe(true); // 14%
    expect(pass(all({ ...TIMES, 'ice-line': 50, 'crystal-line': 58 }))[2]).toBe(false); // 16%
    // Only one seed close.
    const one = all(TIMES, (r) => (r.strategy === 'crystal-line' && r.seed !== 1 ? ({ ...r, playTicks: 70 * MIN } as CampaignResult) : r));
    expect(pass(one)[2]).toBe(false);
    // Two of three close.
    const two = all(TIMES, (r) => (r.strategy === 'crystal-line' && r.seed === 3 ? ({ ...r, playTicks: 70 * MIN } as CampaignResult) : r));
    expect(pass(two)[2]).toBe(true);
  });

  it('flag 4: each design must be at least 20% faster on its own medium', () => {
    expect(pass(all(), GOOD_PROBES)[3]).toBe(true);
    expect(pass(all(), { ...GOOD_PROBES, veilFlak: 640 * TR })[3]).toBe(true); // exactly 20%
    expect(pass(all(), { ...GOOD_PROBES, veilFlak: 641 * TR })[3]).toBe(false);
    expect(pass(all(), { ...GOOD_PROBES, gardenLancer: 641 * TR })[3]).toBe(false);
    // Flags the wrong way round.
    expect(pass(all(), { ...GOOD_PROBES, veilFlak: 800 * TR, veilLancer: 600 * TR })[3]).toBe(false);
    // A slower run that never finished counts as infinitely slow; a faster one that never finished fails.
    expect(pass(all(), { ...GOOD_PROBES, veilLancer: null })[3]).toBe(true);
    expect(pass(all(), { ...GOOD_PROBES, gardenLancer: null })[3]).toBe(false);
    expect(pass(all(), null)[3]).toBe(false);
  });

  it('flag 5: no-research at least 25% slower than the best, and openings shrink to 60%', () => {
    expect(pass(all({ ...TIMES, 'full-kit': 52, 'no-research': 65 }))[4]).toBe(true); // exactly 25%
    expect(pass(all({ ...TIMES, 'full-kit': 52, 'no-research': 64 }))[4]).toBe(false);
    // Last-area opening at 72 s against 120 s is exactly 60%; one second more fails.
    const withOpening = (ticks: number) => all(TIMES, (r) => ({ ...r, visits: visits(r.reclaimOrder, { deep: ticks, veil: ticks, shelf: 120 * TR, shoal: 120 * TR }) }) as CampaignResult);
    expect(pass(withOpening(72 * TR))[4]).toBe(true);
    expect(pass(withOpening(72 * TR + 1))[4]).toBe(false);
    // An opening the last area never reached cannot be compared.
    expect(pass(withOpening(null as unknown as number))[4]).toBe(false);
  });

  it('flag 6: at least two different area orders within 15% of the best on every seed', () => {
    // greedy and no-research share an order, so ice-line, crystal-line, full-kit and greedy give 4 orders.
    expect(pass(all({ 'ice-line': 50, 'crystal-line': 52, 'full-kit': 53, greedy: 54, 'no-research': 80 }))[5]).toBe(true);
    // Everything else more than 15% behind the best.
    expect(pass(all({ 'ice-line': 50, 'crystal-line': 60, 'full-kit': 61, greedy: 62, 'no-research': 80 }))[5]).toBe(false);
    // Two strategies within 15% but with the same order count once.
    const same = all({ 'ice-line': 50, 'crystal-line': 60, 'full-kit': 61, greedy: 52, 'no-research': 53 });
    expect(pass(same)[5]).toBe(true); // ice-line's order and greedy's order
    const oneOrder = all({ 'ice-line': 60, 'crystal-line': 61, 'full-kit': 62, greedy: 50, 'no-research': 52 });
    expect(pass(oneOrder)[5]).toBe(false); // greedy and no-research share an order
  });

  it('flag 7: follows the determinism result', () => {
    expect(pass(all(), GOOD_PROBES, true)[6]).toBe(true);
    expect(pass(all(), GOOD_PROBES, false)[6]).toBe(false);
  });

  it('writes a detail line for every flag', () => {
    for (const f of flagsOf(all())) expect(f.detail.length).toBeGreaterThan(0);
  });
});
