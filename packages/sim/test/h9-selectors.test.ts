import { describe, expect, it } from 'vitest';
import {
  PROBE,
  createWorld,
  fieldSummary,
  guardianAt,
  raidKeep,
  raidStatus,
  rockStatus,
  step,
  type Input,
  type ProngStatus,
  type World,
} from '../src/index.ts';
import { fixtureV15 } from './fixture.ts';
import { addShips, setGuards } from './helpers.ts';
import { F, addEcon, quietField } from './field-helpers.ts';

/**
 * h9-sim acceptance 5: every H9 selector field in its final shape. The raid fields are stubs that mirror today's
 * single raid as one prong (DESIGN.md H9 "Stub for parallel work"); these tests pin the stub's mapping so h9-raids
 * can replace it knowingly. On the frozen v15 fixture (raid speed 3: a5 is 430 su from the hive, 144 ticks; muster
 * 450 ticks; keep 50% of the hive's caps).
 */
const D = fixtureV15;
const hive = (w: World) => guardianAt(w, F.heart)!;

function tick(w: World, ...inputs: Input[]): void {
  step(w, D, inputs);
}

/** A quiet v15 field where a5 is mined (one docked extractor, `haulers` haulers at the probe for a5) and a raid musters at once. */
function raidField(haulers = 3): World {
  const w = quietField(D);
  w.field!.mine[F.a5] = true;
  addEcon(w, 'extractor', F.a5, F.a5);
  for (let i = 0; i < haulers; i++) addEcon(w, 'hauler', PROBE, F.a5);
  w.tun['raid.firstAtEcon'] = 2;
  w.tun['raid.econPerRaider'] = 1;
  return w;
}

/** The stub's mapping: no raid, no prongs; else one prong equal to the legacy fields, its outcome decided once it is home-bound. */
function expectMirror(w: World): ProngStatus | null {
  const s = raidStatus(w);
  const r = w.raid;
  if (r === null) {
    expect(s.prongs).toEqual([]);
    for (const n of w.nodes) expect(rockStatus(w, n.index).raidMix).toBeNull();
    return null;
  }
  const outcome = r.phase === 'home' ? (r.lostEcon.extractor + r.lostEcon.hauler > 0 ? 'hit' : 'turnedBack') : null;
  expect(s.prongs).toEqual([{ target: s.target, phase: s.phase, planned: s.planned, raiders: s.raiders, ticksToArrival: s.ticksToArrival, outcome, holding: s.holding }]);
  for (const n of w.nodes) {
    const mix = rockStatus(w, n.index).raidMix;
    if (n.index !== r.target) expect(mix).toBeNull();
    else expect(mix).toEqual(r.phase === 'muster' ? s.planned : s.raiders);
  }
  return s.prongs[0]!;
}

/** Steps until the raid ends (or throws), checking the mirror on every tick; returns the phases and outcomes seen. */
function playRaid(w: World, each: (w: World) => Input[] = () => [], max = 3000): { phases: Set<string>; outcomes: Set<string>; holding: number } {
  const phases = new Set<string>();
  const outcomes = new Set<string>();
  let holding = 0;
  let started = false;
  for (let i = 0; i < max; i++) {
    tick(w, ...each(w));
    const p = expectMirror(w);
    if (p !== null) {
      started = true;
      phases.add(p.phase);
      if (p.outcome !== null) outcomes.add(p.outcome);
      holding = Math.max(holding, p.holding);
    } else if (started) return { phases, outcomes, holding };
  }
  throw new Error('the raid did not end');
}

describe('raidStatus.prongs and last.prongs (stub: one prong mirroring the raid)', () => {
  it('an undefended rock is hit: muster, out, fight, home with outcome hit, and holding per prong; last.prongs mirrors the result', () => {
    const w = raidField();
    expectMirror(w);
    // A hauler for a5 waiting at the probe once the raid is out: H10 holds it there for the prong.
    let added = false;
    const seen = playRaid(w, (x) => {
      if (!added && x.raid !== null && x.raid.phase === 'out') {
        addEcon(x, 'hauler', PROBE, F.a5);
        added = true;
      }
      return [];
    });
    expect([...seen.phases]).toEqual(['muster', 'out', 'fight', 'home']);
    expect([...seen.outcomes]).toEqual(['hit']);
    expect(seen.holding).toBeGreaterThan(0);
    const last = raidStatus(w).last!;
    expect(last.outcome).toBe('hit');
    expect(last.prongs).toEqual([{ target: last.target, outcome: last.outcome, lostEcon: last.lostEcon, lostShips: last.lostShips, killed: last.killed }]);
    expect(last.target).toBe(F.a5);
  });

  it('a raid whose rock is stopped while it flies turns back: outcome turnedBack while home, and in last.prongs', () => {
    const w = raidField();
    const seen = playRaid(w, (x) => (x.raid !== null && x.raid.phase === 'out' && x.field!.mine[F.a5] ? [{ type: 'setMine', node: F.a5, on: false }] : []));
    expect([...seen.phases]).toEqual(['muster', 'out', 'home']);
    expect([...seen.outcomes]).toEqual(['turnedBack']);
    expect(raidStatus(w).last!.prongs).toEqual([{ target: F.a5, outcome: 'turnedBack', lostEcon: { extractor: 0, hauler: 0 }, lostShips: { drone: 0, lancer: 0, flak: 0 }, killed: { thorn: 0, spore: 0 } }]);
  });

  it('a raid beaten by defenders ends at once (no home phase): last.prongs has the beaten prong with its kills', () => {
    const w = raidField();
    addShips(w, F.a5, 30);
    const seen = playRaid(w);
    expect([...seen.phases]).toEqual(['muster', 'out', 'fight']);
    expect([...seen.outcomes]).toEqual([]);
    const last = raidStatus(w).last!;
    expect(last.outcome).toBe('beaten');
    expect(last.prongs).toEqual([{ target: F.a5, outcome: 'beaten', lostEcon: last.lostEcon, lostShips: last.lostShips, killed: last.killed }]);
    expect(last.killed.thorn + last.killed.spore).toBeGreaterThan(0);
  });

  it('a raid out when the hive falls withers: last.prongs carries withered', () => {
    const w = raidField();
    for (let i = 0; i < 2000 && (w.raid === null || w.raid.phase !== 'out'); i++) tick(w);
    expect(w.raid!.phase).toBe('out');
    setGuards(w, F.heart, []);
    addShips(w, F.heart, 1);
    tick(w);
    expect(raidStatus(w).prongs).toEqual([]);
    expect(raidStatus(w).last!.outcome).toBe('withered');
    expect(raidStatus(w).last!.prongs.map((p) => [p.target, p.outcome])).toEqual([[F.a5, 'withered']]);
  });

  it('the prong count is 1 for any raid size under the stub', () => {
    const w = raidField(11);
    for (let i = 0; i < 2000 && w.raid === null; i++) tick(w);
    expect(raidStatus(w).planned.thorn + raidStatus(w).planned.spore).toBeGreaterThanOrEqual(8);
    expect(raidStatus(w).prongs).toHaveLength(1);
  });
});

describe('raidStatus.nextProngs (stub: 1 when a raid could muster now, else 0)', () => {
  it('1 with a raidable rock and a hive that can spare a raider, ignoring the gap, the economy threshold and a raid in progress', () => {
    const w = raidField();
    expect(raidStatus(w).nextProngs).toBe(1);
    w.tun['raid.firstAtEcon'] = 20;
    w.nextRaidTick = w.tick + 9000;
    expect(raidStatus(w).nextProngs).toBe(1);
    const m = raidField();
    for (let i = 0; i < 2000 && m.raid === null; i++) tick(m);
    expect([m.raid!.phase, raidStatus(m).nextProngs]).toEqual(['muster', 1]);
  });

  it('0 with no raidable rock, raids off, a hive that can\'t spare a raider, or the hive fallen', () => {
    const none = quietField(D);
    expect(raidStatus(none).nextProngs).toBe(0);
    const off = raidField();
    off.tun['raid.enabled'] = 0;
    expect(raidStatus(off).nextProngs).toBe(0);
    const thin = raidField();
    const h = hive(thin);
    h.guards = h.guards.slice(0, raidKeep(thin, h));
    expect(raidStatus(thin).nextProngs).toBe(0);
    h.guards = h.guards.concat([{ id: thin.nextId++, type: 'spore', hp: 1 }]);
    expect(raidStatus(thin).nextProngs).toBe(1);
    const fallen = raidField();
    setGuards(fallen, F.heart, []);
    addShips(fallen, F.heart, 1);
    tick(fallen);
    expect(raidStatus(fallen).nextProngs).toBe(0);
  });
});

describe('rockStatus: extractorSet, extCap, raidMix and raidNext', () => {
  it('extractorSet and extCap follow setExtractors (null and extCap = slots for All)', () => {
    const w = quietField(D);
    w.tun['raid.enabled'] = 0;
    expect([rockStatus(w, F.a5).extractorSet, rockStatus(w, F.a5).extCap]).toEqual([null, 3]);
    tick(w, { type: 'setExtractors', node: F.a5, count: 2 });
    expect([rockStatus(w, F.a5).extractorSet, rockStatus(w, F.a5).extCap]).toEqual([2, 2]);
    tick(w, { type: 'setExtractors', node: F.a5, count: 3 });
    expect([rockStatus(w, F.a5).extractorSet, rockStatus(w, F.a5).extCap]).toEqual([3, 3]);
    tick(w, { type: 'setExtractors', node: F.a5, count: null });
    expect([rockStatus(w, F.a5).extractorSet, rockStatus(w, F.a5).extCap]).toEqual([null, 3]);
  });

  it('raidMix is the plan while mustering and the raiders away afterwards, at the target only', () => {
    const w = raidField();
    for (let i = 0; i < 2000 && w.raid === null; i++) tick(w);
    expect(rockStatus(w, F.a5).raidMix).toEqual(w.raid!.planned);
    expect(rockStatus(w, F.a6).raidMix).toBeNull();
    for (let i = 0; i < 2000 && w.raid!.phase === 'muster'; i++) tick(w);
    const away = { thorn: 0, spore: 0 };
    for (const g of w.raid!.guards) away[g.type] += 1;
    expect(rockStatus(w, F.a5).raidMix).toEqual(away);
  });

  it('raidNext: the raidable rocks with raidRank ≤ nextProngs (1 under the stub); false when unmarked or when no raid could muster', () => {
    const w = raidField();
    w.field!.mine[F.a6] = true;
    addEcon(w, 'extractor', F.a6, F.a6);
    // Hive order: a5 (430 su) then a6 (534 su).
    expect([rockStatus(w, F.a5).raidRank, rockStatus(w, F.a6).raidRank]).toEqual([1, 2]);
    expect([rockStatus(w, F.a5).raidNext, rockStatus(w, F.a6).raidNext, rockStatus(w, F.a1).raidNext]).toEqual([true, false, false]);
    w.tun['raid.enabled'] = 0;
    expect(rockStatus(w, F.a5).raidNext).toBe(false);
  });
});

describe('fieldSummary.raidProngs', () => {
  it('reads stats.raidProngs (h9-raids counts one hit prong for the one-prong raid; a fresh world has zeros)', () => {
    const w = raidField();
    playRaid(w);
    expect(w.stats.raids.hit).toBe(1);
    expect(fieldSummary(w).raidProngs).toEqual({ beaten: 0, hit: 1, turnedBack: 0 });
    w.stats.raidProngs = { beaten: 2, hit: 1, turnedBack: 4 };
    expect(fieldSummary(w).raidProngs).toEqual({ beaten: 2, hit: 1, turnedBack: 4 });
    expect(createWorld(1, D).stats.raidProngs).toEqual({ beaten: 0, hit: 0, turnedBack: 0 });
  });
});
