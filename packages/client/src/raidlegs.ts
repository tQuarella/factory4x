/**
 * H9: the raid's flights, one leg per prong, for the map. This is the one place that reads how a raid flies (`world.raid`): the view
 * draws whatever legs it is given, so a change in the sim's raid shape changes only this file.
 *
 * Every prong is read through `raidProngs(world.raid)` (prong 0 is the raid object itself, and its `phase` can read `done` while
 * another prong is still out), never through `world.raid.target`, `.phase` or `.guards` directly.
 */
import { raidProngs, type World } from '@factory4x/sim';

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

/** The legs to draw, in prong order: prongs that are mustering or done have none. */
export function raidLegs(world: Readonly<World>): RaidLeg[] {
  const raid = world.raid;
  if (raid === null) return [];
  const legs: RaidLeg[] = [];
  for (const p of raidProngs(raid)) {
    if (p.phase === 'muster' || p.phase === 'done') continue;
    const mix = { thorn: 0, spore: 0 };
    for (const g of p.guards) mix[g.type]++;
    legs.push({ target: p.target, phase: p.phase, from: p.from, ticksLeft: p.ticksLeft, flightTicks: p.flightTicks, mix });
  }
  return legs;
}
