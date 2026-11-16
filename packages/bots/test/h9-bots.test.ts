import { describe, expect, it } from 'vitest';
import { createWorld, defaultData, raidStatus, step, type Input, type RaidStatus, type ShipType, type World } from '@factory4x/sim';
import { computeH9Lines, prongSummary, slowerPct } from '../src/field-flags.ts';
import { runField, type FieldResult, type FieldStrategy } from '../src/field-runner.ts';
import { AdaptiveBot, adaptive, adaptiveConcentrate, dronesOnly, econAliveNow, fieldStrategies, greedy, undefended, FIELD_WINNERS, type AdaptiveOptions } from '../src/field-strategies.ts';

/**
 * H9 bot changes (DESIGN.md "Bots (H9)"). Prong splitting is tested on two-prong fixtures: the bot reads its raid from
 * `raidView`, so a fixture hands it a raid with two prongs whatever the sim builds. The whole-run tests use the shipped data.
 */
const data = defaultData;
const TR = data.tickRate;
const MIN = 60 * TR;
const idOf = (w: World, id: string): number => w.nodes.findIndex((n) => n.id === id);

interface Fix {
  w: World;
  a5: number;
  a6: number;
  a7: number;
  view: { current: RaidStatus | null };
  bot: AdaptiveBot;
}
type Mix = { thorn: number; spore: number };
const THORNY: Mix = { thorn: 5, spore: 1 }; // 6 raiders, Lancer counters
const SPORY: Mix = { thorn: 1, spore: 7 }; // 8 raiders, Flak counters

/** A world with Lancer and Flak unlocked, a5 a6 a7 Mine-marked and a bot that reads `view` as its raid (null: no raid). */
function fixture(over: Partial<AdaptiveOptions> = {}): Fix {
  const w = createWorld(1, data);
  w.stats.firstDeliveredTick.ice = 1;
  w.stats.firstDeliveredTick.crystal = 1;
  const [a5, a6, a7] = [idOf(w, 'a5'), idOf(w, 'a6'), idOf(w, 'a7')] as [number, number, number];
  for (const n of [a5, a6, a7]) w.field!.mine[n] = true;
  const view: { current: RaidStatus | null } = { current: null };
  const bot = new AdaptiveBot({ respond: true, dronesOnly: false, offenceGate: () => false, raidView: (x) => view.current ?? raidStatus(x), ...over });
  return { w, a5, a6, a7, view, bot };
}
/** A raid in flight with these prongs (prong 0 first), as `raidStatus` would report them. */
function twoProngs(w: World, prongs: { target: number; planned: Mix }[]): RaidStatus {
  const total: Mix = { thorn: 0, spore: 0 };
  for (const p of prongs) {
    total.thorn += p.planned.thorn;
    total.spore += p.planned.spore;
  }
  return {
    ...raidStatus(w),
    phase: 'out',
    target: prongs[0]!.target,
    planned: total,
    prongs: prongs.map((p) => ({ target: p.target, phase: 'out' as const, planned: { ...p.planned }, raiders: { ...p.planned }, ticksToArrival: 100, outcome: null, holding: 0 })),
  };
}
function ships(w: World, type: ShipType, n: number, at: number): void {
  for (let i = 0; i < n; i++) w.ships.push({ id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at, transit: null, engagedIn: -1 });
}
type Send = { from: number; to: number; n: number };
const sendsOf = (inputs: Input[]): Send[] => inputs.flatMap((i) => (i.type === 'sendShips' ? [{ from: i.from, to: i.to, n: i.counts.drone + i.counts.lancer + i.counts.flak }] : []));
/** The warship weights the inputs set to alloc.maxWeight. */
const maxed = (w: World, inputs: Input[]): ShipType[] => inputs.flatMap((i) => (i.type === 'setAlloc' && i.weight === w.tun['alloc.maxWeight'] && (i.shipType === 'drone' || i.shipType === 'lancer' || i.shipType === 'flak') ? [i.shipType] : []));

describe('change 1: the defence splits across prongs (a two-prong world: a5 THORNY 6, a6 SPORY 8)', () => {
  const prongs = (f: Fix): { target: number; planned: Mix }[] => [
    { target: f.a5, planned: THORNY },
    { target: f.a6, planned: SPORY },
  ];

  it('production: the counter of the largest unmet prong goes to full weight while the goals add up to more than the warships alive', () => {
    const f = fixture();
    f.view.current = twoProngs(f.w, prongs(f));
    // Nothing built: the largest goal is a6 (8, Spores), so Flak.
    expect(maxed(f.w, f.bot.decide(f.w, data))).toEqual(['flak']);
    // a6's goal is met at a6: the largest unmet is a5 (6, Thorns), so Lancer. Alive 8 against goals 14.
    const g = fixture();
    g.view.current = twoProngs(g.w, prongs(g));
    ships(g.w, 'flak', 8, g.a6);
    expect(maxed(g.w, g.bot.decide(g.w, data))).toEqual(['lancer']);
    // Enough warships alive for both goals (14): nothing is raised.
    const h = fixture();
    h.view.current = twoProngs(h.w, prongs(h));
    ships(h.w, 'drone', 14, 0);
    expect(maxed(h.w, h.bot.decide(h.w, data))).toEqual([]);
  });

  it('placement: the largest prong first, and only the largest is covered when the warships run out', () => {
    const f = fixture();
    f.view.current = twoProngs(f.w, prongs(f));
    ships(f.w, 'drone', 8, 0);
    expect(sendsOf(f.bot.decide(f.w, data))).toEqual([{ from: 0, to: f.a6, n: 8 }]);
    const g = fixture();
    g.view.current = twoProngs(g.w, prongs(g));
    ships(g.w, 'drone', 14, 0);
    expect(sendsOf(g.bot.decide(g.w, data))).toEqual([
      { from: 0, to: g.a6, n: 8 },
      { from: 0, to: g.a5, n: 6 },
    ]);
  });

  it('placement counts the warships already standing at a target toward its goal', () => {
    const f = fixture();
    f.view.current = twoProngs(f.w, prongs(f));
    ships(f.w, 'drone', 5, f.a6);
    ships(f.w, 'drone', 6, 0);
    // a6 lacks 3, a5 gets the other 3 (exactly ceil(6 / 2)).
    expect(sendsOf(f.bot.decide(f.w, data))).toEqual([
      { from: 0, to: f.a6, n: 3 },
      { from: 0, to: f.a5, n: 3 },
    ]);
  });

  it('no prong gets a guard under ceil(goal / 2): 2 left for a goal of 6 stay with the larger prong, 3 are sent', () => {
    const f = fixture();
    f.view.current = twoProngs(f.w, prongs(f));
    ships(f.w, 'drone', 10, 0);
    expect(sendsOf(f.bot.decide(f.w, data))).toEqual([{ from: 0, to: f.a6, n: 10 }]);
    const g = fixture();
    g.view.current = twoProngs(g.w, prongs(g));
    ships(g.w, 'drone', 11, 0);
    expect(sendsOf(g.bot.decide(g.w, data))).toEqual([
      { from: 0, to: g.a6, n: 8 },
      { from: 0, to: g.a5, n: 3 },
    ]);
    // A guard already standing at the smaller prong counts toward its half: 2 standing plus 1 sent is 3.
    const h = fixture();
    h.view.current = twoProngs(h.w, prongs(h));
    ships(h.w, 'drone', 2, h.a5);
    ships(h.w, 'drone', 9, 0);
    expect(sendsOf(h.bot.decide(h.w, data))).toEqual([
      { from: 0, to: h.a6, n: 8 },
      { from: 0, to: h.a5, n: 1 },
    ]);
  });

  it('equal prongs: prong 0 is covered first', () => {
    const f = fixture();
    f.view.current = twoProngs(f.w, [
      { target: f.a5, planned: { thorn: 3, spore: 3 } },
      { target: f.a6, planned: { thorn: 3, spore: 3 } },
    ]);
    ships(f.w, 'drone', 6, 0);
    expect(sendsOf(f.bot.decide(f.w, data))).toEqual([{ from: 0, to: f.a5, n: 6 }]);
  });

  it('new warships rally to the post with the most unmet', () => {
    const f = fixture();
    f.view.current = twoProngs(f.w, prongs(f));
    const rally = f.bot.decide(f.w, data).find((i) => i.type === 'setRally');
    expect(rally).toEqual({ type: 'setRally', node: f.a6 });
  });

  it('the standing guard is half of each prong of the last raid, at that prong\'s target, while the rock is mined', () => {
    const f = fixture();
    f.view.current = twoProngs(f.w, prongs(f));
    f.bot.decide(f.w, data); // sees the raid
    f.view.current = null; // it has ended
    ships(f.w, 'drone', 7, 0);
    // Half of 8 (a6) is 4, half of 6 (a5) is 3.
    expect(sendsOf(f.bot.decide(f.w, data))).toEqual([
      { from: 0, to: f.a6, n: 4 },
      { from: 0, to: f.a5, n: 3 },
    ]);
    // Both posts full: no ship moves and no warship is raised.
    const g = fixture();
    g.view.current = twoProngs(g.w, prongs(g));
    g.bot.decide(g.w, data);
    g.view.current = null;
    ships(g.w, 'drone', 4, g.a6);
    ships(g.w, 'drone', 3, g.a5);
    const quiet = g.bot.decide(g.w, data);
    expect(sendsOf(quiet)).toEqual([]);
    expect(maxed(g.w, quiet)).toEqual([]);
    // a5 short by 2: the counter for a5's mix (Thorns, so Lancer) goes to full weight.
    const h = fixture();
    h.view.current = twoProngs(h.w, prongs(h));
    h.bot.decide(h.w, data);
    h.view.current = null;
    ships(h.w, 'drone', 4, h.a6);
    ships(h.w, 'drone', 1, h.a5);
    expect(maxed(h.w, h.bot.decide(h.w, data))).toEqual(['lancer']);
    // a5 unmarked: only a6 keeps a guard, and the ship at a5 joins it.
    const k = fixture();
    k.view.current = twoProngs(k.w, prongs(k));
    k.bot.decide(k.w, data);
    k.view.current = null;
    k.w.field!.mine[k.a5] = false;
    ships(k.w, 'drone', 4, k.a6);
    ships(k.w, 'drone', 2, k.a5);
    expect(sendsOf(k.bot.decide(k.w, data))).toEqual([{ from: k.a5, to: k.a6, n: 2 }]);
  });

  it('a guard follows a W5 retarget: the prong that moves from a6 to a7 draws the warships off a6', () => {
    const f = fixture();
    f.view.current = twoProngs(f.w, prongs(f));
    ships(f.w, 'drone', 6, f.a5);
    ships(f.w, 'drone', 8, f.a6);
    expect(sendsOf(f.bot.decide(f.w, data))).toEqual([]); // both met
    f.view.current = twoProngs(f.w, [
      { target: f.a5, planned: THORNY },
      { target: f.a7, planned: SPORY },
    ]);
    const sends = sendsOf(f.bot.decide(f.w, data));
    expect(sends).toEqual([{ from: f.a6, to: f.a7, n: 8 }]);
  });

  it('a done prong is not answered, and a homebound one only when no other prong is still going', () => {
    const f = fixture();
    const v = twoProngs(f.w, prongs(f));
    v.prongs[1]!.phase = 'done';
    f.view.current = v;
    ships(f.w, 'drone', 14, 0);
    expect(sendsOf(f.bot.decide(f.w, data))).toEqual([{ from: 0, to: f.a5, n: 14 }]);
    const g = fixture();
    const u = twoProngs(g.w, prongs(g));
    u.prongs[1]!.phase = 'home';
    g.view.current = u;
    ships(g.w, 'drone', 14, 0);
    expect(sendsOf(g.bot.decide(g.w, data))).toEqual([{ from: 0, to: g.a5, n: 14 }]);
  });

  it('the hive wave leaves from every post at once when the guards together cover it', () => {
    const f = fixture({ offenceGate: () => true });
    f.w.tun['field.fleetCap'] = 60;
    f.view.current = null;
    f.bot.decide(f.w, data);
    f.view.current = twoProngs(f.w, prongs(f));
    f.bot.decide(f.w, data); // remembers a5 and a6 as posts
    f.view.current = null;
    for (const type of ['drone', 'lancer', 'flak'] as const) {
      ships(f.w, type, 15, f.a5);
      ships(f.w, type, 15, f.a6);
    }
    const sends = sendsOf(f.bot.decide(f.w, data));
    const heart = f.w.nodes.findIndex((n) => n.kind === 'heart' || n.id === 'hive');
    expect(sends.length).toBe(2);
    expect(sends.map((s) => s.from).sort()).toEqual([f.a5, f.a6].sort());
    expect(new Set(sends.map((s) => s.to)).size).toBe(1);
    expect(heart === -1 || sends[0]!.to === heart).toBe(true);
  });

  it('the economy wiped by a two-prong hit is rebuilt as in H8, whatever the prongs', () => {
    for (const s of [adaptive, adaptiveConcentrate, undefended]) {
      const w = createWorld(1, data);
      const bot = s.make(data);
      let g = 0;
      while (econAliveNow(w, data) < 8 && g++ < 20 * MIN) step(w, data, bot.decide(w, data));
      w.field!.econ = [];
      w.field!.bays.extractor.ticksLeft = 0;
      w.field!.bays.hauler.ticksLeft = 0;
      step(w, data, bot.decide(w, data));
      expect(w.field!.alloc.extractor, s.name).toBe(w.tun['alloc.start.extractor']);
      expect(w.field!.alloc.hauler, s.name).toBe(w.tun['alloc.start.hauler']);
    }
  });
});

describe('raid.prongsMax 1: the bot decides as H8 did (v15, seed 1)', () => {
  const opts = { capTicks: 20 * MIN, softlockTicks: 5 * MIN, tunables: { 'raid.prongsMax': 1 } as const };
  // Hashes of the H8 bots (field-strategies.ts at 12924fa, before this task) on the h9-raids sim, over a 20 minute cap on v15, seed 1, with raid.prongsMax 1 set (the tunable is in the hash).
  // They hold while the data is v15; the equality with `adaptive-concentrate` below is data-independent.
  const pins: [FieldStrategy, string, number][] = [
    [adaptive, 'ae732e36', 28591],
    [greedy, '964a3c11', 28351],
    [dronesOnly, '7baddb4a', 36000],
  ];
  for (const [s, hash, ticks] of pins) {
    it(`${s.name} reproduces H8's run`, () => {
      const r = runField(s, 1, data, opts);
      expect(r.ticks).toBe(ticks === 36000 ? 20 * MIN : ticks);
      if (data.dataVersion === 15) expect(r.finalHash).toBe(hash);
    });
  }

  it('with one prong per raid, adaptive and adaptive-concentrate play the same game', () => {
    const a = runField(adaptive, 1, data, opts);
    const c = runField(adaptiveConcentrate, 1, data, opts);
    expect(c.finalHash).toBe(a.finalHash);
  });
});

describe('adaptive-concentrate and undefended: registered as report-only controls', () => {
  it('both are strategies of the field suite, neither is gated to win', () => {
    expect(fieldStrategies.map((s) => s.name)).toEqual(['adaptive', 'greedy', 'idle', 'drones-only', 'adaptive-no-raids', 'adaptive-concentrate', 'undefended']);
    for (const s of [adaptiveConcentrate, undefended]) {
      expect(s.expectedWin).toBe(false);
      expect(FIELD_WINNERS).not.toContain(s.name);
      expect(s.tunables).toBeUndefined(); // the same raids as adaptive
    }
    expect(adaptiveConcentrate.description).toContain('only prong 0');
    expect(undefended.description).toContain('off for the whole run');
  });

  const prongs = (f: Fix): { target: number; planned: Mix }[] => [
    { target: f.a5, planned: THORNY },
    { target: f.a6, planned: SPORY },
  ];

  it('adaptive-concentrate answers only prong 0 with every warship, and sends none to prong 1', () => {
    const f = fixture({ concentrate: true });
    f.view.current = twoProngs(f.w, prongs(f));
    ships(f.w, 'drone', 14, 0);
    const inputs = f.bot.decide(f.w, data);
    expect(sendsOf(inputs)).toEqual([{ from: 0, to: f.a5, n: 14 }]);
    expect(inputs.find((i) => i.type === 'setRally')).toEqual({ type: 'setRally', node: f.a5 });
    // It builds for the whole raid (H8's rule: the counter for the whole plan), not for prong 1 alone.
    const g = fixture({ concentrate: true });
    g.view.current = twoProngs(g.w, prongs(g));
    ships(g.w, 'drone', 5, 0);
    expect(maxed(g.w, g.bot.decide(g.w, data))).toEqual(['flak']);
  });

  it('adaptive-concentrate posts its standing guard only at prong 0: half of the whole raid there, nothing at prong 1', () => {
    const f = fixture({ concentrate: true });
    f.view.current = twoProngs(f.w, prongs(f));
    f.bot.decide(f.w, data);
    f.view.current = null;
    ships(f.w, 'drone', 7, 0);
    expect(sendsOf(f.bot.decide(f.w, data))).toEqual([{ from: 0, to: f.a5, n: 7 }]);
    ships(f.w, 'drone', 1, 0);
    expect(sendsOf(f.bot.decide(f.w, data)).every((s) => s.to !== f.a6)).toBe(true);
  });

  it('undefended never answers a raid or posts a guard: no rally, no send to a raid target, no counter raised, with a raid or after one', () => {
    const f = fixture({ respond: false });
    f.view.current = twoProngs(f.w, prongs(f));
    ships(f.w, 'drone', 14, 0);
    const during = f.bot.decide(f.w, data);
    expect(during.find((i) => i.type === 'setRally')).toBeUndefined();
    expect(sendsOf(during)).toEqual([]);
    expect(maxed(f.w, during)).toEqual([]);
    f.view.current = null;
    const after = f.bot.decide(f.w, data);
    expect(sendsOf(after)).toEqual([]);
    expect(after.find((i) => i.type === 'setRally')).toBeUndefined();
    expect(maxed(f.w, after)).toEqual([]);
  });

  /** Plays a strategy to the end, recording every input it sends. */
  function played(s: FieldStrategy): { r: FieldResult; inputs: Input[]; w: World | null } {
    const inputs: Input[] = [];
    const spy: FieldStrategy = {
      ...s,
      make: (d) => {
        const inner = s.make(d);
        return {
          decide(w, dd): Input[] {
            const out = inner.decide(w, dd);
            inputs.push(...out);
            return out;
          },
        };
      },
    };
    const r = runField(spy, 1, data);
    return { r, inputs, w: null };
  }

  it('on the shipped data undefended takes the hive, is raided, and never rallies or sends a ship to a raided rock', () => {
    const { r, inputs } = played(undefended);
    const w = createWorld(1, data);
    const rocks = new Set(w.nodes.filter((n) => n.kind === 'asteroid').map((n) => n.index));
    expect(r.outcome).toBe('won');
    expect(r.raids.mustered).toBeGreaterThan(0);
    expect(r.idleWithOreMin).toBeLessThan(3);
    expect(inputs.filter((i) => i.type === 'setRally' && i.node !== 0)).toEqual([]);
    expect(inputs.filter((i) => i.type === 'sendShips' && rocks.has(i.to))).toEqual([]);
  });

  it('on the shipped data adaptive-concentrate takes the hive and never idles with ore piling up', () => {
    const { r } = played(adaptiveConcentrate);
    expect(r.outcome).toBe('won');
    expect(r.idleWithOreMin).toBeLessThan(3);
  });
});

describe('the no-plan-fits table, H9 cells', () => {
  it('greedy: no defence before its first hit (only weights), adaptive after it', () => {
    let firstHit: number | null = null;
    const log: { tick: number; input: Input }[] = [];
    const spy: FieldStrategy = {
      ...greedy,
      make: (d) => {
        const inner = greedy.make(d);
        return {
          decide(w, dd): Input[] {
            if (firstHit === null && w.stats.raids.hit >= 1) firstHit = w.tick;
            const out = inner.decide(w, dd);
            for (const input of out) log.push({ tick: w.tick, input });
            return out;
          },
        };
      },
    };
    runField(spy, 1, data, { capTicks: 16 * MIN, softlockTicks: 5 * MIN });
    expect(firstHit).not.toBeNull();
    const before = log.filter((x) => x.tick < firstHit!);
    expect(before.every((x) => x.input.type === 'setAlloc')).toBe(true);
    const after = log.filter((x) => x.tick >= firstHit!);
    expect(after.some((x) => x.input.type === 'setRally' && x.input.node !== 0)).toBe(true);
  });

  it('the controls hold in the cells that say "as H8": idle, drones-only and static are not changed by the prong code', () => {
    // idle and static have no raid response; drones-only is pinned to H8's run above.
    const r = runField(dronesOnly, 1, data, { capTicks: 8 * MIN, softlockTicks: 5 * MIN });
    expect(r.outcome).toBe('timeout');
  });
});

describe('the report', () => {
  const run = (over: Partial<FieldResult>): FieldResult =>
    ({ strategy: 'adaptive', variant: null, seed: 1, outcome: 'won', ticks: 1000, hiveTick: 1000, raids: { mustered: 0, beaten: 0, hit: 0, turnedBack: 0 }, raidProngs: { beaten: 0, hit: 0, turnedBack: 0 }, raidLog: [], econBuilt: { extractor: 10, hauler: 10 }, econLost: { extractor: 0, hauler: 0 }, peakEcon: 20, peakHaulers: 8, allocChanges: 3, built: { extractor: 10, hauler: 10, drone: 0, lancer: 0, flak: 0 }, lost: { extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 }, peakPerMin: 0, tickMsP50: 0, tickMsP95: 0, finalHash: 'x', ...over }) as FieldResult;

  it('prongSummary counts raids by prong count (an unsplit raid is 1) and economy ships lost per prong target', () => {
    const rec = (prongs: { target: string; econLost: number }[]) => ({ startTick: 0, endTick: 1, outcome: 'hit' as const, econLost: 0, planned: { thorn: 1, spore: 1 }, prongs: prongs.map((p) => ({ ...p, outcome: 'hit' })) });
    const s = prongSummary(run({ raidLog: [rec([{ target: 'a5', econLost: 2 }]), rec([{ target: 'a5', econLost: 1 }, { target: 'a6', econLost: 3 }]), rec([])] }));
    expect(s.byCount).toEqual({ 1: 2, 2: 1 });
    expect(s.lostByTarget).toEqual({ a5: 3, a6: 3 });
  });

  it('the win time against adaptive is a whole percent, null unless both won', () => {
    const rs = [run({ hiveTick: 1000 }), run({ strategy: 'greedy', hiveTick: 1150 }), run({ strategy: 'undefended', hiveTick: 800 }), run({ strategy: 'idle', outcome: 'timeout', hiveTick: null })];
    expect(slowerPct(rs, 'greedy', 1)).toBe(15);
    expect(slowerPct(rs, 'undefended', 1)).toBe(-20);
    expect(slowerPct(rs, 'idle', 1)).toBeNull();
    expect(slowerPct(rs, 'absent', 1)).toBeNull();
  });

  it('the two H9 lines: splitting matters (concentrate loses 2 more, every seed) and ignoring raids costs (both 10% slower, undefended may not win)', () => {
    const lost = (n: number) => ({ extractor: n, hauler: 0 });
    const base = [run({ econLost: lost(2) }), run({ seed: 2, econLost: lost(3) })];
    const conc = (a: number, b: number) => [run({ strategy: 'adaptive-concentrate', econLost: lost(a) }), run({ strategy: 'adaptive-concentrate', seed: 2, econLost: lost(b) })];
    expect(computeH9Lines([...base, ...conc(4, 5)])[0]!.pass).toBe(true);
    expect(computeH9Lines([...base, ...conc(4, 4)])[0]!.pass).toBe(false);
    expect(computeH9Lines(base)[0]!.detail).toBe('no runs');
    const mk = (g: number, u: number | null) => [
      ...base,
      run({ strategy: 'greedy', hiveTick: g }),
      run({ strategy: 'greedy', seed: 2, hiveTick: g }),
      ...(u === null ? [run({ strategy: 'undefended', outcome: 'timeout', hiveTick: null }), run({ strategy: 'undefended', seed: 2, outcome: 'timeout', hiveTick: null })] : [run({ strategy: 'undefended', hiveTick: u }), run({ strategy: 'undefended', seed: 2, hiveTick: u })]),
    ];
    const both = computeH9Lines(mk(1100, 1200))[1]!;
    expect(both.pass).toBe(true);
    const greedyMiss = computeH9Lines(mk(1050, null))[1]!;
    expect(greedyMiss.pass).toBe(false);
    expect(greedyMiss.detail).toContain('greedy half MISSED, undefended half met');
    expect(computeH9Lines(mk(1100, 900))[1]!.detail).toContain('undefended half MISSED');
  });
});
