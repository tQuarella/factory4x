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

export function drawProbe(ctx: Ctx, r: number, t: number): void {
  ctx.save();
  ctx.fillStyle = palette.probeGlow;
  ctx.beginPath();
  ctx.arc(0, 0, r * (1.6 + 0.1 * Math.sin(t * 2)), 0, Math.PI * 2);
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

/** Irregular rock; `seed` keeps each asteroid's outline stable between frames. */
export function drawAsteroid(ctx: Ctx, r: number, seed: number): void {
  ctx.save();
  ctx.beginPath();
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const jitter = 0.75 + 0.25 * Math.abs(Math.sin(seed * 12.9898 + i * 78.233));
    ctx.lineTo(Math.cos(a) * r * jitter, Math.sin(a) * r * jitter);
  }
  ctx.closePath();
  ctx.fillStyle = palette.asteroid;
  ctx.fill();
  ctx.fillStyle = palette.asteroidOre;
  ctx.beginPath();
  ctx.arc(r * 0.2, -r * 0.15, r * 0.18, 0, Math.PI * 2);
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

export function drawMob(ctx: Ctx, r: number, t: number): void {
  ctx.save();
  ctx.fillStyle = palette.mobGlow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
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
