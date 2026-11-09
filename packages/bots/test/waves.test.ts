import { describe, expect, it } from 'vitest';
import { campaignWorld, commandedBands, defaultData, isAreaOpen, isLaneOpen, type ShipType, type ShipTypeCounts } from '@factory4x/sim';
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
  trialSpecs,
  trialStart,
  waveWins,
  windowChecks,
  type HeartProbe,
  type TrialKind,
} from '../src/waves.ts';

const L = { l0: 12, l1: 18, l2: 24 };
const heartOf = (w: { nodes: { kind: string }[] }): number => w.nodes.findIndex((n) => n.kind === 'heart');
const ALL: ShipType[] = ['drone', 'lancer', 'flak'];

describe('probe world and limits', () => {
  it('limits are fleet.cap, plus one and two relay steps (h6-sim: fleet.relayStep replaced the removed Command limit step)', () => {
    const l0 = fx.tunables['fleet.cap'].default;
    const stepSize = fx.tunables['fleet.relayStep'].default;
    expect(probeLimits(fx)).toEqual({ l0, l1: l0 + stepSize, l2: l0 + 2 * stepSize });
    expect(probeLimits(fx)).toEqual({ l0: 12, l1: 20, l2: 28 });
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
    relay: false,
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

  const h6 = (tier: number, relay: boolean, d: number | null, l: number | null, f: number | null, mix: number | null, pocketDrones?: number | null): HeartProbe => ({
    ...r(tier, 'fed', d, l, f, mix),
    relay,
    ...(pocketDrones === undefined ? {} : { pocketDrones }),
  });
  const met = (row: HeartProbe): boolean[] => windowChecks(row, L).map((c) => c.met);

  it('marks each H6 window met or missed (premise: limits 12 / 18 / 24)', () => {
    // A plain light area: drones alone fit at L0.
    expect(met(h6(1, false, 10, 20, 20, 9))).toEqual([true]);
    expect(met(h6(1, false, 11, 20, 20, 9))).toEqual([false]);
    // A band 1 relay: closed to drones alone at L0, fits at L0 with the counter.
    expect(met(h6(1, true, 13, 20, 8, 9))).toEqual([true, true]);
    expect(met(h6(1, true, 12, 20, 8, 9))).toEqual([false, true]);
    expect(met(h6(1, true, 13, 20, 8, 11))).toEqual([true, false]);
    // Band 2 plain: closed at L0, fits at L1, no single type fits at L1, first pocket within L1.
    expect(met(h6(2, false, 40, 30, 20, 16, 8))).toEqual([true, true, true, true]);
    expect(met(h6(2, false, 40, 30, 16, 16, 8))).toEqual([true, true, false, true]);
    expect(met(h6(2, false, 40, 30, 20, 12, 19))).toEqual([false, true, true, false]);
    expect(met(h6(2, false, 40, 30, 20, 16))).toEqual([true, true, true, false]);
    // Band 2 relay: also binds at L1 (best mix >= L1 - 6 = 12).
    expect(met(h6(2, true, 40, 30, 20, 16, 8))).toEqual([true, true, true, true, true]);
    expect(met(h6(2, true, 40, 30, 20, 11, 8))[3]).toBe(false);
    expect(windowChecks(h6(2, true, 40, 30, 20, 16, 8), L).map((c) => c.name)).toContain('binds at L1 (mix >= 12)');
    // The Deep: closed at L1, fits at L2, no single type fits at L2, binds at L2 (>= 18).
    expect(met(h6(3, false, 60, 30, 40, 22))).toEqual([true, true, true, true]);
    expect(met(h6(3, false, 60, 30, 40, 18))).toEqual([false, true, true, true]);
    expect(met(h6(3, false, 60, 20, 40, 22))).toEqual([true, true, false, true]);
    expect(met(h6(3, false, 60, 30, 40, 17))).toEqual([false, true, true, false]);
  });
});

describe('trial starts (the shipped map; structure only, no tuned value)', () => {
  const data = defaultData;
  const world = (kind: TrialKind, area: string) => campaignWorld(1, data, trialStart(data, kind, area));

  it('each lands in its own area, behind the lock, with both designs', () => {
    for (const [kind, area] of [['band2-l0', 'veil'], ['band2-l0', 'mire'], ['deep-l1', 'deep'], ['relay-drones', 'rime']] as const) {
      const w = world(kind, area);
      expect(data.map.areas[w.campaign.active!]!.id).toBe(area);
      expect(w.campaign.research.lancer).toBe(1);
      expect(w.campaign.research.flak).toBe(1);
    }
  });

  it('the limit premise: band 2 and the relays land at L0 (no relay reclaimed), The Deep at L1 (one)', () => {
    for (const a of data.map.areas.filter((x) => x.tier === 2)) expect(commandedBands(world('band2-l0', a.id), data), a.id).toBe(0);
    for (const a of data.map.areas.filter((x) => x.tier === 1 && x.relay)) expect(commandedBands(world('relay-drones', a.id), data), a.id).toBe(0);
    expect(commandedBands(world('deep-l1', 'deep'), data)).toBe(1);
  });

  it('a band 2 trial lands behind a real lock: from the same start enterArea refuses the area (The Deep is behind the limit, not the lock)', () => {
    for (const area of ['veil', 'garden', 'mire', 'spire']) {
      const start = trialStart(data, 'band2-l0', area);
      const w = campaignWorld(1, data, { reclaimed: start.reclaimed ?? [], research: start.research ?? {} });
      const a = data.map.areas.findIndex((x) => x.id === area);
      expect(isLaneOpen(w, data, a), `${area} lane`).toBe(true);
      expect(isAreaOpen(w, data, a), `${area} open`).toBe(false);
    }
  });

  it('lists every trial: band 2 areas, The Deep once per seed, band 1 relays with drones only', () => {
    const specs = trialSpecs(data, 2);
    expect(specs.filter((t) => t.kind === 'band2-l0').map((t) => t.area)).toEqual(['veil', 'garden', 'mire', 'spire']);
    expect(specs.filter((t) => t.kind === 'deep-l1').map((t) => `${t.area}/${t.seed}`)).toEqual(['deep/1', 'deep/2']);
    expect(specs.filter((t) => t.kind === 'relay-drones').map((t) => [t.area, t.dronesOnly])).toEqual([['rime', true], ['glint', true]]);
    expect(specs.filter((t) => t.kind !== 'relay-drones').every((t) => !t.dronesOnly)).toBe(true);
  });
});
