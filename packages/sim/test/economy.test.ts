import { describe, expect, it } from 'vitest';
import {
  assemblerStatus,
  nodeDistance,
  nodeStatus,
  prizePerMin,
  runSummary,
  step,
  throughputPerMin,
  unlockStatus,
  yardStatus,
  type World,
} from '../src/index.ts';
import { N, addShips, data, guardian, idle, run, runUntil } from './helpers.ts';

/** DESIGN.md H3 rules 5a (assemblers), 5b (yards), 3-4 for pockets, and the unlocks. */

const state = (w: World, c: 'lens' | 'plating') => assemblerStatus(w).find((a) => a.component === c)!.state;
const yard = (w: World, t: 'drone' | 'lancer' | 'flak') => yardStatus(w).yards.find((y) => y.type === t)!;

describe('rule 5a: assemblers', () => {
  it('make a lens from 5 ore + 4 crystal in component.buildTicks, then start the next while inputs last', () => {
    const w = idle();
    w.stock.ore = 100;
    w.stock.crystal = 8;
    step(w, data, []); // tick 0: starts
    expect(w.assemblers.lens.ticksLeft).toBe(90);
    expect(w.stock).toMatchObject({ ore: 95, crystal: 4, lens: 0 });
    expect(state(w, 'lens')).toBe('making');
    run(w, 89);
    expect(w.stock.lens).toBe(0);
    run(w, 1); // tick 90: done, and the second starts the same tick
    expect(w.stock).toMatchObject({ ore: 90, crystal: 0, lens: 1 });
    expect(w.assemblers.lens.ticksLeft).toBe(90);
    run(w, 90);
    expect(w.stock.lens).toBe(2);
    expect(state(w, 'lens')).toBe('needsInput');
    expect(w.stats.componentsBuilt).toEqual({ lens: 2, plating: 0 });
    expect(w.stats.oreSpentComponents).toBe(10);
  });

  it('plating uses ice; lens goes before plating when ore is short', () => {
    const w = idle();
    w.stock.ore = 5;
    w.stock.crystal = 4;
    w.stock.ice = 4;
    step(w, data, []);
    expect(w.assemblers.lens.ticksLeft).toBe(90);
    expect(w.assemblers.plating.ticksLeft).toBe(0);
    expect(state(w, 'plating')).toBe('needsOre');
    w.stock.ore = 5;
    step(w, data, []);
    expect(w.assemblers.plating.ticksLeft).toBe(90);
    expect(w.stock).toMatchObject({ ore: 0, ice: 0 });
  });

  it('queued builds reserve their ore ahead of the assemblers', () => {
    const w = idle();
    w.activeBuild = { kind: 'extractor', node: N.a3, ticksLeft: 1000 };
    w.queue.push({ kind: 'extractor', node: N.a1, cost: 20 });
    w.stock.ore = 24; // 4 free < 5
    w.stock.crystal = 4;
    step(w, data, []);
    expect(w.assemblers.lens.ticksLeft).toBe(0);
    expect(state(w, 'lens')).toBe('needsOre');
    w.stock.ore = 25;
    step(w, data, []);
    expect(w.assemblers.lens.ticksLeft).toBe(90);
    expect(w.stock.ore).toBe(20);
  });

  it('stop at component.stockCap ("full"), and resume below it', () => {
    const w = idle();
    w.stock.ore = 100;
    w.stock.crystal = 40;
    w.stock.lens = 5;
    step(w, data, []);
    expect(w.assemblers.lens.ticksLeft).toBe(0);
    expect(state(w, 'lens')).toBe('full');
    w.tun['component.stockCap'] = 6;
    expect(state(w, 'lens')).toBe('ready');
    step(w, data, []);
    expect(state(w, 'lens')).toBe('making');
  });

  it('run before the yards: they take ore first', () => {
    const w = idle();
    w.yards.drone.on = true;
    w.stock.ore = 19;
    w.stock.ice = 4;
    step(w, data, []);
    expect(w.assemblers.plating.ticksLeft).toBe(90);
    expect(w.yards.drone.ticksLeft).toBe(0); // 14 left < 15
    expect(yard(w, 'drone').state).toBe('needsOre');
  });

  it('component recipes are live tunables', () => {
    const w = idle();
    w.tun['component.plating.ore'] = 0;
    w.tun['component.plating.ice'] = 1;
    w.tun['component.buildTicks'] = 15;
    w.stock.ice = 1;
    step(w, data, []);
    expect(w.assemblers.plating.ticksLeft).toBe(15);
    expect(w.stock.ice).toBe(0);
    expect(assemblerStatus(w).find((a) => a.component === 'plating')).toMatchObject({ ore: 0, input: 'ice', inputAmount: 1, totalTicks: 15 });
  });
});

describe('rule 5b: yards', () => {
  it('resolve lancer, flak, drone: with ore for two, the drone waits', () => {
    const w = idle();
    for (const t of ['drone', 'lancer', 'flak'] as const) w.yards[t].on = true;
    w.stock = { ore: 30, ice: 0, crystal: 0, lens: 1, plating: 1 };
    step(w, data, []);
    expect([yard(w, 'lancer').state, yard(w, 'flak').state, yard(w, 'drone').state]).toEqual(['building', 'building', 'needsOre']);
    expect(w.stock).toEqual({ ore: 0, ice: 0, crystal: 0, lens: 0, plating: 0 });
    expect(w.stats.oreSpentShips).toBe(30);
  });

  it('ships finishing on the same tick spawn in yard order, with their type hp', () => {
    const w = idle();
    for (const t of ['drone', 'lancer', 'flak'] as const) {
      w.yards[t].on = true;
      w.tun[`ship.${t}.buildTicks`] = 30;
    }
    w.stock = { ore: 45, ice: 0, crystal: 0, lens: 1, plating: 1 };
    run(w, 31);
    expect(w.ships.map((s) => [s.type, s.hp])).toEqual([
      ['lancer', 12],
      ['flak', 12],
      ['drone', 10],
    ]);
    expect(w.stats.shipsBuilt).toEqual({ drone: 1, lancer: 1, flak: 1 });
  });

  it('component scarcity: lancers and flak never start without a component, however much ore there is', () => {
    const w = idle();
    w.yards.lancer.on = true;
    w.yards.flak.on = true;
    w.yards.drone.on = true;
    w.tun['economy.probeOrePerMin'] = 60;
    w.stock.ore = 1000;
    for (let i = 0; i < 3000; i++) {
      step(w, data, []);
      expect(w.yards.lancer.ticksLeft).toBe(0);
      expect(w.yards.flak.ticksLeft).toBe(0);
    }
    expect(w.ships.every((s) => s.type === 'drone')).toBe(true);
    expect(yard(w, 'lancer').state).toBe('needsComponent');
    expect(yard(w, 'flak').state).toBe('needsComponent');
    // One lens appears: one lancer starts and takes it; the flak yard still waits.
    w.stock.lens = 1;
    step(w, data, []);
    expect(w.yards.lancer.ticksLeft).toBe(120);
    expect(w.stock.lens).toBe(0);
    expect(w.yards.flak.ticksLeft).toBe(0);
  });

  it('component before ore in the status line, and every yard state', () => {
    const w = idle();
    expect(yard(w, 'drone').state).toBe('off');
    w.yards.lancer.on = true;
    expect(yard(w, 'lancer').state).toBe('needsComponent'); // no lens and no ore
    w.stock.lens = 1;
    expect(yard(w, 'lancer').state).toBe('needsOre');
    w.stock.ore = 15;
    expect(yard(w, 'lancer')).toMatchObject({ state: 'ready', cost: 15, component: 'lens', hp: 12, damage: 4, totalTicks: 120 });
    step(w, data, []);
    expect(yard(w, 'lancer')).toMatchObject({ state: 'building', ticksLeft: 120 });
    // Turning a yard off lets its ship finish.
    step(w, data, [{ type: 'setShipyard', shipType: 'lancer', on: false }]);
    expect(yard(w, 'lancer').state).toBe('building');
    run(w, 118); // ticks 2..119
    expect(w.ships).toEqual([]);
    run(w, 1); // tick 120
    expect(w.ships.map((s) => s.type)).toEqual(['lancer']);
    expect(yard(w, 'lancer').state).toBe('off');
  });

  it('new ships fly to the rally point, whatever their type', () => {
    const w = idle();
    w.yards.flak.on = true;
    w.stock.ore = 15;
    w.stock.plating = 1;
    step(w, data, [{ type: 'setRally', node: N.a5 }]);
    run(w, 120);
    expect(w.ships[0]).toMatchObject({ type: 'flak', at: null });
    expect(w.ships[0]!.transit!.to).toBe(N.a5);
  });
});

describe('pockets: capture, then the prize flows once routed', () => {
  /** Frost Gate p1 (ice, 2 slots) captured by hand. */
  function capturedP1(): World {
    const w = idle();
    guardian(w, N.p1).guards = [];
    addShips(w, N.p1, 1);
    step(w, data, []);
    return w;
  }

  it('capture owns the pocket with pocket.freeExtractors (capped at its slots) and records the capture', () => {
    const w = capturedP1();
    expect(guardian(w, N.p1).alive).toBe(false);
    expect(w.nodes[N.p1]).toMatchObject({ owned: true, extractors: 1, slots: 2, prize: 'ice' });
    expect(w.stats.captures).toEqual([{ node: N.p1, tick: 0 }]);
    expect(w.lastBattle).toMatchObject({ node: N.p1, outcome: 'captured', shipsEngaged: 1, engagedByType: { drone: 1, lancer: 0, flak: 0 } });
    expect(w.capturedTick).toBeNull(); // only the heart ends the run
    const many = idle();
    many.tun['pocket.freeExtractors'] = 3;
    guardian(many, N.p1).guards = [];
    addShips(many, N.p1, 1);
    step(many, data, []);
    expect(many.nodes[N.p1]!.extractors).toBe(2);
    const none = idle();
    none.tun['pocket.freeExtractors'] = 0;
    guardian(none, N.p1).guards = [];
    addShips(none, N.p1, 1);
    step(none, data, []);
    expect(none.nodes[N.p1]!.extractors).toBe(0);
  });

  it('without a route the prize piles up in the buffer at pocket.resourcePerMin per extractor', () => {
    const w = capturedP1();
    run(w, 1800);
    expect(w.nodes[N.p1]!.buffer).toBe(6);
    expect(w.stock.ice).toBe(0);
    expect(nodeStatus(w, N.p1)).toMatchObject({ prize: 'ice', perExtractorPerMin: 6, extractPerMin: 6, noRoute: true });
    expect(unlockStatus(w).ships.flak).toBe(false);
  });

  it('once routed, pods carry ice to stock.ice: ice buckets, not the ore headline; flak and plating unlock; plating starts', () => {
    const w = capturedP1();
    w.stock.ore = 100;
    step(w, data, [{ type: 'buildRoute', from: N.p1, to: N.probe }]);
    expect(w.activeBuild).toMatchObject({ kind: 'route', node: N.p1 });
    runUntil(w, (x) => x.stats.firstDeliveredTick.ice !== null, 3000);
    const route = w.routes.find((r) => r.from === N.p1)!;
    expect(route.length).toBe(nodeDistance(w, N.p1, N.probe));
    expect(w.stats.delivered).toEqual({ ore: 0, ice: 1, crystal: 0 });
    expect(throughputPerMin(w)).toBe(0);
    expect(prizePerMin(w)).toEqual({ ice: 1, crystal: 0 });
    expect(unlockStatus(w)).toEqual({
      resources: { ore: true, ice: true, crystal: false, lens: false, plating: true },
      ships: { drone: true, lancer: false, flak: true },
    });
    // 4 ice → the first plating starts.
    runUntil(w, (x) => x.assemblers.plating.ticksLeft > 0, 3000);
    expect(w.stock.ice).toBeLessThan(4);
    // Steady state: one extractor, 6 ice/min.
    run(w, 1800 * 3);
    expect(prizePerMin(w).ice).toBeGreaterThanOrEqual(5);
    expect(prizePerMin(w).ice).toBeLessThanOrEqual(7);
    expect(runSummary(w).firstDeliveredSec.ice).not.toBeNull();
  });

  it('a crystal pocket unlocks crystal, lens and lancers', () => {
    const w = idle();
    w.stats.firstDeliveredTick.crystal = 10;
    expect(unlockStatus(w).ships).toEqual({ drone: true, lancer: true, flak: false });
    expect(unlockStatus(w).resources).toMatchObject({ crystal: true, lens: true, ice: false, plating: false });
    expect(yardStatus(w).yards.map((y) => [y.type, y.unlocked])).toEqual([
      ['drone', true],
      ['lancer', true],
      ['flak', false],
    ]);
    expect(assemblerStatus(w).map((a) => [a.component, a.unlocked])).toEqual([
      ['lens', true],
      ['plating', false],
    ]);
  });
});
