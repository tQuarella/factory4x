/**
 * Seeded 32-bit PRNG (mulberry32). Integer-only, so it gives identical
 * sequences in every JS engine. The state is a plain number stored in the
 * world, which keeps it serializable and hashable.
 */
export function nextU32(state: { rng: number }): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** Uniform integer in [0, n). n must be a positive integer below 2^32. */
export function nextInt(state: { rng: number }, n: number): number {
  return nextU32(state) % n;
}
