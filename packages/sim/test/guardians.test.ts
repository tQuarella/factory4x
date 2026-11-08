import { describe, expect, it } from 'vitest';
import {
  TAG_STRONG_PCT,
  TAG_WEAK_PCT,
  capEff,
  chooseVariant,
  combatRates,
  counterTag,
  deserializeWorld,
  guardCaps,
  guardianStatus,
  isRootCut,
  runSummary,
  serializeWorld,
  step,
  supplyStatus,
  systemStatus,
  tagFor,
  weightedMultPct,
  worldHash,
  type SimData,
  type World,
} from '../src/index.ts';
import { L, N, addShips, data, fresh, guardian, heart, idle, root, run, setGuards } from './helpers.ts';
import { h3World } from './h3-world.ts';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Fixture data with one tunable's default replaced. */
function withDefault(key: keyof SimData['tunables'], value: number): SimData {
  const d = clone(data);
  d.tunables[key].default = value;
  return d;
}

/** Captures the Root by hand: no guards, one ship arrives. */
function cutRoot(w: World): void {
  root(w).guards = [];
  addShips(w, N.root, 1);
  step(w, data, []);
  expect(isRootCut(w)).toBe(true);
}

const typeCounts = (w: World, node: number) => {
  const g = guardianStatus(w, node).guards;
  return [g.thorn.count, g.spore.count];
};

describe('layout selection and setup', () => {
  it('by seed: ((seed mod 3) + 3) mod 3, including negative seeds; system.variant k forces layout k − 1', () => {
    expect([0, 1, 2, 3, 4, -1, -2, -3].map((s) => chooseVariant(s, 0, 3))).toEqual([0, 1, 2, 0, 1, 2, 1, 0]);
    for (let k = 1; k <= 3; k++) {
      for (const seed of [0, 1, 2, -5]) expect(h3World(seed, withDefault('system.variant', k)).system.variant).toBe(k - 1);
    }
    expect([0, 1, 2].map((s) => systemStatus(fresh(s)))).toEqual([
      { variant: 0, id: 'frost', name: 'Frost Gate', rootCutTick: null, rootCutSec: null },
      { variant: 1, id: 'glass', name: 'Glass Thicket', rootCutTick: null, rootCutSec: null },
      { variant: 2, id: 'twin', name: 'Twin Seams', rootCutTick: null, rootCutSec: null },
    ]);
  });

  it('pockets take prize and slots from the layout; asteroids and the heart yield ore; positions never change', () => {
    const [frost, glass, twin] = [fresh(L.frost), fresh(L.glass), fresh(L.twin)];
    const pockets = (w: World) => [N.p1, N.p2, N.p3, N.p4].map((n) => `${w.nodes[n]!.prize} ${w.nodes[n]!.slots}`);
    expect(pockets(frost)).toEqual(['ice 2', 'crystal 2', 'ice 3', 'crystal 3']);
    expect(pockets(glass)).toEqual(['crystal 2', 'ice 2', 'ice 3', 'crystal 3']);
    expect(pockets(twin)).toEqual(['ice 2', 'crystal 2', 'crystal 3', 'ice 3']);
    expect(frost.nodes.map((n) => n.prize)).toEqual([null, ...Array(9).fill('ore'), 'ice', 'crystal', 'ice', 'crystal', null, 'ore']);
    expect(glass.nodes.map((n) => [n.x, n.y])).toEqual(frost.nodes.map((n) => [n.x, n.y]));
    expect(frost.guardians.map((g) => g.node)).toEqual([N.p1, N.p2, N.p3, N.p4, N.root, N.heart]);
    expect(frost.guardians.map((g) => g.fed)).toEqual([null, null, null, null, null, true]);
  });

  it('every guardian starts full at its layout mix, Thorns then Spores, ids ascending', () => {
    const counts = (w: World) => w.guardians.map((g) => typeCounts(w, g.node).join('/'));
    expect(counts(fresh(L.frost))).toEqual(['1/8', '3/3', '9/4', '2/18', '6/0', '10/14']);
    expect(counts(fresh(L.glass))).toEqual(['1/8', '3/3', '2/18', '9/4', '0/12', '14/8']);
    expect(counts(fresh(L.twin))).toEqual(['2/5', '2/5', '2/18', '9/4', '3/6', '6/20']);
    const ids = fresh().guardians.flatMap((g) => g.guards.map((x) => x.id));
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(heart(fresh()).guards.map((g) => g.type)).toEqual([...Array(10).fill('thorn'), ...Array(14).fill('spore')]);
  });
});

describe('capEff and guard.capPct', () => {
  it('capEff(n) = min(60, floor(n × capPct / 100))', () => {
    expect(capEff(9, 100)).toBe(9);
    expect(capEff(9, 50)).toBe(4); // 4.5 floors
    expect(capEff(9, 25)).toBe(2);
    expect(capEff(9, 300)).toBe(27);
    expect(capEff(20, 300)).toBe(60); // exactly at the ceiling
    expect(capEff(21, 300)).toBe(60); // 63 clamps
    expect(capEff(0, 300)).toBe(0);
  });

  it('applies to every layout count, starved caps included, at creation and live', () => {
    const w = h3World(0, withDefault('guard.capPct', 50));
    expect(w.guardians.map((g) => typeCounts(w, g.node).join('/'))).toEqual(['0/4', '1/1', '4/2', '1/9', '3/0', '5/7']);
    expect(supplyStatus(w).starvedHeart.caps).toEqual({ thorn: 3, spore: 3 });
    // Live: raising it raises the caps, and regrowth fills toward them.
    const v = fresh();
    v.tun['guard.capPct'] = 200;
    expect(guardCaps(v, heart(v))).toEqual({ thorn: 20, spore: 28 });
    run(v, 60);
    expect(typeCounts(v, N.heart)).toEqual([11, 17]);
    // Lowering it below the live count removes nothing; regrowth just holds.
    v.tun['guard.capPct'] = 25;
    run(v, 120);
    expect(typeCounts(v, N.heart)).toEqual([11, 17]);
    expect(heart(v).regrowProgress).toEqual({ thorn: 0, spore: 0 });
  });

  it('a guarded node whose effective caps are all 0 has no guards, and the first ship to arrive takes it', () => {
    const d = clone(data);
    d.map.layouts[0]!.pockets.p2 = { prize: 'crystal', slots: 2, thorns: 0, spores: 0 };
    const w = h3World(0, d);
    w.stock.ore = 0;
    expect(guardian(w, N.p2).guards).toEqual([]);
    run(w, 600, d);
    expect(guardian(w, N.p2).guards).toEqual([]);
    expect(guardian(w, N.p2).alive).toBe(true);
    addShips(w, N.p2, 1);
    step(w, d, []);
    expect(guardian(w, N.p2).alive).toBe(false);
    expect(w.lastBattle).toMatchObject({ node: N.p2, outcome: 'captured', shipsEngaged: 1, guardsKilled: 0 });
    // capPct 25 also zeroes the Frost Gate p1 Thorn: floor(1 × 25 / 100) = 0.
    expect(typeCounts(h3World(0, withDefault('guard.capPct', 25)), N.p1)).toEqual([0, 2]);
  });
});

describe('rule 9: per-type regrowth', () => {
  it('each type regrows on its own period toward its own cap', () => {
    const w = idle();
    heart(w).guards = [];
    run(w, 60);
    expect(typeCounts(w, N.heart)).toEqual([1, 3]); // Thorn 1 / 60 ticks, Spore 1 / 20
    run(w, 220); // tick 280: 14 Spores, the cap
    expect(typeCounts(w, N.heart)).toEqual([4, 14]);
    run(w, 100);
    expect(typeCounts(w, N.heart)).toEqual([6, 14]);
    expect(heart(w).regrowProgress.spore).toBe(0);
    expect(heart(w).regrowProgress.thorn).toBe(20);
    const st = guardianStatus(w, N.heart).guards;
    expect(st.spore).toMatchObject({ count: 14, cap: 14, regrowTicks: 20, hp: 6, damage: 1, repairPerRound: 0 });
    expect(st.thorn).toMatchObject({ count: 6, cap: 10, regrowTicks: 60, regrowProgress: 20, hp: 20, damage: 3, repairPerRound: 2 });
  });

  it('new guards come at full hp with new ids; when both types complete on one tick, the Thorn is added first', () => {
    const w = idle();
    heart(w).guards = [];
    run(w, 60);
    const gs = heart(w).guards;
    expect(gs.map((g) => g.type)).toEqual(['spore', 'spore', 'thorn', 'spore']);
    expect(gs.map((g) => g.hp)).toEqual([6, 6, 20, 6]);
    expect(gs.map((g) => g.id)).toEqual([...gs.map((g) => g.id)].sort((a, b) => a - b));
  });

  it('the starved heart regrows at guard.<type>.regrowTicks × bloom.starvedRegrowMul toward its starved caps', () => {
    const w = idle();
    cutRoot(w);
    heart(w).guards = [];
    heart(w).regrowProgress = { thorn: 0, spore: 0 };
    const st = guardianStatus(w, N.heart);
    expect(st.supply).toBe('starved');
    expect([st.guards.thorn.regrowTicks, st.guards.spore.regrowTicks]).toEqual([300, 100]);
    expect([st.guards.thorn.cap, st.guards.spore.cap]).toEqual([6, 7]);
    run(w, 300);
    expect(typeCounts(w, N.heart)).toEqual([1, 3]);
    run(w, 1800);
    expect(typeCounts(w, N.heart)).toEqual([6, 7]);
    // The multiplier is live: at 1 it regrows at the fed periods (caps stay starved).
    w.tun['bloom.starvedRegrowMul'] = 1;
    expect(guardianStatus(w, N.heart).guards.thorn.regrowTicks).toBe(60);
  });

  it('the starved heart repairs at bloom.starvedRepairPerRound for both types (0 by default)', () => {
    const w = idle();
    cutRoot(w);
    setGuards(w, N.heart, [['thorn', 10], ['spore', 2]]);
    run(w, 60);
    expect(heart(w).guards.slice(0, 2).map((g) => g.hp)).toEqual([10, 2]);
    w.tun['bloom.starvedRepairPerRound'] = 1;
    run(w, 30);
    expect(heart(w).guards.slice(0, 2).map((g) => g.hp)).toEqual([11, 3]);
  });
});

describe('rule 8: the Root cut wilts the heart', () => {
  it('both types drop to their starved caps, newest first, counted as withered; regrowth restarts; fed = false', () => {
    const w = idle();
    heart(w).regrowProgress = { thorn: 7, spore: 9 };
    const before = heart(w).guards.map((g) => g.id);
    cutRoot(w);
    const h = heart(w);
    expect(h.fed).toBe(false);
    expect(typeCounts(w, N.heart)).toEqual([6, 7]);
    // The oldest 6 Thorns (ids 1st-6th) and oldest 7 Spores (11th-17th) remain.
    expect(h.guards.map((g) => g.id)).toEqual([...before.slice(0, 6), ...before.slice(10, 17)]);
    expect(w.stats.guardsWithered).toBe(11);
    expect(w.stats.guardsKilled).toEqual({ thorn: 0, spore: 0 });
    expect(h.regrowProgress).toEqual({ thorn: 0, spore: 0 });
    expect(w.stats.rootCutTick).toBe(0);
    expect(w.lastBattle).toMatchObject({ node: N.root, outcome: 'captured', wilt: { from: { thorn: 10, spore: 14 }, to: { thorn: 6, spore: 7 } } });
    expect(w.stats.captures).toEqual([{ node: N.root, tick: 0 }]);
  });

  it('removes the highest ids of each type even when the types are interleaved', () => {
    const w = idle();
    heart(w).starvedCounts = { thorn: 1, spore: 1 };
    setGuards(w, N.heart, [['spore', 6], ['thorn', 20], ['thorn', 11], ['spore', 3], ['thorn', 20], ['spore', 6]]);
    const ids = heart(w).guards.map((g) => g.id);
    cutRoot(w);
    expect(heart(w).guards.map((g) => g.id)).toEqual([ids[0], ids[1]]);
    expect(w.stats.guardsWithered).toBe(4);
  });

  it('a heart already at or below its starved caps loses nothing', () => {
    const w = idle();
    setGuards(w, N.heart, [['thorn', 20], ['spore', 6]]);
    cutRoot(w);
    expect(typeCounts(w, N.heart)).toEqual([1, 1]);
    expect(w.stats.guardsWithered).toBe(0);
    expect(w.lastBattle!.wilt).toEqual({ from: { thorn: 1, spore: 1 }, to: { thorn: 1, spore: 1 } });
  });

  it('the starved caps follow guard.capPct', () => {
    const w = idle();
    w.tun['guard.capPct'] = 50;
    cutRoot(w);
    expect(typeCounts(w, N.heart)).toEqual([3, 3]); // floor(6 × 0.5), floor(7 × 0.5)
  });

  it('taking the Root after the heart has fallen only records the cut', () => {
    const w = idle();
    heart(w).guards = [];
    addShips(w, N.heart, 1);
    step(w, data, []);
    expect(w.capturedTick).toBe(0);
    cutRoot(w);
    expect(w.lastBattle!.wilt).toBeNull();
    expect(heart(w).fed).toBe(true);
    expect(w.stats.guardsWithered).toBe(0);
    expect(runSummary(w).captures.map((c) => c.id)).toEqual(['heart', 'root']);
  });

  it('a Root repelled with guards left changes nothing for the heart', () => {
    const w = idle();
    addShips(w, N.root, 1);
    run(w, 31);
    expect(root(w).alive).toBe(true);
    expect(heart(w).fed).toBe(true);
    expect(typeCounts(w, N.heart)).toEqual([10, 14]);
  });
});

describe('Strong / Even / Weak tags', () => {
  const t = data.tunables;
  const tun = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.default])) as unknown as World['tun'];

  it('weighted multiplier = Σ count × hp × mult / Σ count × hp, integer with the division last', () => {
    // Frost Gate p2, 3 Thorns / 3 Spores: lancer (60 × 200 + 18 × 25) / 78 = 159.6 → 159.
    expect(weightedMultPct(tun, 'lancer', { thorn: 3, spore: 3 })).toBe(159);
    expect(weightedMultPct(tun, 'flak', { thorn: 3, spore: 3 })).toBe(65); // (60 × 25 + 18 × 200) / 78 = 65.4
    expect(weightedMultPct(tun, 'drone', { thorn: 3, spore: 3 })).toBe(100);
    expect(weightedMultPct(tun, 'lancer', { thorn: 0, spore: 0 })).toBe(100);
    expect(weightedMultPct(tun, 'flak', { thorn: 0, spore: 5 })).toBe(200);
  });

  it('Strong at ≥ 150, Weak at ≤ 75, Even between; both sides and the equal case of each threshold', () => {
    expect([TAG_STRONG_PCT, TAG_WEAK_PCT]).toEqual([150, 75]);
    expect(tagFor('lancer', 150)).toBe('strong');
    expect(tagFor('lancer', 149)).toBe('even');
    expect(tagFor('flak', 76)).toBe('even');
    expect(tagFor('flak', 75)).toBe('weak');
    expect(tagFor('flak', 74)).toBe('weak');
    expect(tagFor('lancer', 400)).toBe('strong');
    expect(tagFor('drone', 400)).toBe('even'); // drones are always Even
    expect(tagFor('drone', 10)).toBe('even');
  });

  it('follows the counter tunables, reaching each threshold exactly', () => {
    const at = (strong: number, weak: number) => ({ ...tun, 'counter.strongPct': strong, 'counter.weakPct': weak });
    expect(counterTag(at(150, 25), 'lancer', { thorn: 4, spore: 0 })).toEqual({ multPct: 150, tag: 'strong' });
    expect(counterTag(at(149, 25), 'lancer', { thorn: 4, spore: 0 })).toEqual({ multPct: 149, tag: 'even' });
    expect(counterTag(at(200, 75), 'lancer', { thorn: 0, spore: 4 })).toEqual({ multPct: 75, tag: 'weak' });
    expect(counterTag(at(200, 76), 'lancer', { thorn: 0, spore: 4 })).toEqual({ multPct: 76, tag: 'even' });
    expect(counterTag(at(100, 100), 'flak', { thorn: 3, spore: 3 })).toEqual({ multPct: 100, tag: 'even' });
    // Guard hp is the weight: at Spore hp 20 the Frost Gate p1 mix (1/8) is Strong for flak: (20 × 25 + 160 × 200) / 180 = 180.5.
    expect(counterTag({ ...tun, 'guard.spore.hp': 20 }, 'flak', { thorn: 1, spore: 8 })).toEqual({ multPct: 180, tag: 'strong' });
  });

  it('guardianStatus tags every guarded node from its live mix (the fixture layouts at defaults)', () => {
    const tags = (w: World) => w.guardians.map((g) => {
      const s = guardianStatus(w, g.node).tags;
      return `${w.nodes[g.node]!.id} L${s.lancer.multPct} ${s.lancer.tag} F${s.flak.multPct} ${s.flak.tag} D ${s.drone.tag}`;
    });
    expect(tags(fresh(L.frost))).toEqual([
      'p1 L76 even F148 even D even',
      'p2 L159 strong F65 weak D even',
      'p3 L179 strong F45 weak D even',
      'p4 L72 weak F152 strong D even',
      'root L200 strong F25 weak D even',
      'heart L148 even F76 even D even',
    ]);
    expect(tags(fresh(L.glass)).slice(4)).toEqual(['root L25 weak F200 strong D even', 'heart L174 strong F50 weak D even']);
    expect(tags(fresh(L.twin))).toEqual([
      'p1 L125 even F100 even D even',
      'p2 L125 even F100 even D even',
      'p3 L72 weak F152 strong D even',
      'p4 L179 strong F45 weak D even',
      'root L134 even F90 even D even',
      'heart L112 even F112 even D even',
    ]);
    // Live: the tag changes as the mix changes.
    const w = fresh(L.frost);
    setGuards(w, N.p1, [['thorn', 20]]);
    expect(guardianStatus(w, N.p1).tags.lancer).toEqual({ multPct: 200, tag: 'strong' });
  });
});

describe('selectors', () => {
  it('guardianStatus gives the prize line: prize, slots, per-extractor rate', () => {
    const w = fresh(L.frost);
    expect(guardianStatus(w, N.p1)).toMatchObject({ kind: 'pocket', prize: 'ice', slots: 2, prizePerMinPerExtractor: 6, supply: null });
    expect(guardianStatus(w, N.root)).toMatchObject({ kind: 'root', prize: null, slots: 0, prizePerMinPerExtractor: 0 });
    expect(guardianStatus(w, N.heart)).toMatchObject({ kind: 'heart', prize: 'ore', slots: 4, prizePerMinPerExtractor: 25, supply: 'fed' });
    expect(guardianStatus(w, N.p1).guardHps).toEqual([{ type: 'thorn', hp: 20 }, ...Array(8).fill({ type: 'spore', hp: 6 })]);
    expect(() => guardianStatus(w, N.a1)).toThrow(/not a guarded node/);
  });

  it('supplyStatus shows the Root, fed or starved, and the heart in both states from live tunables', () => {
    const w = idle();
    expect(supplyStatus(w)).toEqual({
      heartNode: N.heart,
      rootNode: N.root,
      hasRoot: true,
      rootAlive: true,
      fed: true,
      rootCutTick: null,
      fedHeart: { caps: { thorn: 10, spore: 14 }, regrowTicks: { thorn: 60, spore: 20 }, repairPerRound: { thorn: 2, spore: 0 } },
      starvedHeart: { caps: { thorn: 6, spore: 7 }, regrowTicks: { thorn: 300, spore: 100 }, repairPerRound: { thorn: 0, spore: 0 } },
    });
    w.tun['bloom.starvedRegrowMul'] = 2;
    cutRoot(w);
    expect(supplyStatus(w)).toMatchObject({ rootAlive: false, fed: false, rootCutTick: 0, starvedHeart: { regrowTicks: { thorn: 120, spore: 40 } } });
  });

  it('combatRates: guards stripped per second ×10 against the live mix, and regrowth per type', () => {
    const w = fresh(L.frost);
    // p2 (3/3): 4 lancers × 4 × 159 = 2544 → × 6 guards × 30 × 10 / (100 × 78 hp × 30) = 19.57 → 19.
    expect(combatRates(w, N.p2, { drone: 0, lancer: 4, flak: 0 })).toEqual({ killPerSecX10: 19, regrowPerSecX10: 20, regrowByTypeX10: { thorn: 5, spore: 15 } });
    // Drones: 10 × 2 × 100 = 2000 → 2000 × 6 × 300 / (100 × 78 × 30) = 15.4 → 15.
    expect(combatRates(w, N.p2, { drone: 10, lancer: 0, flak: 0 }).killPerSecX10).toBe(15);
    // The Frost Gate Root has no Spore cap, so only Thorns regrow; no guards → no kill rate.
    root(w).guards = [];
    expect(combatRates(w, N.root, { drone: 10, lancer: 0, flak: 0 })).toEqual({ killPerSecX10: 0, regrowPerSecX10: 5, regrowByTypeX10: { thorn: 5, spore: 0 } });
  });

  it('runSummary lists captures in order with prizes and times, per-type ships, and per-target numbers', () => {
    const w = idle();
    for (const node of [N.p2, N.p1]) {
      guardian(w, node).guards = [];
      addShips(w, node, 1, 'flak');
      run(w, 30);
    }
    cutRoot(w);
    const s = runSummary(w);
    expect(s.captures.map((c) => [c.id, c.prize, c.sec])).toEqual([
      ['p2', 'crystal', 0],
      ['p1', 'ice', 1],
      ['root', null, 2],
    ]);
    expect(s).toMatchObject({ variantId: 'frost', variantName: 'Frost Gate', rootCutSec: 2, guardsWithered: 11, capturedTick: null, captureSec: null });
    expect(s.targets.map((x) => x.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'root', 'heart']);
    expect(s.targets.map((x) => x.capturedTick)).toEqual([30, 0, null, null, 60, null]);
  });
});

describe('save format with the H3 state', () => {
  it('round trip mid-game (pockets, components, mixed fleet, starved heart): identical hash, then lockstep', () => {
    const w = idle();
    w.tun['economy.probeOrePerMin'] = 60;
    w.stock = { ore: 200, ice: 9, crystal: 9, lens: 0, plating: 0 };
    for (const t of ['drone', 'lancer', 'flak'] as const) w.yards[t].on = true;
    guardian(w, N.p1).guards = [];
    addShips(w, N.p1, 2, 'lancer');
    addShips(w, N.p3, 4, 'flak');
    run(w, 200);
    cutRoot(w);
    run(w, 100);
    const r = deserializeWorld(serializeWorld(w), data);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(worldHash(r.world)).toBe(worldHash(w));
    for (let i = 0; i < 1800; i++) {
      step(w, data, []);
      step(r.world, data, []);
    }
    expect(worldHash(r.world)).toBe(worldHash(w));
    expect(w.ships.some((s) => s.type === 'lancer')).toBe(true);
  });

  it('refuses a data-version-3 save (H2) with reason dataVersion', () => {
    const h2 = JSON.stringify({ format: 1, dataVersion: 3, world: { tick: 100, stock: 40, shipyard: { on: true, ticksLeft: 0 }, guardians: [] } });
    expect(deserializeWorld(h2, data)).toEqual({ ok: false, reason: 'dataVersion', saveDataVersion: 3 });
  });
});
