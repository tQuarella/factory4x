import { describe, expect, it } from 'vitest';
import {
  SEND_ALL,
  createWorld,
  deserializeWorld,
  nextU32,
  replayHashes,
  serializeWorld,
  step,
  worldHash,
  type Input,
  type Replay,
  type World,
} from '../src/index.ts';
import { N, data, networkStep } from './helpers.ts';

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

/** A busy game: network script, the drone yard, a wave at a pocket at minute 6, some tuning. */
function busyGame(ticks: number): World {
  const w = createWorld(7, data);
  for (let i = 0; i < ticks; i++) {
    const inputs: Input[] = [];
    const next = networkStep(w);
    if (next) inputs.push(next);
    if (w.tick === 30 * 60 * 6) inputs.push({ type: 'sendShips', from: N.probe, to: N.p1, counts: SEND_ALL });
    if (w.tick === 30 * 60 * 7) inputs.push({ type: 'setTunable', key: 'route.podIntervalTicks', value: 60 });
    step(w, data, inputs);
  }
  return w;
}

describe('world', () => {
  it('is deterministic for the same seed and inputs', () => {
    const replay: Replay = {
      seed: 7,
      dataVersion: data.dataVersion,
      inputs: [
        { tick: 0, input: { type: 'buildExtractor', node: N.a1 } },
        { tick: 10, input: { type: 'buildRoute', from: N.a1, to: N.probe } },
        { tick: 400, input: { type: 'setTunable', key: 'ship.drone.cost', value: 5 } },
      ],
    };
    const a = replayHashes(replay, data, 1800, 300);
    expect(a).toEqual(replayHashes(replay, data, 1800, 300));
    expect(new Set(a).size).toBe(a.length);
  });

  it('a live setTunable in the input log changes the outcome, so replays must carry it', () => {
    const base: Replay = { seed: 1, dataVersion: data.dataVersion, inputs: [] };
    const tuned: Replay = { ...base, inputs: [{ tick: 100, input: { type: 'setTunable', key: 'economy.probeOrePerMin', value: 60 } }] };
    expect(replayHashes(tuned, data, 900, 900)).not.toEqual(replayHashes(base, data, 900, 900));
  });

  it('two busy games with the same inputs hash identically', () => {
    expect(worldHash(busyGame(30 * 60 * 8))).toBe(worldHash(busyGame(30 * 60 * 8)));
  });

  it('hash is independent of key insertion order', () => {
    const w = createWorld(3, data);
    const reordered = Object.fromEntries(Object.entries(w).reverse()) as unknown as World;
    expect(worldHash(reordered)).toEqual(worldHash(w));
  });

  it('step and replayHashes refuse data of another version', () => {
    const w = createWorld(1, data);
    const other = { ...data, dataVersion: 1 };
    expect(() => step(w, other, [])).toThrow(/data version/);
    expect(() => replayHashes({ seed: 1, dataVersion: 1, inputs: [] }, data, 10, 5)).toThrow(/data version/);
  });

  it('holds only plain JSON data (no undefined, NaN, classes or Maps)', () => {
    const w = busyGame(30 * 60 * 7);
    expect(JSON.parse(JSON.stringify(w))).toEqual(w);
  });
});

describe('autosave', () => {
  it('round trip: serialize → deserialize gives an identical hash, and both copies stay in lockstep', () => {
    const w = busyGame(30 * 60 * 7);
    const r = deserializeWorld(serializeWorld(w), data);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(worldHash(r.world)).toBe(worldHash(w));
    for (let i = 0; i < 1800; i++) {
      step(w, data, []);
      step(r.world, data, []);
    }
    expect(worldHash(r.world)).toBe(worldHash(w));
  });

  it('refuses a save from another data version', () => {
    const w = createWorld(1, data);
    const text = serializeWorld(w);
    const r = deserializeWorld(text, { ...data, dataVersion: data.dataVersion + 1 });
    expect(r).toEqual({ ok: false, reason: 'dataVersion', saveDataVersion: data.dataVersion });
  });

  it('refuses corrupt saves', () => {
    expect(deserializeWorld('{not json', data)).toMatchObject({ ok: false, reason: 'corrupt' });
    expect(deserializeWorld('null', data)).toMatchObject({ ok: false, reason: 'corrupt' });
    expect(deserializeWorld(JSON.stringify({ format: 1, dataVersion: 4, world: { tick: 1 } }), data)).toMatchObject({ ok: false, reason: 'corrupt' });
    // An H2-shaped world (stock a number, one shipyard) stamped with version 4 is corrupt, not loaded.
    const w = JSON.parse(serializeWorld(createWorld(1, data))) as { world: Record<string, unknown> };
    w.world.stock = 30;
    expect(deserializeWorld(JSON.stringify(w), data)).toMatchObject({ ok: false, reason: 'corrupt' });
    const g = JSON.parse(serializeWorld(createWorld(1, data))) as { world: { guardians: unknown[] } };
    g.world.guardians.pop();
    expect(deserializeWorld(JSON.stringify(g), data)).toMatchObject({ ok: false, reason: 'corrupt' });
  });
});
