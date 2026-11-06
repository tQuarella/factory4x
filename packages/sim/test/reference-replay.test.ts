import { describe, expect, it } from 'vitest';
import { createWorld, isValidInput, step, type BattleResult, type Input } from '../src/index.ts';
import { referenceReplay } from '../../bots/src/reference-replay.ts';
import { applyInput } from '../src/inputs.ts';
import { clone, data } from './helpers.ts';

declare const console: { log(...args: unknown[]): void };

/**
 * Acceptance 7: the reference replay (determinism gate and browser
 * cross-engine check) reaches combat and a capture, and every input type in
 * it does something.
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

  it('reaches a repelled wave and then a capture before tick 3000 (the browser check length)', () => {
    console.log(ignoredLog.join('\n'));
    console.log(battles.map((b) => `${b.outcome} @${b.startTick}-${b.endTick} engaged ${b.shipsEngaged} lost ${b.shipsLost} thorns ${b.thornsKilled}`).join('\n'));
    expect(battles[0]).toMatchObject({ outcome: 'repelled', shipsEngaged: 3, shipsLost: 3 });
    expect(battles[1]).toMatchObject({ outcome: 'captured' });
    expect(w.capturedTick).not.toBeNull();
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
