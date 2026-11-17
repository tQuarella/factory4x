import { describe, expect, it } from 'vitest';
import { Slowdown, raidSlowdownSetting, slowdownToast, type RaidFrame } from '../src/slowdown.ts';
import type { Speed } from '../src/session.ts';

/** A tiny driver: a speed the "session" holds, and a Slowdown stepped against raid frames, as main.ts does. */
function rig(start: Speed, on = true): { s: Slowdown; speed: () => Speed; step: (f: RaidFrame) => ReturnType<Slowdown['frame']>; tap: (v: Speed) => void } {
  const s = new Slowdown();
  let speed = start;
  return {
    s,
    speed: () => speed,
    step: (f) => {
      const a = s.frame(f, speed, on);
      if (a.speed !== undefined) speed = a.speed;
      return a;
    },
    tap: (v) => {
      speed = v;
      s.playerSpeed();
    },
  };
}
const live = (id: number): RaidFrame => ({ id, live: true, decided: false });
const done = (id: number): RaidFrame => ({ id, live: false, decided: true });
const none: RaidFrame = { id: null, live: false, decided: false };

describe('S1-S3: engage', () => {
  it('above 1x it sets 1x, remembers the speed and says so with the real speed', () => {
    for (const v of [2, 4] as const) {
      const r = rig(v);
      const a = r.step(live(1));
      expect(r.speed()).toBe(1);
      expect(r.s.restoreSpeed).toBe(v);
      expect(a.toast).toBe(`1x for the raid · back to ${v}x after`);
    }
    expect(slowdownToast(4)).toBe('1x for the raid · back to 4x after');
  });
  it('at 1x nothing is remembered and there is no toast', () => {
    const r = rig(1);
    const a = r.step(live(1));
    expect(r.speed()).toBe(1);
    expect(r.s.restoreSpeed).toBeNull();
    expect(a.toast).toBeUndefined();
    r.step(done(1));
    expect(r.speed()).toBe(1);
  });
  it('each raid id engages once', () => {
    const r = rig(4);
    r.step(live(1));
    const again = r.step(live(1));
    expect(again).toEqual({});
    expect(r.s.restoreSpeed).toBe(4);
  });
  it('a game loaded mid-raid engages on its first frame, from the speed it loads at (1x: nothing remembered)', () => {
    const r = rig(1);
    r.step({ id: 7, live: true, decided: false });
    expect(r.s.restoreSpeed).toBeNull();
    r.step(done(7));
    expect(r.speed()).toBe(1);
  });
  it('is off at 0', () => {
    const r = rig(4, false);
    const a = r.step(live(1));
    expect(a).toEqual({});
    expect(r.speed()).toBe(4);
  });
  it('engages while paused without touching pause: pause is not an input to it, and the speed underneath still becomes 1x', () => {
    // The machine never sees `paused`; the speed it is given is the one underneath.
    const r = rig(4);
    r.step(live(1));
    expect(r.speed()).toBe(1);
    expect(raidSlowdownSetting()).toBe(1);
  });
});

describe('S4: restore', () => {
  it('holds through the phases, restores once every outcome is decided', () => {
    const r = rig(4);
    r.step(live(1));
    r.step(live(1));
    expect(r.speed()).toBe(1);
    r.step(done(1));
    expect(r.speed()).toBe(4);
    expect(r.s.restoreSpeed).toBeNull();
    r.step(done(1));
    expect(r.speed()).toBe(4);
  });
  it('restores when no raid shows (a cancelled muster, a wither, the raid ended)', () => {
    const r = rig(2);
    r.step(live(3));
    r.step(none);
    expect(r.speed()).toBe(2);
  });
  it('restores on a changed id, and the new raid engages from the restored speed', () => {
    const r = rig(4);
    r.step(live(1));
    const a = r.step(live(2));
    expect(r.speed()).toBe(1);
    expect(r.s.restoreSpeed).toBe(4);
    expect(a.toast).toBe('1x for the raid · back to 4x after');
  });
  it('a cancelled muster that musters again has a new id and engages again', () => {
    const r = rig(4);
    r.step(live(1));
    r.step(none);
    expect(r.speed()).toBe(4);
    r.step(live(2));
    expect(r.speed()).toBe(1);
  });
});

describe('S5: the player wins', () => {
  it('a tap while engaged clears the restore and the same id never re-engages; the next raid engages from the speed then set', () => {
    const r = rig(4);
    r.step(live(1));
    r.tap(2);
    r.step(live(1));
    expect(r.speed()).toBe(2);
    r.step(done(1));
    expect(r.speed()).toBe(2);
    r.step(live(2));
    expect(r.speed()).toBe(1);
    expect(r.s.restoreSpeed).toBe(2);
  });
  it('a tap on 4x mid-raid stays at 4x', () => {
    const r = rig(4);
    r.step(live(1));
    r.tap(4);
    r.step(live(1));
    r.step(live(1));
    expect(r.speed()).toBe(4);
  });
  it('pause and the tuning panel are not speed changes: nothing but a speed tap reaches playerSpeed, so the restore stands', () => {
    const r = rig(4);
    r.step(live(1));
    // (a pause or a tuning panel changes `paused`, which the machine is never told)
    r.step(live(1));
    r.step(done(1));
    expect(r.speed()).toBe(4);
  });
});

describe('S6: edges', () => {
  it('a new world forgets everything', () => {
    const r = rig(4);
    r.step(live(1));
    r.s.reset();
    expect(r.s.restoreSpeed).toBeNull();
    r.step(live(1));
    // Engaged again (the id was forgotten) at the 1x the first engage left, so nothing is remembered.
    expect(r.speed()).toBe(1);
    expect(r.s.restoreSpeed).toBeNull();
  });
});
