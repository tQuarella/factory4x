/**
 * Overworld renderer (DESIGN.md H4 "Overworld screen"): six area nodes and the lanes between them on the starfield,
 * drawn on the same canvas as the area map. Screen pixels throughout, like view.ts; the draw functions of
 * placeholders.ts get pixel radii. Lanes are drawn on an untranslated context, trimmed to the node rims, with their
 * ends ordered so the pulses of an owned lane flow toward Landfall.
 */
import { areaStatus, isReclaimed, type AreaStatus, type SimData, type World } from '@factory4x/sim';
import { fitOverworld, type Fit } from './fit.ts';
import { palette } from './palette.ts';
import { drawAreaNode, drawLane, drawProbeCore, drawResourceIcon, type LaneState } from './placeholders.ts';
import { ratesX10Text, exportX10 } from './report.ts';
import type { Session } from './session.ts';

/** Area node radius in frame units (the spec: at least 44 px tall at 375x667). */
export const AREA_R_SU = 80;
/** Smallest on-screen node radius, px. */
const MIN_NODE_R = 14;
/** Smallest touch target radius, px (44 px diameter). */
const MIN_HIT = 22;
/** Gap between a node's rim and the lane end, px. */
const RIM_GAP = 2;
const LABEL_FONT = '600 11px ui-monospace, Menlo, Consolas, monospace';
/** px under (or over) a node that its two label lines need. */
const LABEL_ROOM = 36;
const EXPORT_FONT = '600 10px ui-monospace, Menlo, Consolas, monospace';

/** Resource shown at the node's centre: the non-ore haul that is larger (ice or crystal), else ore. The Deep shows the probe core. */
export function prizeOf(area: Pick<AreaStatus, 'haul'>): 'ore' | 'ice' | 'crystal' {
  const { ice, crystal } = area.haul;
  if (ice <= 0 && crystal <= 0) return 'ore';
  return ice >= crystal ? 'ice' : 'crystal';
}

/** Lane lengths in hops from the start area (tier 0), so ends can be ordered toward it. Unreachable areas get Infinity. */
export function hopsFromStart(data: SimData): number[] {
  const n = data.map.areas.length;
  const dist: number[] = Array.from({ length: n }, () => Infinity);
  const ids = data.map.areas.map((a) => a.id);
  const start = data.map.areas.findIndex((a) => a.tier === 0);
  if (start < 0) return dist;
  dist[start] = 0;
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const a = queue[q]!;
    for (const [x, y] of data.map.lanes) {
      const ia = ids.indexOf(x);
      const ib = ids.indexOf(y);
      const other = ia === a ? ib : ib === a ? ia : -1;
      if (other >= 0 && dist[other] === Infinity) {
        dist[other] = dist[a]! + 1;
        queue.push(other);
      }
    }
  }
  return dist;
}

export interface LaneDraw {
  /** Area indices, `from` first: pulses run from → to, toward the start area. */
  from: number;
  to: number;
  state: LaneState;
}

/** Every lane with its state (owned: both ends reclaimed; open: one end; closed: none) and its ends ordered toward Landfall. */
export function laneDraws(world: Readonly<World>, data: SimData): LaneDraw[] {
  const hops = hopsFromStart(data);
  const ids = data.map.areas.map((a) => a.id);
  return data.map.lanes.map(([x, y]) => {
    let a = ids.indexOf(x);
    let b = ids.indexOf(y);
    if (hops[a]! < hops[b]! || (hops[a] === hops[b] && a < b)) [a, b] = [b, a];
    const n = (isReclaimed(world, a) ? 1 : 0) + (isReclaimed(world, b) ? 1 : 0);
    return { from: a, to: b, state: n === 2 ? 'owned' : n === 1 ? 'open' : 'closed' };
  });
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Which side of a node its label goes: the one with fewer lane samples under it, and inside the canvas. */
export function labelSides(centers: readonly { x: number; y: number }[], lanes: readonly [number, number][], r: number, w: number, h: number): Array<'above' | 'below'> {
  const samples: Array<{ x: number; y: number }> = [];
  for (const [a, b] of lanes) {
    const p = centers[a]!;
    const q = centers[b]!;
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    const n = Math.max(1, Math.round(len / 5));
    for (let i = 0; i <= n; i++) samples.push({ x: p.x + ((q.x - p.x) * i) / n, y: p.y + ((q.y - p.y) * i) / n });
  }
  const LW = 120;
  const LH = 30;
  return centers.map((c) => {
    const rect = (above: boolean): Rect => ({ x: c.x - LW / 2, y: above ? c.y - r - 3 - LH : c.y + r + 3, w: LW, h: LH });
    const score = (rc: Rect): number => {
      let s = 0;
      for (const p of samples) {
        // The node's own lanes leave it at the rim, so their samples near the centre don't count against either side.
        if (Math.hypot(p.x - c.x, p.y - c.y) < r + 2) continue;
        if (p.x >= rc.x && p.x <= rc.x + rc.w && p.y >= rc.y && p.y <= rc.y + rc.h) s++;
      }
      if (rc.y < 2 || rc.y + rc.h > h - 2) s += 1000;
      if (rc.x < 0 || rc.x + rc.w > w) s += 5;
      return s;
    };
    return score(rect(false)) <= score(rect(true)) ? 'below' : 'above';
  });
}

interface Cache {
  world: World;
  key: string;
  statuses: AreaStatus[];
  lanes: LaneDraw[];
}

export class WorldView {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly app: { session: Session };
  private fit: Fit = { scale: 1, ox: 0, oy: 0 };
  private w = 1;
  private h = 1;
  private stars: Array<{ x: number; y: number; r: number; bright: boolean }> = [];
  private sides: Array<'above' | 'below'> = [];
  private cache: Cache | null = null;
  /** Vertical shift (px) that keeps the selected area above an overlaying sheet; eases toward its target. */
  private pan = 0;
  /** Px of the canvas's bottom covered by a sheet right now (portrait overlay), set by the host each frame. */
  cover = 0;

  constructor(canvas: HTMLCanvasElement, app: { session: Session }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.app = app;
  }

  private get session(): Session {
    return this.app.session;
  }

  /** Node radius in px. */
  get nodeR(): number {
    return Math.max(MIN_NODE_R, AREA_R_SU * this.fit.scale);
  }

  /** Re-fit to the canvas's current CSS size. */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, this.canvas.clientWidth);
    this.h = Math.max(1, this.canvas.clientHeight);
    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const areas = this.session.data.map.areas;
    this.fit = fitOverworld(areas, AREA_R_SU, this.w, this.h);
    const centers = areas.map((_, i) => this.basePos(i));
    const ids = areas.map((a) => a.id);
    const lanes = this.session.data.map.lanes.map(([x, y]): [number, number] => [ids.indexOf(x), ids.indexOf(y)]);
    this.sides = labelSides(centers, lanes, this.nodeR, this.w, this.h);
    let seed = 777;
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

  /** Area centre in CSS px relative to the canvas, with the pan. */
  areaPos(a: number): { x: number; y: number } {
    const p = this.basePos(a);
    return { x: p.x, y: p.y + this.pan };
  }

  private basePos(a: number): { x: number; y: number } {
    const area = this.session.data.map.areas[a]!;
    return { x: this.fit.ox + area.x * this.fit.scale, y: this.fit.oy + area.y * this.fit.scale };
  }

  /** The pan that puts the selected area, its ring and its label inside the part of the canvas no sheet covers; 0 with none. */
  private panTarget(selected: number | null): number {
    if (selected === null || this.cover <= 0) return 0;
    const y = this.basePos(selected).y;
    const free = this.h - this.cover;
    const below = y + this.nodeR + LABEL_ROOM;
    return Math.min(0, free - 6 - below);
  }

  /** The area under a tap at canvas-relative (px, py), or null. Nearest centre wins among areas in reach. */
  hitTest(px: number, py: number): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    const reach = Math.max(MIN_HIT, this.nodeR + 4);
    this.session.data.map.areas.forEach((_, i) => {
      const p = this.areaPos(i);
      const d = Math.hypot(px - p.x, py - p.y);
      if (d <= reach && d < bestD) {
        best = i;
        bestD = d;
      }
    });
    return best;
  }

  private status(): Cache {
    const world = this.session.world;
    const data = this.session.data;
    const key = `${world.tick}:${world.tun['guard.capPct']}`;
    if (this.cache === null || this.cache.world !== world || this.cache.key !== key) {
      this.cache = { world, key, statuses: data.map.areas.map((_, i) => areaStatus(world, data, i)), lanes: laneDraws(world, data) };
    }
    return this.cache;
  }

  draw(nowMs: number, selected: number | null): void {
    const { ctx, w, h } = this;
    const t = nowMs / 1000;
    const world = this.session.world;
    const data = this.session.data;
    ctx.fillStyle = palette.space;
    ctx.fillRect(0, 0, w, h);
    for (const st of this.stars) {
      ctx.fillStyle = st.bright ? palette.starBright : palette.starDim;
      ctx.fillRect(st.x, st.y, st.r, st.r);
    }
    const { statuses, lanes } = this.status();
    const rr = this.nodeR;
    const target = this.panTarget(selected);
    this.pan = Math.abs(target - this.pan) < 0.5 ? target : this.pan + (target - this.pan) * 0.3;

    for (const lane of lanes) {
      const p = this.areaPos(lane.from);
      const q = this.areaPos(lane.to);
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if (len <= 2 * (rr + RIM_GAP)) continue;
      const ux = (q.x - p.x) / len;
      const uy = (q.y - p.y) / len;
      const trim = rr + RIM_GAP;
      drawLane(ctx, p.x + ux * trim, p.y + uy * trim, q.x - ux * trim, q.y - uy * trim, t, lane.state);
    }

    const pct = world.tun['shipments.pct'];
    const labels: Array<{ name: string; sub: string; x: number; y: number; above: boolean; dim: boolean; reclaimed: boolean }> = [];
    statuses.forEach((st, i) => {
      const { x, y } = this.areaPos(i);
      const reclaimed = st.state === 'reclaimed';
      ctx.save();
      ctx.translate(x, y);
      drawAreaNode(ctx, rr, t, st.tier, st.state === 'reclaimed' ? 'reclaimed' : st.state === 'locked' ? 'locked' : 'open');
      if (data.map.areas[i]!.tier >= 3) drawProbeCore(ctx, rr * 0.45, t, reclaimed ? 1 : 0);
      else drawResourceIcon(ctx, rr * 0.4, prizeOf(st));
      ctx.restore();
      if (selected === i) {
        ctx.save();
        ctx.strokeStyle = palette.starBright;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(x, y, rr + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      const exp = exportX10(st.export, pct);
      labels.push({
        name: st.name,
        sub: reclaimed ? ratesX10Text(exp) : '',
        x,
        y,
        above: this.sides[i] === 'above',
        dim: st.state === 'locked',
        reclaimed,
      });
    });

    // Labels last, each on a dark pill, so no lane runs through the name of a node.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const l of labels) {
      const lines = l.sub ? [l.name, l.sub] : [l.name];
      const top = l.above ? l.y - rr - 3 - (lines.length * 14 + 2) : l.y + rr + 3;
      lines.forEach((text, k) => {
        ctx.font = k === 0 ? LABEL_FONT : EXPORT_FONT;
        const wd = ctx.measureText(text).width + 8;
        const ly = top + 12 + k * 14;
        // Keep the pill inside the canvas whatever the text width.
        const lx = Math.min(w - wd / 2 - 2, Math.max(wd / 2 + 2, l.x));
        ctx.fillStyle = 'rgba(5, 7, 13, 0.78)';
        ctx.beginPath();
        ctx.roundRect(lx - wd / 2, ly - 11, wd, 14, 4);
        ctx.fill();
        ctx.fillStyle = k === 0 ? (l.reclaimed ? palette.probe : l.dim ? palette.areaLocked : palette.starBright) : palette.probe;
        ctx.fillText(text, lx, ly);
      });
    }
    ctx.restore();
  }
}
