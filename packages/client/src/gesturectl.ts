/**
 * H8 drag to move: the DOM side. Pointer events on the field canvas feed `MoveGesture` (gesture.ts), a timer arms the long press, and
 * a release on a node sends `moveShips` through the host. The click that follows any drag or cancel is suppressed (`consumeClick`),
 * so a drag never also opens a sheet; a plain tap is left alone, and the existing click handler opens the sheet.
 *
 * Pointer events are listened to on the window (captured on the canvas for a mouse), so a finger that leaves the canvas still ends the
 * gesture, and a second pointer anywhere cancels it.
 */
import type { MovePart } from '@factory4x/sim';
import { MoveGesture, type GestureEnd } from './gesture.ts';

export interface GestureHost {
  canvas: HTMLCanvasElement;
  /** Drag is on: a field run on the field screen, `client.moveGesture` 1, and Mine mode off. */
  enabled(): boolean;
  /** The node under a canvas-relative point, or null (including when a sheet, the HUD or a notice is on top of that point). */
  hit(x: number, y: number): number | null;
  carry(from: number, part: MovePart): number;
  slopPx(): number;
  longPressMs(): number;
  /** A drop on a node: send `moveShips`. */
  commit(from: number, to: number, part: MovePart): void;
  /** The gesture changed (a redraw of the overlay is due on the next frame; here for tests and dev hooks). */
  changed?(): void;
}

export class MoveGestureControl {
  readonly gesture: MoveGesture;
  /** How many drags have been committed, cancelled and armed since the page opened (test hooks). */
  readonly counts = { moves: 0, cancels: 0, arms: 0 };
  private readonly host: GestureHost;
  private timer = 0;
  private suppress = false;

  constructor(host: GestureHost) {
    this.host = host;
    this.gesture = new MoveGesture({
      hit: (x, y) => host.hit(x, y),
      carry: (from, part) => host.carry(from, part),
      slopPx: () => host.slopPx(),
      longPressMs: () => host.longPressMs(),
    });
    const canvas = host.canvas;
    // The capture phase, so a second pointer on a button is seen too.
    window.addEventListener('pointerdown', (ev) => this.onDown(ev), true);
    window.addEventListener('pointermove', (ev) => this.onMove(ev));
    window.addEventListener('pointerup', (ev) => this.onUp(ev));
    window.addEventListener('pointercancel', (ev) => this.onCancel(ev));
    // A long press must not raise the browser's context menu or select text.
    canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  /** True once after a gesture that was a drag or a cancel: the click that follows it isn't a tap. */
  consumeClick(): boolean {
    const s = this.suppress;
    this.suppress = false;
    return s;
  }

  private local(ev: PointerEvent): { x: number; y: number } {
    const r = this.host.canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  private clearTimer(): void {
    if (this.timer !== 0) window.clearTimeout(this.timer);
    this.timer = 0;
  }

  private onDown(ev: PointerEvent): void {
    const g = this.gesture;
    if (g.active && ev.pointerId !== g.pointer) {
      // A second pointer cancels the gesture; the release of the first one then does nothing.
      this.clearTimer();
      const p = this.local(ev);
      g.down(ev.pointerId, p.x, p.y, performance.now());
      this.host.changed?.();
      return;
    }
    // Every new press starts a new click cycle.
    this.suppress = false;
    if (ev.target !== this.host.canvas || !this.host.enabled() || !ev.isPrimary) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const p = this.local(ev);
    g.down(ev.pointerId, p.x, p.y, performance.now());
    if (!g.active) return;
    try {
      this.host.canvas.setPointerCapture(ev.pointerId);
    } catch {
      /* a synthetic pointer has nothing to capture */
    }
    this.clearTimer();
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      if (g.hold(performance.now())) this.armed();
    }, this.host.longPressMs());
    this.host.changed?.();
  }

  private armed(): void {
    this.counts.arms++;
    // A short buzz where the device has one (not iOS Safari).
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(10);
    this.host.changed?.();
  }

  private onMove(ev: PointerEvent): void {
    const g = this.gesture;
    if (!g.active || ev.pointerId !== g.pointer) return;
    const before = g.phase;
    const p = this.local(ev);
    g.move(ev.pointerId, p.x, p.y, performance.now());
    if (before === 'pressed' && g.phase === 'armed') this.armed();
    if (g.phase !== 'pressed' && g.phase !== 'armed') this.clearTimer();
    this.host.changed?.();
  }

  private onUp(ev: PointerEvent): void {
    const g = this.gesture;
    if (!g.active || ev.pointerId !== g.pointer) return;
    this.clearTimer();
    // The release position counts: the last move may be older than the lift.
    const p = this.local(ev);
    if (g.phase === 'dragging') g.move(ev.pointerId, p.x, p.y, performance.now());
    this.finish(g.up(ev.pointerId));
  }

  private onCancel(ev: PointerEvent): void {
    const g = this.gesture;
    if (!g.active || ev.pointerId !== g.pointer) return;
    this.clearTimer();
    g.cancel();
    this.suppress = true;
    this.counts.cancels++;
    this.host.changed?.();
  }

  private finish(end: GestureEnd): void {
    if (end.kind === 'move') {
      this.suppress = true;
      this.counts.moves++;
      this.host.commit(end.from, end.to, end.part);
    } else if (end.kind === 'cancel') {
      this.suppress = true;
      this.counts.cancels++;
    }
    this.host.changed?.();
  }
}
