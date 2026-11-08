import { describe, expect, it } from 'vitest';
import {
  SHIP_TYPES,
  campaignWorld,
  createWorld,
  fleetCount,
  guardianStatus,
  isValidInput,
  researchLevel,
  runSummary,
  step,
  weightedMultPct,
  type ShipType,
  type ShipTypeCounts,
  type World,
} from '@factory4x/sim';
// H4: an H3 game is The Deep from a constructed campaign (createWorld starts on the overworld).
import { h3World } from '../../sim/test/h3-world.ts';
// The frozen v8 fixture (fleet.cap 12, the Command limit item): the rules and numbers these tests pin never move with calibration.
import { fixtureData as v4, fixtureV8 as data } from '../../sim/test/fixture.ts';
import {
  RESEARCH_POLICY,
  WINNING_STRATEGIES,
  areaEstimate,
  bestAllocation,
  buildableTypes,
  cheapestOpenArea,
  chooseArea,
  chooseTarget,
  closedKey,
  decideArea,
  decideComposer,
  decideOverworld,
  fleetPower,
  guardNeed,
  kitEntries,
  nextEconomyOrder,
  nextPurchase,
  nextTarget,
  nodeFinished,
  openAreas,
  readyToAttack,
  strategies,
  targetOrder,
  type CampaignStrategy,
  type ResearchKit,
} from '../src/strategies.ts';

const N = { probe: 0, a1: 1, a2: 2, a3: 3, a4: 4, a5: 5, p1: 10, p2: 11, p3: 12, p4: 13, root: 14, heart: 15 } as const;
/** Seed 0 is Frost Gate. */
const fresh = (): World => h3World(0, v4);
const by = (name: string): CampaignStrategy => strategies.find((s) => s.name === name)!;
const area = (id: string): number => data.map.areas.findIndex((a) => a.id === id);
const research = (id: string): number => data.research.findIndex((r) => r.id === id);
const idx = (w: World, id: string): number => w.nodes.find((n) => n.id === id)!.index;
const DESIGNS = { lancer: 1, flak: 1 } as const;
const ALL: ShipType[] = ['drone', 'lancer', 'flak'];
/** Landed in `id` with every other area reclaimed (so it is open) and both designs bought. */
const landed = (id: string, seed = 1): World =>
  campaignWorld(seed, data, { reclaimed: data.map.areas.map((a) => a.id).filter((a) => a !== id), research: DESIGNS, land: id });
const place = (w: World, node: number, type: ShipType, n: number): void => {
  for (let i = 0; i < n; i++) w.ships.push({ id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at: node, transit: null, engagedIn: -1 });
};
const heartOf = (w: World): number => w.nodes.findIndex((n) => n.kind === 'heart');
const total = (c: ShipTypeCounts): number => c.drone + c.lancer + c.flak;

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

describe('in-area estimates', () => {
  it('need is Σ capEff × hp, and power uses the weighted counter multiplier', () => {
    const w = fresh();
    expect(guardNeed(w, N.p1)).toBe(1 * 20 + 8 * 6);
    expect(guardNeed(w, N.heart)).toBe(10 * 20 + 14 * 6);
    // Frost Gate p2 (3/3): lancer multiplier 159 → 4 × 4 × 159 / 100 = 25; drones 10 × 2 = 20.
    expect(fleetPower(w, N.p2, { drone: 0, lancer: 4, flak: 0 })).toBe(25);
    expect(fleetPower(w, N.p2, { drone: 10, lancer: 0, flak: 0 })).toBe(20);
  });

  it('target the lowest need / prize weight, the heart only when it is the last', () => {
    const w = fresh();
    expect(nextTarget(w)).toBe(N.p1);
    expect(targetOrder(w)[0]).toBe(N.p1);
    expect(targetOrder(w).at(-1)).toBe(N.heart);
    for (const g of w.guardians) if (g.node !== N.heart) g.alive = false;
    expect(nextTarget(w)).toBe(N.heart);
    expect(targetOrder(w)).toEqual([N.heart]);
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

  it('send the first ship at a heart with no guards', () => {
    const w = campaignWorld(1, data, { land: 'landfall' });
    const heart = idx(w, 'heart');
    expect(guardNeed(w, heart)).toBe(0);
    expect(readyToAttack(w, heart, 0)).toBe(false);
    expect(readyToAttack(w, heart, 1)).toBe(true);
  });
});

describe('buildable types', () => {
  it('drones always; a design only with its prize in the area (captured or not)', () => {
    expect(buildableTypes(landed('shelf'), false)).toEqual(['drone', 'flak']); // ice pocket
    expect(buildableTypes(landed('shoal'), false)).toEqual(['drone', 'lancer']); // crystal pocket
    expect(buildableTypes(landed('veil'), false)).toEqual(ALL);
    expect(buildableTypes(landed('deep'), false)).toEqual(ALL);
    expect(buildableTypes(landed('landfall'), false)).toEqual(['drone']);
  });

  it('a design that is not researched is not buildable, and drones-only builds drones only', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'shoal'], research: { flak: 1 }, land: 'veil' });
    expect(buildableTypes(w, false)).toEqual(['drone', 'flak']);
    expect(buildableTypes(landed('veil'), true)).toEqual(['drone']);
  });
});

describe('allocation', () => {
  /** The best fleet of exactly `limit` ships by brute force over every (l, f), with the spec's tie-break. */
  const brute = (w: World, node: number, limit: number, buildable: ShipType[]): { fleet: ShipTypeCounts; power: number } => {
    let best: { fleet: ShipTypeCounts; power: number } | null = null;
    for (let l = 0; l <= (buildable.includes('lancer') ? limit : 0); l++) {
      for (let f = 0; f <= (buildable.includes('flak') ? limit - l : 0); f++) {
        const fleet = { drone: limit - l - f, lancer: l, flak: f };
        const power = fleetPower(w, node, fleet);
        const better = best === null || power > best.power || (power === best.power && (l + f < best.fleet.lancer + best.fleet.flak || (l + f === best.fleet.lancer + best.fleet.flak && l > best.fleet.lancer)));
        if (better) best = { fleet, power };
      }
    }
    return best!;
  };

  it('is the highest-power fleet of exactly the limit, as a brute-force search finds it', () => {
    const w = landed('veil');
    for (const [node, limit] of [[idx(w, 'p1'), 12], [idx(w, 'heart'), 12], [idx(w, 'heart'), 18], [idx(w, 'root'), 7]] as const) {
      const a = bestAllocation(w, node, limit, ALL);
      expect(total(a.fleet)).toBe(limit);
      expect(a).toEqual(brute(w, node, limit, ALL));
    }
  });

  it('puts the counter on the heart it counters, and respects the buildable types', () => {
    const w = landed('veil'); // a Spore heart: Flak Strong
    const heart = idx(w, 'heart');
    const mixed = bestAllocation(w, heart, 12, ALL).fleet;
    expect(mixed.flak).toBeGreaterThan(mixed.lancer);
    expect(bestAllocation(w, heart, 12, ['drone']).fleet).toEqual({ drone: 12, lancer: 0, flak: 0 });
    expect(bestAllocation(w, heart, 12, ['drone', 'lancer']).fleet.flak).toBe(0);
    const g = landed('garden'); // a Thorn heart: Lancer Strong
    expect(bestAllocation(g, idx(g, 'heart'), 12, ALL).fleet.lancer).toBeGreaterThan(0);
  });

  it('ties go to fewer component ships, then more lancers', () => {
    const w = landed('veil');
    const heart = idx(w, 'heart');
    // Every ship type equal in power and every counter neutral: all drones (no component ships).
    for (const t of SHIP_TYPES) w.tun[`ship.${t}.damage`] = 4;
    w.tun['counter.strongPct'] = 100;
    w.tun['counter.weakPct'] = 100;
    expect(bestAllocation(w, heart, 6, ALL).fleet).toEqual({ drone: 6, lancer: 0, flak: 0 });
    // Drones weak, lancer and flak equal: component ships beat drones, and among equal component counts the lancers win.
    w.tun['ship.drone.damage'] = 1;
    expect(bestAllocation(w, heart, 6, ALL).fleet).toEqual({ drone: 0, lancer: 6, flak: 0 });
    expect(bestAllocation(w, heart, 6, ['drone', 'flak']).fleet).toEqual({ drone: 0, lancer: 0, flak: 6 });
  });

  it('follows a tunable change (the cache is keyed by the numbers it depends on)', () => {
    const w = landed('veil');
    const heart = idx(w, 'heart');
    const before = bestAllocation(w, heart, 10, ALL);
    w.tun['ship.flak.damage'] = 1;
    const after = bestAllocation(w, heart, 10, ALL);
    expect(after).toEqual(brute(w, heart, 10, ALL));
    expect(after.power).toBeLessThan(before.power);
  });

  it('a guardless node needs one drone', () => {
    const w = landed('landfall');
    expect(bestAllocation(w, idx(w, 'heart'), 12, ALL).fleet).toEqual({ drone: 1, lancer: 0, flak: 0 });
  });
});

describe('target and closed areas', () => {
  it('takes the first node in the H3 order whose best allocation passes the attack test', () => {
    const w = landed('veil');
    const t = chooseTarget(w, 12, ALL)!;
    expect(t.passes).toBe(true);
    // Order: pockets and the Root come before the heart; the fed heart (50 spores) is out of reach at 12.
    expect(t.node).not.toBe(idx(w, 'heart'));
    const order = targetOrder(w);
    for (const node of order.slice(0, order.indexOf(t.node))) {
      expect(readyToAttack(w, node, bestAllocation(w, node, 12, ALL).power)).toBe(false);
    }
    // Skipping a failing node: starve the first passing one of its allowance by raising its wave count.
    w.guardians.find((g) => g.node === t.node)!.wavesSent = 12;
    const second = chooseTarget(w, 12, ALL)!;
    expect(second.node).not.toBe(t.node);
  });

  it('is null when nothing passes (the area is closed at this limit), or the first node with passes false when asked for a fallback', () => {
    const w = landed('veil');
    expect(chooseTarget(w, 2, ALL)).toBeNull();
    const fb = chooseTarget(w, 2, ALL, true)!;
    expect(fb.passes).toBe(false);
    expect(fb.node).toBe(targetOrder(w)[0]);
    expect(total(fb.fleet)).toBe(2);
  });

  it('a raised limit opens what a smaller one closed', () => {
    const w = landed('veil');
    expect(chooseTarget(w, 2, ALL)).toBeNull();
    expect(chooseTarget(w, 30, ALL)).not.toBeNull();
  });

  it('a fed medium heart fails the attack test at the base limit and passes at a large one', () => {
    const w = landed('veil');
    const heart = idx(w, 'heart');
    const pass = (limit: number): boolean => readyToAttack(w, heart, bestAllocation(w, heart, limit, ALL).power);
    expect(pass(12)).toBe(false);
    expect(pass(60)).toBe(true);
  });
});

describe('composer engine', () => {
  it('asks to withdraw an area at once when nothing passes at the limit, unless the visit is forced or a wave is in flight', () => {
    const w = landed('veil');
    w.tun['fleet.cap'] = 2;
    expect(decideComposer(w, data, { dronesOnly: false, forced: false })).toEqual({ inputs: [], closed: true });
    const forced = decideComposer(w, data, { dronesOnly: false, forced: true });
    expect(forced.closed).toBe(false);
    // A wave in flight (a ship at a living guarded node) is never abandoned as closed.
    place(w, idx(w, 'p1'), 'drone', 1);
    expect(decideComposer(w, data, { dronesOnly: false, forced: false }).closed).toBe(false);
  });

  it('is not closed when a target passes, and orders only inputs the sim accepts', () => {
    const w = landed('veil');
    for (let i = 0; i < 900; i++) {
      const d = decideComposer(w, data, { dronesOnly: false, forced: false });
      expect(d.closed).toBe(false);
      for (const input of d.inputs) expect(isValidInput(w, data, input), `${w.tick} ${JSON.stringify(input)}`).toBe(true);
      step(w, data, d.inputs);
    }
  });

  it('never lets the fleet pass the limit and keeps every yard off while it is full', () => {
    const w = landed('shelf');
    w.tun['fleet.cap'] = 5;
    let sawFull = false;
    for (let i = 0; i < 30 * 60 * 9 && !sawFull; i++) {
      step(w, data, decideComposer(w, data, { dronesOnly: false, forced: true }).inputs);
      expect(fleetCount(w)).toBeLessThanOrEqual(5);
      if (fleetCount(w) === 5) sawFull = true;
    }
    expect(sawFull).toBe(true);
  });

  it('lancer and flak yards run only for the buildable types and while below their allocation', () => {
    const w = landed('shoal'); // crystal prize: lancers, never flak
    w.tun['fleet.cap'] = 8;
    for (let i = 0; i < 30 * 60 * 7; i++) {
      step(w, data, decideComposer(w, data, { dronesOnly: false, forced: true }).inputs);
      expect(w.yards.flak.ticksLeft).toBe(0);
      expect(w.ships.some((x) => x.type === 'flak')).toBe(false);
    }
  });

  it('regroups a ship stranded at the probe at a5 (base limit)', () => {
    const w = landed('landfall');
    const a5 = idx(w, 'a5');
    place(w, 0, 'drone', 1);
    expect(decideComposer(w, data, { dronesOnly: false, forced: false }).inputs).toContainEqual({ type: 'sendShips', from: 0, to: a5, counts: expect.anything() });
  });

  it('a forced visit at the base limit rallies from the landing, gathers the full allocation at a5 and attacks at least once', () => {
    // Premise: Frost Shelf at the base limit of 12 is closed (the heart needs more), so the visit is forced and plays out.
    const w = landed('shelf');
    expect(chooseTarget(w, 12, ALL)).not.toBeNull(); // the pocket passes first, then the heart does not
    const a5 = idx(w, 'a5');
    let strandedAfterEconomy = 0;
    for (let i = 0; i < 30 * 60 * 30 && runSummary(w).wavesSent === 0; i++) {
      step(w, data, decideComposer(w, data, { dronesOnly: false, forced: true }).inputs);
      if (i === 5) expect(w.rally).toBe(a5);
      if (i > 30 * 60 * 6 && w.ships.some((x) => x.at === 0 && x.transit === null)) strandedAfterEconomy++;
    }
    expect(runSummary(w).wavesSent).toBeGreaterThan(0);
    expect(strandedAfterEconomy).toBe(0);
    // Now only the heart is left and fails the estimate: the forced visit still sends a full fleet.
    for (const g of w.guardians) if (g.node !== heartOf(w)) g.alive = false;
    const before = runSummary(w).wavesSent;
    for (let i = 0; i < 30 * 60 * 25 && runSummary(w).wavesSent === before; i++) step(w, data, decideComposer(w, data, { dronesOnly: false, forced: true }).inputs);
    expect(runSummary(w).wavesSent).toBeGreaterThan(before);
    expect(fleetCount(w)).toBeLessThanOrEqual(12);
  });

  it('recycles the surplus parked at a5 when the fleet is full, and nothing when it is not', () => {
    // Landfall: the target needs one drone, so every other drone at a5 is surplus.
    const w = landed('landfall');
    w.tun['fleet.cap'] = 3;
    const a5 = idx(w, 'a5');
    place(w, a5, 'drone', 3);
    const full = decideComposer(w, data, { dronesOnly: false, forced: false }).inputs;
    expect(full).toContainEqual({ type: 'recycleShips', node: a5, counts: { drone: 2, lancer: 0, flak: 0 } });
    const roomy = landed('landfall');
    place(roomy, idx(roomy, 'a5'), 'drone', 3); // cap 12: not full
    expect(decideComposer(roomy, data, { dronesOnly: false, forced: false }).inputs.some((i) => i.type === 'recycleShips')).toBe(false);
  });

  it('sends everything at a5 once the ships there match the allocation, and holds with none', () => {
    const w = landed('landfall');
    const a5 = idx(w, 'a5');
    const heart = idx(w, 'heart');
    expect(decideComposer(w, data, { dronesOnly: false, forced: false }).inputs.some((i) => i.type === 'sendShips')).toBe(false);
    place(w, a5, 'drone', 1);
    expect(decideComposer(w, data, { dronesOnly: false, forced: false }).inputs).toContainEqual({ type: 'sendShips', from: a5, to: heart, counts: expect.anything() });
  });

  it('builds the economy first: an extractor order and the drone yard off, never an attack', () => {
    const w = landed('shelf');
    const inputs = decideComposer(w, data, { dronesOnly: false, forced: false }).inputs;
    expect(inputs).toContainEqual({ type: 'buildExtractor', node: idx(w, 'a1') });
    expect(inputs.some((i) => i.type === 'sendShips' || i.type === 'recycleShips')).toBe(false);
  });
});

describe('research policy', () => {
  /** An overworld with every item affordable at once, so only the policy's order decides. */
  const rich = (levels: Record<string, number> = {}, reclaimed: string[] = []): World =>
    campaignWorld(1, data, { reclaimed, research: levels, stockpile: { ore: 5000, ice: 500, crystal: 500 } });
  const buy = (w: World, kit: ResearchKit): string[] => {
    const order: string[] = [];
    for (let i = 0; i < 40; i++) {
      const item = nextPurchase(w, data, kit);
      if (item === null) break;
      order.push(`${item}${researchLevel(w, item) + 1}`);
      step(w, data, [{ type: 'buyResearch', item: research(item) }]);
    }
    return order;
  };
  const NO_DEEP = ['landfall', 'shelf', 'shoal', 'veil', 'garden'];

  it('lists the spec order: core, designs, Command limit 1, opening 1, extract 1, Command limit 2, rigs 1, yards 1, Command limit 3, then the rest', () => {
    expect(RESEARCH_POLICY.map(([i, l]) => `${i}${l}`)).toEqual([
      'core1', 'lancer1', 'flak1', 'fleet1', 'opening1', 'extract1', 'fleet2', 'rigs1', 'yards1', 'fleet3', 'extract2', 'opening2', 'rigs2', 'yards2', 'extract3', 'opening3',
    ]);
  });

  it('buys Command limit where the sim allows it: not before an area is reclaimed, each level after its area', () => {
    // Nothing reclaimed: no level is buyable yet.
    expect(buy(rich(), 'full')).toEqual(['lancer1', 'flak1', 'opening1', 'extract1', 'rigs1', 'yards1', 'extract2', 'opening2', 'rigs2', 'yards2', 'extract3', 'opening3']);
    // Both mediums reclaimed: all three levels in their slots.
    expect(buy(rich({}, NO_DEEP), 'full')).toEqual([
      'lancer1', 'flak1', 'fleet1', 'opening1', 'extract1', 'fleet2', 'rigs1', 'yards1', 'fleet3', 'extract2', 'opening2', 'rigs2', 'yards2', 'extract3', 'opening3',
    ]);
    // A light area only: level 1 and nothing more of the Command limit.
    expect(buy(rich({}, ['landfall', 'shelf']), 'full').filter((o) => o.startsWith('fleet'))).toEqual(['fleet1']);
  });

  it('buys the core first once The Deep is reclaimed and it is affordable', () => {
    const order = buy(rich(DESIGNS, [...NO_DEEP, 'deep']), 'full');
    expect(order[0]).toBe('core1');
  });

  it('skips an unaffordable item for the first affordable one below it', () => {
    const w = campaignWorld(1, data, { stockpile: { ore: 60, ice: 0, crystal: 0 } });
    expect(nextPurchase(w, data, 'full')).toBe('opening');
    const w2 = campaignWorld(1, data, { stockpile: { ore: 500, ice: 40, crystal: 0 } });
    expect(nextPurchase(w2, data, 'full')).toBe('flak');
  });

  it('does not buy rigs before extraction 1, and never past a max level', () => {
    const w = campaignWorld(1, data, { stockpile: { ore: 5000, ice: 500, crystal: 500 }, research: { lancer: 1, flak: 1, opening: 3 } });
    const order = buy(w, 'full');
    expect(order.indexOf('rigs1')).toBeGreaterThan(order.indexOf('extract1'));
    expect(order.filter((o) => o.startsWith('opening'))).toEqual([]);
    expect(nextPurchase(w, data, 'full')).toBeNull();
  });

  it('no-command is the policy without Command limit; grind buys only the four grind items, never a design, the core or Command limit', () => {
    expect(kitEntries('no-command').some(([i]) => i === 'fleet')).toBe(false);
    expect(kitEntries('no-command')).toHaveLength(RESEARCH_POLICY.length - 3);
    expect(buy(rich({}, NO_DEEP), 'no-command')).toEqual(['lancer1', 'flak1', 'opening1', 'extract1', 'rigs1', 'yards1', 'extract2', 'opening2', 'rigs2', 'yards2', 'extract3', 'opening3']);
    const all = [...NO_DEEP, 'deep'];
    expect(buy(rich({}, all), 'grind')).toEqual(['opening1', 'extract1', 'rigs1', 'yards1', 'extract2', 'opening2', 'rigs2', 'yards2', 'extract3', 'opening3']);
    expect(nextPurchase(rich(DESIGNS, all), data, 'grind')).toBe('opening');
  });

  it('does not buy Command limit while the limit is off (fleet.cap 0)', () => {
    const w = rich({}, NO_DEEP);
    w.tun['fleet.cap'] = 0;
    expect(buy(w, 'full').filter((o) => o.startsWith('fleet'))).toEqual([]);
  });

  it('the kit none buys nothing', () => {
    expect(nextPurchase(rich(), data, 'none')).toBeNull();
  });
});

describe('area choice', () => {
  const reclaimed = (...ids: string[]): World => campaignWorld(1, data, { reclaimed: ids });
  const chosen = (w: World, s: CampaignStrategy, closed = new Map<number, string>()) => chooseArea(w, data, s, closed);

  it('only Landfall is open at the start; Landfall opens the two light areas', () => {
    expect(openAreas(createWorld(1, data), data)).toEqual([area('landfall')]);
    expect(openAreas(reclaimed('landfall'), data)).toEqual([area('shelf'), area('shoal')]);
  });

  it('ice-first goes Landfall, Frost Shelf, then the greedy choice; crystal-first goes Landfall, Glass Shoal', () => {
    const ice = by('ice-first');
    expect(chosen(createWorld(1, data), ice)).toEqual({ area: area('landfall'), forced: false });
    expect(chosen(reclaimed('landfall'), ice)!.area).toBe(area('shelf'));
    const after = reclaimed('landfall', 'shelf');
    expect(chosen(after, ice)!.area).toBe(cheapestOpenArea(after, data));
    const crystal = by('crystal-first');
    expect(chosen(reclaimed('landfall'), crystal)!.area).toBe(area('shoal'));
    expect(chosen(reclaimed('landfall', 'shoal'), crystal)!.area).toBe(cheapestOpenArea(reclaimed('landfall', 'shoal'), data));
  });

  it('greedy takes the lowest estimate: need / best power, lowest index on ties', () => {
    const w = reclaimed('landfall');
    const e = (id: string) => areaEstimate(w, data, area(id));
    const shelf = e('shelf');
    const shoal = e('shoal');
    const expected = shelf.need * shoal.powerX100 <= shoal.need * shelf.powerX100 ? 'shelf' : 'shoal';
    expect(chosen(w, by('composer'))!.area).toBe(area(expected));
    expect(areaEstimate(createWorld(1, data), data, area('landfall')).need).toBe(0);
    expect(chosen(createWorld(1, data), by('composer'))!.area).toBe(area('landfall'));
  });

  it('counts a researched design in the estimate: the counter makes the area cheaper', () => {
    const base = { reclaimed: ['landfall', 'shelf', 'shoal'] };
    const none = campaignWorld(1, data, base);
    const lancer = campaignWorld(1, data, { ...base, research: { lancer: 1 } });
    const flak = campaignWorld(1, data, { ...base, research: { flak: 1 } });
    expect(areaEstimate(lancer, data, area('garden')).powerX100).toBeGreaterThan(areaEstimate(none, data, area('garden')).powerX100);
    expect(areaEstimate(flak, data, area('garden')).powerX100).toBe(areaEstimate(none, data, area('garden')).powerX100);
    expect(areaEstimate(flak, data, area('veil')).powerX100).toBeGreaterThan(areaEstimate(none, data, area('veil')).powerX100);
  });

  it('skips an area recorded closed at the current limit and designs, and lands in the next cheapest', () => {
    const w = reclaimed('landfall');
    const first = chosen(w, by('composer'))!.area;
    const second = first === area('shelf') ? area('shoal') : area('shelf');
    const closed = new Map([[first, closedKey(w)]]);
    expect(chosen(w, by('composer'), closed)).toEqual({ area: second, forced: false });
    // A route entry that is closed is skipped too.
    const ice = new Map([[area('shelf'), closedKey(w)]]);
    expect(chosen(w, by('ice-first'), ice)).toEqual({ area: area('shoal'), forced: false });
  });

  it('when every open area is closed, lands in the cheapest anyway, forced', () => {
    const w = reclaimed('landfall');
    const cheapest = cheapestOpenArea(w, data)!;
    const closed = new Map([[area('shelf'), closedKey(w)], [area('shoal'), closedKey(w)]]);
    expect(chosen(w, by('composer'), closed)).toEqual({ area: cheapest, forced: true });
  });

  it('a closed record clears when the limit or a design changes', () => {
    const w = reclaimed('landfall');
    const key = closedKey(w);
    const closed = new Map([[area('shelf'), key], [area('shoal'), key]]);
    const lancer = campaignWorld(1, data, { reclaimed: ['landfall'], research: { lancer: 1 } });
    const flak = campaignWorld(1, data, { reclaimed: ['landfall'], research: { flak: 1 } });
    const limit = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'], research: { fleet: 1 } });
    expect(new Set([key, closedKey(lancer), closedKey(flak), closedKey(limit)]).size).toBe(4);
    expect(chosen(lancer, by('composer'), closed)!.forced).toBe(false);
    expect(chosen(flak, by('composer'), closed)!.forced).toBe(false);
    // Other research (a grind item) leaves the record valid.
    const grind = campaignWorld(1, data, { reclaimed: ['landfall'], research: { opening: 1 } });
    expect(closedKey(grind)).toBe(key);
    expect(chosen(grind, by('composer'), closed)!.forced).toBe(true);
  });

  it('returns null when nothing is open', () => {
    const w = reclaimed('landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep');
    expect(chosen(w, by('composer'))).toBeNull();
    expect(decideOverworld(w, data, by('composer'))).toEqual({ input: null, forced: false });
  });

  it('decideOverworld buys before it lands, and lands when nothing is affordable', () => {
    const w = campaignWorld(1, data, { stockpile: { ore: 50 } });
    expect(decideOverworld(w, data, by('composer'))).toEqual({ input: { type: 'buyResearch', item: research('opening') }, forced: false });
    expect(decideOverworld(createWorld(1, data), data, by('composer'))).toEqual({ input: { type: 'enterArea', area: area('landfall') }, forced: false });
  });
});

describe('strategies', () => {
  it('are the five H5 strategies and the cap-off reference', () => {
    expect(strategies.map((s) => [s.name, s.kit, s.engine ?? 'composer', s.dronesOnly ?? false, s.fleetCap ?? null])).toEqual([
      ['composer', 'full', 'composer', false, null],
      ['ice-first', 'full', 'composer', false, null],
      ['crystal-first', 'full', 'composer', false, null],
      ['no-command', 'no-command', 'composer', false, null],
      ['drones-only', 'grind', 'composer', true, null],
      ['greedy', 'full', 'h3', false, 0],
    ]);
    expect(WINNING_STRATEGIES).toEqual(['composer', 'ice-first', 'crystal-first']);
  });

  // Premise: the limit is raised to 60 so every area fits; this checks the engine's inputs and that it reclaims each area.
  for (const id of ['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep']) {
    it(`the composer plays ${id} with a raised limit: only inputs the sim accepts, and it reclaims the area`, () => {
      const w = landed(id);
      w.tun['fleet.cap'] = 60;
      for (let i = 0; i < 30 * 60 * 30 && w.capturedTick === null; i++) {
        const d = decideComposer(w, data, { dronesOnly: false, forced: false });
        expect(d.closed).toBe(false);
        for (const input of d.inputs) expect(isValidInput(w, data, input), `${w.tick} ${JSON.stringify(input)}`).toBe(true);
        step(w, data, d.inputs);
      }
      expect(w.capturedTick).not.toBeNull();
    });
  }

  it('the H3 engine (the cap-off reference) still plays Landfall', () => {
    const w = campaignWorld(1, data, { land: 'landfall' });
    for (let i = 0; i < 30 * 60 * 3 && w.capturedTick === null; i++) step(w, data, decideArea(w));
    expect(w.capturedTick).not.toBeNull();
  });

  it('never runs a yard whose design is not researched', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'], research: { flak: 1 }, land: 'shelf' });
    w.tun['fleet.cap'] = 30;
    for (let i = 0; i < 30 * 60 * 8; i++) {
      step(w, data, decideComposer(w, data, { dronesOnly: false, forced: true }).inputs);
      expect(w.yards.lancer.on).toBe(false);
    }
  });

  it('weightedMultPct drives the allocation: a lancer counters thorns more than spores', () => {
    const w = landed('garden');
    const g = guardianStatus(w, idx(w, 'heart')).guards;
    const caps = { thorn: g.thorn.cap, spore: g.spore.cap };
    expect(weightedMultPct(w.tun, 'lancer', caps)).toBeGreaterThan(weightedMultPct(w.tun, 'flak', caps));
  });
});
