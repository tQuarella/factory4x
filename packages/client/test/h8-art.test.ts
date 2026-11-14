import { describe, expect, it } from 'vitest';
import { palette } from '../src/palette.ts';
import { drawDragLine, drawDropHighlight, drawMineBadge, drawRaidBadge, drawRaidMarker, drawSplitPulse } from '../src/placeholders.ts';
import { recorder, type P } from './recorder.ts';

const R = 50;
const maxRadius = (hits: P[]): number => Math.max(...hits.map((p) => Math.hypot(p.x, p.y) + p.pad));

describe('H8 art: the raid badge, the highlight and the pulse', () => {
  for (const rr of [R, 12, 8]) {
    it(`the raid badge stays within r = ${rr} for every mix`, () => {
      for (const mix of [{ thorn: 5, spore: 0 }, { thorn: 0, spore: 4 }, { thorn: 3, spore: 2 }, { thorn: 0, spore: 0 }]) {
        const { ctx, hits } = recorder();
        drawRaidBadge(ctx, rr, mix);
        expect(hits.length).toBeGreaterThan(0);
        expect(maxRadius(hits)).toBeLessThanOrEqual(rr * 1.0001);
      }
    });
  }
  it('the raid badge is the raiders ring round crossed blades, with no chevron and no amber, so it is not the marker, the "!" or the mine badge', () => {
    const both = recorder();
    drawRaidBadge(both.ctx, R, { thorn: 3, spore: 2 });
    expect(both.styles).toContain(palette.thorn);
    expect(both.styles).toContain(palette.spore);
    expect(both.styles).toContain(palette.bloom);
    for (const a of [palette.probe, palette.routeBackedUp, palette.asteroidOre]) expect(both.styles).not.toContain(a);
    const thorns = recorder();
    drawRaidBadge(thorns.ctx, R, { thorn: 4, spore: 0 });
    expect(thorns.styles).not.toContain(palette.spore);
    const spores = recorder();
    drawRaidBadge(spores.ctx, R, { thorn: 0, spore: 4 });
    expect(spores.styles).not.toContain(palette.thorn);
    // The marker fills its chevron; the badge strokes blades, so the two never share a fill of the accent colour.
    const marker = recorder();
    drawRaidMarker(marker.ctx, R, { thorn: 3, spore: 2 });
    expect(marker.hits.length).not.toBe(both.hits.length);
  });
  it('the mine button icon is the mine badge itself, so the badge and the button read as one thing', () => {
    const { ctx, styles } = recorder();
    drawMineBadge(ctx, 12);
    expect(styles).toContain(palette.asteroidOre);
  });
  it('the drop highlight stays within 1.2 r and is pink for an attack, bright white-blue for a move', () => {
    const a = recorder();
    drawDropHighlight(a.ctx, R, true, 0.3);
    expect(maxRadius(a.hits)).toBeLessThanOrEqual(R * 1.2);
    expect(a.styles).toContain(palette.bloom);
    expect(a.styles).not.toContain(palette.starBright);
    const m = recorder();
    drawDropHighlight(m.ctx, R, false, 0.3);
    expect(m.styles).toContain(palette.starBright);
    expect(m.styles).not.toContain(palette.bloom);
  });
  it('the split pulse stays within 1.5 r at every phase, in player blue', () => {
    for (const t of [0, 0.2, 0.4, 0.6, 0.8]) {
      const { ctx, hits, styles } = recorder();
      drawSplitPulse(ctx, R, t);
      expect(maxRadius(hits)).toBeLessThanOrEqual(R * 1.5);
      expect(styles).toContain(palette.ship);
    }
  });
  it('the drag line is blue to a node, pink at an enemy and grey over nothing', () => {
    const colour = (aim: 'move' | 'attack' | 'none'): string[] => {
      const { ctx, styles } = recorder();
      drawDragLine(ctx, 0, 0, 100, 40, aim, 3);
      return styles;
    };
    expect(colour('move')).toContain(palette.ship);
    expect(colour('attack')).toContain(palette.bloom);
    expect(colour('none')).toContain(palette.laneClosed);
  });
});
