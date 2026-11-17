import { describe, expect, it } from 'vitest';
import { defaultData, tunableMeta } from '@factory4x/sim';
import { hiveGuardsLine, hiveLabelCount, hiveLostText, raidLiveLine } from '../src/hivereport.ts';
import { hiveCountText } from '../src/report.ts';
import { CLIENT_SETTING_KEYS, defaultSettings, loadSettings, type StorageLike } from '../src/persist.ts';
import { TUNE_LABEL } from '../src/panels.ts';

const store = (text: string | null): StorageLike => ({ getItem: () => text, setItem: () => undefined, removeItem: () => undefined });

describe('the hive sheet line', () => {
  const rb = { ticks: 600, progress: 0, nextType: 'thorn' as const };
  it('reads "Guards 18 / 30 · +1 Thorn in 14 s" in game seconds, rounded up', () => {
    expect(hiveGuardsLine(18, 30, { ...rb, progress: 600 - 14 * 30 + 5 }, 30)).toBe('Guards 18 / 30 · +1 Thorn in 14 s');
    expect(hiveGuardsLine(18, 30, { ...rb, nextType: 'spore', progress: 0 }, 30)).toBe('Guards 18 / 30 · +1 Spore in 20 s');
  });
  it('reads "Guards 30 / 30" when full, and nothing without a rebuild queue', () => {
    expect(hiveGuardsLine(30, 30, { ...rb, nextType: null }, 30)).toBe('Guards 30 / 30');
    expect(hiveGuardsLine(18, 30, null, 30)).toBeNull();
  });
});

describe('the map label, reports and banner', () => {
  it('the label count shows only below the caps', () => {
    expect(hiveLabelCount(18, 30)).toBe('18/30');
    expect(hiveLabelCount(30, 30)).toBeNull();
  });
  it('"Hive −N" only when raiders were killed; the battle line reads "Hive 20 / 30"', () => {
    expect(hiveLostText(12)).toBe(` · Hive${String.fromCharCode(160)}−12`);
    expect(hiveLostText(0)).toBe('');
    expect(hiveCountText(20, 30)).toBe('Hive 20 / 30');
  });
  it('a rolling prong reads "A5 hit → A6"; with no roll the line is H9\'s', () => {
    const p = (target: string, phase: string, left: number, rolledFrom: string | null) => ({ target, phase, left, rolledFrom });
    expect(raidLiveLine([p('A6', 'out', 0, 'A5')])).toBe('Raid A5 hit → A6');
    expect(raidLiveLine([p('A7', 'fight', 3, null), p('A6', 'out', 0, 'A5')])).toBe('Raid at A7: 3 left · A5 hit → A6');
    expect(raidLiveLine([p('A5', 'fight', 3, null)])).toBe('Raid at A5: 3 left');
    expect(raidLiveLine([p('A5', 'fight', 3, null), p('A6', 'fight', 4, null)])).toBe('Raid at A5: 3 left · A6: 4 left');
    // After the roll it fights at the new rock: no roll segment.
    expect(raidLiveLine([p('A6', 'fight', 2, 'A5')])).toBe('Raid at A6: 2 left');
  });
});

describe('the tuning keys', () => {
  it('client.raidSlowdown is a client key, default 1, stored in the settings and loaded only when valid', () => {
    const m = tunableMeta(defaultData).find((x) => x.key === 'client.raidSlowdown')!;
    expect([m.default, m.min, m.max, m.scope]).toEqual([1, 0, 1, 'client']);
    expect(CLIENT_SETTING_KEYS['client.raidSlowdown']).toBe('raidSlowdown');
    const d = defaultSettings(defaultData);
    expect(d.raidSlowdown).toBe(1);
    expect(loadSettings(defaultData, store(JSON.stringify({ ...d, raidSlowdown: 0 }))).raidSlowdown).toBe(0);
    expect(loadSettings(defaultData, store(JSON.stringify({ ...d, raidSlowdown: 2 }))).raidSlowdown).toBe(1);
  });
  it('hive.rebuildTicks and raid.rollMax are listed, and hive.regrowPct says it is used only without the rebuild', () => {
    const keys = tunableMeta(defaultData).filter((m) => m.live).map((m) => m.key);
    expect(keys).toContain('hive.rebuildTicks');
    expect(keys).toContain('raid.rollMax');
    expect(keys).toContain('hive.regrowPct');
    expect(TUNE_LABEL['hive.regrowPct']).toMatch(/only when Hive rebuild is 0/);
  });
});
