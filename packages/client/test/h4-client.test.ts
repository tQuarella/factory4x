import { describe, expect, it } from 'vitest';
import {
  areaStatus,
  campaignStatus,
  campaignWorld,
  defaultData,
  landingEffects,
  replayHashes,
  researchStatus,
  worldHash,
  type CampaignStart,
  type Input,
} from '@factory4x/sim';
import { Session } from '../src/session.ts';
import { decodeSave, encodeSave } from '../src/persist.ts';
import {
  COMPONENT_SOURCE,
  effectText,
  exportX10,
  landingNotice,
  openedByReclaim,
  plusText,
  purchaseNotice,
  ratesX10Text,
  reclaimNotice,
  researchBlock,
  shippedNotice,
  tripleText,
  unlockNotice,
  withdrawNotice,
} from '../src/report.ts';
import { YARD_STATE_TEXT } from '../src/sheet.ts';
import { fitOverworld } from '../src/fit.ts';
import { hopsFromStart, labelSides, laneDraws, prizeOf } from '../src/worldview.ts';
import { areaStateText, guardedRowText } from '../src/worldsheets.ts';

const data = defaultData;
const ids = data.map.areas.map((a) => a.id);
const idx = (id: string): number => ids.indexOf(id);

function stepTicks(s: Session, n: number): void {
  for (let i = 0; i < n; i++) s.stepOnce();
}

describe('a new session starts on the overworld', () => {
  it('has no area active, and does not tick on its own', () => {
    const s = new Session(data, { seed: 5 });
    expect(s.onOverworld).toBe(true);
    expect(s.world.nodes).toHaveLength(0);
    expect(s.advance(2000)).toBe(0);
    expect(s.world.tick).toBe(0);
    expect(s.acc).toBe(0);
  });

  it('applies an input at once (one tick) and logs it, running or paused', () => {
    const s = new Session(data, { seed: 5 });
    expect(s.send({ type: 'enterArea', area: idx('landfall') })).toBe(true);
    expect(s.world.campaign.active).toBe(idx('landfall'));
    expect(s.world.tick).toBe(1);
    expect(s.log).toEqual([{ tick: 0, input: { type: 'enterArea', area: idx('landfall') } }]);
    expect(s.onOverworld).toBe(false);
  });

  it('only the open area can be entered; a held one is dropped and not logged', () => {
    const s = new Session(data, { seed: 5 });
    expect(s.send({ type: 'enterArea', area: idx('shelf') })).toBe(false);
    expect(s.log).toHaveLength(0);
    expect(s.world.tick).toBe(0);
  });

  it('a withdraw returns to the overworld on the next tick and the area resets', () => {
    const s = new Session(data, { seed: 5 });
    s.send({ type: 'enterArea', area: idx('landfall') });
    stepTicks(s, 90);
    expect(s.send({ type: 'leaveArea' })).toBe(true);
    s.advance(s.tickMs * 2);
    expect(s.onOverworld).toBe(true);
    expect(s.world.campaign.areas[idx('landfall')]!.withdrawals).toBe(1);
    expect(s.world.campaign.areas[idx('landfall')]!.reclaimedTick).toBeNull();
  });

  it('the replay (no start) reproduces the world across landing, play and a withdraw', () => {
    const s = new Session(data, { seed: 9 });
    s.send({ type: 'enterArea', area: idx('landfall') });
    stepTicks(s, 200);
    const inputs: Input[] = [{ type: 'buildExtractor', node: s.world.nodes.findIndex((n) => n.id === 'a1') }];
    s.sendAll(inputs);
    stepTicks(s, 300);
    s.send({ type: 'leaveArea' });
    stepTicks(s, 5);
    expect(s.replay().start).toBeUndefined();
    expect(replayHashes(s.replay(), data, s.world.tick, s.world.tick)[0]).toBe(worldHash(s.world));
  });
});

describe('a constructed start is part of the replay and the save', () => {
  const start: CampaignStart = { reclaimed: ['landfall', 'shelf'], research: { opening: 1 }, stockpile: { ore: 500 }, land: 'shoal' };

  it('replays from the start, and a resumed save keeps it', () => {
    const s = new Session(data, { seed: 4, start });
    stepTicks(s, 400);
    expect(s.replay().start).toEqual(start);
    expect(replayHashes(s.replay(), data, s.world.tick, s.world.tick)[0]).toBe(worldHash(s.world));
    const out = decodeSave(encodeSave(s), data);
    expect(out.kind).toBe('resumed');
    if (out.kind !== 'resumed') return;
    expect(out.session.replay()).toEqual(s.replay());
    expect(worldHash(out.session.world)).toBe(worldHash(s.world));
  });

  it('keeps the shipped-at-landing flag through a save', () => {
    const s = new Session(data, { seed: 4, start });
    s.flags.shippedAtLanding = { ore: 3, ice: 1, crystal: 0 };
    const out = decodeSave(encodeSave(s), data);
    if (out.kind !== 'resumed') throw new Error('not resumed');
    expect(out.session.flags.shippedAtLanding).toEqual({ ore: 3, ice: 1, crystal: 0 });
  });
});

describe('an H3 (data v5) save is refused with the data-version reason', () => {
  it('discards it so the fresh-start toast shows', () => {
    const s = new Session(data, { seed: 1 });
    const parsed = JSON.parse(encodeSave(s)) as Record<string, unknown>;
    const inner = JSON.parse(parsed.world as string) as Record<string, unknown>;
    inner.dataVersion = 5;
    parsed.world = JSON.stringify(inner);
    const out = decodeSave(JSON.stringify(parsed), data);
    expect(out).toEqual({ kind: 'discarded', reason: 'dataVersion', saveDataVersion: 5 });
  });
});

describe('overworld text comes from selectors and live tunables', () => {
  it('formats resource triples, rates and shipments', () => {
    expect(tripleText({ ore: 300, ice: 60, crystal: 30 })).toBe('300 ore · 60 ice · 30 crystal');
    expect(tripleText({ ore: 150, ice: 0, crystal: 0 })).toBe('150 ore');
    expect(tripleText({ ore: 0, ice: 0, crystal: 0 })).toBe('nothing');
    expect(plusText({ ore: 56, ice: 12, crystal: 0 })).toBe('+56 ore +12 ice');
    expect(ratesX10Text({ ore: 40, ice: 25, crystal: 0 })).toBe('+4 ore +2.5 ice/min');
    expect(exportX10({ ore: 5, ice: 3, crystal: 0 }, 100)).toEqual({ ore: 50, ice: 30, crystal: 0 });
    expect(exportX10({ ore: 5, ice: 3, crystal: 0 }, 0)).toEqual({ ore: 0, ice: 0, crystal: 0 });
    expect(exportX10({ ore: 5, ice: 3, crystal: 0 }, 250)).toEqual({ ore: 125, ice: 75, crystal: 0 });
  });

  it('the landing notice names every research effect in play, and only those', () => {
    const none = landingEffects(campaignWorld(1, data, {}));
    expect(landingNotice('Glass Shoal', none)).toBe(`Landed in Glass Shoal · ${none.openingOre} ore`);
    const w = campaignWorld(1, data, { reclaimed: ['landfall'], research: { opening: 2, extract: 1, rigs: 2, yards: 1, lancer: 1, flak: 1 } });
    const fx = landingEffects(w);
    const text = landingNotice('Glass Shoal', fx);
    expect(text).toContain(`${fx.openingOre} ore`);
    expect(text).toContain('A1 and A2 rigs running');
    expect(text).toContain(`extraction +${fx.extractPct - 100}%`);
    expect(text).toContain(`ships build ${100 - fx.yardTimePct}% faster`);
    expect(text).toContain('Lancer and Flak yards on');
    const one = landingNotice('X', landingEffects(campaignWorld(1, data, { research: { extract: 1, rigs: 1 } })));
    expect(one).toContain('A1 rig running');
    expect(one).not.toContain('A2');
    expect(one).not.toContain('yard');
  });

  it('return notices: shipped (only if non-zero), reclaim with what it opened, withdraw', () => {
    expect(shippedNotice('Spore Veil', { ore: 56, ice: 12, crystal: 0 })).toBe('Shipped while you were in Spore Veil: +56 ore +12 ice');
    expect(shippedNotice('Spore Veil', { ore: 0, ice: 0, crystal: 0 })).toBe('');
    expect(reclaimNotice('Thorn Garden', { ore: 300, ice: 30, crystal: 60 }, ['The Deep'])).toBe('Thorn Garden reclaimed: +300 ore +30 ice +60 crystal. Opened: The Deep.');
    expect(reclaimNotice('Landfall', { ore: 150, ice: 0, crystal: 0 }, [])).toBe('Landfall reclaimed: +150 ore.');
    expect(withdrawNotice('Frost Shelf')).toContain('Withdrew from Frost Shelf');
    expect(withdrawNotice('Frost Shelf')).toContain('research and the stockpile are kept');
  });

  it('openedByReclaim names the neighbours this reclaim opened, not ones already open', () => {
    const afterLandfall = campaignWorld(1, data, { reclaimed: ['landfall'] });
    expect(openedByReclaim(afterLandfall, data, idx('landfall'))).toEqual(['Frost Shelf', 'Glass Shoal']);
    const afterShelf = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'] });
    expect(openedByReclaim(afterShelf, data, idx('shelf'))).toEqual(['Spore Veil']);
    const afterVeil = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'veil'] });
    expect(openedByReclaim(afterVeil, data, idx('veil'))).toEqual(['Thorn Garden', 'The Deep']);
    const bothMedium = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'veil', 'garden'] });
    expect(openedByReclaim(bothMedium, data, idx('garden'))).toEqual([]);
  });

  it('a disabled research button says why: items, then areas, then the shortest missing resource', () => {
    const itemLabel = (id: string, level: number): string => `${id} ${level}`;
    const areaName = (id: string): string => id;
    const rigs = researchStatus(campaignWorld(1, data, {}), data).find((r) => r.id === 'rigs')!;
    expect(researchBlock(rigs, itemLabel, areaName)).toBe('Needs extract 1');
    const core = researchStatus(campaignWorld(1, data, { research: { lancer: 1, flak: 1 } }), data).find((r) => r.id === 'core')!;
    expect(researchBlock(core, itemLabel, areaName)).toBe('Needs deep reclaimed');
    const lancer = researchStatus(campaignWorld(1, data, { stockpile: { ore: 1000, ice: 0, crystal: 10 } }), data).find((r) => r.id === 'lancer')!;
    expect(researchBlock(lancer, itemLabel, areaName)).toBe(`Needs ${lancer.missing.resources.crystal} crystal`);
    const maxed = researchStatus(campaignWorld(1, data, { research: { opening: 3 } }), data).find((r) => r.id === 'opening')!;
    expect(researchBlock(maxed, itemLabel, areaName)).toBe('Max');
  });

  it('the research effect lines come from the row numbers and live tunables', () => {
    const w = campaignWorld(1, data, { research: { opening: 1, extract: 1, rigs: 1, yards: 1 } });
    const rows = researchStatus(w, data);
    const line = (id: string): string => {
      const r = rows.find((x) => x.id === id)!;
      return effectText(r, w.tun, w.tickRate);
    };
    const opening = rows.find((r) => r.id === 'opening')!;
    expect(line('opening')).toBe(`Opening ore ${opening.effect} → ${opening.nextEffect} per landing`);
    expect(line('extract')).toMatch(/^Extractors \d+(\.\d)? → \d+(\.\d)? ore\/min$/);
    expect(line('yards')).toMatch(/^Ship build \d+\.\d → \d+\.\d s$/);
    expect(line('rigs')).toBe('A1 mined → A1 and A2 mined');
    const fresh = researchStatus(campaignWorld(1, data, {}), data);
    expect(effectText(fresh.find((r) => r.id === 'rigs')!, w.tun, w.tickRate)).toBe('Land with A1 mined');
  });

  it('a purchase notice says what changed', () => {
    const w = campaignWorld(1, data, { research: { extract: 2, opening: 1, rigs: 1, yards: 1 } });
    const rows = researchStatus(w, data);
    const rig = landingEffects(w).rigNodes;
    const get = (id: string): ReturnType<typeof researchStatus>[number] => rows.find((r) => r.id === id)!;
    expect(purchaseNotice(get('extract'), rig)).toBe(`Extraction 2: extractors now yield +${get('extract').effect - 100}%`);
    expect(purchaseNotice(get('opening'), rig)).toContain(`${get('opening').effect} ore`);
    expect(purchaseNotice(get('rigs'), rig)).toContain('A1 already mined');
    expect(purchaseNotice(get('yards'), rig)).toBe(`Fast yards 1: ships build ${100 - get('yards').effect}% faster`);
  });

  it('the unlock notice says what the yard is doing', () => {
    expect(unlockNotice('lancer')).toContain('Turn on the Lancer yard');
    expect(unlockNotice('lancer', 'on')).toContain('The Lancer yard is on');
    expect(unlockNotice('flak', 'needsDesign')).toContain('Flak design is not researched');
  });

  it('the two new yard states read as the spec words them', () => {
    expect(YARD_STATE_TEXT.needsDesign(null)).toBe('Design not researched (Research, on the overworld)');
    expect(YARD_STATE_TEXT.noSource('lens')).toBe('No crystal here: no lens source in this area');
    expect(YARD_STATE_TEXT.noSource('plating')).toBe('No ice here: no plating source in this area');
    expect(COMPONENT_SOURCE.lens).toBe('crystal');
  });
});

describe('area sheet text', () => {
  it('the state line', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall'] });
    const st = (id: string) => areaStatus(w, data, idx(id));
    expect(areaStateText(st('shelf'), data.tickRate)).toBe('Open');
    expect(areaStateText(st('veil'), data.tickRate)).toBe('Held: reclaim a neighbour first');
    expect(areaStateText({ state: 'reclaimed', record: { ...st('landfall').record, reclaimPlayTicks: 492 * data.tickRate } }, data.tickRate)).toBe('Reclaimed in 8:12');
  });

  it('guarded rows show the caps the sim reports, Root-fed on a fed heart, and the starved caps', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf', 'shoal'] });
    const st = areaStatus(w, data, idx('veil'));
    expect(st.hasRoot).toBe(true);
    const heart = st.guarded[st.guarded.length - 1]!;
    const row = guardedRowText(heart, st.hasRoot);
    expect(row.title).toBe('Heart · Ore');
    expect(row.counts).toContain(`${heart.caps.thorn} Thorn`);
    expect(row.counts).toContain(`${heart.caps.spore} Spore`);
    expect(row.counts).toContain('Root-fed');
    expect(heart.starvedCaps).not.toBeNull();
    expect(row.starved).toContain(`${heart.starvedCaps!.spore} Spore`);
    const landfall = areaStatus(w, data, idx('landfall'));
    expect(guardedRowText(landfall.guarded[0]!, false).counts).toBe('no guards');
  });

  it('every area picks a prize icon from its haul; The Deep draws the probe core instead', () => {
    const prize = (id: string) => prizeOf(areaStatus(campaignWorld(1, data, {}), data, idx(id)));
    expect(prize('landfall')).toBe('ore');
    expect(prize('shelf')).toBe('ice');
    expect(prize('shoal')).toBe('crystal');
  });
});

describe('overworld layout helpers', () => {
  it('hops from Landfall order the lane ends toward it', () => {
    const hops = hopsFromStart(data);
    expect(hops[idx('landfall')]).toBe(0);
    expect(hops[idx('shelf')]).toBe(1);
    expect(hops[idx('deep')]).toBe(3);
    const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'] });
    const lanes = laneDraws(w, data);
    expect(lanes).toHaveLength(data.map.lanes.length);
    for (const l of lanes) expect(hops[l.from]! >= hops[l.to]!).toBe(true);
    const find = (a: string, b: string) => lanes.find((l) => [ids[l.from], ids[l.to]].sort().join() === [a, b].sort().join())!;
    expect(find('landfall', 'shelf').state).toBe('owned');
    expect(ids[find('landfall', 'shelf').from]).toBe('shelf');
    expect(find('landfall', 'shoal').state).toBe('open');
    expect(find('shelf', 'veil').state).toBe('open');
    expect(find('veil', 'deep').state).toBe('closed');
  });

  it('fits the six areas on 375x667 with nodes at least 44 px across and labels inside the canvas', () => {
    // Canvas height at 375x667 under the two-row HUD (about 100 px) and one notice row (about 50 px).
    for (const [w, h] of [[375, 500], [375, 540], [390, 600], [1000, 800]] as const) {
      const fit = fitOverworld(data.map.areas, 80, w, h);
      expect(80 * fit.scale * 2, `${w}x${h}`).toBeGreaterThanOrEqual(44);
      for (const a of data.map.areas) {
        const x = fit.ox + a.x * fit.scale;
        const y = fit.oy + a.y * fit.scale;
        const r = 80 * fit.scale;
        expect(x - r, 'left').toBeGreaterThanOrEqual(0);
        expect(x + r, 'right').toBeLessThanOrEqual(w);
        expect(y - r - 30, 'top with a label above').toBeGreaterThanOrEqual(-1);
        expect(y + r + 30, 'bottom with two label lines').toBeLessThanOrEqual(h + 1);
      }
    }
  });

  it('label sides keep each label inside the canvas', () => {
    const fit = fitOverworld(data.map.areas, 80, 375, 520);
    const centers = data.map.areas.map((a) => ({ x: fit.ox + a.x * fit.scale, y: fit.oy + a.y * fit.scale }));
    const lanes = data.map.lanes.map(([a, b]): [number, number] => [idx(a), idx(b)]);
    const r = 80 * fit.scale;
    const sides = labelSides(centers, lanes, r, 375, 520);
    sides.forEach((side, i) => {
      const c = centers[i]!;
      const top = side === 'above' ? c.y - r - 33 : c.y + r + 3;
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top + 30).toBeLessThanOrEqual(520);
    });
  });
});

describe('campaign HUD numbers', () => {
  it('the stockpile and shipping rates come from campaignStatus', () => {
    const w = campaignWorld(1, data, { reclaimed: ['landfall', 'shelf'], stockpile: { ore: 12, ice: 3, crystal: 0 } });
    const st = campaignStatus(w, data);
    expect(st.stockpile).toEqual({ ore: 12, ice: 3, crystal: 0 });
    expect(st.reclaimed).toBe(2);
    const exp = data.map.areas.filter((a) => ['landfall', 'shelf'].includes(a.id)).reduce((n, a) => n + a.export.ore, 0);
    expect(st.shipPerMinX10.ore).toBe(Math.floor((exp * w.tun['shipments.pct']) / 10));
  });
});
