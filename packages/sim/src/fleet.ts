import { commandedBands, maxCommandedBands } from './campaign.ts';
import { SHIP_TYPES, type SimData } from './data.ts';
import type { ShipTypeCounts, World } from './world.ts';

/**
 * The fleet limit (DESIGN.md H5 "Fleet cap", H6 "Fleet limit, relays and band
 * locks"). The limit and the count are derived from tunables, the reclaimed
 * relays and the area state, never stored. Integer only; ship types in the
 * fixed SHIP_TYPES order.
 */

/**
 * The fleet limit now: fleet.cap + fleet.relayStep × commandedBands, or null when fleet.cap is 0 (no limit: H4's
 * rules; relays still open bands). commandedBands counts a relay reclaimed in the active area only from the next
 * landing, so the limit never rises mid-area. H6 removed Command limit, so research no longer changes it.
 */
export function fleetCap(world: Readonly<World>, data: SimData): number | null {
  const base = world.tun['fleet.cap'];
  if (base <= 0) return null;
  return base + world.tun['fleet.relayStep'] * commandedBands(world, data);
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
export function isFleetFull(world: Readonly<World>, data: SimData): boolean {
  const cap = fleetCap(world, data);
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
  /** H6: bands commanded by a reclaimed relay (each adds fleet.relayStep to the limit), and how many the data has (2 shipped). */
  commandedBands: number;
  maxCommandedBands: number;
  /**
   * @deprecated H5's Command limit level and max, always 0 since H6 removed Command limit (use commandedBands and
   * maxCommandedBands). Kept only so H5 client code compiles until h6-client moves off them.
   */
  level: number;
  /** @deprecated always 0; see `level`. */
  maxLevel: number;
}

/** The fleet chip, the probe sheet header and the bots. Works on the overworld too (count 0; the limit the next landing gets). */
export function fleetStatus(world: Readonly<World>, data: SimData): FleetStatus {
  const byType: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
  for (const s of world.ships) byType[s.type] += 1;
  const buildingByType: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
  for (const t of SHIP_TYPES) if (world.yards[t].ticksLeft > 0) buildingByType[t] = 1;
  const cap = fleetCap(world, data);
  const building = shipsBuilding(world);
  const count = world.ships.length + building;
  return {
    cap,
    count,
    building,
    byType,
    buildingByType,
    full: cap !== null && count >= cap,
    commandedBands: commandedBands(world, data),
    maxCommandedBands: maxCommandedBands(data),
    level: 0,
    maxLevel: 0,
  };
}
