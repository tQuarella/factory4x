import { describe, expect, it } from 'vitest';
import {
  campaignWorld,
  countGuards,
  createWorld,
  guardianAt,
  hashState,
  hiveAfter,
  raidProngs,
  rebuildPick,
  step,
  withRunMode,
  type GuardCounts,
  type Input,
  type World,
} from '../src/index.ts';
import { syncExtractors } from '../src/field.ts';
import { fixtureV16 } from './fixture.ts';
import { F, addEcon, quietField } from './field-helpers.ts';
import { addShips } from './helpers.ts';
import { withoutH10 } from './h10-strip.ts';

/**
 * h10-sim acceptance 2: D1-D6 (DESIGN.md H10 "Rules (field mode): changes to H9"), on the frozen v16 fixture, whose map.field
 * is the shipped one (data-h10.test.ts checks it), with `hive.rebuildTicks` set in each test (600 unless the test is about
 * another value). The hive holds 12 Thorns and 18 Spores at guard.capPct 100 (caps 12 and 18, keep 15). Everything steps the
 * whole sim (`step`), so the queue runs at rule 9's place, after the raid hook and combat.
 */
const D = fixtureV16;
const R = 600;
const hive = (w: World) => guardianAt(w, F.heart)!;
const counts = (w: World): [number, number] => {
  const c = countGuards(hive(w));
  return [c.thorn, c.spore];
};
const tick = (w: World, ...inputs: Input[]) => step(w, D, inputs);
const run = (w: World, n: number) => {
  for (let i = 0; i < n; i++) step(w, D, []);
};
const tun = (key: Extract<Input, { type: 'setTunable' }>['key'], value: number): Input => ({ type: 'setTunable', key, value });

/** A quiet v16 field (no marks, so no raids) with the queue at `ticks`. */
function rebuildField(ticks = R): World {
  const w = quietField(D);
  w.tun['hive.rebuildTicks'] = ticks;
  return w;
}

/** Removes the hive's `n` newest guards of `type` (a death before the next step; test setup). */
function kill(w: World, type: 'thorn' | 'spore', n: number): void {
  const h = hive(w);
  for (let k = 0; k < n; k++) {
    let i = h.guards.length - 1;
    while (h.guards[i]!.type !== type) i--;
    h.guards.splice(i, 1);
  }
}

/** A hand-built economy at `node`: one docked extractor and `n - 1` haulers there. The node is Mine-marked. */
function econAt(w: World, node: number, n: number): void {
  w.field!.mine[node] = true;
  addEcon(w, 'extractor', node, node);
  for (let i = 1; i < n; i++) addEcon(w, 'hauler', node, node);
  syncExtractors(w);
}

describe('D1: which rule runs', () => {
  it('at hive.rebuildTicks 0 the hive regrows by R9 as built: each type on its own timer at regrowTicks × hive.regrowPct ÷ 100, in parallel; the queue stays at 0', () => {
    const w = rebuildField(0);
    kill(w, 'thorn', 1);
    kill(w, 'spore', 1);
    // v16: guard.thorn.regrowTicks 60 and guard.spore.regrowTicks 20 at hive.regrowPct 200: 120 and 40 ticks.
    expect([w.tun['guard.thorn.regrowTicks'], w.tun['guard.spore.regrowTicks'], w.tun['hive.regrowPct']]).toEqual([60, 20, 200]);
    run(w, 39);
    expect(counts(w)).toEqual([11, 17]);
    run(w, 1);
    expect(counts(w)).toEqual([11, 18]);
    run(w, 79);
    expect(counts(w)).toEqual([11, 18]);
    run(w, 1);
    expect(counts(w)).toEqual([12, 18]);
    expect(w.field!.hiveRebuildProgress).toBe(0);
  });

  it('above 0 the queue runs instead: one counter, one guard at a time, and the hive\'s R9 timers stay at {0, 0}', () => {
    const w = rebuildField();
    kill(w, 'thorn', 1);
    kill(w, 'spore', 1);
    run(w, R - 1);
    expect(counts(w)).toEqual([11, 17]);
    expect(hive(w).regrowProgress).toEqual({ thorn: 0, spore: 0 });
    expect(w.field!.hiveRebuildProgress).toBe(R - 1);
    run(w, 1);
    expect(counts(w)).toEqual([12, 17]); // D3: 1 × 18 ≥ 1 × 12, a Thorn
    run(w, R);
    expect(counts(w)).toEqual([12, 18]);
    expect(hive(w).regrowProgress).toEqual({ thorn: 0, spore: 0 });
  });

  it('pockets always use rule 9, unchanged: a pocket regrows the same at hive.rebuildTicks 0 and 600', () => {
    const play = (ticks: number) => {
      const w = rebuildField(ticks);
      const p2 = guardianAt(w, F.p2)!;
      p2.guards = p2.guards.slice(0, 1); // the Thorn alone: 2 Spores to regrow
      const seen: string[] = [];
      for (let i = 0; i < 200; i++) {
        tick(w);
        seen.push(JSON.stringify([p2.guards.map((g) => [g.type, g.hp]), p2.regrowProgress]));
      }
      return seen;
    };
    const off = play(0);
    expect(play(R)).toEqual(off);
    expect(off[off.length - 1]).toBe(JSON.stringify([[['thorn', 20], ['spore', 6], ['spore', 6]], { thorn: 0, spore: 0 }]));
  });

  it('campaign mode is untouched: a landed area\'s heart regrows by rule 9 at hive.rebuildTicks 600 exactly as at 0', () => {
    const d = withRunMode(D, 'campaign');
    const play = (ticks: number) => {
      const w = campaignWorld(1, d, { reclaimed: ['landfall'], land: 'shelf' });
      w.tun['hive.rebuildTicks'] = ticks;
      expect(w.field).toBeNull();
      const h = w.guardians.find((g) => w.nodes[g.node]!.kind === 'heart')!;
      h.guards = h.guards.slice(0, 3);
      const hashes: string[] = [];
      for (let i = 0; i < 600; i++) {
        step(w, d, []);
        if (i % 50 === 49) hashes.push(hashState(withoutH10(w)));
      }
      return { hashes, guards: h.guards.length };
    };
    const off = play(0);
    expect(play(R)).toEqual(off);
    expect(off.guards).toBeGreaterThan(3); // the heart did regrow, by rule 9
  });
});

describe('D2: the queue', () => {
  it('exactly one guard is added on the R-th tick of a deficit (the tick of the death is the first), then the count starts again', () => {
    const w = rebuildField();
    run(w, 5);
    expect(w.field!.hiveRebuildProgress).toBe(0);
    kill(w, 'spore', 2);
    tick(w); // the deficit's first tick
    expect(w.field!.hiveRebuildProgress).toBe(1);
    run(w, R - 2);
    expect([counts(w), w.field!.hiveRebuildProgress]).toEqual([[12, 16], R - 1]);
    const ids = new Set(hive(w).guards.map((g) => g.id));
    tick(w); // the R-th
    expect([counts(w), w.field!.hiveRebuildProgress]).toEqual([[12, 17], 0]);
    const added = hive(w).guards.filter((g) => !ids.has(g.id));
    expect(added).toEqual([{ id: w.nextId - 1, type: 'spore', hp: w.tun['guard.spore.hp'] }]);
    run(w, R - 1);
    expect(counts(w)).toEqual([12, 17]);
    tick(w);
    expect([counts(w), w.field!.hiveRebuildProgress]).toEqual([[12, 18], 0]);
    run(w, 3 * R);
    expect([counts(w), w.field!.hiveRebuildProgress]).toEqual([[12, 18], 0]);
  });

  it('with nothing missing the progress is 0 and nothing is added; lowering the caps mid-count (guard.capPct) resets it, and nothing is trimmed', () => {
    const w = rebuildField();
    run(w, 100);
    expect([counts(w), w.field!.hiveRebuildProgress]).toEqual([[12, 18], 0]);
    kill(w, 'thorn', 1);
    run(w, 300);
    expect(w.field!.hiveRebuildProgress).toBe(300);
    tick(w, tun('guard.capPct', 50)); // caps 6 and 9: alive 11T 18S is above both
    expect([counts(w), w.field!.hiveRebuildProgress]).toEqual([[11, 18], 0]);
    run(w, 2 * R);
    expect([counts(w), w.field!.hiveRebuildProgress]).toEqual([[11, 18], 0]);
  });

  it('the queue runs during a battle at the hive: a guard is added while the battle goes on (D4)', () => {
    const w = rebuildField();
    // A long battle: one tough Drone against the hive's 2 Thorns (the rest gone), whose damage is turned down.
    hive(w).guards = hive(w).guards.filter((g) => g.type === 'thorn').slice(0, 2);
    w.tun['guard.thorn.damage'] = 1;
    w.tun['ship.drone.hp'] = 200;
    w.tun['ship.drone.damage'] = 3; // against a Thorn's repair of 2 a round: one net damage a round, a Thorn every 20 rounds
    addShips(w, F.heart, 1);
    const during: Array<{ tick: number; added: string[]; progress: number }> = [];
    for (let i = 0; i < 1500 && hive(w).alive; i++) {
      const ids = new Set(hive(w).guards.map((g) => g.id));
      tick(w);
      const added = hive(w).guards.filter((g) => !ids.has(g.id)).map((g) => g.type);
      if (hive(w).battle !== null) during.push({ tick: w.tick - 1, added, progress: w.field!.hiveRebuildProgress });
    }
    // The battle starts on tick 0 (a round tick) and runs past R ticks; the queue (10T 18S missing from the start) counts on
    // every tick of it and adds one guard on its R-th tick, while the fight goes on.
    expect(during[0]!.tick).toBe(0);
    expect(during.length).toBeGreaterThan(R);
    expect(during.slice(0, R - 1).map((d) => d.progress)).toEqual(Array.from({ length: R - 1 }, (_, i) => i + 1));
    // (D3: 10 Thorns of 12 and 18 Spores of 18 missing, 10 × 18 < 18 × 12, so a Spore.)
    expect(during[R - 1]).toEqual({ tick: R - 1, added: ['spore'], progress: 0 });
    expect(during.slice(0, R - 1).every((d) => d.added.length === 0)).toBe(true);
  });

  it('D5: at the capture the progress is 0, alongside R9\'s timers, and nothing rebuilds after', () => {
    const w = rebuildField();
    hive(w).guards = [];
    run(w, 250);
    expect(w.field!.hiveRebuildProgress).toBe(250);
    addShips(w, F.heart, 1);
    tick(w);
    expect(hive(w).alive).toBe(false);
    expect(w.capturedTick).toBe(w.tick - 1);
    expect([w.field!.hiveRebuildProgress, hive(w).regrowProgress]).toEqual([0, { thorn: 0, spore: 0 }]);
    run(w, 3 * R);
    expect([hive(w).guards, w.field!.hiveRebuildProgress]).toEqual([[], 0]);
  });
});

describe('D3: the pick', () => {
  it('rebuildPick: Thorn on a tie, the type further below its cap in proportion otherwise; a type with nothing missing never; caps of 0', () => {
    const c = (thorn: number, spore: number): GuardCounts => ({ thorn, spore });
    const caps = c(12, 18);
    expect(rebuildPick(c(2, 3), caps)).toBe('thorn'); // 36 = 36: the tie goes to Thorn
    expect(rebuildPick(c(4, 6), caps)).toBe('thorn');
    expect(rebuildPick(c(1, 3), caps)).toBe('spore'); // 18 < 36
    expect(rebuildPick(c(2, 4), caps)).toBe('spore'); // 36 < 48
    expect(rebuildPick(c(3, 4), caps)).toBe('thorn'); // 54 > 48
    expect(rebuildPick(c(1, 0), caps)).toBe('thorn');
    expect(rebuildPick(c(0, 1), caps)).toBe('spore'); // Thorns at cap: never picked
    expect(rebuildPick(c(0, 0), caps)).toBeNull();
    // A cap of 0 always has 0 missing, so the other type is picked (or nothing).
    expect(rebuildPick(c(0, 5), c(0, 18))).toBe('spore');
    expect(rebuildPick(c(3, 0), c(12, 0))).toBe('thorn');
    expect(rebuildPick(c(0, 0), c(0, 0))).toBeNull();
  });

  it('the type is picked at completion: a Thorn dying mid-count turns the next guard from a Spore into a Thorn', () => {
    const w = rebuildField();
    kill(w, 'spore', 1);
    run(w, 300);
    kill(w, 'thorn', 1); // now 1T 1S missing: 1 × 18 ≥ 1 × 12
    run(w, R - 300);
    expect(counts(w)).toEqual([12, 17]);
  });

  it('in the sim: a type whose cap is 0 is never rebuilt (the hive\'s Thorn count set to 0 in its layout)', () => {
    const w = rebuildField();
    hive(w).counts = { thorn: 0, spore: 18 };
    kill(w, 'spore', 2);
    kill(w, 'thorn', 12);
    run(w, 4 * R);
    expect(counts(w)).toEqual([0, 18]);
  });

  it('in the sim: a type at its cap is never picked, however far the other is below', () => {
    const w = rebuildField();
    kill(w, 'spore', 3);
    run(w, 3 * R);
    expect(counts(w)).toEqual([12, 18]);
    expect(hive(w).guards.filter((g) => g.type === 'thorn')).toHaveLength(12);
  });
});

describe('raiders away are never rebuilt (W7, D2)', () => {
  /** A v16 field with economy at these rocks and raids of up to 24 (a raid of 12 from 24 economy ships). */
  function raidWorld(marked: number[], econ: number, prongsMax: number): World {
    const w = rebuildField();
    w.tun['raid.prongsMax'] = prongsMax;
    w.tun['raid.maxSize'] = 24;
    w.tun['raid.firstAtEcon'] = 2;
    let left = econ;
    marked.forEach((node, i) => {
      const n = Math.ceil(left / (marked.length - i));
      econAt(w, node, n);
      left -= n;
    });
    return w;
  }

  it('single prong: while it is away nothing is missing; when it is beaten only its dead are rebuilt, one at a time, up to the caps', () => {
    const w = raidWorld([F.a5], 12, 2);
    addShips(w, F.a5, 8, 'flak'); // defenders that beat it at a5
    let away = 0;
    for (let i = 0; i < 4000 && w.lastRaid === null; i++) {
      tick(w);
      const r = w.raid;
      if (r !== null && raidProngs(r).every((p) => p.phase === 'out')) {
        // Away, before any fight: the hive's list plus the raiders out are its caps, so nothing is missing.
        expect([counts(w)[0] + counts(w)[1] + r.guards.length, w.field!.hiveRebuildProgress]).toEqual([30, 0]);
        away++;
      }
    }
    expect(away).toBeGreaterThan(100);
    expect(w.lastRaid).toMatchObject({ outcome: 'beaten' });
    const lost = w.lastRaid!.killed.thorn + w.lastRaid!.killed.spore;
    expect(lost).toBe(6); // 12 economy ships ÷ raid.econPerRaider 2
    expect(counts(w)[0] + counts(w)[1]).toBe(30 - lost);
    w.tun['raid.enabled'] = 0; // no next raid to take guards out while the queue refills
    // The deaths came over a few rounds; each guard needs R ticks of deficit. All of them are back after lost × R, and no more.
    run(w, lost * R);
    expect(counts(w)).toEqual([12, 18]);
    run(w, 2 * R);
    expect(counts(w)).toEqual([12, 18]);
  });

  it('split raid: one prong beaten, the other hits and goes home: only the beaten prong\'s dead are rebuilt, never the absent', () => {
    const w = raidWorld([F.a5, F.a6], 24, 2);
    addShips(w, F.a5, 8, 'flak'); // a5 defended, a6 not
    const outAt: number[] = [];
    for (let i = 0; i < 6000 && (w.lastRaid === null || w.raid !== null); i++) {
      tick(w);
      const r = w.raid;
      if (r !== null) {
        const out = raidProngs(r).reduce((a, p) => a + p.guards.length, 0);
        // The queue never makes the hive plus the raiders away more than its caps.
        expect(counts(w)[0] + counts(w)[1] + out, `tick ${w.tick - 1}`).toBeLessThanOrEqual(30);
        outAt.push(out);
      }
    }
    expect(w.lastRaid!.prongs.map((p) => [p.target, p.outcome])).toEqual([
      [F.a5, 'beaten'],
      [F.a6, 'hit'],
    ]);
    const dead = w.lastRaid!.prongs[0]!.killed.thorn + w.lastRaid!.prongs[0]!.killed.spore;
    expect(dead).toBeGreaterThan(0);
    expect(w.lastRaid!.prongs[1]!.killed).toEqual({ thorn: 0, spore: 0 });
    expect(Math.max(...outAt)).toBe(12);
    w.tun['raid.enabled'] = 0;
    run(w, dead * R);
    expect(counts(w)).toEqual([12, 18]);
  });

  it('a prong rejoining the hive leaves the progress unchanged (missing is the same: alive rises and out falls by the returners)', () => {
    const w = raidWorld([F.a6], 12, 1);
    // Undefended: it hits and comes home. Meanwhile a Thorn dies at the hive, so the queue is counting when it lands.
    let rejoin = -1;
    let killed = false;
    for (let i = 0; i < 4000 && rejoin < 0; i++) {
      const before = { out: w.raid === null ? 0 : raidProngs(w.raid).reduce((a, p) => a + p.guards.length, 0), progress: w.field!.hiveRebuildProgress };
      if (!killed && w.raid !== null && w.raid.phase === 'home') {
        kill(w, 'thorn', 1);
        killed = true;
      }
      tick(w);
      if (killed && before.out > 0 && w.raid === null) {
        rejoin = w.tick - 1;
        expect(before.progress).toBeGreaterThan(0);
        expect(w.field!.hiveRebuildProgress).toBe(before.progress + 1);
      }
    }
    expect(rejoin).toBeGreaterThan(0);
    expect(w.lastRaid).toMatchObject({ outcome: 'hit' });
    expect(counts(w)).toEqual([11, 18]);
  });
});

describe('D6: live tuning of hive.rebuildTicks', () => {
  it('0 → above 0: the queue starts from 0 and the hive\'s R9 timers reset to {0, 0}', () => {
    const w = rebuildField(0);
    kill(w, 'thorn', 1);
    run(w, 100);
    expect([w.field!.hiveRebuildProgress, hive(w).regrowProgress]).toEqual([0, { thorn: 100, spore: 0 }]);
    tick(w, tun('hive.rebuildTicks', R));
    // Reset by the input, then this tick's count.
    expect([w.field!.hiveRebuildProgress, hive(w).regrowProgress]).toEqual([1, { thorn: 0, spore: 0 }]);
    run(w, R - 2);
    expect(counts(w)).toEqual([11, 18]);
    tick(w);
    expect(counts(w)).toEqual([12, 18]);
  });

  it('above 0 → 0: the progress is dropped and R9\'s timers start from 0', () => {
    const w = rebuildField();
    kill(w, 'thorn', 1);
    run(w, 500);
    expect(w.field!.hiveRebuildProgress).toBe(500);
    tick(w, tun('hive.rebuildTicks', 0));
    expect([w.field!.hiveRebuildProgress, hive(w).regrowProgress]).toEqual([0, { thorn: 1, spore: 0 }]);
    // R9's Thorn period at v16 is 120 ticks: the guard is back on its 120th.
    run(w, 118);
    expect(counts(w)).toEqual([11, 18]);
    tick(w);
    expect(counts(w)).toEqual([12, 18]);
  });

  it('above 0 → another value above 0: the progress is kept; at or past the new value the guard completes on that tick\'s check (≥)', () => {
    const up = rebuildField();
    kill(up, 'thorn', 1);
    run(up, 400);
    tick(up, tun('hive.rebuildTicks', 900));
    expect(up.field!.hiveRebuildProgress).toBe(401);
    run(up, 900 - 402);
    expect(counts(up)).toEqual([11, 18]);
    tick(up);
    expect(counts(up)).toEqual([12, 18]);

    const down = rebuildField();
    kill(down, 'thorn', 1);
    run(down, 400);
    tick(down, tun('hive.rebuildTicks', 300)); // 401 ≥ 300
    expect([counts(down), down.field!.hiveRebuildProgress]).toEqual([[12, 18], 0]);

    const equal = rebuildField();
    kill(equal, 'thorn', 1);
    run(equal, 299);
    tick(equal, tun('hive.rebuildTicks', 300)); // 300 ≥ 300
    expect([counts(equal), equal.field!.hiveRebuildProgress]).toEqual([[12, 18], 0]);
  });

  it('a campaign world ignores it (no field state; nothing to reset)', () => {
    const d = withRunMode(D, 'campaign');
    const w = campaignWorld(1, d, { reclaimed: ['landfall'], land: 'shelf' });
    const before = hashState(withoutH10(w));
    step(w, d, [tun('hive.rebuildTicks', R)]);
    const plain = campaignWorld(1, d, { reclaimed: ['landfall'], land: 'shelf' });
    step(plain, d, []);
    expect(hashState(withoutH10(w))).toBe(hashState(withoutH10(plain)));
    expect(before).not.toBe('');
  });
});

describe('hiveAfter(world, ticks): the hive\'s guards at home after more ticks of D2 (or R9), no deaths, no raiders back', () => {
  /** Steps `n` ticks one at a time and checks hiveAfter's forecast from the start against each. */
  function forecastMatches(w: World, n: number): void {
    const start = JSON.parse(JSON.stringify(w)) as World;
    for (let k = 0; k <= n; k++) {
      const c = countGuards(hive(w));
      expect(hiveAfter(start, k), `after ${k}`).toEqual(c);
      tick(w);
    }
  }

  it('D2 mid-count, with Thorns and Spores missing (the D3 picks in order)', () => {
    const w = rebuildField(150);
    kill(w, 'thorn', 2);
    kill(w, 'spore', 3);
    run(w, 70);
    forecastMatches(w, 900);
  });

  it('D2 with the progress at or past a lowered period (the next tick completes)', () => {
    const w = rebuildField(400);
    kill(w, 'spore', 2);
    run(w, 350);
    w.tun['hive.rebuildTicks'] = 200;
    forecastMatches(w, 500);
  });

  it('D2 with raiders away: they stay away and count against the caps, so only the dead are rebuilt', () => {
    const w = rebuildField(100);
    // A prong out on a long flight (constructed: 2 Thorns and 4 Spores away), and 3 Spores dead.
    const h = hive(w);
    const away = [...h.guards.filter((g) => g.type === 'thorn').slice(0, 2), ...h.guards.filter((g) => g.type === 'spore').slice(0, 4)];
    h.guards = h.guards.filter((g) => !away.includes(g));
    kill(w, 'spore', 3);
    w.raid = { id: 1, phase: 'out', target: F.a5, guards: away, ticksLeft: 5000, planned: { thorn: 2, spore: 4 }, flightTicks: 5000, from: F.heart, retargeted: false, lostEcon: { extractor: 0, hauler: 0 }, lostShips: { drone: 0, lancer: 0, flak: 0 }, killed: { thorn: 0, spore: 0 }, rolls: 0, hitRocks: [] };
    w.field!.mine[F.a5] = true;
    addEcon(w, 'extractor', F.a5, F.a5);
    syncExtractors(w);
    forecastMatches(w, 600);
    expect(counts(w)).toEqual([10, 14]); // 3 rebuilt; the 6 away are not
  });

  it('R9 (hive.rebuildTicks 0): each type on its own timer, in parallel', () => {
    const w = rebuildField(0);
    kill(w, 'thorn', 2);
    kill(w, 'spore', 5);
    run(w, 17);
    forecastMatches(w, 400);
  });

  it('full: no change; a dead hive: no change; 0 ticks: now', () => {
    const w = rebuildField();
    expect(hiveAfter(w, 5000)).toEqual({ thorn: 12, spore: 18 });
    kill(w, 'thorn', 3);
    expect(hiveAfter(w, 0)).toEqual({ thorn: 9, spore: 18 });
    expect(hiveAfter(w, R - 1)).toEqual({ thorn: 9, spore: 18 });
    expect(hiveAfter(w, R)).toEqual({ thorn: 10, spore: 18 });
    expect(hiveAfter(w, 3 * R)).toEqual({ thorn: 12, spore: 18 });
    hive(w).alive = false;
    expect(hiveAfter(w, 3 * R)).toEqual({ thorn: 9, spore: 18 });
    expect(hiveAfter(createWorld(1, withRunMode(D, 'campaign')), 100)).toEqual({ thorn: 0, spore: 0 });
  });
});
