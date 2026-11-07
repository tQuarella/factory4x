import { describe, expect, it } from 'vitest';
import { createWorld, defaultData, lastBattle, replayHashes, rootIndex, shipCounts, step, worldHash, type Input, type World } from '@factory4x/sim';
import { Session, dataWithDefaults, replayData } from '../src/session.ts';
import { decodeSave, encodeSave, loadSave, loadSettings, writeSave, SAVE_KEY, type StorageLike } from '../src/persist.ts';
import { buildNote } from '../src/feedback.ts';
import { bannerLines, battleReport, feedsBloomText, supplyLine } from '../src/report.ts';
import { clampInt, fmt10, mmss, shortVersion, stepFor, ticksText } from '../src/format.ts';
import { guardedReach, ringGeom } from '../src/view.ts';
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

function ship(w: World, node: number, n: number): void {
  for (let i = 0; i < n; i++) w.ships.push({ id: w.nextId++, hp: w.tun['ship.hp'], at: node, transit: null, engagedIn: -1 });
}

/** Seed 3 is the Thin Root (4 thorns). Nothing happens unless a test sets it up. */
function idleWorld(): World {
  const w = createWorld(3, defaultData);
  w.stock = 0;
  w.shipyard.on = false;
  w.tun['economy.probeOrePerMin'] = 0;
  return w;
}

describe('H2 readouts', () => {
  it('the Feeds the Bloom box and the rich-sheet line come from live tunables', () => {
    const w = idleWorld();
    expect(feedsBloomText(w, false)).toBe('While the Root lives, the Bloom has 12 thorns, regrows 1 / 2.0 s, repairs 2. Cut it: 8 thorns, 1 / 10.0 s, no repair.');
    expect(supplyLine(w)).toBe('Fed by the Root (cut it: 8 thorns, 1 / 10.0 s)');
    w.tun['bloom.starvedCap'] = 5;
    w.tun['bloom.starvedRepairPerRound'] = 2;
    w.tun['guardian.regrowTicks'] = 30;
    expect(feedsBloomText(w, false)).toContain('regrows 1 / 1.0 s, repairs 2. Cut it: 5 thorns, 1 / 10.0 s, repairs 2.');
    expect(supplyLine(w)).toContain('cut it: 5 thorns');
  });

  it('cutting the Root reports the wilt and flips the Bloom to starved', () => {
    const w = idleWorld();
    ship(w, rootIndex(w), 15);
    for (let i = 0; i < 400 && lastBattle(w, rootIndex(w)) === null; i++) step(w, defaultData, []);
    const r = lastBattle(w, rootIndex(w))!;
    expect(r.outcome).toBe('captured');
    expect(battleReport(w, r)).toBe(`Root cut: ${r.shipsEngaged} sent, ${r.shipsLost} lost. The Bloom wilts: 12 → 8 thorns, regrows 5× slower.`);
    expect(supplyLine(w)).toBe('Starved: Root cut');
    expect(feedsBloomText(w, false)).toContain('The Root is cut');
  });

  it('a Root held report and a Root repelled reason name the Root', () => {
    const w = idleWorld();
    const text = battleReport(w, { id: 1, node: rootIndex(w), wilt: null, startTick: 0, endTick: 10, outcome: 'repelled', shipsEngaged: 10, shipsLost: 10, thornsKilled: 2 });
    expect(text).toContain('Root held: 10 sent, 10 lost, 2 thorns stripped');
    expect(text).toContain('the Root regrows');
  });

  it('the banner has one prefixed line per running battle', () => {
    const w = idleWorld();
    expect(bannerLines(w)).toEqual([]);
    ship(w, rootIndex(w), 3);
    ship(w, 6, 20);
    for (let i = 0; i < 31 && bannerLines(w).length < 2; i++) step(w, defaultData, []);
    const lines = bannerLines(w);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^BLOOM · strip \d+(\.\d)?\/s · regrow 0\.5\/s · \d+ lost$/);
    expect(lines[1]).toMatch(/^ROOT · strip /);
  });

  it('tick values also show seconds', () => {
    expect(ticksText(60, 30)).toBe('60 · 2.0 s');
    expect(ticksText(300, 30)).toBe('300 · 10.0 s');
  });

  it('guarded hit areas cover the thorn ring and are at least 44 px across', () => {
    for (const rr of [14, 20, 28, 60]) {
      const { ringR, thornR } = ringGeom(rr, 12);
      expect(guardedReach(rr, 12)).toBeGreaterThanOrEqual(ringR + thornR);
      expect(guardedReach(rr, 12)).toBeGreaterThanOrEqual(22);
    }
  });
});
