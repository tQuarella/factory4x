import type { ShipType } from './data.ts';
import { ceilDiv } from './math.ts';
import { PROBE, nodeDistance, type Ship, type Transit, type World } from './world.ts';

/**
 * Ship movement and spawning shared by the campaign yards (rule 5b), the H7 field bays (F3) and the inputs.
 * Moved out of inputs.ts and step.ts at h7-sim so field.ts can use them without an import cycle.
 */

/** Anything that flies node to node: warships and (H7) economy ships. */
export interface Mobile {
  at: number | null;
  transit: Transit | null;
}

/**
 * Starts transit for one ship from the node it is parked at (the probe if it has none) to `to`, at `speed` su per
 * tick (default ship.speedSu, the warships' and extractors' speed): ceil(distance / speed) ticks.
 */
export function startTransit(world: World, ship: Mobile, to: number, speed: number = world.tun['ship.speedSu']): void {
  const from = ship.at ?? PROBE;
  const total = ceilDiv(nodeDistance(world, from, to), speed);
  ship.at = null;
  ship.transit = { from, to, ticksLeft: total, totalTicks: total };
}

/** Rule 6 / F7 for one ship: one tick of transit; on the last it parks at the destination. Returns true on arrival. */
export function advance(s: Mobile): boolean {
  const tr = s.transit;
  if (tr === null) return false;
  tr.ticksLeft -= 1;
  if (tr.ticksLeft > 0) return false;
  s.at = tr.to;
  s.transit = null;
  return true;
}

/** Spawns a finished warship at the probe (rule 5b / F3): counted in stats, and sent to the rally point if it isn't the probe. */
export function newShip(world: World, type: ShipType): Ship {
  const ship: Ship = { id: world.nextId++, type, hp: world.tun[`ship.${type}.hp`], at: PROBE, transit: null, engagedIn: -1 };
  world.ships.push(ship);
  world.stats.shipsBuilt[type] += 1;
  if (world.stats.firstShipTick === null) world.stats.firstShipTick = world.tick;
  if (world.rally !== PROBE) startTransit(world, ship, world.rally);
  return ship;
}
