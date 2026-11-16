import { commandedBands, maxCommandedBands } from './campaign.ts';
import { BUILD_TYPES, ECON_TYPES, SHIP_TYPES, type BuildType, type SimData } from './data.ts';
import { recycleOrder } from './orders.ts';
import { PROBE, type EconTypeCounts, type ShipTypeCounts, type World } from './world.ts';

/**
 * The fleet limit (DESIGN.md H5 "Fleet cap", H6 "Fleet limit, relays and band
 * locks", H7 F9 "Fleet limit"). The limit and the count are derived from
 * tunables, the reclaimed relays and the area state, never stored. Integer
 * only; ship types in the fixed SHIP_TYPES (H7: BUILD_TYPES) order.
 */

/** H7 F9: true if `type` counts against the field limit: every type when fleet.countsEconomy is 1, warships only when 0. */
export function isCountedType(world: Readonly<World>, type: BuildType): boolean {
  return world.tun['fleet.countsEconomy'] >= 1 || (type !== 'extractor' && type !== 'hauler');
}

/** H7: true while the probe's bay for `type` is building (economy bays are in world.field, warship bays are world.yards). */
export function bayBusy(world: Readonly<World>, type: BuildType): boolean {
  if (type === 'extractor' || type === 'hauler') return world.field !== null && world.field.bays[type].ticksLeft > 0;
  return world.yards[type].ticksLeft > 0;
}

/**
 * The fleet limit now. Campaign: fleet.cap + fleet.relayStep × commandedBands, or null when fleet.cap is 0 (no
 * limit: H4's rules; relays still open bands). commandedBands counts a relay reclaimed in the active area only from
 * the next landing, so the limit never rises mid-area. H6 removed Command limit, so research no longer changes it.
 * H7 field mode (F9): field.fleetCap, or null when it is 0.
 */
export function fleetCap(world: Readonly<World>, data: SimData): number | null {
  if (world.field !== null) {
    const cap = world.tun['field.fleetCap'];
    return cap <= 0 ? null : cap;
  }
  const base = world.tun['fleet.cap'];
  if (base <= 0) return null;
  return base + world.tun['fleet.relayStep'] * commandedBands(world, data);
}

/** Yards with a ship in progress (each counts against the limit from the moment it starts). H7 field mode: the counted bays. */
export function shipsBuilding(world: Readonly<World>): number {
  let n = 0;
  if (world.field !== null) {
    for (const t of BUILD_TYPES) if (isCountedType(world, t) && bayBusy(world, t)) n++;
    return n;
  }
  for (const t of SHIP_TYPES) if (world.yards[t].ticksLeft > 0) n++;
  return n;
}

/**
 * Ships counted against the limit: every ship in the area (parked, in transit or fighting) plus every yard building
 * one. H7 F9: the counted ships alive (economy ships too when fleet.countsEconomy is 1) plus the counted bays building.
 */
export function fleetCount(world: Readonly<World>): number {
  const econ = world.field !== null && world.tun['fleet.countsEconomy'] >= 1 ? world.field.econ.length : 0;
  return world.ships.length + econ + shipsBuilding(world);
}

/** True when a limit is set and the count has reached it: yards (H7: counted bays) can't start. */
export function isFleetFull(world: Readonly<World>, data: SimData): boolean {
  const cap = fleetCap(world, data);
  return cap !== null && fleetCount(world) >= cap;
}

/** Ore one recycled ship of `type` refunds now: floor(ship.<type>.cost × fleet.recycleRefundPct / 100). H7: economy types too. */
export function recycleRefundEach(world: Readonly<World>, type: BuildType): number {
  return Math.floor((world.tun[`ship.${type}.cost`] * world.tun['fleet.recycleRefundPct']) / 100);
}

/**
 * Ore `counts` would refund if recycled, as given (no clamping: pass clampSendCounts(world, node, counts) for a
 * node's real counts). H7: economy counts (`extractor`, `hauler`) are added when given.
 */
export function recycleRefund(world: Readonly<World>, counts: Readonly<ShipTypeCounts> & Readonly<Partial<EconTypeCounts>>): number {
  let ore = 0;
  for (const t of SHIP_TYPES) ore += counts[t] * recycleRefundEach(world, t);
  for (const t of ECON_TYPES) ore += (counts[t] ?? 0) * recycleRefundEach(world, t);
  return ore;
}

export interface FleetStatus {
  /** The limit now, or null when it is off (fleet.cap 0; H7 field mode: field.fleetCap 0). */
  cap: number | null;
  /** Ships alive plus ships being built (what the limit counts; H7: the counted ones). */
  count: number;
  /** Yards building a ship (H7: the counted bays). */
  building: number;
  /** Warships alive, by type (anywhere: parked, in transit, fighting). */
  byType: ShipTypeCounts;
  /** Warships being built, by type (0 or 1 each). */
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
  /** H7: fleet.countsEconomy is 1 (economy ships count against the limit). */
  countsEconomy: boolean;
  /** H7: economy ships alive (anywhere) and being built (0 or 1 each), by type; 0 in a campaign. */
  econByType: EconTypeCounts;
  econBuildingByType: EconTypeCounts;
  /** H8: the fleet panel's rows, one per BUILD_TYPES type (all zero in a campaign world). */
  types: Record<BuildType, FleetTypeRow>;
}

/** H8 `fleetStatus.types`: one fleet-panel row. */
export interface FleetTypeRow {
  /** Ships of the type alive, anywhere. */
  alive: number;
  /** At the probe: idle economy ships (no node), or warships parked there. */
  idle: number;
  /** 1 while the probe's bay builds one (the building dot), else 0. */
  building: number;
  /** Ships `recycleFleet` can take now (recycleOrder: not at a living guarded node or a fighting raid's target). */
  recyclable: number;
}

/** The fleet chip, the probe sheet header and the bots. Works on the overworld too (count 0; the limit the next landing gets). */
export function fleetStatus(world: Readonly<World>, data: SimData): FleetStatus {
  const byType: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
  for (const s of world.ships) byType[s.type] += 1;
  const buildingByType: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
  for (const t of SHIP_TYPES) if (world.yards[t].ticksLeft > 0) buildingByType[t] = 1;
  const econByType: EconTypeCounts = { extractor: 0, hauler: 0 };
  const econBuildingByType: EconTypeCounts = { extractor: 0, hauler: 0 };
  if (world.field !== null) {
    for (const s of world.field.econ) econByType[s.type] += 1;
    for (const t of ECON_TYPES) if (world.field.bays[t].ticksLeft > 0) econBuildingByType[t] = 1;
  }
  const types = {} as Record<BuildType, FleetTypeRow>;
  for (const t of BUILD_TYPES) types[t] = { alive: 0, idle: 0, building: 0, recyclable: 0 };
  if (world.field !== null) {
    for (const s of world.ships) {
      types[s.type].alive += 1;
      if (s.at === PROBE) types[s.type].idle += 1;
    }
    for (const s of world.field.econ) {
      types[s.type].alive += 1;
      if (s.at === PROBE && s.target === null) types[s.type].idle += 1;
    }
    for (const t of BUILD_TYPES) {
      types[t].building = bayBusy(world, t) ? 1 : 0;
      types[t].recyclable = recycleOrder(world, t).length;
    }
  }
  const cap = fleetCap(world, data);
  const building = shipsBuilding(world);
  const count = fleetCount(world);
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
    countsEconomy: world.tun['fleet.countsEconomy'] >= 1,
    econByType,
    econBuildingByType,
    types,
  };
}
