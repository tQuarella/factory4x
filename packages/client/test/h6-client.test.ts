/**
 * H6 client text and rules that need no DOM: the area sheet lines, the step moment, node states and lane modes, the combat line,
 * the tuning panel and the save flags. Every number comes from the sim or a live tunable; none is pinned.
 */
import { describe, expect, it } from 'vitest';
import { GUARD_TARGET_ORDER, areaStatus, campaignWorld, defaultData, fleetCap, overworldStatus, tunableMeta } from '@factory4x/sim';
import { Session } from '../src/session.ts';
import { decodeSave, encodeSave } from '../src/persist.ts';
import { GUARD_TARGET_LINE, fleetLimitText, stepMoment, stepNotice } from '../src/report.ts';
import { HIDDEN_TUNABLES } from '../src/panels.ts';
import { areaStateText, decayWord, farLine, haulLine, lockLine, relayLine } from '../src/worldsheets.ts';
import { laneDraws, laneMode, nodeState } from '../src/worldview.ts';

const data = defaultData;
const ids = data.map.areas.map((a) => a.id);
const idx = (id: string): number => ids.indexOf(id);
const name = (i: number): string => data.map.areas[i]!.name;

describe('node states and lane modes', () => {
  it('reclaimed, open, locked (known behind a band lock) and far', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'shoal'] });
    const ow = overworldStatus(w, data);
    const state = (id: string) => nodeState(ow.areas[idx(id)]!);
    expect(state('landfall')).toBe('reclaimed');
    expect(state('rime')).toBe('open');
    expect(state('deep')).toBe('far');
    // Whatever band 2 area a lane joins to a reclaimed one is known but locked, never open, until a band 1 relay is reclaimed.
    for (const a of ow.areas.filter((x) => x.band === 2 && x.known)) expect(nodeState(a)).toBe('locked');
  });

  it('a lane into a locked band is dim; the lanes of open bands are normal', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'] });
    const ow = overworldStatus(w, data);
    for (const l of laneDraws(w, data)) {
      const locked = ow.areas[l.from]!.locked || ow.areas[l.to]!.locked;
      expect(laneMode(ow, l)).toBe(locked ? 'dim' : 'normal');
    }
    const open = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'rime', 'glint'] }, );
    const ow2 = overworldStatus(open, data);
    expect(ow2.areas.filter((a) => a.band === 2).every((a) => !a.locked)).toBe(true);
  });

  it('with overworld.bandLock 0 nothing is locked', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'] });
    w.tun['overworld.bandLock'] = 0;
    expect(overworldStatus(w, data).areas.some((a) => a.locked)).toBe(false);
    expect(stepMoment(campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'rime'] }), data, idx('rime'))?.opens).toBe(2);
    const off = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'rime'] });
    off.tun['overworld.bandLock'] = 0;
    expect(stepMoment(off, data, idx('rime'))?.opens).toBeNull();
  });
});

describe('the area sheet lines', () => {
  const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'] });
  const st = (id: string, world = w) => areaStatus(world, data, idx(id));

  it('a locked area names the relays that open its band and has no other action', () => {
    const veil = st('veil');
    expect(veil.known).toBe(veil.lanes.some((l) => w.campaign.areas[l]!.reclaimedTick !== null));
    const line = lockLine(veil, name);
    expect(line).toBe(`Locked: reclaim a band 1 relay (${veil.unlockRelays.map(name).join(' or ')}).`);
    expect(line).toContain('Rime Relay');
    expect(line).toContain('Glint Relay');
    expect(lockLine(st('rime'), name)).toBe('');
  });

  it('a far area says it is unscouted, with its band and kind, and shows the lock line', () => {
    const deep = st('deep');
    expect(deep.known).toBe(false);
    expect(areaStateText(deep, data.tickRate)).toBe('Unscouted');
    expect(farLine(deep)).toBe('Band 3 · Area. Unscouted: reclaim a neighbour to scout it.');
    expect(farLine(st('mire'))).toBe('Band 2 · Command relay. Unscouted: reclaim a neighbour to scout it.');
    expect(lockLine(deep, name)).toContain('Locked: reclaim a band 2 relay');
  });

  it('a relay says what it does, from the limit now and after; a second relay of a band says it pays its haul only', () => {
    const rime = st('rime');
    const now = fleetCap(w, data);
    const line = relayLine(rime, rime.state, now, 2);
    expect(line).toBe(`Command relay: reclaim it to raise your fleet limit ${now} → ${rime.capAfter} and open band 2.`);
    expect(rime.capAfter).toBe(now! + w.tun['fleet.relayStep']);
    expect(relayLine(rime, rime.state, null, 2)).toBe('Command relay: reclaim it to open band 2.');
    expect(relayLine(st('shelf'), 'open', now, null)).toBe('');
    const second = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'rime'] });
    const glint = st('glint', second);
    expect(glint.commanded).toBe(true);
    expect(relayLine(glint, glint.state, fleetCap(second, data), 2)).toBe('Band 2 is already open: this relay pays its haul only.');
  });

  it('a repeat haul shows the decayed amount with its reason, a first haul none', () => {
    const first = st('shoal');
    expect(haulLine(first, false, w.tun['areas.repeatHaulPct'], name)).toBe(`Reclaim to haul ${data.map.areas[idx('shoal')]!.haul.ore} ore · ${data.map.areas[idx('shoal')]!.haul.crystal} crystal`);
    const repeat = st('shoal', campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'] }));
    // Frost Shelf and Glass Shoal are different sides (a group is tier and side), so a mate is only the same side: Rime after Shelf.
    expect(repeat.haulDecayed).toBe(false);
    const rime = st('rime');
    expect(rime.repeatOf).toBe(idx('shelf'));
    expect(rime.haulDecayed).toBe(w.tun['areas.repeatHaulPct'] < 100);
    const line = haulLine(rime, false, w.tun['areas.repeatHaulPct'], name);
    expect(line).toContain(`(${decayWord(w.tun['areas.repeatHaulPct'])}: Frost Shelf already reclaimed)`);
    expect(line).toContain(`${rime.haulNow.ore} ore`);
    expect(rime.haulNow.ore).toBe(Math.floor((data.map.areas[idx('rime')]!.haul.ore * w.tun['areas.repeatHaulPct']) / 100));
    expect(decayWord(50)).toBe('half');
    expect(decayWord(30)).toBe('30%');
  });
});

describe('the step moment', () => {
  it('fires for the first relay of a band only, with the limit before and after from the sim', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'rime'] });
    const s = stepMoment(w, data, idx('rime'))!;
    expect(s).toEqual({ band: 1, opens: 2, capBefore: fleetCap(w, data)! - w.tun['fleet.relayStep'], capAfter: fleetCap(w, data) });
    expect(stepNotice(s)).toBe(`Command relay reclaimed: fleet limit ${s.capBefore} → ${s.capAfter}. Band 2 is open.`);
    // A second relay of the same band, a non-relay and an unreclaimed relay give nothing.
    const both = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'shoal', 'rime', 'glint'] });
    expect(stepMoment(both, data, idx('glint'))).toBeNull();
    expect(stepMoment(both, data, idx('shelf'))).toBeNull();
    expect(stepMoment(w, data, idx('glint'))).toBeNull();
  });

  it('with the limit off it still opens the band; with both off there is nothing to say', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'rime'] });
    w.tun['fleet.cap'] = 0;
    const s = stepMoment(w, data, idx('rime'))!;
    expect(stepNotice(s)).toBe('Command relay reclaimed. Band 2 is open.');
    w.tun['overworld.bandLock'] = 0;
    expect(stepMoment(w, data, idx('rime'))).toBeNull();
  });

  it('the save keeps which steps were shown, so it never replays; an old save has none', () => {
    const s = new Session(data, { seed: 3 });
    s.flags.stepsShown.push(1);
    const out = decodeSave(encodeSave(s), data);
    expect(out.kind).toBe('resumed');
    if (out.kind === 'resumed') expect(out.session.flags.stepsShown).toEqual([1]);
    const raw = JSON.parse(encodeSave(s)) as { flags: Record<string, unknown> };
    delete raw.flags.stepsShown;
    const old = decodeSave(JSON.stringify(raw), data);
    if (old.kind === 'resumed') expect(old.session.flags.stepsShown).toEqual([]);
  });
});

describe('text and tuning', () => {
  it('the combat line, the fleet limit chip and the hidden starved tunables', () => {
    // The line is built from the sim's rule, and says what the spec says today.
    expect(GUARD_TARGET_LINE).toBe('Thorns strike Flak first; Spores strike Lancers first.');
    expect(GUARD_TARGET_LINE.toLowerCase()).toContain(`thorns strike ${GUARD_TARGET_ORDER.thorn[0]}`);
    expect(GUARD_TARGET_LINE.toLowerCase()).toContain(`spores strike ${GUARD_TARGET_ORDER.spore[0] === 'lancer' ? 'lancers' : 'flak'}`);
    expect(fleetLimitText(20)).toBe('Fleet limit 20');
    const keys = tunableMeta(data).map((m) => m.key);
    expect(keys.some((k) => k.startsWith('bloom.starved'))).toBe(true);
    expect(HIDDEN_TUNABLES.some((p) => 'bloom.starvedRegrowMul'.startsWith(p))).toBe(true);
    expect(HIDDEN_TUNABLES.some((p) => 'fleet.cap'.startsWith(p))).toBe(false);
  });
});
