/**
 * Map renderer (Canvas 2D). Everything is drawn in screen pixels: world
 * positions are mapped through `fit`, and the draw functions from
 * placeholders.ts get pixel radii, so line widths and sprites stay crisp at any
 * map scale. Ships and pods interpolate between ticks using session.alpha.
 */
import { SHIP_TYPES, activeBattles, guardianStatus, heartIndex, isCaptured, isField, isGuarded, isRootCut, lastBattle, movePreview, nodeStatus, raidStatus, rockStatus, rootIndex, shipCounts, type EconShip, type Node, type ShipType, type World } from '@factory4x/sim';
import { palette } from './palette.ts';
import type { MoveGesture } from './gesture.ts';
import {
  GHOST_H,
  drawAsteroid,
  drawDragGhost,
  drawDragLine,
  drawDropHighlight,
  drawDropTag,
  drawExtractor,
  drawGuardRing,
  drawHauler,
  drawMineBadge,
  drawRaidBadge,
  drawRaidMarker,
  drawSplitPulse,
  ghostWidth,
  type DragAim,
  type GhostEntry,
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
import { shortName } from './sheet.ts';
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

/** What the last frame drew for a drag in progress (the test hook `mapDrag`), canvas px. */
export interface DragDrawn {
  from: number;
  part: 'all' | 'split';
  armed: boolean;
  finger: { x: number; y: number };
  ghost: { x: number; y: number; w: number; counts: GhostEntry[] } | null;
  target: number | null;
  aim: DragAim;
  tag: string | null;
}

/** The ghost chip's rise above the finger, px: the thumb doesn't hide it. */
export const GHOST_RISE = 48;
/** The Mine badge pop, ms. */
const POP_MS = 320;
const TAG_WORD = { strong: 'Strong', even: 'Even', weak: 'Weak' } as const;

/** Short on-map name for the drop tag ("A5", "Hive"). */
const nodeName = shortName;

/**
 * The raiders on the badge, or null when the rock is not a raid's target. `flag` is `rockStatus.raidTarget`: true from the muster to
 * the raid's end. The ring shows the planned mix while it musters, then who is out.
 */
export function raidBadgeMix(world: Readonly<World>, flag: boolean): { thorn: number; spore: number } | null {
  if (!flag) return null;
  const r = raidStatus(world);
  const out = r.raiders.thorn + r.raiders.spore;
  return out > 0 && r.phase !== 'muster' ? { ...r.raiders } : { ...r.planned };
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
  private readonly drawn = {
    badge: new Set<number>(),
    dashed: new Set<number>(),
    /** H7: rocks that wore the Mine badge, haul lines by rock (the drawn thickness level), and the economy hulls drawn by place. */
    mine: new Set<number>(),
    haul: new Map<number, number>(),
    econ: { docked: 0, idle: 0, waiting: 0, moving: 0 },
    /** H7 raids: what the last frame drew (the muster pulse, the dashed line and marker, the rock under raid, the countdown text). */
    raid: { pulse: false, line: false, marker: false, raided: -1, countdown: '', from: -1, to: -1, frac: -1 },
  };

  /** H7 test hook: what the last frame drew for the economy (Mine badges, haul lines, hulls docked, idle at the probe, waiting, moving). */
  drawnField(): { mine: number[]; haul: Array<[number, number]>; econ: { docked: number; idle: number; waiting: number; moving: number }; raid: { pulse: boolean; line: boolean; marker: boolean; raided: number; countdown: string; from: number; to: number; frac: number } } {
    return { mine: [...this.drawn.mine], haul: [...this.drawn.haul], econ: { ...this.drawn.econ }, raid: { ...this.drawn.raid } };
  }

  /** The move gesture being shown (set by main.ts): drawn over everything while it is armed or dragging. */
  gesture: MoveGesture | null = null;
  /** H8: Mine badge pops: a rock just marked grows in, one just unmarked fades out (client only). */
  private readonly pops = new Map<number, { start: number; on: boolean }>();
  /** H8 test hook: what the last frame drew for the raid badge and the drag. */
  private readonly drawnNew: { raidBadge: number; drag: DragDrawn | null } = { raidBadge: -1, drag: null };

  drawnH8(): { raidBadge: number; drag: DragDrawn | null } {
    return { raidBadge: this.drawnNew.raidBadge, drag: this.drawnNew.drag === null ? null : { ...this.drawnNew.drag } };
  }

  /** Starts the badge pop of a rock whose Mine mark just changed. */
  popMine(node: number, on: boolean): void {
    this.pops.set(node, { start: performance.now(), on });
  }

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

  /** How far from a node's centre a tap still lands on it, px (at least a 44 px target; the whole guard ring on a guarded node). */
  reachOf(n: Node): number {
    const g = guardedKind(n) ? guardianStatus(this.session.world, n.index) : null;
    return g && g.alive ? guardedReach(this.nodeR(n), g.total, n.kind !== 'pocket') : Math.max(MIN_HIT, this.nodeR(n) + 4);
  }

  /** The node under a tap at canvas-relative (px, py), or null. Nearest center wins among nodes in reach. */
  hitTest(px: number, py: number): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    for (const n of this.session.world.nodes) {
      const dx = px - this.sx(n.x);
      const dy = py - this.sy(n.y);
      const d = Math.sqrt(dx * dx + dy * dy);
      const reach = this.reachOf(n);
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
    this.drawn.mine.clear();
    this.drawn.haul.clear();
    this.drawn.econ = { docked: 0, idle: 0, waiting: 0, moving: 0 };
    this.drawn.raid = { pulse: false, line: false, marker: false, raided: -1, countdown: '', from: -1, to: -1, frac: -1 };
    this.drawnNew.raidBadge = -1;
    this.drawnNew.drag = null;
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

    const field = isField(world);
    // H7: a probe-to-rock line for every rock with haulers (thicker for more of them), under the nodes.
    const rocks = new Map<number, ReturnType<typeof rockStatus>>();
    if (field) {
      for (const n of world.nodes) {
        if (n.kind === 'probe' || isGuarded(world, n.index)) continue;
        const rs = rockStatus(world, n.index);
        rocks.set(n.index, rs);
        if (rs.haulers > 0) {
          const a = this.nodePos(0);
          const b = this.nodePos(n.index);
          if (rs.backedUp) this.drawn.dashed.add(n.index);
          this.drawn.haul.set(n.index, Math.min(3, rs.haulers));
          drawRoute(ctx, a.x, a.y, b.x, b.y, Math.min(3, rs.haulers), rs.backedUp);
        }
      }
    }

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
        const raided = world.raid !== null && world.raid.phase === 'fight' && world.raid.target === n.index;
        if (raided) this.drawn.raid.raided = n.index;
        drawAsteroid(ctx, rr, n.index * 7 + 3, n.extractors, n.slots, raided ? 'raided' : 'normal', t);
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
      labels.push({ text: nodeLabel(n, field), x, y: labelTop < LABEL_TOP_PAD ? y + selR + 12 : labelTop });

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
      if (field) {
        // H7: the Mine badge (a pick) on a rock marked for mining, and the "!" while its buffer is full.
        const rs = rocks.get(n.index);
        const pop = this.pops.get(n.index);
        const popAge = pop === undefined ? Infinity : nowMs - pop.start;
        if (pop !== undefined && popAge >= POP_MS) this.pops.delete(n.index);
        const grow = popAge < POP_MS ? 1 - popAge / POP_MS : 0;
        if (rs?.mine) {
          this.drawn.mine.add(n.index);
          ctx.save();
          ctx.translate(x + rr * 0.95, y + rr * 0.7);
          // A fresh mark pops: it starts a size larger and settles.
          drawMineBadge(ctx, Math.max(7, rr * 0.34) * (1 + 0.7 * grow));
          ctx.restore();
        } else if (grow > 0 && pop !== undefined && !pop.on) {
          // A mark just taken off: the badge swells and fades.
          ctx.save();
          ctx.globalAlpha = grow;
          ctx.translate(x + rr * 0.95, y + rr * 0.7);
          drawMineBadge(ctx, Math.max(7, rr * 0.34) * (1 + 0.7 * (1 - grow)));
          ctx.restore();
        }
        // H8: the raid-target badge, lower left (the Mine badge is lower right), from the muster to the raid's end.
        const raidMix = rs === undefined ? null : raidBadgeMix(world, rs.raidTarget);
        if (raidMix !== null) {
          this.drawnNew.raidBadge = n.index;
          ctx.save();
          ctx.translate(x - rr * 0.95, y + rr * 0.7);
          drawRaidBadge(ctx, Math.max(8, rr * 0.4), raidMix);
          ctx.restore();
        }
        if (rs?.backedUp && rs.mine) {
          this.drawn.badge.add(n.index);
          this.badge('!', x - rr * 0.85, y - rr * 0.75, palette.routeBackedUp, '#2a1e00');
        }
      } else {
        const ns = nodeStatus(world, n.index);
        if (n.kind !== 'probe' && (isBackedUp(world, n.index, ns) || ns.noRoute)) {
          this.drawn.badge.add(n.index);
          this.badge('!', x - rr * 0.85, y - rr * 0.75, palette.routeBackedUp, '#2a1e00');
        }
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

    if (field) this.drawEcon(world, alpha);
    if (field) this.drawRaid(world, t, alpha);

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
    this.drawGesture(world, t, nowMs);
  }

  /** H8: the split-armed pulse on the source, and while dragging: the dashed line, the drop-target highlight and tag, and the ghost chip. */
  private drawGesture(world: Readonly<World>, t: number, nowMs: number): void {
    const g = this.gesture;
    if (g === null || (g.phase !== 'armed' && g.phase !== 'dragging') || !isField(world)) return;
    const { ctx } = this;
    const src = world.nodes[g.from];
    if (src === undefined) return;
    const sp = this.nodePos(g.from);
    const srcR = this.nodeR(src) + 8;
    if (g.phase === 'armed') {
      ctx.save();
      ctx.translate(sp.x, sp.y);
      drawSplitPulse(ctx, srcR, t);
      ctx.restore();
    }
    // The ghost shows what the drop would carry, from the same selector the sim uses (a split's halves while armed or split-dragging).
    const carried = movePreview(world, g.from, g.part);
    const entries: GhostEntry[] = SHIP_TYPES.filter((s) => carried[s] > 0).map((s) => ({ type: s, count: carried[s] }));
    const target = g.phase === 'dragging' ? g.target : null;
    const guarded = target !== null && isGuarded(world, target);
    const aim: DragAim = target === null ? 'none' : guarded ? 'attack' : 'move';
    let tag: string | null = null;
    if (g.phase === 'dragging') {
      drawDragLine(ctx, sp.x, sp.y, g.x, g.y, aim, (nowMs / 40) % 15);
      if (target !== null) {
        const tn = world.nodes[target]!;
        const tp = this.nodePos(target);
        const reach = this.reachOf(tn);
        ctx.save();
        ctx.translate(tp.x, tp.y);
        drawDropHighlight(ctx, reach, guarded, t);
        ctx.restore();
        if (guarded) {
          // The Strong/Even/Weak tag of the type that makes up most of what is carried.
          const lead = entries.reduce((a, e) => (e.count > a.count ? e : a), entries[0]!);
          const gs = guardianStatus(world, target);
          tag = `Attack · ${TAG_WORD[gs.tags[lead.type as ShipType].tag]}`;
        }
        const label = nodeName(tn, true);
        // The tag sits above the node, or below it where the canvas's top edge is in the way.
        const above = tp.y - reach - 16 >= 12;
        ctx.save();
        ctx.translate(Math.min(this.w - 60, Math.max(60, tp.x)), above ? tp.y - reach - 14 : tp.y + reach + 14);
        drawDropTag(ctx, label, tag);
        ctx.restore();
      }
    }
    let ghost: DragDrawn['ghost'] = null;
    // Armed or dragging: the ghost shows what a release would carry (the half counts once a split is armed).
    if (entries.length > 0) {
      ctx.save();
      // Measure first (the width centres the clamp), then draw 48 px above the finger.
      const w = ghostWidth(ctx, entries);
      const gx = Math.min(this.w - w / 2 - 4, Math.max(w / 2 + 4, g.x));
      const gy = Math.max(GHOST_H / 2 + 4, g.y - GHOST_RISE);
      ctx.translate(gx, gy);
      drawDragGhost(ctx, entries, aim);
      ctx.restore();
      ghost = { x: gx, y: gy, w, counts: entries };
    }
    this.drawnNew.drag = { from: g.from, part: g.part, armed: g.phase === 'armed', finger: { x: g.x, y: g.y }, ghost, target, aim, tag };
  }

  /**
   * H7: the economy ships. A docked extractor sits on its rock, on an arc over the top (the slot pips are below), its drill toward the
   * rock; idle ones wait in a row under the probe; a hauler waiting at a rock sits beside it; a ship in flight is drawn between its
   * nodes. Hulls are about 7 px (a phone's 24 px read is checked in the gallery). A loaded hauler wears a teal dot.
   */
  private drawEcon(world: Readonly<World>, alpha: number): void {
    const f = world.field;
    if (f === null) return;
    const dockedAt = new Map<number, number>();
    const idleAt = new Map<number, number>();
    const waitingAt = new Map<number, number>();
    for (const s of f.econ) {
      if (s.transit) {
        const tr = s.transit;
        const a = this.nodePos(tr.from);
        const b = this.nodePos(tr.to);
        const fr = progressFrac(tr.ticksLeft, tr.totalTicks, alpha);
        this.drawn.econ.moving++;
        this.econHull(s, lerp(a.x, b.x, fr), lerp(a.y, b.y, fr), Math.atan2(b.y - a.y, b.x - a.x));
        continue;
      }
      const at = s.at ?? 0;
      const p = this.nodePos(at);
      const n = world.nodes[at]!;
      if (s.type === 'extractor' && s.target === at && n.kind !== 'probe') {
        const k = dockedAt.get(at) ?? 0;
        dockedAt.set(at, k + 1);
        this.drawn.econ.docked++;
        const rr = this.nodeR(n);
        const a = -Math.PI / 2 + (k - (Math.max(1, n.slots) - 1) / 2) * 0.85;
        const d = rr * 0.92;
        this.econHull(s, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, a + Math.PI);
      } else if (n.kind === 'probe') {
        const k = idleAt.get(at) ?? 0;
        idleAt.set(at, k + 1);
        this.drawn.econ.idle++;
        const rr = this.nodeR(n);
        this.econHull(s, p.x + (k - 3.5) * 9, p.y + rr + 12, -Math.PI / 2);
      } else {
        const k = waitingAt.get(at) ?? 0;
        waitingAt.set(at, k + 1);
        this.drawn.econ.waiting++;
        const rr = this.nodeR(n);
        this.econHull(s, p.x + rr + 8, p.y - 6 + k * 9, 0);
      }
    }
  }

  /** H7 raid readability: the hive pulses while it musters; the marker rides a dashed line out to the target (and home), with its countdown. */
  private drawRaid(world: Readonly<World>, t: number, alpha: number): void {
    const { ctx } = this;
    const raid = world.raid;
    if (raid === null) return;
    const hive = world.nodes.find((n) => n.kind === 'heart');
    const target = world.nodes[raid.target];
    if (hive === undefined || target === undefined) return;
    const hp = this.nodePos(hive.index);
    if (raid.phase === 'muster') {
      this.drawn.raid.pulse = true;
      const rr = this.nodeR(hive);
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.save();
      ctx.strokeStyle = palette.mob;
      ctx.globalAlpha = 0.35 + 0.5 * pulse;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, rr * 1.55 + 8 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    // Each leg runs from `raid.from` to its end (the target going out, the hive going home); progress is 1 - ticksLeft / flightTicks.
    const origin = world.nodes[raid.from] ?? hive;
    const [fromNode, toNode] = raid.phase === 'home' ? [origin, hive] : [origin, target];
    const a = this.nodePos(fromNode.index);
    const b = this.nodePos(toNode.index);
    const tp = this.nodePos(target.index);
    ctx.save();
    ctx.strokeStyle = palette.mob;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    // The dashed line is the leg being flown; at the target it joins the hive to the rock.
    const [l0, l1] = raid.phase === 'fight' ? [hp, tp] : [a, b];
    ctx.moveTo(l0.x, l0.y);
    ctx.lineTo(l1.x, l1.y);
    ctx.stroke();
    ctx.restore();
    this.drawn.raid.line = true;
    this.drawn.raid.from = l0 === hp ? hive.index : fromNode.index;
    this.drawn.raid.to = raid.phase === 'fight' ? target.index : toNode.index;
    if (raid.phase === 'fight') return;
    const f = progressFrac(raid.ticksLeft, Math.max(1, raid.flightTicks), alpha);
    this.drawn.raid.frac = Math.round(f * 1000) / 1000;
    const x = lerp(a.x, b.x, f);
    const y = lerp(a.y, b.y, f);
    const mix = { thorn: 0, spore: 0 };
    for (const g of raid.guards) mix[g.type]++;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
    drawRaidMarker(ctx, 11, mix);
    ctx.restore();
    this.drawn.raid.marker = true;
    const text = `${Math.ceil(raid.ticksLeft / world.tickRate)}s`;
    this.drawn.raid.countdown = text;
    ctx.save();
    ctx.font = '700 11px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    const wd = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(5, 7, 13, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x - wd / 2, y + 13, wd, 15, 5);
    ctx.fill();
    ctx.fillStyle = palette.bloomHi;
    ctx.fillText(text, x, y + 24.5);
    ctx.restore();
  }

  private econHull(s: Readonly<EconShip>, x: number, y: number, heading: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    if (s.type === 'extractor') drawExtractor(ctx, 6.5, heading);
    else {
      drawHauler(ctx, 6.5, heading);
      if (s.cargo > 0) {
        ctx.fillStyle = palette.asteroidOre;
        ctx.beginPath();
        ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
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
export function nodeLabel(n: Pick<Node, 'id' | 'kind'>, hive = false): string {
  if (n.kind === 'probe') return 'PROBE';
  if (n.kind === 'heart') return hive ? 'HIVE' : 'HEART';
  if (n.kind === 'root') return 'ROOT';
  return n.id.toUpperCase();
}
