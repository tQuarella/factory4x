import { describe, expect, it } from 'vitest';
import { SHIP_TYPES, guardianAt, step, type GuardType, type ShipType, type ShipTypeCounts, type World } from '../src/index.ts';
import { L, N, data, guardian, idle, setGuards } from './helpers.ts';
import { baseWorld, minMix, minSingle } from './min-wave.ts';

/**
 * DESIGN.md H6 "Combat amendment: guards strike the ship type they counter"
 * (h6-combat-target). Guard damage is pooled by guard type over the guards
 * alive at the start of the round: Thorns strike flak, then drones, then
 * lancers; Spores strike lancers, then drones, then flak; within a type in id
 * order, with overflow; thorns first, then spores on the ships left. So a
 * battle's outcome depends on the per-type counts, never on which ship was
 * built first.
 *
 * Everything runs on the frozen v4 fixture (fixtureData) with explicit
 * premises. The hearts are The Deep's three fed hearts at fixture caps:
 * Glass Thicket 14 / 8 (Thorn-heavy), Twin Seams 6 / 20 (Spore-heavy) and
 * Frost Gate 10 / 14 (balanced). Minimum mixes are searched with the real
 * rules, not pinned, so this file states properties, not calibration.
 */

const HEARTS = [
  { name: 'Glass Thicket (Thorn-heavy)', layout: L.glass },
  { name: 'Twin Seams (Spore-heavy)', layout: L.twin },
  { name: 'Frost Gate (balanced)', layout: L.frost },
] as const;

const counts = (drone: number, lancer: number, flak: number): ShipTypeCounts => ({ drone, lancer, flak });
const total = (c: ShipTypeCounts): number => c.drone + c.lancer + c.flak;

/** The ship types of a wave in a build (id) order. */
type Order = (c: ShipTypeCounts) => ShipType[];
const block =
  (types: readonly ShipType[]): Order =>
  (c) =>
    types.flatMap((t) => Array.from({ length: c[t] }, () => t));
const roundRobin: Order = (c) => {
  const left = { ...c };
  const out: ShipType[] = [];
  while (total(left) > 0) {
    for (const t of ['lancer', 'flak', 'drone'] as const) {
      if (left[t] > 0) {
        out.push(t);
        left[t]--;
      }
    }
  }
  return out;
};
/** A fixed shuffle (an integer LCG, no Math.random). */
const shuffled: Order = (c) => {
  const out = roundRobin(c);
  let s = 12345;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};
const ORDERS: Record<string, Order> = {
  'lancers first': block(['lancer', 'flak', 'drone']),
  'flak first': block(['flak', 'lancer', 'drone']),
  'drones first': block(['drone', 'lancer', 'flak']),
  'round-robin': roundRobin,
  'reversed ids': (c) => roundRobin(c).reverse(),
  'fixed shuffle': shuffled,
};

interface Outcome {
  result: 'captured' | 'repelled';
  /** Ticks from the send to the end of the battle. */
  ticks: number;
  /** Surviving ships' hp, per type, sorted (a multiset). */
  survivors: Record<ShipType, number[]>;
}

/** Plays `types` (ids in this order) arriving together at the heart of `base` to resolution. */
function play(base: Readonly<World>, types: readonly ShipType[]): Outcome {
  const w = JSON.parse(JSON.stringify(base)) as World;
  for (const type of types) w.ships.push({ id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at: N.heart, transit: null, engagedIn: -1 });
  const g = guardianAt(w, N.heart)!;
  for (let i = 1; i <= 100_000; i++) {
    step(w, data, []);
    const left = w.ships.filter((s) => s.at === N.heart);
    if (!g.alive || left.length === 0) {
      const survivors = { drone: [] as number[], lancer: [] as number[], flak: [] as number[] };
      for (const s of left) survivors[s.type].push(s.hp);
      for (const t of SHIP_TYPES) survivors[t].sort((a, b) => a - b);
      return { result: g.alive ? 'repelled' : 'captured', ticks: i, survivors };
    }
  }
  throw new Error('battle did not end');
}

const wins = (base: Readonly<World>, types: readonly ShipType[]): boolean => play(base, types).result === 'captured';

/** Per heart: the fed base world, its minimum mix, and the mixes the permutation test covers. */
const cases = HEARTS.map(({ name, layout }) => {
  const base = baseWorld(layout, false);
  const [drones, lancers, flak] = (['drone', 'lancer', 'flak'] as const).map((t) => minSingle(base, N.heart, t));
  const upTo = Math.min(...[drones, lancers, flak].filter((v): v is number => v !== null && v !== undefined));
  const min = minMix(base, N.heart, upTo)!.fleet;
  const big: ShipType = min.lancer >= min.flak ? 'lancer' : 'flak';
  const mixes: Array<[string, ShipTypeCounts]> = [];
  if (drones != null) mixes.push(['drones only', counts(drones, 0, 0)]);
  if (lancers != null) mixes.push(['lancers only', counts(0, lancers, 0)]);
  if (flak != null) mixes.push(['flak only', counts(0, 0, flak)]);
  mixes.push(['minimum mix', min]);
  mixes.push(['one under the minimum', { ...min, [big]: min[big] - 1 }]);
  mixes.push(['two over the minimum', { ...min, lancer: min.lancer + 1, flak: min.flak + 1 }]);
  return { name, base, min, mixes };
});

describe('premise', () => {
  it('the three hearts are Thorn-heavy, Spore-heavy and balanced at fixture caps, and each minimum mix uses both counters', () => {
    const caps = cases.map(({ base }) => {
      const g = guardian(base, N.heart).guards;
      return [g.filter((x) => x.type === 'thorn').length, g.filter((x) => x.type === 'spore').length];
    });
    expect(caps).toEqual([
      [14, 8],
      [6, 20],
      [10, 14],
    ]);
    for (const c of cases) expect(c.min.lancer > 0 && c.min.flak > 0, c.name).toBe(true);
  });
});

describe('1. permutations of one wave give the same outcome', () => {
  for (const c of cases) {
    it(`${c.name}: drones only, single counters, the minimum mix, one under and two over, in six build orders`, () => {
      for (const [label, mix] of c.mixes) {
        const outcomes = Object.entries(ORDERS).map(([order, f]) => {
          const types = f(mix);
          expect(types.length, `${label} ${order}`).toBe(total(mix));
          return [order, play(c.base, types)] as const;
        });
        const [, first] = outcomes[0]!;
        for (const [order, o] of outcomes) expect(o, `${label} (${mix.drone}/${mix.lancer}/${mix.flak}), ${order} vs lancers first`).toEqual(first);
      }
      // The minimum mix wins and one under it loses, so the cases span the boundary.
      expect(wins(c.base, roundRobin(c.min))).toBe(true);
      expect(wins(c.base, roundRobin(c.mixes.find(([l]) => l === 'one under the minimum')![1]))).toBe(false);
    });
  }
});

describe('2. a superset never loses where its subset won; removing a ship never turns a loss into a win', () => {
  for (const c of cases) {
    it(`${c.name}: the minimum mix plus every 0–3 extra drones, lancers and flak, built before and after it, wins`, () => {
      const base = roundRobin(c.min);
      for (let d = 0; d <= 3; d++) {
        for (let l = 0; l <= 3; l++) {
          for (let f = 0; f <= 3; f++) {
            const extra = roundRobin(counts(d, l, f));
            expect(wins(c.base, [...extra, ...base]), `+${d}/${l}/${f} before`).toBe(true);
            expect(wins(c.base, [...base, ...extra]), `+${d}/${l}/${f} after`).toBe(true);
          }
        }
      }
    });

    it(`${c.name}: every losing wave near the minimum still loses with any one ship removed`, () => {
      const near: ShipTypeCounts[] = [];
      for (const t of SHIP_TYPES) if (c.min[t] > 0) near.push({ ...c.min, [t]: c.min[t] - 1 });
      for (const [, mix] of c.mixes) near.push(mix);
      let losing = 0;
      for (const mix of near) {
        if (wins(c.base, roundRobin(mix))) continue;
        losing++;
        for (const t of SHIP_TYPES) {
          if (mix[t] === 0) continue;
          const smaller = { ...mix, [t]: mix[t] - 1 };
          for (const [order, f] of Object.entries(ORDERS)) expect(wins(c.base, f(smaller)), `${mix.drone}/${mix.lancer}/${mix.flak} − 1 ${t}, ${order}`).toBe(false);
        }
      }
      expect(losing).toBeGreaterThan(0);
    });
  }
});

describe('3. unit cases: one round of guard damage', () => {
  /** An idle Frost Gate world; these guards at the heart (hp as given), these ships parked there in this id order, the given damage per guard. */
  function arena(guards: ReadonlyArray<readonly [GuardType, number]>, ships: readonly ShipType[], thornDamage: number, sporeDamage: number): World {
    const w = idle();
    w.tun['guard.thorn.damage'] = thornDamage;
    w.tun['guard.spore.damage'] = sporeDamage;
    // Ships deal no damage, so the guards' pools are the only thing that changes ship hp (unless a test says so).
    for (const t of SHIP_TYPES) w.tun[`ship.${t}.damage`] = 1;
    w.tun['guard.thorn.repairPerRound'] = 0;
    w.tun['guard.spore.repairPerRound'] = 0;
    setGuards(w, N.heart, guards);
    for (const type of ships) w.ships.push({ id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at: N.heart, transit: null, engagedIn: -1 });
    return w;
  }
  /** One round (tick 0); then every ship that was there, in id order, as [type, hp] (0 = destroyed). */
  function round(w: World): Array<[ShipType, number]> {
    const before = w.ships.map((s) => [s.id, s.type] as const);
    step(w, data, []);
    return before.map(([id, type]) => [type, w.ships.find((s) => s.id === id)?.hp ?? 0]);
  }
  const thorns = (n: number, hp = 1000): Array<readonly [GuardType, number]> => Array.from({ length: n }, () => ['thorn', hp] as const);
  const spores = (n: number, hp = 1000): Array<readonly [GuardType, number]> => Array.from({ length: n }, () => ['spore', hp] as const);

  it('premise: drone hp 10, lancer and flak hp 12 on the fixture', () => {
    expect([data.tunables['ship.drone.hp'].default, data.tunables['ship.lancer.hp'].default, data.tunables['ship.flak.hp'].default]).toEqual([10, 12, 12]);
  });

  it('a thorn pool kills flak first, then drones, then lancers, overflowing across a ship and a type boundary', () => {
    // Ids: lancer, drone, flak, flak (the counter built first). 9 Thorns × 3 = 27: both flak die (24), 3 more hit the drone.
    expect(round(arena(thorns(9), ['lancer', 'drone', 'flak', 'flak'], 3, 0))).toEqual([
      ['lancer', 12],
      ['drone', 7],
      ['flak', 0],
      ['flak', 0],
    ]);
    // 12 Thorns × 3 = 36: both flak (24), the drone (10), and 2 into the lancer.
    expect(round(arena(thorns(12), ['lancer', 'drone', 'flak', 'flak'], 3, 0))).toEqual([
      ['lancer', 10],
      ['drone', 0],
      ['flak', 0],
      ['flak', 0],
    ]);
  });

  it('a spore pool kills lancers first, then drones, then flak', () => {
    // Ids: flak, drone, lancer, lancer. 10 Spores × 2 = 20: the first lancer dies (12), the second takes 8.
    expect(round(arena(spores(10), ['flak', 'drone', 'lancer', 'lancer'], 0, 2))).toEqual([
      ['flak', 12],
      ['drone', 10],
      ['lancer', 0],
      ['lancer', 4],
    ]);
    // 15 Spores × 2 = 30: both lancers (24), then 6 into the drone; the flak is untouched.
    expect(round(arena(spores(15), ['flak', 'drone', 'lancer', 'lancer'], 0, 2))).toEqual([
      ['flak', 12],
      ['drone', 4],
      ['lancer', 0],
      ['lancer', 0],
    ]);
  });

  it('both pools come from the start-of-round guards (even ones that die this round), thorns first, then spores on the ships left', () => {
    // 4 Thorns × 3 = 12 and 9 Spores × 2 = 18, every guard at 1 hp so the ships kill them all in this same round.
    const w = arena([...thorns(4, 1), ...spores(9, 1)], ['lancer', 'drone', 'flak'], 3, 2);
    for (const t of SHIP_TYPES) w.tun[`ship.${t}.damage`] = 20;
    // Thorns: the flak dies (12). Spores, on the ships left: the lancer dies (12), then 6 into the drone.
    expect(round(w)).toEqual([
      ['lancer', 0],
      ['drone', 4],
      ['flak', 0],
    ]);
    expect(guardian(w, N.heart).alive).toBe(false);
  });

  it('damage that does not divide into ship hp leaves a remainder on the next ship', () => {
    // 2 Thorns × 7 = 14 against flak (12) then a drone (10): the drone keeps 8. 1 Spore × 5 = 5 on the lancer: 7.
    expect(round(arena([...thorns(2), ...spores(1)], ['drone', 'lancer', 'flak'], 7, 5))).toEqual([
      ['drone', 8],
      ['lancer', 7],
      ['flak', 0],
    ]);
  });
});
