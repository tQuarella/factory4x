import { describe, expect, it } from 'vitest';
import { PROBE, createWorld, parseSimData, step, type Input, type SimData, type World } from '../src/index.ts';
import raw13 from './fixtures/sim-v13.json' with { type: 'json' };
import { F, addEcon } from './field-helpers.ts';

/**
 * h8-sim acceptance 1, the hauler repro (owner, build-20261114-1: "A2 just got a third hauler. A1 has no haulers.").
 * Written on the v13 rules (H7 F6) before any H8 rule change (commit 0291294, where both "(a) buffer only" and
 * "(b) Stop and re-mark" failed), on the frozen v13 fixture (data/sim.json as it shipped at dataVersion 13, so
 * `map.field` and the allocation are the shipped ones). The fixture carries the H8 keys at H7's behaviour
 * (hauler.autoNeed 0); each world here sets hauler.autoNeed to the mode under test.
 *
 * Under H8 (hauler.autoNeed 1, H1–H4) every case passes: a buffer-only rock needs 1 hauler (H1's max(1, …)), so it
 * ranks by its shortfall like any rock. Under hauler.autoNeed 0 (H7's F6 exactly, H5) the producing rocks still come
 * first, so the two failing cases stay as they were: that is the in-build comparison, kept exact.
 */
const D13: SimData = parseSimData(raw13);

function stepW(w: World, n = 1): void {
  for (let i = 0; i < n; i++) step(w, D13, []);
}

/** A quiet v13 field (no stock, no probe mining, every weight 0) with a1 and a2 Mine-marked, nothing else marked. */
function a1a2(auto: number): World {
  const w = createWorld(1, D13);
  w.tun['hauler.autoNeed'] = auto;
  const f = w.field!;
  w.stock.ore = 0;
  w.tun['economy.probeOrePerMin'] = 0;
  w.tun['raid.enabled'] = 0;
  for (const t of Object.keys(f.alloc) as (keyof typeof f.alloc)[]) f.alloc[t] = 0;
  f.mine = f.mine.map((_, i) => i === F.a1 || i === F.a2);
  return w;
}

/** A2 with two docked extractors and two haulers parked there; the caller sets up A1 (0 haulers). */
function ownerCase(auto: number, a1Extractors: number, a1Buffer: number): { w: World; next: ReturnType<typeof addEcon> } {
  const w = a1a2(auto);
  for (let i = 0; i < a1Extractors; i++) addEcon(w, 'extractor', F.a1, F.a1);
  addEcon(w, 'extractor', F.a2, F.a2);
  addEcon(w, 'extractor', F.a2, F.a2);
  addEcon(w, 'hauler', F.a2, F.a2);
  addEcon(w, 'hauler', F.a2, F.a2);
  w.nodes[F.a1]!.buffer = a1Buffer;
  stepW(w);
  const next = addEcon(w, 'hauler', PROBE);
  return { w, next };
}

/** Haulers assigned per node (target set, anywhere on the trip). */
function assigned(w: World): number[] {
  const out = w.nodes.map(() => 0);
  for (const s of w.field!.econ) if (s.type === 'hauler' && s.target !== null) out[s.target] = out[s.target]! + 1;
  return out;
}

/** F6 "worked": a docked or free extractor, or a buffer of at least 1. */
function worked(w: World, n: number): boolean {
  return n !== PROBE && (w.nodes[n]!.extractors > 0 || w.nodes[n]!.buffer >= 1);
}

/**
 * Plays the shipped v13 opening (createWorld, the shipped allocation) for 6 game minutes with `inputsAt(tick)`, and
 * checks every tick that no hauler is newly assigned to a rock that already has haulers while a worked, Mine-marked
 * rock has 0 (the owner's observation). Returns the violations and the number of assignments checked.
 */
function openingRun(auto: number, inputsAt: (t: number) => Input[], minutes = 6): { violations: string[]; assignments: number } {
  const w = createWorld(1, D13);
  w.tun['hauler.autoNeed'] = auto;
  const T = 1800;
  const violations: string[] = [];
  let assignments = 0;
  for (let t = 0; t < minutes * T; t++) {
    const inputs = inputsAt(t);
    // The state before the tick (after its inputs would apply, for the marks): a node worked here is still worked at
    // F6 (F4 only adds to buffers, F5 unbinds only on an unmark, which the mark check covers), so a rock with 0
    // haulers here is a rock F6 should staff first.
    const before = new Map(w.field!.econ.filter((s) => s.type === 'hauler').map((s) => [s.id, s.target]));
    const count = assigned(w);
    const marks = w.field!.mine.slice();
    for (const i of inputs) if (i.type === 'setMine') marks[i.node] = i.on;
    const idle = w.nodes.filter((n) => worked(w, n.index) && marks[n.index] === true && count[n.index] === 0).map((n) => n.index);
    const ext = w.nodes.map((n) => n.extractors);
    const buf = w.nodes.map((n) => n.buffer);
    step(w, D13, inputs);
    for (const s of w.field!.econ) {
      if (s.type !== 'hauler' || s.target === null) continue;
      const was = before.has(s.id) ? before.get(s.id)! : null;
      if (was === s.target) continue;
      assignments++;
      const n = s.target;
      // Haulers assigned earlier this tick count (id order), so a rock staffed by an earlier pick is no longer empty.
      const empty = idle.filter((m) => m !== n && count[m] === 0);
      if (count[n]! > 0 && empty.length > 0) {
        const name = (m: number): string => `${w.nodes[m]!.id} (${count[m]} haulers, ${ext[m]} extractors, buffer ${buf[m]})`;
        violations.push(`tick ${t}: hauler ${s.id} → ${name(n)} while ${empty.map(name).join(', ')}`);
      }
      count[n] = count[n]! + 1;
    }
  }
  return { violations, assignments };
}

const T = 1800;
const stopAndRemark = (t: number): Input[] =>
  t === 3 * T ? [{ type: 'setMine', node: F.a1, on: false }] : t === 3 * T + 150 ? [{ type: 'setMine', node: F.a1, on: true }] : [];

describe('hauler repro (owner: "A2 just got a third hauler. A1 has no haulers.") under H8 (hauler.autoNeed 1)', () => {
  it('(a) A1 worked by its docked extractors with 0 haulers: the next hauler at the probe goes to A1, not to A2 (2 haulers)', () => {
    const { w, next } = ownerCase(1, 2, 0);
    expect([worked(w, F.a1), w.field!.mine[F.a1], assigned(w)[F.a1]]).toEqual([true, true, 0]);
    stepW(w);
    expect(next.target).toBe(F.a1);
  });

  it('(a) A1 worked by its buffer only (its extractors gone or still flying back) with 0 haulers: the next hauler at the probe goes to A1, not to A2', () => {
    const { w, next } = ownerCase(1, 0, 10);
    expect([worked(w, F.a1), w.field!.mine[F.a1], assigned(w)[F.a1], w.nodes[F.a1]!.extractors]).toEqual([true, true, 0, 0]);
    stepW(w);
    expect(next.target).toBe(F.a1);
  });

  it('(b) the shipped opening (v13, the shipped allocation, no inputs) for 6 game minutes: no new hauler goes to a rock with a higher ratio while a worked, marked rock has 0 haulers', () => {
    const r = openingRun(1, () => []);
    expect(r.assignments).toBeGreaterThan(0);
    expect(r.violations).toEqual([]);
  });

  it('(b) the same opening with one Stop and re-mark of A1 (at 3:00 and 3:05): no new hauler goes to a rock with haulers while a rock is worked, marked and has 0', () => {
    const r = openingRun(1, stopAndRemark);
    expect(r.assignments).toBeGreaterThan(0);
    expect(r.violations).toEqual([]);
  });
});

describe('the same cases under hauler.autoNeed 0 (H7 F6 exactly): they guard the H7 rule', () => {
  it('(a) docked extractors: the hauler goes to A1 (ratio 0 beats 2/2 at A2)', () => {
    const { w, next } = ownerCase(0, 2, 0);
    stepW(w);
    expect(next.target).toBe(F.a1);
  });

  it('(a) buffer only: the hauler goes to A2, as H7 ranked a rock with no working extractor after every rock with one', () => {
    const { w, next } = ownerCase(0, 0, 10);
    stepW(w);
    expect(next.target).toBe(F.a2);
  });

  it('(b) the shipped opening with no inputs: no violation in 6 game minutes', () => {
    const r = openingRun(0, () => []);
    expect(r.assignments).toBeGreaterThan(0);
    expect(r.violations).toEqual([]);
  });

  it('(b) Stop and re-mark of A1: the two violations recorded on the v13 rules, at a3 after the raid it drew', () => {
    const r = openingRun(0, stopAndRemark);
    expect(r.violations).toEqual([
      'tick 8160: hauler 47 → a1 (1 haulers, 1 extractors, buffer 1) while a3 (0 haulers, 0 extractors, buffer 3)',
      'tick 9390: hauler 49 → a1 (2 haulers, 2 extractors, buffer 3) while a3 (0 haulers, 0 extractors, buffer 3)',
    ]);
  });
});

/**
 * The two other ways into the owner's state named in DECISIONS.md (h8-sim, the repro entry): a recycle and a Stop
 * then re-mark each leave A1 Mine-marked, with ore in its buffer, no docked extractor and no hauler. Under
 * hauler.autoNeed 0 the next hauler goes to A2 (H7's order); under 1 it goes to A1.
 */
describe('other ways into "A1 has no haulers": a recycle, and a Stop then re-mark', () => {
  /** A2 with 2 docked extractors and 2 haulers waiting; A1 with 2 docked extractors, 1 hauler waiting and a buffer of 10. */
  function both(auto: number): World {
    const w = a1a2(auto);
    for (const n of [F.a1, F.a1, F.a2, F.a2]) addEcon(w, 'extractor', n, n);
    addEcon(w, 'hauler', F.a2, F.a2);
    addEcon(w, 'hauler', F.a2, F.a2);
    addEcon(w, 'hauler', F.a1, F.a1);
    w.nodes[F.a1]!.buffer = 10;
    return w;
  }

  for (const [auto, want] of [
    [0, F.a2],
    [1, F.a1],
  ] as const) {
    const name = want === F.a1 ? 'A1' : 'A2';
    it(`recycleShips of A1's extractors and hauler: A1 marked, buffer 10, no extractor, no hauler; the next hauler goes to ${name} (hauler.autoNeed ${auto})`, () => {
      const w = both(auto);
      step(w, D13, [{ type: 'recycleShips', node: F.a1, counts: { drone: 0, lancer: 0, flak: 0, extractor: 2, hauler: 1 } }]);
      expect([w.field!.mine[F.a1], w.nodes[F.a1]!.buffer >= 1, w.nodes[F.a1]!.extractors, assigned(w)[F.a1]]).toEqual([true, true, 0, 0]);
      const next = addEcon(w, 'hauler', PROBE);
      stepW(w);
      expect(next.target).toBe(want);
    });

    it(`Stop then re-mark of A1: its hauler takes 4 and goes, its extractors leave and fly back on re-mark, so A1 is marked with 6 left and no docked extractor; ${auto === 1 ? 'A1 gets a hauler at once (the idle one, H2)' : 'A1 has no hauler and the next one goes to A2'} (hauler.autoNeed ${auto})`, () => {
      const w = both(auto);
      step(w, D13, [{ type: 'setMine', node: F.a1, on: false }]);
      // The waiting hauler loaded min(10, 4) and left; the extractors had nowhere to go and fly home.
      expect(w.nodes[F.a1]!.buffer).toBe(6);
      // A1's hauler gets home and drops A1 at the probe (A1 is unmarked); its extractors are home and idle.
      const h = w.field!.econ.find((s) => s.type === 'hauler' && s.target === F.a1)!;
      for (let i = 0; i < 400 && h.target === F.a1; i++) stepW(w);
      for (let i = 0; i < 400 && w.field!.econ.some((s) => s.type === 'extractor' && s.transit !== null); i++) stepW(w);
      expect(assigned(w)[F.a1]).toBe(0);
      expect(w.field!.econ.filter((s) => s.type === 'extractor' && s.at === PROBE && s.target === null)).toHaveLength(2);
      // H7: the hauler that dropped A1 took A2 (ratio 2/2 against nothing worked); H8: A2 was at its target (1), so it idles.
      expect(h.target).toBe(auto === 1 ? null : F.a2);
      step(w, D13, [{ type: 'setMine', node: F.a1, on: true }]);
      expect([w.field!.mine[F.a1], w.nodes[F.a1]!.buffer, w.nodes[F.a1]!.extractors]).toEqual([true, 6, 0]);
      if (auto === 1) {
        // The idle hauler takes A1's shortfall the tick it is re-marked.
        expect([h.target, assigned(w)[F.a1]]).toEqual([F.a1, 1]);
        return;
      }
      expect(assigned(w)[F.a1]).toBe(0);
      const next = addEcon(w, 'hauler', PROBE);
      stepW(w);
      expect(next.target).toBe(want);
    });
  }
});
