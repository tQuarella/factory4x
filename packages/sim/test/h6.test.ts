import { describe, expect, it } from 'vitest';
import {
  RAW_RESOURCES,
  areaFrontier,
  areaStatus,
  bandOpen,
  campaignStatus,
  campaignSummary,
  campaignWorld,
  commandedBands,
  createWorld,
  defaultData,
  deserializeWorld,
  fleetCap,
  fleetStatus,
  guardianAt,
  heartIndex,
  isAreaOpen,
  isLaneOpen,
  isValidInput,
  landingEffects,
  overworldStatus,
  rootIndex,
  runSummary,
  serializeWorld,
  step,
  supplyStatus,
  worldHash,
  type Input,
  type ResourceTriple,
  type SimTunableKey,
  type World,
} from '../src/index.ts';
import { fixtureV10, shippedCampaign } from './fixture.ts';
import { deepStart } from './h3-world.ts';

/**
 * h6-sim acceptance 2, 3 and 4 (DESIGN.md H6 "Fleet limit, relays and band
 * locks", "Repeat hauls", "Scouting", "Selectors", "Removing the Root"). The
 * rules run on the frozen v10 fixture (the H6 spec's starting values), with
 * every premise built explicitly (a constructed start, live tunables), so
 * h6-design-data's retune changes none of them. Numbers are read from the
 * fixture's data, never from the shipped data.
 */

const D = fixtureV10;
const idx = (id: string): number => {
  const i = D.map.areas.findIndex((a) => a.id === id);
  if (i < 0) throw new Error(`no area ${id}`);
  return i;
};
const A = Object.fromEntries(D.map.areas.map((a, i) => [a.id, i])) as Record<string, number>;
const CAP = D.tunables['fleet.cap'].default;
const STEP = D.tunables['fleet.relayStep'].default;
const PCT = D.tunables['areas.repeatHaulPct'].default;
const haul = (id: string): ResourceTriple => ({ ...D.map.areas[idx(id)]!.haul });
const decayed = (h: ResourceTriple, pct: number): ResourceTriple => ({
  ore: Math.floor((h.ore * pct) / 100),
  ice: Math.floor((h.ice * pct) / 100),
  crystal: Math.floor((h.crystal * pct) / 100),
});

function tick(w: World, ...inputs: Input[]): void {
  step(w, D, inputs);
}
const tune = (key: SimTunableKey, value: number): Input => ({ type: 'setTunable', key, value });
const enter = (id: string): Input => ({ type: 'enterArea', area: idx(id) });

/** Captures the active area's heart by play: a drone swarm parked on it (test setup), stepping until it falls. */
function takeHeart(w: World): void {
  const heart = heartIndex(w);
  for (let i = 0; i < 200; i++) w.ships.push({ id: w.nextId++, type: 'drone', hp: w.tun['ship.drone.hp'], at: heart, transit: null, engagedIn: -1 });
  for (let i = 0; i < 3000 && w.capturedTick === null; i++) tick(w);
  expect(w.capturedTick).not.toBeNull();
}

/** Lands in `id` by input from the overworld, takes its heart, and leaves: a reclaim by play. */
function reclaimByPlay(w: World, id: string): void {
  tick(w, enter(id));
  expect(w.campaign.active).toBe(idx(id));
  takeHeart(w);
  tick(w, { type: 'leaveArea' });
  expect(w.campaign.active).toBeNull();
}

describe('data premise (the v10 fixture)', () => {
  it('has two relays in band 1 and two in band 2, one per side, and repeat groups of two', () => {
    expect(D.map.areas.filter((a) => a.relay).map((a) => [a.id, a.tier, a.side])).toEqual([
      ['rime', 1, 'ice'],
      ['glint', 1, 'crystal'],
      ['mire', 2, 'ice'],
      ['spire', 2, 'crystal'],
    ]);
    expect([CAP, STEP, PCT, D.tunables['overworld.bandLock'].default]).toEqual([12, 8, 50, 1]);
  });
});

describe('fleetCap from commandedBands (DESIGN.md H6 "Fleet limit, relays and band locks")', () => {
  const capWith = (reclaimed: string[], t: Partial<Record<SimTunableKey, number>> = {}): number | null => {
    const w = campaignWorld(1, D, { reclaimed });
    for (const [k, v] of Object.entries(t)) w.tun[k as SimTunableKey] = v;
    return fleetCap(w, D);
  };

  it('at defaults: 12, then 20 with a band 1 relay, then 28 with a band 2 relay', () => {
    expect(capWith(['landfall'])).toBe(CAP);
    expect(capWith(['landfall', 'shelf', 'rime'])).toBe(CAP + STEP);
    expect(capWith(['landfall', 'shelf', 'rime', 'mire'])).toBe(CAP + 2 * STEP);
    expect(CAP + 2 * STEP).toBe(28);
  });

  it('a second relay in a band adds nothing; either side commands the band', () => {
    expect(capWith(['landfall', 'shoal', 'glint'])).toBe(CAP + STEP);
    expect(capWith(['landfall', 'shelf', 'rime', 'shoal', 'glint'])).toBe(CAP + STEP);
    expect(capWith(['landfall', 'shelf', 'rime', 'shoal', 'glint', 'mire', 'spire'])).toBe(CAP + 2 * STEP);
    // Non-relay areas never count, whatever their band.
    expect(capWith(['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep'])).toBe(CAP);
  });

  it('follows fleet.cap and fleet.relayStep live, across their ranges (4, 12; cap 1 and 60)', () => {
    for (const [cap, stepSize] of [
      [12, 4],
      [12, 12],
      [1, 8],
      [60, 12],
    ] as const) {
      const t = { 'fleet.cap': cap, 'fleet.relayStep': stepSize };
      expect(capWith(['landfall'], t)).toBe(cap);
      expect(capWith(['landfall', 'shelf', 'rime'], t)).toBe(cap + stepSize);
      expect(capWith(['landfall', 'shelf', 'rime', 'glint', 'spire'], t)).toBe(cap + 2 * stepSize);
    }
  });

  it('fleet.cap 0: no limit at all, but relays still command bands and open them', () => {
    const w = campaignWorld(1, D, { reclaimed: ['landfall', 'shelf', 'rime'] });
    tick(w, tune('fleet.cap', 0));
    expect(fleetCap(w, D)).toBeNull();
    expect(fleetStatus(w, D)).toMatchObject({ cap: null, commandedBands: 1, maxCommandedBands: 2, full: false });
    expect(bandOpen(w, D, 2)).toBe(true);
    expect(isValidInput(w, D, enter('veil'))).toBe(true);
    expect(overworldStatus(w, D)).toMatchObject({ fleetCap: null, commandedBands: 1 });
    expect(areaFrontier(w, D, A.glint!).capAfter).toBeNull();
  });

  it('a relay reclaimed in an area raises the limit from the next landing, never mid-area', () => {
    const w = campaignWorld(1, D, { reclaimed: ['landfall', 'shelf'] });
    tick(w, enter('rime'));
    expect(landingEffects(w, D).fleetCap).toBe(CAP);
    takeHeart(w);
    // Reclaimed, but still in the area: the limit, the yards' cap and a battle's capAtSend stay at the landing's.
    expect(w.campaign.areas[A.rime!]!.reclaimedTick).not.toBeNull();
    expect([fleetCap(w, D), commandedBands(w, D), bandOpen(w, D, 2)]).toEqual([CAP, 0, false]);
    tick(w, { type: 'leaveArea' });
    expect([fleetCap(w, D), commandedBands(w, D), bandOpen(w, D, 2)]).toEqual([CAP + STEP, 1, true]);
    // The overworld shows the next landing's limit, and the next landing has it.
    expect(fleetStatus(w, D).cap).toBe(CAP + STEP);
    tick(w, enter('mire'));
    expect(landingEffects(w, D).fleetCap).toBe(CAP + STEP);
    expect(fleetStatus(w, D)).toMatchObject({ cap: CAP + STEP, commandedBands: 1 });
  });
});

describe('band locks: bandOpen and the enterArea lock (bandLocked)', () => {
  it('bands 0 and 1 are always open; band b ≥ 2 opens with a relay of band b − 1, either side', () => {
    const start = campaignWorld(1, D, { reclaimed: ['landfall'] });
    expect([0, 1, 2, 3].map((b) => bandOpen(start, D, b))).toEqual([true, true, false, false]);
    const rime = campaignWorld(1, D, { reclaimed: ['landfall', 'shelf', 'rime'] });
    expect([0, 1, 2, 3].map((b) => bandOpen(rime, D, b))).toEqual([true, true, true, false]);
    const glint = campaignWorld(1, D, { reclaimed: ['landfall', 'shoal', 'glint'] });
    expect([2, 3].map((b) => bandOpen(glint, D, b))).toEqual([true, false]);
    const spire = campaignWorld(1, D, { reclaimed: ['landfall', 'shoal', 'glint', 'spire'] });
    expect([2, 3].map((b) => bandOpen(spire, D, b))).toEqual([true, true]);
    // A band 2 non-relay opens nothing.
    const garden = campaignWorld(1, D, { reclaimed: ['landfall', 'shoal', 'glint', 'garden'] });
    expect(bandOpen(garden, D, 3)).toBe(false);
  });

  it('enterArea is refused for a lane-joined area in a locked band, and its sheet says bandLocked', () => {
    // A constructed start: Thorn Garden reclaimed with no relay, so Spore Veil (veil–garden) is lane-joined but locked.
    const w = campaignWorld(1, D, { reclaimed: ['landfall', 'shoal', 'garden'] });
    expect(isLaneOpen(w, D, A.veil!)).toBe(true);
    expect(isAreaOpen(w, D, A.veil!)).toBe(false);
    expect(isValidInput(w, D, enter('veil'))).toBe(false);
    tick(w, enter('veil'));
    expect(w.campaign.active).toBeNull();
    expect(areaStatus(w, D, A.veil!)).toMatchObject({ state: 'locked', lockReason: 'bandLocked', locked: true, known: true, open: false });
    // Band 1 is never locked.
    expect(isValidInput(w, D, enter('glint'))).toBe(true);
    // A relay reclaimed by play opens it.
    reclaimByPlay(w, 'glint');
    expect(isValidInput(w, D, enter('veil'))).toBe(true);
    expect(areaStatus(w, D, A.veil!)).toMatchObject({ state: 'open', lockReason: null, locked: false });
  });

  it('overworld.bandLock 0: lanes alone decide, live', () => {
    const w = campaignWorld(1, D, { reclaimed: ['landfall', 'shoal', 'garden'] });
    tick(w, tune('overworld.bandLock', 0));
    expect([0, 1, 2, 3].map((b) => bandOpen(w, D, b))).toEqual([true, true, true, true]);
    expect(isValidInput(w, D, enter('veil'))).toBe(true);
    expect(areaFrontier(w, D, A.veil!)).toMatchObject({ locked: false, open: true, unlockRelays: [] });
    // Lanes still rule: The Deep isn't lane-joined.
    expect(isValidInput(w, D, enter('deep'))).toBe(false);
    expect(areaFrontier(w, D, A.deep!).lockReason).toBe('lanes');
    tick(w, tune('overworld.bandLock', 1));
    expect(isValidInput(w, D, enter('veil'))).toBe(false);
  });

  it('by play from createWorld: Landfall, a light area, its relay, then band 2 and The Deep open in turn', () => {
    const w = createWorld(1, D);
    expect(D.map.areas.map((_, a) => isAreaOpen(w, D, a))).toEqual(D.map.areas.map((a) => a.id === 'landfall'));
    reclaimByPlay(w, 'landfall');
    reclaimByPlay(w, 'shelf');
    expect(isValidInput(w, D, enter('rime'))).toBe(true);
    reclaimByPlay(w, 'rime');
    // rime–veil and rime–mire: band 2 open at once; rime–glint is band 1.
    const open = (): string[] => D.map.areas.filter((_, a) => isAreaOpen(w, D, a)).map((a) => a.id);
    expect(open()).toEqual(['shoal', 'glint', 'veil', 'mire']);
    reclaimByPlay(w, 'mire');
    expect(open()).toEqual(['shoal', 'glint', 'veil', 'deep']);
    expect(fleetCap(w, D)).toBe(CAP + 2 * STEP);
  });
});

describe('repeat hauls (DESIGN.md H6 "Repeat hauls")', () => {
  /** Reclaims `first` (constructed), then lands in `second` by input and takes it with `pct` set live; returns the world after leaving. */
  function second(first: string[], target: string, pct: number = PCT): World {
    const w = campaignWorld(1, D, { reclaimed: ['landfall', ...first] });
    tick(w, tune('areas.repeatHaulPct', pct));
    reclaimByPlay(w, target);
    return w;
  }

  it('the second area of a (band, side) group pays floor(haul × 50 / 100); the record, stats, summaries and selectors show it', () => {
    const w = campaignWorld(1, D, { reclaimed: ['landfall', 'shelf'] });
    const shipped0 = { ...w.campaign.totals.shipped };
    tick(w, enter('rime'));
    expect(areaStatus(w, D, A.rime!)).toMatchObject({ haulNow: decayed(haul('rime'), PCT), haulDecayed: true, repeatOf: A.shelf });
    takeHeart(w);
    const paid = decayed(haul('rime'), PCT);
    expect(paid).toEqual({ ore: 100, ice: 30, crystal: 10 });
    expect(w.campaign.areas[A.rime!]!.haulPaid).toEqual(paid);
    expect(w.stats.haulPaid).toEqual(paid);
    expect(runSummary(w).haulPaid).toEqual(paid);
    expect(w.campaign.totals.hauled).toEqual(paid);
    const shipped = w.campaign.totals.shipped;
    for (const r of RAW_RESOURCES) expect(w.campaign.stockpile[r], r).toBe(paid[r] + shipped[r] - shipped0[r]);
    tick(w, { type: 'leaveArea' });
    const sum = campaignSummary(w, D);
    expect(sum.hauled).toEqual(paid);
    // The two constructed areas paid nothing; nominal is Σ data haul of every reclaimed area.
    const nominal = ['landfall', 'shelf', 'rime'].reduce<ResourceTriple>((s, id) => ({ ore: s.ore + haul(id).ore, ice: s.ice + haul(id).ice, crystal: s.crystal + haul(id).crystal }), { ore: 0, ice: 0, crystal: 0 });
    expect(sum.haulNominal).toEqual(nominal);
    expect(sum.reclaimOrder.map((e) => [e.id, e.haulPaid])).toEqual([
      ['landfall', { ore: 0, ice: 0, crystal: 0 }],
      ['shelf', { ore: 0, ice: 0, crystal: 0 }],
      ['rime', paid],
    ]);
    expect(sum.areas[A.rime!]!.haulPaid).toEqual(paid);
    // After the reclaim the selectors show what it paid, still marked decayed, with the mate that made it a repeat.
    expect(areaFrontier(w, D, A.rime!)).toMatchObject({ haulNow: paid, haulDecayed: true, repeatOf: A.shelf });
    expect(areaFrontier(w, D, A.shelf!)).toMatchObject({ repeatOf: null });
  });

  it('the first of a group pays in full, and so does the other side of the band, and side none (Landfall, The Deep)', () => {
    const w = createWorld(1, D);
    reclaimByPlay(w, 'landfall');
    reclaimByPlay(w, 'shelf');
    reclaimByPlay(w, 'shoal');
    expect(w.campaign.areas[A.landfall!]!.haulPaid).toEqual(haul('landfall'));
    expect(w.campaign.areas[A.shelf!]!.haulPaid).toEqual(haul('shelf'));
    expect(w.campaign.areas[A.shoal!]!.haulPaid).toEqual(haul('shoal'));
    // Glint (band 1, crystal) is now a repeat of Glass Shoal; Rime of Frost Shelf.
    expect(areaFrontier(w, D, A.glint!)).toMatchObject({ repeatOf: A.shoal, haulNow: decayed(haul('glint'), PCT), haulDecayed: true });
    // The Deep has side none: never a repeat, even with every other area reclaimed.
    const deep = campaignWorld(1, D, deepStart(D));
    takeHeart(deep);
    expect(deep.campaign.areas[A.deep!]!.haulPaid).toEqual(haul('deep'));
  });

  it('a different band of the same side is not a repeat (Frost Shelf, then Spore Veil)', () => {
    const w = second(['shelf', 'rime'], 'veil');
    // Rime is band 1; Spore Veil is band 2, ice: the first of its group.
    expect(w.campaign.areas[A.veil!]!.haulPaid).toEqual(haul('veil'));
    expect(areaFrontier(w, D, A.mire!)).toMatchObject({ repeatOf: A.veil, haulDecayed: true });
  });

  it('areas.repeatHaulPct 0 pays nothing for a repeat, 100 pays in full (the A/B off)', () => {
    expect(second(['shelf'], 'rime', 0).campaign.areas[A.rime!]!.haulPaid).toEqual({ ore: 0, ice: 0, crystal: 0 });
    const full = second(['shelf'], 'rime', 100);
    expect(full.campaign.areas[A.rime!]!.haulPaid).toEqual(haul('rime'));
    expect(areaFrontier(full, D, A.rime!).haulDecayed).toBe(false);
  });

  it('a haul that does not divide evenly rounds down per resource (33% of 200 / 60 / 20 is 66 / 19 / 6; of 300 / 60 / 40, 99 / 19 / 13)', () => {
    expect(second(['shelf'], 'rime', 33).campaign.areas[A.rime!]!.haulPaid).toEqual({ ore: 66, ice: 19, crystal: 6 });
    // Mire Relay after Spore Veil (band 2, ice).
    const w = second(['shelf', 'rime', 'veil'], 'mire', 33);
    expect(w.campaign.areas[A.mire!]!.haulPaid).toEqual({ ore: 99, ice: 19, crystal: 13 });
  });

  it('exports never decay: a repeat ships its full export', () => {
    const w = second(['shelf'], 'rime');
    const exp = RAW_RESOURCES.map((r) => D.map.areas.filter((_, a) => w.campaign.areas[a]!.reclaimedTick !== null).reduce((s, a) => s + a.export[r], 0));
    const st = campaignStatus(w, D);
    expect(RAW_RESOURCES.map((r) => st.shipPerMinX10[r])).toEqual(exp.map((e) => Math.floor((e * w.tun['shipments.pct']) / 10)));
  });
});

describe('selectors: overworldStatus, areaFrontier, fleetStatus', () => {
  it('at the start only Landfall is known and open; everything else is far, band 2 and 3 locked', () => {
    const ow = overworldStatus(createWorld(1, D), D);
    expect(ow).toMatchObject({ commandedBands: 0, maxCommandedBands: 2, fleetCap: CAP, bandLock: true });
    expect(ow.areas.map((a) => [a.id, a.known, a.open, a.locked, a.relay, a.band])).toEqual(
      D.map.areas.map((a) => [a.id, a.id === 'landfall', a.id === 'landfall', a.tier >= 2, a.relay, a.tier]),
    );
  });

  it('a far area two lanes out (Rime Relay after Landfall) is unscouted: not known, not open, reason lanes, band 1 not locked', () => {
    const w = campaignWorld(1, D, { reclaimed: ['landfall'] });
    const shelf = areaFrontier(w, D, A.shelf!);
    expect(shelf).toMatchObject({ known: true, open: true, locked: false, lockReason: null, haulNow: haul('shelf'), haulDecayed: false });
    expect(areaFrontier(w, D, A.rime!)).toMatchObject({ known: false, open: false, locked: false, lockReason: 'lanes', relay: true, band: 1, commanded: false, bandOpen: true, unlockRelays: [] });
    // Spore Veil is far and in a locked band: both are reported, the reason is the lanes.
    expect(areaFrontier(w, D, A.veil!)).toMatchObject({ known: false, open: false, locked: true, lockReason: 'lanes', unlockRelays: [A.rime, A.glint] });
    // The Deep: band 3, unlocked by either band 2 relay.
    expect(areaFrontier(w, D, A.deep!)).toMatchObject({ known: false, locked: true, unlockRelays: [A.mire, A.spire] });
  });

  it('a known but locked area (locks on, no relay): known, locked, not open, reason bandLocked, names the band 1 relays', () => {
    const w = campaignWorld(1, D, { reclaimed: ['landfall', 'shoal', 'garden'] });
    const veil = overworldStatus(w, D).areas[A.veil!]!;
    expect(veil).toMatchObject({ id: 'veil', known: true, open: false, locked: true, lockReason: 'bandLocked', relay: false, band: 2, commanded: false, unlockRelays: [A.rime, A.glint] });
    expect(veil.haulNow).toEqual(haul('veil'));
  });

  it('relays: capAfter is the raised limit for an uncommanded band, unchanged once the band is commanded ("already open")', () => {
    const w = campaignWorld(1, D, { reclaimed: ['landfall', 'shelf', 'shoal'] });
    expect(areaFrontier(w, D, A.rime!)).toMatchObject({ relay: true, commanded: false, capAfter: CAP + STEP });
    expect(areaFrontier(w, D, A.glint!)).toMatchObject({ relay: true, commanded: false, capAfter: CAP + STEP });
    reclaimByPlay(w, 'rime');
    expect(areaFrontier(w, D, A.glint!)).toMatchObject({ relay: true, commanded: true, capAfter: CAP + STEP });
    expect(areaFrontier(w, D, A.mire!)).toMatchObject({ relay: true, commanded: false, capAfter: CAP + 2 * STEP, known: true, open: true });
    // A non-relay never raises it.
    expect(areaFrontier(w, D, A.veil!).capAfter).toBe(CAP + STEP);
    expect(fleetStatus(w, D)).toMatchObject({ cap: CAP + STEP, commandedBands: 1, maxCommandedBands: 2, level: 0, maxLevel: 0 });
  });

  it('areaStatus carries the frontier fields alongside H4\'s, and its haul stays nominal', () => {
    const w = campaignWorld(1, D, { reclaimed: ['landfall', 'shelf'] });
    const st = areaStatus(w, D, A.rime!);
    expect(st).toMatchObject({ state: 'open', haul: haul('rime'), haulNow: decayed(haul('rime'), PCT), relay: true, side: 'ice', band: 1 });
    expect(st.record.haulPaid).toBeNull();
  });
});

describe('The Deep without the Root (DESIGN.md H6 "Removing the Root")', () => {
  it('in every layout it lands with no Root node: a fed heart for good at the layout\'s fed counts only', () => {
    for (const seed of [0, 1, 2]) {
      const w = campaignWorld(seed, D, deepStart(D));
      const layout = D.map.layouts[w.campaign.deepLayout]!;
      expect(w.nodes.map((n) => n.id)).not.toContain('root');
      expect(w.nodes).toHaveLength(D.map.nodes.length - 1);
      expect(rootIndex(w)).toBe(-1);
      const g = guardianAt(w, heartIndex(w))!;
      expect([g.fed, g.starvedCounts, g.counts]).toEqual([true, null, { thorn: layout.heart.thorns, spore: layout.heart.spores }]);
      expect(supplyStatus(w)).toMatchObject({ hasRoot: false, fed: true });
      const heart = areaStatus(w, D, A.deep!).guarded.find((x) => x.kind === 'heart')!;
      expect(heart.starvedCaps).toBeNull();
      expect(areaStatus(w, D, A.deep!).hasRoot).toBe(false);
      // Pockets follow the layout as in H3.
      for (const p of ['p1', 'p2', 'p3', 'p4']) {
        const node = w.nodes.find((n) => n.id === p)!;
        expect([node.prize, node.slots], `${layout.id} ${p}`).toEqual([layout.pockets[p]!.prize, layout.pockets[p]!.slots]);
      }
      // Over minutes it never starves and stays at its fed caps.
      g.guards = g.guards.slice(0, 2);
      for (let i = 0; i < 3 * 1800; i++) tick(w);
      expect(g.fed).toBe(true);
      expect(g.guards.length).toBe(layout.heart.thorns + layout.heart.spores);
    }
  });

  it('the shipped data lands The Deep the same way (no Root, fed counts only)', () => {
    // h7-sim: the shipped data runs the field; its parked campaign is played with run.mode "campaign".
    const w = campaignWorld(1, shippedCampaign, deepStart(defaultData));
    expect(rootIndex(w)).toBe(-1);
    const g = guardianAt(w, heartIndex(w))!;
    expect([g.fed, g.starvedCounts]).toEqual([true, null]);
  });
});

describe('save', () => {
  it('round-trips haulPaid (record and stats); refuses a record with a malformed haulPaid', () => {
    const w = campaignWorld(1, D, { reclaimed: ['landfall', 'shelf'] });
    tick(w, enter('rime'));
    takeHeart(w);
    const text = serializeWorld(w);
    const back = deserializeWorld(text, D);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(worldHash(back.world)).toBe(worldHash(w));
    expect(back.world.campaign.areas[A.rime!]!.haulPaid).toEqual(w.campaign.areas[A.rime!]!.haulPaid);
    const broken = JSON.parse(text) as { world: { campaign: { areas: Array<Record<string, unknown>> }; stats: Record<string, unknown> } };
    broken.world.campaign.areas[A.rime!]!.haulPaid = { ore: 1 };
    expect(deserializeWorld(JSON.stringify(broken), D)).toMatchObject({ ok: false, reason: 'corrupt' });
    const noStats = JSON.parse(text) as { world: { stats: Record<string, unknown> } };
    delete noStats.world.stats.haulPaid;
    expect(deserializeWorld(JSON.stringify(noStats), D)).toMatchObject({ ok: false, reason: 'corrupt' });
  });
});
