import simData from '../../../data/sim.json' with { type: 'json' };
import type { SimData } from './world.ts';

export * from './world.ts';
export { nextU32, nextInt } from './rng.ts';
export { hashState, canonicalize, fnv1a } from './hash.ts';

/** Default tunables from data/sim.json. Callers may pass edited copies (tuning panel). */
export const defaultData: SimData = simData;
