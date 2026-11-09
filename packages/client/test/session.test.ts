import { describe, expect, it } from 'vitest';
import { SEND_ALL, campaignWorld, defaultData, lastBattle, replayHashes, rootIndex, shipCounts, step, worldHash, type BattleResult, type Input, type World } from '@factory4x/sim';
import { Session, dataWithDefaults, replayData } from '../src/session.ts';
import { decodeSave, encodeSave, loadSave, loadSettings, writeSave, SAVE_KEY, type StorageLike } from '../src/persist.ts';
import { buildNote } from '../src/feedback.ts';
import { bannerLines, battleReport, feedsBloomText, regrowChange, regrowText, repelHint, supplyLine, unlockHint, unlockNotice } from '../src/report.ts';
import { byTypeText, captureOrderText } from '../src/panels.ts';
import { shipsText } from '../src/sheet.ts';
import { clampInt, fmt10, mmss, shortVersion, stepFor, ticksText } from '../src/format.ts';
import { guardRingOuter, guardedReach, ringGeom } from '../src/view.ts';
import { fitMap } from '../src/fit.ts';
import { podTotalTicks, progressFrac } from '../src/interp.ts';
// The frozen v4 test fixture: tests that pin rule outcomes (guard counts, wilt text) run on it, so calibration doesn't break them.
import { fixtureData } from '../../sim/test/fixture.ts';
// H4: createWorld starts on the overworld; an H3 game is The Deep from a constructed campaign.
import { deepStart, h3World } from '../../sim/test/h3-world.ts';

/** The H3 game as a session: The Deep from a constructed campaign (the start is part of the replay). */
function deep(seed: number, data = defaultData): Session {
  return new Session(data, { seed, start: deepStart(data) });
}

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
    { type: 'setTunable', key: 'ship.drone.cost', value: 5 },
  ],
  400: [{ type: 'setRally', node: 5 }],
  900: [{ type: 'buildExtractor', node: 2 }],
};

describe('session replay log', () => {
  it('replay of seed + log reproduces the live hash', () => {
    const s = deep(7);
    play(s, 1500, script);
    expect(s.log.length).toBeGreaterThanOrEqual(4);
    const h = replayHashes(s.replay(), defaultData, s.world.tick, s.world.tick)[0];
    expect(h).toBe(worldHash(s.world));
  });

  it('drops invalid inputs without logging them', () => {
    const s = deep(7);
    expect(s.send({ type: 'buildExtractor', node: DEEP_HEART })).toBe(false);
    expect(s.log.length).toBe(0);
  });

  it('paused sends apply at once and are logged', () => {
    const s = deep(7);
    s.paused = true;
    s.send({ type: 'buildExtractor', node: 1 });
    expect(s.world.tick).toBe(1);
    expect(s.log).toEqual([{ tick: 0, input: { type: 'buildExtractor', node: 1 } }]);
    expect(s.advance(1000)).toBe(0);
  });

  it('advance steps at the fixed tick and scales with speed', () => {
    const s = deep(1);
    s.advance(200);
    const one = s.world.tick;
    const t = deep(1);
    t.speed = 4;
    t.advance(200);
    expect(one).toBeGreaterThanOrEqual(5);
    expect(t.world.tick).toBeGreaterThanOrEqual(one * 4 - 4);
  });
});

/** A session with idle ships at both the Probe (0) and A5 (5), reached by play only, so the replay is valid. */
function stagedAtProbeAndA5(): Session {
  const s = deep(11);
  s.send({ type: 'setTunable', key: 'ship.drone.cost', value: 5 });
  s.send({ type: 'setTunable', key: 'ship.drone.buildTicks', value: 15 });
  let staged = false;
  for (let i = 0; i < 6000; i++) {
    const at = shipCounts(s.world).at;
    if (!staged && at[0]! >= 2) staged = s.send({ type: 'sendShips', from: 0, to: 5, counts: SEND_ALL });
    if (staged && at[5]! >= 2 && at[0]! >= 1) return s;
    s.stepOnce();
  }
  throw new Error('ships never staged at Probe and A5');
}

/** The Deep's heart on the shipped data (h6-sim: index 14, since The Deep has no Root from data v10). */
const DEEP_HEART = campaignWorld(1, defaultData, deepStart(defaultData)).nodes.findIndex((n) => n.kind === 'heart');

/** An attack on the heart from the probe and a5. */
const attackAll: Input[] = [
  { type: 'sendShips', from: 0, to: DEEP_HEART, counts: SEND_ALL },
  { type: 'sendShips', from: 5, to: DEEP_HEART, counts: SEND_ALL },
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
    const s = deep(3);
    s.paused = true;
    expect(s.sendAll([{ type: 'buildExtractor', node: DEEP_HEART }])).toBe(0);
    expect(s.world.tick).toBe(0);
    expect(
      s.sendAll([
        { type: 'setTunable', key: 'ship.drone.cost', value: 20 },
        { type: 'buildExtractor', node: DEEP_HEART },
        { type: 'setTunable', key: 'ship.drone.hp', value: 12 },
      ]),
    ).toBe(2);
    expect(s.world.tick).toBe(1);
    expect(s.log.map((l) => l.tick)).toEqual([0, 0]);
    expect(replayMatches(s)).toBe(true);
  });
});

describe('autosave', () => {
  it('resume keeps the seed and full log so the replay still matches', () => {
    const s = deep(99);
    play(s, 700, script);
    s.send({ type: 'setShipyard', shipType: 'drone', on: false });
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
    const s = deep(5);
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
    expect(writeSave(deep(1), bad)).toBe(false);
    expect(loadSettings(defaultData, bad).autosaveSec).toBe(defaultData.tunables['client.autosaveSec'].default);
    expect(decodeSave('not json', defaultData).kind).toBe('discarded');
  });
});

describe('New system keeps tuning', () => {
  it('applies tuned values (startStock) and the replay and save still reproduce the world', () => {
    const old = deep(1);
    old.send({ type: 'setTunable', key: 'economy.startStock', value: 150 });
    old.send({ type: 'setTunable', key: 'guard.capPct', value: 50 });
    old.stepOnce();
    // A real New system starts on the overworld; the tuned start stock applies at the landing, so land in The Deep from a constructed start.
    const s = new Session(dataWithDefaults(defaultData, old.world.tun), { seed: 2, start: deepStart(defaultData) });
    expect(s.world.stock.ore).toBe(150);
    // Seed 2 is Twin Seams. Its p1 (the first guardian) starts at floor(count × 50 / 100) per type.
    // This test runs on the shipped data (replayData rebuilds from it), so the count is read from the layout.
    const p1 = defaultData.map.layouts[2]!.pockets.p1!;
    expect(s.world.system.variant).toBe(2);
    expect(s.world.guardians[0]!.guards.length).toBe(Math.floor(p1.thorns / 2) + Math.floor(p1.spores / 2));
    play(s, 800, script);
    const r = s.replay();
    expect(r.startTunables).toEqual({ 'economy.startStock': 150, 'guard.capPct': 50 });
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
    const s = deep(3);
    play(s, 60, script);
    const n = buildNote(s, defaultData, 'too slow', 'dev-abcdef0123456789', { viewport: '375x812', userAgent: 'x' });
    expect(n.text).toContain('dev-abcdef0123456789');
    expect(n.text).toContain(`Data version: ${defaultData.dataVersion}`);
    expect(n.text).toContain(worldHash(s.world));
    expect(n.text).toContain('"seed":3');
    expect(n.url).not.toBeNull();
    play(s, 4000, { 100: [{ type: 'setRally', node: 5 }] });
    for (let i = 0; i < 300; i++) s.log.push({ tick: 5000 + i, input: { type: 'setShipyard', shipType: 'drone', on: i % 2 === 0 } });
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

  it('battle report names the reason for a failed wave, with the counter hint', () => {
    const s = deep(1);
    const text = battleReport(s.world, result({ node: DEEP_HEART, outcome: 'repelled', shipsEngaged: 6, shipsLost: 6, guardsKilled: 2 }));
    expect(text).toContain('Heart held: 6 sent, 6 lost.');
    expect(text).toMatch(/Regrowth outpaced|Too few ships/);
    expect(battleReport(s.world, result({ node: DEEP_HEART, outcome: 'captured', shipsEngaged: 30, shipsLost: 12, guardsKilled: 12 }))).toBe('Heart taken: 30 sent, 12 lost');
  });

  it('a pocket capture names its prize, and the unlock only until that prize has been delivered', () => {
    const w = campaignWorld(3, defaultData, deepStart(defaultData));
    const pockets = w.nodes.filter((n) => n.kind === 'pocket');
    const ice = pockets.find((n) => n.prize === 'ice')!;
    const text = battleReport(w, result({ node: ice.index, outcome: 'captured', shipsEngaged: 12, shipsLost: 3, guardsKilled: 9 }));
    expect(text).toBe('Ice pocket taken: 12 sent, 3 lost. Route its ice to the Probe to unlock Plating and Flak.');
    w.stats.firstDeliveredTick.ice = 5;
    expect(battleReport(w, result({ node: ice.index, outcome: 'captured', shipsEngaged: 12, shipsLost: 3, guardsKilled: 9 }))).toBe('Ice pocket taken: 12 sent, 3 lost.');
    const crystal = pockets.find((n) => n.prize === 'crystal')!;
    expect(battleReport(w, result({ node: crystal.index, outcome: 'captured', shipsEngaged: 8, shipsLost: 0, guardsKilled: 4 }))).toContain('unlock Lens and Lancers');
  });

  it('the repelled hint names the dominant guard type and any Weak ship type that was sent', () => {
    const w = idleWorld();
    const base = result({ node: 11, outcome: 'repelled', shipsEngaged: 10, shipsLost: 10, guardsKilled: 0 });
    const hint = (guards: { thorn: number; spore: number }, sent: { drone: number; lancer: number; flak: number }): string =>
      repelHint(w, { ...base, guardsAtStart: guards, engagedByType: sent });
    expect(hint({ thorn: 1, spore: 10 }, { drone: 0, lancer: 10, flak: 0 })).toBe('Mostly Spores; Lancers are weak here.');
    expect(hint({ thorn: 10, spore: 1 }, { drone: 0, lancer: 0, flak: 10 })).toBe('Mostly Thorns; Flak is weak here.');
    expect(hint({ thorn: 8, spore: 2 }, { drone: 10, lancer: 0, flak: 0 })).toBe('Mostly Thorns.');
    expect(hint({ thorn: 8, spore: 2 }, { drone: 4, lancer: 6, flak: 0 })).toBe('Mostly Thorns.');
    expect(hint({ thorn: 5, spore: 5 }, { drone: 4, lancer: 6, flak: 0 })).toBe('An even mix of Thorns and Spores.');
  });

  it('the unlock notice names the prize, what it unlocks and the yard to turn on; regrow keeps one decimal', () => {
    expect(unlockNotice('lancer')).toBe('Crystal delivered: Lens and Lancers unlocked. Turn on the Lancer yard at the Probe. Tap here to open it.');
    expect(unlockNotice('flak')).toBe('Ice delivered: Plating and Flak unlocked. Turn on the Flak yard at the Probe. Tap here to open it.');
    expect(regrowText(60, 30)).toBe('1 / 2.0 s');
    expect(regrowText(20, 30)).toBe('1 / 0.7 s');
    expect(regrowText(300, 30)).toBe('1 / 10.0 s');
  });

  it('capture order and per-type lines for the result panel', () => {
    const caps = [
      { node: 10, id: 'p1', kind: 'pocket', prize: 'ice', tick: 7500, sec: 250 },
      { node: 13, id: 'p4', kind: 'pocket', prize: 'crystal', tick: 20700, sec: 690 },
      { node: 14, id: 'root', kind: 'root', prize: null, tick: 27060, sec: 902 },
      { node: 15, id: 'heart', kind: 'heart', prize: 'ore', tick: 35550, sec: 1185 },
    ] as const;
    expect(captureOrderText(caps)).toBe('Ice (P1) 4:10 → Crystal (P4) 11:30 → Root 15:02 → Heart 19:45');
    expect(byTypeText({ drone: 6, lancer: 0, flak: 2 })).toBe('6 Drone · 2 Flak');
    expect(byTypeText({ drone: 0, lancer: 0, flak: 0 })).toBe('0');
    expect(shipsText({ drone: 1, lancer: 2, flak: 0 })).toBe('1 Drone, 2 Lancers');
    expect(shipsText({ drone: 0, lancer: 0, flak: 0 })).toBe('none');
    expect(unlockHint('lancer')).toBe('Take a crystal pocket to unlock Lancers');
  });

  it('a pocket draws only the guard ring, so its tap reach is the ring and at least 44 px', () => {
    for (const rr of [14, 18, 30]) {
      expect(guardRingOuter(rr, 8, false)).toBe(ringGeom(rr, 8).ringR);
      expect(guardRingOuter(rr, 8, true)).toBeGreaterThan(guardRingOuter(rr, 8, false));
      expect(guardedReach(rr, 8, false)).toBeGreaterThanOrEqual(22);
    }
  });
});

/** A drone-only BattleResult with the given fields (test data). */
function result(f: Pick<BattleResult, 'node' | 'outcome' | 'shipsEngaged' | 'shipsLost' | 'guardsKilled'>): BattleResult {
  return {
    id: 1,
    startTick: 0,
    endTick: 10,
    wilt: null,
    capAtSend: null,
    guardsAtStart: { thorn: 0, spore: 0 },
    engagedByType: { drone: f.shipsEngaged, lancer: 0, flak: 0 },
    lostByType: { drone: f.shipsLost, lancer: 0, flak: 0 },
    killedByType: { thorn: f.guardsKilled, spore: 0 },
    ...f,
  };
}

function ship(w: World, node: number, n: number): void {
  for (let i = 0; i < n; i++) w.ships.push({ id: w.nextId++, type: 'drone', hp: w.tun['ship.drone.hp'], at: node, transit: null, engagedIn: -1 });
}

/** Seed 3 is Frost Gate; on the v4 fixture: Root 6 Thorns, heart 10/14, starved 6/7. Nothing happens unless a test sets it up. */
function idleWorld(): World {
  const w = h3World(3, fixtureData);
  w.stock.ore = 0;
  w.yards.drone.on = false;
  w.tun['economy.probeOrePerMin'] = 0;
  return w;
}

describe('supply readouts', () => {
  it('the Feeds the Heart box and the heart-sheet line come from live tunables', () => {
    const w = idleWorld();
    expect(feedsBloomText(w, false)).toBe(
      'While the Root lives, the Heart has 10 Thorns 14 Spores, regrows 1 / 2.0 s and 1 / 0.7 s, repairs 2. Cut it: 6 Thorns 7 Spores, 1 / 10.0 s and 1 / 3.3 s, no repair.',
    );
    expect(supplyLine(w)).toBe('Fed by the Root (cut it: 6 Thorns 7 Spores, 1 / 10.0 s)');
    w.tun['guard.capPct'] = 50;
    w.tun['bloom.starvedRepairPerRound'] = 2;
    w.tun['guard.thorn.regrowTicks'] = 30;
    expect(feedsBloomText(w, false)).toContain('regrows 1 / 1.0 s and 1 / 0.7 s, repairs 2. Cut it: 3 Thorns 3 Spores, 1 / 5.0 s and 1 / 3.3 s, repairs 2.');
    expect(supplyLine(w)).toContain('cut it: 3 Thorns 3 Spores');
    expect(feedsBloomText(w, true)).toContain('already yours');
  });

  it('cutting the Root reports the wilt and flips the heart to starved', () => {
    const w = idleWorld();
    ship(w, rootIndex(w), 20);
    for (let i = 0; i < 400 && lastBattle(w, rootIndex(w)) === null; i++) step(w, fixtureData, []);
    const r = lastBattle(w, rootIndex(w))!;
    expect(r.outcome).toBe('captured');
    expect(battleReport(w, r)).toBe(`Root cut: ${r.shipsEngaged} sent, ${r.shipsLost} lost. The Heart wilts: 10 Thorns 14 Spores → 6 Thorns 7 Spores, regrows 5× slower.`);
    expect(supplyLine(w)).toBe('Starved: Root cut');
    expect(feedsBloomText(w, false)).toContain('The Root is cut');
  });

  it('a Root held report and a Root repelled reason name the Root', () => {
    const w = idleWorld();
    const text = battleReport(w, result({ node: rootIndex(w), outcome: 'repelled', shipsEngaged: 10, shipsLost: 10, guardsKilled: 2 }));
    expect(text).toContain('Root held: 10 sent, 10 lost.');
    expect(text).toContain('Root regrows');
  });

  it('the banner has one prefixed line per running battle, with the guard mix', () => {
    const w = idleWorld();
    expect(bannerLines(w)).toEqual([]);
    ship(w, rootIndex(w), 3);
    ship(w, 15, 20);
    for (let i = 0; i < 31 && bannerLines(w).length < 2; i++) step(w, fixtureData, []);
    const lines = bannerLines(w);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^ROOT · \d+ Thorn 0 Spore · strip /);
    expect(lines[1]).toMatch(/^HEART · \d+ Thorn \d+ Spore · strip \d+(\.\d)?\/s · \d+ lost$/);
  });

  it('regrowChange follows bloom.starvedRegrowMul', () => {
    const w = idleWorld();
    w.tun['bloom.starvedRegrowMul'] = 1;
    expect(regrowChange(w)).toBe('regrows at the same speed');
    w.tun['bloom.starvedRegrowMul'] = 2;
    expect(regrowChange(w)).toBe('regrows 2× slower');
    w.tun['bloom.starvedRegrowMul'] = 5;
    expect(regrowChange(w)).toBe('regrows 5× slower');
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
