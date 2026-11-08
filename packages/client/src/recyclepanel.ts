/**
 * The "Recycle…" panel (DESIGN.md H5 "Recycle"): the send panel's pattern for scrapping ships parked at a node. One row per ship
 * type with a −/+ stepper (44 px), the count and "All". Every row defaults to 0, never to all. A live refund preview comes from the
 * sim's `recycleRefund` on the clamped counts, so ships that leave while it is open can't make the order wrong.
 */
import { SHIP_TYPES, clampSendCounts, recycleRefund, shipsAtByType, unlockStatus, type Input, type ShipType, type ShipTypeCounts, type World } from '@factory4x/sim';
import { btn, h, setHidden, setText, type Btn } from './dom.ts';
import { recycleIcon, shipIcon } from './icons.ts';
import { SHIP_NAME, recycleNotice } from './report.ts';
import { shortName } from './sheet.ts';

export interface RecyclePanelHost {
  world(): Readonly<World>;
  /** Applies all inputs of one press in the same tick (Session.sendAll). */
  sendAll(inputs: readonly Input[]): void;
  /** A short notice in the notices strip. */
  notice(text: string): void;
}

interface Row {
  type: ShipType;
  wrap: HTMLElement;
  count: HTMLElement;
  minus: Btn;
  plus: Btn;
  all: Btn;
}

export class RecyclePanel {
  private readonly root: HTMLElement;
  private readonly host: RecyclePanelHost;
  private node = -1;
  private want: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
  private rows: Row[] = [];
  private title!: HTMLElement;
  private rule!: HTMLElement;
  private preview!: HTMLElement;
  private go!: Btn;

  constructor(root: HTMLElement, host: RecyclePanelHost) {
    this.root = root;
    this.host = host;
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(node: number): void {
    this.node = node;
    this.want = { drone: 0, lancer: 0, flak: 0 };
    this.build();
    this.root.hidden = false;
    this.update();
  }

  close(): void {
    this.node = -1;
    this.root.hidden = true;
    this.root.replaceChildren();
    this.rows = [];
  }

  private avail(): ShipTypeCounts {
    return shipsAtByType(this.host.world(), this.node);
  }

  private clamped(): ShipTypeCounts {
    return clampSendCounts(this.host.world(), this.node, this.want);
  }

  private build(): void {
    this.root.replaceChildren();
    this.rows = [];
    const card = h('div', 'card send-card recycle-card', '', this.root);
    const head = h('h2', '', '', card);
    recycleIcon(head, 24);
    this.title = h('span', '', '', head);
    this.rule = h('div', 'note', '', card);
    for (const type of SHIP_TYPES) {
      const wrap = h('div', 'sp-row', '', card);
      wrap.dataset.ship = type;
      const label = h('div', 'sp-label', '', wrap);
      shipIcon(label, 24, type);
      h('span', 'sp-name', SHIP_NAME[type], label);
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
      this.rows.push({ type, wrap, count, minus, plus, all });
    }
    this.preview = h('div', 'recycle-preview', '', card);
    const actions = h('div', 'ov-actions', '', card);
    btn(actions, 'Cancel', () => this.close());
    this.go = btn(actions, '', () => this.submit(), 'primary');
  }

  private step(type: ShipType, d: number): void {
    const shown = this.clamped()[type];
    this.want[type] = Math.max(0, Math.min(this.avail()[type], shown + d));
    this.update();
  }

  private submit(): void {
    const w = this.host.world();
    const counts = this.clamped();
    const total = counts.drone + counts.lancer + counts.flak;
    if (total > 0) {
      const ore = recycleRefund(w, counts);
      this.host.sendAll([{ type: 'recycleShips', node: this.node, counts }]);
      this.host.notice(recycleNotice(counts, ore));
    }
    this.close();
  }

  /** Refresh counts, the preview and the button (call while open, a few times a second). */
  update(): void {
    if (!this.isOpen || this.node < 0) return;
    const w = this.host.world();
    const have = this.avail();
    const shown = this.clamped();
    const unlocked = unlockStatus(w).ships;
    setText(this.title, `Recycle ships at ${shortName(w.nodes[this.node]!)}`);
    setText(this.rule, `Scraps ships parked here for ${w.tun['fleet.recycleRefundPct']}% of their ore. The ship's component is lost.`);
    let total = 0;
    for (const r of this.rows) {
      setHidden(r.wrap, !unlocked[r.type] && have[r.type] === 0);
      setText(r.count, `${shown[r.type]}/${have[r.type]}`);
      r.minus.set('−', shown[r.type] > 0);
      r.plus.set('+', shown[r.type] < have[r.type]);
      r.all.set('All', shown[r.type] < have[r.type]);
      total += shown[r.type];
    }
    setText(this.preview, `+${recycleRefund(w, shown)} ore`);
    this.go.set(total > 0 ? `Recycle ${total} ${total === 1 ? 'ship' : 'ships'}` : 'Recycle', total > 0);
  }
}
