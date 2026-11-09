/**
 * Overworld renderer (DESIGN.md H4 "Overworld screen", H6 "Overworld map"): the area nodes and the lanes between them on the
 * starfield, drawn on the same canvas as the area map. Screen pixels throughout, like view.ts; the draw functions of
 * placeholders.ts get pixel radii. The map pans (a drag; a touch that moves under TAP_SLOP is a tap; no zoom, no momentum).
 * Lanes are drawn on an untranslated context, trimmed to the node rims, with their ends ordered so the pulses of an owned lane
 * flow toward Landfall. Every layout number comes from the data (positions, bands, lanes); nothing here knows a relay's place.
 */
import { areaStatus, isReclaimed, overworldStatus, type AreaStatus, type OverworldStatus, type SimData, type World } from '@factory4x/sim';
import { clampScroll, fitOverworld, scrollMax, type OwFit } from './fit.ts';
import { NAME_GAP, bandLabels, overlap, type BandLabel, type Rect } from './owlayout.ts';
import { palette } from './palette.ts';
import {
  drawAreaNode,
  drawBandDivider,
  drawBandPill,
  drawLane,
  drawLockBadge,
  drawProbeCore,
  drawRelayMark,
  drawResourceIcon,
  type AreaNodeState,
  type LaneMode,
  type LaneState,
} from './placeholders.ts';
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
const BAND_FONT = '600 10px ui-monospace, Menlo, Consolas, monospace';
/** px under (or over) a node that its two label lines need. */
const LABEL_ROOM = 42;
const EXPORT_FONT = '600 10px ui-monospace, Menlo, Consolas, monospace';
/** A touch or drag that moves less than this (px) is a tap (DESIGN.md H6). */
export const TAP_SLOP = 10;
/** The step moment's length, ms (DESIGN.md H6: about 1.5 s). */
export const STEP_MS = 1500;
const BAND_PILL_H = 18;

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

/** The brightness mode of a lane (H6): dim while it runs into a locked band, else normal. */
export function laneMode(ow: Pick<OverworldStatus, 'areas'>, lane: Pick<LaneDraw, 'from' | 'to'>): LaneMode {
  return ow.areas[lane.from]!.locked || ow.areas[lane.to]!.locked ? 'dim' : 'normal';
}

/** The look of a node (H6): reclaimed, open, locked (known, band locked) or far (not scouted). */
export function nodeState(a: Pick<OverworldStatus['areas'][number], 'reclaimed' | 'known' | 'open'>): AreaNodeState {
  return a.reclaimed ? 'reclaimed' : !a.known ? 'far' : a.open ? 'open' : 'locked';
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
  // Labels already placed (by index), so two neighbours close together (the 200 su relay pair) don't put their names on each other.
  const placed: Rect[] = [];
  const out: Array<'above' | 'below'> = [];
  centers.forEach((c, i) => {
    const rect = (above: boolean): Rect => ({ x: c.x - LW / 2, y: above ? c.y - r - NAME_GAP - LH : c.y + r + NAME_GAP, w: LW, h: LH });
    const score = (rc: Rect): number => {
      let s = 0;
      for (const p of samples) {
        // The node's own lanes leave it at the rim, so their samples near the centre don't count against either side.
        if (Math.hypot(p.x - c.x, p.y - c.y) < r + 2) continue;
        if (p.x >= rc.x && p.x <= rc.x + rc.w && p.y >= rc.y && p.y <= rc.y + rc.h) s++;
      }
      if (rc.y < 2 || rc.y + rc.h > h - 2) s += 1000;
      if (rc.x < 0 || rc.x + rc.w > w) s += 5;
      for (const o of placed) if (overlap(rc, o)) s += 500;
      centers.forEach((o, k) => {
        if (k !== i && overlap(rc, { x: o.x - r - 3, y: o.y - r - 3, w: 2 * r + 6, h: 2 * r + 6 })) s += 500;
      });
      return s;
    };
    const side = score(rect(false)) <= score(rect(true)) ? 'below' : 'above';
    placed.push(rect(side === 'above'));
    out.push(side);
  });
  return out;
}

interface Cache {
  world: World;
  key: string;
  statuses: AreaStatus[];
  ow: OverworldStatus;
  lanes: LaneDraw[];
}

/** The step moment in progress (DESIGN.md H6): the first relay of a band was just reclaimed and `opened` is the band it opened. */
interface StepAnim {
  opened: number;
  start: number;
  fromY: number;
  toY: number;
}

function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);
const ramp = (t: number, a: number, b: number): number => Math.max(0, Math.min(1, (t - a) / (b - a)));

export class WorldView {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly app: { session: Session };
  private fit: OwFit = { scale: 1, ox: 0, oy: 0, contentW: 1, contentH: 1 };
  private w = 1;
  private h = 1;
  private stars: Array<{ x: number; y: number; r: number; bright: boolean }> = [];
  private sides: Array<'above' | 'below'> = [];
  private bands: BandLabel[] = [];
  private cache: Cache | null = null;
  /** The pan, px: what is added to a node's content position to get its screen position, negated. */
  private scrollX = 0;
  private scrollY = 0;
  private goalX = 0;
  private goalY = 0;
  /** Px of the canvas's bottom covered by a sheet right now (portrait overlay), set by the host each frame. The pan reaches that much further. */
  cover = 0;
  /** The area the view is centred on until the player pans (re-applied when the layout changes). */
  private focusTarget: number | null = null;
  private userMoved = false;
  private step: StepAnim | null = null;
  private stepPending: number | null = null;
  private drag: { id: number; sx: number; sy: number; lx: number; ly: number; moved: boolean } | null = null;
  private dragged = false;

  constructor(canvas: HTMLCanvasElement, app: { session: Session }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.app = app;
    this.attach();
  }

  private get session(): Session {
    return this.app.session;
  }

  /** Node radius in px. */
  get nodeR(): number {
    return Math.max(MIN_NODE_R, AREA_R_SU * this.fit.scale);
  }

  // --- input: drag to pan ------------------------------------------------------------------------------------------

  private attach(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (ev) => {
      if (!this.session.onOverworld) return;
      this.dragged = false;
      this.drag = { id: ev.pointerId, sx: ev.clientX, sy: ev.clientY, lx: ev.clientX, ly: ev.clientY, moved: false };
      try {
        c.setPointerCapture(ev.pointerId);
      } catch {
        // A synthetic pointer has nothing to capture.
      }
    });
    c.addEventListener('pointermove', (ev) => {
      const d = this.drag;
      if (!d || d.id !== ev.pointerId) return;
      if (!d.moved) {
        if (Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) < TAP_SLOP) return;
        d.moved = true;
        this.dragged = true;
        this.skipStep();
        // The pan starts from here, so there is no jump of TAP_SLOP px.
        d.lx = ev.clientX;
        d.ly = ev.clientY;
        return;
      }
      this.panBy(d.lx - ev.clientX, d.ly - ev.clientY);
      d.lx = ev.clientX;
      d.ly = ev.clientY;
    });
    const end = (ev: PointerEvent): void => {
      if (this.drag && this.drag.id === ev.pointerId) this.drag = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener(
      'wheel',
      (ev) => {
        if (!this.session.onOverworld) return;
        ev.preventDefault();
        this.skipStep();
        this.panBy(ev.deltaX, ev.deltaY);
      },
      { passive: false },
    );
  }

  /** True once, after a gesture that panned: the click the browser sends after it is not a tap. */
  consumeDrag(): boolean {
    const d = this.dragged;
    this.dragged = false;
    return d;
  }

  private limits(): { x: number; y: number } {
    return { x: scrollMax(this.fit.contentW, this.w), y: scrollMax(this.fit.contentH, this.h, this.cover) };
  }

  /** Pans by (dx, dy) px at once, held inside the frame. */
  panBy(dx: number, dy: number): void {
    this.userMoved = true;
    const m = this.limits();
    this.goalX = this.scrollX = clampScroll(this.scrollX + dx, m.x);
    this.goalY = this.scrollY = clampScroll(this.scrollY + dy, m.y);
  }

  /** The pan now, px. */
  get scroll(): { x: number; y: number } {
    return { x: this.scrollX, y: this.scrollY };
  }

  /** The furthest the pan reaches now. */
  get scrollLimits(): { x: number; y: number } {
    return this.limits();
  }

  // --- layout ------------------------------------------------------------------------------------------------------

  /** Re-fit to the canvas's current CSS size. */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, this.canvas.clientWidth);
    this.h = Math.max(1, this.canvas.clientHeight);
    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const data = this.session.data;
    const areas = data.map.areas;
    this.fit = fitOverworld(areas, AREA_R_SU, this.w, this.h);
    const centers = areas.map((_, i) => this.basePos(i));
    const ids = areas.map((a) => a.id);
    const lanes = data.map.lanes.map(([x, y]): [number, number] => [ids.indexOf(x), ids.indexOf(y)]);
    this.sides = labelSides(centers, lanes, this.nodeR, this.fit.contentW, this.fit.contentH);
    this.ctx.font = BAND_FONT;
    this.bands = bandLabels({
      centers,
      bands: areas.map((a) => a.tier),
      sides: this.sides,
      r: this.nodeR,
      contentH: this.fit.contentH,
      pill: (band) => ({ w: Math.ceil(this.ctx.measureText(`Band ${band} · locked`).width) + 28, h: BAND_PILL_H }),
    });
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
    if (this.focusTarget !== null && !this.userMoved) {
      this.centreOn(this.focusTarget);
    } else {
      const m = this.limits();
      this.goalX = this.scrollX = clampScroll(this.scrollX, m.x);
      this.goalY = this.scrollY = clampScroll(this.scrollY, m.y);
    }
  }

  /** Area centre in CSS px relative to the canvas, with the pan. */
  areaPos(a: number): { x: number; y: number } {
    const p = this.basePos(a);
    return { x: p.x - this.scrollX, y: p.y - this.scrollY };
  }

  /** Area centre in content px (the map at scroll 0). */
  private basePos(a: number): { x: number; y: number } {
    const area = this.session.data.map.areas[a]!;
    return { x: this.fit.ox + area.x * this.fit.scale, y: this.fit.oy + area.y * this.fit.scale };
  }

  /** The name labels as the last frame drew them (canvas CSS px, text widths measured), by area; null where not drawn. For the host's test hooks. */
  private drawnLabels: Array<Rect | null> = [];

  labelRects(): Array<Rect | null> {
    return this.drawnLabels.map((r) => (r === null ? null : { ...r }));
  }

  /** The band labels' boxes in canvas CSS px, with the pan, for the host's test hooks. */
  bandRects(): Array<{ band: number; x: number; y: number; w: number; h: number }> {
    return this.bands.map((b) => ({ band: b.band, x: b.rect.x - this.scrollX, y: b.rect.y - this.scrollY, w: b.rect.w, h: b.rect.h }));
  }

  /** Centres the map on an area at once (the view opens centred on the area you just left), held inside the frame. Before the first layout it waits for it. */
  focus(area: number): void {
    this.focusTarget = area;
    this.userMoved = false;
    this.step = null;
    this.stepPending = null;
    this.centreOn(area);
  }

  private centreOn(area: number): void {
    const p = this.basePos(area);
    const m = this.limits();
    this.goalX = this.scrollX = clampScroll(p.x - this.w / 2, m.x);
    this.goalY = this.scrollY = clampScroll(p.y - (this.h - this.cover) / 2, m.y);
  }

  /**
   * Pans the least that brings an area, its marks and its labels inside the part of the canvas no sheet covers. Called when a
   * sheet opens for it. The pan reaches `cover` px further while the sheet is up, so the areas above stay reachable by dragging.
   */
  reveal(area: number): void {
    this.userMoved = true;
    const p = this.basePos(area);
    const r = this.nodeR;
    const top = p.y - 1.5 * r - this.goalY;
    const bottom = p.y + r + LABEL_ROOM - this.goalY;
    const free = this.h - this.cover - 6;
    let dy = 0;
    if (bottom > free) dy = bottom - free;
    if (top + dy < 4) dy = 4 - top;
    this.goalY = clampScroll(this.goalY + dy, this.limits().y);
  }

  // --- the step moment ---------------------------------------------------------------------------------------------

  /** True while the step moment plays. */
  get stepActive(): boolean {
    return this.step !== null || this.stepPending !== null;
  }

  /** Starts the step moment for the band the first relay of a band opened (the view pans to it, the locks fade, the lanes brighten). */
  startStep(opened: number): void {
    this.stepPending = opened;
    this.step = null;
  }

  /** Ends the step moment at once, in its final state (a tap skips it). */
  skipStep(): void {
    if (this.step) {
      this.goalY = this.scrollY = this.step.toY;
    }
    this.step = null;
    this.stepPending = null;
  }

  private beginStep(opened: number, nowMs: number): void {
    const ys = this.session.data.map.areas.map((a, i) => (a.tier === opened ? this.basePos(i).y : null)).filter((y): y is number => y !== null);
    const mean = ys.length > 0 ? ys.reduce((s, y) => s + y, 0) / ys.length : this.scrollY + this.h / 2;
    const toY = clampScroll(mean - (this.h - this.cover) / 2, this.limits().y);
    this.userMoved = true;
    this.step = { opened, start: nowMs, fromY: this.scrollY, toY };
  }

  // --- hit testing and drawing --------------------------------------------------------------------------------------

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
      this.cache = {
        world,
        key,
        statuses: data.map.areas.map((_, i) => areaStatus(world, data, i)),
        ow: overworldStatus(world, data),
        lanes: laneDraws(world, data),
      };
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
    const { statuses, lanes, ow } = this.status();
    const rr = this.nodeR;

    // The pan: a drag sets it directly; otherwise it eases to its goal (held inside the frame, which shrinks when a sheet closes).
    if (this.stepPending !== null) {
      this.beginStep(this.stepPending, nowMs);
      this.stepPending = null;
    }
    const m = this.limits();
    let fade = 1;
    let reveal = 100;
    let opened = -1;
    if (this.step) {
      const s = this.step;
      const k = (nowMs - s.start) / STEP_MS;
      if (k >= 1) {
        this.goalY = this.scrollY = s.toY;
        this.step = null;
      } else {
        opened = s.opened;
        const p1 = easeOut(ramp(k, 0, 0.6));
        fade = ramp(k, 0.35, 0.8);
        reveal = ramp(k, 0.4, 1) * 100;
        this.goalY = this.scrollY = s.fromY + (s.toY - s.fromY) * p1;
      }
    }
    if (!this.step && !this.drag) {
      this.goalX = clampScroll(this.goalX, m.x);
      this.goalY = clampScroll(this.goalY, m.y);
      this.scrollX = Math.abs(this.goalX - this.scrollX) < 0.5 ? this.goalX : this.scrollX + (this.goalX - this.scrollX) * 0.3;
      this.scrollY = Math.abs(this.goalY - this.scrollY) < 0.5 ? this.goalY : this.scrollY + (this.goalY - this.scrollY) * 0.3;
    }

    // Band dividers, behind the lanes.
    ctx.save();
    for (const b of this.bands) {
      if (b.band === 0) continue;
      const y = b.rect.y + b.rect.h / 2 - this.scrollY;
      if (y < -10 || y > h + 10) continue;
      drawBandDivider(ctx, b.rect.x + b.rect.w + 6 - this.scrollX, y, w - 4);
    }
    ctx.restore();

    for (const lane of lanes) {
      const p = this.areaPos(lane.from);
      const q = this.areaPos(lane.to);
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if (len <= 2 * (rr + RIM_GAP)) continue;
      if (Math.max(p.y, q.y) < -rr || Math.min(p.y, q.y) > h + rr) continue;
      const ux = (q.x - p.x) / len;
      const uy = (q.y - p.y) / len;
      const trim = rr + RIM_GAP;
      let mode = laneMode(ow, lane);
      let a = { x: p.x + ux * trim, y: p.y + uy * trim };
      let b = { x: q.x - ux * trim, y: q.y - uy * trim };
      // The lanes into the band just opened brighten from the lower band outward; before that moment they are still dim.
      let prog = 100;
      if (opened >= 0 && mode === 'normal' && (statuses[lane.from]!.tier === opened || statuses[lane.to]!.tier === opened)) {
        mode = reveal <= 0 ? 'dim' : 'reveal';
        prog = reveal;
        // Grow from the lower band's end (`from` is the end farther from Landfall, which is usually the higher band).
        if (statuses[lane.from]!.tier >= statuses[lane.to]!.tier) [a, b] = [b, a];
      }
      drawLane(ctx, a.x, a.y, b.x, b.y, t, lane.state, mode, prog);
    }

    const pct = world.tun['shipments.pct'];
    this.drawnLabels = data.map.areas.map(() => null);
    const labels: Array<{ i: number; name: string; sub: string; x: number; y: number; above: boolean; dim: boolean; reclaimed: boolean }> = [];
    statuses.forEach((st, i) => {
      const { x, y } = this.areaPos(i);
      if (y < -3 * rr || y > h + 3 * rr) return;
      const o = ow.areas[i]!;
      let state = nodeState(o);
      let badge = state === 'locked' ? 1 : 0;
      if (opened >= 0 && o.band === opened && state === 'open') {
        // The step moment: this node was locked a moment ago; its padlock fades out.
        badge = 1 - fade;
        if (fade < 0.5) state = 'locked';
      }
      const reclaimed = state === 'reclaimed';
      ctx.save();
      ctx.translate(x, y);
      drawAreaNode(ctx, rr, t, st.tier, state);
      if (state !== 'far') {
        if (data.map.areas[i]!.tier >= 3) drawProbeCore(ctx, rr * 0.45, t, reclaimed ? 1 : 0);
        else drawResourceIcon(ctx, rr * 0.4, prizeOf(st));
      }
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
      // The corner marks go on after the ring: the relay mark upper left (dimmed on a far node), the lock badge upper right.
      if (o.relay) {
        ctx.save();
        ctx.translate(x - 0.7 * rr, y - 0.7 * rr);
        drawRelayMark(ctx, 0.5 * rr, state === 'far' ? 0.5 : 1);
        ctx.restore();
      }
      if (badge > 0) {
        ctx.save();
        ctx.globalAlpha = badge;
        ctx.translate(x + 0.7 * rr, y - 0.7 * rr);
        drawLockBadge(ctx, 0.5 * rr);
        ctx.restore();
      }
      const exp = exportX10(st.export, pct);
      labels.push({
        i,
        name: st.name,
        sub: reclaimed ? ratesX10Text(exp) : '',
        x,
        y,
        above: this.sides[i] === 'above',
        dim: state === 'locked' || state === 'far',
        reclaimed,
      });
    });

    // Labels, each on a dark pill, so no lane runs through the name of a node.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const l of labels) {
      const lines = l.sub ? [l.name, l.sub] : [l.name];
      const top = l.above ? l.y - rr - NAME_GAP - (lines.length * 14 + 2) : l.y + rr + NAME_GAP;
      let box: Rect | null = null;
      lines.forEach((text, k) => {
        ctx.font = k === 0 ? LABEL_FONT : EXPORT_FONT;
        const wd = ctx.measureText(text).width + 8;
        const ly = top + 12 + k * 14;
        // Keep the pill inside the canvas whatever the text width.
        const lx = Math.min(w - wd / 2 - 2, Math.max(wd / 2 + 2, l.x));
        const pill = { x: lx - wd / 2, y: ly - 11, w: wd, h: 14 };
        box = box === null ? pill : unionRect(box, pill);
        this.drawnLabels[l.i] = box;
        ctx.fillStyle = 'rgba(5, 7, 13, 0.78)';
        ctx.beginPath();
        ctx.roundRect(lx - wd / 2, ly - 11, wd, 14, 4);
        ctx.fill();
        ctx.fillStyle = k === 0 ? (l.reclaimed ? palette.probe : l.dim ? palette.areaLocked : palette.starBright) : palette.probe;
        ctx.fillText(text, lx, ly);
      });
    }
    ctx.restore();

    // Band labels at the left edge: "Band 2 · locked" with a padlock, "Band 2" once open.
    ctx.save();
    ctx.font = BAND_FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (const b of this.bands) {
      const rect = { x: b.rect.x - this.scrollX, y: b.rect.y - this.scrollY, w: b.rect.w, h: b.rect.h };
      if (rect.y + rect.h < 0 || rect.y > h) continue;
      const first = ow.areas.find((a) => a.band === b.band);
      let lockAlpha = first?.locked ? 1 : 0;
      if (opened >= 0 && b.band === opened) lockAlpha = 1 - fade;
      ctx.save();
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      drawBandPill(ctx, rect.w, rect.h);
      ctx.fillStyle = palette.starBright;
      ctx.fillText(`Band ${b.band}`, -rect.w / 2 + 22, 0);
      if (lockAlpha > 0) {
        ctx.globalAlpha = lockAlpha;
        ctx.fillStyle = palette.areaLocked;
        const word = `Band ${b.band}`;
        ctx.fillText(word, -rect.w / 2 + 22, 0);
        ctx.fillText(' · locked', -rect.w / 2 + 22 + ctx.measureText(word).width, 0);
        ctx.save();
        ctx.translate(-rect.w / 2 + 11, 1);
        drawLockBadge(ctx, 6);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }
}
