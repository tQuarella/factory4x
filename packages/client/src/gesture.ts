/**
 * H8 drag to move: the gesture state machine, free of the DOM so it can be tested with plain calls (`test/h8-client.test.ts`).
 * `gesturectl.ts` feeds it pointer events and a timer.
 *
 * States (DESIGN.md H8 "Drag to move"), for the primary pointer only:
 *   pressed   down on a node, nothing decided yet
 *   armed     held within the slop for `longPressMs` with a split to carry (the source pulses)
 *   dragging  past the slop: an all-drag (from `pressed`) or a split-drag (from `armed`)
 *   dead      the gesture ended without a move and without a tap (a drag with nothing to carry, a cancel): the release does nothing
 *
 * A release within the slop is a tap (it opens the node's sheet, through the click that follows). Anything else that isn't a
 * drop on a node is a cancel: no input, no change of sheet.
 */
import type { MovePart } from '@factory4x/sim';

export interface GestureDeps {
  /** The node under a canvas point, or null (no node, or the point is over a sheet, the HUD or off the canvas). */
  hit(x: number, y: number): number | null;
  /** The warships a move of `part` from `from` would carry now (`movePreview` total). */
  carry(from: number, part: MovePart): number;
  slopPx(): number;
  longPressMs(): number;
}

export type GesturePhase = 'idle' | 'pressed' | 'armed' | 'dragging' | 'dead';

/** What a release did. */
export type GestureEnd =
  | { kind: 'move'; from: number; to: number; part: MovePart }
  | { kind: 'tap' }
  /** A drag that dropped on nothing, a gesture that ended dead, or a cancel: no input, no tap, and the click after it is suppressed. */
  | { kind: 'cancel' }
  /** Nothing was tracked (the finger went down on empty space): the click that follows is an ordinary tap. */
  | { kind: 'none' };

export class MoveGesture {
  phase: GesturePhase = 'idle';
  /** The pointer being tracked. */
  pointer = -1;
  from = -1;
  part: MovePart = 'all';
  /** The finger, canvas px. */
  x = 0;
  y = 0;
  /** The drop target while dragging (never the source), or null. */
  target: number | null = null;
  private sx = 0;
  private sy = 0;
  private t0 = 0;
  private readonly deps: GestureDeps;

  constructor(deps: GestureDeps) {
    this.deps = deps;
  }

  get active(): boolean {
    return this.phase !== 'idle';
  }

  /** The finger went down at canvas (x, y) at time `t` (ms). A second pointer while one is tracked cancels the gesture. */
  down(pointer: number, x: number, y: number, t: number): void {
    if (this.phase !== 'idle') {
      if (pointer !== this.pointer) this.phase = 'dead';
      return;
    }
    this.pointer = pointer;
    this.x = this.sx = x;
    this.y = this.sy = y;
    this.t0 = t;
    this.target = null;
    this.part = 'all';
    const node = this.deps.hit(x, y);
    if (node === null) {
      // Nothing to track: the click that follows closes the sheet, as before.
      this.from = -1;
      this.phase = 'idle';
      return;
    }
    this.from = node;
    this.phase = 'pressed';
  }

  /**
   * The long-press timer: called when `longPressMs` have passed (and from `move`, so a late timer can't change the answer).
   * Returns true when it armed a split.
   */
  hold(t: number): boolean {
    if (this.phase !== 'pressed' || t - this.t0 < this.deps.longPressMs()) return false;
    if (this.deps.carry(this.from, 'split') <= 0) return false;
    this.phase = 'armed';
    this.part = 'split';
    return true;
  }

  move(pointer: number, x: number, y: number, t: number): void {
    if (pointer !== this.pointer) return;
    if (this.phase === 'idle' || this.phase === 'dead') return;
    this.x = x;
    this.y = y;
    if (this.phase === 'pressed') this.hold(t);
    if (this.phase === 'pressed' || this.phase === 'armed') {
      const slop = this.deps.slopPx();
      if (Math.hypot(x - this.sx, y - this.sy) <= slop) return;
      if (this.phase === 'armed') {
        this.phase = 'dragging';
      } else if (t - this.t0 >= this.deps.longPressMs() || this.deps.carry(this.from, 'all') <= 0) {
        // Held past the long-press time with nothing to split, or nothing to carry at all: not a drag, not a tap.
        this.phase = 'dead';
        return;
      } else {
        this.part = 'all';
        this.phase = 'dragging';
      }
    }
    if (this.phase === 'dragging') {
      const hit = this.deps.hit(x, y);
      this.target = hit === null || hit === this.from ? null : hit;
    }
  }

  up(pointer: number): GestureEnd {
    if (pointer !== this.pointer || this.phase === 'idle') return { kind: 'none' };
    const phase = this.phase;
    const end: GestureEnd =
      phase === 'dragging'
        ? this.target !== null
          ? { kind: 'move', from: this.from, to: this.target, part: this.part }
          : { kind: 'cancel' }
        : phase === 'dead'
          ? { kind: 'cancel' }
          : { kind: 'tap' };
    this.reset();
    return end;
  }

  /** `pointercancel`, or anything else that abandons the gesture. */
  cancel(): void {
    if (this.phase === 'idle') return;
    this.reset();
  }

  private reset(): void {
    this.phase = 'idle';
    this.pointer = -1;
    this.from = -1;
    this.target = null;
    this.part = 'all';
  }
}
