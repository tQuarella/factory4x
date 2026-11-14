import { BUILD_TYPES, SHIP_TYPES, type BuildType, type EconType } from './data.ts';
import { shipsAtByType } from './ships.ts';
import { PROBE, fieldOf, isGuarded, type EconShip, type Ship, type ShipTypeCounts, type World } from './world.ts';

/**
 * H8's fleet orders (DESIGN.md H8 "Rules (field mode): changes to H7", H6 `moveShips` and H8 `recycleFleet`): the
 * counts a move carries and the ships a fleet recycle takes. Integer only; types in SHIP_TYPES / BUILD_TYPES order,
 * nodes in index order, ships in id order. It imports no other rule module (field.ts, fleet.ts), so fleet.ts can
 * read recycleOrder for fleetStatus without an import cycle.
 */

const isEcon = (t: BuildType): t is EconType => t === 'extractor' || t === 'hauler';

/** H6: a move carries every warship at the source (`all`) or the long-press share (`split`). */
export type MovePart = 'all' | 'split';

/** True for a valid `part`. */
export function isMovePart(v: unknown): v is MovePart {
  return v === 'all' || v === 'split';
}

/**
 * H6: the warships a `moveShips` from `from` carries now. `all`: every warship parked there (shipsAtByType).
 * `split`: per type floor(count × move.splitPct ÷ 100); if that totals 0 while a warship is there, 1 ship of the
 * first type present (drone, lancer, flak). Economy ships are never carried (they are not in world.ships).
 */
export function moveCounts(world: Readonly<World>, from: number, part: MovePart): ShipTypeCounts {
  const at = shipsAtByType(world, from);
  if (part === 'all') return at;
  const pct = world.tun['move.splitPct'];
  const out: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
  let total = 0;
  for (const t of SHIP_TYPES) {
    out[t] = Math.floor((at[t] * pct) / 100);
    total += out[t];
  }
  if (total === 0) {
    const first = SHIP_TYPES.find((t) => at[t] > 0);
    if (first !== undefined) out[first] = 1;
  }
  return out;
}

/** Any ship `recycleFleet` can take: a warship or an economy ship. */
type AnyShip = Ship | EconShip;

/**
 * H8: a ship's place in `recycleFleet`'s order, or null if it can't be recycled now. Not eligible: a ship at a
 * living guarded node (in battle there), and a ship at a raid's target while the raid is in its fight phase.
 * Order: 0 idle at the probe (a warship parked there, or an economy ship with no node), 1 parked or docked at a node
 * (by node index; an economy ship at the probe with a node, a hauler that just arrived, is here at index 0),
 * 2 in transit.
 */
function recycleRank(world: Readonly<World>, s: Readonly<AnyShip>): [number, number] | null {
  if (s.at === null) return [2, 0];
  if (isGuarded(world, s.at)) return null;
  const raid = world.raid;
  if (raid !== null && raid.phase === 'fight' && raid.target === s.at) return null;
  const econ = s.type === 'extractor' || s.type === 'hauler';
  if (s.at === PROBE && (!econ || s.target === null)) return [0, 0];
  return [1, s.at];
}

/** H8: the ships of `type` that `recycleFleet` can take now, in the order it takes them (lowest id first in each group). */
export function recycleOrder(world: Readonly<World>, type: BuildType): AnyShip[] {
  const pool: readonly AnyShip[] = isEcon(type) ? (world.field?.econ ?? []) : world.ships;
  const ranked: { s: AnyShip; g: number; n: number }[] = [];
  for (const s of pool) {
    if (s.type !== type) continue;
    const r = recycleRank(world, s);
    if (r !== null) ranked.push({ s, g: r[0], n: r[1] });
  }
  ranked.sort((a, b) => a.g - b.g || a.n - b.n || a.s.id - b.s.id);
  return ranked.map((r) => r.s);
}

/** H8: the counts `recycleFleet` would really take: each count clamped to the type's eligible ships. */
export function clampFleetCounts(world: Readonly<World>, counts: Readonly<Record<BuildType, number>>): Record<BuildType, number> {
  const out = {} as Record<BuildType, number>;
  for (const t of BUILD_TYPES) out[t] = Math.min(counts[t], recycleOrder(world, t).length);
  return out;
}

/**
 * H8 `recycleFleet`: recycles up to counts[type] ships of each type, wherever they are, in recycleOrder. Each
 * refunds floor(ship.<type>.cost × fleet.recycleRefundPct ÷ 100) ore into stock (stats.oreRefunded, and
 * shipsRecycled or econRecycled by type). A recycled hauler's cargo is lost; a recycled docked extractor frees its
 * slot (the caller runs syncExtractors; F5 re-dispatches this tick, after the inputs). `refundEach` is fleet.ts'
 * recycleRefundEach, passed in as recycleEcon takes it. Returns the ore refunded.
 */
export function applyRecycleFleet(world: World, counts: Readonly<Record<BuildType, number>>, refundEach: (t: BuildType) => number): number {
  const f = fieldOf(world);
  const gone = new Set<number>();
  let refund = 0;
  for (const t of BUILD_TYPES) {
    const take = recycleOrder(world, t).slice(0, Math.max(0, counts[t]));
    for (const s of take) {
      gone.add(s.id);
      refund += refundEach(t);
      if (isEcon(t)) world.stats.econRecycled[t] += 1;
      else world.stats.shipsRecycled[t] += 1;
    }
  }
  world.ships = world.ships.filter((s) => !gone.has(s.id));
  f.econ = f.econ.filter((s) => !gone.has(s.id));
  world.stock.ore += refund;
  world.stats.oreRefunded += refund;
  return refund;
}
