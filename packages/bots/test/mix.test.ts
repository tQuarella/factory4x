import { describe, expect, it } from 'vitest';
import { campaignWorld, step, type ShipType, type ShipTypeCounts, type World } from '@factory4x/sim';
// The frozen v10 fixture: its Spore Veil heart (a band 2 heart) is one where no single type wins within the size of the winning mix.
import { fixtureV10 as data } from '../../sim/test/fixture.ts';
import { MAX_WAVES, bestAllocation, chooseTarget, decideComposer, mixAt, nodeFinished, raisedMix, winningMix } from '../src/strategies.ts';
import { minMix, minSingle, probeWorld, waveWins } from '../src/waves.ts';

const ALL: ShipType[] = ['drone', 'lancer', 'flak'];
const area = 'veil';
/** The area landed with every other area reclaimed and both designs, only its heart left guarded (so the heart is the target). */
function heartOnly(): World {
  const w = campaignWorld(1, data, { reclaimed: data.map.areas.map((a) => a.id).filter((a) => a !== area), research: { lancer: 1, flak: 1 }, land: area });
  const heart = w.nodes.findIndex((n) => n.kind === 'heart');
  for (const g of w.guardians) if (g.node !== heart) g.alive = false;
  // Premise: ice and crystal have been delivered, so the lancer and flak yards are unlocked.
  w.stats.firstDeliveredTick.ice = 0;
  w.stats.firstDeliveredTick.crystal = 0;
  return w;
}
const heartOf = (w: World): number => w.nodes.findIndex((n) => n.kind === 'heart');
const a5Of = (w: World): number => w.nodes.find((n) => n.id === 'a5')!.index;
/** Plays the composer with no ships until the economy plan is finished (its first phase), so what follows is the attack phase alone. */
function advanceEconomy(w: World): void {
  const econ = ['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => w.nodes.findIndex((n) => n.id === id)).filter((n) => n >= 0);
  for (let i = 0; i < 30 * 60 * 20 && !econ.every((n) => nodeFinished(w, n)); i++) step(w, data, decideComposer(w, data, { dronesOnly: false, forced: false }).inputs);
  if (!econ.every((n) => nodeFinished(w, n))) throw new Error('the economy never finished');
}
/** The attack phase alone: economy done, no ships, then `fleet` parked at a5 in `order` (the order sets their ids). */
function parked(fleet: ShipTypeCounts, order: readonly ShipType[] = ['drone', 'lancer', 'flak']): World {
  const w = heartOnly();
  advanceEconomy(w);
  w.ships = [];
  const a5 = a5Of(w);
  for (const type of order) for (let i = 0; i < fleet[type]; i++) w.ships.push({ id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at: a5, transit: null, engagedIn: -1 });
  return w;
}
const sendsToHeart = (w: World): boolean => decideComposer(w, data, { dronesOnly: false, forced: false }).inputs.some((x) => x.type === 'sendShips' && x.to === heartOf(w));
/** Plays the composer until the heart falls or `minutes` pass; the waves it sent at the heart. */
function play(w: World, minutes: number): number {
  let waves = 0;
  const heart = heartOf(w);
  for (let i = 0; i < 30 * 60 * minutes && w.capturedTick === null; i++) {
    const d = decideComposer(w, data, { dronesOnly: false, forced: false });
    if (d.inputs.some((x) => x.type === 'sendShips' && x.to === heart)) waves++;
    step(w, data, d.inputs);
  }
  return waves;
}

describe('a heart where only a mix wins (frozen v10 Spore Veil)', () => {
  const base = probeWorld(1, data, area, false);
  const heart = heartOf(base);
  const mix = minMix(base, heart, ALL, 60, data)!;
  const singles = (['drone', 'lancer', 'flak'] as const).map((t) => minSingle(base, heart, t, data));
  const without = (f: ShipTypeCounts, t: ShipType): ShipTypeCounts => ({ ...f, [t]: f[t] - 1 });

  it('premise: no single type wins within the mix size, and the mix has both counters', () => {
    expect(mix.fleet.lancer).toBeGreaterThan(0);
    expect(mix.fleet.flak).toBeGreaterThan(0);
    for (const s of singles) expect(s === null || s > mix.total).toBe(true);
  });

  it('the composer targets exactly that mix at a limit equal to its size; the old best-power fleet there is one type and loses', () => {
    const w = heartOnly();
    const t = chooseTarget(w, data, mix.total, ALL)!;
    expect(t.passes).toBe(true);
    expect(t.node).toBe(heart);
    expect(t.fleet).toEqual(mix.fleet);
    expect(mixAt(w, data, heart, mix.total, ALL)).toEqual(mix);
    // The H5 allocation maximises a linear power estimate, so it is one type, and that fleet loses on the real sim.
    const old = bestAllocation(w, heart, mix.total, ALL).fleet;
    expect([old.drone, old.lancer, old.flak].filter((n) => n > 0)).toHaveLength(1);
    expect(waveWins(base, heart, old, data)).toBe(false);
    // At one ship fewer, nothing wins.
    expect(chooseTarget(w, data, mix.total - 1, ALL)).toBeNull();
  });

  it('attacks when the parked ships include the mix of each type: the heart falls in one wave', () => {
    const w = parked(mix.fleet);
    expect(play(w, 5)).toBe(1);
    expect(w.capturedTick).not.toBeNull();
  });

  it('build order does not matter (combat amendment): the same ships parked flak-first fall in one wave too', () => {
    const w = parked(mix.fleet, ['flak', 'lancer', 'drone']);
    expect(play(w, 5)).toBe(1);
    expect(w.capturedTick).not.toBeNull();
  });

  it('extra ships parked beyond the mix go along and still win (the result is monotone in counts)', () => {
    const w = parked({ ...mix.fleet, drone: mix.fleet.drone + 3 });
    expect(play(w, 5)).toBe(1);
    expect(w.capturedTick).not.toBeNull();
  });

  it('does not attack while a type is short of the mix, however many other ships are parked; it builds the missing type', () => {
    for (const t of ['lancer', 'flak'] as const) {
      const w = parked({ ...without(mix.fleet, t), drone: 6 });
      expect(sendsToHeart(w)).toBe(false);
      step(w, data, decideComposer(w, data, { dronesOnly: false, forced: false }).inputs);
      expect(w.yards[t].on).toBe(true);
    }
  });

  it('after a repel it raises its threshold by 5/4 up to the limit, and records the node closed after MAX_WAVES', () => {
    const w = heartOnly();
    const limit = 40;
    expect(winningMix(w, data, heart, limit, ALL)).toEqual(mix);
    w.guardians.find((g) => g.node === heart)!.wavesSent = 1;
    const raised = winningMix(w, data, heart, limit, ALL)!;
    expect(raised).toEqual(raisedMix(mix, 1, limit));
    for (const t of ALL) expect(raised.fleet[t]).toBe(Math.ceil((mix.fleet[t] * 5) / 4));
    expect(raised.total).toBeGreaterThan(mix.total);
    w.guardians.find((g) => g.node === heart)!.wavesSent = MAX_WAVES;
    expect(winningMix(w, data, heart, limit, ALL)).toBeNull();
    expect(chooseTarget(w, data, limit, ALL)).toBeNull();
  });

  it('a repelled node is retried only with the raised mix parked: the base mix alone no longer sends', () => {
    const w = parked(mix.fleet);
    w.guardians.find((g) => g.node === heart)!.wavesSent = 1;
    expect(sendsToHeart(w)).toBe(false);
    const w2 = parked(raisedMix(mix, 1, 40).fleet);
    w2.guardians.find((g) => g.node === heart)!.wavesSent = 1;
    expect(sendsToHeart(w2)).toBe(true);
  });
});

describe('raisedMix', () => {
  const mix = { total: 10, fleet: { drone: 2, lancer: 5, flak: 3 } };
  it('scales each type by (5/4)^waves rounded up', () => {
    expect(raisedMix(mix, 0, 99)).toEqual(mix);
    expect(raisedMix(mix, 1, 99).fleet).toEqual({ drone: 3, lancer: 7, flak: 4 });
    expect(raisedMix(mix, 2, 99).fleet).toEqual({ drone: 4, lancer: 8, flak: 5 });
  });
  it('is trimmed from the largest type to fit the limit', () => {
    const r = raisedMix(mix, 1, 12);
    expect(r.total).toBe(12);
    expect(r.fleet).toEqual({ drone: 3, lancer: 5, flak: 4 });
    expect(raisedMix(mix, 1, 14).total).toBe(14);
  });
});
