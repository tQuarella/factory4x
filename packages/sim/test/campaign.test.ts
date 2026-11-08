import { describe, expect, it } from 'vitest';
import {
  SEND_ALL,
  areaStatus,
  campaignStatus,
  campaignSummary,
  campaignWorld,
  createWorld,
  defaultData,
  deserializeWorld,
  guardianAt,
  heartIndex,
  isAreaOpen,
  isValidInput,
  landingEffects,
  replayHashes,
  researchStatus,
  rootIndex,
  runSummary,
  serializeWorld,
  step,
  supplyStatus,
  worldHash,
  yardBuildTicks,
  yardStatus,
  type Input,
  type World,
} from '../src/index.ts';
import { fixtureData as data } from './fixture.ts';
import { DEEP_START, h3World } from './h3-world.ts';

/**
 * h4-sim acceptance 1 and 6: the campaign rules (DESIGN.md H4 "Area
 * lifecycle", "Stockpile and shipments", "Research", "Player inputs" and
 * "Rules per tick"), on the frozen fixture (startStock 30, opening step 40,
 * extraction +25%, yards −20%, costPct 100, shipments 100%; the spec's areas
 * and research).
 */

/** Area indices in data order. */
const A = { landfall: 0, shelf: 1, shoal: 2, veil: 3, garden: 4, deep: 5 } as const;
/** Research item indices in data order. */
const R = { lancer: 0, flak: 1, opening: 2, extract: 3, rigs: 4, yards: 5, core: 6 } as const;
const T = 1800; // ticks per game minute

/** The node index of a frame id in the active area. */
function at(w: World, id: string): number {
  const i = w.nodes.findIndex((n) => n.id === id);
  if (i < 0) throw new Error(`no node ${id} in this area`);
  return i;
}

function tick(w: World, ...inputs: Input[]): void {
  step(w, data, inputs);
}

function run(w: World, n: number): void {
  for (let i = 0; i < n; i++) step(w, data, []);
}

/** Parks `n` drones at `node` (test setup). */
function drones(w: World, node: number, n: number): void {
  for (let i = 0; i < n; i++) w.ships.push({ id: w.nextId++, type: 'drone', hp: w.tun['ship.drone.hp'], at: node, transit: null, engagedIn: -1 });
}

/** Lands in `area` from the overworld by input, and checks it took. */
function land(w: World, area: number): void {
  tick(w, { type: 'enterArea', area });
  expect(w.campaign.active).toBe(area);
}

/** Captures the active area's heart with a drone swarm (test setup) and steps until it falls. */
function reclaim(w: World): void {
  drones(w, heartIndex(w), 200);
  for (let i = 0; i < 3000 && w.capturedTick === null; i++) run(w, 1);
  expect(w.capturedTick).not.toBeNull();
}

describe('the overworld at the start, and lanes opening areas', () => {
  it('createWorld is on the overworld with nothing reclaimed; only Landfall is open', () => {
    const w = createWorld(1, data);
    expect(w.campaign.active).toBeNull();
    expect([w.nodes, w.guardians, w.ships, w.routes]).toEqual([[], [], [], []]);
    expect(w.stock).toEqual({ ore: 0, ice: 0, crystal: 0, lens: 0, plating: 0 });
    expect(w.campaign.stockpile).toEqual({ ore: 0, ice: 0, crystal: 0 });
    expect(Object.values(w.campaign.research)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(data.map.areas.map((_, a) => areaStatus(w, data, a).state)).toEqual(['open', 'locked', 'locked', 'locked', 'locked', 'locked']);
  });

  it('each reclaim opens the held areas lane-joined to it; reclaimed areas are not open again', () => {
    const open = (w: World): string[] => data.map.areas.filter((_, a) => isAreaOpen(w, data, a)).map((a) => a.id);
    expect(open(campaignWorld(1, data, { reclaimed: ['landfall'] }))).toEqual(['shelf', 'shoal']);
    expect(open(campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'] }))).toEqual(['shoal', 'veil']);
    expect(open(campaignWorld(1, data, { reclaimed: ['landfall', 'shoal'] }))).toEqual(['shelf', 'garden']);
    // Either medium opens the other and The Deep.
    expect(open(campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'veil'] }))).toEqual(['shoal', 'garden', 'deep']);
    expect(open(campaignWorld(1, data, { reclaimed: ['landfall', 'shoal', 'garden'] }))).toEqual(['shelf', 'veil', 'deep']);
    expect(open(campaignWorld(1, data, { reclaimed: data.map.areas.map((a) => a.id) }))).toEqual([]);
  });

  it('reclaiming Landfall by play opens Frost Shelf and Glass Shoal', () => {
    const w = createWorld(1, data);
    land(w, A.landfall);
    reclaim(w);
    tick(w, { type: 'leaveArea' });
    expect(data.map.areas.map((_, a) => areaStatus(w, data, a).state)).toEqual(['reclaimed', 'open', 'open', 'locked', 'locked', 'locked']);
  });
});

describe('input validity', () => {
  it('enterArea: on the overworld, open areas only, a valid index, not while in an area', () => {
    const w = createWorld(1, data);
    for (const area of [A.shelf, A.deep, -1, 6, 0.5]) expect(isValidInput(w, data, { type: 'enterArea', area }), String(area)).toBe(false);
    expect(isValidInput(w, data, { type: 'enterArea', area: A.landfall })).toBe(true);
    land(w, A.landfall);
    expect(isValidInput(w, data, { type: 'enterArea', area: A.landfall })).toBe(false);
  });

  it('leaveArea: only while an area is active', () => {
    const w = createWorld(1, data);
    expect(isValidInput(w, data, { type: 'leaveArea' })).toBe(false);
    land(w, A.landfall);
    expect(isValidInput(w, data, { type: 'leaveArea' })).toBe(true);
  });

  it('buyResearch: overworld only (no research inside an area), below max, requirements met, affordable', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'], stockpile: { ore: 1000, ice: 1000, crystal: 1000 } });
    const buy = (item: number): Input => ({ type: 'buyResearch', item });
    expect(isValidInput(w, data, buy(R.opening))).toBe(true);
    for (const item of [-1, 7, 1.5]) expect(isValidInput(w, data, buy(item)), String(item)).toBe(false);
    // Seed rigs needs Extraction 1.
    expect(isValidInput(w, data, buy(R.rigs))).toBe(false);
    tick(w, buy(R.extract));
    expect(isValidInput(w, data, buy(R.rigs))).toBe(true);
    // Max level.
    tick(w, buy(R.lancer));
    expect(w.campaign.research.lancer).toBe(1);
    expect(isValidInput(w, data, buy(R.lancer))).toBe(false);
    // Not affordable.
    const poor = campaignWorld(1, data, { stockpile: { ore: 49 } });
    expect(isValidInput(poor, data, buy(R.opening))).toBe(false);
    poor.campaign.stockpile.ore = 50;
    expect(isValidInput(poor, data, buy(R.opening))).toBe(true);
    // Inside an area: never, even when affordable.
    land(w, A.shelf);
    expect(isValidInput(w, data, buy(R.opening))).toBe(false);
    const before = { ...w.campaign.stockpile };
    tick(w, buy(R.opening));
    expect(w.campaign.stockpile).toEqual(before);
    expect(w.campaign.research.opening).toBe(0);
  });

  it('the area inputs are valid only while an area is active; setTunable always', () => {
    const w = createWorld(1, data);
    const area: Input[] = [
      { type: 'buildExtractor', node: 1 },
      { type: 'buildRoute', from: 1, to: 0 },
      { type: 'upgradeRoute', from: 1 },
      { type: 'cancelBuild', index: 0 },
      { type: 'setShipyard', shipType: 'drone', on: true },
      { type: 'sendShips', from: 0, to: 1, counts: SEND_ALL },
      { type: 'setRally', node: 0 },
    ];
    for (const input of area) expect(isValidInput(w, data, input), input.type).toBe(false);
    expect(isValidInput(w, data, { type: 'setTunable', key: 'guard.capPct', value: 50 })).toBe(true);
    land(w, A.landfall);
    expect(isValidInput(w, data, { type: 'buildExtractor', node: 1 })).toBe(true);
    expect(isValidInput(w, data, { type: 'setShipyard', shipType: 'lancer', on: true })).toBe(true);
    expect(isValidInput(w, data, { type: 'setRally', node: 0 })).toBe(true);
  });

  it('nothing but setTunable after the win', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'], research: { lancer: 1, flak: 1 }, stockpile: { ore: 9999, ice: 999, crystal: 999 } });
    w.campaign.wonTick = 0;
    for (const input of [{ type: 'enterArea', area: A.shelf }, { type: 'buyResearch', item: R.opening }, { type: 'leaveArea' }] as Input[]) {
      expect(isValidInput(w, data, input), input.type).toBe(false);
    }
    expect(isValidInput(w, data, { type: 'setTunable', key: 'guard.capPct', value: 50 })).toBe(true);
    tick(w, { type: 'enterArea', area: A.shelf }, { type: 'setTunable', key: 'guard.capPct', value: 50 });
    expect(w.campaign.active).toBeNull();
    expect(w.tun['guard.capPct']).toBe(50);
  });
});

describe('landing (enterArea)', () => {
  it('builds the area fresh: its nodes in frame order (probe 0), full guardians, opening stock, drone yard on, rally at the probe', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'] });
    run(w, 7);
    land(w, A.shelf);
    expect(w.nodes.map((n) => n.id)).toEqual(['probe', 'a1', 'a2', 'a3', 'a5', 'p1', 'heart']);
    expect(w.nodes.map((n) => n.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(w.nodes[at(w, 'p1')]).toMatchObject({ kind: 'pocket', prize: 'ice', slots: 2 });
    expect(w.guardians.map((g) => [w.nodes[g.node]!.id, g.guards.length])).toEqual([
      ['p1', 4],
      ['heart', 12],
    ]);
    expect(w.campaign.areaStartTick).toBe(7);
    expect(w.campaign.areas[A.shelf]!.entries).toBe(1);
    expect(w.rally).toBe(0);
    // Rules ran on the landing tick: the drone yard already paid for its first drone from the 30 opening ore.
    expect(w.stock.ore + w.stats.oreSpentShips).toBe(30);
    expect(w.yards.drone.ticksLeft).toBe(90);
    expect([w.yards.drone.on, w.yards.lancer.on, w.yards.flak.on]).toEqual([true, false, false]);
  });

  it('opening ore: economy.startStock (live) + level × research.opening.step', () => {
    for (const [level, startStock, step_, ore] of [
      [0, 30, 40, 30],
      [1, 30, 40, 70],
      [3, 30, 40, 150],
      [2, 0, 150, 300],
      [1, 200, 10, 210],
    ] as const) {
      const w = campaignWorld(1, data, { research: { opening: level } });
      tick(w, { type: 'setTunable', key: 'economy.startStock', value: startStock }, { type: 'setTunable', key: 'research.opening.step', value: step_ });
      // Ore at the landing (the drone yard may pay for a drone on the landing tick; probe mining adds under a unit a tick).
      tick(w, { type: 'enterArea', area: A.landfall });
      expect(w.stock.ore + w.stats.oreSpentShips, `level ${level}`).toBe(ore);
      expect(landingEffects(w).openingOre).toBe(ore);
    }
  });

  it('seed rigs: level L lands with the first L of a1, a2 owned, 1 extractor and a level-1 route each, free', () => {
    for (const level of [0, 1, 2]) {
      const w = campaignWorld(1, data, { research: { extract: 1, rigs: level } });
      land(w, A.landfall);
      const rigged = w.nodes.filter((n) => n.kind === 'asteroid' && n.owned).map((n) => n.id);
      expect(rigged, `rigs ${level}`).toEqual(['a1', 'a2'].slice(0, level));
      for (const id of rigged) {
        expect(w.nodes[at(w, id)]!.extractors).toBe(1);
        expect(w.routes.find((r) => r.from === at(w, id))).toMatchObject({ to: 0, level: 1 });
      }
      expect(w.routes.length).toBe(level);
      expect(w.stock.ore + w.stats.oreSpentShips + w.stats.oreSpentEconomy).toBe(30);
      expect(w.queue).toEqual([]);
      expect(landingEffects(w).rigNodes).toEqual(rigged);
    }
  });

  it('yards: drones on; lancer and flak on exactly when their design is researched', () => {
    for (const [lancer, flak] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      const w = campaignWorld(1, data, { research: { lancer, flak } });
      land(w, A.landfall);
      expect([w.yards.drone.on, w.yards.lancer.on, w.yards.flak.on]).toEqual([true, lancer === 1, flak === 1]);
      expect(landingEffects(w).designs).toEqual({ lancer: lancer === 1, flak: flak === 1 });
    }
  });

  it('The Deep is the whole field with the run layout, exactly as an H3 game (same nodes, guardians and guard ids)', () => {
    for (const seed of [0, 1, 2]) {
      const w = h3World(seed);
      expect(w.campaign.active).toBe(A.deep);
      expect(w.nodes.map((n) => n.id)).toEqual(data.map.nodes.map((n) => n.id));
      expect(w.system.variant).toBe(seed);
      expect(w.campaign.deepLayout).toBe(seed);
      expect(w.guardians.map((g) => g.node)).toEqual([10, 11, 12, 13, 14, 15]);
      const ids = w.guardians.flatMap((g) => g.guards.map((x) => x.id));
      expect(ids[0]).toBe(1);
      expect(ids).toEqual(ids.map((_, i) => i + 1));
      expect(w.tick).toBe(0);
    }
    // Landing in The Deep by input gives the same area as campaignWorld's `land`.
    const byInput = campaignWorld(2, data, { reclaimed: DEEP_START.reclaimed! });
    tick(byInput, { type: 'enterArea', area: A.deep });
    const direct = campaignWorld(2, data, { reclaimed: DEEP_START.reclaimed!, land: 'deep' });
    expect(byInput.guardians.map((g) => g.counts)).toEqual(direct.guardians.map((g) => g.counts));
    expect(byInput.nodes.map((n) => [n.id, n.prize, n.slots])).toEqual(direct.nodes.map((n) => [n.id, n.prize, n.slots]));
  });
});

describe('research effects in an area', () => {
  /** A rig-free area with every yard off and no probe mining, with one extractor at `id`. */
  function extracting(level: number, id: string): World {
    const w = campaignWorld(1, data, { research: { extract: level }, reclaimed: ['landfall'], land: 'shelf' });
    w.tun['economy.probeOrePerMin'] = 0;
    w.yards.drone.on = false;
    w.nodes[at(w, id)]!.extractors = 1;
    return w;
  }

  it('extraction is exact over a minute: extractors × perMin × (100 + level × stepPct) / 100, remainder carried', () => {
    // Asteroid 10/min: 10, 12.5, 15, 17.5.
    expect([0, 1, 2, 3].map((level) => {
      const w = extracting(level, 'a1');
      run(w, T);
      return w.nodes[at(w, 'a1')]!.buffer;
    })).toEqual([10, 12, 15, 17]);
    // The half unit is carried: the second minute at level 1 brings the total to 25.
    const w = extracting(1, 'a1');
    run(w, 2 * T);
    expect(w.nodes[at(w, 'a1')]!.buffer).toBe(25);
    // Non-default stepPct (10 and 50) and a captured pocket (6/min): 6 × 150% = 9 a minute at level 1 with 50%.
    const p = extracting(1, 'a1');
    p.tun['research.extract.stepPct'] = 50;
    p.guardians[0]!.alive = false;
    p.nodes[at(p, 'p1')]!.extractors = 1;
    run(p, T);
    expect([p.nodes[at(p, 'a1')]!.buffer, p.nodes[at(p, 'p1')]!.buffer]).toEqual([15, 9]);
    const q = extracting(2, 'a1');
    q.tun['research.extract.stepPct'] = 10;
    run(q, T);
    expect(q.nodes[at(q, 'a1')]!.buffer).toBe(12);
  });

  it('extraction does not boost probe mining', () => {
    const w = campaignWorld(1, data, { research: { extract: 3 }, land: 'landfall' });
    w.yards.drone.on = false;
    const ore = w.stock.ore;
    run(w, T);
    expect(w.stock.ore - ore).toBe(12);
  });

  it('fast yards: max(15, floor(buildTicks × (100 − level × stepPct) / 100)), both sides of the floor and the equal case', () => {
    const w = campaignWorld(1, data, { research: { yards: 0 } });
    const ticksAt = (level: number, buildTicks: number, stepPct = 20): number => {
      w.campaign.research.yards = level;
      w.tun['ship.drone.buildTicks'] = buildTicks;
      w.tun['research.yards.stepPct'] = stepPct;
      return yardBuildTicks(w, 'drone');
    };
    expect(ticksAt(0, 90)).toBe(90);
    expect(ticksAt(1, 90)).toBe(72);
    expect(ticksAt(2, 90)).toBe(54);
    expect(ticksAt(2, 90, 40)).toBe(18);
    expect(ticksAt(1, 18)).toBe(15); // floor(14.4) = 14 → 15
    expect(ticksAt(1, 19)).toBe(15); // floor(15.2) = 15, equal to the floor
    expect(ticksAt(1, 20)).toBe(16); // above the floor
    expect(ticksAt(2, 15, 40)).toBe(15);
  });

  it('a started build takes the Fast-yards time (rule 5b), and the yard row shows it', () => {
    const w = campaignWorld(1, data, { research: { yards: 2 }, land: 'landfall' });
    tick(w);
    // Drone yard on with 30 ore: the first build starts on the first tick, at 90 × 60% = 54 ticks.
    expect(w.yards.drone.ticksLeft).toBe(54);
    expect(yardStatus(w).yards[0]!.totalTicks).toBe(54);
    run(w, 53);
    expect(w.stats.shipsBuilt.drone).toBe(0);
    run(w, 1);
    expect(w.stats.shipsBuilt.drone).toBe(1);
  });

  it('design gate: a lancer or flak yard starts only once its design is researched; the row says needsDesign, then noSource', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'], land: 'shelf' });
    w.yards.drone.on = false;
    w.yards.lancer.on = true;
    w.yards.flak.on = true;
    w.stock = { ore: 100, ice: 0, crystal: 0, lens: 2, plating: 2 };
    w.tun['economy.probeOrePerMin'] = 0;
    expect(yardStatus(w).yards.map((y) => [y.type, y.researched, y.state])).toEqual([
      ['drone', true, 'off'],
      ['lancer', false, 'needsDesign'],
      ['flak', false, 'needsDesign'],
    ]);
    run(w, 5);
    expect([w.yards.lancer.ticksLeft, w.yards.flak.ticksLeft, w.stock.ore]).toEqual([0, 0, 100]);
    // Researched: they start.
    w.campaign.research.lancer = 1;
    w.campaign.research.flak = 1;
    run(w, 1);
    expect([w.yards.lancer.ticksLeft > 0, w.yards.flak.ticksLeft > 0]).toEqual([true, true]);
    // Frost Shelf has ice (plating) but no crystal (lens): once the lenses run out the lancer row says noSource.
    w.stock = { ore: 100, ice: 0, crystal: 0, lens: 0, plating: 0 };
    w.yards.lancer.ticksLeft = 0;
    w.yards.flak.ticksLeft = 0;
    expect(yardStatus(w).yards.map((y) => y.state)).toEqual(['off', 'noSource', 'needsComponent']);
    // noSource and needsDesign come before off.
    w.yards.lancer.on = false;
    w.campaign.research.flak = 0;
    expect(yardStatus(w).yards.map((y) => y.state)).toEqual(['off', 'noSource', 'needsDesign']);
  });
});

describe('withdraw and reclaim', () => {
  it('a withdraw resets the area and keeps research and the stockpile; re-landing starts fresh', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'], research: { opening: 1 }, stockpile: { ore: 77, ice: 3, crystal: 0 } });
    land(w, A.shelf);
    tick(w, { type: 'buildExtractor', node: at(w, 'a1') }, { type: 'setRally', node: at(w, 'a5') });
    run(w, 400);
    drones(w, at(w, 'p1'), 5);
    run(w, 31);
    expect(w.nodes[at(w, 'a1')]!.extractors).toBe(1);
    expect(guardianAt(w, at(w, 'p1'))!.battle).not.toBeNull();
    const research = { ...w.campaign.research };
    const stockpile = { ...w.campaign.stockpile };
    const ticksIn = w.tick - w.campaign.areaStartTick;
    tick(w, { type: 'leaveArea' });
    expect(w.campaign.active).toBeNull();
    expect([w.nodes, w.guardians, w.ships, w.routes, w.queue]).toEqual([[], [], [], [], []]);
    expect(w.stock).toEqual({ ore: 0, ice: 0, crystal: 0, lens: 0, plating: 0 });
    expect(w.campaign.research).toEqual(research);
    // No shipments on the overworld, and none paid by the withdraw itself. (Landfall shipped while Frost Shelf was played.)
    expect(w.campaign.stockpile).toEqual(stockpile);
    expect(w.campaign.areas[A.shelf]).toMatchObject({ reclaimedTick: null, entries: 1, withdrawals: 1, playTicks: ticksIn, reclaimPlayTicks: null });
    expect(isAreaOpen(w, data, A.shelf)).toBe(true);
    land(w, A.shelf);
    expect(w.nodes[at(w, 'a1')]!.extractors).toBe(0);
    expect(guardianAt(w, at(w, 'p1'))!.guards.map((g) => g.hp)).toEqual([6, 6, 6, 6]);
    expect(guardianAt(w, at(w, 'p1'))!.battle).toBeNull();
    expect(w.stock.ore + w.stats.oreSpentShips).toBe(70);
    expect(w.campaign.areas[A.shelf]).toMatchObject({ entries: 2, withdrawals: 1 });
  });

  it('a reclaim pays the haul once, records the visit, and stops shipments; leaving after it is not a withdraw', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'] });
    run(w, 30);
    land(w, A.shelf);
    reclaim(w);
    const c = w.campaign;
    const shipped = { ...c.totals.shipped };
    expect(c.areas[A.shelf]!.reclaimedTick).toBe(w.capturedTick);
    expect(c.areas[A.shelf]!.reclaimPlayTicks).toBe(w.capturedTick! - 30);
    expect(c.reclaimOrder).toEqual([A.landfall, A.shelf]);
    expect(c.totals.hauled).toEqual({ ore: 150, ice: 80, crystal: 0 });
    expect(c.stockpile).toEqual({ ore: 150 + shipped.ore, ice: 80 + shipped.ice, crystal: 0 });
    // Free play after the reclaim: no second haul, no shipments.
    run(w, 3 * T);
    expect(c.totals.hauled).toEqual({ ore: 150, ice: 80, crystal: 0 });
    expect(c.totals.shipped).toEqual(shipped);
    expect(campaignStatus(w, data).shipping).toBe(false);
    tick(w, { type: 'leaveArea' });
    expect(c.areas[A.shelf]).toMatchObject({ entries: 1, withdrawals: 0, playTicks: c.areas[A.shelf]!.reclaimPlayTicks });
    expect(c.stockpile.ore).toBe(150 + shipped.ore);
    expect(isAreaOpen(w, data, A.shelf)).toBe(false);
  });

  it("Landfall's empty heart falls to the first ship that arrives (by play: one drone)", () => {
    const w = createWorld(1, data);
    land(w, A.landfall);
    const heart = heartIndex(w);
    expect(guardianAt(w, heart)!.guards).toEqual([]);
    for (let i = 0; i < 400 && w.ships.length === 0; i++) run(w, 1);
    expect(w.ships.length).toBe(1);
    tick(w, { type: 'sendShips', from: 0, to: heart, counts: SEND_ALL });
    for (let i = 0; i < 400 && w.capturedTick === null; i++) run(w, 1);
    expect(w.capturedTick).not.toBeNull();
    expect(w.lastBattle).toMatchObject({ node: heart, outcome: 'captured', shipsEngaged: 1, guardsKilled: 0, shipsLost: 0 });
    expect(w.campaign.stockpile).toEqual({ ore: 150, ice: 0, crystal: 0 });
    // A ship arrival takes ceil(dist / speed) ticks: Landfall is a landing beat of well under a minute.
    expect(w.capturedTick! - w.campaign.areaStartTick).toBeLessThan(T);
  });

  it('a heart with no Root is fed for good and never starves; supplyStatus and runSummary say so', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'], land: 'shelf' });
    const g = guardianAt(w, heartIndex(w))!;
    expect([g.fed, g.starvedCounts, rootIndex(w)]).toEqual([true, null, -1]);
    expect(supplyStatus(w)).toMatchObject({ hasRoot: false, rootNode: -1, rootAlive: false, fed: true });
    // Damage it and let it regrow over minutes: always fed, back to its full caps (2 Thorns 10 Spores).
    g.guards = g.guards.slice(0, 3);
    run(w, 3 * T);
    expect(g.fed).toBe(true);
    expect(g.guards.length).toBe(12);
    expect(runSummary(w)).toMatchObject({ rootWavesSent: 0, rootShipsLost: 0, rootCutTick: null });
  });
});

describe('shipments (rule 10)', () => {
  it('accrue exactly: Σ export × shipments.pct per minute, integer, remainder carried', () => {
    // Landfall 4 ore and Frost Shelf 3 ore + 2 ice per minute, while Glass Shoal is played.
    const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'], land: 'shoal' });
    run(w, T);
    expect(w.campaign.stockpile).toEqual({ ore: 7, ice: 2, crystal: 0 });
    expect(w.campaign.shipAccum).toEqual({ ore: 0, ice: 0, crystal: 0 });
    expect(w.campaign.totals.shipped).toEqual({ ore: 7, ice: 2, crystal: 0 });
    expect(campaignStatus(w, data).shipPerMinX10).toEqual({ ore: 70, ice: 20, crystal: 0 });
    // 150%: 10.5 ore and 3 ice a minute; the half unit carries.
    const h = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'], land: 'shoal' });
    h.tun['shipments.pct'] = 150;
    run(h, T);
    expect(h.campaign.stockpile).toEqual({ ore: 10, ice: 3, crystal: 0 });
    expect(h.campaign.shipAccum.ore).toBe(T * 50);
    run(h, T);
    expect(h.campaign.stockpile.ore).toBe(21);
    expect(campaignStatus(h, data).shipPerMinX10.ore).toBe(105);
    // 0: off.
    const z = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'], land: 'shoal' });
    z.tun['shipments.pct'] = 0;
    run(z, 2 * T);
    expect(z.campaign.stockpile).toEqual({ ore: 0, ice: 0, crystal: 0 });
  });

  it('a unit ships on the exact tick its accumulator reaches ticksPerMin × 100', () => {
    // Landfall alone ships 4 ore a minute: one every 450 ticks.
    const w = campaignWorld(1, data, { reclaimed: ['landfall'], land: 'shelf' });
    run(w, 449);
    expect(w.campaign.stockpile.ore).toBe(0);
    run(w, 1);
    expect(w.campaign.stockpile.ore).toBe(1);
  });

  it('never on the overworld, only while a held area is active, and not after its heart falls', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'] });
    run(w, 3 * T);
    expect(w.campaign.stockpile).toEqual({ ore: 0, ice: 0, crystal: 0 });
    expect(w.tick).toBe(3 * T);
    expect(campaignStatus(w, data).shipping).toBe(false);
    land(w, A.shoal);
    expect(campaignStatus(w, data).shipping).toBe(true);
    reclaim(w);
    const s = { ...w.campaign.totals.shipped };
    run(w, T);
    expect(w.campaign.totals.shipped).toEqual(s);
  });
});

describe('research purchases', () => {
  it('pays floor(cost × research.costPct / 100) per resource, one level at a time, and logs it', () => {
    const w = campaignWorld(1, data, { stockpile: { ore: 500, ice: 100, crystal: 100 } });
    tick(w, { type: 'setTunable', key: 'research.costPct', value: 33 });
    // Lancer 60 ore 40 crystal at 33%: 19.8 → 19 and 13.2 → 13.
    expect(researchStatus(w, data)[R.lancer]!.cost).toEqual({ ore: 19, ice: 0, crystal: 13 });
    tick(w, { type: 'buyResearch', item: R.lancer });
    expect(w.campaign.stockpile).toEqual({ ore: 481, ice: 100, crystal: 87 });
    // Opening 1 at 25%: 12.5 → 12; level 2 at 100%: 100.
    w.tun['research.costPct'] = 25;
    tick(w, { type: 'buyResearch', item: R.opening });
    expect(w.campaign.stockpile.ore).toBe(469);
    w.tun['research.costPct'] = 100;
    expect(researchStatus(w, data)[R.opening]!.cost).toEqual({ ore: 100, ice: 0, crystal: 0 });
    tick(w, { type: 'buyResearch', item: R.opening });
    expect(w.campaign.stockpile.ore).toBe(369);
    expect(w.campaign.research.opening).toBe(2);
    expect(w.campaign.researchLog).toEqual([
      { item: 'lancer', level: 1, tick: 1 },
      { item: 'opening', level: 1, tick: 2 },
      { item: 'opening', level: 2, tick: 3 },
    ]);
  });

  it('the probe core needs both designs and The Deep reclaimed; buying it sets wonTick', () => {
    const rich = { ore: 2000, ice: 500, crystal: 500 };
    const core = (w: World) => researchStatus(w, data)[R.core]!;
    const w = campaignWorld(1, data, { reclaimed: ['landfall'], stockpile: rich });
    expect(core(w).missing).toMatchObject({ items: [{ id: 'lancer', level: 1 }, { id: 'flak', level: 1 }], areas: ['deep'] });
    expect(core(w).canBuy).toBe(false);
    tick(w, { type: 'buyResearch', item: R.lancer }, { type: 'buyResearch', item: R.flak });
    expect(core(w).missing).toMatchObject({ items: [], areas: ['deep'] });
    expect(isValidInput(w, data, { type: 'buyResearch', item: R.core })).toBe(false);
    const d = campaignWorld(1, data, { reclaimed: [...DEEP_START.reclaimed!, 'deep'], research: { lancer: 1 }, stockpile: rich });
    expect(core(d).missing.items).toEqual([{ id: 'flak', level: 1 }]);
    d.campaign.research.flak = 1;
    expect(core(d).canBuy).toBe(true);
    tick(d, { type: 'buyResearch', item: R.core });
    expect(d.campaign.wonTick).toBe(0);
    expect(d.campaign.stockpile).toEqual({ ore: 1600, ice: 380, crystal: 380 });
    expect(campaignSummary(d, data)).toMatchObject({ won: true, wonTick: 0 });
    // After the win the overworld still steps (inputs only), and nothing is valid but setTunable.
    tick(d, { type: 'enterArea', area: A.landfall });
    expect(d.campaign.active).toBeNull();
    expect(d.tick).toBe(2);
  });
});

describe('the overworld is paused: rule 1 only', () => {
  it('stepping with no area active changes nothing but the tick (and applied inputs)', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'], stockpile: { ore: 100 } });
    const before = JSON.parse(JSON.stringify(w)) as World;
    run(w, 5000);
    expect({ ...w, tick: 0 }).toEqual({ ...before, tick: 0 });
    expect(w.tick).toBe(5000);
  });
});

describe('campaign selectors', () => {
  it('areaStatus: state, lanes, haul and export, guarded caps and heart tags with the researched flag', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'], research: { flak: 1 } });
    const veil = areaStatus(w, data, A.veil);
    expect(veil).toMatchObject({ id: 'veil', name: 'Spore Veil', tier: 2, x: 220, y: 520, state: 'open', lanes: [A.shelf, A.garden, A.deep], hasRoot: true });
    expect(veil.guarded.map((g) => [g.id, g.prize, g.caps.thorn, g.caps.spore])).toEqual([
      ['p1', 'ice', 2, 6],
      ['p2', 'crystal', 2, 6],
      ['root', null, 0, 12],
      ['heart', 'ore', 3, 30],
    ]);
    expect(veil.guarded[3]!.starvedCaps).toEqual({ thorn: 1, spore: 15 });
    expect(veil.heartTags.flak).toMatchObject({ tag: 'strong', researched: true });
    expect(veil.heartTags.lancer).toMatchObject({ tag: 'weak', researched: false });
    // Caps follow guard.capPct live.
    w.tun['guard.capPct'] = 50;
    expect(areaStatus(w, data, A.veil).guarded[3]!.caps).toEqual({ thorn: 1, spore: 15 });
    expect(areaStatus(w, data, A.landfall).state).toBe('reclaimed');
    expect(areaStatus(w, data, A.garden).state).toBe('locked');
    land(w, A.veil);
    expect(areaStatus(w, data, A.veil).state).toBe('active');
    // The Deep's guarded nodes come from the run's H3 layout (seed 1: Glass Thicket, heart 14 Thorns 8 Spores).
    const deep = areaStatus(w, data, A.deep);
    expect(deep.guarded.map((g) => g.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'root', 'heart']);
    w.tun['guard.capPct'] = 100;
    expect(areaStatus(w, data, A.deep).guarded[5]!.caps).toEqual({ thorn: 14, spore: 8 });
  });

  it('researchStatus: levels, effects now and next, and why a purchase is blocked', () => {
    const w = campaignWorld(1, data, { research: { extract: 1, yards: 2 }, stockpile: { ore: 70, ice: 0, crystal: 10 } });
    const rows = researchStatus(w, data);
    expect(rows.map((r) => [r.id, r.level, r.maxLevel, r.effect, r.nextEffect])).toEqual([
      ['lancer', 0, 1, 0, 1],
      ['flak', 0, 1, 0, 1],
      ['opening', 0, 3, 30, 70],
      ['extract', 1, 3, 125, 150],
      ['rigs', 0, 2, 0, 1],
      ['yards', 2, 2, 60, null],
      ['core', 0, 1, 0, 1],
    ]);
    expect(rows[R.lancer]).toMatchObject({ affordable: false, canBuy: false, missing: { resources: { ore: 0, ice: 0, crystal: 30 }, items: [], areas: [] } });
    expect(rows[R.opening]).toMatchObject({ affordable: true, canBuy: true });
    expect(rows[R.yards]).toMatchObject({ cost: null, affordable: false, canBuy: false });
    expect(rows[R.rigs]).toMatchObject({ affordable: false, canBuy: false, missing: { resources: { ore: 30, ice: 0, crystal: 0 }, items: [] } });
    // Effects follow live tunables (non-default values inside the spec ranges).
    w.tun['economy.startStock'] = 0;
    w.tun['research.opening.step'] = 150;
    w.tun['research.extract.stepPct'] = 50;
    w.tun['research.yards.stepPct'] = 40;
    expect(researchStatus(w, data).map((r) => [r.id, r.effect, r.nextEffect]).slice(R.opening, R.core)).toEqual([
      ['opening', 0, 150],
      ['extract', 150, 200],
      ['rigs', 0, 1],
      ['yards', 20, null],
    ]);
    expect(landingEffects(w)).toEqual({ openingOre: 0, rigNodes: [], extractPct: 150, yardTimePct: 20, designs: { lancer: false, flak: false } });
    const noExtract = researchStatus(campaignWorld(1, data, { stockpile: { ore: 500 } }), data)[R.rigs]!;
    expect(noExtract).toMatchObject({ affordable: true, canBuy: false, missing: { items: [{ id: 'extract', level: 1 }] } });
  });

  it('campaignSummary and runSummary: reclaim order, research order, play ticks, and area-relative seconds', () => {
    const w = createWorld(1, data);
    run(w, 90);
    land(w, A.landfall);
    reclaim(w);
    const sec = Math.floor((w.capturedTick! - 90) / 30);
    expect(runSummary(w)).toMatchObject({ areaStartTick: 90, captureSec: sec });
    expect(runSummary(w).captures.map((c) => c.sec)).toEqual([sec]);
    tick(w, { type: 'leaveArea' });
    tick(w, { type: 'buyResearch', item: R.opening });
    land(w, A.shelf);
    run(w, 100);
    tick(w, { type: 'leaveArea' });
    const s = campaignSummary(w, data);
    expect(s.reclaimOrder.map((r) => [r.id, r.reclaimPlayTicks])).toEqual([['landfall', w.campaign.areas[A.landfall]!.reclaimPlayTicks]]);
    expect(s.research.map((r) => [r.item, r.name, r.level])).toEqual([['opening', 'Opening ore', 1]]);
    // The landing tick plus 100: the leave applies before the next tick's rules.
    expect(s.areas[A.shelf]).toMatchObject({ entries: 1, withdrawals: 1, playTicks: 101 });
    expect(s.totalPlayTicks).toBe(w.campaign.areas[A.landfall]!.playTicks + 101);
    expect(s.hauled).toEqual({ ore: 150, ice: 0, crystal: 0 });
    expect(s.shipsBuilt).toBeGreaterThanOrEqual(1);
  });
});

describe('save and replay with a campaign', () => {
  it('serialize round trip keeps the campaign, on the overworld and in an area, and both copies stay in lockstep', () => {
    const w = campaignWorld(3, data, { reclaimed: ['landfall'], research: { opening: 2, extract: 1 }, stockpile: { ore: 12, ice: 3, crystal: 4 } });
    for (const phase of ['overworld', 'area'] as const) {
      if (phase === 'area') {
        land(w, A.shoal);
        run(w, 700);
      }
      const r = deserializeWorld(serializeWorld(w), data);
      expect(r.ok, phase).toBe(true);
      if (!r.ok) return;
      expect(r.world.campaign).toEqual(w.campaign);
      expect(worldHash(r.world)).toBe(worldHash(w));
      run(r.world, 900);
      run(w, 900);
      expect(worldHash(r.world)).toBe(worldHash(w));
    }
  });

  it('the campaign stays small in a save: under 2 KB at its largest (every area recorded, every research level logged)', () => {
    // DECISIONS.md h4-sim: the spec's field list measures about 1.7 KB at worst, over the spec's "under 1 KB" aim; this pins growth.
    const w = campaignWorld(1, data, { land: 'landfall' });
    const c = w.campaign;
    c.areas.forEach((a) => Object.assign(a, { reclaimedTick: 123456, entries: 3, withdrawals: 2, playTicks: 123456, reclaimPlayTicks: 23456, shipsBuilt: 123, shipsLost: 99 }));
    c.reclaimOrder = [0, 1, 2, 3, 4, 5];
    for (const it of data.research) it.levels.forEach((_, k) => c.researchLog.push({ item: it.id, level: k + 1, tick: 123456 }));
    c.stockpile = { ore: 1234, ice: 123, crystal: 123 };
    c.shipAccum = { ore: 9999999, ice: 9999999, crystal: 9999999 };
    c.totals = { hauled: { ore: 1700, ice: 230, crystal: 230 }, shipped: { ore: 999, ice: 99, crystal: 99 } };
    c.wonTick = 123456;
    expect(c.researchLog.length).toBe(13);
    const withCampaign = serializeWorld(w).length;
    const without = JSON.stringify({ format: 1, dataVersion: w.dataVersion, world: { ...w, campaign: undefined } }).length;
    expect(withCampaign - without).toBeLessThan(2048);
  });

  it('the hash covers the campaign', () => {
    const w = createWorld(1, data);
    const h = worldHash(w);
    w.campaign.shipAccum.ice = 1;
    expect(worldHash(w)).not.toBe(h);
  });

  it('refuses a save with a missing or malformed campaign, or area fields that do not match the active area', () => {
    const good = JSON.parse(serializeWorld(campaignWorld(1, data, { land: 'landfall' }))) as { world: Record<string, unknown> & { campaign: Record<string, unknown> } };
    const variants: Array<(s: typeof good) => void> = [
      (s) => delete (s.world as Record<string, unknown>).campaign,
      (s) => (s.world.campaign.active = 9),
      (s) => (s.world.campaign.research = { lancer: 2 }),
      (s) => (s.world.campaign.stockpile = { ore: 1, ice: 1 }),
      (s) => (s.world.campaign.areas = []),
      (s) => (s.world.campaign.active = null), // still has Landfall's nodes
      (s) => (s.world.campaign.active = A.shelf), // Landfall's nodes, but Frost Shelf active... same count, guardians differ
      (s) => (s.world.campaign.wonTick = 'soon'),
    ];
    const results = variants.map((edit) => {
      const s = JSON.parse(JSON.stringify(good)) as typeof good;
      edit(s);
      return deserializeWorld(JSON.stringify(s), data);
    });
    // Frost Shelf also has 7 nodes and 2 guardians (p1 and the heart) vs Landfall's 1: refused on the guardian count.
    expect(results.map((r) => (r.ok ? 'ok' : r.reason))).toEqual(Array(variants.length).fill('corrupt'));
  });

  it('refuses a v5 (H3) save: the data-version check, before any shape check', () => {
    const v5 = JSON.stringify({ format: 1, dataVersion: 5, world: { tick: 100, dataVersion: 5 } });
    expect(deserializeWorld(v5, defaultData)).toEqual({ ok: false, reason: 'dataVersion', saveDataVersion: 5 });
    // A v6 world loads with the shipped data.
    expect(deserializeWorld(serializeWorld(createWorld(1, defaultData)), defaultData).ok).toBe(true);
  });

  it('a replay with a constructed start reproduces a game from campaignWorld; without it, from createWorld', () => {
    const inputs = [
      { tick: 0, input: { type: 'buildExtractor', node: 1 } as Input },
      { tick: 3, input: { type: 'buildRoute', from: 1, to: 0 } as Input },
    ];
    const w = h3World(2);
    w.yards.lancer.on = true;
    w.yards.flak.on = true;
    for (let t = 0; t < 600; t++) step(w, data, inputs.filter((e) => e.tick === t).map((e) => e.input));
    const withStart = replayHashes({ seed: 2, dataVersion: data.dataVersion, start: DEEP_START, inputs }, data, 600, 600);
    expect(withStart).toEqual([worldHash(w)]);
    const plain = replayHashes({ seed: 2, dataVersion: data.dataVersion, inputs }, data, 600, 600);
    expect(plain).not.toEqual(withStart);
  });
});
