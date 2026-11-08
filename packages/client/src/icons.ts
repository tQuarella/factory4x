/** Small canvas icons for the HUD chips, guard rows, yard rows and the send panel. Drawn once when built. */
import { drawResearchIcon, drawResourceIcon, drawShip, drawSpore, drawStockpileIcon, drawThorn, type ResearchIconId, type ResourceKind, type ShipType } from './placeholders.ts';
import { h } from './dom.ts';

/** Sets a canvas up for a `size` px square icon (crisp on 2x screens), clears it and draws `draw(ctx, r)` centred, r = half the size minus a pixel. */
export function paintIcon(c: HTMLCanvasElement, size: number, draw: (ctx: CanvasRenderingContext2D, r: number) => void): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.round(size * dpr);
  c.height = Math.round(size * dpr);
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, (size * dpr) / 2, (size * dpr) / 2);
  draw(ctx, size / 2 - 1);
}

/** A `size` px square canvas (CSS px), drawn by `draw(ctx, r)`. */
export function iconCanvas(parent: HTMLElement, size: number, draw: (ctx: CanvasRenderingContext2D, r: number) => void): HTMLCanvasElement {
  const c = h('canvas', 'icon', '', parent);
  c.setAttribute('aria-hidden', 'true');
  paintIcon(c, size, draw);
  return c;
}

export const resourceIcon = (parent: HTMLElement, size: number, kind: ResourceKind): HTMLCanvasElement =>
  iconCanvas(parent, size, (ctx, r) => drawResourceIcon(ctx, r, kind));

export const shipIcon = (parent: HTMLElement, size: number, type: ShipType): HTMLCanvasElement =>
  iconCanvas(parent, size, (ctx, r) => drawShip(ctx, r, 0, type));

export const guardIcon = (parent: HTMLElement, size: number, type: 'thorn' | 'spore'): HTMLCanvasElement =>
  iconCanvas(parent, size, (ctx, r) => (type === 'thorn' ? drawThorn(ctx, r, 0, 1) : drawSpore(ctx, r, 0, 1)));

export const researchIcon = (parent: HTMLElement, size: number, id: ResearchIconId): HTMLCanvasElement =>
  iconCanvas(parent, size, (ctx, r) => drawResearchIcon(ctx, r, id));

export const stockpileIcon = (parent: HTMLElement, size: number): HTMLCanvasElement => iconCanvas(parent, size, (ctx, r) => drawStockpileIcon(ctx, r));
