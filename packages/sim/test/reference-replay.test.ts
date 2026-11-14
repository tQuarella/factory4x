import { describe, expect, it } from 'vitest';
import {
  PROBE,
  allocStatus,
  createWorld,
  defaultData as data,
  fleetStatus,
  isValidInput,
  raidStatus,
  replayHashes,
  rockStatus,
  step,
  type Input,
  type World,
} from '../src/index.ts';
import { referenceReplay } from '../../bots/src/reference-replay.ts';
import { applyInput } from '../src/inputs.ts';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * h7-sim acceptance 7: the reference replay (the determinism gate and the browser cross-engine check) runs in
 * field mode on the shipped data, as the gate does, and covers DESIGN.md H7 "Save, data version and replay", with
 * the raid items h7-raids added (a raid mustered, launched and beaten by defenders; a raid that hits an undefended
 * rock; the hive captured with a raid out, which withers): a landing; setAlloc changes, one to 0 that returns a share to stock; an
 * extractor dispatched and docked and an idle one re-dispatched; a hauler delivery; a setMine off; a pocket
 * capture that unlocks the Flak; a bay held by the fleet limit; and a recycleShips of an economy ship. Numbers are
 * read from the shipped data, not pinned; a calibration that breaks the script shows here (regenerate it then).
 */
describe('reference replay (field mode)', () => {
  expect(referenceReplay.start).toBeUndefined();
  const w: World = createWorld(referenceReplay.seed, data);
  const landing = { alloc: { ...w.field!.alloc }, stock: w.stock.ore, rally: w.rally };
  const typesApplied = new Set<string>();
  const ignored: string[] = [];
  let shareReturned: { tick: number; share: number; stockBefore: number; stockAfter: number; shareAfter: number } | null = null;
  let redispatched: { tick: number; id: number; to: number | null } | null = null;
  const unboundAtUnmark: number[] = [];
  let firstDock: { tick: number; node: number } | null = null;
  let fleetFullTicks = 0;
  let recycle: { tick: number; econBefore: number; econAfter: number; refund: number } | null = null;
  const raidLog: Array<{ tick: number; phase: string; target: number | null; raids: World['stats']['raids']; econ: number; warshipsAtTarget: number }> = [];
  let raidPhase = 'none:null';
  for (let t = 0; t < 9000; t++) {
    const inputs: Input[] = referenceReplay.inputs.filter((e) => e.tick === t).map((e) => e.input);
    const probe = inputs.length > 0 ? clone(w) : w;
    for (const input of inputs) {
      if (isValidInput(probe, data, input)) typesApplied.add(input.type);
      else ignored.push(`${t} ${JSON.stringify(input)}`);
      applyInput(probe, data, input);
    }
    const f = w.field!;
    const zeroing = inputs.find((i): i is Extract<Input, { type: 'setAlloc' }> => i.type === 'setAlloc' && i.weight === 0 && f.share[i.shipType] > 0);
    const before = zeroing ? { share: f.share[zeroing.shipType], stock: w.stock.ore } : null;
    const idle = f.econ.filter((s) => s.type === 'extractor' && s.target === null && s.at === PROBE && s.transit === null).map((s) => s.id);
    const unmark = inputs.find((i): i is Extract<Input, { type: 'setMine' }> => i.type === 'setMine' && !i.on && t > 0);
    const boundThere = unmark ? f.econ.filter((s) => s.type === 'extractor' && s.target === unmark.node).map((s) => s.id) : [];
    const econBefore = f.econ.length;
    const refundBefore = w.stats.oreRefunded;
    step(w, data, inputs);
    if (zeroing && before && shareReturned === null) {
      shareReturned = { tick: t, share: before.share, stockBefore: before.stock, stockAfter: w.stock.ore, shareAfter: f.share[zeroing.shipType] };
    }
    if (redispatched === null && idle.length > 0) {
      const s = f.econ.find((x) => idle.includes(x.id) && x.target !== null);
      if (s) redispatched = { tick: t, id: s.id, to: s.target };
    }
    if (unmark) for (const id of boundThere) if (f.econ.find((s) => s.id === id)!.target !== unmark.node) unboundAtUnmark.push(id);
    if (firstDock === null) {
      const n = w.nodes.find((x) => x.kind === 'asteroid' && rockStatus(w, x.index).docked > 0);
      if (n) firstDock = { tick: t, node: n.index };
    }
    if (fleetStatus(w, data).full && allocStatus(w, data).rows.some((r) => r.state === 'fleetFull')) fleetFullTicks++;
    const rst = raidStatus(w);
    if (`${rst.phase}:${rst.target}` !== raidPhase) {
      raidPhase = `${rst.phase}:${rst.target}`;
      raidLog.push({
        tick: t,
        phase: rst.phase,
        target: rst.target,
        raids: { ...w.stats.raids },
        econ: rst.econ,
        warshipsAtTarget: rst.target === null ? 0 : w.ships.filter((x) => x.at === rst.target).length,
      });
    }
    if (inputs.some((i) => i.type === 'recycleShips')) recycle = { tick: t, econBefore, econAfter: f.econ.length, refund: w.stats.oreRefunded - refundBefore };
  }
  const nodeId = (i: number): string => w.nodes[i]!.id;
  const t = data.tunables;

  it('lands in the field: the alloc.start weights with every warship at 0, economy.startStock ore, the rally at the probe', () => {
    expect(landing).toEqual({
      alloc: { extractor: t['alloc.start.extractor'].default, hauler: t['alloc.start.hauler'].default, drone: 0, lancer: 0, flak: 0 },
      stock: t['economy.startStock'].default,
      rally: PROBE,
    });
  });

  it('changes the allocation six times; the setAlloc to 0 at tick 280 returns the extractor share to stock', () => {
    expect(w.stats.allocChanges).toBe(6); // 450 x2, 280 x2, 850, and drone 5 at tick 7000
    expect(shareReturned).not.toBeNull();
    expect(shareReturned!.tick).toBe(280);
    expect(shareReturned!.share).toBeGreaterThan(0);
    expect(shareReturned!.shareAfter).toBe(0);
    expect(shareReturned!.stockAfter).toBeGreaterThanOrEqual(shareReturned!.stockBefore + shareReturned!.share);
  });

  it('dispatches and docks extractors, and re-dispatches an idle one the tick a3 is marked (tick 400)', () => {
    expect(firstDock).not.toBeNull();
    expect(nodeId(firstDock!.node)).toBe('a1');
    expect(redispatched).toMatchObject({ tick: 400 });
    expect(nodeId(redispatched!.to!)).toBe('a3');
  });

  it('haulers deliver ore and ice', () => {
    expect(w.stats.delivered.ore).toBeGreaterThan(0);
    expect(w.stats.firstDeliveredTick.ore).not.toBeNull();
    expect(w.stats.delivered.ice).toBeGreaterThan(0);
  });

  it('a setMine off (a1, tick 600) unbinds every extractor bound there', () => {
    // a1 has 2 slots, both filled by then.
    expect(unboundAtUnmark.length).toBe(2);
    expect(rockStatus(w, 1)).toMatchObject({ mine: false, bound: 0 });
  });

  it('the drones take the ice pocket p1 (then p2); its ice unlocks the Flak, which is built paying ice', () => {
    expect(w.stats.captures.map((c) => nodeId(c.node))).toEqual(['p1', 'p2', 'heart']);
    const p1 = w.stats.captures[0]!.tick;
    expect(w.stats.firstDeliveredTick.ice).toBeGreaterThan(p1);
    expect(w.stats.shipsBuilt.flak).toBeGreaterThanOrEqual(1);
    expect(rockStatus(w, 8)).toMatchObject({ mine: true, freeExtractors: 1 });
  });

  it('a bay is held by the fleet limit (fleetFull) for part of the run', () => {
    expect(fleetFullTicks).toBeGreaterThan(0);
  });

  it('recycles a docked extractor at a2 (tick 900) for its refund (the replay tunes ship.extractor.cost to 5)', () => {
    expect(recycle).not.toBeNull();
    expect(recycle!.tick).toBe(900);
    // One economy ship fewer after the tick (no economy bay finishes then: both economy weights are 0 from tick 280).
    expect(recycle!.econBefore).toBeGreaterThan(0);
    expect(recycle!.econAfter).toBe(recycle!.econBefore - 1);
    expect(recycle!.refund).toBe(Math.floor((5 * t['fleet.recycleRefundPct'].default) / 100));
    expect(w.stats.econRecycled).toEqual({ extractor: 1, hauler: 0 });
  });

  it('a raid musters once the economy reaches raid.firstAtEcon (tick 95), is mustered, launched at a1 and, a1 being stopped, retargets to the captured p1', () => {
    const first = raidLog.find((e) => e.phase === 'muster')!;
    expect(first.tick).toBe(95);
    expect(first.econ).toBeGreaterThanOrEqual(t['raid.firstAtEcon'].default);
    expect(nodeId(first.target!)).toBe('a1');
    const outs = raidLog.filter((e) => e.phase === 'out');
    // The log shows the state after the tick: the muster's first call is tick 95 and its last (the launch) is musterTicks - 1 later.
    expect(outs[0]!.tick - first.tick).toBe(t['raid.musterTicks'].default - 1);
    expect(nodeId(outs[0]!.target!)).toBe('a1');
    // Still raid 1: a1 was stopped at tick 600, and the raid retargeted once on arrival.
    expect(outs[1]!.raids.mustered).toBe(1);
    expect(nodeId(outs[1]!.target!)).toBe('p1');
    expect(outs[1]!.tick).toBeGreaterThan(600);
  });

  it('the first raid is beaten at p1 by the defenders there (no economy ship lost)', () => {
    const fight = raidLog.find((e) => e.phase === 'fight')!;
    expect(nodeId(fight.target!)).toBe('p1');
    expect(fight.warshipsAtTarget).toBeGreaterThan(0);
    const end = raidLog.find((e) => e.phase === 'none' && e.raids.beaten === 1)!;
    expect(end.tick).toBeGreaterThan(fight.tick);
    expect(end.raids).toEqual({ mustered: 1, beaten: 1, hit: 0, turnedBack: 0 });
  });

  it('the second raid hits p1 undefended: it kills a docked extractor and comes home (hit)', () => {
    const fights = raidLog.filter((e) => e.phase === 'fight');
    expect(fights.length).toBeGreaterThanOrEqual(2);
    expect(nodeId(fights[1]!.target!)).toBe('p1');
    expect(fights[1]!.warshipsAtTarget).toBe(0);
    const hit = raidLog.find((e) => e.phase === 'none' && e.raids.hit === 1)!;
    expect(hit.raids).toEqual({ mustered: 2, beaten: 1, hit: 1, turnedBack: 0 });
  });

  it('the hive is captured (tick 8010) with the third raid out at p1: it withers (removed, not counted as an outcome)', () => {
    const cap = w.stats.captures.find((c) => nodeId(c.node) === 'heart')!;
    expect(w.capturedTick).toBe(cap.tick);
    const third = raidLog.filter((e) => e.phase === 'fight')[2]!;
    expect(third.tick).toBeLessThan(cap.tick);
    const end = raidLog.find((e) => e.phase === 'none' && e.tick > third.tick)!;
    expect(end.tick).toBe(cap.tick);
    expect(w.raid).toBeNull();
    expect(w.lastRaid).toMatchObject({ id: 3, outcome: 'withered' });
    expect(w.stats.raids).toEqual({ mustered: 3, beaten: 1, hit: 1, turnedBack: 0 });
    expect(w.guardians.find((g) => nodeId(g.node) === 'heart')!.guards).toEqual([]);
  });

  it('uses every field input type it needs, with no input ignored', () => {
    expect([...typesApplied].sort()).toEqual(['recycleShips', 'sendShips', 'setAlloc', 'setMine', 'setRally', 'setTunable']);
    expect(ignored).toEqual([]);
  });

  it('is deterministic: two runs give the same 30 checkpoint hashes', () => {
    const a = replayHashes(referenceReplay, data, 9000, 300);
    const b = replayHashes(referenceReplay, data, 9000, 300);
    expect(a).toHaveLength(30);
    expect(a).toEqual(b);
  });
});
