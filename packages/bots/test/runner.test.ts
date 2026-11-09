import { describe, expect, it } from 'vitest';
import { defaultData } from '@factory4x/sim';
// The frozen v8 fixture: outcome assertions that depend on tuned numbers run here, so a retune of data/sim.json
// (h5-design-data) never breaks them. Tests on defaultData below keep only what any calibration must keep.
import { fixtureV8 as fx } from '../../sim/test/fixture.ts';
import { CAMPAIGN_CAP_MIN, defaultRunOptions, reclaimVisit, runCampaign, runSeeds, runTrial } from '../src/runner.ts';
import { trialSpecs } from '../src/waves.ts';
import { strategies, type CampaignStrategy } from '../src/strategies.ts';

const VISIT_CAP = 54000;
const by = (name: string): CampaignStrategy => strategies.find((s) => s.name === name)!;
const fxOpts = defaultRunOptions(fx, VISIT_CAP);
/** Premise for the whole-campaign tests: a limit of 60 (the tunable's max), so every area fits and only the engine's play matters. */
const RAISED = { ...fxOpts, fleetCap: 60 };
/**
 * Shipped-data runs stop after a fixed 10 game minutes of play, so their runtime can't grow when a retune
 * lengthens the campaign. Whole shipped campaigns are played by the `bots` gate.
 */
const SHIPPED_PLAY_CAP = 10 * 60 * defaultData.tickRate;
const shippedOpts = { ...defaultRunOptions(defaultData, VISIT_CAP), campaignCapTicks: SHIPPED_PLAY_CAP };

describe('campaign runner (shipped data: only what any calibration must keep)', () => {
  it('is deterministic: the same seed and strategy end on the same hash, other seeds differ', () => {
    const a = runCampaign(by('composer'), 1, defaultData, shippedOpts);
    expect(runCampaign(by('composer'), 1, defaultData, shippedOpts).finalHash).toBe(a.finalHash);
    expect(runCampaign(by('composer'), 2, defaultData, shippedOpts).finalHash).not.toBe(a.finalHash);
  });

  it('fills the report shape without depending on values (first 10 game minutes)', () => {
    const r = runCampaign(by('composer'), 1, defaultData, shippedOpts);
    expect(r.error).toBeUndefined();
    expect(r.playTicks).toBeLessThanOrEqual(SHIPPED_PLAY_CAP);
    expect(r.visits.length).toBeGreaterThan(0);
    expect(Array.isArray(r.research)).toBe(true);
    // Landfall is undefended: reclaimed within the first 10 minutes under any calibration.
    expect(r.reclaimOrder[0]).toBe('landfall');
    expect(reclaimVisit(r, 'landfall')!.rootCutBeforeHeart).toBeNull();
    expect(reclaimVisit(r, 'landfall')!.closed).toBe(false);
    expect(r.shipsRecycled).toBeGreaterThanOrEqual(0);
    expect(r.tickMsP95).toBeGreaterThanOrEqual(r.tickMsP50);
    expect(r.finalHash).toMatch(/^[0-9a-f]{8}$/);
    expect(r.ticks).toBeGreaterThan(r.playTicks);
  });
});

describe('trial visits', () => {
  // A short visit cap keeps these fast; what they check is the premise (the limit the visit gets) and the result shape.
  const specs = trialSpecs(defaultData, 3);

  it('every trial lands in its area under the limit it expects, and a visit that runs out of time is a timeout, not a reclaim', () => {
    for (const t of specs.filter((x) => ['veil', 'mire', 'deep', 'rime'].includes(x.area)).filter((x) => x.seed === 1)) {
      const r = runTrial(t, defaultData, 300);
      expect(r.area).toBe(t.area);
      expect(r.limit, `${t.kind} ${t.area}`).toBe(t.limit);
      expect(r.reclaimed).toBe(false);
      expect(r.result).toBe('timeout');
      expect(r.playTicks).toBe(300);
    }
  });

  it('plays a forced visit: nothing is withdrawn as closed even where nothing passes the attack test', () => {
    const veil = specs.find((t) => t.area === 'veil')!;
    expect(runTrial(veil, defaultData, 300).result).not.toBe('closed');
  });

  it('reports a reclaim when the heart falls (Landfall, undefended, as a trial)', () => {
    const easy = { kind: 'relay-drones', area: 'landfall', seed: 1, limit: 12, dronesOnly: true, start: { land: 'landfall' } } as const;
    const r = runTrial(easy, defaultData, 3000);
    expect(r.reclaimed).toBe(true);
    expect(r.result).toBe('reclaimed');
  });
});

describe('campaign runner (frozen v8 fixture)', () => {
  it('runs every seed as its own game', () => {
    const rs = runSeeds(by('cap-off'), 2, fx, 3000);
    expect(rs.map((r) => r.seed)).toEqual([1, 2]);
    expect(rs[0]!.finalHash).not.toBe(rs[1]!.finalHash);
  });

  it('the cap-off reference (cap-off, fleet.cap 0) plays the H3 engine to the core and recycles nothing', () => {
    const r = runCampaign(by('cap-off'), 1, fx, fxOpts);
    expect(r.outcome).toBe('won');
    expect(r.shipsRecycled).toBe(0);
    expect(r.research.some((b) => b.item === 'fleet')).toBe(false);
    expect(r.visits.every((v) => !v.closed)).toBe(true);
  });

  it('a composer with a raised limit plays the last area to the probe core and fills every report field', () => {
    // Premise: everything but The Deep reclaimed, both designs bought, and a stockpile that pays the core.
    const start = { reclaimed: ['landfall', 'shelf', 'shoal', 'veil', 'garden'], research: { lancer: 1, flak: 1 }, stockpile: { ore: 5000, ice: 500, crystal: 500 } };
    const r = runCampaign(by('composer'), 1, fx, { ...RAISED, start });
    expect(r.outcome).toBe('won');
    expect(r.playTicks).toBeLessThan(CAMPAIGN_CAP_MIN * 60 * fx.tickRate);
    expect(r.reclaimOrder).toEqual(['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep']);
    expect(r.visits.map((v) => v.area)).toEqual(['deep']);
    expect(r.research.at(-1)!.item).toBe('core');
    expect(r.research.map((b) => b.playTicks)).toEqual([...r.research.map((b) => b.playTicks)].sort((a, b) => a - b));
    expect(r.shipsBuilt).toBeGreaterThan(0);
    expect(r.visits.reduce((n, v) => n + v.playTicks, 0)).toBe(r.playTicks);
    const deep = reclaimVisit(r, 'deep')!;
    expect(deep.closed).toBe(false);
    expect(deep.wave).not.toBeNull();
    expect(deep.wave!.drone + deep.wave!.lancer + deep.wave!.flak).toBeGreaterThan(0);
    expect(typeof deep.rootCutBeforeHeart).toBe('boolean');
    expect(deep.openingTicks).not.toBeNull();
  });

  it('records the capturing wave per heart, and the Root only where the area has one', () => {
    // Premise: no design bought, plenty of ore, no ice or crystal: the goal is the designs and only the light areas pay the missing ice and crystal.
    const start = { reclaimed: ['landfall'], stockpile: { ore: 5000 } };
    const r = runCampaign(by('composer'), 1, fx, { ...RAISED, start, stopAfterReclaims: 2 });
    expect(r.visits).toHaveLength(2);
    for (const v of r.visits) {
      expect(v.result).toBe('reclaimed');
      expect(v.wave).not.toBeNull();
      // The v8 fixture's two light areas have no Root; its medium areas do (a boolean: cut before the heart or not).
      expect(v.rootCutBeforeHeart === null).toBe(v.area === 'shelf' || v.area === 'shoal');
    }
    expect(r.visits[0]!.area).toBe('shelf');
  });

  it('records a closed area and withdraws at once, then plays the cheapest forced when every open area is closed', () => {
    // Premise: a limit of 2 ships. Landfall needs one drone; both light areas fail the attack test at once.
    const r = runCampaign(by('composer'), 1, fx, { ...fxOpts, fleetCap: 2, visitCapTicks: 900 });
    expect(r.visits[0]!.area).toBe('landfall');
    expect(r.visits[0]!.result).toBe('reclaimed');
    const closed = r.visits.filter((v) => v.closed);
    expect(closed.map((v) => v.area).sort()).toEqual(['shelf', 'shoal']);
    for (const v of closed) {
      expect(v.result).toBe('withdrawn');
      expect(v.forced).toBe(false);
      expect(v.playTicks).toBeLessThan(5);
    }
    // Then every open area is closed: the cheapest is forced, played until the visit cap, twice, and that is a softlock.
    const forced = r.visits.filter((v) => v.forced);
    expect(forced).toHaveLength(2);
    expect(new Set(forced.map((v) => v.area)).size).toBe(1);
    expect(forced.every((v) => v.result === 'withdrawn' && !v.closed && v.playTicks === 900)).toBe(true);
    // Repelled waves are counted per visit and over the run (a limit of 2 can't take Frost Shelf's heart).
    expect(r.repelled).toBe(r.visits.reduce((n, v) => n + v.repelled, 0));
    expect(r.visits.every((v) => v.repelled >= 0)).toBe(true);
    expect(r.outcome).toBe('softlock');
  });

  it('a closed area is not entered again while the limit and designs are unchanged', () => {
    const r = runCampaign(by('composer'), 1, fx, { ...fxOpts, fleetCap: 2, visitCapTicks: 900 });
    const order = r.visits.map((v) => `${v.area}${v.closed ? ':closed' : ''}`);
    expect(order.filter((x) => x === 'shelf:closed' || x === 'shoal:closed')).toHaveLength(2);
    expect(order.indexOf('shelf:closed') + order.indexOf('shoal:closed')).toBeLessThan(5);
  });

  it('drones-only buys only grind research and never a design, the core or Command limit', () => {
    const r = runCampaign(by('drones-only'), 1, fx, { ...RAISED, campaignCapTicks: 10 * 60 * fx.tickRate });
    expect(r.research.length).toBeGreaterThan(0);
    for (const b of r.research) expect(['opening', 'extract', 'rigs', 'yards']).toContain(b.item);
    expect(r.visits.every((v) => v.wave === null || v.wave.lancer + v.wave.flak === 0)).toBe(true);
  });

  it('no strategy buys Command limit (H6 removed it)', () => {
    const r = runCampaign(by('composer'), 1, fx, { ...RAISED, campaignCapTicks: 15 * 60 * fx.tickRate });
    expect(r.research.some((b) => b.item === 'fleet')).toBe(false);
  });

  it('records the limit each visit played under and the haul a reclaim paid (Landfall: the haul in the data, nominal)', () => {
    const r = runCampaign(by('composer'), 1, fx, { ...RAISED, stopAfterReclaims: 1 });
    const v = r.visits[0]!;
    expect(v.area).toBe('landfall');
    expect(v.limit).toBe(60);
    expect(v.haulPaid).toEqual(fx.map.areas.find((a) => a.id === 'landfall')!.haul);
    const off = runCampaign(by('cap-off'), 1, fx, { ...fxOpts, stopAfterReclaims: 1 });
    expect(off.visits[0]!.limit).toBeNull();
  });

  it('stopAfterVisits ends the run after that many visits, reclaimed or withdrawn', () => {
    const r = runCampaign(by('composer'), 1, fx, { ...fxOpts, visitCapTicks: 1, stopAfterVisits: 1 });
    expect(r.visits).toHaveLength(1);
    expect(r.visits[0]!.result).toBe('withdrawn');
    expect(r.outcome).toBe('timeout');
  });

  it('forceFirstVisit plays a visit the engine would withdraw as closed, up to the visit cap', () => {
    // Premise: a limit of 2 closes Frost Shelf (nothing passes the attack test), and Landfall is already reclaimed.
    const start = { reclaimed: ['landfall'], land: 'shelf' };
    const closed = runCampaign(by('composer'), 1, fx, { ...fxOpts, fleetCap: 2, start, visitCapTicks: 900, stopAfterVisits: 1 });
    expect(closed.visits[0]!.closed).toBe(true);
    const forced = runCampaign(by('composer'), 1, fx, { ...fxOpts, fleetCap: 2, start, visitCapTicks: 900, stopAfterVisits: 1, forceFirstVisit: true });
    expect(forced.visits[0]!.closed).toBe(false);
    expect(forced.visits[0]!.forced).toBe(true);
    expect(forced.visits[0]!.playTicks).toBe(900);
  });

  it('withdraws a visit past the cap, then reports a softlock on a second timeout in the same area', () => {
    // A cap of 1 tick: no area can be reclaimed in time, so Landfall times out twice.
    const r = runCampaign(by('composer'), 1, fx, { ...fxOpts, visitCapTicks: 1 });
    expect(r.outcome).toBe('softlock');
    expect(r.visits.map((v) => [v.area, v.result])).toEqual([
      ['landfall', 'withdrawn'],
      ['landfall', 'withdrawn'],
    ]);
    expect(r.entries.landfall).toBe(2);
    expect(r.withdrawals.landfall).toBe(1);
    expect(r.visits[0]!.playTicks).toBe(1);
    expect(r.reclaimOrder).toEqual([]);
  });

  it('stops with timeout when the campaign cap of play time runs out', () => {
    const r = runCampaign(by('composer'), 1, fx, { ...RAISED, campaignCapTicks: 5 * 60 * fx.tickRate });
    expect(r.outcome).toBe('timeout');
    expect(r.playTicks).toBeGreaterThanOrEqual(5 * 60 * fx.tickRate);
    expect(r.playTicks).toBeLessThan(5 * 60 * fx.tickRate + 60);
  });

  it('reports a softlock when the overworld has nothing to buy and nothing open', () => {
    const dead: CampaignStrategy = { name: 'dead', description: '', kit: 'none' };
    const r = runCampaign(dead, 1, fx, { ...fxOpts, start: { reclaimed: ['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep'] } });
    expect(r.outcome).toBe('softlock');
  });

  it('turns a crash into outcome crash', () => {
    const boom = { name: 'boom', description: '', kit: 'none', get side(): never { throw new Error('kaboom'); } } as CampaignStrategy;
    const r = runCampaign(boom, 1, fx, fxOpts);
    expect(r.outcome).toBe('crash');
    expect(r.error).toContain('kaboom');
  });
});
