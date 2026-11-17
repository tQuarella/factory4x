import { describe, expect, it } from 'vitest';
import { BUILD_TYPES, createWorld, defaultData, fleetStatus, guardianAt, isGuarded, rockStatus, step, type Input, type World } from '@factory4x/sim';
import { FIELD_CAP_MIN, runField, type FieldResult } from '../src/field-runner.ts';
import {
  AdaptiveBot,
  Backstops,
  OFFENCE_AT_ECON,
  adaptive,
  dronesOnly,
  econAliveNow,
  economyWeights,
  greedy,
  haulerShortfall,
  idle,
  openSlots,
  STATIC_SHAPES,
  staticStrategy,
} from '../src/field-strategies.ts';
import type { FieldBot, FieldStrategy, Weights } from '../src/field-runner.ts';

/**
 * H8 bot changes (DESIGN.md H8 "Bots (H8)") on the shipped data (`defaultData`, v14). Premises are structure, not
 * tuned values: a rock with a docked extractor needs a hauler, the economy was wiped when no economy ship is left,
 * and a bay that has not run for 2 minutes with ore in stock is idle. The whole-run tests play the shipped data to the end.
 */
const data = defaultData;
const TR = data.tickRate;
const MIN = 60 * TR;
const A5 = 5;
const ZERO: Weights = { extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 };

/** Push a docked extractor ship at a node. */
function dock(w: World, node: number, n = 1): void {
  for (let i = 0; i < n; i++) w.field!.econ.push({ id: w.nextId++, type: 'extractor', hp: 6, at: node, transit: null, target: node, cargo: 0, cargoRes: null });
}
/** Push a hauler: idle at the probe (no target), or assigned to a node. */
function hauler(w: World, target: number | null): void {
  w.field!.econ.push({ id: w.nextId++, type: 'hauler', hp: 6, at: 0, transit: null, target, cargo: 0, cargoRes: null });
}
/** Step the world with the inputs a bot decides each tick. */
function play(w: World, bot: FieldBot, ticks: number, each?: (w: World) => void): void {
  for (let i = 0; i < ticks; i++) {
    step(w, data, bot.decide(w, data));
    each?.(w);
  }
}
const weightsOf = (w: World): Weights => ({ ...w.field!.alloc }) as Weights;

describe('change 1: the Hauler weight follows the shortfall', () => {
  it('a rock with a docked extractor and no hauler is a shortfall; staffing it ends the shortfall', () => {
    const w = createWorld(1, data);
    expect(haulerShortfall(w)).toBe(0);
    dock(w, A5, 3);
    expect(rockStatus(w, A5).haulerTarget).toBeGreaterThan(0);
    const short = haulerShortfall(w);
    expect(short).toBe(rockStatus(w, A5).haulerTarget);
    for (let i = 0; i < short; i++) hauler(w, A5);
    expect(haulerShortfall(w)).toBe(0);
  });

  it('the weight stays on while a rock has a shortfall, even with a hauler for every slot (the H7 rule would drop it to 0)', () => {
    const w = createWorld(1, data);
    dock(w, A5, 3);
    for (let i = 0; i < openSlots(w); i++) hauler(w, null); // a hauler per slot, none assigned yet
    expect(fleetStatus(w, data).econByType.hauler).toBeGreaterThanOrEqual(openSlots(w));
    expect(haulerShortfall(w)).toBeGreaterThan(0);
    expect(economyWeights(w, data, false).hauler).toBe(w.tun['alloc.start.hauler']);
    expect(economyWeights(w, data, true).hauler).toBe(1); // lean (offence) too
  });

  it('with no shortfall and a hauler per slot the weight is 0, and it stays on while there are fewer haulers than slots', () => {
    const w = createWorld(1, data);
    dock(w, A5, 3);
    const need = rockStatus(w, A5).haulerTarget;
    for (let i = 0; i < need; i++) hauler(w, A5);
    expect(haulerShortfall(w)).toBe(0);
    expect(economyWeights(w, data, false).hauler).toBeGreaterThan(0); // fewer haulers than slots: the opening weights hold, H4 stops the sim building
    for (let i = need; i < openSlots(w); i++) hauler(w, A5);
    expect(haulerShortfall(w)).toBe(0);
    expect(economyWeights(w, data, false).hauler).toBe(0);
  });

  it('adaptive in offence at the fleet limit still asks for the haulers a taken pocket lacks (its deliveries unlock the type)', () => {
    const w = createWorld(1, data);
    const bot = new AdaptiveBot({ respond: true, dronesOnly: false, offenceGate: () => true });
    const p1 = w.nodes.findIndex((n) => n.id === 'p1');
    guardianAt(w, p1)!.alive = false;
    w.field!.mine[p1] = true;
    dock(w, p1, 2);
    for (let i = 0; i < 12; i++) hauler(w, null);
    w.tun['field.fleetCap'] = 7; // no hive wave plus the economy floor fits: nothing is recycled, limitEconomy zeroes the weights, but not the haulers a pocket lacks
    expect(haulerShortfall(w, 'pocket')).toBeGreaterThan(0);
    step(w, data, bot.decide(w, data));
    expect(w.field!.alloc.hauler).toBeGreaterThan(0);
    expect(w.field!.alloc.extractor).toBe(0);
  });

  it('an asteroid shortfall at the limit with no room for the wave builds no hauler (it would only be Recycled again)', () => {
    const w = createWorld(1, data);
    const bot = new AdaptiveBot({ respond: true, dronesOnly: false, offenceGate: () => true });
    dock(w, A5, 3);
    for (let i = 0; i < 12; i++) hauler(w, null);
    w.tun['field.fleetCap'] = 7;
    expect(haulerShortfall(w, 'pocket')).toBe(0);
    expect(haulerShortfall(w)).toBeGreaterThan(0);
    step(w, data, bot.decide(w, data));
    expect(w.field!.alloc.hauler).toBe(0);
  });


  it('the one exception: while economy ships are being Recycled toward a wave, no hauler is built back (it would thrash)', () => {
    const w = createWorld(1, data);
    const bot = new AdaptiveBot({ respond: true, dronesOnly: false, offenceGate: () => true });
    dock(w, A5, 3);
    for (let i = 0; i < 12; i++) hauler(w, null);
    w.tun['field.fleetCap'] = 12; // a pocket wave plus the economy floor fits: the economy comes down toward it
    expect(haulerShortfall(w)).toBeGreaterThan(0);
    const inputs = bot.decide(w, data);
    expect(inputs.some((i) => i.type === 'recycleShips' && i.counts.hauler === 1)).toBe(true);
    step(w, data, inputs);
    expect(w.field!.alloc.hauler).toBe(0);
  });
});

describe('change 2: the economy wiped', () => {
  /** Adaptive played into offence (econ at OFFENCE_AT_ECON), then every economy ship and bay emptied. */
  function wipedAdaptive(): { w: World; bot: FieldBot } {
    const w = createWorld(1, data);
    const bot = adaptive.make(data);
    let guard = 0;
    while (econAliveNow(w, data) < OFFENCE_AT_ECON && guard++ < 20 * MIN) step(w, data, bot.decide(w, data));
    expect(econAliveNow(w, data)).toBeGreaterThanOrEqual(OFFENCE_AT_ECON);
    play(w, bot, 5 * TR); // offence: the weights are lean
    expect(w.field!.alloc.extractor).toBeLessThanOrEqual(1);
    w.field!.econ = [];
    w.field!.bays.extractor.ticksLeft = 0;
    w.field!.bays.hauler.ticksLeft = 0;
    return { w, bot };
  }

  it('adaptive sets Extractor and Hauler back to the opening weights, and keeps them there until econ reaches raid.firstAtEcon - 1', () => {
    const { w, bot } = wipedAdaptive();
    expect(fleetStatus(w, data).econByType.extractor + fleetStatus(w, data).econBuildingByType.extractor).toBe(0);
    play(w, bot, 1);
    expect(w.field!.alloc.extractor).toBe(w.tun['alloc.start.extractor']);
    expect(w.field!.alloc.hauler).toBe(w.tun['alloc.start.hauler']);
    const resume = w.tun['raid.firstAtEcon'] - 1;
    let held = 0;
    while (econAliveNow(w, data) < resume && held < 15 * MIN) {
      play(w, bot, 1);
      if (econAliveNow(w, data) < resume) {
        expect(w.field!.alloc.extractor).toBe(w.tun['alloc.start.extractor']);
        // the Hauler weight is the opening one too, but H4 may pause the bay; the weight itself is what the bot sets
        expect(w.field!.alloc.hauler).toBe(w.tun['alloc.start.hauler']);
      }
      held++;
    }
    expect(econAliveNow(w, data)).toBeGreaterThanOrEqual(resume);
    // After that adaptive plays its own rules again: offence weights are lean (at most 1).
    play(w, bot, 3 * TR);
    expect(w.field!.alloc.extractor).toBeLessThanOrEqual(1);
    expect(w.field!.alloc.hauler).toBeLessThanOrEqual(1);
  });

  it('greedy and drones-only recover the same way; a strategy that never had an economy does not "recover" at the start', () => {
    for (const s of [greedy, dronesOnly]) {
      const w = createWorld(1, data);
      const bot = s.make(data);
      let g = 0;
      while (econAliveNow(w, data) < 8 && g++ < 20 * MIN) step(w, data, bot.decide(w, data));
      w.field!.econ = [];
      w.field!.bays.extractor.ticksLeft = 0;
      w.field!.bays.hauler.ticksLeft = 0;
      play(w, bot, 1);
      expect(w.field!.alloc.extractor, s.name).toBe(w.tun['alloc.start.extractor']);
      expect(w.field!.alloc.hauler, s.name).toBe(w.tun['alloc.start.hauler']);
    }
    const w = createWorld(1, data);
    const lean: Weights = { ...ZERO, extractor: 1, hauler: 1 };
    new Backstops(false).apply(w, data, lean);
    expect(lean).toEqual({ ...ZERO, extractor: 1, hauler: 1 }); // 0 economy ships at tick 0 is not a wipe
  });

  it('static keeps its shape and idle holds below the threshold: neither is moved by change 2', () => {
    const shape = STATIC_SHAPES[0]!;
    const w = createWorld(1, data);
    const st = staticStrategy(shape).make(data);
    play(w, st, 2 * MIN);
    w.field!.econ = [];
    play(w, st, 1);
    expect(weightsOf(w)).toEqual(shape.weights);
    const w2 = createWorld(1, data);
    const id = idle.make(data);
    play(w2, id, 4 * MIN);
    w2.field!.econ = [];
    play(w2, id, 1);
    expect(w2.field!.alloc.drone).toBe(0); // idle builds economy to raid.firstAtEcon - 1 by its own rule
    expect(w2.field!.alloc.extractor).toBe(w2.tun['alloc.start.extractor']);
  });
});

describe('change 3: nothing to build', () => {
  /** A world with ore in stock, no bay running, and a tick count the caller sets. */
  function rich(tick: number): World {
    const w = createWorld(1, data);
    w.stock.ore = 500;
    w.tick = tick;
    return w;
  }

  it('after 2 game minutes with no bay running, ore for a drone and every warship weight 0: the counter type (a Drone before a pocket) goes to 1', () => {
    const w = rich(0);
    const b = new Backstops(false);
    b.apply(w, data, { ...ZERO });
    w.tick = 2 * MIN - 1;
    const early: Weights = { ...ZERO };
    b.apply(w, data, early);
    expect(early.drone).toBe(0); // not yet 2 minutes
    w.tick = 2 * MIN;
    const late: Weights = { ...ZERO };
    b.apply(w, data, late);
    expect(late).toEqual({ ...ZERO, drone: 1 });
  });

  it('not while the strategy already weights a warship, a bay is running, or the ore is below the dearest warship', () => {
    const w = rich(0);
    const b = new Backstops(false);
    b.apply(w, data, { ...ZERO });
    w.tick = 3 * MIN;
    const wants: Weights = { ...ZERO, lancer: 2 };
    b.apply(w, data, wants);
    expect(wants).toEqual({ ...ZERO, lancer: 2 });
    const poor = rich(0);
    const b2 = new Backstops(false);
    b2.apply(poor, data, { ...ZERO });
    poor.tick = 3 * MIN;
    poor.stock.ore = 1;
    const none: Weights = { ...ZERO };
    b2.apply(poor, data, none);
    expect(none).toEqual(ZERO);
  });

  it('holds once triggered while the strategy wants no warship, and lets go when it does', () => {
    const w = rich(0);
    const b = new Backstops(false);
    b.apply(w, data, { ...ZERO });
    w.tick = 2 * MIN;
    b.apply(w, data, { ...ZERO });
    w.stock.ore = 1; // the drone bought it: the next tick has little ore, the weight still holds
    w.tick += 1;
    const held: Weights = { ...ZERO };
    b.apply(w, data, held);
    expect(held.drone).toBe(1);
    b.apply(w, data, { ...ZERO, flak: 3 });
    const after: Weights = { ...ZERO };
    w.stock.ore = 1;
    b.apply(w, data, after);
    expect(after.drone).toBe(0);
  });

  it('drones-only gets a Drone, never a Lancer or Flak; the counter type is used when it is unlocked', () => {
    const w = rich(0);
    const b = new Backstops(true);
    b.apply(w, data, { ...ZERO });
    w.tick = 2 * MIN;
    const x: Weights = { ...ZERO };
    b.apply(w, data, x);
    expect(x).toEqual({ ...ZERO, drone: 1 });
  });

  it('haulers enough, every warship weight 0 and ore piling up: adaptive (offence never starts) builds a Drone and the ore is spent', () => {
    const w = createWorld(1, data);
    w.tun['raid.enabled'] = 0;
    const bot = new AdaptiveBot({ respond: true, dronesOnly: false, offenceGate: () => false });
    // The economy fills every open slot and is staffed; nothing else is wanted.
    let g = 0;
    while (g++ < 25 * MIN) {
      step(w, data, bot.decide(w, data));
      if (w.stats.shipsBuilt.drone > 0) break;
    }
    expect(w.stats.shipsBuilt.drone, 'a drone is built by the backstop').toBeGreaterThan(0);
    const e = fleetStatus(w, data);
    expect(e.econByType.extractor).toBeGreaterThanOrEqual(openSlots(w));
    expect(haulerShortfall(w)).toBe(0);
    // Without the backstop it would have waited: its own weights were all 0 (economy full).
    expect(BUILD_TYPES.filter((t) => t !== 'extractor' && t !== 'hauler').some((t) => w.field!.alloc[t] > 0)).toBe(true);
  });

  it('idle is exempt: with the same state it keeps every warship weight it chose (it builds warships itself after holding)', () => {
    const w = createWorld(1, data);
    const bot = idle.make(data);
    play(w, bot, 1);
    expect(weightsOf(w).extractor).toBe(w.tun['alloc.start.extractor']);
  });
});

describe('the no-plan-fits table (cells without a traced run)', () => {
  it('drones-only: no hive plan fits by design, so it keeps building drones up to the limit', () => {
    let peak = 0;
    let full = false;
    const r = runField(dronesOnly, 1, data, { capTicks: 20 * MIN, softlockTicks: 5 * MIN, onTick: (w) => {
      const f = fleetStatus(w, data);
      peak = Math.max(peak, f.byType.drone);
      if (f.full) full = true;
    } });
    expect(['timeout']).toContain(r.outcome);
    expect(full, 'the fleet reaches its limit').toBe(true);
    expect(peak).toBeGreaterThan(10);
  });

  it('static waits: it never recycles economy ships, and its weights never change after tick 0', () => {
    const w = createWorld(1, data);
    const bot = staticStrategy(STATIC_SHAPES[1]!).make(data);
    let recycles = 0;
    let changes = 0;
    for (let i = 0; i < 25 * MIN; i++) {
      const inputs: Input[] = bot.decide(w, data);
      for (const input of inputs) {
        if (input.type === 'recycleShips' && (input.counts.extractor ?? 0) + (input.counts.hauler ?? 0) > 0) recycles++;
        if (input.type === 'setAlloc' && w.tick > 0) changes++;
      }
      step(w, data, inputs);
    }
    expect(recycles).toBe(0);
    expect(changes).toBe(0);
  });
});

describe('greedy hands its backstops to the adaptive bot it becomes', () => {
  it('a first hit that takes the economy below 2 ships: greedy then holds Extractor and Hauler at the start weights until econ reaches raid.firstAtEcon - 1', () => {
    const w = createWorld(1, data);
    const bot = greedy.make(data);
    let g = 0;
    while (econAliveNow(w, data) < 8 && g++ < 20 * MIN) step(w, data, bot.decide(w, data));
    // The first hit is the tick the stats say so; it wipes the economy at the same time.
    w.field!.econ = [];
    w.field!.bays.extractor.ticksLeft = 0;
    w.field!.bays.hauler.ticksLeft = 0;
    w.stats.raids.hit = 1;
    play(w, bot, 1);
    const resume = w.tun['raid.firstAtEcon'] - 1;
    let held = 0;
    while (econAliveNow(w, data) < resume && held++ < 15 * MIN) {
      expect(w.field!.alloc.extractor).toBe(w.tun['alloc.start.extractor']);
      expect(w.field!.alloc.hauler).toBe(w.tun['alloc.start.hauler']);
      play(w, bot, 1);
    }
    expect(econAliveNow(w, data)).toBeGreaterThanOrEqual(resume);
  });
});

describe('whole runs on the shipped data: the winners never idle with resources piling up', () => {
  const runs = new Map<string, { r: FieldResult; hauler0WithShortfall: number; peakOre: number; atEnd: number; limitTicks: number; recycleTicks: number }>();
  const play1 = (s: typeof adaptive): { r: FieldResult; hauler0WithShortfall: number; peakOre: number; atEnd: number; limitTicks: number; recycleTicks: number } => {
    const hit = runs.get(s.name);
    if (hit !== undefined) return hit;
    let hauler0 = 0;
    let peakOre = 0;
    let atEnd = 0;
    let limitTicks = 0;
    let recycleTicks = 0;
    type Probe = { haulerBlock: 'limit' | 'recycling' | null; blockLoad: number };
    // The amendment to change 1 is checked on the world the bot decided on: Hauler 0 with a shortfall only (a) at the
    // limit for an asteroid shortfall that the wave being built leaves no room for, (b) while recycling, except a taken pocket with no hauler.
    const spy: FieldStrategy = {
      ...s,
      make: (d) => {
        const inner = s.make(d);
        return {
          decide(w, dd): Input[] {
            const inputs = inner.decide(w, dd);
            const set = inputs.find((i) => i.type === 'setAlloc' && i.shipType === 'hauler') as { weight: number } | undefined;
            const weight = set === undefined ? w.field!.alloc.hauler : set.weight;
            if (weight === 0 && haulerShortfall(w) > 0) {
              const p = inner as unknown as Probe;
              const bare = w.nodes.some((n) => n.kind === 'pocket' && !isGuarded(w, n.index) && rockStatus(w, n.index).haulers === 0);
              const ok = p.haulerBlock === 'limit' ? haulerShortfall(w, 'pocket') === 0 && p.blockLoad >= w.tun['field.fleetCap'] : p.haulerBlock === 'recycling' ? !bare : false;
              if (!ok) hauler0++;
              if (p.haulerBlock === 'limit') limitTicks++;
              if (p.haulerBlock === 'recycling') recycleTicks++;
            }
            return inputs;
          },
        };
      },
    };
    const r = runField(spy, 1, data, { capTicks: FIELD_CAP_MIN * MIN, softlockTicks: 5 * MIN, onTick: (w) => {
      peakOre = Math.max(peakOre, w.stock.ore);
      atEnd = w.stock.ore;
    } });
    const out = { r, hauler0WithShortfall: hauler0, peakOre, atEnd, limitTicks, recycleTicks };
    runs.set(s.name, out);
    return out;
  };

  for (const s of [adaptive, greedy]) {
    it(`${s.name} takes the hive within the cap on v14, and never sits with ore for a warship, room, and no bay running for 3 game minutes`, () => {
      const { r } = play1(s);
      expect(r.outcome).toBe('won');
      expect(r.ticks).toBeLessThan(FIELD_CAP_MIN * MIN);
      expect(r.idleWithOreMin).toBeLessThan(3);
    });

    it(`${s.name}: the 15-minute trace shows an economy, warships and little ore in stock (no pile)`, () => {
      const { r, peakOre } = play1(s);
      const t = r.trace.find((x) => x.minute === 15);
      expect(t, 'the run reaches minute 15').toBeDefined();
      expect(t!.extractors + t!.haulers).toBeGreaterThan(0);
      expect(t!.warships.drone + t!.warships.lancer + t!.warships.flak).toBeGreaterThan(0);
      expect(t!.stockOre).toBeLessThan(300);
      expect(peakOre).toBeLessThan(1000);
    });

    it(`${s.name}: staffing holds: at most 1 hauler idle at the probe outside raids, no rock backed up for 30 s with its target met`, () => {
      const { r } = play1(s);
      // H9: a two-prong hit can kill two extractors at once; the haulers of those rocks idle at the probe for a few seconds until they rebalance (adaptive: 0.07 min, once). Under 15 s a run.
      expect(r.idleHaulers.minutesOver1).toBeLessThan(0.25);
      for (const [rock, b] of Object.entries(r.backedUp)) expect(b.longest, rock).toBeLessThan(30);
    });
  }

  it('the hauler weight is 0 with a shortfall only in the two cases the amendment allows: exactly zero ticks outside them', () => {
    for (const s of [adaptive, greedy]) {
      const x = play1(s);
      expect(x.hauler0WithShortfall, s.name).toBe(0);
      if (s.name === 'adaptive') expect(x.limitTicks + x.recycleTicks, 'the exceptions are exercised').toBeGreaterThan(0);
    }
  });

  it('the controls that cannot win do not idle with ore either: drones-only keeps building to the limit, idle is the control for waiting', () => {
    const r = runField(dronesOnly, 1, data, { capTicks: 30 * MIN, softlockTicks: 5 * MIN });
    expect(r.idleWithOreMin).toBeLessThan(3);
  });

  it('the shield holds (raid.shieldEcon 1 ships): no economy ship is lost in a tick that began with a warship at the raid target, in adaptive and greedy', () => {
    expect(createWorld(1, data).tun['raid.shieldEcon']).toBe(1);
    for (const s of [adaptive, greedy]) expect(play1(s).r.econLostGuarded, s.name).toBe(0);
  });
});
