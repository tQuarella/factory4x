import { describe, expect, it } from 'vitest';
import archive from '../../../reports/archive/h9-design-data-v16-bots.json' with { type: 'json' };
import { defaultFieldOptions, runField, type FieldResult } from '../src/field-runner.ts';
import { fieldStrategies } from '../src/field-strategies.ts';
import { fixtureV16 } from '../../sim/test/fixture.ts';

/**
 * h10-sim acceptance 4 (i), kept as a test: with `hive.rebuildTicks` 0 and `raid.rollMax` 0 the v17 code plays the v16 bot
 * runs exactly. One run of the suite (undefended, which takes every raid and wins at 13:09; the longer runs take 8 to 14 s, past
 * the per-test limit), on
 * fixtures/sim-v16.json (main's v16 data plus the H10 keys at 0, 0 and 1, so h10-design-data's v18 values don't reach it),
 * against main's suite output in reports/archive/h9-design-data-v16-bots.json: every field of the result but the timings
 * (tickMsP50, tickMsP95) and `finalHash` (a world hash, which covers the new state by construction). The whole suite on the
 * shipped v17 data was compared once, the same way, for the h10-sim report (DECISIONS.md, h10-sim).
 */
type Comparable = Omit<FieldResult, 'tickMsP50' | 'tickMsP95' | 'finalHash'>;
const comparable = (r: FieldResult): Comparable => {
  const { tickMsP50: _p50, tickMsP95: _p95, finalHash: _hash, ...rest } = r;
  void _p50;
  void _p95;
  void _hash;
  return JSON.parse(JSON.stringify(rest)) as Comparable;
};

describe('identical at 0: bot runs on the v17 code match main\'s v16 suite', () => {
  for (const name of ['undefended']) {
    it(`${name}, seed 1`, () => {
      const strategy = fieldStrategies.find((s) => s.name === name)!;
      const main = (archive.results as unknown as FieldResult[]).find((r) => r.strategy === name && r.seed === 1 && r.variant === null)!;
      expect(main.outcome).toBe('won');
      // Bounded at 14 game minutes (it wins at 13:09 on the frozen fixture, so the bound never cuts the run short).
      const opts = { ...defaultFieldOptions(fixtureV16), capTicks: 14 * 60 * fixtureV16.tickRate };
      expect(main.ticks).toBeLessThan(opts.capTicks);
      expect(comparable(runField(strategy, 1, fixtureV16, opts))).toEqual(comparable(main));
    });
  }
});
