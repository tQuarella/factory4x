import { describe, expect, it } from 'vitest';
import { defaultData } from '@factory4x/sim';
// The frozen test fixture: outcome assertions that depend on tuned numbers run here, so a retune of data/sim.json
// (h4-design-data) never breaks them. Tests on defaultData below keep only what any calibration must keep.
import { fixtureData as fx } from '../../sim/test/fixture.ts';
import { CAMPAIGN_CAP_MIN, defaultRunOptions, reclaimVisit, runCampaign, runFlag4Probes, runSeeds } from '../src/runner.ts';
import { strategies, type CampaignStrategy } from '../src/strategies.ts';

const VISIT_CAP = 54000;
const by = (name: string): CampaignStrategy => strategies.find((s) => s.name === name)!;
const fxOpts = defaultRunOptions(fx, VISIT_CAP);
const shippedOpts = defaultRunOptions(defaultData, VISIT_CAP);

describe('campaign runner (shipped data: only what any calibration must keep)', () => {
  it('every strategy buys the probe core on every seed, with no crash or softlock', () => {
    for (const s of strategies) {
      for (const r of runSeeds(s, 3, defaultData, VISIT_CAP)) {
        expect(r.outcome, `${s.name} seed ${r.seed}`).toBe('won');
        expect(r.error).toBeUndefined();
        expect(r.playTicks).toBeLessThanOrEqual(CAMPAIGN_CAP_MIN * 60 * defaultData.tickRate);
      }
    }
  });

  it('is deterministic: the same seed and strategy end on the same hash, other seeds differ', () => {
    const a = runCampaign(by('greedy'), 1, defaultData, shippedOpts);
    expect(runCampaign(by('greedy'), 1, defaultData, shippedOpts).finalHash).toBe(a.finalHash);
    expect(runCampaign(by('greedy'), 2, defaultData, shippedOpts).finalHash).not.toBe(a.finalHash);
  });

  it('fills the report shape without depending on values', () => {
    const r = runCampaign(by('full-kit'), 1, defaultData, shippedOpts);
    expect(r.visits.length).toBeGreaterThan(0);
    expect(r.research.length).toBeGreaterThan(0);
    expect(r.reclaimOrder.length).toBeGreaterThan(0);
    expect(r.shippedSharePct).toBeGreaterThanOrEqual(0);
    expect(r.shippedSharePct).toBeLessThanOrEqual(100);
    expect(r.tickMsP95).toBeGreaterThanOrEqual(r.tickMsP50);
    expect(r.finalHash).toMatch(/^[0-9a-f]{8}$/);
    expect(r.ticks).toBeGreaterThan(r.playTicks);
  });

  it('runs every seed as its own game', () => {
    expect(runSeeds(by('greedy'), 2, defaultData, VISIT_CAP).map((r) => r.seed)).toEqual([1, 2]);
  });
});

describe('campaign runner (frozen fixture)', () => {
  it('plays a whole campaign to the probe core and fills every report field', () => {
    const r = runCampaign(by('full-kit'), 1, fx, fxOpts);
    expect(r.outcome).toBe('won');
    expect(r.playTicks).toBeLessThan(CAMPAIGN_CAP_MIN * 60 * fx.tickRate);
    expect(r.reclaimOrder).toEqual(['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep']);
    expect(r.visits.map((v) => v.area)).toEqual(r.reclaimOrder);
    expect(r.skipped).toEqual([]);
    expect(r.research.at(-1)!.item).toBe('core');
    expect(r.research.map((b) => b.playTicks)).toEqual([...r.research.map((b) => b.playTicks)].sort((a, b) => a - b));
    expect(r.hauled.ore + r.shipped.ore).toBeGreaterThan(0);
    expect(r.shipsBuilt).toBeGreaterThan(0);
    // The visits' play times add up to the run's play time (every visit was reclaimed, none withdrawn).
    expect(r.visits.reduce((n, v) => n + v.playTicks, 0)).toBe(r.playTicks);
    for (const id of r.reclaimOrder) expect(r.entries[id]).toBe(1);
    // The opening is measured on a visit that built an economy, and not at Landfall (no economy).
    expect(reclaimVisit(r, 'deep')!.openingTicks).not.toBeNull();
    expect(reclaimVisit(r, 'landfall')!.openingTicks).toBeNull();
  });

  it('takes the areas in its own order, and a strategy that has the core early skips areas', () => {
    const r = runCampaign(by('ice-line'), 1, fx, fxOpts);
    expect(r.outcome).toBe('won');
    expect(r.reclaimOrder.slice(0, 4)).toEqual(['landfall', 'shelf', 'veil', 'deep']);
    // Premise built explicitly: with the stockpile already holding the core and both designs bought, only The Deep is left.
    const early = runCampaign(by('ice-line'), 1, fx, {
      ...fxOpts,
      start: { reclaimed: ['landfall', 'shelf', 'veil'], research: { lancer: 1, flak: 1 }, stockpile: { ore: 5000, ice: 500, crystal: 500 } },
    });
    expect(early.outcome).toBe('won');
    expect(early.reclaimOrder).toEqual(['landfall', 'shelf', 'veil', 'deep']);
    expect(early.skipped.sort()).toEqual(['garden', 'shoal']);
  });

  it('withdraws a visit past the cap, then reports a softlock on a second timeout in the same area', () => {
    // A cap of 1 tick: no area can be reclaimed in time, so Landfall times out twice.
    const r = runCampaign(by('greedy'), 1, fx, { ...fxOpts, visitCapTicks: 1 });
    expect(r.outcome).toBe('softlock');
    expect(r.visits.map((v) => [v.area, v.result])).toEqual([
      ['landfall', 'withdrawn'],
      ['landfall', 'withdrawn'],
    ]);
    expect(r.entries.landfall).toBe(2);
    // The run stops on the second timeout, still in the area: the sim has recorded one withdrawal.
    expect(r.withdrawals.landfall).toBe(1);
    expect(r.visits[0]!.playTicks).toBe(1);
    expect(r.reclaimOrder).toEqual([]);
  });

  it('stops with timeout when the campaign cap of play time runs out', () => {
    const r = runCampaign(by('no-research'), 1, fx, { ...fxOpts, campaignCapTicks: 5 * 60 * fx.tickRate });
    expect(r.outcome).toBe('timeout');
    expect(r.playTicks).toBeGreaterThanOrEqual(5 * 60 * fx.tickRate);
    expect(r.playTicks).toBeLessThan(5 * 60 * fx.tickRate + 60);
  });

  it('reports a softlock when the overworld has nothing to buy and nothing open', () => {
    const dead: CampaignStrategy = { name: 'dead', description: '', kit: 'none', route: [] };
    const r = runCampaign(dead, 1, fx, { ...fxOpts, start: { reclaimed: ['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep'] } });
    expect(r.outcome).toBe('softlock');
  });

  it('turns a crash into outcome crash', () => {
    const boom = { name: 'boom', description: '', kit: 'none', get route(): string[] { throw new Error('kaboom'); } } as CampaignStrategy;
    const r = runCampaign(boom, 1, fx, fxOpts);
    expect(r.outcome).toBe('crash');
    expect(r.error).toContain('kaboom');
  });

  it('flag 4 probes reclaim the area from the constructed start and report ticks', () => {
    const p = runFlag4Probes(fx, VISIT_CAP);
    for (const v of Object.values(p)) {
      expect(v).not.toBeNull();
      expect(v!).toBeGreaterThan(0);
    }
    expect(runFlag4Probes(fx, VISIT_CAP)).toEqual(p);
  });
});
