import { describe, expect, it } from 'vitest';
import design from '../../../DESIGN.md?raw';
import {
  TUNABLE_KEYS,
  createWorld,
  defaultData,
  deserializeWorld,
  fieldSummary,
  hashState,
  parseSimData,
  runMode,
  serializeWorld,
  step,
  tunableMeta,
  worldHash,
  type SimData,
  type TunableKey,
  type World,
} from '../src/index.ts';
import { fixtureData, fixtureV10, fixtureV12, fixtureV13, fixtureV14, fixtureV15, fixtureV16, fixtureV8 } from './fixture.ts';
import { F } from './field-helpers.ts';
import { withoutH10 } from './h10-strip.ts';

/**
 * h9-sim acceptance 1 (data v15) and 4 (the opening is H8's). DESIGN.md H9 "Tunables (H9, data v15, all integers)"
 * and "Save, data version and replay". The shipped data is checked against the spec's table, so a retune edits data
 * and DESIGN.md together and no test. The dataVersion pin lives here.
 */
const strip = (cell: string): string => cell.replace(/`/g, '');
const h9At = design.indexOf('### H9 (Milestone 2, iteration 9');

function tableAfter(from: string): string[][] {
  if (h9At < 0) throw new Error('DESIGN.md has no H9 spec');
  const i = design.indexOf(from, h9At);
  if (i < 0) throw new Error(`DESIGN.md H9 has no "${from}"`);
  const lines = design.slice(i).split('\n');
  const start = lines.findIndex((l) => l.startsWith('|'));
  const rows: string[][] = [];
  for (let k = start; k < lines.length && lines[k]!.startsWith('|'); k++) {
    if (!lines[k]!.startsWith('| ---')) rows.push(lines[k]!.split('|').slice(1, -1).map((c) => c.trim()));
  }
  return rows.slice(1);
}

const H9_SIM = ['raid.prongsMax', 'raid.prongMinSize'];
const H9_CLIENT = ['client.haulerStepper'];

describe('data/sim.json (shipped) at H9', () => {
  it('is data version 16 (h10-sim: the v16 data is frozen in fixtures/sim-v16.json; the shipped pin is in data-h10.test.ts)', () => {
    expect(fixtureV16.dataVersion).toBe(16);
    expect(fixtureV16.tunables['raid.prongsMax']).toEqual(defaultData.tunables['raid.prongsMax']);
  });

  it('matches the "Tunables (H9 …)" table: every key with its default and range', () => {
    const rows = tableAfter('#### Tunables (H9, data v16, all integers)');
    const keys = rows.map((r) => strip(r[0]!) as TunableKey);
    expect(keys).toEqual([...H9_SIM, ...H9_CLIENT]);
    for (const [key = '', def = '', range = ''] of rows) {
      const k = strip(key) as TunableKey;
      const [min, max] = range.split('–').map(Number);
      expect(defaultData.tunables[k], k).toEqual({ default: Number(/^\d+/.exec(def)![0]), min, max });
    }
  });

  it('the sim keys follow the H8 keys (after move.splitPct) and are sim-scoped and live; the client key follows the H8 client keys (after client.moveGesture) and is client-scoped, as client.autosaveSec', () => {
    const at = TUNABLE_KEYS.indexOf('move.splitPct');
    expect(TUNABLE_KEYS.slice(at + 1, at + 1 + H9_SIM.length)).toEqual(H9_SIM);
    // (Last until h10-sim appended client.raidSlowdown after it.)
    const c = TUNABLE_KEYS.indexOf('client.moveGesture');
    expect(TUNABLE_KEYS.slice(c + 1, c + 1 + H9_CLIENT.length)).toEqual(H9_CLIENT);
    const meta = tunableMeta(defaultData);
    const row = (k: string) => meta.find((m) => m.key === k)!;
    for (const k of H9_SIM) expect([k, row(k).scope, row(k).live, row(k).newRunOnly]).toEqual([k, 'sim', true, false]);
    for (const k of H9_CLIENT) {
      expect([k, row(k).scope, row(k).live, row(k).newRunOnly]).toEqual([k, row('client.autosaveSec').scope, row('client.autosaveSec').live, false]);
    }
    // The client key never enters the sim's tunables, and setTunable refuses it.
    const w = createWorld(1, defaultData);
    for (const k of H9_CLIENT) expect(k in w.tun).toBe(false);
    for (const k of H9_SIM) expect(w.tun[k as keyof typeof w.tun]).toBe(defaultData.tunables[k as TunableKey].default);
    const before = worldHash(w);
    const probe = JSON.parse(JSON.stringify(w)) as World;
    step(probe, defaultData, [{ type: 'setTunable', key: 'client.haulerStepper' as TunableKey, value: 1 }]);
    const plain = JSON.parse(JSON.stringify(w)) as World;
    step(plain, defaultData, []);
    expect(worldHash(probe)).toBe(worldHash(plain));
    expect(worldHash(w)).toBe(before);
  });

  it('a data file missing an H9 key is refused (parseSimData names it)', () => {
    for (const k of [...H9_SIM, ...H9_CLIENT]) {
      const raw = JSON.parse(JSON.stringify(fixtureV15)) as { tunables: Record<string, unknown> };
      delete raw.tunables[k];
      expect(() => parseSimData(raw)).toThrow(new RegExp(k.replace('.', '\\.')));
    }
  });
});

describe('the frozen fixtures and the H9 keys', () => {
  it('v15 is the shipped data as h9-sim leaves it: version 15, field mode, the shipped map.field, every H9 key at its spec default', () => {
    expect(fixtureV15.dataVersion).toBe(15);
    expect(runMode(fixtureV15)).toBe('field');
    expect(fixtureV15.map.field!.nodes).toEqual(defaultData.map.field!.nodes);
    expect(fixtureV15.map.field!.mine).toEqual(defaultData.map.field!.mine);
    expect([...H9_SIM, ...H9_CLIENT].map((k) => fixtureV15.tunables[k as TunableKey].default)).toEqual([2, 4, 0]);
  });

  it('v15 is v14 plus the H9 keys: every other tunable and the map are v14\'s', () => {
    const drop = (d: SimData): unknown => {
      const c = JSON.parse(JSON.stringify(d)) as { dataVersion?: number; tunables: Record<string, unknown> };
      delete c.dataVersion;
      for (const k of [...H9_SIM, ...H9_CLIENT]) delete c.tunables[k];
      return c;
    };
    expect(drop(fixtureV15)).toEqual(drop(fixtureV14));
  });

  it('the older fixtures (v4 to v14) carry the H9 keys at H8 behaviour: raid.prongsMax 1 (W8) and client.haulerStepper 1', () => {
    const olds: SimData[] = [fixtureData, fixtureV8, fixtureV10, fixtureV12, fixtureV13, fixtureV14];
    expect(olds.map((d) => d.dataVersion)).toEqual([4, 8, 10, 12, 13, 14]);
    for (const d of olds) {
      expect([d.dataVersion, d.tunables['raid.prongsMax'].default, d.tunables['raid.prongMinSize'].default, d.tunables['client.haulerStepper'].default]).toEqual([d.dataVersion, 1, 4, 1]);
    }
  });
});

describe('extractorSet in the field state (saved), and stats.raidProngs', () => {
  it('extractorSet starts as All (null) on every node; stats.raidProngs starts at zero; both survive save and load exactly', () => {
    const w = createWorld(1, fixtureV15);
    expect(w.field!.extractorSet).toEqual(w.nodes.map(() => null));
    expect(w.stats.raidProngs).toEqual({ beaten: 0, hit: 0, turnedBack: 0 });
    expect(fieldSummary(w).raidProngs).toEqual({ beaten: 0, hit: 0, turnedBack: 0 });
    step(w, fixtureV15, [{ type: 'setExtractors', node: F.a5, count: 2 }]);
    w.stats.raidProngs = { beaten: 1, hit: 2, turnedBack: 3 };
    const back = deserializeWorld(serializeWorld(w), fixtureV15);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.world.field!.extractorSet[F.a5]).toBe(2);
    expect(fieldSummary(back.world).raidProngs).toEqual({ beaten: 1, hit: 2, turnedBack: 3 });
    expect(worldHash(back.world)).toBe(worldHash(w));
  });

  it('a save without extractorSet, with the wrong length or a bad count, without raidProngs, or with a last raid without prongs is corrupt', () => {
    const w = createWorld(1, fixtureV15);
    w.lastRaid = { id: 1, outcome: 'hit', target: F.a5, endTick: 0, lostEcon: { extractor: 1, hauler: 0 }, lostShips: { drone: 0, lancer: 0, flak: 0 }, killed: { thorn: 0, spore: 0 }, prongs: [{ target: F.a5, outcome: 'hit', lostEcon: { extractor: 1, hauler: 0 }, lostShips: { drone: 0, lancer: 0, flak: 0 }, killed: { thorn: 0, spore: 0 }, hitRocks: [F.a5] }] };
    const text = serializeWorld(w);
    type Save = { world: { field: Record<string, unknown>; stats: Record<string, unknown>; lastRaid: Record<string, unknown> } };
    const edits: Array<(s: Save) => void> = [
      (s) => delete s.world.field.extractorSet,
      (s) => (s.world.field.extractorSet = [null]),
      (s) => ((s.world.field.extractorSet as unknown[])[1] = 0),
      (s) => ((s.world.field.extractorSet as unknown[])[1] = -1),
      (s) => ((s.world.field.extractorSet as unknown[])[1] = 1.5),
      (s) => ((s.world.field.extractorSet as unknown[])[1] = '2'),
      (s) => delete s.world.stats.raidProngs,
      (s) => ((s.world.stats.raidProngs as Record<string, unknown>).hit = '1'),
      (s) => delete s.world.lastRaid.prongs,
    ];
    edits.forEach((edit, i) => {
      const bad = JSON.parse(text) as Save;
      edit(bad);
      expect(deserializeWorld(JSON.stringify(bad), fixtureV15), `edit ${i}`).toMatchObject({ ok: false, reason: 'corrupt' });
    });
    const ok = JSON.parse(text) as Save;
    (ok.world.field.extractorSet as unknown[])[1] = 1;
    expect(deserializeWorld(JSON.stringify(ok), fixtureV15).ok).toBe(true);
  });

  it('an H8 save (data version 14) is refused as an old version', () => {
    const w = createWorld(1, fixtureV14);
    expect(deserializeWorld(serializeWorld(w), fixtureV15)).toMatchObject({ ok: false, reason: 'dataVersion' });
  });
});

/**
 * h9-sim acceptance 4: on v15 with no inputs, the first 6 game minutes are H8's. The pinned values were produced by
 * running this same loop on main at 2ceada1 (the H8 code, before any h9-sim change) with its data/sim.json (v14), via
 * `git archive 2ceada1 packages/sim data` and the same projection:
 *  - every tick, a chained hash over the tick, the warships, the economy ships, the stock, the ore (and ice and
 *    crystal) delivered, the economy bays, the warship bays and the shares, so a difference on any tick shows;
 *  - every 600th tick, the hash of the whole world without what h9-sim added (dataVersion, raid.prongsMax,
 *    raid.prongMinSize, field.extractorSet, stats.raidProngs and lastRaid.prongs).
 * So the hashes differ from v14's only by the version and the new keys. The run includes two raids (both hit).
 */
const V14_CHAIN = 'a48e6bea';
const V14_MARKS = [
  '3f695429', '569b2b17', 'f6f85a85', '980a922d', '69a8d8d9', '8493cb97', 'fe322b9b', 'f8c098b2', '17d2fe2f',
  'c038547a', '4da1052e', '80fc6878', 'e8a5e836', 'c3abb8f3', '401308e3', 'ea613c17', '2bada2fc', '8e836d23',
];

function withoutH9(world: World): unknown {
  // h10-sim: and without what H10 added (`withoutH10`), so the v14 code's marks still apply.
  const c = withoutH10(world) as {
    dataVersion?: number;
    tun: Record<string, unknown>;
    field: Record<string, unknown>;
    stats: Record<string, unknown>;
    lastRaid: Record<string, unknown> | null;
  };
  delete c.dataVersion;
  for (const k of H9_SIM) delete c.tun[k];
  delete c.field.extractorSet;
  delete c.stats.raidProngs;
  if (c.lastRaid !== null) delete c.lastRaid.prongs;
  return c;
}

describe('the opening is H8\'s (acceptance 4)', () => {
  it('v15 with no inputs matches the v14 code tick for tick for 6 game minutes (ships, ore delivered, bays), and the whole world every 600 ticks', () => {
    const w = createWorld(1, fixtureV15);
    let chain = '';
    const marks: string[] = [];
    for (let t = 0; t < 6 * 1800; t++) {
      step(w, fixtureV15, []);
      const f = w.field!;
      chain = hashState([chain, { tick: w.tick, ships: w.ships, econ: f.econ, stock: w.stock, delivered: w.stats.delivered, bays: f.bays, yards: w.yards, share: f.share }]);
      if ((t + 1) % 600 === 0) marks.push(hashState(withoutH9(w)));
    }
    expect(marks).toEqual(V14_MARKS);
    expect(chain).toBe(V14_CHAIN);
    // The run reached the states the comparison is about: a grown economy, deliveries and two finished raids.
    expect([w.field!.econ.length, w.stats.delivered.ore, w.stats.raids.mustered, w.stats.raids.hit]).toEqual([12, 199, 2, 2]);
    expect(w.lastRaid!.prongs).toHaveLength(1);
  });
});
