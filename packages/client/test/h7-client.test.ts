import { describe, expect, it } from 'vitest';
import {
  BUILD_TYPES,
  FIELD_PARKED_KEYS,
  allocStatus,
  createWorld,
  defaultData,
  fieldSummary,
  isField,
  isWon,
  replayHashes,
  rockStatus,
  tunableMeta,
  withRunMode,
  worldHash,
  type AllocRow,
  type AllocState,
  type FieldSummary,
  type RockStatus,
} from '@factory4x/sim';
import { Session, dataWithDefaults, replayData } from '../src/session.ts';
import { decodeSave, encodeSave } from '../src/persist.ts';
import { isHiddenTunable } from '../src/panels.ts';
import {
  BUILD_NAME,
  allocCostText,
  allocStateText,
  fieldFleetFullNotice,
  fieldUnlockNotice,
  hiveTimeText,
  pipText,
  radarLabel,
  raidChipText,
  raidEndText,
  raidFightLine,
  raidMixText,
  raidMusterLine,
  clockText,
  secsText,
  raidsText,
  typesText,
} from '../src/fieldreport.ts';
import { recycleNotice } from '../src/report.ts';
import { shortName } from '../src/sheet.ts';
import { nodeLabel } from '../src/view.ts';

const data = defaultData;

function row(over: Partial<AllocRow> & { state: AllocState }): AllocRow {
  return { type: 'extractor', weight: 3, share: 6, cost: { ore: 20, resource: null }, unlocked: true, building: 0, ticksLeft: 0, totalTicks: 120, ...over };
}

describe('acceptance 1: field mode end to end', () => {
  it('shipped data is field mode and a new session lands in the field, running from the first tick', () => {
    const s = new Session(data, { seed: 1 });
    expect(isField(s.world)).toBe(true);
    expect(s.onOverworld).toBe(false);
    expect(s.world.campaign.active).toBeNull();
    expect(s.advance(1000)).toBeGreaterThan(0);
    expect(s.world.tick).toBeGreaterThan(0);
  });
  it('a paused input applies at once, in one tick, and is logged', () => {
    const s = new Session(data, { seed: 1 });
    s.paused = true;
    expect(s.send({ type: 'setAlloc', shipType: 'drone', weight: 2 })).toBe(true);
    expect(s.world.tick).toBe(1);
    expect(s.world.field!.alloc.drone).toBe(2);
    expect(s.log).toEqual([{ tick: 0, input: { type: 'setAlloc', shipType: 'drone', weight: 2 } }]);
  });
  it('the campaign inputs are refused in a field run (research, withdraw, the overworld are unreachable)', () => {
    const s = new Session(data, { seed: 1 });
    for (const input of [{ type: 'enterArea', area: 0 }, { type: 'leaveArea' }, { type: 'buyResearch', id: 'opening' }] as const) {
      expect(s.send(input as never)).toBe(false);
    }
    expect(s.log).toEqual([]);
  });
  it('a field run saves, resumes and replays to the same hash', () => {
    const s = new Session(data, { seed: 7 });
    s.send({ type: 'setAlloc', shipType: 'drone', weight: 2 });
    s.advance(250);
    for (let i = 0; i < 12; i++) s.advance(250);
    s.send({ type: 'setMine', node: s.world.nodes.findIndex((n) => n.id === 'a1'), on: false });
    for (let i = 0; i < 12; i++) s.advance(250);
    const text = encodeSave(s);
    expect(JSON.parse(text).mode).toBeUndefined();
    const out = decodeSave(text, data);
    expect(out.kind).toBe('resumed');
    if (out.kind !== 'resumed') return;
    expect(isField(out.session.world)).toBe(true);
    expect(worldHash(out.session.world)).toBe(worldHash(s.world));
    const r = out.session.replay();
    expect(r.mode).toBeUndefined();
    expect(replayHashes(r, replayData(r), s.world.tick, s.world.tick)[0]).toBe(worldHash(s.world));
  });
  it('the parked campaign still saves, resumes and replays: its session says mode campaign, and data v-shipped decodes it', () => {
    const campaign = withRunMode(data, 'campaign');
    const s = new Session(campaign, { seed: 3, start: { reclaimed: ['landfall'] } });
    expect(isField(s.world)).toBe(false);
    expect(s.onOverworld).toBe(true);
    s.send({ type: 'setTunable', key: 'economy.startStock', value: 77 });
    expect(s.world.tick).toBe(1);
    const text = encodeSave(s);
    expect(JSON.parse(text).mode).toBe('campaign');
    const out = decodeSave(text, data);
    expect(out.kind).toBe('resumed');
    if (out.kind !== 'resumed') return;
    expect(isField(out.session.world)).toBe(false);
    const r = out.session.replay();
    expect(r.mode).toBe('campaign');
    expect(replayHashes(r, replayData(r), 1, 1)[0]).toBe(worldHash(s.world));
  });
  it('New run keeps the live tuning (the next run starts from the tuned values) and a new seed', () => {
    const s = new Session(data, { seed: 5 });
    s.paused = true;
    s.send({ type: 'setTunable', key: 'economy.startStock', value: 80 });
    const next = new Session(dataWithDefaults(s.data, s.world.tun), { seed: s.seed + 1 });
    expect(next.world.stock.ore).toBe(80);
    expect(next.seed).toBe(6);
    expect(isField(next.world)).toBe(true);
  });
  it('the tuning panel hides every parked key and the variant in a field run, and shows the H7 keys', () => {
    for (const k of FIELD_PARKED_KEYS) expect(isHiddenTunable(k, true), k).toBe(true);
    expect(isHiddenTunable('system.variant', true)).toBe(true);
    for (const k of ['alloc.maxWeight', 'alloc.start.extractor', 'ship.extractor.cost', 'ship.hauler.cargo', 'field.fleetCap', 'fleet.countsEconomy', 'raid.enabled', 'raid.musterTicks', 'hive.regrowPct', 'fleet.recycleRefundPct', 'economy.startStock']) {
      expect(isHiddenTunable(k, true), k).toBe(false);
    }
    // Every live H7 key is shown.
    for (const m of tunableMeta(data)) {
      if (!m.live) continue;
      if (/^(alloc|raid|field|hive)\./.test(m.key) || /^ship\.(extractor|hauler)\./.test(m.key)) expect(isHiddenTunable(m.key, true), m.key).toBe(false);
    }
  });
  it('the campaign tuning panel keeps its parked keys (only the Root starved keys stay hidden)', () => {
    for (const k of FIELD_PARKED_KEYS) expect(isHiddenTunable(k, false), k).toBe(k.startsWith('bloom.starved'));
    expect(isHiddenTunable('system.variant', false)).toBe(false);
  });
  it('the hive: the heart reads Hive in a field run and Heart in the campaign', () => {
    expect(shortName({ id: 'heart', kind: 'heart' }, true)).toBe('Hive');
    expect(shortName({ id: 'heart', kind: 'heart' })).toBe('Heart');
    expect(nodeLabel({ id: 'heart', kind: 'heart' }, true)).toBe('HIVE');
    expect(nodeLabel({ id: 'heart', kind: 'heart' })).toBe('HEART');
  });
  it('the win is the hive: isWon is false at the landing', () => {
    expect(isWon(createWorld(1, data))).toBe(false);
  });
});

describe('acceptance 2: the probe sheet text, one line for each allocStatus state', () => {
  it('every state has its own line, from the row', () => {
    expect(allocStateText(row({ state: 'building', building: 40 }))).toBe('building 40%');
    expect(allocStateText(row({ state: 'filling', share: 12 }))).toBe('saving 12/20');
    expect(allocStateText(row({ state: 'fleetFull' }))).toBe('fleet full');
    expect(allocStateText(row({ state: 'off', weight: 0 }))).toBe('off');
    expect(allocStateText(row({ type: 'lancer', state: 'locked' }))).toBe('needs crystal pocket');
    expect(allocStateText(row({ type: 'flak', state: 'locked' }))).toBe('needs ice pocket');
    expect(allocStateText(row({ type: 'lancer', state: 'waitingResource', cost: { ore: 18, resource: { res: 'crystal', amount: 4 } } }))).toBe('needs 4 crystal');
  });
  it('the text covers every state the sim can report', () => {
    const states: AllocState[] = ['off', 'locked', 'filling', 'waitingResource', 'fleetFull', 'building'];
    for (const state of states) expect(allocStateText(row({ state, type: 'lancer', cost: { ore: 18, resource: { res: 'crystal', amount: 4 } } })).length).toBeGreaterThan(0);
  });
  it('the line follows the real sim: a landing is saving for the economy and has the warships off', () => {
    const w = createWorld(1, data);
    const st = allocStatus(w, data);
    const byType = Object.fromEntries(st.rows.map((r) => [r.type, allocStateText(r)]));
    expect(byType.drone).toBe('off');
    expect(byType.lancer).toBe('off');
    expect(byType.flak).toBe('off');
    expect(byType.extractor).toMatch(/^saving \d+\/20$/);
    expect(st.rows.map((r) => r.type)).toEqual([...BUILD_TYPES]);
  });
  it('a locked type with a weight says what it needs, and costs read from the row', () => {
    const w = createWorld(1, data);
    w.field!.alloc.lancer = 2;
    const lancer = allocStatus(w, data).rows.find((r) => r.type === 'lancer')!;
    expect(lancer.state).toBe('locked');
    expect(allocStateText(lancer)).toContain('crystal');
    expect(allocCostText(lancer)).toBe(`${w.tun['ship.lancer.cost']} ore + ${w.tun['ship.lancer.crystal']} crystal`);
    expect(allocCostText(allocStatus(w, data).rows[0]!)).toBe(`${w.tun['ship.extractor.cost']} ore`);
  });
  it('the radar label comes from the status', () => {
    const w = createWorld(1, data);
    const st = allocStatus(w, data);
    expect(radarLabel(st.rows)).toBe('Allocation: Extractor 3, Hauler 2, Drone 0, Lancer 0, Flak 0');
  });
  it('names: every build type has a name', () => {
    for (const t of BUILD_TYPES) expect(BUILD_NAME[t].length).toBeGreaterThan(0);
  });
});

describe('acceptance 3: the rock sheet text', () => {
  const rs = (over: Partial<RockStatus>): RockStatus => ({
    node: 1, id: 'a1', kind: 'asteroid', prize: 'ore', mine: true, mineable: true, docked: 1, bound: 3, inFlight: 2, slots: 3, freeExtractors: 0, haulers: 2, buffer: 4, bufferCap: 40, backedUp: false, deliveredPerMin: 12, raidRank: 0, ...over,
  });
  it('the pip line counts docked and free extractors and names the ones on the way', () => {
    expect(pipText(rs({}))).toBe('1/3 (+2 on the way)');
    expect(pipText(rs({ inFlight: 0, docked: 3 }))).toBe('3/3');
    expect(pipText(rs({ kind: 'heart', slots: 4, docked: 1, freeExtractors: 1, inFlight: 0 }))).toBe('2/4');
  });
  it('the live rock status of a landing: the near rocks are mined and have no ships yet', () => {
    const w = createWorld(1, data);
    const a1 = rockStatus(w, w.nodes.findIndex((n) => n.id === 'a1'));
    expect(a1.mine).toBe(true);
    expect(a1.docked).toBe(0);
    expect(a1.slots).toBe(2);
    expect(a1.raidRank).toBeGreaterThanOrEqual(0);
  });
});

describe('the field result panel text', () => {
  const s: FieldSummary = {
    capturedTick: 30000,
    timeToHiveSec: 1000,
    peakPerMin: 90,
    built: { extractor: 8, hauler: 6, drone: 10, lancer: 4, flak: 0 },
    lost: { extractor: 1, hauler: 0, drone: 3, lancer: 0, flak: 0 },
    recycled: { extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 },
    raids: { mustered: 4, beaten: 2, hit: 1, turnedBack: 1 },
    econLostToRaids: 1,
    allocChanges: 9,
    peakEcon: 14,
  };
  it('reads time, ships and raids from fieldSummary', () => {
    expect(hiveTimeText(s)).toBe('16:40');
    expect(hiveTimeText({ ...s, timeToHiveSec: null })).toBe('-');
    expect(typesText(s.built)).toBe('8 Extractor · 6 Hauler · 10 Drone · 4 Lancer');
    expect(typesText(s.lost)).toBe('1 Extractor · 3 Drone');
    expect(typesText({ extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 })).toBe('0');
    expect(raidsText(s.raids)).toBe('4: 2 beaten · 1 hit · 1 turned back');
    expect(raidsText({ mustered: 0, beaten: 0, hit: 0, turnedBack: 0 })).toBe('none');
  });
  it('fieldSummary of a new run is empty', () => {
    const f = fieldSummary(createWorld(1, data));
    expect(f.capturedTick).toBeNull();
    expect(typesText(f.lost)).toBe('0');
  });
});

describe('notices in a field run', () => {
  it('the unlock notice says where the weight is, and the fleet notice says who counts', () => {
    expect(fieldUnlockNotice('lancer')).toBe('Crystal delivered: Lancers unlocked. Raise their weight at the Probe. Tap here to open it.');
    expect(fieldUnlockNotice('flak')).toContain('Ice delivered: Flak unlocked');
    expect(fieldFleetFullNotice(30, 30, true)).toContain('Every ship counts.');
    expect(fieldFleetFullNotice(12, 12, false)).toContain('Warships count.');
  });
  it('a recycle notice names economy ships', () => {
    expect(recycleNotice({ drone: 1, lancer: 0, flak: 0, extractor: 2, hauler: 1 }, 40)).toBe('Recycled 1 drone, 2 extractors, 1 hauler: +40 ore.');
  });
});

describe('acceptance 4: raid text (the chip in each state, the muster line, the three end toasts and the withered one)', () => {
  const chip = {
    enabled: true,
    phase: 'none' as 'none' | 'muster' | 'out' | 'fight' | 'home',
    econ: 3,
    nextRaidAtEcon: 6,
    ticksToLaunch: 0,
    ticksToArrival: 0,
    ticksToNextAllowed: 0,
  };
  it('the chip: off is null, then each state reads its own text', () => {
    expect(raidChipText({ ...chip, enabled: false }, 30)).toBeNull();
    expect(raidChipText({ ...chip, enabled: false, phase: 'out' }, 30)).toBeNull();
    expect(raidChipText(chip, 30)).toBe('Raids at 6 ships');
    expect(raidChipText({ ...chip, econ: 8, ticksToNextAllowed: 1350 }, 30)).toBe('Next raid 0:45');
    expect(raidChipText({ ...chip, econ: 8 }, 30)).toBe('Raids ready');
    expect(raidChipText({ ...chip, econ: 8, phase: 'muster', ticksToLaunch: 450 }, 30)).toBe('Raid 0:15');
    expect(raidChipText({ ...chip, econ: 8, phase: 'out', ticksToArrival: 143 }, 30)).toBe('Raid 0:05');
    expect(raidChipText({ ...chip, econ: 8, phase: 'fight' }, 30)).toBe('Raid on');
    expect(raidChipText({ ...chip, econ: 8, phase: 'home', ticksToArrival: 100 }, 30)).toBe('Raid leaving');
  });
  it('the clocks round up and carry minutes', () => {
    expect(clockText(1, 30)).toBe('0:01');
    expect(clockText(1800, 30)).toBe('1:00');
    expect(clockText(1861, 30)).toBe('1:03');
    expect(secsText(450, 30)).toBe('15 s');
    expect(secsText(451, 30)).toBe('16 s');
  });
  it('the mix puts the larger type first, with singular and plural', () => {
    expect(raidMixText({ thorn: 1, spore: 4 })).toBe('4 Spores, 1 Thorn');
    expect(raidMixText({ thorn: 3, spore: 1 })).toBe('3 Thorns, 1 Spore');
    expect(raidMixText({ thorn: 1, spore: 1 })).toBe('1 Spore, 1 Thorn');
    expect(raidMixText({ thorn: 0, spore: 2 })).toBe('2 Spores');
    expect(raidMixText({ thorn: 1, spore: 0 })).toBe('1 Thorn');
    expect(raidMixText({ thorn: 0, spore: 0 })).toBe('nothing');
  });
  it('the muster and fight lines', () => {
    expect(raidMusterLine({ thorn: 1, spore: 4 }, 'A5', 450, 30)).toBe('Raid gathering: 4 Spores, 1 Thorn → A5 in 15 s');
    expect(raidFightLine('A5', 3)).toBe('Raid at A5: 3 left');
  });
  const none = { lostEcon: { extractor: 0, hauler: 0 }, lostShips: { drone: 0, lancer: 0, flak: 0 }, killed: { thorn: 0, spore: 0 } };
  it('beaten: kills and losses, whatever was lost (a raid whose last raider dies is beaten)', () => {
    expect(raidEndText({ ...none, outcome: 'beaten', killed: { thorn: 2, spore: 3 } }, 'A5')).toBe('Raid beaten at A5: 5 killed, 0 lost');
    expect(raidEndText({ ...none, outcome: 'beaten', killed: { thorn: 1, spore: 1 }, lostEcon: { extractor: 1, hauler: 0 }, lostShips: { drone: 2, lancer: 0, flak: 0 } }, 'A1')).toBe('Raid beaten at A1: 2 killed, 3 lost');
  });
  it('hit: each loss kind, singular and plural, in a fixed order', () => {
    expect(raidEndText({ ...none, outcome: 'hit', lostEcon: { extractor: 2, hauler: 1 } }, 'A5')).toBe('Raid hit A5: lost 2 extractors, 1 hauler');
    expect(raidEndText({ ...none, outcome: 'hit', lostEcon: { extractor: 1, hauler: 3 } }, 'A5')).toBe('Raid hit A5: lost 1 extractor, 3 haulers');
    expect(raidEndText({ ...none, outcome: 'hit', lostEcon: { extractor: 1, hauler: 0 }, lostShips: { drone: 1, lancer: 2, flak: 1 } }, 'P2')).toBe('Raid hit P2: lost 1 extractor, 1 drone, 2 lancers, 1 flak');
    expect(raidEndText({ ...none, outcome: 'hit', lostShips: { drone: 4, lancer: 0, flak: 0 } }, 'A3')).toBe('Raid hit A3: lost 4 drones');
  });
  it('turned back and withered', () => {
    expect(raidEndText({ ...none, outcome: 'turnedBack' }, 'A5')).toBe('Raid turned back');
    expect(raidEndText({ ...none, outcome: 'withered' }, 'A5')).toBe('The raid withers with the hive.');
  });
});
