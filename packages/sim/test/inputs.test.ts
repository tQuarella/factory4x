import { describe, expect, it } from 'vitest';
import { inputCost, isValidInput, step, worldHash, type Input, type World } from '../src/index.ts';
import { N, addShips, bloom, clone, data, fresh, run } from './helpers.ts';

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

/** A world with no stock and the yard off, so queued orders stay queued. */
function idle(): World {
  const w = fresh();
  w.stock = 0;
  w.shipyard.on = false;
  w.tun['economy.probeOrePerMin'] = 0;
  return w;
}

/** Captures the rich node by hand (test setup). */
function captured(w: World): World {
  bloom(w).thorns = [];
  addShips(w, N.rich, 1);
  step(w, data, []);
  expect(w.capturedTick).not.toBeNull();
  return w;
}

describe('buildExtractor', () => {
  it('queues on an asteroid at extractor.cost', () => {
    const w = idle();
    expectApplied(w, { type: 'buildExtractor', node: N.a1 });
    step(w, data, [{ type: 'buildExtractor', node: N.a1 }]);
    expect(w.queue).toEqual([{ kind: 'extractor', node: N.a1, cost: 20 }]);
  });
  it('is invalid on the probe and on the rich node before capture', () => {
    const w = idle();
    expectIgnored(w, { type: 'buildExtractor', node: N.probe });
    expectIgnored(w, { type: 'buildExtractor', node: N.rich });
  });
  it('is valid on the rich node after capture', () => {
    const w = captured(idle());
    expectApplied(w, { type: 'buildExtractor', node: N.rich });
  });
  it('counts built, active and queued extractors against the slots', () => {
    const w = idle();
    w.nodes[N.a2]!.extractors = 1; // built
    w.activeBuild = { kind: 'extractor', node: N.a2, ticksLeft: 100 }; // active
    w.queue.push({ kind: 'extractor', node: N.a2, cost: 20 }); // queued
    expectIgnored(w, { type: 'buildExtractor', node: N.a2 }); // a2 has 3 slots
    w.queue.pop();
    expectApplied(w, { type: 'buildExtractor', node: N.a2 });
  });
  it('is invalid when the queue is full', () => {
    const w = idle();
    for (let i = 0; i < 4; i++) w.queue.push({ kind: 'extractor', node: N.a5, cost: 20 });
    expectIgnored(w, { type: 'buildExtractor', node: N.a3 });
  });
  it('is invalid for a node index out of range or not an integer', () => {
    const w = idle();
    expectIgnored(w, { type: 'buildExtractor', node: 8 });
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
    expect(costs).toEqual([9, 10, 15, 15, 17]);
    step(w, data, [{ type: 'buildRoute', from: N.a1, to: N.probe }]);
    step(w, data, [{ type: 'setTunable', key: 'route.costBase', value: 50 }]);
    expect(w.queue[0]!.cost).toBe(9);
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
    w.queue.push({ kind: 'route', node: N.a1, cost: 9 });
    expectIgnored(w, { type: 'buildRoute', from: N.a1, to: N.probe });
    w.queue = [];
    w.activeBuild = { kind: 'route', node: N.a1, ticksLeft: 5 };
    expectIgnored(w, { type: 'buildRoute', from: N.a1, to: N.probe });
    w.activeBuild = null;
    w.routes.push({ id: w.nextId++, from: N.a1, to: N.probe, length: 247, level: 1, cooldown: 0, pods: [] });
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
    w.stock = 5;
    step(w, data, [
      { type: 'buildExtractor', node: N.a1 },
      { type: 'buildExtractor', node: N.a2 },
    ]);
    expectIgnored(w, { type: 'cancelBuild', index: 2 });
    expectIgnored(w, { type: 'cancelBuild', index: -1 });
    step(w, data, [{ type: 'cancelBuild', index: 0 }]);
    expect(w.queue).toEqual([{ kind: 'extractor', node: N.a2, cost: 20 }]);
    expect(w.stock).toBe(5);
  });
});

describe('setShipyard', () => {
  it('turns production off; a ship in progress still finishes', () => {
    const w = fresh();
    w.stock = 100;
    step(w, data, []);
    expect(w.shipyard.ticksLeft).toBe(90);
    step(w, data, [{ type: 'setShipyard', on: false }]);
    run(w, 89);
    expect(w.ships.length).toBe(1);
    expect(w.shipyard.ticksLeft).toBe(0);
    run(w, 200);
    expect(w.ships.length).toBe(1);
  });
  it('rejects a non-boolean', () => {
    expectIgnored(fresh(), { type: 'setShipyard', on: 1 as unknown as boolean });
  });
});

describe('sendShips', () => {
  it('moves the lowest-id `count` ships; count 0 sends all', () => {
    const w = idle();
    addShips(w, N.probe, 5);
    const ids = w.ships.map((s) => s.id);
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.a5, count: 2 }]);
    expect(w.ships.filter((s) => s.transit !== null).map((s) => s.id)).toEqual(ids.slice(0, 2));
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.a1, count: 0 }]);
    expect(w.ships.filter((s) => s.at === N.probe)).toEqual([]);
  });
  it('travel time is ceil(length / ship.speedSu), and the ship arrives `at` the target', () => {
    const w = idle();
    addShips(w, N.probe, 1);
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.rich, count: 1 }]);
    const ship = w.ships[0]!;
    expect(ship.transit!.totalTicks).toBe(238); // ceil(950 / 4)
    expect(ship.transit!.ticksLeft).toBe(237); // decremented on the send tick (rule 6)
    run(w, 236);
    expect(ship.transit).not.toBeNull();
    run(w, 1);
    expect(ship.at).toBe(N.rich);
  });
  it('counts a wave only when sending to the guarded rich node', () => {
    const w = idle();
    addShips(w, N.probe, 4);
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.a5, count: 2 }]);
    expect(w.stats.wavesSent).toBe(0);
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.rich, count: 1 }]);
    expect(w.stats.wavesSent).toBe(1);
  });
  it('counts several attack orders applied in one tick as one wave, but separate ticks separately', () => {
    const w = idle();
    addShips(w, N.probe, 3);
    addShips(w, N.a5, 3);
    step(w, data, [
      { type: 'sendShips', from: N.probe, to: N.rich, count: 0 },
      { type: 'sendShips', from: N.a5, to: N.rich, count: 0 },
    ]);
    expect(w.stats.wavesSent).toBe(1);
    addShips(w, N.probe, 1);
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.rich, count: 0 }]);
    expect(w.stats.wavesSent).toBe(2);
  });
  it('is invalid with from = to, no ships at from, or a bad count', () => {
    const w = idle();
    expectIgnored(w, { type: 'sendShips', from: N.probe, to: N.rich, count: 0 });
    addShips(w, N.probe, 2);
    expectIgnored(w, { type: 'sendShips', from: N.probe, to: N.probe, count: 0 });
    expectIgnored(w, { type: 'sendShips', from: N.probe, to: N.rich, count: -1 });
    expectIgnored(w, { type: 'sendShips', from: N.probe, to: 9, count: 1 });
    expectApplied(w, { type: 'sendShips', from: N.probe, to: N.rich, count: 5 });
  });
});

describe('setRally', () => {
  it('sets the rally node; new ships fly there at once', () => {
    const w = fresh();
    w.stock = 100;
    step(w, data, [{ type: 'setRally', node: N.a5 }]);
    expect(w.rally).toBe(N.a5);
    run(w, 90);
    expect(w.ships[0]!.transit!.to).toBe(N.a5);
  });
  it('is invalid for a node out of range', () => {
    expectIgnored(fresh(), { type: 'setRally', node: 8 });
  });
});

describe('setTunable', () => {
  it('changes a sim tunable from that tick on', () => {
    const w = fresh();
    step(w, data, [{ type: 'setTunable', key: 'ship.cost', value: 60 }]);
    expect(w.tun['ship.cost']).toBe(60);
    expect(inputCost(w, { type: 'buildExtractor', node: N.a1 })).toBe(20);
  });
  it('rejects out-of-range and non-integer values', () => {
    const w = fresh();
    expectIgnored(w, { type: 'setTunable', key: 'ship.cost', value: 61 });
    expectIgnored(w, { type: 'setTunable', key: 'ship.cost', value: 4 });
    expectIgnored(w, { type: 'setTunable', key: 'ship.cost', value: 15.5 });
  });
  it('rejects stats.*, client.*, map.*, tickRate and unknown keys', () => {
    const w = fresh();
    expectIgnored(w, { type: 'setTunable', key: 'stats.throughputWindowSec', value: 60 });
    expectIgnored(w, { type: 'setTunable', key: 'client.autosaveSec', value: 10 });
    for (const key of ['map.nodes', 'tickRate', 'ship.warp']) {
      expectIgnored(w, { type: 'setTunable', key: key as 'ship.cost', value: 1 });
    }
  });
});

it('an unknown input type is ignored', () => {
  expectIgnored(fresh(), { type: 'boost' } as unknown as Input);
});
