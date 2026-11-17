import { describe, expect, it } from 'vitest';
import { PROBE, createWorld, defaultData, fieldSummary, guardianAt, heartIndex, hiveAfter, raidStatus, type Input, type RaidStatus, type ShipType, type ShipTypeCounts, type World } from '@factory4x/sim';
import { fieldMix, flightTicks, guardFull, guardsAtHome, guardsOnArrival } from '../src/field-estimate.ts';
import { runField, type FieldResult } from '../src/field-runner.ts';
import { AdaptiveBot, adaptive, hiveAtLanding, hiveWave, onePush, parkedWarships, twoPush, twoThirds, weightsFor, fieldStrategies } from '../src/field-strategies.ts';
import { atLeastSlower, computeH10Lines, eventsBeforeWin, landingPct, pctText, target1, target3, target4, winLanding } from '../src/h10-lines.ts';

/**
 * h10-bots: the flight allowance (`hiveAfter`), the `one-push` and `two-push` controls, the no-plan-fits table, and the
 * report's hive columns and targets 1 to 6.
 */
const data = defaultData;
const ALL: ShipType[] = ['drone', 'lancer', 'flak'];
const sum = (c: { thorn: number; spore: number }): number => c.thorn + c.spore;
const total = (c: ShipTypeCounts): number => c.drone + c.lancer + c.flak;

function ships(w: World, type: ShipType, n: number, at: number): void {
  for (let i = 0; i < n; i++) w.ships.push({ id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at, transit: null, engagedIn: -1 });
}
function shipsOf(w: World, fleet: ShipTypeCounts, at: number): void {
  for (const t of ALL) ships(w, t, fleet[t], at);
}
/** A field world with both pockets taken (Lancer and Flak unlocked), a fleet limit of `cap`, and the hive cut to `keep` guards (the lowest ids stay). */
function setup(rebuildTicks: number, cap: number, keep: number | null): { w: World; heart: number } {
  const w = createWorld(1, data);
  w.tun['hive.rebuildTicks'] = rebuildTicks;
  w.tun['field.fleetCap'] = cap;
  w.tun['raid.enabled'] = 0;
  w.stats.firstDeliveredTick.ice = 1;
  w.stats.firstDeliveredTick.crystal = 1;
  const heart = heartIndex(w);
  if (keep !== null) {
    const g = guardianAt(w, heart)!;
    g.guards = g.guards.slice(0, keep);
  }
  return { w, heart };
}
const bot = (hive: 'live' | 'full' | 'two-push'): AdaptiveBot => new AdaptiveBot({ respond: true, dronesOnly: false, offenceGate: () => true, hive });
const heartSends = (inputs: readonly Input[], heart: number): Input[] => inputs.filter((i) => i.type === 'sendShips' && i.to === heart);
const sent = (inputs: readonly Input[], heart: number): ShipTypeCounts => {
  const c: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
  for (const i of heartSends(inputs, heart)) if (i.type === 'sendShips') for (const t of ALL) c[t] += i.counts[t];
  return c;
};

describe('change 1: hive waves are sized at hiveAfter(world, arrive)', () => {
  it('with a deficit and hive.rebuildTicks 600 the wave is sized for the guards at landing, not the guards now', () => {
    const { w, heart } = setup(600, 60, 14);
    // The queue is 10 ticks from its next guard: it lands one guard (and only one) before a wave from the probe arrives.
    w.field!.hiveRebuildProgress = 590;
    const flight = flightTicks(w, [PROBE], heart);
    expect(flight).toBeGreaterThanOrEqual(10);
    expect(flight).toBeLessThan(610);
    const now = guardsAtHome(w, heart);
    const landing = hiveAfter(w, flight);
    expect(sum(landing)).toBe(sum(now) + 1);
    const got = hiveAtLanding(w, data, null, [PROBE], heart, ALL, 60);
    expect(got.counts).toEqual(landing);
    expect(got.mix).toEqual(fieldMix(w, data, heart, ALL, 60, landing));
    // The old read (the hive as it is now) is smaller, so the old wave could be short by the rebuilt guard.
    const old = fieldMix(w, data, heart, ALL, 60, now)!;
    expect(got.mix!.total).toBeGreaterThanOrEqual(old.total);
    // The mix is the one the estimate wins with against the landing guards: the same wave fights them in the real sim.
    expect(guardsOnArrival(w, heart, [PROBE])).toEqual(landing);
  });

  it('a pocket is sized as it is now (rule 9 is untouched by H10)', () => {
    const { w } = setup(600, 60, null);
    const p1 = w.nodes.findIndex((n) => n.kind === 'pocket');
    expect(guardsOnArrival(w, p1, [PROBE])).toEqual(guardsAtHome(w, p1));
  });

  it('at hive.rebuildTicks 0 the hive is sized as it is now, as in H9 (R9 is not read)', () => {
    const { w, heart } = setup(0, 60, 14);
    w.field!.hiveRebuildProgress = 0;
    const g = guardianAt(w, heart)!;
    g.regrowProgress = { thorn: g.regrowProgress.thorn, spore: g.regrowProgress.spore };
    expect(hiveAfter(w, 4000)).not.toEqual(guardsAtHome(w, heart)); // R9 would have regrown some
    expect(guardsOnArrival(w, heart, [PROBE])).toEqual(guardsAtHome(w, heart));
    expect(hiveAtLanding(w, data, null, [PROBE], heart, ALL, 60).counts).toEqual(guardsAtHome(w, heart));
  });

  it('the raid-window path (two prongs) starts from the landing guards too', () => {
    const { w, heart } = setup(600, 60, 14);
    w.field!.hiveRebuildProgress = 590;
    const a5 = w.nodes.findIndex((n) => n.id === 'a5');
    const p1 = w.nodes.findIndex((n) => n.id === 'p1');
    const status: RaidStatus = {
      ...raidStatus(w),
      phase: 'out',
      target: a5,
      prongs: [a5, p1].map((t) => ({ target: t, phase: 'out' as const, planned: { thorn: 1, spore: 1 }, raiders: { thorn: 1, spore: 1 }, ticksToArrival: 900, outcome: null, holding: 0, rolls: 0, rolledFrom: null })),
    };
    // Far from arriving, both prongs stay away: the counts are exactly the landing guards.
    expect(hiveAtLanding(w, data, status, [p1], heart, ALL, 60).counts).toEqual(hiveAfter(w, flightTicks(w, [p1], heart)));
  });

  it("smallestHiveWave (and so limitEconomy's reserve) is the wave for the landing guards", () => {
    const { w, heart } = setup(600, 60, 14);
    w.field!.hiveRebuildProgress = 590;
    const b = bot('live');
    const smallest = (b as unknown as { smallestHiveWave: (w: World, d: typeof data, t: ShipType[], l: number) => number | null }).smallestHiveWave(w, data, ALL, 60);
    expect(smallest).toBe(fieldMix(w, data, heart, ALL, 60, hiveAfter(w, flightTicks(w, [PROBE], heart)))!.total);
    b.decide(w, data);
    expect((b as unknown as { reserve: number }).reserve).toBe(smallest);
  });
});

describe('twoThirds: ceil(2W / 3) ships in the full-caps wave W\'s mix, floors per type, the remainder to the counter', () => {
  it('splits 5 / 6 / 4 (15 ships) into 10: floors 3 / 4 / 2, and the 1 left goes to the counter', () => {
    const w = { total: 15, fleet: { drone: 5, lancer: 6, flak: 4 } };
    expect(twoThirds(w, 'lancer')).toEqual({ total: 10, fleet: { drone: 3, lancer: 5, flak: 2 } });
    expect(twoThirds(w, 'flak')).toEqual({ total: 10, fleet: { drone: 3, lancer: 4, flak: 3 } });
  });
  it('rounds up: 16 ships are 11, and a type with floor 0 stays 0', () => {
    const r = twoThirds({ total: 16, fleet: { drone: 0, lancer: 11, flak: 5 } }, 'lancer');
    expect(r.total).toBe(11);
    expect(total(r.fleet)).toBe(11);
    expect(r.fleet.drone).toBe(0);
  });
});

describe('one-push: every hive wave is for the hive at full caps', () => {
  it('never launches below the full-caps wave: ships that cover the weakened hive stay home (adaptive sends them)', () => {
    const { w, heart } = setup(600, 60, 14);
    const caps = guardFull(w, heart);
    const live = fieldMix(w, data, heart, ALL, 60, hiveAfter(w, flightTicks(w, [PROBE], heart)))!;
    const full = fieldMix(w, data, heart, ALL, 60, caps)!;
    expect(live.total).toBeLessThan(full.total);
    shipsOf(w, live.fleet, PROBE);
    expect(sent(bot('live').decide(w, data), heart)).toEqual(live.fleet);
    expect(heartSends(bot('full').decide(w, data), heart)).toEqual([]);
    // One ship short of the full-caps wave (it is still covered by the type counts) is not enough either.
    const w2 = setup(600, 60, 14).w;
    shipsOf(w2, { ...full.fleet, drone: full.fleet.drone + (full.fleet.drone === 0 ? 0 : -1), lancer: full.fleet.drone === 0 ? full.fleet.lancer - 1 : full.fleet.lancer }, PROBE);
    expect(heartSends(bot('full').decide(w2, data), heart)).toEqual([]);
    // With the full-caps wave at home it goes, in that mix.
    const w3 = setup(600, 60, 14).w;
    shipsOf(w3, full.fleet, PROBE);
    expect(sent(bot('full').decide(w3, data), heart)).toEqual(full.fleet);
  });

  it('the full-caps wave never fits under the fleet limit: it never launches (it times out; target 3 is then met)', () => {
    const { w, heart } = setup(600, 14, 14);
    expect(fieldMix(w, data, heart, ALL, 14, guardFull(w, heart))).toBeNull();
    ships(w, 'lancer', 20, PROBE);
    ships(w, 'flak', 20, PROBE);
    expect(heartSends(bot('full').decide(w, data), heart)).toEqual([]);
  });

  it('it builds for full caps: its weights follow the full-caps wave when the hive is at the keep line and no raid comes', () => {
    const { w, heart } = setup(600, 60, 14);
    const full = fieldMix(w, data, heart, ALL, 60, guardFull(w, heart))!;
    const inputs = bot('full').decide(w, data);
    const weights = weightsFor(w, full.fleet);
    for (const t of ALL) {
      const set = inputs.find((i) => i.type === 'setAlloc' && i.shipType === t);
      if (weights[t] > 0) expect(set).toMatchObject({ weight: weights[t] });
    }
  });

  it('with a raid mustering and the hive low, it defends first and does not push below full caps', () => {
    const { w, heart } = setup(600, 60, 14);
    const a5 = w.nodes.findIndex((n) => n.id === 'a5');
    const live = fieldMix(w, data, heart, ALL, 60, hiveAfter(w, flightTicks(w, [PROBE], heart)))!;
    shipsOf(w, live.fleet, PROBE);
    const view: RaidStatus = { ...raidStatus(w), phase: 'muster', target: a5, planned: { thorn: 2, spore: 3 }, prongs: [{ target: a5, phase: 'muster', planned: { thorn: 2, spore: 3 }, raiders: { thorn: 2, spore: 3 }, ticksToArrival: 0, outcome: null, holding: 0, rolls: 0, rolledFrom: null }] };
    w.field!.mine[a5] = true;
    const b = new AdaptiveBot({ respond: true, dronesOnly: false, offenceGate: () => true, hive: 'full', raidView: () => view });
    const inputs = b.decide(w, data);
    expect(heartSends(inputs, heart)).toEqual([]);
    expect(inputs.some((i) => i.type === 'sendShips' && i.to === a5)).toBe(true);
  });
});

describe('two-push: its first hive push is ceil(2W / 3) ships of W\'s mix, then it plays adaptive', () => {
  it('waits for 2W/3 sound ships, then sends exactly that mix', () => {
    const { w, heart } = setup(600, 60, null);
    const full = fieldMix(w, data, heart, ALL, 60, guardFull(w, heart))!;
    const hiveCounter = guardFull(w, heart).spore > guardFull(w, heart).thorn ? 'flak' : 'lancer';
    const want = twoThirds(full, hiveCounter);
    expect(want.total).toBe(Math.ceil((2 * full.total) / 3));
    expect(want.total).toBeLessThan(full.total);
    // One ship short: it waits.
    const short = { ...want.fleet };
    const t = ALL.find((x) => short[x] > 0)!;
    short[t]--;
    shipsOf(w, short, PROBE);
    const b = bot('two-push');
    expect(b.sizing).toBe('two-push');
    expect(heartSends(b.decide(w, data), heart)).toEqual([]);
    // With the ship it goes, in the scaled mix.
    ships(w, t, 1, PROBE);
    expect(sent(b.decide(w, data), heart)).toEqual(want.fleet);
    expect(b.sizing).toBe('two-push'); // the push is flying: still the first push until it ends
  });

  it('the first push ends when no player ship is at or heading for the hive, and it plays adaptive after (sized for the live hive)', () => {
    const { w, heart } = setup(600, 60, 14);
    const full = fieldMix(w, data, heart, ALL, 60, guardFull(w, heart))!;
    const counter = guardFull(w, heart).spore > guardFull(w, heart).thorn ? 'flak' : 'lancer';
    const first = twoThirds(full, counter);
    shipsOf(w, first.fleet, PROBE);
    const b = bot('two-push');
    expect(sent(b.decide(w, data), heart)).toEqual(first.fleet);
    // The wave is in flight toward the hive: still the first push.
    for (const s of w.ships) {
      s.at = null;
      s.transit = { from: PROBE, to: heart, ticksLeft: 50 } as unknown as typeof s.transit;
    }
    b.decide(w, data);
    expect(b.sizing).toBe('two-push');
    // Lost: no ship left. The bot is adaptive from the next decision, and sends ships that cover the weakened hive alone.
    w.ships = [];
    const live = fieldMix(w, data, heart, ALL, 60, hiveAfter(w, flightTicks(w, [PROBE], heart)))!;
    shipsOf(w, live.fleet, PROBE);
    expect(sent(b.decide(w, data), heart)).toEqual(live.fleet);
    expect(b.sizing).toBe('live');
  });

  it('the full-caps wave never fits under the fleet limit: its first push still goes at 2W/3', () => {
    const { w, heart } = setup(600, 14, null);
    expect(fieldMix(w, data, heart, ALL, 14, guardFull(w, heart))).toBeNull();
    const full = fieldMix(w, data, heart, ALL, 60, guardFull(w, heart))!;
    const counter = guardFull(w, heart).spore > guardFull(w, heart).thorn ? 'flak' : 'lancer';
    const want = twoThirds(full, counter);
    expect(want.total).toBeLessThanOrEqual(14);
    shipsOf(w, want.fleet, PROBE);
    expect(sent(bot('two-push').decide(w, data), heart)).toEqual(want.fleet);
  });

  it('with a raid mustering it defends ships that are not on a post, and its first push waits for 2W/3 sound ships on the post', () => {
    const { w, heart } = setup(600, 60, null);
    const a5 = w.nodes.findIndex((n) => n.id === 'a5');
    const full = fieldMix(w, data, heart, ALL, 60, guardFull(w, heart))!;
    const counter = guardFull(w, heart).spore > guardFull(w, heart).thorn ? 'flak' : 'lancer';
    const want = twoThirds(full, counter);
    const view: RaidStatus = { ...raidStatus(w), phase: 'muster', target: a5, planned: { thorn: 2, spore: 3 }, prongs: [{ target: a5, phase: 'muster', planned: { thorn: 2, spore: 3 }, raiders: { thorn: 2, spore: 3 }, ticksToArrival: 0, outcome: null, holding: 0, rolls: 0, rolledFrom: null }] };
    w.field!.mine[a5] = true;
    const make = (): AdaptiveBot => new AdaptiveBot({ respond: true, dronesOnly: false, offenceGate: () => true, hive: 'two-push', raidView: () => view });
    // Ships at the probe, not on the post: it defends (they go to the rock), and nothing goes to the hive.
    shipsOf(w, want.fleet, PROBE);
    const defend = make().decide(w, data);
    expect(heartSends(defend, heart)).toEqual([]);
    expect(defend.some((i) => i.type === 'sendShips' && i.to === a5)).toBe(true);
    // On the post, one short of 2W/3: it waits. With 2W/3 sound ships there, the push goes (as H9: the push goes before the defence).
    const w2 = setup(600, 60, null).w;
    w2.field!.mine[a5] = true;
    const short = { ...want.fleet };
    const t = ALL.find((x) => short[x] > 0)!;
    short[t]--;
    shipsOf(w2, short, a5);
    expect(heartSends(make().decide(w2, data), heart)).toEqual([]);
    ships(w2, t, 1, a5);
    expect(sent(make().decide(w2, data), heart)).toEqual(want.fleet);
  });
});

describe('adaptive, with a weakened hive and no raid, sizes the next wave for the weaker hive (a push that lost)', () => {
  it('it sends the smaller wave, builds toward the live wave, and uses the hive-at-keep-line plan with no posts', () => {
    const { w, heart } = setup(600, 60, 15);
    const live = fieldMix(w, data, heart, ALL, 60, hiveAfter(w, flightTicks(w, [PROBE], heart)))!;
    const inputs = bot('live').decide(w, data);
    expect(heartSends(inputs, heart)).toEqual([]);
    const weights = weightsFor(w, live.fleet);
    for (const t of ALL) if (weights[t] > 0) expect(inputs.find((i) => i.type === 'setAlloc' && i.shipType === t)).toMatchObject({ weight: weights[t] });
    void parkedWarships;
    void hiveWave;
  });
});

describe('the registry', () => {
  it('one-push and two-push are report-only strategies with the spec descriptions, and no strategy is gated that was not', () => {
    for (const s of [onePush, twoPush]) {
      expect(fieldStrategies).toContain(s);
      expect(s.expectedWin).toBe(false);
    }
    expect(onePush.name).toBe('one-push');
    expect(onePush.description).toContain('full caps');
    expect(twoPush.name).toBe('two-push');
    expect(twoPush.description).toContain('two thirds');
    expect(fieldStrategies.filter((s) => s.expectedWin).map((s) => s.name)).toEqual(['adaptive', 'greedy']);
  });
});

// ---- The report ----------------------------------------------------------------------------------------------------

function result(over: Partial<FieldResult> & { strategy: string }): FieldResult {
  return {
    variant: null,
    seed: 1,
    outcome: 'won',
    ticks: 30000,
    hiveTick: 30000,
    raids: { mustered: 0, beaten: 0, hit: 0, turnedBack: 0 },
    raidProngs: { beaten: 0, hit: 0, turnedBack: 0 },
    raidRolls: 0,
    hive: { cap: 30, lostToRaids: 0, lostToPushes: 0, pushes: [], events: [], perMinute: [] },
    raidLog: [],
    ...over,
  } as unknown as FieldResult;
}
const won = (strategy: string, ticks: number, extra: Partial<FieldResult> = {}): FieldResult => result({ strategy, ticks, hiveTick: ticks, ...extra });
const lost = (strategy: string): FieldResult => result({ strategy, outcome: 'timeout', hiveTick: null, ticks: 81000 });

describe('the targets, per seed', () => {
  const a = won('adaptive', 28800);
  it('target 1 and 3: at least 10% slower, or does not win; adaptive must win', () => {
    expect(target1(a, won('undefended', 31680))).toBe(true); // exactly +10%
    expect(target1(a, won('undefended', 31679))).toBe(false);
    expect(target1(a, lost('undefended'))).toBe(true);
    expect(target1(won('adaptive', 28800, { outcome: 'timeout', hiveTick: null }), lost('undefended'))).toBe(false);
    expect(target3(a, won('one-push', 40000))).toBe(true);
    expect(target3(a, won('one-push', 28800))).toBe(false);
    expect(target3(a, lost('one-push'))).toBe(true);
    expect(atLeastSlower(a, won('x', 28800 * 2), 100)).toBe(true);
  });
  it('target 4: two-push no more than 10% behind one-push, or wins where one-push does not', () => {
    const o = won('one-push', 40000);
    expect(target4(o, won('two-push', 44000))).toBe(true); // exactly +10%
    expect(target4(o, won('two-push', 44001))).toBe(false);
    expect(target4(o, won('two-push', 30000))).toBe(true); // faster is fine
    expect(target4(lost('one-push'), won('two-push', 60000))).toBe(true);
    expect(target4(o, lost('two-push'))).toBe(false);
    expect(target4(lost('one-push'), lost('two-push'))).toBe(false); // neither won: not "wins where one-push does not"
  });
  it('target 2 counts events before the win, and the landing against the caps', () => {
    const ad = won('adaptive', 30000, {
      hive: { cap: 30, lostToRaids: 6, lostToPushes: 12, pushes: [{ tick: 20000, home: 28, cap: 30, killed: 7, won: false }, { tick: 29000, home: 22, cap: 30, killed: 12, won: true }], events: [{ tick: 9000, kind: 'prong', killed: 3 }, { tick: 21000, kind: 'push', killed: 7 }, { tick: 31000, kind: 'prong', killed: 4 }], perMinute: [] },
    });
    expect(winLanding(ad)).toEqual({ home: 22, cap: 30 });
    expect(landingPct(ad)).toBe(73);
    expect(eventsBeforeWin(ad)).toBe(2); // the third is after the win
    expect(winLanding(lost('adaptive'))).toBeNull();
  });
  it('pctText says +N% or the outcome', () => {
    expect(pctText(a, won('x', 31680))).toBe('+10%');
    expect(pctText(a, won('x', 25920))).toBe('-10%');
    expect(pctText(a, lost('x'))).toBe('timeout');
  });
});

describe('the report lines (REPORTED, never MET or MISSED), over the suite and the sweep', () => {
  const suite = [
    won('adaptive', 30000, { hive: { cap: 30, lostToRaids: 0, lostToPushes: 0, pushes: [{ tick: 29000, home: 20, cap: 30, killed: 10, won: true }], events: [{ tick: 9000, kind: 'prong', killed: 3 }, { tick: 20000, kind: 'push', killed: 5 }], perMinute: [] }, raidLog: [{ startTick: 4862, endTick: 5973, outcome: 'hit', econLost: 2, planned: { thorn: 1, spore: 2 }, prongs: [] }] }),
    won('greedy', 31000),
    won('undefended', 36000),
    won('one-push', 40000),
    won('two-push', 41000),
  ];
  it('lines 1 to 4 and 6 are computed and marked reported', () => {
    const lines = computeH10Lines(suite, null, 600);
    expect(lines).toHaveLength(6);
    expect(lines.every((l) => l.reported === true)).toBe(true);
    expect(lines.map((l) => l.pass)).toEqual([true, true, true, true, false, true]);
    expect(lines[4]!.detail).toContain('not run');
    expect(lines[0]!.detail).toContain('+20%');
  });
  it('line 5 reads the sweep at 0.75 and 1.25 times the shipped value, and is missed when one side fails', () => {
    const run = (ticks: number, undefendedTicks: number): { rebuildTicks: number; results: FieldResult[] } => ({ rebuildTicks: ticks, results: [won('adaptive', 30000), won('undefended', undefendedTicks), won('one-push', 40000)] });
    const ok = computeH10Lines(suite, [run(450, 36000), run(600, 36000), run(750, 36000)], 600)[4]!;
    expect(ok.pass).toBe(true);
    const miss = computeH10Lines(suite, [run(450, 36000), run(600, 36000), run(750, 30500)], 600)[4]!;
    expect(miss.pass).toBe(false);
    expect(miss.detail).toContain('hive.rebuildTicks 750: target 1 MISS');
    // Shipped 0 (h10-bots): centred on 600, so 450 and 750.
    const zero = computeH10Lines(suite, [run(450, 36000), run(600, 36000), run(750, 36000)], 0)[4]!;
    expect(zero.pass).toBe(true);
    expect(zero.detail).toContain('hive.rebuildTicks 450');
    expect(zero.detail).toContain('centred on 600');
    // A sweep without the period is not a pass.
    expect(computeH10Lines(suite, [run(600, 36000)], 600)[4]!.pass).toBe(false);
  });
  it('no runs reads "no runs"', () => {
    expect(computeH10Lines([], null, 600).every((l) => l.detail === 'no runs')).toBe(true);
  });
});

describe('the runner records the hive columns', () => {
  it('adaptive at hive.rebuildTicks 600: pushes, events, losses and the per-minute guards agree with the sim', () => {
    let final: World | null = null;
    const r = runField(adaptive, 1, data, { capTicks: 45 * 1800, softlockTicks: 5 * 1800, tunables: { 'hive.rebuildTicks': 600 }, onTick: (w) => (final = w as World) });
    expect(r.outcome).toBe('won');
    const s = fieldSummary(final!);
    expect(r.hive.lostToRaids).toBe(s.hive.lostToRaids);
    expect(r.hive.lostToPushes).toBe(s.hive.lostToPushes);
    expect(r.hive.cap).toBe(s.hive.cap);
    expect(r.raidRolls).toBe(0);
    // Every guard killed in a battle at the hive is in a push, and the last push took the hive.
    expect(r.hive.pushes.reduce((a, p) => a + p.killed, 0)).toBe(r.hive.lostToPushes);
    expect(r.hive.pushes[r.hive.pushes.length - 1]!.won).toBe(true);
    expect(r.hive.pushes.slice(0, -1).every((p) => !p.won)).toBe(true);
    expect(r.hive.perMinute).toHaveLength(Math.floor(r.ticks / 1800));
    expect(winLanding(r)!.home).toBeLessThanOrEqual(winLanding(r)!.cap);
    // Events are a beaten prong with at least 3 raiders killed, or a lost push with at least 5 guards killed.
    for (const e of r.hive.events) expect(e.killed).toBeGreaterThanOrEqual(e.kind === 'prong' ? 3 : 5);
    expect(r.hive.events.filter((e) => e.kind === 'push')).toHaveLength(r.hive.pushes.filter((p) => !p.won && p.killed >= 5).length);
  }, 90000);
});
