/**
 * TEMPORARY stand-in for the H3 draw functions until h3-art merges. It has the
 * exact signatures of the draw contract (DESIGN.md H3 "Flavor and art needs"),
 * with simple drawings. The Director swaps the imports to placeholders.ts after
 * h3-art lands, then deletes this file. Every function draws centred on the
 * origin, within radius r.
 */
import { palette } from './palette.ts';

type Ctx = CanvasRenderingContext2D;
export type ShipType = 'drone' | 'lancer' | 'flak';
export type ResourceKind = 'ore' | 'ice' | 'crystal' | 'lens' | 'plating';

const SPORE = '#e056d6';
const SPORE_GLOW = 'rgba(224, 86, 214, 0.28)';
const COLORS: Record<ResourceKind, string> = {
  ore: palette.asteroidOre,
  ice: '#bdf3ff',
  crystal: '#b79cff',
  lens: '#ffd27a',
  plating: '#a8b3c7',
};

function disc(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}

/** Drone = arrowhead, lancer = long needle with a bright tip, flak = short wide block with a ring. `heading` is radians. */
export function drawShip(ctx: Ctx, r: number, heading: number, type: ShipType = 'drone'): void {
  ctx.save();
  ctx.rotate(heading);
  ctx.fillStyle = palette.ship;
  ctx.beginPath();
  if (type === 'lancer') {
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.9, r * 0.35);
    ctx.lineTo(-r * 0.7, 0);
    ctx.lineTo(-r * 0.9, -r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.starBright;
    disc(ctx, r * 0.8, 0, r * 0.12);
    ctx.fill();
  } else if (type === 'flak') {
    ctx.rect(-r * 0.7, -r * 0.7, r * 1.3, r * 1.4);
    ctx.fill();
    ctx.strokeStyle = palette.space;
    ctx.lineWidth = Math.max(1.5, r * 0.15);
    disc(ctx, 0, 0, r * 0.38);
    ctx.stroke();
  } else {
    ctx.moveTo(r * 0.85, 0);
    ctx.lineTo(-r * 0.6, r * 0.5);
    ctx.lineTo(-r * 0.35, 0);
    ctx.lineTo(-r * 0.6, -r * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** A small round puff with a dotted halo. */
export function drawSpore(ctx: Ctx, r: number, t: number, hpFrac: number): void {
  const f = Math.min(1, Math.max(0, hpFrac));
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.45 * f;
  ctx.fillStyle = SPORE_GLOW;
  disc(ctx, 0, 0, r * 0.82);
  ctx.fill();
  ctx.fillStyle = SPORE;
  const dr = Math.max(1, r * 0.1);
  for (let i = 0; i < 8; i++) {
    const a = t * 0.6 + (i / 8) * Math.PI * 2;
    disc(ctx, Math.cos(a) * (r - dr), Math.sin(a) * (r - dr), dr);
    ctx.fill();
  }
  disc(ctx, 0, 0, r * (0.38 + 0.27 * f));
  ctx.fill();
  ctx.restore();
}

/** Two arcs (Thorn colour, Spore colour), each a share of the full circle; the ring shrinks as guards die. Outer edge at r. */
export function drawGuardRing(ctx: Ctx, r: number, thornShare: number, sporeShare: number, t: number): void {
  const th = Math.max(0, thornShare);
  const sp = Math.max(0, sporeShare);
  const sum = th + sp;
  if (sum <= 0) return;
  const scale = sum > 1 ? 1 / sum : 1;
  const w = Math.max(2.5, r * 0.16);
  const full = Math.PI * 2;
  let a = -Math.PI / 2 + Math.sin(t * 0.8) * 0.05;
  ctx.save();
  ctx.lineWidth = w;
  for (const [share, color] of [[th, palette.thorn], [sp, SPORE]] as const) {
    const len = share * scale * full;
    if (len > 0) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, r - w / 2, a, a + len);
      ctx.stroke();
    }
    a += len;
  }
  ctx.restore();
}

/** A resource or component icon, centred, within radius r. */
export function drawResourceIcon(ctx: Ctx, r: number, kind: ResourceKind): void {
  ctx.save();
  ctx.fillStyle = COLORS[kind];
  ctx.strokeStyle = COLORS[kind];
  ctx.lineWidth = Math.max(1.2, r * 0.2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'ore') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      ctx.lineTo(Math.cos(a) * r * (i % 2 ? 0.8 : 1), Math.sin(a) * r * (i % 2 ? 0.8 : 1));
    }
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'ice') {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(-Math.cos(a) * r, -Math.sin(a) * r);
    }
    ctx.stroke();
  } else if (kind === 'crystal') {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.6, -r * 0.1);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.6, -r * 0.1);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'lens') {
    disc(ctx, 0, 0, r * 0.8);
    ctx.stroke();
    disc(ctx, 0, 0, r * 0.25);
    ctx.fill();
  } else {
    for (let i = 0; i < 3; i++) ctx.fillRect(-r * 0.9, -r * 0.8 + i * r * 0.6, r * 1.8, r * 0.4);
  }
  ctx.restore();
}

/** A guarded pocket (rock with a pink growth) or a captured one (grey rock), prize icon in the centre. */
export function drawPocket(ctx: Ctx, r: number, t: number, alive: boolean, prize: ResourceKind = 'ore'): void {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const j = 0.82 + 0.18 * Math.abs(Math.sin(i * 7.3 + 1.1));
    ctx.lineTo(Math.cos(a) * r * 0.74 * j, Math.sin(a) * r * 0.74 * j);
  }
  ctx.closePath();
  ctx.fillStyle = alive ? palette.rootRock : palette.withered;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.strokeStyle = alive ? palette.rootRockEdge : palette.witheredDark;
  ctx.stroke();
  if (alive) {
    ctx.fillStyle = palette.bloom;
    const sway = Math.sin(t * 1.8) * 0.08;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 1.55 + sway;
      disc(ctx, Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, r * 0.2);
      ctx.fill();
    }
  }
  drawResourceIcon(ctx, r * 0.4, prize);
  ctx.restore();
}
