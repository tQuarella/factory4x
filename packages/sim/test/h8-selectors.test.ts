import { describe, expect, it } from 'vitest';
import {
  BUILD_TYPES,
  PROBE,
  allocStatus,
  fleetStatus,
  movePreview,
  rockStatus,
  step,
  type BuildType,
  type Input,
  type World,
} from '../src/index.ts';
import { fixtureV14 } from './fixture.ts';
import { addShips, setGuards } from './helpers.ts';
import { F, addEcon, quietField } from './field-helpers.ts';

/** h8-sim acceptance 5: the H8 selectors (DESIGN.md H8 "Selectors (sim, read-only)"), on the frozen v14 fixture. */
const D = fixtureV14;

function tick(w: World, ...inputs: Input[]): void {
  step(w, D, inputs);
}

function quiet(): World {
  const w = quietField(D);
  w.tun['raid.enabled'] = 0;
  return w;
}

const pct = (w: World): Record<BuildType, number> => {
  const out = {} as Record<BuildType, number>;
  for (const r of allocStatus(w, D).rows) out[r.type] = r.incomePct;
  return out;
};

describe('allocStatus (H8)', () => {
  it('incomePct = floor(weight × 100 ÷ Σ weights of the unlocked types above 0), rounding down: 3/2/1 → 50, 33, 16; a locked type (lancer 2) and an off type are 0 and not in the sum', () => {
    const w = quiet();
    Object.assign(w.field!.alloc, { extractor: 3, hauler: 2, drone: 1, lancer: 2, flak: 0 });
    // Lancer is locked (no crystal delivered): the sum is 3 + 2 + 1 = 6.
    expect(pct(w)).toEqual({ extractor: 50, hauler: 33, drone: 16, lancer: 0, flak: 0 });
    // Unlocked, it joins the sum: 3 + 2 + 1 + 2 = 8 → 37, 25, 12, 25 (37.5 and 12.5 round down).
    w.stats.firstDeliveredTick.crystal = 0;
    expect(pct(w)).toEqual({ extractor: 37, hauler: 25, drone: 12, lancer: 25, flak: 0 });
  });

  it('incomePct at the landing weights (3 and 2): 60 and 40; one type alone is 100; equal weights split evenly; every weight 0 is all 0', () => {
    const w = quiet();
    Object.assign(w.field!.alloc, { extractor: 3, hauler: 2, drone: 0, lancer: 0, flak: 0 });
    expect(pct(w)).toEqual({ extractor: 60, hauler: 40, drone: 0, lancer: 0, flak: 0 });
    Object.assign(w.field!.alloc, { extractor: 0, hauler: 0, drone: 5, lancer: 0, flak: 0 });
    expect(pct(w)).toEqual({ extractor: 0, hauler: 0, drone: 100, lancer: 0, flak: 0 });
    Object.assign(w.field!.alloc, { extractor: 1, hauler: 1, drone: 0, lancer: 0, flak: 0 });
    expect(pct(w)).toEqual({ extractor: 50, hauler: 50, drone: 0, lancer: 0, flak: 0 });
    Object.assign(w.field!.alloc, { extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 });
    expect(pct(w)).toEqual({ extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 });
  });

  it('the Hauler is enough with a weight and no rock short; building, off and the other states keep their precedence', () => {
    const w = quiet();
    w.field!.alloc.hauler = 2;
    const state = (): string => allocStatus(w, D).rows.find((r) => r.type === 'hauler')!.state;
    // Nothing marked: no rock is short.
    expect(state()).toBe('enough');
    // An enough hauler still asks for its share of income (the weight is a priority).
    expect(pct(w).hauler).toBe(100);
    w.field!.alloc.hauler = 0;
    expect(state()).toBe('off');
    w.field!.alloc.hauler = 2;
    w.field!.bays.hauler.ticksLeft = 10;
    expect(state()).toBe('building');
    w.field!.bays.hauler.ticksLeft = 0;
    w.field!.mine[F.a1] = true;
    addEcon(w, 'extractor', F.a1, F.a1);
    tick(w);
    expect(state()).toBe('filling');
    // hauler.autoNeed 0: never enough.
    w.field!.mine[F.a1] = false;
    tick(w);
    expect(state()).toBe('enough');
    w.tun['hauler.autoNeed'] = 0;
    expect(state()).toBe('filling');
  });
});

describe('rockStatus (H8)', () => {
  it('haulerNeed, haulerSet and haulerTarget: Auto, a set count, and an unmarked rock (0 need and target, the count kept); raidTarget and haulersHeld are false until h8-raids', () => {
    const w = quiet();
    w.field!.mine[F.a5] = true;
    for (let i = 0; i < 3; i++) addEcon(w, 'extractor', F.a5, F.a5);
    tick(w);
    expect(rockStatus(w, F.a5)).toMatchObject({ haulerNeed: 3, haulerSet: null, haulerTarget: 3, raidTarget: false, haulersHeld: false });
    tick(w, { type: 'setHaulers', node: F.a5, count: 5 });
    expect(rockStatus(w, F.a5)).toMatchObject({ haulerNeed: 3, haulerSet: 5, haulerTarget: 5 });
    tick(w, { type: 'setMine', node: F.a5, on: false });
    expect(rockStatus(w, F.a5)).toMatchObject({ haulerNeed: 0, haulerSet: 5, haulerTarget: 0 });
  });
});

describe('fleetStatus.types (H8)', () => {
  it('per type: alive anywhere, idle at the probe (economy ships with no node, warships parked there), the bay building (0 or 1), and recyclable now', () => {
    const w = quiet();
    w.field!.mine[F.a1] = true;
    addEcon(w, 'extractor', PROBE);
    addEcon(w, 'extractor', F.a1, F.a1);
    addEcon(w, 'hauler', PROBE);
    // A hauler at the probe with a node (it just arrived) is not idle.
    addEcon(w, 'hauler', PROBE, F.a1);
    addShips(w, PROBE, 2, 'drone');
    addShips(w, F.a2, 1, 'drone');
    // Two flak at a living guarded node: alive, not recyclable.
    setGuards(w, F.p1, [['spore', 30]]);
    addShips(w, F.p1, 2, 'flak');
    w.field!.bays.hauler.ticksLeft = 5;
    w.yards.lancer.ticksLeft = 5;
    const ty = fleetStatus(w, D).types;
    expect(ty).toEqual({
      extractor: { alive: 2, idle: 1, building: 0, recyclable: 2 },
      hauler: { alive: 2, idle: 1, building: 1, recyclable: 2 },
      drone: { alive: 3, idle: 2, building: 0, recyclable: 3 },
      lancer: { alive: 0, idle: 0, building: 1, recyclable: 0 },
      flak: { alive: 2, idle: 0, building: 0, recyclable: 0 },
    });
    expect(BUILD_TYPES.every((t) => ty[t].recyclable <= ty[t].alive)).toBe(true);
  });
});

describe('movePreview (H8)', () => {
  it('the counts a moveShips would carry now: all, split (per type) and the 1-ship fallback; zeros for an empty node or a bad index', () => {
    const w = quiet();
    addShips(w, F.a5, 5, 'drone');
    addShips(w, F.a5, 2, 'flak');
    addShips(w, F.a2, 1, 'lancer');
    addEcon(w, 'hauler', F.a3, F.a3);
    expect(movePreview(w, F.a5, 'all')).toEqual({ drone: 5, lancer: 0, flak: 2 });
    expect(movePreview(w, F.a5, 'split')).toEqual({ drone: 2, lancer: 0, flak: 1 });
    expect(movePreview(w, F.a2, 'split')).toEqual({ drone: 0, lancer: 1, flak: 0 });
    expect(movePreview(w, F.a3, 'all')).toEqual({ drone: 0, lancer: 0, flak: 0 });
    expect(movePreview(w, 99, 'all')).toEqual({ drone: 0, lancer: 0, flak: 0 });
    // It is what the move carries.
    tick(w, { type: 'moveShips', from: F.a5, to: F.a1, part: 'split' });
    expect(w.ships.filter((s) => s.transit !== null).length).toBe(3);
  });
});
