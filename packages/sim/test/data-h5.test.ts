import { describe, expect, it } from 'vitest';
import design from '../../../DESIGN.md?raw';
import { RAW_RESOURCES, defaultData, parseSimData, tunableMeta, type SimData } from '../src/index.ts';
import { fixtureV8 } from './fixture.ts';
import rawV8 from './fixtures/sim-v8.json' with { type: 'json' };

/**
 * h5-sim acceptance 2 and 3: data v8. The dataVersion pin lives here (moved
 * from data-h4.test.ts). The shipped data is checked against the DESIGN.md
 * H5 "Tunables (H5 …)" table, so a retune edits data and DESIGN.md together
 * and no test; the Command limit rows and the v8 hauls are checked by the H4
 * "Research" and "Areas" table tests in data-h4.test.ts. Validation is tested
 * on the frozen v8 fixture (fixtures/sim-v8.json).
 */

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const strip = (cell: string): string => cell.replace(/`/g, '');

const h5At = design.indexOf('### H5 (Milestone 2, iteration 5');

/** Body rows of the first Markdown table after `from` in the H5 spec (cells trimmed). */
function h5Table(from: string): string[][] {
  if (h5At < 0) throw new Error('DESIGN.md has no H5 spec');
  const at = design.indexOf(from, h5At);
  if (at < 0) throw new Error(`H5 spec has no "${from}"`);
  const lines = design.slice(at).split('\n');
  const start = lines.findIndex((l) => l.startsWith('|'));
  const rows: string[][] = [];
  for (let i = start; i < lines.length && lines[i]!.startsWith('|'); i++) {
    if (!lines[i]!.startsWith('| ---')) rows.push(lines[i]!.split('|').slice(1, -1).map((c) => c.trim()));
  }
  return rows.slice(1);
}

const H5_KEYS = ['fleet.cap', 'fleet.recycleRefundPct', 'research.fleet.step'];

describe('data/sim.json (shipped) at H5', () => {
  it('is data version 8', () => {
    expect(defaultData.dataVersion).toBe(8);
  });

  it('matches the "Tunables (H5, data/sim.json, all integers)" table; all three are live sim tunables', () => {
    const rows = h5Table('#### Tunables (H5, data/sim.json, all integers)');
    expect(rows.map((r) => strip(r[0]!)).sort()).toEqual([...H5_KEYS].sort());
    for (const [key = '', def = '', range = ''] of rows) {
      const k = strip(key) as keyof SimData['tunables'];
      const [min, max] = range.split('–').map(Number);
      expect(defaultData.tunables[k], k).toEqual({ default: Number(def), min, max });
    }
    const meta = tunableMeta(defaultData).filter((m) => H5_KEYS.includes(m.key));
    expect(meta.map((m) => [m.key, m.live, m.newRunOnly, m.scope]).sort()).toEqual(H5_KEYS.map((k) => [k, true, false, 'sim']).sort());
  });

  it('keeps Σ haul ≥ Σ research cost per resource, Command limit included (calibration-proof)', () => {
    for (const res of RAW_RESOURCES) {
      const haul = defaultData.map.areas.reduce((s, a) => s + a.haul[res], 0);
      const cost = defaultData.research.reduce((s, it) => s + it.levels.reduce((x, lv) => x + lv[res], 0), 0);
      expect(haul, res).toBeGreaterThanOrEqual(cost);
    }
    expect(defaultData.research.find((r) => r.id === 'fleet')?.kind).toBe('limit');
  });
});

describe('the frozen v8 fixture', () => {
  it('is data version 8 with the H5 tunables at their spec values and Command limit as the h5-sim spec gave it', () => {
    expect(fixtureV8.dataVersion).toBe(8);
    expect(H5_KEYS.map((k) => fixtureV8.tunables[k as keyof SimData['tunables']])).toEqual([
      { default: 12, min: 0, max: 60 },
      { default: 50, min: 0, max: 100 },
      { default: 6, min: 2, max: 12 },
    ]);
    const fleet = fixtureV8.research.find((r) => r.id === 'fleet')!;
    expect(fleet.levels.map((lv) => [lv.ore, lv.ice, lv.crystal])).toEqual([
      [60, 20, 20],
      [140, 40, 40],
      [240, 60, 60],
    ]);
    expect(fleet.requires).toEqual([
      { tier: 1, count: 1, atLevel: 1 },
      { tier: 2, count: 1, atLevel: 2 },
      { tier: 2, count: 2, atLevel: 3 },
    ]);
  });
});

describe('parseSimData rejects bad H5 data', () => {
  type Raw = typeof rawV8;
  const bad = (edit: (d: Raw) => void, msg: RegExp): void => {
    const d = clone(rawV8);
    edit(d);
    expect(() => parseSimData(d)).toThrow(msg);
  };
  const fleet = (d: Raw) => d.research.find((r) => r.id === 'fleet')! as unknown as { kind: string; requires: Array<Record<string, unknown>>; levels: Array<Record<string, number>> };

  it('a tier requirement names a tier the areas have, and a count from 1 to the areas of at least that tier', () => {
    bad((d) => (fleet(d).requires[0] = { tier: 4, count: 1 }), /tier must be one of the area tiers/);
    bad((d) => (fleet(d).requires[0] = { tier: -1, count: 1 }), /tier must be one of the area tiers/);
    bad((d) => (fleet(d).requires[0] = { tier: 1.5, count: 1 }), /tier must be one of the area tiers/);
    bad((d) => (fleet(d).requires[0] = { tier: 1, count: 0 }), /count must be 1\.\.5/);
    // Tier ≥ 2: veil, garden and deep.
    bad((d) => (fleet(d).requires[0] = { tier: 2, count: 4 }), /count must be 1\.\.3/);
    bad((d) => (fleet(d).requires[0] = { tier: 3, count: 2 }), /count must be 1\.\.1/);
    // The edges are fine.
    for (const q of [
      { tier: 0, count: 6 },
      { tier: 2, count: 3 },
      { tier: 3, count: 1 },
    ]) {
      const d = clone(rawV8);
      fleet(d).requires[0] = q;
      expect(() => parseSimData(d), JSON.stringify(q)).not.toThrow();
    }
  });

  it('atLevel is one of the item\'s levels', () => {
    bad((d) => (fleet(d).requires[0]!.atLevel = 4), /atLevel must be 1\.\.3/);
    bad((d) => (fleet(d).requires[0]!.atLevel = 0), /atLevel must be 1\.\.3/);
    bad((d) => ((d.research[0]!.requires as unknown[]).push({ area: 'shelf', atLevel: 2 })), /atLevel must be 1\.\.1/);
  });

  it('kind limit belongs to the fleet item only', () => {
    bad((d) => (fleet(d).kind = 'grind'), /kind limit is the fleet item's/);
    bad((d) => (d.research[2]!.kind = 'limit'), /kind limit is the fleet item's/);
    bad((d) => (fleet(d).kind = 'cap'), /kind must be design, grind, win or limit/);
  });

  it('Command limit costs count in Σ haul ≥ Σ research cost', () => {
    bad((d) => (fleet(d).levels[2]!.ice = 61), /total ice haul 340 is below the total research cost 341/);
    bad((d) => (d.map.areas.find((a) => a.id === 'deep')!.haul.crystal = 99), /total crystal haul 339 is below the total research cost 340/);
  });

  it('the Command limit item may be left out (the v4 fixture has none); every other item is still required', () => {
    const d = clone(rawV8);
    d.research = d.research.filter((r) => r.id !== 'fleet');
    expect(parseSimData(d).research.some((r) => r.id === 'fleet')).toBe(false);
    bad((x) => (x.research = x.research.filter((r) => r.id !== 'yards')), /research item yards missing/);
  });
});
