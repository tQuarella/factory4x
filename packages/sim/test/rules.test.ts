import { describe, expect, it } from 'vitest';
import {
  battleStatus,
  combatRates,
  guardianStatus,
  isCaptured,
  nodeDistance,
  nodeStatus,
  queueStatus,
  routeCapacityPerMin,
  runSummary,
  shipCounts,
  shipsPerMinX10,
  step,
  throughputPerMin,
  type World,
} from '../src/index.ts';
import { N, addShips, data, fresh, heart, idle, root, run, runUntil, setGuards } from './helpers.ts';

/**
 * H1 rules that H3 keeps (DESIGN.md H1 "Rules per tick"), on the H3 map.
 * Combat cases put twelve 20-hp Thorns on the heart and use drones, which is
 * exactly H1's fight, so the H1 numbers still hold.
 */

function addRoute(w: World, from: number, level = 1): void {
  w.routes.push({ id: w.nextId++, from, to: N.probe, length: nodeDistance(w, from, N.probe), level, cooldown: 0, pods: [] });
}

/** An idle world whose heart holds H1's twelve full Thorns. */
function h1Heart(): World {
  const w = idle();
  setGuards(w, N.heart, Array.from({ length: 12 }, () => ['thorn', 20] as const));
  return w;
}

describe('rule 3: extraction and buffer cap', () => {
  it('1 extractor at 10/min adds 1 ore every 180 ticks to the buffer', () => {
    const w = idle();
    w.nodes[N.a1]!.extractors = 1;
    run(w, 179);
    expect(w.nodes[N.a1]!.buffer).toBe(0);
    run(w, 1);
    expect(w.nodes[N.a1]!.buffer).toBe(1);
    run(w, 1800);
    expect(w.nodes[N.a1]!.buffer).toBe(11);
    expect(nodeStatus(w, N.a1)).toMatchObject({ prize: 'ore', extractPerMin: 10, perExtractorPerMin: 10 });
  });

  it('the buffer stops at node.bufferCap and extra ore is lost (backed up)', () => {
    const w = idle();
    w.nodes[N.a2]!.extractors = 3;
    w.nodes[N.a2]!.buffer = 39;
    run(w, 1800);
    expect(w.nodes[N.a2]!.buffer).toBe(40);
    expect(w.nodes[N.a2]!.accum).toBeLessThan(1800);
    expect(nodeStatus(w, N.a2)).toMatchObject({ backedUp: true, noRoute: true });
  });

  it('probe mining adds economy.probeOrePerMin to stock.ore only', () => {
    const w = fresh();
    w.stock.ore = 0;
    w.yards.drone.on = false;
    run(w, 1800);
    expect(w.stock).toEqual({ ore: 12, ice: 0, crystal: 0, lens: 0, plating: 0 });
  });
});

describe('rule 4: pods', () => {
  it('launch min(buffer, level × podOrePerLevel), travel ceil(length / podSpeedSu) ticks, then deliver to stock and the bucket', () => {
    const w = idle();
    w.nodes[N.a1]!.buffer = 5;
    addRoute(w, N.a1);
    step(w, data, []);
    const route = w.routes[0]!;
    expect(route.length).toBe(262);
    expect(route.pods).toEqual([{ res: 'ore', amount: 1, ticksLeft: 43 }]); // ceil(262/6) = 44, decremented on the launch tick
    expect(route.cooldown).toBe(90);
    expect(w.nodes[N.a1]!.buffer).toBe(4);
    run(w, 42);
    expect(w.stock.ore).toBe(0);
    run(w, 1);
    expect(w.stock.ore).toBe(1);
    expect(route.pods).toEqual([]);
    expect(w.stats.deliveredBuckets[1]).toBe(1); // delivered on tick 43, second 1
    expect(w.stats.delivered.ore).toBe(1);
    expect(w.stats.firstDeliveredTick.ore).toBe(43);
    // Next launch exactly podIntervalTicks after the first.
    run(w, 90 - 44); // ticks 44..89
    expect(route.pods.length).toBe(0);
    run(w, 1);
    expect(route.pods.length).toBe(1);
  });

  it('a higher level carries more per pod; capacity is 20/min per level at defaults', () => {
    const w = idle();
    w.nodes[N.a2]!.buffer = 10;
    addRoute(w, N.a2, 3);
    step(w, data, []);
    expect(w.routes[0]!.pods[0]!.amount).toBe(3);
    expect(routeCapacityPerMin(w, 1)).toBe(20);
    expect(nodeStatus(w, N.a2).route!.capacityPerMin).toBe(60);
  });

  it('nothing launches from an empty buffer', () => {
    const w = idle();
    addRoute(w, N.a1);
    run(w, 200);
    expect(w.routes[0]!.pods).toEqual([]);
    expect(w.routes[0]!.cooldown).toBe(0);
  });

  it('steady state: 1 route at L1 fed by 2 extractors delivers 20/min', () => {
    const w = idle();
    w.nodes[N.a1]!.extractors = 2;
    addRoute(w, N.a1);
    run(w, 1800 * 3);
    expect(throughputPerMin(w)).toBeGreaterThanOrEqual(19);
    expect(throughputPerMin(w)).toBeLessThanOrEqual(21);
  });
});

describe('rule 2: build queue', () => {
  it('pays the head when stock allows, builds one at a time FIFO, and applies after buildTicks', () => {
    const w = idle();
    w.stock.ore = 30;
    step(w, data, [
      { type: 'buildExtractor', node: N.a1 },
      { type: 'buildRoute', from: N.a1, to: N.probe },
      { type: 'buildExtractor', node: N.a1 },
    ]);
    expect(w.stock.ore).toBe(10);
    expect(w.activeBuild).toEqual({ kind: 'extractor', node: N.a1, ticksLeft: 300 });
    expect(w.queue.map((o) => o.kind)).toEqual(['route', 'extractor']);
    run(w, 299);
    expect(w.nodes[N.a1]!.extractors).toBe(0);
    run(w, 1);
    expect(w.nodes[N.a1]!).toMatchObject({ extractors: 1, owned: true });
    // The route (10) started the same tick; the second extractor (20) waits for ore.
    expect(w.activeBuild).toMatchObject({ kind: 'route', ticksLeft: 300 });
    expect(w.stock.ore).toBe(0);
    run(w, 300);
    expect(w.routes.map((r) => ({ from: r.from, level: r.level, length: r.length }))).toEqual([{ from: N.a1, level: 1, length: 262 }]);
    expect(w.activeBuild).toBeNull();
    expect(w.queue.length).toBe(1);
    expect(w.stats.oreSpentEconomy).toBe(30);
  });

  it('a head the stock cannot cover blocks cheaper orders behind it', () => {
    const w = idle();
    w.stock.ore = 10;
    w.nodes[N.a1]!.extractors = 1;
    step(w, data, [
      { type: 'buildExtractor', node: N.a2 },
      { type: 'buildRoute', from: N.a1, to: N.probe },
    ]);
    expect(w.activeBuild).toBeNull();
    expect(w.stock.ore).toBe(10);
  });

  it('queued orders reserve their ore ahead of the yards', () => {
    const w = idle();
    w.yards.drone.on = true;
    w.activeBuild = { kind: 'extractor', node: N.a3, ticksLeft: 1000 };
    w.stock.ore = 34;
    step(w, data, [{ type: 'buildExtractor', node: N.a1 }]); // reserves 20; 14 free < 15
    expect(w.yards.drone.ticksLeft).toBe(0);
    expect(queueStatus(w).reserved).toBe(20);
    w.stock.ore = 35;
    step(w, data, []);
    expect(w.yards.drone.ticksLeft).toBe(90);
    expect(w.stock.ore).toBe(20);
  });

  it('upgrades raise the route level', () => {
    const w = idle();
    w.stock.ore = 100;
    w.nodes[N.a2]!.extractors = 1;
    addRoute(w, N.a2);
    step(w, data, [{ type: 'upgradeRoute', from: N.a2 }]);
    run(w, 300);
    expect(w.routes[0]!.level).toBe(2);
  });
});

describe('rule 5b: the drone yard alone (H1 shipyard)', () => {
  it('builds one ship per ship.drone.buildTicks when ore is plentiful (20/min)', () => {
    const w = idle();
    w.yards.drone.on = true;
    w.stock.ore = 1000;
    run(w, 1801);
    expect(w.ships.length).toBe(20);
    expect(w.stats.shipsBuilt).toEqual({ drone: 20, lancer: 0, flak: 0 });
    expect(w.stats.firstShipTick).toBe(90);
    expect(w.ships.every((s) => s.at === N.probe && s.hp === 10 && s.type === 'drone')).toBe(true);
  });

  it('is limited by income otherwise: 60 ore/min at 15 per ship is 4 ships/min', () => {
    const w = idle();
    w.yards.drone.on = true;
    w.tun['economy.probeOrePerMin'] = 60;
    expect(shipsPerMinX10(w)).toBe(40);
    expect(shipsPerMinX10(w, 'lancer')).toBe(0); // off
    run(w, 1800 * 5);
    expect(w.ships.length).toBeGreaterThanOrEqual(19);
    expect(w.ships.length).toBeLessThanOrEqual(20);
    expect(w.stats.oreSpentShips).toBe(15 * (w.ships.length + (w.yards.drone.ticksLeft > 0 ? 1 : 0)));
  });
});

describe('rule 7: combat (drones against Thorns, as H1)', () => {
  it('resolves both sides at once from start-of-round counts; leftover damage is wasted on the last unit', () => {
    const w = h1Heart();
    addShips(w, N.heart, 3);
    step(w, data, []); // tick 0 is a round tick
    // Ships: 3 × 2 = 6 → thorn 1 at 14, repaired +2 → 16. Heart: 12 × 3 = 36 → all three ships (30 hp).
    expect(heart(w).guards.map((t) => t.hp)).toEqual([16, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20]);
    expect(w.ships).toEqual([]);
    expect(heart(w).battle).toBeNull();
    expect(w.lastBattle).toMatchObject({ node: N.heart, startTick: 0, endTick: 0, shipsEngaged: 3, shipsLost: 3, guardsKilled: 0, outcome: 'repelled', wilt: null });
    expect(w.lastBattle!.guardsAtStart).toEqual({ thorn: 12, spore: 0 });
    expect(w.lastBattle!.lostByType).toEqual({ drone: 3, lancer: 0, flak: 0 });
    expect(w.stats.shipsLost).toEqual({ drone: 3, lancer: 0, flak: 0 });
  });

  it('damage overflows to the next unit in id order', () => {
    const w = h1Heart();
    addShips(w, N.heart, 15);
    step(w, data, []);
    // Ships: 30 → thorn 1 dies (20), thorn 2 takes 10 → 10, +2 repair → 12. Heart (12 at round start): 36 → ships 1-3 die, ship 4 at 4.
    expect(heart(w).guards.length).toBe(11);
    expect(heart(w).guards[0]!.hp).toBe(12);
    expect(w.ships.length).toBe(12);
    expect(w.ships[0]!.hp).toBe(4);
    expect(battleStatus(w, N.heart)).toMatchObject({ startTick: 0, shipsPresent: 12, shipsEngaged: 15, shipsLost: 3, guardsKilled: 1, guards: { thorn: 11, spore: 0 } });
    expect(w.stats.guardsKilled).toEqual({ thorn: 1, spore: 0 });
  });

  it('fights only on round ticks, and counts each ship once per battle', () => {
    const w = h1Heart();
    w.tun['guard.thorn.damage'] = 0;
    run(w, 1); // tick 1
    addShips(w, N.heart, 2);
    run(w, 28); // ticks 1..28: no round
    expect(heart(w).battle).toBeNull();
    run(w, 1); // tick 29
    expect(heart(w).battle).toBeNull();
    run(w, 1); // tick 30: round
    expect(heart(w).battle).toMatchObject({ startTick: 30, shipsEngaged: 2 });
    run(w, 30);
    expect(heart(w).battle).toMatchObject({ startTick: 30, shipsEngaged: 2 });
    addShips(w, N.heart, 1, 'lancer');
    run(w, 30);
    expect(heart(w).battle!.shipsEngaged).toBe(3);
    expect(heart(w).battle!.engagedByType).toEqual({ drone: 2, lancer: 1, flak: 0 });
  });

  it('a battle ends "withdrew" when the ships leave', () => {
    const w = h1Heart();
    w.tun['guard.thorn.damage'] = 0;
    addShips(w, N.heart, 2);
    run(w, 5);
    expect(heart(w).battle).not.toBeNull();
    step(w, data, [{ type: 'sendShips', from: N.heart, to: N.a5, counts: { drone: 2, lancer: 0, flak: 0 } }]);
    expect(heart(w).battle).toBeNull();
    expect(w.lastBattle).toMatchObject({ outcome: 'withdrew', startTick: 0, endTick: 5, shipsLost: 0 });
  });

  it('wounded thorns repair on every round tick, fight or not, up to guard.thorn.hp', () => {
    const w = h1Heart();
    heart(w).guards[0]!.hp = 13;
    heart(w).guards[1]!.hp = 19;
    step(w, data, []); // tick 0
    expect(heart(w).guards.slice(0, 2).map((t) => t.hp)).toEqual([15, 20]);
    run(w, 29);
    expect(heart(w).guards[0]!.hp).toBe(15);
    run(w, 1);
    expect(heart(w).guards[0]!.hp).toBe(17);
  });

  it('combatRates gives kill rate vs regrowth in tenths per second', () => {
    const w = h1Heart();
    // 24 drones × 2 dmg / 20 hp per round, 1 round/s → 2.4/s. Regrowth: Frost Gate heart caps 10 Thorns (30/60 → 0.5/s) and 14 Spores (30/20 → 1.5/s).
    expect(combatRates(w, N.heart, { drone: 24, lancer: 0, flak: 0 })).toEqual({ killPerSecX10: 24, regrowPerSecX10: 20, regrowByTypeX10: { thorn: 5, spore: 15 } });
  });
});

describe('rule 9: regrowth (one type)', () => {
  it('adds a full-hp thorn every regrowTicks up to the cap, then holds progress at 0', () => {
    const w = idle(); // Frost Gate: the Root is 6 Thorns, no Spores
    root(w).guards = root(w).guards.slice(0, 4);
    const lastId = root(w).guards[3]!.id;
    run(w, 59);
    expect(root(w).guards.length).toBe(4);
    expect(guardianStatus(w, N.root).guards.thorn.regrowProgress).toBe(59);
    run(w, 1);
    expect(root(w).guards.length).toBe(5);
    expect(root(w).guards[4]).toMatchObject({ type: 'thorn', hp: 20 });
    expect(root(w).guards[4]!.id).toBeGreaterThan(lastId);
    run(w, 60);
    expect(root(w).guards.length).toBe(6);
    run(w, 600);
    expect(root(w).guards.length).toBe(6);
    expect(root(w).regrowProgress).toEqual({ thorn: 0, spore: 0 });
  });

  it('every guardian starts full at its caps', () => {
    const g = guardianStatus(fresh(), N.heart);
    expect(g).toMatchObject({ alive: true, total: 24, totalCap: 24 });
    expect(g.guards.thorn).toMatchObject({ count: 10, cap: 10, regrowProgress: 0 });
    expect(g.guards.spore).toMatchObject({ count: 14, cap: 14, regrowProgress: 0 });
  });
});

describe('rule 8: capture of the heart', () => {
  it('when the last guard falls with ships present: guardian dies, node owned with free extractors, battle captured', () => {
    const w = idle();
    setGuards(w, N.heart, [['thorn', 2]]);
    addShips(w, N.heart, 5);
    step(w, data, []);
    expect(isCaptured(w)).toBe(true);
    expect(heart(w).alive).toBe(false);
    expect(w.nodes[N.heart]).toMatchObject({ owned: true, extractors: 1 });
    expect(w.capturedTick).toBe(0);
    expect(w.stats.captures).toEqual([{ node: N.heart, tick: 0 }]);
    expect(w.lastBattle).toMatchObject({ node: N.heart, startTick: 0, endTick: 0, shipsEngaged: 5, shipsLost: 0, guardsKilled: 1, outcome: 'captured', wilt: null });
    expect(w.ships[0]!.hp).toBe(7); // the dying thorn still hit back this round
    expect(runSummary(w).captureSec).toBe(0);
    // No more combat or regrowth; the heart now extracts ore at 25/min.
    run(w, 1800);
    expect(heart(w).guards).toEqual([]);
    expect(w.ships.length).toBe(5);
    expect(w.nodes[N.heart]!.buffer).toBe(25);
    expect(nodeStatus(w, N.heart)).toMatchObject({ prize: 'ore', extractPerMin: 25 });
  });

  it('no capture without a ship present', () => {
    const w = idle();
    heart(w).guards = [];
    step(w, data, []);
    expect(isCaptured(w)).toBe(false);
    expect(heart(w).regrowProgress).toEqual({ thorn: 1, spore: 1 });
  });

  it('a mutual wipe is repelled, and regrowth resumes', () => {
    const w = idle();
    setGuards(w, N.heart, [['thorn', 2]]);
    w.tun['guard.thorn.damage'] = 30;
    addShips(w, N.heart, 1);
    step(w, data, []);
    expect(heart(w).guards).toEqual([]);
    expect(w.ships).toEqual([]);
    expect(w.lastBattle!.outcome).toBe('repelled');
    expect(isCaptured(w)).toBe(false);
    runUntil(w, (x) => heart(x).guards.length === 1, 100);
  });
});

describe('rule 10: stats', () => {
  it('peak uses the full ore window, then the bucket for the next second is cleared in every ring', () => {
    const w = idle();
    w.stats.deliveredBuckets.fill(1);
    w.stats.prizeBuckets.ice.fill(2);
    step(w, data, []); // tick 0
    expect(w.stats.peakPerMin).toBe(60);
    run(w, 28); // ticks 1..28
    expect(w.stats.deliveredBuckets[1]).toBe(1);
    run(w, 1); // tick 29: next tick enters second 1
    expect(w.stats.deliveredBuckets[1]).toBe(0);
    expect(w.stats.prizeBuckets.ice[1]).toBe(0);
    expect(throughputPerMin(w)).toBe(59);
  });

  it('shipCounts reports parked and en-route ships per node and per type', () => {
    const w = idle();
    addShips(w, N.probe, 3);
    addShips(w, N.probe, 1, 'flak');
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.a5, counts: { drone: 1, lancer: 0, flak: 1 } }]);
    const c = shipCounts(w);
    expect(c.total).toBe(4);
    expect(c.byType).toEqual({ drone: 3, lancer: 0, flak: 1 });
    expect(c.at[N.probe]).toBe(2);
    expect(c.enRoute[N.a5]).toBe(2);
    expect(c.atByType[N.probe]).toEqual({ drone: 2, lancer: 0, flak: 0 });
    expect(c.enRouteByType[N.a5]).toEqual({ drone: 1, lancer: 0, flak: 1 });
    expect(c.at.length).toBe(16);
  });
});
