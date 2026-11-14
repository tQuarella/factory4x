import { describe, expect, it } from 'vitest';
import {
  PROBE,
  allocStatus,
  createWorld,
  defaultData as data,
  fleetStatus,
  isValidInput,
  isHaulable,
  isStaffed,
  movePreview,
  raidStatus,
  recycleOrder,
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
  // h8-sim: the H8 items (from tick 8100).
  const picks: Array<{ tick: number; id: number; to: number; short: number; maxShort: number; staffed: boolean; haulable: boolean }> = [];
  const leaves: Array<{ tick: number; id: number; from: number; to: number | null }> = [];
  let enoughTicks = 0;
  // h8-sim round 2: the staffed-rock wait and the Extractor's enough.
  let p1Captured: ReturnType<typeof rockStatus> | null = null;
  const waits: Array<{ tick: number; id: number; node: number }> = [];
  const loads: Array<{ tick: number; id: number; node: number; cargo: number }> = [];
  const firstDockAt: Record<number, number> = {};
  const extLog: Array<{ tick: number; state: string; weight: number; share: number; bay: number; bayBefore: number; inputs: string[] }> = [];
  const moves: Array<{ tick: number; from: number; to: number; part: string; preview: { drone: number; lancer: number; flak: number }; moved: { drone: number; lancer: number; flak: number }; at: { drone: number; lancer: number; flak: number } }> = [];
  let fleetRecycle: { tick: number; orderHaulers: Array<{ id: number; at: number | null; target: number | null }>; orderExtractors: Array<{ id: number; at: number | null; docked: boolean }>; gone: number[]; slotsBefore: number; slotsAfter: number } | null = null;
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
    const targetBefore = new Map(probe.field!.econ.filter((s) => s.type === 'hauler').map((s) => [s.id, s.target]));
    const moveInputs = inputs.filter((i): i is Extract<Input, { type: 'moveShips' }> => i.type === 'moveShips');
    const moveBefore = moveInputs.map((i) => ({ i, preview: movePreview(w, i.from, i.part), ids: w.ships.filter((s) => s.at === i.from).map((s) => s.id) }));
    const fleetIn = inputs.find((i) => i.type === 'recycleFleet');
    const orderBefore = fleetIn
      ? {
          haulers: recycleOrder(w, 'hauler').map((s) => ({ id: s.id, at: s.at, target: 'target' in s ? s.target : null })),
          extractors: recycleOrder(w, 'extractor').map((s) => ({ id: s.id, at: s.at, docked: 'target' in s && s.at !== null && s.at === s.target && s.transit === null })),
          slots: rockStatus(w, 2).bound,
        }
      : null;
    const extBefore = { bay: f.bays.extractor.ticksLeft, share: f.share.extractor };
    step(w, data, inputs);
    if (p1Captured === null && w.stats.captures.length > 0) p1Captured = rockStatus(w, 8);
    if (t >= 8100) {
      // Each hauler pick against the shortfalls F6 saw: the targets after the tick (nothing after F6 changes them:
      // F2 can, when an extractor share fills, so the tick's start is not the right baseline) minus the haulers
      // assigned before F6 (after this tick's inputs), then leaves and picks in id order, as F6 makes them.
      const assignedPre = w.nodes.map(() => 0);
      for (const [, tg] of targetBefore) if (tg !== null) assignedPre[tg] = assignedPre[tg]! + 1;
      const short = w.nodes.map((n) => rockStatus(w, n.index).haulerTarget - assignedPre[n.index]!);
      for (const s of f.econ) {
        if (s.type !== 'hauler') continue;
        const was = targetBefore.get(s.id) ?? null;
        if (was === s.target) continue;
        if (was !== null) {
          short[was] = short[was]! + 1;
          leaves.push({ tick: t, id: s.id, from: was, to: s.target });
        }
        if (s.target !== null) {
          picks.push({ tick: t, id: s.id, to: s.target, short: short[s.target]!, maxShort: Math.max(...short), staffed: isStaffed(w, s.target), haulable: isHaulable(w, s.target) });
          short[s.target] = short[s.target]! - 1;
        }
      }
      if (allocStatus(w, data).rows.find((r) => r.type === 'hauler')!.state === 'enough') enoughTicks++;
      // Haulers waiting (parked, empty) at a rock no extractor works yet.
      for (const s of f.econ) {
        if (s.type === 'hauler' && s.transit === null && s.at !== null && s.at !== PROBE && s.at === s.target && w.nodes[s.at]!.extractors === 0) {
          waits.push({ tick: t, id: s.id, node: s.at });
        }
        // A hauler that loaded and left a rock this tick.
        if (s.type === 'hauler' && s.cargo > 0 && s.transit !== null && s.transit.totalTicks === s.transit.ticksLeft + 1 && s.transit.to === PROBE) {
          loads.push({ tick: t, id: s.id, node: s.transit.from, cargo: s.cargo });
        }
      }
      for (const n of w.nodes) if (n.kind === 'asteroid' && firstDockAt[n.index] === undefined && rockStatus(w, n.index).docked > 0 && t > 8700) firstDockAt[n.index] = t;
      const ex = allocStatus(w, data).rows.find((r) => r.type === 'extractor')!;
      extLog.push({ tick: t, state: ex.state, weight: ex.weight, share: ex.share, bay: f.bays.extractor.ticksLeft, bayBefore: extBefore.bay, inputs: inputs.map((i) => i.type) });
    }
    for (const m of moveBefore) {
      const moved = { drone: 0, lancer: 0, flak: 0 };
      const at = { drone: 0, lancer: 0, flak: 0 };
      for (const s of w.ships) if (m.ids.includes(s.id) && s.transit !== null && s.transit.to === m.i.to) moved[s.type] += 1;
      for (const id of m.ids) {
        const s = w.ships.find((x) => x.id === id);
        if (s) at[s.type] += 1;
      }
      moves.push({ tick: t, from: m.i.from, to: m.i.to, part: m.i.part, preview: { ...m.preview }, moved, at });
    }
    if (fleetIn && orderBefore) {
      const alive = new Set([...f.econ.map((s) => s.id), ...w.ships.map((s) => s.id)]);
      const gone = [...orderBefore.haulers, ...orderBefore.extractors].map((s) => s.id).filter((id) => !alive.has(id));
      fleetRecycle = { tick: t, orderHaulers: orderBefore.haulers, orderExtractors: orderBefore.extractors, gone, slotsBefore: orderBefore.slots, slotsAfter: rockStatus(w, 2).bound };
    }
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

  it('changes the allocation nine times; the setAlloc to 0 at tick 280 returns the extractor share to stock', () => {
    expect(w.stats.allocChanges).toBe(10); // 450 x2, 280 x2, 850, drone 5 at tick 7000, h8-sim's three at 8100 and extractor 3 at 8660
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
    // At its capture (the script unmarks p1 at 8670, for the H8 items).
    expect(p1Captured).toMatchObject({ mine: true, freeExtractors: 1 });
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
    // This extractor, plus (h8-sim) the recycleFleet at 8488: 1 extractor and 4 haulers.
    expect(w.stats.econRecycled).toEqual({ extractor: 2, hauler: 4 });
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

  // h8-sim (DESIGN.md H8 "Save, data version and replay"), after the hive falls, with hauler.autoNeed back to 1.
  it('H8: hauler.autoNeed 0 until tick 8100 (H7 haulers for the H7 items), 1 from then on', () => {
    const tuned = referenceReplay.inputs.filter((e) => e.input.type === 'setTunable' && e.input.key === 'hauler.autoNeed').map((e) => [e.tick, (e.input as Extract<Input, { type: 'setTunable' }>).value]);
    expect(tuned).toEqual([[0, 0], [8100, 1]]);
    expect(w.tun['hauler.autoNeed']).toBe(1);
  });

  it('H8 H2: need-based assignment: every hauler pick from 8100 takes a rock with the largest shortfall, above 0 (the three new haulers and the rebalanced one)', () => {
    expect(picks.length).toBeGreaterThanOrEqual(4);
    for (const p of picks) {
      expect(p.short, JSON.stringify(p)).toBeGreaterThan(0);
      expect(p.short, JSON.stringify(p)).toBe(p.maxShort);
    }
    // The heart (target 2, nobody assigned at 8100) gets one of them.
    expect(picks.some((p) => nodeId(p.to) === 'heart')).toBe(true);
  });

  it('H8 H3: a2, over its target once hauler.autoNeed is 1, loses a hauler as it gets home; after setHaulers a2 1 (8400) the next one home leaves too and parks idle', () => {
    const fromA2 = leaves.filter((l) => nodeId(l.from) === 'a2');
    expect(fromA2.length).toBe(2);
    expect(fromA2[0]!.tick).toBeLessThan(8400);
    expect(nodeId(fromA2[0]!.to!)).toBe('heart');
    expect(fromA2[1]!.tick).toBeGreaterThan(8400);
    expect(fromA2[1]!.to).toBeNull();
    expect(rockStatus(w, 2)).toMatchObject({ haulerSet: 1, haulerTarget: 1 });
  });

  it('H8 H4: the Hauler reaches the state enough (weight above 0, no rock short)', () => {
    expect(enoughTicks).toBeGreaterThan(0);
    expect(w.field!.alloc.hauler).toBe(2);
  });

  it('H8 H6: moveShips split carries floor(count × move.splitPct ÷ 100) per type, the 1-ship fallback sends the lone Flak, and moveShips all carries every warship', () => {
    const pct = t['move.splitPct'].default;
    expect(moves.map((m) => [m.tick, nodeId(m.from), nodeId(m.to), m.part])).toEqual([
      [8450, 'heart', 'p2', 'split'],
      [8450, 'p1', 'a2', 'split'],
      [8650, 'p2', 'a3', 'all'],
    ]);
    const [split, fallback, all] = moves;
    expect(split!.moved).toEqual(split!.preview);
    expect(split!.moved).toEqual({ drone: Math.floor((split!.at.drone * pct) / 100), lancer: 0, flak: Math.floor((split!.at.flak * pct) / 100) });
    expect(split!.moved.drone).toBeGreaterThan(0);
    expect(split!.moved.flak).toBeGreaterThan(0);
    expect(fallback!.at).toEqual({ drone: 0, lancer: 0, flak: 1 });
    expect(fallback!.moved).toEqual({ drone: 0, lancer: 0, flak: 1 });
    expect(all!.moved).toEqual(all!.at);
    expect(all!.moved.drone + all!.moved.flak).toBeGreaterThan(split!.moved.drone + split!.moved.flak);
  });

  it('H8 H8: recycleFleet takes the docked extractor at a2 (freeing its slot) and the haulers in order: idle, parked by node index, then the lowest id in transit', () => {
    expect(fleetRecycle).not.toBeNull();
    const r = fleetRecycle!;
    expect(r.tick).toBe(8488);
    // No extractor idled, so the first in order is docked, at a2 (the lowest node index with one).
    expect(r.orderExtractors[0]).toMatchObject({ at: 2, docked: true });
    expect(r.gone).toContain(r.orderExtractors[0]!.id);
    expect(r.slotsAfter).toBe(r.slotsBefore - 1);
    const four = r.orderHaulers.slice(0, 4);
    expect(four.map((h) => (h.at === PROBE && h.target === null ? 'idle' : h.at === null ? 'transit' : `at ${nodeId(h.at)}`))).toEqual(['idle', 'at a3', 'at heart', 'transit']);
    const transitIds = r.orderHaulers.filter((h) => h.at === null).map((h) => h.id);
    expect(four[3]!.id).toBe(Math.min(...transitIds));
    for (const h of four) expect(r.gone).toContain(h.id);
    expect(r.gone).toHaveLength(5);
  });

  it('H1 amendment (round 2): a hauler is picked for a4 while it is staffed but not haulable (its extractor still coming), waits there empty, and loads only after the extractor docks', () => {
    const atA4 = picks.filter((p) => nodeId(p.to) === 'a4');
    expect(atA4.length).toBeGreaterThan(0);
    const first = atA4[0]!;
    expect([first.tick, first.staffed, first.haulable]).toEqual([8720, true, false]);
    const dock = firstDockAt[4]!;
    expect(dock).toBeGreaterThan(first.tick);
    const waited = waits.filter((x) => x.id === first.id && nodeId(x.node) === 'a4');
    expect(waited.length).toBeGreaterThan(0);
    // It waited the whole time from its arrival to the dock, without leaving.
    expect(waited[waited.length - 1]!.tick).toBe(dock - 1);
    expect(waited.length).toBe(dock - waited[0]!.tick);
    const load = loads.find((l) => l.id === first.id && nodeId(l.node) === 'a4')!;
    expect(load.tick).toBeGreaterThan(dock);
    expect(load.cargo).toBe(2);
  });

  it('no surplus extractors (round 2): with weight 3 and every marked slot taken, the Extractor is enough: its bay stays idle and its full share is kept', () => {
    const enough = extLog.filter((e) => e.state === 'enough');
    expect(enough.length).toBeGreaterThan(0);
    for (const e of enough) {
      expect(e.weight, `tick ${e.tick}`).toBe(3);
      expect(e.bay, `tick ${e.tick}`).toBe(0);
    }
    // The share kept while enough: full (ship.extractor.cost is tuned to 5) and unchanged.
    const kept = enough.filter((e) => e.tick < 8720);
    expect(kept.length).toBeGreaterThan(0);
    expect(new Set(kept.map((e) => e.share))).toEqual(new Set([5]));
  });

  it('no surplus extractors (round 2): the bay starts again on the tick a4 is marked (a slot opens)', () => {
    const restart = extLog.find((e) => e.tick > 8690 && e.bayBefore === 0 && e.bay > 0)!;
    expect(restart.tick).toBe(8720);
    expect(restart.inputs).toContain('setMine');
    expect(extLog.find((e) => e.tick === 8719)!.state).toBe('enough');
    // The full share went into the bay.
    expect(restart.share).toBe(0);
  });

  it('uses every field input type it needs, with no input ignored', () => {
    expect([...typesApplied].sort()).toEqual(['moveShips', 'recycleFleet', 'recycleShips', 'sendShips', 'setAlloc', 'setHaulers', 'setMine', 'setRally', 'setTunable']);
    expect(ignored).toEqual([]);
  });

  it('is deterministic: two runs give the same 30 checkpoint hashes', () => {
    const a = replayHashes(referenceReplay, data, 9000, 300);
    const b = replayHashes(referenceReplay, data, 9000, 300);
    expect(a).toHaveLength(30);
    expect(a).toEqual(b);
  });
});
