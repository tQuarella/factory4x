import { describe, expect, it } from 'vitest';
import { palette } from '../src/palette.ts';
import {
  RADAR_TYPES,
  drawAsteroid,
  drawExtractor,
  drawHauler,
  drawMineBadge,
  drawRadar,
  drawRaidMarker,
  drawLockBadge,
  drawGuardRing,
} from '../src/placeholders.ts';
import { recorder, type P } from './recorder.ts';

const R = 50;
const maxRadius = (hits: P[]): number => Math.max(...hits.map((p) => Math.hypot(p.x, p.y) + p.pad));
const extent = (hits: P[]): { x0: number; x1: number; y0: number; y1: number } => ({
  x0: Math.min(...hits.map((p) => p.x - p.pad)),
  x1: Math.max(...hits.map((p) => p.x + p.pad)),
  y0: Math.min(...hits.map((p) => p.y - p.pad)),
  y1: Math.max(...hits.map((p) => p.y + p.pad)),
});

describe('H7 art: bounds (acceptance 6)', () => {
  for (const rr of [R, 12, 6.5]) {
    it(`extractor stays within r = ${rr} at every heading`, () => {
      for (const heading of [0, 0.7, Math.PI / 2, 2.5, -1.2]) {
        const { ctx, hits } = recorder();
        drawExtractor(ctx, rr, heading);
        expect(hits.length).toBeGreaterThan(0);
        expect(maxRadius(hits)).toBeLessThanOrEqual(rr * 1.0001);
      }
    });
    it(`hauler stays within r = ${rr} at every heading`, () => {
      for (const heading of [0, 0.7, Math.PI / 2, 2.5, -1.2]) {
        const { ctx, hits } = recorder();
        drawHauler(ctx, rr, heading);
        expect(hits.length).toBeGreaterThan(0);
        expect(maxRadius(hits)).toBeLessThanOrEqual(rr * 1.0001);
      }
    });
    it(`raid marker stays within r = ${rr} for every mix`, () => {
      for (const mix of [{ thorn: 5, spore: 0 }, { thorn: 0, spore: 4 }, { thorn: 3, spore: 2 }, { thorn: 0, spore: 0 }]) {
        const { ctx, hits } = recorder();
        drawRaidMarker(ctx, rr, mix);
        expect(maxRadius(hits)).toBeLessThanOrEqual(rr * 1.0001);
      }
    });
    it(`mine badge stays within r = ${rr}`, () => {
      const { ctx, hits } = recorder();
      drawMineBadge(ctx, rr);
      expect(maxRadius(hits)).toBeLessThanOrEqual(rr * 1.0001);
    });
  }
  it('the raided rock stays within 1.1 r above the pips, and its pips are the same as a normal rock', () => {
    const raided = recorder();
    drawAsteroid(raided.ctx, R, 3, 1, 0, 'raided', 0.3);
    expect(maxRadius(raided.hits)).toBeLessThanOrEqual(R * 1.1 * 1.0001);
    const a = recorder();
    const b = recorder();
    drawAsteroid(a.ctx, R, 3, 2, 3);
    drawAsteroid(b.ctx, R, 3, 2, 3, 'normal', 5);
    expect(a.hits).toEqual(b.hits);
  });
  for (const [w, h] of [[148, 124], [343, 170], [200, 200]] as const) {
    it(`the radar, icons included, stays inside its ${w}x${h} box at every weight`, () => {
      for (const weights of [[0, 0, 0, 0, 0], [5, 5, 5, 5, 5], [3, 2, 0, 0, 0], [1, 5, 2, 4, 3]]) {
        const { ctx, hits } = recorder();
        drawRadar(ctx, w, h, weights, 5);
        const e = extent(hits);
        expect(e.x0).toBeGreaterThanOrEqual(-w / 2 - 0.01);
        expect(e.x1).toBeLessThanOrEqual(w / 2 + 0.01);
        expect(e.y0).toBeGreaterThanOrEqual(-h / 2 - 0.01);
        expect(e.y1).toBeLessThanOrEqual(h / 2 + 0.01);
      }
    });
  }
  it('the radar scales to alloc.maxWeight: more rings, same box', () => {
    const rings = (max: number): number => {
      const { ctx, hits } = recorder();
      drawRadar(ctx, 148, 124, [1, 1, 1, 1, 1], max);
      const e = extent(hits);
      expect(e.x1 - e.x0).toBeLessThanOrEqual(148.01);
      return hits.length;
    };
    expect(rings(10)).toBeGreaterThan(rings(3));
  });
});

describe('H7 art: shape and colour rules (acceptance 6)', () => {
  it('extractor and hauler are the economy amber hull with no player blue and no mob colours', () => {
    for (const draw of [drawExtractor, drawHauler]) {
      const { ctx, styles } = recorder();
      draw(ctx, R, 0);
      expect(styles).toContain(palette.econ);
      for (const c of [palette.ship, palette.mob, palette.bloom, palette.spore, palette.thorn]) expect(styles).not.toContain(c);
    }
  });
  it('the hull amber is not the probe amber', () => {
    expect(palette.econ).not.toBe(palette.probe);
    const { ctx, styles } = recorder();
    drawExtractor(ctx, R);
    expect(styles).not.toContain(palette.probe);
  });
  it('the extractor has a prong reaching r ahead of its hull, the hauler a flat-ended box that stops short of it', () => {
    const ex = recorder();
    const ha = recorder();
    drawExtractor(ex.ctx, R);
    drawHauler(ha.ctx, R);
    const e = extent(ex.hits);
    const h = extent(ha.hits);
    // The extractor's nose reaches r; the hauler's cab ends flat short of it. (The 24 px pixel-scan comparison with the warships and a
    // rock is the gallery's, run by tests/smoke/h7-art.spec.ts.)
    expect(e.x1).toBeCloseTo(R, 5);
    expect(h.x1).toBeLessThan(e.x1 * 0.9);
    expect(h.y1 - h.y0).toBeGreaterThanOrEqual((e.y1 - e.y0) * 0.99);
  });
  it('the raid marker is the raiders ring (Thorn and Spore arcs) round a hot-pink chevron, and a one-type raid has one arc colour', () => {
    const both = recorder();
    drawRaidMarker(both.ctx, R, { thorn: 3, spore: 2 });
    expect(both.styles).toContain(palette.thorn);
    expect(both.styles).toContain(palette.spore);
    expect(both.styles).toContain(palette.bloom);
    const thorns = recorder();
    drawRaidMarker(thorns.ctx, R, { thorn: 4, spore: 0 });
    expect(thorns.styles).toContain(palette.thorn);
    expect(thorns.styles).not.toContain(palette.spore);
    const spores = recorder();
    drawRaidMarker(spores.ctx, R, { thorn: 0, spore: 4 });
    expect(spores.styles).toContain(palette.spore);
    expect(spores.styles).not.toContain(palette.thorn);
  });
  it('the mine badge is teal with no amber, unlike the lock (amber shackle)', () => {
    const m = recorder();
    drawMineBadge(m.ctx, R);
    expect(m.styles).toContain(palette.asteroidOre);
    for (const a of [palette.probe, palette.econ, palette.routeBackedUp]) expect(m.styles).not.toContain(a);
    const l = recorder();
    drawLockBadge(l.ctx, R);
    expect(l.styles).toContain(palette.probe);
  });
  it('the radar is filled in amber over a starDim grid, and a zero weight draws no vertex dot', () => {
    const full = recorder();
    drawRadar(full.ctx, 148, 124, [5, 5, 5, 5, 5], 5);
    expect(full.styles).toContain(palette.probe);
    expect(full.styles).toContain(palette.starDim);
    const none = recorder();
    drawRadar(none.ctx, 148, 124, [0, 0, 0, 0, 0], 5);
    // Dots are arcs filled with no padding; five at full weights, none at zero (the icons are polygons and rects).
    const dots = (r: ReturnType<typeof recorder>): number => r.hits.filter((p) => p.pad === 0).length;
    expect(dots(full)).toBeGreaterThan(dots(none));
  });
  it('the raided rock draws mob red and a normal one does not', () => {
    const raided = recorder();
    drawAsteroid(raided.ctx, R, 3, 0, 2, 'raided', 0.2);
    expect(raided.styles).toContain(palette.mob);
    const normal = recorder();
    drawAsteroid(normal.ctx, R, 3, 0, 2);
    expect(normal.styles).not.toContain(palette.mob);
  });
  it('the radar axes are the five build types in order', () => {
    expect([...RADAR_TYPES]).toEqual(['extractor', 'hauler', 'drone', 'lancer', 'flak']);
  });
  it('the guard ring, the raid marker ring and the mix agree on colours', () => {
    const g = recorder();
    drawGuardRing(g.ctx, R, 0.5, 0.5, 0);
    const m = recorder();
    drawRaidMarker(m.ctx, R, { thorn: 1, spore: 1 });
    for (const c of [palette.thorn, palette.spore]) {
      expect(g.styles).toContain(c);
      expect(m.styles).toContain(c);
    }
  });
});
