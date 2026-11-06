/**
 * Procedural placeholder art (see ART_STYLE.md "Placeholders"). Each draw
 * function renders one entity type centered at (0, 0) with radius r, so
 * generated sprites can later replace them one for one. Rendering code may use
 * floating-point Math freely; only packages/sim is restricted.
 */
import { palette } from './palette.ts';

type Ctx = CanvasRenderingContext2D;

function polygon(ctx: Ctx, sides: number, r: number, rotation = 0): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

function disc(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

export function drawProbe(ctx: Ctx, r: number, t: number): void {
  ctx.save();
  ctx.fillStyle = palette.probeGlow;
  disc(ctx, 0, 0, r * (1.6 + 0.1 * Math.sin(t * 2)));
  ctx.fill();
  ctx.strokeStyle = palette.probe;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  polygon(ctx, 6, r, t * 0.2);
  ctx.stroke();
  polygon(ctx, 6, r * 0.45, -t * 0.4);
  ctx.fillStyle = palette.probe;
  ctx.fill();
  ctx.restore();
}

/** Seeded irregular outline; shared by asteroid and withered Bloom. */
function rockPath(ctx: Ctx, r: number, seed: number, n: number, lo: number): void {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const jitter = lo + (1 - lo) * Math.abs(Math.sin(seed * 12.9898 + i * 78.233));
    ctx.lineTo(Math.cos(a) * r * jitter, Math.sin(a) * r * jitter);
  }
  ctx.closePath();
}

/**
 * Irregular rock; `seed` keeps each outline stable. Extractor pips sit in a
 * row below the rock: filled teal = built, hollow = free slot.
 */
export function drawAsteroid(ctx: Ctx, r: number, seed: number, extractors: number, slots: number): void {
  ctx.save();
  rockPath(ctx, r, seed, 9, 0.75);
  ctx.fillStyle = palette.asteroid;
  ctx.fill();
  ctx.fillStyle = palette.asteroidOre;
  disc(ctx, r * 0.2, -r * 0.15, r * 0.18);
  ctx.fill();
  if (slots > 0) {
    const pr = Math.max(2.2, r * 0.11);
    const gap = pr * 2.7;
    const y = r * 1.18 + pr;
    const x0 = (-(slots - 1) * gap) / 2;
    ctx.lineWidth = Math.max(1, pr * 0.5);
    ctx.strokeStyle = palette.asteroidOre;
    ctx.fillStyle = palette.asteroidOre;
    for (let i = 0; i < slots; i++) {
      disc(ctx, x0 + i * gap, y, pr);
      if (i < extractors) ctx.fill();
      else ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * The Bloom's rock. Alive: glowing hot-pink coral, a lumpy mass with stubby
 * arms that breathes. Withered (captured): grey rock, teal ore veins, no glow.
 */
export function drawRichNode(ctx: Ctx, r: number, t: number, captured: boolean): void {
  ctx.save();
  if (captured) {
    rockPath(ctx, r, 7, 11, 0.8);
    ctx.fillStyle = palette.withered;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.strokeStyle = palette.witheredDark;
    ctx.stroke();
    ctx.strokeStyle = palette.asteroidOre;
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.1);
    ctx.lineTo(-r * 0.1, r * 0.1);
    ctx.lineTo(r * 0.2, -r * 0.35);
    ctx.moveTo(-r * 0.1, r * 0.1);
    ctx.lineTo(r * 0.15, r * 0.55);
    ctx.moveTo(r * 0.2, -r * 0.35);
    ctx.lineTo(r * 0.55, -r * 0.2);
    ctx.stroke();
    ctx.fillStyle = palette.asteroidOre;
    disc(ctx, -r * 0.1, r * 0.1, r * 0.2);
    ctx.fill();
  } else {
    const breathe = 1 + 0.04 * Math.sin(t * 2.5);
    ctx.fillStyle = palette.bloomGlow;
    disc(ctx, 0, 0, r * 1.45 * breathe);
    ctx.fill();
    const arms = 8;
    ctx.strokeStyle = palette.bloom;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2.5, r * 0.3);
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * Math.PI * 2 + 0.2;
      const len = r * (0.72 + 0.14 * Math.abs(Math.sin(i * 2.7))) * breathe;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.fillStyle = palette.bloom;
    disc(ctx, 0, 0, r * 0.62 * breathe);
    ctx.fill();
    ctx.fillStyle = palette.bloomHi;
    disc(ctx, 0, 0, r * 0.26);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * One orbiting thorn: a four-spike seed-pod, drawn once per thorn around the
 * rich node. Stays within r. hpFrac 0..1 shrinks and dims it; there is no
 * ring, so a full ring of thorns stays quiet.
 */
export function drawThorn(ctx: Ctx, r: number, t: number, hpFrac: number): void {
  const f = Math.min(1, Math.max(0, hpFrac));
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.5 * f;
  ctx.rotate(t * 0.8);
  const body = r * (0.5 + 0.5 * f);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 === 0 ? body : body * 0.32;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = palette.thorn;
  ctx.fill();
  ctx.fillStyle = palette.thornCore;
  disc(ctx, 0, 0, body * 0.2);
  ctx.fill();
  ctx.restore();
}

export function drawShip(ctx: Ctx, r: number, heading: number): void {
  ctx.save();
  ctx.rotate(heading);
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(-r * 0.7, r * 0.6);
  ctx.lineTo(-r * 0.4, 0);
  ctx.lineTo(-r * 0.7, -r * 0.6);
  ctx.closePath();
  ctx.fillStyle = palette.ship;
  ctx.fill();
  ctx.restore();
}

/** Pod in transit: a bright teal dot with a soft halo. */
export function drawPod(ctx: Ctx, r: number): void {
  ctx.save();
  ctx.fillStyle = palette.route;
  ctx.globalAlpha = 0.45;
  disc(ctx, 0, 0, r * 1.7);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.asteroidOre;
  disc(ctx, 0, 0, r);
  ctx.fill();
  ctx.restore();
}

/**
 * Route between two world points (call with an untranslated context).
 * `level` (1 and up) thickens the line; `backedUp` turns it dashed amber.
 */
export function drawRoute(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  level: number,
  backedUp: boolean,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.5 + 1.5 * Math.max(0, level);
  if (backedUp) {
    ctx.strokeStyle = palette.routeBackedUp;
    ctx.setLineDash([ctx.lineWidth * 2.5, ctx.lineWidth * 2]);
  } else {
    ctx.strokeStyle = palette.route;
  }
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** Rally flag: amber pennant on a pale pole, centered, within radius r (pole spans y = +0.9r to -0.9r). */
export function drawRallyFlag(ctx: Ctx, r: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = palette.starBright;
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, r * 0.9);
  ctx.lineTo(-r * 0.3, -r * 0.9);
  ctx.stroke();
  ctx.fillStyle = palette.probe;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.9);
  ctx.lineTo(r * 0.75, -r * 0.5);
  ctx.lineTo(-r * 0.3, -r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Hit flash: expanding white ring with a burst. frac 0 = just hit, 1 = gone. */
export function drawHitFlash(ctx: Ctx, r: number, frac: number): void {
  const f = Math.min(1, Math.max(0, frac));
  ctx.save();
  ctx.globalAlpha = 1 - f;
  ctx.strokeStyle = palette.flash;
  ctx.fillStyle = palette.flash;
  ctx.lineWidth = Math.max(1.5, r * 0.18 * (1 - f));
  disc(ctx, 0, 0, r * (0.4 + 0.9 * f));
  ctx.stroke();
  disc(ctx, 0, 0, r * 0.45 * (1 - f));
  ctx.fill();
  ctx.restore();
}

export function drawMob(ctx: Ctx, r: number, t: number): void {
  ctx.save();
  ctx.fillStyle = palette.mobGlow;
  disc(ctx, 0, 0, r * 1.5);
  ctx.fill();
  ctx.beginPath();
  const spikes = 7;
  for (let i = 0; i < spikes * 2; i++) {
    const a = t * 0.5 + (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.55;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = palette.mob;
  ctx.fill();
  ctx.restore();
}
