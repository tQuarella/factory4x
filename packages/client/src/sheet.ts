/**
 * Node sheets (probe, asteroid, rich). A sheet is built once when a node is
 * selected, then `update()` refreshes text, bars and enabled states in place.
 * All numbers come from the sim's selectors; buttons grey out via isValidInput.
 */
import {
  battleStatus,
  combatRates,
  guardianStatus,
  inputCost,
  isValidInput,
  nodeStatus,
  queueStatus,
  shipCounts,
  shipyardStatus,
  shipsPerMinX10,
  type BuildKind,
  type Input,
  type Node,
} from '@factory4x/sim';
import { palette } from './palette.ts';
import { bar, btn, h, setHidden, setText, toggleClass, type Btn } from './dom.ts';
import { fmt10 } from './format.ts';
import type { Session } from './session.ts';

export interface SheetHost {
  session: Session;
  send(input: Input): void;
  close(): void;
}

const KIND_LABEL: Record<BuildKind, string> = { extractor: 'Ext', route: 'Route', upgrade: 'Upg' };

export function shortName(n: Pick<Node, 'id' | 'kind'>): string {
  return n.kind === 'probe' ? 'Probe' : n.kind === 'rich' ? 'Rich' : n.id.toUpperCase();
}

function longName(n: Pick<Node, 'id' | 'kind'>, captured: boolean): string {
  if (n.kind === 'probe') return 'Probe';
  if (n.kind === 'rich') return captured ? 'Rich node (yours)' : 'Rich node · the Bloom';
  return `Asteroid ${n.id.toUpperCase()}`;
}

export class Sheet {
  private readonly root: HTMLElement;
  private readonly host: SheetHost;
  private ups: Array<() => void> = [];
  private node = -1;
  private sig = '';
  /** Queue icon armed for the "Cancel" second tap, or -1. */
  private armed = -1;

  constructor(root: HTMLElement, host: SheetHost) {
    this.root = root;
    this.host = host;
  }

  get selected(): number | null {
    return this.node < 0 ? null : this.node;
  }

  private get world() {
    return this.host.session.world;
  }

  private valid(input: Input): boolean {
    return isValidInput(this.world, this.host.session.data, input);
  }

  open(node: number): void {
    this.node = node;
    this.armed = -1;
    this.build();
  }

  close(): void {
    this.node = -1;
    this.sig = '';
    this.ups = [];
    this.root.replaceChildren();
    this.root.hidden = true;
  }

  /** Rebuilds when the node's kind of sheet changes (the Bloom falls while its sheet is open). */
  private signature(): string {
    const n = this.world.nodes[this.node]!;
    return `${this.node}:${n.kind === 'rich' && this.world.guardian.alive ? 'guarded' : 'open'}`;
  }

  private build(): void {
    const world = this.world;
    const n = world.nodes[this.node]!;
    this.sig = this.signature();
    this.ups = [];
    this.root.replaceChildren();
    this.root.hidden = false;
    this.root.scrollTop = 0;

    const head = h('div', 'sheet-head', '', this.root);
    const title = h('h2', '', longName(n, !world.guardian.alive), head);
    const closeBtn = btn(head, '✕', () => this.host.close(), 'close');
    closeBtn.el.setAttribute('aria-label', 'Close');
    void title;

    if (n.kind === 'probe') this.probeSections();
    else if (n.kind === 'rich' && world.guardian.alive) this.richSections(n);
    else this.producerSections(n);

    this.sendSection(n);
    this.rallySection(n);
    this.update();
  }

  update(): void {
    if (this.node < 0) return;
    if (this.signature() !== this.sig) {
      this.build();
      return;
    }
    for (const u of this.ups) u();
  }

  // --- shared pieces -------------------------------------------------------

  private row(parent: HTMLElement, label: string): { el: HTMLElement; val: HTMLElement } {
    const el = h('div', 'row', '', parent);
    h('span', 'lbl', label, el);
    return { el, val: h('span', 'val', '', el) };
  }

  private note(parent: HTMLElement, cls: string): HTMLElement {
    const el = h('div', `note ${cls}`, '', parent);
    el.hidden = true;
    return el;
  }

  private buildButton(parent: HTMLElement, make: () => Input, label: (cost: number) => string, disabledLabel: () => string): void {
    const b = btn(parent, '', () => this.host.send(make()), 'primary');
    this.ups.push(() => {
      const input = make();
      const ok = this.valid(input);
      b.set(ok ? label(inputCost(this.world, input)) : disabledLabel(), ok);
    });
  }

  // --- asteroid, and the rich node once captured ---------------------------

  private producerSections(n: Node): void {
    const sec = h('section', '', '', this.root);
    const pipRow = h('div', 'pips', '', sec);
    const pips: HTMLElement[] = [];
    for (let i = 0; i < n.slots; i++) pips.push(h('span', 'pip', '', pipRow));
    const pipText = h('span', 'pip-text', '', pipRow);
    const extract = this.row(sec, 'Extracting');
    const route = this.row(sec, 'Route');
    const bufRow = h('div', 'row', '', sec);
    h('span', 'lbl', 'Buffer', bufRow);
    const buf = bar(bufRow, 'buf');
    const bufText = h('span', 'val', '', bufRow);
    const warn = this.note(sec, 'warn');

    const actions = h('div', 'actions', '', sec);
    const node = n.index;
    this.buildButton(
      actions,
      () => ({ type: 'buildExtractor', node }),
      (c) => `Extractor · ${c}`,
      () => {
        const st = nodeStatus(this.world, node);
        return st.extractorsCommitted >= st.slots ? 'Extractor · slots full' : 'Extractor · queue full';
      },
    );
    this.buildButton(
      actions,
      () => ({ type: 'buildRoute', from: node, to: 0 }),
      (c) => `Route to probe · ${c}`,
      () => {
        const st = nodeStatus(this.world, node);
        if (st.route) return 'Route built';
        if (st.routePending) return 'Route queued';
        return st.extractorsCommitted === 0 ? 'Route · build an extractor first' : 'Route · queue full';
      },
    );
    this.buildButton(
      actions,
      () => ({ type: 'upgradeRoute', from: node }),
      (c) => {
        const st = nodeStatus(this.world, node);
        const next = (st.route?.level ?? 0) + (st.route?.pendingUpgrades ?? 0) + 1;
        return `Upgrade route → L${next} · ${c}`;
      },
      () => {
        const st = nodeStatus(this.world, node);
        if (!st.route) return 'Upgrade route · no route yet';
        return st.route.level + st.route.pendingUpgrades >= st.route.maxLevel ? 'Route at max level' : 'Upgrade route · queue full';
      },
    );

    this.ups.push(() => {
      const st = nodeStatus(this.world, node);
      pips.forEach((p, i) => {
        toggleClass(p, 'on', i < st.extractors);
        toggleClass(p, 'queued', i >= st.extractors && i < st.extractorsCommitted);
      });
      const queued = st.extractorsCommitted - st.extractors;
      setText(pipText, `${st.extractors}/${st.slots}${queued > 0 ? ` (+${queued} queued)` : ''}`);
      setText(extract.val, `+${st.extractPerMin}/min`);
      if (st.route) {
        const up = st.route.pendingUpgrades > 0 ? ` (+${st.route.pendingUpgrades} queued)` : '';
        setText(route.val, `L${st.route.level}/${st.route.maxLevel} · carries ${st.route.capacityPerMin}/min${up}`);
      } else setText(route.val, st.routePending ? 'queued' : 'none');
      buf.set(st.buffer / Math.max(1, st.bufferCap));
      toggleClass(buf.el, 'full', st.backedUp);
      setText(bufText, `${st.buffer}/${st.bufferCap}`);
      const msg = st.backedUp
        ? st.route
          ? 'Backed up: route at capacity. Upgrade it.'
          : 'Backed up: no route. Build one.'
        : st.noRoute
          ? 'No route: this ore goes nowhere. Build a route.'
          : '';
      setHidden(warn, msg === '');
      setText(warn, msg);
    });
  }

  // --- probe ---------------------------------------------------------------

  private probeSections(): void {
    const yard = h('section', '', '', this.root);
    const yardBtn = btn(yard, '', () => this.host.send({ type: 'setShipyard', on: !this.world.shipyard.on }), 'primary');
    const yardBar = bar(yard, 'yard');
    const yardInfo = this.row(yard, 'Ships');
    const mining = this.row(yard, 'Probe mining');

    const qsec = h('section', '', '', this.root);
    const qHead = this.row(qsec, 'Build queue');
    const active = h('div', 'active', '', qsec);
    const activeText = h('span', '', '', active);
    const activeBar = bar(active, 'build');
    const icons = h('div', 'qicons', '', qsec);
    const cancel = btn(qsec, '', () => {
      if (this.armed >= 0) this.host.send({ type: 'cancelBuild', index: this.armed });
      this.armed = -1;
    }, 'danger');
    cancel.el.hidden = true;
    let iconSig = '';

    const spark = h('section', '', '', this.root);
    h('div', 'lbl', 'Ore/min, last 10 min', spark);
    const canvas = h('canvas', 'spark', '', spark);

    this.ups.push(() => {
      const w = this.world;
      const y = shipyardStatus(w);
      yardBtn.set(y.on ? 'Shipyard ON · tap to stop' : 'Shipyard OFF · tap to start');
      toggleClass(yardBtn.el, 'on', y.on);
      yardBar.set(y.ticksLeft > 0 ? (y.totalTicks - y.ticksLeft) / y.totalTicks : 0);
      const perMin = shipsPerMinX10(w);
      setText(yardInfo.val, `${w.ships.length} · ${y.on ? `${fmt10(perMin)}/min at this income` : 'paused'}`);
      setText(mining.val, `+${y.probeOrePerMin}/min`);

      const q = queueStatus(w);
      setText(qHead.val, `${q.orders.length}/${q.queueMax}${q.reserved > 0 ? ` · ${q.reserved} ore reserved` : ''}`);
      if (q.active) {
        const an = w.nodes[q.active.node]!;
        setText(activeText, `Building ${KIND_LABEL[q.active.kind]} ${shortName(an)}`);
        activeBar.set((q.active.totalTicks - q.active.ticksLeft) / Math.max(1, q.active.totalTicks));
      } else {
        setText(activeText, q.orders.length > 0 ? 'Waiting for ore…' : 'Nothing building');
        activeBar.set(0);
      }
      const sig = q.orders.map((o) => `${o.kind}:${o.node}:${o.cost}`).join('|');
      if (sig !== iconSig) {
        iconSig = sig;
        this.armed = -1;
        icons.replaceChildren();
        q.orders.forEach((o, i) => {
          const b = btn(icons, '', () => {
            this.armed = this.armed === i ? -1 : i;
            this.update();
          }, 'qicon');
          b.el.dataset.index = String(i);
          b.el.replaceChildren(h('span', '', `${KIND_LABEL[o.kind]} ${shortName(w.nodes[o.node]!)}`), h('b', '', String(o.cost)));
        });
      }
      Array.from(icons.children).forEach((c, i) => toggleClass(c as HTMLElement, 'armed', i === this.armed));
      const o = this.armed >= 0 ? q.orders[this.armed] : undefined;
      cancel.el.hidden = !o;
      if (o) cancel.set(`Cancel ${KIND_LABEL[o.kind]} ${shortName(w.nodes[o.node]!)} · ${o.cost}`);

      drawSpark(canvas, this.host.session.history);
    });
  }

  // --- the guarded rich node -----------------------------------------------

  private richSections(n: Node): void {
    const sec = h('section', '', '', this.root);
    const thornRow = this.row(sec, 'Thorns');
    const ringWrap = h('div', 'regrow', '', sec);
    const ring = h('canvas', 'ring', '', ringWrap);
    ring.width = 56;
    ring.height = 56;
    const regrow = h('span', '', '', ringWrap);
    const stats = h('div', 'note', '', sec);
    const ships = this.row(sec, 'Ships here / en route');
    const hint = h('div', 'note', '', sec);

    // Always shown, with its space reserved, so Retreat never appears where "Attack from" was.
    const battle = h('section', 'battle', '', this.root);
    const lines = h('div', 'lines', '', battle);
    const bLine = h('div', '', '', lines);
    const bLost = h('div', '', '', lines);
    const retreat = btn(battle, '', () => this.host.send({ type: 'sendShips', from: n.index, to: 0, count: 0 }), 'danger');

    this.ups.push(() => {
      const w = this.world;
      const g = guardianStatus(w);
      setText(thornRow.val, `${g.thorns} / ${g.cap}`);
      const atCap = g.thorns >= g.cap;
      const secX10 = Math.round((g.regrowTicks * 10) / w.tickRate);
      setText(regrow, atCap ? `Bloom at full strength · regrows 1 thorn / ${fmt10(secX10)} s when hurt` : `Regrows 1 thorn / ${fmt10(secX10)} s`);
      drawRing(ring, atCap ? 0 : g.regrowProgress / Math.max(1, g.regrowTicks));
      setText(
        stats,
        `Thorn: ${g.thornHp} hp, hits ${g.thornDamage}/round, heals ${g.repairPerRound}/round. Ship: ${g.shipHp} hp, hits ${g.shipDamage}/round.`,
      );
      const c = shipCounts(w);
      setText(ships.val, `${c.at[n.index]} / ${c.enRoute[n.index]}`);
      const total = c.total;
      const r = combatRates(w, total);
      setText(
        hint,
        total === 0
          ? 'No ships yet. Waves must out-strip regrowth.'
          : `All ${total} ships together: strip ${fmt10(r.killPerSecX10)} thorns/s vs Bloom regrows ${fmt10(r.regrowPerSecX10)}/s.`,
      );
      const b = battleStatus(w);
      if (b) {
        setText(bLine, `Battle: you strip ${fmt10(b.killPerSecX10)} thorns/s · Bloom regrows ${fmt10(b.regrowPerSecX10)}/s`);
        setText(bLost, `Ships lost so far: ${b.shipsLost} · thorns stripped: ${b.thornsKilled}`);
      } else {
        setText(bLine, 'No battle running.');
        setText(bLost, '');
      }
      const here = c.at[n.index]!;
      retreat.set(`Retreat to Probe · ${here}`, here > 0);
    });
  }

  // --- send ships here, rally ----------------------------------------------

  private sendSection(n: Node): void {
    const sec = h('section', 'send', '', this.root);
    const title = h('div', 'lbl', '', sec);
    const nodes = this.world.nodes;
    const sources: Array<{ node: number; b: Btn }> = [];
    const attack = (): boolean => n.kind === 'rich' && this.world.guardian.alive;
    for (const m of nodes) {
      if (m.index === n.index) continue;
      const b = btn(sec, '', () => this.host.send({ type: 'sendShips', from: m.index, to: n.index, count: 0 }), 'send-btn');
      sources.push({ node: m.index, b });
    }
    const all = btn(sec, '', () => {
      for (const s of sources) {
        if (shipCounts(this.world).at[s.node]! > 0) this.host.send({ type: 'sendShips', from: s.node, to: n.index, count: 0 });
      }
    }, 'send-btn all');
    this.ups.push(() => {
      const c = shipCounts(this.world);
      let total = 0;
      let live = 0;
      for (const s of sources) {
        const k = c.at[s.node]!;
        total += k;
        if (k > 0) live++;
        setHidden(s.b.el, k === 0);
        s.b.set(`${attack() ? 'Attack from' : 'From'} ${shortName(nodes[s.node]!)} · ${k}`);
      }
      setHidden(all.el, live < 2);
      all.set(`${attack() ? 'Attack with all' : 'All'} · ${total}`);
      setHidden(sec, total === 0);
      setText(title, attack() ? 'Attack the Bloom' : 'Send ships here');
    });
  }

  private rallySection(n: Node): void {
    const sec = h('section', '', '', this.root);
    const b = btn(sec, '', () => this.host.send({ type: 'setRally', node: n.index }), 'rally');
    this.ups.push(() => {
      const here = this.world.rally === n.index;
      b.set(here ? 'New ships gather here (rally set)' : 'New ships gather here', !here);
      toggleClass(b.el, 'on', here);
    });
  }
}

function drawSpark(canvas: HTMLCanvasElement, history: readonly number[]): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, canvas.clientWidth);
  const hgt = Math.max(1, canvas.clientHeight);
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(hgt * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(hgt * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hgt);
  if (history.length < 2) return;
  const max = Math.max(10, ...history);
  ctx.strokeStyle = palette.asteroidOre;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  history.forEach((v, i) => {
    const x = (i / (history.length - 1)) * (w - 2) + 1;
    const y = hgt - 2 - (v / max) * (hgt - 4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = '#9fb4d6';
  ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(`max ${max}`, 4, 10);
}

function drawRing(canvas: HTMLCanvasElement, frac: number): void {
  const ctx = canvas.getContext('2d')!;
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 5, 0, Math.PI * 2);
  ctx.stroke();
  if (frac > 0) {
    ctx.strokeStyle = palette.bloom;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac));
    ctx.stroke();
  }
}
