import { COMBAT_ORDER, GUARD_TYPES, type GuardType, type ShipType, type Tunables } from './data.ts';
import type { EconShip, Guard, Ship } from './world.ts';

/**
 * Rule 7's pure combat arithmetic (player damage, guard damage, counters), shared by combat at guarded nodes (step.ts)
 * and the H7 raid fight (factions/). Moved out of step.ts in h7-raids so the faction module doesn't import step.ts
 * (step.ts imports the faction module: an import cycle). step.ts re-exports everything here, so imports from it still work.
 */

/** Target order per ship type (rule 7). Drones use all guards in id order and are handled apart. */
const TARGET_ORDER: Readonly<Record<'lancer' | 'flak', readonly GuardType[]>> = {
  lancer: ['thorn', 'spore'],
  flak: ['spore', 'thorn'],
};

/**
 * Rule 7, guard damage (DESIGN.md H6 "Combat amendment"): the ship types each guard type's pool strikes, in order.
 * Each strikes first the type that is Weak against it and last the type that counters it; drones sit between.
 */
export const GUARD_TARGET_ORDER: Readonly<Record<GuardType, readonly ShipType[]>> = {
  thorn: ['flak', 'drone', 'lancer'],
  spore: ['lancer', 'drone', 'flak'],
};

/** Damage multiplier, percent, of a ship type against a guard type: strong, weak, or 100 for drones. */
export function counterPct(t: Readonly<Tunables>, ship: ShipType, guard: GuardType): number {
  if (ship === 'drone') return 100;
  const strong = (ship === 'lancer') === (guard === 'thorn');
  return strong ? t['counter.strongPct'] : t['counter.weakPct'];
}

/**
 * Applies `dmg` to the living guards (hp > 0) of `type` (or of every type when
 * null) in id order, overflowing from one to the next as in H1. Returns the
 * damage left over.
 */
function applyToGuards(guards: Guard[], type: GuardType | null, dmg: number): number {
  for (const gd of guards) {
    if (dmg <= 0) break;
    if (gd.hp <= 0 || (type !== null && gd.type !== type)) continue;
    const hit = Math.min(dmg, gd.hp);
    gd.hp -= hit;
    dmg -= hit;
  }
  return dmg;
}

function anyLiving(guards: readonly Guard[], type: GuardType): boolean {
  for (const gd of guards) if (gd.type === type && gd.hp > 0) return true;
  return false;
}

/**
 * Rule 7 player damage for one round: each ship type present, in the order
 * lancer, flak, drone, pools its damage and walks its target order. Damage
 * from earlier types is already applied when later types act.
 */
export function playerDamage(t: Readonly<Tunables>, guards: Guard[], present: Readonly<Record<ShipType, number>>): void {
  for (const type of COMBAT_ORDER) {
    const n = present[type];
    if (n === 0) continue;
    let base = n * t[`ship.${type}.damage`];
    if (type === 'drone') {
      applyToGuards(guards, null, base);
      continue;
    }
    for (const gt of TARGET_ORDER[type]) {
      if (base <= 0) break;
      // A type with no living guards takes nothing, so the pool passes on unconverted (DECISIONS.md, h3-sim).
      if (!anyLiving(guards, gt)) continue;
      const pct = counterPct(t, type, gt);
      const left = applyToGuards(guards, gt, Math.floor((base * pct) / 100));
      base = anyLiving(guards, gt) ? 0 : Math.floor((left * 100) / pct);
    }
  }
}

/** Rule 7: each guard type's damage pool for one round, from the living guards at the start of the round. */
export function guardPools(t: Readonly<Tunables>, guards: readonly Guard[]): Record<GuardType, number> {
  const pools: Record<GuardType, number> = { thorn: 0, spore: 0 };
  for (const gd of guards) pools[gd.type] += t[`guard.${gd.type}.damage`];
  return pools;
}

/** H7 R7: after the warships, a raid's pools strike haulers, then extractors. */
export const ECON_STRIKE_ORDER: readonly EconShip['type'][] = ['hauler', 'extractor'];

/** The units a guardStrike brought to hp ≤ 0, each list in the order they fell. */
export interface StrikeKills {
  ships: Ship[];
  econ: EconShip[];
}

function strikeType<T extends Ship | EconShip>(list: readonly T[], type: T['type'], pool: number, killed: T[]): number {
  for (const s of list) {
    if (pool <= 0) break;
    if (s.type !== type || s.hp <= 0) continue;
    const hit = Math.min(pool, s.hp);
    s.hp -= hit;
    pool -= hit;
    if (s.hp <= 0) killed.push(s);
  }
  return pool;
}

/**
 * Rule 7 guard damage (DESIGN.md H6 "Combat amendment"), used by F10 at guarded nodes and exported for the H7
 * raid fight (R7). Each guard type's pool, Thorns then Spores, strikes the warships in GUARD_TARGET_ORDER (the
 * type it counters first), within a type in id order, with overflow to the next ship and the next type; for a raid
 * it then goes on to `econ`: haulers, then extractors (ECON_STRIKE_ORDER), in id order. Ships already at hp ≤ 0
 * are skipped. Mutates hp in place; the caller removes the dead and keeps the books.
 */
export function guardStrike(pools: Readonly<Record<GuardType, number>>, warships: readonly Ship[], econ: readonly EconShip[] = []): StrikeKills {
  const kills: StrikeKills = { ships: [], econ: [] };
  for (const gt of GUARD_TYPES) {
    let pool = pools[gt];
    for (const type of GUARD_TARGET_ORDER[gt]) pool = strikeType(warships, type, pool, kills.ships);
    for (const type of ECON_STRIKE_ORDER) pool = strikeType(econ, type, pool, kills.econ);
  }
  return kills;
}
