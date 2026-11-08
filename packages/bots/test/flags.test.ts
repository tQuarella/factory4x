import { describe, expect, it } from 'vitest';
import { computeH5Flags, lancerSharePct, type CampaignResult, type FlagContext } from '../src/runner.ts';
import type { HeartProbe } from '../src/waves.ts';

const TR = 30;
const MIN = 60 * TR;
const SEEDS = 3;
const ctx: FlagContext = {
  tickRate: TR,
  tiers: { landfall: 0, shelf: 1, shoal: 1, veil: 2, garden: 2, deep: 3 },
  limits: { l0: 12, l1: 18, l2: 24 },
  seeds: SEEDS,
};

const buy = (item: string) => ({ item, level: 1, tick: 0, playTicks: 0 });

function run(strategy: string, seed: number, extra: Partial<CampaignResult> = {}): CampaignResult {
  return { strategy, seed, outcome: 'won', playTicks: 60 * MIN, reclaimOrder: ['landfall', 'shelf', 'veil', 'deep'], research: [buy('core')], ...extra } as unknown as CampaignResult;
}

/** A healthy set of runs: the three winners win, no-command and drones-only stall on tier 1. */
function runs(tweak: (r: CampaignResult) => CampaignResult = (r) => r): CampaignResult[] {
  const out: CampaignResult[] = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    for (const s of ['composer', 'ice-first', 'crystal-first']) out.push(tweak(run(s, seed)));
    out.push(tweak(run('no-command', seed, { outcome: 'softlock', reclaimOrder: ['landfall', 'shelf'], research: [buy('opening')] })));
    out.push(tweak(run('drones-only', seed, { outcome: 'softlock', reclaimOrder: ['landfall', 'shelf', 'shoal'], research: [] })));
    out.push(tweak(run('greedy', seed)));
  }
  return out;
}

const row = (area: string, tier: number, state: 'fed' | 'starved', d: number | null, l: number | null, f: number | null, mix: number | null, fleet: [number, number, number] | null, extra: Partial<HeartProbe> = {}): HeartProbe => ({
  area,
  tier,
  state,
  layout: area === 'deep' ? 'Glass Thicket' : null,
  seed: 1,
  drones: d,
  lancers: l,
  flak: f,
  buildable: ['drone', 'lancer', 'flak'],
  mix,
  mixFleet: fleet === null ? null : { drone: fleet[0], lancer: fleet[1], flak: fleet[2] },
  ...extra,
});

/** Probe rows that meet every window, with an ice-side medium (flak share 0%) and a crystal-side one (lancer share 100%). */
function goodProbe(): HeartProbe[] {
  const rows: HeartProbe[] = [
    row('shelf', 1, 'fed', 9, 12, 8, 7, [2, 0, 5]),
    row('shoal', 1, 'fed', 10, 8, 14, 7, [2, 5, 0]),
    row('veil', 2, 'fed', 40, 30, 20, 16, [0, 0, 16]),
    row('veil', 2, 'starved', 20, 15, 9, 7, [0, 0, 7]),
    row('garden', 2, 'fed', 50, 20, 30, 16, [0, 16, 0]),
    row('garden', 2, 'starved', 25, 9, 14, 8, [0, 8, 0]),
  ];
  for (let seed = 1; seed <= SEEDS; seed++) {
    rows.push(row('deep', 3, 'fed', 60, 30, 40, 22, [0, 12, 10], { seed }));
    rows.push(row('deep', 3, 'starved', 30, 14, 20, 14, [0, 10, 4], { seed }));
  }
  return rows;
}

const flagsOf = (rs: CampaignResult[] = runs(), probe: HeartProbe[] | null = goodProbe(), det = true) => computeH5Flags(rs, probe, ctx, det, 'x');
const pass = (rs: CampaignResult[] = runs(), probe: HeartProbe[] | null = goodProbe(), det = true): boolean[] => flagsOf(rs, probe, det).map((f) => f.pass);
const withRows = (edit: (rows: HeartProbe[]) => HeartProbe[]): HeartProbe[] => edit(goodProbe());
const setRow = (rows: HeartProbe[], area: string, state: string, patch: Partial<HeartProbe>): HeartProbe[] =>
  rows.map((r) => (r.area === area && r.state === state ? { ...r, ...patch } : r));

describe('H5 flags', () => {
  it('reports seven flags, all met on a healthy set of results and probe rows', () => {
    const f = flagsOf();
    expect(f).toHaveLength(7);
    expect(f.map((x) => x.pass)).toEqual([true, true, true, true, true, true, true]);
  });

  it('every flag is a capability line: no flag reads a time gap between strategies', () => {
    // The same wins at any pace keep every flag but the 120-minute ceiling of flag 1.
    const slow = pass(runs((r) => ({ ...r, playTicks: 110 * MIN }) as CampaignResult));
    expect(slow).toEqual([true, true, true, true, true, true, true]);
    const fast = pass(runs((r) => ({ ...r, playTicks: 20 * MIN }) as CampaignResult));
    expect(fast).toEqual([true, true, true, true, true, true, true]);
  });

  it('flag 1: composer, ice-first and crystal-first must buy the core within 120 minutes on every seed; the stalled strategies do not count', () => {
    expect(pass()[0]).toBe(true);
    expect(pass(runs((r) => (r.strategy === 'ice-first' && r.seed === 2 ? ({ ...r, outcome: 'softlock' } as CampaignResult) : r)))[0]).toBe(false);
    expect(pass(runs((r) => (r.strategy === 'crystal-first' ? ({ ...r, outcome: 'timeout' } as CampaignResult) : r)))[0]).toBe(false);
    expect(pass(runs((r) => (r.strategy === 'composer' && r.seed === 1 ? ({ ...r, playTicks: 121 * MIN } as CampaignResult) : r)))[0]).toBe(false);
    // drones-only and no-command stalling is expected, and greedy (the reference) is not covered either.
    expect(pass(runs((r) => (r.strategy === 'greedy' ? ({ ...r, outcome: 'softlock' } as CampaignResult) : r)))[0]).toBe(true);
    // A missing run is a miss.
    expect(pass(runs().filter((r) => !(r.strategy === 'composer' && r.seed === 3)))[0]).toBe(false);
  });

  it('flag 2: tier 2 starved hearts are closed to drones at L1, tier 3 starved at L2 (closed means above the limit)', () => {
    expect(pass()[1]).toBe(true);
    // Veil starved drones 18 = L1: not above it, so not closed.
    expect(pass(runs(), withRows((r) => setRow(r, 'veil', 'starved', { drones: 18 })))[1]).toBe(false);
    expect(pass(runs(), withRows((r) => setRow(r, 'veil', 'starved', { drones: 19 })))[1]).toBe(true);
    // No drone win within the search counts as closed.
    expect(pass(runs(), withRows((r) => setRow(r, 'garden', 'starved', { drones: null })))[1]).toBe(true);
    // A Deep layout open to 24 drones is not closed at L2.
    expect(pass(runs(), withRows((r) => r.map((x) => (x.area === 'deep' && x.state === 'starved' && x.seed === 2 ? { ...x, drones: 24 } : x))))[1]).toBe(false);
  });

  it('flag 2: drones-only must reclaim no tier 2 or tier 3 area on any seed', () => {
    expect(pass(runs((r) => (r.strategy === 'drones-only' && r.seed === 3 ? ({ ...r, reclaimOrder: ['landfall', 'shelf', 'veil'] } as CampaignResult) : r)))[1]).toBe(false);
    expect(pass(runs((r) => (r.strategy === 'drones-only' ? ({ ...r, reclaimOrder: ['landfall', 'shelf', 'shoal', 'deep'] } as CampaignResult) : r)))[1]).toBe(false);
    expect(pass(runs().filter((r) => r.strategy !== 'drones-only'))[1]).toBe(false);
  });

  it('flag 3: tier 1 fits at L0 with drones, tier 2 starved at L0 and fed at L1, tier 3 starved at L1 and fed at L2 (fits means at most L - 2)', () => {
    expect(pass()[2]).toBe(true);
    expect(pass(runs(), withRows((r) => setRow(r, 'shelf', 'fed', { drones: 11 })))[2]).toBe(false);
    expect(pass(runs(), withRows((r) => setRow(r, 'shelf', 'fed', { drones: 10 })))[2]).toBe(true);
    expect(pass(runs(), withRows((r) => setRow(r, 'veil', 'starved', { mix: 11 })))[2]).toBe(false);
    expect(pass(runs(), withRows((r) => setRow(r, 'garden', 'fed', { mix: 17 })))[2]).toBe(false);
    expect(pass(runs(), withRows((r) => setRow(r, 'deep', 'starved', { mix: 17 })))[2]).toBe(false);
    expect(pass(runs(), withRows((r) => setRow(r, 'deep', 'fed', { mix: 23 })))[2]).toBe(false);
    expect(pass(runs(), withRows((r) => setRow(r, 'deep', 'fed', { mix: null, mixFleet: null })))[2]).toBe(false);
  });

  it('flag 4: no single type fits a medium fed heart at L1, and the best mix does', () => {
    expect(pass()[3]).toBe(true);
    // Flak alone at 16 fits at L1 (16 <= 16): the mix is not needed.
    expect(pass(runs(), withRows((r) => setRow(r, 'veil', 'fed', { flak: 16 })))[3]).toBe(false);
    expect(pass(runs(), withRows((r) => setRow(r, 'veil', 'fed', { flak: 17 })))[3]).toBe(true);
    // The mix not fitting is a miss too.
    expect(pass(runs(), withRows((r) => setRow(r, 'garden', 'fed', { mix: 17 })))[3]).toBe(false);
  });

  it('flag 5: medium fed hearts closed at L0, Deep fed closed at L1 and fitting at L2, and no-command never buys the core', () => {
    expect(pass()[4]).toBe(true);
    expect(pass(runs(), withRows((r) => setRow(r, 'veil', 'fed', { mix: 12 })))[4]).toBe(false); // fits-or-open at L0: 12 is not above L0
    expect(pass(runs(), withRows((r) => setRow(r, 'veil', 'fed', { mix: 13 })))[4]).toBe(true);
    expect(pass(runs(), withRows((r) => setRow(r, 'deep', 'fed', { mix: 18 })))[4]).toBe(false); // not above L1
    expect(pass(runs(), withRows((r) => setRow(r, 'deep', 'fed', { mix: 23 })))[4]).toBe(false); // does not fit at L2
    expect(pass(runs(), withRows((r) => setRow(r, 'deep', 'fed', { mix: 22 })))[4]).toBe(true);
    expect(pass(runs((r) => (r.strategy === 'no-command' && r.seed === 2 ? ({ ...r, research: [buy('core')] } as unknown as CampaignResult) : r)))[4]).toBe(false);
  });

  it('flag 6: on every seed two tier 2 or 3 hearts differ by at least 30 points of lancer share', () => {
    expect(lancerSharePct(row('x', 2, 'fed', 1, 1, 1, 10, [0, 3, 7]))).toBe(30);
    expect(lancerSharePct(row('x', 2, 'fed', 1, 1, 1, null, null))).toBeNull();
    expect(pass()[5]).toBe(true);
    // Every tier 2 or 3 heart at the same share: no spread.
    const flat = withRows((r) => r.map((x) => (x.tier >= 2 ? { ...x, mix: 10, mixFleet: { drone: 0, lancer: 5, flak: 5 } } : x)));
    expect(pass(runs(), flat)[5]).toBe(false);
    // A 29 point spread misses, 30 meets.
    const spread = (pct: number): HeartProbe[] =>
      withRows((r) => r.map((x) => (x.tier >= 2 ? { ...x, mix: 100, mixFleet: { drone: 0, lancer: x.area === 'garden' ? 20 + pct : 20, flak: 80 - (x.area === 'garden' ? pct : 0) } } : x)));
    expect(pass(runs(), spread(29))[5]).toBe(false);
    expect(pass(runs(), spread(30))[5]).toBe(true);
    // One seed's Deep layout can be the spread: only that seed's row counts for that seed.
    const onlySeed2 = withRows((r) => r.map((x) => (x.tier >= 2 ? { ...x, mix: 10, mixFleet: { drone: 0, lancer: 5, flak: 5 } } : x)).map((x) => (x.area === 'deep' && x.seed === 2 ? { ...x, mixFleet: { drone: 0, lancer: 10, flak: 0 } } : x)));
    expect(pass(runs(), onlySeed2)[5]).toBe(false);
  });

  it('flag 7: determinism passes only when the caller says so', () => {
    expect(pass(runs(), goodProbe(), false)[6]).toBe(false);
  });

  it('without a probe the probe flags are missed, and flag 1 and 7 still stand', () => {
    const p = pass(runs(), null);
    expect(p).toEqual([true, false, false, false, false, false, true]);
  });
});
