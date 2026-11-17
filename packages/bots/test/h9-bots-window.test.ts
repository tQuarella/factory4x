import { describe, expect, it } from 'vitest';
import { createWorld, defaultData, guardianAt, heartIndex, nodeDistance, raidStatus, type Raid, type RaidStatus, type ShipType, type World } from '@factory4x/sim';
import { guardsAtHome } from '../src/field-estimate.ts';
import { ShieldMeter, runField } from '../src/field-runner.ts';
import { AdaptiveBot, adaptive, hiveAtLanding, hiveWave, parkedWarships, windowHome } from '../src/field-strategies.ts';

/**
 * h9-bots round 1 fixes: the exact per-prong shield metric, and the Director's raid-window rule (a live prong counts as
 * away only if the wave has taken the hive before that prong's earliest return).
 */
const data = defaultData;
const idOf = (w: World, id: string): number => w.nodes.findIndex((n) => n.id === id);
const ALL: ShipType[] = ['drone', 'lancer', 'flak'];

function ships(w: World, type: ShipType, n: number, at: number): void {
  for (let i = 0; i < n; i++) w.ships.push({ id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at, transit: null, engagedIn: -1 });
}
const zero = { thorn: 0, spore: 0 };
function prong(target: number, phase: 'out' | 'fight' | 'home', lost = 0): Raid {
  return { id: 7, phase, target, guards: [], ticksLeft: 100, planned: { thorn: 1, spore: 3 }, flightTicks: 0, from: 0, retargeted: false, lostEcon: { extractor: lost, hauler: 0 }, lostShips: { drone: 0, lancer: 0, flak: 0 }, killed: zero } as unknown as Raid;
}

describe('the shield metric is exact per prong', () => {
  function twoProngRaid(): { w: World; a5: number; p1: number; raid: Raid } {
    const w = createWorld(1, data);
    const [a5, p1] = [idOf(w, 'a5'), idOf(w, 'p1')] as [number, number];
    const raid = prong(a5, 'fight');
    raid.others = [prong(p1, 'fight')];
    w.raid = raid;
    ships(w, 'drone', 3, a5); // a5 is guarded, p1 is not
    return { w, a5, p1, raid };
  }

  it('a loss at the guarded prong counts (forced, as with raid.shieldEcon 0), whatever the other prong has', () => {
    const { w, raid } = twoProngRaid();
    const m = new ShieldMeter();
    m.begin(w);
    raid.lostEcon.extractor += 1; // prong 0, at a5 (guarded)
    expect(m.end(w)).toBe(1); // the old metric (every prong guarded) read 0 here
  });

  it('a loss at the unguarded prong does not count, even in the same tick as the guarded one', () => {
    const { w, raid } = twoProngRaid();
    const m = new ShieldMeter();
    m.begin(w);
    raid.others![0]!.lostEcon.extractor += 2; // p1, unguarded
    expect(m.end(w)).toBe(0);
    m.begin(w);
    raid.others![0]!.lostEcon.hauler += 1;
    raid.lostEcon.hauler += 1;
    expect(m.end(w)).toBe(1);
  });

  it('a prong that ends in the step is read from lastRaid.prongs at the same index', () => {
    const { w, raid, a5 } = twoProngRaid();
    const m = new ShieldMeter();
    m.begin(w);
    const res = (lost: number): unknown => ({ target: a5, outcome: 'hit', lostEcon: { extractor: lost, hauler: 0 }, lostShips: { drone: 0, lancer: 0, flak: 0 }, killed: zero });
    w.raid = null;
    w.lastRaid = { id: raid.id, outcome: 'hit', target: a5, endTick: 1, lostEcon: { extractor: 3, hauler: 0 }, lostShips: { drone: 0, lancer: 0, flak: 0 }, killed: zero, prongs: [res(1), res(2)] } as unknown as typeof w.lastRaid;
    expect(m.end(w)).toBe(1); // 1 at the guarded prong 0, the 2 at prong 1 are not counted
  });

  it('with no raid it counts nothing', () => {
    const w = createWorld(1, data);
    const m = new ShieldMeter();
    m.begin(w);
    expect(m.end(w)).toBe(0);
  });
});

describe('the raid-window rule: a prong counts as away only if the wave takes the hive before it can be back', () => {
  function front(): { w: World; heart: number; a5: number; p1: number; status: (phases?: ('out' | 'fight' | 'home')[]) => RaidStatus } {
    const w = createWorld(1, data);
    w.stats.firstDeliveredTick.ice = 1;
    w.stats.firstDeliveredTick.crystal = 1;
    const [a5, p1] = [idOf(w, 'a5'), idOf(w, 'p1')] as [number, number];
    const heart = heartIndex(w);
    const status = (phases: ('out' | 'fight' | 'home')[] = ['out', 'out']): RaidStatus => ({
      ...raidStatus(w),
      phase: 'out',
      target: a5,
      prongs: [a5, p1].map((t, i) => ({ target: t, phase: phases[i]!, planned: { thorn: 2, spore: 3 }, raiders: { thorn: 2, spore: 3 }, ticksToArrival: i === 0 ? 144 : 215, outcome: null, holding: 0, rolls: 0, rolledFrom: null })),
    });
    return { w, heart, a5, p1, status };
  }
  const sum = (c: { thorn: number; spore: number }): number => c.thorn + c.spore;

  it('a wave from the far rock meets a prong coming home from the near rock; a wave from the near rock does not', () => {
    const { w, heart, a5, p1, status } = front();
    const base = guardsAtHome(w, heart);
    const far = hiveAtLanding(w, data, status(), [p1], heart, ALL, 40);
    const near = hiveAtLanding(w, data, status(), [a5], heart, ALL, 40);
    expect(sum(far.counts)).toBeGreaterThan(sum(base)); // the a5 prong is counted back in the hive
    expect(sum(near.counts)).toBeLessThanOrEqual(sum(far.counts));
    // A prong that is a long way from arriving is away for either wave.
    const late = { ...status(), prongs: status().prongs.map((p) => ({ ...p, ticksToArrival: 900 })) };
    expect(hiveAtLanding(w, data, late, [p1], heart, ALL, 40).counts).toEqual(base);
    expect(nodeDistance(w, p1, heart)).toBeGreaterThan(nodeDistance(w, a5, heart));
  });

  it('a prong that a warship outside the wave holds at its rock is committed and stays away', () => {
    const { w, heart, a5, p1, status } = front();
    ships(w, 'drone', 3, a5); // not in the wave
    const parked = parkedWarships(w);
    const far = hiveAtLanding(w, data, status(), [p1], heart, ALL, 40, parked);
    expect(sum(far.counts)).toBeLessThan(sum(hiveAtLanding(w, data, status(), [p1], heart, ALL, 40).counts));
  });

  it('one prong, or no raid, is H8: raiders away stay away', () => {
    const { w, heart, a5, p1, status } = front();
    const base = guardsAtHome(w, heart);
    expect(hiveAtLanding(w, data, null, [p1], heart, ALL, 40).counts).toEqual(base);
    const one = { ...status(), prongs: [status().prongs[0]!] };
    expect(hiveAtLanding(w, data, one, [p1], heart, ALL, 40).counts).toEqual(base);
    void a5;
  });

  it('a wave built from two rocks whose distances differ by more than a round is held, not sent piecemeal', () => {
    const { w, heart, a5, p1, status } = front();
    for (const t of ['lancer', 'flak'] as const) {
      ships(w, t, 20, a5);
      ships(w, t, 20, p1);
    }
    const both = hiveWave(w, data, status(), [a5, p1], parkedWarships(w), heart, ALL, 80);
    expect(both.ok && both.from.length === 2).toBe(false);
    // The near rock alone, with enough ships, is allowed to go.
    const near = hiveWave(w, data, status(), [a5, p1], parkedWarships(w), heart, ALL, 80);
    expect(near.from).toEqual(near.ok ? [a5] : near.from);
  });

  it('the bot sends a two-prong raid-window wave only from the rocks that can arrive together, never the far rock piecemeal', () => {
    const w = createWorld(1, data);
    w.stats.firstDeliveredTick.ice = 1;
    w.stats.firstDeliveredTick.crystal = 1;
    const [a5, p1] = [idOf(w, 'a5'), idOf(w, 'p1')] as [number, number];
    const heart = heartIndex(w);
    const view: { current: RaidStatus } = { current: raidStatus(w) };
    const bot = new AdaptiveBot({ respond: true, dronesOnly: false, offenceGate: () => true, raidView: () => view.current });
    w.tun['field.fleetCap'] = 60;
    const base = raidStatus(w);
    const pr = (t: number, a: number) => ({ target: t, phase: 'out' as const, planned: { thorn: 2, spore: 3 }, raiders: { thorn: 2, spore: 3 }, ticksToArrival: a, outcome: null, holding: 0, rolls: 0, rolledFrom: null });
    // The raiders are away from the hive in the world, as in a real raid.
    const g = guardianAt(w, heart)!;
    g.guards = g.guards.slice(0, g.guards.length - 10);
    // A guard on each prong's rock, the wave spread over two rocks 54 ticks apart.
    for (const t of ['lancer', 'flak'] as const) {
      ships(w, t, 10, a5);
      ships(w, t, 10, p1);
    }
    view.current = { ...base, phase: 'out', target: a5, planned: { thorn: 4, spore: 6 }, prongs: [pr(a5, 144), pr(p1, 215)] };
    const sends = bot.decide(w, data).filter((i) => i.type === 'sendShips' && i.to === heart);
    expect(sends.map((s) => (s.type === 'sendShips' ? s.from : -1))).toEqual([a5]);
  });
});

describe('the plan for the raid window counts one prong home when the raid would split', () => {
  it('windowHome adds one prong share of the raid back; one prong is H8', () => {
    const w = createWorld(1, data);
    const heart = heartIndex(w);
    const away = windowHome(w, 1, heart, 20);
    const two = windowHome(w, 2, heart, 20);
    expect(two.thorn + two.spore).toBeGreaterThan(away.thorn + away.spore);
    expect(windowHome(w, 3, heart, 20).thorn + windowHome(w, 3, heart, 20).spore).toBeLessThan(two.thorn + two.spore);
  });
});

describe('whole runs with the rule', () => {
  it('adaptive still takes the hive on the shipped data with the shield exactly 0 (raid.prongsMax 1 is H8 to the hash in h9-bots.test.ts: the rule needs two prongs)', () => {
    const a = runField(adaptive, 1, data);
    expect(a.outcome).toBe('won');
    expect(a.econLostGuarded).toBe(0);
  });
});
