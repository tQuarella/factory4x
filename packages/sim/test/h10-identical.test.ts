import { describe, expect, it } from 'vitest';
import { createWorld, hashState, step, worldHash, type Input } from '../src/index.ts';
import { fixtureV16 } from './fixture.ts';
import { replayV16 } from './fixtures/replay-v16.ts';
import { H10_SIM_KEYS, withoutH10 } from './h10-strip.ts';

/**
 * h10-sim acceptance 4 (ii) (DESIGN.md H10 "Save, data version and replay", "Identical at 0"; Director ruling 2026-11-17 item
 * 1): with both rule keys at 0 the v17 code plays v16 exactly. Method: main's reference replay at bd702b9 (frozen in
 * fixtures/replay-v16.ts) runs on fixtures/sim-v16.json (main's v16 data/sim.json plus the three H10 keys at 0, 0 and 1), and
 * its checkpoint hashes every 300 ticks over the determinism gate's 9000 are taken without the H10 state (`withoutH10`: the two
 * rule tunables, field.hiveRebuildProgress, each prong's rolls and hitRocks, each result prong's hitRocks, stats.raidRolls;
 * the fixture is version 16, so `dataVersion` needs no stripping). MAIN_V16 is `npm run determinism`'s checkpoint list on
 * main at bd702b9 (final a8f4c2ff), produced before any h10-sim change.
 */
const MAIN_V16 = [
  'ad5edfdc', '5ac9fab8', '2ed3c09f', 'bbd567f9', 'c228c740', '3c563333', '71c09d5c', 'b9d4c7f0', '82714426', '9dad55c6',
  '028ceca7', '82441f50', 'b3703782', '46968bec', '2b53aec3', 'b14a910b', '27381371', '4d3bd65c', '11e8b35d', '6078ae74',
  'e0487ecf', 'a0e4c837', '563ee42b', '154932ea', '03bb7fad', 'f4eef6b5', '18306eb5', '4d4344ca', '1a57e2ae', 'a8f4c2ff',
];

describe('identical at 0: main\'s v16 replay on the v17 code', () => {
  const w = createWorld(replayV16.seed, fixtureV16);
  const stripped: string[] = [];
  const raw: string[] = [];
  let maxProgress = 0;
  let maxRolls = 0;
  for (let t = 0; t < 9000; t++) {
    const inputs: Input[] = replayV16.inputs.filter((e) => e.tick === t).map((e) => e.input);
    step(w, fixtureV16, inputs);
    maxProgress = Math.max(maxProgress, w.field!.hiveRebuildProgress);
    maxRolls = Math.max(maxRolls, w.stats.raidRolls);
    if (w.tick % 300 === 0) {
      stripped.push(hashState(withoutH10(w)));
      raw.push(worldHash(w));
    }
  }

  it('the fixture is v16 with both rule keys at 0', () => {
    expect(fixtureV16.dataVersion).toBe(16);
    expect(H10_SIM_KEYS.map((k) => fixtureV16.tunables[k].default)).toEqual([0, 0]);
    expect(replayV16.inputs.some((e) => e.input.type === 'setTunable' && (H10_SIM_KEYS as readonly string[]).includes(e.input.key))).toBe(false);
  });

  it('every checkpoint matches main\'s once the H10 state is left out of the hash', () => {
    expect(stripped).toEqual(MAIN_V16);
  });

  it('the raw hashes differ (the new state is hashed), and the new state stayed at rest: no rebuild count, no roll', () => {
    expect(raw.filter((h, i) => h === MAIN_V16[i])).toEqual([]);
    expect([maxProgress, maxRolls]).toEqual([0, 0]);
  });
});
