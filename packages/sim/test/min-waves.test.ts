import { describe, expect, it } from 'vitest';
import { L, N } from './helpers.ts';
import { baseWorld, minWaves, waveWins, type MinWaves } from './min-wave.ts';

declare const console: { log(...args: unknown[]): void };

/**
 * h3-sim acceptance 5: per layout, the smallest simultaneous wave that
 * captures each guarded node from full strength, as drones / lancers / flak /
 * best mix (any mix of the three), with the real sim at the shipped defaults.
 * `spec` is the throwaway model's column from DESIGN.md H3 "Layouts"; `sim` is
 * what the sim gives. The engineers report these and do not retune.
 */

type Row = [drones: number, lancers: number, flak: number, mix: number];

interface Case {
  id: 'p1' | 'p2' | 'p3' | 'p4' | 'root' | 'heart' | 'starved heart';
  spec: Row;
  sim: Row;
}

const NODE = { p1: N.p1, p2: N.p2, p3: N.p3, p4: N.p4, root: N.root, heart: N.heart, 'starved heart': N.heart } as const;

const LAYOUTS: Array<{ name: string; layout: number; cases: Case[] }> = [
  {
    name: 'Frost Gate',
    layout: L.frost,
    cases: [
      { id: 'p1', spec: [14, 17, 8, 5], sim: [13, 17, 8, 5] },
      { id: 'p2', spec: [13, 12, 20, 6], sim: [15, 12, 20, 6] },
      { id: 'p3', spec: [25, 17, 35, 11], sim: [25, 17, 35, 11] },
      { id: 'p4', spec: [22, 25, 18, 10], sim: [22, 25, 18, 10] },
      { id: 'root', spec: [16, 6, 25, 6], sim: [16, 6, 25, 6] },
      { id: 'heart', spec: [32, 25, 39, 14], sim: [33, 25, 39, 14] },
      { id: 'starved heart', spec: [16, 10, 17, 7], sim: [16, 10, 17, 7] },
    ],
  },
  {
    name: 'Glass Thicket',
    layout: L.glass,
    cases: [
      { id: 'p1', spec: [14, 17, 8, 5], sim: [13, 17, 8, 5] },
      { id: 'p2', spec: [13, 12, 20, 6], sim: [15, 12, 20, 6] },
      { id: 'p3', spec: [22, 25, 18, 10], sim: [22, 25, 18, 10] },
      { id: 'p4', spec: [25, 17, 35, 11], sim: [25, 17, 35, 11] },
      { id: 'root', spec: [11, 17, 4, 4], sim: [11, 17, 4, 4] },
      { id: 'heart', spec: [36, 23, 46, 16], sim: [37, 23, 46, 16] },
      { id: 'starved heart', spec: [17, 9, 21, 8], sim: [17, 9, 21, 8] },
    ],
  },
  {
    name: 'Twin Seams',
    layout: L.twin,
    cases: [
      { id: 'p1', spec: [14, 15, 17, 5], sim: [15, 15, 17, 5] },
      { id: 'p2', spec: [14, 15, 17, 5], sim: [15, 15, 17, 5] },
      { id: 'p3', spec: [22, 25, 18, 10], sim: [22, 25, 18, 10] },
      { id: 'p4', spec: [25, 17, 35, 11], sim: [25, 17, 35, 11] },
      { id: 'root', spec: [16, 16, 20, 7], sim: [17, 16, 20, 7] },
      { id: 'heart', spec: [30, 28, 30, 13], sim: [30, 28, 30, 13] },
      { id: 'starved heart', spec: [14, 11, 12, 6], sim: [14, 11, 12, 6] },
    ],
  },
];

const row = (m: MinWaves): Array<number | null> => [m.drones, m.lancers, m.flak, m.mix];

for (const { name, layout, cases } of LAYOUTS) {
  describe(`scripted minimum waves: ${name}`, () => {
    const fed = baseWorld(layout, false);
    const starved = baseWorld(layout, true);
    const results = cases.map((c) => {
      const base = c.id === 'starved heart' ? starved : fed;
      return { c, base, m: minWaves(base, NODE[c.id]) };
    });

    it('reports the real numbers against the spec model (drones / lancers / flak / best mix)', () => {
      console.log(
        [
          `${name}: node | spec model | sim | best mix found`,
          ...results.map(({ c, m }) => `  ${c.id.padEnd(13)} | ${c.spec.join(' / ').padEnd(16)} | ${row(m).join(' / ').padEnd(16)} | ${JSON.stringify(m.mixFleet)}`),
        ].join('\n'),
      );
      expect(results.map(({ m }) => row(m))).toEqual(cases.map((c) => c.sim));
    });

    it('each minimum is a real threshold: one ship fewer of that kind is repelled', () => {
      for (const { c, base, m } of results) {
        const node = NODE[c.id];
        for (const type of ['drone', 'lancer', 'flak'] as const) {
          const n = type === 'drone' ? m.drones : type === 'lancer' ? m.lancers : m.flak;
          if (n === null || n === 1) continue;
          expect(waveWins(base, node, { drone: 0, lancer: 0, flak: 0, [type]: n - 1 }), `${c.id} ${type} ${n - 1}`).toBe(false);
        }
      }
    });

    it('the spec headline holds: a mix beats every single type on mixed nodes, the right counter beats drones, and a starved heart needs about half', () => {
      for (const { c, m } of results) {
        const mixed = !(c.id === 'root' && (layout === L.frost || layout === L.glass));
        if (mixed) expect(m.mix!, c.id).toBeLessThan(Math.min(m.drones!, m.lancers!, m.flak!));
        expect(Math.min(m.lancers!, m.flak!), c.id).toBeLessThanOrEqual(m.drones!);
      }
      const heart = results.find((r) => r.c.id === 'heart')!.m.mix!;
      const starvedHeart = results.find((r) => r.c.id === 'starved heart')!.m.mix!;
      expect(starvedHeart * 2).toBeLessThanOrEqual(heart + 2);
    });
  });
}
