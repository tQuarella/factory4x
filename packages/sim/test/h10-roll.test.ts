import { describe, expect, it } from 'vitest';
import {
  PROBE,
  fieldSummary,
  haulersHeld,
  nodeDistance,
  prongOutcome,
  raidFightsAt,
  raidProngs,
  raidStatus,
  recycleOrder,
  rockStatus,
  type Prong,
  type World,
} from '../src/index.ts';
import { raidStep } from '../src/factions/index.ts';
import { syncExtractors } from '../src/field.ts';
import { fixtureV16 } from './fixture.ts';
import { F, addEcon, quietField } from './field-helpers.ts';
import { addShips } from './helpers.ts';

/**
 * h10-sim acceptance 3: L1-L5, the roll-on (DESIGN.md H10 "The roll-on fallback"), with `raid.rollMax` 1 unless a test says
 * otherwise, on the frozen v16 fixture (raid.speedSu 3). As raids-h9.test.ts does, the raid hook is called directly (`rs`), so
 * nothing but the raid moves. Hive order: a5 (430 su), a6 and a7 (534; a6 first, the lower index), the pockets (guarded, so
 * never raidable), a3 and a4 (735), a1 and a2 (814).
 */
const D = fixtureV16;

function rs(w: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    raidStep(w, D);
    w.tick += 1;
  }
}

function rsUntil(w: World, pred: (w: World) => boolean, max = 6000): number {
  let i = 0;
  while (!pred(w)) {
    if (i >= max) throw new Error(`condition not met within ${max} calls (tick ${w.tick})`);
    rs(w);
    i++;
  }
  return i;
}

/** One docked extractor at `node` (Mine-marked), plus `haulers` haulers assigned to it waiting at the probe. */
function rock(w: World, node: number, haulers = 0): void {
  w.field!.mine[node] = true;
  addEcon(w, 'extractor', node, node);
  for (let i = 0; i < haulers; i++) addEcon(w, 'hauler', PROBE, node);
  syncExtractors(w);
}

/**
 * A quiet v16 field with these rocks, a raid of `size` raiders from `econ` padding haulers (assigned to the first rock), and
 * `rollMax`. The padding haulers wait at the probe, so the first rock stays raidable after its extractor dies.
 */
function field(rocks: number[], rollMax = 1, prongsMax = 1, size = 3): World {
  const w = quietField(D);
  w.tun['raid.rollMax'] = rollMax;
  w.tun['raid.prongsMax'] = prongsMax;
  w.tun['raid.prongMinSize'] = 2;
  w.tun['raid.firstAtEcon'] = 2;
  w.tun['raid.econPerRaider'] = 1;
  w.tun['raid.maxSize'] = size;
  rocks.forEach((n, i) => rock(w, n, i === 0 ? 3 : 0));
  return w;
}

const p0 = (w: World): Prong => raidProngs(w.raid!)[0]!;
const ids = (p: Prong) => p.guards.map((g) => g.id);

/** Runs to prong 0's first roll and returns the state just before it and on it. */
function toRoll(w: World): { before: { target: number; ids: number[]; held: Record<number, boolean> }; at: number } {
  rs(w); // muster
  let before = { target: -1, ids: [] as number[], held: {} as Record<number, boolean> };
  rsUntil(w, (x) => {
    if (x.raid === null) throw new Error('the raid ended without a roll');
    const p = p0(x);
    if (p.rolls === 0) {
      before = { target: p.target, ids: ids(p), held: Object.fromEntries(x.nodes.map((n) => [n.index, haulersHeld(x, n.index)])) };
      return false;
    }
    return true;
  });
  return { before, at: w.tick - 1 };
}

describe('L1-L2: when a prong rolls, and where to', () => {
  it('a prong that hit its target, with no player ship left there, rolls to the first raidable node in hive order instead of going home', () => {
    const w = field([F.a5, F.a6, F.a7]);
    const { before } = toRoll(w);
    const p = p0(w);
    expect(before.target).toBe(F.a5);
    expect([p.phase, p.target, p.from, p.rolls]).toEqual(['out', F.a6, F.a5, 1]);
    // A new flight from the old target: the distance ÷ raid.speedSu, ceiling.
    const flight = Math.ceil(nodeDistance(w, F.a5, F.a6) / w.tun['raid.speedSu']);
    expect([p.flightTicks, p.ticksLeft]).toEqual([flight, flight]);
    // L5: the same raiders go on; nothing is added.
    expect(ids(p)).toEqual(before.ids);
    expect(w.stats.raidRolls).toBe(1);
    expect(p.hitRocks).toEqual([F.a5]);
  });

  it('it skips the rocks it has hit and the targets of other live prongs (rollMax 2, two prongs)', () => {
    // Prong 0 at a5, prong 1 at a6 (held there by a tough Drone that hardly scratches it). a5 stays raidable after its
    // extractor dies (3 haulers assigned to it wait at the probe), but prong 0 has hit it.
    const w = field([F.a5, F.a6, F.a7, F.a3], 2, 2, 6);
    w.tun['ship.drone.hp'] = 1000;
    w.tun['ship.drone.damage'] = 1;
    addShips(w, F.a6, 1);
    toRoll(w);
    const first = p0(w);
    // a6 is prong 1's live target, so the first eligible node is a7.
    expect(raidProngs(w.raid!)[1]!.phase === 'out' || raidProngs(w.raid!)[1]!.phase === 'fight').toBe(true);
    expect([first.target, first.rolls]).toEqual([F.a7, 1]);
    rsUntil(w, (x) => p0(x).rolls === 2);
    const second = p0(w);
    // From a7: a5 is raidable but hit, a6 is prong 1's, a7 is its own: a3.
    expect(rockStatus(w, F.a5).raidRank).toBe(1);
    expect([second.target, second.from, second.rolls, second.hitRocks]).toEqual([F.a3, F.a7, 2, [F.a5, F.a7]]);
    // At rollMax it goes home from a3 once it has hit there.
    rsUntil(w, (x) => p0(x).phase === 'home' || p0(x).phase === 'done');
    expect([p0(w).phase, p0(w).target, p0(w).rolls, p0(w).hitRocks, prongOutcome(p0(w))]).toEqual(['home', F.a3, 2, [F.a5, F.a7, F.a3], 'hit']);
    expect(w.stats.raidRolls).toBe(2);
  });

  it('with raid.rollMax 0 a prong that hit goes home, as in H9 (no roll; hitRocks still names the rock)', () => {
    const w = field([F.a5, F.a6], 0);
    rs(w);
    rsUntil(w, (x) => x.raid === null || p0(x).phase === 'home');
    expect([p0(w).phase, p0(w).target, p0(w).rolls, p0(w).hitRocks, prongOutcome(p0(w))]).toEqual(['home', F.a5, 0, [F.a5], 'hit']);
    expect(w.stats.raidRolls).toBe(0);
  });

  it('it rolls at most raid.rollMax times: at rollMax 1, after hitting the second rock it goes home though a third is raidable', () => {
    const w = field([F.a5, F.a6, F.a7]);
    toRoll(w);
    rsUntil(w, (x) => p0(x).phase === 'home');
    expect([p0(w).target, p0(w).rolls, p0(w).hitRocks]).toEqual([F.a6, 1, [F.a5, F.a6]]);
    expect(rockStatus(w, F.a7).raidRank).toBeGreaterThan(0);
  });

  it('no roll without a kill at this target, or with no eligible node: it goes home', () => {
    // Its target's ships leave before any is killed (recycled by hand): it killed nothing here.
    const left = field([F.a5, F.a6]);
    rs(left);
    rsUntil(left, (x) => p0(x).phase === 'fight');
    left.field!.econ = left.field!.econ.filter((s) => s.at !== F.a5);
    syncExtractors(left);
    rsUntil(left, (x) => p0(x).phase !== 'fight');
    expect([p0(left).phase, p0(left).rolls, p0(left).hitRocks]).toEqual(['home', 0, []]);
    // One mined rock: nowhere to roll.
    const one = quietField(D);
    Object.assign(one.tun, { 'raid.rollMax': 3, 'raid.firstAtEcon': 2, 'raid.econPerRaider': 1, 'raid.maxSize': 3 });
    rock(one, F.a5);
    addEcon(one, 'hauler', F.a5, F.a5);
    rs(one);
    rsUntil(one, (x) => p0(x).phase === 'home');
    expect([p0(one).target, p0(one).rolls, p0(one).hitRocks]).toEqual([F.a5, 0, [F.a5]]);
  });

  it('W5 on arrival after a roll never picks a rock the prong has hit (h10-sim reading): a6 unmarked mid-flight sends it to a7, not back to a5', () => {
    const w = field([F.a5, F.a6, F.a7]);
    toRoll(w);
    w.field!.mine[F.a6] = false;
    rsUntil(w, (x) => p0(x).retargeted);
    expect(rockStatus(w, F.a5).raidRank).toBe(1); // still raidable (its haulers), but hit
    expect([p0(w).target, p0(w).from, p0(w).phase]).toEqual([F.a7, F.a6, 'out']);
  });
});

describe('L2-L3: the hold, the outcome and the counts', () => {
  it('the hold moves on the roll tick: the old target\'s haulers are free, the new target\'s held', () => {
    const w = field([F.a5, F.a6, F.a7]);
    const { before } = toRoll(w);
    expect([before.held[F.a5], before.held[F.a6]]).toEqual([true, false]);
    expect([haulersHeld(w, F.a5), haulersHeld(w, F.a6)]).toEqual([false, true]);
    expect(raidStatus(w).holding).toBe(0); // the a5 haulers waiting at the probe are free to go
  });

  it('the outcome stays open through a roll; it is decided when the prong leaves for home (hit) or is beaten', () => {
    const w = field([F.a5, F.a6, F.a7]);
    toRoll(w);
    const open: Array<string | null> = [];
    rsUntil(w, (x) => {
      open.push(prongOutcome(p0(x)));
      expect(raidStatus(x).prongs[0]!.outcome).toBe(prongOutcome(p0(x)));
      return p0(x).phase === 'home';
    });
    expect(open.slice(0, -1).every((o) => o === null)).toBe(true);
    expect(prongOutcome(p0(w))).toBe('hit');
    expect(raidStatus(w).phase).toBe('home');
  });

  it('a prong that hit, rolled and was then beaten is beaten (W6: all its raiders died); its result keeps the rocks it hit', () => {
    const w = field([F.a5, F.a6]);
    addShips(w, F.a6, 6, 'flak');
    toRoll(w);
    rsUntil(w, (x) => x.raid === null);
    const last = raidStatus(w).last!;
    expect(last.outcome).toBe('beaten');
    expect(last.prongs).toHaveLength(1);
    const pr = last.prongs[0]!;
    expect([pr.target, pr.outcome, pr.hitRocks]).toEqual([F.a6, 'beaten', [F.a5]]);
    expect(pr.hiveLost).toBe(pr.killed.thorn + pr.killed.spore);
    expect(pr.hiveLost).toBe(3);
    expect(w.stats.raidProngs).toEqual({ beaten: 1, hit: 0, turnedBack: 0 });
    expect(w.stats.raidRolls).toBe(1);
    expect(fieldSummary(w).raidRolls).toBe(1);
  });

  it('a prong that hit, rolled and hit again is hit, with both rocks in hitRocks and no raider lost', () => {
    const w = field([F.a5, F.a6]);
    toRoll(w);
    rsUntil(w, (x) => x.raid === null);
    const pr = raidStatus(w).last!.prongs[0]!;
    expect([pr.outcome, pr.hitRocks, pr.hiveLost, pr.lostEcon]).toEqual(['hit', [F.a5, F.a6], 0, { extractor: 2, hauler: 0 }]);
  });

  it('raidStatus.prongs[i].rolls and rolledFrom: 0 and null before a roll, then the count and the rock it left', () => {
    const w = field([F.a5, F.a6, F.a7], 2, 1, 3);
    rs(w);
    expect(raidStatus(w).prongs[0]).toMatchObject({ rolls: 0, rolledFrom: null });
    toRoll(w);
    expect(raidStatus(w).prongs[0]).toMatchObject({ target: F.a6, rolls: 1, rolledFrom: F.a5 });
    rsUntil(w, (x) => p0(x).rolls === 2);
    expect(raidStatus(w).prongs[0]).toMatchObject({ target: F.a7, rolls: 2, rolledFrom: F.a6 });
    rsUntil(w, (x) => p0(x).phase === 'home');
    expect(raidStatus(w).prongs[0]).toMatchObject({ phase: 'home', rolls: 2, rolledFrom: F.a6 });
  });
});

describe('L4: the siblings read a rolling prong\'s current target', () => {
  it('the shield, recycleFleet\'s exclusion, raidTarget and raidMix follow the roll', () => {
    const w = field([F.a5, F.a6]);
    w.tun['ship.drone.hp'] = 1000;
    w.tun['ship.drone.damage'] = 1;
    addShips(w, F.a6, 1); // a warship at the new target
    toRoll(w);
    // A Drone parked at the old target: no longer a fight there.
    addShips(w, F.a5, 1);
    expect([rockStatus(w, F.a5).raidTarget, rockStatus(w, F.a5).raidMix]).toEqual([false, null]);
    expect(rockStatus(w, F.a6).raidTarget).toBe(true);
    expect(rockStatus(w, F.a6).raidMix).toEqual(raidStatus(w).prongs[0]!.raiders);
    rsUntil(w, (x) => p0(x).phase === 'fight');
    expect([raidFightsAt(w, F.a6), raidFightsAt(w, F.a5)]).toEqual([true, false]);
    const order = recycleOrder(w, 'drone').map((s) => s.at);
    expect(order).toContain(F.a5);
    expect(order).not.toContain(F.a6);
    // The shield: with the Drone at a6 the raiders strike it only, so a6's extractor stands round after round.
    rs(w, 5 * w.tun['combat.roundTicks']);
    expect(p0(w).lostEcon).toEqual({ extractor: 1, hauler: 0 });
    expect(rockStatus(w, F.a6).docked).toBe(1);
  });
});
