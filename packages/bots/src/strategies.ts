import type { Input, World } from '@factory4x/sim';

/**
 * A strategy looks at the world each tick and returns that tick's inputs.
 * Milestone 0: all four are stubs that exercise the pipeline. Milestone 1
 * gives at least two of them real behavior.
 */
export interface Strategy {
  name: string;
  description: string;
  decide(world: Readonly<World>): Input[];
}

const noop = (): Input[] => [];

export const strategies: Strategy[] = [
  { name: 'rush', description: 'Build ships as early as possible and attack the nearest guarded node.', decide: noop },
  { name: 'turtle', description: 'Maximize throughput and defense before any attack.', decide: noop },
  { name: 'greedy-expansion', description: 'Claim as many resource nodes as fast as possible.', decide: noop },
  { name: 'raid-supply', description: 'Target mob logistics and factories instead of their defenders.', decide: noop },
];
