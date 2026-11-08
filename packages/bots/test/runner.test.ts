import { describe, expect, it } from 'vitest';
import { defaultData as data } from '@factory4x/sim';
import { CAMPAIGN_CAP_MIN, defaultRunOptions, reclaimVisit, runCampaign, runFlag4Probes, runSeeds } from '../src/runner.ts';
import { strategies, type CampaignStrategy } from '../src/strategies.ts';

const VISIT_CAP = 54000;
const by = (name: string): CampaignStrategy => strategies.find((s) => s.name === name)!;
const opts = defaultRunOptions(data, VISIT_CAP);

describe('campaign runner', () => {
  it('plays a whole campaign to the probe core and fills every report field', () => {
    const r = runCampaign(by('full-kit'), 1, data, opts);
    expect(r.outcome).toBe('won');
    expect(r.playTicks).toBeGreaterThan(0);
    expect(r.playTicks).toBeLessThan(CAMPAIGN_CAP_MIN * 60 * data.tickRate);
    expect(r.reclaimOrder).toEqual(['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep']);
    expect(r.visits.map((v) => v.area)).toEqual(r.reclaimOrder);
    expect(r.skipped).toEqual([]);
    expect(r.research.at(-1)!.item).toBe('core');
    expect(r.research.map((b) => b.playTicks)).toEqual([...r.research.map((b) => b.playTicks)].sort((a, b) => a - b));
    expect(r.hauled.ore + r.shipped.ore).toBeGreaterThan(0);
    expect(r.shippedSharePct).toBeGreaterThanOrEqual(0);
    expect(r.shippedSharePct).toBeLessThanOrEqual(100);
    expect(r.shipsBuilt).toBeGreaterThan(0);
    expect(r.tickMsP95).toBeGreaterThanOrEqual(r.tickMsP50);
    expect(r.finalHash).toMatch(/^[0-9a-f]{8}$/);
    // The visits' play times add up to the run's play time (every visit was reclaimed, none withdrawn).
    expect(r.visits.reduce((n, v) => n + v.playTicks, 0)).toBe(r.playTicks);
    for (const id of r.reclaimOrder) expect(r.entries[id]).toBe(1);
    // Openings are measured on the visits that built an economy.
    expect(reclaimVisit(r, 'shelf')!.openingTicks).not.toBeNull();
    expect(reclaimVisit(r, 'landfall')!.openingTicks).toBeNull();
  });

  it('takes the areas in its own order and can skip some', () => {
    const r = runCampaign(by('ice-line'), 1, data, opts);
    expect(r.outcome).toBe('won');
    expect(r.reclaimOrder.slice(0, 4)).toEqual(['landfall', 'shelf', 'veil', 'deep']);
    expect(r.skipped.length).toBeGreaterThan(0);
  });

  it('is deterministic: the same seed and strategy end on the same hash, other seeds differ', () => {
    const a = runCampaign(by('greedy'), 1, data, opts);
    expect(runCampaign(by('greedy'), 1, data, opts).finalHash).toBe(a.finalHash);
    expect(runCampaign(by('greedy'), 2, data, opts).finalHash).not.toBe(a.finalHash);
  });

  it('runs every seed as its own game', () => {
    const rs = runSeeds(by('greedy'), 2, data, VISIT_CAP);
    expect(rs.map((r) => r.seed)).toEqual([1, 2]);
    expect(rs.every((r) => r.outcome === 'won')).toBe(true);
  });

  it('withdraws a visit past the cap, then reports a softlock on a second timeout in the same area', () => {
    // A 10 second cap: Landfall (11 s) is never reclaimed in time, so it times out twice.
    const r = runCampaign(by('greedy'), 1, data, { ...opts, visitCapTicks: 10 * data.tickRate });
    expect(r.outcome).toBe('softlock');
    expect(r.visits.map((v) => [v.area, v.result])).toEqual([
      ['landfall', 'withdrawn'],
      ['landfall', 'withdrawn'],
    ]);
    expect(r.entries.landfall).toBe(2);
    // The run stops on the second timeout, still in the area: the sim has recorded one withdrawal.
    expect(r.withdrawals.landfall).toBe(1);
    expect(r.visits[0]!.playTicks).toBe(10 * data.tickRate);
    expect(r.reclaimOrder).toEqual([]);
  });

  it('stops with timeout when the campaign cap of play time runs out', () => {
    const r = runCampaign(by('no-research'), 1, data, { ...opts, campaignCapTicks: 5 * 60 * data.tickRate });
    expect(r.outcome).toBe('timeout');
    expect(r.playTicks).toBeGreaterThanOrEqual(5 * 60 * data.tickRate);
    expect(r.playTicks).toBeLessThan(5 * 60 * data.tickRate + 60);
  });

  it('reports a softlock when the overworld has nothing to buy and nothing open', () => {
    const dead: CampaignStrategy = { name: 'dead', description: '', kit: 'none', route: [] };
    const r = runCampaign(dead, 1, data, {
      ...opts,
      start: { reclaimed: ['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep'] },
    });
    expect(r.outcome).toBe('softlock');
  });

  it('turns a crash into outcome crash', () => {
    const boom = { name: 'boom', description: '', kit: 'none', get route(): string[] { throw new Error('kaboom'); } } as CampaignStrategy;
    const r = runCampaign(boom, 1, data, opts);
    expect(r.outcome).toBe('crash');
    expect(r.error).toContain('kaboom');
  });

  it('counts only held play time, not the overworld or a reclaimed area left standing', () => {
    const r = runCampaign(by('greedy'), 1, data, opts);
    expect(r.ticks).toBeGreaterThan(r.playTicks);
  });

  it('flag 4 probes reclaim the area from the constructed start and report ticks', () => {
    const p = runFlag4Probes(data, VISIT_CAP);
    for (const v of Object.values(p)) {
      expect(v).not.toBeNull();
      expect(v!).toBeGreaterThan(0);
    }
    expect(runFlag4Probes(data, VISIT_CAP)).toEqual(p);
  });
});
