/**
 * H5 client text and wiring that needs no DOM: the fleet notices, the repelled hint, the research wording and disabled reasons,
 * and the Session path of a recycle. Numbers are read from the sim (tunables, selectors), never pinned.
 */
import { describe, expect, it } from 'vitest';
import {
  campaignWorld,
  defaultData,
  fleetStatus,
  landingEffects,
  recycleRefund,
  researchStatus,
  type BattleResult,
  type ShipTypeCounts,
} from '@factory4x/sim';
import { Session } from '../src/session.ts';
import {
  effectText,
  fleetChipText,
  fleetFullNotice,
  fleetLine,
  fullFleetHint,
  landingNotice,
  purchaseNotice,
  recycleNotice,
  recycledText,
  researchBlock,
  tierRequirementText,
} from '../src/report.ts';
import { YARD_STATE_TEXT } from '../src/sheet.ts';
import { TUNE_LABEL } from '../src/panels.ts';

const data = defaultData;
const itemLabel = (id: string, level: number): string => `${id} ${level}`;
const areaName = (id: string): string => id;
const row = (w: ReturnType<typeof campaignWorld>, id: string) => researchStatus(w, data).find((r) => r.id === id)!;

describe('fleet text', () => {
  it('words the chip, the Yards header and the notices', () => {
    expect(fleetChipText(9, 12)).toBe('Fleet 9/12');
    expect(fleetLine({ count: 9, cap: 12, level: 1, maxLevel: 3 })).toBe('Fleet 9/12 · Command limit 1/3');
    expect(fleetLine({ count: 9, cap: 12, level: 0, maxLevel: 0 })).toBe('Fleet 9/12');
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
    const w = campaignWorld(1, data, { reclaimed: ['landfall'], research: { fleet: 1 } });
    const fx = landingEffects(w);
    expect(fx.fleetCap).not.toBeNull();
    expect(landingNotice('Frost Shelf', fx)).toContain(`fleet limit ${fx.fleetCap}`);
    expect(landingNotice('Frost Shelf', { ...fx, fleetCap: null })).not.toContain('fleet limit');
  });
});

describe('Command limit research', () => {
  it('words the effect as limits, from the row and live tunables', () => {
    const w = campaignWorld(1, data, {});
    const r = row(w, 'fleet');
    expect(r.kind).toBe('limit');
    expect(effectText(r, w.tun, w.tickRate)).toBe(`Fleet limit ${r.effect} → ${r.nextEffect}`);
    expect(r.nextEffect).toBe(r.effect + w.tun['research.fleet.step']);
  });

  it('says the limit is off when fleet.cap is 0, in the effect line and the disabled button', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'], stockpile: { ore: 999, ice: 99, crystal: 99 } });
    w.tun['fleet.cap'] = 0;
    const r = row(w, 'fleet');
    expect(r.missing.capOff).toBe(true);
    expect(researchBlock(r, itemLabel, areaName)).toBe('Fleet limit is off (tuning)');
    expect(effectText(r, w.tun, w.tickRate)).toBe('Fleet limit is off (tuning)');
  });

  it('a disabled Command limit says which tier of area it needs, then what it lacks', () => {
    const none = campaignWorld(1, data, { stockpile: { ore: 999, ice: 99, crystal: 99 } });
    const need = row(none, 'fleet').missing.tiers[0]!;
    expect(researchBlock(row(none, 'fleet'), itemLabel, areaName)).toBe(`Needs ${tierRequirementText(need.tier, need.count)}`);
    expect(researchBlock(row(none, 'fleet'), itemLabel, areaName)).toBe('Needs a light area reclaimed');
    const light = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'], stockpile: { ore: 0, ice: 0, crystal: 0 } });
    expect(row(light, 'fleet').missing.tiers).toEqual([]);
    expect(researchBlock(row(light, 'fleet'), itemLabel, areaName)).toMatch(/^Needs \d+ (ore|ice|crystal)$/);
  });

  it('words the tier requirement', () => {
    expect(tierRequirementText(1, 1)).toBe('a light area reclaimed');
    expect(tierRequirementText(2, 1)).toBe('a medium area reclaimed');
    expect(tierRequirementText(2, 2)).toBe('both medium areas reclaimed');
    expect(tierRequirementText(2, 3)).toBe('3 medium areas reclaimed');
  });

  it('the purchase notice names the new limit, and the landing shows the same number', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'], stockpile: { ore: 999, ice: 99, crystal: 99 } });
    const s = new Session(data, { seed: 1, world: w });
    const idx = data.research.findIndex((r) => r.id === 'fleet');
    expect(s.send({ type: 'buyResearch', item: idx })).toBe(true);
    const after = row(s.world, 'fleet');
    expect(after.level).toBe(1);
    expect(purchaseNotice(after, [])).toBe(`Command limit 1: fleet limit now ${after.effect}.`);
    expect(landingEffects(s.world).fleetCap).toBe(after.effect);
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

  it('fires at capAtSend - 1 ships, leading with the Root cut for a fed heart', () => {
    expect(fullFleetHint(fed, result(heart, 11, 12), data)).toBe(' You sent a full fleet. Cut the Root, change the mix, or raise the limit (Command limit).');
  });

  it('leaves the Root cut out when the target is not a fed heart', () => {
    expect(fullFleetHint(fed, result(pocket, 12, 12), data)).toBe(' You sent a full fleet. Change the mix or raise the limit (Command limit).');
  });

  it('leaves "raise the limit" out at the last Command limit level', () => {
    const maxed = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'shoal', 'veil', 'garden'], research: { fleet: 3 }, land: 'deep' });
    const f = fleetStatus(maxed, data);
    expect(f.level).toBe(f.maxLevel);
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
  it('labels the three H5 keys, fleet.cap as the A/B switch', () => {
    expect(TUNE_LABEL['fleet.cap']).toBe('Fleet limit (0 = none)');
    for (const k of ['fleet.cap', 'fleet.recycleRefundPct', 'research.fleet.step']) {
      expect(Object.keys(data.tunables)).toContain(k);
      expect(TUNE_LABEL[k]).toBeTruthy();
    }
  });
});
