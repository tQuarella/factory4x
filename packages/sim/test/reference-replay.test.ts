import { describe, expect, it } from 'vitest';
import {
  PROBE,
  allocStatus,
  countGuards,
  createWorld,
  fieldSummary,
  guardCaps,
  guardianAt,
  guardianStatus,
  heartIndex,
  raidKeep,
  defaultData as data,
  fleetStatus,
  haulersHeld,
  isValidInput,
  isHaulable,
  isStaffed,
  isRaidable,
  movePreview,
  nodeDistance,
  prongOutcome,
  raidProngs,
  raidStatus,
  recycleOrder,
  replayHashes,
  rockStatus,
  step,
  worldHash,
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
  // h8-raids: the second raid's rounds at p1 (H9), and its haulers (H10).
  const rounds: Array<{ tick: number; warships: number; lostShips: number; lostEcon: number; extractorsAtP1: number }> = [];
  const heldDepartures: number[] = [];
  const departuresAfter: number[] = [];
  let holdingPeak = 0;
  let raid2End = -1;
  let raid2Held = 0;
  let raid1HeldTicks = 0;
  // h9-sim: the extractor dial items (a)-(f).
  let a1AtUnmark: ReturnType<typeof rockStatus> | null = null;
  const dials: Array<{ tick: number; node: number; count: number | null; markedBefore: boolean; boundBefore: number; boundAfter: number; extCap: number; slots: number; unbound: Array<{ id: number; docked: boolean; target: number | null; to: number | null }>; bayBefore: number; bayAfter: number }> = [];
  const extFates = new Map<number, { dockedAt: number | null; idleAt: number | null; tick: number }>();
  const h9Ext: Array<{ tick: number; state: string; bay: number; share: number; built: number }> = [];
  const remarks: Array<{ tick: number; node: number; set: number | null; boundAfter: number; slots: number }> = [];
  const hArrive = new Map<number, number>();
  const h9Leaves: Array<{ tick: number; id: number; from: number; to: number | null; arrived: number; assignedBefore: number; target: number }> = [];
  const invalidChecks: Array<{ tick: number; same: boolean; inputs: number }> = [];
  const a1Docks: Array<{ tick: number; id: number; built: number }> = [];
  let a1Docked = new Set<number>();
  // h9-raids: the prongs' state at every change (the phases, targets, raiders, losses, outcomes and the holds), items (g)-(n).
  type ProngSnap = { target: number; phase: string; planned: [number, number]; raiders: [number, number]; retargeted: boolean; outcome: string | null; lost: number; killed: number; shipsLost: number; warships: number };
  const prongLog: Array<{ tick: number; id: number; phase: string; prongs: ProngSnap[]; held: Record<number, boolean>; status: ReturnType<typeof raidStatus> }> = [];
  let prongKey = '';
  const prevRetargeted = new Map<string, boolean>();
  const retargets: Array<{ tick: number; raid: number; prong: number; to: number; raidable: number[]; others: string[] }> = [];
  const muster: Array<{ tick: number; id: number; raidable: number[]; prongs: Array<{ target: number; planned: [number, number]; mix: [number, number] | null; next: boolean }>; nextProngs: number }> = [];
  const endsOf: Array<{ tick: number; last: NonNullable<ReturnType<typeof raidStatus>['last']>; raids: World['stats']['raids']; raidProngs: World['stats']['raidProngs']; nextRaidTick: number }> = [];
  let lastSeen: unknown = null;
  // h10-sim: the hive's rebuild queue (D1-D6) and the roll-on (L1-L5) at every tick, items (a)-(h).
  type Pair = [number, number];
  type HiveSnap = { tick: number; live: boolean; alive: Pair; out: Pair; caps: Pair; missing: Pair; progress: number; rg: Pair; battle: boolean; rebuildTicks: number; ids: number[] };
  const hiveLog: HiveSnap[] = [];
  const knownGuardIds = new Set<number>();
  const rebuilt: Array<{ tick: number; type: string; missingBefore: Pair; caps: Pair }> = [];
  const hiveBattles: Array<{ end: number; result: NonNullable<ReturnType<typeof guardianAt>>['lastBattle']; snap: HiveSnap; progressDuring: number[] }> = [];
  let battleProgress: number[] = [];
  const h10Musters: Array<{ id: number; tick: number; planned: number; econ: number; want: number; keep: number; alive: number; missing: Pair; progress: number }> = [];
  const holds: Array<{ tick: number; p1: boolean; a5: boolean }> = [];
  const rebuildStatus: Array<{ tick: number; rebuild: ReturnType<typeof guardianStatus>['rebuild']; thornRow: [number, number]; sporeRow: [number, number] }> = [];
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
    // (h9-raids unmarks a3 and p2 for its prong items; this check is about a1's unmark at 600.)
    const unmark = inputs.find((i): i is Extract<Input, { type: 'setMine' }> => i.type === 'setMine' && !i.on && t > 0 && i.node === 1);
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
    // h9-sim: the dial inputs (valid ones are applied in order; each is recorded against the state before the tick).
    const dialIns = inputs.filter((i): i is Extract<Input, { type: 'setExtractors' }> => i.type === 'setExtractors' && isValidInput(w, data, i));
    const dialBefore = dialIns.map((i) => ({
      i,
      marked: f.mine[i.node] === true,
      ids: f.econ.filter((s) => s.type === 'extractor' && s.target === i.node).map((s) => ({ id: s.id, docked: s.at === i.node && s.transit === null })),
    }));
    const remarkIns = inputs.filter((i): i is Extract<Input, { type: 'setMine' }> => i.type === 'setMine' && i.on && t > 0 && f.extractorSet[i.node] !== null);
    const remarkSets = remarkIns.map((i) => f.extractorSet[i.node] ?? null);
    const hBefore = new Map(f.econ.filter((s) => s.type === 'hauler').map((s) => [s.id, { target: s.target, toProbe: s.transit !== null && s.transit.to === PROBE }]));
    const assignedBefore = w.nodes.map((n) => f.econ.filter((s) => s.type === 'hauler' && s.target === n.index).length);
    const invalidIns = inputs.filter((i) => i.type === 'setExtractors' && !isValidInput(w, data, i));
    const without = invalidIns.length > 0 ? clone(w) : null;
    step(w, data, inputs);
    if (without !== null) {
      step(without, data, inputs.filter((i) => !invalidIns.includes(i)));
      invalidChecks.push({ tick: t, same: worldHash(without) === worldHash(w), inputs: invalidIns.length });
    }
    if (t === 600) a1AtUnmark = rockStatus(w, 1);
    for (const d of dialBefore) {
      const unbound = d.ids
        .filter((x) => f.econ.find((s) => s.id === x.id)!.target !== d.i.node)
        .map((x) => {
          const s = f.econ.find((y) => y.id === x.id)!;
          extFates.set(x.id, { dockedAt: null, idleAt: null, tick: t });
          return { id: x.id, docked: x.docked, target: s.target, to: s.transit?.to ?? null };
        });
      const r = rockStatus(w, d.i.node);
      dials.push({ tick: t, node: d.i.node, count: d.i.count, markedBefore: d.marked, boundBefore: d.ids.length, boundAfter: r.bound, extCap: r.extCap, slots: r.slots, unbound, bayBefore: extBefore.bay, bayAfter: f.bays.extractor.ticksLeft });
    }
    remarkIns.forEach((i, k) => remarks.push({ tick: t, node: i.node, set: remarkSets[k]!, boundAfter: rockStatus(w, i.node).bound, slots: w.nodes[i.node]!.slots }));
    for (const [id, fate] of extFates) {
      const s = f.econ.find((x) => x.id === id);
      if (s === undefined || fate.dockedAt !== null || fate.idleAt !== null) continue;
      if (s.transit === null && s.at !== null && s.at === s.target) fate.dockedAt = s.at;
      else if (s.transit === null && s.at === PROBE && s.target === null) fate.idleAt = t;
    }
    if (t >= 8760) {
      const now = new Set(f.econ.filter((s) => s.type === 'extractor' && s.transit === null && s.at === 1 && s.target === 1).map((s) => s.id));
      for (const id of now) if (!a1Docked.has(id)) a1Docks.push({ tick: t, id, built: w.stats.econBuilt.extractor });
      a1Docked = now;
      const ex = allocStatus(w, data).rows.find((r) => r.type === 'extractor')!;
      h9Ext.push({ tick: t, state: ex.state, bay: f.bays.extractor.ticksLeft, share: f.share.extractor, built: w.stats.econBuilt.extractor });
      for (const s of f.econ) {
        if (s.type !== 'hauler') continue;
        const b = hBefore.get(s.id);
        if (b !== undefined && b.toProbe && s.at === PROBE && s.transit === null) hArrive.set(s.id, t);
        if (b !== undefined && b.target !== null && b.target !== s.target) {
          h9Leaves.push({ tick: t, id: s.id, from: b.target, to: s.target, arrived: hArrive.get(s.id) ?? -1, assignedBefore: assignedBefore[b.target]!, target: rockStatus(w, b.target).haulerTarget });
        }
      }
    }
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
    // h9-raids: the prongs, at each change of their state.
    {
      const r = w.raid;
      const hold = { 3: haulersHeld(w, 3), 8: haulersHeld(w, 8), 9: haulersHeld(w, 9) };
      const prongs: ProngSnap[] =
        r === null
          ? []
          : raidProngs(r).map((p) => ({
              target: p.target,
              phase: p.phase,
              planned: [p.planned.thorn, p.planned.spore],
              raiders: [p.guards.filter((g) => g.type === 'thorn').length, p.guards.filter((g) => g.type === 'spore').length],
              retargeted: p.retargeted,
              outcome: prongOutcome(p),
              lost: p.lostEcon.extractor + p.lostEcon.hauler,
              killed: p.killed.thorn + p.killed.spore,
              shipsLost: p.lostShips.drone + p.lostShips.lancer + p.lostShips.flak,
              warships: w.ships.filter((x) => x.at === p.target).length,
            }));
      // W5: each prong's retarget, with the raidable rocks in hive order at that moment.
      if (r !== null) {
        raidProngs(r).forEach((p, i) => {
          const was = prevRetargeted.get(`${r.id}:${i}`) ?? false;
          if (p.retargeted && !was) {
            const hive = w.nodes.find((n) => n.kind === 'heart')!.index;
            const order = w.nodes.filter((n) => isRaidable(w, n.index)).map((n) => n.index).sort((a, b) => nodeDistance(w, hive, a) - nodeDistance(w, hive, b) || a - b);
            retargets.push({ tick: t, raid: r.id, prong: i, to: p.target, raidable: order, others: raidProngs(r).filter((q) => q !== p).map((q) => `${q.phase}@${q.target}`) });
          }
          prevRetargeted.set(`${r.id}:${i}`, p.retargeted);
        });
      }
      const key = JSON.stringify([r === null ? null : r.id, prongs, hold]);
      if (key !== prongKey) {
        prongKey = key;
        const status = raidStatus(w);
        prongLog.push({ tick: t, id: r === null ? 0 : r.id, phase: status.phase, prongs, held: hold, status });
        if (r !== null && r.phase === 'muster' && muster.every((m) => m.id !== r.id)) {
          muster.push({
            tick: t,
            id: r.id,
            raidable: w.nodes.filter((n) => isRaidable(w, n.index)).map((n) => n.index),
            prongs: raidProngs(r).map((p) => ({ target: p.target, planned: [p.planned.thorn, p.planned.spore], mix: rockStatus(w, p.target).raidMix === null ? null : [rockStatus(w, p.target).raidMix!.thorn, rockStatus(w, p.target).raidMix!.spore], next: rockStatus(w, p.target).raidNext })),
            nextProngs: status.nextProngs,
          });
        }
      }
      if (lastSeen !== w.lastRaid && w.lastRaid !== null) endsOf.push({ tick: t, last: clone(raidStatus(w).last!), raids: { ...w.stats.raids }, raidProngs: { ...w.stats.raidProngs }, nextRaidTick: w.nextRaidTick });
      lastSeen = w.lastRaid;
    }
    // h8-raids: raid 1's hold at p1 (a beaten raid), raid 2's rounds and hauler departures (H9, H10).
    const rr = w.raid;
    const departed = f.econ.filter((s) => s.type === 'hauler' && s.transit !== null && s.transit.from === PROBE && s.transit.to === 8 && s.transit.ticksLeft + 1 === s.transit.totalTicks).length;
    if (rr !== null && rr.id === 1 && rockStatus(w, 8).haulersHeld) raid1HeldTicks++;
    if (rr !== null && rr.id === 2 && rr.phase === 'home') {
      if (raid2End < 0) raid2End = t; // the outcome is decided: the raiders left p1 this tick (the hold ended)
      if (t <= raid2End + 5) departuresAfter.push(...Array<number>(departed).fill(t));
    } else if (rr !== null && rr.id === 2 && rr.phase !== 'muster') {
      heldDepartures.push(...Array<number>(departed).fill(t));
      holdingPeak = Math.max(holdingPeak, raidStatus(w).holding);
      raid2Held++;
      if (rr.phase === 'fight' && t % 30 === 0) {
        rounds.push({
          tick: t,
          warships: w.ships.filter((s) => s.at === 8).length,
          lostShips: rr.lostShips.drone + rr.lostShips.lancer + rr.lostShips.flak,
          lostEcon: rr.lostEcon.extractor + rr.lostEcon.hauler,
          extractorsAtP1: rockStatus(w, 8).docked,
        });
      }
    }
    if (inputs.some((i) => i.type === 'recycleShips' && i.node === 2)) recycle = { tick: t, econBefore, econAfter: f.econ.length, refund: w.stats.oreRefunded - refundBefore };
    // h10-sim: the hive after this tick.
    {
      const hive = guardianAt(w, heartIndex(w))!;
      const c = countGuards(hive);
      const caps = guardCaps(w, hive);
      const out: Pair = [0, 0];
      if (w.raid !== null) for (const p of raidProngs(w.raid)) for (const g of p.guards) out[g.type === 'thorn' ? 0 : 1] += 1;
      const missing: Pair = [Math.max(0, caps.thorn - c.thorn - out[0]), Math.max(0, caps.spore - c.spore - out[1])];
      const snap: HiveSnap = {
        tick: t,
        live: hive.alive,
        alive: [c.thorn, c.spore],
        out,
        caps: [caps.thorn, caps.spore],
        missing,
        progress: f.hiveRebuildProgress,
        rg: [hive.regrowProgress.thorn, hive.regrowProgress.spore],
        battle: hive.battle !== null,
        rebuildTicks: w.tun['hive.rebuildTicks'],
        ids: hive.guards.map((g) => g.id),
      };
      hiveLog.push(snap);
      // A guard id never seen before in the hive or a prong is a rebuilt guard (a returning raider keeps its id).
      for (const g of hive.guards) {
        if (t > 0 && !knownGuardIds.has(g.id)) {
          const before: Pair = [...missing];
          before[g.type === 'thorn' ? 0 : 1] += 1;
          rebuilt.push({ tick: t, type: g.type, missingBefore: before, caps: snap.caps });
        }
      }
      for (const g of hive.guards) knownGuardIds.add(g.id);
      if (w.raid !== null) for (const p of raidProngs(w.raid)) for (const g of p.guards) knownGuardIds.add(g.id);
      if (hive.battle !== null) battleProgress.push(snap.progress);
      const prev = hiveLog[hiveLog.length - 2];
      if (prev !== undefined && prev.battle && !snap.battle) {
        hiveBattles.push({ end: t, result: clone(hive.lastBattle), snap, progressDuring: battleProgress });
        battleProgress = [];
      }
      const r = w.raid;
      if (r !== null && r.phase === 'muster' && h10Musters.every((m) => m.id !== r.id)) {
        const econ = raidStatus(w).econ;
        h10Musters.push({
          id: r.id,
          tick: t,
          planned: raidProngs(r).reduce((a, p) => a + p.planned.thorn + p.planned.spore, 0),
          econ,
          want: Math.min(w.tun['raid.maxSize'], Math.ceil(econ / w.tun['raid.econPerRaider'])),
          keep: raidKeep(w, hive),
          alive: hive.guards.length,
          missing,
          progress: snap.progress,
        });
      }
      if (t >= 6080 && t <= 6100) holds.push({ tick: t, p1: haulersHeld(w, 8), a5: haulersHeld(w, 5) });
      if (hive.alive && (t === 2549 || t === 6200 || t === 6659)) {
        const gs = guardianStatus(w, hive.node);
        rebuildStatus.push({ tick: t, rebuild: gs.rebuild, thornRow: [gs.guards.thorn.regrowProgress, gs.guards.thorn.regrowTicks], sporeRow: [gs.guards.spore.regrowProgress, gs.guards.spore.regrowTicks] });
      }
    }
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
    // 450 x2, 280 x2, 850, drone 5 at tick 7000, h8-sim's three at 8100 and extractor 3 at 8660, (h9-raids) Flak 0 and Extractor 1
    // at 4410 and Extractor 0 and Flak 2 at 4500, and (h10-sim) drone 2 at 1900, drone 0 at 1991, extractor 1 at 5870 and 0 at 5871.
    expect(w.stats.allocChanges).toBe(18);
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
    // a1 has 2 slots, both filled by then. (h9-sim marks a1 again at 8761 for the dial items, so its state is read
    // on the tick of the unmark rather than at the end of the run.)
    expect(unboundAtUnmark.length).toBe(2);
    expect(a1AtUnmark).toMatchObject({ mine: false, bound: 0 });
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

  it('the second raid hits p1 defended by one lone Drone (sent at tick 4100): it falls, then the extractor does, and the raid comes home (hit)', () => {
    const fights = raidLog.filter((e) => e.phase === 'fight');
    expect(fights.length).toBeGreaterThanOrEqual(2);
    expect(nodeId(fights[1]!.target!)).toBe('p1');
    expect(fights[1]!.warshipsAtTarget).toBe(1);
    const hit = raidLog.find((e) => e.phase === 'none' && e.raids.hit === 1)!;
    expect(hit.raids).toEqual({ mustered: 2, beaten: 1, hit: 1, turnedBack: 0 });
  });

  it('H9: raid 2 strikes the Drone alone in its first round (the damage is raised for it at 4250; the overflow is lost), the extractor in the next, with no warship left', () => {
    expect(rounds.map((r) => r.tick)).toEqual([4290, 4320]);
    // The state after each round: the Drone fell in the first, the extractor still stands; the extractor fell in the second.
    expect(rounds[0]).toEqual({ tick: 4290, warships: 0, lostShips: 1, lostEcon: 0, extractorsAtP1: 1 });
    expect(rounds[1]).toEqual({ tick: 4320, warships: 0, lostShips: 1, lostEcon: 1, extractorsAtP1: 0 });
  });

  it('H10: from launch to the outcome of raid 2, no hauler leaves the probe for p1 while some wait there (the partial load at the node is in raids-h8.test.ts)', () => {
    expect(raid2Held).toBeGreaterThan(300);
    expect(holdingPeak).toBeGreaterThan(0);
    expect(heldDepartures).toEqual([]);
    // Raid 1 held p1's haulers too (the target at its fight), then the beaten raid ended.
    expect(raid1HeldTicks).toBeGreaterThan(0);
  });

  it('H10: the haulers resume at once when the outcome of raid 2 is decided (it leaves p1 for home, tick 4350, 215 ticks before it lands): they leave the probe within a tick of that', () => {
    expect(raid2End).toBeGreaterThan(0);
    expect(raid2End).toBe(4350);
    expect(departuresAfter.length).toBeGreaterThan(0);
    expect(Math.min(...departuresAfter)).toBeLessThanOrEqual(raid2End + 1);
  });

  it('the hive is captured (tick 8010) with the last raid (4, one prong) out at p1: it withers (removed, not counted as an outcome)', () => {
    const cap = w.stats.captures.find((c) => nodeId(c.node) === 'heart')!;
    expect(w.capturedTick).toBe(cap.tick);
    // (h9-raids: this was raid 3, at p1 in its fight at 7929. Raid 3 is now a prong raid, over at 6305, and raid 4 is launched at 7854, and out when the hive falls.)
    const last = raidLog.filter((e) => e.phase === 'out' && e.raids.mustered === 4)[0]!;
    expect(last.tick).toBeLessThan(cap.tick);
    const end = raidLog.find((e) => e.phase === 'none' && e.tick > last.tick)!;
    expect(end.tick).toBe(cap.tick);
    expect(w.raid).toBeNull();
    expect(w.lastRaid).toMatchObject({ id: 4, outcome: 'withered' });
    expect(w.stats.raids).toEqual({ mustered: 4, beaten: 1, hit: 2, turnedBack: 0 });
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
    // (h9-raids: 8750, was 8720. The a3 unmark of the prong items shifted hauler 41's trips, so no hauler is idle at the probe at 8720 and the first free one is at 8750.)
    expect([first.tick, first.staffed, first.haulable]).toEqual([8750, true, false]);
    const dock = firstDockAt[4]!;
    expect(dock).toBeGreaterThan(first.tick);
    const waited = waits.filter((x) => x.id === first.id && nodeId(x.node) === 'a4');
    expect(waited.length).toBeGreaterThan(0);
    // It waited the whole time from its arrival to the dock, without leaving.
    expect(waited[waited.length - 1]!.tick).toBe(dock - 1);
    expect(waited.length).toBe(dock - waited[0]!.tick);
    // Loads at a4 go in id order, and (h9-raids) the first pick (94, 8750) has a higher id than the second (89, 8760), so 89 loads first
    // (8970) and 94 only after the 9000 ticks the replay runs. So the check covers every hauler picked for a4 before the dock that loads
    // in the run: it loads only after the extractor docks, with its full cargo of 2.
    const pickedBefore = new Set(atA4.filter((p) => p.tick < dock).map((p) => p.id));
    const loaded = loads.filter((l) => pickedBefore.has(l.id) && nodeId(l.node) === 'a4');
    expect(loaded.length).toBeGreaterThan(0);
    for (const load of loaded) {
      expect(load.tick).toBeGreaterThan(dock);
      expect(load.cargo).toBe(2);
    }
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
    expect([...typesApplied].sort()).toEqual(['moveShips', 'recycleFleet', 'recycleShips', 'sendShips', 'setAlloc', 'setExtractors', 'setHaulers', 'setMine', 'setRally', 'setTunable']);
    // h9-sim item (f): the only inputs ignored are the invalid setExtractors (checked below).
    expect(ignored.every((x) => x.includes('"setExtractors"'))).toBe(true);
    expect(ignored).toHaveLength(4);
  });

  // h9-sim (DESIGN.md H9 "Save, data version and replay", items (a)-(f)): the extractor dial, from tick 8760.
  const dialAt = (tick: number) => dials.find((d) => d.tick === tick)!;
  const lowerToA1 = 8761;
  const raise = 8800;
  const lowerIdle = 8880;

  it('H9 (a): setExtractors a2 1 lowers a docked rock: its highest-id docked extractor re-dispatches to a1, the marked rock with room', () => {
    const d = dials.find((x) => x.tick === lowerToA1 && nodeId(x.node) === 'a2')!;
    expect([d.count, d.boundBefore, d.boundAfter, d.extCap, d.slots]).toEqual([1, 2, 1, 1, 2]);
    expect(d.unbound).toHaveLength(1);
    expect(d.unbound[0]).toMatchObject({ docked: true, target: 1, to: 1 });
    expect(extFates.get(d.unbound[0]!.id)!.dockedAt).toBe(1);
  });

  it('H9 (a): setExtractors a1 1 lowers a1 when no marked rock has room: the surplus flies home and parks idle', () => {
    const d = dialAt(lowerIdle);
    expect([nodeId(d.node), d.count, d.boundBefore, d.boundAfter, d.extCap]).toEqual(['a1', 1, 2, 1, 1]);
    expect(d.unbound).toHaveLength(1);
    expect(d.unbound[0]).toMatchObject({ docked: true, target: null, to: PROBE });
    const fate = extFates.get(d.unbound[0]!.id)!;
    expect([fate.dockedAt, fate.idleAt !== null]).toEqual([null, true]);
    const idleAtEnd = w.field!.econ.filter((s) => s.type === 'extractor' && s.target === null && s.at === PROBE && s.transit === null).map((s) => s.id);
    expect(idleAtEnd).toEqual([d.unbound[0]!.id]);
  });

  it('H9 (b): after each lowering the Extractor is enough with weight 3: its share is held, the bay stays idle and no extractor is built', () => {
    for (const [from, to] of [[lowerToA1, raise], [lowerIdle, 9000]] as const) {
      const span = h9Ext.filter((e) => e.tick >= from && e.tick < to);
      expect(span.length).toBe(to - from);
      for (const e of span) expect([e.tick, e.state, e.bay, e.share, e.built]).toEqual([e.tick, 'enough', 0, span[0]!.share, span[0]!.built]);
    }
    // After the first lowering a1 (set 1) and a2 (set 1) each have a slot under their slots: H4b reads extCap.
    expect([rockStatus(w, 2).slots, rockStatus(w, 2).extCap, rockStatus(w, 1).slots, rockStatus(w, 1).extCap]).toEqual([2, 1, 2, 1]);
  });

  it("H9 (c): a1's target drops with the lowering, and a hauler over it leaves a1 at its next delivery (the tick after it reaches the probe)", () => {
    const fromA1 = h9Leaves.filter((l) => nodeId(l.from) === 'a1' && l.tick > lowerIdle);
    expect(fromA1).toHaveLength(1);
    const l = fromA1[0]!;
    expect(l.tick).toBe(l.arrived + 1);
    expect(l.assignedBefore).toBeGreaterThan(l.target);
    expect(l.to).toBeNull();
    // No hauler left a1 before the lowering.
    expect(h9Leaves.filter((x) => nodeId(x.from) === 'a1' && x.tick <= lowerIdle)).toEqual([]);
    expect(rockStatus(w, 1)).toMatchObject({ haulerTarget: 2, haulers: 2 });
  });

  it('H9 (d): setExtractors a1 null (All) reopens H4b on that tick: the bay starts, and the extractor it builds docks at a1', () => {
    const d = dialAt(raise);
    expect([nodeId(d.node), d.count, d.extCap, d.bayBefore]).toEqual(['a1', null, 2, 0]);
    expect(d.bayAfter).toBe(w.tun['ship.extractor.buildTicks']);
    const before = h9Ext.find((e) => e.tick === raise - 1)!;
    expect(before.state).toBe('enough');
    // Docks at a1 after 8760: the re-dispatched one from a2 (built before), then the one this bay built, before the next lowering.
    expect(a1Docks.map((x) => [x.id, x.built])).toEqual([
      [dials.find((x) => x.tick === lowerToA1 && nodeId(x.node) === 'a2')!.unbound[0]!.id, before.built],
      [dialAt(lowerIdle).unbound[0]!.id, before.built + 1],
    ]);
    expect(a1Docks[1]!.tick).toBeGreaterThan(raise);
    expect(a1Docks[1]!.tick).toBeLessThan(lowerIdle);
  });

  it('H9 (e): a count set on unmarked a1 (8760) is kept and applies when a1 is marked again (8761): one extractor, not its two slots', () => {
    const d = dials.find((x) => x.tick === 8760 && nodeId(x.node) === 'a1')!;
    expect([d.markedBefore, d.count, d.boundBefore, d.boundAfter]).toEqual([false, 1, 0, 0]);
    expect(remarks).toEqual([{ tick: lowerToA1, node: 1, set: 1, boundAfter: 1, slots: 2 }]);
  });

  it('H9 (f): invalid setExtractors (a guarded pocket and the guarded hive at tick 1, 0 and above the slots at 8760) are ignored and change nothing', () => {
    expect(ignored).toEqual([
      '1 {"type":"setExtractors","node":9,"count":1}',
      '1 {"type":"setExtractors","node":10,"count":1}',
      '8760 {"type":"setExtractors","node":2,"count":0}',
      '8760 {"type":"setExtractors","node":2,"count":3}',
    ]);
    expect(invalidChecks).toEqual([
      { tick: 1, same: true, inputs: 2 },
      { tick: 8760, same: true, inputs: 2 },
    ]);
  });

  // h9-raids (DESIGN.md H9 "Save, data version and replay", items (g)-(n)): the prong raids, from tick 4400.
  const p1 = 8;
  const p2 = 9;
  const entry = (tick: number) => prongLog.find((e) => e.tick === tick)!;
  const at = (tick: number) => [...prongLog].reverse().find((e) => e.tick <= tick)!; // the state in force after `tick`
  const sumPlanned = (c: [number, number]) => c[0] + c[1];
  const result = (id: number) => endsOf.find((e) => e.last.id === id)!;

  it('H9 (n): raids 1 and 2 are below the split size (2 x raid.prongMinSize 3), so each stays one prong, though raid 2 has three raidable rocks', () => {
    const [r1, r2] = [muster.find((m) => m.id === 1)!, muster.find((m) => m.id === 2)!];
    // Raids 1 and 2 have at most 3 raiders, under 2 x 3, so they stay one prong (data v16, raid.prongMinSize 3).
    expect(data.tunables['raid.prongMinSize'].default).toBe(3);
    expect(r1.tick).toBe(95);
    expect(r1.raidable.length).toBeGreaterThanOrEqual(1); // one target: only a1 has a docked extractor by then
    expect(r2.raidable.map(nodeId)).toEqual(['a2', 'a3', 'p1']);
    for (const m of [r1, r2]) {
      expect(m.prongs).toHaveLength(1);
      expect(sumPlanned(m.prongs[0]!.planned)).toBeLessThan(2 * 3);
      expect(m.nextProngs).toBe(1);
    }
    expect(sumPlanned(r2.prongs[0]!.planned)).toBe(3);
    // Their results have one prong each (the wire shape of last.prongs).
    expect(result(1).last.prongs.map((p) => [nodeId(p.target), p.outcome])).toEqual([['p1', 'beaten']]);
    expect(result(2).last.prongs.map((p) => [nodeId(p.target), p.outcome])).toEqual([['p1', 'hit']]);
  });

  it('H9 (g): raid 3 musters at 5465 with 2 prongs, at p1 and a3 in hive order, its 2 Thorns and 3 Spores dealt 1T 2S and 1T 1S (W2), with both badges\' mixes and the rank flag', () => {
    const m = muster.find((x) => x.id === 3)!;
    expect(m.tick).toBe(5465);
    expect(m.raidable.map(nodeId)).toEqual(['a2', 'a3', 'p1']);
    expect(m.prongs).toEqual([
      { target: p1, planned: [1, 2], mix: [1, 2], next: true },
      { target: 3, planned: [1, 1], mix: [1, 1], next: true },
    ]);
    expect(m.nextProngs).toBe(2);
    const st = entry(5465);
    expect(st.status.phase).toBe('muster');
    expect(st.status.prongs.map((p) => [p.target, p.phase, p.planned, p.raiders, p.outcome])).toEqual([
      [p1, 'muster', { thorn: 1, spore: 2 }, { thorn: 0, spore: 0 }, null],
      [3, 'muster', { thorn: 1, spore: 1 }, { thorn: 0, spore: 0 }, null],
    ]);
    expect(st.status.planned).toEqual({ thorn: 2, spore: 3 });
    expect(st.status.target).toBe(p1);
    expect(st.status.ticksToLaunch).toBe(149);
  });

  it('H9 (h): both prongs launch on the same tick (5614) and fly their own legs; they arrive on different ticks (p1 at 5829, a3 at 5859)', () => {
    const launch = entry(5614);
    expect(launch.prongs.map((p) => [p.target, p.phase, p.raiders, p.planned])).toEqual([
      [p1, 'out', [1, 2], [1, 2]],
      [3, 'out', [1, 1], [1, 1]],
    ]);
    expect(launch.status.prongs.map((p) => p.ticksToArrival)).toEqual([215, 245]); // 645 and 735 su at raid.speedSu 3
    expect(launch.status.ticksToArrival).toBe(215); // the smallest
    expect(launch.status.phase).toBe('out');
    expect(launch.status.raiders).toEqual({ thorn: 2, spore: 3 });
    expect(launch.held[p1] && launch.held[3]).toBe(true); // the holds start at the launch
    // Prong 0 arrives and fights at 5829; prong 1 reaches a3 at 5859 (30 ticks later: 735 su against 645).
    expect(at(5829).prongs.map((p) => p.phase)).toEqual(['fight', 'out']);
    expect(prongLog.find((e) => e.tick === 5829)!.status.phase).toBe('fight');
    expect(retargets.find((r) => r.raid === 3)!.tick).toBe(5859);
  });

  it('H9 (l): a3 is unmarked, so prong 1 retargets once on arrival (5859), skipping p1, the nearest rock but prong 0\'s live target, for p2', () => {
    const rt = retargets.filter((r) => r.raid === 3);
    expect(rt).toHaveLength(1);
    expect(rt[0]).toEqual({ tick: 5859, raid: 3, prong: 1, to: p2, raidable: [p1, p2, 2], others: ['fight@8'] });
    const after = entry(5859);
    expect(after.prongs.map((p) => [p.target, p.phase, p.retargeted])).toEqual([
      [p1, 'fight', false],
      [p2, 'out', true],
    ]);
    // The retarget is per prong: prong 0 never retargets, and two live prongs never share a node.
    expect(retargets.filter((r) => r.raid === 3 && r.prong === 0)).toEqual([]);
    for (const e of prongLog.filter((x) => x.id === 3)) {
      const live = e.prongs.filter((p) => p.phase !== 'done').map((p) => p.target);
      expect(new Set(live).size).toBe(live.length);
    }
  });

  it('H9 (j): the shield holds at p2, where warships stand, while prong 0 strikes the economy at p1, where none do', () => {
    const round = entry(6060);
    expect(round.prongs.map((p) => [p.target, p.phase, p.warships, p.lost, p.shipsLost])).toEqual([
      [p1, 'fight', 0, 1, 0], // no warship at p1: the extractor falls (the first loss, at 6060)
      [p2, 'done', 2, 0, 0], // the Drone and the Flak stand at p2: the raiders struck them (hp), nothing of the economy, no ship fell
    ]);
    // Before that, prong 0 had struck from 5850 on with nothing lost, and prong 1\'s fight (from 6033) cost the defenders no ship.
    expect(at(6059).prongs[0]!.lost).toBe(0);
    expect(prongLog.filter((e) => e.id === 3).every((e) => e.prongs.every((p) => p.shipsLost === 0))).toBe(true);
  });

  it('H9 (i): prong 1 is beaten at p2 while prong 0 hits p1: the raid is a hit, raidProngs counts one of each, and the gap runs from the last prong', () => {
    const beaten = entry(6060);
    expect(beaten.prongs[1]).toMatchObject({ phase: 'done', outcome: 'beaten', raiders: [0, 0], killed: 2 });
    expect(beaten.status.prongs.map((p) => p.outcome)).toEqual([null, 'beaten']);
    expect(beaten.status.phase).toBe('fight'); // prong 0 still fights
    // h10-sim: with raid.rollMax 1 (from 5870), prong 0 rolls on from p1 at 6090 to a5 (H10 (g)), hits again there and
    // leaves a5 for home at 6240 (it was home-bound from p1 at 6090, with 1 economy ship, before H10).
    const home = entry(6240);
    expect(home.prongs[0]).toMatchObject({ phase: 'home', target: 5, outcome: 'hit', lost: 2 });
    expect(home.status.phase).toBe('home');
    const res = result(3);
    expect(res.tick).toBe(6384); // (6305 before H10: the roll's leg and its fight at a5 keep prong 0 out longer)
    // The result's target is prong 0's, and prong 0 left a5 for home (H10: p1 before).
    expect(res.last).toMatchObject({ outcome: 'hit', target: 5, lostEcon: { extractor: 2, hauler: 0 }, killed: { thorn: 1, spore: 1 } });
    expect(res.last.prongs.map((p) => [p.target, p.outcome])).toEqual([[5, 'hit'], [p2, 'beaten']]);
    expect(res.raids).toEqual({ mustered: 3, beaten: 1, hit: 2, turnedBack: 0 });
    expect(res.raidProngs).toEqual({ beaten: 2, hit: 2, turnedBack: 0 }); // raids 1 and 2, then this raid's two prongs
    // The gap (1321 from tick 5000; 1400 before H10, so that raid 4 still musters at 7705) runs from the tick the last prong
    // landed, and raid 4 musters then.
    expect(res.nextRaidTick).toBe(res.tick + 1321);
    expect(muster.find((x) => x.id === 4)!.tick).toBe(res.nextRaidTick);
    // The raid ended only when the last prong was done: prong 1 was done at 6060, prong 0 at 6384.
    expect(entry(6384).id).toBe(0);
  });

  it('H9 (k): the hold at p2 ends at prong 1\'s outcome (6060) while prong 0 still fights; p1\'s ends at its own (6090)', () => {
    expect(entry(5614).held).toEqual({ 3: true, 8: true, 9: false });
    expect(entry(5859).held).toEqual({ 3: false, 8: true, 9: true }); // the hold follows the retarget
    expect(at(6059).held).toEqual({ 3: false, 8: true, 9: true });
    const resumed = entry(6060);
    expect(resumed.held).toEqual({ 3: false, 8: true, 9: false });
    expect(resumed.prongs[0]!.phase).toBe('fight');
    expect(entry(6090).held).toEqual({ 3: false, 8: false, 9: false });
  });

  it('H9 (m): raid 4 musters at 7705 with 2 prongs, and a launch that can spare only 2 guards (7854) drops to one, at p1; it is out when the hive falls, and withers', () => {
    const m = muster.find((x) => x.id === 4)!;
    expect(m.tick).toBe(7705);
    expect(m.prongs.map((p) => [p.target, p.planned])).toEqual([[p1, [1, 1]], [3, [0, 2]]]); // 1 Thorn and 3 Spores, dealt Thorn, Spore | Spore, Spore
    expect(m.prongs.map((p) => p.next)).toEqual([true, true]);
    expect(entry(7854).prongs.map((p) => [p.target, p.phase, p.planned, p.raiders])).toEqual([[p1, 'out', [1, 1], [1, 1]]]);
    expect(entry(7854).status.prongs).toHaveLength(1);
    expect(entry(7854).status.planned).toEqual({ thorn: 1, spore: 1 });
    // The dropped target's badge clears at the launch (a3 is raidable but no prong aims at it).
    expect(entry(7854).held).toEqual({ 3: false, 8: true, 9: false });
    const fall = result(4);
    expect(fall.last).toMatchObject({ id: 4, outcome: 'withered', target: p1 });
    expect(fall.last.prongs.map((p) => [p.target, p.outcome])).toEqual([[p1, 'withered']]);
    expect(fall.raids).toEqual({ mustered: 4, beaten: 1, hit: 2, turnedBack: 0 });
    expect(fall.raidProngs).toEqual({ beaten: 2, hit: 2, turnedBack: 0 }); // a withered raid counts nothing
  });

  it('raidStatus keeps its one-prong fields as summaries of the prongs at every change, in a replay that has one and two prongs', () => {
    let twoProngs = 0;
    for (const e of prongLog) {
      const st = e.status;
      if (e.id === 0) {
        expect(st.prongs).toEqual([]);
        expect(st.phase).toBe('none');
        continue;
      }
      if (st.prongs.length === 2) twoProngs++;
      const phases = st.prongs.map((p) => p.phase);
      expect(st.phase, `tick ${e.tick}`).toBe(phases.every((p) => p === 'muster') ? 'muster' : phases.includes('fight') ? 'fight' : phases.includes('out') ? 'out' : 'home');
      expect(st.target).toBe(st.prongs[0]!.target);
      expect(st.planned.thorn).toBe(st.prongs.reduce((a, p) => a + p.planned.thorn, 0));
      expect(st.planned.spore).toBe(st.prongs.reduce((a, p) => a + p.planned.spore, 0));
      expect(st.raiders.thorn + st.raiders.spore).toBe(st.prongs.reduce((a, p) => a + p.raiders.thorn + p.raiders.spore, 0));
      const flying = st.prongs.filter((p) => p.phase === 'out' || p.phase === 'home').map((p) => p.ticksToArrival);
      expect(st.ticksToArrival).toBe(flying.length === 0 ? 0 : Math.min(...flying));
      expect(st.holding).toBe(st.prongs.reduce((a, p) => a + p.holding, 0));
    }
    expect(twoProngs).toBeGreaterThan(5);
  });

  // h10-sim (DESIGN.md H10 "Save, data version and replay", items (a)-(h)): the hive's rebuild queue and the roll-on. The
  // replay sets hive.rebuildTicks 300 at tick 0 (the hive starts above its caps, so nothing rebuilds until guard.capPct 88 at
  // 650 makes its caps 10 Thorns and 15 Spores and something dies below them), and raid.rollMax 1 from 5870 to 6250.
  const R = 300;
  const snapAt = (tick: number) => hiveLog[tick]!;
  const a5 = 5;

  it('H10: the replay sets the rule keys it needs (hive.rebuildTicks 300 at 0, 0 at 2700, 300 at 2760; raid.rollMax 1 at 5870, 0 at 6250)', () => {
    const tuned = (key: string) => referenceReplay.inputs.filter((e) => e.input.type === 'setTunable' && e.input.key === key).map((e) => [e.tick, (e.input as Extract<Input, { type: 'setTunable' }>).value]);
    expect(tuned('hive.rebuildTicks')).toEqual([[0, R], [2700, 0], [2760, R]]);
    expect(tuned('raid.rollMax')).toEqual([[5870, 1], [6250, 0]]);
    // From 650 (guard.capPct 88) until (m)'s 7800, the hive's caps are 10 Thorns and 15 Spores.
    expect(hiveLog.filter((h) => h.tick >= 650 && h.tick < 7800 && (h.caps[0] !== 10 || h.caps[1] !== 15))).toEqual([]);
  });

  it('H10 D2/D3: every guard the queue adds, in order: one at a time, R ticks apart while something is missing, each of the type D3 picks from what was missing then', () => {
    expect(rebuilt).toEqual([
      // The push at 2250-2310 (item c): 5 Thorns and 5 Spores killed, the hive at 7T 11S against caps of 10 and 15.
      { tick: 2549, type: 'thorn', missingBefore: [3, 4], caps: [10, 15] },
      // (Item f: the queue is off from 2700 to 2759, so the next guard is R ticks after 2760.)
      { tick: 3059, type: 'spore', missingBefore: [2, 4], caps: [10, 15] },
      { tick: 3359, type: 'thorn', missingBefore: [2, 3], caps: [10, 15] },
      { tick: 3659, type: 'spore', missingBefore: [1, 3], caps: [10, 15] },
      { tick: 3959, type: 'spore', missingBefore: [1, 2], caps: [10, 15] },
      { tick: 4259, type: 'thorn', missingBefore: [1, 1], caps: [10, 15] },
      // Raid 2's Thorn died at 4290 at p1 (missing 0T 1S → 1T 1S); the count went on.
      { tick: 4559, type: 'thorn', missingBefore: [1, 1], caps: [10, 15] },
      { tick: 4859, type: 'spore', missingBefore: [0, 1], caps: [10, 15] },
      // Raid 3's prong 1, beaten at p2 at 6060 (item a).
      { tick: 6359, type: 'thorn', missingBefore: [1, 1], caps: [10, 15] },
      { tick: 6659, type: 'spore', missingBefore: [0, 1], caps: [10, 15] },
    ]);
    for (const r of rebuilt) {
      const [mt, ms] = r.missingBefore;
      const [ct, cs] = r.caps;
      expect(r.type, `tick ${r.tick}`).toBe(mt > 0 && mt * cs >= ms * ct ? 'thorn' : 'spore');
    }
    // One guard per completion: the queue's progress is R - 1 the tick before each add and 0 on it, and one guard joins.
    for (const r of rebuilt) {
      expect([snapAt(r.tick - 1).progress, snapAt(r.tick).progress], `tick ${r.tick}`).toEqual([R - 1, 0]);
      const size = (h: HiveSnap) => h.alive[0] + h.alive[1] + h.out[0] + h.out[1];
      expect(size(snapAt(r.tick)) - size(snapAt(r.tick - 1)), `tick ${r.tick}`).toBe(1);
    }
    // The hive's own R9 timers stay at 0 while the queue runs (they move only in item f's window, when it is off).
    expect(hiveLog.filter((h) => h.rebuildTicks > 0 && (h.rg[0] !== 0 || h.rg[1] !== 0)).map((h) => h.tick)).toEqual([]);
    // Every tick of the live hive under D2: with nothing missing the progress is 0; with something missing it counts, except
    // on a completion's tick (0 again, the next guard's count starting the tick after).
    const adds = new Set(rebuilt.map((r) => r.tick));
    for (const h of hiveLog) {
      if (!h.live || h.rebuildTicks === 0) continue;
      if (h.missing[0] + h.missing[1] === 0 || adds.has(h.tick)) expect(h.progress, `tick ${h.tick}`).toBe(0);
      else expect(h.progress, `tick ${h.tick}`).toBeGreaterThan(0);
    }
  });

  it("H10 (a): raid 3's prong 1 is beaten at p2 (6060) with the hive at its caps: a deficit of 1T 1S, and the queue adds one guard (a Thorn) on the deficit's R-th tick", () => {
    expect(entry(6060).prongs[1]).toMatchObject({ phase: 'done', outcome: 'beaten', killed: 2 });
    expect(snapAt(6059)).toMatchObject({ missing: [0, 0], progress: 0 });
    expect(snapAt(6060)).toMatchObject({ missing: [1, 1], progress: 1 });
    // Rule 9 runs after the raid in the step, so the tick of the deaths is the deficit's first; the guard lands on its R-th.
    const next = rebuilt.find((r) => r.tick >= 6060)!;
    expect(next.tick - 6060 + 1).toBe(R);
    expect(next.type).toBe('thorn');
  });

  it('H10 (b): the D3 pick: a Thorn on a tie (2T 3S missing against caps of 10 and 15), and a Spore when the Spores are further below in proportion with Thorns missing too', () => {
    const tie = rebuilt.filter((r) => r.missingBefore[0] > 0 && r.missingBefore[0] * r.caps[1] === r.missingBefore[1] * r.caps[0]);
    expect(tie.map((r) => [r.tick, r.type])).toEqual([[3359, 'thorn']]);
    const further = rebuilt.filter((r) => r.missingBefore[0] > 0 && r.missingBefore[0] * r.caps[1] < r.missingBefore[1] * r.caps[0]);
    expect(further.map((r) => [r.tick, r.type])).toEqual([[3059, 'spore'], [3659, 'spore'], [3959, 'spore']]);
    // The sheet's readout names the same pick: guardianStatus(hive).rebuild, sampled mid-rebuild and when full, with the
    // hive's regrow rows at progress 0 and the queue's period (H10 "Selectors").
    expect(rebuildStatus).toEqual([
      { tick: 2549, rebuild: { ticks: R, progress: 0, nextType: 'spore' }, thornRow: [0, R], sporeRow: [0, R] },
      { tick: 6200, rebuild: { ticks: R, progress: 141, nextType: 'thorn' }, thornRow: [0, R], sporeRow: [0, R] },
      { tick: 6659, rebuild: { ticks: R, progress: 0, nextType: null }, thornRow: [0, R], sporeRow: [0, R] },
    ]);
  });

  it('H10 (c): a push at the hive (5 ships, 2250-2310) loses: the queue runs through the battle, and the hive is below its caps when it ends', () => {
    // (The winning push of item h starts and ends on the capture's tick, 8010, so the log of battles seen running has this one.)
    expect(hiveBattles).toHaveLength(1);
    const lost = hiveBattles[0]!;
    expect(lost.end).toBe(2310);
    expect(lost.result).toMatchObject({ outcome: 'repelled', startTick: 2250, shipsEngaged: 5, shipsLost: 5, guardsKilled: 10, killedByType: { thorn: 5, spore: 5 } });
    // The first deaths are in the battle's first round (2250), and the queue counts on every tick of the battle from then.
    expect(lost.progressDuring).toEqual(Array.from({ length: 2310 - 2250 }, (_, i) => i + 1));
    expect(lost.snap).toMatchObject({ alive: [7, 11], caps: [10, 15], missing: [3, 4], progress: 61, live: true });
    // The next battle at the hive is the winning push (item h).
    expect(guardianAt(w, heartIndex(w))!.lastBattle).toMatchObject({ outcome: 'captured', startTick: 8010 });
  });

  it('H10 (d): raid 2 musters (3600) after the beaten raid 1, mid-rebuild, smaller than its want: alive − keep is 3, its want 5', () => {
    expect(result(1).last.outcome).toBe('beaten');
    const m = h10Musters.find((x) => x.id === 2)!;
    // At 3600 the replay sets raid.econPerRaider 2 and raid.hiveKeepPct 72 for the muster (3 and 50 again from 3601): at the
    // replay's scale (raids of 3, a hive of 25) the keep never binds at 50%.
    expect(m).toEqual({ id: 2, tick: 3600, planned: 3, econ: 9, want: 5, keep: 18, alive: 21, missing: [1, 3], progress: 241 });
    expect(m.planned).toBe(m.alive - m.keep);
    expect(m.planned).toBeLessThan(m.want);
  });

  it("H10 (e): a prong rejoining the hive mid-rebuild leaves the progress as it was (raid 2 at 4565, raid 3's prong 0 at 6384)", () => {
    for (const [land, back] of [[4565, 2], [6384, 3]] as const) {
      const before = snapAt(land - 1);
      const after = snapAt(land);
      expect(before.out[0] + before.out[1], `tick ${land}`).toBe(back);
      expect(after.out, `tick ${land}`).toEqual([0, 0]);
      expect(after.alive[0] + after.alive[1], `tick ${land}`).toBe(before.alive[0] + before.alive[1] + back);
      expect(after.missing, `tick ${land}`).toEqual(before.missing);
      expect(before.progress, `tick ${land}`).toBeGreaterThan(0);
      // The tick's own count, nothing more: the rejoin neither resets nor advances it.
      expect(after.progress, `tick ${land}`).toBe(before.progress + 1);
    }
  });

  it("H10 (f): setTunable hive.rebuildTicks 0 mid-rebuild (2700) hands the hive to R9's timers from 0; back to 300 (2760) restarts the queue from 0", () => {
    expect(snapAt(2699)).toMatchObject({ rebuildTicks: R, progress: 150, rg: [0, 0], missing: [2, 4] });
    expect(snapAt(2700)).toMatchObject({ rebuildTicks: 0, progress: 0, rg: [1, 1] });
    expect(snapAt(2759)).toMatchObject({ rebuildTicks: 0, progress: 0, rg: [60, 60] });
    expect(snapAt(2760)).toMatchObject({ rebuildTicks: R, progress: 1, rg: [0, 0] });
    // R9's period here is 600 (guard.<type>.regrowTicks 600 × hive.regrowPct 100), so nothing grew in those 60 ticks.
    expect(rebuilt.filter((r) => r.tick >= 2700 && r.tick <= 2760)).toEqual([]);
  });

  it("H10 (g): with raid.rollMax 1, raid 3's prong 0 hits p1, rolls on to a5 (6090; the hold moves on that tick), stays undecided through the roll, and hits again", () => {
    // At 6089 it fights at p1, which is held; at 6090 it leaves p1 for a5, and the hold moves with it.
    expect(holds.find((h) => h.tick === 6089)).toEqual({ tick: 6089, p1: true, a5: false });
    expect(holds.find((h) => h.tick === 6090)).toEqual({ tick: 6090, p1: false, a5: true });
    const rolled = entry(6090);
    expect(rolled.prongs[0]).toMatchObject({ phase: 'out', target: a5, outcome: null, lost: 1 });
    expect(rolled.status.prongs[0]).toMatchObject({ target: a5, phase: 'out', rolls: 1, rolledFrom: p1, outcome: null });
    expect(rolled.status.phase).toBe('out');
    // The outcome stays open until it leaves a5 for home (6240), after its second hit (6210).
    const during = prongLog.filter((e) => e.id === 3 && e.tick >= 6090 && e.tick < 6240);
    expect(during.length).toBeGreaterThan(1);
    expect(during.every((e) => e.prongs[0]!.outcome === null)).toBe(true);
    expect(entry(6210).prongs[0]).toMatchObject({ phase: 'fight', target: a5, lost: 2 });
    expect(entry(6240).status.prongs[0]).toMatchObject({ phase: 'home', outcome: 'hit', rolls: 1, rolledFrom: p1 });
    const last = result(3).last;
    expect(last.prongs.map((p) => [p.hitRocks, p.hiveLost])).toEqual([[[p1, a5], 0], [[], 2]]);
    expect(w.stats.raidRolls).toBe(1);
    expect(fieldSummary(w).raidRolls).toBe(1);
    // No other prong ever rolled (raid.rollMax is 0 outside 5870-6249).
    expect([...new Set(prongLog.filter((e) => e.status.prongs.some((p) => p.rolls > 0)).map((e) => e.id))]).toEqual([3]);
  });

  it('H10 (h): the hive falls (8010) with the queue counting (guard.capPct 100 from 7990 puts it below its caps); the count drops to 0 and nothing rebuilds after', () => {
    expect(snapAt(8009)).toMatchObject({ live: true, progress: 20 });
    expect(snapAt(8009).missing[0] + snapAt(8009).missing[1]).toBeGreaterThan(0);
    expect(snapAt(8010)).toMatchObject({ live: false, progress: 0, alive: [0, 0] });
    expect(w.capturedTick).toBe(8010);
    expect(hiveLog.filter((h) => h.tick > 8010 && (h.progress !== 0 || h.ids.length > 0)).map((h) => h.tick)).toEqual([]);
    // fieldSummary.hive: raiders killed at rocks (raid 1: 2, raid 2: 1, raid 3's prong 1: 2), and guards killed at the hive
    // (the lost push: 10; the winning one: the 23 at home).
    const won = guardianAt(w, heartIndex(w))!.lastBattle!;
    expect(won.guardsKilled).toBe(23);
    expect(fieldSummary(w).hive).toEqual({ alive: 0, cap: 30, lostToRaids: 5, lostToPushes: 10 + 23 });
  });

  it('is deterministic: two runs give the same 30 checkpoint hashes', () => {
    const a = replayHashes(referenceReplay, data, 9000, 300);
    const b = replayHashes(referenceReplay, data, 9000, 300);
    expect(a).toHaveLength(30);
    expect(a).toEqual(b);
  });
});
