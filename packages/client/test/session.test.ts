import { describe, expect, it } from 'vitest';
import { defaultData, replayHashes, shipCounts, worldHash, type Input } from '@factory4x/sim';
import { Session, dataWithDefaults, replayData } from '../src/session.ts';
import { decodeSave, encodeSave, loadSave, loadSettings, writeSave, SAVE_KEY, type StorageLike } from '../src/persist.ts';
import { buildNote } from '../src/feedback.ts';
import { battleReport } from '../src/report.ts';
import { clampInt, fmt10, mmss, shortVersion, stepFor } from '../src/format.ts';
import { fitMap } from '../src/fit.ts';
import { podTotalTicks, progressFrac } from '../src/interp.ts';

function mem(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function play(s: Session, ticks: number, inputsAt: Record<number, Input[]> = {}): void {
  for (let i = 0; i < ticks; i++) {
    for (const input of inputsAt[s.world.tick] ?? []) s.send(input);
    s.stepOnce();
  }
}

const script: Record<number, Input[]> = {
  0: [
    { type: 'buildExtractor', node: 1 },
    { type: 'buildRoute', from: 1, to: 0 },
    { type: 'setTunable', key: 'ship.cost', value: 5 },
  ],
  400: [{ type: 'setRally', node: 5 }],
  900: [{ type: 'buildExtractor', node: 2 }],
};

describe('session replay log', () => {
  it('replay of seed + log reproduces the live hash', () => {
    const s = new Session(defaultData, { seed: 7 });
    play(s, 1500, script);
    expect(s.log.length).toBeGreaterThanOrEqual(4);
    const h = replayHashes(s.replay(), defaultData, s.world.tick, s.world.tick)[0];
    expect(h).toBe(worldHash(s.world));
  });

  it('drops invalid inputs without logging them', () => {
    const s = new Session(defaultData, { seed: 7 });
    expect(s.send({ type: 'buildExtractor', node: 6 })).toBe(false);
    expect(s.log.length).toBe(0);
  });

  it('paused sends apply at once and are logged', () => {
    const s = new Session(defaultData, { seed: 7 });
    s.paused = true;
    s.send({ type: 'buildExtractor', node: 1 });
    expect(s.world.tick).toBe(1);
    expect(s.log).toEqual([{ tick: 0, input: { type: 'buildExtractor', node: 1 } }]);
    expect(s.advance(1000)).toBe(0);
  });

  it('advance steps at the fixed tick and scales with speed', () => {
    const s = new Session(defaultData, { seed: 1 });
    s.advance(200);
    const one = s.world.tick;
    const t = new Session(defaultData, { seed: 1 });
    t.speed = 4;
    t.advance(200);
    expect(one).toBeGreaterThanOrEqual(5);
    expect(t.world.tick).toBeGreaterThanOrEqual(one * 4 - 4);
  });
});

/** A session with idle ships at both the Probe (0) and A5 (5), reached by play only, so the replay is valid. */
function stagedAtProbeAndA5(): Session {
  const s = new Session(defaultData, { seed: 11 });
  s.send({ type: 'setTunable', key: 'ship.cost', value: 5 });
  s.send({ type: 'setTunable', key: 'ship.buildTicks', value: 15 });
  let staged = false;
  for (let i = 0; i < 6000; i++) {
    const at = shipCounts(s.world).at;
    if (!staged && at[0]! >= 2) staged = s.send({ type: 'sendShips', from: 0, to: 5, count: 0 });
    if (staged && at[5]! >= 2 && at[0]! >= 1) return s;
    s.stepOnce();
  }
  throw new Error('ships never staged at Probe and A5');
}

const attackAll: Input[] = [
  { type: 'sendShips', from: 0, to: 6, count: 0 },
  { type: 'sendShips', from: 5, to: 6, count: 0 },
];

function replayMatches(s: Session): boolean {
  return replayHashes(s.replay(), defaultData, s.world.tick, s.world.tick)[0] === worldHash(s.world);
}

describe('one press, one tick (sendAll)', () => {
  it('paused: a two-source attack applies in one tick and counts one wave', () => {
    const s = stagedAtProbeAndA5();
    s.paused = true;
    const t0 = s.world.tick;
    expect(s.world.stats.wavesSent).toBe(0);
    expect(s.sendAll(attackAll)).toBe(2);
    expect(s.world.tick).toBe(t0 + 1);
    expect(s.world.stats.wavesSent).toBe(1);
    expect(s.log.slice(-2).map((l) => l.tick)).toEqual([t0, t0]);
    expect(replayMatches(s)).toBe(true);
  });

  it('running: a two-source attack applies on the next tick and counts one wave', () => {
    const s = stagedAtProbeAndA5();
    const t0 = s.world.tick;
    expect(s.sendAll(attackAll)).toBe(2);
    expect(s.world.tick).toBe(t0);
    s.advance(s.tickMs);
    expect(s.world.tick).toBe(t0 + 1);
    expect(s.world.stats.wavesSent).toBe(1);
    expect(s.log.slice(-2).map((l) => l.tick)).toEqual([t0, t0]);
    expect(replayMatches(s)).toBe(true);
  });

  it('paused: drops invalid inputs, and steps nothing when none is valid', () => {
    const s = new Session(defaultData, { seed: 3 });
    s.paused = true;
    expect(s.sendAll([{ type: 'buildExtractor', node: 6 }])).toBe(0);
    expect(s.world.tick).toBe(0);
    expect(
      s.sendAll([
        { type: 'setTunable', key: 'ship.cost', value: 20 },
        { type: 'buildExtractor', node: 6 },
        { type: 'setTunable', key: 'ship.hp', value: 12 },
      ]),
    ).toBe(2);
    expect(s.world.tick).toBe(1);
    expect(s.log.map((l) => l.tick)).toEqual([0, 0]);
    expect(replayMatches(s)).toBe(true);
  });
});

describe('autosave', () => {
  it('resume keeps the seed and full log so the replay still matches', () => {
    const s = new Session(defaultData, { seed: 99 });
    play(s, 700, script);
    s.send({ type: 'setShipyard', on: false });
    const out = decodeSave(encodeSave(s), defaultData);
    expect(out.kind).toBe('resumed');
    if (out.kind !== 'resumed') return;
    const r = out.session;
    expect(worldHash(r.world)).toBe(worldHash(s.world));
    expect(r.pending).toEqual(s.pending);
    play(r, 600, { 700: [{ type: 'buildExtractor', node: 2 }] });
    const h = replayHashes(r.replay(), defaultData, r.world.tick, r.world.tick)[0];
    expect(h).toBe(worldHash(r.world));
    expect(r.replay().seed).toBe(99);
  });

  it('writes and loads through storage; discards other data versions', () => {
    const st = mem();
    const s = new Session(defaultData, { seed: 5 });
    play(s, 100);
    expect(writeSave(s, st)).toBe(true);
    expect(loadSave(defaultData, st).kind).toBe('resumed');
    const parsed = JSON.parse(st.map.get(SAVE_KEY)!) as Record<string, unknown>;
    const inner = JSON.parse(parsed.world as string) as Record<string, unknown>;
    inner.dataVersion = defaultData.dataVersion + 1;
    parsed.world = JSON.stringify(inner);
    st.map.set(SAVE_KEY, JSON.stringify(parsed));
    const out = loadSave(defaultData, st);
    expect(out.kind).toBe('discarded');
    expect(st.map.has(SAVE_KEY)).toBe(false);
  });

  it('survives broken storage and garbage', () => {
    const bad: StorageLike = {
      getItem: () => {
        throw new Error('no');
      },
      setItem: () => {
        throw new Error('no');
      },
      removeItem: () => {
        throw new Error('no');
      },
    };
    expect(loadSave(defaultData, bad).kind).toBe('none');
    expect(writeSave(new Session(defaultData, { seed: 1 }), bad)).toBe(false);
    expect(loadSettings(defaultData, bad).autosaveSec).toBe(defaultData.tunables['client.autosaveSec'].default);
    expect(decodeSave('not json', defaultData).kind).toBe('discarded');
  });
});

describe('New run keeps tuning', () => {
  it('applies tuned values (startStock) and the replay and save still reproduce the world', () => {
    const old = new Session(defaultData, { seed: 1 });
    old.send({ type: 'setTunable', key: 'economy.startStock', value: 150 });
    old.send({ type: 'setTunable', key: 'guardian.cap', value: 5 });
    old.stepOnce();
    const s = new Session(dataWithDefaults(defaultData, old.world.tun), { seed: 2 });
    expect(s.world.stock).toBe(150);
    expect(s.world.guardians[0]!.thorns.length).toBe(5);
    play(s, 800, script);
    const r = s.replay();
    expect(r.startTunables).toEqual({ 'economy.startStock': 150, 'guardian.cap': 5 });
    expect(replayHashes(r, replayData(r), s.world.tick, s.world.tick)[0]).toBe(worldHash(s.world));
    const out = decodeSave(encodeSave(s), defaultData);
    expect(out.kind).toBe('resumed');
    if (out.kind !== 'resumed') return;
    expect(out.session.replay()).toEqual(r);
    expect(worldHash(out.session.world)).toBe(worldHash(s.world));
  });
});

describe('feedback note', () => {
  it('carries versions, hash and replay, and falls back when long', () => {
    const s = new Session(defaultData, { seed: 3 });
    play(s, 60, script);
    const n = buildNote(s, defaultData, 'too slow', 'dev-abcdef0123456789', { viewport: '375x812', userAgent: 'x' });
    expect(n.text).toContain('dev-abcdef0123456789');
    expect(n.text).toContain(`Data version: ${defaultData.dataVersion}`);
    expect(n.text).toContain(worldHash(s.world));
    expect(n.text).toContain('"seed":3');
    expect(n.url).not.toBeNull();
    play(s, 4000, { 100: [{ type: 'setRally', node: 5 }] });
    for (let i = 0; i < 300; i++) s.log.push({ tick: 5000 + i, input: { type: 'setShipyard', on: i % 2 === 0 } });
    const long = buildNote(s, defaultData, 'x', 'v', { viewport: 'a', userAgent: 'b' });
    expect(long.url).toBeNull();
    expect(long.shortUrl.length).toBeLessThan(2000);
  });
});

describe('helpers', () => {
  it('format', () => {
    expect(fmt10(25)).toBe('2.5');
    expect(fmt10(30)).toBe('3');
    expect(mmss(125)).toBe('2:05');
    expect(shortVersion('main-12-0123456789abcdef0123456789abcdef01234567')).toBe('0123456');
    expect(shortVersion('dev')).toBe('dev');
    expect(clampInt(999, 1, 10)).toBe(10);
    expect(stepFor(30, 1800)).toBeGreaterThan(1);
  });

  it('pod and ship progress is clamped even when speed was retuned mid-flight', () => {
    const total = podTotalTicks(950, 30);
    expect(progressFrac(500, total, 0.5)).toBe(0);
    expect(progressFrac(0, total, 5)).toBe(1);
    expect(progressFrac(3, 0, 0)).toBe(1);
  });

  it('fitMap keeps every node inside the area', () => {
    const nodes = defaultData.map.nodes;
    for (const [w, h] of [[375, 350], [375, 700], [300, 375]] as const) {
      const f = fitMap(nodes, w, h);
      for (const n of nodes) {
        const x = f.ox + n.x * f.scale;
        const y = f.oy + n.y * f.scale;
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(w);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(h);
      }
    }
  });

  it('battle report names the reason for a failed wave', () => {
    const s = new Session(defaultData, { seed: 1 });
    const text = battleReport(s.world, { id: 1, node: 6, wilt: null, startTick: 0, endTick: 10, outcome: 'repelled', shipsEngaged: 6, shipsLost: 6, thornsKilled: 2 });
    expect(text).toContain('Wave repelled: 6 sent, 6 lost, 2 thorns stripped');
    expect(text).toMatch(/Regrowth outpaced|Too few ships/);
    expect(battleReport(s.world, { id: 2, node: 6, wilt: null, startTick: 0, endTick: 10, outcome: 'captured', shipsEngaged: 30, shipsLost: 12, thornsKilled: 12 })).toBe('Captured: 30 sent, 12 lost');
  });
});
