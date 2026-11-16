import { describe, expect, it } from 'vitest';
import {
  PROBE,
  dealCounts,
  deserializeWorld,
  fieldSummary,
  guardianAt,
  haulersHeld,
  isRaidable,
  nextProngs,
  nodeDistance,
  prongCount,
  raidKeep,
  raidProngs,
  raidStatus,
  recycleOrder,
  rockStatus,
  serializeWorld,
  type Guard,
  type GuardCounts,
  type Prong,
  type Raid,
  type World,
} from '../src/index.ts';
import { hiveRegrow, raidStep, raidWither } from '../src/factions/index.ts';
import { syncExtractors } from '../src/field.ts';
import { F, FD, addEcon, quietField, tick } from './field-helpers.ts';
import { addShips } from './helpers.ts';

/**
 * h9-raids acceptance 1-7: W1-W8 (DESIGN.md H9 "A wider front"). Like raids.test.ts they run on the frozen v12 fixture
 * (whose `raid.prongsMax` is 1, so every H7 and H8 test there is the W8 check) and call the raid hook directly (`rs`);
 * each test sets `raid.prongsMax` it is about. The hive holds 12 Thorns and 24 Spores (keep 18); a5 is 430 su from the
 * hive (144 flight ticks), a6 and a7 534 (178), p1 645 (215), a3 and a4 735. Hive order: a5, a6, a7, p1, a3, a4.
 */

const hive = (w: World) => guardianAt(w, F.heart)!;

/** Runs the raid hook `n` times, advancing the tick as `step` does. */
function rs(w: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    raidStep(w, FD);
    w.tick += 1;
  }
}

/** Calls until `pred` or throws after `max`; returns the calls made. */
function rsUntil(w: World, pred: (w: World) => boolean, max = 5000): number {
  let i = 0;
  while (!pred(w)) {
    if (i >= max) throw new Error(`condition not met within ${max} calls (tick ${w.tick})`);
    rs(w);
    i++;
  }
  return i;
}

/** A tick on a round boundary (the fight happens on round ticks). */
function toRound(w: World): void {
  const r = w.tun['combat.roundTicks'];
  while (w.tick % r !== 0) w.tick += 1;
}

/** A hand-built economy at `node`: one docked extractor and `n - 1` haulers waiting there. The node is Mine-marked. */
function econAtNode(w: World, node: number, n: number): void {
  w.field!.mine[node] = true;
  addEcon(w, 'extractor', node, node);
  for (let i = 1; i < n; i++) addEcon(w, 'hauler', node, node);
  syncExtractors(w);
}

/**
 * A field with `econ` economy ships spread over the `marked` rocks (in the order given), raids of up to 24, and `prongsMax`.
 * With `econ` 36 the raid is 12 (4 Thorns, 8 Spores), 24 gives 8, 21 gives 7.
 */
function front(marked: readonly number[], econ = 36, prongsMax = 2): World {
  const w = quietField();
  w.tun['raid.prongsMax'] = prongsMax;
  w.tun['raid.maxSize'] = 24;
  let left = econ;
  marked.forEach((node, i) => {
    const n = Math.ceil(left / (marked.length - i));
    econAtNode(w, node, n);
    left -= n;
  });
  return w;
}

const counts = (c: GuardCounts): [number, number] => [c.thorn, c.spore];
const prongs = (w: World): Prong[] => raidProngs(w.raid!);

/** Musters (one hook call), then runs to the launch. */
function launched(w: World): Raid {
  rs(w);
  rsUntil(w, (x) => x.raid!.phase === 'out');
  return w.raid!;
}

/** Runs until every prong is in the `fight` phase (or done). */
function toFight(w: World): void {
  rsUntil(w, (x) => prongs(x).every((p) => p.phase === 'fight' || p.phase === 'done'));
}

describe('W1: the prong count and the targets', () => {
  it('prongCount: min(prongsMax, nodes, max(1, floor(size ÷ prongMinSize))) at each limit', () => {
    const w = quietField();
    w.tun['raid.prongsMax'] = 3;
    w.tun['raid.prongMinSize'] = 4;
    // no target: k 0 gives 0 prongs (R3 would not muster); the formula floors at the node count
    expect(prongCount(w, 0, 12)).toBe(0);
    expect(prongCount(w, 1, 12)).toBe(1); // one target, whatever the size
    expect(prongCount(w, 5, 7)).toBe(1); // a size below the split (8)
    expect(prongCount(w, 5, 8)).toBe(2); // the size at the split
    expect(prongCount(w, 5, 11)).toBe(2);
    expect(prongCount(w, 5, 12)).toBe(3); // prongsMax 3 at 12
    expect(prongCount(w, 5, 24)).toBe(3); // never past prongsMax
    expect(prongCount(w, 2, 24)).toBe(2); // never past the targets
    w.tun['raid.prongsMax'] = 1;
    expect(prongCount(w, 5, 24)).toBe(1); // W8
    w.tun['raid.prongsMax'] = 2;
    w.tun['raid.prongMinSize'] = 2;
    expect(prongCount(w, 5, 3)).toBe(1);
    expect(prongCount(w, 5, 4)).toBe(2);
  });

  it('at muster: no target means no raid; one target is 1 prong whatever the size; below the split is 1 prong; at it 2', () => {
    const none = front([]);
    rs(none);
    expect(none.raid).toBeNull();
    const one = front([F.a5]);
    rs(one);
    expect(counts(one.raid!.planned)).toEqual([4, 8]);
    expect(raidProngs(one.raid!)).toHaveLength(1);
    expect(one.raid!.others).toBeUndefined();
    const below = front([F.a5, F.a6], 21); // size 7: floor(7 ÷ 4) is 1
    rs(below);
    expect(raidProngs(below.raid!)).toHaveLength(1);
    expect(below.raid!.target).toBe(F.a5);
    const at = front([F.a5, F.a6], 24); // size 8: 2 prongs of 4
    rs(at);
    expect(prongs(at).map((p) => p.target)).toEqual([F.a5, F.a6]);
    expect(prongs(at).map((p) => counts(p.planned).reduce((a, b) => a + b))).toEqual([4, 4]);
  });

  it('prongsMax 3 at a raid of 12 gives 3 prongs of 4 at a5, a6 and a7; prongsMax 1 gives 1 prong (W8)', () => {
    const w = front([F.a7, F.a6, F.a5], 36, 3);
    rs(w);
    expect(prongs(w).map((p) => p.target)).toEqual([F.a5, F.a6, F.a7]);
    expect(prongs(w).map((p) => counts(p.planned))).toEqual([
      [2, 2],
      [1, 3],
      [1, 3],
    ]);
    const one = front([F.a7, F.a6, F.a5], 36, 1);
    rs(one);
    expect(raidProngs(one.raid!)).toHaveLength(1);
    expect(one.raid!.target).toBe(F.a5);
    expect(counts(one.raid!.planned)).toEqual([4, 8]);
  });

  it('the targets are in hive order, and the a6/a7 tie goes to a6', () => {
    const w = front([F.a7, F.a6, F.a5]);
    rs(w);
    expect(prongs(w).map((p) => p.target)).toEqual([F.a5, F.a6]);
    const tie = front([F.a7, F.a6]);
    rs(tie);
    expect(prongs(tie).map((p) => p.target)).toEqual([F.a6, F.a7]);
    const tie1 = front([F.a7, F.a6], 36, 1);
    rs(tie1);
    expect(tie1.raid!.target).toBe(F.a6);
    // a3, a4 are farther than the captured pocket p1 (645 su), which is farther than a7
    const far = front([F.a3, F.a4], 36, 3);
    rs(far);
    expect(prongs(far).map((p) => p.target)).toEqual([F.a3, F.a4]);
  });

  it('a captured pocket can be a target; the hive and the probe never are', () => {
    const w = front([F.a5]);
    guardianAt(w, F.p1)!.alive = false;
    w.field!.free[F.p1] = 1;
    econAtNode(w, F.p1, 2);
    expect(isRaidable(w, F.p1)).toBe(true);
    rs(w);
    expect(prongs(w).map((p) => p.target)).toEqual([F.a5, F.p1]);
    const x = front([F.a5]);
    for (const n of [F.heart, F.probe]) {
      x.field!.mine[n] = true;
      addEcon(x, 'hauler', n, n);
      expect(isRaidable(x, n)).toBe(false);
    }
    rs(x);
    expect(raidProngs(x.raid!)).toHaveLength(1);
    expect(x.raid!.target).toBe(F.a5);
  });

  it('a muster cancelled by a battle at the hive discards the prongs with the raid', () => {
    const w = front([F.a5, F.a6]);
    rs(w);
    expect(raidProngs(w.raid!)).toHaveLength(2);
    hive(w).battle = { ticksLeft: 5 } as never;
    rs(w);
    expect(w.raid).toBeNull();
  });
});

describe('W2: the deal', () => {
  it('4T 8S into 2 prongs is 2T 4S each; 3T 8S is 2T 4S and 1T 4S; the pointer carries on from Thorns into Spores', () => {
    expect(dealCounts({ thorn: 4, spore: 8 }, 2).map(counts)).toEqual([
      [2, 4],
      [2, 4],
    ]);
    expect(dealCounts({ thorn: 3, spore: 8 }, 2).map(counts)).toEqual([
      [2, 4],
      [1, 4],
    ]);
    expect(dealCounts({ thorn: 3, spore: 7 }, 2).map(counts)).toEqual([
      [2, 3],
      [1, 4],
    ]);
    expect(dealCounts({ thorn: 5, spore: 0 }, 3).map(counts)).toEqual([
      [2, 0],
      [2, 0],
      [1, 0],
    ]);
    expect(dealCounts({ thorn: 4, spore: 8 }, 1).map(counts)).toEqual([[4, 8]]);
  });

  it('at muster each prong carries its dealt plan; at launch the raiders are dealt again, lowest id of each type first', () => {
    const w = front([F.a5, F.a6]);
    rs(w);
    expect(prongs(w).map((p) => counts(p.planned))).toEqual([
      [2, 4],
      [2, 4],
    ]);
    expect(prongs(w).every((p) => p.phase === 'muster' && p.guards.length === 0)).toBe(true);
    const lowThorns = hive(w)
      .guards.filter((g) => g.type === 'thorn')
      .map((g) => g.id)
      .slice(0, 4);
    const lowSpores = hive(w)
      .guards.filter((g) => g.type === 'spore')
      .map((g) => g.id)
      .slice(0, 8);
    launched(w);
    const [p0, p1] = prongs(w);
    // The pointer deals thorns 1,2,3,4 to prongs 0,1,0,1 and spores 1..8 to 0,1,0,1,...
    expect(p0!.guards.filter((g) => g.type === 'thorn').map((g) => g.id)).toEqual([lowThorns[0], lowThorns[2]]);
    expect(p1!.guards.filter((g) => g.type === 'thorn').map((g) => g.id)).toEqual([lowThorns[1], lowThorns[3]]);
    expect(p0!.guards.filter((g) => g.type === 'spore').map((g) => g.id)).toEqual([0, 2, 4, 6].map((i) => lowSpores[i]));
    expect(p1!.guards.filter((g) => g.type === 'spore').map((g) => g.id)).toEqual([1, 3, 5, 7].map((i) => lowSpores[i]));
    for (const p of [p0!, p1!]) expect(p.guards.map((g) => g.id)).toEqual([...p.guards.map((g) => g.id)].sort((a, b) => a - b));
    expect([p0!.planned, p1!.planned].map(counts)).toEqual([
      [2, 4],
      [2, 4],
    ]);
    expect(prongs(w).every((p) => p.phase === 'out')).toBe(true);
    expect(hive(w).guards).toHaveLength(36 - 12);
  });

  it('a trimmed launch drops to 1 prong, keeping the nearest target, and the dropped target clears', () => {
    const w = front([F.a5, F.a6]);
    rs(w);
    // The hive can spare only 4 by launch time: floor(4 ÷ 4) is 1 prong, which takes everything.
    const h = hive(w);
    const keep = raidKeep(w, h);
    h.guards = h.guards.slice(0, keep + 4);
    expect(rockStatus(w, F.a6).raidMix).not.toBeNull();
    rsUntil(w, (x) => x.raid === null || x.raid.phase === 'out');
    const r = w.raid!;
    expect(r.phase).toBe('out');
    expect(raidProngs(r)).toHaveLength(1);
    expect(r.others).toBeUndefined();
    expect(r.target).toBe(F.a5);
    expect(r.guards).toHaveLength(4);
    expect(rockStatus(w, F.a6).raidTarget).toBe(false);
    expect(rockStatus(w, F.a6).raidMix).toBeNull();
    expect(raidStatus(w).prongs).toHaveLength(1);
  });

  it('a launch that still holds 2 × prongMinSize keeps both prongs even if trimmed', () => {
    const w = front([F.a5, F.a6]);
    rs(w);
    const h = hive(w);
    h.guards = h.guards.slice(0, raidKeep(w, h) + 9); // spare 9: floor(9 ÷ 4) = 2 prongs, dealt 5 and 4
    const r = launched(w);
    expect(raidProngs(r).map((p) => p.guards.length)).toEqual([5, 4]);
    expect(raidProngs(r).map((p) => p.planned.thorn + p.planned.spore)).toEqual([5, 4]);
  });
});

describe('W3: flight and arrival', () => {
  it('every prong launches on the same tick and flies its own leg; they arrive on different ticks', () => {
    const w = front([F.a5, F.a6]);
    const r = launched(w);
    const [p0, p1] = raidProngs(r);
    expect([p0!.from, p1!.from]).toEqual([F.heart, F.heart]);
    const f0 = Math.ceil(nodeDistance(w, F.heart, F.a5) / w.tun['raid.speedSu']);
    const f1 = Math.ceil(nodeDistance(w, F.heart, F.a6) / w.tun['raid.speedSu']);
    expect([p0!.flightTicks, p1!.flightTicks]).toEqual([f0, f1]);
    expect([p0!.ticksLeft, p1!.ticksLeft]).toEqual([f0, f1]);
    expect(f0).toBeLessThan(f1);
    rs(w, f0);
    expect([p0!.phase, p1!.phase]).toEqual(['fight', 'out']);
    expect(p1!.ticksLeft).toBe(f1 - f0);
    rs(w, f1 - f0);
    expect(p1!.phase).toBe('fight');
    expect(p1!.flightTicks).toBe(0);
    expect(p1!.from).toBe(F.a6);
  });
});

describe('W4: the fight, per prong', () => {
  /** Two prongs of 6 Thorns each... sized small and sturdy so the fights are decided by the test's own damage numbers. */
  function twoFronts(): World {
    const w = front([F.a5, F.a6]);
    w.tun['guard.thorn.damage'] = 6;
    w.tun['guard.spore.damage'] = 6;
    w.tun['raid.shieldEcon'] = 1; // the v12 fixture carries the shield at 0
    return w;
  }

  it('the shield holds at one target while the other target\'s economy ships are struck (j)', () => {
    const w = twoFronts();
    w.tun['ship.drone.hp'] = 100000; // a Drone that outlasts every round, so the shield stands at a5 throughout
    w.tun['ship.drone.damage'] = 0;
    addShips(w, F.a5, 1, 'drone');
    launched(w);
    toFight(w);
    const econAt = (n: number) => w.field!.econ.filter((s) => s.at === n).length;
    const a5Econ = econAt(F.a5);
    const a6Econ = econAt(F.a6);
    toRound(w);
    rs(w);
    // Prong 0 saw a Drone at a5: it struck the Drone only. Prong 1 saw none at a6: it struck economy ships.
    expect(w.ships).toHaveLength(1);
    expect(w.ships[0]!.hp).toBeLessThan(100000); // prong 0 struck the Drone
    expect(prongs(w)[0]!.lostEcon).toEqual({ extractor: 0, hauler: 0 });
    expect(econAt(F.a5)).toBe(a5Econ);
    expect(econAt(F.a6)).toBeLessThan(a6Econ);
    const l1 = prongs(w)[1]!.lostEcon;
    expect(l1.extractor + l1.hauler).toBe(a6Econ - econAt(F.a6));
    expect(prongs(w)[1]!.lostShips).toEqual({ drone: 0, lancer: 0, flak: 0 });
  });

  it('a round that starts with no player ship at a target sends that prong home, and only that prong', () => {
    const w = twoFronts();
    launched(w);
    toFight(w);
    // Nothing is left at a5 (its economy moved away); a6 still has its economy.
    w.field!.econ = w.field!.econ.filter((s) => s.at !== F.a5);
    syncExtractors(w);
    toRound(w);
    rs(w);
    expect(prongs(w).map((p) => p.phase)).toEqual(['home', 'fight']);
  });

  it('two live prongs never share a node: each round runs against its own target', () => {
    const w = twoFronts();
    launched(w);
    toFight(w);
    const at = prongs(w).map((p) => p.target);
    expect(new Set(at).size).toBe(2);
    toRound(w);
    rs(w);
    expect(prongs(w).map((p) => p.target)).toEqual(at);
  });

  it('the hold: each prong holds its own rock\'s haulers from its launch to its own outcome (k)', () => {
    const w = twoFronts();
    w.tun['raid.haulersHold'] = 1;
    // Hauler-held: haulers waiting at the probe for each rock.
    for (const n of [F.a5, F.a6]) addEcon(w, 'hauler', PROBE, n);
    rs(w);
    expect([haulersHeld(w, F.a5), haulersHeld(w, F.a6)]).toEqual([false, false]); // not during the muster
    rsUntil(w, (x) => x.raid!.phase === 'out');
    expect([haulersHeld(w, F.a5), haulersHeld(w, F.a6)]).toEqual([true, true]);
    expect(raidStatus(w).prongs.map((p) => p.holding)).toEqual([1, 1]);
    expect(raidStatus(w).holding).toBe(2);
    toFight(w);
    // Prong 0's rock is emptied of defenders and economy, so its prong leaves; prong 1 keeps fighting.
    w.field!.econ = w.field!.econ.filter((s) => s.at !== F.a5);
    syncExtractors(w);
    toRound(w);
    rs(w);
    expect(prongs(w).map((p) => p.phase)).toEqual(['home', 'fight']);
    expect([haulersHeld(w, F.a5), haulersHeld(w, F.a6)]).toEqual([false, true]);
    expect(rockStatus(w, F.a5).haulersHeld).toBe(false);
    expect(rockStatus(w, F.a6).haulersHeld).toBe(true);
    expect(raidStatus(w).prongs.map((p) => p.holding)).toEqual([0, 1]);
    expect(raidStatus(w).holding).toBe(1);
  });

  it('a hold with raid.haulersHold 0 holds nothing', () => {
    const w = twoFronts();
    w.tun['raid.haulersHold'] = 0;
    launched(w);
    expect([haulersHeld(w, F.a5), haulersHeld(w, F.a6)]).toEqual([false, false]);
  });
});

describe('W5: the retarget, per prong', () => {
  it('a prong whose target was unmarked retargets once to the nearest node no other live prong aims at (l)', () => {
    const w = front([F.a5, F.a6, F.a7]);
    launched(w);
    expect(prongs(w).map((p) => p.target)).toEqual([F.a5, F.a6]);
    w.field!.mine[F.a5] = false; // prong 0's target; prong 1 is out toward a6, so the nearest free is a7
    rs(w, prongs(w)[0]!.ticksLeft);
    const [p0, p1] = prongs(w);
    expect(p0!.phase).toBe('out');
    expect(p0!.retargeted).toBe(true);
    expect(p0!.target).toBe(F.a7);
    expect(p0!.from).toBe(F.a5);
    expect(p0!.flightTicks).toBe(Math.ceil(nodeDistance(w, F.a5, F.a7) / w.tun['raid.speedSu']));
    expect(p1!.retargeted).toBe(false);
    expect(p1!.target).toBe(F.a6);
    expect(new Set(prongs(w).map((p) => p.target)).size).toBe(2);
  });

  it('a prong whose only alternative is the other prong\'s live target flies home instead of doubling up', () => {
    const w = front([F.a5, F.a6]);
    launched(w);
    w.field!.mine[F.a5] = false;
    rs(w, prongs(w)[0]!.ticksLeft);
    const [p0, p1] = prongs(w);
    expect(p0!.phase).toBe('home');
    expect(p0!.target).toBe(F.a5);
    expect(p0!.retargeted).toBe(false);
    expect(p1!.phase).toBe('out');
    expect(raidStatus(w).prongs.map((p) => p.outcome)).toEqual(['turnedBack', null]);
  });

  it('retargeted is per prong: a second failure sends that prong home, the other still has its one retarget', () => {
    const w = front([F.a5, F.a6, F.a7, F.p1]);
    guardianAt(w, F.p1)!.alive = false;
    w.field!.free[F.p1] = 1;
    launched(w);
    w.field!.mine[F.a5] = false;
    rs(w, prongs(w)[0]!.ticksLeft);
    expect(prongs(w)[0]!.target).toBe(F.a7);
    w.field!.mine[F.a7] = false;
    w.field!.mine[F.a6] = false;
    rsUntil(w, (x) => prongs(x)[0]!.phase !== 'out' || prongs(x)[1]!.phase !== 'out');
    // Prong 1 reached a6 (now unmarked) first? It is the nearer arrival: it retargets once, to p1.
    const [p0, p1] = prongs(w);
    const first = p0!.phase === 'out' ? p1! : p0!;
    expect(first.retargeted || first.phase === 'home').toBe(true);
  });

  it('if the player unmarks every rock, both prongs fly home and the raid ends turned back', () => {
    const w = front([F.a5, F.a6]);
    launched(w);
    for (const n of [F.a5, F.a6]) w.field!.mine[n] = false;
    rsUntil(w, (x) => x.raid === null);
    expect(w.lastRaid!.outcome).toBe('turnedBack');
    expect(w.lastRaid!.prongs.map((p) => p.outcome)).toEqual(['turnedBack', 'turnedBack']);
    expect(w.stats.raids).toEqual({ mustered: 1, beaten: 0, hit: 0, turnedBack: 1 });
    expect(w.stats.raidProngs).toEqual({ beaten: 0, hit: 0, turnedBack: 2 });
    expect(hive(w).guards).toHaveLength(36);
  });
});

/** Builds a raid by hand: each prong in `phase`, with these raiders taken from the hive (lowest ids first), like a launch would. */
function forceRaid(w: World, specs: Array<{ target: number; phase: Prong['phase']; mix: GuardCounts; lostEcon?: number }>): Raid {
  const h = hive(w);
  const list: Prong[] = specs.map((s) => {
    const taken: Guard[] = [];
    const need = { ...s.mix };
    h.guards = h.guards.filter((g) => {
      if (need[g.type] > 0) {
        need[g.type] -= 1;
        taken.push(g);
        return false;
      }
      return true;
    });
    const flying = s.phase === 'out' || s.phase === 'home';
    const flight = Math.ceil(nodeDistance(w, F.heart, s.target) / w.tun['raid.speedSu']);
    return {
      phase: s.phase,
      target: s.target,
      guards: taken,
      ticksLeft: flying ? flight : 0,
      planned: { ...s.mix },
      flightTicks: flying ? flight : 0,
      from: s.phase === 'out' ? F.heart : s.target,
      retargeted: false,
      lostEcon: { extractor: s.lostEcon ?? 0, hauler: 0 },
      lostShips: { drone: 0, lancer: 0, flak: 0 },
      killed: { thorn: 0, spore: 0 },
    };
  });
  const [first, ...others] = list;
  const raid: Raid = { id: 1, ...first!, ...(others.length > 0 ? { others } : {}) };
  w.raid = raid;
  w.stats.raids.mustered += 1;
  return raid;
}

describe('W6: outcomes and pacing', () => {
  /** Two prongs at a5 and a6, each 1 Thorn 3 Spores, both fighting. */
  function fighting(): World {
    const w = front([F.a5, F.a6]);
    w.tun['guard.thorn.damage'] = 6;
    w.tun['guard.spore.damage'] = 6;
    forceRaid(w, [
      { target: F.a5, phase: 'fight', mix: { thorn: 1, spore: 3 } },
      { target: F.a6, phase: 'fight', mix: { thorn: 1, spore: 3 } },
    ]);
    return w;
  }

  it('a beaten prong is done at once; the other fights on; the raid has not ended (i)', () => {
    const w = fighting();
    addShips(w, F.a5, 30, 'drone');
    w.tun['ship.drone.damage'] = 20;
    toRound(w);
    rs(w);
    const [p0, p1] = prongs(w);
    expect(p0!.phase).toBe('done');
    expect(p0!.outcome).toBe('beaten');
    expect(p0!.guards).toEqual([]);
    expect(p1!.phase).toBe('fight');
    expect(w.raid).not.toBeNull();
    expect(w.stats.raids.beaten + w.stats.raids.hit + w.stats.raids.turnedBack).toBe(0);
    const st = raidStatus(w);
    expect(st.prongs.map((p) => [p.phase, p.outcome])).toEqual([
      ['done', 'beaten'],
      ['fight', null],
    ]);
    expect(st.phase).toBe('fight');
    // A done prong aims at nothing.
    expect(rockStatus(w, F.a5).raidTarget).toBe(false);
    expect(rockStatus(w, F.a5).raidMix).toBeNull();
    expect(rockStatus(w, F.a6).raidTarget).toBe(true);
  });

  it('one beaten and one hit: the raid is a hit, raidProngs counts one of each, and the gap runs from the last prong', () => {
    const w = fighting();
    addShips(w, F.a5, 30, 'drone');
    w.tun['ship.drone.damage'] = 20;
    toRound(w);
    rs(w);
    // a6 has no warship: its prong strikes economy ships, then (turned out of targets) flies home.
    rsUntil(w, (x) => prongs(x)[1]!.lostEcon.extractor + prongs(x)[1]!.lostEcon.hauler > 0, 200);
    toRound(w);
    w.field!.econ = w.field!.econ.filter((s) => s.at !== F.a6);
    syncExtractors(w);
    rs(w, 30);
    rsUntil(w, (x) => prongs(x)[1]!.phase === 'home');
    expect(raidStatus(w).prongs.map((p) => p.outcome)).toEqual(['beaten', 'hit']);
    expect(raidStatus(w).phase).toBe('home');
    const away = hive(w).guards.length;
    rsUntil(w, (x) => x.raid === null);
    const end = w.tick;
    expect(hive(w).guards.length).toBeGreaterThan(away); // the prong's raiders rejoined the hive
    expect(w.lastRaid!.outcome).toBe('hit');
    expect(w.lastRaid!.target).toBe(F.a5);
    expect(w.lastRaid!.prongs.map((p) => [p.target, p.outcome])).toEqual([
      [F.a5, 'beaten'],
      [F.a6, 'hit'],
    ]);
    expect(w.lastRaid!.prongs[0]!.killed).toEqual({ thorn: 1, spore: 3 });
    expect(w.lastRaid!.killed).toEqual({ thorn: 1, spore: 3 });
    expect(w.lastRaid!.lostEcon.extractor + w.lastRaid!.lostEcon.hauler).toBeGreaterThan(0);
    expect(w.stats.raids).toEqual({ mustered: 1, beaten: 0, hit: 1, turnedBack: 0 });
    expect(w.stats.raidProngs).toEqual({ beaten: 1, hit: 1, turnedBack: 0 });
    expect(fieldSummary(w).raidProngs).toEqual({ beaten: 1, hit: 1, turnedBack: 0 });
    expect(w.nextRaidTick).toBe(end - 1 + w.tun['raid.gapTicks']); // the hook ran on tick end - 1
  });

  it('the overall outcome: hit if any prong hit, else beaten if every prong was beaten, else turned back', () => {
    const overall = (a: { phase: Prong['phase']; lost: number }, b: { phase: Prong['phase']; lost: number }) => {
      const w = front([F.a5, F.a6]);
      forceRaid(w, [
        { target: F.a5, phase: a.phase, mix: { thorn: 1, spore: 3 }, lostEcon: a.lost },
        { target: F.a6, phase: b.phase, mix: { thorn: 1, spore: 3 }, lostEcon: b.lost },
      ]);
      // A prong that is `done` beaten has no raiders; the others fly 1 tick from home.
      for (const p of raidProngs(w.raid!)) {
        if (p.phase === 'done') {
          p.outcome = 'beaten';
          p.guards = [];
        } else p.ticksLeft = 1;
      }
      rs(w);
      return [w.lastRaid!.outcome, w.stats.raids.beaten, w.stats.raids.hit, w.stats.raids.turnedBack, w.stats.raidProngs];
    };
    expect(overall({ phase: 'home', lost: 1 }, { phase: 'home', lost: 0 })).toEqual(['hit', 0, 1, 0, { beaten: 0, hit: 1, turnedBack: 1 }]);
    expect(overall({ phase: 'done', lost: 0 }, { phase: 'home', lost: 2 })).toEqual(['hit', 0, 1, 0, { beaten: 1, hit: 1, turnedBack: 0 }]);
    expect(overall({ phase: 'done', lost: 0 }, { phase: 'home', lost: 0 })).toEqual(['turnedBack', 0, 0, 1, { beaten: 1, hit: 0, turnedBack: 1 }]);
    expect(overall({ phase: 'home', lost: 0 }, { phase: 'home', lost: 0 })).toEqual(['turnedBack', 0, 0, 1, { beaten: 0, hit: 0, turnedBack: 2 }]);
  });

  it('every prong beaten is a beaten raid', () => {
    const w = fighting();
    addShips(w, F.a5, 30, 'drone');
    addShips(w, F.a6, 30, 'drone');
    w.tun['ship.drone.damage'] = 20;
    toRound(w);
    rs(w);
    expect(w.raid).toBeNull();
    expect(w.lastRaid!.outcome).toBe('beaten');
    expect(w.stats.raids).toEqual({ mustered: 1, beaten: 1, hit: 0, turnedBack: 0 });
    expect(w.stats.raidProngs).toEqual({ beaten: 2, hit: 0, turnedBack: 0 });
    expect(w.nextRaidTick).toBe(w.tick - 1 + w.tun['raid.gapTicks']);
  });

  it('a prong that is home rejoins the guard list while the other is still out; the raiders away count against the hive caps (W7)', () => {
    const w = front([F.a5, F.a6]);
    const h = hive(w);
    const before = h.guards.length;
    forceRaid(w, [
      { target: F.a5, phase: 'home', mix: { thorn: 2, spore: 4 } },
      { target: F.a6, phase: 'out', mix: { thorn: 2, spore: 4 } },
    ]);
    expect(h.guards).toHaveLength(before - 12);
    expect(counts(raidStatus(w).raiders)).toEqual([4, 8]); // the sum over both prongs
    // W7: with 12 away and 24 alive the hive sits at its caps (12 Thorns, 24 Spores), so nothing regrows however long we wait.
    const added: string[] = [];
    for (let i = 0; i < 4000; i++) hiveRegrow(w, h, (t) => added.push(t));
    expect(added).toEqual([]);
    // Prong 1's two Thorns die: one cap slot opens for each, so Thorns regrow while its Spores (still away) leave Spores at the cap.
    prongs(w)[1]!.guards = prongs(w)[1]!.guards.filter((g) => g.type !== 'thorn');
    for (let i = 0; i < 4000; i++) hiveRegrow(w, h, (t) => added.push(t));
    expect(added.length).toBeGreaterThan(0);
    expect(new Set(added)).toEqual(new Set(['thorn']));
    rs(w, prongs(w)[0]!.ticksLeft);
    expect(prongs(w)[0]!.phase).toBe('done');
    expect(prongs(w)[0]!.outcome).toBe('turnedBack');
    expect(prongs(w)[0]!.guards).toEqual([]);
    expect(w.raid).not.toBeNull();
    expect(counts(raidStatus(w).raiders)).toEqual([0, 4]); // only prong 1's four Spores are still away
    expect(h.guards.filter((g) => g.type === 'spore')).toHaveLength(24 - 8 + 4); // prong 0's Spores rejoined
  });

  it('the hive falling withers every prong, and the raid ends withered, uncounted (R9)', () => {
    const w = front([F.a5, F.a6]);
    forceRaid(w, [
      { target: F.a5, phase: 'out', mix: { thorn: 2, spore: 4 } },
      { target: F.a6, phase: 'home', mix: { thorn: 2, spore: 4 } },
    ]);
    raidWither(w);
    expect(w.raid).toBeNull();
    expect(w.lastRaid!.outcome).toBe('withered');
    expect(w.lastRaid!.prongs.map((p) => p.outcome)).toEqual(['withered', 'withered']);
    expect(w.stats.raids).toEqual({ mustered: 1, beaten: 0, hit: 0, turnedBack: 0 });
    expect(w.stats.raidProngs).toEqual({ beaten: 0, hit: 0, turnedBack: 0 });
  });

  it('a prong that was beaten before the hive fell keeps its outcome in the withered raid\'s result', () => {
    const w = front([F.a5, F.a6]);
    forceRaid(w, [
      { target: F.a5, phase: 'out', mix: { thorn: 2, spore: 4 } },
      { target: F.a6, phase: 'out', mix: { thorn: 2, spore: 4 } },
    ]);
    const p0 = prongs(w)[0]!;
    p0.phase = 'done';
    p0.outcome = 'beaten';
    p0.guards = [];
    raidWither(w);
    expect(w.lastRaid!.prongs.map((p) => p.outcome)).toEqual(['beaten', 'withered']);
  });

  it('the gap, the muster and R3 are the raid\'s, not a prong\'s: no new raid while any prong is out', () => {
    const w = front([F.a5, F.a6]);
    forceRaid(w, [
      { target: F.a5, phase: 'home', mix: { thorn: 2, spore: 4 } },
      { target: F.a6, phase: 'out', mix: { thorn: 2, spore: 4 } },
    ]);
    prongs(w)[0]!.ticksLeft = 1;
    rs(w);
    expect(prongs(w)[0]!.phase).toBe('done');
    expect(w.stats.raids.mustered).toBe(1);
    expect(w.raid!.id).toBe(1);
  });
});

describe('recycleFleet: the exclusion covers any prong in its fight phase', () => {
  it('ships at a target whose prong fights are not recycled; ships at a target whose prong is out or done are', () => {
    const w = front([F.a5, F.a6]);
    addShips(w, F.a5, 1, 'drone');
    addShips(w, F.a6, 1, 'drone');
    forceRaid(w, [
      { target: F.a5, phase: 'fight', mix: { thorn: 2, spore: 4 } },
      { target: F.a6, phase: 'out', mix: { thorn: 2, spore: 4 } },
    ]);
    expect(recycleOrder(w, 'drone').map((s) => s.at)).toEqual([F.a6]);
    const [p0, p1] = prongs(w);
    p1!.phase = 'fight';
    expect(recycleOrder(w, 'drone')).toEqual([]);
    p0!.phase = 'home';
    expect(recycleOrder(w, 'drone').map((s) => s.at)).toEqual([F.a5]);
    p1!.phase = 'done';
    p1!.outcome = 'beaten';
    expect(recycleOrder(w, 'drone').map((s) => s.at)).toEqual([F.a5, F.a6]);
  });
});

describe('selectors, at each prong phase', () => {
  it('raidStatus while mustering: every prong in `muster` with its plan, totals, nextProngs, and the rock fields', () => {
    const w = front([F.a5, F.a6]);
    expect(raidStatus(w).prongs).toEqual([]);
    expect(raidStatus(w).nextProngs).toBe(2);
    expect(nextProngs(w)).toBe(2);
    rs(w);
    const st = raidStatus(w);
    expect(st.phase).toBe('muster');
    expect(st.target).toBe(F.a5);
    expect(st.ticksToLaunch).toBe(w.tun['raid.musterTicks'] - 1); // the muster tick counted once
    expect(st.ticksToArrival).toBe(0);
    expect(counts(st.planned)).toEqual([4, 8]);
    expect(counts(st.raiders)).toEqual([0, 0]);
    expect(st.prongs.map((p) => [p.target, p.phase, counts(p.planned), counts(p.raiders), p.ticksToArrival, p.outcome, p.holding])).toEqual([
      [F.a5, 'muster', [2, 4], [0, 0], 0, null, 0],
      [F.a6, 'muster', [2, 4], [0, 0], 0, null, 0],
    ]);
    expect(rockStatus(w, F.a5)).toMatchObject({ raidTarget: true, raidNext: true });
    expect(counts(rockStatus(w, F.a5).raidMix!)).toEqual([2, 4]);
    expect(counts(rockStatus(w, F.a6).raidMix!)).toEqual([2, 4]);
    expect(rockStatus(w, F.a7).raidMix).toBeNull();
    expect(rockStatus(w, F.a7).raidTarget).toBe(false);
  });

  it('nextProngs follows W1 with today\'s economy: 0 below a size, 1, 2 and 3 as it grows; 0 with no raidable rock or raids off', () => {
    const w = front([F.a5, F.a6, F.a7], 3, 3);
    expect(nextProngs(w)).toBe(1); // size 1
    for (const [econ, expected] of [
      [24, 2],
      [36, 3],
    ] as const) {
      const x = front([F.a5, F.a6, F.a7], econ, 3);
      expect(nextProngs(x)).toBe(expected);
    }
    const none = front([]);
    expect(nextProngs(none)).toBe(0);
    const off = front([F.a5, F.a6]);
    off.tun['raid.enabled'] = 0;
    expect(nextProngs(off)).toBe(0);
    const noSpare = front([F.a5, F.a6]);
    hive(noSpare).guards = hive(noSpare).guards.slice(0, raidKeep(noSpare, hive(noSpare)));
    expect(nextProngs(noSpare)).toBe(0);
  });

  it('raidStatus out, fight and home: the summary phase, the smallest ticksToArrival, and totals over prongs', () => {
    const w = front([F.a5, F.a6]);
    launched(w);
    let st = raidStatus(w);
    expect(st.phase).toBe('out');
    const f0 = Math.ceil(nodeDistance(w, F.heart, F.a5) / w.tun['raid.speedSu']);
    expect(st.ticksToArrival).toBe(f0);
    expect(st.prongs.map((p) => p.ticksToArrival)).toEqual([f0, Math.ceil(nodeDistance(w, F.heart, F.a6) / w.tun['raid.speedSu'])]);
    expect(counts(st.raiders)).toEqual([4, 8]);
    expect(rockStatus(w, F.a6)).toMatchObject({ raidTarget: true });
    expect(counts(rockStatus(w, F.a6).raidMix!)).toEqual([2, 4]);
    rs(w, f0);
    st = raidStatus(w);
    expect(st.phase).toBe('fight'); // fight wins over out
    expect(st.ticksToArrival).toBe(prongs(w)[1]!.ticksLeft); // the fighting prong has none: the smallest is the one still out
    expect(st.prongs.map((p) => p.phase)).toEqual(['fight', 'out']);
    // Prong 0 leaves (nothing of the player's at a5), prong 1 is still out: home wins only when nothing else is out or fighting.
    w.field!.econ = w.field!.econ.filter((s) => s.at !== F.a5);
    syncExtractors(w);
    toRound(w);
    rs(w);
    st = raidStatus(w);
    expect(st.prongs.map((p) => p.phase)).toEqual(['home', 'out']);
    expect(st.phase).toBe('out');
    expect(st.ticksToArrival).toBe(Math.min(...st.prongs.map((p) => p.ticksToArrival)));
    prongs(w)[1]!.phase = 'home';
    expect(raidStatus(w).phase).toBe('home');
    expect(raidStatus(w).last).toBeNull();
  });

  it('last.prongs and last.outcome/target after the raid; the legacy fields mirror prong 0', () => {
    const w = front([F.a5, F.a6]);
    launched(w);
    for (const n of [F.a5, F.a6]) w.field!.mine[n] = false;
    rsUntil(w, (x) => x.raid === null);
    const st = raidStatus(w);
    expect(st.phase).toBe('none');
    expect(st.prongs).toEqual([]);
    expect(st.last!.target).toBe(F.a5);
    expect(st.last!.prongs.map((p) => p.target)).toEqual([F.a5, F.a6]);
    expect(st.last!.prongs[0]).toEqual({ target: F.a5, outcome: 'turnedBack', lostEcon: { extractor: 0, hauler: 0 }, lostShips: { drone: 0, lancer: 0, flak: 0 }, killed: { thorn: 0, spore: 0 } });
  });
});

describe('W8: raid.prongsMax 1 is H8', () => {
  /** The same world's raid, in the fields H8's tests read, at fixed intervals. */
  function trace(prongsMax: number, econ: number): string {
    const w = front([F.a5, F.a6], econ, prongsMax);
    addShips(w, F.a5, 4, 'drone');
    const out: unknown[] = [];
    for (let i = 0; i < 2600; i++) {
      rs(w);
      if (i % 40 === 0) {
        const r = w.raid;
        out.push(r === null ? null : [r.phase, r.target, r.guards.length, r.ticksLeft, r.planned, r.lostEcon, r.killed]);
      }
    }
    out.push(w.stats.raids, w.lastRaid && [w.lastRaid.outcome, w.lastRaid.target, w.lastRaid.lostEcon, w.lastRaid.killed], guardianAt(w, F.heart)!.guards.length);
    return JSON.stringify(out);
  }

  it('with prongsMax 1 a raid of 12 is one prong at a5 (the H8 raid); a raid below the split is identical under 1 and 2 (n)', () => {
    const big = front([F.a5, F.a6], 36, 1);
    launched(big);
    expect(raidProngs(big.raid!)).toHaveLength(1);
    expect(big.raid!.others).toBeUndefined();
    expect(big.raid!.guards).toHaveLength(12);
    // Below the split size (7 raiders: 1 prong under prongsMax 2) the two settings play the same raid, tick for tick.
    expect(trace(2, 21)).toBe(trace(1, 21));
  });

  it('a one-prong raid has no `others` and no `outcome` field while it lives (H8\'s saved shape)', () => {
    const w = front([F.a5], 36, 2);
    launched(w);
    toFight(w);
    expect(Object.keys(w.raid!).sort()).toEqual(
      ['from', 'flightTicks', 'guards', 'id', 'killed', 'lostEcon', 'lostShips', 'phase', 'planned', 'retargeted', 'target', 'ticksLeft'].sort(),
    );
  });
});

describe('save: the prongs round-trip, and a malformed raid is refused', () => {
  const load = (x: World) => deserializeWorld(serializeWorld(x), FD);

  it('a two-prong raid at muster, out, fight with a done prong, and the result with prongs, all round-trip exactly', () => {
    const w = front([F.a5, F.a6]);
    rs(w);
    const stages: World[] = [];
    const snap = (): void => {
      const back = load(w);
      expect(back.ok).toBe(true);
      if (back.ok) {
        expect(back.world.raid).toEqual(w.raid);
        stages.push(back.world);
      }
    };
    snap(); // muster
    rsUntil(w, (x) => x.raid!.phase === 'out');
    snap();
    toFight(w);
    prongs(w)[0]!.phase = 'done';
    prongs(w)[0]!.outcome = 'beaten';
    prongs(w)[0]!.guards = [];
    snap();
    expect(stages).toHaveLength(3);
    w.field!.mine[F.a6] = false;
    rsUntil(w, (x) => x.raid === null, 20000);
    const done = load(w);
    expect(done.ok).toBe(true);
    if (done.ok) expect(done.world.lastRaid).toEqual(w.lastRaid);
  });

  it('a raid with a bad prong, a bad `others`, an outcome before done, or a done prong without one is refused', () => {
    const w = front([F.a5, F.a6]);
    launched(w);
    type Save = { world: { raid: Record<string, unknown> & { others: Array<Record<string, unknown>> } } };
    const text = serializeWorld(w);
    const edits: Array<(s: Save) => void> = [
      (s) => (s.world.raid.others = {} as never),
      (s) => (s.world.raid.others = []),
      (s) => (s.world.raid.others[0]!.phase = 'sulking'),
      (s) => delete s.world.raid.others[0]!.target,
      (s) => (s.world.raid.others[0]!.target = 1.5),
      (s) => (s.world.raid.others[0]!.guards = 'none'),
      (s) => (s.world.raid.others[0]!.retargeted = 0),
      (s) => (s.world.raid.others[0]!.outcome = 'hit'),
      (s) => (s.world.raid.others[0]!.phase = 'done'),
      (s) => (s.world.raid.others[0]!.planned = { thorn: 'x', spore: 1 }),
      (s) => delete s.world.raid.others[0]!.lostEcon,
      (s) => (s.world.raid.phase = 'sulking'),
      (s) => delete s.world.raid.id,
      (s) => delete s.world.raid.killed,
    ];
    edits.forEach((edit, i) => {
      const bad = JSON.parse(text) as Save;
      edit(bad);
      expect(deserializeWorld(JSON.stringify(bad), FD), `edit ${i}`).toMatchObject({ ok: false, reason: 'corrupt' });
    });
    expect(load(w).ok).toBe(true);
    const done = JSON.parse(text) as Save;
    done.world.raid.others[0]!.phase = 'done';
    done.world.raid.others[0]!.outcome = 'beaten';
    expect(deserializeWorld(JSON.stringify(done), FD).ok).toBe(true);
  });

  it('a malformed last-raid prong entry is refused', () => {
    const w = front([F.a5, F.a6]);
    launched(w);
    for (const n of [F.a5, F.a6]) w.field!.mine[n] = false;
    rsUntil(w, (x) => x.raid === null);
    type Save = { world: { lastRaid: { prongs: Array<Record<string, unknown>> } } };
    const text = serializeWorld(w);
    const edits: Array<(s: Save) => void> = [
      (s) => (s.world.lastRaid.prongs = []),
      (s) => (s.world.lastRaid.prongs[0]!.outcome = 'sulking'),
      (s) => delete s.world.lastRaid.prongs[1]!.target,
      (s) => delete s.world.lastRaid.prongs[0]!.killed,
    ];
    edits.forEach((edit, i) => {
      const bad = JSON.parse(text) as Save;
      edit(bad);
      expect(deserializeWorld(JSON.stringify(bad), FD), `edit ${i}`).toMatchObject({ ok: false, reason: 'corrupt' });
    });
  });
});

describe('a whole two-prong raid under `step`', () => {
  it('runs from muster to its end through the full tick, deterministically', () => {
    const run = (): string => {
      const w = front([F.a5, F.a6]);
      for (let i = 0; i < 1500; i++) tick(w);
      return JSON.stringify([w.raid, w.lastRaid, w.stats.raids, w.stats.raidProngs, w.tick]);
    };
    const a = run();
    expect(a).toBe(run());
    const w = front([F.a5, F.a6]);
    let sawTwo = false;
    for (let i = 0; i < 1500 && !sawTwo; i++) {
      tick(w);
      sawTwo = w.raid !== null && raidProngs(w.raid).length === 2 && w.raid.phase === 'out';
    }
    expect(sawTwo).toBe(true);
  });
});
