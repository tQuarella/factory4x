import { describe, expect, it } from 'vitest';
import { BUILD_TYPES, createWorld, defaultData, isTypeUnlocked, isValidInput, step, type Input, type SimData, type World } from '@factory4x/sim';
import { fixtureV12 } from '../../sim/test/fixture.ts';
import { fieldMix, fullRaidAwayCounts, guardsAtHome } from '../src/field-estimate.ts';
import { computeFieldFlags } from '../src/field-flags.ts';
import { FIELD_CAP_MIN, SOFTLOCK_MIN, defaultFieldOptions, fieldGateFailures, gateRuns, runField, type FieldBot, type FieldResult, type FieldStrategy } from '../src/field-runner.ts';
import {
  FIELD_WINNERS,
  STATIC_SHAPES,
  adaptive,
  adaptiveNoRaids,
  counterFor,
  dronesOnly,
  economyWeights,
  soundShips,
  fieldStrategies,
  greedy,
  hiveCounter,
  idle,
  openSlots,
  staticStrategy,
  weightInputs,
} from '../src/field-strategies.ts';

/**
 * The field bots (DESIGN.md H7 "Bots (H7): strategies"). Rule premises run on the frozen v12 fixture, so a
 * calibration of the shipped data never breaks them; `easy` is that fixture with a small hive (4 Thorns, 8 Spores)
 * that a bot can take within the cap, so a winning run can be tested without depending on a tuned value.
 */
const TR = fixtureV12.tickRate;
const MIN = 60 * TR;

const easy: SimData = (() => {
  const d = JSON.parse(JSON.stringify(fixtureV12)) as SimData;
  d.map.field!.layout.heart = { thorns: 4, spores: 8 } as never;
  return d;
})();

const lancerOf = (r: FieldResult): number => r.built.lancer;

/** A bot that never sets a weight: nothing is built, nothing is delivered. */
const nothing: FieldStrategy = {
  name: 'nothing',
  description: 'no weights, no ships',
  expectedWin: false,
  make: () => ({
    decide(world: Readonly<World>, data: SimData): Input[] {
      return weightInputs(world, data, { extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 });
    },
  }),
};

/** Run a bot's `decide` for `ticks`, applying its inputs; returns every input it emitted by tick. */
function play(world: World, data: SimData, bot: FieldBot, ticks: number, extra: (tick: number) => Input[] = () => []): { tick: number; input: Input }[] {
  const log: { tick: number; input: Input }[] = [];
  for (let i = 0; i < ticks; i++) {
    const inputs = [...extra(world.tick), ...bot.decide(world, data)];
    for (const input of inputs) log.push({ tick: world.tick, input });
    step(world, data, inputs);
  }
  return log;
}

/** Give a world a raid in a phase, with a planned size. */
function setRaid(w: World, phase: 'muster' | 'out' | 'fight', target: number, planned: { thorn: number; spore: number }): void {
  w.raid = { id: 1, phase, target, guards: [], ticksLeft: 300, planned, flightTicks: 144, from: 10, retargeted: false, lostEcon: { extractor: 0, hauler: 0 }, lostShips: { drone: 0, lancer: 0, flak: 0 }, killed: { thorn: 0, spore: 0 } };
}

describe('the field runner (acceptance 1)', () => {
  it('won: a run that captures the hive ends with outcome won and the capture tick', () => {
    const r = runField(adaptiveNoRaids, 1, easy);
    expect(r.outcome).toBe('won');
    expect(r.hiveTick).not.toBeNull();
    expect(r.ticks - r.hiveTick!).toBeLessThanOrEqual(1);
    expect(r.ticks).toBeLessThan(FIELD_CAP_MIN * MIN);
    expect(r.error).toBeUndefined();
  });

  it('timeout: a run still going at the cap ends with outcome timeout at exactly the cap', () => {
    const r = runField(adaptive, 1, easy, { ...defaultFieldOptions(easy), capTicks: 3 * MIN });
    expect(r.outcome).toBe('timeout');
    expect(r.ticks).toBe(3 * MIN);
    expect(r.hiveTick).toBeNull();
  });

  it('the shipped cap is 45 game minutes and the softlock window 5', () => {
    const o = defaultFieldOptions(fixtureV12);
    expect(FIELD_CAP_MIN).toBe(45);
    expect(SOFTLOCK_MIN).toBe(5);
    expect(o.capTicks).toBe(45 * MIN);
    expect(o.softlockTicks).toBe(5 * MIN);
  });

  it('softlock (forced): probe mining 0 and no economy means no ship starts and no delivery, and the run ends after 5 minutes', () => {
    const r = runField(nothing, 1, easy, { ...defaultFieldOptions(easy), tunables: { 'economy.probeOrePerMin': 0 } });
    expect(r.outcome).toBe('softlock');
    expect(r.ticks).toBe(5 * MIN);
    expect(r.built.drone + r.built.extractor + r.built.hauler).toBe(0);
  });

  it('a run with ships starting is not a softlock, even through a long stretch with no delivery', () => {
    const r = runField(adaptive, 1, easy, { ...defaultFieldOptions(easy), capTicks: 12 * MIN });
    expect(r.outcome).not.toBe('softlock');
  });

  it('crash: a strategy that throws ends with outcome crash and the error text', () => {
    const boom: FieldStrategy = { name: 'boom', description: '', expectedWin: false, make: () => ({ decide: () => { throw new Error('bot exploded'); } }) };
    const r = runField(boom, 1, easy);
    expect(r.outcome).toBe('crash');
    expect(r.error).toContain('bot exploded');
  });

  it('is deterministic: the same strategy and seed end on the same hash', () => {
    const a = runField(adaptiveNoRaids, 1, easy, { ...defaultFieldOptions(easy), capTicks: 6 * MIN });
    const b = runField(adaptiveNoRaids, 1, easy, { ...defaultFieldOptions(easy), capTicks: 6 * MIN });
    expect(b.finalHash).toBe(a.finalHash);
  });

  it('fills the report fields: built by type, peak economy, allocation changes, lost, and raids by outcome', () => {
    const r = runField(adaptive, 1, easy, { ...defaultFieldOptions(easy), capTicks: 8 * MIN });
    expect(r.built.extractor).toBeGreaterThan(0);
    expect(r.built.hauler).toBeGreaterThan(0);
    expect(r.peakEcon).toBeGreaterThan(0);
    expect(r.peakHaulers).toBeGreaterThan(0);
    expect(r.allocChanges).toBeGreaterThan(0);
    expect(Object.keys(r.raids).sort()).toEqual(['beaten', 'hit', 'mustered', 'turnedBack']);
    expect(Object.keys(r.econLost).sort()).toEqual(['extractor', 'hauler']);
    expect(r.tickMsP95).toBeGreaterThanOrEqual(r.tickMsP50);
  });
});

describe('the six strategies (acceptance 2)', () => {
  it('exports the six: adaptive, greedy, static (a sweep of at most 6), idle, drones-only, adaptive-no-raids; the gate expects adaptive and greedy to win', () => {
    expect([...fieldStrategies.map((s) => s.name), 'static'].sort()).toEqual(['adaptive', 'adaptive-no-raids', 'drones-only', 'greedy', 'idle', 'static']);
    expect(STATIC_SHAPES.length).toBeGreaterThan(0);
    expect(STATIC_SHAPES.length).toBeLessThanOrEqual(6);
    expect(new Set(STATIC_SHAPES.map((s) => s.name)).size).toBe(STATIC_SHAPES.length);
    expect(FIELD_WINNERS).toEqual(['adaptive', 'greedy']);
    expect([adaptive, greedy, idle, dronesOnly, adaptiveNoRaids, staticStrategy(STATIC_SHAPES[0]!)].filter((s) => s.expectedWin).map((s) => s.name)).toEqual(['adaptive', 'greedy']);
  });

  it('weightInputs only emits the weights that change, clamped to alloc.maxWeight', () => {
    const w = createWorld(1, fixtureV12);
    expect(weightInputs(w, fixtureV12, { extractor: 3, hauler: 2, drone: 0, lancer: 0, flak: 0 })).toEqual([]);
    expect(weightInputs(w, fixtureV12, { extractor: 3, hauler: 2, drone: 99, lancer: 0, flak: 0 })).toEqual([{ type: 'setAlloc', shipType: 'drone', weight: w.tun['alloc.maxWeight'] }]);
  });

  it('adaptive opens economy only: no warship weight, build or send until the first muster', () => {
    const w = createWorld(1, easy);
    const bot = adaptive.make(easy);
    const log: { tick: number; input: Input }[] = [];
    for (let i = 0; i < 6 * MIN && w.raid === null; i++) {
      const inputs = bot.decide(w, easy);
      for (const input of inputs) log.push({ tick: w.tick, input });
      step(w, easy, inputs);
    }
    expect(w.tick).toBeGreaterThan(MIN);
    for (const t of BUILD_TYPES) if (t !== 'extractor' && t !== 'hauler') expect(w.field!.alloc[t], t).toBe(0);
    expect(log.some((l) => l.input.type === 'sendShips')).toBe(false);
    expect(w.stats.shipsBuilt).toEqual({ drone: 0, lancer: 0, flak: 0 });
  });

  it('economyWeights: an extractor type at 0 once every open slot has one (it would idle at the probe)', () => {
    const w = createWorld(1, easy);
    expect(economyWeights(w, easy, false).extractor).toBeGreaterThan(0);
    const slots = openSlots(w);
    expect(slots).toBeGreaterThan(0);
    for (let i = 0; i < slots; i++) w.field!.econ.push({ id: 1000 + i, type: 'extractor', hp: 6, at: 0, transit: null, target: null, cargo: 0, cargoRes: null });
    expect(economyWeights(w, easy, false).extractor).toBe(0);
  });

  it('counterFor: Flak against Spores, Lancer against Thorns, a Drone before either is unlocked, and always a Drone for drones-only', () => {
    const w = createWorld(1, easy);
    const spores = { thorn: 1, spore: 4 };
    const thorns = { thorn: 4, spore: 1 };
    expect(isTypeUnlocked(w, 'flak')).toBe(false);
    expect(counterFor(w, spores, false)).toBe('drone');
    expect(counterFor(w, thorns, false)).toBe('drone');
    w.stats.firstDeliveredTick.ice = 1;
    w.stats.firstDeliveredTick.crystal = 1;
    expect(counterFor(w, spores, false)).toBe('flak');
    expect(counterFor(w, thorns, false)).toBe('lancer');
    expect(counterFor(w, spores, true)).toBe('drone');
  });

  it("adaptive answers a muster: the counter for the raid's majority at full weight, the rally and the idle warships sent to the target", () => {
    const w = createWorld(1, easy);
    w.stats.firstDeliveredTick.ice = 1;
    const a5 = w.nodes.findIndex((n) => n.id === 'a5');
    for (let i = 0; i < 2; i++) w.ships.push({ id: 900 + i, type: 'drone', hp: 10, at: 0, transit: null, engagedIn: -1 });
    setRaid(w, 'muster', a5, { thorn: 1, spore: 4 });
    const bot = adaptive.make(easy);
    const inputs = bot.decide(w, easy);
    expect(inputs).toContainEqual({ type: 'setRally', node: a5 });
    expect(inputs).toContainEqual({ type: 'setAlloc', shipType: 'flak', weight: w.tun['alloc.maxWeight'] });
    expect(inputs.filter((i) => i.type === 'sendShips')).toEqual([{ type: 'sendShips', from: 0, to: a5, counts: { drone: 2, lancer: 0, flak: 0 } }]);
  });

  it('adaptive answers a Thorn-majority muster with Lancer, and with a Drone while the counter is locked', () => {
    const w = createWorld(1, easy);
    const a5 = w.nodes.findIndex((n) => n.id === 'a5');
    setRaid(w, 'muster', a5, { thorn: 4, spore: 1 });
    expect(adaptive.make(easy).decide(w, easy)).toContainEqual({ type: 'setAlloc', shipType: 'drone', weight: w.tun['alloc.maxWeight'] });
    w.stats.firstDeliveredTick.crystal = 1;
    expect(adaptive.make(easy).decide(w, easy)).toContainEqual({ type: 'setAlloc', shipType: 'lancer', weight: w.tun['alloc.maxWeight'] });
  });

  it('adaptive stops adding defenders once they match the raid, then holds a standing guard of half the planned size at the target after it ends', () => {
    const w = createWorld(1, easy);
    const a5 = w.nodes.findIndex((n) => n.id === 'a5');
    const bot = adaptive.make(easy);
    setRaid(w, 'out', a5, { thorn: 2, spore: 4 });
    const at = (n: number): void => {
      w.ships = [];
      for (let i = 0; i < n; i++) w.ships.push({ id: 900 + i, type: 'drone', hp: 10, at: a5, transit: null, engagedIn: -1 });
    };
    at(2);
    expect(bot.decide(w, easy)).toContainEqual({ type: 'setAlloc', shipType: 'drone', weight: w.tun['alloc.maxWeight'] });
    at(6);
    w.field!.alloc.drone = 5;
    expect(bot.decide(w, easy)).toContainEqual({ type: 'setAlloc', shipType: 'drone', weight: 0 });
    // The raid ends: the guard is ceil(6 / 2) = 3, posted at the target (rally stays there).
    w.raid = null;
    w.rally = a5;
    w.field!.alloc.drone = 0;
    at(2);
    const short = bot.decide(w, easy);
    expect(short).toContainEqual({ type: 'setAlloc', shipType: 'drone', weight: w.tun['alloc.maxWeight'] });
    expect(short.some((i) => i.type === 'setRally')).toBe(false);
    at(3);
    w.field!.alloc.drone = 5;
    expect(bot.decide(w, easy)).toContainEqual({ type: 'setAlloc', shipType: 'drone', weight: 0 });
  });

  it('greedy ignores a muster, and plays adaptive only after its first raid that hits', () => {
    const w = createWorld(1, easy);
    const a5 = w.nodes.findIndex((n) => n.id === 'a5');
    setRaid(w, 'muster', a5, { thorn: 1, spore: 4 });
    const bot = greedy.make(easy);
    const ignored = bot.decide(w, easy);
    expect(ignored.some((i) => i.type === 'setRally' || i.type === 'sendShips')).toBe(false);
    expect(ignored.some((i) => i.type === 'setAlloc' && i.shipType === 'drone')).toBe(false);
    w.stats.raids.beaten = 1;
    expect(bot.decide(w, easy).some((i) => i.type === 'setRally')).toBe(false);
    w.stats.raids.hit = 1;
    const answered = bot.decide(w, easy);
    expect(answered).toContainEqual({ type: 'setRally', node: a5 });
    expect(answered).toContainEqual({ type: 'setAlloc', shipType: 'drone', weight: w.tun['alloc.maxWeight'] });
  });

  it('greedy is all economy, no warships, until every open slot has an extractor', () => {
    const w = createWorld(1, easy);
    const bot = greedy.make(easy);
    play(w, easy, bot, 4 * MIN);
    expect(w.stats.shipsBuilt).toEqual({ drone: 0, lancer: 0, flak: 0 });
    expect(w.stats.econBuilt.extractor).toBeGreaterThan(0);
  });

  it('adaptive shifts to offence at econ 12: economy weights drop to at most 1 and warships are built', () => {
    const w = createWorld(1, easy);
    const bot = adaptive.make(easy);
    play(w, easy, bot, 4 * MIN);
    expect(w.field!.econ.length).toBeLessThan(12);
    expect(w.field!.alloc.extractor).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < 6 * MIN && w.field!.econ.length < 12; i++) step(w, easy, bot.decide(w, easy));
    expect(w.field!.econ.length).toBeGreaterThanOrEqual(12);
    step(w, easy, bot.decide(w, easy));
    expect(w.field!.alloc.extractor).toBeLessThanOrEqual(1);
    expect(w.field!.alloc.hauler).toBeLessThanOrEqual(1);
    expect(w.field!.alloc.drone).toBeGreaterThan(0);
  });

  it("adaptive takes the pocket that unlocks the counter for the hive's majority (Spores: the ice pocket) and not the other", () => {
    const w = createWorld(1, easy);
    expect(hiveCounter(w).type).toBe('flak');
    const p1 = w.nodes.findIndex((n) => n.id === 'p1');
    expect(hiveCounter(w).pocket).toBe(p1);
    const bot = adaptiveNoRaids.make(easy);
    const first = { type: 'setTunable' as const, key: 'raid.enabled' as const, value: 0 };
    play(w, easy, bot, 14 * MIN, (t) => (t === 0 ? [first] : []));
    const taken = w.stats.captures.map((c) => w.nodes[c.node]!.id);
    expect(taken[0]).toBe('p1');
    expect(taken).not.toContain('p2');
  });

  it("adaptive attacks the hive when the best-mix estimate fits what it has, and wins (the A/B variant, raids off)", () => {
    const w = createWorld(1, easy);
    const bot = adaptiveNoRaids.make(easy);
    const log = play(w, easy, bot, 20 * MIN, (t) => (t === 0 ? [{ type: 'setTunable', key: 'raid.enabled', value: 0 }] : []));
    const heart = w.nodes.findIndex((n) => n.kind === 'heart');
    const sent = log.filter((l) => l.input.type === 'sendShips' && l.input.to === heart);
    expect(sent.length).toBeGreaterThan(0);
    expect(w.capturedTick).not.toBeNull();
    // It sent at least the estimate's mix.
    const mix = fieldMix(w, easy, heart, ['drone', 'lancer', 'flak'], 30)!;
    const first = sent[0]!.input as Extract<Input, { type: 'sendShips' }>;
    expect(first.counts.drone + first.counts.lancer + first.counts.flak).toBeGreaterThanOrEqual(mix.total > 0 ? 1 : 0);
  });

  it('adaptive waits for the raid window when the hive at full strength does not fit: it builds for the hive with a full-size raid away', () => {
    // The shipped-shape hive (12 Thorns, 24 Spores) is bigger than the limit allows; with a raid away it shrinks.
    const w = createWorld(1, fixtureV12);
    const hive = w.nodes.findIndex((n) => n.kind === 'heart');
    const full = fieldMix(w, fixtureV12, hive, ['drone', 'lancer', 'flak'], 60)!;
    const away = fullRaidAwayCounts(w, hive);
    const small = fieldMix(w, fixtureV12, hive, ['drone', 'lancer', 'flak'], 60, away.home)!;
    expect(small.total).toBeLessThan(full.total);
    expect(away.raid.thorn + away.raid.spore).toBeLessThanOrEqual(w.tun['raid.maxSize']);
    expect(guardsAtHome(w, hive)).toEqual({ thorn: away.home.thorn + away.raid.thorn, spore: away.home.spore + away.raid.spore });
  });

  it('static sets its weights on the first tick and never changes them again', () => {
    const shape = STATIC_SHAPES[1]!;
    const w = createWorld(1, easy);
    const log = play(w, easy, staticStrategy(shape).make(easy), 8 * MIN);
    const sets = log.filter((l) => l.input.type === 'setAlloc');
    expect(sets.every((l) => l.tick === 0)).toBe(true);
    for (const t of BUILD_TYPES) expect(w.field!.alloc[t], t).toBe(shape.weights[t]);
  });

  it('static attacks when the estimate fits: it sends only what the ships at the probe cover', () => {
    const w = createWorld(1, easy);
    const log = play(w, easy, staticStrategy(STATIC_SHAPES[2]!).make(easy), 10 * MIN, (t) => (t === 0 ? [{ type: 'setTunable', key: 'raid.enabled', value: 0 }] : []));
    expect(log.some((l) => l.input.type === 'sendShips')).toBe(true);
  });

  it('idle holds econ at raid.firstAtEcon - 1, then builds warships only', () => {
    const w = createWorld(1, easy);
    const hold = w.tun['raid.firstAtEcon'] - 1;
    play(w, easy, idle.make(easy), 8 * MIN);
    expect(w.stats.peakEcon).toBe(hold);
    expect(w.stats.econBuilt.extractor + w.stats.econBuilt.hauler).toBe(hold);
    expect(w.stats.shipsBuilt.drone).toBeGreaterThan(0);
    expect(w.stats.shipsBuilt.lancer + w.stats.shipsBuilt.flak).toBe(0);
  });

  it('drones-only never sets Lancer or Flak above 0, even with both unlocked and a raid mustering', () => {
    const w = createWorld(1, easy);
    w.stats.firstDeliveredTick.ice = 1;
    w.stats.firstDeliveredTick.crystal = 1;
    const a5 = w.nodes.findIndex((n) => n.id === 'a5');
    const bot = dronesOnly.make(easy);
    const log = play(w, easy, bot, 6 * MIN);
    setRaid(w, 'muster', a5, { thorn: 1, spore: 4 });
    log.push(...play(w, easy, bot, 600).map((l) => l));
    expect(log.some((l) => l.input.type === 'setAlloc' && (l.input.shipType === 'lancer' || l.input.shipType === 'flak') && l.input.weight > 0)).toBe(false);
    expect(lancerOf({ built: w.stats.shipsBuilt } as unknown as FieldResult)).toBe(0);
  });

  it('adaptive-no-raids runs adaptive with raid.enabled 0 (a tunable the runner sets on the first tick)', () => {
    expect(adaptiveNoRaids.tunables).toEqual({ 'raid.enabled': 0 });
    const r = runField(adaptiveNoRaids, 1, defaultData, { ...defaultFieldOptions(defaultData), capTicks: 2 * MIN });
    expect(r.raids.mustered).toBe(0);
  });

  it('no strategy ever sends an input the sim rejects (every input applies)', () => {
    for (const s of [adaptive, greedy, idle, dronesOnly, staticStrategy(STATIC_SHAPES[0]!)]) {
      const w = createWorld(1, easy);
      const bot = s.make(easy);
      for (let i = 0; i < 12 * MIN; i++) {
        const inputs = bot.decide(w, easy);
        const before = w.stats.allocChanges;
        const sets = inputs.filter((x) => x.type === 'setAlloc').length;
        step(w, easy, inputs);
        // Every setAlloc the bot emits changes a weight (weightInputs only emits changes).
        expect(w.stats.allocChanges - before, `${s.name} tick ${w.tick}`).toBe(sets);
      }
    }
  });
});

describe('the estimate is the min-wave estimate (acceptance 2: no other battle simulation)', () => {
  it('fieldMix on a node is the same minimum the H6 minMix finds, from full strength and from fewer guards at home', () => {
    const w = createWorld(1, fixtureV12);
    const hive = w.nodes.findIndex((n) => n.kind === 'heart');
    const a = fieldMix(w, fixtureV12, hive, ['drone', 'lancer', 'flak'], 60)!;
    const b = fieldMix(w, fixtureV12, hive, ['drone', 'lancer', 'flak'], 60, { thorn: 4, spore: 8 })!;
    expect(b.total).toBeLessThan(a.total);
    expect(a.fleet.drone + a.fleet.lancer + a.fleet.flak).toBe(a.total);
  });
});

describe('the gate (acceptance 3)', () => {
  const base = (over: Partial<FieldResult>): FieldResult =>
    ({ strategy: 'adaptive', variant: null, seed: 1, outcome: 'won', ticks: 100, hiveTick: 100, raids: { mustered: 0, beaten: 0, hit: 0, turnedBack: 0 }, raidLog: [], econBuilt: { extractor: 0, hauler: 0 }, econLost: { extractor: 0, hauler: 0 }, peakEcon: 0, peakHaulers: 0, allocChanges: 0, built: { extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 }, lost: { extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 }, peakPerMin: 0, tickMsP50: 0, tickMsP95: 0, finalHash: 'x', ...over }) as FieldResult;
  const names = ['adaptive', 'greedy', 'static', 'idle', 'drones-only', 'adaptive-no-raids'];
  const fails = (rs: FieldResult[]): string[] => fieldGateFailures(rs, FIELD_WINNERS, names, 2, TR);

  it('passes when every winner wins and nothing crashes', () => {
    expect(fails([base({}), base({ strategy: 'greedy' })])).toEqual([]);
  });
  it('fails on a crash of any strategy, controls included', () => {
    expect(fails([base({ strategy: 'idle', outcome: 'crash', error: 'bad' })])).toEqual(['idle seed 1: crash (bad)']);
  });
  it('fails on a tick p95 over budget', () => {
    expect(fails([base({ strategy: 'static', tickMsP95: 2.5 })]).join()).toContain('static: tick p95 2.500ms exceeds budget 2ms');
  });
  it('fails on a softlock or a timeout of adaptive or greedy on any seed', () => {
    expect(fails([base({ seed: 2, outcome: 'softlock' })]).join()).toContain('adaptive seed 2: softlock');
    expect(fails([base({ strategy: 'greedy', seed: 3, outcome: 'timeout' })]).join()).toContain('greedy seed 3: timeout');
  });
  it('does not fail on a control that times out or softlocks, or on any flag', () => {
    expect(fails([base({ strategy: 'static', outcome: 'timeout' }), base({ strategy: 'idle', outcome: 'softlock' }), base({ strategy: 'drones-only', outcome: 'timeout' })])).toEqual([]);
  });
});

describe('the seven capability flags (acceptance 4)', () => {
  const run = (over: Partial<FieldResult>): FieldResult =>
    ({ strategy: 'adaptive', variant: null, seed: 1, outcome: 'won', ticks: 100, hiveTick: 100, raids: { mustered: 0, beaten: 0, hit: 0, turnedBack: 0 }, raidLog: [], econBuilt: { extractor: 10, hauler: 10 }, econLost: { extractor: 0, hauler: 0 }, peakEcon: 20, peakHaulers: 8, allocChanges: 3, built: { extractor: 10, hauler: 10, drone: 0, lancer: 0, flak: 0 }, lost: { extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 }, peakPerMin: 0, tickMsP50: 0, tickMsP95: 0, finalHash: 'x', ...over }) as FieldResult;

  it('reports seven flags, each with pass, a name and a detail', () => {
    const flags = computeFieldFlags([run({})], fixtureV12);
    expect(flags).toHaveLength(7);
    for (const f of flags) {
      expect(typeof f.pass).toBe('boolean');
      expect(f.name.length).toBeGreaterThan(10);
      expect(f.detail.length).toBeGreaterThan(0);
    }
  });

  it('flag 1, splitting matters: static fails to win or loses half its economy, and adaptive wins', () => {
    const lost = { extractor: 6, hauler: 6 };
    const ok = computeFieldFlags([run({}), run({ strategy: 'static', econBuilt: { extractor: 10, hauler: 10 }, econLost: lost })], fixtureV12)[0]!;
    expect(ok.pass).toBe(true);
    expect(computeFieldFlags([run({}), run({ strategy: 'static', outcome: 'timeout' })], fixtureV12)[0]!.pass).toBe(true);
    expect(computeFieldFlags([run({}), run({ strategy: 'static', econLost: { extractor: 2, hauler: 2 } })], fixtureV12)[0]!.pass).toBe(false);
    expect(computeFieldFlags([run({ outcome: 'timeout' }), run({ strategy: 'static', outcome: 'timeout' })], fixtureV12)[0]!.pass).toBe(false);
  });

  it("flag 2, greed is answered: greedy's first hitting raid kills at least 2 economy ships and greedy wins", () => {
    const log = (n: number) => [{ startTick: 0, endTick: 1, outcome: 'hit' as const, econLost: n, planned: { thorn: 1, spore: 1 } }];
    expect(computeFieldFlags([run({ strategy: 'greedy', raidLog: log(2) })], fixtureV12)[1]!.pass).toBe(true);
    expect(computeFieldFlags([run({ strategy: 'greedy', raidLog: log(1) })], fixtureV12)[1]!.pass).toBe(false);
    expect(computeFieldFlags([run({ strategy: 'greedy', raidLog: log(3), outcome: 'timeout' })], fixtureV12)[1]!.pass).toBe(false);
    expect(computeFieldFlags([run({ strategy: 'greedy' })], fixtureV12)[1]!.pass).toBe(false);
  });

  it('flag 3, waiting is safe: idle is raided at most once', () => {
    const raids = (n: number) => ({ mustered: n, beaten: 0, hit: n, turnedBack: 0 });
    expect(computeFieldFlags([run({ strategy: 'idle', raids: raids(1) })], fixtureV12)[2]!.pass).toBe(true);
    expect(computeFieldFlags([run({ strategy: 'idle', raids: raids(2) })], fixtureV12)[2]!.pass).toBe(false);
  });

  it('flag 4 uses the min-wave estimate on the hive at home with a full-size raid removed', () => {
    const f = computeFieldFlags([], fixtureV12)[3]!;
    const w = createWorld(1, fixtureV12);
    const hive = w.nodes.findIndex((n) => n.kind === 'heart');
    const full = fieldMix(w, fixtureV12, hive, ['drone', 'lancer', 'flak'], w.tun['field.fleetCap'] + 10)!;
    const away = fullRaidAwayCounts(w, hive);
    const small = fieldMix(w, fixtureV12, hive, ['drone', 'lancer', 'flak'], w.tun['field.fleetCap'] + 10, away.home)!;
    expect(f.detail).toContain(`full strength ${full.total}`);
    expect(f.detail).toContain(`out ${small.total}`);
    expect(f.pass).toBe(small.total * 100 <= full.total * 70);
  });

  it("flag 5 reads the hive's best drone wave against field.fleetCap minus 10", () => {
    const f = computeFieldFlags([], fixtureV12)[4]!;
    expect(f.detail).toContain('against 20 warship slots');
  });

  it('flag 6 reads the best mix, the Mine slots plus the haulers adaptive ran at its peak, and the cap', () => {
    const f = computeFieldFlags([run({ peakHaulers: 7 })], fixtureV12)[5]!;
    const w = createWorld(1, fixtureV12);
    expect(f.detail).toContain(`full economy ${openSlots(w) + 7} (${openSlots(w)} Mine slots plus 7 haulers`);
    expect(f.detail).toContain('field.fleetCap 30');
  });

  it('flag 7 (no free first win) holds on the field, node by node', () => {
    const f = computeFieldFlags([], fixtureV12)[6]!;
    expect(f.pass).toBe(true);
    for (const id of ['p1', 'p2', 'heart']) expect(f.detail).toContain(`${id} needs more than`);
  });
});

describe('raids in the runs (h7-raids merged)', () => {
  it('idle holds below the raid threshold and is never raided; its raid count feeds flag 3', () => {
    const r = runField(idle, 1, fixtureV12, { ...defaultFieldOptions(fixtureV12), capTicks: 12 * MIN });
    expect(r.raids.mustered).toBe(0);
  });

  it('the runner logs each raid with its outcome and the economy ships it killed', () => {
    const r = runField(greedy, 1, fixtureV12, { ...defaultFieldOptions(fixtureV12), capTicks: 20 * MIN });
    expect(r.raids.mustered).toBeGreaterThan(0);
    const ended = r.raids.beaten + r.raids.hit + r.raids.turnedBack;
    expect(r.raidLog.length).toBe(ended);
    expect(r.raidLog.filter((x) => x.outcome === 'hit').length).toBe(r.raids.hit);
    expect(r.raidLog.reduce((n, x) => n + x.econLost, 0)).toBeLessThanOrEqual(r.econLost.extractor + r.econLost.hauler);
    for (const x of r.raidLog) expect(x.endTick).toBeGreaterThan(x.startTick);
  });

  it('greedy builds no warships and sends no response before its first hit, then answers the next muster at its target', () => {
    const w = createWorld(1, fixtureV12);
    const bot = greedy.make(fixtureV12);
    const log: { tick: number; input: Input }[] = [];
    let hitTick = -1;
    for (let i = 0; i < 40 * MIN && !(hitTick >= 0 && w.raid !== null && w.raid.phase === 'muster' && w.tick > hitTick); i++) {
      const inputs = bot.decide(w, fixtureV12);
      for (const input of inputs) log.push({ tick: w.tick, input });
      step(w, fixtureV12, inputs);
      if (hitTick < 0 && w.stats.raids.hit >= 1) hitTick = w.tick;
    }
    expect(hitTick).toBeGreaterThan(0);
    const before = log.filter((l) => l.tick < hitTick);
    expect(before.some((l) => l.input.type === 'setRally' || l.input.type === 'sendShips')).toBe(false);
    expect(before.some((l) => l.input.type === 'setAlloc' && l.input.shipType === 'drone' && l.input.weight > 0)).toBe(false);
    // The next muster (the loop ran one decision into it): the answer is in the world.
    const target = w.raid!.target;
    for (let i = 0; i < 3; i++) step(w, fixtureV12, bot.decide(w, fixtureV12));
    expect(w.rally).toBe(target);
  });

  it('adaptive answers a real muster: rally at the raid target by the time the raid launches', () => {
    const w = createWorld(1, fixtureV12);
    const bot = adaptive.make(fixtureV12);
    for (let i = 0; i < 20 * MIN && !(w.raid !== null && w.raid.phase === 'out'); i++) step(w, fixtureV12, bot.decide(w, fixtureV12));
    expect(w.raid).not.toBeNull();
    expect(w.rally).toBe(w.raid!.target);
  });
});

/** Test setup: economy ships parked at the probe. */
function addEcon(w: World, extractors: number, haulers: number): void {
  for (let i = 0; i < extractors + haulers; i++) w.field!.econ.push({ id: w.nextId++, type: i < extractors ? 'extractor' : 'hauler', hp: 6, at: 0, transit: null, target: null, cargo: 0, cargoRes: null });
}
const weightOf = (inputs: Input[], t: string): number | undefined => (inputs.find((i) => i.type === 'setAlloc' && i.shipType === t) as { weight: number } | undefined)?.weight;

describe('review round 1: the economy limit, the dead end, the gate and greedy', () => {
  it('in offence a muster in progress still applies the trade in slots: with econ + margin + the smallest hive wave above the limit, extractor and hauler weights go to 0', () => {
    const w = createWorld(1, easy);
    w.tun['field.fleetCap'] = 24;
    addEcon(w, 8, 6); // econ 14 >= 12: offence; 14 + 3 + 15 > 24
    w.field!.alloc.extractor = 1;
    w.field!.alloc.hauler = 1;
    w.stats.firstDeliveredTick.ice = 1;
    const a5 = w.nodes.findIndex((n) => n.id === 'a5');
    setRaid(w, 'muster', a5, { thorn: 1, spore: 3 });
    const inputs = adaptive.make(easy).decide(w, easy);
    expect(weightOf(inputs, 'extractor')).toBe(0);
    expect(weightOf(inputs, 'hauler')).toBe(0);
    expect(inputs).toContainEqual({ type: 'setAlloc', shipType: 'flak', weight: w.tun['alloc.maxWeight'] });
  });

  it('the dead end (offence latched, no plan fits, ore piling up): adaptive recycles economy ships, idle ones at the probe first, then builds the wave', () => {
    const w = createWorld(1, easy);
    w.tun['field.fleetCap'] = 22;
    w.tun['raid.enabled'] = 0;
    w.stats.firstDeliveredTick.ice = 1;
    addEcon(w, 8, 6);
    w.stock.ore = 500;
    w.stock.ice = 200;
    const bot = adaptive.make(easy);
    const first = bot.decide(w, easy);
    const rec = first.filter((i) => i.type === 'recycleShips');
    expect(rec).toHaveLength(1);
    expect(rec[0]).toMatchObject({ node: 0 });
    let recycled = 0;
    let hiveSent = false;
    for (let i = 0; i < 20 * MIN && w.capturedTick === null; i++) {
      const inputs = bot.decide(w, easy);
      for (const x of inputs) {
        if (x.type === 'recycleShips') recycled++;
        if (x.type === 'sendShips' && x.to === 10) hiveSent = true;
        if (x.type !== 'setAlloc') expect(isValidInput(w, easy, x), JSON.stringify(x)).toBe(true);
      }
      step(w, easy, inputs);
    }
    expect(recycled).toBeGreaterThan(0);
    expect(w.field!.econ.length).toBeGreaterThanOrEqual(w.tun['raid.firstAtEcon']);
    expect(hiveSent).toBe(true);
  });

  it('it never recycles below the economy floor, and not when even the floor leaves no room for the wave', () => {
    const w = createWorld(1, easy);
    w.tun['field.fleetCap'] = 18; // floor 6 + wave 15 > 18: hopeless, nothing to recycle toward
    w.tun['raid.enabled'] = 0;
    w.stats.firstDeliveredTick.ice = 1;
    addEcon(w, 8, 6);
    expect(adaptive.make(easy).decide(w, easy).some((i) => i.type === 'recycleShips')).toBe(false);
  });

  it('the dead end takes the other pocket first when that unlocks a mix that fits', () => {
    const w = createWorld(1, fixtureV12); // the 12/24 hive: Drone + Flak is over the cap, with Lancers it fits
    w.tun['raid.enabled'] = 0;
    w.stats.firstDeliveredTick.ice = 1;
    addEcon(w, 7, 5);
    const p2 = w.nodes.findIndex((n) => n.id === 'p2');
    const bot = adaptive.make(fixtureV12);
    const inputs = bot.decide(w, fixtureV12);
    expect(inputs.some((i) => i.type === 'recycleShips')).toBe(false);
    expect(weightOf(inputs, 'drone')).toBeGreaterThan(0);
    for (let i = 0; i < 15; i++) w.ships.push({ id: 800 + i, type: 'drone', hp: 10, at: 0, transit: null, engagedIn: -1 });
    expect(bot.decide(w, fixtureV12).filter((i) => i.type === 'sendShips')).toEqual([{ type: 'sendShips', from: 0, to: p2, counts: expect.anything() }]);
  });

  it('wounded survivors do not count as ready: the estimate assumes full health', () => {
    const w = createWorld(1, easy);
    w.ships.push({ id: 1, type: 'drone', hp: 10, at: 0, transit: null, engagedIn: -1 }, { id: 2, type: 'drone', hp: 2, at: 0, transit: null, engagedIn: -1 });
    expect(soundShips(w, 0).drone).toBe(1);
  });

  it('every static shape counts toward the gate: a crash in a non-best shape fails it', () => {
    const base = { variant: null, seed: 1, outcome: 'won', ticks: 1, hiveTick: 1, tickMsP95: 0 } as unknown as FieldResult;
    const best = { ...base, strategy: 'static', variant: 'even' } as FieldResult;
    const crashed = { ...base, strategy: 'static', variant: 'war-lean', outcome: 'crash', error: 'boom' } as FieldResult;
    const slow = { ...base, strategy: 'static', variant: 'flak-heavy', tickMsP95: 9 } as FieldResult;
    const names = ['static'];
    expect(fieldGateFailures(gateRuns([best], [best, crashed]), FIELD_WINNERS, names, 2, TR).join()).toContain('static seed 1: crash (boom)');
    expect(fieldGateFailures(gateRuns([best], [best, slow]), FIELD_WINNERS, names, 2, TR).join()).toContain('static: tick p95');
    expect(fieldGateFailures(gateRuns([best], [best]), FIELD_WINNERS, names, 2, TR)).toEqual([]);
  });

  it('greedy builds no warship, sends nothing and takes no pocket before its first hit, even with every open slot filled (raids off)', () => {
    const w = createWorld(1, easy);
    const log = play(w, easy, greedy.make(easy), 16 * MIN, (t) => (t === 0 ? [{ type: 'setTunable', key: 'raid.enabled', value: 0 }] : []));
    expect(w.field!.econ.length).toBeGreaterThanOrEqual(openSlots(w));
    expect(log.some((l) => l.input.type === 'sendShips' || l.input.type === 'setRally' || l.input.type === 'recycleShips')).toBe(false);
    expect(log.some((l) => l.input.type === 'setAlloc' && l.input.weight > 0 && l.input.shipType !== 'extractor' && l.input.shipType !== 'hauler')).toBe(false);
    expect(w.stats.shipsBuilt).toEqual({ drone: 0, lancer: 0, flak: 0 });
    expect(w.stats.captures).toHaveLength(0);
  });
});

describe('the frozen v12 field (no dead end)', () => {
  it('adaptive and greedy take the hive within the cap on the v12 fixture, with raids on', () => {
    for (const s of [adaptive, greedy]) {
      const r = runField(s, 1, fixtureV12);
      expect(r.outcome, s.name).toBe('won');
      expect(r.ticks).toBeLessThan(FIELD_CAP_MIN * MIN);
    }
  });
});
