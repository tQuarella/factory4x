/**
 * H5 client text and wiring that needs no DOM, as H6 left it: the fleet notices, the repelled hint, and the Session path of a
 * recycle. Numbers are read from the sim (tunables, selectors), never pinned. The Command limit research (H5) is removed with
 * its tests: the limit rises by reclaiming command relays now (see h6-client.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { campaignWorld, defaultData, fleetStatus, landingEffects, recycleRefund, type BattleResult, type ShipTypeCounts } from '@factory4x/sim';
import { Session } from '../src/session.ts';
import { fleetChipText, fleetFullNotice, fleetLine, fullFleetHint, landingNotice, recycleNotice, recycledText, tierRequirementText } from '../src/report.ts';
import { YARD_STATE_TEXT } from '../src/sheet.ts';
import { TUNE_LABEL } from '../src/panels.ts';

const data = defaultData;

describe('fleet text', () => {
  it('words the chip, the Yards header and the notices', () => {
    expect(fleetChipText(9, 12)).toBe('Fleet 9/12');
    expect(fleetLine({ count: 9, cap: 12 })).toBe('Fleet 9/12');
    expect(fleetFullNotice(12, 12)).toBe('Fleet full (12/12): yards paused. Recycle ships at a node to change your mix.');
  });

  it('the fleetFull yard row names the counts, and falls back without them', () => {
    expect(YARD_STATE_TEXT.fleetFull(null, { count: 12, cap: 12 })).toBe('idle: fleet full (12/12)');
    expect(YARD_STATE_TEXT.fleetFull(null)).toBe('idle: fleet full');
    expect(YARD_STATE_TEXT.fleetFull(null, { count: 3, cap: null })).toBe('idle: fleet full');
  });

  it('the recycle notice lists what went and the ore', () => {
    expect(recycleNotice({ drone: 3, lancer: 0, flak: 0 }, 27)).toBe('Recycled 3 drones: +27 ore.');
    expect(recycleNotice({ drone: 1, lancer: 2, flak: 1 }, 40)).toBe('Recycled 1 drone, 2 lancers, 1 flak: +40 ore.');
    expect(recycledText(5, 40)).toBe('5 ships (+40 ore)');
    expect(recycledText(1, 0)).toBe('1 ship (+0 ore)');
  });

  it('the landing notice names the limit from landingEffects, and nothing when it is off', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'] });
    const fx = landingEffects(w, data);
    expect(fx.fleetCap).not.toBeNull();
    expect(landingNotice('Frost Shelf', fx)).toContain(`fleet limit ${fx.fleetCap}`);
    expect(landingNotice('Frost Shelf', { ...fx, fleetCap: null })).not.toContain('fleet limit');
  });
});

describe('tier requirement wording (still rendered by researchBlock and the research sheet)', () => {
  it('words the tier requirement', () => {
    expect(tierRequirementText(1, 1)).toBe('a light area reclaimed');
    expect(tierRequirementText(2, 1)).toBe('a medium area reclaimed');
    expect(tierRequirementText(2, 2)).toBe('both medium areas reclaimed');
    expect(tierRequirementText(2, 3)).toBe('3 medium areas reclaimed');
  });
});

describe('the repelled hint', () => {
  const fed = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'shoal'], land: 'veil' });
  const heart = fed.nodes.findIndex((n) => n.kind === 'heart');
  const pocket = fed.nodes.findIndex((n) => n.kind === 'pocket');
  const result = (node: number, sent: number, cap: number | null): BattleResult => ({ node, shipsEngaged: sent, capAtSend: cap }) as unknown as BattleResult;

  it('stays silent for a small wave or when the limit was off', () => {
    expect(fullFleetHint(fed, result(heart, 3, 12), data)).toBe('');
    expect(fullFleetHint(fed, result(heart, 12, null), data)).toBe('');
  });

  it('fires at capAtSend - 1 ships and points at a command relay, not at Command limit (H6)', () => {
    const hint = fullFleetHint(fed, result(heart, 11, 12), data);
    expect(hint).toBe(' You sent a full fleet. Change the mix, or reclaim a command relay to raise the limit.');
    expect(fullFleetHint(fed, result(pocket, 12, 12), data)).toBe(hint);
    expect(hint).not.toContain('Command limit');
  });

  it('leaves the relay part out once every band has its relay reclaimed', () => {
    const maxed = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'rime', 'mire', 'veil'], land: 'deep' });
    const f = fleetStatus(maxed, data);
    expect(f.commandedBands).toBe(f.maxCommandedBands);
    const p = maxed.nodes.findIndex((n) => n.kind === 'pocket');
    expect(fullFleetHint(maxed, result(p, 12, 12), data)).toBe(' You sent a full fleet. Change the mix.');
  });
});

describe('recycling through the session', () => {
  it('the preview the panel shows equals the ore the order adds', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'], land: 'shelf' });
    const s = new Session(data, { seed: 1, world: w });
    // Park two drones at the probe by building them: run until the yard has made some.
    for (let i = 0; i < 4000 && s.world.ships.length < 2; i++) s.stepOnce();
    expect(s.world.ships.length).toBeGreaterThanOrEqual(2);
    const at = s.world.ships[0]!.at!;
    const want: ShipTypeCounts = { drone: 2, lancer: 0, flak: 0 };
    const preview = recycleRefund(s.world, want);
    const parked = s.world.ships.filter((x) => x.at === at && x.type === 'drone').length;
    expect(parked).toBeGreaterThanOrEqual(2);
    expect(s.send({ type: 'recycleShips', node: at, counts: want })).toBe(true);
    s.stepOnce();
    expect(s.world.stats.shipsRecycled.drone).toBe(2);
    expect(s.world.stats.oreRefunded).toBe(preview);
  });
});

describe('tuning labels', () => {
  it('labels the fleet and H6 keys, fleet.cap as the A/B switch; the removed Command limit step has none', () => {
    expect(TUNE_LABEL['fleet.cap']).toBe('Fleet limit (0 = none)');
    for (const k of ['fleet.cap', 'fleet.recycleRefundPct', 'fleet.relayStep', 'areas.repeatHaulPct', 'overworld.bandLock']) {
      expect(Object.keys(data.tunables)).toContain(k);
      expect(TUNE_LABEL[k]).toBeTruthy();
    }
    expect(Object.keys(data.tunables)).not.toContain('research.fleet.step');
    expect(TUNE_LABEL['research.fleet.step']).toBeUndefined();
  });
});
