import { describe, expect, it, vi } from 'vitest';
import { GUARD_TARGET_ORDER, createWorld, guardStrike, guardianAt, step, type EconShip, type Ship, type World } from '../src/index.ts';
import { fixtureData } from './fixture.ts';
import { addShips, setGuards } from './helpers.ts';
import { F, FD, addEcon, quietField, tick } from './field-helpers.ts';

/**
 * h7-sim acceptance 5: `step` calls the faction AI's raid hook at F8, after movement (F7) and before combat at
 * guarded nodes (F10), once per field-mode tick; and the guard damage F10 uses is exported for the raid fight.
 * The hook is a no-op in h7-sim; here it is replaced by a recorder that reads the world when it is called.
 */

interface Call {
  tick: number;
  /** The drone sent at p1 has arrived (movement ran). */
  arrived: boolean;
  /** No battle at p1 yet (combat hasn't run). */
  noBattle: boolean;
  /** The hauler loaded this tick (F6 ran). */
  loaded: boolean;
}
const calls: Call[] = [];
let probe: { drone: Ship | null; hauler: EconShip | null } = { drone: null, hauler: null };

vi.mock('../src/factions/index.ts', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../src/factions/index.ts')>();
  return {
    ...orig,
    raidStep: (world: World): void => {
      const g = world.guardians.find((x) => world.nodes[x.node]!.id === 'p1');
      calls.push({
        tick: world.tick,
        arrived: probe.drone !== null && probe.drone.at === F.p1,
        noBattle: g !== undefined && g.battle === null,
        loaded: probe.hauler !== null && probe.hauler.cargo > 0,
      });
    },
  };
});

describe('F8: the raid hook', () => {
  it('runs once per field tick, after movement and haulers, before combat at guarded nodes', () => {
    const w = quietField();
    // A drone one tick from p1, arriving on a round tick (tick 0): movement parks it, then combat starts the battle.
    addShips(w, F.p1, 1);
    const drone = w.ships[0]!;
    drone.at = null;
    drone.transit = { from: 0, to: F.p1, ticksLeft: 1, totalTicks: 90 };
    w.field!.mine[F.a1] = true;
    addEcon(w, 'extractor', F.a1, F.a1);
    const hauler = addEcon(w, 'hauler', F.a1, F.a1);
    w.nodes[F.a1]!.buffer = 4;
    probe = { drone, hauler };
    calls.length = 0;
    expect(w.tick % w.tun['combat.roundTicks']).toBe(0);
    tick(w);
    expect(calls).toEqual([{ tick: 0, arrived: true, noBattle: true, loaded: true }]);
    // After the tick, combat has run: the battle at p1 started.
    expect(guardianAt(w, F.p1)!.battle).not.toBeNull();
    tick(w);
    tick(w);
    expect(calls.map((c) => c.tick)).toEqual([0, 1, 2]);
  });

  it('never runs in a campaign world', () => {
    calls.length = 0;
    const w = createWorld(1, fixtureData);
    step(w, fixtureData, [{ type: 'enterArea', area: 0 }]);
    for (let i = 0; i < 5; i++) step(w, fixtureData, []);
    expect(w.campaign.active).not.toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('guardStrike: the guard damage F10 uses, exported for the raid fight (R7)', () => {
  const ship = (id: number, type: Ship['type'], hp: number): Ship => ({ id, type, hp, at: 1, transit: null, engagedIn: -1 });
  const econ = (id: number, type: EconShip['type'], hp: number): EconShip => ({ id, type, hp, at: 1, transit: null, target: 1, cargo: 0, cargoRes: null });

  it('each pool strikes the warships in GUARD_TARGET_ORDER first, then haulers, then extractors, in id order with overflow', () => {
    expect(GUARD_TARGET_ORDER.thorn).toEqual(['flak', 'drone', 'lancer']);
    const war = [ship(1, 'drone', 10), ship(2, 'flak', 12)];
    // The extractor has the lower id, but haulers come first.
    const eco = [econ(3, 'extractor', 6), econ(4, 'hauler', 6), econ(5, 'hauler', 6)];
    const kills = guardStrike({ thorn: 40, spore: 3 }, war, eco);
    // Thorns: flak 12, drone 10, hauler 4 6, hauler 5 6, extractor 3 takes the last 6. Spores: nothing left alive.
    expect(kills.ships.map((s) => s.id)).toEqual([2, 1]);
    expect(kills.econ.map((s) => s.id)).toEqual([4, 5, 3]);
    expect([...war, ...eco].map((s) => s.hp)).toEqual([0, 0, 0, 0, 0]);
  });

  it('pools that run out leave the economy ships untouched; with no economy list it is exactly F10\'s strike', () => {
    const war = [ship(1, 'lancer', 12), ship(2, 'drone', 10)];
    const eco = [econ(3, 'hauler', 6)];
    const kills = guardStrike({ thorn: 5, spore: 13 }, war, eco);
    // Thorns: no flak, drone 10 → 5. Spores: lancer 12 → dead, drone 5 → 4.
    expect(kills.ships.map((s) => s.id)).toEqual([1]);
    expect([war[0]!.hp, war[1]!.hp, eco[0]!.hp]).toEqual([0, 4, 6]);
    const w2 = [ship(1, 'lancer', 12), ship(2, 'drone', 10)];
    expect(guardStrike({ thorn: 5, spore: 13 }, w2).econ).toEqual([]);
    expect(w2.map((s) => s.hp)).toEqual([0, 4]);
  });

  it('F10 strikes warships only: even an economy ship placed at a guarded node (never possible in play) is not hit', () => {
    const w = quietField();
    setGuards(w, F.p2, [['thorn', 20]]);
    addShips(w, F.p2, 1);
    const x = addEcon(w, 'hauler', F.p2, F.p2);
    // Pin it there: with a working extractor and an empty buffer, F6 keeps it waiting at its node.
    w.field!.free[F.p2] = 1;
    tick(w);
    expect(x.at).toBe(F.p2);
    expect(w.ships[0]!.hp).toBe(w.tun['ship.drone.hp'] - w.tun['guard.thorn.damage']);
    expect(x.hp).toBe(FD.tunables['ship.hauler.hp'].default);
  });
});
