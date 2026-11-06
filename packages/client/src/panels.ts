/** Full-screen panels: tuning, feedback, result, and the New run confirmation. */
import { runSummary, tunableMeta, type Input, type SimData, type TunableMeta } from '@factory4x/sim';
import { btn, h, toggleClass, type Btn } from './dom.ts';
import { buildNote } from './feedback.ts';
import { clampInt, mmss, shortVersion, stepFor } from './format.ts';
import type { Settings } from './persist.ts';
import type { Session } from './session.ts';

export interface PanelHost {
  app: { session: Session };
  data: SimData;
  settings: Settings;
  fullVersion: string;
  send(input: Input): void;
  /** Applies all inputs of one press in the same tick (Session.sendAll). */
  sendAll(inputs: readonly Input[]): void;
  settingsChanged(): void;
  newRun(): void;
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

interface TuneRow {
  meta: TunableMeta;
  row: HTMLElement;
  input: HTMLInputElement;
  minus: Btn;
  plus: Btn;
  reset: Btn;
}

export class TuningPanel {
  private readonly root: HTMLElement;
  private readonly host: PanelHost;
  private rows: TuneRow[] = [];
  private resultToggle!: Btn;

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
    return m.scope === 'client' ? this.host.settings.autosaveSec : this.host.app.session.world.tun[m.key as keyof typeof this.host.app.session.world.tun];
  }

  private setValue(m: TunableMeta, raw: number): void {
    const v = clampInt(raw, m.min, m.max);
    if (m.scope === 'client') {
      this.host.settings.autosaveSec = v;
      this.host.settingsChanged();
    } else {
      this.host.send({ type: 'setTunable', key: m.key, value: v });
    }
    this.update();
  }

  private build(): void {
    const { host } = this;
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
    btn(top, 'New run…', () => {
      void confirmModal('Start over? This run is discarded and a new one begins. Your current tuning is kept; use Reset all in the tuning panel to restore the defaults.', 'Yes, new run', 'Keep playing').then((yes) => {
        if (yes) {
          this.close();
          host.newRun();
        }
      });
    }, 'danger');
    h('div', 'note', `Build ${shortVersion(host.fullVersion)} · data v${host.data.dataVersion}. Changes apply live and are recorded in the replay. New run keeps your tuning.`, this.root);

    let section = '';
    for (const meta of tunableMeta(host.data)) {
      if (!meta.live) continue;
      if (meta.section !== section) {
        section = meta.section;
        h('div', 't-section', section, this.root);
      }
      const row = h('div', 't-row', '', this.root);
      const name = h('div', 't-name', meta.key.slice(meta.section.length + 1), row);
      const info = h('small', '', `${meta.min}–${meta.max} · default ${meta.default}`, name);
      if (meta.newRunOnly) h('span', 'tag', ' · applies on New run', info);
      if (meta.scope === 'client') h('span', 'tag', ' · this device', info);
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
      this.rows.push({ meta, row, input, minus, plus, reset });
    }
  }

  /** Refresh shown values (call while open, a few times a second). */
  update(): void {
    if (!this.isOpen) return;
    this.resultToggle.set(`Result panel: ${this.host.settings.showResult ? 'ON' : 'OFF'}`);
    for (const r of this.rows) {
      const v = this.value(r.meta);
      if (document.activeElement !== r.input) r.input.value = String(v);
      r.minus.set('−', v > r.meta.min);
      r.plus.set('+', v < r.meta.max);
      r.reset.set('↺', v !== r.meta.default);
      toggleClass(r.row, 'changed', v !== r.meta.default);
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

/** The capture result panel. */
export function showResult(root: HTMLElement, session: Session, onKeep: () => void, onNewRun: () => void): void {
  const s = runSummary(session.world);
  root.replaceChildren();
  const card = h('div', 'card', '', root);
  h('h2', '', 'Rich node captured', card);
  const line = (label: string, value: string): void => {
    const r = h('div', 'stat-line', '', card);
    h('span', '', label, r);
    h('b', '', value, r);
  };
  line('Time to capture', s.captureSec === null ? '-' : mmss(s.captureSec));
  line('Peak ore/min', String(s.peakPerMin));
  line('Ships built', String(s.shipsBuilt));
  line('Ships lost', String(s.shipsLost));
  line('Waves sent', String(s.wavesSent));
  const row = h('div', 'ov-actions', '', card);
  btn(row, 'Keep playing', () => {
    root.hidden = true;
    onKeep();
  }, 'primary');
  btn(row, 'New run', () => {
    void confirmModal('Start over? This run is discarded and a new one begins. Your current tuning is kept; use Reset all in the tuning panel to restore the defaults.', 'Yes, new run', 'Keep playing').then((yes) => {
      if (yes) {
        root.hidden = true;
        onNewRun();
      }
    });
  });
  root.hidden = false;
}

