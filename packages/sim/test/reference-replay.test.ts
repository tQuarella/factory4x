import { describe, expect, it } from 'vitest';
import {
  PROBE,
  allocStatus,
  createWorld,
  defaultData as data,
  fleetStatus,
  isValidInput,
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
 * field mode on the shipped data, as the gate does, and covers DESIGN.md H7 "Save, data version and replay" up to
 * the raid items (h7-raids adds those): a landing; setAlloc changes, one to 0 that returns a share to stock; an
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

  it('changes the allocation five times; the setAlloc to 0 at tick 280 returns the extractor share to stock', () => {
    expect(w.stats.allocChanges).toBe(5);
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
    expect(w.stats.captures.map((c) => nodeId(c.node))).toEqual(['p1', 'p2']);
    const p1 = w.stats.captures[0]!.tick;
    expect(w.stats.firstDeliveredTick.ice).toBeGreaterThan(p1);
    expect(w.stats.shipsBuilt.flak).toBeGreaterThanOrEqual(1);
    expect(rockStatus(w, 8)).toMatchObject({ mine: true, freeExtractors: 1 });
  });

  it('a bay is held by the fleet limit (fleetFull) for part of the run', () => {
    expect(fleetFullTicks).toBeGreaterThan(0);
  });

  it('recycles a docked extractor at a2 (tick 900) for its refund (the replay tunes ship.extractor.cost to 5)', () => {
    expect(recycle).toEqual({ tick: 900, econBefore: recycle!.econBefore, econAfter: recycle!.econBefore - 1, refund: Math.floor((5 * t['fleet.recycleRefundPct'].default) / 100) });
    expect(w.stats.econRecycled).toEqual({ extractor: 1, hauler: 0 });
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
