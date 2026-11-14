/**
 * The "Recycle…" panel (DESIGN.md H5 "Recycle"): the send panel's pattern for scrapping ships parked at a node. One row per ship
 * type with a −/+ stepper (44 px), the count and "All". Every row defaults to 0, never to all. A live refund preview comes from the
 * sim's `recycleRefund` on the clamped counts, so ships that leave while it is open can't make the order wrong.
 */
import {
  BUILD_TYPES,
  SHIP_TYPES,
  clampSendCounts,
  econAtByType,
  isField,
  recycleRefund,
  shipsAtByType,
  unlockStatus,
  type BuildType,
  type Input,
  type RecycleCounts,
  type World,
} from '@factory4x/sim';
import { btn, h, setHidden, setText, type Btn } from './dom.ts';
import { BUILD_NAME } from './fieldreport.ts';
import { buildIcon, recycleIcon } from './icons.ts';
import { recycleNotice } from './report.ts';
import { shortName } from './sheet.ts';

export interface RecyclePanelHost {
  world(): Readonly<World>;
  /** Applies all inputs of one press in the same tick (Session.sendAll). */
  sendAll(inputs: readonly Input[]): void;
  /** A short notice in the notices strip. */
  notice(text: string): void;
}

/** Every type's count, zero where absent (H7: the economy types are only ever present in a field run). */
type Counts = Record<BuildType, number>;
const zero = (): Counts => ({ extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 });

interface Row {
  type: BuildType;
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
  private want: Counts = zero();
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
    this.want = zero();
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

  /** The types the panel offers: the three warships, plus the two economy ships in a field run. */
  private types(): readonly BuildType[] {
    return isField(this.host.world()) ? BUILD_TYPES : SHIP_TYPES;
  }

  private avail(): Counts {
    const w = this.host.world();
    return { ...zero(), ...shipsAtByType(w, this.node), ...econAtByType(w, this.node) };
  }

  private clamped(): Counts {
    const w = this.host.world();
    const war = clampSendCounts(w, this.node, this.want);
    const have = econAtByType(w, this.node);
    return {
      ...zero(),
      ...war,
      extractor: Math.min(this.want.extractor, have.extractor),
      hauler: Math.min(this.want.hauler, have.hauler),
    };
  }

  private build(): void {
    this.root.replaceChildren();
    this.rows = [];
    const card = h('div', 'card send-card recycle-card', '', this.root);
    const head = h('h2', '', '', card);
    recycleIcon(head, 24);
    this.title = h('span', '', '', head);
    this.rule = h('div', 'note', '', card);
    for (const type of this.types()) {
      const wrap = h('div', 'sp-row', '', card);
      wrap.dataset.ship = type;
      const label = h('div', 'sp-label', '', wrap);
      buildIcon(label, 24, type);
      h('span', 'sp-name', BUILD_NAME[type], label);
      const minus = btn(wrap, '−', () => this.step(type, -1), 'sp-step');
      minus.el.setAttribute('aria-label', `Fewer ${BUILD_NAME[type]}`);
      const count = h('b', 'sp-count', '', wrap);
      const plus = btn(wrap, '+', () => this.step(type, 1), 'sp-step');
      plus.el.setAttribute('aria-label', `More ${BUILD_NAME[type]}`);
      const all = btn(wrap, 'All', () => {
        this.want[type] = this.avail()[type];
        this.update();
      }, 'sp-all');
      all.el.setAttribute('aria-label', `All ${BUILD_NAME[type]}`);
      this.rows.push({ type, wrap, count, minus, plus, all });
    }
    this.preview = h('div', 'recycle-preview', '', card);
    const actions = h('div', 'ov-actions', '', card);
    btn(actions, 'Cancel', () => this.close());
    this.go = btn(actions, '', () => this.submit(), 'primary');
  }

  private step(type: BuildType, d: number): void {
    const shown = this.clamped()[type];
    this.want[type] = Math.max(0, Math.min(this.avail()[type], shown + d));
    this.update();
  }

  private submit(): void {
    const w = this.host.world();
    const counts = this.clamped();
    const total = BUILD_TYPES.reduce((a, t) => a + counts[t], 0);
    if (total > 0) {
      const ore = recycleRefund(w, counts);
      // The campaign's order has the three warship counts only; a field order adds the economy ones.
      const order: RecycleCounts = isField(w) ? counts : { drone: counts.drone, lancer: counts.lancer, flak: counts.flak };
      this.host.sendAll([{ type: 'recycleShips', node: this.node, counts: order }]);
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
    setText(this.title, `Recycle ships at ${shortName(w.nodes[this.node]!, isField(w))}`);
    setText(
      this.rule,
      isField(w)
        ? `Scraps ships parked here for ${w.tun['fleet.recycleRefundPct']}% of their ore. A recycled extractor frees its slot.`
        : `Scraps ships parked here for ${w.tun['fleet.recycleRefundPct']}% of their ore. The ship's component is lost.`,
    );
    let total = 0;
    for (const r of this.rows) {
      setHidden(r.wrap, r.type !== 'extractor' && r.type !== 'hauler' && !unlocked[r.type] && have[r.type] === 0);
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
