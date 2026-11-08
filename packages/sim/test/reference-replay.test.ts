import { describe, expect, it } from 'vitest';
import {
  RAW_RESOURCES,
  capEff,
  createWorld,
  defaultData as data,
  fleetStatus,
  isValidInput,
  landingEffects,
  step,
  yardBuildTicks,
  yardStatus,
  type Input,
  type World,
} from '../src/index.ts';
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
 *
 * h5-sim acceptance 6: it also buys Command limit 1 (with a tier 1 area
 * reclaimed), lands in Thorn Garden with the raised limit (a small fleet.cap
 * set live keeps it short), pauses yards at the limit ('fleetFull'), recycles
 * six drones and captures with the freed slots. Before that it plays with
 * fleet.cap 0 (H4's rules).
 */
describe('reference replay', () => {
  const w: World = createWorld(referenceReplay.seed, data);
  const battles: string[] = [];
  const typesApplied = new Set<string>();
  const ignored: string[] = [];
  const landings: Array<{ area: number; tick: number; ore: number; rigged: string[]; droneTicks: number; fleetCap: number | null }> = [];
  /** Per area: ticks a switched-on yard reported 'fleetFull', the most ships counted against the limit, and capAtSend per battle. */
  const fullTicks: Record<number, number> = {};
  const maxCount: Record<number, number> = {};
  const capAtSend: string[] = [];
  const recycled: Array<{ area: number; tick: number; drones: number; ore: number; countBefore: number; countAfter: number }> = [];
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
    const recycledBefore = before === null ? 0 : w.stats.shipsRecycled.drone;
    const refundBefore = before === null ? 0 : w.stats.oreRefunded;
    const countBefore = before === null ? 0 : fleetStatus(w, data).count;
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
        fleetCap: landingEffects(w).fleetCap,
      });
    }
    if (a !== null && a === before) {
      w.guardians.forEach((g, i) => {
        const lb = g.lastBattle;
        if (lb !== null && lb !== prevBattles[i]) {
          battles.push(`${data.map.areas[a]!.id} ${w.nodes[g.node]!.id} ${lb.outcome}`);
          capAtSend.push(`${data.map.areas[a]!.id} ${w.nodes[g.node]!.id} ${String(lb.capAtSend)}`);
          if (lb.wilt !== null) wilts.push({ area: a, from: lb.wilt.from, to: lb.wilt.to });
        }
      });
      builtIn[a] = { lancer: w.stats.shipsBuilt.lancer, flak: w.stats.shipsBuilt.flak, lens: w.stats.componentsBuilt.lens, plating: w.stats.componentsBuilt.plating };
      if (data.map.areas[a]!.id === 'veil' && w.yards.lancer.on) lancerOnInVeil = true;
      if (yardStatus(w).yards.some((y) => y.state === 'fleetFull')) fullTicks[a] = (fullTicks[a] ?? 0) + 1;
      maxCount[a] = Math.max(maxCount[a] ?? 0, fleetStatus(w, data).count);
      if (w.stats.shipsRecycled.drone > recycledBefore) {
        recycled.push({ area: a, tick: t, drones: w.stats.shipsRecycled.drone - recycledBefore, ore: w.stats.oreRefunded - refundBefore, countBefore, countAfter: fleetStatus(w, data).count });
      }
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
    expect(w.campaign.researchLog.map((r) => `${r.item} ${r.level}`)).toEqual(['opening 1', 'extract 1', 'flak 1', 'fleet 1', 'lancer 1', 'rigs 1', 'yards 1']);
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

  it('H5: no limit before Thorn Garden; Command limit 1 raises it there, the yards pause at it, and a recycle frees slots', () => {
    // fleet.cap is set to 0 at tick 0 and to 4 just before Command limit 1 is bought (Frost Shelf, tier 1, is reclaimed).
    const limit = 4 + data.tunables['research.fleet.step'].default;
    expect(landings.map((l) => [data.map.areas[l.area]!.id, l.fleetCap])).toEqual([
      ['landfall', null],
      ['shelf', null],
      ['shelf', null],
      ['veil', null],
      ['garden', limit],
      ['deep', limit],
    ]);
    // Without a limit the yards never report fleetFull; with it they do, and the count never passes the limit.
    for (const id of ['landfall', 'shelf', 'veil']) expect(fullTicks[area(id)] ?? 0, id).toBe(0);
    expect(fullTicks[area('garden')]).toBeGreaterThan(0);
    expect(maxCount[area('veil')]).toBeGreaterThan(limit);
    expect(maxCount[area('garden')]).toBe(limit);
    // The recycle: six drones at p1, each refunding floor(cost × refundPct / 100) at the replay's drone cost (5).
    const each = Math.floor((5 * data.tunables['fleet.recycleRefundPct'].default) / 100);
    expect(recycled.map((r) => ({ ...r, countAfter: 0 }))).toEqual([{ area: area('garden'), tick: 4500, drones: 6, ore: 6 * each, countBefore: limit, countAfter: 0 }]);
    // Rule 1 (the recycle) runs before rule 5b, so the paused yards start into the freed slots in the same tick.
    expect(recycled[0]!.countAfter).toBeGreaterThan(limit - 6);
    expect(recycled[0]!.countAfter).toBeLessThanOrEqual(limit);
    expect(w.campaign.areas[area('garden')]).toMatchObject({ shipsRecycled: 6, oreRefunded: 6 * each });
    // Every Garden battle records the limit it was sent at; earlier ones have none.
    expect(capAtSend.filter((c) => c.startsWith('garden'))).toEqual(['garden p2 10', 'garden p1 10', 'garden root 10', 'garden heart 10'].map((c) => c.replace('10', String(limit))));
    expect(capAtSend.filter((c) => !c.startsWith('garden')).every((c) => c.endsWith(' null'))).toBe(true);
  });

  it('uses every input type, with exactly one deliberately invalid input', () => {
    expect([...typesApplied].sort()).toEqual(
      ['buildExtractor', 'buildRoute', 'buyResearch', 'cancelBuild', 'enterArea', 'leaveArea', 'recycleShips', 'sendShips', 'setRally', 'setShipyard', 'setTunable', 'upgradeRoute'].sort(),
    );
    expect(ignored).toEqual([`0 ${JSON.stringify({ type: 'buyResearch', item: 2 })}`]);
  });
});
