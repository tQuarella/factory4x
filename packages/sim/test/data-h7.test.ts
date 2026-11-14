import { describe, expect, it } from 'vitest';
import design from '../../../DESIGN.md?raw';
import shippedRaw from '../../../data/sim.json' with { type: 'json' };
import {
  BUILD_TYPES,
  FIELD_PARKED_KEYS,
  PROBE,
  TUNABLE_KEYS,
  capEff,
  countGuards,
  createWorld,
  defaultData,
  guardianAt,
  nodeDistance,
  parseSimData,
  runMode,
  step,
  tunableMeta,
  withRunMode,
  type SimData,
  type TunableKey,
  type World,
} from '../src/index.ts';
import { fixtureData, fixtureV12, shippedCampaign } from './fixture.ts';
import rawV12 from './fixtures/sim-v12.json' with { type: 'json' };

declare const console: { log(...args: unknown[]): void };

/**
 * h7-sim acceptance 1 and 4: data v12 (DESIGN.md H7). The shipped data is checked against the H7 "The field"
 * and "Tunables (H7 …)" tables, so a retune edits data and DESIGN.md together and no test. Validation runs on the
 * frozen v12 fixture. The dataVersion pin lives here.
 */

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const strip = (cell: string): string => cell.replace(/`/g, '');
const h7At = design.indexOf('### H7 (Milestone 2, iteration 7');

/** Body rows of the first Markdown table after `from` in the H7 spec, cells trimmed. */
function tableAfter(from: string): string[][] {
  if (h7At < 0) throw new Error('DESIGN.md has no H7 spec');
  const i = design.indexOf(from, h7At);
  if (i < 0) throw new Error(`DESIGN.md H7 has no "${from}"`);
  const lines = design.slice(i).split('\n');
  const start = lines.findIndex((l) => l.startsWith('|'));
  const rows: string[][] = [];
  for (let k = start; k < lines.length && lines[k]!.startsWith('|'); k++) {
    if (!lines[k]!.startsWith('| ---')) rows.push(lines[k]!.split('|').slice(1, -1).map((c) => c.trim()));
  }
  return rows.slice(1);
}

/** The field as one row per node, in the form of the H7 "The field" table: id, kind, slots, prize, guards, mine at start, distance to the hive. */
function fieldRows(d: SimData): string[][] {
  const fm = d.map.field!;
  const frame = d.map.nodes.filter((n) => fm.nodes.includes(n.id));
  const heart = frame.find((n) => n.kind === 'heart')!;
  return frame.map((n) => {
    const dist = Math.floor(Math.sqrt((n.x - heart.x) * (n.x - heart.x) + (n.y - heart.y) * (n.y - heart.y)));
    const pocket = n.kind === 'pocket' ? fm.layout.pockets[n.id]! : null;
    const kind = n.kind === 'heart' ? 'the hive' : n.kind;
    const slots = n.kind === 'probe' ? '–' : String(pocket ? pocket.slots : n.slots);
    const prize = n.kind === 'probe' ? '–' : pocket ? pocket.prize : 'ore';
    const guards = pocket ? `${pocket.thorns} / ${pocket.spores}` : n.kind === 'heart' ? `${fm.layout.heart.thorns} / ${fm.layout.heart.spores}` : '–';
    const mine = n.kind === 'probe' ? '–' : fm.mine.includes(n.id) ? 'yes' : 'after capture';
    return [n.id, kind, slots, prize, guards, mine, String(dist)];
  });
}

/** The spec table expanded to one row per node ("`a1`, `a2` | … | 2 each" is two rows with slots 2). */
function specFieldRows(): string[][] {
  return tableAfter('#### The field (data `map.field`)').flatMap(([ids = '', kind = '', slots = '', ...rest]) =>
    strip(ids)
      .split(', ')
      .map((id) => [id, kind, slots.replace(' each', ''), ...rest]),
  );
}

describe('data/sim.json (shipped) at H7', () => {
  it('is data version 12', () => {
    expect(defaultData.dataVersion).toBe(12);
  });

  it('runs in field mode: run.mode is "field"', () => {
    expect(shippedRaw.run).toEqual({ mode: 'field' });
    expect(runMode(defaultData)).toBe('field');
  });

  it('matches the H7 "The field" table: nodes, kinds, slots, prizes, guards, Mine marks and distances to the hive', () => {
    expect(fieldRows(defaultData)).toEqual(specFieldRows());
    expect(defaultData.map.field!.nodes).toEqual(['probe', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'p1', 'p2', 'heart']);
    expect(defaultData.map.field!.mine).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']);
  });

  it('matches the "Tunables (H7 …)" table: every key with its default and range, live except the two landing weights (new runs only)', () => {
    const rows = tableAfter('#### Tunables (H7, data/sim.json, all integers)');
    const keys = rows.map((r) => strip(r[0]!) as TunableKey);
    expect(keys).toHaveLength(24);
    for (const [key = '', def = '', range = ''] of rows) {
      const k = strip(key) as TunableKey;
      const [min, max] = range.split('–').map(Number);
      expect(defaultData.tunables[k], k).toEqual({ default: Number(/^\d+/.exec(def)![0]), min, max });
    }
    // Every H7 key is in TUNABLE_KEYS, after the H6 keys and before stats.* and client.*.
    expect(TUNABLE_KEYS.slice(TUNABLE_KEYS.indexOf('system.variant') + 1, TUNABLE_KEYS.indexOf('stats.throughputWindowSec'))).toEqual(keys);
    const meta = tunableMeta(defaultData).filter((m) => keys.includes(m.key));
    const newRunOnly = ['alloc.start.extractor', 'alloc.start.hauler'];
    expect(meta.map((m) => [m.key, m.live, m.newRunOnly, m.scope])).toEqual(keys.map((k) => [k, true, newRunOnly.includes(k), 'sim']));
  });

  it('FIELD_PARKED_KEYS is exactly the tunables the spec keeps unused in field mode (wildcards expanded)', () => {
    const line = /\*\*Kept in data and code, unused in field mode:\*\*(.+)\n/.exec(design.slice(h7At))![1]!;
    const tokens = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]!).filter((t) => t.includes('.') && !t.startsWith('map.'));
    const want = TUNABLE_KEYS.filter((k) => tokens.some((t) => (t.endsWith('*') ? k.startsWith(t.slice(0, -1)) : k === t)));
    expect([...FIELD_PARKED_KEYS]).toEqual(want);
    expect(want).toContain('extractor.cost');
    expect(want).toContain('bloom.starvedRegrowMul');
    expect(want).not.toContain('ship.extractor.cost');
  });

  it('keeps the field checks at the defaults: ship.hauler.cargo ≤ node.bufferCap and economy.probeOrePerMin ≥ 1', () => {
    expect(defaultData.tunables['ship.hauler.cargo'].default).toBeLessThanOrEqual(defaultData.tunables['node.bufferCap'].default);
    expect(defaultData.tunables['economy.probeOrePerMin'].default).toBeGreaterThanOrEqual(1);
  });
});

describe('the frozen v12 fixture', () => {
  it('is data version 12 in field mode, and its map.field nodes and Mine marks are the shipped ones (calibration changes only values)', () => {
    expect(fixtureV12.dataVersion).toBe(12);
    expect(runMode(fixtureV12)).toBe('field');
    expect(fixtureV12.map.field!.nodes).toEqual(defaultData.map.field!.nodes);
    expect(fixtureV12.map.field!.mine).toEqual(defaultData.map.field!.mine);
    const frame = (d: SimData) => d.map.nodes.filter((n) => d.map.field!.nodes.includes(n.id));
    expect(frame(fixtureV12)).toEqual(frame(defaultData));
  });
});

describe('the campaign is untouched (run.mode absent or "campaign")', () => {
  it('data without `run` is a campaign: createWorld starts on the overworld with no field state', () => {
    expect(runMode(fixtureData)).toBe('campaign');
    const w = createWorld(1, fixtureData);
    expect([w.campaign.active, w.field, w.raid, w.nextRaidTick, w.nodes.length]).toEqual([null, null, null, 0, 0]);
  });

  it('withRunMode(shipped, "campaign") plays the parked campaign: createWorld starts on the overworld', () => {
    const w = createWorld(1, shippedCampaign);
    expect([w.campaign.active, w.field, w.nodes.length]).toEqual([null, null, 0]);
    expect(() => withRunMode(fixtureData, 'field')).toThrow('map.field');
  });
});

describe('F13: the landing (shipped data)', () => {
  it('a new run lands in the field: its nodes, full guards, economy.startStock ore, weights alloc.start.* with every warship at 0, the Mine marks of map.field.mine, and the rally at the probe', () => {
    const d = defaultData;
    const w = createWorld(7, d);
    const t = d.tunables;
    expect(w.campaign.active).toBeNull();
    expect(w.nodes.map((n) => n.id)).toEqual(d.map.field!.nodes);
    expect(w.stock).toEqual({ ore: t['economy.startStock'].default, ice: 0, crystal: 0, lens: 0, plating: 0 });
    expect(w.field!.alloc).toEqual({ extractor: t['alloc.start.extractor'].default, hauler: t['alloc.start.hauler'].default, drone: 0, lancer: 0, flak: 0 });
    expect(w.field!.share).toEqual({ extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 });
    expect(w.nodes.filter((n) => w.field!.mine[n.index]).map((n) => n.id)).toEqual(d.map.field!.mine);
    expect(w.rally).toBe(PROBE);
    expect(w.ships).toEqual([]);
    expect(w.field!.econ).toEqual([]);
    const layout = d.map.field!.layout;
    for (const g of w.guardians) {
      const id = w.nodes[g.node]!.id;
      const want = id === 'heart' ? layout.heart : layout.pockets[id]!;
      expect(countGuards(g), id).toEqual({ thorn: capEff(want.thorns, t['guard.capPct'].default), spore: capEff(want.spores, t['guard.capPct'].default) });
    }
    expect(w.guardians.map((g) => w.nodes[g.node]!.id)).toEqual(['p1', 'p2', 'heart']);
  });

  it('the landing weights are clamped to alloc.maxWeight (a non-default start above the max)', () => {
    const raw = clone(rawV12);
    raw.tunables['alloc.maxWeight'].default = 3;
    raw.tunables['alloc.start.extractor'].default = 5;
    raw.tunables['alloc.start.hauler'].default = 3;
    const w = createWorld(1, parseSimData(raw));
    expect([w.field!.alloc.extractor, w.field!.alloc.hauler]).toEqual([3, 3]);
  });

  it('the first ships a landing builds are economy ships: nothing but extractors and haulers in the first game minute', () => {
    const w = createWorld(1, defaultData);
    for (let i = 0; i < 1800; i++) step(w, defaultData, []);
    expect(w.ships).toEqual([]);
    expect(w.field!.econ.length).toBeGreaterThan(0);
    expect(w.stats.shipsBuilt).toEqual({ drone: 0, lancer: 0, flak: 0 });
  });

  /** True if `n` drones placed at `node` on a round tick capture it (the min-wave search's rule, on a field world with nothing else happening). */
  function dronesWin(base: Readonly<World>, node: number, n: number): boolean {
    const w = clone(base) as World;
    for (let i = 0; i < n; i++) w.ships.push({ id: w.nextId++, type: 'drone', hp: w.tun['ship.drone.hp'], at: node, transit: null, engagedIn: -1 });
    const g = guardianAt(w, node)!;
    for (let i = 0; i < 100_000; i++) {
      step(w, defaultData, []);
      if (!g.alive) return true;
      if (!w.ships.some((s) => s.at === node)) return false;
    }
    throw new Error('battle did not end');
  }

  it('no free first win: every guarded node\'s smallest drone wave is more than floor(economy.startStock ÷ ship.drone.cost) (reports each node)', () => {
    const t = defaultData.tunables;
    const affordable = Math.floor(t['economy.startStock'].default / t['ship.drone.cost'].default);
    const base = createWorld(1, defaultData);
    base.tun['economy.probeOrePerMin'] = 0;
    for (const type of BUILD_TYPES) base.field!.alloc[type] = 0;
    expect(base.tick % base.tun['combat.roundTicks']).toBe(0);
    const lines = [`F13 on shipped data v${defaultData.dataVersion}: the opening stock buys ${affordable} drones`];
    const fails: string[] = [];
    for (const g of base.guardians) {
      const id = base.nodes[g.node]!.id;
      let min: number | null = null;
      for (let n = 1; n <= 80 && min === null; n++) if (dronesWin(base, g.node, n)) min = n;
      lines.push(`  ${id}: smallest drone wave ${min ?? '>80'} (distance from the probe ${nodeDistance(base, PROBE, g.node)})`);
      if (min !== null && min <= affordable) fails.push(id);
    }
    console.log(lines.join('\n'));
    expect(fails).toEqual([]);
  });
});

describe('parseSimData rejects bad H7 data', () => {
  type Raw = ReturnType<typeof clone<typeof rawV12>>;
  const bad = (edit: (r: Raw & Record<string, unknown>) => void, msg: string | RegExp): void => {
    const r = clone(rawV12) as Raw & Record<string, unknown>;
    edit(r);
    expect(() => parseSimData(r)).toThrow(msg);
  };

  it('accepts the fixture, and campaign data with no map.field', () => {
    expect(() => parseSimData(clone(rawV12))).not.toThrow();
    const r = clone(rawV12) as Record<string, unknown> & { map: Record<string, unknown> };
    delete r.run;
    delete r.map.field;
    expect(runMode(parseSimData(r))).toBe('campaign');
  });

  it('a bad run.mode or an unknown run setting', () => {
    bad((r) => (r.run = { mode: 'overworld' } as never), 'run.mode must be one of campaign, field');
    bad((r) => (r.run = { mode: 'field', seed: 1 } as never), 'run.seed is not a run setting');
  });

  it('field mode without map.field', () => {
    bad((r) => delete (r.map as Record<string, unknown>).field, 'map.field is missing');
  });

  it('map.field nodes: an unknown id, a repeat, the Root, no probe first, no heart', () => {
    bad((r) => r.map.field.nodes.push('x9'), 'x9 is not a frame node id');
    bad((r) => r.map.field.nodes.push('a1'), 'a1 is listed twice');
    bad((r) => r.map.field.nodes.push('root'), 'the field has no Root');
    bad((r) => (r.map.field.nodes = ['a1', 'probe', ...r.map.field.nodes.slice(2)]), 'must start with the probe');
    bad((r) => (r.map.field.nodes = r.map.field.nodes.filter((id) => id !== 'heart')), 'must include the heart');
  });

  it('map.field.mine: a node not in the field, a pocket or the hive, a repeat', () => {
    bad((r) => r.map.field.mine.push('a9'), 'a9 is not a node of the field');
    bad((r) => r.map.field.mine.push('p1'), 'p1 is not an asteroid');
    bad((r) => r.map.field.mine.push('heart'), 'heart is not an asteroid');
    bad((r) => r.map.field.mine.push('a1'), 'a1 is listed twice');
  });

  it('map.field.layout: a missing or foreign pocket, a Root, starved counts, a count out of range', () => {
    bad((r) => delete (r.map.field.layout.pockets as Record<string, unknown>).p2, 'map.field.layout.pockets.p2 missing');
    bad((r) => ((r.map.field.layout.pockets as Record<string, unknown>).p3 = { prize: 'ice', slots: 2, thorns: 0, spores: 1 }), 'p3 is not a pocket node of the field');
    bad((r) => ((r.map.field.layout as Record<string, unknown>).root = { thorns: 0, spores: 1 }), 'the field has no Root');
    bad((r) => ((r.map.field.layout.heart as Record<string, unknown>).starvedThorns = 1), 'no Root to starve it');
    bad((r) => (r.map.field.layout.heart.spores = 61), 'map.field.layout.heart.spores must be an integer 0..60');
  });

  it('field mode: ship.hauler.cargo above node.bufferCap, or economy.probeOrePerMin below 1 (at the defaults)', () => {
    bad((r) => {
      r.tunables['ship.hauler.cargo'] = { default: 12, min: 1, max: 20 };
      r.tunables['node.bufferCap'] = { default: 10, min: 10, max: 200 };
    }, 'ship.hauler.cargo 12 is above node.bufferCap 10');
    bad((r) => (r.tunables['economy.probeOrePerMin'].default = 0), 'economy.probeOrePerMin must be at least 1');
    // The equal case passes.
    const r = clone(rawV12);
    r.tunables['ship.hauler.cargo'] = { default: 10, min: 1, max: 20 };
    r.tunables['node.bufferCap'] = { default: 10, min: 10, max: 200 };
    expect(() => parseSimData(r)).not.toThrow();
    // In campaign mode neither check applies.
    const c = clone(rawV12) as Record<string, unknown> & { tunables: Raw['tunables'] };
    c.run = { mode: 'campaign' };
    c.tunables['economy.probeOrePerMin'].default = 0;
    expect(() => parseSimData(c)).not.toThrow();
  });

  it('an H7 divisor whose range reaches 0', () => {
    bad((r) => (r.tunables['raid.econPerRaider'].min = 0), 'raid.econPerRaider must have min >= 1');
    bad((r) => (r.tunables['ship.hauler.speedSu'].min = 0), 'ship.hauler.speedSu must have min >= 1');
  });
});
