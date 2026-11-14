import { describe, expect, it } from 'vitest';
import {
  SEND_ALL,
  campaignSummary,
  campaignWorld,
  clampSendCounts,
  deserializeWorld,
  fleetCap,
  fleetCount,
  fleetStatus,
  isValidInput,
  parseSimData,
  landingEffects,
  recycleRefund,
  researchIndex,
  researchStatus,
  runSummary,
  serializeWorld,
  step,
  worldHash,
  yardStatus,
  type Input,
  type ShipTypeCounts,
  type SimTunableKey,
  type World,
} from '../src/index.ts';
import { fixtureData, fixtureV8 } from './fixture.ts';
import rawV8 from './fixtures/sim-v8.json' with { type: 'json' };
import { DEEP_START, h3World } from './h3-world.ts';
import { N, addShips, guardian, setGuards } from './helpers.ts';

/**
 * h5-sim acceptance 1, 4 and 5 (DESIGN.md H5 "The fleet limit", "Recycle",
 * "Selectors"). Every rule test runs on the frozen v8 fixture with its premise
 * set explicitly (a small limit, a constructed fleet), so a retune of
 * data/sim.json changes none of them. h6-sim removed Command limit (its tests
 * are retired; the H6 relay limit is tested in h6.test.ts).
 */

const D = fixtureV8;
const counts = (drone: number, lancer: number, flak: number): ShipTypeCounts => ({ drone, lancer, flak });

function tick(w: World, ...inputs: Input[]): void {
  step(w, D, inputs);
}

function run(w: World, n: number): void {
  for (let i = 0; i < n; i++) step(w, D, []);
}

const tune = (key: SimTunableKey, value: number): Input => ({ type: 'setTunable', key, value });

/** The Deep (the whole H3 field) from DEEP_START on the v8 fixture: no probe mining, plenty of ore, rally at the probe, yards as the test sets them. */
function deep(yards: Partial<Record<'drone' | 'lancer' | 'flak', boolean>> = { drone: true }): World {
  const w = h3World(1, D);
  w.tun['economy.probeOrePerMin'] = 0;
  w.stock.ore = 100_000;
  w.yards.drone.on = yards.drone ?? false;
  w.yards.lancer.on = yards.lancer ?? false;
  w.yards.flak.on = yards.flak ?? false;
  return w;
}

/** Steps `n` ticks, asserting the count never passes the limit. */
function runCapped(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    step(w, D, []);
    const cap = fleetCap(w, D);
    if (cap !== null) expect(fleetCount(w)).toBeLessThanOrEqual(cap);
  }
}

describe('the fleet limit (rule 5b)', () => {
  it('fleetCap is fleet.cap with no relay reclaimed (the v8 fixture has none; H6 removed Command limit), or null when fleet.cap is 0', () => {
    // The H6 relay term (fleet.relayStep × commandedBands) is tested on the v10 fixture in h6.test.ts.
    const w = deep();
    for (const cap of [12, 6, 60, 1]) {
      tick(w, tune('fleet.cap', cap), tune('fleet.relayStep', 12));
      expect(fleetCap(w, D), `cap ${cap}`).toBe(cap);
    }
    tick(w, tune('fleet.cap', 0));
    expect(fleetCap(w, D)).toBeNull();
  });

  it('the yards stop at the limit: the count never passes it, and the yard shows fleetFull', () => {
    const w = deep();
    tick(w, tune('fleet.cap', 5));
    runCapped(w, 1500);
    expect(w.ships.length).toBe(5);
    expect(fleetStatus(w, D)).toMatchObject({ cap: 5, count: 5, building: 0, full: true });
    expect(w.yards.drone).toEqual({ on: true, ticksLeft: 0 });
    expect(yardStatus(w, D).yards.find((y) => y.type === 'drone')!.state).toBe('fleetFull');
    expect(w.stock.ore).toBe(100_000 - 5 * w.tun['ship.drone.cost']);
  });

  it('a ship being built counts from the moment its yard starts', () => {
    const w = deep({ drone: true, lancer: true, flak: true });
    w.stock.lens = 5;
    w.stock.plating = 5;
    w.yards.lancer.on = false;
    w.yards.flak.on = false;
    addShips(w, N.probe, 2);
    tick(w, tune('fleet.cap', 3));
    // The drone yard took the last slot; with it building, the lancer and flak yards (components in stock) can't start.
    expect(w.yards.drone.ticksLeft).toBeGreaterThan(0);
    expect(fleetStatus(w, D)).toMatchObject({ count: 3, building: 1, buildingByType: counts(1, 0, 0), byType: counts(2, 0, 0), full: true });
    tick(w, { type: 'setShipyard', shipType: 'lancer', on: true }, { type: 'setShipyard', shipType: 'flak', on: true });
    runCapped(w, w.yards.drone.ticksLeft + 30);
    expect(w.ships.map((s) => s.type)).toEqual(['drone', 'drone', 'drone']);
    expect([w.yards.lancer.ticksLeft, w.yards.flak.ticksLeft, w.yards.drone.ticksLeft]).toEqual([0, 0, 0]);
    expect(yardStatus(w, D).yards.map((y) => y.state)).toEqual(['fleetFull', 'fleetFull', 'fleetFull']);
  });

  it('two idle yards and one slot: only the first in rotation starts; the capped yard keeps its turn', () => {
    const w = deep({ lancer: true, flak: true });
    w.stock.lens = 5;
    w.stock.plating = 5;
    expect(w.yardTurn).toBe(0);
    tick(w, tune('fleet.cap', 1));
    expect([w.yards.lancer.ticksLeft > 0, w.yards.flak.ticksLeft > 0]).toEqual([true, false]);
    // The lancer passed the turn to flak, which is held by the limit, so the turn stays with flak.
    expect(w.yardTurn).toBe(1);
    runCapped(w, w.yards.lancer.ticksLeft + 300);
    expect(w.ships.map((s) => s.type)).toEqual(['lancer']);
    expect(w.yardTurn).toBe(1);
    // A slot frees (the lancer is recycled): flak, whose turn it is, starts in the same tick; the lancer yard doesn't.
    tick(w, { type: 'recycleShips', node: N.probe, counts: counts(0, 1, 0) });
    expect([w.yards.lancer.ticksLeft > 0, w.yards.flak.ticksLeft > 0]).toEqual([false, true]);
    expect(w.yardTurn).toBe(0);
  });

  it('a raised limit lets several yards start in one tick, each start counted before the next', () => {
    const w = deep({ drone: true, lancer: true, flak: true });
    w.stock.lens = 5;
    w.stock.plating = 5;
    addShips(w, N.probe, 4);
    tick(w, tune('fleet.cap', 6));
    // Two slots: lancer and flak (the component yards go first), not the drone yard.
    expect([w.yards.lancer.ticksLeft > 0, w.yards.flak.ticksLeft > 0, w.yards.drone.ticksLeft > 0]).toEqual([true, true, false]);
    expect(fleetCount(w)).toBe(6);
  });

  it('losses free slots at once, and the yards refill them', () => {
    const w = deep();
    tick(w, tune('fleet.cap', 3));
    runCapped(w, 600);
    expect(fleetStatus(w, D)).toMatchObject({ count: 3, full: true });
    // p1's guards hit hard enough to kill every ship in one round.
    w.tun['guard.thorn.damage'] = 30;
    setGuards(w, N.p1, [
      ['thorn', 200],
      ['thorn', 200],
    ]);
    tick(w, { type: 'sendShips', from: N.probe, to: N.p1, counts: SEND_ALL });
    // In transit and fighting, they still count.
    expect(fleetCount(w)).toBe(3);
    let t = 0;
    while (w.stats.shipsLost.drone < 3 && t++ < 3000) {
      expect(w.yards.drone.ticksLeft).toBe(0);
      tick(w);
    }
    expect(w.stats.shipsLost.drone).toBe(3);
    // The tick they died the yard was already past its start step; the next tick it starts.
    tick(w);
    expect(w.yards.drone.ticksLeft).toBeGreaterThan(0);
    expect(fleetStatus(w, D)).toMatchObject({ count: 1, building: 1, full: false });
  });

  it('lowering fleet.cap live keeps every ship and pauses the yards; raising it resumes them on the next tick', () => {
    const w = deep({ drone: true, lancer: true });
    w.stock.lens = 5;
    addShips(w, N.probe, 8);
    addShips(w, N.a5, 2, 'lancer');
    tick(w, tune('fleet.cap', 5));
    // The landing tick's builds may already run; finish them, then nothing more starts.
    run(w, 200);
    const ships = w.ships.length;
    expect(ships).toBeGreaterThanOrEqual(10);
    run(w, 1500);
    expect(w.ships.length).toBe(ships);
    expect(fleetStatus(w, D)).toMatchObject({ cap: 5, count: ships, full: true });
    expect(yardStatus(w, D).yards.filter((y) => y.on).map((y) => y.state)).toEqual(['fleetFull', 'fleetFull']);
    tick(w, tune('fleet.cap', 30));
    expect(w.yards.lancer.ticksLeft).toBeGreaterThan(0);
    expect(w.yards.drone.ticksLeft).toBeGreaterThan(0);
  });

  it('fleet.cap 0 means no limit: the yards keep building past any count', () => {
    const w = deep();
    addShips(w, N.probe, 70);
    tick(w, tune('fleet.cap', 0));
    expect(w.yards.drone.ticksLeft).toBeGreaterThan(0);
    expect(fleetStatus(w, D)).toMatchObject({ cap: null, count: 71, building: 1, full: false });
    run(w, 300);
    expect(w.ships.length).toBeGreaterThan(71);
    expect(yardStatus(w, D).yards.some((y) => y.state === 'fleetFull')).toBe(false);
  });
});

describe('yardStatus fleetFull and fleetStatus', () => {
  it('fleetFull comes after building, needsDesign and off, and before needsComponent and needsOre', () => {
    const w = campaignWorld(1, D, { reclaimed: [...(DEEP_START.reclaimed ?? [])], research: { lancer: 1 }, land: 'deep' });
    w.tun['economy.probeOrePerMin'] = 0;
    w.stock.ore = 0;
    w.yards.flak.on = true;
    w.yards.drone.on = false;
    addShips(w, N.probe, 12);
    // Full at 12: drone off → off; lancer on, no lens and no ore → fleetFull (not needsComponent); flak, no design → needsDesign.
    expect(yardStatus(w, D).yards.map((y) => [y.type, y.state])).toEqual([
      ['drone', 'off'],
      ['lancer', 'fleetFull'],
      ['flak', 'needsDesign'],
    ]);
    // One slot free: the real reasons show.
    w.ships.pop();
    expect(yardStatus(w, D).yards.map((y) => y.state)).toEqual(['off', 'needsComponent', 'needsDesign']);
    w.stock.lens = 1;
    expect(yardStatus(w, D).yards.map((y) => y.state)).toEqual(['off', 'needsOre', 'needsDesign']);
    // A yard building at the limit says building.
    w.stock.ore = 1000;
    tick(w);
    expect(w.yards.lancer.ticksLeft).toBeGreaterThan(0);
    expect(fleetStatus(w, D).full).toBe(true);
    expect(yardStatus(w, D).yards.map((y) => y.state)).toEqual(['off', 'building', 'needsDesign']);
  });

  it('fleetStatus: limit, counts by type, building; no relays in the v8 fixture (H6: commandedBands 0 of 0, the deprecated level and max level 0)', () => {
    const w = deep({ drone: true });
    addShips(w, N.a5, 2, 'flak');
    addShips(w, N.probe, 1, 'lancer');
    tick(w);
    expect(fleetStatus(w, D)).toEqual({
      cap: D.tunables['fleet.cap'].default,
      count: 4,
      building: 1,
      byType: counts(0, 1, 2),
      buildingByType: counts(1, 0, 0),
      full: false,
      commandedBands: 0,
      maxCommandedBands: 0,
      level: 0,
      maxLevel: 0,
      // h7-sim: the field-mode additions, at the v8 fixture's fleet.countsEconomy 1 and with no economy ships in a campaign.
      countsEconomy: true,
      econByType: { extractor: 0, hauler: 0 },
      econBuildingByType: { extractor: 0, hauler: 0 },
      // h8-sim: the fleet panel rows are field-mode only, so all zero in a campaign world.
      types: {
        extractor: { alive: 0, idle: 0, building: 0, recyclable: 0 },
        hauler: { alive: 0, idle: 0, building: 0, recyclable: 0 },
        drone: { alive: 0, idle: 0, building: 0, recyclable: 0 },
        lancer: { alive: 0, idle: 0, building: 0, recyclable: 0 },
        flak: { alive: 0, idle: 0, building: 0, recyclable: 0 },
      },
    });
    const overworld = campaignWorld(1, D);
    expect(fleetStatus(overworld, D)).toMatchObject({ cap: D.tunables['fleet.cap'].default, count: 0, full: false, commandedBands: 0, level: 0, maxLevel: 0 });
    // The frozen v4 fixture: fleet.cap 0.
    expect(fleetStatus(campaignWorld(1, fixtureData), fixtureData)).toMatchObject({ cap: null, commandedBands: 0, level: 0, maxLevel: 0 });
  });
});

describe('recycleShips', () => {
  /** The Deep with 3 drones, 2 lancers and 1 flak parked at a5 (in id order: drones first), and 2 drones at p1 (living; its guards deal no damage). */
  function fleetAtA5(): World {
    const w = deep({});
    w.tun['guard.thorn.damage'] = 0;
    w.tun['guard.spore.damage'] = 0;
    addShips(w, N.a5, 3, 'drone');
    addShips(w, N.a5, 2, 'lancer');
    addShips(w, N.a5, 1, 'flak');
    addShips(w, N.p1, 2, 'drone');
    w.stock.ore = 0;
    return w;
  }

  it('clamps each count to the ships parked there, removes the lowest ids first, refunds floor(cost × pct / 100) each, and counts them as recycled, not lost', () => {
    const w = fleetAtA5();
    const ids = w.ships.filter((s) => s.at === N.a5).map((s) => s.id);
    const input: Input = { type: 'recycleShips', node: N.a5, counts: counts(2, 9, 0) };
    expect(isValidInput(w, D, input)).toBe(true);
    const clamped = clampSendCounts(w, N.a5, input.type === 'recycleShips' ? input.counts : counts(0, 0, 0));
    expect(clamped).toEqual(counts(2, 2, 0));
    const preview = recycleRefund(w, clamped);
    const pct = w.tun['fleet.recycleRefundPct'];
    expect(preview).toBe(2 * Math.floor((w.tun['ship.drone.cost'] * pct) / 100) + 2 * Math.floor((w.tun['ship.lancer.cost'] * pct) / 100));
    tick(w, input);
    // ids[0..1] drones and ids[3..4] lancers went; drone ids[2] and the flak ids[5] stay, and p1's drones.
    expect(w.ships.filter((s) => s.at === N.a5).map((s) => s.id)).toEqual([ids[2], ids[5]]);
    expect(w.ships.filter((s) => s.at === N.p1)).toHaveLength(2);
    expect(w.stock.ore).toBe(preview);
    expect(w.stats.shipsRecycled).toEqual(counts(2, 2, 0));
    expect(w.stats.oreRefunded).toBe(preview);
    expect(w.stats.shipsLost).toEqual(counts(0, 0, 0));
    expect(runSummary(w)).toMatchObject({ shipsRecycled: 4, shipsRecycledByType: counts(2, 2, 0), oreRefunded: preview, shipsLost: 0 });
  });

  it('is refused at a living guarded node (no recycling in a battle), and allowed there once it is captured', () => {
    const w = fleetAtA5();
    const at = (node: number): Input => ({ type: 'recycleShips', node, counts: SEND_ALL });
    expect(isValidInput(w, D, at(N.p1))).toBe(false);
    tick(w, at(N.p1));
    expect(w.ships.filter((s) => s.at === N.p1)).toHaveLength(2);
    expect(w.stats.shipsRecycled).toEqual(counts(0, 0, 0));
    // Its guards gone, the drones there capture it on the next round.
    setGuards(w, N.p1, []);
    let t = 0;
    while (guardian(w, N.p1).alive && t++ < 100) tick(w);
    expect(guardian(w, N.p1).alive).toBe(false);
    expect(isValidInput(w, D, at(N.p1))).toBe(true);
    tick(w, at(N.p1));
    expect(w.ships.filter((s) => s.at === N.p1)).toHaveLength(0);
    expect(w.stats.shipsRecycled.drone).toBe(2);
  });

  it('ships in transit are not recycled: they are not parked at the node yet', () => {
    const w = fleetAtA5();
    tick(w, { type: 'sendShips', from: N.a5, to: N.probe, counts: counts(3, 0, 0) });
    expect(w.ships.filter((s) => s.transit !== null)).toHaveLength(3);
    // At a5 only the lancers and the flak are parked; at the probe nothing has arrived.
    expect(isValidInput(w, D, { type: 'recycleShips', node: N.a5, counts: counts(3, 0, 0) })).toBe(false);
    expect(isValidInput(w, D, { type: 'recycleShips', node: N.probe, counts: SEND_ALL })).toBe(false);
    tick(w, { type: 'recycleShips', node: N.a5, counts: counts(3, 1, 0) });
    expect(w.stats.shipsRecycled).toEqual(counts(0, 1, 0));
    expect(w.ships.filter((s) => s.transit !== null)).toHaveLength(3);
  });

  it('is refused with a zero total: all counts 0, or only types not parked there, or a bad node or counts', () => {
    const w = fleetAtA5();
    for (const input of [
      { type: 'recycleShips', node: N.a5, counts: counts(0, 0, 0) },
      { type: 'recycleShips', node: N.a4, counts: SEND_ALL },
      { type: 'recycleShips', node: N.p1, counts: counts(0, 3, 0) },
      { type: 'recycleShips', node: 99, counts: SEND_ALL },
      { type: 'recycleShips', node: N.a5, counts: { drone: -1, lancer: 1, flak: 0 } },
      { type: 'recycleShips', node: N.a5, counts: { drone: 1.5, lancer: 0, flak: 0 } },
    ] as Input[]) {
      expect(isValidInput(w, D, input), JSON.stringify(input)).toBe(false);
    }
    expect(isValidInput(w, D, { type: 'recycleShips', node: N.a5, counts: counts(0, 0, 1) })).toBe(true);
  });

  it('works with the limit off, and not on the overworld or after the win', () => {
    const w = fleetAtA5();
    const one: Input = { type: 'recycleShips', node: N.a5, counts: counts(1, 0, 0) };
    tick(w, tune('fleet.cap', 0));
    expect(isValidInput(w, D, one)).toBe(true);
    w.campaign.wonTick = w.tick;
    expect(isValidInput(w, D, one)).toBe(false);
    expect(isValidInput(campaignWorld(1, D), D, { type: 'recycleShips', node: 0, counts: SEND_ALL })).toBe(false);
  });

  it('the refund rounds down per ship, at default and tuned costs and percentages (0, 33, 50, 100)', () => {
    for (const [cost, pct, each] of [
      [18, 50, 9],
      [15, 50, 7],
      [15, 33, 4],
      [5, 50, 2],
      [60, 100, 60],
      [18, 0, 0],
      [7, 99, 6],
    ] as const) {
      const w = deep({});
      addShips(w, N.a5, 3, 'flak');
      w.stock.ore = 0;
      tick(w, tune('ship.flak.cost', cost), tune('fleet.recycleRefundPct', pct));
      expect(recycleRefund(w, counts(0, 0, 3)), `cost ${cost} pct ${pct}`).toBe(3 * each);
      tick(w, { type: 'recycleShips', node: N.a5, counts: counts(0, 0, 3) });
      expect(w.stock.ore, `cost ${cost} pct ${pct}`).toBe(3 * each);
      expect(w.stats.oreRefunded).toBe(3 * each);
    }
  });

  it('a visit records its recycles in the area record; campaignSummary totals them', () => {
    const w = campaignWorld(1, D, { reclaimed: ['landfall'], land: 'shelf' });
    const a5 = w.nodes.findIndex((n) => n.id === 'a5');
    addShips(w, a5, 4);
    tick(w, { type: 'recycleShips', node: a5, counts: counts(3, 0, 0) });
    const refund = w.stats.oreRefunded;
    expect(refund).toBe(3 * Math.floor((w.tun['ship.drone.cost'] * w.tun['fleet.recycleRefundPct']) / 100));
    tick(w, { type: 'leaveArea' });
    const shelf = D.map.areas.findIndex((a) => a.id === 'shelf');
    expect(w.campaign.areas[shelf]).toMatchObject({ withdrawals: 1, shipsRecycled: 3, oreRefunded: refund });
    expect(campaignSummary(w, D)).toMatchObject({ shipsRecycled: 3, oreRefunded: refund });
    expect(campaignSummary(w, D).areas[shelf]).toMatchObject({ shipsRecycled: 3, oreRefunded: refund });
  });
});

describe('capAtSend', () => {
  it('a battle records the limit its wave was sent at (null when off), and a wave sent into a running battle updates it', () => {
    const w = deep({});
    setGuards(w, N.p1, Array.from({ length: 30 }, () => ['spore', 100] as const));
    w.tun['guard.spore.damage'] = 0;
    addShips(w, N.a5, 3);
    tick(w, { type: 'sendShips', from: N.a5, to: N.p1, counts: SEND_ALL });
    let t = 0;
    while (guardian(w, N.p1).battle === null && t++ < 300) tick(w);
    const cap = D.tunables['fleet.cap'].default;
    expect(guardian(w, N.p1).battle!.capAtSend).toBe(cap);
    // Live tuning, then a second wave into the running battle.
    addShips(w, N.a5, 1);
    tick(w, tune('fleet.cap', 20), { type: 'sendShips', from: N.a5, to: N.p1, counts: SEND_ALL });
    expect(guardian(w, N.p1).battle!.capAtSend).toBe(20);
    // Withdraw: the finished battle keeps it.
    tick(w, { type: 'sendShips', from: N.p1, to: N.a5, counts: SEND_ALL });
    t = 0;
    while (guardian(w, N.p1).battle !== null && t++ < 300) tick(w);
    expect(guardian(w, N.p1).lastBattle).toMatchObject({ outcome: 'withdrew', capAtSend: 20 });
    // With the limit off the next battle records null.
    run(w, 300);
    tick(w, tune('fleet.cap', 0), { type: 'sendShips', from: N.a5, to: N.p1, counts: SEND_ALL });
    t = 0;
    while (guardian(w, N.p1).battle === null && t++ < 300) tick(w);
    expect(guardian(w, N.p1).battle!.capAtSend).toBeNull();
  });
});

/**
 * H6 removed Command limit (the `fleet` item, kind 'limit', research.fleet.step): parseSimData rejects it
 * (data-h6.test.ts), and relays raise the limit (h6.test.ts). The H5 {tier, count} requirement it used stays a
 * generic research requirement; no shipped item has one, so it is tested here on a v8 fixture item given one.
 */
describe('tier requirements (H5; generic since H6)', () => {
  const rich = { ore: 10_000, ice: 10_000, crystal: 10_000 };
  const raw = JSON.parse(JSON.stringify(rawV8)) as { research: Array<{ id: string; requires: unknown[] }> };
  raw.research.find((r) => r.id === 'yards')!.requires = [
    { tier: 1, count: 1, atLevel: 1 },
    { tier: 2, count: 2, atLevel: 2 },
  ];
  const T = parseSimData(raw);
  const YARDS = researchIndex(T, 'yards');
  const buy: Input = { type: 'buyResearch', item: YARDS };

  it('level 1 needs an area of tier ≥ 1, level 2 two of tier ≥ 2; at max level none is reported', () => {
    const state = (reclaimed: string[], level: number) => {
      const w = campaignWorld(1, T, { reclaimed, stockpile: rich, research: { yards: level } });
      const row = researchStatus(w, T)[YARDS]!;
      return { canBuy: row.canBuy, tiers: row.missing.tiers, capOff: row.missing.capOff, valid: isValidInput(w, T, buy) };
    };
    expect(state([], 0)).toEqual({ canBuy: false, tiers: [{ tier: 1, count: 1, have: 0 }], capOff: false, valid: false });
    expect(state(['landfall'], 0)).toEqual({ canBuy: false, tiers: [{ tier: 1, count: 1, have: 0 }], capOff: false, valid: false });
    expect(state(['landfall', 'shoal'], 0)).toEqual({ canBuy: true, tiers: [], capOff: false, valid: true });
    // A heavier area also counts ("tier ≥ T").
    expect(state(['landfall', 'veil'], 0)).toEqual({ canBuy: true, tiers: [], capOff: false, valid: true });
    expect(state(['landfall', 'shelf', 'veil'], 1)).toEqual({ canBuy: false, tiers: [{ tier: 2, count: 2, have: 1 }], capOff: false, valid: false });
    expect(state(['landfall', 'shelf', 'veil', 'deep'], 1)).toEqual({ canBuy: true, tiers: [], capOff: false, valid: true });
    expect(state([], 2)).toEqual({ canBuy: false, tiers: [], capOff: false, valid: false });
  });

  it('research no longer changes the fleet limit, and no row is capOff with the limit off', () => {
    const w = campaignWorld(1, T, { reclaimed: ['landfall', 'shelf', 'veil', 'garden'], stockpile: rich });
    const before = landingEffects(w, T).fleetCap;
    tick(w, buy);
    tick(w, buy);
    expect(w.campaign.research.yards).toBe(2);
    expect(landingEffects(w, T).fleetCap).toBe(before);
    tick(w, tune('fleet.cap', 0));
    expect(researchStatus(w, T).every((r) => !r.missing.capOff)).toBe(true);
  });
});

describe('save', () => {
  it('round-trips a world with recycles and a battle with capAtSend; refuses a v7 save', () => {
    const w = deep({ drone: true });
    addShips(w, N.a5, 4);
    tick(w, { type: 'recycleShips', node: N.a5, counts: counts(1, 0, 0) }, { type: 'sendShips', from: N.a5, to: N.p1, counts: SEND_ALL });
    let t = 0;
    while (guardian(w, N.p1).battle === null && t++ < 300) tick(w);
    expect(guardian(w, N.p1).battle!.capAtSend).toBe(fleetCap(w, D));
    const text = serializeWorld(w);
    const back = deserializeWorld(text, D);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(worldHash(back.world)).toBe(worldHash(w));
    expect(back.world.stats.shipsRecycled.drone).toBe(1);
    // Both keep playing identically.
    run(w, 200);
    run(back.world, 200);
    expect(worldHash(back.world)).toBe(worldHash(w));

    const v7 = JSON.parse(text) as { dataVersion: number; world: { dataVersion: number } };
    v7.dataVersion = 7;
    v7.world.dataVersion = 7;
    expect(deserializeWorld(JSON.stringify(v7), D)).toEqual({ ok: false, reason: 'dataVersion', saveDataVersion: 7 });

    // An area record without the H5 recycle fields is not a well-formed v8 save.
    const old = JSON.parse(text) as { world: { campaign: { areas: Array<Record<string, unknown>> } } };
    delete old.world.campaign.areas[0]!.shipsRecycled;
    expect(deserializeWorld(JSON.stringify(old), D)).toMatchObject({ ok: false, reason: 'corrupt' });
  });
});
