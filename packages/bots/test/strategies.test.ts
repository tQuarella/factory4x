import { describe, expect, it } from 'vitest';
import { campaignWorld, createWorld, guardianStatus, isValidInput, researchLevel, step, type World } from '@factory4x/sim';
// H4: an H3 game is The Deep from a constructed campaign (createWorld starts on the overworld).
import { h3World } from '../../sim/test/h3-world.ts';
// The frozen test fixture: these tests pin the shared rules' numbers (need, power, thresholds, costs), so they don't move with calibration.
import { fixtureData as data } from '../../sim/test/fixture.ts';
import {
  RESEARCH_POLICY,
  areaEstimate,
  chooseArea,
  cheapestOpenArea,
  decideArea,
  decideOverworld,
  fleetPower,
  guardNeed,
  nextEconomyOrder,
  nextPurchase,
  nextTarget,
  nodeFinished,
  openAreas,
  readyToAttack,
  strategies,
  type CampaignStrategy,
} from '../src/strategies.ts';

const N = { probe: 0, a1: 1, a2: 2, a3: 3, a4: 4, a5: 5, p1: 10, p2: 11, p3: 12, p4: 13, root: 14, heart: 15 } as const;
/** Seed 0 is Frost Gate. */
const fresh = (): World => h3World(0, data);
const by = (name: string): CampaignStrategy => strategies.find((s) => s.name === name)!;
const area = (id: string): number => data.map.areas.findIndex((a) => a.id === id);
const research = (id: string): number => data.research.findIndex((r) => r.id === id);

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

  it('send the first ship at a heart with no guards', () => {
    const w = campaignWorld(1, data, { land: 'landfall' });
    const heart = w.nodes.find((n) => n.id === 'heart')!.index;
    expect(guardNeed(w, heart)).toBe(0);
    expect(readyToAttack(w, heart, 0)).toBe(false);
    expect(readyToAttack(w, heart, 1)).toBe(true);
  });
});

describe('research policy', () => {
  /** An overworld with every item affordable at once, so only the policy's order decides. */
  const rich = (levels: Record<string, number> = {}, reclaimed: string[] = []): World =>
    campaignWorld(1, data, { reclaimed, research: levels, stockpile: { ore: 5000, ice: 500, crystal: 500 } });
  const buy = (w: World, kit: 'full' | 'designs'): string[] => {
    const order: string[] = [];
    for (let i = 0; i < 40; i++) {
      const item = nextPurchase(w, data, kit);
      if (item === null) break;
      order.push(`${item}${researchLevel(w, item) + 1}`);
      step(w, data, [{ type: 'buyResearch', item: research(item) }]);
    }
    return order;
  };

  it('buys the spec list in order when everything is affordable (core last until The Deep falls)', () => {
    expect(buy(rich(), 'full')).toEqual(['lancer1', 'flak1', 'opening1', 'extract1', 'rigs1', 'yards1', 'extract2', 'opening2', 'rigs2', 'yards2', 'extract3', 'opening3']);
  });

  it('buys the core first once The Deep is reclaimed and it is affordable', () => {
    const order = buy(rich({ lancer: 1, flak: 1 }, ['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep']), 'full');
    expect(order[0]).toBe('core1');
  });

  it('skips an unaffordable item for the first affordable one below it', () => {
    // Ore only: no ice or crystal, so neither design is affordable, but opening 1 is.
    const w = campaignWorld(1, data, { stockpile: { ore: 60, ice: 0, crystal: 0 } });
    expect(nextPurchase(w, data, 'full')).toBe('opening');
    // Flak needs ice, lancer crystal: with ice only, flak comes before the grind items.
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

  it('no-research buys only the designs and the core', () => {
    const w = rich();
    expect(buy(w, 'designs')).toEqual(['lancer1', 'flak1']);
    expect(nextPurchase(rich({ lancer: 1, flak: 1 }, ['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep']), data, 'designs')).toBe('core');
  });

  it('the kit none buys nothing', () => {
    expect(nextPurchase(rich(), data, 'none')).toBeNull();
  });

  it('lists exactly the 13 policy entries in the spec order', () => {
    expect(RESEARCH_POLICY.map(([i, l]) => `${i}${l}`)).toEqual([
      'core1', 'lancer1', 'flak1', 'opening1', 'extract1', 'rigs1', 'yards1', 'extract2', 'opening2', 'rigs2', 'yards2', 'extract3', 'opening3',
    ]);
  });
});

describe('area choice', () => {
  const reclaimed = (...ids: string[]): World => campaignWorld(1, data, { reclaimed: ids });

  it('only Landfall is open at the start; Landfall opens the two light areas', () => {
    expect(openAreas(createWorld(1, data), data)).toEqual([area('landfall')]);
    expect(openAreas(reclaimed('landfall'), data)).toEqual([area('shelf'), area('shoal')]);
  });

  it('the lines follow their routes, then the cheapest open area', () => {
    const ice = by('ice-line');
    expect(chooseArea(createWorld(1, data), data, ice)).toBe(area('landfall'));
    expect(chooseArea(reclaimed('landfall'), data, ice)).toBe(area('shelf'));
    expect(chooseArea(reclaimed('landfall', 'shelf'), data, ice)).toBe(area('veil'));
    expect(chooseArea(reclaimed('landfall', 'shelf', 'veil'), data, ice)).toBe(area('deep'));
    // After the route: the cheapest open area (Glass Shoal opens from Landfall).
    const after = chooseArea(reclaimed('landfall', 'shelf', 'veil', 'deep'), data, ice);
    expect(after).toBe(cheapestOpenArea(reclaimed('landfall', 'shelf', 'veil', 'deep'), data));
    const crystal = by('crystal-line');
    expect(chooseArea(reclaimed('landfall'), data, crystal)).toBe(area('shoal'));
    expect(chooseArea(reclaimed('landfall', 'shoal'), data, crystal)).toBe(area('garden'));
  });

  it('full-kit visits the six areas in its fixed order', () => {
    const order = by('full-kit').route;
    expect(order).toEqual(['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep']);
    for (let i = 0; i < order.length; i++) expect(chooseArea(reclaimed(...order.slice(0, i)), data, by('full-kit'))).toBe(area(order[i]!));
  });

  it('greedy takes the lowest estimate: need / best power, lowest index on ties', () => {
    const w = reclaimed('landfall');
    const e = (id: string) => areaEstimate(w, data, area(id));
    // Both light areas have a heart; with no designs the power is the drone's, so the lower need wins.
    const shelf = e('shelf');
    const shoal = e('shoal');
    const expected = shelf.need * shoal.powerX100 <= shoal.need * shelf.powerX100 ? 'shelf' : 'shoal';
    expect(chooseArea(w, data, by('greedy'))).toBe(area(expected));
    // Landfall's heart has no guards: need 0, so it is chosen first from the start.
    expect(areaEstimate(createWorld(1, data), data, area('landfall')).need).toBe(0);
    expect(chooseArea(createWorld(1, data), data, by('greedy'))).toBe(area('landfall'));
  });

  it('greedy counts a researched design in the power: the design that counters the heart makes the area cheaper', () => {
    const none = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'shoal'] });
    const lancer = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'shoal'], research: { lancer: 1 } });
    const flak = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'shoal'], research: { flak: 1 } });
    // Thorn Garden's heart is Lancer Strong, Spore Veil's Flak Strong (DESIGN.md H4 area guards).
    expect(areaEstimate(lancer, data, area('garden')).powerX100).toBeGreaterThan(areaEstimate(none, data, area('garden')).powerX100);
    expect(areaEstimate(flak, data, area('garden')).powerX100).toBe(areaEstimate(none, data, area('garden')).powerX100);
    expect(areaEstimate(flak, data, area('veil')).powerX100).toBeGreaterThan(areaEstimate(none, data, area('veil')).powerX100);
  });

  it('returns null when nothing is open', () => {
    const w = reclaimed('landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep');
    expect(chooseArea(w, data, by('greedy'))).toBeNull();
    expect(decideOverworld(w, data, by('greedy'))).toBeNull();
  });

  it('decideOverworld buys before it lands, and lands when nothing is affordable', () => {
    const w = campaignWorld(1, data, { stockpile: { ore: 50 } });
    expect(decideOverworld(w, data, by('greedy'))).toEqual({ type: 'buyResearch', item: research('opening') });
    expect(decideOverworld(createWorld(1, data), data, by('greedy'))).toEqual({ type: 'enterArea', area: area('landfall') });
  });
});

describe('strategies', () => {
  it('are the spec five, with no-research buying only designs', () => {
    expect(strategies.map((s) => [s.name, s.kit])).toEqual([
      ['ice-line', 'full'],
      ['crystal-line', 'full'],
      ['full-kit', 'full'],
      ['greedy', 'full'],
      ['no-research', 'designs'],
    ]);
  });

  for (const id of ['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep']) {
    it(`the in-area engine plays ${id}: only inputs the sim accepts, and it reclaims the area`, () => {
      const reclaimed = ['landfall', 'shelf', 'shoal', 'veil', 'garden'].filter((r) => r !== id);
      const w = campaignWorld(1, data, { reclaimed: id === 'landfall' ? [] : reclaimed, research: { lancer: 1, flak: 1 }, land: id });
      for (let i = 0; i < 30 * 60 * 30 && w.capturedTick === null; i++) {
        const inputs = decideArea(w);
        for (const input of inputs) expect(isValidInput(w, data, input), `${w.tick} ${JSON.stringify(input)}`).toBe(true);
        step(w, data, inputs);
      }
      expect(w.capturedTick).not.toBeNull();
    });
  }

  it('never runs a yard whose design is not researched', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'], research: { flak: 1 }, land: 'shelf' });
    for (let i = 0; i < 30 * 60 * 8; i++) {
      step(w, data, decideArea(w));
      expect(w.yards.lancer.on).toBe(false); // never researched
    }
  });
});
