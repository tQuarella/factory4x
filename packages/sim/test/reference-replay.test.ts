import { describe, expect, it } from 'vitest';
import { capEff, createWorld, defaultData as data, isValidInput, step, type BattleResult, type Input } from '../src/index.ts';
import { referenceReplay } from '../../bots/src/reference-replay.ts';
import { applyInput } from '../src/inputs.ts';
import { N } from './helpers.ts';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * h3-sim acceptance 6: the reference replay (determinism gate and browser
 * cross-engine check) captures both light pockets, assembles both
 * components, builds lancers and flak, cuts the Root (wilt and starvation)
 * and captures the heart, all before tick 3000; and every input type in it
 * does something. It runs on the shipped data, as the gate and the browser
 * do, so a calibration that breaks the script shows here: regenerate the
 * replay then. The wilt numbers are read from the shipped layout.
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

  it('before tick 3000: a wave repelled at p2, p1 and p2 captured, plating and flak built, the Root cut with the wilt, then the starved heart captured by lancers and flak', () => {
    expect(battles.map((b) => [b.node, b.outcome])).toEqual([
      [N.p2, 'repelled'],
      [N.p1, 'captured'],
      [N.p2, 'captured'],
      [N.root, 'captured'],
      [N.heart, 'captured'],
    ]);
    expect(w.stats.captures.map((c) => c.node)).toEqual([N.p1, N.p2, N.root, N.heart]);
    // The ice route delivers, the plating assembler runs, and the flak yard builds, before the Root fight.
    expect(w.stats.firstDeliveredTick.ice!).toBeLessThan(firstComponentTick!);
    expect(firstComponentTick!).toBeLessThan(firstFlakTick!);
    expect(firstFlakTick!).toBeLessThan(w.stats.rootCutTick!);
    // The heart started full at its layout counts and wilts to its starved caps at guard.capPct 50.
    const h = data.map.layouts[0]!.heart;
    const to = { thorn: capEff(h.starvedThorns, 50), spore: capEff(h.starvedSpores, 50) };
    expect(battles[3]!.wilt).toEqual({ from: { thorn: h.thorns, spore: h.spores }, to });
    expect(w.stats.guardsWithered).toBe(h.thorns - to.thorn + (h.spores - to.spore));
    expect(w.stats.rootCutTick!).toBeLessThan(w.capturedTick!);
    // Starved regrowth (multiplier tuned to 1) acted during the heart fight: more guards killed than it had.
    expect(battles[4]!.guardsKilled).toBeGreaterThan(to.thorn + to.spore);
    expect(battles[4]!.engagedByType.flak).toBeGreaterThan(0);
    expect(battles[4]!.engagedByType.lancer).toBeGreaterThan(0);
    expect(flakAtHeartCapture).toBeGreaterThan(0);
    expect(w.capturedTick!).toBeLessThan(3000);
  });

  it('runs both component yards, so the rule 5b round-robin is in the determinism hashes', () => {
    expect(w.stats.componentsBuilt.lens).toBeGreaterThan(0);
    expect(w.stats.shipsBuilt.lancer).toBeGreaterThanOrEqual(2);
    expect(w.stats.shipsBuilt.flak).toBeGreaterThanOrEqual(2);
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
