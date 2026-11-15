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
  type SimData,
  type TunableKey,
} from '../src/index.ts';
import { fixtureData, fixtureV10, fixtureV12, fixtureV13, fixtureV14, fixtureV8 } from './fixture.ts';
import { F } from './field-helpers.ts';

/**
 * h8-sim acceptance 2: data v14 (DESIGN.md H8 "Tunables (H8, data v14, all integers)" and "Save, data version and
 * replay"). The shipped data is checked against the spec's table, so a retune edits data and DESIGN.md together and
 * no test. The dataVersion pin lives here.
 */
const strip = (cell: string): string => cell.replace(/`/g, '');
const h8At = design.indexOf('### H8 (Milestone 2, iteration 8');

function tableAfter(from: string): string[][] {
  if (h8At < 0) throw new Error('DESIGN.md has no H8 spec');
  const i = design.indexOf(from, h8At);
  if (i < 0) throw new Error(`DESIGN.md H8 has no "${from}"`);
  const lines = design.slice(i).split('\n');
  const start = lines.findIndex((l) => l.startsWith('|'));
  const rows: string[][] = [];
  for (let k = start; k < lines.length && lines[k]!.startsWith('|'); k++) {
    if (!lines[k]!.startsWith('| ---')) rows.push(lines[k]!.split('|').slice(1, -1).map((c) => c.trim()));
  }
  return rows.slice(1);
}

const H8_SIM = ['hauler.autoNeed', 'hauler.needPct', 'rock.haulerMax', 'raid.shieldEcon', 'raid.haulersHold', 'move.splitPct'];
const H8_CLIENT = ['client.longPressMs', 'client.dragSlopPx', 'client.moveGesture'];

describe('data/sim.json (shipped) at H8', () => {
  it('is data version 15', () => {
    expect(defaultData.dataVersion).toBe(15);
  });

  it('matches the "Tunables (H8 …)" table: every key with its default and range', () => {
    const rows = tableAfter('#### Tunables (H8, data v14, all integers)');
    const keys = rows.map((r) => strip(r[0]!) as TunableKey);
    expect(keys).toEqual([...H8_SIM, ...H8_CLIENT]);
    for (const [key = '', def = '', range = ''] of rows) {
      const k = strip(key) as TunableKey;
      const [min, max] = range.split('–').map(Number);
      expect(defaultData.tunables[k], k).toEqual({ default: Number(/^\d+/.exec(def)![0]), min, max });
    }
  });

  it('the sim keys follow the H7 keys (after hive.regrowPct) and are sim-scoped and live; the client keys follow client.autosaveSec and are client-scoped, as it is', () => {
    const at = TUNABLE_KEYS.indexOf('hive.regrowPct');
    expect(TUNABLE_KEYS.slice(at + 1, at + 1 + H8_SIM.length)).toEqual(H8_SIM);
    const c = TUNABLE_KEYS.indexOf('client.autosaveSec');
    expect(TUNABLE_KEYS.slice(c + 1)).toEqual(H8_CLIENT);
    const meta = tunableMeta(defaultData);
    const row = (k: string) => meta.find((m) => m.key === k)!;
    for (const k of H8_SIM) expect([k, row(k).scope, row(k).live, row(k).newRunOnly]).toEqual([k, 'sim', true, false]);
    for (const k of H8_CLIENT) expect([k, row(k).scope, row(k).live, row(k).newRunOnly]).toEqual([k, row('client.autosaveSec').scope, row('client.autosaveSec').live, false]);
    // Client keys never enter the sim's tunables.
    const w = createWorld(1, defaultData);
    for (const k of H8_CLIENT) expect(k in w.tun).toBe(false);
    for (const k of H8_SIM) expect(w.tun[k as keyof typeof w.tun]).toBe(defaultData.tunables[k as TunableKey].default);
  });

  it('a data file missing an H8 key is refused (parseSimData names it)', () => {
    const raw = JSON.parse(JSON.stringify(fixtureV14)) as { tunables: Record<string, unknown> };
    delete raw.tunables['hauler.needPct'];
    expect(() => parseSimData(raw)).toThrow(/hauler\.needPct/);
  });
});

describe('the frozen fixtures and the H8 keys', () => {
  it('v14 is the shipped data as h8-sim leaves it: version 14, field mode, the shipped map.field, every H8 key at its spec default', () => {
    expect(fixtureV14.dataVersion).toBe(14);
    expect(runMode(fixtureV14)).toBe('field');
    expect(fixtureV14.map.field!.nodes).toEqual(defaultData.map.field!.nodes);
    expect(fixtureV14.map.field!.mine).toEqual(defaultData.map.field!.mine);
    expect(H8_SIM.map((k) => fixtureV14.tunables[k as TunableKey].default)).toEqual([1, 110, 6, 1, 1, 50]);
  });

  it('the older fixtures (v4, v8, v10, v12, v13) carry the H8 keys at H7 behaviour: hauler.autoNeed, raid.shieldEcon and raid.haulersHold 0', () => {
    const olds: SimData[] = [fixtureData, fixtureV8, fixtureV10, fixtureV12, fixtureV13];
    for (const d of olds) {
      expect([d.dataVersion, d.tunables['hauler.autoNeed'].default, d.tunables['raid.shieldEcon'].default, d.tunables['raid.haulersHold'].default]).toEqual([d.dataVersion, 0, 0, 0]);
    }
    expect(olds.map((d) => d.dataVersion)).toEqual([4, 8, 10, 12, 13]);
    expect(fixtureV13.map.field!.nodes).toEqual(defaultData.map.field!.nodes);
  });
});

describe('haulerSet in the field state (saved)', () => {
  it('starts as Auto (null) on every node, and a set count survives save and load exactly', () => {
    const w = createWorld(1, fixtureV14);
    expect(w.field!.haulerSet).toEqual(w.nodes.map(() => null));
    step(w, fixtureV14, [{ type: 'setHaulers', node: F.a5, count: 4 }]);
    const back = deserializeWorld(serializeWorld(w), fixtureV14);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.world.field!.haulerSet[F.a5]).toBe(4);
    expect(worldHash(back.world)).toBe(worldHash(w));
  });

  it('a save without haulerSet, with the wrong length, or with a bad count is corrupt', () => {
    const w = createWorld(1, fixtureV14);
    const text = serializeWorld(w);
    const edits: Array<(f: Record<string, unknown>) => void> = [
      (f) => delete f.haulerSet,
      (f) => (f.haulerSet = [null]),
      (f) => ((f.haulerSet as unknown[])[1] = -1),
      (f) => ((f.haulerSet as unknown[])[1] = 1.5),
      (f) => ((f.haulerSet as unknown[])[1] = '2'),
    ];
    edits.forEach((edit, i) => {
      const bad = JSON.parse(text) as { world: { field: Record<string, unknown> } };
      edit(bad.world.field);
      expect(deserializeWorld(JSON.stringify(bad), fixtureV14), `edit ${i}`).toMatchObject({ ok: false, reason: 'corrupt' });
    });
    const ok = JSON.parse(text) as { world: { field: { haulerSet: unknown[] } } };
    ok.world.field.haulerSet[1] = 0;
    expect(deserializeWorld(JSON.stringify(ok), fixtureV14).ok).toBe(true);
  });

  it('an H7 save (data version 13) is refused as an old version', () => {
    const w = createWorld(1, fixtureV13);
    expect(deserializeWorld(serializeWorld(w), fixtureV14)).toMatchObject({ ok: false, reason: 'dataVersion' });
  });
});

describe('the opening on shipped data (H1 amendment): what any calibration must keep', () => {
  it('with no inputs, staffing by need builds the first hauler no later than H7 plus a build, delivers first no later than H7, and delivers at least as much by minutes 1, 2 and 3', () => {
    const run = (auto: number): { firstHauler: number; firstDelivery: number; byMinute: number[] } => {
      const w = createWorld(1, defaultData);
      w.tun['hauler.autoNeed'] = auto;
      let firstHauler = -1;
      const byMinute: number[] = [];
      for (let t = 0; t < 3 * 1800; t++) {
        step(w, defaultData, []);
        if (firstHauler < 0 && w.stats.econBuilt.hauler > 0) firstHauler = t;
        if ((t + 1) % 1800 === 0) byMinute.push(w.stats.delivered.ore);
      }
      return { firstHauler, firstDelivery: w.stats.firstDeliveredTick.ore ?? Infinity, byMinute };
    };
    const h8 = run(1);
    const h7 = run(0);
    expect(h8.firstHauler).toBeGreaterThanOrEqual(0);
    expect(h8.firstHauler).toBeLessThanOrEqual(h7.firstHauler + defaultData.tunables['ship.hauler.buildTicks'].default);
    expect(h8.firstDelivery).toBeLessThanOrEqual(h7.firstDelivery);
    for (let m = 0; m < 3; m++) expect(h8.byMinute[m], `minute ${m + 1}`).toBeGreaterThanOrEqual(h7.byMinute[m]!);
  });
});
