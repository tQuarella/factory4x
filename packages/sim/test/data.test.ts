import { describe, expect, it } from 'vitest';
import shippedRaw from '../../../data/sim.json' with { type: 'json' };
import design from '../../../DESIGN.md?raw';
import { TUNABLE_KEYS, defaultData, nodeDistance, parseSimData, tunableMeta, type SimData } from '../src/index.ts';
import { fixtureData } from './fixture.ts';
import rawData from './fixtures/sim-v4.json' with { type: 'json' };
import { N, fresh } from './helpers.ts';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** The frozen fixture (data v4, the h3-sim spec): every H3 key with its default and range. Rule tests rely on these numbers. */
const H3_TUNABLES: Record<string, [number, number, number]> = {
  'ship.drone.cost': [15, 5, 60],
  'ship.drone.buildTicks': [90, 15, 900],
  'ship.drone.hp': [10, 1, 100],
  'ship.drone.damage': [2, 1, 20],
  'ship.lancer.cost': [15, 5, 60],
  'ship.lancer.buildTicks': [120, 15, 900],
  'ship.lancer.hp': [12, 1, 100],
  'ship.lancer.damage': [4, 1, 20],
  'ship.flak.cost': [15, 5, 60],
  'ship.flak.buildTicks': [120, 15, 900],
  'ship.flak.hp': [12, 1, 100],
  'ship.flak.damage': [4, 1, 20],
  'counter.strongPct': [200, 100, 400],
  'counter.weakPct': [25, 10, 100],
  'guard.thorn.hp': [20, 1, 200],
  'guard.thorn.damage': [3, 0, 30],
  'guard.thorn.repairPerRound': [2, 0, 20],
  'guard.thorn.regrowTicks': [60, 15, 1800],
  'guard.spore.hp': [6, 1, 100],
  'guard.spore.damage': [1, 0, 30],
  'guard.spore.repairPerRound': [0, 0, 20],
  'guard.spore.regrowTicks': [20, 5, 1800],
  'guard.capPct': [100, 25, 300],
  'bloom.starvedRegrowMul': [5, 1, 30],
  'bloom.starvedRepairPerRound': [0, 0, 20],
  'pocket.resourcePerMin': [6, 1, 40],
  'pocket.freeExtractors': [1, 0, 3],
  'heart.orePerMin': [25, 10, 80],
  'heart.freeExtractors': [1, 0, 4],
  'component.lens.ore': [5, 0, 60],
  'component.lens.crystal': [4, 1, 40],
  'component.plating.ore': [5, 0, 60],
  'component.plating.ice': [4, 1, 40],
  'component.buildTicks': [90, 15, 900],
  'component.stockCap': [5, 1, 50],
  'system.variant': [0, 0, 3],
};

/** Layouts in a compact row form: name, then `p1 ice 2 1/8` per pocket, the Root and the heart. */
const layoutRows = (d: SimData) =>
  d.map.layouts.map((l) => [
    l.name,
    ...(['p1', 'p2', 'p3', 'p4'] as const).map((p) => {
      const x = l.pockets[p]!;
      return `${p} ${x.prize} ${x.slots} ${x.thorns}/${x.spores}`;
    }),
    `root ${l.root.thorns}/${l.root.spores}`,
    `heart ${l.heart.thorns}/${l.heart.spores} starved ${l.heart.starvedThorns}/${l.heart.starvedSpores}`,
  ]);

/** Keys the H3 spec removes. */
const REMOVED = [
  'ship.cost',
  'ship.buildTicks',
  'ship.hp',
  'ship.damage',
  'guardian.cap',
  'guardian.thornHp',
  'guardian.thornDamage',
  'guardian.regrowTicks',
  'guardian.repairPerRound',
  'root.capBonus',
  'root.regrowTicks',
  'bloom.starvedCap',
  'bloom.starvedRegrowTicks',
  'rich.orePerMin',
  'rich.freeExtractors',
];

describe('the frozen test fixture (data v4)', () => {
  it('is data version 4 and holds every H3 tunable with its v4 default and range', () => {
    expect(fixtureData.dataVersion).toBe(4);
    expect(fixtureData.tickRate).toBe(30);
    expect(Object.keys(fixtureData.tunables).sort()).toEqual([...TUNABLE_KEYS].sort());
    for (const [k, [d, min, max]] of Object.entries(H3_TUNABLES)) {
      expect(fixtureData.tunables[k as keyof typeof fixtureData.tunables], k).toEqual({ default: d, min, max });
    }
    // Kept from H1.
    expect(fixtureData.tunables['ship.speedSu']).toEqual({ default: 4, min: 1, max: 20 });
    expect(fixtureData.tunables['combat.roundTicks']).toEqual({ default: 30, min: 10, max: 90 });
    expect(fixtureData.tunables['stats.throughputWindowSec']).toEqual({ default: 60, min: 60, max: 60 });
  });

  it('drops every key the spec removes, and map.variants (the shipped data too); H4 adds map.areas and map.lanes', () => {
    for (const raw of [rawData, shippedRaw]) {
      for (const k of REMOVED) expect(Object.keys(raw.tunables)).not.toContain(k);
      expect(Object.keys(raw.map)).toEqual(['nodes', 'layouts', 'areas', 'lanes']);
    }
  });

  it('has the 16-node field at the spec positions, every node at least 160 su from every other', () => {
    expect(fixtureData.map.nodes.map((n) => [n.id, n.kind, n.x, n.y, n.r, n.slots])).toEqual([
      ['probe', 'probe', 500, 1180, 70, 0],
      ['a1', 'asteroid', 300, 1010, 45, 2],
      ['a2', 'asteroid', 700, 1010, 45, 2],
      ['a3', 'asteroid', 120, 850, 40, 1],
      ['a4', 'asteroid', 880, 850, 40, 1],
      ['a5', 'asteroid', 500, 650, 55, 3],
      ['a6', 'asteroid', 170, 640, 45, 2],
      ['a7', 'asteroid', 830, 640, 45, 2],
      ['a8', 'asteroid', 100, 250, 40, 1],
      ['a9', 'asteroid', 900, 250, 40, 1],
      ['p1', 'pocket', 360, 850, 50, 0],
      ['p2', 'pocket', 640, 850, 50, 0],
      ['p3', 'pocket', 250, 440, 60, 0],
      ['p4', 'pocket', 750, 440, 60, 0],
      ['root', 'root', 500, 450, 45, 0],
      ['heart', 'heart', 500, 220, 90, 4],
    ]);
    const w = fresh();
    for (let a = 0; a < w.nodes.length; a++) {
      for (let b = a + 1; b < w.nodes.length; b++) expect(nodeDistance(w, a, b), `${w.nodes[a]!.id}-${w.nodes[b]!.id}`).toBeGreaterThanOrEqual(160);
    }
    // 15 asteroid slots: the H1 ore ceiling of 150/min.
    expect(w.nodes.filter((n) => n.kind === 'asteroid').reduce((s, n) => s + n.slots, 0)).toBe(15);
    expect(N.heart).toBe(15);
  });

  it('has the three v4 layouts (the h3-sim spec tables)', () => {
    expect(fixtureData.map.layouts.map((l) => l.id)).toEqual(['frost', 'glass', 'twin']);
    expect(layoutRows(fixtureData)).toEqual([
      ['Frost Gate', 'p1 ice 2 1/8', 'p2 crystal 2 3/3', 'p3 ice 3 9/4', 'p4 crystal 3 2/18', 'root 6/0', 'heart 10/14 starved 6/7'],
      ['Glass Thicket', 'p1 crystal 2 1/8', 'p2 ice 2 3/3', 'p3 ice 3 2/18', 'p4 crystal 3 9/4', 'root 0/12', 'heart 14/8 starved 8/4'],
      ['Twin Seams', 'p1 ice 2 2/5', 'p2 crystal 2 2/5', 'p3 crystal 3 2/18', 'p4 ice 3 9/4', 'root 3/6', 'heart 6/20 starved 4/10'],
    ]);
  });

  it('tunable metadata marks stats.* fixed, client.* client-scope, system.variant new-run-only, and startStock live (H4: read at every landing)', () => {
    const meta = tunableMeta(fixtureData);
    expect(meta.map((m) => m.key)).toEqual([...TUNABLE_KEYS]);
    const by = (k: string) => meta.find((m) => m.key === k)!;
    expect(by('ship.lancer.cost')).toEqual({ key: 'ship.lancer.cost', section: 'ship', default: 15, min: 5, max: 60, live: true, scope: 'sim', newRunOnly: false });
    expect(by('stats.throughputWindowSec').live).toBe(false);
    expect(by('client.autosaveSec').scope).toBe('client');
    expect(by('economy.startStock')).toMatchObject({ live: true, newRunOnly: false });
    expect(by('system.variant')).toMatchObject({ section: 'system', live: true, scope: 'sim', newRunOnly: true });
    expect(by('guard.capPct').newRunOnly).toBe(false);
  });
});

/** Body rows of the first Markdown table between `from` and `until` in DESIGN.md (cells trimmed). */
function specTable(from: string, until: string): string[][] {
  const at = design.indexOf(from);
  if (at < 0) throw new Error(`DESIGN.md has no "${from}"`);
  const end = design.indexOf(until, at + from.length);
  return design
    .slice(at, end < 0 ? undefined : end)
    .split('\n')
    .filter((l) => l.startsWith('|') && !l.startsWith('| ---'))
    .slice(1)
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

/** The layouts in DESIGN.md H3 "Layouts", in the same row form as `layoutRows`. */
function specLayouts(): string[][] {
  const at = design.indexOf('#### Layouts (data `map.layouts`');
  if (at < 0) throw new Error('DESIGN.md has no H3 Layouts section');
  return design
    .slice(at, design.indexOf('Why these layouts', at))
    .split('**Layout ')
    .slice(1)
    .map((block) => {
      const title = /^\d+: (.+?)\*\*/.exec(block)?.[1] ?? '?';
      const rows = block
        .split('\n')
        .filter((l) => /^\| (p\d|root|heart) \|/.test(l))
        .map((l) => {
          const [node = '', prize = '', slots = '', guards = ''] = l.split('|').slice(1, 5).map((c) => c.trim());
          const g = guards.replace(/ \/ /g, '/').replace(', starved ', ' starved ');
          return node.startsWith('p') ? `${node} ${prize} ${slots} ${g}` : `${node} ${g}`;
        });
      return [title, ...rows];
    });
}

/**
 * The shipped data/sim.json. Calibration changes it, so these tests check
 * that it is well formed and agrees with the spec tables in DESIGN.md, and
 * pin no tuned number of their own: a retune edits data/sim.json and
 * DESIGN.md together, and no test. Rule tests use the fixture above.
 */
describe('data/sim.json (shipped)', () => {
  it('is valid, newer than the fixture, and has every tunable with its default inside its range', () => {
    expect(() => parseSimData(clone(shippedRaw))).not.toThrow();
    expect(defaultData.dataVersion).toBeGreaterThan(fixtureData.dataVersion);
    expect(defaultData.tickRate).toBe(30);
    expect(Object.keys(defaultData.tunables).sort()).toEqual([...TUNABLE_KEYS].sort());
    for (const k of TUNABLE_KEYS) {
      const { default: d, min, max } = defaultData.tunables[k];
      expect(min <= d && d <= max, k).toBe(true);
    }
  });

  it('matches every default and range in the DESIGN.md H3 Tunables table', () => {
    const rows = specTable('#### Tunables (data/, all integers)\n\nNew or renamed keys.', '- **Removed:**');
    expect(rows.map((r) => r[0]!.replace(/`/g, '')).sort()).toEqual(Object.keys(H3_TUNABLES).sort());
    for (const [key = '', def = '', range = ''] of rows) {
      const k = key.replace(/`/g, '') as keyof SimData['tunables'];
      const [min, max] = range.split('–').map(Number);
      expect(defaultData.tunables[k], k).toEqual({ default: Number(def), min, max });
    }
  });

  it('keeps the fixture field: node positions do not change with calibration', () => {
    expect(defaultData.map.nodes).toEqual(fixtureData.map.nodes);
  });

  it('has three well-formed layouts that match the DESIGN.md H3 layout tables', () => {
    const layouts = defaultData.map.layouts;
    expect(layouts.map((l) => [l.id, l.name])).toEqual([
      ['frost', 'Frost Gate'],
      ['glass', 'Glass Thicket'],
      ['twin', 'Twin Seams'],
    ]);
    for (const l of layouts) {
      const pockets = Object.values(l.pockets);
      // Two doors: two ice and two crystal pockets per layout, and every guarded node has guards.
      expect(pockets.filter((p) => p.prize === 'ice').length, l.id).toBe(2);
      expect(pockets.filter((p) => p.prize === 'crystal').length, l.id).toBe(2);
      for (const p of pockets) expect(p.thorns + p.spores, l.id).toBeGreaterThan(0);
      expect(l.root.thorns + l.root.spores, l.id).toBeGreaterThan(0);
      // Cutting the Root weakens the heart and never strengthens it.
      expect(l.heart.starvedThorns, l.id).toBeLessThanOrEqual(l.heart.thorns);
      expect(l.heart.starvedSpores, l.id).toBeLessThanOrEqual(l.heart.spores);
      expect(l.heart.starvedThorns + l.heart.starvedSpores, l.id).toBeLessThan(l.heart.thorns + l.heart.spores);
    }
    expect(layoutRows(defaultData)).toEqual(specLayouts());
  });

  it('tunable metadata follows the shipped defaults and ranges', () => {
    const meta = tunableMeta(defaultData);
    expect(meta.map((m) => m.key)).toEqual([...TUNABLE_KEYS]);
    for (const m of meta) expect([m.default, m.min, m.max], m.key).toEqual([defaultData.tunables[m.key].default, defaultData.tunables[m.key].min, defaultData.tunables[m.key].max]);
  });
});

describe('parseSimData rejects bad data', () => {
  it('missing tunable', () => {
    const d = clone(rawData) as unknown as Record<string, Record<string, unknown>>;
    delete d.tunables!['ship.flak.cost'];
    expect(() => parseSimData(d)).toThrow(/ship.flak.cost missing/);
  });
  it('unknown tunable (e.g. a removed H2 key)', () => {
    const d = clone(rawData) as unknown as Record<string, Record<string, unknown>>;
    d.tunables!['root.capBonus'] = { default: 0, min: -14, max: 20 };
    expect(() => parseSimData(d)).toThrow(/unknown tunable/);
  });
  it('default outside its range, or not an integer', () => {
    const d = clone(rawData);
    d.tunables['ship.drone.cost'].default = 61;
    expect(() => parseSimData(d)).toThrow(/outside/);
    d.tunables['ship.drone.cost'].default = 15.5;
    expect(() => parseSimData(d)).toThrow(/integer/);
  });
  it('a counter percentage or regrow period whose range reaches 0 (the sim divides by them)', () => {
    const d = clone(rawData);
    d.tunables['counter.weakPct'].min = 0;
    expect(() => parseSimData(d)).toThrow(/counter.weakPct/);
  });
  it('a map without the probe first, or without exactly one heart and one root', () => {
    const d = clone(rawData);
    d.map.nodes.reverse();
    expect(() => parseSimData(d)).toThrow(/probe/);
    const e = clone(rawData);
    e.map.nodes[1]!.kind = 'heart';
    expect(() => parseSimData(e)).toThrow(/heart/);
    const f = clone(rawData);
    f.map.nodes[1]!.kind = 'root';
    expect(() => parseSimData(f)).toThrow(/root/);
    const g = clone(rawData);
    g.map.nodes[1]!.kind = 'rich';
    expect(() => parseSimData(g)).toThrow(/bad kind/);
  });
  it('missing or malformed layouts, and a system.variant range past the table', () => {
    const d = clone(rawData) as unknown as { map: Record<string, unknown> };
    delete d.map.layouts;
    expect(() => parseSimData(d)).toThrow(/layouts missing/);
    const e = clone(rawData);
    e.map.layouts[1]!.pockets.p3!.prize = 'ore';
    expect(() => parseSimData(e)).toThrow(/prize/);
    const f = clone(rawData);
    f.map.layouts[2]!.id = 'frost';
    expect(() => parseSimData(f)).toThrow(/unique/);
    const g = clone(rawData);
    g.map.layouts.pop();
    expect(() => parseSimData(g)).toThrow(/system.variant/);
    const h = clone(rawData) as unknown as { map: { layouts: Array<{ pockets: Record<string, unknown> }> } };
    delete h.map.layouts[0]!.pockets.p4;
    expect(() => parseSimData(h)).toThrow(/p4 missing/);
    const i = clone(rawData) as unknown as { map: { layouts: Array<{ pockets: Record<string, unknown> }> } };
    i.map.layouts[0]!.pockets.a1 = { prize: 'ice', slots: 1, thorns: 1, spores: 1 };
    expect(() => parseSimData(i)).toThrow(/not a pocket/);
    const j = clone(rawData);
    j.map.layouts[0]!.heart.starvedSpores = 61;
    expect(() => parseSimData(j)).toThrow(/starvedSpores/);
    const k = clone(rawData);
    k.map.layouts[0]!.root.thorns = -1;
    expect(() => parseSimData(k)).toThrow(/root.thorns/);
  });
});
