import { describe, expect, it } from 'vitest';
import design from '../../../DESIGN.md?raw';
import shippedRaw from '../../../data/sim.json' with { type: 'json' };
import {
  OVERWORLD_FRAME,
  RAW_RESOURCES,
  RESEARCH_IDS,
  appliesAtLevel,
  defaultData,
  isTierRequirement,
  parseSimData,
  tunableMeta,
  worstHauls,
  type ResearchItem,
  type ResourceTriple,
  type SimData,
} from '../src/index.ts';
import { fixtureV10 } from './fixture.ts';
import rawV10 from './fixtures/sim-v10.json' with { type: 'json' };

/**
 * h6-sim acceptance 1, 4 and 5: data v10. The shipped data/sim.json is checked
 * against the DESIGN.md H6 tables ("Areas", "Area guards", "Research",
 * "Tunables (H6 …)"), the 16 lanes and the frame, so a retune edits data and
 * DESIGN.md together and no test. Nothing here pins a tuned number of its own.
 * The dataVersion pin lived here until h7-sim (now data-h7.test.ts). Validation is tested on the frozen v10
 * fixture (fixtures/sim-v10.json), which is the shipped data as h6-sim left it.
 */

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const strip = (cell: string): string => cell.replace(/`/g, '');

const h6At = design.indexOf('### H6 (Milestone 2, iteration 6');
const h4At = design.indexOf('### H4 (Milestone 2, iteration 4');

/** Body rows of the first Markdown table after `from` (searched from `at`), cells trimmed. */
function tableAfter(at: number, from: string): string[][] {
  if (at < 0) throw new Error('DESIGN.md is missing a spec section');
  const i = design.indexOf(from, at);
  if (i < 0) throw new Error(`DESIGN.md has no "${from}"`);
  const lines = design.slice(i).split('\n');
  const start = lines.findIndex((l) => l.startsWith('|'));
  const rows: string[][] = [];
  for (let k = start; k < lines.length && lines[k]!.startsWith('|'); k++) {
    if (!lines[k]!.startsWith('| ---')) rows.push(lines[k]!.split('|').slice(1, -1).map((c) => c.trim()));
  }
  return rows.slice(1);
}

/** The text of the H6 spec from `from` up to `until`. */
function h6Text(from: string, until: string): string {
  const i = design.indexOf(from, h6At);
  const j = design.indexOf(until, i);
  if (h6At < 0 || i < 0 || j < 0) throw new Error(`H6 spec has no "${from}" … "${until}"`);
  return design.slice(i, j);
}

const triple = (t: Readonly<ResourceTriple>): string => RAW_RESOURCES.map((r) => t[r]).join(' / ');

/** Areas in the row form of the H6 "Areas" table. */
const areaRows = (d: SimData): string[][] =>
  d.map.areas.map((a) => [a.id, a.name, String(a.tier), a.side, a.relay ? 'yes' : 'no', String(a.x), String(a.y), a.nodes.join(' '), triple(a.haul), triple(a.export)]);

/** Research levels in the row form of the "Research" tables. */
function researchRows(d: SimData): string[][] {
  const req = (it: ResearchItem, level: number): string => {
    const qs = it.requires.filter((q) => appliesAtLevel(q, level));
    if (qs.length === 0) return 'none';
    return qs
      .map((q) => {
        if (isTierRequirement(q)) throw new Error('no shipped H6 item has a tier requirement');
        if ('area' in q) return `${d.map.areas.find((a) => a.id === q.area)!.name} reclaimed`;
        return `${q.item} ${q.level}`;
      })
      .join(', ');
  };
  return d.research.flatMap((it) => it.levels.map((lv, k) => [it.id, it.name, it.kind, String(k + 1), String(lv.ore), String(lv.ice), String(lv.crystal), req(it, k + 1)]));
}

/** Guarded nodes of the areas with their own layout, in the "Area guards" row form: area, node, prize, slots, "T / S". */
function guardRows(d: SimData): string[][] {
  const out: string[][] = [];
  const heartSlots = d.map.nodes.find((n) => n.kind === 'heart')!.slots;
  for (const a of d.map.areas) {
    if (a.layout === 'seed') continue;
    for (const n of d.map.nodes) {
      if (!a.nodes.includes(n.id)) continue;
      if (n.kind === 'pocket') {
        const p = a.layout.pockets[n.id]!;
        out.push([a.id, n.id, p.prize, String(p.slots), `${p.thorns} / ${p.spores}`]);
      } else if (n.kind === 'heart') {
        out.push([a.id, n.id, 'ore', String(heartSlots), `${a.layout.heart.thorns} / ${a.layout.heart.spores}`]);
      }
    }
  }
  return out;
}

const sum = (d: SimData, res: keyof ResourceTriple): number => d.research.reduce((s, it) => s + it.levels.reduce((x, lv) => x + lv[res], 0), 0);

describe('data/sim.json (shipped) at H6', () => {
  // h7-sim: the dataVersion pin moved to data-h7.test.ts (v12). The H6 tables below still describe the shipped,
  // parked campaign data.

  it('matches the H6 "Areas" table (ten areas with side and relay)', () => {
    const rows = tableAfter(h6At, '#### Areas (H6, data `map.areas`)').map((r) => r.map(strip));
    expect(areaRows(defaultData)).toEqual(rows);
  });

  it('has the 16 spec lanes, and every area inside the spec frame (x 0–1000, y 0–2100)', () => {
    const lanes = [...h6Text('Lanes (undirected, 16):', 'What this means in play').matchAll(/`(\w+)–(\w+)`/g)].map((m) => `${m[1]}–${m[2]}`);
    expect(lanes).toHaveLength(16);
    expect(defaultData.map.lanes.map((l) => l.join('–'))).toEqual(lanes);
    const frame = /Frame x 0–(\d+), y 0–(\d+)\./.exec(design.slice(h6At))!;
    expect([OVERWORLD_FRAME.width, OVERWORLD_FRAME.height]).toEqual([Number(frame[1]), Number(frame[2])]);
    for (const a of defaultData.map.areas) {
      expect(a.x <= OVERWORLD_FRAME.width && a.y <= OVERWORLD_FRAME.height, a.id).toBe(true);
    }
  });

  it('no area includes the Root (H6 "Removing the Root"); the frame and the H3 layouts keep theirs for the frozen fixtures', () => {
    const rootId = defaultData.map.nodes.find((n) => n.kind === 'root')!.id;
    for (const a of defaultData.map.areas) {
      expect(a.nodes, a.id).not.toContain(rootId);
      if (a.layout !== 'seed') {
        expect(a.layout.root, a.id).toBeUndefined();
        expect(a.layout.heart.starvedThorns, a.id).toBeUndefined();
        expect(a.layout.heart.starvedSpores, a.id).toBeUndefined();
      }
    }
    for (const l of defaultData.map.layouts) expect(l.root, l.id).toBeDefined();
  });

  it('matches the H6 "Area guards" table; the areas it calls unchanged match the H4 table rows (data v9); The Deep plays the H3 layouts', () => {
    const rows = tableAfter(h6At, '#### Area guards (H6)');
    const deepRow = rows.find((r) => r[0] === 'deep')!;
    expect(deepRow[1]).toBe('all');
    expect(defaultData.map.areas.find((a) => a.id === 'deep')!.layout).toBe('seed');
    const unchanged = /Unchanged areas: (.+) as data v9\./.exec(h6Text('#### Area guards (H6)', '#### Fleet limit'))![1]!.split(/, | and /);
    const ids = unchanged.map((name) => defaultData.map.areas.find((a) => a.name === name)!.id);
    expect(ids).toEqual(['landfall', 'shelf', 'shoal']);
    // The H4 rows for those areas: area, node, prize, slots, guards (the tag column is H4's own).
    const h4Rows = tableAfter(h4At, '**Area guards**')
      .filter((r) => ids.includes(r[0]!))
      .map((r) => r.slice(0, 5));
    const h6Rows = rows.filter((r) => r[0] !== 'deep');
    const want = defaultData.map.areas.flatMap((a) => (ids.includes(a.id) ? h4Rows : h6Rows).filter((r) => r[0] === a.id));
    expect(guardRows(defaultData)).toEqual(want);
  });

  it('matches the H6 "Research" table and its totals line: no Command limit', () => {
    const rows = tableAfter(h6At, '#### Research (H6, data `research`)').map((r) => r.slice(0, 8).map(strip));
    expect(researchRows(defaultData)).toEqual(rows);
    const totals = /Totals over every level: (\d+) ore, (\d+) ice, (\d+) crystal/.exec(design.slice(h6At))!;
    expect([sum(defaultData, 'ore'), sum(defaultData, 'ice'), sum(defaultData, 'crystal')]).toEqual([Number(totals[1]), Number(totals[2]), Number(totals[3])]);
    expect(defaultData.research.map((r) => r.id)).not.toContain('fleet');
    expect(defaultData.research.map((r) => r.kind)).not.toContain('limit');
  });

  it('matches the "Tunables (H6 …)" table: all three live sim tunables; research.fleet.step is gone; fleet.cap and fleet.recycleRefundPct keep the H5 rows', () => {
    const rows = tableAfter(h6At, '#### Tunables (H6, data/sim.json, all integers)');
    const keys = rows.map((r) => strip(r[0]!));
    expect(keys.sort()).toEqual(['areas.repeatHaulPct', 'fleet.relayStep', 'overworld.bandLock']);
    for (const [key = '', def = '', range = ''] of rows) {
      const k = strip(key) as keyof SimData['tunables'];
      const [min, max] = range.split('–').map(Number);
      expect(defaultData.tunables[k], k).toEqual({ default: Number(def), min, max });
    }
    const meta = tunableMeta(defaultData).filter((m) => keys.includes(m.key));
    expect(meta.map((m) => [m.key, m.live, m.newRunOnly, m.scope]).sort()).toEqual(keys.map((k) => [k, true, false, 'sim']).sort());
    expect(h6Text('All three are live.', '#### Save')).toContain('Removed: `research.fleet.step`');
    expect(Object.keys(shippedRaw.tunables)).not.toContain('research.fleet.step');
    for (const [key = '', def = '', range = ''] of tableAfter(design.indexOf('### H5 (Milestone 2, iteration 5'), '#### Tunables (H5, data/sim.json, all integers)')) {
      const k = strip(key);
      if (k !== 'fleet.cap' && k !== 'fleet.recycleRefundPct') continue;
      const [min, max] = range.split('–').map(Number);
      expect(defaultData.tunables[k], k).toEqual({ default: Number(def), min, max });
    }
  });

  it('keeps the H6 haul invariant with every area at its worst position (calibration-proof: only the bound is asserted)', () => {
    const worst = worstHauls(defaultData.map.areas, defaultData.tunables['areas.repeatHaulPct'].default);
    for (const res of RAW_RESOURCES) expect(worst[res], res).toBeGreaterThanOrEqual(sum(defaultData, res));
  });
});

describe('the frozen v10 fixture', () => {
  it('is the shipped data as h6-sim left it: the spec bound line holds for its starting values', () => {
    expect(fixtureV10.dataVersion).toBe(10);
    const line = /At the starting values above the bound is (\d+) \/ (\d+) \/ (\d+) against (\d+) \/ (\d+) \/ (\d+)\./.exec(design.slice(h6At))!;
    const worst = worstHauls(fixtureV10.map.areas, fixtureV10.tunables['areas.repeatHaulPct'].default);
    expect([worst.ore, worst.ice, worst.crystal]).toEqual([Number(line[1]), Number(line[2]), Number(line[3])]);
    expect([sum(fixtureV10, 'ore'), sum(fixtureV10, 'ice'), sum(fixtureV10, 'crystal')]).toEqual([Number(line[4]), Number(line[5]), Number(line[6])]);
  });
});

describe('parseSimData rejects bad H6 data', () => {
  type Raw = typeof rawV10;
  type RawArea = Record<string, unknown> & { tier: number; nodes: string[]; haul: ResourceTriple };
  const bad = (edit: (d: Raw) => void, msg: RegExp): void => {
    const d = clone(rawV10);
    edit(d);
    expect(() => parseSimData(d)).toThrow(msg);
  };
  const ok = (edit: (d: Raw) => void): void => {
    const d = clone(rawV10);
    edit(d);
    expect(() => parseSimData(d)).not.toThrow();
  };
  const area = (d: Raw, id: string): RawArea => d.map.areas.find((a) => a.id === id)! as unknown as RawArea;

  it('every area has a side (ice, crystal or none) and a relay flag', () => {
    bad((d) => delete area(d, 'shelf').side, /map\.areas\[1\]\.side must be one of ice, crystal, none/);
    bad((d) => (area(d, 'shelf').side = 'ore'), /side must be one of ice, crystal, none/);
    bad((d) => delete area(d, 'rime').relay, /relay must be true or false/);
    bad((d) => (area(d, 'rime').relay = 1), /relay must be true or false/);
  });

  it('a relay stands in tier 1 or 2 only', () => {
    bad((d) => (area(d, 'landfall').relay = true), /is a relay in tier 0: relays stand in tiers 1–2 only/);
    bad((d) => (area(d, 'deep').relay = true), /is a relay in tier 3: relays stand in tiers 1–2 only/);
    ok((d) => (area(d, 'shelf').relay = true));
    ok((d) => (area(d, 'veil').relay = true));
  });

  it('every area lies inside the frame (x 0–1000, y 0–2100; the edges are fine)', () => {
    bad((d) => (area(d, 'deep').y = 2101), /outside the overworld frame 1000 × 2100/);
    bad((d) => (area(d, 'shoal').x = 1001), /outside the overworld frame/);
    ok((d) => {
      area(d, 'deep').y = 2100;
      area(d, 'shoal').x = 1000;
    });
  });

  it('The Deep may leave out the Root, but no other frame node', () => {
    bad((d) => (area(d, 'deep').nodes = area(d, 'deep').nodes.filter((n) => n !== 'a9')), /must have every frame node but the Root \(missing a9\)/);
    ok((d) => area(d, 'deep').nodes.push('root'));
  });

  it('the haul invariant counts every repeat-group area at its decayed haul (worst position), floored per area', () => {
    // At the default 50%, ice is 310 at worst against 220. Taking 91 from The Deep (no group: never decays) leaves 219.
    // The plain sum would still be 429, so only the worst-position rule rejects it.
    bad((d) => (area(d, 'deep').haul.ice = 9), /total ice haul 219 \(every area at its worst position, areas\.repeatHaulPct 50\) is below the total research cost 220/);
    ok((d) => (area(d, 'deep').haul.ice = 10));
    // 100% is no decay: the plain sum.
    ok((d) => {
      area(d, 'deep').haul.ice = 9;
      d.tunables['areas.repeatHaulPct'].default = 100;
    });
    // 33% doesn't divide evenly: each area is floored on its own (26 + 19 + 6 + 29 + 19 + 23 + 13 = 135), so The Deep
    // needs 85 ice. Flooring the group total instead (floor(420 × 33 / 100) = 138) would wrongly accept 84.
    const at33 = (deepIce: number) => (d: Raw) => {
      d.tunables['areas.repeatHaulPct'].default = 33;
      area(d, 'deep').haul.ice = deepIce;
    };
    ok(at33(85));
    bad(at33(84), /total ice haul 219 \(every area at its worst position, areas\.repeatHaulPct 33\) is below the total research cost 220/);
    // 0%: every grouped area counts nothing; only Landfall and The Deep (side none) remain.
    bad((d) => (d.tunables['areas.repeatHaulPct'].default = 0), /total ore haul 1020 \(.*areas\.repeatHaulPct 0\) is below the total research cost 1660/);
  });

  it('a band locked by default needs a relay in the band below; with the lock off by default it does not', () => {
    bad((d) => (area(d, 'rime').relay = area(d, 'glint').relay = false), /veil is in band 2, which overworld.bandLock keeps locked, but band 1 has no relay to open it/);
    bad((d) => (area(d, 'mire').relay = area(d, 'spire').relay = false), /deep is in band 3, which overworld.bandLock keeps locked, but band 2 has no relay/);
    ok((d) => {
      area(d, 'rime').relay = area(d, 'glint').relay = false;
      d.tunables['overworld.bandLock'].default = 0;
    });
    ok((d) => (area(d, 'rime').relay = false));
  });

  it('Command limit is gone: the fleet item, kind limit and research.fleet.step are rejected', () => {
    const fleetItem = { id: 'fleet', name: 'Command limit', kind: 'limit', levels: [{ ore: 60, ice: 20, crystal: 20 }], requires: [] };
    bad((d) => (d.research as unknown[]).push(fleetItem), /fleet \(Command limit\) was removed at H6/);
    bad((d) => ((d.research[2] as { kind: string }).kind = 'limit'), /kind must be design, grind or win/);
    bad((d) => ((d.tunables as Record<string, unknown>)['research.fleet.step'] = { default: 6, min: 2, max: 12 }), /unknown tunable research\.fleet\.step/);
    // The id stays in RESEARCH_IDS only for the H5 client's types; data never needs it.
    expect(RESEARCH_IDS).toContain('fleet');
    ok((d) => (d.research = d.research.filter((r) => r.id !== 'fleet')));
  });
});
