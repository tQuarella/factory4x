import { describe, expect, it } from 'vitest';
import { defaultData, raidStatus, rockStatus, tunableMeta, type RockStatus } from '@factory4x/sim';
import { MoveGesture, type GestureDeps } from '../src/gesture.ts';
import { MINE_MODE_TOAST, RADAR_NOTE, haulerRowText, moveBannerText, movedText, pctText, raidRockText, recycleFleetText } from '../src/fieldreport.ts';
import { CLIENT_SETTING_KEYS, defaultSettings, loadSettings, type StorageLike } from '../src/persist.ts';
import { Session } from '../src/session.ts';
import { raidBadgeMix } from '../src/view.ts';

const data = defaultData;

/** Nodes on a line, 100 px apart: node i at x = 100 i; each has `reach` px of reach. Node 1 holds warships (all: 4, split: 2); the rest hold none. */
function deps(over: Partial<GestureDeps> & { carryAll?: number; carrySplit?: number } = {}): GestureDeps {
  const carryAll = over.carryAll ?? 4;
  const carrySplit = over.carrySplit ?? 2;
  return {
    hit: over.hit ?? ((x, y) => {
      if (y < 0 || y > 100) return null;
      const n = Math.round(x / 100);
      return n >= 0 && n <= 4 && Math.abs(x - n * 100) <= 30 ? n : null;
    }),
    carry: over.carry ?? ((from, part) => (from === 1 ? (part === 'all' ? carryAll : carrySplit) : 0)),
    slopPx: over.slopPx ?? (() => 12),
    longPressMs: over.longPressMs ?? (() => 450),
  };
}

describe('acceptance 1: the move gesture state machine', () => {
  it('a release within the slop is a tap, short or long, and starts nothing', () => {
    const g = new MoveGesture(deps());
    g.down(1, 100, 50, 0);
    expect(g.phase).toBe('pressed');
    g.move(1, 105, 53, 100);
    expect(g.phase).toBe('pressed');
    expect(g.up(1)).toEqual({ kind: 'tap' });
    expect(g.phase).toBe('idle');
    // Held past the long-press time: armed, and the release is still a tap.
    g.down(1, 100, 50, 1000);
    expect(g.hold(1450)).toBe(true);
    expect(g.phase).toBe('armed');
    expect(g.part).toBe('split');
    expect(g.up(1)).toEqual({ kind: 'tap' });
  });

  it('moving past the slop before the long-press time starts an all-drag; dropping on a node moves to it', () => {
    const g = new MoveGesture(deps());
    g.down(1, 100, 50, 0);
    g.move(1, 140, 50, 100);
    expect(g.phase).toBe('dragging');
    expect(g.part).toBe('all');
    g.move(1, 300, 50, 200);
    expect(g.target).toBe(3);
    expect(g.up(1)).toEqual({ kind: 'move', from: 1, to: 3, part: 'all' });
  });

  it('after the long-press time a move starts a split-drag, even if the timer has not fired yet', () => {
    const g = new MoveGesture(deps());
    g.down(1, 100, 50, 0);
    // The timer is late: the move arrives at 500 ms and still counts as a long press.
    g.move(1, 160, 50, 500);
    expect(g.phase).toBe('dragging');
    expect(g.part).toBe('split');
    g.move(1, 200, 50, 520);
    expect(g.up(1)).toEqual({ kind: 'move', from: 1, to: 2, part: 'split' });
  });

  it('the long press arms only when there is something to split; with nothing to carry a drag never starts', () => {
    const none = new MoveGesture(deps());
    none.down(1, 200, 50, 0);
    expect(none.hold(450)).toBe(false);
    expect(none.phase).toBe('pressed');
    expect(none.up(1)).toEqual({ kind: 'tap' });
    const empty = new MoveGesture(deps());
    empty.down(1, 200, 50, 0);
    empty.move(1, 260, 50, 100);
    expect(empty.phase).toBe('dead');
    expect(empty.up(1)).toEqual({ kind: 'cancel' });
  });

  it('a release on empty space, on the source or over a sheet cancels', () => {
    const empty = new MoveGesture(deps());
    empty.down(1, 100, 50, 0);
    empty.move(1, 150, 50, 50);
    empty.move(1, 150, 400, 80);
    expect(empty.target).toBeNull();
    expect(empty.up(1)).toEqual({ kind: 'cancel' });
    const source = new MoveGesture(deps());
    source.down(1, 100, 50, 0);
    source.move(1, 180, 50, 50);
    source.move(1, 104, 50, 80);
    expect(source.target, 'the source is never its own target').toBeNull();
    expect(source.up(1)).toEqual({ kind: 'cancel' });
    // A sheet over the point: the host's hit says null.
    let covered = false;
    const sheet = new MoveGesture(deps({ hit: (x) => (covered ? null : Math.abs(x - 100) <= 30 ? 1 : Math.abs(x - 300) <= 30 ? 3 : null) }));
    sheet.down(1, 100, 50, 0);
    sheet.move(1, 200, 50, 20);
    covered = true;
    sheet.move(1, 300, 50, 40);
    expect(sheet.target).toBeNull();
    expect(sheet.up(1)).toEqual({ kind: 'cancel' });
  });

  it('a second pointer cancels, and the first one\'s release then does nothing but end it', () => {
    const g = new MoveGesture(deps());
    g.down(1, 100, 50, 0);
    g.move(1, 160, 50, 10);
    g.down(2, 300, 50, 20);
    expect(g.phase).toBe('dead');
    g.move(1, 300, 50, 30);
    expect(g.target).toBeNull();
    expect(g.up(2)).toEqual({ kind: 'none' });
    expect(g.up(1)).toEqual({ kind: 'cancel' });
    expect(g.phase).toBe('idle');
  });

  it('pointercancel ends the gesture; a press on no node tracks nothing', () => {
    const g = new MoveGesture(deps());
    g.down(1, 100, 50, 0);
    g.move(1, 160, 50, 10);
    g.cancel();
    expect(g.phase).toBe('idle');
    expect(g.up(1)).toEqual({ kind: 'none' });
    g.down(1, 50, 50, 0);
    expect(g.phase, 'between nodes').toBe('idle');
    expect(g.up(1)).toEqual({ kind: 'none' });
  });

  it('the slop and the long-press time are read live from the settings', () => {
    let slop = 12;
    const g = new MoveGesture(deps({ slopPx: () => slop }));
    g.down(1, 100, 50, 0);
    g.move(1, 125, 50, 10);
    expect(g.phase).toBe('dragging');
    g.cancel();
    slop = 30;
    g.down(1, 100, 50, 0);
    g.move(1, 125, 50, 10);
    expect(g.phase).toBe('pressed');
  });
});

describe('acceptance 2 to 7: the H8 texts', () => {
  const rock = (o: Partial<RockStatus>): Pick<RockStatus, 'mine' | 'haulerNeed' | 'haulerSet' | 'haulerTarget'> => ({ mine: true, haulerNeed: 2, haulerSet: null, haulerTarget: 2, ...o });
  it('the hauler row reads "2 · Auto" and "3 · set (Auto 2)", and a rock not being mined has no need to show', () => {
    expect(haulerRowText(rock({}))).toBe('2 · Auto');
    expect(haulerRowText(rock({ haulerSet: 3, haulerTarget: 3 }))).toBe('3 · set (Auto 2)');
    expect(haulerRowText(rock({ haulerSet: 0, haulerTarget: 0 }))).toBe('0 · set (Auto 2)');
    expect(haulerRowText(rock({ mine: false, haulerNeed: 0, haulerTarget: 0 }))).toBe('Auto');
    expect(haulerRowText(rock({ mine: false, haulerNeed: 0, haulerTarget: 0, haulerSet: 4 }))).toBe('4 · set');
  });
  it('the weight column, the radar line, the banner, the toasts and the recycle button', () => {
    expect(pctText({ incomePct: 30 })).toBe(' · 30%');
    expect(RADAR_NOTE).toBe('Income is split by these weights.');
    expect(moveBannerText(6)).toBe('Tap where to send 6 ships');
    expect(moveBannerText(1)).toBe('Tap where to send 1 ship');
    expect(movedText(6, 'A5', false)).toBe('Moved 6 → A5');
    expect(movedText(6, 'P2', true)).toBe('Sent 6 to attack P2');
    expect(MINE_MODE_TOAST).toBe('Tap rocks to mine or stop. Tap Mine to finish.');
    expect(recycleFleetText(0, 0)).toBe('Recycle');
    expect(recycleFleetText(3, 24)).toBe('Recycle 3 (+24 ore)');
  });
  it('the rock sheet names what is coming, then what is here', () => {
    expect(raidRockText('muster', { thorn: 1, spore: 4 })).toBe('Raid coming: 4 Spores, 1 Thorn');
    expect(raidRockText('out', { thorn: 2, spore: 0 })).toBe('Raid coming: 2 Thorns');
    expect(raidRockText('fight', { thorn: 0, spore: 1 })).toBe('Raid here: 1 Spore');
  });
});

describe('acceptance 10: the client keys are device settings', () => {
  const store = (initial: string | null): StorageLike & { saved: string | null } => {
    const s = { saved: initial, getItem: () => s.saved, setItem: (_k: string, v: string) => void (s.saved = v), removeItem: () => void (s.saved = null) };
    return s;
  };
  it('the three H8 keys are in the data with the spec defaults, are client scope, and never reach setTunable', () => {
    const meta = tunableMeta(data).filter((m) => m.key.startsWith('client.'));
    expect(meta.map((m) => [m.key, m.default, m.min, m.max, m.scope])).toEqual([
      ['client.autosaveSec', 5, 2, 60, 'client'],
      ['client.longPressMs', 450, 250, 900, 'client'],
      ['client.dragSlopPx', 12, 6, 24, 'client'],
      ['client.moveGesture', 1, 0, 1, 'client'],
    ]);
    expect(Object.keys(CLIENT_SETTING_KEYS)).toHaveLength(4);
  });
  it('settings default to the data, load valid stored values and drop out-of-range ones', () => {
    const d = defaultSettings(data);
    expect([d.longPressMs, d.dragSlopPx, d.moveGesture]).toEqual([450, 12, 1]);
    const good = loadSettings(data, store(JSON.stringify({ ...d, longPressMs: 300, dragSlopPx: 8, moveGesture: 0 })));
    expect([good.longPressMs, good.dragSlopPx, good.moveGesture]).toEqual([300, 8, 0]);
    const bad = loadSettings(data, store(JSON.stringify({ ...d, longPressMs: 100, dragSlopPx: 99, moveGesture: 2 })));
    expect([bad.longPressMs, bad.dragSlopPx, bad.moveGesture]).toEqual([450, 12, 1]);
  });
});

describe('acceptance 6: the raid badge', () => {
  it('only the target rock wears it, from the muster to the end, with the raiders\' mix', () => {
    const s = new Session(data, { seed: 3 });
    s.sendAll([
      { type: 'setTunable', key: 'raid.firstAtEcon', value: 2 },
      { type: 'setTunable', key: 'raid.musterTicks', value: 0 },
    ]);
    for (let i = 0; i < 12000 && raidStatus(s.world).phase === 'none'; i++) s.stepOnce();
    const r = raidStatus(s.world);
    expect(r.phase).not.toBe('none');
    const target = r.target!;
    const mixes = s.world.nodes.map((n) => raidBadgeMix(s.world, n.index, n.kind === 'probe' ? false : rockStatus(s.world, n.index).raidTarget));
    s.world.nodes.forEach((n, i) => {
      if (n.index === target) expect(mixes[i]).not.toBeNull();
      else expect(mixes[i], `node ${n.id}`).toBeNull();
    });
    const mix = mixes[target]!;
    expect(mix.thorn + mix.spore).toBeGreaterThan(0);
    // To the end: the badge goes when the raid has finished.
    for (let i = 0; i < 12000 && !(raidStatus(s.world).phase === 'none' && raidStatus(s.world).last !== null); i++) s.stepOnce();
    expect(raidBadgeMix(s.world, target, false)).toBeNull();
  });
});
