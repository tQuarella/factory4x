import { describe, expect, it } from 'vitest';
import type { ShipType, ShipTypeCounts } from '@factory4x/sim';
// The frozen v8 fixture: the probe's numbers on it never move with calibration.
import { fixtureV8 as fx } from '../../sim/test/fixture.ts';
import {
  closedAt,
  fitsAt,
  locallyBuildable,
  minMix,
  minSingle,
  probeAll,
  probeHeart,
  probeLimits,
  probeWorld,
  singleClosedAt,
  singleFitsAt,
  waveWins,
  windowChecks,
  type HeartProbe,
} from '../src/waves.ts';

const L = { l0: 12, l1: 18, l2: 24 };
const heartOf = (w: { nodes: { kind: string }[] }): number => w.nodes.findIndex((n) => n.kind === 'heart');
const ALL: ShipType[] = ['drone', 'lancer', 'flak'];

describe('probe world and limits', () => {
  it('limits are fleet.cap, plus one and two Command limit steps', () => {
    expect(probeLimits(fx)).toEqual(L);
  });

  it('lands the area with both designs, every other area reclaimed and every yard off', () => {
    const w = probeWorld(1, fx, 'veil', false);
    expect(w.campaign.areas[w.campaign.active!]!.reclaimedTick).toBeNull();
    expect(w.campaign.research.lancer).toBe(1);
    expect(w.campaign.research.flak).toBe(1);
    expect(Object.values(w.yards).every((y) => !y.on)).toBe(true);
    expect(w.guardians.every((g) => g.alive)).toBe(true);
  });

  it('a starved world has the Root cut and no ships; an area without a Root cannot be starved', () => {
    const w = probeWorld(1, fx, 'veil', true);
    expect(w.guardians.find((g) => g.node === w.nodes.findIndex((n) => n.kind === 'root'))!.alive).toBe(false);
    expect(w.ships).toEqual([]);
    expect(w.tick % w.tun['combat.roundTicks']).toBe(0);
    expect(() => probeWorld(1, fx, 'shelf', true)).toThrow(/no Root/);
  });

  it('locally buildable types follow the area prizes (both designs assumed)', () => {
    expect(locallyBuildable(fx, 'shelf')).toEqual(['drone', 'flak']);
    expect(locallyBuildable(fx, 'shoal')).toEqual(['drone', 'lancer']);
    expect(locallyBuildable(fx, 'veil')).toEqual(ALL);
    expect(locallyBuildable(fx, 'garden')).toEqual(ALL);
    expect(locallyBuildable(fx, 'deep')).toEqual(ALL);
  });
});

describe('minimum waves', () => {
  it('the minimum single-type wave wins, one fewer loses (Frost Shelf heart)', () => {
    const w = probeWorld(1, fx, 'shelf', false);
    const node = heartOf(w);
    for (const type of ALL) {
      const n = minSingle(w, node, type, fx)!;
      const wave = (k: number): ShipTypeCounts => ({ drone: 0, lancer: 0, flak: 0, [type]: k });
      expect(waveWins(w, node, wave(n), fx)).toBe(true);
      expect(waveWins(w, node, wave(n - 1), fx)).toBe(false);
    }
  });

  it('gives up at the cap: a type that cannot win within it reports null', () => {
    const w = probeWorld(1, fx, 'veil', false);
    expect(minSingle(w, heartOf(w), 'drone', fx, 5)).toBeNull();
  });

  it('the minimum mix wins and no mix of one fewer ship does (brute force, starved Spore Veil heart)', () => {
    const w = probeWorld(1, fx, 'veil', true);
    const node = heartOf(w);
    const best = minMix(w, node, ALL, 30, fx)!;
    expect(best.total).toBe(best.fleet.drone + best.fleet.lancer + best.fleet.flak);
    expect(waveWins(w, node, best.fleet, fx)).toBe(true);
    const n = best.total - 1;
    for (let d = 0; d <= n; d++) for (let l = 0; l <= n - d; l++) expect(waveWins(w, node, { drone: d, lancer: l, flak: n - d - l }, fx)).toBe(false);
  });

  it('a mix restricted to some types never uses the others, and is never smaller than the unrestricted minimum', () => {
    const w = probeWorld(1, fx, 'shelf', false);
    const node = heartOf(w);
    const free = minMix(w, node, ALL, 30, fx)!;
    const local = minMix(w, node, ['drone', 'flak'], 30, fx)!;
    expect(local.fleet.lancer).toBe(0);
    expect(local.total).toBeGreaterThanOrEqual(free.total);
    expect(minMix(w, node, ['drone'], 30, fx)!.fleet).toEqual({ drone: minSingle(w, node, 'drone', fx), lancer: 0, flak: 0 });
  });

  it('is null when nothing within the cap wins, and reports the first mix in the fixed order (fewest drones)', () => {
    const w = probeWorld(1, fx, 'veil', false);
    expect(minMix(w, heartOf(w), ALL, 3, fx)).toBeNull();
    const s = probeWorld(1, fx, 'veil', true);
    const best = minMix(s, heartOf(s), ALL, 30, fx)!;
    // Any mix with fewer drones and the same total that wins would have been found first.
    const node = heartOf(s);
    for (let d = 0; d < best.fleet.drone; d++) {
      for (let l = 0; l <= best.total - d; l++) expect(waveWins(s, node, { drone: d, lancer: l, flak: best.total - d - l }, fx)).toBe(false);
    }
  });
});

describe('heart probe', () => {
  it('a starved heart is no harder than its fed heart, for every type and the mix', () => {
    const fed = probeHeart(1, fx, 'garden', false);
    const starved = probeHeart(1, fx, 'garden', true);
    for (const k of ['drones', 'lancers', 'flak'] as const) expect(starved[k]!).toBeLessThanOrEqual(fed[k] ?? 81);
    expect(starved.mix!).toBeLessThanOrEqual(fed.mix!);
    expect(starved.state).toBe('starved');
    expect(fed.mixFleet!.drone + fed.mixFleet!.lancer + fed.mixFleet!.flak).toBe(fed.mix);
  });

  it('probes every tier 1 or higher heart, fed and starved where there is a Root, The Deep once per seed (two here) with its layout', () => {
    const seen: string[] = [];
    const rows = probeAll(fx, 2, (r) => seen.push(`${r.area}${r.layout ? `/${r.layout}` : ''} ${r.state}`));
    expect(seen).toEqual(rows.map((r) => `${r.area}${r.layout ? `/${r.layout}` : ''} ${r.state}`));
    expect(rows.filter((r) => r.tier === 1).map((r) => [r.area, r.state])).toEqual([['shelf', 'fed'], ['shoal', 'fed']]);
    expect(rows.filter((r) => r.tier === 2).map((r) => `${r.area} ${r.state}`)).toEqual(['veil fed', 'veil starved', 'garden fed', 'garden starved']);
    const deep = rows.filter((r) => r.tier === 3);
    expect(deep.map((r) => r.seed)).toEqual([1, 1, 2, 2]);
    expect(new Set(deep.map((r) => r.layout)).size).toBe(2);
  });

  it('is deterministic', () => {
    expect(probeHeart(2, fx, 'deep', true)).toEqual(probeHeart(2, fx, 'deep', true));
  });
});

describe('windows', () => {
  const r = (tier: number, state: 'fed' | 'starved', d: number | null, l: number | null, f: number | null, mix: number | null): HeartProbe => ({
    area: 'x',
    tier,
    state,
    layout: null,
    seed: 1,
    drones: d,
    lancers: l,
    flak: f,
    buildable: ALL,
    mix,
    mixFleet: null,
  });

  it('fits means at most L - 2, closed means above L (no win in the search is closed)', () => {
    expect(fitsAt(10, 12)).toBe(true);
    expect(fitsAt(11, 12)).toBe(false);
    expect(fitsAt(null, 12)).toBe(false);
    expect(closedAt(12, 12)).toBe(false);
    expect(closedAt(13, 12)).toBe(true);
    expect(closedAt(null, 12)).toBe(true);
    expect(singleFitsAt(10, 12)).toBe(true);
    expect(singleClosedAt(null, 12)).toBe(true);
    expect(singleClosedAt(12, 12)).toBe(false);
  });

  it('marks each tier window met or missed', () => {
    expect(windowChecks(r(1, 'fed', 10, 20, 20, 9), L).map((c) => c.met)).toEqual([true]);
    expect(windowChecks(r(1, 'fed', 11, 20, 20, 9), L).map((c) => c.met)).toEqual([false]);
    // Tier 2 fed: closed at L0, fits at L1, no single type fits at L1.
    expect(windowChecks(r(2, 'fed', 40, 30, 20, 16), L).map((c) => c.met)).toEqual([true, true, true]);
    expect(windowChecks(r(2, 'fed', 40, 30, 16, 16), L).map((c) => c.met)).toEqual([true, true, false]);
    // Tier 2 starved: fits at L0, drones closed at L1.
    expect(windowChecks(r(2, 'starved', 19, 9, 9, 10), L).map((c) => c.met)).toEqual([true, true]);
    expect(windowChecks(r(2, 'starved', 18, 9, 9, 11), L).map((c) => c.met)).toEqual([false, false]);
    // Tier 3 starved: fits at L1, closed at L0, drones closed at L2. Fed: closed at L1, fits at L2.
    expect(windowChecks(r(3, 'starved', 25, 9, 9, 14), L).map((c) => c.met)).toEqual([true, true, true]);
    expect(windowChecks(r(3, 'fed', 60, 30, 40, 22), L).map((c) => c.met)).toEqual([true, true]);
    expect(windowChecks(r(3, 'fed', 60, 30, 40, 18), L).map((c) => c.met)).toEqual([false, true]);
  });
});
