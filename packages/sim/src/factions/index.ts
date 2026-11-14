import type { SimData } from '../data.ts';
import type { Guard, GuardCounts, World } from '../world.ts';

/**
 * Faction AI (DESIGN.md H7 "Raids", R1–R9): the hive's raids. h7-sim lands only the state (R1) and the hook,
 * which `step` calls at F8 (after movement, before combat at guarded nodes) and which does nothing yet. h7-raids
 * fills it in. Everything here must stay integer-only with fixed orders and no RNG, like the rest of the sim.
 */

/** R1: a raid's phase. */
export type RaidPhase = 'muster' | 'out' | 'fight' | 'home';

/** R1: the raid in progress (`world.raid`), or none (null). */
export interface Raid {
  id: number;
  phase: RaidPhase;
  /** The target node index (R5), fixed at muster; R6 may retarget it once. */
  target: number;
  /** The raiders, once launched (lowest id of each type first). Empty while mustering: they stay in the hive's guard list. */
  guards: Guard[];
  /** Ticks left in the current phase (the muster countdown, or the flight). */
  ticksLeft: number;
  /** R4: the raid's size by type, fixed at muster. */
  planned: GuardCounts;
}

/** R1: the raid state a new world starts with: no raid, and none before tick 0. */
export function initialRaidState(): { raid: Raid | null; nextRaidTick: number } {
  return { raid: null, nextRaidTick: 0 };
}

/**
 * F8, the raid hook. h7-sim: a no-op. Called once per field-mode tick, after movement (F7) and before combat at
 * guarded nodes (F10). It may change `world.raid`, `world.nextRaidTick`, the hive's guard list, economy ships and
 * warships; after removing a docked extractor it must call `syncExtractors(world)` (field.ts) so the node's
 * `extractors` count drops the same tick.
 */
export function raidStep(world: World, data: SimData): void {
  void world;
  void data;
}
