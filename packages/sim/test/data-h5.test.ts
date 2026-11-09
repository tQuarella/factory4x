import { describe, expect, it } from 'vitest';
import { parseSimData, type SimData } from '../src/index.ts';
import { fixtureV8 } from './fixture.ts';
import rawV8 from './fixtures/sim-v8.json' with { type: 'json' };

/**
 * h5-sim acceptance 2 and 3: data v8. Validation is tested on the frozen v8
 * fixture (fixtures/sim-v8.json).
 *
 * h6-sim: the H5 "Tunables (H5 …)" and "Command limit" tables describe data
 * v9 and were superseded at data v10 by H6 (DESIGN.md says so under each):
 * Command limit and `research.fleet.step` are gone, and `fleet.cap` and
 * `fleet.recycleRefundPct` are unchanged. So this file no longer checks the
 * shipped data: the dataVersion pin and the shipped tunables are in
 * data-h6.test.ts. The v8 fixture lost its Command limit item with the schema
 * change; the {tier, count} requirement it used is generic, and its
 * validation is tested here on another item.
 */

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const H5_KEYS = ['fleet.cap', 'fleet.recycleRefundPct'];

describe('the frozen v8 fixture', () => {
  it('is data version 8 with the H5 tunables at their spec values, and no Command limit (removed at H6)', () => {
    expect(fixtureV8.dataVersion).toBe(8);
    expect(H5_KEYS.map((k) => fixtureV8.tunables[k as keyof SimData['tunables']])).toEqual([
      { default: 12, min: 0, max: 60 },
      { default: 50, min: 0, max: 100 },
    ]);
    expect(fixtureV8.research.some((r) => r.id === 'fleet')).toBe(false);
    expect(Object.keys(fixtureV8.tunables)).not.toContain('research.fleet.step');
  });
});

describe('parseSimData rejects bad H5 data', () => {
  type Raw = typeof rawV8;
  const bad = (edit: (d: Raw) => void, msg: RegExp): void => {
    const d = clone(rawV8);
    edit(d);
    expect(() => parseSimData(d)).toThrow(msg);
  };
  /** The Fast yards item (two levels), given requirements by the tests below. */
  const yards = (d: Raw) => d.research.find((r) => r.id === 'yards')! as unknown as { requires: Array<Record<string, unknown>> };

  it('a tier requirement names a tier the areas have, and a count from 1 to the areas of at least that tier', () => {
    bad((d) => (yards(d).requires = [{ tier: 4, count: 1 }]), /tier must be one of the area tiers/);
    bad((d) => (yards(d).requires = [{ tier: -1, count: 1 }]), /tier must be one of the area tiers/);
    bad((d) => (yards(d).requires = [{ tier: 1.5, count: 1 }]), /tier must be one of the area tiers/);
    bad((d) => (yards(d).requires = [{ tier: 1, count: 0 }]), /count must be 1\.\.5/);
    // Tier ≥ 2: veil, garden and deep.
    bad((d) => (yards(d).requires = [{ tier: 2, count: 4 }]), /count must be 1\.\.3/);
    bad((d) => (yards(d).requires = [{ tier: 3, count: 2 }]), /count must be 1\.\.1/);
    // The edges are fine.
    for (const q of [
      { tier: 0, count: 6 },
      { tier: 2, count: 3 },
      { tier: 3, count: 1 },
    ]) {
      const d = clone(rawV8);
      yards(d).requires = [q];
      expect(() => parseSimData(d), JSON.stringify(q)).not.toThrow();
    }
  });

  it("atLevel is one of the item's levels", () => {
    bad((d) => (yards(d).requires = [{ tier: 1, count: 1, atLevel: 3 }]), /atLevel must be 1\.\.2/);
    bad((d) => (yards(d).requires = [{ tier: 1, count: 1, atLevel: 0 }]), /atLevel must be 1\.\.2/);
    bad((d) => (d.research[0]!.requires as unknown[]).push({ area: 'shelf', atLevel: 2 }), /atLevel must be 1\.\.1/);
  });
});
