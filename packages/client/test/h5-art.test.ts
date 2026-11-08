import { describe, expect, it } from 'vitest';
import { palette } from '../src/palette.ts';
import { drawFleetIcon, drawRecycleIcon, drawResearchIcon } from '../src/placeholders.ts';

type P = { x: number; y: number; pad: number };

/**
 * A recording 2D context: tracks the transform and every path point that gets
 * filled or stroked (stroked points carry half the line width as padding).
 * Curves are sampled by their control points and arcs by 24 rim points, so the
 * measured extent is conservative. Clips are ignored.
 */
function recorder(): { ctx: CanvasRenderingContext2D; hits: P[]; styles: string[] } {
  const styles: string[] = [];
  type M = [number, number, number, number, number, number];
  let m: M = [1, 0, 0, 1, 0, 0];
  const stack: M[] = [];
  let path: { x: number; y: number }[] = [];
  const hits: P[] = [];
  const apply = (x: number, y: number) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
  const scale = () => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  const add = (x: number, y: number) => path.push(apply(x, y));
  const target: Record<string, unknown> = { lineWidth: 1 };
  const methods: Record<string, (...a: number[]) => void> = {
    save: () => void stack.push([...m] as M),
    restore: () => void (m = stack.pop() ?? m),
    translate: (x, y) => void (m = [m[0], m[1], m[2], m[3], m[0]! * x! + m[2]! * y! + m[4], m[1]! * x! + m[3]! * y! + m[5]]),
    rotate: (a) => {
      const c = Math.cos(a!);
      const s = Math.sin(a!);
      m = [m[0]! * c + m[2]! * s, m[1]! * c + m[3]! * s, -m[0]! * s + m[2]! * c, -m[1]! * s + m[3]! * c, m[4], m[5]];
    },
    scale: (x, y) => void (m = [m[0]! * x!, m[1]! * x!, m[2]! * y!, m[3]! * y!, m[4], m[5]]),
    beginPath: () => void (path = []),
    closePath: () => undefined,
    moveTo: (x, y) => add(x!, y!),
    lineTo: (x, y) => add(x!, y!),
    quadraticCurveTo: (a, b, x, y) => {
      add(a!, b!);
      add(x!, y!);
    },
    arc: (x, y, rad) => {
      for (let i = 0; i < 24; i++) add(x! + Math.cos((i / 24) * Math.PI * 2) * rad!, y! + Math.sin((i / 24) * Math.PI * 2) * rad!);
    },
    rect: (x, y, w, h) => {
      add(x!, y!);
      add(x! + w!, y! + h!);
      add(x! + w!, y!);
      add(x!, y! + h!);
    },
    fill: () => void path.forEach((p) => hits.push({ ...p, pad: 0 })),
    stroke: () => void path.forEach((p) => hits.push({ ...p, pad: ((target.lineWidth as number) * scale()) / 2 })),
    fillRect: (x, y, w, h) => {
      const keep = path;
      path = [];
      methods.rect!(x!, y!, w!, h!);
      methods.fill!();
      path = keep;
    },
    strokeRect: (x, y, w, h) => {
      const keep = path;
      path = [];
      methods.rect!(x!, y!, w!, h!);
      methods.stroke!();
      path = keep;
    },
    clip: () => undefined,
    setLineDash: () => undefined,
  };
  const ctx = new Proxy(target, {
    get: (t, k: string) => methods[k] ?? t[k],
    set: (t, k: string, v) => {
      if (k === 'fillStyle' || k === 'strokeStyle') styles.push(String(v));
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, hits, styles };
}

const R = 50;
const amber = [palette.probe, palette.probeGlow, palette.laneOwned, palette.routeBackedUp];

function maxRadius(hits: P[]): number {
  return Math.max(...hits.map((p) => Math.hypot(p.x, p.y) + p.pad));
}

describe('H5 draw bounds', () => {
  for (const full of [false, true]) {
    it(`fleet icon (full ${full}) stays within r`, () => {
      const { ctx, hits } = recorder();
      drawFleetIcon(ctx, R, full);
      expect(hits.length).toBeGreaterThan(0);
      expect(maxRadius(hits)).toBeLessThanOrEqual(R * 1.0001);
    });
  }
  it('recycle icon stays within r', () => {
    const { ctx, hits } = recorder();
    drawRecycleIcon(ctx, R);
    expect(hits.length).toBeGreaterThan(0);
    expect(maxRadius(hits)).toBeLessThanOrEqual(R * 1.0001);
  });
  it("research icon 'fleet' stays within r", () => {
    const { ctx, hits } = recorder();
    drawResearchIcon(ctx, R, 'fleet');
    expect(maxRadius(hits)).toBeLessThanOrEqual(R * 1.0001);
  });
  it('icons stay within r at phone size (r = 12)', () => {
    for (const draw of [(c: CanvasRenderingContext2D) => drawFleetIcon(c, 12, true), (c: CanvasRenderingContext2D) => drawFleetIcon(c, 12, false), (c: CanvasRenderingContext2D) => drawRecycleIcon(c, 12), (c: CanvasRenderingContext2D) => drawResearchIcon(c, 12, 'fleet')]) {
      const { ctx, hits } = recorder();
      draw(ctx);
      expect(maxRadius(hits)).toBeLessThanOrEqual(12 * 1.0001);
    }
  });
});

describe('H5 amber rule: amber only in the full fleet bracket', () => {
  it('the normal fleet icon uses no amber', () => {
    const { ctx, styles } = recorder();
    drawFleetIcon(ctx, R, false);
    for (const a of amber) expect(styles).not.toContain(a);
  });
  it('the full fleet icon uses amber (the bracket) and keeps blue chevrons', () => {
    const { ctx, styles } = recorder();
    drawFleetIcon(ctx, R, true);
    expect(styles).toContain(palette.probe);
    expect(styles).toContain(palette.ship);
  });
  it('the recycle icon and the fleet research icon use no amber', () => {
    for (const draw of [(c: CanvasRenderingContext2D) => drawRecycleIcon(c, R), (c: CanvasRenderingContext2D) => drawResearchIcon(c, R, 'fleet')]) {
      const { ctx, styles } = recorder();
      draw(ctx);
      expect(styles.length).toBeGreaterThan(0);
      for (const a of amber) expect(styles).not.toContain(a);
    }
  });
});
