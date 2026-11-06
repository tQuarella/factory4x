import { describe, expect, it } from 'vitest';
import { createWorld, defaultData, nextU32, replayHashes, step, worldHash, type Replay } from '../src/index.ts';

describe('rng', () => {
  it('produces a fixed sequence for a fixed seed', () => {
    const s = { rng: 42 };
    const seq = [nextU32(s), nextU32(s), nextU32(s)];
    const t = { rng: 42 };
    expect([nextU32(t), nextU32(t), nextU32(t)]).toEqual(seq);
    // Golden values: if these change, every existing replay breaks.
    expect(seq).toMatchInlineSnapshot(`
      [
        2581720956,
        1925393290,
        3661312704,
      ]
    `);
  });
});

describe('world', () => {
  it('is deterministic for the same seed and inputs', () => {
    const replay: Replay = {
      seed: 7,
      dataVersion: defaultData.dataVersion,
      inputs: [{ tick: 10, input: { type: 'boost', amount: 5 } }],
    };
    expect(replayHashes(replay, defaultData, 900, 300)).toEqual(replayHashes(replay, defaultData, 900, 300));
  });

  it('diverges for different seeds', () => {
    const a = createWorld(1, defaultData);
    const b = createWorld(2, defaultData);
    for (let i = 0; i < 100; i++) {
      step(a, defaultData, []);
      step(b, defaultData, []);
    }
    expect(worldHash(a)).not.toEqual(worldHash(b));
  });

  it('hash is independent of key insertion order', () => {
    const w = createWorld(3, defaultData);
    const reordered = { probe: w.probe, dataVersion: w.dataVersion, rng: w.rng, tick: w.tick };
    expect(worldHash(reordered as typeof w)).toEqual(worldHash(w));
  });
});
