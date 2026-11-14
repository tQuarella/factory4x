import { describe, expect, it } from 'vitest';
import {
  RAW_RESOURCES,
  bandOpen,
  campaignWorld,
  decayedHaul,
  fleetStatus,
  isLaneOpen,
  isValidInput,
  landingEffects,
  rootIndex,
  step,
  yardBuildTicks,
  yardStatus,
  type Input,
  type ResourceTriple,
  type World,
} from '../src/index.ts';
import { campaignReplay as referenceReplay } from './campaign-replay.ts';
import { shippedCampaign as data } from './fixture.ts';
import { applyInput } from '../src/inputs.ts';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * h7-sim: the H6 reference replay moved here from the bots package and runs on the shipped data with run.mode
 * "campaign" (the field replay is the determinism gate's now), with every assertion it had.
 *
 * h4-sim acceptance 7, h5-sim acceptance 6 and h6-sim acceptance 6: the
 * reference replay (determinism gate and browser cross-engine check). It runs
 * on the shipped data, as the gate and the browser do, so a calibration that
 * breaks the script shows here: regenerate the replay then. Numbers are read
 * from the shipped data, not pinned.
 *
 * H6 (DESIGN.md "Save, data version and replay"): from a campaignWorld start
 * with both designs (and Thorn Garden held, the only way to put a band-locked
 * area on a lane), it covers Landfall, an enterArea refused by the band lock, a
 * relay reclaim (Glint Relay, which is also a repeat haul), a landing in band 2
 * with the raised limit, a yard at the limit, a recycleShips, captures, a
 * second relay and repeat haul (Spire Relay), and The Deep without its Root at
 * the twice-raised limit. It also keeps H4's withdraw, cancel and research
 * steps, and uses every input type.
 *
 * h6-combat-target: in The Deep, weak lancers and flak fight the heart's
 * Thorns and Spores across the 5400 checkpoint, so the determinism hashes
 * depend on the combat amendment (each guard pool strikes the ship type it
 * counters first).
 */
describe('campaign replay (the H6 reference replay, on the shipped data in campaign mode)', () => {
  expect(referenceReplay.start).toBeDefined();
  const w: World = campaignWorld(referenceReplay.seed, data, referenceReplay.start!);
  const battles: string[] = [];
  const typesApplied = new Set<string>();
  const ignored: string[] = [];
  /** Why each refused enterArea was refused: [tick, area id, lane-open, band open]. */
  const refusedLandings: Array<[number, string, boolean, boolean]> = [];
  const landings: Array<{ area: string; tick: number; ore: number; rigged: string[]; droneTicks: number; fleetCap: number | null; hasRoot: boolean }> = [];
  /** Per area id: ticks a switched-on yard reported 'fleetFull', and the most ships counted against the limit. */
  const fullTicks: Record<string, number> = {};
  const maxCount: Record<string, number> = {};
  const capAtSend: string[] = [];
  const recycled: Array<{ area: string; tick: number; drones: number; ore: number; countBefore: number }> = [];
  const builtIn: Record<string, { lancer: number; flak: number; drone: number }> = {};
  let activeAt3000: number | null = null;
  /** At each checkpoint (every 300 ticks) with a battle at a heart: the ships there as type + hp, and the guards left. */
  const heartAtCheckpoint: Array<{ tick: number; area: string; ships: string[]; guards: { thorn: number; spore: number } }> = [];
  const areaId = (a: number): string => data.map.areas[a]!.id;
  for (let t = 0; t < 9000; t++) {
    const inputs: Input[] = referenceReplay.inputs.filter((e) => e.tick === t).map((e) => e.input);
    // Judge validity in log order, as step does: earlier inputs of the tick apply first.
    const probe = inputs.length > 0 ? clone(w) : w;
    for (const input of inputs) {
      if (isValidInput(probe, data, input)) typesApplied.add(input.type);
      else {
        ignored.push(`${t} ${JSON.stringify(input)}`);
        if (input.type === 'enterArea') {
          const tier = data.map.areas[input.area]!.tier;
          refusedLandings.push([t, areaId(input.area), isLaneOpen(probe, data, input.area), bandOpen(probe, data, tier)]);
        }
      }
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
        area: areaId(a),
        tick: w.campaign.areaStartTick,
        // The opening stock: what is left plus what the landing tick spent.
        ore: w.stock.ore + w.stats.oreSpentShips + w.stats.oreSpentEconomy + w.stats.oreSpentComponents,
        rigged: w.nodes.filter((n) => n.kind === 'asteroid' && n.extractors > 0).map((n) => n.id),
        droneTicks: yardBuildTicks(w, 'drone'),
        fleetCap: landingEffects(w, data).fleetCap,
        hasRoot: rootIndex(w) >= 0,
      });
    }
    if (a !== null && a === before) {
      const id = areaId(a);
      w.guardians.forEach((g, i) => {
        const lb = g.lastBattle;
        if (lb !== null && lb !== prevBattles[i]) {
          battles.push(`${id} ${w.nodes[g.node]!.id} ${lb.outcome}`);
          capAtSend.push(`${id} ${w.nodes[g.node]!.id} ${String(lb.capAtSend)}`);
        }
      });
      builtIn[id] = { ...w.stats.shipsBuilt };
      if (yardStatus(w, data).yards.some((y) => y.state === 'fleetFull')) fullTicks[id] = (fullTicks[id] ?? 0) + 1;
      maxCount[id] = Math.max(maxCount[id] ?? 0, fleetStatus(w, data).count);
      if (w.stats.shipsRecycled.drone > recycledBefore) {
        recycled.push({ area: id, tick: t, drones: w.stats.shipsRecycled.drone - recycledBefore, ore: w.stats.oreRefunded - refundBefore, countBefore });
      }
    }
    if (w.tick === 3000) activeAt3000 = w.campaign.active;
    if (a !== null && w.tick % 300 === 0) {
      const hg = w.guardians.find((g) => w.nodes[g.node]!.kind === 'heart')!;
      if (hg.battle !== null) {
        heartAtCheckpoint.push({
          tick: w.tick,
          area: areaId(a),
          ships: w.ships.filter((s) => s.at === hg.node).map((s) => `${s.type} ${s.hp}`),
          guards: { thorn: hg.guards.filter((x) => x.type === 'thorn').length, spore: hg.guards.filter((x) => x.type === 'spore').length },
        });
      }
    }
  }
  const area = (id: string): number => data.map.areas.findIndex((x) => x.id === id);
  const haul = (id: string): ResourceTriple => data.map.areas[area(id)]!.haul;
  const pct = data.tunables['areas.repeatHaulPct'].default;
  const limit0 = 4;
  const relayStep = data.tunables['fleet.relayStep'].default;

  it('reclaims Landfall, Glass Shoal, Glint Relay, Spore Veil and Spire Relay after the constructed Thorn Garden, then lands in The Deep and takes it', () => {
    expect(w.campaign.reclaimOrder.map(areaId)).toEqual(['garden', 'landfall', 'shoal', 'glint', 'veil', 'spire', 'deep']);
    expect(landings.map((l) => l.area)).toEqual(['landfall', 'shoal', 'shoal', 'glint', 'veil', 'spire', 'deep']);
    expect(areaId(w.campaign.active!)).toBe('deep');
    expect(activeAt3000).not.toBeNull();
    expect(w.campaign.totals.shipped.ore).toBeGreaterThan(0);
  });

  it('pays repeat hauls: Glint Relay after Glass Shoal and Spire Relay after Thorn Garden pay areas.repeatHaulPct; the others pay in full', () => {
    const paid = (id: string) => w.campaign.areas[area(id)]!.haulPaid;
    expect(paid('landfall')).toEqual(haul('landfall'));
    expect(paid('shoal')).toEqual(haul('shoal'));
    expect(paid('glint')).toEqual(decayedHaul(haul('glint'), pct));
    expect(paid('veil')).toEqual(haul('veil'));
    expect(paid('spire')).toEqual(decayedHaul(haul('spire'), pct));
    expect(paid('deep')).toEqual(haul('deep'));
    // The premise: the decay takes something off both relays.
    expect(paid('glint')).not.toEqual(haul('glint'));
    expect(paid('spire')).not.toEqual(haul('spire'));
    for (const res of RAW_RESOURCES) {
      const total = ['landfall', 'shoal', 'glint', 'veil', 'spire', 'deep'].reduce((s, id) => s + paid(id)![res], 0);
      expect(w.campaign.totals.hauled[res], res).toBe(total);
    }
  });

  it('refuses the Spore Veil landing by the band lock (lane-joined through Thorn Garden, band 2 not yet open), and lands there once Glint Relay is reclaimed', () => {
    expect(refusedLandings).toEqual([[272, 'veil', true, false]]);
    expect(landings.find((l) => l.area === 'veil')!.tick).toBeGreaterThan(w.campaign.areas[area('glint')]!.reclaimedTick!);
  });

  it('withdraws from Glass Shoal once; the second landing carries Opening ore 1, and the withdraw kept the research', () => {
    expect(w.campaign.areas[area('shoal')]).toMatchObject({ entries: 2, withdrawals: 1 });
    const opening = data.tunables['economy.startStock'].default + data.tunables['research.opening.step'].default;
    expect([landings[1]!.ore, landings[2]!.ore]).toEqual([opening, opening]);
    expect(landings[0]!.ore).toBe(data.tunables['economy.startStock'].default);
    expect(w.campaign.researchLog.map((r) => `${r.item} ${r.level}`)).toEqual(['opening 1', 'extract 1', 'rigs 1', 'yards 1']);
  });

  it('captures pockets and hearts in every area it plays', () => {
    expect(battles).toEqual([
      'landfall heart captured',
      'shoal p1 captured',
      'shoal heart captured',
      'glint p2 captured',
      'glint heart captured',
      'veil p1 captured',
      'veil p2 captured',
      'veil heart captured',
      'spire p2 captured',
      'spire heart captured',
      'deep p2 captured',
      'deep p1 captured',
      'deep heart captured',
    ]);
  });

  it('relays raise the limit from the next landing: 4, then 12 in band 2, then 20 in The Deep', () => {
    expect(landings.map((l) => [l.area, l.fleetCap])).toEqual([
      ['landfall', limit0],
      ['shoal', limit0],
      ['shoal', limit0],
      ['glint', limit0],
      ['veil', limit0 + relayStep],
      ['spire', limit0 + relayStep],
      ['deep', limit0 + 2 * relayStep],
    ]);
    // Every battle records the limit its wave was sent at; Glint's own capture is still at 4.
    expect(capAtSend).toEqual(battles.map((b) => {
      const id = b.split(' ')[0]!;
      const node = b.split(' ')[1]!;
      return `${id} ${node} ${id === 'deep' ? limit0 + 2 * relayStep : ['veil', 'spire'].includes(id) ? limit0 + relayStep : limit0}`;
    }));
  });

  it('a yard at the limit: the yards report fleetFull in Spore Veil and the count never passes 12; a recycle there frees slots', () => {
    expect(fullTicks['veil']).toBeGreaterThan(0);
    expect(maxCount['veil']).toBe(limit0 + relayStep);
    for (const [id, n] of Object.entries(maxCount)) {
      const cap = landings.find((l) => l.area === id)!.fleetCap!;
      expect(n, id).toBeLessThanOrEqual(cap);
    }
    const each = Math.floor((5 * data.tunables['fleet.recycleRefundPct'].default) / 100);
    expect(recycled[0]).toEqual({ area: 'veil', tick: 2522, drones: 3, ore: 3 * each, countBefore: limit0 + relayStep });
    // The Deep recycles every drone at p1 too (drone yard off), so lancers and flak fill its limit.
    expect(recycled.map((r) => [r.area, r.tick])).toEqual([
      ['veil', 2522],
      ['deep', 3872],
    ]);
    expect(recycled[1]!.ore).toBe(recycled[1]!.drones * each);
    expect(w.campaign.areas[area('veil')]).toMatchObject({ shipsRecycled: 3, oreRefunded: 3 * each });
    // The freed slots go to both component yards in Spore Veil (both designs, both prizes; the drone yard is off).
    expect(builtIn['veil']!.lancer).toBeGreaterThanOrEqual(1);
    expect(builtIn['veil']!.flak).toBeGreaterThanOrEqual(1);
  });

  it('lands in The Deep without a Root, with A1 rigged and Fast yards 1 on the drone build time', () => {
    const deep = landings[landings.length - 1]!;
    expect(deep.hasRoot).toBe(false);
    expect(deep.rigged).toEqual(['a1']);
    expect(deep.droneTicks).toBe(Math.max(15, Math.floor((30 * (100 - data.tunables['research.yards.stepPct'].default)) / 100)));
    expect(w.routes.find((r) => r.from === 1)?.level).toBe(2);
  });

  it('a mixed fight spans a checkpoint: lancers and flak at The Deep\'s heart against Thorns and Spores at tick 5400, after losses past the first ship', () => {
    const at5400 = heartAtCheckpoint.find((c) => c.tick === 5400)!;
    expect(at5400.area).toBe('deep');
    const types = new Set(at5400.ships.map((s) => s.split(' ')[0]));
    expect([...types].sort()).toEqual(['flak', 'lancer']);
    expect(at5400.guards.thorn).toBeGreaterThan(0);
    expect(at5400.guards.spore).toBeGreaterThan(0);
    // Some ships are wounded, not only dead or whole: hp is carried across the checkpoint.
    const full = data.tunables['ship.lancer.hp'].default;
    expect(at5400.ships.some((s) => Number(s.split(' ')[1]) < full)).toBe(true);
    // More than one ship lost in that battle: each round's damage spills past the first ship.
    // The heart's battle: lancers and flak only, both guard types at the start, and losses on both ship types, so
    // each guard pool found its own target type and spilled past single ships.
    const fight = w.guardians.find((g) => w.nodes[g.node]!.kind === 'heart')!.lastBattle!;
    expect(fight.startTick).toBeLessThan(5400);
    expect(fight.endTick).toBeGreaterThan(5400);
    expect(fight.engagedByType.drone).toBe(0);
    expect(fight.guardsAtStart.thorn > 0 && fight.guardsAtStart.spore > 0).toBe(true);
    expect(fight.lostByType.lancer).toBeGreaterThan(0);
    expect(fight.lostByType.flak).toBeGreaterThan(0);
    expect(fight.shipsLost).toBeGreaterThanOrEqual(2);
    // By the checkpoint, ships had already been lost.
    expect(at5400.ships.length).toBeLessThan(fight.engagedByType.lancer + fight.engagedByType.flak);
  });

  it('uses every input type, with exactly two inputs ignored on purpose: research inside an area, and the band-locked landing', () => {
    expect([...typesApplied].sort()).toEqual(
      ['buildExtractor', 'buildRoute', 'buyResearch', 'cancelBuild', 'enterArea', 'leaveArea', 'recycleShips', 'sendShips', 'setRally', 'setShipyard', 'setTunable', 'upgradeRoute'].sort(),
    );
    expect(ignored).toEqual([`0 ${JSON.stringify({ type: 'buyResearch', item: 2 })}`, `272 ${JSON.stringify({ type: 'enterArea', area: area('veil') })}`]);
  });
});
