/**
 * The "Choose…" send panel (DESIGN.md H3 "Attack"): one row per unlocked ship
 * type with a −/+ stepper (44 px), the count and "All", then Send. It defaults
 * to every ship of each type at the source. Counts are clamped by the sim's
 * `clampSendCounts`, so ships that leave or arrive while it is open can't make
 * the order wrong. Built on open, then `update()` refreshes in place.
 */
import { SHIP_TYPES, clampSendCounts, guardianStatus, isGuarded, shipsAtByType, unlockStatus, type Input, type ShipType, type ShipTypeCounts, type World } from '@factory4x/sim';
import { btn, h, setHidden, setText, type Btn } from './dom.ts';
import { shipIcon } from './icons.ts';
import { SHIP_NAME, TAG_TEXT } from './report.ts';
import { shortName } from './sheet.ts';

export interface SendPanelHost {
  world(): Readonly<World>;
  /** Applies all inputs of one press in the same tick (Session.sendAll). */
  sendAll(inputs: readonly Input[]): void;
}

interface Row {
  type: ShipType;
  wrap: HTMLElement;
  count: HTMLElement;
  minus: Btn;
  plus: Btn;
  all: Btn;
  tag: HTMLElement;
}

export class SendPanel {
  private readonly root: HTMLElement;
  private readonly host: SendPanelHost;
  private from = -1;
  private to = -1;
  private want: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
  private rows: Row[] = [];
  private title!: HTMLElement;
  private send!: Btn;

  constructor(root: HTMLElement, host: SendPanelHost) {
    this.root = root;
    this.host = host;
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(from: number, to: number): void {
    this.from = from;
    this.to = to;
    // Defaults to all of each type.
    this.want = { ...shipsAtByType(this.host.world(), from) };
    this.build();
    this.root.hidden = false;
    this.update();
  }

  close(): void {
    this.from = -1;
    this.root.hidden = true;
    this.root.replaceChildren();
    this.rows = [];
  }

  private avail(): ShipTypeCounts {
    return shipsAtByType(this.host.world(), this.from);
  }

  private build(): void {
    this.root.replaceChildren();
    this.rows = [];
    const card = h('div', 'card send-card', '', this.root);
    this.title = h('h2', '', '', card);
    for (const type of SHIP_TYPES) {
      const wrap = h('div', 'sp-row', '', card);
      wrap.dataset.ship = type;
      const label = h('div', 'sp-label', '', wrap);
      shipIcon(label, 24, type);
      const name = h('span', 'sp-name', SHIP_NAME[type], label);
      const tag = h('small', 'sp-tag', '', name);
      const minus = btn(wrap, '−', () => this.step(type, -1), 'sp-step');
      minus.el.setAttribute('aria-label', `Fewer ${SHIP_NAME[type]}`);
      const count = h('b', 'sp-count', '', wrap);
      const plus = btn(wrap, '+', () => this.step(type, 1), 'sp-step');
      plus.el.setAttribute('aria-label', `More ${SHIP_NAME[type]}`);
      const all = btn(wrap, 'All', () => {
        this.want[type] = this.avail()[type];
        this.update();
      }, 'sp-all');
      all.el.setAttribute('aria-label', `All ${SHIP_NAME[type]}`);
      this.rows.push({ type, wrap, count, minus, plus, all, tag });
    }
    const actions = h('div', 'ov-actions', '', card);
    btn(actions, 'Cancel', () => this.close());
    this.send = btn(actions, '', () => this.submit(), 'primary');
  }

  private step(type: ShipType, d: number): void {
    const shown = clampSendCounts(this.host.world(), this.from, this.want)[type];
    this.want[type] = Math.max(0, Math.min(this.avail()[type], shown + d));
    this.update();
  }

  private submit(): void {
    const counts = clampSendCounts(this.host.world(), this.from, this.want);
    const total = counts.drone + counts.lancer + counts.flak;
    if (total > 0) this.host.sendAll([{ type: 'sendShips', from: this.from, to: this.to, counts }]);
    this.close();
  }

  /** Refresh counts, tags and the Send label (call while open, a few times a second). */
  update(): void {
    if (!this.isOpen || this.from < 0) return;
    const w = this.host.world();
    const have = this.avail();
    const shown = clampSendCounts(w, this.from, this.want);
    const unlocked = unlockStatus(w).ships;
    const target = w.nodes[this.to]!;
    const guarded = isGuarded(w, this.to);
    setText(this.title, `${guarded ? 'Attack' : 'Send to'} ${shortName(target)} from ${shortName(w.nodes[this.from]!)}`);
    const tags = guarded ? guardianStatus(w, this.to).tags : null;
    let total = 0;
    for (const r of this.rows) {
      setHidden(r.wrap, !unlocked[r.type] && have[r.type] === 0);
      setText(r.count, `${shown[r.type]}/${have[r.type]}`);
      r.minus.set('−', shown[r.type] > 0);
      r.plus.set('+', shown[r.type] < have[r.type]);
      r.all.set('All', shown[r.type] < have[r.type]);
      setText(r.tag, tags ? ` · ${TAG_TEXT[tags[r.type].tag]}` : '');
      total += shown[r.type];
    }
    this.send.set(total > 0 ? `Send ${total} ${total === 1 ? 'ship' : 'ships'}` : 'Send', total > 0);
  }
}
