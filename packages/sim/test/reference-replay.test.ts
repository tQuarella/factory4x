import { describe, expect, it } from 'vitest';
import { createWorld, isValidInput, step, type BattleResult, type Input } from '../src/index.ts';
import { referenceReplay } from '../../bots/src/reference-replay.ts';
import { applyInput } from '../src/inputs.ts';
import { clone, data } from './helpers.ts';

declare const console: { log(...args: unknown[]): void };

/**
 * m1-sim acceptance 7 and h2-sim acceptance 6: the reference replay
 * (determinism gate and browser cross-engine check) reaches combat, cuts the
 * Root (wilt and starvation), captures the Bloom, and every input type in it
 * does something.
 */
describe('reference replay', () => {
  const w = createWorld(referenceReplay.seed, data);
  const battles: BattleResult[] = [];
  const typesApplied = new Set<string>();
  let ignored = 0;
  const ignoredLog: string[] = [];
  for (let t = 0; t < 9000; t++) {
    const inputs: Input[] = referenceReplay.inputs.filter((e) => e.tick === t).map((e) => e.input);
    // Judge validity in log order, as step does: earlier inputs of the tick apply first.
    const probe = inputs.length > 0 ? clone(w) : w;
    for (const input of inputs) {
      if (isValidInput(probe, data, input)) typesApplied.add(input.type);
      else {
        ignored++;
        ignoredLog.push(`${t} ${JSON.stringify(input)} stock ${probe.stock} queue ${probe.queue.length} ships@5 ${probe.ships.filter((s) => s.at === 5).length}`);
      }
      applyInput(probe, data, input);
    }
    const prev = w.lastBattle;
    step(w, data, inputs);
    if (w.lastBattle !== prev && w.lastBattle) battles.push(w.lastBattle);
  }

  it('before tick 3000 (the browser check length): a repelled wave, the Root cut with the wilt, then the starved Bloom captured', () => {
    console.log(ignoredLog.join('\n'));
    console.log(battles.map((b) => `${b.outcome} @${b.startTick}-${b.endTick} engaged ${b.shipsEngaged} lost ${b.shipsLost} thorns ${b.thornsKilled}`).join('\n'));
    expect(w.system.id).toBe('thin');
    expect(battles.map((b) => [b.node, b.outcome])).toEqual([
      [6, 'repelled'],
      [7, 'captured'],
      [6, 'captured'],
    ]);
    expect(battles[0]).toMatchObject({ shipsEngaged: 3, shipsLost: 3, wilt: null });
    // The Root grew to 6 thorns (root.capBonus 2) before the cut; the Bloom wilted 12 → 8.
    expect(battles[1]).toMatchObject({ thornsKilled: 6, wilt: { from: 12, to: 8 } });
    expect(w.stats.thornsWithered).toBe(4);
    expect(w.stats.rootCutTick!).toBeLessThan(w.capturedTick!);
    // Starved regrowth (tuned to 30 ticks) acted during the Bloom fight: more thorns killed than the 8 it had.
    expect(battles[2]!.thornsKilled).toBeGreaterThan(8);
    expect(battles[2]!.startTick).toBeGreaterThan(w.stats.rootCutTick!);
    expect(w.capturedTick!).toBeLessThan(3000);
  });

  it('uses every input type, with exactly one deliberately invalid input', () => {
    expect([...typesApplied].sort()).toEqual(
      ['buildExtractor', 'buildRoute', 'cancelBuild', 'sendShips', 'setRally', 'setShipyard', 'setTunable', 'upgradeRoute'].sort(),
    );
    expect(ignored).toBe(1);
  });

  it('builds out the rich node after capture', () => {
    expect(w.nodes[6]!.extractors).toBe(2);
    expect(w.routes.find((r) => r.from === 6)?.level).toBe(2);
  });
});
