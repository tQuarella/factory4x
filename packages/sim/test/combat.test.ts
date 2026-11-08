import { describe, expect, it } from 'vitest';
import { counterPct, step, type GuardType, type ShipType, type World } from '../src/index.ts';
import { N, addShips, data, guardian, idle, setGuards } from './helpers.ts';

/**
 * Rule 7 player damage (DESIGN.md H3): each ship type pools count × damage and
 * walks its target order (lancer: Thorns then Spores; flak: Spores then
 * Thorns; drones: every guard in id order at 100%), converting the pool by
 * the counter multiplier, with overflow inside a type group and leftover
 * carried to the next group. Guards here neither hit back nor repair unless a
 * test says so, so the hps show the damage exactly.
 */

/** An idle Frost Gate world with these guards at p1 and these ships parked there, before the tick-0 round. */
function arena(guards: ReadonlyArray<readonly [GuardType, number]>, ships: Partial<Record<ShipType, number>>): World {
  const w = idle();
  w.tun['guard.thorn.damage'] = 0;
  w.tun['guard.spore.damage'] = 0;
  w.tun['guard.thorn.repairPerRound'] = 0;
  w.tun['guard.spore.repairPerRound'] = 0;
  setGuards(w, N.p1, guards);
  for (const t of ['lancer', 'flak', 'drone'] as const) addShips(w, N.p1, ships[t] ?? 0, t);
  return w;
}

/** One round (tick 0), then the guards left as [type, hp]. */
function round(w: World): Array<[GuardType, number]> {
  step(w, data, []);
  return guardian(w, N.p1).guards.map((g) => [g.type, g.hp]);
}

describe('counter multipliers', () => {
  it('lancer strong vs Thorns and weak vs Spores, flak the reverse, drones 100 against both', () => {
    const t = idle().tun;
    expect(counterPct(t, 'lancer', 'thorn')).toBe(200);
    expect(counterPct(t, 'lancer', 'spore')).toBe(25);
    expect(counterPct(t, 'flak', 'spore')).toBe(200);
    expect(counterPct(t, 'flak', 'thorn')).toBe(25);
    expect(counterPct(t, 'drone', 'thorn')).toBe(100);
    expect(counterPct(t, 'drone', 'spore')).toBe(100);
  });
});

describe('rule 7: counter damage with overflow', () => {
  it('lancers: ×2 against Thorns, overflowing Thorn to Thorn in id order; the leftover converts back and hits Spores at ×1/4', () => {
    // 6 lancers: base 24 → 48 vs Thorns: both die (40), left 8 → base 4 → 1 vs Spores.
    const w = arena([['thorn', 20], ['spore', 6], ['thorn', 20], ['spore', 6]], { lancer: 6 });
    expect(round(w)).toEqual([['spore', 5], ['spore', 6]]);
    expect(w.lastBattle ?? guardian(w, N.p1).battle).toMatchObject({ guardsKilled: 2, killedByType: { thorn: 2, spore: 0 } });
  });

  it('lancers: while Thorns remain, nothing reaches the Spores', () => {
    // 3 lancers: base 12 → 24: Thorn 1 dies, Thorn 2 at 16; Thorns remain, so base = 0.
    const w = arena([['thorn', 20], ['thorn', 20], ['spore', 6]], { lancer: 3 });
    expect(round(w)).toEqual([['thorn', 16], ['spore', 6]]);
  });

  it('flak: ×2 against Spores first, then the leftover hits Thorns at ×1/4', () => {
    // 3 flak: base 12 → 24 vs Spores: both die (12), left 12 → base 6 → floor(6 × 25 / 100) = 1 vs the Thorn.
    const w = arena([['thorn', 20], ['spore', 6], ['spore', 6]], { flak: 3 });
    expect(round(w)).toEqual([['thorn', 19]]);
    // 2 flak: base 8 → 16: Spores die, left 4 → base 2 → 0 vs the Thorn.
    expect(round(arena([['thorn', 20], ['spore', 6], ['spore', 6]], { flak: 2 }))).toEqual([['thorn', 20]]);
  });

  it('drones: every guard in id order at 100%, no type preference', () => {
    // 5 drones: 10 damage: Spore 1 dies (6), the Thorn takes 4; Spore 2 is untouched.
    const w = arena([['spore', 6], ['thorn', 20], ['spore', 6]], { drone: 5 });
    expect(round(w)).toEqual([['thorn', 16], ['spore', 6]]);
  });

  it('types resolve lancer, flak, drone, each on what the earlier ones left; guards at 0 hp are skipped', () => {
    // Lancer: 4 → 8 vs the Thorn (12 left). Flak: 4 → 8 vs the Spore (dies), left 2 → base 1 → 0 vs the Thorn.
    // Drones: 4 in id order: the Thorn (first living) → 8; the dead Spore is skipped.
    const w = arena([['thorn', 20], ['spore', 6]], { lancer: 1, flak: 1, drone: 2 });
    expect(round(w)).toEqual([['thorn', 8]]);
  });

  it('guards killed this round still hit back (start-of-round state), and ship damage overflows in id order', () => {
    const w = arena([['spore', 6], ['spore', 6]], { flak: 2 });
    w.tun['guard.spore.damage'] = 7;
    expect(round(w)).toEqual([]);
    // 14 damage: flak 1 (12 hp) dies, flak 2 takes 2.
    expect(w.ships.map((s) => [s.type, s.hp])).toEqual([['flak', 10]]);
    expect(w.stats.shipsLost).toEqual({ drone: 0, lancer: 0, flak: 1 });
    expect(guardian(w, N.p1).alive).toBe(false); // captured: no guards left and a ship present
  });

  it('a guard type with no living guards passes the pool on unconverted (no rounding loss at non-default multipliers)', () => {
    // strongPct 150, weakPct 100, lancer damage 3: 1 lancer vs a lone Spore.
    // Skipping the empty Thorn group leaves base 3 → 3 vs the Spore (6 → 3). Converting through it would give floor(4 × 100 / 150) = 2.
    const w = arena([['spore', 6]], { lancer: 1 });
    w.tun['counter.strongPct'] = 150;
    w.tun['counter.weakPct'] = 100;
    w.tun['ship.lancer.damage'] = 3;
    expect(round(w)).toEqual([['spore', 3]]);
  });

  it('non-default multipliers: strongPct 400, weakPct 10', () => {
    // 1 lancer: base 4 → 16 vs Thorn (20 → 4); Thorns remain. 1 flak: 4 → 16 vs Spores: two die (12), left 4 → base 1 → floor(10/100) = 0.
    const w = arena([['thorn', 20], ['spore', 6], ['spore', 6], ['spore', 6]], { lancer: 1, flak: 1 });
    w.tun['counter.strongPct'] = 400;
    w.tun['counter.weakPct'] = 10;
    expect(round(w)).toEqual([['thorn', 4], ['spore', 2]]);
  });

  it('repair is per type: Thorns heal guard.thorn.repairPerRound, Spores guard.spore.repairPerRound (0 by default)', () => {
    const w = idle();
    setGuards(w, N.p1, [['thorn', 10], ['spore', 2]]);
    step(w, data, []); // tick 0: a round tick with no fight
    expect(guardian(w, N.p1).guards.map((g) => g.hp)).toEqual([12, 2]);
    w.tun['guard.spore.repairPerRound'] = 3;
    for (let i = 0; i < 30; i++) step(w, data, []);
    // (Regrowth refills p1 meanwhile; its new guards come after these two.)
    expect(guardian(w, N.p1).guards.slice(0, 2).map((g) => g.hp)).toEqual([14, 5]);
    // Never above the type's hp.
    for (let i = 0; i < 300; i++) step(w, data, []);
    expect(guardian(w, N.p1).guards.slice(0, 2).map((g) => g.hp)).toEqual([20, 6]);
  });
});
