import { describe, expect, it } from 'vitest';
import {
  PROBE,
  allocStatus,
  createWorld,
  deserializeWorld,
  fieldSummary,
  fleetStatus,
  rockStatus,
  serializeWorld,
  worldHash,
  type AllocRow,
  type BuildType,
  type World,
} from '../src/index.ts';
import { fixtureData } from './fixture.ts';
import { addShips, setGuards } from './helpers.ts';
import { F, FD, addEcon, fieldWorld, quietField, run, tick, weights } from './field-helpers.ts';

/**
 * h7-sim acceptance 6: the field selectors (DESIGN.md H7 "Selectors"): allocStatus, rockStatus (raidRank is 0
 * until h7-raids), the fleetStatus additions and fieldSummary. Plus the field save round trip.
 */

const row = (w: World, type: BuildType): AllocRow => allocStatus(w, FD).rows.find((r) => r.type === type)!;

describe('allocStatus', () => {
  it('rows in type order with weight, share, costs (ore, and crystal or ice), unlocked; stockOre and incomePerMin', () => {
    const w = quietField();
    Object.assign(w.field!.alloc, weights(3, 2, 0, 1, 0));
    w.stock.ore = 9;
    w.tun['economy.probeOrePerMin'] = 7;
    tick(w);
    const st = allocStatus(w, FD);
    expect(st.rows.map((r) => r.type)).toEqual(['extractor', 'hauler', 'drone', 'lancer', 'flak']);
    expect(st.rows.map((r) => r.weight)).toEqual([3, 2, 0, 1, 0]);
    expect(st.rows.map((r) => r.share)).toEqual([w.field!.share.extractor, w.field!.share.hauler, 0, 0, 0]);
    expect(st.rows[0]!.share + st.rows[1]!.share).toBe(9);
    expect(st.rows.map((r) => r.cost)).toEqual([
      { ore: 20, resource: null },
      { ore: 15, resource: null },
      { ore: 18, resource: null },
      { ore: 18, resource: { res: 'crystal', amount: 4 } },
      { ore: 18, resource: { res: 'ice', amount: 4 } },
    ]);
    expect(st.rows.map((r) => r.unlocked)).toEqual([true, true, true, false, false]);
    expect(st.maxWeight).toBe(5);
    expect(st.stockOre).toBe(w.stock.ore);
    // No deliveries yet: income is probe mining alone.
    expect(st.incomePerMin).toBe(7);
    w.stats.deliveredBuckets[3] = 11;
    expect(allocStatus(w, FD).incomePerMin).toBe(18);
  });

  it('state: off (weight 0), locked (needs crystal or ice), filling, waitingResource, fleetFull, building', () => {
    const w = quietField();
    w.tun['field.fleetCap'] = 1;
    Object.assign(w.field!.alloc, weights(0, 1, 0, 1, 1));
    w.stock.ore = 5;
    tick(w);
    expect(row(w, 'extractor').state).toBe('off');
    expect(row(w, 'lancer').state).toBe('locked');
    expect(row(w, 'hauler').state).toBe('filling');
    // A full flak share with no ice: waitingResource, even with the fleet full (the bay checks the resource first).
    w.stats.firstDeliveredTick.ice = 0;
    addShips(w, PROBE, 1);
    w.stock.ore = 40;
    tick(w);
    expect(w.field!.share.flak).toBe(18);
    expect(row(w, 'flak').state).toBe('waitingResource');
    expect(row(w, 'hauler').state).toBe('fleetFull');
    w.stock.ice = 4;
    tick(w);
    expect(row(w, 'flak').state).toBe('fleetFull');
    w.ships = [];
    tick(w);
    // The hauler bay took the freed place (type order), then the flak waits again behind the limit of 1.
    expect(row(w, 'hauler').state).toBe('building');
    expect(row(w, 'flak').state).toBe('fleetFull');
  });

  it('building progress is floor(done × 100 ÷ total), 0 when idle; total is max(ticksLeft, buildTicks) when buildTicks is tuned down mid-build', () => {
    const w = quietField();
    Object.assign(w.field!.alloc, weights(1, 1, 0, 0, 0));
    w.stock.ore = 35;
    tick(w);
    // Extractor 120 ticks, hauler 90 ticks; one tick done after the start tick.
    expect([row(w, 'extractor').building, row(w, 'hauler').building]).toEqual([0, 0]);
    run(w, 30);
    expect(row(w, 'extractor')).toMatchObject({ ticksLeft: 90, totalTicks: 120, building: 25 });
    // 30 of 90: 33.3… → 33.
    expect(row(w, 'hauler')).toMatchObject({ ticksLeft: 60, totalTicks: 90, building: 33 });
    run(w, 59);
    expect(row(w, 'hauler')).toMatchObject({ ticksLeft: 1, building: 98 });
    tick(w, { type: 'setTunable', key: 'ship.extractor.buildTicks', value: 15 });
    // 120 − 90 = 30 ticks left against a build time of 15: the total is the ticks left, so progress reads 0, never negative.
    expect(row(w, 'extractor')).toMatchObject({ ticksLeft: 30, totalTicks: 30, building: 0 });
    tick(w);
    expect(row(w, 'hauler')).toMatchObject({ ticksLeft: 0, building: 0, state: 'filling' });
  });

  it('throws in a campaign world', () => {
    expect(() => allocStatus(createWorld(1, fixtureData), fixtureData)).toThrow('not a field-mode world');
  });
});

describe('rockStatus', () => {
  it('mine, mineable, docked, bound (with in-flight), slots, haulers, buffer, delivered per minute, raidRank 0', () => {
    const w = quietField();
    w.field!.mine[F.a5] = true;
    addEcon(w, 'extractor', F.a5, F.a5);
    addEcon(w, 'extractor', PROBE);
    addEcon(w, 'hauler', PROBE, F.a5);
    w.nodes[F.a5]!.buffer = 7;
    tick(w);
    expect(rockStatus(w, F.a5)).toEqual({
      node: F.a5,
      id: 'a5',
      kind: 'asteroid',
      prize: 'ore',
      mine: true,
      mineable: true,
      docked: 1,
      bound: 2,
      inFlight: 1,
      slots: 3,
      freeExtractors: 0,
      haulers: 1,
      buffer: 7,
      bufferCap: 40,
      backedUp: false,
      deliveredPerMin: 0,
      raidRank: 0,
    });
    expect(rockStatus(w, F.a1)).toMatchObject({ mine: false, mineable: false, docked: 0, bound: 0, haulers: 0 });
  });

  it('backedUp exactly when the buffer is at node.bufferCap', () => {
    const w = quietField();
    w.nodes[F.a2]!.buffer = 39;
    expect(rockStatus(w, F.a2).backedUp).toBe(false);
    w.nodes[F.a2]!.buffer = 40;
    expect(rockStatus(w, F.a2).backedUp).toBe(true);
  });

  it('a guarded pocket is not mineable; once captured it is marked, mineable and shows its free extractor', () => {
    const w = quietField();
    expect(rockStatus(w, F.p2)).toMatchObject({ mine: false, mineable: false, freeExtractors: 0, prize: 'crystal', slots: 2 });
    setGuards(w, F.p2, []);
    addShips(w, F.p2, 1);
    tick(w);
    expect(rockStatus(w, F.p2)).toMatchObject({ mine: true, mineable: true, freeExtractors: 1, docked: 0 });
  });

  it('deliveredPerMin sums the rock\'s hauler deliveries over the last 60 s and drops them after', () => {
    const w = quietField();
    w.field!.mine[F.a1] = true;
    addEcon(w, 'extractor', F.a1, F.a1);
    const h = addEcon(w, 'hauler', F.a1, F.a1);
    w.nodes[F.a1]!.buffer = 4;
    tick(w);
    while (h.at !== PROBE) tick(w);
    expect(rockStatus(w, F.a1).deliveredPerMin).toBe(4);
    expect(rockStatus(w, F.a2).deliveredPerMin).toBe(0);
    w.field!.mine[F.a1] = false;
    run(w, 1800);
    expect(rockStatus(w, F.a1).deliveredPerMin).toBe(0);
  });
});

describe('fleetStatus additions', () => {
  it('countsEconomy, and the counts by type for all five (alive and building)', () => {
    const w = quietField();
    addShips(w, PROBE, 2, 'flak');
    addEcon(w, 'extractor', PROBE);
    addEcon(w, 'hauler', PROBE);
    addEcon(w, 'hauler', PROBE);
    Object.assign(w.field!.alloc, weights(0, 1, 1, 0, 0));
    w.stock.ore = 33;
    tick(w);
    expect(fleetStatus(w, FD)).toMatchObject({
      cap: 30,
      count: 7,
      building: 2,
      byType: { drone: 0, lancer: 0, flak: 2 },
      buildingByType: { drone: 1, lancer: 0, flak: 0 },
      econByType: { extractor: 1, hauler: 2 },
      econBuildingByType: { extractor: 0, hauler: 1 },
      countsEconomy: true,
      full: false,
    });
    w.tun['fleet.countsEconomy'] = 0;
    expect(fleetStatus(w, FD)).toMatchObject({ count: 3, building: 1, countsEconomy: false, econByType: { extractor: 1, hauler: 2 } });
  });
});

describe('fieldSummary', () => {
  it('time to the hive in whole seconds (floor), peak ore/min, built / lost / recycled by type, raids, economy ships lost, allocChanges, peakEcon', () => {
    const w = quietField();
    w.field!.mine[F.a1] = true;
    Object.assign(w.field!.alloc, weights(1, 0, 1, 0, 0));
    w.stock.ore = 38;
    tick(w);
    // Both bays started; with no stock left the hauler weight takes nothing.
    tick(w, { type: 'setAlloc', shipType: 'hauler', weight: 1 });
    run(w, 129);
    tick(w, { type: 'recycleShips', node: PROBE, counts: { drone: 1, lancer: 0, flak: 0 } });
    // Setup for the loss counts (raids are h7-raids): two extractors and a hauler lost, one drone lost.
    w.stats.econLost = { extractor: 2, hauler: 1 };
    w.stats.shipsLost.drone = 1;
    w.stats.peakPerMin = 44;
    // Capture on tick 151: 151 ÷ 30 = 5.03 → 5 s.
    while (w.tick < 151) tick(w);
    setGuards(w, F.heart, []);
    addShips(w, F.heart, 1);
    tick(w);
    expect(w.capturedTick).toBe(151);
    expect(fieldSummary(w)).toEqual({
      capturedTick: 151,
      timeToHiveSec: 5,
      peakPerMin: 44,
      built: { extractor: 1, hauler: 0, drone: 1, lancer: 0, flak: 0 },
      lost: { extractor: 2, hauler: 1, drone: 1, lancer: 0, flak: 0 },
      recycled: { extractor: 0, hauler: 0, drone: 1, lancer: 0, flak: 0 },
      raids: { mustered: 0, beaten: 0, hit: 0, turnedBack: 0 },
      econLostToRaids: 3,
      allocChanges: 1,
      peakEcon: 1,
    });
  });

  it('before the hive falls: capturedTick and timeToHiveSec are null; throws in a campaign world', () => {
    const s = fieldSummary(fieldWorld());
    expect([s.capturedTick, s.timeToHiveSec]).toEqual([null, null]);
    expect(() => fieldSummary(createWorld(1, fixtureData))).toThrow('not a field-mode world');
    expect(() => rockStatus(createWorld(1, fixtureData), 0)).toThrow('not a field-mode world');
  });
});

describe('save (field mode)', () => {
  it('round-trips a running field exactly; refuses a field save with no field state or a malformed economy ship', () => {
    const w = fieldWorld();
    run(w, 900);
    expect(w.field!.econ.length).toBeGreaterThan(0);
    const text = serializeWorld(w);
    const back = deserializeWorld(text, FD);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(worldHash(back.world)).toBe(worldHash(w));
    const noField = JSON.parse(text) as { world: Record<string, unknown> };
    noField.world.field = null;
    expect(deserializeWorld(JSON.stringify(noField), FD)).toMatchObject({ ok: false, reason: 'corrupt' });
    const badShip = JSON.parse(text) as { world: { field: { econ: Array<Record<string, unknown>> } } };
    badShip.world.field.econ[0]!.type = 'drone';
    expect(deserializeWorld(JSON.stringify(badShip), FD)).toMatchObject({ ok: false, reason: 'corrupt' });
    const noStats = JSON.parse(text) as { world: { stats: Record<string, unknown> } };
    delete noStats.world.stats.peakEcon;
    expect(deserializeWorld(JSON.stringify(noStats), FD)).toMatchObject({ ok: false, reason: 'corrupt' });
    const badRaid = JSON.parse(text) as { world: Record<string, unknown> };
    delete badRaid.world.nextRaidTick;
    expect(deserializeWorld(JSON.stringify(badRaid), FD)).toMatchObject({ ok: false, reason: 'corrupt' });
  });
});
