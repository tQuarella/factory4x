import { describe, expect, it } from 'vitest';
import { createWorld, defaultData, isValidInput, step, type Input, type World } from '@factory4x/sim';
import { nextEconomyOrder, nodeFinished, rushDecide, strategies, turtleDecide } from '../src/strategies.ts';

const N = { probe: 0, a1: 1, a2: 2, a3: 3, a4: 4, a5: 5, rich: 6 } as const;
const fresh = (): World => createWorld(1, defaultData);

/** Park `count` new ships at `node` (hand-built state: ships are plain data). */
function parkShips(world: World, node: number, count: number): void {
  for (let i = 0; i < count; i++) world.ships.push({ id: world.nextId++, hp: 10, at: node, transit: null, engagedIn: -1 });
}

const networkDone = (x: World): boolean => [N.a1, N.a2, N.a3, N.a4, N.a5].every((id) => nodeFinished(x, id));

/** Plays a strategy until `pred` holds. */
function playUntil(world: World, decide: (w: World) => Input[], pred: (w: World) => boolean, max: number): void {
  for (let i = 0; i < max && !pred(world); i++) step(world, defaultData, decide(world));
  if (!pred(world)) throw new Error('condition not met');
}

describe('economy planner', () => {
  it('orders the first extractor, then the route, then more extractors', () => {
    const w = fresh();
    expect(nextEconomyOrder(w, N.a1)).toEqual({ type: 'buildExtractor', node: N.a1 });
    w.nodes[N.a1]!.extractors = 1;
    expect(nextEconomyOrder(w, N.a1)).toEqual({ type: 'buildRoute', from: N.a1, to: N.probe });
    w.routes.push({ id: 99, from: N.a1, to: N.probe, length: 247, level: 1, cooldown: 0, pods: [] });
    expect(nextEconomyOrder(w, N.a1)).toEqual({ type: 'buildExtractor', node: N.a1 });
  });

  it('orders nothing while an order is waiting in the queue', () => {
    const w = fresh();
    w.queue.push({ kind: 'extractor', node: N.a1, cost: 20 });
    expect(nextEconomyOrder(w, N.a1)).toBeNull();
  });

  it('upgrades the route when extraction exceeds capacity, then is finished', () => {
    const w = fresh();
    w.nodes[N.a2]!.extractors = 3; // 30 ore/min against a level 1 route (20/min)
    w.routes.push({ id: 99, from: N.a2, to: N.probe, length: 300, level: 1, cooldown: 0, pods: [] });
    expect(nextEconomyOrder(w, N.a2)).toEqual({ type: 'upgradeRoute', from: N.a2 });
    expect(nodeFinished(w, N.a2)).toBe(false);
    w.routes[0]!.level = 2;
    expect(nextEconomyOrder(w, N.a2)).toBeNull();
    expect(nodeFinished(w, N.a2)).toBe(true);
  });

  it('does not upgrade past max level', () => {
    const w = fresh();
    w.nodes[N.a5]!.extractors = 4;
    w.tun['extractor.orePerMin'] = 40;
    w.routes.push({ id: 99, from: N.a5, to: N.probe, length: 300, level: 5, cooldown: 0, pods: [] });
    expect(nextEconomyOrder(w, N.a5)).toBeNull();
    expect(nodeFinished(w, N.a5)).toBe(true);
  });
});

describe('rush', () => {
  it('starts a1 at tick 0 with the yard on and rally at the probe', () => {
    const w = fresh();
    expect(rushDecide(w)).toEqual([{ type: 'buildExtractor', node: N.a1 }]);
    w.shipyard.on = false;
    w.rally = N.a5;
    const inputs = rushDecide(w);
    expect(inputs).toContainEqual({ type: 'setShipyard', on: true });
    expect(inputs).toContainEqual({ type: 'setRally', node: N.probe });
  });

  it('sends the first wave at 6 ships, not before', () => {
    const w = fresh();
    parkShips(w, N.probe, 5);
    expect(rushDecide(w).some((i) => i.type === 'sendShips')).toBe(false);
    parkShips(w, N.probe, 1);
    expect(rushDecide(w)).toContainEqual({ type: 'sendShips', from: N.probe, to: N.rich, count: 0 });
  });

  it('raises the wave by 6 for each wave already sent', () => {
    const w = fresh();
    w.stats.wavesSent = 2; // next wave is 6 + 12 = 18
    parkShips(w, N.probe, 17);
    expect(rushDecide(w).some((i) => i.type === 'sendShips')).toBe(false);
    parkShips(w, N.probe, 1);
    expect(rushDecide(w).some((i) => i.type === 'sendShips')).toBe(true);
  });

  it('does not send while ships are at or heading to the rich node', () => {
    const w = fresh();
    parkShips(w, N.probe, 12);
    parkShips(w, N.rich, 1);
    expect(rushDecide(w).some((i) => i.type === 'sendShips')).toBe(false);
  });

  it('stops attacking and builds out the rich node after capture', () => {
    const w = fresh();
    w.capturedTick = 100;
    w.nodes[N.rich]!.owned = true;
    parkShips(w, N.probe, 20);
    const inputs = rushDecide(w);
    expect(inputs.some((i) => i.type === 'sendShips')).toBe(false);
    expect(inputs).toContainEqual({ type: 'buildExtractor', node: N.rich });
  });

  it('only issues inputs the sim accepts', () => {
    const w = fresh();
    for (let i = 0; i < 6000; i++) {
      const inputs = rushDecide(w);
      for (const input of inputs) expect(isValidInput(w, defaultData, input), JSON.stringify(input)).toBe(true);
      step(w, defaultData, inputs);
    }
  });
});

describe('turtle', () => {
  it('turns the yard off and starts a1 at tick 0', () => {
    const w = fresh();
    expect(turtleDecide(w)).toEqual([
      { type: 'setShipyard', on: false },
      { type: 'buildExtractor', node: N.a1 },
    ]);
  });

  it('keeps the yard off, then turns it on and rallies at a5 when the network is done', () => {
    const w = fresh();
    playUntil(w, turtleDecide, networkDone, 30 * 60 * 15);
    expect(w.stats.shipsBuilt).toBe(0);
    for (const id of [N.a1, N.a2, N.a3, N.a4, N.a5]) expect(nodeFinished(w, id)).toBe(true);
    step(w, defaultData, turtleDecide(w));
    expect(w.rally).toBe(N.a5);
  });

  it('sends the wave at 32 ships at a5, not at 31', () => {
    const w = fresh();
    playUntil(w, turtleDecide, networkDone, 30 * 60 * 15);
    w.ships.length = 0;
    parkShips(w, N.a5, 31);
    expect(turtleDecide(w).some((i) => i.type === 'sendShips')).toBe(false);
    parkShips(w, N.a5, 1);
    expect(turtleDecide(w)).toContainEqual({ type: 'sendShips', from: N.a5, to: N.rich, count: 0 });
  });

  it('waits for 32 again after a repelled wave', () => {
    const w = fresh();
    playUntil(w, turtleDecide, networkDone, 30 * 60 * 15);
    w.ships.length = 0;
    w.stats.wavesSent = 1;
    parkShips(w, N.a5, 5);
    expect(turtleDecide(w).some((i) => i.type === 'sendShips')).toBe(false);
  });
});

describe('stubs', () => {
  it('greedy-expansion and raid-supply are labelled stubs that issue nothing', () => {
    const stubs = strategies.filter((s) => s.stub);
    expect(stubs.map((s) => s.name)).toEqual(['greedy-expansion', 'raid-supply']);
    for (const s of stubs) {
      expect(s.description).toContain('STUB');
      expect(s.decide(fresh())).toEqual([]);
    }
  });
});
