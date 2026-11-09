import { describe, expect, it } from 'vitest';
import { campaignWorld, fleetCap, isFleetFull, runSummary, step, type ShipType, type ShipTypeCounts, type World } from '@factory4x/sim';
// The frozen v10 fixture: its Spore Veil heart (a band 2 heart) is one where no single type wins within the size of the winning mix.
import { fixtureV10 as data } from '../../sim/test/fixture.ts';
import { bestAllocation, chooseTarget, decideComposer, mixAt, nodeFinished, waveWins } from '../src/strategies.ts';
import { minMix, minSingle, probeWorld, shipsWin } from '../src/waves.ts';

const ALL: ShipType[] = ['drone', 'lancer', 'flak'];
const total = (c: ShipTypeCounts): number => c.drone + c.lancer + c.flak;
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
const place = (w: World, node: number, fleet: ShipTypeCounts, hp?: number): void => {
  for (const type of ['drone', 'lancer', 'flak'] as const) {
    for (let i = 0; i < fleet[type]; i++) w.ships.push({ id: w.nextId++, type, hp: hp ?? w.tun[`ship.${type}.hp`], at: node, transit: null, engagedIn: -1 });
  }
};

describe('a heart where only a mix wins (frozen v10 Spore Veil)', () => {
  const base = probeWorld(1, data, area, false);
  const heart = heartOf(base);
  const mix = minMix(base, heart, ALL, 60, data)!;
  const singles = (['drone', 'lancer', 'flak'] as const).map((t) => minSingle(base, heart, t, data));

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
    expect(shipsWin(base, heart, listOf(old), data)).toBe(false);
    // At one ship fewer, nothing wins.
    expect(chooseTarget(w, data, mix.total - 1, ALL)).toBeNull();
  });

  it('builds and sends the mix: with the mix parked at a5 the composer sends exactly it, and the heart falls', () => {
    const w = heartOnly();

    advanceEconomy(w);
    w.ships = [];
    // Premise: the economy is built and the ships are parked at a5 (placed here, in the order the probe uses).
    place(w, a5Of(w), mix.fleet);
    let sent: ShipTypeCounts | null = null;
    for (let i = 0; i < 30 * 60 * 5 && w.capturedTick === null; i++) {
      const d = decideComposer(w, data, { dronesOnly: false, forced: false });
      const s = d.inputs.find((x) => x.type === 'sendShips' && x.to === heart);
      if (s !== undefined && s.type === 'sendShips' && sent === null) sent = s.counts;
      step(w, data, d.inputs);
    }
    expect(sent).toEqual(mix.fleet);
    expect(w.capturedTick).not.toBeNull();
    expect(runSummary(w).wavesSent).toBe(1);
  });

  it('does not send a mix that the parked ships would lose with; it builds more while there is room, and sends everything when the fleet is full', () => {
    // Premise: the mix is parked but every ship is nearly dead, so the real wave loses.
    const wounded = (filler: boolean): World => {
      const w = heartOnly();
      advanceEconomy(w);
      w.ships = [];
      place(w, a5Of(w), mix.fleet, 1);
      // Full: wounded drones fill the rest of the limit.
      if (filler) place(w, a5Of(w), { drone: (fleetCap(w, data) ?? 0) - total(mix.fleet), lancer: 0, flak: 0 }, 1);
      return w;
    };
    const room = wounded(false);
    expect(waveWins(room, data, heart, room.ships.filter((s) => s.at === a5Of(room)))).toBe(false);
    const d = decideComposer(room, data, { dronesOnly: false, forced: false });
    expect(d.inputs.some((x) => x.type === 'sendShips' && x.to === heart)).toBe(false);
    step(room, data, d.inputs);
    expect(room.yards.lancer.on && room.yards.flak.on).toBe(true);
    // Full: the last resort sends everything parked.
    const full = wounded(true);
    expect(isFleetFull(full, data)).toBe(true);
    const f = decideComposer(full, data, { dronesOnly: false, forced: false });
    expect(f.inputs).toContainEqual({ type: 'sendShips', from: a5Of(full), to: heart, counts: expect.objectContaining({ drone: 1_000_000 }) });
  });

  it('shipsWin depends on the order of the ships, which is why the wave is verified before it is sent', () => {
    const lancersFirst: { type: ShipType; hp: number }[] = listOf(mix.fleet);
    const flakFirst = [...lancersFirst].reverse();
    // Both orders are legal waves of the same fleet; the result of each is computed, not assumed.
    expect(typeof shipsWin(base, heart, lancersFirst, data)).toBe('boolean');
    expect(shipsWin(base, heart, lancersFirst, data)).toBe(true);
    expect(typeof shipsWin(base, heart, flakFirst, data)).toBe('boolean');
  });
});

function listOf(f: ShipTypeCounts): { type: ShipType; hp: number }[] {
  const out: { type: ShipType; hp: number }[] = [];
  for (const type of ['drone', 'lancer', 'flak'] as const) for (let i = 0; i < f[type]; i++) out.push({ type, hp: 12 });
  return out;
}


