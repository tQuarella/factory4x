import { describe, expect, it } from 'vitest';
import {
  createWorld,
  defaultData as data,
  deserializeWorld,
  raidProngs,
  serializeWorld,
  step,
  worldHash,
  type Input,
  type World,
} from '../src/index.ts';
import { referenceReplay } from '../../bots/src/reference-replay.ts';

/**
 * h10-sim acceptance 5: the H10 state is saved and validated (DESIGN.md H10 "Save, data version and replay"): the field's
 * `hiveRebuildProgress`, each prong's `rolls` and `hitRocks`, each result prong's `hitRocks` and `stats.raidRolls`. The saves
 * come from the reference replay (shipped data, as the game saves), which reaches a rebuild in progress and a roll.
 */
const inputsAt = (t: number): Input[] => referenceReplay.inputs.filter((e) => e.tick === t).map((e) => e.input);

/** The reference replay's world after `ticks` ticks. */
function replayTo(ticks: number): World {
  const w = createWorld(referenceReplay.seed, data);
  for (let t = 0; t < ticks; t++) step(w, data, inputsAt(t));
  return w;
}

function load(text: string): World {
  const r = deserializeWorld(text, data);
  if (!r.ok) throw new Error(`load failed: ${r.reason}`);
  return r.world;
}

/** Steps a loaded world and the uninterrupted one `n` ticks with the replay's inputs; returns the ticks where they differ. */
function diverges(loaded: World, live: World, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = live.tick;
    step(live, data, inputsAt(t));
    step(loaded, data, inputsAt(t));
    if (worldHash(loaded) !== worldHash(live)) out.push(t);
  }
  return out;
}

describe('save and load mid-rebuild and mid-roll', () => {
  it('a save with hiveRebuildProgress > 0 (tick 2400, the queue refilling after the lost push), loaded and stepped 2000 ticks, matches the uninterrupted run hash for hash', () => {
    const live = replayTo(2400);
    expect(live.field!.hiveRebuildProgress).toBe(150); // the deficit began at 2250 (after ticks 0-2399 are stepped)
    const loaded = load(serializeWorld(live));
    expect(worldHash(loaded)).toBe(worldHash(live));
    expect(diverges(loaded, live, 2000)).toEqual([]);
    // The span covered completions of the queue and raid 2 (muster 3600, launch 4049).
    expect(live.tick).toBe(4400);
  });

  it('a save while a prong rolls (tick 6150: raid 3\'s prong 0 on its way from p1 to a5) round-trips its rolls and hitRocks and plays on identically', () => {
    const live = replayTo(6150);
    const p0 = raidProngs(live.raid!)[0]!;
    expect([p0.phase, p0.target, p0.rolls, p0.hitRocks]).toEqual(['out', 5, 1, [8]]);
    expect(live.stats.raidRolls).toBe(1);
    const loaded = load(serializeWorld(live));
    expect(raidProngs(loaded.raid!)[0]).toEqual(p0);
    expect(diverges(loaded, live, 1000)).toEqual([]);
    // Over by then: the result's hitRocks came through the save too.
    expect(loaded.lastRaid!.prongs.map((p) => p.hitRocks)).toEqual([[8, 5], []]);
  });
});

describe('a malformed H10 save is refused as corrupt', () => {
  type Loose = Record<string, unknown>;
  type Save = { world: { field: Loose; stats: Loose; raid: Loose & { others?: Loose[] }; lastRaid: Loose & { prongs: Loose[] } } };
  // A save from mid-roll (a live raid with a rolled prong, a finished raid's result, a rebuild in progress).
  const base = (() => {
    const w = replayTo(6150);
    expect(w.field!.hiveRebuildProgress).toBeGreaterThan(0);
    expect(w.lastRaid).not.toBeNull();
    return serializeWorld(w);
  })();
  const bad = (f: (s: Save) => void): string => {
    const s = JSON.parse(base) as Save;
    f(s);
    return JSON.stringify(s);
  };

  it('the unbroken save loads', () => {
    expect(deserializeWorld(base, data).ok).toBe(true);
  });

  it.each([
    ['no hiveRebuildProgress', (s: Save) => delete s.world.field.hiveRebuildProgress],
    ['a negative hiveRebuildProgress', (s: Save) => (s.world.field.hiveRebuildProgress = -1)],
    ['a fractional hiveRebuildProgress', (s: Save) => (s.world.field.hiveRebuildProgress = 1.5)],
    ['a string hiveRebuildProgress', (s: Save) => (s.world.field.hiveRebuildProgress = '3')],
    ['a prong without rolls', (s: Save) => delete s.world.raid.rolls],
    ['a negative rolls', (s: Save) => (s.world.raid.rolls = -1)],
    ['a prong without hitRocks', (s: Save) => delete s.world.raid.hitRocks],
    ['hitRocks not a list', (s: Save) => (s.world.raid.hitRocks = 8)],
    ['hitRocks with a negative node', (s: Save) => (s.world.raid.hitRocks = [-1])],
    ['hitRocks with a repeat', (s: Save) => (s.world.raid.hitRocks = [8, 8])],
    ['a result prong without hitRocks', (s: Save) => delete s.world.lastRaid.prongs[0]!.hitRocks],
    ['no stats.raidRolls', (s: Save) => delete s.world.stats.raidRolls],
    ['a negative stats.raidRolls', (s: Save) => (s.world.stats.raidRolls = -2)],
  ])('%s', (_name, f) => {
    expect(deserializeWorld(bad(f), data)).toEqual({ ok: false, reason: 'corrupt', saveDataVersion: data.dataVersion });
  });
});
