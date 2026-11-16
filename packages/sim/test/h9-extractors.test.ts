import { describe, expect, it } from 'vitest';
import {
  PROBE,
  allocStatus,
  createWorld,
  extCap,
  extractorMinCount,
  extractorShortfall,
  guardianAt,
  hashState,
  isValidInput,
  rockStatus,
  step,
  worldHash,
  type EconShip,
  type Input,
  type World,
} from '../src/index.ts';
import { boundCounts, staffCounts } from '../src/field.ts';
import { startTransit } from '../src/ships.ts';
import { fixtureV15, shippedCampaign } from './fixture.ts';
import { addShips, setGuards } from './helpers.ts';
import { F, addEcon, quietField } from './field-helpers.ts';

/**
 * h9-sim acceptance 2 and 3: the extractor dial (DESIGN.md H9 X1–X4) on the frozen v15 fixture, whose map.field is
 * the shipped one (data-h9.test.ts checks it). Slots on that field: a1 2, a2 2, a3 1, a4 1, a5 3, a6 2, a7 2, p1 2,
 * p2 2, the hive 4. Distances from the probe: a1 and a2 262, a3 and a4 503, a5 530, a6 and a7 632.
 */
const D = fixtureV15;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const set = (node: number, count: number | null): Input => ({ type: 'setExtractors', node, count });

function tick(w: World, ...inputs: Input[]): void {
  step(w, D, inputs);
}

function run(w: World, n: number): void {
  for (let i = 0; i < n; i++) step(w, D, []);
}

/** A quiet v15 field (no stock, no probe mining, every weight 0, no marks) with these rocks Mine-marked and no raids. */
function marked(...nodes: number[]): World {
  const w = quietField(D);
  w.tun['raid.enabled'] = 0;
  for (const n of nodes) w.field!.mine[n] = true;
  return w;
}

/** `n` extractors docked at `node`, returned in id order. */
function dock(w: World, node: number, n: number): EconShip[] {
  const out: EconShip[] = [];
  for (let i = 0; i < n; i++) out.push(addEcon(w, 'extractor', node, node));
  return out;
}

/** An extractor bound to `node` and on its way there from the probe (as F5 leaves one it dispatched). */
function flyingTo(w: World, node: number): EconShip {
  const s = addEcon(w, 'extractor', PROBE, node);
  startTransit(w, s, node);
  return s;
}

/** Captures the pocket or hive at `node` (F11, with its free extractors), then removes the drone that took it. */
function capture(w: World, node: number): void {
  setGuards(w, node, []);
  addShips(w, node, 1);
  tick(w);
  expect(guardianAt(w, node)!.alive).toBe(false);
  w.ships = [];
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

const idleAtProbe = (w: World): number[] =>
  w.field!.econ.filter((s) => s.type === 'extractor' && s.target === null && s.at === PROBE && s.transit === null).map((s) => s.id);

describe('X1 setExtractors: the valid range', () => {
  it('an asteroid takes null (All) or 1..its slots', () => {
    const w = marked();
    for (const [n, slots] of [[F.a1, 2], [F.a3, 1], [F.a5, 3], [F.a7, 2]] as const) {
      expect([n, extractorMinCount(w, n), w.nodes[n]!.slots]).toEqual([n, 1, slots]);
      for (let c = 1; c <= slots; c++) expect(isValidInput(w, D, set(n, c)), `${n} ${c}`).toBe(true);
      expect(isValidInput(w, D, set(n, null))).toBe(true);
      expect(isValidInput(w, D, set(n, 0))).toBe(false);
      expect(isValidInput(w, D, set(n, slots + 1))).toBe(false);
    }
  });

  it('a captured pocket or the hive takes max(1, free extractors)..its slots: free 0, 1 (the equal case) and above 1', () => {
    // [pocket.freeExtractors or heart.freeExtractors, the node's free extractors after capture, minCount]
    const cases = [
      { node: F.p1, key: 'pocket.freeExtractors', free: 0, min: 1 },
      { node: F.p1, key: 'pocket.freeExtractors', free: 1, min: 1 },
      { node: F.p1, key: 'pocket.freeExtractors', free: 2, min: 2 },
      { node: F.heart, key: 'heart.freeExtractors', free: 1, min: 1 },
      { node: F.heart, key: 'heart.freeExtractors', free: 3, min: 3 },
    ] as const;
    for (const c of cases) {
      const w = marked();
      w.tun[c.key] = c.free;
      capture(w, c.node);
      const slots = w.nodes[c.node]!.slots;
      const tag = `${c.node} free ${c.free}`;
      expect([w.field!.free[c.node], extractorMinCount(w, c.node)], tag).toEqual([c.free, c.min]);
      for (let k = 0; k <= slots + 1; k++) expect(isValidInput(w, D, set(c.node, k)), `${tag} count ${k}`).toBe(k >= c.min && k <= slots);
      expect(isValidInput(w, D, set(c.node, null)), tag).toBe(true);
    }
  });
});

describe('X1 setExtractors: invalid inputs change nothing', () => {
  it('0, above the slots, not an integer, a guarded pocket or hive, the probe, a bad index, and in a campaign world', () => {
    const w = marked(F.a5);
    dock(w, F.a5, 2);
    expectIgnored(w, set(F.a5, 0));
    expectIgnored(w, set(F.a5, 4));
    expectIgnored(w, set(F.a5, -1));
    expectIgnored(w, set(F.a5, 1.5));
    expectIgnored(w, set(F.a5, '2' as unknown as number));
    expectIgnored(w, set(F.p1, 1));
    expectIgnored(w, set(F.p1, null));
    expectIgnored(w, set(F.heart, 2));
    expectIgnored(w, set(PROBE, null));
    expectIgnored(w, set(PROBE, 1));
    expectIgnored(w, set(42, 1));
    const c = createWorld(1, shippedCampaign);
    expect(isValidInput(c, shippedCampaign, set(1, 1))).toBe(false);
  });
});

describe('X1 kept while unmarked, applied on re-mark', () => {
  it('a count set on an unmarked rock is kept through marks, and caps F5 the tick the rock is marked', () => {
    const w = marked();
    for (let i = 0; i < 3; i++) addEcon(w, 'extractor', PROBE);
    tick(w, set(F.a5, 1));
    expect(w.field!.extractorSet[F.a5]).toBe(1);
    expect(idleAtProbe(w)).toHaveLength(3);
    // All idle; mark a5: exactly one goes, on that tick.
    const all = clone(w);
    tick(w, { type: 'setMine', node: F.a5, on: true });
    expect([boundCounts(w)[F.a5], idleAtProbe(w).length]).toEqual([1, 2]);
    // The same re-mark with All would have taken all three (the slots).
    tick(all, set(F.a5, null), { type: 'setMine', node: F.a5, on: true });
    expect([boundCounts(all)[F.a5], idleAtProbe(all).length]).toEqual([3, 0]);
    // Unmark and re-mark: the setting is still there, and still caps.
    tick(w, { type: 'setMine', node: F.a5, on: false });
    expect(w.field!.extractorSet[F.a5]).toBe(1);
    run(w, 400);
    expect(boundCounts(w)[F.a5]).toBe(0);
    tick(w, { type: 'setMine', node: F.a5, on: true });
    expect([w.field!.extractorSet[F.a5], boundCounts(w)[F.a5]]).toEqual([1, 1]);
    expect(rockStatus(w, F.a5)).toMatchObject({ extractorSet: 1, extCap: 1, slots: 3 });
  });
});

describe('X2 the cap', () => {
  it('F5 never dispatches past extCap: a5 (nearest) set 2 takes 2, a6 takes its slots, the fifth idles', () => {
    const w = marked(F.a5, F.a6);
    for (let i = 0; i < 5; i++) addEcon(w, 'extractor', PROBE);
    tick(w, set(F.a5, 2));
    for (let t = 0; t < 600; t++) {
      tick(w);
      const b = boundCounts(w);
      expect(b[F.a5]!, `tick ${w.tick}`).toBeLessThanOrEqual(2);
      expect(b[F.a6]!).toBeLessThanOrEqual(2);
    }
    const r5 = rockStatus(w, F.a5);
    expect([r5.docked, r5.bound, r5.extCap, rockStatus(w, F.a6).docked, idleAtProbe(w).length]).toEqual([2, 2, 2, 2, 1]);
  });

  it('free extractors count against extCap: a captured p1 (1 free) set 1 takes no ship, set 2 takes one', () => {
    const w = marked();
    capture(w, F.p1);
    addEcon(w, 'extractor', PROBE);
    tick(w, set(F.p1, 1));
    run(w, 5);
    expect([boundCounts(w)[F.p1], idleAtProbe(w).length]).toEqual([0, 1]);
    tick(w, set(F.p1, 2));
    expect(boundCounts(w)[F.p1]).toBe(1);
  });

  it('H4b holds the Extractor share (enough) while every marked rock is at its extCap, and the bay never starts', () => {
    const w = marked(F.a1, F.a5);
    dock(w, F.a1, 1);
    dock(w, F.a5, 1);
    w.stock.ore = 200;
    w.field!.alloc.extractor = 3;
    // A full share: under All the bay would start on the next tick (a1 and a5 have free slots).
    const cost = w.tun['ship.extractor.cost'];
    w.field!.share.extractor = cost;
    tick(w, set(F.a1, 1), set(F.a5, 1));
    for (let t = 0; t < 300; t++) {
      tick(w);
      expect(w.field!.bays.extractor.ticksLeft).toBe(0);
    }
    expect(extractorShortfall(w)).toBe(0);
    expect([w.stats.econBuilt.extractor, w.field!.share.extractor]).toEqual([0, cost]);
    expect(allocStatus(w, D).rows.find((r) => r.type === 'extractor')!.state).toBe('enough');
  });

  it('committed extractors (the bay\'s, a full share) pick by extCap: a1 set 1 sends them to a2', () => {
    const w = marked(F.a1, F.a2);
    dock(w, F.a1, 1);
    w.field!.alloc.extractor = 3;
    w.field!.share.extractor = w.tun['ship.extractor.cost'];
    w.field!.bays.extractor.ticksLeft = 50;
    // All: a1 (nearest, the lower index) has one slot free, so the bay's goes there and the share's to a2.
    expect([staffCounts(w)[F.a1], staffCounts(w)[F.a2]]).toEqual([2, 1]);
    tick(w, set(F.a1, 1));
    // a1 at its cap of 1: both go to a2, which is staffed (H1 amendment) and has a need.
    expect([staffCounts(w)[F.a1], staffCounts(w)[F.a2]]).toEqual([1, 2]);
    expect(rockStatus(w, F.a2).haulerNeed).toBeGreaterThan(0);
  });
});

describe('X3 lowering', () => {
  it('unbinds the ones in flight before the docked ones, whatever their ids, then the docked by highest id', () => {
    const w = marked(F.a5);
    const d1 = addEcon(w, 'extractor', F.a5, F.a5);
    const f1 = flyingTo(w, F.a5);
    const d2 = addEcon(w, 'extractor', F.a5, F.a5);
    expect(d1.id < f1.id && f1.id < d2.id).toBe(true);
    const unboundBy = (count: number): number[] => {
      const c = clone(w);
      step(c, D, [set(F.a5, count)]);
      return c.field!.econ.filter((s) => s.type === 'extractor' && s.target === null).map((s) => s.id);
    };
    expect(unboundBy(2)).toEqual([f1.id]);
    expect(unboundBy(1)).toEqual([f1.id, d2.id]);
    expect(unboundBy(3)).toEqual([]);
  });

  it('within each group, the highest id goes first', () => {
    const inFlight = marked(F.a5);
    const docked = addEcon(inFlight, 'extractor', F.a5, F.a5);
    const g1 = flyingTo(inFlight, F.a5);
    const g2 = flyingTo(inFlight, F.a5);
    const a = clone(inFlight);
    step(a, D, [set(F.a5, 2)]);
    expect(a.field!.econ.filter((s) => s.target === null).map((s) => s.id)).toEqual([g2.id]);
    const b = clone(inFlight);
    step(b, D, [set(F.a5, 1)]);
    expect(b.field!.econ.filter((s) => s.target === null).map((s) => s.id)).toEqual([g1.id, g2.id]);
    expect(b.field!.econ.find((s) => s.id === docked.id)!.target).toBe(F.a5);
    const dk = marked(F.a5);
    const [e1, e2, e3] = dock(dk, F.a5, 3);
    const c = clone(dk);
    step(c, D, [set(F.a5, 2)]);
    expect(c.field!.econ.filter((s) => s.target === null).map((s) => s.id)).toEqual([e3!.id]);
    step(dk, D, [set(F.a5, 1)]);
    expect(dk.field!.econ.filter((s) => s.target === null).map((s) => s.id)).toEqual([e2!.id, e3!.id]);
    expect(dk.field!.econ.find((s) => s.id === e1!.id)!.target).toBe(F.a5);
  });

  it('the surplus re-dispatches to a marked rock with room, or flies home and parks idle; the buffer stays on the rock', () => {
    const w = marked(F.a5, F.a6);
    // No extraction, so the buffer can only change by what leaves with an extractor (nothing).
    w.tun['extractor.orePerMin'] = 0;
    const [, e2, e3] = dock(w, F.a5, 3);
    dock(w, F.a6, 1);
    w.nodes[F.a5]!.buffer = 7;
    tick(w, set(F.a5, 1));
    // The count drops on that tick, and both left: e2 (lower id, dispatched first) takes a6's free slot, e3 finds none.
    expect([w.nodes[F.a5]!.extractors, boundCounts(w)[F.a5], boundCounts(w)[F.a6]]).toEqual([1, 1, 2]);
    const s2 = w.field!.econ.find((s) => s.id === e2!.id)!;
    const s3 = w.field!.econ.find((s) => s.id === e3!.id)!;
    expect([s2.target, s2.transit?.to]).toEqual([F.a6, F.a6]);
    expect([s3.target, s3.transit?.to]).toEqual([null, PROBE]);
    for (let t = 0; t < 400; t++) {
      tick(w);
      expect(w.nodes[F.a5]!.buffer).toBe(7);
    }
    expect([s2.at, s3.at, s3.target, s3.cargo]).toEqual([F.a6, PROBE, null, 0]);
    expect(idleAtProbe(w)).toEqual([e3!.id]);
    expect(rockStatus(w, F.a6).docked).toBe(2);
  });
});

describe('X3 raising, or All', () => {
  it('reopens F5 on the same tick: an idle extractor is dispatched to the raised rock', () => {
    for (const raise of [2, null]) {
      const w = marked(F.a5);
      dock(w, F.a5, 1);
      tick(w, set(F.a5, 1));
      const idle = addEcon(w, 'extractor', PROBE);
      run(w, 5);
      expect(idleAtProbe(w)).toEqual([idle.id]);
      tick(w, set(F.a5, raise));
      expect([idle.target, idle.transit?.to], String(raise)).toEqual([F.a5, F.a5]);
    }
  });

  it('reopens H4b on the same tick: the bay starts the tick All is set', () => {
    for (const raise of [3, null]) {
      const w = marked(F.a5);
      dock(w, F.a5, 1);
      w.stock.ore = 200;
      w.field!.alloc.extractor = 3;
      tick(w, set(F.a5, 1));
      run(w, 60);
      expect(allocStatus(w, D).rows.find((r) => r.type === 'extractor')!.state).toBe('enough');
      tick(w, set(F.a5, raise));
      expect(w.field!.bays.extractor.ticksLeft, String(raise)).toBe(w.tun['ship.extractor.buildTicks']);
    }
  });
});

describe('X1/X2: null and the slots behave the same for every rule', () => {
  it('the shipped opening with every marked rock set to its slots matches it with All, at every 60th tick for 3 game minutes', () => {
    const a = createWorld(1, D);
    const b = createWorld(1, D);
    const marks = a.nodes.filter((n) => a.field!.mine[n.index]).map((n) => n.index);
    expect(marks.length).toBeGreaterThan(0);
    const strip = (w: World): string => {
      const c = clone(w);
      c.field!.extractorSet = [];
      return hashState(c);
    };
    step(a, D, marks.map((n) => set(n, a.nodes[n]!.slots)));
    step(b, D, []);
    expect(marks.map((n) => a.field!.extractorSet[n])).toEqual(marks.map((n) => a.nodes[n]!.slots));
    for (let t = 1; t < 3 * 1800; t++) {
      step(a, D, []);
      step(b, D, []);
      if (t % 60 === 0) {
        expect(strip(a), `tick ${t}`).toBe(strip(b));
        for (const n of marks) expect(extCap(a, n)).toBe(extCap(b, n));
      }
    }
    // The run did something: extractors docked and ore delivered.
    expect(b.stats.econBuilt.extractor).toBeGreaterThan(0);
    expect(b.stats.delivered.ore).toBeGreaterThan(0);
    expect(rockStatus(a, marks[0]!).extractorSet).toBe(a.nodes[marks[0]!]!.slots);
    expect(rockStatus(b, marks[0]!).extractorSet).toBeNull();
  });
});

describe('X4: haulers follow (no new rule)', () => {
  /**
   * a5 (530 su, round trip 2 × ceil(530 ÷ 2) = 530 ticks, cargo 4, needPct 110, 10 ore/min per extractor):
   * 3 extractors: max(1, ceilDiv(30 × 530 × 110, 100 × 1800 × 4)) = ceilDiv(1,749,000, 720,000) = 3;
   * 1 extractor: ceilDiv(583,000, 720,000) = 1.
   */
  function staffedA5(): World {
    const w = marked(F.a5);
    dock(w, F.a5, 3);
    for (let i = 0; i < 3; i++) addEcon(w, 'hauler', F.a5, F.a5);
    w.nodes[F.a5]!.buffer = 12;
    w.stock.ore = 200;
    w.field!.alloc.hauler = 3;
    return w;
  }

  it('after a lowering the need and target drop, each hauler over target leaves at its next delivery, and H4 builds none', () => {
    const w = staffedA5();
    expect([rockStatus(w, F.a5).haulerNeed, rockStatus(w, F.a5).haulerTarget]).toEqual([3, 3]);
    tick(w, set(F.a5, 1));
    expect([rockStatus(w, F.a5).haulerNeed, rockStatus(w, F.a5).haulerTarget]).toEqual([1, 1]);
    const haulers = w.field!.econ.filter((s) => s.type === 'hauler');
    const leaves: Array<{ id: number; tick: number; arrivedAt: number }> = [];
    const arrived = new Map<number, number>();
    for (let t = 0; t < 1200; t++) {
      const before = haulers.map((s) => ({ id: s.id, target: s.target, atProbe: s.at === PROBE && s.transit === null }));
      tick(w);
      for (const s of haulers) {
        const b = before.find((x) => x.id === s.id)!;
        if (s.at === PROBE && s.transit === null && !b.atProbe) arrived.set(s.id, w.tick - 1);
        if (b.target === F.a5 && s.target !== F.a5) {
          // It left a5 on its first pass at the probe after unloading: the tick after it arrived.
          expect(b.atProbe).toBe(true);
          leaves.push({ id: s.id, tick: w.tick - 1, arrivedAt: arrived.get(s.id)! });
        }
      }
      expect(w.stats.econBuilt.hauler, `tick ${w.tick}`).toBe(0);
      expect(w.field!.bays.hauler.ticksLeft).toBe(0);
    }
    expect(leaves).toHaveLength(2);
    for (const l of leaves) expect(l.tick).toBe(l.arrivedAt + 1);
    const r = rockStatus(w, F.a5);
    expect([r.haulers, r.haulerTarget]).toEqual([1, 1]);
    expect(haulers.filter((s) => s.target === null && s.at === PROBE && s.transit === null)).toHaveLength(2);
    expect(allocStatus(w, D).rows.find((x) => x.type === 'hauler')!.state).toBe('enough');
  });

  it('a kept haulerSet wins over the dial: the target stays at the set count and no hauler leaves', () => {
    const w = staffedA5();
    tick(w, { type: 'setHaulers', node: F.a5, count: 3 });
    tick(w, set(F.a5, 1));
    expect([rockStatus(w, F.a5).haulerNeed, rockStatus(w, F.a5).haulerTarget]).toEqual([1, 3]);
    for (let t = 0; t < 1200; t++) {
      tick(w);
      expect(rockStatus(w, F.a5).haulers).toBe(3);
    }
    expect(w.stats.delivered.ore).toBeGreaterThan(0);
  });
});
