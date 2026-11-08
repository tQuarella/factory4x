import { SHIP_TYPES, type SimData } from './data.ts';
import { researchLevel, type ShipTypeCounts, type World } from './world.ts';

/**
 * The fleet limit (DESIGN.md H5 "Fleet cap"). The limit and the count are
 * derived from tunables, research and the area state, never stored. Integer
 * only; ship types in the fixed SHIP_TYPES order.
 */

/** The fleet limit now: fleet.cap + Command limit level × research.fleet.step, or null when fleet.cap is 0 (no limit: H4's rules). */
export function fleetCap(world: Readonly<World>): number | null {
  const base = world.tun['fleet.cap'];
  if (base <= 0) return null;
  return base + researchLevel(world, 'fleet') * world.tun['research.fleet.step'];
}

/** Yards with a ship in progress (each counts against the limit from the moment it starts). */
export function shipsBuilding(world: Readonly<World>): number {
  let n = 0;
  for (const t of SHIP_TYPES) if (world.yards[t].ticksLeft > 0) n++;
  return n;
}

/** Ships counted against the limit: every ship in the area (parked, in transit or fighting) plus every yard building one. */
export function fleetCount(world: Readonly<World>): number {
  return world.ships.length + shipsBuilding(world);
}

/** True when a limit is set and the count has reached it: yards can't start (rule 5b). */
export function isFleetFull(world: Readonly<World>): boolean {
  const cap = fleetCap(world);
  return cap !== null && fleetCount(world) >= cap;
}

/** Ore one recycled ship of `type` refunds now: floor(ship.<type>.cost × fleet.recycleRefundPct / 100). */
export function recycleRefundEach(world: Readonly<World>, type: keyof ShipTypeCounts): number {
  return Math.floor((world.tun[`ship.${type}.cost`] * world.tun['fleet.recycleRefundPct']) / 100);
}

/** Ore `counts` would refund if recycled, as given (no clamping: pass clampSendCounts(world, node, counts) for a node's real counts). */
export function recycleRefund(world: Readonly<World>, counts: Readonly<ShipTypeCounts>): number {
  let ore = 0;
  for (const t of SHIP_TYPES) ore += counts[t] * recycleRefundEach(world, t);
  return ore;
}

/** The Command limit item's level count in `data` (0 when the data has none). */
export function fleetMaxLevel(data: SimData): number {
  const item = data.research.find((r) => r.id === 'fleet');
  return item === undefined ? 0 : item.levels.length;
}

export interface FleetStatus {
  /** The limit now, or null when it is off (fleet.cap 0). */
  cap: number | null;
  /** Ships alive plus ships being built (what the limit counts). */
  count: number;
  /** Yards building a ship. */
  building: number;
  /** Ships alive, by type (anywhere: parked, in transit, fighting). */
  byType: ShipTypeCounts;
  /** Ships being built, by type (0 or 1 each). */
  buildingByType: ShipTypeCounts;
  /** A limit is set and the count has reached it (the chip's full style; yards are paused). */
  full: boolean;
  /** Command limit level and its max (0 when the data has no Command limit). */
  level: number;
  maxLevel: number;
}

/** The fleet chip, the probe sheet header ("Fleet 9/12 · Command limit 1/3") and the bots. Works on the overworld too (count 0). */
export function fleetStatus(world: Readonly<World>, data: SimData): FleetStatus {
  const byType: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
  for (const s of world.ships) byType[s.type] += 1;
  const buildingByType: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
  for (const t of SHIP_TYPES) if (world.yards[t].ticksLeft > 0) buildingByType[t] = 1;
  const cap = fleetCap(world);
  const building = shipsBuilding(world);
  const count = world.ships.length + building;
  return {
    cap,
    count,
    building,
    byType,
    buildingByType,
    full: cap !== null && count >= cap,
    level: researchLevel(world, 'fleet'),
    maxLevel: fleetMaxLevel(data),
  };
}
