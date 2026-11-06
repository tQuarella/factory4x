/**
 * Von Neumann Probe client (H1): fixed-step sim, interpolated Canvas 2D map,
 * node sheets, HUD, tuning, feedback and autosave. See DESIGN.md H1.
 */
import './style.css';
import {
  battleStatus,
  defaultData,
  isCaptured,
  lastBattle,
  replayHashes,
  shipCounts,
  shipsPerMinX10,
  throughputPerMin,
  worldHash,
  type Input,
} from '@factory4x/sim';
import { setHidden, setText, toggleClass } from './dom.ts';
import { fmt10, shortVersion } from './format.ts';
import { FeedbackPanel, TuningPanel, showResult, type PanelHost } from './panels.ts';
import { loadSave, loadSettings, saveSettings, writeSave } from './persist.ts';
import { battleReport } from './report.ts';
import { Session, dataWithDefaults, replayData, type Speed } from './session.ts';
import { Sheet } from './sheet.ts';
import { MapView } from './view.ts';


const data = defaultData;
const fullVersion = __BUILD_VERSION__;
const settings = loadSettings(data);
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

const newSeed = (): number => Date.now() % 2147483647;

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
  close: () => closeSheet(),
});

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

/** New run keeps the live tuning: the world is built from default data with the current tuned values as its defaults (so startStock and guardian.cap apply). See DECISIONS.md. */
function newRun(): void {
  app.session = new Session(dataWithDefaults(data, app.session.world.tun), { seed: newSeed() });
  sheet.close();
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
$('hint').hidden = settings.hintDismissed;

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
const el = {
  thr: $('thr'),
  arrow: $('thr-arrow'),
  stock: $('stock'),
  ships: $('ships'),
  rate: $('ships-rate'),
  pause: $('b-pause'),
  paused: $('paused'),
  banner: $('banner'),
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
  setText(el.stock, String(w.stock));
  setText(el.ships, String(w.ships.length));
  setText(el.rate, `${fmt10(shipsPerMinX10(w))}/min`);
  setText(el.pause, s.paused ? 'Play' : 'Pause');
  toggleClass(el.pause, 'on', s.paused);
  setHidden(el.paused, !s.paused);
  for (const b of document.querySelectorAll<HTMLElement>('.speed')) toggleClass(b, 'on', Number(b.dataset.speed) === s.speed);

  const b = battleStatus(w);
  setHidden(el.banner, !b && !forceBanner);
  if (!b && forceBanner) setText(el.banner, 'BATTLE · strip 0.8/s · regrow 0.5/s · 6 lost');
  if (b) setText(el.banner, `BATTLE · strip ${fmt10(b.killPerSecX10)}/s · regrow ${fmt10(b.regrowPerSecX10)}/s · ${b.shipsLost} lost`);

  const lb = lastBattle(w);
  if (lb && lb.endTick !== s.flags.seenBattleEnd) {
    s.flags.seenBattleEnd = lb.endTick;
    toast.show(battleReport(w, lb));
  }
  if (isCaptured(w) && !s.flags.resultShown) {
    s.flags.resultShown = true;
    if (settings.showResult) {
      showResult($('result'), s, () => undefined, newRun);
    }
  }
  sheet.update();
  tuning.update();
}

el.banner.addEventListener('click', () => {
  const rich = app.session.world.nodes.findIndex((n) => n.kind === 'rich');
  if (rich >= 0) sheet.open(rich);
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
  stock: () => app.session.world.stock,
  paused: () => app.session.paused,
  inputCount: () => app.session.log.length,
  shipsAt: (node) => shipCounts(app.session.world).at[node] ?? 0,
  wavesSent: () => app.session.world.stats.wavesSent,
  saveNow,
  replayMatchesLive: () => {
    const s = app.session;
    if (s.world.tick === 0) return true;
    const r = s.replay();
    return replayHashes(r, replayData(r), s.world.tick, s.world.tick)[0] === worldHash(s.world);
  },
  debugShowNotices: (on) => {
    forceBanner = on;
    if (on) toast.show('Wave repelled: 18 sent, 18 lost, 5 thorns stripped\nRegrowth outpaced the wave. 18 ships strip 1.2 thorns/s; the Bloom regrows 0.5/s.');
    else toast.hide();
    refreshUi();
  },
  debugShowResult: () => showResult($('result'), app.session, () => undefined, newRun),
  newRun,
};
