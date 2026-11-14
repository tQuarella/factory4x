import { describe, expect, it } from 'vitest';
import {
  BUILD_TYPES,
  PROBE,
  SEND_ALL,
  allocStatus,
  fleetCount,
  fleetStatus,
  guardianAt,
  isValidInput,
  isWon,
  rockStatus,
  worldHash,
  type BuildType,
  type Input,
  type World,
} from '../src/index.ts';
import { addShips, setGuards } from './helpers.ts';
import { F, FD, addEcon, docked, quietField, run, runUntil, setAll, tick, weights } from './field-helpers.ts';

/**
 * h7-sim acceptance 3: rules F2–F7, F9, F11, F12 and F14 (DESIGN.md H7 "Rules (field mode), per tick in this
 * order") on the field (the frozen v12 fixture, whose map.field is the shipped one). Each test builds its premise
 * explicitly from a quiet field (no stock, no probe mining, every weight 0, no Mine marks).
 */

const ALL_UNLOCKED = (w: World): void => {
  w.stats.firstDeliveredTick.crystal = 0;
  w.stats.firstDeliveredTick.ice = 0;
};

describe('F2 allocation', () => {
  it('with every type eligible, N ore moved gives each type within 1 of N × weight ÷ Σweights, for every N from 1 to 120 (uneven weights)', () => {
    const wts = weights(5, 3, 1, 2, 4);
    const sum = 15;
    for (let n = 1; n <= 120; n++) {
      const w = quietField();
      ALL_UNLOCKED(w);
      for (const t of BUILD_TYPES) w.tun[`ship.${t}.cost`] = 60;
      Object.assign(w.field!.alloc, wts);
      w.stock.ore = n;
      tick(w);
      let moved = 0;
      for (const t of BUILD_TYPES) {
        const share = w.field!.share[t];
        moved += share;
        // |share − n × w ÷ Σ| ≤ 1, in integers: |share × Σ − n × w| ≤ Σ.
        expect(Math.abs(share * sum - n * wts[t]), `N ${n} ${t}`).toBeLessThanOrEqual(sum);
      }
      expect(moved, `N ${n}`).toBe(n);
      expect(w.stock.ore).toBe(0);
    }
  });

  it('ties go to type order: equal weights fill extractor, hauler, drone, lancer, flak in turn; a higher weight wins a tie on the counter', () => {
    const w = quietField();
    ALL_UNLOCKED(w);
    Object.assign(w.field!.alloc, weights(1, 1, 1, 1, 1));
    w.stock.ore = 3;
    tick(w);
    expect(w.field!.share).toEqual(weights(1, 1, 1, 0, 0));
    w.stock.ore = 2;
    tick(w);
    expect(w.field!.share).toEqual(weights(1, 1, 1, 1, 1));
    // Weights 1 and 2: the counters go 1/2 (hauler), 2/1 (extractor), 0/3 (hauler).
    const v = quietField();
    Object.assign(v.field!.alloc, weights(1, 2, 0, 0, 0));
    v.stock.ore = 1;
    tick(v);
    expect([v.field!.share.extractor, v.field!.share.hauler]).toEqual([0, 1]);
    v.stock.ore = 2;
    tick(v);
    expect([v.field!.share.extractor, v.field!.share.hauler]).toEqual([1, 2]);
  });

  it('a type that is not eligible (weight 0, locked, or its share full) takes no ore and has its counter at 0; ore no share can take stays in stock', () => {
    const w = quietField();
    // A fleet at its limit keeps the full extractor share from starting its bay.
    w.tun['field.fleetCap'] = 1;
    addShips(w, PROBE, 1, 'drone');
    Object.assign(w.field!.alloc, weights(2, 0, 0, 3, 0));
    w.stock.ore = 50;
    tick(w);
    // The lancer is locked (no crystal delivered) and the hauler has weight 0: the extractor fills to its cost, the rest stays.
    expect(w.field!.share).toEqual(weights(20, 0, 0, 0, 0));
    expect(w.field!.allocCur).toEqual(weights(0, 0, 0, 0, 0));
    expect(w.stock.ore).toBe(30);
  });

  it('setAlloc to 0 returns the type\'s share to stock; switching away never strands ore', () => {
    const w = quietField();
    Object.assign(w.field!.alloc, weights(3, 0, 0, 0, 0));
    w.stock.ore = 7;
    tick(w);
    expect([w.field!.share.extractor, w.stock.ore]).toEqual([7, 0]);
    tick(w, { type: 'setAlloc', shipType: 'extractor', weight: 0 });
    expect([w.field!.share.extractor, w.stock.ore, w.field!.alloc.extractor]).toEqual([0, 7, 0]);
    // With another type weighted, the returned ore flows there the same tick.
    tick(w, { type: 'setAlloc', shipType: 'hauler', weight: 1 });
    expect([w.field!.share.hauler, w.stock.ore]).toEqual([7, 0]);
  });

  it('lowering alloc.maxWeight live clamps the weights; a cost tuned below a share returns the excess', () => {
    const w = quietField();
    Object.assign(w.field!.alloc, weights(5, 4, 0, 0, 0));
    w.stock.ore = 18;
    tick(w, { type: 'setTunable', key: 'alloc.maxWeight', value: 3 });
    expect([w.field!.alloc.extractor, w.field!.alloc.hauler]).toEqual([3, 3]);
    expect(w.field!.share.extractor + w.field!.share.hauler).toBe(18);
    const before = w.field!.share.extractor;
    expect(before).toBeGreaterThan(5);
    tick(w, { type: 'setTunable', key: 'ship.extractor.cost', value: 5 });
    // The extractor share is cut to 5 and the excess returns; its bay then starts (share = cost).
    expect(w.field!.bays.extractor.ticksLeft).toBe(w.tun['ship.extractor.buildTicks']);
    expect(w.field!.share.extractor).toBe(0);
  });
});

describe('F3 bays and F9 the fleet limit', () => {
  it('a full share starts its bay: the resource is paid, the share empties, ticksLeft = ship.<type>.buildTicks; the ship spawns at the probe and a warship flies to the rally', () => {
    const w = quietField();
    Object.assign(w.field!.alloc, weights(0, 0, 1, 0, 0));
    w.stock.ore = 18;
    tick(w, { type: 'setRally', node: F.a5 });
    expect(w.field!.share.drone).toBe(0);
    expect(w.yards.drone.ticksLeft).toBe(w.tun['ship.drone.buildTicks']);
    expect(w.stats.oreSpentShips).toBe(18);
    run(w, w.tun['ship.drone.buildTicks'] - 1);
    expect(w.ships).toHaveLength(0);
    tick(w);
    expect(w.ships).toHaveLength(1);
    expect(w.ships[0]!.transit!.to).toBe(F.a5);
    expect(w.stats.shipsBuilt.drone).toBe(1);
  });

  it('a full share waits on the fleet limit while the others keep filling (fleet.countsEconomy 1: every ship counts)', () => {
    const w = quietField();
    w.tun['field.fleetCap'] = 2;
    addShips(w, PROBE, 2, 'drone');
    Object.assign(w.field!.alloc, weights(0, 0, 1, 0, 0));
    w.stock.ore = 18;
    tick(w);
    expect(w.field!.share.drone).toBe(18);
    expect(w.yards.drone.ticksLeft).toBe(0);
    expect(allocStatus(w, FD).rows.find((r) => r.type === 'drone')!.state).toBe('fleetFull');
    tick(w, { type: 'setAlloc', shipType: 'extractor', weight: 2 });
    w.stock.ore = 5;
    tick(w);
    expect(w.field!.share.extractor).toBe(5);
    expect(w.field!.share.drone).toBe(18);
    expect(allocStatus(w, FD).rows.find((r) => r.type === 'extractor')!.state).toBe('filling');
    w.stock.ore = 15;
    tick(w);
    // Both shares are full and both are counted: neither bay starts.
    expect([w.field!.share.extractor, w.field!.bays.extractor.ticksLeft, w.yards.drone.ticksLeft]).toEqual([20, 0, 0]);
    expect(fleetCount(w)).toBe(2);
    // A warship recycled frees a place: in type order the extractor bay takes it, and the count is recomputed before the drone.
    tick(w, { type: 'recycleShips', node: PROBE, counts: { drone: 1, lancer: 0, flak: 0 } });
    expect(w.field!.bays.extractor.ticksLeft).toBe(w.tun['ship.extractor.buildTicks']);
    expect(w.yards.drone.ticksLeft).toBe(0);
    expect(fleetCount(w)).toBe(2);
  });

  it('fleet.countsEconomy 0: the limit counts warships only, so economy bays start at the limit and economy ships are not counted', () => {
    const w = quietField();
    w.tun['field.fleetCap'] = 2;
    w.tun['fleet.countsEconomy'] = 0;
    addShips(w, PROBE, 2, 'drone');
    for (let i = 0; i < 5; i++) addEcon(w, 'hauler', PROBE);
    expect(fleetCount(w)).toBe(2);
    Object.assign(w.field!.alloc, weights(1, 0, 1, 0, 0));
    w.stock.ore = 38;
    tick(w);
    expect(w.field!.bays.extractor.ticksLeft).toBe(w.tun['ship.extractor.buildTicks']);
    expect(w.yards.drone.ticksLeft).toBe(0);
    expect(w.field!.share.drone).toBe(18);
    expect(fleetStatus(w, FD)).toMatchObject({ cap: 2, count: 2, building: 0, full: true, countsEconomy: false });
    // Recycling one drone lets the drone bay start; the extractor bay building is not counted either.
    tick(w, { type: 'recycleShips', node: PROBE, counts: { drone: 1, lancer: 0, flak: 0 } });
    expect(w.yards.drone.ticksLeft).toBe(w.tun['ship.drone.buildTicks']);
    expect(fleetCount(w)).toBe(2);
  });

  it('fleet.countsEconomy 1 counts economy ships alive and economy bays building', () => {
    const w = quietField();
    w.tun['field.fleetCap'] = 4;
    for (let i = 0; i < 3; i++) addEcon(w, 'hauler', PROBE);
    Object.assign(w.field!.alloc, weights(1, 0, 1, 0, 0));
    w.stock.ore = 38;
    tick(w);
    // 3 haulers + the extractor bay = 4: the drone waits.
    expect(w.field!.bays.extractor.ticksLeft).toBeGreaterThan(0);
    expect(w.yards.drone.ticksLeft).toBe(0);
    expect(fleetStatus(w, FD)).toMatchObject({ cap: 4, count: 4, building: 1, full: true, countsEconomy: true, econByType: { extractor: 0, hauler: 3 }, econBuildingByType: { extractor: 1, hauler: 0 } });
  });

  it('field.fleetCap 0 is no limit: bays start with any number of ships', () => {
    const w = quietField();
    w.tun['field.fleetCap'] = 0;
    addShips(w, PROBE, 40, 'drone');
    for (let i = 0; i < 40; i++) addEcon(w, 'hauler', PROBE);
    Object.assign(w.field!.alloc, weights(1, 0, 1, 0, 0));
    w.stock.ore = 38;
    tick(w);
    expect(fleetStatus(w, FD).cap).toBeNull();
    expect(fleetStatus(w, FD).full).toBe(false);
    expect([w.field!.bays.extractor.ticksLeft > 0, w.yards.drone.ticksLeft > 0]).toEqual([true, true]);
  });

  it('a Lancer is locked (no share, counter 0) until crystal is first delivered, then waits on crystal with a full share, then starts and pays ship.lancer.crystal', () => {
    const w = quietField();
    Object.assign(w.field!.alloc, weights(0, 0, 0, 2, 0));
    w.stock.ore = 50;
    tick(w);
    expect([w.field!.share.lancer, w.stock.ore, w.field!.allocCur.lancer]).toEqual([0, 50, 0]);
    expect(allocStatus(w, FD).rows.find((r) => r.type === 'lancer')!).toMatchObject({ state: 'locked', unlocked: false });
    w.stats.firstDeliveredTick.crystal = w.tick;
    tick(w);
    expect([w.field!.share.lancer, w.stock.ore]).toEqual([18, 32]);
    expect(w.yards.lancer.ticksLeft).toBe(0);
    expect(allocStatus(w, FD).rows.find((r) => r.type === 'lancer')!.state).toBe('waitingResource');
    w.stock.crystal = 3;
    tick(w);
    expect(w.yards.lancer.ticksLeft).toBe(0);
    w.stock.crystal = 5;
    tick(w);
    expect(w.yards.lancer.ticksLeft).toBe(w.tun['ship.lancer.buildTicks']);
    expect([w.stock.crystal, w.field!.share.lancer]).toEqual([5 - w.tun['ship.lancer.crystal'], 0]);
  });

  it('a Flak waits on ice the same way and pays ship.flak.ice', () => {
    const w = quietField();
    Object.assign(w.field!.alloc, weights(0, 0, 0, 0, 1));
    w.stock.ore = 18;
    w.stats.firstDeliveredTick.ice = 0;
    w.stock.ice = 4;
    tick(w);
    expect(w.yards.flak.ticksLeft).toBe(w.tun['ship.flak.buildTicks']);
    expect(w.stock.ice).toBe(0);
  });
});

/** A quiet field with these asteroids marked. */
function marked(...nodes: number[]): World {
  const w = quietField();
  for (const n of nodes) w.field!.mine[n] = true;
  return w;
}

describe('F5 extractors', () => {
  it('dispatch to the mineable node nearest the probe with a free slot (a1 before a2 at equal distance), reserving the slot from dispatch on', () => {
    const w = marked(F.a1, F.a2, F.a3);
    for (let i = 0; i < 6; i++) addEcon(w, 'extractor', PROBE);
    tick(w);
    const x = w.field!.econ;
    expect(x.map((s) => s.target)).toEqual([F.a1, F.a1, F.a2, F.a2, F.a3, null]);
    // In flight, not docked, yet every slot is reserved.
    expect(x.slice(0, 5).every((s) => s.transit !== null)).toBe(true);
    expect(rockStatus(w, F.a1)).toMatchObject({ bound: 2, docked: 0, inFlight: 2 });
    // The sixth finds no slot and parks idle at the probe.
    expect([x[5]!.at, x[5]!.transit]).toEqual([PROBE, null]);
  });

  it('docks on arrival after ceil(distance ÷ ship.speedSu) ticks and counts in the node\'s extractors', () => {
    const w = marked(F.a1);
    addEcon(w, 'extractor', PROBE);
    const ticks = runUntil(w, (v) => v.nodes[F.a1]!.extractors === 1, 200);
    // 262 su at 4 su/tick: 66 ticks, counting the dispatch tick.
    expect(ticks).toBe(Math.ceil(262 / w.tun['ship.speedSu']));
    expect(rockStatus(w, F.a1)).toMatchObject({ docked: 1, bound: 1, inFlight: 0 });
  });

  it('an idle extractor re-dispatches on the tick a slot opens (a mark turned on)', () => {
    const w = marked(F.a3);
    addEcon(w, 'extractor', PROBE, F.a3);
    w.field!.econ[0]!.at = F.a3;
    const idle = addEcon(w, 'extractor', PROBE);
    run(w, 5);
    expect([idle.target, idle.at]).toEqual([null, PROBE]);
    tick(w, { type: 'setMine', node: F.a4, on: true });
    expect(idle.target).toBe(F.a4);
    expect(idle.transit!.to).toBe(F.a4);
  });

  it('unmarking a node unbinds its extractors, which re-dispatch from where they are (or fly home and idle with nowhere to go)', () => {
    const w = marked(F.a1);
    const a = addEcon(w, 'extractor', F.a1, F.a1);
    const b = addEcon(w, 'extractor', F.a1, F.a1);
    tick(w);
    expect(w.nodes[F.a1]!.extractors).toBe(2);
    tick(w, { type: 'setMine', node: F.a1, on: false }, { type: 'setMine', node: F.a5, on: true });
    expect([a.target, b.target]).toEqual([F.a5, F.a5]);
    expect(a.transit!.from).toBe(F.a1);
    expect(w.nodes[F.a1]!.extractors).toBe(0);
    // With no mineable slot left, an unbound extractor flies home and idles there.
    const v = marked(F.a1);
    const c = addEcon(v, 'extractor', F.a1, F.a1);
    tick(v, { type: 'setMine', node: F.a1, on: false });
    expect([c.target, c.transit!.to]).toEqual([null, PROBE]);
    runUntil(v, () => c.transit === null, 200);
    expect([c.at, c.target]).toEqual([PROBE, null]);
  });

  it('an extractor unbound in flight finishes its leg, then re-dispatches from the node it reached', () => {
    const w = marked(F.a1, F.a2);
    const x = addEcon(w, 'extractor', PROBE);
    tick(w);
    expect(x.target).toBe(F.a1);
    tick(w, { type: 'setMine', node: F.a1, on: false });
    expect([x.target, x.transit!.to]).toEqual([null, F.a1]);
    runUntil(w, () => x.target !== null, 200);
    expect(x.target).toBe(F.a2);
    expect(x.transit!.from).toBe(F.a1);
  });

  it('recycling an extractor frees its slot: the idle one takes it the same tick, and the refund is fleet.recycleRefundPct of ship.extractor.cost', () => {
    const w = marked(F.a1);
    addEcon(w, 'extractor', F.a1, F.a1);
    addEcon(w, 'extractor', F.a1, F.a1);
    const idle = addEcon(w, 'extractor', PROBE);
    tick(w);
    expect(idle.target).toBeNull();
    tick(w, { type: 'recycleShips', node: F.a1, counts: { drone: 0, lancer: 0, flak: 0, extractor: 1 } });
    expect(w.field!.econ).toHaveLength(2);
    expect(idle.target).toBe(F.a1);
    const refund = Math.floor((w.tun['ship.extractor.cost'] * w.tun['fleet.recycleRefundPct']) / 100);
    expect([w.stock.ore, w.stats.oreRefunded, w.stats.econRecycled.extractor]).toEqual([refund, refund, 1]);
    expect(w.nodes[F.a1]!.extractors).toBe(1);
  });
});

describe('F6 haulers', () => {
  /** A quiet field with a1 and a2 marked and `e1`, `e2` extractors docked there. */
  function docks(e1: number, e2: number): World {
    const w = marked(F.a1, F.a2);
    for (let i = 0; i < e1; i++) addEcon(w, 'extractor', F.a1, F.a1);
    for (let i = 0; i < e2; i++) addEcon(w, 'extractor', F.a2, F.a2);
    tick(w);
    return w;
  }

  it('a hauler at the probe picks the worked node with the lowest haulers ÷ extractors (cross-multiplied); ties go to the nearer, then the lower index', () => {
    const w = docks(2, 1);
    addEcon(w, 'hauler', F.a1, F.a1);
    const h1 = addEcon(w, 'hauler', PROBE);
    tick(w);
    // a1 1/2 against a2 0/1: a2.
    expect(h1.target).toBe(F.a2);
    const h2 = addEcon(w, 'hauler', PROBE);
    tick(w);
    // a1 1/2 against a2 1/1: a1.
    expect(h2.target).toBe(F.a1);
    const h3 = addEcon(w, 'hauler', PROBE);
    tick(w);
    // a1 2/2 against a2 1/1: equal ratios, equal distance (262): the lower index.
    expect(h3.target).toBe(F.a1);
  });

  it('on equal ratios the nearer node wins even with the higher index (the captured pocket p1, 358 su, before a3, 503 su)', () => {
    const w = marked(F.a3);
    addEcon(w, 'extractor', F.a3, F.a3);
    setGuards(w, F.p1, []);
    addShips(w, F.p1, 1);
    tick(w);
    expect(guardianAt(w, F.p1)!.alive).toBe(false);
    expect([w.nodes[F.p1]!.extractors, w.nodes[F.a3]!.extractors]).toEqual([1, 1]);
    const h = addEcon(w, 'hauler', PROBE);
    tick(w);
    expect(h.target).toBe(F.p1);
  });

  it('a node with a buffer but no working extractor ranks after every node with one', () => {
    const w = docks(0, 1);
    w.nodes[F.a1]!.buffer = 10;
    addEcon(w, 'hauler', F.a2, F.a2);
    addEcon(w, 'hauler', F.a2, F.a2);
    const h = addEcon(w, 'hauler', PROBE);
    tick(w);
    expect(h.target).toBe(F.a2);
    // With no node producing, the buffer-only node is picked.
    const v = marked(F.a1);
    v.nodes[F.a1]!.buffer = 3;
    const g = addEcon(v, 'hauler', PROBE);
    tick(v);
    expect(g.target).toBe(F.a1);
  });

  it('with no worked node a hauler parks idle at the probe', () => {
    const w = marked(F.a1);
    const h = addEcon(w, 'hauler', PROBE);
    run(w, 3);
    expect([h.target, h.at, h.transit]).toEqual([null, PROBE, null]);
  });

  it('waits at its node until the buffer holds a full cargo, then loads ship.hauler.cargo and flies home at ship.hauler.speedSu', () => {
    const w = docks(1, 0);
    const n = w.nodes[F.a1]!;
    const h = addEcon(w, 'hauler', F.a1, F.a1);
    n.buffer = 3;
    n.accum = 0;
    tick(w);
    expect([h.at, h.cargo, n.buffer]).toEqual([F.a1, 0, 3]);
    n.buffer = 4;
    tick(w);
    expect([h.cargo, h.cargoRes, n.buffer]).toEqual([4, 'ore', 0]);
    expect(h.transit).toMatchObject({ from: F.a1, to: PROBE, totalTicks: Math.ceil(262 / w.tun['ship.hauler.speedSu']) });
  });

  it('loads a partial cargo once the node stops being worked (its extractor left)', () => {
    const w = docks(1, 0);
    const n = w.nodes[F.a1]!;
    const h = addEcon(w, 'hauler', F.a1, F.a1);
    n.buffer = 2;
    n.accum = 0;
    tick(w);
    expect(h.cargo).toBe(0);
    tick(w, { type: 'setMine', node: F.a1, on: false });
    expect([h.cargo, n.buffer, h.transit!.to]).toEqual([2, 0, PROBE]);
  });

  it('delivers on arrival into stock, the delivered stats and buckets, firstDeliveredTick and the rock\'s delivered-per-minute; then reassigns when its node is unmarked', () => {
    const w = docks(1, 0);
    const h = addEcon(w, 'hauler', F.a1, F.a1);
    w.nodes[F.a1]!.buffer = 4;
    tick(w);
    expect(w.stats.firstDeliveredTick.ore).toBeNull();
    const t = runUntil(w, () => h.at === PROBE, 400);
    // ceil(262 ÷ 2) = 131 ticks of flight; the loading tick already moved it once.
    expect(t).toBe(Math.ceil(262 / w.tun['ship.hauler.speedSu']) - 1);
    expect(w.stock.ore).toBe(4);
    expect(w.stats.delivered.ore).toBe(4);
    expect(w.stats.firstDeliveredTick.ore).toBe(w.tick - 1);
    expect(w.stats.deliveredBuckets.reduce((s, v) => s + v, 0)).toBe(4);
    expect(rockStatus(w, F.a1).deliveredPerMin).toBe(4);
    expect([h.cargo, h.cargoRes]).toEqual([0, null]);
    // Its node is still worked and marked: it goes back.
    tick(w);
    expect(h.transit!.to).toBe(F.a1);
  });

  /** A quiet field with p1 captured (Mine-marked, one free extractor), plus `asteroids` marked with one docked extractor each. */
  function capturedP1(...asteroids: number[]): World {
    const w = marked(...asteroids);
    for (const n of asteroids) addEcon(w, 'extractor', n, n);
    setGuards(w, F.p1, []);
    addShips(w, F.p1, 1);
    tick(w);
    expect(guardianAt(w, F.p1)!.alive).toBe(false);
    return w;
  }

  /** After Stop on p1: runs 6000 ticks and returns the last tick any hauler targeted p1, and the ice delivered after it. */
  function afterStop(w: World): { lastOnP1: number; iceAfter: number } {
    let lastOnP1 = -1;
    for (let i = 0; i < 6000; i++) {
      if (w.field!.econ.some((s) => s.type === 'hauler' && s.target === F.p1)) lastOnP1 = w.tick;
      tick(w);
    }
    expect(lastOnP1).toBeGreaterThanOrEqual(0);
    return { lastOnP1, iceAfter: w.stats.delivered.ice };
  }

  it('Stop on a captured pocket releases its haulers: they finish the trip, never pick it again, and ice deliveries stop (p1 the only worked rock)', () => {
    const w = capturedP1();
    const h = addEcon(w, 'hauler', PROBE);
    runUntil(w, () => h.at === F.p1, 400);
    tick(w, { type: 'setMine', node: F.p1, on: false });
    // Stop ends the wait at once: it loads what is there and flies home.
    expect(h.transit!.to).toBe(PROBE);
    runUntil(w, () => h.at === PROBE, 400);
    const ice = w.stats.delivered.ice;
    tick(w);
    expect([h.target, h.at, h.transit]).toEqual([null, PROBE, null]);
    run(w, 6000);
    expect(h.target).toBeNull();
    expect(w.stats.delivered.ice).toBe(ice);
    // The free extractor still works the rock: its buffer stays there, and is collected once the mark is back on.
    expect(w.nodes[F.p1]!.buffer).toBeGreaterThan(0);
    tick(w, { type: 'setMine', node: F.p1, on: true });
    expect(h.target).toBe(F.p1);
  });

  it('Stop on a captured pocket releases its haulers with other rocks worked too (a1 and a2, three haulers): none targets p1 after its trip', () => {
    const w = capturedP1(F.a1, F.a2);
    for (let i = 0; i < 3; i++) addEcon(w, 'hauler', PROBE);
    runUntil(w, () => w.field!.econ.some((s) => s.type === 'hauler' && s.target === F.p1 && s.at === F.p1), 2000);
    tick(w, { type: 'setMine', node: F.p1, on: false });
    // Every hauler that was on p1 is flying home within one round trip.
    const { lastOnP1, iceAfter } = afterStop(w);
    const roundTrip = 2 * Math.ceil(358 / w.tun['ship.hauler.speedSu']) + 2;
    expect(lastOnP1).toBeLessThan(w.tick - 6000 + roundTrip);
    const iceAtStop = iceAfter;
    run(w, 3000);
    expect(w.stats.delivered.ice).toBe(iceAtStop);
    // The other rocks keep their haulers.
    expect(w.field!.econ.filter((s) => s.type === 'hauler' && s.target !== null).every((s) => s.target === F.a1 || s.target === F.a2)).toBe(true);
  });

  it('the hive after Stop gets no haulers either', () => {
    const w = quietField();
    setGuards(w, F.heart, []);
    addShips(w, F.heart, 1);
    tick(w, { type: 'setTunable', key: 'ship.hauler.speedSu', value: 10 });
    expect(w.field!.mine[F.heart]).toBe(true);
    tick(w, { type: 'setMine', node: F.heart, on: false });
    const h = addEcon(w, 'hauler', PROBE);
    run(w, 600);
    expect([h.target, h.at]).toEqual([null, PROBE]);
    expect(w.stats.delivered.ore).toBe(0);
  });

  it('only Mine-marked rocks are assigned haulers: an unmarked asteroid\'s leftover buffer stays on it until it is marked again (Director, 2026-11-14)', () => {
    const w = quietField();
    w.nodes[F.a1]!.buffer = 10;
    const h = addEcon(w, 'hauler', PROBE);
    run(w, 300);
    expect([h.target, w.nodes[F.a1]!.buffer]).toEqual([null, 10]);
    tick(w, { type: 'setMine', node: F.a1, on: true });
    expect(h.target).toBe(F.a1);
    runUntil(w, () => w.stats.delivered.ore > 0, 400);
    // No extractor works a1: the hauler loads what is there (min(buffer, cargo)) each trip until it is empty.
    expect(w.stats.delivered.ore).toBe(w.tun['ship.hauler.cargo']);
  });

  it('a hauler of an unmarked node finishes its trip and reassigns at the probe', () => {
    const w = docks(1, 1);
    const h = addEcon(w, 'hauler', F.a1, F.a1);
    w.nodes[F.a1]!.buffer = 4;
    tick(w);
    expect(h.cargo).toBe(4);
    tick(w, { type: 'setMine', node: F.a1, on: false });
    runUntil(w, () => h.at === PROBE, 400);
    expect(w.stock.ore).toBe(4);
    tick(w);
    expect(h.target).toBe(F.a2);
  });
});

describe('F11 capture in field mode', () => {
  it('a captured pocket is Mine-marked, gets min(pocket.freeExtractors, slots) free extractors, and an idle extractor is dispatched to it', () => {
    const w = quietField();
    const x = addEcon(w, 'extractor', PROBE);
    setGuards(w, F.p1, []);
    addShips(w, F.p1, 1);
    expect(isValidInput(w, FD, { type: 'setMine', node: F.p1, on: true })).toBe(false);
    tick(w);
    expect(w.field!.mine[F.p1]).toBe(true);
    expect(w.field!.free[F.p1]).toBe(Math.min(w.tun['pocket.freeExtractors'], w.nodes[F.p1]!.slots));
    expect(w.nodes[F.p1]!.extractors).toBe(1);
    // F5 ran before capture this tick: the extractor goes next tick, to the one slot left.
    tick(w);
    expect(x.target).toBe(F.p1);
    expect(rockStatus(w, F.p1)).toMatchObject({ mine: true, mineable: true, freeExtractors: 1, bound: 1 });
    expect(isValidInput(w, FD, { type: 'setMine', node: F.p1, on: false })).toBe(true);
  });

  it('the pocket\'s prize unlocks its warship on first delivery (ice: the Flak)', () => {
    const w = quietField();
    setGuards(w, F.p1, []);
    addShips(w, F.p1, 1);
    tick(w);
    const h = addEcon(w, 'hauler', PROBE);
    runUntil(w, () => w.stats.firstDeliveredTick.ice !== null, 3000);
    expect(h.target).toBe(F.p1);
    expect(w.stock.ice).toBeGreaterThan(0);
    expect(allocStatus(w, FD).rows.find((r) => r.type === 'flak')!.unlocked).toBe(true);
    expect(allocStatus(w, FD).rows.find((r) => r.type === 'lancer')!.unlocked).toBe(false);
  });

  it('capturing the hive wins the run (capturedTick, isWon); it is Mine-marked with its free extractor, and free play continues with inputs valid', () => {
    const w = quietField();
    setGuards(w, F.heart, []);
    addShips(w, F.heart, 1);
    expect(isWon(w)).toBe(false);
    tick(w);
    expect(w.capturedTick).toBe(w.tick - 1);
    expect(isWon(w)).toBe(true);
    expect(w.field!.mine[F.heart]).toBe(true);
    expect(w.field!.free[F.heart]).toBe(Math.min(w.tun['heart.freeExtractors'], w.nodes[F.heart]!.slots));
    const set: Input = { type: 'setAlloc', shipType: 'drone', weight: 2 };
    expect(isValidInput(w, FD, set)).toBe(true);
    w.stock.ore = 18;
    tick(w, set);
    expect(w.yards.drone.ticksLeft).toBeGreaterThan(0);
  });
});

describe('F12 inputs in field mode', () => {
  /** A busy field: ships, shares and marks, so an applied input would show in the hash. */
  function busy(): World {
    const w = quietField();
    w.field!.mine[F.a1] = true;
    addEcon(w, 'extractor', F.a1, F.a1);
    // Waiting at a1 for a full cargo (its buffer is empty): only economy ships are parked at a1.
    addEcon(w, 'hauler', F.a1, F.a1);
    addShips(w, PROBE, 2, 'drone');
    w.stock.ore = 10;
    tick(w);
    expect(w.field!.econ.every((s) => s.at === F.a1)).toBe(true);
    return w;
  }

  /** Steps a copy with the input and a copy without: an ignored input leaves the same state. */
  function ignored(input: Input): boolean {
    const a = busy();
    const b = busy();
    expect(isValidInput(a, FD, input), JSON.stringify(input)).toBe(false);
    tick(a, input);
    tick(b);
    return worldHash(a) === worldHash(b);
  }

  it('every campaign input is invalid and ignored: buildExtractor, buildRoute, upgradeRoute, cancelBuild, setShipyard, enterArea, leaveArea (withdraw), buyResearch', () => {
    const inputs: Input[] = [
      { type: 'buildExtractor', node: F.a1 },
      { type: 'buildRoute', from: F.a1, to: PROBE },
      { type: 'upgradeRoute', from: F.a1 },
      { type: 'cancelBuild', index: 0 },
      { type: 'setShipyard', shipType: 'drone', on: true },
      { type: 'enterArea', area: 0 },
      { type: 'leaveArea' },
      { type: 'buyResearch', item: 0 },
    ];
    for (const input of inputs) expect(ignored(input), input.type).toBe(true);
  });

  it('setAlloc: a weight below 0, above alloc.maxWeight or not an integer, or an unknown type, is invalid and ignored', () => {
    const max = FD.tunables['alloc.maxWeight'].default;
    const bad: Input[] = [
      { type: 'setAlloc', shipType: 'drone', weight: -1 },
      { type: 'setAlloc', shipType: 'drone', weight: max + 1 },
      { type: 'setAlloc', shipType: 'drone', weight: 1.5 },
      { type: 'setAlloc', shipType: 'root' as BuildType, weight: 1 },
    ];
    for (const input of bad) expect(ignored(input), JSON.stringify(input)).toBe(true);
    const w = busy();
    expect(isValidInput(w, FD, { type: 'setAlloc', shipType: 'flak', weight: max })).toBe(true);
    expect(isValidInput(w, FD, { type: 'setAlloc', shipType: 'flak', weight: 0 })).toBe(true);
  });

  it('setMine: the probe, a guarded pocket, the guarded hive, a bad index or a non-boolean is invalid and ignored; any asteroid is valid', () => {
    const bad: Input[] = [
      { type: 'setMine', node: PROBE, on: true },
      { type: 'setMine', node: F.p2, on: true },
      { type: 'setMine', node: F.heart, on: true },
      { type: 'setMine', node: 99, on: true },
      { type: 'setMine', node: F.a2, on: 1 as unknown as boolean },
    ];
    for (const input of bad) expect(ignored(input), JSON.stringify(input)).toBe(true);
    const w = busy();
    for (const n of [F.a1, F.a2, F.a3, F.a4, F.a5, F.a6, F.a7]) {
      expect(isValidInput(w, FD, { type: 'setMine', node: n, on: true }), String(n)).toBe(true);
      expect(isValidInput(w, FD, { type: 'setMine', node: n, on: false }), String(n)).toBe(true);
    }
  });

  it('sendShips counts warships only: economy ships are never sent by hand', () => {
    // Only an extractor and a hauler are parked at a1: nothing to send, even with economy counts in the order.
    expect(ignored({ type: 'sendShips', from: F.a1, to: F.a5, counts: SEND_ALL })).toBe(true);
    const sent = { type: 'sendShips', from: F.a1, to: F.a5, counts: { ...SEND_ALL, hauler: 5, extractor: 5 } } as unknown as Input;
    expect(ignored(sent)).toBe(true);
    const w = busy();
    expect(isValidInput(w, FD, { type: 'sendShips', from: PROBE, to: F.a5, counts: SEND_ALL })).toBe(true);
  });

  it('recycleShips: at a guarded node, with nothing of those types parked there, or with a bad economy count, is invalid and ignored', () => {
    const none = { drone: 0, lancer: 0, flak: 0 };
    const bad: Input[] = [
      { type: 'recycleShips', node: F.p1, counts: { ...none, extractor: 1 } },
      { type: 'recycleShips', node: F.a2, counts: { ...none, hauler: 1 } },
      { type: 'recycleShips', node: F.a1, counts: { ...none, extractor: -1 } },
      { type: 'recycleShips', node: F.a1, counts: { ...none, extractor: 0.5 } },
      { type: 'recycleShips', node: F.a1, counts: none },
    ];
    for (const input of bad) expect(ignored(input), JSON.stringify(input)).toBe(true);
    const w = busy();
    expect(isValidInput(w, FD, { type: 'recycleShips', node: F.a1, counts: { ...none, extractor: 1 } })).toBe(true);
    expect(isValidInput(w, FD, { type: 'recycleShips', node: F.a1, counts: { ...none, hauler: 9 } })).toBe(true);
  });

  it('setRally and setTunable "as now": a bad node index, or a tunable value outside its range, is invalid and ignored', () => {
    const max = FD.tunables['raid.maxSize'].max;
    const bad: Input[] = [
      { type: 'setRally', node: 11 },
      { type: 'setRally', node: -1 },
      { type: 'setTunable', key: 'raid.maxSize', value: max + 1 },
      { type: 'setTunable', key: 'alloc.maxWeight', value: 2 },
    ];
    for (const input of bad) expect(ignored(input), JSON.stringify(input)).toBe(true);
    const w = busy();
    expect(isValidInput(w, FD, { type: 'setRally', node: F.heart })).toBe(true);
    expect(isValidInput(w, FD, { type: 'setTunable', key: 'raid.maxSize', value: max })).toBe(true);
  });

  it('setRally applies to warships only: economy ships spawn at the probe and are dispatched or assigned', () => {
    const w = marked(F.a1);
    Object.assign(w.field!.alloc, weights(1, 0, 0, 0, 0));
    w.stock.ore = 20;
    tick(w, { type: 'setRally', node: F.a5 });
    runUntil(w, () => w.field!.econ.length === 1, 400);
    expect(w.field!.econ[0]!.transit!.to).toBe(F.a1);
  });
});

describe('F14 stats', () => {
  it('allocChanges counts setAlloc inputs that changed a weight; peakEcon is the most economy ships alive at once; econBuilt counts spawns', () => {
    const w = marked(F.a1);
    tick(w, { type: 'setAlloc', shipType: 'hauler', weight: 2 }, { type: 'setAlloc', shipType: 'hauler', weight: 2 }, { type: 'setAlloc', shipType: 'drone', weight: 0 });
    expect(w.stats.allocChanges).toBe(1);
    tick(w, ...setAll(weights(2, 0, 0, 0, 0)));
    // hauler 2 → 0 and extractor 0 → 2 changed; drone, lancer and flak stayed 0.
    expect(w.stats.allocChanges).toBe(3);
    w.stock.ore = 40;
    runUntil(w, () => w.field!.econ.length === 2, 1000);
    expect(w.stats.econBuilt).toEqual({ extractor: 2, hauler: 0 });
    expect(w.stats.peakEcon).toBe(2);
    tick(w, { type: 'recycleShips', node: PROBE, counts: { drone: 0, lancer: 0, flak: 0, extractor: 5 } });
    run(w, 2);
    expect(w.stats.peakEcon).toBe(2);
    expect(w.stats.econLost).toEqual({ extractor: 0, hauler: 0 });
    expect(w.stats.raids).toEqual({ mustered: 0, beaten: 0, hit: 0, turnedBack: 0 });
  });
});

describe('F7 movement and F4 extraction', () => {
  it('each economy type moves at its own speed: extractors at ship.speedSu, haulers at ship.hauler.speedSu', () => {
    const w = marked(F.a6);
    w.nodes[F.a6]!.buffer = 1;
    const x = addEcon(w, 'extractor', PROBE);
    const h = addEcon(w, 'hauler', PROBE);
    tick(w);
    expect(x.transit!.totalTicks).toBe(Math.ceil(632 / w.tun['ship.speedSu']));
    expect(h.transit!.totalTicks).toBe(Math.ceil(632 / w.tun['ship.hauler.speedSu']));
  });

  it('a node\'s extractors is its docked extractor ships plus its free extractors, and drives extraction (extractor.orePerMin each)', () => {
    const w = marked(F.a5);
    for (let i = 0; i < 3; i++) addEcon(w, 'extractor', F.a5, F.a5);
    tick(w);
    expect(docked(w)[F.a5]).toBe(3);
    // 3 × 10 ore/min: 30 ore over 1800 ticks (the accumulator yields a unit every 60 ticks).
    w.nodes[F.a5]!.buffer = 0;
    w.nodes[F.a5]!.accum = 0;
    run(w, 1800);
    expect(w.nodes[F.a5]!.buffer).toBe(3 * w.tun['extractor.orePerMin']);
  });
});
