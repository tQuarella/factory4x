import { describe, expect, it } from 'vitest';
import rawData from '../../../data/sim.json' with { type: 'json' };
import { TUNABLE_KEYS, defaultData, nodeDistance, parseSimData, tunableMeta } from '../src/index.ts';
import { N, fresh } from './helpers.ts';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('data/sim.json', () => {
  it('is data version 2 and holds every tunable from the spec table with its default and range', () => {
    expect(defaultData.dataVersion).toBe(2);
    expect(defaultData.tickRate).toBe(30);
    expect(Object.keys(defaultData.tunables).sort()).toEqual([...TUNABLE_KEYS].sort());
    // Spot checks against DESIGN.md H1 "Tunables".
    expect(defaultData.tunables['ship.cost']).toEqual({ default: 15, min: 5, max: 60 });
    expect(defaultData.tunables['guardian.regrowTicks']).toEqual({ default: 60, min: 15, max: 1800 });
    expect(defaultData.tunables['stats.throughputWindowSec']).toEqual({ default: 60, min: 60, max: 60 });
    expect(defaultData.tunables['client.autosaveSec']).toEqual({ default: 5, min: 2, max: 60 });
  });

  it('has the M1 map: route lengths per the floor-sqrt rule, and nodes at least 140 su apart', () => {
    const w = fresh();
    expect(w.nodes.map((n) => n.id)).toEqual(['probe', 'a1', 'a2', 'a3', 'a4', 'a5', 'rich']);
    // The DESIGN table says 248 for a1; floor(sqrt(170² + 180²)) = floor(247.59) = 247 (see DECISIONS.md).
    expect([N.a1, N.a2, N.a3, N.a4, N.a5, N.rich].map((n) => nodeDistance(w, n, N.probe))).toEqual([247, 262, 504, 543, 620, 950]);
    expect(nodeDistance(w, N.a5, N.rich)).toBe(330);
    for (let a = 0; a < w.nodes.length; a++) {
      for (let b = a + 1; b < w.nodes.length; b++) expect(nodeDistance(w, a, b)).toBeGreaterThanOrEqual(140);
    }
  });

  it('tunable metadata marks stats.* fixed, client.* client-scope, and startStock new-run-only', () => {
    const meta = tunableMeta(defaultData);
    expect(meta.map((m) => m.key)).toEqual([...TUNABLE_KEYS]);
    const by = (k: string) => meta.find((m) => m.key === k)!;
    expect(by('ship.cost')).toEqual({ key: 'ship.cost', section: 'ship', default: 15, min: 5, max: 60, live: true, scope: 'sim', newRunOnly: false });
    expect(by('stats.throughputWindowSec').live).toBe(false);
    expect(by('client.autosaveSec').scope).toBe('client');
    expect(by('economy.startStock').newRunOnly).toBe(true);
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
});
