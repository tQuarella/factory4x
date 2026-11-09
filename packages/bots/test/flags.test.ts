import { describe, expect, it } from 'vitest';
import { computeH6Flags, gateFailures, isMixedWave, lancerSharePct, type CampaignResult, type FlagContext, type TrialResult, type Visit } from '../src/runner.ts';
import type { HeartProbe } from '../src/waves.ts';

// Premises, all explicit: limits 12 / 20 / 28, three seeds, a map with a plain band 2 (veil), a band 2 relay (mire) and The Deep.
const TR = 30;
const MIN = 60 * TR;
const SEEDS = 3;
const ctx: FlagContext = {
  tickRate: TR,
  tiers: { landfall: 0, shelf: 1, shoal: 1, rime: 1, glint: 1, veil: 2, garden: 2, mire: 2, spire: 2, deep: 3 },
  relays: ['rime', 'glint', 'mire', 'spire'],
  limits: { l0: 12, l1: 20, l2: 28 },
  seeds: SEEDS,
};

const buy = (item: string) => ({ item, level: 1, tick: 0, playTicks: 0 });

/** A reclaiming visit with a capturing wave (d/l/f) under `limit`. */
const visit = (area: string, wave: [number, number, number] | null, limit: number | null): Visit =>
  ({
    area,
    result: 'reclaimed',
    limit,
    wave: wave === null ? null : { drone: wave[0], lancer: wave[1], flak: wave[2] },
  }) as unknown as Visit;

/** The healthy winner: mire at L20 with 16 ships, 25% drones; The Deep at L28 with 24 ships. */
const winVisits = (): Visit[] => [visit('landfall', [1, 0, 0], 12), visit('mire', [4, 6, 6], 20), visit('deep', [6, 9, 9], 28)];

function run(strategy: string, seed: number, extra: Partial<CampaignResult> = {}): CampaignResult {
  return {
    strategy,
    seed,
    outcome: 'won',
    playTicks: 60 * MIN,
    reclaimOrder: ['landfall', 'shelf', 'rime', 'mire', 'deep'],
    skipped: ['shoal', 'glint', 'veil', 'garden', 'spire'],
    visits: winVisits(),
    research: [buy('core')],
    ...extra,
  } as unknown as CampaignResult;
}

/** Healthy runs: the three winners differ by one area per strategy; drones-only and cap-off stall or win and are not winners for the flags. */
function runs(tweak: (r: CampaignResult) => CampaignResult = (r) => r): CampaignResult[] {
  const out: CampaignResult[] = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    out.push(tweak(run('composer', seed)));
    out.push(tweak(run('ice-first', seed, { reclaimOrder: ['landfall', 'shelf', 'rime', 'mire', 'deep', 'veil'], skipped: ['shoal', 'glint', 'garden', 'spire'] })));
    out.push(tweak(run('crystal-first', seed, { reclaimOrder: ['landfall', 'shoal', 'glint', 'spire', 'deep'], skipped: ['shelf', 'rime', 'veil', 'garden', 'mire'] })));
    out.push(tweak(run('drones-only', seed, { outcome: 'softlock', reclaimOrder: ['landfall', 'shelf'], research: [], visits: [] })));
  }
  return out;
}

const row = (area: string, tier: number, mix: number | null, extra: Partial<HeartProbe> = {}): HeartProbe => ({
  area,
  tier,
  state: 'fed',
  relay: false,
  layout: area === 'deep' ? 'Glass Thicket' : null,
  seed: 1,
  drones: 40,
  lancers: 30,
  flak: 20,
  buildable: ['drone', 'lancer', 'flak'],
  mix,
  mixFleet: null,
  ...extra,
});

/** Probe rows that meet flag 2: band 2 hearts need 16 (closed at 12, fit at 20), every Deep layout needs 24 (closed at 20, fit at 28). */
function goodProbe(): HeartProbe[] {
  const rows = [row('shelf', 1, 7), row('veil', 2, 16), row('mire', 2, 16, { relay: true })];
  for (let seed = 1; seed <= SEEDS; seed++) rows.push(row('deep', 3, 24, { seed }));
  return rows;
}

const trial = (kind: TrialResult['kind'], area: string, reclaimed = false, seed = 1): TrialResult => ({
  kind,
  area,
  seed,
  limit: kind === 'deep-l1' ? 20 : 12,
  expectedLimit: kind === 'deep-l1' ? 20 : 12,
  reclaimed,
  result: reclaimed ? 'reclaimed' : 'timeout',
  playTicks: 30 * MIN,
});
const goodTrials = (): TrialResult[] => [trial('band2-l0', 'veil'), trial('band2-l0', 'mire'), trial('deep-l1', 'deep'), trial('relay-drones', 'rime'), trial('relay-drones', 'glint')];

const flagsOf = (rs: CampaignResult[] = runs(), probe: HeartProbe[] | null = goodProbe(), trials: TrialResult[] | null = goodTrials(), det = true) =>
  computeH6Flags(rs, probe, trials, ctx, det, 'x');
const pass = (...args: Parameters<typeof flagsOf>): boolean[] => flagsOf(...args).map((f) => f.pass);
const only = (i: number): boolean[] => [0, 1, 2, 3, 4, 5, 6].map((k) => k !== i);

describe('H6 flags', () => {
  it('reports seven flags, all met on a healthy set of results, probe rows and trials', () => {
    const f = flagsOf();
    expect(f).toHaveLength(7);
    expect(f.map((x) => x.pass)).toEqual([true, true, true, true, true, true, true]);
  });

  it('no flag reads a time gap: the same wins at any pace keep every flag but the 120-minute ceiling of flag 1', () => {
    expect(pass(runs((r) => ({ ...r, playTicks: 110 * MIN }) as CampaignResult))).toEqual([true, true, true, true, true, true, true]);
    expect(pass(runs((r) => ({ ...r, playTicks: 130 * MIN }) as CampaignResult))).toEqual([false, true, true, true, true, true, true]);
  });

  it('flag 1: a winner that does not buy the core, or a missing run, fails it', () => {
    expect(pass(runs((r) => (r.strategy === 'composer' && r.seed === 2 ? ({ ...r, outcome: 'timeout' } as CampaignResult) : r)))[0]).toBe(false);
    expect(pass(runs().filter((r) => !(r.strategy === 'ice-first' && r.seed === 3)))[0]).toBe(false);
  });

  it('flag 2: a band 2 heart that fits at L0, or a Deep layout that fits at L1, or one that fits at no limit, fails it', () => {
    const edit = (area: string, mix: number | null, seed = 1): HeartProbe[] => goodProbe().map((r) => (r.area === area && r.seed === seed ? { ...r, mix } : r));
    expect(pass(undefined, edit('veil', 12))[1]).toBe(false); // open at L0
    expect(pass(undefined, edit('veil', 12))[1]).toBe(false);
    expect(pass(undefined, edit('veil', 13))[1]).toBe(true);
    expect(pass(undefined, edit('veil', 19))[1]).toBe(false); // does not fit at L1 (needs <= 18)
    expect(pass(undefined, edit('deep', 20, 2))[1]).toBe(false); // open at L1 on one layout
    expect(pass(undefined, edit('deep', 27, 3))[1]).toBe(false); // does not fit at L2
    expect(pass(undefined, edit('deep', null, 3))[1]).toBe(false);
    expect(pass(undefined, null)[1]).toBe(false);
    expect(pass(undefined, [])[1]).toBe(false);
  });

  it('flag 3: a reclaimed trial, a kind with no trials, or trials not run fail it', () => {
    expect(pass(undefined, undefined, [...goodTrials().slice(1), trial('band2-l0', 'veil', true)])[2]).toBe(false);
    expect(pass(undefined, undefined, goodTrials().filter((t) => t.kind !== 'relay-drones'))[2]).toBe(false);
    expect(pass(undefined, undefined, [...goodTrials().slice(0, 4), trial('relay-drones', 'glint', true)])[2]).toBe(false);
    expect(pass(undefined, undefined, null)[2]).toBe(false);
    expect(flagsOf(undefined, undefined, null)[2]!.detail).toContain('not run');
  });

  it('flag 4: a capturing wave of one counter type fails it (a single-type wave), and 30% is the line', () => {
    const wave = (w: [number, number, number]) => runs((r) => ({ ...r, visits: [visit('mire', w, 20), visit('deep', w, 28)] }) as CampaignResult);
    expect(pass(wave([0, 16, 0]))[3]).toBe(false); // all lancers
    expect(pass(wave([6, 10, 0]))[3]).toBe(false); // lancers and drones, no flak
    expect(pass(wave([10, 3, 3]))[3]).toBe(false); // 3 of 16 ships each: below 30%
    expect(pass(wave([8, 4, 4]))[3]).toBe(false); // 25% each
    expect(pass(wave([0, 5, 5]))[3]).toBe(true);
    expect(pass(wave([4, 3, 3]))[3]).toBe(true); // exactly 30% each
    expect(pass(wave([5, 3, 3]))[3]).toBe(false); // 3 of 11 is under 30%
  });

  it('flag 4: one mixed band 2 or higher capture is enough, and a band 1 capture does not count', () => {
    const rs = runs((r) => ({ ...r, visits: [visit('rime', [0, 6, 6], 12), visit('mire', [12, 4, 0], 20), visit('deep', [6, 9, 9], 28)] }) as CampaignResult);
    expect(pass(rs)[3]).toBe(true);
    const onlyBand1 = runs((r) => ({ ...r, visits: [visit('rime', [0, 6, 6], 12), visit('deep', [12, 4, 0], 28)] }) as CampaignResult);
    expect(pass(onlyBand1)[3]).toBe(false);
  });

  it('flag 5: a capturing wave under L - 6 ships at the band 2 relay or at The Deep fails it', () => {
    const waves = (mire: [number, number, number], deep: [number, number, number]) => runs((r) => ({ ...r, visits: [visit('mire', mire, 20), visit('deep', deep, 28)] }) as CampaignResult);
    expect(pass(waves([4, 5, 5], [6, 8, 8]))[4]).toBe(true); // 14 at L20 and 22 at L28
    expect(pass(waves([4, 5, 4], [6, 8, 8]))[4]).toBe(false); // 13 at L20
    expect(pass(waves([4, 5, 5], [6, 8, 7]))[4]).toBe(false); // 21 at L28
  });

  it('flag 5: the limit is the one at the visit, and a winner with neither capture fails it', () => {
    const base = (limit: number | null) => runs((r) => ({ ...r, visits: [visit('mire', [4, 5, 5], limit), visit('deep', [6, 8, 8], 28)] }) as CampaignResult);
    expect(pass(base(20))[4]).toBe(true);
    expect(pass(base(21))[4]).toBe(false);
    expect(pass(base(null))[4]).toBe(false);
    expect(pass(runs((r) => ({ ...r, visits: [visit('veil', [4, 5, 5], 12)] }) as CampaignResult))[4]).toBe(false);
  });

  it('flag 6: two winners that end with the same set of areas on a seed fail it (the order they took them in does not matter)', () => {
    const same = runs((r) => {
      if (r.seed !== 2) return r;
      if (r.strategy === 'crystal-first') return { ...r, outcome: 'timeout' } as CampaignResult; // only composer and ice-first win on seed 2
      if (r.strategy === 'ice-first') return { ...r, reclaimOrder: [...run('x', 2).reclaimOrder].reverse(), skipped: run('x', 2).skipped } as CampaignResult;
      return r;
    });
    expect(pass(same)[5]).toBe(false);
    expect(flagsOf(same)[5]!.detail).toContain('seed 2: 2 winners, 1 distinct sets');
  });

  it('flag 6: two different sets among the winners of a seed are enough', () => {
    expect(flagsOf()[5]!.detail).toContain('seed 2: 3 winners, 3 distinct sets');
  });

  it('flag 6: when only one distinct set remains on a seed it fails, and the order of reclaiming does not matter', () => {
    const one = runs((r) => (r.seed === 1 && r.strategy !== 'composer' ? ({ ...r, reclaimOrder: [...run('x', 1).reclaimOrder].reverse(), skipped: run('x', 1).skipped } as CampaignResult) : r));
    expect(pass(one)[5]).toBe(false);
    expect(flagsOf(one)[5]!.detail).toContain('seed 1: 3 winners, 1 distinct sets');
  });

  it('flag 6: a winner that takes every area leaves none untaken and fails it', () => {
    expect(pass(runs((r) => (r.strategy === 'composer' && r.seed === 1 ? ({ ...r, skipped: [] } as CampaignResult) : r)))[5]).toBe(false);
  });

  it('flags 4 to 6 need winners: with none they fail rather than pass vacuously', () => {
    const none = runs((r) => ({ ...r, outcome: 'timeout' }) as CampaignResult);
    expect(pass(none)).toEqual([false, true, true, false, false, false, true]);
    expect(flagsOf(none)[3]!.detail).toBe('no winning runs');
  });

  it('flag 7 is the determinism result passed in', () => {
    expect(pass(undefined, undefined, undefined, false)).toEqual(only(6));
  });

  it('isMixedWave and lancerSharePct are integer shares', () => {
    expect(isMixedWave({ drone: 4, lancer: 3, flak: 3 })).toBe(true);
    expect(isMixedWave({ drone: 5, lancer: 3, flak: 3 })).toBe(false);
    expect(isMixedWave({ drone: 0, lancer: 0, flak: 0 })).toBe(false);
    expect(lancerSharePct(row('x', 2, 10, { mixFleet: { drone: 0, lancer: 3, flak: 7 } }))).toBe(30);
    expect(lancerSharePct(row('x', 2, null))).toBeNull();
  });
});

describe('the bot gate (gateFailures)', () => {
  const names = ['composer', 'ice-first', 'crystal-first', 'drones-only', 'cap-off'];
  const clean = (): CampaignResult[] => names.map((n) => ({ ...run(n, 1), tickMsP95: 0.1 }) as CampaignResult);
  const gate = (rs: CampaignResult[]): string[] => gateFailures(rs, names, 2, TR);
  const with_ = (name: string, patch: Partial<CampaignResult>): CampaignResult[] => clean().map((r) => (r.strategy === name ? ({ ...r, ...patch } as CampaignResult) : r));

  it('passes when every strategy meant to win wins', () => {
    expect(gate(clean())).toEqual([]);
  });

  it('a campaign timeout of a strategy meant to win fails the gate (the 120-minute cap ran out)', () => {
    for (const n of ['composer', 'ice-first', 'crystal-first']) {
      const f = gate(with_(n, { outcome: 'timeout', playTicks: 120 * MIN }));
      expect(f, n).toHaveLength(1);
      expect(f[0]).toContain(`${n} seed 1: campaign timeout`);
      expect(f[0]).toContain('120.0 min');
    }
  });

  it('a timeout of drones-only or the cap-off reference is reported, not gated', () => {
    expect(gate(with_('drones-only', { outcome: 'timeout' }))).toEqual([]);
    expect(gate(with_('cap-off', { outcome: 'timeout' }))).toEqual([]);
  });

  it('a softlock of a winner fails, of drones-only does not; a crash of any strategy fails', () => {
    expect(gate(with_('composer', { outcome: 'softlock' }))[0]).toContain('composer seed 1: softlock');
    expect(gate(with_('drones-only', { outcome: 'softlock' }))).toEqual([]);
    expect(gate(with_('drones-only', { outcome: 'crash', error: 'boom' }))[0]).toContain('drones-only seed 1: crash (boom)');
  });

  it('a tick p95 over the budget fails the strategy', () => {
    expect(gate(with_('cap-off', { tickMsP95: 2.5 }))[0]).toContain('cap-off: tick p95 2.500ms exceeds budget 2ms');
  });
});
