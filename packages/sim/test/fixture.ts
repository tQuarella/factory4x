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
import rawV8 from './fixtures/sim-v8.json' with { type: 'json' };
import rawV10 from './fixtures/sim-v10.json' with { type: 'json' };
import rawV12 from './fixtures/sim-v12.json' with { type: 'json' };
import { defaultData, parseSimData, withRunMode, type SimData } from '../src/index.ts';

export const fixtureData: SimData = parseSimData(raw);

/**
 * h5-sim: data/sim.json as it shipped at dataVersion 8 (h5-sim), frozen in
 * fixtures/sim-v8.json and never retuned. The H5 rule tests (fleet limit,
 * recycle) run on it: it carries `fleet.cap` 12, which the v4 fixture
 * leaves out (`fleet.cap` 0 there, so every older rule test keeps playing
 * H4's rules).
 *
 * h6-sim: both older fixtures follow the v10 schema with H4's behaviour kept:
 * every area has its natural side and `relay: false` (no tier has two
 * areas of one side, so no haul ever decays), the three H6 tunables are added
 * at their spec values except `overworld.bandLock`, whose default is 0 (no
 * relays, so a lock could never open; the range stays 0–1), and Command limit
 * (the `fleet` item and `research.fleet.step`), which H6 removed, is gone.
 */
export const fixtureV8: SimData = parseSimData(rawV8);

/**
 * h6-sim: data/sim.json as it shipped at dataVersion 10 (h6-sim: the
 * ten-area map, relays, band locks and repeat hauls at the H6 spec's starting
 * values), frozen in fixtures/sim-v10.json and never retuned. The H6 rule
 * tests run on it, so h6-design-data's calibration changes none of them.
 */
export const fixtureV10: SimData = parseSimData(rawV10);

/**
 * h7-sim: data/sim.json as it shipped at dataVersion 12 (h7-sim: field mode, `map.field` and the H7 tunables at
 * the spec's starting values), frozen in fixtures/sim-v12.json and never retuned. The H7 field rule tests run on
 * it, so h7-design-data's calibration changes none of them. Its `map.field` nodes and Mine marks equal the shipped
 * ones (data-h7.test.ts checks that; calibration changes only guard counts and values).
 */
export const fixtureV12: SimData = parseSimData(rawV12);

/**
 * h7-sim: the shipped data with `run.mode` "campaign" (DESIGN.md H7 "What is parked, and how"). Tests that built
 * campaign worlds from the shipped data keep doing so through this, with every assertion as it was.
 */
export const shippedCampaign: SimData = withRunMode(defaultData, 'campaign');
