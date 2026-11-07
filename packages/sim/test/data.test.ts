import { describe, expect, it } from 'vitest';
import rawData from '../../../data/sim.json' with { type: 'json' };
import { TUNABLE_KEYS, createWorld, defaultData, nodeDistance, parseSimData, tunableMeta, type SimData } from '../src/index.ts';
import { N, fresh } from './helpers.ts';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Default data with system.variant forced (1 thin, 2 knotted, 3 deep). */
function withVariant(v: number): SimData {
  const d = clone(defaultData);
  d.tunables['system.variant'].default = v;
  return d;
}

describe('data/sim.json', () => {
  it('is data version 3 and holds every tunable from the spec tables with its default and range', () => {
    expect(defaultData.dataVersion).toBe(3);
    expect(defaultData.tickRate).toBe(30);
    expect(Object.keys(defaultData.tunables).sort()).toEqual([...TUNABLE_KEYS].sort());
    // Spot checks against DESIGN.md H1 "Tunables".
    expect(defaultData.tunables['ship.cost']).toEqual({ default: 15, min: 5, max: 60 });
    expect(defaultData.tunables['guardian.regrowTicks']).toEqual({ default: 60, min: 15, max: 1800 });
    expect(defaultData.tunables['stats.throughputWindowSec']).toEqual({ default: 60, min: 60, max: 60 });
    expect(defaultData.tunables['client.autosaveSec']).toEqual({ default: 5, min: 2, max: 60 });
    // DESIGN.md H2 "Tunables", every new key.
    expect(defaultData.tunables['root.capBonus']).toEqual({ default: 0, min: -14, max: 20 });
    expect(defaultData.tunables['root.regrowTicks']).toEqual({ default: 60, min: 15, max: 1800 });
    expect(defaultData.tunables['bloom.starvedCap']).toEqual({ default: 8, min: 1, max: 40 });
    expect(defaultData.tunables['bloom.starvedRegrowTicks']).toEqual({ default: 300, min: 15, max: 1800 });
    expect(defaultData.tunables['bloom.starvedRepairPerRound']).toEqual({ default: 0, min: 0, max: 20 });
    expect(defaultData.tunables['system.variant']).toEqual({ default: 0, min: 0, max: 3 });
  });

  it('has the three H2 variants and the root node entry', () => {
    expect(defaultData.map.variants).toEqual([
      { id: 'thin', name: 'Thin Root', x: 820, y: 110, rootCap: 4 },
      { id: 'knotted', name: 'Knotted Root', x: 850, y: 420, rootCap: 9 },
      { id: 'deep', name: 'Deep Root', x: 160, y: 480, rootCap: 14 },
    ]);
    expect(defaultData.map.nodes[7]).toEqual({ id: 'root', kind: 'root', x: 850, y: 420, r: 45, slots: 0 });
  });

  it('every Root position is at least 280 su from every other node', () => {
    for (let v = 1; v <= 3; v++) {
      const w = createWorld(0, withVariant(v));
      for (let n = 0; n < N.root; n++) expect(nodeDistance(w, N.root, n)).toBeGreaterThanOrEqual(280);
    }
  });

  it('has the M1 map: route lengths per the floor-sqrt rule, and nodes at least 140 su apart', () => {
    const w = fresh();
    expect(w.nodes.map((n) => n.id)).toEqual(['probe', 'a1', 'a2', 'a3', 'a4', 'a5', 'rich', 'root']);
    // The DESIGN table says 248 for a1; floor(sqrt(170² + 180²)) = floor(247.59) = 247 (see DECISIONS.md).
    expect([N.a1, N.a2, N.a3, N.a4, N.a5, N.rich].map((n) => nodeDistance(w, n, N.probe))).toEqual([247, 262, 504, 543, 620, 950]);
    expect(nodeDistance(w, N.a5, N.rich)).toBe(330);
    for (let a = 0; a < w.nodes.length; a++) {
      for (let b = a + 1; b < w.nodes.length; b++) expect(nodeDistance(w, a, b)).toBeGreaterThanOrEqual(140);
    }
  });

  it('tunable metadata marks stats.* fixed, client.* client-scope, and startStock and system.variant new-run-only', () => {
    const meta = tunableMeta(defaultData);
    expect(meta.map((m) => m.key)).toEqual([...TUNABLE_KEYS]);
    const by = (k: string) => meta.find((m) => m.key === k)!;
    expect(by('ship.cost')).toEqual({ key: 'ship.cost', section: 'ship', default: 15, min: 5, max: 60, live: true, scope: 'sim', newRunOnly: false });
    expect(by('stats.throughputWindowSec').live).toBe(false);
    expect(by('client.autosaveSec').scope).toBe('client');
    expect(by('economy.startStock').newRunOnly).toBe(true);
    expect(by('system.variant')).toMatchObject({ section: 'system', live: true, scope: 'sim', newRunOnly: true });
    expect(by('root.capBonus').newRunOnly).toBe(false);
  });
});

describe('parseSimData rejects bad data', () => {
  it('missing tunable', () => {
    const d = clone(rawData) as unknown as Record<string, Record<string, unknown>>;
    delete d.tunables!['ship.cost'];
    expect(() => parseSimData(d)).toThrow(/ship.cost missing/);
  });
  it('unknown tunable', () => {
    const d = clone(rawData) as unknown as Record<string, Record<string, unknown>>;
    d.tunables!['ship.warp'] = { default: 1, min: 0, max: 2 };
    expect(() => parseSimData(d)).toThrow(/unknown tunable/);
  });
  it('default outside its range, or not an integer', () => {
    const d = clone(rawData);
    d.tunables['ship.cost'].default = 61;
    expect(() => parseSimData(d)).toThrow(/outside/);
    d.tunables['ship.cost'].default = 15.5;
    expect(() => parseSimData(d)).toThrow(/integer/);
  });
  it('a map without the probe first or with two rich nodes', () => {
    const d = clone(rawData);
    d.map.nodes.reverse();
    expect(() => parseSimData(d)).toThrow(/probe/);
    const e = clone(rawData);
    e.map.nodes[1]!.kind = 'rich';
    expect(() => parseSimData(e)).toThrow(/rich/);
  });
  it('a map without exactly one root node', () => {
    const d = clone(rawData);
    d.map.nodes.pop();
    expect(() => parseSimData(d)).toThrow(/root/);
  });
  it('missing or malformed variants, and a system.variant range past the table', () => {
    const d = clone(rawData) as unknown as { map: Record<string, unknown> };
    delete d.map.variants;
    expect(() => parseSimData(d)).toThrow(/variants missing/);
    const e = clone(rawData);
    e.map.variants[1]!.rootCap = 41;
    expect(() => parseSimData(e)).toThrow(/rootCap/);
    const f = clone(rawData);
    f.map.variants[2]!.id = 'thin';
    expect(() => parseSimData(f)).toThrow(/unique/);
    const g = clone(rawData);
    g.map.variants.pop();
    expect(() => parseSimData(g)).toThrow(/system.variant/);
  });
});
