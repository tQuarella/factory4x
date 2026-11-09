import { campaignWorld, type CampaignStart, type SimData, type World } from '../src/index.ts';
import { fixtureData } from './fixture.ts';

/**
 * H4: createWorld starts a campaign on the overworld. The H3 rule tests
 * (sim, client and bots) play The Deep instead: the whole 16-node field with
 * the run's H3 layout (chosen by seed or system.variant, as in H3), landed at
 * tick 0 from a campaign where every other area is reclaimed and both designs
 * are bought. Node indices are the H3 ones (The Deep has every frame node).
 *
 * DEEP_START is that start on the H4/H5 six-area map (the v4 and v8
 * fixtures). deepStart(data) builds it for any map (h6-sim: on the ten-area
 * map every other area, relays included, is reclaimed, so The Deep is
 * lane-joined and its band open); on the fixtures it equals DEEP_START.
 */
export const DEEP_START: Readonly<CampaignStart> = Object.freeze({
  reclaimed: ['landfall', 'shelf', 'shoal', 'veil', 'garden'],
  research: { lancer: 1, flak: 1 },
  land: 'deep',
});

/** Every area but The Deep reclaimed (data order), both designs bought, landed in The Deep. */
export function deepStart(data: SimData): CampaignStart {
  const deep = data.map.areas.find((a) => a.layout === 'seed')!.id;
  return { reclaimed: data.map.areas.filter((a) => a.id !== deep).map((a) => a.id), research: { lancer: 1, flak: 1 }, land: deep };
}

/**
 * An H3 game: The Deep from deepStart(data) with no other research, so the
 * opening stock is economy.startStock and no extraction or yard bonus
 * applies. As in H3, the lancer and flak yards start off (an H4 landing
 * switches researched yards on).
 */
export function h3World(seed: number, data: SimData = fixtureData): World {
  const w = campaignWorld(seed, data, deepStart(data));
  w.yards.lancer.on = false;
  w.yards.flak.on = false;
  return w;
}
