import { describe, expect, it } from 'vitest';
import { guardianStatus, isValidInput, step, type World } from '@factory4x/sim';
// H4: an H3 game is The Deep from a constructed campaign (createWorld starts on the overworld).
import { h3World } from '../../sim/test/h3-world.ts';
// The frozen v4 test fixture: these tests pin the shared rules' numbers (need, power, thresholds), so they don't move with calibration.
import { fixtureData as data } from '../../sim/test/fixture.ts';
import { firstDoor, fleetPower, guardNeed, nextEconomyOrder, nextTarget, nodeFinished, readyToAttack, strategies } from '../src/strategies.ts';

const N = { probe: 0, a1: 1, a2: 2, a3: 3, a4: 4, a5: 5, p1: 10, p2: 11, p3: 12, p4: 13, root: 14, heart: 15 } as const;
/** Seed 0 is Frost Gate. */
const fresh = (): World => h3World(0, data);
const by = (name: string) => strategies.find((s) => s.name === name)!;

describe('economy planner', () => {
  it('orders the first extractor, then the route, then more extractors', () => {
    const w = fresh();
    expect(nextEconomyOrder(w, N.a1)).toEqual({ type: 'buildExtractor', node: N.a1 });
    w.nodes[N.a1]!.extractors = 1;
    expect(nextEconomyOrder(w, N.a1)).toEqual({ type: 'buildRoute', from: N.a1, to: N.probe });
    w.routes.push({ id: 99, from: N.a1, to: N.probe, length: 262, level: 1, cooldown: 0, pods: [] });
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
    w.nodes[N.a5]!.extractors = 3;
    w.tun['extractor.orePerMin'] = 40;
    w.routes.push({ id: 99, from: N.a5, to: N.probe, length: 300, level: 5, cooldown: 0, pods: [] });
    expect(nextEconomyOrder(w, N.a5)).toBeNull();
    expect(nodeFinished(w, N.a5)).toBe(true);
  });
});

describe('H3 strategies', () => {
  it('are the spec four, none a stub', () => {
    expect(strategies.map((s) => [s.name, s.stub === true])).toEqual([
      ['drones-only', false],
      ['ice-first', false],
      ['crystal-first', false],
      ['greedy', false],
    ]);
  });

  it('firstDoor is the light pocket with that prize in every layout, and null once it is dead', () => {
    for (let seed = 0; seed < 3; seed++) {
      const w = h3World(seed, data);
      for (const prize of ['ice', 'crystal'] as const) {
        const n = firstDoor(w, prize)!;
        expect(w.nodes[n]!.kind).toBe('pocket');
        expect(w.nodes[n]!.slots).toBe(2);
        expect(w.nodes[n]!.prize).toBe(prize);
        w.guardians.find((g) => g.node === n)!.alive = false;
        expect(firstDoor(w, prize)).toBeNull();
      }
    }
  });

  it('estimate need as Σ capEff × hp, and power with the weighted counter multiplier', () => {
    const w = fresh();
    expect(guardNeed(w, N.p1)).toBe(1 * 20 + 8 * 6);
    expect(guardNeed(w, N.heart)).toBe(10 * 20 + 14 * 6);
    // Frost Gate p2 (3/3): lancer multiplier 159 → 4 × 4 × 159 / 100 = 25; drones 10 × 2 = 20.
    expect(fleetPower(w, N.p2, { drone: 0, lancer: 4, flak: 0 })).toBe(25);
    expect(fleetPower(w, N.p2, { drone: 10, lancer: 0, flak: 0 })).toBe(20);
  });

  it('pick the lowest need / prize weight, the heart only when it is the last', () => {
    const w = fresh();
    // Frost Gate: p1 68/2 = 34, p2 78/2 = 39, p3 204/3 = 68, p4 148/3 = 49.3, Root 120/2 = 60.
    expect(nextTarget(w)).toBe(N.p1);
    for (const g of w.guardians) if (g.node !== N.heart) g.alive = false;
    expect(nextTarget(w)).toBe(N.heart);
  });

  it('attack when power × 3 ≥ need + 20, raising the bar by 5/4 per wave already sent there', () => {
    const w = fresh();
    const need = guardNeed(w, N.p1); // 68 → 88
    expect(readyToAttack(w, N.p1, 29)).toBe(false);
    expect(readyToAttack(w, N.p1, 30)).toBe(true);
    w.guardians.find((g) => g.node === N.p1)!.wavesSent = 1; // 110
    expect(readyToAttack(w, N.p1, 36)).toBe(false);
    expect(readyToAttack(w, N.p1, 37)).toBe(true);
    expect(guardianStatus(w, N.p1).guards.thorn.cap * 20 + guardianStatus(w, N.p1).guards.spore.cap * 6).toBe(need);
  });

  for (const name of ['drones-only', 'ice-first', 'crystal-first', 'greedy']) {
    it(`${name}: only issues inputs the sim accepts, and keeps its yards as described`, () => {
      const w = fresh();
      let flakSeen = false;
      for (let i = 0; i < 30 * 60 * 14; i++) {
        const inputs = by(name).decide(w);
        for (const input of inputs) expect(isValidInput(w, data, input), `${w.tick} ${JSON.stringify(input)}`).toBe(true);
        step(w, data, inputs);
        if (w.yards.flak.on || w.yards.lancer.on) flakSeen = true;
      }
      expect(flakSeen).toBe(name !== 'drones-only');
      expect(w.stats.captures.length).toBeGreaterThan(0);
    });
  }
});

describe('first door', () => {
  /** Run until the first guarded node is captured; return that node's prize. */
  function firstCapturePrize(name: string, seed: number): string | null {
    const w = h3World(seed, data);
    for (let i = 0; i < 30 * 60 * 14 && w.stats.captures.length === 0; i++) step(w, data, by(name).decide(w));
    const c = w.stats.captures[0];
    return c ? (w.nodes[c.node]!.prize ?? null) : null;
  }

  it('ice-first takes the ice pocket and crystal-first the crystal pocket first, in every layout', () => {
    for (const seed of [0, 1, 2]) {
      expect(firstCapturePrize('ice-first', seed), `ice-first seed ${seed}`).toBe('ice');
      expect(firstCapturePrize('crystal-first', seed), `crystal-first seed ${seed}`).toBe('crystal');
    }
  });

  it('runs flak only once ice has arrived and lancers only once crystal has', () => {
    const w = h3World(0, data);
    for (let i = 0; i < 30 * 60 * 12; i++) {
      step(w, data, by('ice-first').decide(w));
      const f = w.stats.firstDeliveredTick;
      if (f.crystal === null) expect(w.yards.lancer.on).toBe(false);
      if (f.ice === null) expect(w.yards.flak.on).toBe(false);
    }
    expect(w.yards.flak.on).toBe(true);
  });
});
