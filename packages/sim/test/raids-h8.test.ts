import { describe, expect, it } from 'vitest';
import {
  PROBE,
  guardianAt,
  haulersHeld,
  nodeDistance,
  raidStatus,
  raidTarget,
  rockStatus,
  type EconShip,
  type Guard,
  type GuardCounts,
  type Raid,
  type World,
} from '../src/index.ts';
import { raidStep, raidWither } from '../src/factions/index.ts';
import { syncExtractors } from '../src/field.ts';
import { startTransit } from '../src/ships.ts';
import { F, FD, addEcon, quietField, tick } from './field-helpers.ts';
import { addShips } from './helpers.ts';

/**
 * h8-raids acceptance 1-3: H9 (the shield, `raid.shieldEcon`) and H10 (haulers hold, `raid.haulersHold`), DESIGN.md
 * H8. The v12 fixture carries both keys at 0 (H7's raids), so every raid test in raids.test.ts is also the "H7
 * exactly" check; here each test sets the key it is about to 1 (or leaves it 0 for the off case).
 *
 * The shield tests call the raid hook directly (`rs`) on a hand-built world, like raids.test.ts. The hold tests step
 * the whole world (`tick`), because the haulers move in F6, and rocks produce nothing (`extractor.orePerMin` 0) so
 * the buffer is whatever the test puts there.
 */

const hive = (w: World) => guardianAt(w, F.heart)!;

/** Runs the raid hook `n` times, advancing the tick as `step` does. */
function rs(w: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    raidStep(w, FD);
    w.tick += 1;
  }
}

/** Steps the whole world `n` ticks. */
function steps(w: World, n: number): void {
  for (let i = 0; i < n; i++) tick(w);
}

/** A tick on a round boundary (the fight happens on round ticks). */
function toRound(w: World): void {
  const r = w.tun['combat.roundTicks'];
  while (w.tick % r !== 0) w.tick += 1;
}

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
  const flying = phase === 'out' || phase === 'home';
  const raid: Raid = {
    id: 1,
    phase,
    target,
    guards: taken,
    ticksLeft: flying ? flight : phase === 'muster' ? 450 : 0,
    planned: { ...c },
    flightTicks: flying ? flight : 0,
    from: phase === 'out' ? F.heart : target,
    retargeted: false,
    rolls: 0,
    hitRocks: [],
    lostEcon: { extractor: 0, hauler: 0 },
    lostShips: { drone: 0, lancer: 0, flak: 0 },
    killed: { thorn: 0, spore: 0 },
  };
  w.raid = raid;
  w.stats.raids.mustered += 1;
  return raid;
}

/** A quiet field where `node` is mined by one docked extractor, with the shield and hold keys as given. */
function world(shield: 0 | 1, hold: 0 | 1, node: number = F.a5): World {
  const w = quietField();
  w.tun['raid.shieldEcon'] = shield;
  w.tun['raid.haulersHold'] = hold;
  w.tun['extractor.orePerMin'] = 0;
  w.field!.mine[node] = true;
  addEcon(w, 'extractor', node, node);
  syncExtractors(w);
  return w;
}

describe('H9: the shield', () => {
  /**
   * a5: an extractor (id lowest), a hauler, and one Drone (10 hp) at the node. One Spore with a 30-damage pool: 10 kills
   * the Drone, 20 are left over. Under H7 the overflow goes to the hauler (6 hp) and then the extractor (6 hp).
   */
  function shieldFight(shield: 0 | 1): { w: World; r: Raid; ext: EconShip; hau: EconShip } {
    const w = world(shield, 0);
    const ext = w.field!.econ[0]!;
    const hau = addEcon(w, 'hauler', F.a5, F.a5);
    addShips(w, F.a5, 1, 'drone');
    w.tun['guard.spore.damage'] = 30;
    w.tun['guard.thorn.damage'] = 0;
    const r = forceRaid(w, { thorn: 0, spore: 1 }, F.a5, 'fight');
    r.guards[0]!.hp = 1000;
    return { w, r, ext, hau };
  }

  it('a round that starts with one warship at the target strikes warships only, and its overflow is lost', () => {
    const { w, r, ext, hau } = shieldFight(1);
    toRound(w);
    rs(w);
    expect(w.ships).toEqual([]);
    expect(r.lostShips).toEqual({ drone: 1, lancer: 0, flak: 0 });
    expect(r.lostEcon).toEqual({ extractor: 0, hauler: 0 });
    expect(w.stats.econLost).toEqual({ extractor: 0, hauler: 0 });
    expect(w.field!.econ.map((s) => s.id)).toEqual([ext.id, hau.id]);
    expect([ext.hp, hau.hp]).toEqual([w.tun['ship.extractor.hp'], w.tun['ship.hauler.hp']]);
    expect(w.nodes[F.a5]!.extractors).toBe(1);
  });

  it('the next round, after that warship fell, strikes haulers and then extractors', () => {
    const { w, r, ext, hau } = shieldFight(1);
    toRound(w);
    rs(w);
    toRound(w);
    // Pool 30: the hauler (6 hp) first, then the extractor (6 hp), 18 left over.
    rs(w);
    expect(r.lostEcon).toEqual({ extractor: 1, hauler: 1 });
    expect(w.field!.econ).toEqual([]);
    expect([ext.hp, hau.hp].every((h) => h <= 0)).toBe(true);
    expect(w.nodes[F.a5]!.extractors).toBe(0);
    expect(w.stats.econLost).toEqual({ extractor: 1, hauler: 1 });
  });

  it('a warship that arrives mid-round counts from the next round (not from the one under way)', () => {
    const w = world(1, 0);
    const hau = addEcon(w, 'hauler', F.a5, F.a5);
    w.tun['guard.spore.damage'] = 6;
    w.tun['guard.thorn.damage'] = 0;
    const r = forceRaid(w, { thorn: 0, spore: 1 }, F.a5, 'fight');
    r.guards[0]!.hp = 1000;
    toRound(w);
    rs(w); // a round with no warship there: the hauler (6 hp) dies, the overflow is none
    expect(r.lostEcon).toEqual({ extractor: 0, hauler: 1 });
    expect(hau.hp).toBeLessThanOrEqual(0);
    // The warship arrives between rounds: the extractor is not struck in the next round.
    addShips(w, F.a5, 1, 'flak');
    rs(w, 5);
    expect(w.ships.length).toBe(1);
    toRound(w);
    w.tun['guard.spore.damage'] = 4; // the Flak (12 hp) takes it, the extractor none
    rs(w);
    expect(r.lostEcon).toEqual({ extractor: 0, hauler: 1 });
    expect(w.ships[0]!.hp).toBe(8);
    expect(w.field!.econ.length).toBe(1);
  });

  it('a warship that arrives after a round started does not shield that round: a round with none at its start strikes economy ships', () => {
    const w = world(1, 0);
    w.tun['guard.spore.damage'] = 6;
    w.tun['guard.thorn.damage'] = 0;
    const r = forceRaid(w, { thorn: 0, spore: 1 }, F.a5, 'fight');
    r.guards[0]!.hp = 1000;
    toRound(w);
    w.tick += 1; // the tick after the round boundary: a warship lands now, too late for the round
    addShips(w, F.a5, 1, 'drone');
    rs(w); // not a round tick: nothing is struck
    expect(r.lostEcon).toEqual({ extractor: 0, hauler: 0 });
    expect(w.ships[0]!.hp).toBe(w.tun['ship.drone.hp']);
  });

  it('a warship at another node does not shield the target', () => {
    const w = world(1, 0);
    addShips(w, F.a3, 1, 'drone');
    w.tun['guard.spore.damage'] = 6;
    w.tun['guard.thorn.damage'] = 0;
    const r = forceRaid(w, { thorn: 0, spore: 1 }, F.a5, 'fight');
    r.guards[0]!.hp = 1000;
    toRound(w);
    rs(w);
    expect(r.lostEcon).toEqual({ extractor: 1, hauler: 0 });
    expect(w.ships.length).toBe(1);
  });

  it('both pools lose their overflow: a Thorn and a Spore with huge pools kill the warship and nothing else', () => {
    const w = world(1, 0);
    addEcon(w, 'hauler', F.a5, F.a5);
    addShips(w, F.a5, 1, 'lancer');
    w.tun['guard.spore.damage'] = 50;
    w.tun['guard.thorn.damage'] = 50;
    const r = forceRaid(w, { thorn: 1, spore: 1 }, F.a5, 'fight');
    for (const g of r.guards) g.hp = 1000;
    toRound(w);
    rs(w);
    expect(r.lostShips.lancer).toBe(1);
    expect(r.lostEcon).toEqual({ extractor: 0, hauler: 0 });
    expect(w.field!.econ.length).toBe(2);
  });

  it('a warship that stands through the round keeps the economy safe every round', () => {
    const w = world(1, 0);
    addEcon(w, 'hauler', F.a5, F.a5);
    addShips(w, F.a5, 3, 'drone');
    w.tun['guard.spore.damage'] = 6;
    w.tun['guard.thorn.damage'] = 0;
    w.tun['ship.drone.damage'] = 0;
    const r = forceRaid(w, { thorn: 0, spore: 1 }, F.a5, 'fight');
    r.guards[0]!.hp = 1000;
    for (let i = 0; i < 3; i++) {
      toRound(w);
      rs(w);
      w.tick += 29;
    }
    expect(r.lostEcon).toEqual({ extractor: 0, hauler: 0 });
    expect(r.lostShips.drone).toBe(1); // 6 + 6 + 6 damage into 10-hp Drones: the first falls in round 2, and the overflow is lost
  });

  it('raid.shieldEcon 0 is H7 R7: the same fight sends the overflow to the hauler, then the extractor', () => {
    const { w, r } = shieldFight(0);
    toRound(w);
    rs(w);
    expect(w.ships).toEqual([]);
    expect(r.lostShips.drone).toBe(1);
    expect(r.lostEcon).toEqual({ extractor: 1, hauler: 1 });
    expect(w.field!.econ).toEqual([]);
  });
});

describe('H10: haulers hold', () => {
  /** a5 mined by a docked extractor, with its buffer at `buffer` (below the hauler's cargo), a hauler `at` and assigned to it. */
  function holdWorld(hold: 0 | 1, buffer: number): { w: World; h: EconShip } {
    const w = world(0, hold);
    w.nodes[F.a5]!.buffer = buffer;
    const h = addEcon(w, 'hauler', PROBE, F.a5);
    return { w, h };
  }

  it('at the probe, the hauler stays and keeps its assignment while the raid is out and fighting', () => {
    const { w, h } = holdWorld(1, 3);
    const r = forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'out');
    for (const phase of ['out', 'fight'] as const) {
      r.phase = phase;
      steps(w, 3);
      expect(h.at).toBe(PROBE);
      expect(h.transit).toBeNull();
      expect(h.target).toBe(F.a5);
      expect(w.raid).toBe(r);
    }
    expect(rockStatus(w, F.a5).haulers).toBe(1);
  });

  it('with raid.haulersHold 0 the same hauler flies out into the raid (H7)', () => {
    const { w, h } = holdWorld(0, 3);
    forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'out');
    steps(w, 1);
    expect(h.transit).toMatchObject({ from: PROBE, to: F.a5 });
  });

  it('before the launch (muster) a hauler at the probe goes: the hold does not apply during the muster', () => {
    const { w, h } = holdWorld(1, 3);
    forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'muster');
    expect(haulersHeld(w, F.a5)).toBe(false);
    steps(w, 1);
    expect(h.transit).toMatchObject({ from: PROBE, to: F.a5 });
  });

  it('at the node, the hauler loads what is there and leaves at once, without waiting for a full cargo', () => {
    const { w, h } = holdWorld(1, 3);
    h.at = F.a5;
    forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'out');
    const cap = w.tun['ship.hauler.cargo'];
    expect(w.nodes[F.a5]!.buffer).toBeLessThan(cap);
    steps(w, 1);
    expect(h.cargo).toBe(3);
    expect(h.cargoRes).toBe(w.nodes[F.a5]!.prize);
    expect(w.nodes[F.a5]!.buffer).toBe(0);
    expect(h.transit).toMatchObject({ from: F.a5, to: PROBE });
    expect(h.target).toBe(F.a5);
  });

  it('with an empty buffer the hauler at the node leaves empty (min(buffer, cargo) is 0)', () => {
    const { w, h } = holdWorld(1, 0);
    h.at = F.a5;
    forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'fight');
    steps(w, 1);
    expect(h.cargo).toBe(0);
    expect(h.cargoRes).toBeNull();
    expect(h.transit).toMatchObject({ from: F.a5, to: PROBE });
  });

  it('control: without a raid (and with raid.haulersHold 0 during one) the same hauler waits at the node for a full cargo', () => {
    const idle = holdWorld(1, 3);
    idle.h.at = F.a5;
    steps(idle.w, 3);
    expect(idle.h.at).toBe(F.a5);
    expect(idle.h.transit).toBeNull();
    const off = holdWorld(0, 3);
    off.h.at = F.a5;
    forceRaid(off.w, { thorn: 0, spore: 2 }, F.a5, 'fight');
    steps(off.w, 3);
    expect(off.h.at).toBe(F.a5);
    expect(off.h.cargo).toBe(0);
  });

  it('flying out when the raid launches, the hauler finishes its leg, then loads and leaves', () => {
    const { w, h } = holdWorld(1, 3);
    h.at = PROBE;
    startTransit(w, h, F.a5, w.tun['ship.hauler.speedSu']);
    forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'out');
    const left = h.transit!.ticksLeft;
    steps(w, left - 1);
    expect(h.transit).not.toBeNull(); // still flying: held haulers don't turn back
    expect(h.transit!.to).toBe(F.a5);
    steps(w, 1);
    expect(h.at).toBe(F.a5); // arrived (F7)
    expect(h.cargo).toBe(0);
    steps(w, 1);
    expect(h.cargo).toBe(3); // loaded what was there and left in its next F6
    expect(h.transit).toMatchObject({ from: F.a5, to: PROBE });
  });

  it('the hold ends on the tick the outcome is decided: beaten and withered (the raid ends), hit and turned back (the raiders leave the target, still flying home)', () => {
    const cases: Array<[string, (w: World) => void]> = [
      [
        'turnedBack',
        (w) => {
          // Nothing of the player's is left at a5 when the round comes: the raiders leave for home with no kill.
          w.field!.econ = w.field!.econ.filter((s) => s.type === 'hauler');
          syncExtractors(w);
          forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'fight');
        },
      ],
      [
        'hit',
        (w) => {
          w.field!.econ = w.field!.econ.filter((s) => s.type === 'hauler');
          syncExtractors(w);
          forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'fight').lostEcon.extractor = 1;
        },
      ],
      [
        'beaten',
        (w) => {
          addShips(w, F.a5, 2, 'drone');
          w.tun['ship.drone.damage'] = 20;
          w.tun['guard.spore.damage'] = 0;
          forceRaid(w, { thorn: 0, spore: 1 }, F.a5, 'fight');
        },
      ],
      ['withered', (w) => forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'out')],
    ];
    for (const [outcome, setup] of cases) {
      const { w, h } = holdWorld(1, 3);
      setup(w);
      const leaving = outcome === 'turnedBack' || outcome === 'hit';
      if (outcome === 'withered') {
        steps(w, 1);
        expect(haulersHeld(w, F.a5)).toBe(true);
        raidWither(w);
      } else {
        // Held until the round that decides the outcome, then not: stepped one tick at a time.
        let n = 0;
        while (haulersHeld(w, F.a5)) {
          expect(n++, outcome).toBeLessThan(60);
          steps(w, 1);
        }
      }
      expect(haulersHeld(w, F.a5), outcome).toBe(false);
      if (leaving) {
        expect(w.raid?.phase, outcome).toBe('home'); // the raiders are still flying: the hold did not wait for them
        expect(w.lastRaid, outcome).toBeNull();
      } else {
        expect(w.raid, outcome).toBeNull();
        if (outcome === 'beaten') expect(w.lastRaid?.outcome).toBe('beaten');
      }
      if (!leaving) {
        steps(w, 1);
        expect(h.transit, outcome).toMatchObject({ from: PROBE, to: F.a5 });
      }
    }
  });

  it('flying home, the raiders no longer hold anything: a hauler at the probe leaves for the target the tick after the raid turns for home', () => {
    const { w, h } = holdWorld(1, 3);
    const r = forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'fight');
    r.phase = 'home';
    r.ticksLeft = 50;
    expect(haulersHeld(w, F.a5)).toBe(false);
    expect(rockStatus(w, F.a5)).toMatchObject({ raidTarget: true, haulersHeld: false });
    expect(raidStatus(w).holding).toBe(0);
    steps(w, 1);
    expect(h.transit).toMatchObject({ from: PROBE, to: F.a5 });
    expect(w.raid).toBe(r);
  });

  it('the target stays mined: its extractor stays docked, its haulers stay assigned, and the raid target is unchanged during the hold', () => {
    const { w } = holdWorld(1, 3);
    forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'out');
    steps(w, 10);
    expect(raidTarget(w)).toBe(F.a5);
    expect(w.raid!.target).toBe(F.a5);
    expect(rockStatus(w, F.a5)).toMatchObject({ docked: 1, haulers: 1, raidRank: 1, mine: true });
  });

  it('R6 is unchanged: the raid retargets once when its target was stopped, and the hold follows the new target', () => {
    const { w, h } = holdWorld(1, 3);
    w.field!.mine[F.a3] = true;
    addEcon(w, 'extractor', F.a3, F.a3);
    syncExtractors(w);
    const r = forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'out');
    r.ticksLeft = 2;
    w.field!.mine[F.a5] = false;
    steps(w, 2);
    expect(r.retargeted).toBe(true);
    expect(r.target).toBe(F.a3);
    expect(r.phase).toBe('out');
    expect(haulersHeld(w, F.a3)).toBe(true);
    expect(haulersHeld(w, F.a5)).toBe(false);
    const h3 = addEcon(w, 'hauler', PROBE, F.a3);
    steps(w, 2);
    expect(h3.at).toBe(PROBE); // held for the new target
    expect(h3.transit).toBeNull();
    expect(h3.target).toBe(F.a3);
    expect(h.transit).toMatchObject({ to: F.a3 }); // a5 is unmarked: its hauler reassigned to a3 before the retarget (a3 was not held then) and finishes its leg
  });

  it('a held hauler is not struck: it left the node before the round, and flying home it is in transit', () => {
    const w = world(1, 1);
    const ext = w.field!.econ[0]!;
    const h = addEcon(w, 'hauler', F.a5, F.a5);
    w.nodes[F.a5]!.buffer = 3;
    w.tun['guard.spore.damage'] = 30;
    const r = forceRaid(w, { thorn: 0, spore: 1 }, F.a5, 'fight');
    r.guards[0]!.hp = 1000;
    toRound(w);
    w.tick += 1;
    steps(w, 1); // F6 loads and sends the hauler off (the world's tick was moved past the round boundary)
    expect(h.transit).toMatchObject({ to: PROBE });
    w.tick += w.tun['combat.roundTicks'] - (w.tick % w.tun['combat.roundTicks']);
    steps(w, 1);
    expect(r.lostEcon.hauler).toBe(0);
    expect(r.lostEcon.extractor).toBe(1);
    expect(ext.hp).toBeLessThanOrEqual(0);
    expect(h.hp).toBeGreaterThan(0);
  });
});

describe('rockStatus.raidTarget, rockStatus.haulersHeld and raidStatus.holding at each phase', () => {
  it('none: nothing is the target, nothing is held, holding is 0', () => {
    const w = world(1, 1);
    addEcon(w, 'hauler', PROBE, F.a5);
    expect(rockStatus(w, F.a5)).toMatchObject({ raidTarget: false, haulersHeld: false });
    expect(raidStatus(w).holding).toBe(0);
  });

  it('muster: the target is flagged from the muster on, but nothing is held yet', () => {
    const w = world(1, 1);
    addEcon(w, 'hauler', PROBE, F.a5);
    forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'muster');
    expect(rockStatus(w, F.a5)).toMatchObject({ raidTarget: true, haulersHeld: false });
    expect(rockStatus(w, F.a3)).toMatchObject({ raidTarget: false, haulersHeld: false });
    expect(raidStatus(w).holding).toBe(0);
  });

  it('out and fight: flagged and held; home: flagged only; holding counts the haulers waiting at the probe for the target (not others, not those flying)', () => {
    const w = world(1, 1);
    addEcon(w, 'hauler', PROBE, F.a5);
    addEcon(w, 'hauler', PROBE, F.a5);
    addEcon(w, 'hauler', PROBE, null); // idle, no target: not held
    const flying = addEcon(w, 'hauler', PROBE, F.a5);
    startTransit(w, flying, F.a5, w.tun['ship.hauler.speedSu']);
    const r = forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'out');
    for (const phase of ['out', 'fight'] as const) {
      r.phase = phase;
      expect(rockStatus(w, F.a5), phase).toMatchObject({ raidTarget: true, haulersHeld: true });
      expect(rockStatus(w, F.a3), phase).toMatchObject({ raidTarget: false, haulersHeld: false });
      expect(raidStatus(w).holding, phase).toBe(2);
    }
    r.phase = 'home';
    expect(rockStatus(w, F.a5)).toMatchObject({ raidTarget: true, haulersHeld: false });
    expect(raidStatus(w).holding).toBe(0);
  });

  it('after the raid ends: all false and holding 0; with raid.haulersHold 0: flagged but never held', () => {
    const w = world(1, 1);
    addEcon(w, 'hauler', PROBE, F.a5);
    forceRaid(w, { thorn: 0, spore: 2 }, F.a5, 'fight');
    w.raid = null;
    expect(rockStatus(w, F.a5)).toMatchObject({ raidTarget: false, haulersHeld: false });
    expect(raidStatus(w).holding).toBe(0);
    const off = world(1, 0);
    addEcon(off, 'hauler', PROBE, F.a5);
    forceRaid(off, { thorn: 0, spore: 2 }, F.a5, 'out');
    expect(rockStatus(off, F.a5)).toMatchObject({ raidTarget: true, haulersHeld: false });
    expect(raidStatus(off).holding).toBe(0);
  });
});
