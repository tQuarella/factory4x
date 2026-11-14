/**
 * Von Neumann Probe client (H7): fixed-step sim, interpolated Canvas 2D map, node sheets (the probe's allocation and the rocks'
 * Mine marks), HUD, tuning, feedback and autosave. Shipped data runs in field mode: one field, no overworld. The H4 to H6 overworld
 * and its sheets stay in the code for the parked campaign (a test or dev hook starts one). See DESIGN.md H1 to H7.
 */
import './style.css';
import {
  activeBattles,
  allocStatus,
  areaStatus,
  campaignStatus,
  fieldSummary,
  fleetStatus,
  defaultData,
  isCaptured,
  isField,
  isReclaimed,
  isWon,
  landingEffects,
  replayHashes,
  RESOURCES,
  SHIP_TYPES,
  rockStatus,
  rootIndex,
  shipCounts,
  shipsAtByType,
  systemStatus,
  throughputPerMin,
  unlockStatus,
  withRunMode,
  worldHash,
  yardStatus,
  type BattleResult,
  type CampaignStart,
  type Input,
  type SimData,
  type World,
} from '@factory4x/sim';
import { h, setHidden, setText, toggleClass } from './dom.ts';
import { shortVersion } from './format.ts';
import { Hud, OverworldHud } from './hud.ts';
import { FeedbackPanel, TuningPanel, confirmModal, showAreaResult, showFieldResult, showWin, type PanelHost } from './panels.ts';
import { FIELD_HINT, fieldFleetFullNotice, fieldUnlockNotice } from './fieldreport.ts';
import { loadSave, loadSettings, saveSettings, writeSave } from './persist.ts';
import {
  bannerLines,
  battleReport,
  fleetFullNotice,
  landingNotice,
  openedByReclaim,
  reclaimNotice,
  shippedNotice,
  stepMoment,
  stepNotice,
  unlockNotice,
  withdrawNotice,
} from './report.ts';
import { RecyclePanel } from './recyclepanel.ts';
import { SendPanel } from './sendpanel.ts';
import { Session, dataWithDefaults, replayData, type Speed } from './session.ts';
import { Sheet } from './sheet.ts';
import { MapView } from './view.ts';
import { AreaSheet, ResearchSheet } from './worldsheets.ts';
import { WorldView } from './worldview.ts';

/** The shipped data: field mode (H7). A session may hold other data (the parked campaign, from a test hook), so screens read `app.session.data`. */
const data = defaultData;
const fullVersion = __BUILD_VERSION__;
const settings = loadSettings(data);
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

/** The data of the session on screen. */
function sd(): SimData {
  return app.session.data;
}

const newSeed = (): number => Date.now() % 2147483647;
/** The seed of the system after `seed`: consecutive systems are consecutive Deep layouts. */
const nextSeed = (seed: number): number => seed + 1;

// --- session: resume silently, or start fresh on the overworld ---------------
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

// --- map, sheets ---------------------------------------------------------------
const canvas = $<HTMLCanvasElement>('view');
const view = new MapView(canvas, app);
const worldView = new WorldView(canvas, app);
const sheet = new Sheet($('sheet'), {
  get session() {
    return app.session;
  },
  send,
  sendAll,
  choose: (from, to) => sendPanel.open(from, to),
  recycle: (node) => recyclePanel.open(node),
  close: () => closeSheet(),
});
const sendPanel = new SendPanel($('sendpanel'), { world: () => app.session.world, sendAll });
const recyclePanel = new RecyclePanel($('recyclepanel'), { world: () => app.session.world, sendAll, notice: (text: string) => toast.show(text) });
const worldHost = {
  get session() {
    return app.session;
  },
  send,
  land,
  notice: (text: string) => toast.show(text),
  close: () => closeWorldSheets(),
};
const areaSheet = new AreaSheet($('sheet'), worldHost);
const researchSheet = new ResearchSheet($('research'), worldHost);

function send(input: Input): void {
  sendAll([input]);
}

/** All inputs of one press, applied in the same tick even while paused (and on the overworld). */
function sendAll(inputs: readonly Input[]): void {
  app.session.sendAll(inputs);
  if (inputs.some((i) => i.type === 'buildExtractor' || i.type === 'setAlloc' || i.type === 'setMine') && !settings.hintDismissed) dismissHint();
  refreshUi();
}

function closeSheet(): void {
  sheet.close();
}

function closeWorldSheets(): void {
  areaSheet.close();
  researchSheet.close();
}

/** Land in an area (the area sheet's Land button). */
function land(area: number): void {
  settings.worldHintDismissed = true;
  saveSettings(settings);
  app.session.paused = false;
  sendAll([{ type: 'enterArea', area }]);
}

function resizeViews(): void {
  if (app.session.world.nodes.length > 0) view.resize();
  worldView.resize();
}
new ResizeObserver(() => resizeViews()).observe($('stage'));
window.addEventListener('resize', () => resizeViews());

canvas.addEventListener('click', (ev) => {
  // A tap must land on the screen the sim is on now, after its transition (sheets closed, map re-fitted).
  if (transitionPending()) refreshUi();
  const r = canvas.getBoundingClientRect();
  const x = ev.clientX - r.left;
  const y = ev.clientY - r.top;
  if (app.session.onOverworld) {
    // The click that ends a drag is not a tap; a tap during the step moment skips it (and does nothing else).
    if (worldView.consumeDrag()) return;
    if (worldView.stepActive) {
      worldView.skipStep();
      return;
    }
    const a = worldView.hitTest(x, y);
    researchSheet.close();
    if (a === null) areaSheet.close();
    else {
      areaSheet.open(a);
      // The sheet may overlay the bottom of the map: pan the least that keeps this area clear of it. The pan reaches further under it,
      // so the other areas stay reachable by dragging while it is open.
      worldView.cover = sheetCover();
      worldView.reveal(a);
    }
    return;
  }
  const node = view.hitTest(x, y);
  if (node === null) closeSheet();
  else {
    sheet.open(node);
    // H7: the hint says to tap the probe; once its sheet is up the hint has done its job and its room goes back to the map.
    if (isField(app.session.world) && node === 0 && !settings.hintDismissed) dismissHint();
  }
});

// --- panels ---------------------------------------------------------------------
const panelHost: PanelHost = {
  app,
  get data() {
    return app.session.data;
  },
  settings,
  fullVersion,
  send,
  sendAll,
  settingsChanged: () => saveSettings(settings),
  newSystem,
};
const tuning = new TuningPanel($('tuning'), panelHost);
const feedback = new FeedbackPanel($('feedback'), panelHost);

/** Replaces the session and every screen's state with a fresh one. */
function adopt(session: Session): void {
  app.session = session;
  sheet.close();
  closeWorldSheets();
  sendPanel.close();
  recyclePanel.close();
  toast.hide();
  $('result').hidden = true;
  $('win').hidden = true;
  tuning.update();
  writeSave(app.session);
  resizeViews();
  refreshUi();
}

/**
 * New system keeps the live tuning: the world is built from default data with the current tuned values as its defaults (so startStock,
 * guard.capPct and system.variant apply). Its seed is the old one plus one, so consecutive systems cycle through The Deep's layouts. See DECISIONS.md.
 */
function newSystem(): void {
  adopt(new Session(dataWithDefaults(app.session.data, app.session.world.tun), { seed: nextSeed(app.session.seed) }));
}

// --- toast (battle reports, notices); stays until tapped ----------------------------
const toastEl = $('toast');
let toastAction: (() => void) | null = null;
const toast = {
  show(text: string, action: (() => void) | null = null): void {
    toastEl.textContent = text;
    toastEl.hidden = false;
    toastAction = action;
  },
  hide(): void {
    toastEl.hidden = true;
    toastAction = null;
  },
};
toastEl.addEventListener('click', () => {
  const act = toastAction;
  toast.hide();
  act?.();
});
toastEl.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    toast.hide();
  }
});
if (startToast) toast.show(startToast);

// --- hint ---------------------------------------------------------------------------
function dismissHint(): void {
  if (app.session.onOverworld) settings.worldHintDismissed = true;
  else settings.hintDismissed = true;
  saveSettings(settings);
  $('hint').hidden = true;
}
$('hint-x').addEventListener('click', dismissHint);

// --- time controls (client only), the overworld button, research ------------------------
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
$('b-research').addEventListener('click', () => {
  if (researchSheet.isOpen) researchSheet.close();
  else {
    areaSheet.close();
    researchSheet.open();
  }
});
/** In a held area the Overworld button asks first (a withdraw loses the area); in a reclaimed one it goes straight back. */
$('b-world').addEventListener('click', () => {
  const w = app.session.world;
  const a = w.campaign.active;
  if (a === null) return;
  if (isReclaimed(w, a)) {
    send({ type: 'leaveArea' });
    return;
  }
  const name = sd().map.areas[a]!.name;
  void confirmModal(
    `Withdraw from ${name}? Everything built here is lost and the area resets. Research and the stockpile are kept.`,
    'Withdraw',
    'Stay',
  ).then((yes) => {
    if (yes) send({ type: 'leaveArea' });
  });
});

// --- HUD ----------------------------------------------------------------------------------
$('version').textContent = shortVersion(fullVersion);
const hud = new Hud($('chips'));
const owHud = new OverworldHud($('ow-stats'));
const el = {
  app: $('app'),
  thr: $('thr'),
  arrow: $('thr-arrow'),
  pause: $('b-pause'),
  paused: $('paused'),
  banner: $('banner'),
  hint: $('hint'),
  hintText: $('hint-text'),
};

let forceBanner = false;
/** Unlocked ship types as of the last look, per area visit, so a resumed run doesn't announce old unlocks. */
const unlockSeen: { world: unknown; ships: Record<string, boolean> } = { world: null, ships: {} };
/** Whether the "fleet full" notice has been shown in this area visit (reset at each landing and on a new session). */
const fleetSeen: { world: unknown; shown: boolean } = { world: null, shown: false };
/** Which screen the last refresh showed, per world, so only a change inside one session raises a landing or return notice. */
const modeSeen: { world: unknown; active: number | null } = { world: null, active: null };

/** How many step moments have started in this page (a test hook: the step is over in 1.5 s). */
let stepsStarted = 0;

/** Raises the landing, return, withdraw or reclaim notice when the screen changed since the last look. */
function modeTransition(): void {
  const s = app.session;
  const w = s.world;
  const active = w.campaign.active;
  // H7: a field run has no landing and no overworld, so only a new session needs resetting.
  if (isField(w)) {
    if (modeSeen.world !== w) {
      modeSeen.world = w;
      modeSeen.active = null;
      unlockSeen.world = null;
      closeWorldSheets();
      resizeViews();
    }
    return;
  }
  if (modeSeen.world !== w) {
    modeSeen.world = w;
    modeSeen.active = active;
    unlockSeen.world = null;
    if (active === null) {
      closeWorldSheets();
      // A new or resumed session opens centred on the area last reclaimed, else on the start.
      const order = w.campaign.reclaimOrder;
      worldView.focus(order.length > 0 ? order[order.length - 1]! : Math.max(0, sd().map.areas.findIndex((a) => a.tier === 0)));
    }
    return;
  }
  if (modeSeen.active === active) return;
  const prev = modeSeen.active;
  modeSeen.active = active;
  sheet.close();
  sendPanel.close();
  recyclePanel.close();
  closeWorldSheets();
  $('result').hidden = true;
  unlockSeen.world = null;
  fleetSeen.world = null;
  resizeViews();
  if (active !== null) {
    // Landing: name every research effect in play.
    s.flags.resultShown = false;
    s.flags.shippedAtLanding = { ...w.campaign.totals.shipped };
    toast.show(landingNotice(sd().map.areas[active]!.name, landingEffects(w, sd())));
    return;
  }
  if (prev === null) return;
  // Back on the overworld: what the visit did.
  const name = sd().map.areas[prev]!.name;
  const base = s.flags.shippedAtLanding;
  const now = w.campaign.totals.shipped;
  const shipped = base === null ? '' : shippedNotice(name, { ore: now.ore - base.ore, ice: now.ice - base.ice, crystal: now.crystal - base.crystal });
  s.flags.shippedAtLanding = null;
  const head = isReclaimed(w, prev)
    ? reclaimNotice(name, areaStatus(w, sd(), prev).haulNow, openedByReclaim(w, sd(), prev))
    : withdrawNotice(name);
  // H6 step moment: the first relay of a band raises the limit and opens the next band, once per band.
  const step = isReclaimed(w, prev) ? stepMoment(w, sd(), prev) : null;
  const first = step !== null && !s.flags.stepsShown.includes(step.band);
  const lead = first ? `${stepNotice(step)}\n\n${head}` : head;
  toast.show(shipped === '' ? lead : `${lead}\n\n${shipped}`);
  // Centre the view on the area just left, after the notice has settled the canvas height; then play the step moment.
  resizeViews();
  worldView.focus(prev);
  if (first) {
    s.flags.stepsShown.push(step.band);
    if (step.opens !== null) {
      stepsStarted++;
      worldView.startStep(step.opens);
    }
  }
}

/**
 * True when the sim changed screen state since the last refresh: another session, a landing or a leave
 * (campaign.active), or a heart capture whose result panel hasn't been shown. The frame loop and the tap
 * handler run refreshUi() at once when this holds, instead of waiting for the 100 ms UI cadence: a tap in that
 * gap used to open a sheet the late transition then closed (h4-client round 2).
 */
function transitionPending(): boolean {
  const s = app.session;
  const w = s.world;
  if (modeSeen.world !== w || modeSeen.active !== w.campaign.active) return true;
  if (isField(w)) return isCaptured(w) && !s.flags.resultShown;
  return !s.onOverworld && isCaptured(w) && !s.flags.resultShown;
}

/** Dev hook state: a copy of the world with chosen counts, shown by the in-area HUD instead of the live one (hud-stability.spec.ts). */
let hudOverride: World | null = null;

function refreshUi(): void {
  // The mode is set first, so a re-fit inside modeTransition measures the layout of the screen it is about to show.
  el.app.dataset.mode = app.session.onOverworld ? 'world' : 'area';
  el.app.dataset.run = isField(app.session.world) ? 'field' : 'campaign';
  modeTransition();
  const s = app.session;
  const w = s.world;
  const onWorld = s.onOverworld;
  const field = isField(w);
  const won = isWon(w) && !field;
  if (onWorld) {
    owHud.update(w, sd());
    researchSheet.update();
    areaSheet.update();
  } else {
    const thr = throughputPerMin(hudOverride ?? w);
    setText(el.thr, String(thr));
    const before = s.history.length > 10 ? s.history[s.history.length - 11]! : thr;
    const dir = thr > before ? 'up' : thr < before ? 'down' : '';
    setText(el.arrow, dir === 'up' ? '▲' : dir === 'down' ? '▼' : '');
    toggleClass(el.arrow, 'up', dir === 'up');
    toggleClass(el.arrow, 'down', dir === 'down');
    hud.update(hudOverride ?? w, sd());
    el.pause.setAttribute('aria-label', s.paused ? 'Play' : 'Pause');
    toggleClass(el.pause, 'on', s.paused);
    for (const b of document.querySelectorAll<HTMLElement>('.speed')) toggleClass(b, 'on', Number(b.dataset.speed) === s.speed);
  }
  setHidden(el.paused, onWorld || !s.paused);

  const lines = onWorld ? [] : bannerLines(w);
  const showBanner = lines.length > 0 || forceBanner;
  setHidden(el.banner, !showBanner);
  if (lines.length === 0 && forceBanner) lines.push('HEART · 10 Thorn 14 Spore · strip 0.8/s · 6 lost', 'P4 · 6 Thorn 4 Spore · strip 0.8/s · 2 lost');
  if (showBanner && el.banner.dataset.text !== lines.join('|')) {
    el.banner.dataset.text = lines.join('|');
    el.banner.replaceChildren(...lines.map((l) => h('div', 'bline', l)));
  }

  if (!onWorld) {
    // Battle reports: every battle that ended since the last look, at any guarded node, oldest first.
    const ended: BattleResult[] = [];
    for (const g of w.guardians) if (g.lastBattle && g.lastBattle.endTick > s.flags.seenBattleEnd) ended.push(g.lastBattle);
    if (ended.length > 0) {
      ended.sort((a, b) => a.endTick - b.endTick || a.node - b.node);
      s.flags.seenBattleEnd = ended[ended.length - 1]!.endTick;
      toast.show(ended.map((r) => battleReport(w, r, sd())).join('\n\n'));
    }
    // The first delivery that unlocks Lancers or Flak: say what their yard is doing; one tap opens the Probe.
    if (unlockSeen.world !== w) {
      unlockSeen.world = w;
      unlockSeen.ships = { ...unlockStatus(w).ships };
    }
    const fresh = (['lancer', 'flak'] as const).filter((t) => unlockStatus(w).ships[t] && !unlockSeen.ships[t]);
    if (fresh.length > 0) {
      for (const t of fresh) unlockSeen.ships[t] = true;
      const text = fresh
        .map((t) => {
          if (field) return fieldUnlockNotice(t);
          const row = yardStatus(w, sd()).yards.find((y) => y.type === t)!;
          return unlockNotice(t, !row.researched ? 'needsDesign' : row.on ? 'on' : 'off');
        })
        .join('\n\n');
      toast.show(toastEl.hidden ? text : `${toastEl.textContent}\n\n${text}`, () => sheet.open(0));
    }
    // H5: the first time the fleet fills in a visit, say why the yards stopped and what to do. A resumed, already full fleet isn't announced again.
    const fleet = fleetStatus(w, sd());
    if (fleetSeen.world !== w) {
      fleetSeen.world = w;
      fleetSeen.shown = fleet.full;
    }
    if (fleet.full && !fleetSeen.shown && fleet.cap !== null) {
      fleetSeen.shown = true;
      const text = field ? fieldFleetFullNotice(fleet.count, fleet.cap, fleet.countsEconomy) : fleetFullNotice(fleet.count, fleet.cap);
      toast.show(toastEl.hidden ? text : `${toastEl.textContent}\n\n${text}`);
    }
  }
  // The first-run hints give way to notices, so the strip keeps room for them.
  const hintDone = onWorld ? settings.worldHintDismissed : settings.hintDismissed;
  setText(el.hintText, onWorld ? 'Your probe has arrived. Tap Landfall, then Land.' : field ? FIELD_HINT : 'Tap an asteroid to build an extractor');
  setHidden(el.hint, hintDone || showBanner || !toastEl.hidden || (onWorld && w.campaign.reclaimOrder.length > 0));

  if (!onWorld && isCaptured(w) && !s.flags.resultShown) {
    s.flags.resultShown = true;
    if (settings.showResult) {
      if (field) showFieldResult($('result'), s, newSystem, () => undefined);
      else showAreaResult($('result'), s, () => send({ type: 'leaveArea' }), () => undefined);
    }
  }
  if (won) {
    researchSheet.close();
    areaSheet.close();
    if ($('win').hidden) showWin($('win'), s, newSystem);
  }
  if (!onWorld) {
    sheet.update();
    sendPanel.update();
    recyclePanel.update();
  }
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

/** Px of the canvas's bottom that the area sheet covers (portrait: the sheet is an overlay), so the map can pan the selected area clear of it. */
function sheetCover(): number {
  const el = $('sheet');
  if (el.hidden || !el.classList.contains('world')) return 0;
  const s = el.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();
  if (s.left >= c.right - 1 || s.right <= c.left + 1) return 0;
  return Math.max(0, c.bottom - s.top);
}

// --- main loop ------------------------------------------------------------------------------------
let last = performance.now();
let uiAcc = 0;
function frame(now: number): void {
  const dt = now - last;
  last = now;
  app.session.advance(dt);
  uiAcc += dt;
  // Inputs applied in advance() (a running withdraw, a heart falling) change the screen now, before this frame draws.
  if (uiAcc >= 100 || transitionPending()) {
    uiAcc = 0;
    refreshUi();
  }
  if (app.session.onOverworld) {
    worldView.cover = sheetCover();
    worldView.draw(now, areaSheet.selected);
  }
  else view.draw(now, sheet.selected);
  requestAnimationFrame(frame);
}
resizeViews();
refreshUi();
requestAnimationFrame(frame);

/** Test and dev hook: replaces the session with a constructed campaign (the start is part of the replay). */
function startCampaign(start: CampaignStart, tunables: Record<string, number> = {}): void {
  const s = app.session;
  // H7: the parked campaign: the same shipped data in campaign mode, so every H4 to H6 screen and rule runs as it did.
  adopt(new Session(dataWithDefaults(withRunMode(data, 'campaign'), { ...s.world.tun, ...tunables }), { seed: s.seed, start }));
  // A constructed landing gets the landing notice a real one would.
  const w = app.session.world;
  if (w.campaign.active !== null) toast.show(landingNotice(sd().map.areas[w.campaign.active]!.name, landingEffects(w, sd())));
}

window.__factory4x = {
  version: fullVersion,
  tick: () => app.session.world.tick,
  replayHashes: (ticks, every, replay) => replayHashes(replay, replayData(replay), ticks, every),
  nodeScreenPos: (i) => {
    const r = canvas.getBoundingClientRect();
    const p = view.nodePos(i);
    return { x: r.left + p.x, y: r.top + p.y };
  },
  areaScreenPos: (a) => {
    const r = canvas.getBoundingClientRect();
    const p = worldView.areaPos(a);
    return { x: r.left + p.x, y: r.top + p.y };
  },
  areaRadius: () => worldView.nodeR,
  bandRects: () => {
    const r = canvas.getBoundingClientRect();
    return worldView.bandRects().map((b) => ({ ...b, x: r.left + b.x, y: r.top + b.y }));
  },
  areaLabelRects: () => {
    const r = canvas.getBoundingClientRect();
    return worldView.labelRects().map((b) => (b === null ? null : { x: r.left + b.x, y: r.top + b.y, w: b.w, h: b.h }));
  },
  overworldScroll: () => ({ ...worldView.scroll, max: worldView.scrollLimits }),
  centerOnArea: (a) => worldView.focus(a),
  stepActive: () => worldView.stepActive,
  stepsStarted: () => stepsStarted,
  skipStep: () => worldView.skipStep(),
  selected: () => sheet.selected,
  selectedArea: () => areaSheet.selected,
  onOverworld: () => app.session.onOverworld,
  activeArea: () => app.session.world.campaign.active,
  campaign: () => JSON.stringify(campaignStatus(app.session.world, sd())),
  pendingBuilds: () => app.session.world.queue.length + (app.session.world.activeBuild ? 1 : 0),
  stock: () => app.session.world.stock.ore,
  paused: () => app.session.paused,
  inputCount: () => app.session.log.length,
  shipsAt: (node) => shipCounts(app.session.world).at[node] ?? 0,
  wavesSent: () => app.session.world.stats.wavesSent,
  shipsAtByType: (node) => ({ ...shipsAtByType(app.session.world, node) }),
  pocketNode: (prize) => app.session.world.nodes.find((n) => n.kind === 'pocket' && n.prize === prize)?.index ?? -1,
  nodeIndex: (id) => app.session.world.nodes.findIndex((n) => n.id === id),
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
    if (on) toast.show('Heart held: 15 sent, 3 lost, 4 guards stripped. 10 Thorns 14 Spores regrow 1 / 2.0 s and 1 / 0.7 s.\n\nP4 held: 10 sent, 10 lost, 2 guards stripped\nRegrowth outpaced the wave. 10 ships strip 0.6 guards/s; P4 regrows 1/s.');
    else toast.hide();
    refreshUi();
  },
  debugHudFrame: (f) => {
    const clone = structuredClone(app.session.world) as World;
    for (const r of RESOURCES) clone.stock[r] = f.stock[r];
    clone.stats.firstDeliveredTick.ice = clone.stats.firstDeliveredTick.ice ?? 0;
    clone.stats.firstDeliveredTick.crystal = clone.stats.firstDeliveredTick.crystal ?? 0;
    clone.stats.deliveredBuckets.fill(0);
    clone.stats.deliveredBuckets[0] = f.ore;
    clone.stats.prizeBuckets.ice.fill(0);
    clone.stats.prizeBuckets.crystal.fill(0);
    clone.stats.prizeBuckets.ice[0] = f.ice;
    clone.stats.prizeBuckets.crystal[0] = f.crystal;
    clone.tun['fleet.cap'] = f.cap;
    clone.ships = [];
    for (const t of SHIP_TYPES) for (let i = 0; i < f.ships[t]; i++) clone.ships.push({ id: clone.ships.length, type: t, hp: 1, at: 0, transit: null, engagedIn: -1 });
    hudOverride = clone;
    refreshUi();
  },
  mapBackedUp: (node) => view.drawnBackedUp(node),
  mapField: () => JSON.stringify(view.drawnField()),
  debugShowResult: () =>
    isField(app.session.world)
      ? showFieldResult($('result'), app.session, newSystem, () => undefined)
      : showAreaResult($('result'), app.session, () => send({ type: 'leaveArea' }), () => undefined),
  startCampaign,
  systemName: () => systemStatus(app.session.world).name,
  rootNode: () => rootIndex(app.session.world),
  newSystem,
  newRun: newSystem,
  isField: () => isField(app.session.world),
  allocStatus: () => JSON.stringify(allocStatus(app.session.world, sd())),
  rockStatus: (node) => JSON.stringify(rockStatus(app.session.world, node)),
  fieldSummary: () => JSON.stringify(fieldSummary(app.session.world)),
  econShips: () => JSON.stringify((app.session.world.field?.econ ?? []).map((e) => ({ id: e.id, type: e.type, at: e.at, target: e.target, moving: e.transit !== null }))),
  log: () => JSON.stringify(app.session.log.map((l) => l.input)),
  setSpeed: (v) => {
    app.session.speed = v;
    refreshUi();
  },
};
