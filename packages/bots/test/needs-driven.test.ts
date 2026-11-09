import { describe, expect, it } from 'vitest';
import { campaignWorld, defaultData as data, type World } from '@factory4x/sim';
import { advancingAreas, areaEstimate, chooseArea, closedKey, decideOverworld, firstUnmetGoal, openAreas, strategies, type CampaignStrategy, type Goal } from '../src/strategies.ts';

/**
 * H6 area choice on the shipped map. Premises are explicit and none pins a tuned value: the structure (areas, lanes,
 * relays, sides) is what the tests read, a stockpile of 10000 of each resource is "rich" (every cost is below it) and
 * an empty one is "poor".
 */
const by = (name: string): CampaignStrategy => strategies.find((s) => s.name === name)!;
const ix = (id: string): number => data.map.areas.findIndex((a) => a.id === id);
const RICH = { ore: 10000, ice: 10000, crystal: 10000 };
const DESIGNS = { lancer: 1, flak: 1 } as const;
const world = (reclaimed: string[], opts: { rich?: boolean; designs?: boolean } = {}): World =>
  campaignWorld(1, data, { reclaimed, research: opts.designs ? DESIGNS : {}, stockpile: opts.rich ? RICH : {} });
const choice = (w: World, name: string, closed = new Map<number, string>()) => chooseArea(w, data, by(name), closed);
const kinds = (g: Goal | null): string => (g === null ? 'none' : g.kind === 'relay' ? `relay${g.band}` : g.kind === 'area' ? `area:${g.id}` : g.kind);

describe('the goal order (needs-driven area choice)', () => {
  it('1. the designs while the stockpile cannot afford both; the missing resources are what the stock lacks', () => {
    const g = firstUnmetGoal(world(['landfall']), data);
    expect(g!.kind).toBe('designs');
    if (g!.kind === 'designs') expect(g!.missing.ice).toBeGreaterThan(0);
    expect(kinds(firstUnmetGoal(world(['landfall'], { rich: true }), data))).toBe('relay1');
  });

  it('1. a design already bought is not counted, and one affordable design is not enough', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'], research: { lancer: 1 }, stockpile: { ore: 10000, ice: 10000, crystal: 0 } });
    expect(kinds(firstUnmetGoal(w, data))).toBe('relay1'); // only the flak design is left and its ice is in stock
    const poor = campaignWorld(1, data, { reclaimed: ['landfall'], research: { lancer: 1 }, stockpile: { ore: 10000, ice: 0, crystal: 10000 } });
    expect(kinds(firstUnmetGoal(poor, data))).toBe('designs');
  });

  it('2-4. then a band 1 relay, a band 2 relay, The Deep, in that order (a relay of either side counts)', () => {
    const goal = (reclaimed: string[]): string => kinds(firstUnmetGoal(world(reclaimed, { rich: true, designs: true }), data));
    expect(goal(['landfall', 'shelf'])).toBe('relay1');
    expect(goal(['landfall', 'shelf', 'rime'])).toBe('relay2');
    expect(goal(['landfall', 'shoal', 'glint'])).toBe('relay2');
    expect(goal(['landfall', 'shelf', 'rime', 'spire'])).toBe('area:deep');
    expect(goal(['landfall', 'shelf', 'rime', 'mire', 'deep'])).toBe('none');
  });

  it('a relay of band 2 taken before band 1 does not skip the band 1 goal', () => {
    expect(kinds(firstUnmetGoal(world(['landfall', 'mire'], { rich: true, designs: true }), data))).toBe('relay1');
  });

  it('5. the core: unmet while it is unaffordable once everything else is done, met when the stock covers it', () => {
    const done = ['landfall', 'shelf', 'rime', 'mire', 'deep'];
    const poor = campaignWorld(1, data, { reclaimed: done, research: DESIGNS });
    const g = firstUnmetGoal(poor, data);
    expect(g!.kind).toBe('core');
    expect(firstUnmetGoal(world(done, { rich: true, designs: true }), data)).toBeNull();
  });

  it('a goal the data has no relay for is skipped (a map with no relays goes straight to The Deep)', () => {
    const noRelays = structuredClone(data);
    for (const a of noRelays.map.areas) a.relay = false;
    const w = campaignWorld(1, noRelays, { reclaimed: ['landfall'], research: DESIGNS, stockpile: RICH });
    expect(kinds(firstUnmetGoal(w, noRelays))).toBe('area:deep');
  });
});

describe('landing in the area that advances the goal', () => {
  it('a resource goal: only areas whose haul adds a missing resource advance it', () => {
    const w = world(['landfall']);
    const g = firstUnmetGoal(w, data)!;
    // Poor stock: both light areas pay what the designs lack; with only ice (or only crystal) missing, only its side's area does.
    expect(advancingAreas(w, data, g, openAreas(w, data))).toEqual([ix('shelf'), ix('shoal')]);
    const needIce: Goal = { kind: 'designs', missing: { ore: 0, ice: 5, crystal: 0 } };
    expect(advancingAreas(w, data, needIce, openAreas(w, data))).toEqual([ix('shelf')]);
    const needCrystal: Goal = { kind: 'designs', missing: { ore: 0, ice: 0, crystal: 5 } };
    expect(advancingAreas(w, data, needCrystal, openAreas(w, data))).toEqual([ix('shoal')]);
  });

  it('a relay goal: the relay if enterable, else the areas lane-joined to one', () => {
    const near = world(['landfall'], { rich: true, designs: true });
    const g1 = firstUnmetGoal(near, data)!;
    expect(advancingAreas(near, data, g1, openAreas(near, data))).toEqual([ix('shelf'), ix('shoal')]);
    const there = world(['landfall', 'shelf'], { rich: true, designs: true });
    expect(advancingAreas(there, data, g1, openAreas(there, data))).toEqual([ix('rime')]);
  });

  it('a band locked area is not a candidate: with the band 1 relay not reclaimed, band 2 is never chosen', () => {
    // Premise: Frost Shelf and Glass Shoal reclaimed; Spore Veil is two lanes away, and band 2 is locked anyway.
    const w = world(['landfall', 'shelf', 'shoal'], { rich: true, designs: true });
    expect(openAreas(w, data)).toEqual([ix('rime'), ix('glint')]);
    expect([ix('rime'), ix('glint')]).toContain(choice(w, 'composer')!.area);
  });

  it('with every goal-advancing area closed, any other live area is landed in (the goal is a preference)', () => {
    const w = world(['landfall', 'shelf'], { rich: true, designs: true });
    const closed = new Map([[ix('rime'), closedKey(w, data)]]);
    expect(choice(w, 'composer', closed)).toEqual({ area: ix('shoal'), forced: false });
  });

  it('a closed area is skipped, and when every open area is closed the cheapest is forced', () => {
    const w = world(['landfall'], { rich: true, designs: true });
    const key = closedKey(w, data);
    expect(choice(w, 'ice-first', new Map([[ix('shelf'), key]]))).toEqual({ area: ix('shoal'), forced: false });
    const all = choice(w, 'composer', new Map([[ix('shelf'), key], [ix('shoal'), key]]))!;
    expect(all.forced).toBe(true);
    expect([ix('shelf'), ix('shoal')]).toContain(all.area);
  });
});

describe('tie-breaks and side preferences', () => {
  // Premise: Glass Shoal gets Frost Shelf's guards, so the two light areas have exactly the same estimate; the sides still differ.
  const tiedData = structuredClone(data);
  tiedData.map.areas[ix('shoal')]!.layout = structuredClone(tiedData.map.areas[ix('shelf')]!.layout);
  const tied = (): World => campaignWorld(1, tiedData, { reclaimed: ['landfall'], stockpile: RICH });
  const pick = (name: string): number => chooseArea(tied(), tiedData, by(name))!.area;

  it('the premise holds: the two estimates tie exactly', () => {
    const e = (id: string) => areaEstimate(tied(), tiedData, ix(id));
    expect(e('shelf')).toEqual(e('shoal'));
  });

  it('an exact tie goes to data order when there is no side preference', () => {
    expect(pick('composer')).toBe(ix('shelf'));
  });

  it('the side preference decides a tie either way: crystal-first takes the later Glass Shoal, ice-first the Shelf', () => {
    expect(pick('crystal-first')).toBe(ix('shoal'));
    expect(pick('ice-first')).toBe(ix('shelf'));
  });

  it('a side preference outweighs a cheaper estimate on the other side (it narrows the candidates first)', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'], stockpile: RICH });
    const cheaper = choice(w, 'composer')!.area;
    const other = cheaper === ix('shelf') ? 'crystal-first' : 'ice-first';
    expect(choice(w, other)!.area).not.toBe(cheaper);
  });

  it('a side preference never blocks the goal: when no candidate is on its side it takes the cheapest of those that advance', () => {
    // Premise: the band 1 relay goal, Frost Shelf reclaimed: the only advancing area is the ice relay, so crystal-first goes there too.
    const w = world(['landfall', 'shelf'], { rich: true, designs: true });
    expect(choice(w, 'crystal-first')!.area).toBe(ix('rime'));
  });

  it('drones-only has no goal: the cheapest open area, whatever it advances', () => {
    const w = world(['landfall', 'shelf', 'shoal', 'rime'], { rich: true });
    expect(openAreas(w, data)).toContain(ix('mire'));
    const d = choice(w, 'drones-only')!;
    expect(openAreas(w, data)).toContain(d.area);
    expect(d.forced).toBe(false);
  });

  it('decideOverworld buys first, then lands where the choice says', () => {
    const w = world(['landfall'], { rich: true });
    expect(decideOverworld(w, data, by('composer')).input!.type).toBe('buyResearch');
    // Premise: every purchasable item is already at its maximum, so there is nothing left to buy.
    const spent = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'], research: { ...DESIGNS, opening: 3, extract: 3, rigs: 2, yards: 2 }, stockpile: RICH });
    expect(decideOverworld(spent, data, by('composer'))).toEqual({ input: { type: 'enterArea', area: ix('rime') }, forced: false });
  });
});
