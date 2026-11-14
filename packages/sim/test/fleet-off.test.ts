import { describe, expect, it } from 'vitest';
import { SEND_ALL, TUNABLE_KEYS, createWorld, hashState, isValidInput, step, type Input, type World } from '../src/index.ts';
import { N, data, networkStep } from './helpers.ts';
import { h3World } from './h3-world.ts';

/**
 * h5-sim: `fleet.cap` 0 reproduces H4's rules exactly (DESIGN.md H5 "The A/B
 * switch"). The frozen v4 fixture carries `fleet.cap` 0, so two fixed games on
 * it must reach exactly the states the H4 code reached. The golden hashes at
 * the bottom were recorded by running these two games on main at 078806e,
 * before any H5 code existed. Each hash is over the world with only the
 * fields H5 added removed (`h4View`), so a change to any H4 field (ships,
 * guards, stock, yards, research, the campaign records) shows up here.
 */

/**
 * The world without the state H5 and H6 added: the H5 tunables, recycle stats, the Command limit level and
 * `capAtSend`; h6-sim: the three H6 tunables and `haulPaid` (stats and area records). The v4 fixture has no relays,
 * no repeat groups and `overworld.bandLock` 0, so H6's rules must leave every H4 field exactly as H4 did.
 */
function h4View(w: Readonly<World>): unknown {
  const v = JSON.parse(JSON.stringify(w)) as {
    tun: Record<string, unknown>;
    stats: Record<string, unknown>;
    campaign: { research: Record<string, unknown>; areas: Array<Record<string, unknown>> };
    lastBattle: Record<string, unknown> | null;
    guardians: Array<{ battle: Record<string, unknown> | null; lastBattle: Record<string, unknown> | null }>;
  } & Record<string, unknown>;
  for (const k of ['fleet.cap', 'fleet.recycleRefundPct', 'research.fleet.step', 'fleet.relayStep', 'areas.repeatHaulPct', 'overworld.bandLock']) delete v.tun[k];
  delete v.stats.shipsRecycled;
  delete v.stats.oreRefunded;
  delete v.stats.haulPaid;
  // h7-sim: the field-mode state (null / zero in a campaign world), its stats and the H7 tunables, none of which a
  // campaign rule reads. Everything H4 had is still hashed.
  for (const k of H7_TUNABLES) delete v.tun[k];
  for (const k of ['field', 'raid', 'nextRaidTick', 'lastRaid']) delete v[k];
  for (const k of ['econBuilt', 'econLost', 'econRecycled', 'raids', 'allocChanges', 'peakEcon']) delete v.stats[k];
  delete v.campaign.research.fleet;
  for (const a of v.campaign.areas) {
    delete a.shipsRecycled;
    delete a.oreRefunded;
    delete a.haulPaid;
  }
  for (const b of [v.lastBattle, ...v.guardians.flatMap((g) => [g.battle, g.lastBattle])]) if (b !== null) delete b.capAtSend;
  return v;
}

/** h7-sim: the tunables H7 added (DESIGN.md H7 "Tunables"), every one after system.variant in TUNABLE_KEYS. */
const H7_TUNABLES = TUNABLE_KEYS.slice(TUNABLE_KEYS.indexOf('system.variant') + 1).filter((k) => !k.startsWith('stats.') && !k.startsWith('client.'));

const EVERY = 600;

/** Scenario A: The Deep (the H3 field), all three yards on and cheap, the network script, and a wave from a5 at the next living guarded node every 80 s from minute 4. */
function bigFleet(): { hashes: string[]; maxShips: number } {
  const w = h3World(1, data);
  w.yards.lancer.on = true;
  w.yards.flak.on = true;
  const targets = [N.p1, N.p2, N.p3, N.p4, N.root, N.heart];
  const hashes: string[] = [];
  let maxShips = 0;
  for (let t = 0; t < 12_000; t++) {
    const inputs: Input[] = [];
    if (t === 0) {
      inputs.push({ type: 'setRally', node: N.a5 }, { type: 'setTunable', key: 'economy.probeOrePerMin', value: 60 });
      for (const ship of ['drone', 'lancer', 'flak'] as const) {
        inputs.push({ type: 'setTunable', key: `ship.${ship}.cost`, value: 5 }, { type: 'setTunable', key: `ship.${ship}.buildTicks`, value: 30 });
      }
    }
    const next = networkStep(w);
    if (next) inputs.push(next);
    if (t >= 7200 && t % 2400 === 0) {
      const target = targets.find((n) => w.guardians.some((g) => g.node === n && g.alive));
      if (target !== undefined) inputs.push({ type: 'sendShips', from: N.a5, to: target, counts: SEND_ALL });
    }
    step(w, data, inputs);
    maxShips = Math.max(maxShips, w.ships.length);
    if (w.tick % EVERY === 0) hashes.push(hashState(h4View(w)));
  }
  return { hashes, maxShips };
}

/**
 * Scenario B: a campaign from createWorld. On the overworld: buy the first
 * affordable research item in data order, else land in the first open area.
 * In an area: rally at a5 (when present), send everything at the probe and
 * a5 at the heart every 60 s from 40 s, leave once the heart falls, and
 * withdraw after 4 minutes.
 */
function campaign(): { hashes: string[]; reclaimed: number; bought: number; withdrawals: number } {
  const w = createWorld(3, data);
  const hashes: string[] = [];
  for (let t = 0; t < 24_000; t++) {
    const inputs: Input[] = [];
    if (t === 0) inputs.push({ type: 'setTunable', key: 'ship.drone.cost', value: 5 }, { type: 'setTunable', key: 'ship.drone.buildTicks', value: 30 });
    const camp = w.campaign;
    if (camp.active === null) {
      const buy = data.research.map((_, item): Input => ({ type: 'buyResearch', item })).find((i) => isValidInput(w, data, i));
      const land = data.map.areas.map((_, area): Input => ({ type: 'enterArea', area })).find((i) => isValidInput(w, data, i));
      const pick = buy ?? land;
      if (pick) inputs.push(pick);
    } else {
      const since = w.tick - camp.areaStartTick;
      const a5 = w.nodes.findIndex((n) => n.id === 'a5');
      const heart = w.nodes.findIndex((n) => n.kind === 'heart');
      if (w.capturedTick !== null || since >= 7200) inputs.push({ type: 'leaveArea' });
      else {
        if (since === 0 && a5 >= 0) inputs.push({ type: 'setRally', node: a5 });
        if (since >= 1200 && since % 1800 === 0) {
          inputs.push({ type: 'sendShips', from: 0, to: heart, counts: SEND_ALL });
          if (a5 >= 0) inputs.push({ type: 'sendShips', from: a5, to: heart, counts: SEND_ALL });
        }
      }
    }
    step(w, data, inputs);
    if (w.tick % EVERY === 0) hashes.push(hashState(h4View(w)));
  }
  const withdrawals = w.campaign.areas.reduce((s, a) => s + a.withdrawals, 0);
  return { hashes, reclaimed: w.campaign.reclaimOrder.length, bought: w.campaign.researchLog.length, withdrawals };
}

describe('fleet.cap 0 reproduces the H4 rules exactly (frozen v4 fixture, golden hashes from main 078806e)', () => {
  it('the fixture has no fleet limit', () => {
    expect(data.tunables['fleet.cap'].default).toBe(0);
  });

  it('a big-fleet game in The Deep', () => {
    const { hashes, maxShips } = bigFleet();
    // The premise: far more ships at once than any H5 limit, so a limit would have changed the game.
    expect(maxShips).toBeGreaterThan(30);
    expect(hashes).toEqual(GOLDEN_BIG_FLEET);
  });

  it('a campaign: research bought, landings, reclaims and withdrawals', () => {
    const { hashes, reclaimed, bought, withdrawals } = campaign();
    expect(reclaimed).toBeGreaterThanOrEqual(2);
    expect(bought).toBeGreaterThanOrEqual(1);
    expect(withdrawals).toBeGreaterThanOrEqual(1);
    expect(hashes).toEqual(GOLDEN_CAMPAIGN);
  });
});

/** Recorded on main 078806e (H4 code), every 600 ticks. */
const GOLDEN_BIG_FLEET: string[] = [
  '72651804',
  'c5abee14',
  '6860c72f',
  'f856c6d6',
  '50cbe3f4',
  '583153b9',
  'cd5d3122',
  '8bc2395f',
  'c54fa7c9',
  'a02e0a3a',
  '9ae13aa7',
  '76a956df',
  '45801113',
  '4b479d33',
  '837fa199',
  'ddae9c87',
  '14c5f00b',
  'a3340bbd',
  '71d1fc1f',
  '70f3d5ee',
];
/** Recorded on main 078806e (H4 code), every 600 ticks. */
const GOLDEN_CAMPAIGN: string[] = [
  'bb3482b1',
  '856be0f0',
  'eee5929e',
  'cf826922',
  '54ab7822',
  'bf4b4f7c',
  'f877a6cb',
  '090d9768',
  '725e548c',
  '98c861aa',
  '98e5699b',
  'c85075b8',
  'bb1e78ed',
  '12db5282',
  '86eb2ce7',
  '9cd1cd16',
  '01565ccb',
  '5e8e695d',
  'e4ebbde3',
  '6ace742f',
  '6c4da0a7',
  '887c0987',
  '3c80f7d3',
  'cade6ad8',
  '3ae69796',
  'ef8d75fb',
  'ff8ee721',
  'b3232643',
  '5bcc2c60',
  'cf2e9aa1',
  '8c90af78',
  'f9014d34',
  '69406ce1',
  'e517febe',
  '76da9ff1',
  '8d43a53a',
  '7ed0aae1',
  'bb534140',
  '3ce4ea8e',
  'a95eec1d',
];
