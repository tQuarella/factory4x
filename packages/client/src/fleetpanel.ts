/**
 * H8 fleet panel (the Fleet chip opens it): five rows, one per build type, each with its icon, name, ships alive, how many idle at the
 * probe and a dot while its bay builds; a recycle stepper (−/+, never more than `recyclable`) and one "Recycle N (+X ore)" button that
 * sends `recycleFleet`. Every number comes from `fleetStatus` (alive, idle, building, recyclable) and `recycleRefund`.
 */
import { BUILD_TYPES, fleetStatus, recycleRefund, type BuildType, type Input, type SimData, type World } from '@factory4x/sim';
import { btn, h, setHidden, setText, toggleClass, type Btn } from './dom.ts';
import { BUILD_NAME, recycleFleetText } from './fieldreport.ts';
import { buildIcon, recycleIcon } from './icons.ts';
import { recycleNotice } from './report.ts';

export interface FleetPanelHost {
  world(): Readonly<World>;
  data(): SimData;
  /** Applies all inputs of one press in the same tick (Session.sendAll). */
  sendAll(inputs: readonly Input[]): void;
  notice(text: string): void;
}

type Counts = Record<BuildType, number>;
const zero = (): Counts => ({ extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 });

interface Row {
  type: BuildType;
  alive: HTMLElement;
  dot: HTMLElement;
  count: HTMLElement;
  minus: Btn;
  plus: Btn;
}

export class FleetPanel {
  private readonly root: HTMLElement;
  private readonly host: FleetPanelHost;
  private want: Counts = zero();
  private rows: Row[] = [];
  private head!: HTMLElement;
  private go!: Btn;

  constructor(root: HTMLElement, host: FleetPanelHost) {
    this.root = root;
    this.host = host;
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(): void {
    this.want = zero();
    this.build();
    this.root.hidden = false;
    this.update();
  }

  close(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
    this.rows = [];
  }

  /** What the order would recycle: each wish clamped to what is recyclable now, so ships lost while it is open can't make it wrong. */
  private clamped(): Counts {
    const types = fleetStatus(this.host.world(), this.host.data()).types;
    const out = zero();
    for (const t of BUILD_TYPES) out[t] = Math.min(this.want[t], types[t].recyclable);
    return out;
  }

  private build(): void {
    this.root.replaceChildren();
    this.rows = [];
    const card = h('div', 'card send-card fleet-card', '', this.root);
    const top = h('div', 'fleet-head', '', card);
    const title = h('h2', '', '', top);
    recycleIcon(title, 22);
    h('span', '', 'Fleet', title);
    const close = btn(top, '✕', () => this.close(), 'close');
    close.el.setAttribute('aria-label', 'Close');
    this.head = h('div', 'note fleet-line', '', card);
    for (const type of BUILD_TYPES) {
      const wrap = h('div', 'fl-row', '', card);
      wrap.dataset.type = type;
      buildIcon(wrap, 24, type);
      const text = h('div', 'fl-text', '', wrap);
      const name = h('b', 'fl-name', BUILD_NAME[type], text);
      const dot = h('span', 'fl-dot', '', name);
      dot.title = 'building';
      const alive = h('div', 'fl-alive', '', text);
      const minus = btn(wrap, '−', () => this.step(type, -1), 'sp-step');
      minus.el.setAttribute('aria-label', `Recycle fewer ${BUILD_NAME[type]}`);
      const count = h('b', 'fl-count', '', wrap);
      const plus = btn(wrap, '+', () => this.step(type, 1), 'sp-step');
      plus.el.setAttribute('aria-label', `Recycle more ${BUILD_NAME[type]}`);
      this.rows.push({ type, alive, dot, count, minus, plus });
    }
    const actions = h('div', 'ov-actions', '', card);
    this.go = btn(actions, '', () => this.submit(), 'primary fl-go');
  }

  private step(type: BuildType, d: number): void {
    const max = fleetStatus(this.host.world(), this.host.data()).types[type].recyclable;
    this.want[type] = Math.max(0, Math.min(max, this.clamped()[type] + d));
    this.update();
  }

  private submit(): void {
    const w = this.host.world();
    const counts = this.clamped();
    const total = BUILD_TYPES.reduce((a, t) => a + counts[t], 0);
    if (total > 0) {
      const ore = recycleRefund(w, counts);
      this.host.sendAll([{ type: 'recycleFleet', counts }]);
      this.host.notice(recycleNotice(counts, ore));
    }
    this.close();
  }

  /** Refreshes the rows, the counts and the button (a few times a second while open). */
  update(): void {
    if (!this.isOpen) return;
    const w = this.host.world();
    const st = fleetStatus(w, this.host.data());
    const shown = this.clamped();
    setText(this.head, st.cap === null ? `${st.count} ships` : `Fleet ${st.count}/${st.cap}${st.countsEconomy ? ', every ship counts' : ', warships count'}`);
    let total = 0;
    for (const r of this.rows) {
      const row = st.types[r.type];
      setText(r.alive, `${row.alive} alive · idle ${row.idle}`);
      setHidden(r.dot, row.building === 0);
      setText(r.count, `${shown[r.type]}/${row.recyclable}`);
      r.minus.set('−', shown[r.type] > 0);
      r.plus.set('+', shown[r.type] < row.recyclable);
      toggleClass(r.count, 'zero', shown[r.type] === 0);
      total += shown[r.type];
    }
    this.go.set(recycleFleetText(total, total > 0 ? recycleRefund(w, shown) : 0), total > 0);
  }
}
