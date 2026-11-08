import { describe, expect, it } from 'vitest';
import { createWorld, isValidInput, step, type BattleResult, type Input } from '../src/index.ts';
import { referenceReplay } from '../../bots/src/reference-replay.ts';
import { applyInput } from '../src/inputs.ts';
import { N, clone, data } from './helpers.ts';

/**
 * h3-sim acceptance 6: the reference replay (determinism gate and browser
 * cross-engine check) captures a pocket, assembles a component, builds flak,
 * cuts the Root (wilt and starvation) and captures the heart, all before tick
 * 3000; and every input type in it does something.
 */
describe('reference replay', () => {
  const w = createWorld(referenceReplay.seed, data);
  const battles: BattleResult[] = [];
  const typesApplied = new Set<string>();
  const ignored: string[] = [];
  let firstComponentTick: number | null = null;
  let firstFlakTick: number | null = null;
  let flakAtHeartCapture = 0;
  for (let t = 0; t < 9000; t++) {
    const inputs: Input[] = referenceReplay.inputs.filter((e) => e.tick === t).map((e) => e.input);
    // Judge validity in log order, as step does: earlier inputs of the tick apply first.
    const probe = inputs.length > 0 ? clone(w) : w;
    for (const input of inputs) {
      if (isValidInput(probe, data, input)) typesApplied.add(input.type);
      else ignored.push(`${t} ${JSON.stringify(input)}`);
      applyInput(probe, data, input);
    }
    const prev = w.lastBattle;
    step(w, data, inputs);
    if (w.lastBattle !== prev && w.lastBattle) battles.push(w.lastBattle);
    if (firstComponentTick === null && w.stats.componentsBuilt.plating > 0) firstComponentTick = w.tick;
    if (firstFlakTick === null && w.stats.shipsBuilt.flak > 0) firstFlakTick = w.tick;
    if (w.capturedTick !== null && w.capturedTick === w.tick - 1) flakAtHeartCapture = w.ships.filter((s) => s.at === N.heart && s.type === 'flak').length;
  }

  it('is Frost Gate', () => {
    expect(w.system.id).toBe('frost');
  });

  it('before tick 3000: a wave repelled at p2, p1 captured, plating and flak built, the Root cut with the wilt, then the starved heart captured with flak in the wave', () => {
    expect(battles.map((b) => [b.node, b.outcome])).toEqual([
      [N.p2, 'repelled'],
      [N.p1, 'captured'],
      [N.root, 'captured'],
      [N.heart, 'captured'],
    ]);
    expect(w.stats.captures.map((c) => c.node)).toEqual([N.p1, N.root, N.heart]);
    // The ice route delivers, the plating assembler runs, and the flak yard builds, before the Root fight.
    expect(w.stats.firstDeliveredTick.ice!).toBeLessThan(firstComponentTick!);
    expect(firstComponentTick!).toBeLessThan(firstFlakTick!);
    expect(firstFlakTick!).toBeLessThan(w.capturedTick!);
    // The heart started full (10 Thorns, 14 Spores) and wilts to its starved caps at guard.capPct 50: 3 and 3.
    expect(battles[2]!.wilt).toEqual({ from: { thorn: 10, spore: 14 }, to: { thorn: 3, spore: 3 } });
    expect(w.stats.guardsWithered).toBe(18);
    expect(w.stats.rootCutTick!).toBeLessThan(w.capturedTick!);
    // Starved regrowth (multiplier tuned to 1) acted during the heart fight: more guards killed than the 6 it had.
    expect(battles[3]!.guardsKilled).toBeGreaterThan(6);
    expect(battles[3]!.engagedByType.flak).toBeGreaterThan(0);
    expect(flakAtHeartCapture).toBeGreaterThan(0);
    expect(w.capturedTick!).toBeLessThan(3000);
  });

  it('uses every input type, with exactly one deliberately invalid input', () => {
    expect([...typesApplied].sort()).toEqual(
      ['buildExtractor', 'buildRoute', 'cancelBuild', 'sendShips', 'setRally', 'setShipyard', 'setTunable', 'upgradeRoute'].sort(),
    );
    expect(ignored).toEqual([`0 ${JSON.stringify({ type: 'buildExtractor', node: N.p1 })}`]);
  });

  it('builds out the captured pocket and the heart', () => {
    expect(w.nodes[N.p1]!.extractors).toBe(2);
    expect(w.nodes[N.heart]!.extractors).toBe(2);
    expect(w.routes.find((r) => r.from === N.heart)?.level).toBe(2);
  });
});
