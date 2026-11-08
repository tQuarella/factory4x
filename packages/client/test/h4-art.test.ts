import { describe, expect, it } from 'vitest';
import { palette } from '../src/palette.ts';
import {
  type AreaNodeState,
  type ResearchIconId,
  drawAreaNode,
  drawLane,
  drawProbeCore,
  drawResearchIcon,
  drawStockpileIcon,
} from '../src/placeholders.ts';

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
const states: AreaNodeState[] = ['locked', 'open', 'reclaimed'];
const icons: ResearchIconId[] = ['lancer', 'flak', 'opening', 'extract', 'rigs', 'yards', 'core'];

function maxRadius(hits: P[]): number {
  return Math.max(...hits.map((p) => Math.hypot(p.x, p.y) + p.pad));
}

describe('H4 amber rule: amber marks reclaimed areas only', () => {
  const amber = [palette.probe, palette.probeGlow, palette.laneOwned];
  it('an empty probe core (frac 0) uses no amber', () => {
    for (const t of [0, 0.8, 1.6]) {
      const { ctx, styles } = recorder();
      drawProbeCore(ctx, R, t, 0);
      expect(styles.length).toBeGreaterThan(0);
      for (const a of amber) expect(styles).not.toContain(a);
    }
  });
  it('a filled probe core does use amber', () => {
    const { ctx, styles } = recorder();
    drawProbeCore(ctx, R, 0, 1);
    expect(styles).toContain(palette.probe);
  });
  for (const state of ['locked', 'open'] as const) {
    it(`a ${state} area node uses no amber`, () => {
      for (const tier of [0, 1, 2, 3]) {
        const { ctx, styles } = recorder();
        drawAreaNode(ctx, R, 0.7, tier, state);
        for (const a of amber) expect(styles).not.toContain(a);
      }
    });
  }
  it('a reclaimed area node does use amber', () => {
    const { ctx, styles } = recorder();
    drawAreaNode(ctx, R, 0.7, 1, 'reclaimed');
    expect(styles).toContain(palette.probe);
  });
});

describe('H4 draw bounds', () => {
  for (const state of states) {
    for (const tier of [0, 1, 2, 3]) {
      it(`area node tier ${tier} ${state} stays within r`, () => {
        for (const t of [0, 0.5, 1.3, 2.9]) {
          const { ctx, hits } = recorder();
          drawAreaNode(ctx, R, t, tier, state);
          expect(hits.length).toBeGreaterThan(0);
          expect(maxRadius(hits)).toBeLessThanOrEqual(R * 1.0001);
        }
      });
    }
  }

  for (const id of icons) {
    it(`research icon ${id} stays within r`, () => {
      const { ctx, hits } = recorder();
      drawResearchIcon(ctx, R, id);
      expect(maxRadius(hits)).toBeLessThanOrEqual(R * 1.0001);
    });
  }

  it('probe core stays within r at every fill', () => {
    for (const frac of [0, 0.25, 0.5, 1, 2, -1]) {
      for (const t of [0, 0.8, 1.6]) {
        const { ctx, hits } = recorder();
        drawProbeCore(ctx, R, t, frac);
        expect(maxRadius(hits)).toBeLessThanOrEqual(R * 1.0001);
      }
    }
  });

  it('stockpile icon stays within r', () => {
    const { ctx, hits } = recorder();
    drawStockpileIcon(ctx, R);
    expect(maxRadius(hits)).toBeLessThanOrEqual(R * 1.0001);
  });

  for (const state of ['closed', 'open', 'owned'] as const) {
    it(`lane ${state} stays within 4 px of its segment`, () => {
      const segs: [number, number, number, number][] = [
        [20, 30, 220, 90],
        [300, 40, 60, 400],
        [0, 0, 40, 0],
      ];
      for (const [x1, y1, x2, y2] of segs) {
        for (const t of [0, 0.7, 2.2]) {
          const { ctx, hits } = recorder();
          drawLane(ctx, x1, y1, x2, y2, t, state);
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len2 = dx * dx + dy * dy;
          const worst = Math.max(
            ...hits.map((p) => {
              const u = Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.y - y1) * dy) / len2));
              return Math.hypot(p.x - (x1 + dx * u), p.y - (y1 + dy * u)) + p.pad;
            }),
          );
          expect(worst).toBeLessThanOrEqual(4);
        }
      }
    });
  }

  it('owned lane pulses move from (x1, y1) toward (x2, y2)', () => {
    const along = (t: number): number => {
      const { ctx, hits } = recorder();
      drawLane(ctx, 0, 0, 160, 0, t, 'owned');
      // Pulse heads are the filled dots; the stroke is the line itself.
      const dots = hits.filter((h) => h.pad === 0).map((h) => h.x);
      return dots.reduce((a, b) => a + b, 0) / dots.length;
    };
    expect(along(0.7)).toBeGreaterThan(along(0.5));
  });
});
