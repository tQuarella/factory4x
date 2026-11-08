import { describe, expect, it } from 'vitest';
import design from '../../../DESIGN.md?raw';
import shippedRaw from '../../../data/sim.json' with { type: 'json' };
import {
  RAW_RESOURCES,
  areaStatus,
  counterTag,
  createWorld,
  defaultData,
  parseSimData,
  tagFor,
  tunableMeta,
  type GuardCounts,
  type ResearchItem,
  type SimData,
} from '../src/index.ts';
import { fixtureData } from './fixture.ts';
import rawData from './fixtures/sim-v4.json' with { type: 'json' };

/**
 * h4-sim acceptance 2 and 3: the H4 data (map.areas, map.lanes, research and
 * the H4 tunables). The shipped data/sim.json is checked against the DESIGN.md
 * H4 tables ("Areas", "Area guards", "Research", "Tunables (H4 …)"), so a
 * retune edits data and DESIGN.md together and no test. The frozen fixture
 * carries the spec's H4 values as they were at h4-sim, for the rule tests.
 */

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const h4At = design.indexOf('### H4 (Milestone 2, iteration 4');

/** Body rows of the first Markdown table between `from` and `until`, searched from the H4 spec on (cells trimmed). */
function h4Table(from: string, until: string): string[][] {
  if (h4At < 0) throw new Error('DESIGN.md has no H4 spec');
  const at = design.indexOf(from, h4At);
  if (at < 0) throw new Error(`H4 spec has no "${from}"`);
  const end = design.indexOf(until, at + from.length);
  if (end < 0) throw new Error(`H4 spec has no "${until}" after "${from}"`);
  return design
    .slice(at, end)
    .split('\n')
    .filter((l) => l.startsWith('|') && !l.startsWith('| ---'))
    .slice(1)
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

const strip = (cell: string): string => cell.replace(/`/g, '');

/** Areas in the row form of the DESIGN.md "Areas" table. */
const areaRows = (d: SimData): string[][] =>
  d.map.areas.map((a) => [
    a.id,
    a.name,
    String(a.tier),
    String(a.x),
    String(a.y),
    a.nodes.length === d.map.nodes.length ? 'all 16' : a.nodes.join(' '),
    RAW_RESOURCES.map((r) => a.haul[r]).join(' / '),
    RAW_RESOURCES.map((r) => a.export[r]).join(' / '),
  ]);

/** Research levels in the row form of the DESIGN.md "Research" table (without the effect column). */
function researchRows(d: SimData): string[][] {
  const req = (it: ResearchItem): string =>
    it.requires.length === 0
      ? 'none'
      : it.requires.map((q) => ('area' in q ? `${d.map.areas.find((a) => a.id === q.area)!.name} reclaimed` : `${q.item} ${q.level}`)).join(', ');
  return d.research.flatMap((it) => it.levels.map((lv, k) => [it.id, it.name, it.kind, String(k + 1), String(lv.ore), String(lv.ice), String(lv.crystal), req(it)]));
}

/** The H4 tunables, as the spec gives them: key → [default, min, max]. */
const H4_TUNABLES: Record<string, [number, number, number]> = {
  'research.opening.step': [40, 10, 150],
  'research.extract.stepPct': [25, 10, 50],
  'research.yards.stepPct': [20, 10, 40],
  'research.costPct': [100, 25, 100],
  'shipments.pct': [100, 0, 300],
};

describe('the frozen fixture carries the H4 spec values (as of h4-sim)', () => {
  it('has the H4 tunables at their spec defaults and ranges, and keeps its v4 startStock', () => {
    for (const [k, [d, min, max]] of Object.entries(H4_TUNABLES)) {
      expect(fixtureData.tunables[k as keyof SimData['tunables']], k).toEqual({ default: d, min, max });
    }
    expect(fixtureData.tunables['economy.startStock']).toEqual({ default: 30, min: 0, max: 200 });
  });

  it('has the six areas, seven lanes and seven research items of the h4-sim spec', () => {
    expect(areaRows(fixtureData)).toEqual([
      ['landfall', 'Landfall', '0', '500', '1150', 'probe a1 a2 a3 a4 a5 heart', '150 / 0 / 0', '4 / 0 / 0'],
      ['shelf', 'Frost Shelf', '1', '220', '870', 'probe a1 a2 a3 a5 p1 heart', '150 / 80 / 0', '3 / 2 / 0'],
      ['shoal', 'Glass Shoal', '1', '780', '870', 'probe a1 a2 a4 a5 p1 heart', '150 / 0 / 80', '3 / 0 / 2'],
      ['veil', 'Spore Veil', '2', '220', '520', 'probe a1 a2 a3 a4 a5 a6 a7 p1 p2 root heart', '300 / 60 / 30', '5 / 3 / 0'],
      ['garden', 'Thorn Garden', '2', '780', '520', 'probe a1 a2 a3 a4 a5 a6 a7 p1 p2 root heart', '300 / 30 / 60', '5 / 0 / 3'],
      ['deep', 'The Deep', '3', '500', '200', 'all 16', '650 / 60 / 60', '8 / 3 / 3'],
    ]);
    expect(fixtureData.map.lanes.map((l) => l.join('–'))).toEqual([
      'landfall–shelf',
      'landfall–shoal',
      'shelf–veil',
      'shoal–garden',
      'veil–garden',
      'veil–deep',
      'garden–deep',
    ]);
    expect(researchRows(fixtureData).map((r) => r.slice(0, 7).join(' '))).toEqual([
      'lancer Lancer design design 1 60 0 40',
      'flak Flak design design 1 60 40 0',
      'opening Opening ore grind 1 50 0 0',
      'opening Opening ore grind 2 100 0 0',
      'opening Opening ore grind 3 150 0 0',
      'extract Extraction grind 1 60 0 0',
      'extract Extraction grind 2 120 0 0',
      'extract Extraction grind 3 180 0 0',
      'rigs Seed rigs grind 1 100 0 0',
      'rigs Seed rigs grind 2 200 0 0',
      'yards Fast yards grind 1 60 20 20',
      'yards Fast yards grind 2 120 40 40',
      'core Probe core win 1 400 120 120',
    ]);
  });
});

describe('data/sim.json (shipped) against the DESIGN.md H4 tables', () => {
  it('is data version 6', () => {
    expect(defaultData.dataVersion).toBe(6);
  });

  it('matches the "Areas" table', () => {
    const rows = h4Table('#### Areas (data `map.areas`)', '**Area guards**').map((r) => r.map(strip));
    expect(areaRows(defaultData)).toEqual(rows);
  });

  it('has the spec lanes, all undirected pairs of known areas', () => {
    const line = design.slice(h4At).match(/Lanes \(data `map\.lanes`, undirected\): (.+)\./)![1]!;
    const spec = line.split(', ').map((l) => strip(l));
    expect(defaultData.map.lanes.map((l) => l.join('–'))).toEqual(spec);
  });

  it('matches the "Area guards" table: prize, slots and guard counts per guarded node', () => {
    const rows = h4Table('**Area guards**', 'How an H3 field is cut down').filter((r) => r[0] !== 'deep');
    const ours: string[][] = [];
    for (const a of defaultData.map.areas) {
      if (a.layout === 'seed') continue;
      const l = a.layout;
      for (const id of a.nodes) {
        const kind = defaultData.map.nodes.find((n) => n.id === id)!.kind;
        if (kind === 'pocket') {
          const p = l.pockets[id]!;
          ours.push([a.id, id, p.prize, String(p.slots), `${p.thorns} / ${p.spores}`]);
        } else if (kind === 'root') {
          ours.push([a.id, id, 'none', '0', `${l.root!.thorns} / ${l.root!.spores}`]);
        } else if (kind === 'heart') {
          const h = l.heart;
          const starved = h.starvedThorns === undefined ? '' : `, starved ${h.starvedThorns} / ${h.starvedSpores}`;
          ours.push([a.id, id, 'ore', String(defaultData.map.nodes.find((n) => n.id === 'heart')!.slots), `${h.thorns} / ${h.spores}${starved}`]);
        }
      }
    }
    expect(ours).toEqual(rows.map((r) => r.slice(0, 5)));
    // The Deep's row says "as H3": it uses the run's H3 layout.
    expect(defaultData.map.areas.find((a) => a.id === 'deep')!.layout).toBe('seed');
  });

  it('counterTag on each area guard caps (areaStatus) reproduces the "Area guards" tag column, starved hearts included', () => {
    const rows = h4Table('**Area guards**', 'How an H3 field is cut down').filter((r) => r[0] !== 'deep');
    const w = createWorld(1, defaultData);
    const t = w.tun;
    /** "Weak (25)" → ['weak', 25]; "Even" → ['even', null]. */
    const parse = (cell: string): [string, number | null] => {
      const m = /^(Strong|Even|Weak)(?: \((\d+)\))?$/.exec(cell.trim());
      if (!m) throw new Error(`bad tag cell "${cell}"`);
      return [m[1]!.toLowerCase(), m[2] === undefined ? null : Number(m[2])];
    };
    const check = (caps: GuardCounts, cell: string, where: string): void => {
      const [l, f] = cell.split(' / ');
      for (const [ship, c] of [['lancer', l!], ['flak', f!]] as const) {
        const [tag, pct] = parse(c);
        const got = counterTag(t, ship, caps);
        expect(got.tag, `${where} ${ship}`).toBe(tag);
        if (pct !== null) expect(got.multPct, `${where} ${ship}`).toBe(pct);
        expect(tagFor(ship, got.multPct)).toBe(got.tag);
      }
    };
    let checked = 0;
    for (const [areaId = '', node = '', , , , tags = ''] of rows) {
      const a = defaultData.map.areas.findIndex((x) => x.id === areaId);
      const g = areaStatus(w, defaultData, a).guarded.find((x) => x.id === node)!;
      if (tags.startsWith('none')) {
        expect(g.caps, `${areaId} ${node} has no guards`).toEqual({ thorn: 0, spore: 0 });
        continue;
      }
      const [fed = '', starved] = tags.split('; starved ');
      check(g.caps, fed, `${areaId} ${node}`);
      checked++;
      if (starved !== undefined) {
        expect(g.starvedCaps, `${areaId} ${node} starved`).not.toBeNull();
        check(g.starvedCaps!, starved, `${areaId} ${node} starved`);
        checked++;
      }
      if (node === 'heart') {
        const st = areaStatus(w, defaultData, a).heartTags;
        expect([st.lancer.tag, st.flak.tag]).toEqual([counterTag(t, 'lancer', g.caps).tag, counterTag(t, 'flak', g.caps).tag]);
      }
    }
    // 12 guarded nodes with guards (Landfall's heart has none) plus the two starved hearts.
    expect(checked).toBe(14);
  });

  it('matches the "Research" table, and its totals line', () => {
    const rows = h4Table('#### Research (data `research`)', 'Totals over every level').map((r) => r.slice(0, 8).map(strip));
    expect(researchRows(defaultData)).toEqual(rows);
    const totals = design.slice(h4At).match(/Totals over every level: (\d+) ore, (\d+) ice, (\d+) crystal/)!;
    const sum = (res: 'ore' | 'ice' | 'crystal'): number => defaultData.research.reduce((s, it) => s + it.levels.reduce((x, lv) => x + lv[res], 0), 0);
    expect([sum('ore'), sum('ice'), sum('crystal')]).toEqual([Number(totals[1]), Number(totals[2]), Number(totals[3])]);
  });

  it('matches the "Tunables (H4, data/sim.json, all integers)" table, and the haul totals cover every research level', () => {
    const rows = h4Table('#### Tunables (H4, data/sim.json, all integers)', '`system.variant` keeps');
    expect(rows.map((r) => strip(r[0]!)).sort()).toEqual([...Object.keys(H4_TUNABLES), 'economy.startStock'].sort());
    for (const [key = '', def = '', range = ''] of rows) {
      const k = strip(key) as keyof SimData['tunables'];
      const [min, max] = range.split('–').map(Number);
      expect(defaultData.tunables[k], k).toEqual({ default: Number(def), min, max });
    }
    // The "Totals" line under the Areas table: haul per resource, and the validation rule it states.
    const hauls = design.slice(h4At).match(/Totals: haul (\d+) \/ (\d+) \/ (\d+)/)!;
    const haul = (res: 'ore' | 'ice' | 'crystal'): number => defaultData.map.areas.reduce((s, a) => s + a.haul[res], 0);
    expect([haul('ore'), haul('ice'), haul('crystal')]).toEqual([Number(hauls[1]), Number(hauls[2]), Number(hauls[3])]);
    const meta = tunableMeta(defaultData).filter((m) => m.key.startsWith('research.') || m.key.startsWith('shipments.'));
    expect(meta.map((m) => [m.key, m.live, m.newRunOnly, m.scope])).toEqual(Object.keys(H4_TUNABLES).map((k) => [k, true, false, 'sim']));
  });
});

describe('parseSimData rejects bad H4 data', () => {
  type Raw = typeof rawData;
  const bad = (edit: (d: Raw) => void, msg: RegExp): void => {
    const d = clone(rawData);
    edit(d);
    expect(() => parseSimData(d)).toThrow(msg);
  };
  const area = (d: Raw, id: string) => d.map.areas.find((a) => a.id === id)! as unknown as Record<string, unknown> & { nodes: string[]; layout: Record<string, unknown> };

  it('area node lists must be frame ids and include the probe, the heart and the rig nodes', () => {
    bad((d) => area(d, 'shelf').nodes.push('z9'), /z9 is not a frame node id/);
    bad((d) => (area(d, 'shelf').nodes = area(d, 'shelf').nodes.filter((n) => n !== 'probe')), /include the probe/);
    bad((d) => (area(d, 'shelf').nodes = area(d, 'shelf').nodes.filter((n) => n !== 'heart')), /include the heart/);
    bad((d) => (area(d, 'shelf').nodes = area(d, 'shelf').nodes.filter((n) => n !== 'a2')), /seed-rig node a2/);
    bad((d) => area(d, 'shelf').nodes.push('a1'), /listed twice/);
  });

  it('pocket and Root entries must match the nodes present, and only a Root lets the heart starve', () => {
    bad((d) => ((area(d, 'shelf').layout.pockets as Record<string, unknown>).p2 = { prize: 'ice', slots: 2, thorns: 0, spores: 1 }), /p2 is not a pocket node in this area/);
    bad((d) => delete (area(d, 'veil').layout.pockets as Record<string, unknown>).p2, /pockets.p2 missing/);
    bad((d) => (area(d, 'shelf').layout.root = { thorns: 1, spores: 1 }), /Root is not present/);
    bad((d) => delete area(d, 'veil').layout.root, /root missing/);
    bad((d) => ((area(d, 'shelf').layout.heart as Record<string, unknown>).starvedThorns = 1), /no Root to starve/);
    bad((d) => delete (area(d, 'garden').layout.heart as Record<string, unknown>).starvedSpores, /starvedSpores/);
  });

  it('The Deep has every node; one start area and one Deep', () => {
    bad((d) => (area(d, 'deep').nodes = area(d, 'deep').nodes.filter((n) => n !== 'a9')), /must have every frame node/);
    bad((d) => (area(d, 'shelf').tier = 0), /exactly one tier-0 area/);
    bad((d) => (area(d, 'veil').layout = 'seed' as unknown as Record<string, unknown>), /must have every frame node/);
  });

  it('lanes must join two known, different areas, once', () => {
    bad((d) => d.map.lanes.push(['landfall', 'nowhere']), /nowhere is not an area/);
    bad((d) => d.map.lanes.push(['veil', 'veil']), /to itself/);
    bad((d) => d.map.lanes.push(['shelf', 'landfall']), /repeats a lane/);
  });

  it('research requirements must name known items (at a real level) and areas; every item id is known and present', () => {
    bad((d) => (d.research[4]!.requires = [{ item: 'warp', level: 1 }]), /warp is not another research item/);
    bad((d) => (d.research[4]!.requires = [{ item: 'extract', level: 4 }]), /level must be 1..3/);
    bad((d) => (d.research[6]!.requires = [{ area: 'atlantis' }] as never), /atlantis is not an area/);
    bad((d) => (d.research[0]!.id = 'warp'), /id must be one of/);
    bad((d) => d.research.splice(5, 1), /research item yards missing/);
    bad((d) => (d.research[2]!.kind = 'win'), /exactly one win item/);
  });

  it('the hauls must cover every research level per resource at the research.costPct maximum', () => {
    bad((d) => (area(d, 'deep').haul = { ore: 650, ice: 49, crystal: 60 }), /total ice haul 219 is below the total research cost 220/);
    bad((d) => (d.research[0]!.levels[0]!.ore = 101), /total ore haul 1700 is below the total research cost 1701/);
    // Exactly equal is fine.
    const d = clone(rawData);
    area(d, 'deep').haul = { ore: 650, ice: 50, crystal: 50 };
    expect(() => parseSimData(d)).not.toThrow();
  });
});

it('the shipped data parses and agrees with the fixture on structure (areas, lanes, research ids)', () => {
  const d = parseSimData(clone(shippedRaw));
  expect(d.map.areas.map((a) => [a.id, a.nodes])).toEqual(fixtureData.map.areas.map((a) => [a.id, a.nodes]));
  expect(d.map.lanes).toEqual(fixtureData.map.lanes);
  expect(d.research.map((r) => [r.id, r.levels.length])).toEqual(fixtureData.research.map((r) => [r.id, r.levels.length]));
});
