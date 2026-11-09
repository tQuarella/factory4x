import { describe, expect, it } from 'vitest';
import design from '../../../DESIGN.md?raw';
import {
  RAW_RESOURCES,
  appliesAtLevel,
  defaultData,
  isTierRequirement,
  parseSimData,
  tunableMeta,
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
 *
 * h5-sim: the dataVersion pin moved to data-h5.test.ts. The "Research" table
 * gained the Command limit rows (one requirement per level, `atLevel`), and
 * the "Areas" table the v8 hauls; the frozen v4 fixture has no Command limit.
 *
 * h6-sim: the H4 "Areas", "Area guards" and "Research" tables describe data
 * v9 and were superseded at data v10 by the H6 tables (DESIGN.md says so under
 * each). The shipped data is checked against the H6 tables in
 * data-h6.test.ts, so those checks are retired here. The "Tunables (H4 …)"
 * table is not superseded (H6 changes none of its keys) and still checks the
 * shipped data. The fixture and validation tests below stay.
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

/** "a tier 1 area reclaimed", "two tier 2 areas reclaimed" (H5 tier requirements, as the table words them). */
const tierText = (tier: number, count: number): string =>
  count === 1 ? `a tier ${tier} area reclaimed` : `${count === 2 ? 'two' : String(count)} tier ${tier} areas reclaimed`;

/** Research levels in the row form of the DESIGN.md "Research" table (without the effect column). Each level lists the requirements that apply to it. */
function researchRows(d: SimData): string[][] {
  const req = (it: ResearchItem, level: number): string => {
    const qs = it.requires.filter((q) => appliesAtLevel(q, level));
    if (qs.length === 0) return 'none';
    return qs
      .map((q) => {
        if (isTierRequirement(q)) return tierText(q.tier, q.count);
        if ('area' in q) return `${d.map.areas.find((a) => a.id === q.area)!.name} reclaimed`;
        return `${q.item} ${q.level}`;
      })
      .join(', ');
  };
  return d.research.flatMap((it) => it.levels.map((lv, k) => [it.id, it.name, it.kind, String(k + 1), String(lv.ore), String(lv.ice), String(lv.crystal), req(it, k + 1)]));
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

describe('data/sim.json (shipped) against the DESIGN.md H4 Tunables table (not superseded at v10)', () => {
  it('matches the "Tunables (H4, data/sim.json, all integers)" table; all of them are live sim tunables', () => {
    const rows = h4Table('#### Tunables (H4, data/sim.json, all integers)', '`system.variant` keeps');
    expect(rows.map((r) => strip(r[0]!)).sort()).toEqual([...Object.keys(H4_TUNABLES), 'economy.startStock'].sort());
    for (const [key = '', def = '', range = ''] of rows) {
      const k = strip(key) as keyof SimData['tunables'];
      const [min, max] = range.split('–').map(Number);
      expect(defaultData.tunables[k], k).toEqual({ default: Number(def), min, max });
    }
    // The H4 "Totals" line under the superseded Areas table is H6's haul invariant now (data-h6.test.ts).
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

  it('the hauls must cover every research level per resource at the research.costPct maximum (no repeat groups on this map, so H6\'s worst position is the plain sum)', () => {
    bad((d) => (area(d, 'deep').haul = { ore: 650, ice: 49, crystal: 60 }), /total ice haul 219 \(.*\) is below the total research cost 220/);
    bad((d) => (d.research[0]!.levels[0]!.ore = 101), /total ore haul 1700 \(.*\) is below the total research cost 1701/);
    // Exactly equal is fine.
    const d = clone(rawData);
    area(d, 'deep').haul = { ore: 650, ice: 50, crystal: 50 };
    expect(() => parseSimData(d)).not.toThrow();
  });
});
