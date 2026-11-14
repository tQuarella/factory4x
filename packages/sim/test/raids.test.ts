import { describe, expect, it } from 'vitest';
import {
  counterPct,
  deserializeWorld,
  guardianAt,
  isRaidable,
  launchMix,
  nodeDistance,
  raidKeep,
  raidMix,
  raidRank,
  raidSize,
  raidStatus,
  raidTarget,
  rockStatus,
  serializeWorld,
  type Guard,
  type GuardCounts,
  type Raid,
  type World,
} from '../src/index.ts';
import { raidStep } from '../src/factions/index.ts';
import { syncExtractors } from '../src/field.ts';
import { F, FD, addEcon, quietField, run, tick } from './field-helpers.ts';
import { addShips, setGuards } from './helpers.ts';

/**
 * h7-raids acceptance 1-3 and 5: R1-R9 on the frozen v12 fixture (its map.field is the shipped one). Most tests
 * call the hook directly (`rs`) on a world built by hand, so no other rule moves anything; the ones about the
 * hive's regrowth, capture and the 60-minute quiet run use `step`. Defaults used throughout: 12 Thorns and 24
 * Spores at the hive (keep 18 at hiveKeepPct 50), firstAtEcon 6, econPerRaider 3, maxSize 10, gap 2700, muster 450,
 * raid speed 3 (a5 is 430 su from the hive: 144 ticks).
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
    if (i >= max) throw new Error(`condition not met within ${max} calls (tick ${w.tick}, raid ${JSON.stringify(w.raid?.phase)})`);
    rs(w);
    i++;
  }
  return i;
}

/** A hand-built economy at `node`: one docked extractor and `n - 1` haulers waiting there. The node is Mine-marked. */
function econAtNode(w: World, node: number, n: number): void {
  w.field!.mine[node] = true;
  addEcon(w, 'extractor', node, node);
  for (let i = 1; i < n; i++) addEcon(w, 'hauler', node, node);
  syncExtractors(w);
}

/** A field where a5 is mined by `econ` economy ships. */
function raidWorld(econ: number, node: number = F.a5): World {
  const w = quietField();
  econAtNode(w, node, econ);
  return w;
}

const counts = (c: GuardCounts): number => c.thorn + c.spore;

/** Puts a raid in `phase` with raiders taken from the hive (lowest ids first), as a launch would. */
function forceRaid(w: World, c: GuardCounts, target: number, phase: Raid['phase']): Raid {
  const h = hive(w);
  const taken: Guard[] = [];
  const need = { ...c };
  h.guards = h.guards.filter((g) => {
    if (need[g.type] > 0) {
      need[g.type] -= 1;
      taken.push(g);
      return false;
    }
    return true;
  });
  const flight = Math.ceil(nodeDistance(w, F.heart, target) / w.tun['raid.speedSu']);
  const raid: Raid = {
    id: 1,
    phase,
    target,
    guards: taken,
    ticksLeft: phase === 'out' || phase === 'home' ? flight : 0,
    planned: { ...c },
    flightTicks: phase === 'out' || phase === 'home' ? flight : 0,
    from: phase === 'out' ? F.heart : target,
    retargeted: false,
    lostEcon: { extractor: 0, hauler: 0 },
    lostShips: { drone: 0, lancer: 0, flak: 0 },
    killed: { thorn: 0, spore: 0 },
  };
  w.raid = raid;
  w.stats.raids.mustered += 1;
  return raid;
}

/** A tick on a round boundary (the fight happens on round ticks). */
function toRound(w: World): void {
  const r = w.tun['combat.roundTicks'];
  while (w.tick % r !== 0) w.tick += 1;
}

describe('R3: when a raid musters', () => {
  it('no raid below raid.firstAtEcon, and a raid at it (econ counts extractors and haulers alive)', () => {
    const below = raidWorld(5);
    rs(below, 50);
    expect(below.raid).toBeNull();
    expect(below.stats.raids.mustered).toBe(0);
    const at = raidWorld(6);
    rs(at);
    expect(at.raid?.phase).toBe('muster');
    expect(at.stats.raids.mustered).toBe(1);
  });

  it('econ does not count ships still in a bay', () => {
    const w = raidWorld(5);
    w.field!.bays.extractor.ticksLeft = 50;
    rs(w, 5);
    expect(w.raid).toBeNull();
  });

  it('no raid with raid.enabled 0, even with a full economy', () => {
    const w = raidWorld(30);
    w.tun['raid.enabled'] = 0;
    rs(w, 3000);
    expect(w.raid).toBeNull();
    expect(w.stats.raids.mustered).toBe(0);
  });

  it('no raid without a target (nothing mined with a docked extractor or an assigned hauler)', () => {
    const w = quietField();
    for (let i = 0; i < 8; i++) addEcon(w, 'hauler', F.probe, null);
    rs(w, 10);
    expect(w.raid).toBeNull();
  });

  it('no raid before nextRaidTick, and none while a battle runs at the hive', () => {
    const w = raidWorld(6);
    w.nextRaidTick = 100;
    rs(w, 100);
    expect(w.raid).toBeNull();
    rs(w);
    expect(w.raid?.phase).toBe('muster');
    // A battle at the hive (sturdy drones, so it keeps running): the raid musters only once it is over.
    const b = raidWorld(6);
    b.tun['ship.drone.hp'] = 5000;
    addShips(b, F.heart, 2);
    b.raid = null;
    tick(b); // tick 0 is a round: the battle starts (after the hook, which musters at tick 0)
    expect(hive(b).battle).not.toBeNull();
    b.raid = null;
    b.stats.raids.mustered = 0;
    for (let i = 0; i < 40; i++) tick(b);
    expect(b.raid).toBeNull();
    expect(b.stats.raids.mustered).toBe(0);
  });

  it('no raid when the hive can spare none (guards alive at or below the keep)', () => {
    const w = raidWorld(12);
    const keep = raidKeep(w, hive(w));
    expect(keep).toBe(18);
    setGuards(w, F.heart, Array.from({ length: keep }, () => ['spore', 6] as const));
    rs(w, 10);
    expect(w.raid).toBeNull();
  });

  it('the muster takes raid.musterTicks, then the raiders launch (0 launches at once)', () => {
    const w = raidWorld(6);
    const start = w.tick;
    rs(w);
    expect(w.raid!.phase).toBe('muster');
    const calls = rsUntil(w, (x) => x.raid!.phase === 'out') + 1;
    expect(calls).toBe(w.tun['raid.musterTicks']);
    expect(w.tick - start).toBe(450);
    const fast = raidWorld(6);
    fast.tun['raid.musterTicks'] = 0;
    rs(fast);
    expect(fast.raid!.phase).toBe('out');
  });
});

describe('R4: size and mix', () => {
  it('want = min(maxSize, ceil(econ / econPerRaider)): 2 at econ 6, 4 at 12, 8 at 22, and capped by maxSize', () => {
    const w = quietField();
    const h = hive(w);
    expect(raidSize(w, 6, h)).toBe(2);
    expect(raidSize(w, 7, h)).toBe(3);
    expect(raidSize(w, 12, h)).toBe(4);
    expect(raidSize(w, 22, h)).toBe(8);
    expect(raidSize(w, 30, h)).toBe(10);
    expect(raidSize(w, 60, h)).toBe(10);
    w.tun['raid.maxSize'] = 3;
    expect(raidSize(w, 60, h)).toBe(3);
    w.tun['raid.econPerRaider'] = 1;
    expect(raidSize(w, 2, h)).toBe(2);
  });

  it('is capped by the keep: guards alive minus ceil(caps x hiveKeepPct / 100), caps after guard.capPct', () => {
    const w = quietField();
    const h = hive(w);
    expect(h.guards.length).toBe(36);
    expect(raidKeep(w, h)).toBe(18);
    w.tun['raid.hiveKeepPct'] = 90;
    expect(raidKeep(w, h)).toBe(33); // ceil(32.4)
    expect(raidSize(w, 60, h)).toBe(3);
    w.tun['raid.hiveKeepPct'] = 25;
    expect(raidKeep(w, h)).toBe(9);
    expect(raidSize(w, 60, h)).toBe(10);
    // The caps after guard.capPct: 50% of 12 and 24 is 6 and 12, so the keep is 9 at 50%.
    w.tun['raid.hiveKeepPct'] = 50;
    w.tun['guard.capPct'] = 50;
    expect(raidKeep(w, h)).toBe(9);
    // Guards alive below the caps count as they are: 20 alive, keep 9.
    setGuards(w, F.heart, Array.from({ length: 20 }, () => ['spore', 6] as const));
    expect(raidSize(w, 60, h)).toBe(10);
    setGuards(w, F.heart, Array.from({ length: 12 }, () => ['spore', 6] as const));
    expect(raidSize(w, 60, h)).toBe(3);
  });

  it('the mix follows the hive: thorn = floor(size x thorns / guards), spore = the rest', () => {
    expect(raidMix(4, { thorn: 12, spore: 24 })).toEqual({ thorn: 1, spore: 3 });
    expect(raidMix(2, { thorn: 12, spore: 24 })).toEqual({ thorn: 0, spore: 2 });
    expect(raidMix(6, { thorn: 5, spore: 7 })).toEqual({ thorn: 2, spore: 4 }); // floor(2.5), rest
    expect(raidMix(5, { thorn: 7, spore: 5 })).toEqual({ thorn: 2, spore: 3 }); // floor(2.92)
    expect(raidMix(3, { thorn: 0, spore: 9 })).toEqual({ thorn: 0, spore: 3 });
    expect(raidMix(3, { thorn: 9, spore: 0 })).toEqual({ thorn: 3, spore: 0 });
  });

  it('a type that runs short is made up by the other (never more than alive of either)', () => {
    expect(raidMix(10, { thorn: 1, spore: 9 })).toEqual({ thorn: 1, spore: 9 });
    expect(raidMix(9, { thorn: 8, spore: 1 })).toEqual({ thorn: 8, spore: 1 });
    expect(raidMix(12, { thorn: 4, spore: 3 })).toEqual({ thorn: 4, spore: 3 });
    // At launch: planned 3 Thorns, but only 1 is alive any more: a Spore takes the place.
    expect(launchMix({ thorn: 3, spore: 0 }, { thorn: 1, spore: 5 }, 3)).toEqual({ thorn: 1, spore: 2 });
    expect(launchMix({ thorn: 0, spore: 3 }, { thorn: 5, spore: 1 }, 3)).toEqual({ thorn: 2, spore: 1 });
    // Capped at the spare: Spores are trimmed first.
    expect(launchMix({ thorn: 2, spore: 4 }, { thorn: 12, spore: 24 }, 4)).toEqual({ thorn: 2, spore: 2 });
    expect(launchMix({ thorn: 2, spore: 4 }, { thorn: 12, spore: 24 }, 1)).toEqual({ thorn: 1, spore: 0 });
    expect(launchMix({ thorn: 2, spore: 4 }, { thorn: 12, spore: 24 }, 0)).toEqual({ thorn: 0, spore: 0 });
  });

  it('the launch takes the lowest ids of each type, and the planned mix is fixed at the muster', () => {
    const w = raidWorld(12); // size 4: 1 Thorn, 3 Spores
    rs(w);
    expect(w.raid!.planned).toEqual({ thorn: 1, spore: 3 });
    const h = hive(w);
    const lowThorn = h.guards.filter((g) => g.type === 'thorn')[0]!.id;
    const lowSpores = h.guards.filter((g) => g.type === 'spore').slice(0, 3).map((g) => g.id);
    // The raiders stay in the hive's guard list while mustering.
    expect(h.guards.length).toBe(36);
    rsUntil(w, (x) => x.raid!.phase === 'out');
    expect(w.raid!.guards.map((g) => g.id)).toEqual([lowThorn, ...lowSpores].sort((a, b) => a - b));
    expect(h.guards.length).toBe(32);
    expect(h.guards.some((g) => g.id === lowThorn || lowSpores.includes(g.id))).toBe(false);
  });

  it('at launch the hive holds back the keep even if guards were lost during the muster', () => {
    const w = raidWorld(60); // size 10 of 36 alive, keep 18
    rs(w);
    expect(counts(w.raid!.planned)).toBe(10);
    setGuards(w, F.heart, Array.from({ length: 22 }, () => ['spore', 6] as const)); // spare is now 4
    rsUntil(w, (x) => x.raid!.phase === 'out');
    expect(w.raid!.guards.length).toBe(4);
    expect(hive(w).guards.length).toBe(18);
  });

  it('raiders defend the hive while mustering: a battle then fights all of them, and cancels the muster', () => {
    const w = raidWorld(12);
    rs(w); // tick 0: muster starts (4 raiders still in the hive's list)
    expect(hive(w).guards.length).toBe(36);
    w.tun['ship.drone.hp'] = 5000;
    addShips(w, F.heart, 2);
    toRound(w);
    tick(w);
    expect(hive(w).battle).not.toBeNull();
    expect(hive(w).battle!.guardsAtStart.thorn + hive(w).battle!.guardsAtStart.spore).toBe(36);
  });
});

describe('R5: the target', () => {
  it('is the mined rock nearest the hive, ties to the lower node index', () => {
    const w = quietField();
    // a3 and a4 are the same distance from the hive; a1 and a2 too.
    expect(nodeDistance(w, F.heart, F.a3)).toBe(nodeDistance(w, F.heart, F.a4));
    expect(nodeDistance(w, F.heart, F.a1)).toBe(nodeDistance(w, F.heart, F.a2));
    econAtNode(w, F.a4, 1);
    econAtNode(w, F.a3, 1);
    expect(raidTarget(w)).toBe(F.a3);
    econAtNode(w, F.a2, 1);
    econAtNode(w, F.a1, 1);
    expect(raidTarget(w)).toBe(F.a3); // a3 is nearer than a1
    econAtNode(w, F.a5, 1);
    expect(raidTarget(w)).toBe(F.a5);
    expect(raidRank(w, F.a5)).toBe(1);
    expect(raidRank(w, F.a3)).toBe(2);
    expect(raidRank(w, F.a4)).toBe(3);
    expect(raidRank(w, F.a1)).toBe(4);
    expect(raidRank(w, F.a2)).toBe(5);
  });

  it('a tie between a1 and a2 goes to a1; between a6 and a7 to a6', () => {
    const w = quietField();
    econAtNode(w, F.a2, 1);
    econAtNode(w, F.a1, 1);
    expect(raidTarget(w)).toBe(F.a1);
    const v = quietField();
    econAtNode(v, F.a7, 1);
    econAtNode(v, F.a6, 1);
    expect(raidTarget(v)).toBe(F.a6);
  });

  it('a rock with only an assigned hauler counts (no docked extractor); a rock with neither does not', () => {
    const w = quietField();
    w.field!.mine[F.a5] = true;
    w.field!.mine[F.a3] = true;
    addEcon(w, 'hauler', F.probe, F.a3);
    expect(raidTarget(w)).toBe(F.a3);
    expect(isRaidable(w, F.a5)).toBe(false);
  });

  it('a docked extractor that is not Mine-marked does not count, and an extractor in flight is not docked', () => {
    const w = quietField();
    addEcon(w, 'extractor', F.a5, F.a5); // marked off
    expect(isRaidable(w, F.a5)).toBe(false);
    w.field!.mine[F.a5] = true;
    expect(isRaidable(w, F.a5)).toBe(true);
    const e = w.field!.econ[0]!;
    e.at = null;
    e.transit = { from: F.probe, to: F.a5, ticksLeft: 5, totalTicks: 10 };
    expect(isRaidable(w, F.a5)).toBe(false);
  });

  it('is never the probe, even Mine-marked with a docked extractor, and never the hive', () => {
    const w = quietField();
    w.field!.mine[F.probe] = true;
    addEcon(w, 'extractor', F.probe, F.probe);
    addEcon(w, 'hauler', F.probe, F.probe);
    expect(isRaidable(w, F.probe)).toBe(false);
    expect(raidTarget(w)).toBeNull();
    w.field!.mine[F.heart] = true;
    w.field!.free[F.heart] = 1;
    addEcon(w, 'hauler', F.heart, F.heart);
    expect(isRaidable(w, F.heart)).toBe(false);
    expect(raidTarget(w)).toBeNull();
    for (let i = 0; i < 8; i++) addEcon(w, 'hauler', F.probe, F.probe);
    rs(w, 20);
    expect(w.raid).toBeNull();
  });

  it('a guarded pocket is not a target; a captured one is', () => {
    const w = quietField();
    w.field!.mine[F.p1] = true;
    addEcon(w, 'hauler', F.p1, F.p1);
    expect(isRaidable(w, F.p1)).toBe(false);
    hive(w);
    guardianAt(w, F.p1)!.alive = false;
    expect(isRaidable(w, F.p1)).toBe(true);
  });

  it('Stop takes a rock off the raid list even while a hauler still flies home from it (the hauler keeps it as target until the probe)', () => {
    const w = quietField();
    const f = w.field!;
    f.mine[F.a5] = true;
    f.mine[F.a3] = true;
    addEcon(w, 'extractor', F.a5, F.a5);
    const hauler = addEcon(w, 'hauler', F.a5, F.a5);
    addEcon(w, 'extractor', F.a3, F.a3);
    syncExtractors(w);
    w.nodes[F.a5]!.buffer = 2;
    expect(raidTarget(w)).toBe(F.a5);
    tick(w, { type: 'setMine', node: F.a5, on: false });
    // The hauler loaded and is on its way to the probe, still assigned to a5.
    expect(hauler.transit).not.toBeNull();
    expect(hauler.transit!.to).toBe(F.probe);
    expect(hauler.target).toBe(F.a5);
    expect(rockStatus(w, F.a5).haulers).toBe(1);
    // ...but a5 is not raidable: the mark is off. The raid list holds only a3.
    expect(isRaidable(w, F.a5)).toBe(false);
    expect(raidTarget(w)).toBe(F.a3);
    expect(raidRank(w, F.a5)).toBe(0);
    expect(rockStatus(w, F.a5).raidRank).toBe(0);
    expect(rockStatus(w, F.a3).raidRank).toBe(1);
  });

  it('with only a Stopped rock left (a hauler flying home from it), no raid musters at any economy size', () => {
    const w = quietField();
    const f = w.field!;
    f.mine[F.a5] = true;
    addEcon(w, 'extractor', F.a5, F.a5);
    const haulers = [1, 2, 3, 4, 5, 6, 7].map(() => addEcon(w, 'hauler', F.a5, F.a5));
    syncExtractors(w);
    w.nodes[F.a5]!.buffer = 40;
    tick(w, { type: 'setMine', node: F.a5, on: false });
    expect(haulers.every((h) => h.target === F.a5 && h.transit !== null)).toBe(true);
    expect(w.field!.econ.length).toBe(8);
    for (let i = 0; i < 20; i++) tick(w);
    expect(w.raid).toBeNull();
    expect(w.stats.raids.mustered).toBe(0);
    expect(raidTarget(w)).toBeNull();
    // Marking it again puts it back on the list (the buffer and the assigned haulers are still there).
    tick(w, { type: 'setMine', node: F.a5, on: true });
    expect(raidTarget(w)).not.toBeNull();
  });

  it('the raid retargets once on arrival if its target was stopped, from where it is, and flies there', () => {
    const w = raidWorld(6, F.a5);
    econAtNode(w, F.a3, 1);
    rs(w);
    expect(w.raid!.target).toBe(F.a5);
    rsUntil(w, (x) => x.raid!.phase === 'out');
    expect(w.raid!.flightTicks).toBe(144);
    w.field!.mine[F.a5] = false;
    const arrive = rsUntil(w, (x) => x.raid!.phase !== 'out' || x.raid!.retargeted);
    expect(arrive).toBe(144);
    const r = w.raid!;
    expect(r.phase).toBe('out');
    expect(r.retargeted).toBe(true);
    expect(r.target).toBe(F.a3);
    expect(r.from).toBe(F.a5);
    expect(r.flightTicks).toBe(Math.ceil(nodeDistance(w, F.a5, F.a3) / 3));
    expect(r.ticksLeft).toBe(r.flightTicks);
  });

  it('a second miss does not retarget again: it flies home, and ends turned back', () => {
    const w = raidWorld(6, F.a5);
    econAtNode(w, F.a3, 1);
    rs(w);
    rsUntil(w, (x) => x.raid!.phase === 'out');
    w.field!.mine[F.a5] = false;
    rsUntil(w, (x) => x.raid!.retargeted);
    w.field!.mine[F.a3] = false;
    econAtNode(w, F.a1, 1); // an alternative exists, but the raid has used its one retarget
    rsUntil(w, (x) => x.raid!.phase === 'home');
    expect(w.raid!.target).toBe(F.a3);
    rsUntil(w, (x) => x.raid === null);
    expect(w.stats.raids).toMatchObject({ mustered: 1, turnedBack: 1, hit: 0, beaten: 0 });
  });

  it('with no mined rock left on arrival the raid flies home at once', () => {
    const w = raidWorld(6);
    rs(w);
    rsUntil(w, (x) => x.raid!.phase === 'out');
    w.field!.mine[F.a5] = false;
    rsUntil(w, (x) => x.raid!.phase === 'home');
    expect(w.raid!.retargeted).toBe(false);
    expect(w.raid!.from).toBe(F.a5);
    expect(w.raid!.flightTicks).toBe(144);
  });
});

describe('R6: launch and flight', () => {
  it('a battle at the hive during the muster cancels it: raid null, nextRaidTick = now, and a new muster waits for the battle to end', () => {
    const w = raidWorld(12);
    rs(w);
    w.tick = 0;
    expect(w.raid!.phase).toBe('muster');
    // Warships at the hive: the next round tick starts the battle (full step).
    w.tun['ship.drone.hp'] = 5000;
    addShips(w, F.heart, 2);
    w.tick = 0;
    tick(w);
    expect(hive(w).battle).not.toBeNull();
    expect(w.raid).not.toBeNull(); // the hook ran before combat started the battle
    tick(w);
    expect(w.raid).toBeNull();
    expect(w.nextRaidTick).toBe(w.tick - 1);
    expect(w.stats.raids.mustered).toBe(1);
    // The battle runs: no new muster until it is over.
    for (let i = 0; i < 5; i++) tick(w);
    expect(hive(w).battle).not.toBeNull();
    expect(w.raid).toBeNull();
    // Remove the ship: the battle ends (withdrew); the next hook musters again.
    w.ships = [];
    for (let i = 0; i < 3; i++) tick(w);
    expect(hive(w).battle).toBeNull();
    expect(w.raid?.phase).toBe('muster');
    expect(w.stats.raids.mustered).toBe(2);
  });

  it('flies at raid.speedSu: ceil(distance / speed) ticks, and arrives at the fight', () => {
    const w = raidWorld(6);
    rs(w);
    rsUntil(w, (x) => x.raid!.phase === 'out');
    expect(w.raid!.flightTicks).toBe(Math.ceil(430 / 3));
    const calls = rsUntil(w, (x) => x.raid!.phase === 'fight');
    expect(calls).toBe(144); // the launch call sets the flight; 144 calls later it arrives
    const fast = raidWorld(6);
    fast.tun['raid.speedSu'] = 10;
    rs(fast);
    rsUntil(fast, (x) => x.raid!.phase === 'out');
    expect(fast.raid!.flightTicks).toBe(43);
  });
});

describe('R7: the fight at the target', () => {
  it('no player ship at the node at the start of a round: the raid leaves for home', () => {
    const w = raidWorld(6);
    const r = forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'fight');
    w.field!.econ = []; // nothing there
    syncExtractors(w);
    toRound(w);
    rs(w);
    expect(r.phase).toBe('home');
    expect(r.flightTicks).toBe(144);
    expect(w.raid).toBe(r);
  });

  it('the fight happens only on round ticks', () => {
    const w = raidWorld(6);
    w.tun['guard.spore.damage'] = 6;
    forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'fight');
    w.tick = 1;
    rs(w, 29);
    expect(w.field!.econ.length).toBe(6);
    expect(w.tick).toBe(30);
    rs(w);
    expect(w.field!.econ.length).toBe(4); // 2 spores x 6 damage kill two 6-hp ships
  });

  it('economy ships do no damage: raiders facing only haulers and extractors keep their hp', () => {
    const w = raidWorld(3);
    const r = forceRaid(w, { thorn: 1, spore: 1 }, F.a5, 'fight');
    w.tun['guard.thorn.damage'] = 0;
    w.tun['guard.spore.damage'] = 0;
    const hp = r.guards.map((g) => g.hp);
    toRound(w);
    rs(w, 31);
    expect(r.guards.map((g) => g.hp)).toEqual(hp);
    expect(r.killed).toEqual({ thorn: 0, spore: 0 });
  });

  it('counters apply to the player damage: a Lancer is strong against a Thorn, weak against a Spore (and Flak the reverse)', () => {
    const t = (w: World) => w.tun;
    const probe = (ship: 'lancer' | 'flak', raiderType: 'thorn' | 'spore'): number => {
      const w = quietField();
      w.tun['guard.thorn.damage'] = 0;
      w.tun['guard.spore.damage'] = 0;
      w.tun['guard.spore.hp'] = 40;
      addShips(w, F.a5, 1, ship);
      w.field!.mine[F.a5] = true;
      const r = forceRaid(w, raiderType === 'thorn' ? { thorn: 1, spore: 0 } : { thorn: 0, spore: 1 }, F.a5, 'fight');
      r.guards[0]!.hp = 1000;
      const before = r.guards[0]!.hp;
      toRound(w);
      rs(w);
      return before - r.guards[0]!.hp;
    };
    const w = quietField();
    expect(probe('lancer', 'thorn')).toBe(Math.floor((t(w)['ship.lancer.damage']! * counterPct(w.tun, 'lancer', 'thorn')) / 100));
    expect(probe('lancer', 'spore')).toBe(Math.floor((t(w)['ship.lancer.damage']! * counterPct(w.tun, 'lancer', 'spore')) / 100));
    expect(probe('flak', 'spore')).toBe(Math.floor((t(w)['ship.flak.damage']! * counterPct(w.tun, 'flak', 'spore')) / 100));
    expect(probe('flak', 'thorn')).toBe(Math.floor((t(w)['ship.flak.damage']! * counterPct(w.tun, 'flak', 'thorn')) / 100));
    // The strong side really is the larger number at the defaults (8 against 1).
    expect(probe('lancer', 'thorn')).toBe(8);
    expect(probe('lancer', 'spore')).toBe(1);
  });

  it('raider damage hits warships (the type each pool counters first), then haulers, then extractors, in id order with overflow', () => {
    const w = quietField();
    const f = w.field!;
    f.mine[F.a5] = true;
    // Ships at a5: an extractor (lowest id), a hauler, a Lancer, a Flak, a Drone.
    const ext = addEcon(w, 'extractor', F.a5, F.a5);
    const hau = addEcon(w, 'hauler', F.a5, F.a5);
    addShips(w, F.a5, 1, 'lancer');
    addShips(w, F.a5, 1, 'flak');
    addShips(w, F.a5, 1, 'drone');
    syncExtractors(w);
    const [lancer, flak, drone] = w.ships;
    w.tun['guard.spore.damage'] = 0;
    // One Thorn: its pool strikes Flak (12 hp), then Drone (10), then Lancer (12), then the hauler (6), then the extractor (6).
    // Pool 12 + 10 + 12 + 6 + 2 = 42: warships and the hauler fall, the extractor keeps 4.
    w.tun['guard.thorn.damage'] = 42;
    const r = forceRaid(w, { thorn: 1, spore: 0 }, F.a5, 'fight');
    r.guards[0]!.hp = 1000;
    toRound(w);
    rs(w);
    expect(w.ships).toEqual([]);
    expect(f.econ.map((s) => s.id)).toEqual([ext.id]);
    expect(ext.hp).toBe(4);
    expect(hau.hp).toBeLessThanOrEqual(0);
    expect(r.lostShips).toEqual({ drone: 1, lancer: 1, flak: 1 });
    expect(r.lostEcon).toEqual({ extractor: 0, hauler: 1 });
    expect([lancer!.hp, flak!.hp, drone!.hp].every((h) => h <= 0)).toBe(true);
    expect(w.stats.shipsLost).toMatchObject({ drone: 1, lancer: 1, flak: 1 });
    expect(w.stats.econLost).toEqual({ extractor: 0, hauler: 1 });
  });

  it('a Spore pool strikes the Lancer first, then the Drone, then the Flak', () => {
    const w = quietField();
    w.field!.mine[F.a5] = true;
    addShips(w, F.a5, 1, 'flak');
    addShips(w, F.a5, 1, 'drone');
    addShips(w, F.a5, 1, 'lancer');
    w.tun['guard.thorn.damage'] = 0;
    w.tun['guard.spore.damage'] = 13; // 12 kills the Lancer, 1 into the Drone
    const r = forceRaid(w, { thorn: 0, spore: 1 }, F.a5, 'fight');
    r.guards[0]!.hp = 1000;
    toRound(w);
    rs(w);
    expect(w.ships.map((s) => s.type)).toEqual(['flak', 'drone']);
    expect(w.ships[1]!.hp).toBe(9);
    expect(r.lostShips).toEqual({ drone: 0, lancer: 1, flak: 0 });
  });

  it('both sides strike from the start-of-round state: a raider that dies this round still hits', () => {
    const w = quietField();
    w.field!.mine[F.a5] = true;
    addShips(w, F.a5, 3, 'drone');
    w.tun['ship.drone.damage'] = 20;
    w.tun['guard.spore.damage'] = 5;
    forceRaid(w, { thorn: 0, spore: 1 }, F.a5, 'fight');
    toRound(w);
    rs(w);
    expect(w.raid).toBeNull(); // beaten
    expect(w.ships.map((s) => s.hp)).toEqual([5, 10, 10]); // the dead Spore still struck once
  });

  it('warships that arrive mid-raid join from the next round', () => {
    const w = quietField();
    w.field!.mine[F.a5] = true;
    addEcon(w, 'hauler', F.a5, F.a5);
    w.tun['guard.spore.damage'] = 0;
    const r = forceRaid(w, { thorn: 0, spore: 1 }, F.a5, 'fight');
    r.guards[0]!.hp = 1000;
    toRound(w);
    rs(w); // round: no warship yet
    expect(r.guards[0]!.hp).toBe(1000);
    addShips(w, F.a5, 1, 'drone');
    rs(w, 5); // not a round tick
    expect(r.guards[0]!.hp).toBe(1000);
    toRound(w);
    rs(w);
    expect(r.guards[0]!.hp).toBe(1000 - w.tun['ship.drone.damage']!);
  });

  it('an undefended hit removes the dead docked extractors from the node count the same call (syncExtractors)', () => {
    const w = quietField();
    w.field!.mine[F.a5] = true;
    for (let i = 0; i < 3; i++) addEcon(w, 'extractor', F.a5, F.a5);
    syncExtractors(w);
    expect(w.nodes[F.a5]!.extractors).toBe(3);
    w.tun['guard.spore.damage'] = 6;
    forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'fight');
    toRound(w);
    rs(w);
    expect(w.field!.econ.length).toBe(1);
    expect(w.nodes[F.a5]!.extractors).toBe(1);
    expect(rockStatus(w, F.a5).docked).toBe(1);
    rs(w, 30);
    expect(w.nodes[F.a5]!.extractors).toBe(0);
  });

  it('free extractors cannot be killed', () => {
    const w = quietField();
    w.field!.mine[F.p1] = true;
    guardianAt(w, F.p1)!.alive = false;
    w.field!.free[F.p1] = 1;
    addEcon(w, 'hauler', F.p1, F.p1);
    syncExtractors(w);
    w.tun['guard.spore.damage'] = 30;
    forceRaid(w, { thorn: 0, spore: 3 }, F.p1, 'fight');
    toRound(w);
    rs(w, 61);
    expect(w.nodes[F.p1]!.extractors).toBe(1);
    expect(w.stats.econLost).toEqual({ extractor: 0, hauler: 1 });
  });
});

describe('R8: return and pacing', () => {
  it('beaten: every raider dies; counted, recorded in lastRaid, and the gap starts from the end', () => {
    const w = raidWorld(6);
    addShips(w, F.a5, 6, 'drone');
    rs(w);
    rsUntil(w, (x) => x.raid === null);
    const endTick = w.lastRaid!.endTick;
    expect(w.stats.raids).toEqual({ mustered: 1, beaten: 1, hit: 0, turnedBack: 0 });
    expect(w.lastRaid).toMatchObject({ id: 1, outcome: 'beaten', target: F.a5, killed: { thorn: 0, spore: 2 } });
    expect(w.nextRaidTick).toBe(endTick + 2700);
    // The hive lost the two raiders for good (they regrow like any killed guard).
    expect(hive(w).guards.length).toBe(34);
  });

  it('the gap counts from the end of the raid: no muster until nextRaidTick, a new one then', () => {
    const w = raidWorld(6);
    addShips(w, F.a5, 6, 'drone');
    rs(w);
    rsUntil(w, (x) => x.raid === null);
    const next = w.nextRaidTick;
    expect(next).toBe(w.lastRaid!.endTick + 2700);
    // Beaten raids left the economy intact: econ is still 6 and a5 is still mined.
    rsUntil(w, (x) => x.tick >= next - 1);
    expect(w.raid).toBeNull();
    expect(w.stats.raids.mustered).toBe(1);
    rs(w); // the call with tick = next - 1 ... then tick = next
    expect(w.raid).toBeNull();
    rs(w);
    expect(w.raid?.phase).toBe('muster');
    expect(w.stats.raids.mustered).toBe(2);
    // The gap counts from the end, not the start: a long raid pushes the next one back by as much.
    const long = raidWorld(6);
    long.tun['raid.musterTicks'] = 1000;
    addShips(long, F.a5, 6, 'drone');
    rs(long);
    rsUntil(long, (x) => x.raid === null, 3000);
    expect(long.nextRaidTick).toBe(long.lastRaid!.endTick + 2700);
    expect(long.lastRaid!.endTick).toBeGreaterThan(1000 + 143);
  });

  it('hit: it killed an economy ship, then left with no one to fight and came home', () => {
    const w = raidWorld(1); // a lone docked extractor
    w.tun['guard.spore.damage'] = 6;
    const r = forceRaid(w, { thorn: 0, spore: 1 }, F.a5, 'fight');
    toRound(w);
    rs(w); // the extractor dies
    expect(r.lostEcon).toEqual({ extractor: 1, hauler: 0 });
    expect(r.phase).toBe('fight');
    toRound(w);
    w.tick += 30;
    rs(w); // next round: nobody at the node: home
    expect(r.phase).toBe('home');
    rsUntil(w, (x) => x.raid === null);
    expect(w.stats.raids).toEqual({ mustered: 1, beaten: 0, hit: 1, turnedBack: 0 });
    expect(w.lastRaid).toMatchObject({ outcome: 'hit', lostEcon: { extractor: 1, hauler: 0 } });
    expect(w.nextRaidTick).toBe(w.lastRaid!.endTick + 2700);
  });

  it('turned back: it killed nothing and left (the node emptied before the round, or the target was lost)', () => {
    const w = raidWorld(1);
    forceRaid(w, { thorn: 0, spore: 1 }, F.a5, 'fight');
    w.field!.econ = [];
    syncExtractors(w);
    toRound(w);
    rs(w);
    rsUntil(w, (x) => x.raid === null);
    expect(w.stats.raids).toEqual({ mustered: 1, beaten: 0, hit: 0, turnedBack: 1 });
    expect(w.lastRaid).toMatchObject({ outcome: 'turnedBack', killed: { thorn: 0, spore: 0 } });
  });

  it('beaten wins over hit when the last raider dies in the round that killed a ship (R7: no raiders left is beaten)', () => {
    const w = quietField();
    w.field!.mine[F.a5] = true;
    addEcon(w, 'hauler', F.a5, F.a5);
    addShips(w, F.a5, 3, 'drone');
    w.tun['ship.drone.damage'] = 20;
    w.tun['guard.spore.damage'] = 30;
    forceRaid(w, { thorn: 0, spore: 1 }, F.a5, 'fight');
    toRound(w);
    rs(w);
    expect(w.stats.raids).toMatchObject({ beaten: 1, hit: 0 });
    expect(w.lastRaid!.lostEcon.hauler + w.lastRaid!.lostShips.drone).toBeGreaterThan(0);
  });

  it('returning raiders keep their ids and hp (no repair on the way), and rejoin the hive list in id order', () => {
    const w = raidWorld(1);
    const before = hive(w).guards.map((g) => g.id);
    const r = forceRaid(w, { thorn: 1, spore: 2 }, F.a5, 'fight');
    const ids = r.guards.map((g) => g.id);
    r.guards[0]!.hp = 7; // hurt
    const hp = r.guards.map((g) => g.hp);
    w.field!.econ = [];
    syncExtractors(w);
    toRound(w);
    rs(w);
    expect(r.phase).toBe('home');
    expect(hive(w).guards.length).toBe(33);
    rsUntil(w, (x) => x.raid === null);
    const h = hive(w);
    expect(h.guards.length).toBe(36);
    expect(h.guards.map((g) => g.id)).toEqual(before);
    for (let i = 0; i < ids.length; i++) expect(h.guards.find((g) => g.id === ids[i])!.hp).toBe(hp[i]);
  });

  it('the flight home takes ceil(distance / raid.speedSu), and the raiders are not in the hive list until they land', () => {
    const w = raidWorld(1);
    forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'fight');
    w.field!.econ = [];
    syncExtractors(w);
    toRound(w);
    rs(w);
    expect(hive(w).guards.length).toBe(34);
    const calls = rsUntil(w, (x) => x.raid === null);
    expect(calls).toBe(144);
    expect(hive(w).guards.length).toBe(36);
  });
});

describe('R9: hive regrowth with raiders out, and withering at capture', () => {
  const noRaids = (w: World): void => {
    w.tun['raid.enabled'] = 0;
  };

  it('raiders out count against the hive caps: only guards that died regrow, never the ones that are out', () => {
    const w = quietField();
    noRaids(w);
    econAtNode(w, F.a5, 2); // an extractor and a hauler waiting for a load keep the raid at the node
    const r = forceRaid(w, { thorn: 1, spore: 3 }, F.a5, 'fight');
    w.tun['guard.spore.damage'] = 0;
    w.tun['guard.thorn.damage'] = 0;
    const idBefore = w.nextId;
    run(w, 200);
    expect(hive(w).guards.length).toBe(32);
    expect(w.nextId).toBe(idBefore);
    expect(hive(w).regrowProgress).toEqual({ thorn: 0, spore: 0 });
    // One raider dies: exactly one guard (a Spore, after its period) regrows.
    r.guards.pop();
    const spores = hive(w).guards.filter((g) => g.type === 'spore').length;
    run(w, 25);
    expect(hive(w).guards.filter((g) => g.type === 'spore').length).toBe(spores + 1);
    run(w, 200);
    expect(hive(w).guards.length).toBe(33);
  });

  it('hive.regrowPct scales the hive regrow period (guard.<type>.regrowTicks x pct / 100), the pockets are unchanged', () => {
    const periods = (pct: number): { hive: number; pocket: number } => {
      const w = quietField();
      noRaids(w);
      w.tun['hive.regrowPct'] = pct;
      hive(w).guards.pop(); // one Spore short (the newest guard is a Spore)
      const p = guardianAt(w, F.p1)!;
      p.guards.pop();
      const hn = hive(w).guards.length;
      const pn = p.guards.length;
      let hiveT = -1;
      let pocketT = -1;
      for (let i = 1; i <= 3000; i++) {
        tick(w);
        if (hiveT < 0 && hive(w).guards.length > hn) hiveT = i;
        if (pocketT < 0 && p.guards.length > pn) pocketT = i;
        if (hiveT > 0 && pocketT > 0) break;
      }
      return { hive: hiveT, pocket: pocketT };
    };
    const spore = FD.tunables['guard.spore.regrowTicks'].default;
    expect(periods(100)).toEqual({ hive: spore, pocket: spore });
    expect(periods(250)).toEqual({ hive: spore * 2 + spore / 2, pocket: spore });
    expect(periods(1000)).toEqual({ hive: spore * 10, pocket: spore });
    // A non-divisible period floors: 20 x 130 / 100 = 26.
    expect(periods(130).hive).toBe(26);
  });

  it('hive capture with a raid out removes every raider, ends the raid and the raids (withered, not counted)', () => {
    const w = raidWorld(6);
    const r = forceRaid(w, { thorn: 2, spore: 4 }, F.a5, 'out');
    setGuards(w, F.heart, []); // the hive is empty: the raiders are all away
    addShips(w, F.heart, 1);
    expect(w.raid).toBe(r);
    tick(w);
    expect(w.capturedTick).toBe(0);
    expect(w.raid).toBeNull();
    expect(hive(w).alive).toBe(false);
    expect(hive(w).guards).toEqual([]);
    expect(w.lastRaid).toMatchObject({ outcome: 'withered', target: F.a5 });
    expect(w.stats.raids).toEqual({ mustered: 1, beaten: 0, hit: 0, turnedBack: 0 });
    // No raid musters afterwards, however long and however big the economy.
    run(w, 4000);
    expect(w.raid).toBeNull();
    expect(w.stats.raids.mustered).toBe(1);
  });

  it('hive capture during a muster ends that raid too (and a raid in any phase)', () => {
    for (const phase of ['out', 'fight', 'home'] as const) {
      const w = raidWorld(6);
      forceRaid(w, { thorn: 0, spore: 3 }, F.a5, phase);
      setGuards(w, F.heart, []);
      addShips(w, F.heart, 1);
      tick(w);
      expect(w.raid, phase).toBeNull();
      expect(w.lastRaid!.outcome, phase).toBe('withered');
    }
    const w = raidWorld(6);
    rs(w);
    expect(w.raid!.phase).toBe('muster');
    setGuards(w, F.heart, []);
    addShips(w, F.heart, 1);
    tick(w);
    expect(w.raid).toBeNull();
  });
});

describe('raidStatus and rockStatus.raidRank at each phase', () => {
  it('none: zeros, the threshold, and no gap before the first raid', () => {
    const w = raidWorld(4);
    expect(raidStatus(w)).toEqual({
      enabled: true,
      phase: 'none',
      planned: { thorn: 0, spore: 0 },
      raiders: { thorn: 0, spore: 0 },
      target: null,
      ticksToLaunch: 0,
      ticksToArrival: 0,
      econ: 4,
      nextRaidAtEcon: 6,
      ticksToNextAllowed: 0,
      last: null,
    });
    w.tun['raid.enabled'] = 0;
    expect(raidStatus(w).enabled).toBe(false);
  });

  it('muster: planned by type, the target, the countdown; the raiders are still in the hive', () => {
    const w = raidWorld(12);
    rs(w);
    rs(w, 9);
    expect(raidStatus(w)).toMatchObject({
      phase: 'muster',
      planned: { thorn: 1, spore: 3 },
      raiders: { thorn: 0, spore: 0 },
      target: F.a5,
      ticksToLaunch: 440,
      ticksToArrival: 0,
      econ: 12,
    });
    expect(rockStatus(w, F.a5).raidRank).toBe(1);
  });

  it('out: the raiders by type and the ticks to arrival', () => {
    const w = raidWorld(12);
    rs(w);
    rsUntil(w, (x) => x.raid!.phase === 'out');
    rs(w, 4);
    expect(raidStatus(w)).toMatchObject({
      phase: 'out',
      planned: { thorn: 1, spore: 3 },
      raiders: { thorn: 1, spore: 3 },
      target: F.a5,
      ticksToLaunch: 0,
      ticksToArrival: 144 - 4,
    });
  });

  it('fight: at the target with raiders left, no timers', () => {
    const w = raidWorld(12);
    rs(w);
    rsUntil(w, (x) => x.raid!.phase === 'fight');
    expect(raidStatus(w)).toMatchObject({ phase: 'fight', raiders: { thorn: 1, spore: 3 }, ticksToLaunch: 0, ticksToArrival: 0, target: F.a5 });
  });

  it('home: ticks to the hive; then last and the gap after the raid ends', () => {
    const w = raidWorld(1);
    forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'fight');
    w.field!.econ = [];
    syncExtractors(w);
    toRound(w);
    rs(w);
    expect(raidStatus(w)).toMatchObject({ phase: 'home', raiders: { thorn: 0, spore: 2 }, ticksToArrival: 144, target: F.a5 });
    rsUntil(w, (x) => x.raid === null);
    const s = raidStatus(w);
    expect(s.phase).toBe('none');
    expect(s.ticksToNextAllowed).toBe(2700 - 1);
    expect(s.last).toMatchObject({ outcome: 'turnedBack', target: F.a5, lostEcon: { extractor: 0, hauler: 0 }, killed: { thorn: 0, spore: 0 } });
  });

  it('raidRank: 1 for the R5 target, then by distance to the hive among the raidable rocks, 0 for others; the threshold follows raid.firstAtEcon', () => {
    const w = quietField();
    expect(raidStatus(w).nextRaidAtEcon).toBe(6);
    w.tun['raid.firstAtEcon'] = 9;
    expect(raidStatus(w).nextRaidAtEcon).toBe(9);
    econAtNode(w, F.a6, 1);
    econAtNode(w, F.a1, 1);
    econAtNode(w, F.a7, 1);
    expect([F.a5, F.a6, F.a7, F.a1, F.a2].map((n) => rockStatus(w, n).raidRank)).toEqual([0, 1, 2, 3, 0]);
    w.field!.mine[F.a5] = true; // marked, but nothing there yet: not raidable
    expect(rockStatus(w, F.a5).raidRank).toBe(0);
    addEcon(w, 'hauler', F.probe, F.a5);
    expect(rockStatus(w, F.a5).raidRank).toBe(1);
    expect(rockStatus(w, F.a6).raidRank).toBe(2);
  });
});

describe('pacing: no time pressure (acceptance 3)', () => {
  /** Six economy ships at a5 with six drones to beat the first raid, then run `minutes` game minutes. */
  function afterFirstRaid(keepEcon: number): World {
    const w = raidWorld(6);
    addShips(w, F.a5, 6, 'drone');
    let guard = 0;
    while (w.stats.raids.beaten < 1) {
      tick(w);
      if (++guard > 3000) throw new Error('the first raid never ended');
    }
    expect(w.stats.raids).toEqual({ mustered: 1, beaten: 1, hit: 0, turnedBack: 0 });
    while (w.field!.econ.length > keepEcon) w.field!.econ.pop();
    syncExtractors(w);
    return w;
  }

  it('60 game minutes with econ held below raid.firstAtEcon after one raid: no further raid', () => {
    const w = afterFirstRaid(5);
    expect(w.tickRate * 60).toBe(1800);
    const start = w.tick;
    for (let i = 0; i < 60 * 1800; i++) tick(w);
    expect(w.tick - start).toBe(108000);
    expect(w.field!.econ.length).toBe(5);
    expect(w.stats.raids.mustered).toBe(1);
    expect(w.raid).toBeNull();
  });

  it('...and the same world with econ held at the threshold is raided again after the gap (so the test above can fail)', () => {
    const w = afterFirstRaid(6);
    const next = w.nextRaidTick;
    while (w.tick < next - 1) tick(w);
    expect(w.stats.raids.mustered).toBe(1);
    tick(w);
    tick(w);
    expect(w.stats.raids.mustered).toBe(2);
  });
});

describe('save: a raid in progress and the last result survive a round trip', () => {
  it('round-trips world.raid and world.lastRaid, and rejects a malformed lastRaid', () => {
    const w = raidWorld(6);
    addShips(w, F.a5, 6, 'drone');
    rs(w);
    rsUntil(w, (x) => x.raid!.phase === 'out');
    const load = (x: World) => deserializeWorld(serializeWorld(x), FD);
    const mid = load(w);
    expect(mid.ok).toBe(true);
    if (mid.ok) expect(mid.world.raid).toEqual(w.raid);
    rsUntil(w, (x) => x.raid === null);
    expect(w.lastRaid).not.toBeNull();
    const done = load(w);
    expect(done.ok).toBe(true);
    if (done.ok) expect(done.world.lastRaid).toEqual(w.lastRaid);
    const bad = JSON.parse(serializeWorld(w)) as { world: Record<string, unknown> };
    bad.world.lastRaid = 5;
    expect(deserializeWorld(JSON.stringify(bad), FD).ok).toBe(false);
  });
});
