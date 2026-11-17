/**
 * H10 S1-S6: the auto-slowdown. Speed is session state in the client; nothing here reaches the sim, the replay or a save.
 * `Slowdown` is a small state machine, stepped once per frame with what the raid looks like now, and it says what to do.
 */
import type { Speed } from './session.ts';

/** What one frame shows of the raid (from `world.raid` and `raidStatus`). */
export interface RaidFrame {
  /** `world.raid.id`, or null when there is no raid (it ended, was cancelled by a battle at the hive, or withered). */
  id: number | null;
  /** The raid's summary phase is muster, out or fight (some prong has not come home). */
  live: boolean;
  /** Every prong's outcome is decided (non-null). */
  decided: boolean;
}

export interface SlowdownAct {
  /** Set the session speed to this. */
  speed?: Speed;
  /** Show this toast. */
  toast?: string;
}

/** The raid-slowdown setting, read through this one function: `client.raidSlowdown` (shipped at 1; a setting of this device). */
export function raidSlowdownSetting(settings: Readonly<{ raidSlowdown: number }>): number {
  return settings.raidSlowdown;
}

/** S3: the note on engage, with the real speed. */
export function slowdownToast(restore: Speed): string {
  return `1x for the raid · back to ${restore}x after`;
}

export class Slowdown {
  /** The raid id last engaged (or passed at 1x), so each id engages at most once. */
  private seen: number | null = null;
  /** The speed to give back when the raid is over; null when nothing is remembered. */
  restoreSpeed: Speed | null = null;

  /** One frame. `speed` is the session's speed now; `on` is the setting. Returns what to do. */
  frame(f: RaidFrame, speed: Speed, on: boolean): SlowdownAct {
    const act: SlowdownAct = {};
    let now = speed;
    // S4: over when every outcome is decided, no raid shows, or the id changed.
    if (this.restoreSpeed !== null && (f.id === null || f.id !== this.seen || f.decided)) {
      now = this.restoreSpeed;
      act.speed = now;
      this.restoreSpeed = null;
    }
    // S1, S2: the first frame that sees a live raid id engages, once. At 1x nothing is remembered.
    if (on && f.id !== null && f.live && !f.decided && f.id !== this.seen) {
      this.seen = f.id;
      if (now > 1) {
        this.restoreSpeed = now;
        act.speed = 1;
        act.toast = slowdownToast(now);
      }
    }
    return act;
  }

  /** S5: the player tapped 1x, 2x or 4x. Their choice wins: nothing is restored, and the same id never re-engages. */
  playerSpeed(): void {
    this.restoreSpeed = null;
  }

  /** A new world (new run, load): nothing is remembered. */
  reset(): void {
    this.seen = null;
    this.restoreSpeed = null;
  }
}
