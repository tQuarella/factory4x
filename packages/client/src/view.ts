/**
 * Map renderer (Canvas 2D). Everything is drawn in screen pixels: world
 * positions are mapped through `fit`, and the draw functions from
 * placeholders.ts get pixel radii, so line widths and sprites stay crisp at any
 * map scale. Ships and pods interpolate between ticks using session.alpha.
 */
import { activeBattles, guardianStatus, heartIndex, isCaptured, isGuarded, isRootCut, lastBattle, nodeStatus, rootIndex, shipCounts, type Node, type World } from '@factory4x/sim';
import { palette } from './palette.ts';
import {
  drawAsteroid,
  drawGuardRing,
  drawHitFlash,
  drawPocket,
  drawPod,
  drawProbe,
  drawRallyFlag,
  drawRichNode,
  drawRoot,
  drawResourceIcon,
  drawRoute,
  drawShip,
  drawSpore,
  drawThorn,
  drawVine,
  drawWiltingThorn,
} from './placeholders.ts';
import { isBackedUp } from './report.ts';
import { fitMap, type Fit } from './fit.ts';
import { lerp, podTotalTicks, progressFrac } from './interp.ts';
import type { Session } from './session.ts';

/** Smallest touch target radius in CSS px (44 px diameter). */
const MIN_HIT = 22;
const FLASH_MS = 450;
/** The wilt animation: the Bloom's withered thorns fall off for about a second (client only). */
const WILT_MS = 1000;
/** Labels keep this many px clear of the canvas top edge (an 11 px font's ascent plus a little). */
const LABEL_TOP_PAD = 13;

/** Where a guarded node's thorn ring sits, in px around its center, and how big each thorn is. */
export function ringGeom(rr: number, count: number): { ringR: number; thornR: number } {
  const ringR = rr * 1.38 + 4;
  const thornR = Math.max(3.5, Math.min(rr * 0.3, (Math.PI * 2 * ringR) / Math.max(1, count) / 2.3));
  return { ringR, thornR };
}

/**
 * Outer radius of the guard ring (two arcs, Thorn and Spore colour) in px. Pockets draw the ring only, at `ringR`;
 * the Root and the heart also draw each guard, so their ring sits just outside those.
 */
export function guardRingOuter(rr: number, count: number, individuals: boolean): number {
  const { ringR, thornR } = ringGeom(rr, count);
  return individuals ? ringR + thornR + 3 : ringR;
}

/** Radius the Root's and heart's individual guards sit at: just inside the ring band, so the ring stays within the old margin. */
export function guardSpotR(rr: number, count: number): number {
  const outer = guardRingOuter(rr, count, true);
  const w = Math.max(2.5, outer * 0.16);
  return outer - w - ringGeom(rr, count).thornR - 1;
}

/** Radius that a tap on a guarded node may land in: the whole guard ring, and at least a 44 px target. */
export function guardedReach(rr: number, count: number, individuals = true): number {
  return Math.max(MIN_HIT, guardRingOuter(rr, count, individuals) + 3);
}

interface WiltAnim {
  startMs: number;
  from: number;
  to: number;
}

/** The heart's wilt as total guard counts before and after, or null. */
function wiltOf(world: Readonly<World>): { from: number; to: number } | null {
  if (rootIndex(world) < 0) return null;
  const b = lastBattle(world, rootIndex(world));
  if (!b || b.outcome !== 'captured' || !b.wilt) return null;
  const from = b.wilt.from.thorn + b.wilt.from.spore;
  const to = b.wilt.to.thorn + b.wilt.to.spore;
  return from > to ? { from, to } : null;
}

/** Pockets, the Root and the heart have guardians. */
function guardedKind(n: Pick<Node, 'kind'>): boolean {
  return n.kind === 'pocket' || n.kind === 'root' || n.kind === 'heart';
}

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
  private hitNodes: number[] = [];
  private trackedWorld: World | null = null;
  private seenCut: number | null = null;
  private wilt: WiltAnim | null = null;
  /** What the last frame drew for each node: the "!" badge and the dashed backed-up route (tests read it through a dev hook). */
  private readonly drawn = { badge: new Set<number>(), dashed: new Set<number>() };

  drawnBackedUp(node: number): { badge: boolean; route: boolean } {
    return { badge: this.drawn.badge.has(node), route: this.drawn.dashed.has(node) };
  }

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
    if (this.session.world.nodes.length > 0) this.fit = fitMap(this.session.world.nodes, this.w, this.h);
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
      const g = guardedKind(n) ? guardianStatus(this.session.world, n.index) : null;
      const reach = g && g.alive ? guardedReach(this.nodeR(n), g.total, n.kind !== 'pocket') : Math.max(MIN_HIT, this.nodeR(n) + 4);
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
    this.drawn.badge.clear();
    this.drawn.dashed.clear();
    ctx.fillStyle = palette.space;
    ctx.fillRect(0, 0, w, h);
    for (const st of this.stars) {
      ctx.fillStyle = st.bright ? palette.starBright : palette.starDim;
      ctx.fillRect(st.x, st.y, st.r, st.r);
    }

    if (session.hitSeq !== this.seenHit) {
      this.seenHit = session.hitSeq;
      this.hitAt = nowMs;
      this.hitNodes = activeBattles(world).map((b) => b.node);
    }

    // The wilt animation starts when the Root is cut during play. A new run or a resumed save starts with no animation.
    const cutTick = world.stats.rootCutTick;
    if (this.trackedWorld !== world) {
      this.trackedWorld = world;
      this.seenCut = cutTick;
      this.wilt = null;
    } else if (cutTick !== this.seenCut) {
      this.seenCut = cutTick;
      const w = wiltOf(world);
      this.wilt = w ? { startMs: nowMs, from: w.from, to: w.to } : null;
    }
    if (this.wilt && nowMs - this.wilt.startMs >= WILT_MS) this.wilt = null;

    // Routes, then pods on them.
    for (const route of world.routes) {
      const a = this.nodePos(route.from);
      const b = this.nodePos(route.to);
      const backedUp = isBackedUp(world, route.from, nodeStatus(world, route.from));
      if (backedUp) this.drawn.dashed.add(route.from);
      drawRoute(ctx, a.x, a.y, b.x, b.y, route.level, backedUp);
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

    // The vine, under the nodes: pink and pulsing toward the Bloom while the Root lives, grey once it is cut.
    {
      // Areas without a Root (Landfall, the light areas) have no vine.
      if (rootIndex(world) >= 0) {
        const a = this.nodePos(rootIndex(world));
        const b = this.nodePos(heartIndex(world));
        drawVine(ctx, a.x, a.y, b.x, b.y, t, isRootCut(world));
      }
    }

    const counts = shipCounts(world);
    const labels: Array<{ text: string; x: number; y: number }> = [];
    for (const n of world.nodes) {
      const { x, y } = this.nodePos(n.index);
      const rr = this.nodeR(n);
      ctx.save();
      ctx.translate(x, y);
      if (n.kind === 'probe') drawProbe(ctx, rr, t);
      else if (n.kind === 'pocket' && isGuarded(world, n.index)) drawPocket(ctx, rr, t, true, n.prize ?? 'ore');
      else if (n.kind === 'asteroid' || n.kind === 'pocket') {
        drawAsteroid(ctx, rr, n.index * 7 + 3, n.extractors, n.slots);
        // A captured pocket is a rock that shows its prize.
        if (n.kind === 'pocket') drawResourceIcon(ctx, rr * 0.4, n.prize ?? 'ore');
      }
      else if (n.kind === 'root') drawRoot(ctx, rr, t, isRootCut(world));
      else drawRichNode(ctx, rr, t, isCaptured(world));
      ctx.restore();

      let labelTop = y - rr - 15;
      let selR = rr + 6;
      const guard = guardedKind(n) ? guardianStatus(world, n.index) : null;
      if (guard && guard.alive) {
        const wilt = n.kind === 'heart' ? this.wilt : null;
        const individuals = n.kind !== 'pocket';
        const count = wilt ? wilt.from : guard.total;
        const { thornR } = ringGeom(rr, count);
        const spotR = guardSpotR(rr, count);
        if (individuals) {
          for (let i = 0; i < count; i++) {
            const ang = (i / count) * Math.PI * 2 + t * 0.12;
            ctx.save();
            ctx.translate(x + Math.cos(ang) * spotR, y + Math.sin(ang) * spotR);
            if (wilt && i >= wilt.to) {
              // Falls with the angle it had spinning (drawThorn turns at t * 0.8), so it doesn't snap when it starts to wilt.
              const frac = (nowMs - wilt.startMs) / WILT_MS;
              ctx.translate(0, frac * thornR * 3);
              ctx.rotate((wilt.startMs / 1000) * 0.8);
              drawWiltingThorn(ctx, thornR, frac);
            } else {
              const gd = guard.guardHps[i] ?? { type: 'thorn' as const, hp: 0 };
              const frac = gd.hp / Math.max(1, guard.guards[gd.type].hp);
              if (gd.type === 'spore') drawSpore(ctx, thornR, t, frac);
              else drawThorn(ctx, thornR, t, frac);
            }
            ctx.restore();
          }
        }
        // The guard ring: Thorn and Spore arcs, each a share of the full strength (the caps), so it shrinks as guards die.
        const outer = guardRingOuter(rr, count, individuals);
        const cap = Math.max(1, guard.totalCap);
        ctx.save();
        ctx.translate(x, y);
        drawGuardRing(ctx, outer, guard.guards.thorn.count / cap, guard.guards.spore.count / cap, t);
        ctx.restore();
        selR = outer + 3;
        labelTop = y - outer - 10;
        const age = nowMs - this.hitAt;
        if (age < FLASH_MS && this.hitNodes.includes(n.index)) {
          ctx.save();
          ctx.translate(x, y);
          drawHitFlash(ctx, outer * 0.9, age / FLASH_MS);
          ctx.restore();
        }
      }

      // Label (drawn in a last pass, over every ring), selection ring, rally flag, ship badge, warning badge.
      // A label that would clip at the top edge goes below the node instead.
      labels.push({ text: nodeLabel(n), x, y: labelTop < LABEL_TOP_PAD ? y + selR + 12 : labelTop });

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
      if (n.kind !== 'probe' && (isBackedUp(world, n.index, ns) || ns.noRoute)) {
        this.drawn.badge.add(n.index);
        this.badge('!', x - rr * 0.85, y - rr * 0.75, palette.routeBackedUp, '#2a1e00');
      }
    }

    // Labels last, each on a dark pill, so no guard ring hides the name of the node it rings or a neighbour.
    ctx.save();
    ctx.font = '600 11px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const l of labels) {
      const wd = ctx.measureText(l.text).width + 6;
      ctx.fillStyle = 'rgba(5, 7, 13, 0.78)';
      ctx.beginPath();
      ctx.roundRect(l.x - wd / 2, l.y - 10, wd, 14, 4);
      ctx.fill();
      ctx.fillStyle = '#9fb4d6';
      ctx.fillText(l.text, l.x, l.y);
    }
    ctx.restore();

    // Ships in transit.
    for (const s of world.ships) {
      const tr = s.transit;
      if (!tr) continue;
      const a = this.nodePos(tr.from);
      const b = this.nodePos(tr.to);
      const f = progressFrac(tr.ticksLeft, tr.totalTicks, alpha);
      ctx.save();
      ctx.translate(lerp(a.x, b.x, f), lerp(a.y, b.y, f));
      drawShip(ctx, 6, Math.atan2(b.y - a.y, b.x - a.x), s.type);
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
  if (n.kind === 'heart') return 'HEART';
  if (n.kind === 'root') return 'ROOT';
  return n.id.toUpperCase();
}
