import { describe, expect, it } from 'vitest';
import {
  battleStatus,
  combatRates,
  guardianStatus,
  isCaptured,
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
import { N, addShips, bloom, data, fresh, run, runUntil } from './helpers.ts';

/** No stock, no probe mining, yard off: nothing happens unless the test sets it up. */
function idle(): World {
  const w = fresh();
  w.stock = 0;
  w.shipyard.on = false;
  w.tun['economy.probeOrePerMin'] = 0;
  return w;
}

function addRoute(w: World, from: number, level = 1): void {
  w.routes.push({ id: w.nextId++, from, to: N.probe, length: [0, 247, 262, 504, 543, 620, 950][from]!, level, cooldown: 0, pods: [] });
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
    expect(nodeStatus(w, N.a1).extractPerMin).toBe(10);
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

  it('probe mining adds economy.probeOrePerMin to stock', () => {
    const w = fresh();
    w.stock = 0;
    w.shipyard.on = false;
    run(w, 1800);
    expect(w.stock).toBe(12);
  });
});

describe('rule 4: pods', () => {
  it('launch min(buffer, level × podOrePerLevel), travel ceil(length / podSpeedSu) ticks, then deliver to stock and the bucket', () => {
    const w = idle();
    w.nodes[N.a1]!.buffer = 5;
    addRoute(w, N.a1);
    step(w, data, []);
    const route = w.routes[0]!;
    expect(route.pods).toEqual([{ amount: 1, ticksLeft: 41 }]); // ceil(247/6) = 42, decremented on the launch tick
    expect(route.cooldown).toBe(90);
    expect(w.nodes[N.a1]!.buffer).toBe(4);
    run(w, 40);
    expect(w.stock).toBe(0);
    run(w, 1);
    expect(w.stock).toBe(1);
    expect(route.pods).toEqual([]);
    expect(w.stats.deliveredBuckets[1]).toBe(1); // delivered on tick 41, second 1
    // Next launch exactly podIntervalTicks after the first.
    run(w, 90 - 42); // ticks 42..89
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
    w.stock = 30;
    step(w, data, [
      { type: 'buildExtractor', node: N.a1 },
      { type: 'buildRoute', from: N.a1, to: N.probe },
      { type: 'buildExtractor', node: N.a1 },
    ]);
    expect(w.stock).toBe(10);
    expect(w.activeBuild).toEqual({ kind: 'extractor', node: N.a1, ticksLeft: 300 });
    expect(w.queue.map((o) => o.kind)).toEqual(['route', 'extractor']);
    run(w, 299);
    expect(w.nodes[N.a1]!.extractors).toBe(0);
    run(w, 1);
    expect(w.nodes[N.a1]!).toMatchObject({ extractors: 1, owned: true });
    // The route (9) started the same tick; the second extractor (20) waits for ore.
    expect(w.activeBuild).toMatchObject({ kind: 'route', ticksLeft: 300 });
    expect(w.stock).toBe(1);
    run(w, 300);
    expect(w.routes.map((r) => ({ from: r.from, level: r.level, length: r.length }))).toEqual([{ from: N.a1, level: 1, length: 247 }]);
    expect(w.activeBuild).toBeNull();
    expect(w.queue.length).toBe(1);
    expect(w.stats.oreSpentEconomy).toBe(29);
  });

  it('a head the stock cannot cover blocks cheaper orders behind it', () => {
    const w = idle();
    w.stock = 10;
    w.nodes[N.a1]!.extractors = 1;
    step(w, data, [
      { type: 'buildExtractor', node: N.a2 },
      { type: 'buildRoute', from: N.a1, to: N.probe },
    ]);
    expect(w.activeBuild).toBeNull();
    expect(w.stock).toBe(10);
  });

  it('queued orders reserve their ore ahead of the shipyard', () => {
    const w = idle();
    w.shipyard.on = true;
    w.activeBuild = { kind: 'extractor', node: N.a3, ticksLeft: 1000 };
    w.stock = 34;
    step(w, data, [{ type: 'buildExtractor', node: N.a1 }]); // reserves 20; 14 free < 15
    expect(w.shipyard.ticksLeft).toBe(0);
    expect(queueStatus(w).reserved).toBe(20);
    w.stock = 35;
    step(w, data, []);
    expect(w.shipyard.ticksLeft).toBe(90);
    expect(w.stock).toBe(20);
  });

  it('upgrades raise the route level', () => {
    const w = idle();
    w.stock = 100;
    w.nodes[N.a2]!.extractors = 1;
    addRoute(w, N.a2);
    step(w, data, [{ type: 'upgradeRoute', from: N.a2 }]);
    run(w, 300);
    expect(w.routes[0]!.level).toBe(2);
  });
});

describe('rule 5: shipyard', () => {
  it('builds one ship per ship.buildTicks when ore is plentiful (20/min)', () => {
    const w = idle();
    w.shipyard.on = true;
    w.stock = 1000;
    run(w, 1801);
    expect(w.ships.length).toBe(20);
    expect(w.stats.shipsBuilt).toBe(20);
    expect(w.stats.firstShipTick).toBe(90);
    expect(w.ships.every((s) => s.at === N.probe && s.hp === 10)).toBe(true);
  });

  it('is limited by income otherwise: 60 ore/min at 15 per ship is 4 ships/min', () => {
    const w = idle();
    w.shipyard.on = true;
    w.tun['economy.probeOrePerMin'] = 60;
    expect(shipsPerMinX10(w)).toBe(40);
    run(w, 1800 * 5);
    expect(w.ships.length).toBeGreaterThanOrEqual(19);
    expect(w.ships.length).toBeLessThanOrEqual(20);
    expect(w.stats.oreSpentShips).toBe(15 * (w.ships.length + (w.shipyard.ticksLeft > 0 ? 1 : 0)));
  });
});

describe('rule 7: combat', () => {
  it('resolves both sides at once from start-of-round counts; leftover damage is wasted on the last unit', () => {
    const w = idle();
    addShips(w, N.rich, 3);
    step(w, data, []); // tick 0 is a round tick
    // Ships: 3 × 2 = 6 → thorn 1 at 14, repaired +2 → 16. Bloom: 12 × 3 = 36 → all three ships (30 hp).
    expect(bloom(w).thorns.map((t) => t.hp)).toEqual([16, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20]);
    expect(w.ships).toEqual([]);
    expect(bloom(w).battle).toBeNull();
    expect(w.lastBattle).toMatchObject({ node: N.rich, startTick: 0, endTick: 0, shipsEngaged: 3, shipsLost: 3, thornsKilled: 0, outcome: 'repelled', wilt: null });
    expect(w.stats.shipsLost).toBe(3);
  });

  it('damage overflows to the next unit in id order', () => {
    const w = idle();
    addShips(w, N.rich, 15);
    step(w, data, []);
    // Ships: 30 → thorn 1 dies (20), thorn 2 takes 10 → 10, +2 repair → 12. Bloom (12 thorns at round start): 36 → ships 1-3 die, ship 4 at 4.
    expect(bloom(w).thorns.length).toBe(11);
    expect(bloom(w).thorns[0]!.hp).toBe(12);
    expect(w.ships.length).toBe(12);
    expect(w.ships[0]!.hp).toBe(4);
    expect(battleStatus(w)).toMatchObject({ startTick: 0, shipsPresent: 12, shipsEngaged: 15, shipsLost: 3, thornsKilled: 1 });
  });

  it('fights only on round ticks, and counts each ship once per battle', () => {
    const w = idle();
    w.tun['guardian.thornDamage'] = 0;
    run(w, 1); // tick 1
    addShips(w, N.rich, 2);
    run(w, 28); // ticks 1..28: no round
    expect(bloom(w).battle).toBeNull();
    run(w, 1); // tick 29
    expect(bloom(w).battle).toBeNull();
    run(w, 1); // tick 30: round
    expect(bloom(w).battle).toMatchObject({ startTick: 30, shipsEngaged: 2 });
    run(w, 30);
    expect(bloom(w).battle).toMatchObject({ startTick: 30, shipsEngaged: 2 });
    addShips(w, N.rich, 1);
    run(w, 30);
    expect(bloom(w).battle!.shipsEngaged).toBe(3);
  });

  it('a battle ends "withdrew" when the ships leave', () => {
    const w = idle();
    w.tun['guardian.thornDamage'] = 0;
    addShips(w, N.rich, 2);
    run(w, 5);
    expect(bloom(w).battle).not.toBeNull();
    step(w, data, [{ type: 'sendShips', from: N.rich, to: N.a5, count: 0 }]);
    expect(bloom(w).battle).toBeNull();
    expect(w.lastBattle).toMatchObject({ outcome: 'withdrew', startTick: 0, endTick: 5, shipsLost: 0 });
  });

  it('wounded thorns repair on every round tick, fight or not, up to thornHp', () => {
    const w = idle();
    bloom(w).thorns[0]!.hp = 13;
    bloom(w).thorns[1]!.hp = 19;
    step(w, data, []); // tick 0
    expect(bloom(w).thorns.slice(0, 2).map((t) => t.hp)).toEqual([15, 20]);
    run(w, 29);
    expect(bloom(w).thorns[0]!.hp).toBe(15);
    run(w, 1);
    expect(bloom(w).thorns[0]!.hp).toBe(17);
  });

  it('combatRates gives kill rate vs regrowth in tenths per second', () => {
    const w = idle();
    // 24 ships × 2 dmg / 20 hp per round, 1 round/s → 2.4/s. Regrow 30/60 → 0.5/s.
    expect(combatRates(w, 24)).toEqual({ killPerSecX10: 24, regrowPerSecX10: 5 });
  });
});

describe('rule 9: regrowth', () => {
  it('adds a full-hp thorn every regrowTicks up to the cap, then holds progress at 0', () => {
    const w = idle();
    bloom(w).thorns = bloom(w).thorns.slice(0, 10);
    const lastId = bloom(w).thorns[9]!.id;
    run(w, 59);
    expect(bloom(w).thorns.length).toBe(10);
    expect(guardianStatus(w).regrowProgress).toBe(59);
    run(w, 1);
    expect(bloom(w).thorns.length).toBe(11);
    expect(bloom(w).thorns[10]!.hp).toBe(20);
    expect(bloom(w).thorns[10]!.id).toBeGreaterThan(lastId);
    run(w, 60);
    expect(bloom(w).thorns.length).toBe(12);
    run(w, 600);
    expect(bloom(w).thorns.length).toBe(12);
    expect(bloom(w).regrowProgress).toBe(0);
  });

  it('the Bloom starts at its cap', () => {
    expect(guardianStatus(fresh())).toMatchObject({ alive: true, thorns: 12, cap: 12, regrowProgress: 0 });
  });
});

describe('rule 8: capture', () => {
  it('when the last thorn falls with ships present: Bloom dies, node owned with free extractors, battle captured', () => {
    const w = idle();
    bloom(w).thorns = [{ id: 999, hp: 2 }];
    addShips(w, N.rich, 5);
    step(w, data, []);
    expect(isCaptured(w)).toBe(true);
    expect(bloom(w).alive).toBe(false);
    expect(w.nodes[N.rich]).toMatchObject({ owned: true, extractors: 1 });
    expect(w.capturedTick).toBe(0);
    expect(w.lastBattle).toMatchObject({ node: N.rich, startTick: 0, endTick: 0, shipsEngaged: 5, shipsLost: 0, thornsKilled: 1, outcome: 'captured', wilt: null });
    expect(w.ships[0]!.hp).toBe(7); // the dying thorn still hit back this round
    expect(runSummary(w).captureSec).toBe(0);
    // No more combat or regrowth; the rich node now extracts at 25/min.
    run(w, 1800);
    expect(bloom(w).thorns).toEqual([]);
    expect(w.ships.length).toBe(5);
    expect(w.nodes[N.rich]!.buffer).toBe(25);
    expect(nodeStatus(w, N.rich).extractPerMin).toBe(25);
  });

  it('no capture without a ship present', () => {
    const w = idle();
    bloom(w).thorns = [];
    step(w, data, []);
    expect(isCaptured(w)).toBe(false);
    expect(bloom(w).regrowProgress).toBe(1);
  });

  it('a mutual wipe is repelled, and regrowth resumes', () => {
    const w = idle();
    bloom(w).thorns = [{ id: 999, hp: 2 }];
    w.tun['guardian.thornDamage'] = 30;
    addShips(w, N.rich, 1);
    step(w, data, []);
    expect(bloom(w).thorns).toEqual([]);
    expect(w.ships).toEqual([]);
    expect(w.lastBattle!.outcome).toBe('repelled');
    expect(isCaptured(w)).toBe(false);
    runUntil(w, (x) => bloom(x).thorns.length === 1, 100);
  });
});

describe('rule 10: stats', () => {
  it('peak uses the full window, then the bucket for the next second is cleared', () => {
    const w = idle();
    w.stats.deliveredBuckets.fill(1);
    step(w, data, []); // tick 0
    expect(w.stats.peakPerMin).toBe(60);
    run(w, 28); // ticks 1..28
    expect(w.stats.deliveredBuckets[1]).toBe(1);
    run(w, 1); // tick 29: next tick enters second 1
    expect(w.stats.deliveredBuckets[1]).toBe(0);
    expect(throughputPerMin(w)).toBe(59);
  });

  it('shipCounts reports parked and en-route ships per node', () => {
    const w = idle();
    addShips(w, N.probe, 3);
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.a5, count: 1 }]);
    expect(shipCounts(w)).toEqual({ at: [2, 0, 0, 0, 0, 0, 0, 0], enRoute: [0, 0, 0, 0, 0, 1, 0, 0], total: 3 });
  });
});
