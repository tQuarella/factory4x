import { describe, expect, it } from 'vitest';
import { RAW_RESOURCES, capEff, createWorld, defaultData as data, isValidInput, step, yardBuildTicks, type Input, type World } from '../src/index.ts';
import { referenceReplay } from '../../bots/src/reference-replay.ts';
import { applyInput } from '../src/inputs.ts';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * h4-sim acceptance 7: the reference replay (determinism gate and browser
 * cross-engine check) plays a campaign: Landfall reclaimed, research bought,
 * a withdraw and a re-landing, pocket, Root and heart captures, both designs
 * and both component yards, and a landing in The Deep with seed rigs and fast
 * yards; and every input type in it does something. It runs on the shipped
 * data, as the gate and the browser do, so a calibration that breaks the
 * script shows here: regenerate the replay then. Numbers are read from the
 * shipped data, not pinned.
 */
describe('reference replay', () => {
  const w: World = createWorld(referenceReplay.seed, data);
  const battles: string[] = [];
  const typesApplied = new Set<string>();
  const ignored: string[] = [];
  const landings: Array<{ area: number; tick: number; ore: number; rigged: string[]; droneTicks: number }> = [];
  const builtIn: Record<number, { lancer: number; flak: number; lens: number; plating: number }> = {};
  let lancerOnInVeil = false;
  const wilts: Array<{ area: number; from: unknown; to: unknown }> = [];
  let activeAt3000: number | null = null;
  for (let t = 0; t < 9000; t++) {
    const inputs: Input[] = referenceReplay.inputs.filter((e) => e.tick === t).map((e) => e.input);
    // Judge validity in log order, as step does: earlier inputs of the tick apply first.
    const probe = inputs.length > 0 ? clone(w) : w;
    for (const input of inputs) {
      if (isValidInput(probe, data, input)) typesApplied.add(input.type);
      else ignored.push(`${t} ${JSON.stringify(input)}`);
      applyInput(probe, data, input);
    }
    const before = w.campaign.active;
    const prevBattles = w.guardians.map((g) => g.lastBattle);
    step(w, data, inputs);
    const a = w.campaign.active;
    if (a !== null && a !== before) {
      landings.push({
        area: a,
        tick: w.campaign.areaStartTick,
        // The opening stock: what is left plus what the landing tick spent.
        ore: w.stock.ore + w.stats.oreSpentShips + w.stats.oreSpentEconomy + w.stats.oreSpentComponents,
        rigged: w.nodes.filter((n) => n.kind === 'asteroid' && n.extractors > 0).map((n) => n.id),
        droneTicks: yardBuildTicks(w, 'drone'),
      });
    }
    if (a !== null && a === before) {
      w.guardians.forEach((g, i) => {
        const lb = g.lastBattle;
        if (lb !== null && lb !== prevBattles[i]) {
          battles.push(`${data.map.areas[a]!.id} ${w.nodes[g.node]!.id} ${lb.outcome}`);
          if (lb.wilt !== null) wilts.push({ area: a, from: lb.wilt.from, to: lb.wilt.to });
        }
      });
      builtIn[a] = { lancer: w.stats.shipsBuilt.lancer, flak: w.stats.shipsBuilt.flak, lens: w.stats.componentsBuilt.lens, plating: w.stats.componentsBuilt.plating };
      if (data.map.areas[a]!.id === 'veil' && w.yards.lancer.on) lancerOnInVeil = true;
    }
    if (w.tick === 3000) activeAt3000 = w.campaign.active;
  }
  const area = (id: string): number => data.map.areas.findIndex((x) => x.id === id);

  it('reclaims Landfall, Frost Shelf, Spore Veil and Thorn Garden in that order, then lands in The Deep (the gate ends in an area)', () => {
    expect(w.campaign.reclaimOrder.map((i) => data.map.areas[i]!.id)).toEqual(['landfall', 'shelf', 'veil', 'garden']);
    expect(landings.map((l) => data.map.areas[l.area]!.id)).toEqual(['landfall', 'shelf', 'shelf', 'veil', 'garden', 'deep']);
    expect(data.map.areas[w.campaign.active!]!.id).toBe('deep');
    expect(activeAt3000).not.toBeNull();
    // Every reclaim paid its haul once.
    for (const res of RAW_RESOURCES) {
      const hauls = ['landfall', 'shelf', 'veil', 'garden'].reduce((s, id) => s + data.map.areas[area(id)]!.haul[res], 0);
      expect(w.campaign.totals.hauled[res], res).toBe(hauls);
    }
    expect(w.campaign.totals.shipped.ore).toBeGreaterThan(0);
  });

  it('withdraws from Frost Shelf once; the second landing carries Opening ore 1, and the withdraw kept the research', () => {
    expect(w.campaign.areas[area('shelf')]).toMatchObject({ entries: 2, withdrawals: 1 });
    const [, first, second] = landings;
    const opening = data.tunables['economy.startStock'].default + data.tunables['research.opening.step'].default;
    expect([first!.ore, second!.ore]).toEqual([opening, opening]);
    expect(landings[0]!.ore).toBe(data.tunables['economy.startStock'].default);
    expect(w.campaign.researchLog.map((r) => `${r.item} ${r.level}`)).toEqual(['opening 1', 'extract 1', 'flak 1', 'lancer 1', 'rigs 1', 'yards 1']);
  });

  it('captures pockets, cuts Roots (the wilt) and takes hearts; a lone drone is repelled', () => {
    expect(battles).toEqual([
      'landfall heart captured',
      'shelf p1 captured',
      'shelf heart captured',
      'veil heart repelled',
      'veil p1 captured',
      'veil p2 captured',
      'veil root captured',
      'veil heart captured',
      'garden p2 captured',
      'garden p1 captured',
      'garden root captured',
      'garden heart captured',
    ]);
    // The Veil heart starts full at half its counts and wilts to half its starved counts.
    const veil = data.map.areas[area('veil')]!.layout;
    if (veil === 'seed') throw new Error('veil has its own layout');
    const h = veil.heart;
    expect(wilts.map((x) => x.area)).toEqual([area('veil'), area('garden')]);
    expect(wilts[0]).toMatchObject({ to: { thorn: capEff(h.starvedThorns!, 50), spore: capEff(h.starvedSpores!, 50) } });
  });

  it('the design gate holds in Spore Veil (lancer yard on, lenses made, no lancer); Thorn Garden runs both component yards', () => {
    expect(lancerOnInVeil).toBe(true);
    expect(builtIn[area('veil')]).toMatchObject({ lancer: 0 });
    expect(builtIn[area('veil')]!.lens).toBeGreaterThan(0);
    expect(builtIn[area('veil')]!.flak).toBeGreaterThanOrEqual(2);
    expect(builtIn[area('garden')]!.lancer).toBeGreaterThanOrEqual(2);
    expect(builtIn[area('garden')]!.flak).toBeGreaterThanOrEqual(2);
  });

  it('lands in The Deep with A1 rigged and Fast yards 1 on the drone build time', () => {
    const deep = landings[landings.length - 1]!;
    expect(deep.rigged).toEqual(['a1']);
    expect(deep.droneTicks).toBe(Math.max(15, Math.floor((30 * (100 - data.tunables['research.yards.stepPct'].default)) / 100)));
    expect(w.routes.find((r) => r.from === 1)?.level).toBe(2);
  });

  it('uses every input type, with exactly one deliberately invalid input', () => {
    expect([...typesApplied].sort()).toEqual(
      ['buildExtractor', 'buildRoute', 'buyResearch', 'cancelBuild', 'enterArea', 'leaveArea', 'sendShips', 'setRally', 'setShipyard', 'setTunable', 'upgradeRoute'].sort(),
    );
    expect(ignored).toEqual([`0 ${JSON.stringify({ type: 'buyResearch', item: 2 })}`]);
  });
});
