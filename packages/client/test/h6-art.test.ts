import { describe, expect, it } from 'vitest';
import { palette } from '../src/palette.ts';
import { drawAreaNode, drawBandDivider, drawBandPill, drawLane, drawLockBadge, drawRelayIcon, drawRelayMark, type AreaNodeState, type LaneMode, type LaneState } from '../src/placeholders.ts';

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

function distFromSeg(hits: P[], x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  return Math.max(
    ...hits.map((p) => {
      const u = Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.y - y1) * dy) / len2));
      return Math.hypot(p.x - (x1 + dx * u), p.y - (y1 + dy * u)) + p.pad;
    }),
  );
}

describe('H6 draw bounds', () => {
  for (const rr of [R, 12]) {
    it(`relay icon stays within r = ${rr}`, () => {
      const { ctx, hits } = recorder();
      drawRelayIcon(ctx, rr);
      expect(hits.length).toBeGreaterThan(0);
      expect(maxRadius(hits)).toBeLessThanOrEqual(rr * 1.0001);
    });
    it(`lock badge stays within r = ${rr}`, () => {
      const { ctx, hits } = recorder();
      drawLockBadge(ctx, rr);
      expect(hits.length).toBeGreaterThan(0);
      expect(maxRadius(hits)).toBeLessThanOrEqual(rr * 1.0001);
    });
  }
  for (const state of ['locked', 'open', 'reclaimed', 'far'] as AreaNodeState[]) {
    it(`area node ${state} stays within r at every tier`, () => {
      for (const tier of [0, 1, 2, 3]) {
        for (const t of [0, 0.5, 1.3, 2.9]) {
          const { ctx, hits } = recorder();
          drawAreaNode(ctx, R, t, tier, state);
          expect(maxRadius(hits)).toBeLessThanOrEqual(R * 1.0001);
        }
      }
    });
  }
  for (const state of ['closed', 'open', 'owned'] as LaneState[]) {
    for (const mode of ['dim', 'normal', 'reveal'] as LaneMode[]) {
      it(`lane ${state} ${mode} stays within 4 px of its segment`, () => {
        for (const [x1, y1, x2, y2] of [[20, 30, 220, 90], [300, 40, 60, 400], [0, 0, 40, 0]] as [number, number, number, number][]) {
          for (const reveal of [0, 25, 60, 100, 150, -10]) {
            for (const t of [0, 0.7, 2.2]) {
              const { ctx, hits } = recorder();
              drawLane(ctx, x1, y1, x2, y2, t, state, mode, reveal);
              if (hits.length === 0) continue;
              expect(distFromSeg(hits, x1, y1, x2, y2)).toBeLessThanOrEqual(4);
            }
          }
        }
      });
    }
  }
});

describe('H6 colour rules', () => {
  it('the relay icon is player blue with no amber and no pink', () => {
    const { ctx, styles } = recorder();
    drawRelayIcon(ctx, R);
    expect(styles).toContain(palette.ship);
    for (const a of [...amber, palette.bloom, palette.mob, palette.spore]) expect(styles).not.toContain(a);
  });
  it('the lock badge is steel grey with an amber shackle', () => {
    const { ctx, styles } = recorder();
    drawLockBadge(ctx, R);
    expect(styles).toContain(palette.plating);
    expect(styles).toContain(palette.probe);
  });
  it('a far area node uses no amber and no pink spikes', () => {
    for (const tier of [0, 3]) {
      const { ctx, styles } = recorder();
      drawAreaNode(ctx, R, 0.7, tier, 'far');
      for (const a of [...amber, palette.bloom]) expect(styles).not.toContain(a);
    }
  });
});

describe('H6 lane modes', () => {
  const heads = (mode: LaneMode, reveal: number): number[] => {
    const { ctx, hits } = recorder();
    drawLane(ctx, 0, 0, 200, 0, 0.7, 'owned', mode, reveal);
    return hits.filter((h) => h.pad === 0).map((h) => h.x);
  };
  it('normal has pulses and dim draws none', () => {
    expect(heads('normal', 100).length).toBeGreaterThan(0);
    expect(heads('dim', 100).length).toBe(0);
  });
  it('reveal keeps its pulses and spark inside the revealed length', () => {
    expect(heads('reveal', 40).length).toBeGreaterThan(0);
    expect(Math.max(...heads('reveal', 40))).toBeLessThanOrEqual(80 + 3.3);
  });
  it('reveal at 100 matches normal; at 0 draws nothing bright', () => {
    expect(heads('reveal', 100).length).toBe(heads('normal', 100).length);
    expect(heads('reveal', 0).length).toBe(0);
  });
  it('the old 7-argument call is unchanged', () => {
    const a = recorder();
    const b = recorder();
    drawLane(a.ctx, 0, 0, 160, 0, 0.7, 'owned');
    drawLane(b.ctx, 0, 0, 160, 0, 0.7, 'owned', 'normal', 100);
    expect(a.hits).toEqual(b.hits);
  });
});

describe('H6 band label', () => {
  it('the pill stays inside its box and the divider draws', () => {
    const { ctx, hits } = recorder();
    drawBandPill(ctx, 80, 18);
    expect(Math.max(...hits.map((p) => Math.abs(p.x) + p.pad))).toBeLessThanOrEqual(40.6);
    expect(Math.max(...hits.map((p) => Math.abs(p.y) + p.pad))).toBeLessThanOrEqual(9.6);
    const d = recorder();
    drawBandDivider(d.ctx, 0, 10, 300);
    expect(d.hits.length).toBeGreaterThan(0);
  });
});

describe('H6 relay mark and lock badge on one node', () => {
  const box = (draw: (c: CanvasRenderingContext2D) => void) => {
    const { ctx, hits } = recorder();
    draw(ctx);
    const xs = hits.map((p) => p.x);
    const ys = hits.map((p) => p.y);
    return { x0: Math.min(...xs.map((x, i) => x - hits[i]!.pad)), x1: Math.max(...xs.map((x, i) => x + hits[i]!.pad)), y0: Math.min(...ys.map((y, i) => y - hits[i]!.pad)), y1: Math.max(...ys.map((y, i) => y + hits[i]!.pad)) };
  };
  for (const rr of [12, 22, 50]) {
    it(`the relay mark stays within its r and the pair do not overlap on a node of r = ${rr}`, () => {
      const m = recorder();
      drawRelayMark(m.ctx, rr * 0.5);
      expect(maxRadius(m.hits)).toBeLessThanOrEqual(rr * 0.5 * 1.0001);
      const mark = box((c) => {
        c.translate(-rr * 0.7, -rr * 0.7);
        drawRelayMark(c, rr * 0.5);
      });
      const lock = box((c) => {
        c.translate(rr * 0.7, -rr * 0.7);
        drawLockBadge(c, rr * 0.5);
      });
      expect(mark.x1).toBeLessThan(lock.x0);
    });
  }
});
