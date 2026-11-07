import { describe, expect, it } from 'vitest';
import {
  activeBattles,
  battleStatus,
  chooseVariant,
  combatRates,
  createWorld,
  defaultData,
  deserializeWorld,
  guardianStatus,
  isRootCut,
  isValidInput,
  lastBattle,
  rootCap,
  runSummary,
  serializeWorld,
  step,
  supplyStatus,
  systemStatus,
  worldHash,
  type Input,
  type SimData,
  type World,
} from '../src/index.ts';
import { N, addShips, bloom, data, fresh, networkStep, root, run } from './helpers.ts';

/** Default data with system.variant forced (0 by seed, 1 thin, 2 knotted, 3 deep). */
function withVariant(v: number, d: SimData = data): SimData {
  const copy = JSON.parse(JSON.stringify(d)) as SimData;
  copy.tunables['system.variant'].default = v;
  return copy;
}

/** No stock, no probe mining, yard off: nothing happens unless the test sets it up. */
function idle(seed = 1, d: SimData = data): World {
  const w = createWorld(seed, d);
  w.stock = 0;
  w.shipyard.on = false;
  w.tun['economy.probeOrePerMin'] = 0;
  return w;
}

/** Takes the Root by hand: strip its thorns and park a ship there for one tick. */
function cutRoot(w: World, d: SimData = data): void {
  root(w).thorns = [];
  addShips(w, N.root, 1);
  step(w, d, []);
  expect(isRootCut(w)).toBe(true);
}

describe('variant selection', () => {
  it('by seed: ((seed mod 3) + 3) mod 3, including negative seeds', () => {
    const ids = [0, 1, 2, 3, 4, 5, -1, -2, -3, 20261106].map((seed) => createWorld(seed, data).system.id);
    expect(ids).toEqual(['thin', 'knotted', 'deep', 'thin', 'knotted', 'deep', 'deep', 'knotted', 'thin', 'thin']);
    expect(chooseVariant(-4, 0, 3)).toBe(2);
  });

  it('the bot seeds 1, 2, 3 are knotted, deep, thin', () => {
    expect([1, 2, 3].map((s) => systemStatus(createWorld(s, data)).id)).toEqual(['knotted', 'deep', 'thin']);
  });

  it('system.variant > 0 forces variant system.variant − 1 for any seed', () => {
    for (const seed of [0, 1, 2, 7]) {
      expect(createWorld(seed, withVariant(1)).system.id).toBe('thin');
      expect(createWorld(seed, withVariant(2)).system.id).toBe('knotted');
      expect(createWorld(seed, withVariant(3)).system.id).toBe('deep');
    }
  });

  it('the Root takes the variant position and cap; everything else is identical', () => {
    const worlds = [1, 2, 3].map((v) => createWorld(5, withVariant(v)));
    expect(worlds.map((w) => [w.nodes[N.root]!.x, w.nodes[N.root]!.y, root(w).thorns.length])).toEqual([
      [820, 110, 4],
      [850, 420, 9],
      [160, 480, 14],
    ]);
    expect(worlds.map((w) => systemStatus(w))).toEqual([
      { variant: 0, id: 'thin', name: 'Thin Root', rootCutTick: null, rootCutSec: null },
      { variant: 1, id: 'knotted', name: 'Knotted Root', rootCutTick: null, rootCutSec: null },
      { variant: 2, id: 'deep', name: 'Deep Root', rootCutTick: null, rootCutSec: null },
    ]);
    const others = (w: World) => JSON.stringify(w.nodes.slice(0, N.root));
    expect(new Set(worlds.map(others)).size).toBe(1);
    expect(worlds.map((w) => w.nodes[N.root]!)).toMatchObject([{ kind: 'root', r: 45, slots: 0, owned: false }, {}, {}]);
    expect(new Set(worlds.map((w) => bloom(w).thorns.length))).toEqual(new Set([12]));
  });

  it('the Root cap is rootCap + root.capBonus, clamped to 0..40', () => {
    const thin = createWorld(0, withVariant(1));
    thin.tun['root.capBonus'] = -14;
    expect(rootCap(thin)).toBe(0);
    const deep = createWorld(0, withVariant(3));
    deep.tun['root.capBonus'] = 20;
    expect(rootCap(deep)).toBe(34);
    const big = JSON.parse(JSON.stringify(data)) as SimData;
    big.map.variants[0]!.rootCap = 30;
    const w = createWorld(0, withVariant(1, big));
    expect(root(w).thorns.length).toBe(30);
    w.tun['root.capBonus'] = 20;
    expect(rootCap(w)).toBe(40);
    // The default applies at creation: a world created with a bonus starts at the bonused cap.
    const bonused = JSON.parse(JSON.stringify(withVariant(2))) as SimData;
    bonused.tunables['root.capBonus'].default = -3;
    expect(root(createWorld(0, bonused)).thorns.length).toBe(6);
  });

  it('a zero-thorn Root falls to the first ship that arrives', () => {
    const d = JSON.parse(JSON.stringify(withVariant(1))) as SimData;
    d.tunables['root.capBonus'].default = -14;
    const w = idle(0, d);
    expect(root(w).thorns).toEqual([]);
    run(w, 100, d);
    expect(root(w).thorns).toEqual([]);
    addShips(w, N.root, 1);
    step(w, d, []);
    expect(isRootCut(w)).toBe(true);
    expect(lastBattle(w, N.root)).toMatchObject({ outcome: 'captured', shipsEngaged: 1, wilt: { from: 12, to: 8 } });
  });
});

describe('the wilt on Root capture (rule 8)', () => {
  it('drops the Bloom to bloom.starvedCap, newest thorns first, counted as withered not killed', () => {
    const w = idle();
    const ids = bloom(w).thorns.map((t) => t.id);
    bloom(w).regrowProgress = 0;
    root(w).thorns = [{ id: 9999, hp: 2 }];
    addShips(w, N.root, 3);
    step(w, data, []);
    expect(bloom(w).thorns.map((t) => t.id)).toEqual(ids.slice(0, 8));
    expect(w.stats).toMatchObject({ thornsWithered: 4, thornsKilled: 1, rootCutTick: 0 });
    expect(root(w)).toMatchObject({ alive: false, thorns: [], thornsKilled: 1 });
    expect(w.nodes[N.root]!.owned).toBe(true);
    expect(w.nodes[N.root]!.extractors).toBe(0);
    expect(w.capturedTick).toBeNull();
    const result = { node: N.root, outcome: 'captured', shipsEngaged: 3, shipsLost: 0, thornsKilled: 1, wilt: { from: 12, to: 8 } };
    expect(lastBattle(w, N.root)).toMatchObject(result);
    expect(w.lastBattle).toMatchObject(result);
    // The Bloom's own last battle is untouched (it never fought).
    expect(lastBattle(w)).toBeNull();
    expect(runSummary(w)).toMatchObject({ rootCutTick: 0, rootCutSec: 0, thornsWithered: 4, rootShipsLost: 0 });
  });

  it('removes the highest ids even after kills and regrowth reorder which thorns are oldest', () => {
    const w = idle();
    const g = bloom(w);
    // Three thorns killed, three regrown with new (higher) ids: the regrown ones wilt first.
    g.thorns.splice(0, 3);
    for (let i = 0; i < 3; i++) g.thorns.push({ id: w.nextId++, hp: 20 });
    const keep = g.thorns.slice(0, 8).map((t) => t.id);
    cutRoot(w);
    expect(g.thorns.map((t) => t.id)).toEqual(keep);
  });

  it('a Bloom already at or below the starved cap loses nothing, and its regrowth restarts', () => {
    const w = idle();
    bloom(w).thorns = bloom(w).thorns.slice(0, 5);
    bloom(w).regrowProgress = 40;
    cutRoot(w);
    expect(bloom(w).thorns.length).toBe(5);
    expect(w.stats.thornsWithered).toBe(0);
    expect(lastBattle(w, N.root)!.wilt).toEqual({ from: 5, to: 5 });
    // Reset to 0 at the cut, then +1 in the same tick's regrowth (starved, below the cap of 8).
    expect(bloom(w).regrowProgress).toBe(1);
  });

  it('taking the Root after the Bloom has fallen does nothing more', () => {
    const w = idle();
    bloom(w).thorns = [];
    addShips(w, N.rich, 1);
    step(w, data, []);
    expect(w.capturedTick).toBe(0);
    cutRoot(w);
    expect(lastBattle(w, N.root)).toMatchObject({ outcome: 'captured', wilt: null });
    expect(w.stats.thornsWithered).toBe(0);
    expect(bloom(w).thorns).toEqual([]);
    expect(w.nodes[N.rich]!.extractors).toBe(1);
  });

  it('a Root repelled with thorns left changes nothing for the Bloom', () => {
    const w = idle();
    addShips(w, N.root, 2); // 9 thorns × 3 = 27 ≥ 20 hp: both die in round 1
    step(w, data, []);
    expect(lastBattle(w, N.root)).toMatchObject({ outcome: 'repelled', shipsLost: 2, wilt: null });
    expect(supplyStatus(w).fed).toBe(true);
    expect(bloom(w).thorns.length).toBe(12);
    expect(runSummary(w)).toMatchObject({ rootShipsLost: 2, bloomShipsLost: 0, shipsLost: 2 });
  });
});

describe('the starved Bloom', () => {
  it('regrows one thorn per bloom.starvedRegrowTicks, only up to bloom.starvedCap', () => {
    const w = idle();
    cutRoot(w); // tick 0; regrowth progress 0 after the wilt (at cap 8)
    bloom(w).thorns = bloom(w).thorns.slice(0, 6);
    run(w, 299);
    expect(bloom(w).thorns.length).toBe(6);
    run(w, 1);
    expect(bloom(w).thorns.length).toBe(7);
    run(w, 300);
    expect(bloom(w).thorns.length).toBe(8);
    run(w, 900);
    expect(bloom(w).thorns.length).toBe(8);
    expect(bloom(w).regrowProgress).toBe(0);
    expect(guardianStatus(w)).toMatchObject({ supply: 'starved', cap: 8, regrowTicks: 300, repairPerRound: 0, thorns: 8 });
  });

  it('does not repair at the default bloom.starvedRepairPerRound 0, and repairs at the tuned value', () => {
    const w = idle();
    cutRoot(w);
    bloom(w).thorns[0]!.hp = 5;
    run(w, 90);
    expect(bloom(w).thorns[0]!.hp).toBe(5);
    step(w, data, [{ type: 'setTunable', key: 'bloom.starvedRepairPerRound', value: 3 }]); // tick 91
    run(w, 29); // tick 120 is a round tick
    expect(bloom(w).thorns[0]!.hp).toBe(8);
  });

  it('a fed Bloom repairs and regrows at the guardian.* values (contrast)', () => {
    const w = idle();
    bloom(w).thorns[0]!.hp = 5;
    bloom(w).thorns = bloom(w).thorns.slice(0, 10);
    step(w, data, []); // round tick 0
    expect(bloom(w).thorns[0]!.hp).toBe(7);
    run(w, 59);
    expect(bloom(w).thorns.length).toBe(11);
    expect(guardianStatus(w)).toMatchObject({ supply: 'fed', cap: 12, regrowTicks: 60, repairPerRound: 2 });
  });

  it('starved values are live tunables', () => {
    const w = idle();
    cutRoot(w);
    step(w, data, [
      { type: 'setTunable', key: 'bloom.starvedCap', value: 10 },
      { type: 'setTunable', key: 'bloom.starvedRegrowTicks', value: 15 },
    ]);
    run(w, 30);
    expect(bloom(w).thorns.length).toBe(10);
    expect(combatRates(w, 10)).toEqual({ killPerSecX10: 10, regrowPerSecX10: 20 });
  });
});

describe('the Root while uncut', () => {
  it('regrows one thorn per root.regrowTicks up to its effective cap, and follows root.capBonus live', () => {
    const w = idle(); // seed 1: knotted, cap 9
    expect(guardianStatus(w, N.root)).toMatchObject({ node: N.root, cap: 9, thorns: 9, regrowTicks: 60, repairPerRound: 2, supply: null });
    root(w).thorns = root(w).thorns.slice(0, 7);
    run(w, 59);
    expect(root(w).thorns.length).toBe(7);
    run(w, 1);
    expect(root(w).thorns.length).toBe(8);
    run(w, 60);
    expect(root(w).thorns.length).toBe(9);
    run(w, 300);
    expect(root(w).thorns.length).toBe(9);
    step(w, data, [{ type: 'setTunable', key: 'root.capBonus', value: 2 }]);
    run(w, 120);
    expect(root(w).thorns.length).toBe(11);
    step(w, data, [{ type: 'setTunable', key: 'root.regrowTicks', value: 15 }, { type: 'setTunable', key: 'root.capBonus', value: 4 }]);
    run(w, 30);
    expect(root(w).thorns.length).toBe(13);
    // Above a lowered cap: nothing is removed, regrowth just holds.
    step(w, data, [{ type: 'setTunable', key: 'root.capBonus', value: -5 }]);
    run(w, 100);
    expect(root(w).thorns.length).toBe(13);
    expect(root(w).regrowProgress).toBe(0);
  });

  it('repairs at guardian.repairPerRound and fights with the H1 round rules', () => {
    const w = idle();
    addShips(w, N.root, 10);
    step(w, data, []);
    // Ships: 20 dmg kills Root thorn 1. Root: 9 thorns × 3 = 27 → ships 1 and 2 die, ship 3 at 3.
    expect(root(w).thorns.length).toBe(8);
    expect(w.ships.length).toBe(8);
    expect(w.ships[0]!.hp).toBe(3);
    expect(battleStatus(w, N.root)).toMatchObject({ node: N.root, shipsPresent: 8, shipsEngaged: 10, shipsLost: 2, thornsKilled: 1 });
    expect(battleStatus(w)).toBeNull();
    // The Bloom is untouched and still fed.
    expect(bloom(w).thorns.length).toBe(12);
    expect(supplyStatus(w).fed).toBe(true);
  });

  it('two battles run at once, each counted on its own node', () => {
    const w = idle();
    w.tun['guardian.thornDamage'] = 0;
    addShips(w, N.root, 2);
    addShips(w, N.rich, 3);
    step(w, data, []);
    expect(activeBattles(w).map((b) => [b.node, b.shipsEngaged])).toEqual([
      [N.rich, 3],
      [N.root, 2],
    ]);
    step(w, data, [{ type: 'sendShips', from: N.root, to: N.probe, count: 0 }]);
    expect(activeBattles(w).map((b) => b.node)).toEqual([N.rich]);
    expect(lastBattle(w, N.root)).toMatchObject({ node: N.root, outcome: 'withdrew' });
    expect(lastBattle(w)).toBeNull();
  });

  it('a ship that fought at the Root counts as engaged again at the Bloom', () => {
    const w = idle();
    w.tun['guardian.thornDamage'] = 0;
    addShips(w, N.root, 1);
    addShips(w, N.rich, 1);
    step(w, data, []); // both battles start at tick 0
    w.ships[0]!.at = N.rich; // teleport for the test: the Root ship joins the Bloom fight
    run(w, 30);
    expect(battleStatus(w)!.shipsEngaged).toBe(2);
  });
});

describe('inputs and waves', () => {
  it('sending to the Root while it lives is a wave, counted per target; same-tick orders to one target are one wave', () => {
    const w = idle();
    addShips(w, N.probe, 4);
    addShips(w, N.a5, 4);
    step(w, data, [
      { type: 'sendShips', from: N.probe, to: N.root, count: 1 },
      { type: 'sendShips', from: N.a5, to: N.root, count: 1 },
    ]);
    expect(w.stats.wavesSent).toBe(1);
    expect(root(w).wavesSent).toBe(1);
    step(w, data, [
      { type: 'sendShips', from: N.probe, to: N.root, count: 1 },
      { type: 'sendShips', from: N.a5, to: N.rich, count: 1 },
      { type: 'sendShips', from: N.probe, to: N.rich, count: 1 },
    ]);
    expect([w.stats.wavesSent, root(w).wavesSent, bloom(w).wavesSent]).toEqual([3, 2, 1]);
    expect(runSummary(w)).toMatchObject({ wavesSent: 3, rootWavesSent: 2, bloomWavesSent: 1 });
  });

  it('after the cut, sending to the Root is a move, and it is a rally point; extractors are never valid there', () => {
    const w = idle();
    expect(isValidInput(w, data, { type: 'buildExtractor', node: N.root })).toBe(false);
    cutRoot(w);
    const before = w.stats.wavesSent;
    addShips(w, N.probe, 2);
    step(w, data, [{ type: 'sendShips', from: N.probe, to: N.root, count: 0 }, { type: 'setRally', node: N.root }]);
    expect(w.stats.wavesSent).toBe(before);
    expect(w.rally).toBe(N.root);
    expect(isValidInput(w, data, { type: 'buildExtractor', node: N.root })).toBe(false);
  });

  it('system.variant is accepted by setTunable but only read at world creation', () => {
    const w = idle();
    const id = w.system.id;
    step(w, data, [{ type: 'setTunable', key: 'system.variant', value: 3 }]);
    expect(w.tun['system.variant']).toBe(3);
    expect(w.system.id).toBe(id);
    expect(isValidInput(w, data, { type: 'setTunable', key: 'system.variant', value: 4 })).toBe(false);
    expect(isValidInput(w, data, { type: 'setTunable', key: 'root.capBonus', value: -15 })).toBe(false);
    expect(isValidInput(w, data, { type: 'setTunable', key: 'root.capBonus', value: -14 })).toBe(true);
  });
});

describe('selectors', () => {
  it('supplyStatus shows the Root, fed or starved, and both sets of Bloom values from live tunables', () => {
    const w = idle();
    expect(supplyStatus(w)).toEqual({
      bloomNode: N.rich,
      rootNode: N.root,
      rootAlive: true,
      fed: true,
      rootCutTick: null,
      fedBloom: { cap: 12, regrowTicks: 60, repairPerRound: 2 },
      starvedBloom: { cap: 8, regrowTicks: 300, repairPerRound: 0 },
      rootCap: 9,
      rootBaseCap: 9,
      rootCapBonus: 0,
    });
    run(w, 10);
    cutRoot(w);
    expect(supplyStatus(w)).toMatchObject({ rootAlive: false, fed: false, rootCutTick: 10 });
    expect(systemStatus(w)).toMatchObject({ rootCutTick: 10, rootCutSec: 0 });
    expect(combatRates(w, 0)).toEqual({ killPerSecX10: 0, regrowPerSecX10: 1 });
  });

  it('guardianStatus throws for a node that is not guarded', () => {
    expect(() => guardianStatus(fresh(), N.a1)).toThrow(/not a guarded node/);
  });
});

describe('fed behaviour is H1 when the Root is never touched', () => {
  /** A game with the network script, a full-army attack on the Bloom at minute 10 (37 ships), and a record of the Bloom every tick. */
  function bloomTrace(d: SimData, tuneRoot: Input[]): { trace: string[]; capturedTick: number | null; summary: ReturnType<typeof runSummary> } {
    const w = createWorld(11, d);
    const trace: string[] = [];
    for (let i = 0; i < 30 * 60 * 12; i++) {
      const inputs: Input[] = [];
      if (w.tick === 0) inputs.push(...tuneRoot);
      const next = networkStep(w);
      if (next) inputs.push(next);
      if (w.tick === 30 * 60 * 10) inputs.push({ type: 'sendShips', from: N.probe, to: N.rich, count: 0 });
      step(w, d, inputs);
      const g = bloom(w);
      trace.push(`${g.alive}:${g.regrowProgress}:${g.thorns.map((t) => t.hp).join(',')}`);
    }
    return { trace, capturedTick: w.capturedTick, summary: runSummary(w) };
  }

  it('the Bloom, the capture and the run summary are identical in every variant and at any Root strength', () => {
    const base = bloomTrace(withVariant(1), []);
    expect(base.capturedTick).not.toBeNull();
    const pick = (s: typeof base.summary) => [s.capturedTick, s.shipsBuilt, s.shipsLost, s.wavesSent, s.peakPerMin, s.thornsWithered, s.rootCutTick];
    for (const [v, tune] of [
      [2, []],
      [3, [{ type: 'setTunable', key: 'root.capBonus', value: 20 } as Input, { type: 'setTunable', key: 'root.regrowTicks', value: 15 } as Input]],
      [1, [{ type: 'setTunable', key: 'root.capBonus', value: -14 } as Input]],
    ] as const) {
      const other = bloomTrace(withVariant(v), [...tune]);
      expect(other.trace).toEqual(base.trace);
      expect(pick(other.summary)).toEqual(pick(base.summary));
    }
    expect(base.summary).toMatchObject({ thornsWithered: 0, rootCutTick: null, rootWavesSent: 0, rootShipsLost: 0 });
  });
});

describe('save format with the H2 state', () => {
  it('round trip after the Root is cut and the Bloom is starved: identical hash, then lockstep', () => {
    const w = createWorld(3, data);
    for (let i = 0; i < 30 * 60 * 7; i++) {
      const next = networkStep(w);
      step(w, data, next ? [next] : []);
    }
    addShips(w, N.root, 30);
    run(w, 200);
    expect(isRootCut(w)).toBe(true);
    addShips(w, N.rich, 6);
    run(w, 30);
    expect(battleStatus(w)).not.toBeNull();
    const r = deserializeWorld(serializeWorld(w), data);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(worldHash(r.world)).toBe(worldHash(w));
    expect(r.world.system).toEqual(w.system);
    expect(r.world.guardians).toEqual(w.guardians);
    for (let i = 0; i < 1800; i++) {
      step(w, data, []);
      step(r.world, data, []);
    }
    expect(worldHash(r.world)).toBe(worldHash(w));
  });

  it('refuses a data-version-2 save (H1 layout) with reason dataVersion', () => {
    const h1Save = JSON.stringify({
      format: 1,
      dataVersion: 2,
      world: { dataVersion: 2, tick: 10, stock: 5, nodes: [], routes: [], ships: [], queue: [], guardian: { alive: true, thorns: [], regrowProgress: 0 } },
    });
    expect(deserializeWorld(h1Save, defaultData)).toEqual({ ok: false, reason: 'dataVersion', saveDataVersion: 2 });
  });

  it('refuses a version-3 save without the guardians array or system as corrupt', () => {
    const w = fresh();
    const env = JSON.parse(serializeWorld(w)) as { world: Record<string, unknown> };
    delete env.world.guardians;
    expect(deserializeWorld(JSON.stringify(env), data)).toMatchObject({ ok: false, reason: 'corrupt' });
    const env2 = JSON.parse(serializeWorld(w)) as { world: Record<string, unknown> };
    delete env2.world.system;
    expect(deserializeWorld(JSON.stringify(env2), data)).toMatchObject({ ok: false, reason: 'corrupt' });
  });
});
