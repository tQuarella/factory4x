/** Small canvas icons for the HUD chips, guard rows, yard rows and the send panel. Drawn once when built. */
import { drawThorn } from './placeholders.ts';
import { drawResourceIcon, drawShip, drawSpore, type ResourceKind, type ShipType } from './h3-art-shim.ts';
import { h } from './dom.ts';

/** A `size` px square canvas (CSS px, crisp on 2x screens), drawn by `draw(ctx, r)` centred, r = half the size minus a pixel. */
export function iconCanvas(parent: HTMLElement, size: number, draw: (ctx: CanvasRenderingContext2D, r: number) => void): HTMLCanvasElement {
  const c = h('canvas', 'icon', '', parent);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.round(size * dpr);
  c.height = Math.round(size * dpr);
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  c.setAttribute('aria-hidden', 'true');
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, (size * dpr) / 2, (size * dpr) / 2);
  draw(ctx, size / 2 - 1);
  return c;
}

export const resourceIcon = (parent: HTMLElement, size: number, kind: ResourceKind): HTMLCanvasElement =>
  iconCanvas(parent, size, (ctx, r) => drawResourceIcon(ctx, r, kind));

export const shipIcon = (parent: HTMLElement, size: number, type: ShipType): HTMLCanvasElement =>
  iconCanvas(parent, size, (ctx, r) => drawShip(ctx, r, 0, type));

export const guardIcon = (parent: HTMLElement, size: number, type: 'thorn' | 'spore'): HTMLCanvasElement =>
  iconCanvas(parent, size, (ctx, r) => (type === 'thorn' ? drawThorn(ctx, r, 0, 1) : drawSpore(ctx, r, 0, 1)));
