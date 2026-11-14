import { describe, expect, it } from 'vitest';
import {
  PROBE,
  allocStatus,
  createWorld,
  guardianAt,
  haulerNeed,
  haulerShortfall,
  haulerTarget,
  nodeDistance,
  rockStatus,
  step,
  type EconShip,
  type Input,
  type World,
} from '../src/index.ts';
import { staffCounts } from '../src/field.ts';
import { fixtureV14 } from './fixture.ts';
import { addShips, setGuards } from './helpers.ts';
import { F, addEcon, quietField } from './field-helpers.ts';

/**
 * h8-sim acceptance 3: H1–H5 (DESIGN.md H8 "Rules (field mode): changes to H7") on the shipped `map.field`, run on
 * the frozen v14 fixture (the shipped data as h8-sim leaves it: v13 values plus the H8 keys at their spec
 * defaults), so h8-design-data's calibration changes none of them. Each test builds its premise from a quiet field
 * (no stock, no probe mining, every weight 0, no Mine marks).
 */
const D = fixtureV14;

function tick(w: World, ...inputs: Input[]): void {
  step(w, D, inputs);
}

function run(w: World, n: number): void {
  for (let i = 0; i < n; i++) step(w, D, []);
}

/** A quiet v14 field with these rocks Mine-marked and no raids. */
function marked(...nodes: number[]): World {
  const w = quietField(D);
  w.tun['raid.enabled'] = 0;
  for (const n of nodes) w.field!.mine[n] = true;
  return w;
}

/** `n` extractors docked at `node`. */
function dock(w: World, node: number, n: number): void {
  for (let i = 0; i < n; i++) addEcon(w, 'extractor', node, node);
}

/** Captures the pocket or hive at `node` (no guards, one drone there), as F11 does, then removes the drone. */
function capture(w: World, node: number): void {
  setGuards(w, node, []);
  addShips(w, node, 1);
  tick(w);
  expect(guardianAt(w, node)!.alive).toBe(false);
  w.ships = [];
}

/** Haulers assigned per node. */
function assigned(w: World): number[] {
  const out = w.nodes.map(() => 0);
  for (const s of w.field!.econ) if (s.type === 'hauler' && s.target !== null) out[s.target] = out[s.target]! + 1;
  return out;
}

const T = 1800;

describe('H1 the need', () => {
  it('the need table at v13 values and hauler.needPct 110, pinned: a1–a4 1, a5 3, a6 and a7 2 (full slots), p1 and p2 1 once taken', () => {
    const w = marked(F.a1, F.a2, F.a3, F.a4, F.a5, F.a6, F.a7);
    for (const n of [F.a1, F.a2, F.a6, F.a7]) dock(w, n, 2);
    for (const n of [F.a3, F.a4]) dock(w, n, 1);
    dock(w, F.a5, 3);
    capture(w, F.p1);
    capture(w, F.p2);
    // Round trips at ship.hauler.speedSu 2: a1/a2 2 × 131 = 262, a3/a4 2 × 252 = 504, a5 2 × 265 = 530,
    // a6/a7 2 × 316 = 632, p1/p2 2 × 179 = 358 ticks. Denominator 100 × 1800 × 4 = 720000.
    const needs = [F.a1, F.a2, F.a3, F.a4, F.a5, F.a6, F.a7, F.p1, F.p2].map((n) => haulerNeed(w, n));
    // a1 20 × 262 × 110 = 576400 → 1; a3 10 × 504 × 110 = 554400 → 1; a5 30 × 530 × 110 = 1749000 → 3;
    // a6 20 × 632 × 110 = 1390400 → 2; p1 (its free extractor) 12 × 358 × 110 = 472560 → 1.
    expect(needs).toEqual([1, 1, 1, 1, 3, 2, 2, 1, 1]);
    // Not in the spec's table, pinned so a change shows: p1 with its second slot docked (24/min) needs 2
    // (945120 → 2), and the hive with its free extractor (25/min, round trip 2 × 480 = 960) needs 4 (2640000 → 4).
    dock(w, F.p1, 1);
    capture(w, F.heart);
    tick(w);
    expect([haulerNeed(w, F.p1), haulerNeed(w, F.heart)]).toEqual([2, 4]);
  });

  it('the formula off its defaults: an exact division (7) and one just above it (8); needPct 200 doubles staffing; needPct 100 at a1 is still 1', () => {
    const w = marked(F.a3, F.a5);
    dock(w, F.a3, 1);
    dock(w, F.a5, 3);
    tick(w);
    // a3: extractor.orePerMin 20, cargo 1, needPct 125: 20 × 504 × 125 = 1260000 = 7 × 180000 exactly.
    w.tun['extractor.orePerMin'] = 20;
    w.tun['ship.hauler.cargo'] = 1;
    w.tun['hauler.needPct'] = 125;
    expect(haulerNeed(w, F.a3)).toBe(7);
    // needPct 126: 1270080 → 7.056, so 8.
    w.tun['hauler.needPct'] = 126;
    expect(haulerNeed(w, F.a3)).toBe(8);
    // Back to v13 values with needPct 200: a5 30 × 530 × 200 = 3180000 / 720000 = 4.42 → 5 (3 at 110).
    w.tun['extractor.orePerMin'] = 10;
    w.tun['ship.hauler.cargo'] = 4;
    w.tun['hauler.needPct'] = 200;
    expect(haulerNeed(w, F.a5)).toBe(5);
    // A faster hauler shortens the trip: speed 10, round trip 2 × 53 = 106: 30 × 106 × 200 = 636000 → 1.
    w.tun['ship.hauler.speedSu'] = 10;
    expect(haulerNeed(w, F.a5)).toBe(1);
  });

  it('max(1, …): a marked rock worked by its buffer only (no working extractor) needs 1; a rock that is not haulable needs 0', () => {
    const w = marked(F.a1);
    w.nodes[F.a1]!.buffer = 3;
    expect([haulerNeed(w, F.a1), haulerTarget(w, F.a1)]).toEqual([1, 1]);
    // Unmarked: not haulable, so 0 (its buffer stays on the rock).
    w.field!.mine[F.a1] = false;
    expect([haulerNeed(w, F.a1), haulerTarget(w, F.a1)]).toEqual([0, 0]);
    // Marked with an empty buffer and no extractor: not worked, 0.
    w.field!.mine[F.a1] = true;
    w.nodes[F.a1]!.buffer = 0;
    expect([haulerNeed(w, F.a1), haulerTarget(w, F.a1)]).toEqual([0, 0]);
  });

  it('a set count overrides the need (higher, lower and 0), Auto (null) restores it, and the count is kept while the rock is unmarked', () => {
    const w = marked(F.a5);
    dock(w, F.a5, 3);
    tick(w);
    expect(haulerTarget(w, F.a5)).toBe(3);
    tick(w, { type: 'setHaulers', node: F.a5, count: 5 });
    expect([haulerNeed(w, F.a5), haulerTarget(w, F.a5)]).toEqual([3, 5]);
    tick(w, { type: 'setHaulers', node: F.a5, count: 1 });
    expect(haulerTarget(w, F.a5)).toBe(1);
    tick(w, { type: 'setHaulers', node: F.a5, count: 0 });
    expect(haulerTarget(w, F.a5)).toBe(0);
    tick(w, { type: 'setHaulers', node: F.a5, count: 4 });
    tick(w, { type: 'setMine', node: F.a5, on: false });
    // Unmarked: target 0, the setting kept.
    expect([haulerTarget(w, F.a5), w.field!.haulerSet[F.a5], rockStatus(w, F.a5).haulerSet]).toEqual([0, 4, 4]);
    // Re-marked (its buffer still holds ore, so it is worked again at once): the count applies again.
    w.nodes[F.a5]!.buffer = 2;
    tick(w, { type: 'setMine', node: F.a5, on: true });
    expect(haulerTarget(w, F.a5)).toBe(4);
    tick(w, { type: 'setHaulers', node: F.a5, count: null });
    expect([w.field!.haulerSet[F.a5], haulerTarget(w, F.a5)]).toEqual([null, haulerNeed(w, F.a5)]);
  });

  it('rock.haulerMax tuned below a set count caps the target at the new max; the stored count is kept and applies when the max rises again', () => {
    const w = marked(F.a5);
    dock(w, F.a5, 3);
    tick(w, { type: 'setHaulers', node: F.a5, count: 6 });
    expect(haulerTarget(w, F.a5)).toBe(6);
    tick(w, { type: 'setTunable', key: 'rock.haulerMax', value: 4 });
    expect([haulerTarget(w, F.a5), rockStatus(w, F.a5).haulerSet, w.field!.haulerSet[F.a5]]).toEqual([4, 4, 6]);
    tick(w, { type: 'setTunable', key: 'rock.haulerMax', value: 6 });
    expect(haulerTarget(w, F.a5)).toBe(6);
  });
});

describe('H1 amendment: staffed rocks', () => {
  /** a1 marked with one extractor on its way (bound, 100 ticks out) and nothing docked or buffered. */
  function inbound(): { w: World; e: EconShip } {
    const w = marked(F.a1);
    const e = addEcon(w, 'extractor', F.a1, F.a1);
    e.at = null;
    e.transit = { from: PROBE, to: F.a1, ticksLeft: 100, totalTicks: 100 };
    return { w, e };
  }

  it('a marked rock with an extractor on its way is staffed: its need counts the inbound extractor, and a hauler at the probe is sent there', () => {
    const { w } = inbound();
    expect(w.nodes[F.a1]!.extractors).toBe(0);
    expect([haulerNeed(w, F.a1), haulerTarget(w, F.a1)]).toEqual([1, 1]);
    const h = addEcon(w, 'hauler', PROBE);
    tick(w);
    expect([h.target, h.transit?.to]).toEqual([F.a1, F.a1]);
  });

  it('a hauler at a staffed rock that is not worked yet waits there; it leaves (empty) once no extractor is bound any more, or on Stop', () => {
    for (const end of ['lost', 'stop'] as const) {
      const { w, e } = inbound();
      const h = addEcon(w, 'hauler', F.a1, F.a1);
      tick(w);
      tick(w);
      expect([h.at, h.transit], end).toEqual([F.a1, null]);
      if (end === 'lost') w.field!.econ = w.field!.econ.filter((s) => s !== e);
      tick(w, ...(end === 'stop' ? [{ type: 'setMine' as const, node: F.a1, on: false }] : []));
      expect([h.cargo, h.transit?.to], end).toEqual([0, PROBE]);
    }
  });

  it('hauler.autoNeed 0 (H7): the same hauler leaves at once, because the rock is not worked', () => {
    const { w } = inbound();
    w.tun['hauler.autoNeed'] = 0;
    const h = addEcon(w, 'hauler', F.a1, F.a1);
    tick(w);
    expect(h.transit?.to).toBe(PROBE);
  });

  it('committed extractors staff the nearest mineable rocks with a free slot: a full share and one in the bay staff a1 twice; with a1 full they go to a2; an unweighted share does not count', () => {
    const w = marked(F.a1, F.a2);
    w.field!.alloc.extractor = 3;
    w.field!.share.extractor = w.tun['ship.extractor.cost'];
    w.field!.bays.extractor.ticksLeft = 50;
    expect([staffCounts(w)[F.a1], staffCounts(w)[F.a2]]).toEqual([2, 0]);
    expect([haulerTarget(w, F.a1), haulerTarget(w, F.a2)]).toEqual([1, 0]);
    addEcon(w, 'extractor', F.a1, F.a1);
    addEcon(w, 'extractor', F.a1, F.a1);
    expect([staffCounts(w)[F.a1], staffCounts(w)[F.a2]]).toEqual([2, 2]);
    expect(haulerTarget(w, F.a2)).toBe(1);
    w.field!.alloc.extractor = 0;
    expect(staffCounts(w)[F.a2]).toBe(1);
    w.field!.bays.extractor.ticksLeft = 0;
    expect([staffCounts(w)[F.a2], haulerTarget(w, F.a2)]).toEqual([0, 0]);
  });
});

describe('H2 assignment by shortfall', () => {
  it('the largest shortfall wins, whatever the distance: a5 (target 3, 1 assigned) before a1 (target 1, none)', () => {
    const w = marked(F.a1, F.a5);
    dock(w, F.a1, 2);
    dock(w, F.a5, 3);
    addEcon(w, 'hauler', F.a5, F.a5);
    tick(w);
    const h = addEcon(w, 'hauler', PROBE);
    tick(w);
    expect(h.target).toBe(F.a5);
  });

  it('equal shortfalls go to the node nearest the probe, even with the higher index (the captured p1, 358 su, before a3, 503 su)', () => {
    const w = marked(F.a3);
    dock(w, F.a3, 1);
    capture(w, F.p1);
    expect([haulerTarget(w, F.p1), haulerTarget(w, F.a3)]).toEqual([1, 1]);
    expect(nodeDistance(w, PROBE, F.p1)).toBeLessThan(nodeDistance(w, PROBE, F.a3));
    const h = addEcon(w, 'hauler', PROBE);
    tick(w);
    expect(h.target).toBe(F.p1);
  });

  it('equal shortfalls at equal distance go to the lower index (a1 before a2, both 262 su)', () => {
    const w = marked(F.a1, F.a2);
    dock(w, F.a1, 2);
    dock(w, F.a2, 2);
    tick(w);
    const h = addEcon(w, 'hauler', PROBE);
    tick(w);
    expect(h.target).toBe(F.a1);
  });

  it('haulers pick in id order and each pick updates the count: a5 short 2 and a1 short 1 take three haulers as a5, a1 (a tie at 1, nearer), a5', () => {
    const w = marked(F.a1, F.a5);
    dock(w, F.a1, 2);
    dock(w, F.a5, 3);
    addEcon(w, 'hauler', F.a5, F.a5);
    tick(w);
    const hs = [addEcon(w, 'hauler', PROBE), addEcon(w, 'hauler', PROBE), addEcon(w, 'hauler', PROBE)];
    tick(w);
    expect(hs.map((h) => h.target)).toEqual([F.a5, F.a1, F.a5]);
  });

  it('with no shortfall anywhere a hauler parks idle at the probe, and it takes the first shortfall that opens', () => {
    const w = marked(F.a1);
    dock(w, F.a1, 2);
    addEcon(w, 'hauler', F.a1, F.a1);
    tick(w);
    const h = addEcon(w, 'hauler', PROBE);
    run(w, 3);
    expect([h.target, h.at, h.transit]).toEqual([null, PROBE, null]);
    tick(w, { type: 'setMine', node: F.a2, on: true });
    dock(w, F.a2, 1);
    tick(w);
    expect(h.target).toBe(F.a2);
  });

  it('a hauler at the probe whose node stops being haulable reassigns by shortfall (H7 "keep while haulable" still holds)', () => {
    const w = marked(F.a1, F.a2);
    dock(w, F.a2, 2);
    const h = addEcon(w, 'hauler', PROBE, F.a1);
    tick(w);
    // a1 is marked but not worked (no extractor, empty buffer): the hauler drops it and takes a2.
    expect(h.target).toBe(F.a2);
  });
});

describe('H3 rebalance at home', () => {
  /** a1 (2 extractors, target 1) with `n` haulers; the first is placed at the probe as if it had just arrived. */
  function overA1(n: number): { w: World; home: EconShip } {
    const w = marked(F.a1, F.a2);
    dock(w, F.a1, 2);
    dock(w, F.a2, 2);
    const home = addEcon(w, 'hauler', PROBE, F.a1);
    for (let i = 1; i < n; i++) addEcon(w, 'hauler', F.a1, F.a1);
    return { w, home };
  }

  it('arriving over its node\'s target, a hauler leaves the node and picks again by H2 (a2, short 1)', () => {
    const { w, home } = overA1(2);
    tick(w);
    expect(home.target).toBe(F.a2);
    expect(assigned(w)[F.a1]).toBe(1);
  });

  it('with no shortfall left, the rebalanced hauler parks idle at the probe', () => {
    const { w, home } = overA1(2);
    addEcon(w, 'hauler', F.a2, F.a2);
    tick(w);
    expect([home.target, home.at, home.transit]).toEqual([null, PROBE, null]);
  });

  it('at its target the node keeps its hauler: no move', () => {
    const { w, home } = overA1(1);
    tick(w);
    expect(home.target).toBe(F.a1);
    expect(home.transit?.to).toBe(F.a1);
  });

  it('after setHaulers lowers a count, each hauler leaves as it next reaches home, and the ones away keep the node until then', () => {
    const w = marked(F.a5);
    dock(w, F.a5, 3);
    const hs = [addEcon(w, 'hauler', F.a5, F.a5), addEcon(w, 'hauler', F.a5, F.a5), addEcon(w, 'hauler', F.a5, F.a5)];
    tick(w, { type: 'setHaulers', node: F.a5, count: 1 });
    // Nobody is home: all three keep a5 for now.
    expect(assigned(w)[F.a5]).toBe(3);
    // Each loads (the buffer is filled) and comes home; at home the first two over the target leave.
    w.nodes[F.a5]!.buffer = 40;
    let ticks = 0;
    while (hs.some((h) => h.at !== PROBE || h.transit !== null) && ticks < 2000) {
      tick(w);
      ticks++;
      if (hs.every((h) => h.at === PROBE && h.transit === null)) break;
      if (assigned(w)[F.a5] === 1) break;
    }
    run(w, 2);
    expect(assigned(w)[F.a5]).toBe(1);
    expect(hs.filter((h) => h.target === null && h.at === PROBE).length).toBe(2);
  });

  it('hauler.autoNeed 0: no rebalance; an over-staffed node keeps its haulers (H7)', () => {
    const { w, home } = overA1(3);
    w.tun['hauler.autoNeed'] = 0;
    tick(w);
    expect(home.target).toBe(F.a1);
  });
});

describe('H4 no surplus haulers', () => {
  /** a1 marked with 2 extractors; hauler weight 2 and enough stock to build. */
  function weighted(): World {
    const w = marked(F.a1);
    dock(w, F.a1, 2);
    w.field!.alloc.hauler = 2;
    w.stock.ore = 100;
    tick(w);
    return w;
  }

  it('haulerShortfall = Σ max(0, target − assigned) − idle haulers at the probe − a hauler in the bay', () => {
    const w = marked(F.a1, F.a5);
    dock(w, F.a1, 2);
    dock(w, F.a5, 3);
    addEcon(w, 'hauler', F.a1, F.a1);
    addEcon(w, 'hauler', F.a1, F.a1);
    tick(w);
    // a1 target 1 with 2 (over: counts 0, not −1); a5 target 3 with 0: 3.
    expect(haulerShortfall(w)).toBe(3);
    addEcon(w, 'hauler', PROBE);
    expect(haulerShortfall(w)).toBe(2);
    w.field!.bays.hauler.ticksLeft = 10;
    expect(haulerShortfall(w)).toBe(1);
  });

  it('the probe builds exactly the haulers the rocks are short of, then the Hauler is "enough": ineligible (no ore, counter 0) with its share kept', () => {
    const w = weighted();
    run(w, 400);
    expect(w.field!.econ.filter((s) => s.type === 'hauler').length).toBe(1);
    expect(haulerShortfall(w)).toBe(0);
    const share = w.field!.share.hauler;
    w.stock.ore = 100;
    run(w, 200);
    const row = allocStatus(w, D).rows.find((r) => r.type === 'hauler')!;
    expect(row.state).toBe('enough');
    expect([w.field!.share.hauler, w.field!.allocCur.hauler]).toEqual([share, 0]);
    expect(w.field!.bays.hauler.ticksLeft).toBe(0);
    expect(w.field!.econ.filter((s) => s.type === 'hauler').length).toBe(1);
  });

  it('a full Hauler share waits while no rock is short (the bay does not start), and is kept', () => {
    const w = marked(F.a1);
    dock(w, F.a1, 2);
    addEcon(w, 'hauler', F.a1, F.a1);
    w.field!.alloc.hauler = 2;
    w.field!.share.hauler = w.tun['ship.hauler.cost'];
    run(w, 30);
    expect([w.field!.bays.hauler.ticksLeft, w.field!.share.hauler]).toEqual([0, w.tun['ship.hauler.cost']]);
    expect(allocStatus(w, D).rows.find((r) => r.type === 'hauler')!.state).toBe('enough');
  });

  it('building resumes when a rock is marked', () => {
    const w = weighted();
    run(w, 400);
    expect(allocStatus(w, D).rows.find((r) => r.type === 'hauler')!.state).toBe('enough');
    dock(w, F.a2, 1);
    w.stock.ore = 100;
    tick(w, { type: 'setMine', node: F.a2, on: true });
    expect(haulerShortfall(w)).toBeLessThanOrEqual(1);
    expect(allocStatus(w, D).rows.find((r) => r.type === 'hauler')!.state).toBe('building');
    run(w, w.tun['ship.hauler.buildTicks'] + 2);
    expect(assigned(w)[F.a2]).toBe(1);
  });

  it('building resumes when an extractor docks and raises the need (a5: 1 extractor needs 1, 3 need 3)', () => {
    const w = marked(F.a5);
    dock(w, F.a5, 1);
    addEcon(w, 'hauler', F.a5, F.a5);
    w.field!.alloc.hauler = 2;
    w.stock.ore = 100;
    run(w, 5);
    expect(allocStatus(w, D).rows.find((r) => r.type === 'hauler')!.state).toBe('enough');
    // Two more extractors fly in from the probe and dock.
    w.field!.econ.push(...[0, 1].map(() => ({ id: w.nextId++, type: 'extractor' as const, hp: 6, at: PROBE, transit: null, target: null, cargo: 0, cargoRes: null })));
    let ticks = 0;
    while (rockStatus(w, F.a5).docked < 3 && ticks < 300) {
      tick(w);
      ticks++;
    }
    expect(rockStatus(w, F.a5).docked).toBe(3);
    expect(haulerTarget(w, F.a5)).toBe(3);
    run(w, 2 * (w.tun['ship.hauler.buildTicks'] + 20));
    expect(assigned(w)[F.a5]).toBe(3);
  });

  it('hauler.autoNeed 0: the Hauler stays eligible with no rock short (H7: built while weighted)', () => {
    const w = weighted();
    w.tun['hauler.autoNeed'] = 0;
    run(w, 400);
    expect(w.field!.econ.filter((s) => s.type === 'hauler').length).toBeGreaterThan(1);
    expect(allocStatus(w, D).rows.find((r) => r.type === 'hauler')!.state).not.toBe('enough');
  });

  it('the v14 landing played for 6 game minutes (no inputs): every Hauler started fits the staffed targets (no surplus), and with no shortfall the state is enough or building', () => {
    const v = createWorld(1, D);
    let started = 0;
    let enough = 0;
    for (let t = 0; t < 6 * T; t++) {
      const before = v.field!.bays.hauler.ticksLeft;
      tick(v);
      if (before <= 1 && v.field!.bays.hauler.ticksLeft === v.tun['ship.hauler.buildTicks']) {
        started++;
        // The new hauler (in the bay) plus every hauler alive fit within Σ of the staffed targets.
        const haulers = v.field!.econ.filter((s) => s.type === 'hauler').length + 1;
        const targets = v.nodes.reduce((n, x) => n + haulerTarget(v, x.index), 0);
        expect(haulers, `tick ${t}`).toBeLessThanOrEqual(targets);
      }
      const state = allocStatus(v, D).rows.find((r) => r.type === 'hauler')!.state;
      if (haulerShortfall(v) <= 0) {
        expect(['enough', 'building'], `tick ${t}`).toContain(state);
        if (state === 'enough') enough++;
      }
    }
    expect(started).toBeGreaterThan(0);
    expect(enough).toBeGreaterThan(0);
  });

  it('H1 amendment: the opening on the frozen v14 fixture (no inputs, seed 1) matches or beats H7: first hauler at tick 90, first delivery at 1035, and the delivery curve pinned', () => {
    const curve = (auto: number): { firstHauler: number; firstDelivery: number | null; byMinute: number[] } => {
      const w = createWorld(1, D);
      w.tun['hauler.autoNeed'] = auto;
      let firstHauler = -1;
      const byMinute: number[] = [];
      for (let t = 0; t < 10 * T; t++) {
        tick(w);
        if (firstHauler < 0 && w.stats.econBuilt.hauler > 0) firstHauler = t;
        if ((t + 1) % T === 0) byMinute.push(w.stats.delivered.ore);
      }
      return { firstHauler, firstDelivery: w.stats.firstDeliveredTick.ore, byMinute };
    };
    const h8 = curve(1);
    const h7 = curve(0);
    expect(h7).toEqual({ firstHauler: 90, firstDelivery: 1035, byMinute: [8, 20, 40, 60, 88, 124, 153, 189, 241, 297] });
    expect(h8).toEqual({ firstHauler: 90, firstDelivery: 1035, byMinute: [8, 24, 52, 80, 112, 172, 248, 344, 464, 592] });
  });

  it('H1 amendment, the landing: before any extractor launches, the committed extractor (a full share, then the bay) staffs a1, so the Hauler takes ore at tick 0', () => {
    const w = createWorld(1, D);
    tick(w);
    // Tick 0: the extractor share filled (20) and its bay started; the Hauler share filled too and its bay started.
    expect([w.field!.bays.extractor.ticksLeft > 0, w.field!.bays.hauler.ticksLeft > 0]).toEqual([true, true]);
    expect(w.field!.econ).toHaveLength(0);
    expect([rockStatus(w, F.a1).haulerTarget, rockStatus(w, F.a2).haulerTarget]).toEqual([1, 0]);
    // Literal amendment (bound ships only) would leave every target 0 here: no ship exists yet.
    expect(w.field!.econ.some((s) => s.type === 'extractor')).toBe(false);
  });

});
