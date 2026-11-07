import { describe, expect, it } from 'vitest';
import { createWorld, lastBattle, shipCounts, step, supplyStatus, throughputPerMin, type BattleResult, type Input, type SimData, type World } from '../src/index.ts';
import { N, bloom, clone, data, networkDone, networkStep, root } from './helpers.ts';

// The sim tsconfig has no DOM or Node types; vitest provides console at runtime.
declare const console: { log(...args: unknown[]): void };

/**
 * h2-sim acceptance 5: a scripted game (not a bot) on Thin Root at defaults.
 * It builds the asteroid network, gathers ships at a5, then from that one
 * snapshot (Bloom fed and at its cap, Root at its cap):
 *   - 15 ships take the Root, the Bloom wilts to 8, then 18 ships take the Bloom;
 *   - 18 ships against the fed Bloom are repelled.
 * The numbers are reported as measured; nothing is retuned here.
 */

/** Default data with system.variant forced (1 thin, 2 knotted, 3 deep). */
function forced(v: number): SimData {
  const d = JSON.parse(JSON.stringify(data)) as SimData;
  d.tunables['system.variant'].default = v;
  return d;
}

const THIN = forced(1);

interface Fight {
  size: number;
  result: BattleResult;
  rounds: number;
  /** Ticks from the send order to the end of the battle. */
  ticks: number;
}

function prepare(d: SimData, seed: number): { world: World; readySec: number } {
  const w = createWorld(seed, d);
  step(w, d, [
    { type: 'setShipyard', on: false },
    { type: 'setRally', node: N.a5 },
  ]);
  let yardOn = false;
  while (shipCounts(w).at[N.a5]! < 50) {
    const inputs: Input[] = [];
    const next = networkStep(w);
    if (next) inputs.push(next);
    else if (!yardOn && networkDone(w)) {
      yardOn = true;
      inputs.push({ type: 'setShipyard', on: true });
    }
    step(w, d, inputs);
    if (w.tick > 30 * 60 * 40) throw new Error('network script stalled');
  }
  step(w, d, [{ type: 'setShipyard', on: false }]);
  return { world: w, readySec: Math.floor(w.tick / w.tickRate) };
}

/** Sends `size` ships from a5 to `target` and steps until that node's battle ends. */
function attack(w: World, d: SimData, target: number, size: number): Fight {
  const before = lastBattle(w, target);
  const sentAt = w.tick;
  step(w, d, [{ type: 'sendShips', from: N.a5, to: target, count: size }]);
  let guard = 0;
  while (lastBattle(w, target) === before) {
    step(w, d, []);
    if (++guard > 30 * 60 * 5) throw new Error('battle did not end');
  }
  const result = lastBattle(w, target)!;
  return { size, result, rounds: Math.floor((result.endTick - result.startTick) / w.tun['combat.roundTicks']) + 1, ticks: w.tick - sentAt };
}

/** Smallest wave in [lo, hi] that captures `target` from a copy of `w`, or -1. */
function smallestCapture(w: World, d: SimData, target: number, lo: number, hi: number): number {
  for (let size = lo; size <= hi; size++) if (attack(clone(w), d, target, size).result.outcome === 'captured') return size;
  return -1;
}

const fmt = (f: Fight) =>
  `${f.size} sent: ${f.result.outcome}, lost ${f.result.shipsLost}, thorns ${f.result.thornsKilled}, rounds ${f.rounds}, ${(f.ticks / 30).toFixed(1)} s from order to end`;

describe('scripted Thin Root (h2-sim acceptance 5)', () => {
  const prep = prepare(THIN, 0);
  const snap = prep.world;

  // Starve line: Root with 15, then the Bloom with 18 (fresh ships from a5; the Root survivors stay on the Root).
  const starve = clone(snap);
  const rootFight = attack(starve, THIN, N.root, 15);
  const bloomAfterWilt = bloom(starve).thorns.length;
  const withered = starve.stats.thornsWithered;
  const wilt = rootFight.result.wilt;
  const rootSurvivors = shipCounts(starve).at[N.root]!;
  const bloomAtSend = bloom(starve).thorns.length;
  const bloomFight = attack(starve, THIN, N.rich, 18);

  // Overwhelm check: 18 ships against the fed Bloom.
  const fed = clone(snap);
  const fedFight = attack(fed, THIN, N.rich, 18);

  it('reports the real numbers', () => {
    const cut = clone(snap);
    attack(cut, THIN, N.root, 15);
    const lines = [
      `Thin: 50 ships at a5 by ${prep.readySec}s, throughput ${throughputPerMin(snap)}/min, Root ${root(snap).thorns.length} thorns, Bloom ${bloom(snap).thorns.length}`,
      `Root wave  ${fmt(rootFight)}; survivors ${rootSurvivors}; wilt ${wilt?.from} -> ${wilt?.to} (${withered} withered)`,
      `Bloom wave (starved, ${bloomAtSend} thorns at send) ${fmt(bloomFight)}`,
      `Fed Bloom  ${fmt(fedFight)}`,
      `smallest capturing Root wave on Thin: ${smallestCapture(snap, THIN, N.root, 1, 40)} (model 13)`,
      `smallest capturing Bloom wave after the cut: ${smallestCapture(cut, THIN, N.rich, 1, 40)} (model 15)`,
      `smallest capturing Bloom wave while fed: ${smallestCapture(snap, THIN, N.rich, 15, 40)} (H1 measured 27)`,
    ];
    for (const v of [2, 3]) {
      const d = forced(v);
      const p = prepare(d, 0);
      lines.push(`${p.world.system.name}: smallest capturing Root wave ${smallestCapture(p.world, d, N.root, 1, 50)} (model ${v === 2 ? 21 : 30})`);
    }
    console.log(lines.join('\n'));
    expect(snap.system.id).toBe('thin');
    expect(root(snap).thorns.length).toBe(4);
    expect(bloom(snap).thorns.length).toBe(12);
  });

  it('15 ships take the Root', () => {
    expect(rootFight.result).toMatchObject({ node: N.root, outcome: 'captured', shipsEngaged: 15 });
    expect(starve.stats.rootCutTick).toBe(rootFight.result.endTick);
    expect(supplyStatus(starve).fed).toBe(false);
  });

  it('the Bloom wilts from 12 to 8 thorns, the 4 newest withered', () => {
    expect(wilt).toEqual({ from: 12, to: 8 });
    expect(bloomAfterWilt).toBe(8);
    expect(withered).toBe(4);
    expect(bloomAtSend).toBe(8);
  });

  it('then 18 ships take the starved Bloom', () => {
    expect(bloomFight.result).toMatchObject({ node: N.rich, outcome: 'captured', shipsEngaged: 18 });
    expect(starve.capturedTick).toBe(bloomFight.result.endTick);
  });

  it('18 ships against the fed Bloom are repelled', () => {
    expect(fedFight.result).toMatchObject({ node: N.rich, outcome: 'repelled', shipsLost: 18 });
    expect(fed.capturedTick).toBeNull();
    expect(supplyStatus(fed).fed).toBe(true);
  });
});
