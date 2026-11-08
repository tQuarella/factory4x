/**
 * The frozen test fixture: data/sim.json as it shipped at dataVersion 4
 * (h3-sim), copied to fixtures/sim-v4.json and never retuned.
 *
 * Rule and outcome tests (sim, client and bots) run against this, not
 * against the shipped data, so calibrating data/sim.json does not break
 * them: they check how the rules behave for known numbers. Only
 * packages/sim/test/data.test.ts reads the shipped data, and only checks
 * that it is well formed.
 *
 * When the data schema changes (a tunable added, renamed or removed, a new
 * layout field), update the fixture to match with the spec's value for the
 * new key, and keep every existing value as it is. parseSimData names any
 * key the fixture is missing.
 */
import raw from './fixtures/sim-v4.json' with { type: 'json' };
import { parseSimData, type SimData } from '../src/index.ts';

export const fixtureData: SimData = parseSimData(raw);
