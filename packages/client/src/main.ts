/**
 * Von Neumann Probe client (H1): fixed-step sim, interpolated Canvas 2D map,
 * node sheets, HUD, tuning, feedback and autosave. See DESIGN.md H1.
 */
import './style.css';
import {
  activeBattles,
  defaultData,
  isCaptured,
  rootIndex,
  systemStatus,
  type BattleResult,
  replayHashes,
  shipCounts,
  shipsAtByType,
  throughputPerMin,
  worldHash,
  type Input,
} from '@factory4x/sim';
import { h, setHidden, setText, toggleClass } from './dom.ts';
import { shortVersion } from './format.ts';
import { Hud } from './hud.ts';
import { FeedbackPanel, TuningPanel, showResult, type PanelHost } from './panels.ts';
import { loadSave, loadSettings, saveSettings, writeSave } from './persist.ts';
import { bannerLines, battleReport } from './report.ts';
import { SendPanel } from './sendpanel.ts';
import { Session, dataWithDefaults, replayData, type Speed } from './session.ts';
import { Sheet } from './sheet.ts';
import { MapView } from './view.ts';


const data = defaultData;
const fullVersion = __BUILD_VERSION__;
const settings = loadSettings(data);
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

const newSeed = (): number => Date.now() % 2147483647;
/** The seed of the run after `seed`: consecutive runs are consecutive systems. */
const nextSeed = (seed: number): number => seed + 1;

// --- session: resume silently, or start fresh ------------------------------
const app: { session: Session } = { session: new Session(data, { seed: newSeed() }) };
let startToast = '';
{
  const out = loadSave(data);
  if (out.kind === 'resumed') app.session = out.session;
  else if (out.kind === 'discarded') {
    startToast =
      out.reason === 'dataVersion'
        ? `Your saved game used older game data (v${out.saveDataVersion ?? '?'}; this build is v${data.dataVersion}), so it was discarded and a new run started.`
        : 'Your saved game could not be read, so a new run started.';
  }
}

// --- map, sheet ---------------------------------------------------------------
const canvas = $<HTMLCanvasElement>('view');
const view = new MapView(canvas, app);
const sheet = new Sheet($('sheet'), {
  get session() {
    return app.session;
  },
  send,
  sendAll,
  choose: (from, to) => sendPanel.open(from, to),
  close: () => closeSheet(),
});
const sendPanel = new SendPanel($('sendpanel'), { world: () => app.session.world, sendAll });

function send(input: Input): void {
  sendAll([input]);
}

/** All inputs of one press, applied in the same tick even while paused. */
function sendAll(inputs: readonly Input[]): void {
  app.session.sendAll(inputs);
  if (inputs.some((i) => i.type === 'buildExtractor') && !settings.hintDismissed) dismissHint();
  refreshUi();
}

function closeSheet(): void {
  sheet.close();
}

new ResizeObserver(() => view.resize()).observe($('stage'));
window.addEventListener('resize', () => view.resize());

canvas.addEventListener('click', (ev) => {
  const r = canvas.getBoundingClientRect();
  const node = view.hitTest(ev.clientX - r.left, ev.clientY - r.top);
  if (node === null) closeSheet();
  else sheet.open(node);
});

// --- panels ---------------------------------------------------------------------
const panelHost: PanelHost = {
  app,
  data,
  settings,
  fullVersion,
  send,
  sendAll,
  settingsChanged: () => saveSettings(settings),
  newRun,
};
const tuning = new TuningPanel($('tuning'), panelHost);
const feedback = new FeedbackPanel($('feedback'), panelHost);

/**
 * New run keeps the live tuning: the world is built from default data with the current tuned values as its defaults (so startStock, guardian.cap and
 * system.variant apply). Its seed is the old one plus one, so consecutive runs cycle through the three Roots. See DECISIONS.md.
 */
function newRun(): void {
  app.session = new Session(dataWithDefaults(data, app.session.world.tun), { seed: nextSeed(app.session.seed) });
  sheet.close();
  sendPanel.close();
  toast.hide();
  writeSave(app.session);
  refreshUi();
}

// --- toast (battle reports, notices); stays until tapped ----------------------------
const toastEl = $('toast');
const toast = {
  show(text: string): void {
    toastEl.textContent = text;
    toastEl.hidden = false;
  },
  hide(): void {
    toastEl.hidden = true;
  },
};
toastEl.addEventListener('click', () => toast.hide());
toastEl.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    toast.hide();
  }
});
if (startToast) toast.show(startToast);

// --- hint ---------------------------------------------------------------------------
function dismissHint(): void {
  settings.hintDismissed = true;
  saveSettings(settings);
  $('hint').hidden = true;
}
$('hint-x').addEventListener('click', dismissHint);

// --- time controls (client only) -------------------------------------------------------
$('b-pause').addEventListener('click', () => {
  app.session.paused = !app.session.paused;
  refreshUi();
});
for (const b of document.querySelectorAll<HTMLElement>('.speed')) {
  b.addEventListener('click', () => {
    app.session.speed = Number(b.dataset.speed) as Speed;
    refreshUi();
  });
}
$('b-tune').addEventListener('click', () => (tuning.isOpen ? tuning.close() : tuning.open()));
$('b-note').addEventListener('click', () => feedback.open());

// --- HUD ----------------------------------------------------------------------------------
$('version').textContent = shortVersion(fullVersion);
const hud = new Hud($('chips'));
const el = {
  thr: $('thr'),
  arrow: $('thr-arrow'),
  pause: $('b-pause'),
  paused: $('paused'),
  banner: $('banner'),
  hint: $('hint'),
};

let forceBanner = false;

function refreshUi(): void {
  const s = app.session;
  const w = s.world;
  const thr = throughputPerMin(w);
  setText(el.thr, String(thr));
  const before = s.history.length > 10 ? s.history[s.history.length - 11]! : thr;
  const dir = thr > before ? 'up' : thr < before ? 'down' : '';
  setText(el.arrow, dir === 'up' ? '▲' : dir === 'down' ? '▼' : '');
  toggleClass(el.arrow, 'up', dir === 'up');
  toggleClass(el.arrow, 'down', dir === 'down');
  hud.update(w);
  setText(el.pause, s.paused ? 'Play' : 'Pause');
  toggleClass(el.pause, 'on', s.paused);
  setHidden(el.paused, !s.paused);
  for (const b of document.querySelectorAll<HTMLElement>('.speed')) toggleClass(b, 'on', Number(b.dataset.speed) === s.speed);

  const lines = bannerLines(w);
  const showBanner = lines.length > 0 || forceBanner;
  setHidden(el.banner, !showBanner);
  if (lines.length === 0 && forceBanner) lines.push('HEART · 10 Thorn 14 Spore · strip 0.8/s · 6 lost', 'ROOT · 6 Thorn 4 Spore · strip 0.8/s · 2 lost');
  if (showBanner && el.banner.dataset.text !== lines.join('|')) {
    el.banner.dataset.text = lines.join('|');
    el.banner.replaceChildren(...lines.map((l) => h('div', 'bline', l)));
  }

  // Battle reports: every battle that ended since the last look, at any guarded node, oldest first.
  const ended: BattleResult[] = [];
  for (const g of w.guardians) if (g.lastBattle && g.lastBattle.endTick > s.flags.seenBattleEnd) ended.push(g.lastBattle);
  if (ended.length > 0) {
    ended.sort((a, b) => a.endTick - b.endTick || a.node - b.node);
    s.flags.seenBattleEnd = ended[ended.length - 1]!.endTick;
    toast.show(ended.map((r) => battleReport(w, r)).join('\n\n'));
  }
  // The first-run hint gives way to battle notices, so the strip keeps room for them.
  setHidden(el.hint, settings.hintDismissed || showBanner || !toastEl.hidden);
  if (isCaptured(w) && !s.flags.resultShown) {
    s.flags.resultShown = true;
    if (settings.showResult) {
      showResult($('result'), s, () => undefined, newRun);
    }
  }
  sheet.update();
  sendPanel.update();
  tuning.update();
}

el.banner.addEventListener('click', () => {
  const first = activeBattles(app.session.world)[0];
  const node = first ? first.node : app.session.world.nodes.findIndex((n) => n.kind === 'heart');
  if (node >= 0) sheet.open(node);
});

// --- autosave: every client.autosaveSec of wall time, and when the page is hidden -----------
function saveNow(): boolean {
  return writeSave(app.session);
}
function scheduleAutosave(): void {
  window.setTimeout(() => {
    saveNow();
    scheduleAutosave();
  }, settings.autosaveSec * 1000);
}
scheduleAutosave();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow();
});
window.addEventListener('pagehide', saveNow);

// --- main loop ------------------------------------------------------------------------------------
let last = performance.now();
let uiAcc = 0;
function frame(now: number): void {
  const dt = now - last;
  last = now;
  app.session.advance(dt);
  view.draw(now, sheet.selected);
  uiAcc += dt;
  if (uiAcc >= 100) {
    uiAcc = 0;
    refreshUi();
  }
  requestAnimationFrame(frame);
}
view.resize();
refreshUi();
requestAnimationFrame(frame);


window.__factory4x = {
  version: fullVersion,
  tick: () => app.session.world.tick,
  replayHashes: (ticks, every, replay) => replayHashes(replay, data, ticks, every),
  nodeScreenPos: (i) => {
    const r = canvas.getBoundingClientRect();
    const p = view.nodePos(i);
    return { x: r.left + p.x, y: r.top + p.y };
  },
  selected: () => sheet.selected,
  pendingBuilds: () => app.session.world.queue.length + (app.session.world.activeBuild ? 1 : 0),
  stock: () => app.session.world.stock.ore,
  paused: () => app.session.paused,
  inputCount: () => app.session.log.length,
  shipsAt: (node) => shipCounts(app.session.world).at[node] ?? 0,
  wavesSent: () => app.session.world.stats.wavesSent,
  shipsAtByType: (node) => ({ ...shipsAtByType(app.session.world, node) }),
  pocketNode: (prize) => app.session.world.nodes.find((n) => n.kind === 'pocket' && n.prize === prize)?.index ?? -1,
  owned: (node) => app.session.world.nodes[node]!.owned,
  lastInput: () => JSON.stringify(app.session.log[app.session.log.length - 1]?.input ?? null),
  saveNow,
  replayMatchesLive: () => {
    const s = app.session;
    if (s.world.tick === 0) return true;
    const r = s.replay();
    return replayHashes(r, replayData(r), s.world.tick, s.world.tick)[0] === worldHash(s.world);
  },
  debugShowNotices: (on) => {
    forceBanner = on;
    if (on) toast.show('Root cut: 15 sent, 3 lost. The Heart wilts: 10 Thorns 14 Spores → 6 Thorns 7 Spores, regrows 5× slower.\n\nP4 held: 10 sent, 10 lost, 2 guards stripped\nRegrowth outpaced the wave. 10 ships strip 0.6 guards/s; P4 regrows 1/s.');
    else toast.hide();
    refreshUi();
  },
  debugShowResult: () => showResult($('result'), app.session, () => undefined, newRun),
  systemName: () => systemStatus(app.session.world).name,
  rootNode: () => rootIndex(app.session.world),
  newRun,
};
