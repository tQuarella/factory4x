import { describe, expect, it } from 'vitest';
import {
  BUILD_TYPES,
  PROBE,
  createWorld,
  guardianAt,
  isValidInput,
  recycleOrder,
  rockStatus,
  step,
  worldHash,
  type BuildType,
  type Input,
  type Raid,
  type World,
} from '../src/index.ts';
import { fixtureV14, shippedCampaign } from './fixture.ts';
import { addShips, setGuards } from './helpers.ts';
import { F, addEcon, quietField } from './field-helpers.ts';

/**
 * h8-sim acceptance 4: the inputs moveShips (H6), setHaulers (H7) and recycleFleet (H8), each with every invalid
 * case, on the frozen v14 fixture.
 */
const D = fixtureV14;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function tick(w: World, ...inputs: Input[]): void {
  step(w, D, inputs);
}

/** A quiet v14 field with no raids. */
function quiet(): World {
  const w = quietField(D);
  w.tun['raid.enabled'] = 0;
  return w;
}

/** Invalid and ignored: isValidInput says so, and a tick with it equals a tick without it. */
function expectIgnored(w: World, input: Input): void {
  expect(isValidInput(w, D, input), JSON.stringify(input)).toBe(false);
  const a = clone(w);
  const b = clone(w);
  step(a, D, [input]);
  step(b, D, []);
  expect(worldHash(a), JSON.stringify(input)).toBe(worldHash(b));
}

/** Warships of each type in transit from `from` to `to`. */
function flying(w: World, from: number, to: number): Record<string, number> {
  const c = { drone: 0, lancer: 0, flak: 0 };
  for (const s of w.ships) if (s.transit !== null && s.transit.from === from && s.transit.to === to) c[s.type] += 1;
  return c;
}

const counts = (c: Partial<Record<BuildType, number>>): Record<BuildType, number> => ({ extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0, ...c });

describe('moveShips (H6)', () => {
  /** 5 drones, 3 lancers and 1 flak parked at a5. */
  function fleet(): World {
    const w = quiet();
    addShips(w, F.a5, 5, 'drone');
    addShips(w, F.a5, 3, 'lancer');
    addShips(w, F.a5, 1, 'flak');
    return w;
  }

  it('all: every warship parked at the source goes, as a guard order (no attack) to an unguarded node', () => {
    const w = fleet();
    tick(w, { type: 'moveShips', from: F.a5, to: F.a1, part: 'all' });
    expect(flying(w, F.a5, F.a1)).toEqual({ drone: 5, lancer: 3, flak: 1 });
    expect(w.stats.wavesSent).toBe(0);
  });

  it('split at move.splitPct 50: floor per type (2 of 5 drones, 1 of 3 lancers, 0 of 1 flak); at 75: 3, 2, 0; at 25: 1, 0, 0', () => {
    for (const [pct, want] of [
      [50, { drone: 2, lancer: 1, flak: 0 }],
      [75, { drone: 3, lancer: 2, flak: 0 }],
      [25, { drone: 1, lancer: 0, flak: 0 }],
    ] as const) {
      const w = fleet();
      w.tun['move.splitPct'] = pct;
      tick(w, { type: 'moveShips', from: F.a5, to: F.a1, part: 'split' });
      expect(flying(w, F.a5, F.a1), `splitPct ${pct}`).toEqual(want);
    }
  });

  it('the 1-ship fallback: a split that rounds to 0 with warships there takes 1 of the first type present, in type order', () => {
    const w = quiet();
    addShips(w, F.a5, 1, 'flak');
    addShips(w, F.a5, 1, 'lancer');
    tick(w, { type: 'moveShips', from: F.a5, to: F.a1, part: 'split' });
    // Drone, lancer, flak: no drone, so a lancer.
    expect(flying(w, F.a5, F.a1)).toEqual({ drone: 0, lancer: 1, flak: 0 });
    const v = quiet();
    addShips(v, F.a5, 1, 'drone');
    addShips(v, F.a5, 1, 'flak');
    tick(v, { type: 'moveShips', from: F.a5, to: F.a1, part: 'split' });
    expect(flying(v, F.a5, F.a1)).toEqual({ drone: 1, lancer: 0, flak: 0 });
  });

  it('the lowest ids of each type go, as sendShips', () => {
    const w = quiet();
    addShips(w, F.a5, 4, 'drone');
    const ids = w.ships.map((s) => s.id);
    tick(w, { type: 'moveShips', from: F.a5, to: F.a1, part: 'split' });
    expect(w.ships.filter((s) => s.transit !== null).map((s) => s.id)).toEqual(ids.slice(0, 2));
  });

  it('to a guarded node it is an attack: a wave is counted', () => {
    const w = fleet();
    setGuards(w, F.p1, [['spore', 1]]);
    tick(w, { type: 'moveShips', from: F.a5, to: F.p1, part: 'split' });
    expect(flying(w, F.a5, F.p1)).toEqual({ drone: 2, lancer: 1, flak: 0 });
    expect([w.stats.wavesSent, guardianAt(w, F.p1)!.wavesSent]).toEqual([1, 1]);
  });

  it('economy ships are never carried: a source with only economy ships is an invalid move, and with warships too only the warships go', () => {
    const w = quiet();
    addEcon(w, 'extractor', F.a5, F.a5);
    addEcon(w, 'hauler', F.a5, F.a5);
    expectIgnored(w, { type: 'moveShips', from: F.a5, to: F.a1, part: 'all' });
    expectIgnored(w, { type: 'moveShips', from: F.a5, to: F.a1, part: 'split' });
    addShips(w, F.a5, 1, 'drone');
    tick(w, { type: 'moveShips', from: F.a5, to: F.a1, part: 'all' });
    expect(flying(w, F.a5, F.a1)).toEqual({ drone: 1, lancer: 0, flak: 0 });
    expect(w.field!.econ.every((s) => s.transit === null || s.transit.to !== F.a1)).toBe(true);
  });

  it('invalid and ignored: from = to, an empty source, ships only in transit there, a bad node index or part, and in a campaign world', () => {
    const w = fleet();
    expectIgnored(w, { type: 'moveShips', from: F.a5, to: F.a5, part: 'all' });
    expectIgnored(w, { type: 'moveShips', from: F.a2, to: F.a1, part: 'all' });
    expectIgnored(w, { type: 'moveShips', from: F.a2, to: F.a1, part: 'split' });
    expectIgnored(w, { type: 'moveShips', from: 99, to: F.a1, part: 'all' });
    expectIgnored(w, { type: 'moveShips', from: F.a5, to: -1, part: 'all' });
    expectIgnored(w, { type: 'moveShips', from: F.a5, to: F.a1, part: 'half' as 'all' });
    // Ships flying out of a5 are not "at" a5.
    const v = fleet();
    tick(v, { type: 'moveShips', from: F.a5, to: F.a1, part: 'all' });
    expectIgnored(v, { type: 'moveShips', from: F.a5, to: F.a2, part: 'all' });
    const c = createWorld(1, shippedCampaign);
    expect(isValidInput(c, shippedCampaign, { type: 'moveShips', from: 0, to: 1, part: 'all' })).toBe(false);
  });

  it('the counts are computed on the tick it applies: a ship that arrives earlier that tick is not carried, one parked then is', () => {
    const w = quiet();
    addShips(w, F.a5, 2, 'drone');
    // A drone one tick from a5 arrives in this tick's movement, after the inputs: the move takes the 2 parked.
    addShips(w, F.a1, 1, 'drone');
    const late = w.ships[2]!;
    late.at = null;
    late.transit = { from: F.a1, to: F.a5, ticksLeft: 1, totalTicks: 10 };
    tick(w, { type: 'moveShips', from: F.a5, to: F.a2, part: 'all' });
    expect(flying(w, F.a5, F.a2)).toEqual({ drone: 2, lancer: 0, flak: 0 });
    expect(late.at).toBe(F.a5);
    tick(w, { type: 'moveShips', from: F.a5, to: F.a2, part: 'all' });
    expect(flying(w, F.a5, F.a2)).toEqual({ drone: 3, lancer: 0, flak: 0 });
  });
});

describe('setHaulers (H7)', () => {
  it('valid on any asteroid, and on a pocket or the hive once captured; the count is null or 0..rock.haulerMax', () => {
    const w = quiet();
    for (const n of [F.a1, F.a2, F.a3, F.a4, F.a5, F.a6, F.a7]) expect(isValidInput(w, D, { type: 'setHaulers', node: n, count: 2 })).toBe(true);
    for (const count of [null, 0, 1, w.tun['rock.haulerMax']]) expect(isValidInput(w, D, { type: 'setHaulers', node: F.a1, count })).toBe(true);
    setGuards(w, F.p1, []);
    addShips(w, F.p1, 1);
    tick(w);
    expect(isValidInput(w, D, { type: 'setHaulers', node: F.p1, count: 1 })).toBe(true);
  });

  it('invalid and ignored: the probe, a guarded pocket or hive, a bad index, a count below 0, above rock.haulerMax, not an integer or not a number', () => {
    const w = quiet();
    expectIgnored(w, { type: 'setHaulers', node: PROBE, count: 1 });
    expectIgnored(w, { type: 'setHaulers', node: F.p1, count: 1 });
    expectIgnored(w, { type: 'setHaulers', node: F.heart, count: 1 });
    expectIgnored(w, { type: 'setHaulers', node: 42, count: 1 });
    expectIgnored(w, { type: 'setHaulers', node: F.a1, count: -1 });
    expectIgnored(w, { type: 'setHaulers', node: F.a1, count: w.tun['rock.haulerMax'] + 1 });
    expectIgnored(w, { type: 'setHaulers', node: F.a1, count: 1.5 });
    expectIgnored(w, { type: 'setHaulers', node: F.a1, count: '2' as unknown as number });
    // The max is live: lowering it narrows the range.
    w.tun['rock.haulerMax'] = 3;
    expectIgnored(w, { type: 'setHaulers', node: F.a1, count: 4 });
    const c = createWorld(1, shippedCampaign);
    expect(isValidInput(c, shippedCampaign, { type: 'setHaulers', node: 1, count: 1 })).toBe(false);
  });

  it('sets haulerSet, kept while the rock is unmarked; null restores Auto; repeating the value is valid and changes nothing', () => {
    const w = quiet();
    tick(w, { type: 'setHaulers', node: F.a3, count: 3 });
    expect(w.field!.haulerSet[F.a3]).toBe(3);
    tick(w, { type: 'setMine', node: F.a3, on: true });
    tick(w, { type: 'setMine', node: F.a3, on: false });
    expect(w.field!.haulerSet[F.a3]).toBe(3);
    const a = clone(w);
    tick(a, { type: 'setHaulers', node: F.a3, count: 3 });
    expect(a.field!.haulerSet).toEqual(w.field!.haulerSet);
    tick(w, { type: 'setHaulers', node: F.a3, count: null });
    expect(w.field!.haulerSet[F.a3]).toBeNull();
  });

  it('0 is allowed: the rock stays mined, its haulers leave as they get home, and its ore piles up (Backed up)', () => {
    const w = quiet();
    w.field!.mine[F.a1] = true;
    addEcon(w, 'extractor', F.a1, F.a1);
    addEcon(w, 'extractor', F.a1, F.a1);
    const h = addEcon(w, 'hauler', PROBE, F.a1);
    tick(w, { type: 'setHaulers', node: F.a1, count: 0 });
    expect([h.target, h.at]).toEqual([null, PROBE]);
    expect(rockStatus(w, F.a1)).toMatchObject({ mine: true, haulerTarget: 0, haulers: 0 });
    for (let i = 0; i < 1800 * 3; i++) tick(w);
    expect(rockStatus(w, F.a1)).toMatchObject({ backedUp: true, buffer: w.tun['node.bufferCap'], haulers: 0 });
  });
});

describe('recycleFleet (H8)', () => {
  /**
   * Extractors: e0 idle at the probe, e1 docked at a2, e2 docked at a1, e3 in transit to a5. Haulers: h0 in transit,
   * h1 at a2 (waiting), h2 idle at the probe, h3 at a1 (waiting). Drones: d0 at a5, d1 at the probe, d2 in transit.
   */
  function spread(): { w: World; e: number[]; h: number[]; d: number[] } {
    const w = quiet();
    w.field!.mine[F.a1] = true;
    w.field!.mine[F.a2] = true;
    w.field!.mine[F.a5] = true;
    const e0 = addEcon(w, 'extractor', PROBE);
    const e1 = addEcon(w, 'extractor', F.a2, F.a2);
    const e2 = addEcon(w, 'extractor', F.a1, F.a1);
    const e3 = addEcon(w, 'extractor', F.a5, F.a5);
    e3.at = null;
    e3.transit = { from: PROBE, to: F.a5, ticksLeft: 50, totalTicks: 133 };
    const h0 = addEcon(w, 'hauler', F.a1, F.a1);
    h0.at = null;
    h0.transit = { from: F.a1, to: PROBE, ticksLeft: 50, totalTicks: 131 };
    h0.cargo = 4;
    h0.cargoRes = 'ore';
    const h1 = addEcon(w, 'hauler', F.a2, F.a2);
    const h2 = addEcon(w, 'hauler', PROBE);
    const h3 = addEcon(w, 'hauler', F.a1, F.a1);
    addShips(w, F.a5, 1, 'drone');
    addShips(w, PROBE, 1, 'drone');
    addShips(w, F.a1, 1, 'drone');
    const d2 = w.ships[2]!;
    d2.at = null;
    d2.transit = { from: F.a1, to: F.a3, ticksLeft: 40, totalTicks: 63 };
    return { w, e: [e0.id, e1.id, e2.id, e3.id], h: [h0.id, h1.id, h2.id, h3.id], d: w.ships.map((s) => s.id) };
  }

  it('the order within a type: idle at the probe, then parked or docked by node index, then in transit; lowest id first in each group', () => {
    const { w, e, h, d } = spread();
    expect(recycleOrder(w, 'extractor').map((s) => s.id)).toEqual([e[0], e[2], e[1], e[3]]);
    expect(recycleOrder(w, 'hauler').map((s) => s.id)).toEqual([h[2], h[3], h[1], h[0]]);
    // Drones: d1 at the probe, d0 at a5, d2 in transit.
    expect(recycleOrder(w, 'drone').map((s) => s.id)).toEqual([d[1], d[0], d[2]]);
  });

  it('recycles up to the count of each type in that order, wherever they are, each refunding fleet.recycleRefundPct of its ore cost', () => {
    const { w, e, h, d } = spread();
    const stock = w.stock.ore;
    tick(w, { type: 'recycleFleet', counts: counts({ extractor: 2, hauler: 4, drone: 3 }) });
    const left = [...w.field!.econ.map((s) => s.id), ...w.ships.map((s) => s.id)];
    expect(left.sort((a, b) => a - b)).toEqual([e[1]!, e[3]!].sort((a, b) => a - b));
    const each = (t: BuildType): number => Math.floor((w.tun[`ship.${t}.cost`] * w.tun['fleet.recycleRefundPct']) / 100);
    const refund = 2 * each('extractor') + 4 * each('hauler') + 3 * each('drone');
    expect(refund).toBeGreaterThan(0);
    expect(w.stock.ore).toBe(stock + refund);
    expect(w.stats.oreRefunded).toBe(refund);
    expect([w.stats.econRecycled, w.stats.shipsRecycled]).toEqual([{ extractor: 2, hauler: 4 }, { drone: 3, lancer: 0, flak: 0 }]);
    void h;
    void d;
  });

  it('refunds at a non-default fleet.recycleRefundPct with uneven division: 33% of 15 (hauler) is 4, of 20 (extractor) is 6', () => {
    const { w } = spread();
    w.tun['fleet.recycleRefundPct'] = 33;
    const stock = w.stock.ore;
    tick(w, { type: 'recycleFleet', counts: counts({ extractor: 1, hauler: 1 }) });
    expect(w.tun['ship.hauler.cost']).toBe(15);
    expect(w.tun['ship.extractor.cost']).toBe(20);
    expect(w.stock.ore - stock).toBe(4 + 6);
  });

  it('a recycled hauler\'s cargo is lost: the hauler in transit with 4 ore is gone and the ore never reaches stock', () => {
    const { w, h } = spread();
    const delivered = w.stats.delivered.ore;
    tick(w, { type: 'recycleFleet', counts: counts({ hauler: 4 }) });
    expect(w.field!.econ.some((s) => s.id === h[0])).toBe(false);
    for (let i = 0; i < 200; i++) tick(w);
    expect(w.stats.delivered.ore).toBe(delivered);
  });

  it('a recycled docked extractor frees its slot at once, and F5 re-dispatches into it the same tick (a new extractor from the bay)', () => {
    const w = quiet();
    w.field!.mine[F.a3] = true;
    const docked = addEcon(w, 'extractor', F.a3, F.a3);
    tick(w);
    expect(rockStatus(w, F.a3)).toMatchObject({ docked: 1, bound: 1, slots: 1 });
    // A bay finishing this tick: its extractor spawns in F3 and is dispatched in F5, after the recycle in F1.
    w.field!.bays.extractor.ticksLeft = 1;
    tick(w, { type: 'recycleFleet', counts: counts({ extractor: 1 }) });
    expect(w.field!.econ.some((s) => s.id === docked.id)).toBe(false);
    const fresh = w.field!.econ.find((s) => s.type === 'extractor')!;
    expect([fresh.target, fresh.transit?.to]).toEqual([F.a3, F.a3]);
    expect(rockStatus(w, F.a3)).toMatchObject({ docked: 0, bound: 1, inFlight: 1 });
    // And the node's extractors count dropped in F1: nothing was extracted there this tick.
    expect(w.nodes[F.a3]!.extractors).toBe(0);
  });

  it('not eligible: ships at a living guarded node (in battle there), and ships at a raid\'s target while it fights', () => {
    const w = quiet();
    setGuards(w, F.p1, [['spore', 30]]);
    addShips(w, F.p1, 2, 'drone');
    addShips(w, F.a2, 1, 'drone');
    w.field!.mine[F.a5] = true;
    addEcon(w, 'extractor', F.a5, F.a5);
    addEcon(w, 'hauler', F.a5, F.a5);
    addShips(w, F.a5, 1, 'flak');
    const raid: Raid = {
      id: 1,
      phase: 'fight',
      target: F.a5,
      guards: [{ id: w.nextId++, type: 'spore', hp: 5 }],
      ticksLeft: 0,
      planned: { thorn: 0, spore: 1 },
      flightTicks: 0,
      from: F.a5,
      retargeted: false,
      lostEcon: { extractor: 0, hauler: 0 },
      lostShips: { drone: 0, lancer: 0, flak: 0 },
      killed: { thorn: 0, spore: 0 },
    };
    w.raid = raid;
    expect(recycleOrder(w, 'drone').map((s) => s.at)).toEqual([F.a2]);
    expect([recycleOrder(w, 'extractor'), recycleOrder(w, 'hauler'), recycleOrder(w, 'flak')]).toEqual([[], [], []]);
    expectIgnored(w, { type: 'recycleFleet', counts: counts({ extractor: 1, hauler: 1, flak: 1 }) });
    // Out of the fight phase (flying out) the target's ships are eligible again.
    raid.phase = 'out';
    expect(recycleOrder(w, 'flak')).toHaveLength(1);
    expect(recycleOrder(w, 'extractor')).toHaveLength(1);
    // A drone recycle count of 3 takes only the one at a2.
    tick(w, { type: 'recycleFleet', counts: counts({ drone: 3 }) });
    expect(w.ships.filter((s) => s.type === 'drone').map((s) => s.at)).toEqual([F.p1, F.p1]);
  });

  it('invalid and ignored: a clamped total of 0, a missing type, a negative or fractional count, a non-object, and in a campaign world', () => {
    const { w } = spread();
    expectIgnored(w, { type: 'recycleFleet', counts: counts({}) });
    expectIgnored(w, { type: 'recycleFleet', counts: counts({ lancer: 3, flak: 2 }) });
    const missing = counts({ drone: 1 }) as Partial<Record<BuildType, number>>;
    delete missing.flak;
    expectIgnored(w, { type: 'recycleFleet', counts: missing as Record<BuildType, number> });
    expectIgnored(w, { type: 'recycleFleet', counts: counts({ drone: -1, hauler: 1 }) });
    expectIgnored(w, { type: 'recycleFleet', counts: counts({ drone: 0.5 }) });
    expectIgnored(w, { type: 'recycleFleet', counts: null as unknown as Record<BuildType, number> });
    for (const t of BUILD_TYPES) expect(isValidInput(w, D, { type: 'recycleFleet', counts: counts({ [t]: 1 }) }), t).toBe(t !== 'lancer' && t !== 'flak');
    const c = createWorld(1, shippedCampaign);
    expect(isValidInput(c, shippedCampaign, { type: 'recycleFleet', counts: counts({ drone: 1 }) })).toBe(false);
  });

  it('recycleShips (per node) stays as it was', () => {
    const { w } = spread();
    tick(w, { type: 'recycleShips', node: F.a1, counts: { drone: 0, lancer: 0, flak: 0, extractor: 1, hauler: 1 } });
    expect(w.stats.econRecycled).toEqual({ extractor: 1, hauler: 1 });
  });
});
