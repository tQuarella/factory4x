import { describe, expect, it } from 'vitest';
import { defaultData, extractorMinCount, rockStatus, tunableMeta } from '@factory4x/sim';
import {
  extractorRowText,
  haulersLineText,
  onTheWayText,
  prongSegment,
  raidChipText,
  raidEndProngsText,
  raidEndText,
  raidFightLineProngs,
  raidMusterLineProngs,
  raidProngsText,
} from '../src/fieldreport.ts';
import { CLIENT_SETTING_KEYS, defaultSettings, loadSettings, type StorageLike } from '../src/persist.ts';
import { isHiddenTunable, TUNE_LABEL } from '../src/panels.ts';
import { raidLegs } from '../src/raidlegs.ts';
import { Session } from '../src/session.ts';
import { raidBadgeMix } from '../src/view.ts';

const data = defaultData;
const store = (text: string | null): StorageLike => ({ getItem: () => text, setItem: () => undefined, removeItem: () => undefined });

describe('acceptance 1: the extractor row texts', () => {
  const r = { docked: 2, freeExtractors: 0, extCap: 3 };
  it('reads "Extractors d / cap", counting free extractors as docked', () => {
    expect(extractorRowText(r)).toBe('Extractors 2 / 3');
    expect(extractorRowText({ docked: 1, freeExtractors: 1, extCap: 4 })).toBe('Extractors 2 / 4');
    expect(extractorRowText({ docked: 0, freeExtractors: 0, extCap: 2 })).toBe('Extractors 0 / 2');
  });
  it('says "+1 on the way" only while an extractor is in flight', () => {
    expect(onTheWayText({ inFlight: 1 })).toBe('+1 on the way');
    expect(onTheWayText({ inFlight: 2 })).toBe('+2 on the way');
    expect(onTheWayText({ inFlight: 0 })).toBe('');
  });
  it('the haulers line is read-only: "(auto)", "(set N)", or just the count without need staffing', () => {
    expect(haulersLineText({ haulers: 1, haulerSet: null, haulerTarget: 1 }, true)).toBe('Haulers 1 (auto)');
    expect(haulersLineText({ haulers: 1, haulerSet: 2, haulerTarget: 2 }, true)).toBe('Haulers 2 (set 2)');
    expect(haulersLineText({ haulers: 3, haulerSet: null, haulerTarget: 0 }, false)).toBe('Haulers 3');
  });
});

describe('acceptance 1: the dial limits come from the sim', () => {
  it('the minimum is 1 for an asteroid, and an unmarked rock keeps its setting readable', () => {
    const s = new Session(data, { seed: 3 });
    const rock = s.world.nodes.find((n) => n.kind === 'asteroid')!;
    s.send({ type: 'setMine', node: rock.index, on: false });
    s.stepOnce();
    expect(extractorMinCount(s.world, rock.index)).toBe(1);
    const before = rockStatus(s.world, rock.index);
    expect(before.mine).toBe(false);
    expect(before.extractorSet).toBeNull();
    expect(before.extCap).toBe(rock.slots);
    // Setting on an unmarked rock is accepted and kept (X1); the row shows it greyed.
    s.send({ type: 'setExtractors', node: rock.index, count: 1 });
    s.stepOnce();
    const after = rockStatus(s.world, rock.index);
    expect(after.extractorSet).toBe(1);
    expect(after.extCap).toBe(1);
    expect(extractorRowText(after)).toBe('Extractors 0 / 1');
  });
});

describe('acceptance 3: the banner and the chip with prongs', () => {
  const two = [
    { target: 'A5', planned: { thorn: 2, spore: 4 } },
    { target: 'A6', planned: { thorn: 1, spore: 4 } },
  ];
  it('one prong is H7\'s text, unchanged', () => {
    expect(raidMusterLineProngs([{ target: 'A5', planned: { thorn: 1, spore: 4 } }], 450, 30)).toBe('Raid gathering: 4 Spores, 1 Thorn → A5 in 15 s');
    expect(raidFightLineProngs([{ target: 'A5', left: 3 }])).toBe('Raid at A5: 3 left');
  });
  it('two prongs name every rock with its counts, one segment each', () => {
    expect(raidMusterLineProngs(two, 450, 30)).toBe('Raid gathering in 15 s → A5 2T 4S · A6 1T 4S');
    expect(raidFightLineProngs([{ target: 'A5', left: 3 }, { target: 'A6', left: 0 }])).toBe('Raid at A5: 3 left · A6: 0 left');
    expect(prongSegment('A7', { thorn: 0, spore: 3 })).toBe('A7 3S');
    expect(prongSegment('A7', { thorn: 2, spore: 0 })).toBe('A7 2T');
  });
  it('the chip shows the soonest time, plus "· 2" with two prongs', () => {
    const chip = { enabled: true, phase: 'muster' as const, econ: 8, nextRaidAtEcon: 6, ticksToLaunch: 450, ticksToArrival: 0, ticksToNextAllowed: 0 };
    expect(raidChipText({ ...chip, prongsLive: 1 }, 30)).toBe('Raid 0:15');
    expect(raidChipText({ ...chip, prongsLive: 2 }, 30)).toBe('Raid 0:15 · 2');
    expect(raidChipText({ ...chip, phase: 'out', ticksToArrival: 143, prongsLive: 2 }, 30)).toBe('Raid 0:05 · 2');
    expect(raidChipText({ ...chip, phase: 'fight', prongsLive: 2 }, 30)).toBe('Raid on · 2');
    expect(raidChipText({ ...chip, phase: 'home', ticksToArrival: 90, prongsLive: 3 }, 30)).toBe('Raid leaving · 3');
    // Idle chips are H7's, whatever the prong count.
    expect(raidChipText({ ...chip, phase: 'none', prongsLive: 0 }, 30)).toBe('Raids ready');
    expect(raidChipText({ ...chip, phase: 'none', econ: 3 }, 30)).toBe('Raids at 6 ships');
  });
  it('the longest chip text fits the room the chip reserves ("Raids at 00 ships", 17 characters)', () => {
    const chip = { enabled: true, econ: 8, nextRaidAtEcon: 6, ticksToLaunch: 5999, ticksToArrival: 5999, ticksToNextAllowed: 0, prongsLive: 3 };
    for (const phase of ['muster', 'out', 'fight', 'home'] as const) expect(raidChipText({ ...chip, phase }, 30)!.length, phase).toBeLessThanOrEqual(17);
  });
});

describe('acceptance 5: the raid report and result panel per prong', () => {
  const none = { lostEcon: { extractor: 0, hauler: 0 }, lostShips: { drone: 0, lancer: 0, flak: 0 }, killed: { thorn: 0, spore: 0 } };
  it('lists each prong: "A5 beaten · A6 hit, 2 extractors lost"', () => {
    expect(
      raidEndProngsText([
        { ...none, target: 'A5', outcome: 'beaten', killed: { thorn: 2, spore: 3 } },
        { ...none, target: 'A6', outcome: 'hit', lostEcon: { extractor: 2, hauler: 0 } },
      ]),
    ).toBe('Raid: A5 beaten · A6 hit, 2 extractors lost');
    expect(
      raidEndProngsText([
        { ...none, target: 'A5', outcome: 'turnedBack' },
        { ...none, target: 'A6', outcome: 'hit', lostEcon: { extractor: 1, hauler: 1 }, lostShips: { drone: 2, lancer: 0, flak: 0 } },
      ]),
    ).toBe('Raid: A5 turned back · A6 hit, 1 extractor, 1 hauler, 2 drones lost');
  });
  it('one prong keeps H7\'s end text', () => {
    expect(raidEndText({ ...none, outcome: 'beaten', killed: { thorn: 2, spore: 3 } }, 'A5')).toBe('Raid beaten at A5: 5 killed, 0 lost');
  });
  it('the result panel line counts prongs by outcome, or says none', () => {
    expect(raidProngsText({ beaten: 0, hit: 0, turnedBack: 0 })).toBe('none');
    expect(raidProngsText({ beaten: 3, hit: 2, turnedBack: 1 })).toBe('6: 3 beaten · 2 hit · 1 turned back');
  });
});

describe('acceptance 2: the badge and the legs', () => {
  it('a rock wears a badge only while a prong is aimed at it, with that prong\'s mix', () => {
    expect(raidBadgeMix({ raidTarget: false, raidMix: null })).toBeNull();
    expect(raidBadgeMix({ raidTarget: false, raidMix: { thorn: 1, spore: 1 } })).toBeNull();
    expect(raidBadgeMix({ raidTarget: true, raidMix: null })).toBeNull();
    expect(raidBadgeMix({ raidTarget: true, raidMix: { thorn: 2, spore: 4 } })).toEqual({ thorn: 2, spore: 4 });
  });
  it('with h9-sim\'s one prong there is one leg while the raid is away, none while it musters or when there is no raid', () => {
    const s = new Session(data, { seed: 3 });
    expect(raidLegs(s.world)).toEqual([]);
    s.sendAll([
      { type: 'setTunable', key: 'raid.firstAtEcon', value: 2 },
      { type: 'setTunable', key: 'raid.musterTicks', value: 0 },
    ]);
    let sawLeg = false;
    for (let i = 0; i < 12000 && !sawLeg; i++) {
      s.stepOnce();
      const legs = raidLegs(s.world);
      if (legs.length > 0) {
        sawLeg = true;
        expect(legs).toHaveLength(1);
        expect(legs[0]!.mix.thorn + legs[0]!.mix.spore).toBeGreaterThan(0);
      }
    }
    expect(sawLeg).toBe(true);
  });
});

describe('acceptance 7: tuning', () => {
  it('client.haulerStepper is a client key with default 0, stored in the settings, and loaded only when valid', () => {
    const m = tunableMeta(data).find((x) => x.key === 'client.haulerStepper')!;
    expect([m.default, m.min, m.max, m.scope]).toEqual([0, 0, 1, 'client']);
    expect(CLIENT_SETTING_KEYS['client.haulerStepper']).toBe('haulerStepper');
    const d = defaultSettings(data);
    expect(d.haulerStepper).toBe(0);
    expect(loadSettings(data, store(JSON.stringify({ ...d, haulerStepper: 1 }))).haulerStepper).toBe(1);
    expect(loadSettings(data, store(JSON.stringify({ ...d, haulerStepper: 2 }))).haulerStepper).toBe(0);
  });
  it('the prong keys are live tunables, shown in a field run, with labels', () => {
    const keys = tunableMeta(data).filter((m) => m.live && !isHiddenTunable(m.key, true)).map((m) => m.key);
    for (const k of ['raid.prongsMax', 'raid.prongMinSize', 'client.haulerStepper']) {
      expect(keys, k).toContain(k);
      expect(TUNE_LABEL[k], k).toBeTruthy();
    }
    const m = tunableMeta(data);
    expect(m.find((x) => x.key === 'raid.prongsMax')).toMatchObject({ default: 2, min: 1, max: 3, scope: 'sim' });
    expect(m.find((x) => x.key === 'raid.prongMinSize')).toMatchObject({ default: 3, min: 2, max: 12, scope: 'sim' });
  });
});
