import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts'],
    // The bot tests run whole 30-minute games (up to ~0.5 s alone, ~2 s with a dozen suites in parallel),
    // and the default 5 s per-test limit left little headroom when a loaded machine slowed a run to 28 s.
    // No test asserts on wall-clock time, so this only bounds a hang; it does not loosen any check.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
