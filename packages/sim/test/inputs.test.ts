import { describe, expect, it } from 'vitest';
import { SEND_ALL, clampSendCounts, inputCost, isValidInput, step, worldHash, type Input, type World } from '../src/index.ts';
import { N, addShips, clone, data, fresh, guardian, heart, idle, run } from './helpers.ts';

/** The input is invalid, and stepping with it changes nothing compared with stepping without it. */
function expectIgnored(w: World, input: Input): void {
  expect(isValidInput(w, data, input)).toBe(false);
  const a = clone(w);
  const b = clone(w);
  step(a, data, [input]);
  step(b, data, []);
  expect(worldHash(a)).toBe(worldHash(b));
}

function expectApplied(w: World, input: Input): void {
  expect(isValidInput(w, data, input)).toBe(true);
  const a = clone(w);
  const b = clone(w);
  step(a, data, [input]);
  step(b, data, []);
  expect(worldHash(a)).not.toBe(worldHash(b));
}

/** Captures a guarded node by hand (test setup): no guards, one ship arrives. */
function captured(w: World, node: number = N.heart): World {
  guardian(w, node).guards = [];
  addShips(w, node, 1);
  step(w, data, []);
  expect(guardian(w, node).alive).toBe(false);
  return w;
}

describe('buildExtractor', () => {
  it('queues on an asteroid at extractor.cost', () => {
    const w = idle();
    expectApplied(w, { type: 'buildExtractor', node: N.a1 });
    step(w, data, [{ type: 'buildExtractor', node: N.a1 }]);
    expect(w.queue).toEqual([{ kind: 'extractor', node: N.a1, cost: 20 }]);
  });
  it('is invalid on the probe, the Root, and on a pocket or the heart before capture', () => {
    const w = idle();
    for (const node of [N.probe, N.root, N.p1, N.p4, N.heart]) expectIgnored(w, { type: 'buildExtractor', node });
    expectIgnored(captured(idle(), N.root), { type: 'buildExtractor', node: N.root });
  });
  it('is valid on a captured pocket and the captured heart, up to their slots', () => {
    const w = captured(idle());
    expectApplied(w, { type: 'buildExtractor', node: N.heart });
    const p = captured(idle(), N.p1); // Frost Gate p1: 2 slots, 1 free extractor
    expect(p.nodes[N.p1]!.extractors).toBe(1);
    expectApplied(p, { type: 'buildExtractor', node: N.p1 });
    step(p, data, [{ type: 'buildExtractor', node: N.p1 }]);
    expectIgnored(p, { type: 'buildExtractor', node: N.p1 });
  });
  it('counts built, active and queued extractors against the slots', () => {
    const w = idle();
    w.nodes[N.a5]!.extractors = 1; // built
    w.activeBuild = { kind: 'extractor', node: N.a5, ticksLeft: 100 }; // active
    w.queue.push({ kind: 'extractor', node: N.a5, cost: 20 }); // queued
    expectIgnored(w, { type: 'buildExtractor', node: N.a5 }); // a5 has 3 slots
    w.queue.pop();
    expectApplied(w, { type: 'buildExtractor', node: N.a5 });
  });
  it('is invalid when the queue is full', () => {
    const w = idle();
    for (let i = 0; i < 4; i++) w.queue.push({ kind: 'extractor', node: N.a5, cost: 20 });
    expectIgnored(w, { type: 'buildExtractor', node: N.a3 });
  });
  it('is invalid for a node index out of range or not an integer', () => {
    const w = idle();
    expectIgnored(w, { type: 'buildExtractor', node: 16 });
    expectIgnored(w, { type: 'buildExtractor', node: -1 });
    expectIgnored(w, { type: 'buildExtractor', node: 1.5 });
  });
});

describe('buildRoute', () => {
  it('needs an extractor built, active or queued at the source', () => {
    const w = idle();
    expectIgnored(w, { type: 'buildRoute', from: N.a1, to: N.probe });
    w.queue.push({ kind: 'extractor', node: N.a1, cost: 20 });
    expectApplied(w, { type: 'buildRoute', from: N.a1, to: N.probe });
    w.queue = [];
    w.activeBuild = { kind: 'extractor', node: N.a1, ticksLeft: 50 };
    expectApplied(w, { type: 'buildRoute', from: N.a1, to: N.probe });
    w.activeBuild = null;
    w.nodes[N.a1]!.extractors = 1;
    expectApplied(w, { type: 'buildRoute', from: N.a1, to: N.probe });
  });
  it('costs costBase + floor(length × costPer100Su / 100), locked when queued', () => {
    const w = idle();
    for (const n of [N.a1, N.a2, N.a3, N.a4, N.a5]) w.nodes[n]!.extractors = 1;
    const costs = [N.a1, N.a2, N.a3, N.a4, N.a5].map((n) => inputCost(w, { type: 'buildRoute', from: n, to: N.probe }));
    expect(costs).toEqual([10, 10, 15, 15, 15]); // lengths 262, 262, 503, 503, 530
    step(w, data, [{ type: 'buildRoute', from: N.a1, to: N.probe }]);
    step(w, data, [{ type: 'setTunable', key: 'route.costBase', value: 50 }]);
    expect(w.queue[0]!.cost).toBe(10);
  });
  it('requires to = probe and from ≠ probe', () => {
    const w = idle();
    w.nodes[N.a1]!.extractors = 1;
    expectIgnored(w, { type: 'buildRoute', from: N.a1, to: N.a2 });
    expectIgnored(w, { type: 'buildRoute', from: N.probe, to: N.probe });
  });
  it('is invalid if the source already has a route, or one queued or under construction', () => {
    const w = idle();
    w.nodes[N.a1]!.extractors = 1;
    w.queue.push({ kind: 'route', node: N.a1, cost: 10 });
    expectIgnored(w, { type: 'buildRoute', from: N.a1, to: N.probe });
    w.queue = [];
    w.activeBuild = { kind: 'route', node: N.a1, ticksLeft: 5 };
    expectIgnored(w, { type: 'buildRoute', from: N.a1, to: N.probe });
    w.activeBuild = null;
    w.routes.push({ id: w.nextId++, from: N.a1, to: N.probe, length: 262, level: 1, cooldown: 0, pods: [] });
    expectIgnored(w, { type: 'buildRoute', from: N.a1, to: N.probe });
  });
  it('is invalid when the queue is full', () => {
    const w = idle();
    w.nodes[N.a1]!.extractors = 1;
    for (let i = 0; i < 4; i++) w.queue.push({ kind: 'extractor', node: N.a5, cost: 20 });
    expectIgnored(w, { type: 'buildRoute', from: N.a1, to: N.probe });
  });
});

describe('upgradeRoute', () => {
  function withRoute(): World {
    const w = idle();
    w.nodes[N.a2]!.extractors = 1;
    w.routes.push({ id: w.nextId++, from: N.a2, to: N.probe, length: 262, level: 1, cooldown: 0, pods: [] });
    return w;
  }
  it('is invalid without a route', () => {
    expectIgnored(idle(), { type: 'upgradeRoute', from: N.a2 });
  });
  it('costs 20, 40, 60, 80 for L2..L5 and stops at maxLevel counting queued and active upgrades', () => {
    const w = withRoute();
    const costs: number[] = [];
    for (let i = 0; i < 3; i++) {
      costs.push(inputCost(w, { type: 'upgradeRoute', from: N.a2 }));
      step(w, data, [{ type: 'upgradeRoute', from: N.a2 }]);
    }
    w.activeBuild = { kind: 'upgrade', node: N.a2, ticksLeft: 100 };
    w.queue.shift(); // the active one replaces a queued one
    costs.push(inputCost(w, { type: 'upgradeRoute', from: N.a2 }));
    step(w, data, [{ type: 'upgradeRoute', from: N.a2 }]);
    expect(costs).toEqual([20, 40, 60, 80]);
    expect(w.queue.map((o) => o.cost)).toEqual([40, 60, 80]);
    // level 1 + 1 active + 3 queued = 5 = maxLevel
    expectIgnored(w, { type: 'upgradeRoute', from: N.a2 });
  });
  it('is invalid when the queue is full', () => {
    const w = withRoute();
    for (let i = 0; i < 4; i++) w.queue.push({ kind: 'extractor', node: N.a5, cost: 20 });
    expectIgnored(w, { type: 'upgradeRoute', from: N.a2 });
  });
});

describe('cancelBuild', () => {
  it('removes an unpaid order without refund; out-of-range indices are ignored', () => {
    const w = idle();
    w.stock.ore = 5;
    step(w, data, [
      { type: 'buildExtractor', node: N.a1 },
      { type: 'buildExtractor', node: N.a2 },
    ]);
    expectIgnored(w, { type: 'cancelBuild', index: 2 });
    expectIgnored(w, { type: 'cancelBuild', index: -1 });
    step(w, data, [{ type: 'cancelBuild', index: 0 }]);
    expect(w.queue).toEqual([{ kind: 'extractor', node: N.a2, cost: 20 }]);
    expect(w.stock.ore).toBe(5);
  });
});

describe('setShipyard', () => {
  it('turns one yard off; a ship in progress still finishes', () => {
    const w = fresh();
    w.stock.ore = 100;
    step(w, data, []);
    expect(w.yards.drone.ticksLeft).toBe(90);
    step(w, data, [{ type: 'setShipyard', shipType: 'drone', on: false }]);
    run(w, 89);
    expect(w.ships.length).toBe(1);
    expect(w.yards.drone.ticksLeft).toBe(0);
    run(w, 200);
    expect(w.ships.length).toBe(1);
  });
  it('is always valid for each type (even before its component exists), and only touches that yard', () => {
    const w = fresh();
    expect(w.yards).toEqual({ drone: { on: true, ticksLeft: 0 }, lancer: { on: false, ticksLeft: 0 }, flak: { on: false, ticksLeft: 0 } });
    expectApplied(w, { type: 'setShipyard', shipType: 'lancer', on: true });
    step(w, data, [{ type: 'setShipyard', shipType: 'flak', on: true }]);
    expect(w.yards.flak.on).toBe(true);
    expect(w.yards.lancer.on).toBe(false);
    expect(w.yards.drone.on).toBe(true);
  });
  it('rejects a non-boolean or an unknown ship type', () => {
    expectIgnored(fresh(), { type: 'setShipyard', shipType: 'drone', on: 1 as unknown as boolean });
    expectIgnored(fresh(), { type: 'setShipyard', shipType: 'warden' as 'drone', on: false });
  });
});

describe('sendShips', () => {
  const counts = (drone: number, lancer: number, flak: number) => ({ drone, lancer, flak });
  it('moves the lowest-id ships of each type, each count clamped to the ships of that type at `from`', () => {
    const w = idle();
    addShips(w, N.probe, 3, 'drone');
    addShips(w, N.probe, 2, 'lancer');
    addShips(w, N.probe, 2, 'flak');
    addShips(w, N.a5, 2, 'lancer');
    const ids = (type: string) => w.ships.filter((s) => s.type === type && s.at === N.probe).map((s) => s.id);
    const drones = ids('drone');
    const lancers = ids('lancer');
    const flak = ids('flak');
    expect(clampSendCounts(w, N.probe, counts(2, 9, 0))).toEqual(counts(2, 2, 0));
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.a5, counts: counts(2, 9, 0) }]);
    const moving = w.ships.filter((s) => s.transit !== null).map((s) => s.id);
    expect(moving).toEqual([...drones.slice(0, 2), ...lancers].sort((a, b) => a - b));
    expect(w.ships.filter((s) => s.at === N.probe).map((s) => s.id)).toEqual([drones[2], ...flak]);
    // The a5 lancers did not move: the order only takes ships at `from`.
    expect(w.ships.filter((s) => s.at === N.a5).length).toBe(2);
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.a1, counts: SEND_ALL }]);
    expect(w.ships.filter((s) => s.at === N.probe)).toEqual([]);
  });
  it('a count of 0 for a type leaves that type behind', () => {
    const w = idle();
    addShips(w, N.probe, 2, 'drone');
    addShips(w, N.probe, 2, 'flak');
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.a5, counts: counts(0, 0, 1) }]);
    expect(w.ships.filter((s) => s.transit !== null).map((s) => s.type)).toEqual(['flak']);
  });
  it('travel time is ceil(length / ship.speedSu) for every type, and the ship arrives `at` the target', () => {
    const w = idle();
    addShips(w, N.probe, 1, 'lancer');
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.heart, counts: counts(0, 1, 0) }]);
    const ship = w.ships[0]!;
    expect(ship.transit!.totalTicks).toBe(240); // ceil(960 / 4)
    expect(ship.transit!.ticksLeft).toBe(239); // decremented on the send tick (rule 6)
    run(w, 238);
    expect(ship.transit).not.toBeNull();
    run(w, 1);
    expect(ship.at).toBe(N.heart);
  });
  it('counts a wave only when sending to a living guarded node (pocket, Root or heart)', () => {
    const w = idle();
    addShips(w, N.probe, 6);
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.a5, counts: counts(2, 0, 0) }]);
    expect(w.stats.wavesSent).toBe(0);
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.p3, counts: counts(1, 0, 0) }]);
    expect(w.stats.wavesSent).toBe(1);
    expect(guardian(w, N.p3).wavesSent).toBe(1);
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.root, counts: counts(1, 0, 0) }]);
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.heart, counts: counts(1, 0, 0) }]);
    expect(w.stats.wavesSent).toBe(3);
    const c = captured(w, N.p2);
    const before = c.stats.wavesSent;
    step(c, data, [{ type: 'sendShips', from: N.probe, to: N.p2, counts: counts(1, 0, 0) }]);
    expect(c.stats.wavesSent).toBe(before);
  });
  it('counts several attack orders on one node in one tick as one wave, but separate ticks separately', () => {
    const w = idle();
    addShips(w, N.probe, 3);
    addShips(w, N.a5, 3, 'flak');
    step(w, data, [
      { type: 'sendShips', from: N.probe, to: N.heart, counts: SEND_ALL },
      { type: 'sendShips', from: N.a5, to: N.heart, counts: SEND_ALL },
    ]);
    expect(w.stats.wavesSent).toBe(1);
    expect(heart(w).wavesSent).toBe(1);
    addShips(w, N.probe, 1);
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.heart, counts: SEND_ALL }]);
    expect(w.stats.wavesSent).toBe(2);
  });
  it('is invalid with from = to, a clamped total of 0, or bad counts', () => {
    const w = idle();
    expectIgnored(w, { type: 'sendShips', from: N.probe, to: N.heart, counts: SEND_ALL });
    addShips(w, N.probe, 2, 'drone');
    expectIgnored(w, { type: 'sendShips', from: N.probe, to: N.probe, counts: SEND_ALL });
    // Only drones here: asking for lancers and flak clamps to 0.
    expectIgnored(w, { type: 'sendShips', from: N.probe, to: N.heart, counts: counts(0, 3, 3) });
    expectIgnored(w, { type: 'sendShips', from: N.probe, to: N.heart, counts: counts(-1, 0, 0) });
    expectIgnored(w, { type: 'sendShips', from: N.probe, to: N.heart, counts: counts(1.5, 0, 0) });
    expectIgnored(w, { type: 'sendShips', from: N.probe, to: N.heart, counts: { drone: 1 } as unknown as ReturnType<typeof counts> });
    expectIgnored(w, { type: 'sendShips', from: N.probe, to: N.heart, count: 0 } as unknown as Input);
    expectIgnored(w, { type: 'sendShips', from: N.probe, to: 16, counts: SEND_ALL });
    expectApplied(w, { type: 'sendShips', from: N.probe, to: N.heart, counts: counts(5, 0, 0) });
  });
});

describe('setRally', () => {
  it('sets the rally node; new ships fly there at once', () => {
    const w = fresh();
    w.stock.ore = 100;
    step(w, data, [{ type: 'setRally', node: N.a5 }]);
    expect(w.rally).toBe(N.a5);
    run(w, 90);
    expect(w.ships[0]!.transit!.to).toBe(N.a5);
  });
  it('is invalid for a node out of range', () => {
    expectIgnored(fresh(), { type: 'setRally', node: 16 });
  });
});

describe('setTunable', () => {
  it('changes a sim tunable from that tick on', () => {
    const w = fresh();
    step(w, data, [{ type: 'setTunable', key: 'ship.flak.cost', value: 60 }]);
    expect(w.tun['ship.flak.cost']).toBe(60);
    expect(inputCost(w, { type: 'buildExtractor', node: N.a1 })).toBe(20);
  });
  it('rejects out-of-range and non-integer values', () => {
    const w = fresh();
    expectIgnored(w, { type: 'setTunable', key: 'ship.drone.cost', value: 61 });
    expectIgnored(w, { type: 'setTunable', key: 'ship.drone.cost', value: 4 });
    expectIgnored(w, { type: 'setTunable', key: 'ship.drone.cost', value: 15.5 });
    expectIgnored(w, { type: 'setTunable', key: 'guard.capPct', value: 24 });
    expectApplied(w, { type: 'setTunable', key: 'guard.capPct', value: 300 });
  });
  it('rejects stats.*, client.*, map.*, tickRate and unknown keys', () => {
    const w = fresh();
    expectIgnored(w, { type: 'setTunable', key: 'stats.throughputWindowSec', value: 60 });
    expectIgnored(w, { type: 'setTunable', key: 'client.autosaveSec', value: 10 });
    for (const key of ['map.nodes', 'tickRate', 'ship.warp', 'ship.cost', 'root.capBonus']) {
      expectIgnored(w, { type: 'setTunable', key: key as 'ship.drone.cost', value: 1 });
    }
  });
});

it('an unknown input type is ignored', () => {
  expectIgnored(fresh(), { type: 'boost' } as unknown as Input);
});
