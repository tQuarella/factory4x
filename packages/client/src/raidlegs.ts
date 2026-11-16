/**
 * H9: the raid's flights, one leg per prong, for the map. This is the one place that reads how a raid flies (`world.raid`): the view
 * draws whatever legs it is given, so a change in the sim's raid shape changes only this file.
 *
 * With h9-sim's stub there is a single prong, mirrored from `world.raid`. When h9-raids lands, `raidLegs` reads each prong's own
 * `from`, `target`, `ticksLeft` and `flightTicks`, in prong order.
 */
import type { World } from '@factory4x/sim';

/** One prong's flight: it flies `from` to `target` while `out`, `target` to the hive while `home`, and stands at `target` in a `fight`. */
export interface RaidLeg {
  target: number;
  phase: 'out' | 'fight' | 'home';
  /** The node the leg starts from (the hive, or the rock a retarget left). */
  from: number;
  ticksLeft: number;
  flightTicks: number;
  /** The raiders on this leg, by type. */
  mix: { thorn: number; spore: number };
}

/** The legs to draw, in prong order: prongs mustering or done have none. */
export function raidLegs(world: Readonly<World>): RaidLeg[] {
  const raid = world.raid;
  if (raid === null || raid.phase === 'muster') return [];
  const mix = { thorn: 0, spore: 0 };
  for (const g of raid.guards) mix[g.type]++;
  return [{ target: raid.target, phase: raid.phase, from: raid.from, ticksLeft: raid.ticksLeft, flightTicks: raid.flightTicks, mix }];
}
