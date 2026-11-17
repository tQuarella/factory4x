/** Full-screen panels: tuning, feedback, the area result and win panels, and the New system confirmation. */
import { FIELD_PARKED_KEYS, SHIP_TYPES, areaStatus, campaignSummary, fieldSummary, isField, runSummary, tunableMeta, type CaptureEntry, type Input, type ShipTypeCounts, type SimData, type TunableMeta } from '@factory4x/sim';
import { btn, h, setText, toggleClass, type Btn } from './dom.ts';
import { buildNote } from './feedback.ts';
import { clampInt, mmss, shortVersion, stepFor, ticksText } from './format.ts';
import { CLIENT_SETTING_KEYS, type ClientKey, type Settings } from './persist.ts';
import { iconCanvas } from './icons.ts';
import { drawProbeCore } from './placeholders.ts';
import { hiveTimeText, raidProngsText, raidsText, typesText } from './fieldreport.ts';
import { RES_NAME, SHIP_NAME, plusText, recycledText, tripleText } from './report.ts';
import type { Session } from './session.ts';

export interface PanelHost {
  app: { session: Session };
  /** The data of the session on screen (H7: field mode on shipped data; the parked campaign in a test). */
  readonly data: SimData;
  settings: Settings;
  fullVersion: string;
  send(input: Input): void;
  /** Applies all inputs of one press in the same tick (Session.sendAll). */
  sendAll(inputs: readonly Input[]): void;
  settingsChanged(): void;
  newSystem(): void;
}

/** Modal yes/no. Resolves true on yes. */
export function confirmModal(message: string, yes: string, no: string): Promise<boolean> {
  return new Promise((resolve) => {
    const root = h('section', 'overlay modal', '', document.body);
    const card = h('div', 'card', '', root);
    h('h2', '', 'Are you sure?', card);
    h('p', '', message, card);
    const row = h('div', 'ov-actions', '', card);
    const done = (v: boolean): void => {
      root.remove();
      resolve(v);
    };
    btn(row, no, () => done(false));
    btn(row, yes, () => done(true), 'danger');
  });
}

function header(root: HTMLElement, title: string, onClose: () => void): void {
  const head = h('div', 'ov-head', '', root);
  h('h2', '', title, head);
  const c = btn(head, '✕', onClose, 'close');
  c.el.setAttribute('aria-label', 'Close');
}

// ---------------------------------------------------------------------------

/** H5: friendlier names for the fleet-cap tunables (the owner's A/B: `fleet.cap` 0 turns the limit off). The input's aria-label stays the key. */
/** H6: the Root is removed from play, so its starved-heart tunables are hidden (they stay in the data). */
export const HIDDEN_TUNABLES: readonly string[] = ['bloom.starved'];

/**
 * Whether the tuning panel hides a key. H7: a field run hides the parked keys (kept in the data, unused in field mode) and the system
 * variant (the field has one layout); the campaign shows them all. The Root's starved-heart keys are hidden in both (H6).
 */
export function isHiddenTunable(key: string, field: boolean): boolean {
  return HIDDEN_TUNABLES.some((p) => key.startsWith(p)) || (field && ((FIELD_PARKED_KEYS as readonly string[]).includes(key) || key === 'system.variant'));
}

export const TUNE_LABEL: Readonly<Record<string, string>> = {
  'fleet.cap': 'Fleet limit (0 = none)',
  'field.fleetCap': 'Fleet limit (0 = none)',
  'fleet.countsEconomy': 'Economy ships count (0 = warships only)',
  'raid.enabled': 'Raids (0 = off)',
  'hauler.autoNeed': 'Haulers by need (0 = H7 haulers)',
  'hauler.needPct': 'Hauler need %',
  'rock.haulerMax': 'Most haulers per rock',
  'raid.shieldEcon': 'Warships shield the economy (0 = off)',
  'raid.haulersHold': 'Haulers wait out a raid (0 = off)',
  'raid.prongsMax': 'Most raid prongs (1 = one target)',
  'raid.prongMinSize': 'Fewest raiders per prong',
  'move.splitPct': 'Long-press split %',
  'client.longPressMs': 'Long-press time, ms',
  'client.dragSlopPx': 'Drag distance, px',
  'client.moveGesture': 'Move ships by (1 = drag, 0 = tap Move, tap)',
  'client.haulerStepper': 'Hauler stepper on rock sheets (1 = on)',
  'alloc.maxWeight': 'Weight steps (radar scale)',
  'fleet.recycleRefundPct': 'Recycle refund %',
  'fleet.relayStep': 'Relay limit step',
  'areas.repeatHaulPct': 'Repeat haul %',
  'overworld.bandLock': 'Band locks (0 = off)',
};

interface TuneRow {
  meta: TunableMeta;
  row: HTMLElement;
  input: HTMLInputElement;
  minus: Btn;
  plus: Btn;
  reset: Btn;
  /** Live caption under the name (ticks as seconds), or null. */
  now: HTMLElement | null;
}

export class TuningPanel {
  private readonly root: HTMLElement;
  private readonly host: PanelHost;
  private rows: TuneRow[] = [];
  private resultToggle!: Btn;
  /** Whether the panel was built for a field run (H7); it is rebuilt when the session's mode changes. */
  private builtField = false;

  constructor(root: HTMLElement, host: PanelHost) {
    this.root = root;
    this.host = host;
    this.build();
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(): void {
    this.root.hidden = false;
    this.update();
  }

  close(): void {
    this.root.hidden = true;
  }

  private value(m: TunableMeta): number {
    return m.scope === 'client' ? this.host.settings[CLIENT_SETTING_KEYS[m.key as ClientKey]] : this.host.app.session.world.tun[m.key as keyof typeof this.host.app.session.world.tun];
  }

  private setValue(m: TunableMeta, raw: number): void {
    const v = clampInt(raw, m.min, m.max);
    if (m.scope === 'client') {
      this.host.settings[CLIENT_SETTING_KEYS[m.key as ClientKey]] = v;
      this.host.settingsChanged();
    } else {
      this.host.send({ type: 'setTunable', key: m.key, value: v });
    }
    this.update();
  }

  /** H7: the labels and the list depend on the run mode, so a session of the other mode rebuilds the panel. */
  private rebuildIfModeChanged(): void {
    if (isField(this.host.app.session.world) === this.builtField) return;
    this.root.replaceChildren();
    this.rows = [];
    this.build();
  }

  private build(): void {
    const { host } = this;
    const field = isField(host.app.session.world);
    this.builtField = field;
    // H7: the parked keys (and the variant, which the field doesn't use) are hidden in a field run; the campaign keeps all of them.
    header(this.root, 'Tuning', () => this.close());
    const top = h('div', 'ov-actions', '', this.root);
    this.resultToggle = btn(top, '', () => {
      host.settings.showResult = !host.settings.showResult;
      host.settingsChanged();
      this.update();
    });
    // One press, one tick: every changed sim tunable is reset in a single batch (see Session.sendAll).
    btn(top, 'Reset all', () => {
      const resets: Input[] = [];
      for (const r of this.rows) {
        if (this.value(r.meta) === r.meta.default) continue;
        if (r.meta.scope === 'client') this.setValue(r.meta, r.meta.default);
        else resets.push({ type: 'setTunable', key: r.meta.key, value: r.meta.default });
      }
      host.sendAll(resets);
      this.update();
    });
    btn(top, field ? 'New run…' : 'New system…', () => {
      confirmNewSystem(() => {
        this.close();
        host.newSystem();
      }, field);
    }, 'danger');
    h(
      'div',
      'note',
      `Build ${shortVersion(host.fullVersion)} · data v${host.data.dataVersion}. Changes apply live and are recorded in the replay. ${field ? 'New run' : 'New system'} keeps your tuning.`,
      this.root,
    );

    let section = '';
    for (const meta of tunableMeta(host.data)) {
      if (!meta.live || isHiddenTunable(meta.key, field)) continue;
      if (meta.section !== section) {
        section = meta.section;
        h('div', 't-section', section, this.root);
      }
      const row = h('div', 't-row', '', this.root);
      const name = h('div', 't-name', TUNE_LABEL[meta.key] ?? meta.key.slice(meta.section.length + 1), row);
      const info = h('small', '', `${meta.min}–${meta.max} · default ${meta.default}`, name);
      if (meta.newRunOnly) h('span', 'tag', field ? ' · applies on New run' : ' · applies on New system', info);
      if (meta.key === 'economy.startStock') h('span', 'tag', field ? ' · applies on New run' : ' · applies at the next landing', info);
      if (meta.scope === 'client') h('span', 'tag', ' · this device', info);
      // Tick values also show game seconds ("60 · 2.0 s"); the system variant lists what its numbers mean.
      let now: HTMLElement | null = null;
      if (meta.key.endsWith('Ticks')) now = h('small', 't-now', '', name);
      if (meta.key === 'system.variant') {
        const names = host.data.map.layouts.map((v, i) => `${i + 1} ${v.name.split(' ')[0]}`);
        h('small', '', `0 · by seed / ${names.join(' / ')}`, name);
      }
      const step = stepFor(meta.min, meta.max);
      const minus = btn(row, '−', () => this.setValue(meta, this.value(meta) - step));
      minus.el.setAttribute('aria-label', `Decrease ${meta.key}`);
      const input = h('input', '', '', row);
      input.type = 'number';
      input.inputMode = 'numeric';
      input.min = String(meta.min);
      input.max = String(meta.max);
      input.setAttribute('aria-label', meta.key);
      input.addEventListener('change', () => this.setValue(meta, Number(input.value)));
      const plus = btn(row, '+', () => this.setValue(meta, this.value(meta) + step));
      plus.el.setAttribute('aria-label', `Increase ${meta.key}`);
      const reset = btn(row, '↺', () => this.setValue(meta, meta.default), 'reset');
      reset.el.setAttribute('aria-label', `Reset ${meta.key} to default`);
      this.rows.push({ meta, row, input, minus, plus, reset, now });
    }
  }

  /** Refresh shown values (call while open, a few times a second). */
  update(): void {
    this.rebuildIfModeChanged();
    if (!this.isOpen) return;
    this.resultToggle.set(`Result panel: ${this.host.settings.showResult ? 'ON' : 'OFF'}`);
    for (const r of this.rows) {
      const v = this.value(r.meta);
      if (document.activeElement !== r.input) r.input.value = String(v);
      r.minus.set('−', v > r.meta.min);
      r.plus.set('+', v < r.meta.max);
      r.reset.set('↺', v !== r.meta.default);
      toggleClass(r.row, 'changed', v !== r.meta.default);
      if (r.now) setText(r.now, ticksText(v, this.host.data.tickRate));
    }
  }
}

// ---------------------------------------------------------------------------

export class FeedbackPanel {
  private readonly root: HTMLElement;
  private readonly host: PanelHost;
  private text!: HTMLTextAreaElement;
  private status!: HTMLElement;
  private openIssue!: Btn;
  private issueUrl = '';
  private wasPaused = false;

  constructor(root: HTMLElement, host: PanelHost) {
    this.root = root;
    this.host = host;
    this.build();
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  /** Opens and pauses the game; closing restores the previous pause state. */
  open(): void {
    if (this.isOpen) return;
    const s = this.host.app.session;
    this.wasPaused = s.paused;
    s.paused = true;
    this.status.textContent = '';
    this.openIssue.el.hidden = true;
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
    this.host.app.session.paused = this.wasPaused;
  }

  private note() {
    return buildNote(this.host.app.session, this.host.data, this.text.value, this.host.fullVersion, {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      userAgent: navigator.userAgent,
    });
  }

  private build(): void {
    header(this.root, 'Feedback', () => this.close());
    h('div', 'note', 'Tell us what felt good or bad. The note includes your build, data version and a replay of this session. Nothing is sent until you submit it on GitHub.', this.root);
    this.text = h('textarea', '', '', this.root);
    this.text.placeholder = 'What happened? What did you expect?';
    this.text.rows = 5;
    this.status = h('div', 'status', '', this.root);
    const row = h('div', 'ov-actions', '', this.root);
    btn(row, 'Send', () => void this.send(), 'primary');
    btn(row, 'Copy note', () => void this.copy(this.note().text, 'Copied the note to the clipboard.'));
    this.openIssue = btn(row, 'Open issue page', () => {
      const win = window.open(this.issueUrl, '_blank');
      if (win) win.opener = null;
    });
    this.openIssue.set('Open issue page, then paste');
    this.openIssue.el.hidden = true;
  }

  private async copy(text: string, ok: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      this.status.textContent = ok;
      return true;
    } catch {
      this.text.value = text;
      this.text.focus();
      this.text.select();
      this.status.textContent = 'Could not copy automatically. The full note is in the box: select all and copy it.';
      return false;
    }
  }

  private async send(): Promise<void> {
    const note = this.note();
    if (note.url !== null) {
      // No 'noopener' feature: it makes window.open return null even when the tab opens. Cut the link by hand instead.
      const win = window.open(note.url, '_blank');
      if (win) win.opener = null;
      this.status.textContent = win
        ? 'Opened a prefilled GitHub issue in a new tab. Nothing is sent until you submit it there.'
        : 'Your browser blocked the new tab. Use "Copy note" and paste it into an issue.';
      return;
    }
    const copied = await this.copy(note.text, 'The note (with replay) is too long for a link, so it was copied. Tap "Open issue page", then paste it into the issue body.');
    if (copied) {
      this.issueUrl = note.shortUrl;
      this.openIssue.el.hidden = false;
    }
  }
}

// ---------------------------------------------------------------------------

/** "Ice (P1) 4:10": one step of the capture order. */
export function captureLabel(c: Readonly<CaptureEntry>): string {
  const name = c.kind === 'pocket' ? `${RES_NAME[c.prize ?? 'ore']} (${c.id.toUpperCase()})` : c.kind === 'root' ? 'Root' : 'Heart';
  return `${name} ${mmss(c.sec)}`;
}

/** "Ice (P1) 4:10 → Crystal (P4) 11:30 → Root 15:02 → Heart 19:45". */
export function captureOrderText(captures: readonly CaptureEntry[]): string {
  return captures.map(captureLabel).join(' → ');
}

/** "6 Drone · 3 Lancer · 1 Flak", only the types that appear (or "0"). */
export function byTypeText(c: Readonly<ShipTypeCounts>): string {
  const parts = SHIP_TYPES.filter((t) => c[t] > 0).map((t) => `${c[t]} ${SHIP_NAME[t]}`);
  return parts.length > 0 ? parts.join(' · ') : '0';
}

const NEW_SYSTEM_CONFIRM = 'Start a new system? This erases your campaign. Your current tuning is kept; use Reset all in the tuning panel to restore the defaults.';
const NEW_RUN_CONFIRM = 'Start a new run? This erases this field and its ships. Your current tuning is kept; use Reset all in the tuning panel to restore the defaults.';

/** Asks, then runs `onYes`: the one confirm every New system (H7: New run) button goes through. */
export function confirmNewSystem(onYes: () => void, field = false): void {
  void confirmModal(field ? NEW_RUN_CONFIRM : NEW_SYSTEM_CONFIRM, field ? 'Yes, new run' : 'Yes, new system', 'Keep playing').then((yes) => {
    if (yes) onYes();
  });
}

/** A two-column stat line in a card. */
function statLine(card: HTMLElement, label: string, value: string): void {
  const r = h('div', 'stat-line', '', card);
  h('span', '', label, r);
  h('b', '', value, r);
}

/** The area result panel (DESIGN.md H4 "The area result panel"): shown when the active area's heart is captured. */
export function showAreaResult(root: HTMLElement, session: Session, onBack: () => void, onStay: () => void): void {
  const world = session.world;
  const data = session.data;
  const s = runSummary(world);
  const st = world.campaign.active === null ? null : areaStatus(world, data, world.campaign.active);
  root.replaceChildren();
  const card = h('div', 'card', '', root);
  h('h2', '', `${st?.name ?? 'Area'} reclaimed`, card);
  statLine(card, 'Time to reclaim', s.captureSec === null ? '-' : mmss(s.captureSec));
  const order = h('div', 'capture-order', '', card);
  h('span', 'lbl', 'Capture order', order);
  h('b', '', captureOrderText(s.captures), order);
  statLine(card, 'Ships lost', byTypeText(s.shipsLostByType));
  statLine(card, 'Guards withered', String(s.guardsWithered));
  if (s.shipsRecycled > 0) statLine(card, 'Recycled', recycledText(s.shipsRecycled, s.oreRefunded));
  const haul = h('div', 'capture-order haul-line', '', card);
  h('span', 'lbl', 'Hauled to the stockpile', haul);
  h('b', '', st ? plusText(st.haul) : '-', haul);
  const row = h('div', 'ov-actions', '', card);
  btn(row, 'Back to the overworld', () => {
    root.hidden = true;
    onBack();
  }, 'primary');
  btn(row, 'Keep playing here', () => {
    root.hidden = true;
    onStay();
  });
  root.hidden = false;
}

/** The win panel (DESIGN.md H4 "Win panel"): the whole campaign from `campaignSummary`. */
export function showWin(root: HTMLElement, session: Session, onNewSystem: () => void): void {
  const world = session.world;
  const data = session.data;
  const sum = campaignSummary(world, data);
  root.replaceChildren();
  const card = h('div', 'card', '', root);
  h('h2', '', 'The new probe launches.', card);
  const core = h('div', 'win-core', '', card);
  iconCanvas(core, 72, (ctx, r) => drawProbeCore(ctx, r, 0, 1));
  statLine(card, 'Total play time', mmss(Math.floor(sum.totalPlayTicks / world.tickRate)));
  const areas = h('div', 'win-list win-areas', '', card);
  h('span', 'lbl', 'Areas, in order', areas);
  h('b', '', sum.reclaimOrder.map((a) => `${a.name} ${a.reclaimPlayTicks === null ? '-' : mmss(Math.floor(a.reclaimPlayTicks / world.tickRate))}`).join(' → ') || '-', areas);
  const research = h('div', 'win-list win-research', '', card);
  h('span', 'lbl', 'Research, in order', research);
  const multi = (id: string): boolean => (data.research.find((r) => r.id === id)?.levels.length ?? 1) > 1;
  h('b', '', sum.research.map((r) => (multi(r.item) ? `${r.name} ${r.level}` : r.name)).join(' → ') || '-', research);
  statLine(card, 'Ships lost', `${sum.shipsLost} of ${sum.shipsBuilt}`);
  if (sum.shipsRecycled > 0) statLine(card, 'Recycled', recycledText(sum.shipsRecycled, sum.oreRefunded));
  const hs = h('div', 'win-list win-hauled', '', card);
  h('span', 'lbl', 'Hauled', hs);
  h('b', '', tripleText(sum.hauled), hs);
  const sh = h('div', 'win-list win-shipped', '', card);
  h('span', 'lbl', 'Shipped while you played', sh);
  h('b', '', tripleText(sum.shipped), sh);
  const row = h('div', 'ov-actions', '', card);
  btn(row, 'New system', () => confirmNewSystem(onNewSystem), 'primary');
  root.hidden = false;
}

/**
 * The field result panel (DESIGN.md H7 "Result panel"): shown once when the hive falls, from `fieldSummary`. New run asks first
 * (the run is won, so the tap is deliberate); Keep playing closes it and free play continues.
 */
export function showFieldResult(root: HTMLElement, session: Session, onNewRun: () => void, onStay: () => void): void {
  const s = fieldSummary(session.world);
  root.replaceChildren();
  const card = h('div', 'card field-result', '', root);
  h('h2', '', 'The hive has fallen', card);
  statLine(card, 'Time to the hive', hiveTimeText(s));
  statLine(card, 'Peak ore/min', String(s.peakPerMin));
  const built = h('div', 'capture-order built-line', '', card);
  h('span', 'lbl', 'Ships built', built);
  h('b', '', typesText(s.built), built);
  const lost = h('div', 'capture-order lost-line', '', card);
  h('span', 'lbl', 'Ships lost', lost);
  h('b', '', typesText(s.lost), lost);
  statLine(card, 'Raids', raidsText(s.raids));
  statLine(card, 'Raid prongs', raidProngsText(s.raidProngs));
  statLine(card, 'Economy ships lost to raids', String(s.econLostToRaids));
  statLine(card, 'Weight changes', String(s.allocChanges));
  statLine(card, 'Most economy ships at once', String(s.peakEcon));
  const row = h('div', 'ov-actions', '', card);
  btn(row, 'New run', () => confirmNewSystem(() => {
    root.hidden = true;
    onNewRun();
  }, true), 'primary');
  btn(row, 'Keep playing', () => {
    root.hidden = true;
    onStay();
  });
  root.hidden = false;
}
