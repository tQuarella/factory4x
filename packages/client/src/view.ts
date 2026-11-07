/**
 * Map renderer (Canvas 2D). Everything is drawn in screen pixels: world
 * positions are mapped through `fit`, and the draw functions from
 * placeholders.ts get pixel radii, so line widths and sprites stay crisp at any
 * map scale. Ships and pods interpolate between ticks using session.alpha.
 */
import { guardianStatus, isCaptured, nodeStatus, shipCounts, type Node } from '@factory4x/sim';
import { palette } from './palette.ts';
import { drawAsteroid, drawHitFlash, drawPod, drawProbe, drawRallyFlag, drawRichNode, drawRoute, drawShip, drawThorn } from './placeholders.ts';
import { fitMap, type Fit } from './fit.ts';
import { lerp, podTotalTicks, progressFrac } from './interp.ts';
import type { Session } from './session.ts';

/** Smallest touch target radius in CSS px (44 px diameter). */
const MIN_HIT = 22;
const FLASH_MS = 450;

export class MapView {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly app: { session: Session };
  private fit: Fit = { scale: 1, ox: 0, oy: 0 };
  private w = 1;
  private h = 1;
  private stars: Array<{ x: number; y: number; r: number; bright: boolean }> = [];
  private seenHit = 0;
  private hitAt = -1e9;

  constructor(canvas: HTMLCanvasElement, app: { session: Session }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.app = app;
  }

  private get session(): Session {
    return this.app.session;
  }

  /** Re-fit to the canvas's current CSS size (call on window or layout resize). */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, this.canvas.clientWidth);
    this.h = Math.max(1, this.canvas.clientHeight);
    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.fit = fitMap(this.session.world.nodes, this.w, this.h);
    let seed = 12345;
    const rnd = (): number => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed / 4294967296;
    };
    this.stars = Array.from({ length: Math.floor((this.w * this.h) / 2600) + 30 }, () => ({
      x: rnd() * this.w,
      y: rnd() * this.h,
      r: rnd() * 1.2 + 0.3,
      bright: rnd() < 0.15,
    }));
  }

  private sx(x: number): number {
    return this.fit.ox + x * this.fit.scale;
  }
  private sy(y: number): number {
    return this.fit.oy + y * this.fit.scale;
  }

  /** On-screen radius of a node sprite. */
  private nodeR(n: Node): number {
    return Math.max(14, n.r * this.fit.scale);
  }

  /** Node center in CSS px relative to the canvas. */
  nodePos(i: number): { x: number; y: number } {
    const n = this.session.world.nodes[i]!;
    return { x: this.sx(n.x), y: this.sy(n.y) };
  }

  /** The node under a tap at canvas-relative (px, py), or null. Nearest center wins among nodes in reach. */
  hitTest(px: number, py: number): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    for (const n of this.session.world.nodes) {
      const dx = px - this.sx(n.x);
      const dy = py - this.sy(n.y);
      const d = Math.sqrt(dx * dx + dy * dy);
      const reach = Math.max(MIN_HIT, this.nodeR(n) + 4);
      if (d <= reach && d < bestD) {
        best = n.index;
        bestD = d;
      }
    }
    return best;
  }

  draw(nowMs: number, selected: number | null): void {
    const { ctx, w, h } = this;
    const session = this.session;
    const world = session.world;
    const alpha = session.alpha;
    const t = nowMs / 1000;
    ctx.fillStyle = palette.space;
    ctx.fillRect(0, 0, w, h);
    for (const st of this.stars) {
      ctx.fillStyle = st.bright ? palette.starBright : palette.starDim;
      ctx.fillRect(st.x, st.y, st.r, st.r);
    }

    if (session.hitSeq !== this.seenHit) {
      this.seenHit = session.hitSeq;
      this.hitAt = nowMs;
    }

    // Routes, then pods on them.
    for (const route of world.routes) {
      const a = this.nodePos(route.from);
      const b = this.nodePos(route.to);
      drawRoute(ctx, a.x, a.y, b.x, b.y, route.level, nodeStatus(world, route.from).backedUp);
    }
    const podTotal = (length: number): number => podTotalTicks(length, world.tun['route.podSpeedSu']);
    for (const route of world.routes) {
      const a = this.nodePos(route.from);
      const b = this.nodePos(route.to);
      const total = podTotal(route.length);
      for (const pod of route.pods) {
        const f = progressFrac(pod.ticksLeft, total, alpha);
        ctx.save();
        ctx.translate(lerp(a.x, b.x, f), lerp(a.y, b.y, f));
        drawPod(ctx, 2.2 + Math.min(pod.amount, 6) * 0.45);
        ctx.restore();
      }
    }

    const counts = shipCounts(world);
    const guard = guardianStatus(world);
    for (const n of world.nodes) {
      const { x, y } = this.nodePos(n.index);
      const rr = this.nodeR(n);
      ctx.save();
      ctx.translate(x, y);
      if (n.kind === 'probe') drawProbe(ctx, rr, t);
      else if (n.kind === 'asteroid') drawAsteroid(ctx, rr, n.index * 7 + 3, n.extractors, n.slots);
      else drawRichNode(ctx, rr, t, isCaptured(world));
      ctx.restore();

      let labelTop = y - rr - 15;
      let selR = rr + 6;
      if (n.kind === 'rich' && !isCaptured(world)) {
        const count = guard.thornHps.length;
        const ringR = rr * 1.38 + 4;
        const thornR = Math.max(3.5, Math.min(rr * 0.3, (Math.PI * 2 * ringR) / Math.max(1, count) / 2.3));
        for (let i = 0; i < count; i++) {
          const ang = (i / count) * Math.PI * 2 + t * 0.12;
          ctx.save();
          ctx.translate(x + Math.cos(ang) * ringR, y + Math.sin(ang) * ringR);
          drawThorn(ctx, thornR, t, guard.thornHps[i]! / Math.max(1, guard.thornHp));
          ctx.restore();
        }
        selR = ringR + thornR + 3;
        labelTop = y - ringR - thornR - 12;
        const age = nowMs - this.hitAt;
        if (age < FLASH_MS) {
          ctx.save();
          ctx.translate(x, y);
          drawHitFlash(ctx, ringR * 0.9, age / FLASH_MS);
          ctx.restore();
        }
      }

      // Label, selection ring, rally flag, ship badge, warning badge.
      ctx.save();
      ctx.font = '600 11px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#9fb4d6';
      ctx.fillText(nodeLabel(n), x, labelTop);
      ctx.restore();

      if (selected === n.index) {
        ctx.save();
        ctx.strokeStyle = palette.starBright;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(x, y, selR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (world.rally === n.index) {
        ctx.save();
        ctx.translate(x - rr - 6, y - rr * 0.5);
        drawRallyFlag(ctx, 11);
        ctx.restore();
      }
      const parked = counts.at[n.index]!;
      if (parked > 0) this.badge(String(parked), x + rr * 0.85, y - rr * 0.75, palette.ship, '#0b1626');
      const ns = nodeStatus(world, n.index);
      if (n.kind !== 'probe' && (ns.backedUp || ns.noRoute)) this.badge('!', x - rr * 0.85, y - rr * 0.75, palette.routeBackedUp, '#2a1e00');
    }

    // Ships in transit.
    for (const s of world.ships) {
      const tr = s.transit;
      if (!tr) continue;
      const a = this.nodePos(tr.from);
      const b = this.nodePos(tr.to);
      const f = progressFrac(tr.ticksLeft, tr.totalTicks, alpha);
      ctx.save();
      ctx.translate(lerp(a.x, b.x, f), lerp(a.y, b.y, f));
      drawShip(ctx, 6, Math.atan2(b.y - a.y, b.x - a.x));
      ctx.restore();
    }
  }

  private badge(text: string, x: number, y: number, fill: string, ink: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.font = '700 11px ui-monospace, Menlo, Consolas, monospace';
    const wd = Math.max(16, ctx.measureText(text).width + 8);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x - wd / 2, y - 8, wd, 16, 8);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }
}

/** Short on-map name. */
export function nodeLabel(n: Pick<Node, 'id' | 'kind'>): string {
  if (n.kind === 'probe') return 'PROBE';
  if (n.kind === 'rich') return 'BLOOM';
  return n.id.toUpperCase();
}
