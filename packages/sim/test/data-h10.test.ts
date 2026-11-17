import { describe, expect, it } from 'vitest';
import design from '../../../DESIGN.md?raw';
import {
  TUNABLE_KEYS,
  createWorld,
  defaultData,
  deserializeWorld,
  parseSimData,
  runMode,
  serializeWorld,
  step,
  tunableMeta,
  worldHash,
  type TunableKey,
  type World,
} from '../src/index.ts';
import { fixtureV15, fixtureV16 } from './fixture.ts';

/**
 * h10-sim acceptance 1: data v17 (DESIGN.md H10 "Tunables (H10, all integers)" and "Save, data version and replay"). The keys
 * and ranges are checked against the spec's table; the v17 defaults against its "v17" side (h10-design-data moves the shipped
 * hive.rebuildTicks to the v18 side and this file's version pin with it).
 */
const h10At = design.indexOf('### H10 (Milestone 2, iteration 10');
const strip = (cell: string): string => cell.replace(/`/g, '');

function tableAfter(from: string): string[][] {
  if (h10At < 0) throw new Error('DESIGN.md has no H10 spec');
  const i = design.indexOf(from, h10At);
  if (i < 0) throw new Error(`DESIGN.md H10 has no "${from}"`);
  const lines = design.slice(i).split('\n');
  const start = lines.findIndex((l) => l.startsWith('|'));
  const rows: string[][] = [];
  for (let k = start; k < lines.length && lines[k]!.startsWith('|'); k++) {
    if (!lines[k]!.startsWith('| ---')) rows.push(lines[k]!.split('|').slice(1, -1).map((c) => c.trim()));
  }
  return rows.slice(1);
}

const H10_SIM = ['hive.rebuildTicks', 'raid.rollMax'];
const H10_CLIENT = ['client.raidSlowdown'];

describe('data/sim.json (shipped) at H10', () => {
  it('is data version 18, with the H10 keys at their v18 defaults (hive.rebuildTicks 600 from h10-design-data; raid.rollMax 0)', () => {
    expect(defaultData.dataVersion).toBe(18);
    expect([...H10_SIM, ...H10_CLIENT].map((k) => defaultData.tunables[k as TunableKey].default)).toEqual([600, 0, 1]);
  });

  it('matches the "Tunables (H10 …)" table: every key with its range, and the v17 default (the left of "v17 → v18")', () => {
    const rows = tableAfter('#### Tunables (H10, all integers)');
    expect(rows.map((r) => strip(r[0]!))).toEqual([...H10_SIM, ...H10_CLIENT]);
    for (const [key = '', shipped = '', range = ''] of rows) {
      const k = strip(key) as TunableKey;
      const [min, max] = range.split('–').map(Number);
      const v17 = Number(/^\d+/.exec(shipped)![0]);
      expect([k, defaultData.tunables[k].min, defaultData.tunables[k].max], k).toEqual([k, min, max]);
      expect([k, fixtureV16.tunables[k]], k).toEqual([k, { default: v17, min, max }]);
    }
  });

  it('the sim keys follow the H9 keys (after raid.prongMinSize), sim-scoped and live; the client key is last and client-scoped, as client.autosaveSec', () => {
    const at = TUNABLE_KEYS.indexOf('raid.prongMinSize');
    expect(TUNABLE_KEYS.slice(at + 1, at + 1 + H10_SIM.length)).toEqual(H10_SIM);
    expect(TUNABLE_KEYS.slice(-H10_CLIENT.length)).toEqual(H10_CLIENT);
    const meta = tunableMeta(defaultData);
    const row = (k: string) => meta.find((m) => m.key === k)!;
    for (const k of H10_SIM) expect([k, row(k).scope, row(k).live, row(k).newRunOnly]).toEqual([k, 'sim', true, false]);
    for (const k of H10_CLIENT) {
      expect([k, row(k).scope, row(k).live, row(k).newRunOnly]).toEqual([k, row('client.autosaveSec').scope, row('client.autosaveSec').live, false]);
    }
  });

  it('the client key never enters the sim: not in world.tun, and setTunable refuses it (the world steps as with no input)', () => {
    const w = createWorld(1, defaultData);
    for (const k of H10_CLIENT) expect(k in w.tun).toBe(false);
    for (const k of H10_SIM) expect(w.tun[k as keyof typeof w.tun]).toBe(defaultData.tunables[k as TunableKey].default);
    const probe = JSON.parse(JSON.stringify(w)) as World;
    step(probe, defaultData, [{ type: 'setTunable', key: 'client.raidSlowdown' as TunableKey, value: 0 }]);
    const plain = JSON.parse(JSON.stringify(w)) as World;
    step(plain, defaultData, []);
    expect(worldHash(probe)).toBe(worldHash(plain));
  });

  it('setTunable takes the rule keys within their ranges and refuses values outside them', () => {
    const w = createWorld(1, defaultData);
    step(w, defaultData, [{ type: 'setTunable', key: 'hive.rebuildTicks', value: 3600 }, { type: 'setTunable', key: 'raid.rollMax', value: 3 }]);
    expect([w.tun['hive.rebuildTicks'], w.tun['raid.rollMax']]).toEqual([3600, 3]);
    step(w, defaultData, [{ type: 'setTunable', key: 'hive.rebuildTicks', value: 3601 }, { type: 'setTunable', key: 'raid.rollMax', value: 4 }, { type: 'setTunable', key: 'raid.rollMax', value: -1 }]);
    expect([w.tun['hive.rebuildTicks'], w.tun['raid.rollMax']]).toEqual([3600, 3]);
  });

  it('a data file missing an H10 key is refused (parseSimData names it)', () => {
    for (const k of [...H10_SIM, ...H10_CLIENT]) {
      const raw = JSON.parse(JSON.stringify(fixtureV16)) as { tunables: Record<string, unknown> };
      delete raw.tunables[k];
      expect(() => parseSimData(raw)).toThrow(new RegExp(k.replace('.', '\\.')));
    }
  });

  it('an H9 save (data version 16) is refused as an old version, which the client discards with its toast', () => {
    const old = createWorld(1, fixtureV16);
    const r = deserializeWorld(serializeWorld(old), defaultData);
    expect(r).toEqual({ ok: false, reason: 'dataVersion', saveDataVersion: 16 });
  });
});

describe('the frozen v16 fixture', () => {
  it('is the shipped data as h9-design-data left it, plus the H10 keys: version 16, field mode, the shipped map.field and tunable set', () => {
    expect(fixtureV16.dataVersion).toBe(16);
    expect(runMode(fixtureV16)).toBe('field');
    expect(fixtureV16.map.field!.nodes).toEqual(defaultData.map.field!.nodes);
    expect(fixtureV16.map.field!.mine).toEqual(defaultData.map.field!.mine);
    expect(Object.keys(fixtureV16.tunables).sort()).toEqual(Object.keys(defaultData.tunables).sort());
    // The older fixtures carry the H10 keys at the values that keep their rules: both off.
    for (const k of [...H10_SIM, ...H10_CLIENT]) expect(fixtureV15.tunables[k as TunableKey]).toEqual(fixtureV16.tunables[k as TunableKey]);
  });
});
