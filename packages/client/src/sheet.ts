/**
 * Node sheets (probe, asteroid, rich). A sheet is built once when a node is
 * selected, then `update()` refreshes text, bars and enabled states in place.
 * All numbers come from the sim's selectors; buttons grey out via isValidInput.
 */
import {
  SEND_ALL,
  SHIP_TYPES,
  assemblerStatus,
  battleStatus,
  campaignStatus,
  combatRates,
  fleetStatus,
  guardianStatus,
  inputCost,
  isCaptured,
  isGuarded,
  isRootCut,
  isValidInput,
  nodeStatus,
  queueStatus,
  shipCounts,
  systemStatus,
  unlockStatus,
  yardStatus,
  type AssemblerRow,
  type AssemblerState,
  type Component,
  type BuildKind,
  type Input,
  type Node,
  type ShipType,
  type ShipTypeCounts,
  type YardRow,
  type YardState,
} from '@factory4x/sim';
import { palette } from './palette.ts';
import { bar, btn, h, setHidden, setText, toggleClass, type Btn } from './dom.ts';
import { fmt10 } from './format.ts';
import { guardIcon, recycleIcon, resourceIcon, shipIcon } from './icons.ts';
import {
  COMPONENT_SOURCE,
  COUNTER_PHRASE,
  GUARD_NAME,
  RES_NAME,
  SHIP_NAME,
  ratesX10Text,
  SHIP_PLURAL,
  TAG_TEXT,
  UNLOCKS,
  feedsBloomText,
  guardName,
  regrowText,
  supplyLine,
  fleetLine,
  isBackedUp,
  unlockHint,
} from './report.ts';
import type { Session } from './session.ts';

export interface SheetHost {
  session: Session;
  send(input: Input): void;
  /** Applies all inputs of one press in the same tick (Session.sendAll). */
  sendAll(inputs: readonly Input[]): void;
  /** Opens the "Choose…" send panel for a fleet at `from` going to `to`. */
  choose(from: number, to: number): void;
  /** Opens the Recycle panel for the ships parked at `node`. */
  recycle(node: number): void;
  close(): void;
}

/** "3 Drones, 2 Lancers", or "none". */
export function shipsText(c: Readonly<ShipTypeCounts>): string {
  const parts = SHIP_TYPES.filter((t) => c[t] > 0).map((t) => `${c[t]} ${c[t] === 1 ? SHIP_NAME[t] : SHIP_PLURAL[t]}`);
  return parts.length > 0 ? parts.join(', ') : 'none';
}


/** The fleet's count and limit, for the `fleetFull` row ("idle: fleet full (12/12)"). */
export interface FleetCounts {
  count: number;
  cap: number | null;
}

export const YARD_STATE_TEXT: Record<YardState, (component: string | null, fleet?: FleetCounts) => string> = {
  building: () => 'building',
  needsDesign: () => 'Design not researched (Research, on the overworld)',
  noSource: (c) => (c === 'lens' || c === 'plating' ? `No ${COMPONENT_SOURCE[c]} here: no ${c} source in this area` : 'No component source in this area'),
  off: () => 'off',
  fleetFull: (_c, f) => (f && f.cap !== null ? `idle: fleet full (${f.count}/${f.cap})` : 'idle: fleet full'),
  needsComponent: (c) => `idle: needs ${c ?? 'a component'}`,
  needsOre: () => 'idle: needs ore',
  ready: () => 'starting',
};
const ASSEMBLER_STATE_TEXT: Record<AssemblerState, (input: string) => string> = {
  making: () => 'making',
  full: () => 'full',
  needsInput: (i) => `needs ${i}`,
  needsOre: () => 'needs ore',
  ready: () => 'starting',
};

const KIND_LABEL: Record<BuildKind, string> = { extractor: 'Ext', route: 'Route', upgrade: 'Upg' };

export function shortName(n: Pick<Node, 'id' | 'kind'>): string {
  return n.kind === 'probe' ? 'Probe' : n.kind === 'heart' ? 'Heart' : n.kind === 'root' ? 'Root' : n.id.toUpperCase();
}

function longName(n: Pick<Node, 'id' | 'kind' | 'prize'>, captured: boolean, rootCut: boolean): string {
  if (n.kind === 'probe') return 'Probe';
  if (n.kind === 'root') return rootCut ? 'Root (cut)' : 'Root · feeds the Heart';
  if (n.kind === 'heart') return captured ? 'Heart (yours)' : 'The Bloom heart';
  if (n.kind === 'pocket') return `Pocket ${n.id.toUpperCase()}${n.prize ? ` · ${RES_NAME[n.prize]}` : ''}`;
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
    return `${this.node}:${isGuarded(this.world, n.index) ? 'guarded' : 'open'}`;
  }

  private build(): void {
    const world = this.world;
    const n = world.nodes[this.node]!;
    this.sig = this.signature();
    this.ups = [];
    this.root.replaceChildren();
    this.root.hidden = false;
    this.root.classList.remove('world');
    this.root.scrollTop = 0;

    const head = h('div', 'sheet-head', '', this.root);
    const title = h('h2', '', longName(n, isCaptured(world), isRootCut(world)), head);
    const closeBtn = btn(head, '✕', () => this.host.close(), 'close');
    closeBtn.el.setAttribute('aria-label', 'Close');
    void title;

    if (n.kind === 'probe') this.probeSections();
    else if (isGuarded(world, n.index)) this.guardedSections(n);
    else if (n.kind === 'root') this.cutRootSections();
    else this.producerSections(n);

    this.sendSection(n);
    if (!isGuarded(world, n.index)) this.recycleSection(n);
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
    const yields = this.row(sec, 'Yields');
    const extract = this.row(sec, 'Extracting');
    const route = this.row(sec, 'Route');
    const bufRow = h('div', 'row', '', sec);
    h('span', 'lbl', 'Buffer', bufRow);
    const buf = bar(bufRow, 'buf');
    const bufText = h('span', 'val', '', bufRow);
    // The warning's room is always reserved (a hidden sizer holds the longest message), so showing it moves nothing below it.
    const warn = h('div', 'note warn idle', '', sec);
    const warnSizer = h('span', 'sizer', 'No route: this crystal goes nowhere. Build a route.', warn);
    warnSizer.setAttribute('aria-hidden', 'true');
    const warnMsg = h('span', 'msg', '', warn);

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
      setText(yields.val, st.prize ? `${RES_NAME[st.prize]} · ${fmt10(st.perExtractorPerMinX10)}/min each` : '-');
      setText(extract.val, `+${fmt10(st.extractPerMinX10)}/min`);
      if (st.route) {
        const up = st.route.pendingUpgrades > 0 ? ` (+${st.route.pendingUpgrades} queued)` : '';
        setText(route.val, `L${st.route.level}/${st.route.maxLevel} · carries ${st.route.capacityPerMin}/min${up}`);
      } else setText(route.val, st.routePending ? 'queued' : 'none');
      buf.set(st.buffer / Math.max(1, st.bufferCap));
      const backedUp = isBackedUp(this.world, node, st);
      toggleClass(buf.el, 'full', backedUp);
      setText(bufText, `${st.buffer}/${st.bufferCap}`);
      const msg = backedUp
        ? st.route
          ? 'Backed up: route at capacity. Upgrade it.'
          : 'Backed up: no route. Build one.'
        : st.noRoute
          ? `No route: this ${st.prize ? RES_NAME[st.prize].toLowerCase() : 'ore'} goes nowhere. Build a route.`
          : '';
      toggleClass(warn, 'idle', msg === '');
      setText(warnMsg, msg);
    });
  }

  // --- probe ---------------------------------------------------------------

  private probeSections(): void {
    const sys = h('div', 'note sys', '', this.root);
    this.ups.push(() => setText(sys, `System: ${systemStatus(this.world).name}`));
    const ship = this.row(this.root, 'Shipments');
    ship.el.classList.add('shipments');
    this.ups.push(() => {
      const c = campaignStatus(this.world, this.host.session.data);
      const rates = ratesX10Text(c.shipPerMinX10);
      setText(ship.val, c.shipping ? `${rates === 'nothing' ? 'none yet' : `${rates} to the stockpile`}` : isCaptured(this.world) ? 'paused: area reclaimed' : 'paused');
    });
    const yard = h('section', 'yards', '', this.root);
    h('div', 'lbl', 'Yards', yard);
    const fleetHead = h('div', 'fleet-line', '', yard);
    const yardRows = SHIP_TYPES.map((type) => this.yardRow(yard, type));
    const mining = this.row(yard, 'Probe mining');
    const asm = h('section', 'assembly', '', this.root);
    h('div', 'lbl', 'Assembly (automatic)', asm);
    const asmRows = assemblerStatus(this.world).map((r) => this.assemblerRow(asm, r.component));

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
      const ys = yardStatus(w);
      const fleet = fleetStatus(w, this.host.session.data);
      setHidden(fleetHead, fleet.cap === null);
      if (fleet.cap !== null) setText(fleetHead, fleetLine({ count: fleet.count, cap: fleet.cap, level: fleet.level, maxLevel: fleet.maxLevel }));
      ys.yards.forEach((y, i) => yardRows[i]!.update(y, w.tickRate, { count: fleet.count, cap: fleet.cap }));
      setText(mining.val, `+${ys.probeOrePerMin}/min`);
      const asms = assemblerStatus(w);
      asms.forEach((r, i) => asmRows[i]!.update(r, w.tickRate));
      setHidden(asm, !asms.some((r) => r.unlocked));

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

  /** One yard row: icon, name, an on/off toggle, the cost line and a status; hidden (with its unlock hint) until unlocked. */
  private yardRow(parent: HTMLElement, type: ShipType): { update(y: YardRow, tickRate: number, fleet: FleetCounts): void } {
    const wrap = h('div', 'yard-row', '', parent);
    wrap.dataset.yard = type;
    const hint = h('div', 'note locked-hint', unlockHint(type), parent);
    const top = h('div', 'yr-top', '', wrap);
    shipIcon(top, 24, type);
    h('b', 'yr-name', SHIP_NAME[type], top);
    const tog = btn(top, '', () => this.host.send({ type: 'setShipyard', shipType: type, on: !this.world.yards[type].on }), 'tog');
    const cost = h('div', 'yr-cost', '', wrap);
    const status = h('div', 'yr-status', '', wrap);
    const progress = bar(wrap, 'yard');
    return {
      update: (y, tickRate, fleet) => {
        const shown = y.unlocked || y.researched;
        setHidden(wrap, !shown);
        setHidden(hint, shown || type === 'drone');
        tog.set(y.on ? 'ON' : 'OFF');
        tog.el.setAttribute('aria-label', `${SHIP_NAME[type]} yard ${y.on ? 'on, tap to stop' : 'off, tap to start'}`);
        toggleClass(tog.el, 'on', y.on);
        setText(cost, `${y.cost} ore${y.component ? ` + 1 ${y.component}` : ''} · ${(y.totalTicks / tickRate).toFixed(1)} s`);
        setText(status, YARD_STATE_TEXT[y.state](y.component, fleet));
        toggleClass(status, 'bad', y.state === 'fleetFull' || y.state === 'needsComponent' || y.state === 'needsOre');
        progress.set(y.ticksLeft > 0 ? (y.totalTicks - y.ticksLeft) / y.totalTicks : 0);
      },
    };
  }

  /** One assembler row: stock/cap, recipe and status; hidden until its input has been delivered. */
  private assemblerRow(parent: HTMLElement, component: Component): { update(r: AssemblerRow, tickRate: number): void } {
    const wrap = h('div', 'yard-row asm-row', '', parent);
    wrap.dataset.assembler = component;
    const top = h('div', 'yr-top', '', wrap);
    resourceIcon(top, 22, component);
    h('b', 'yr-name', RES_NAME[component], top);
    const stock = h('span', 'yr-stock', '', top);
    const recipe = h('div', 'yr-cost', '', wrap);
    const status = h('div', 'yr-status', '', wrap);
    const progress = bar(wrap, 'build');
    return {
      update: (r, tickRate) => {
        setHidden(wrap, !r.unlocked);
        setText(stock, `${r.stock}/${r.stockCap}`);
        setText(recipe, `${r.ore} ore + ${r.inputAmount} ${r.input} · ${(r.totalTicks / tickRate).toFixed(1)} s`);
        setText(status, ASSEMBLER_STATE_TEXT[r.state](r.input));
        toggleClass(status, 'bad', r.state === 'needsInput' || r.state === 'needsOre');
        progress.set(r.ticksLeft > 0 ? (r.totalTicks - r.ticksLeft) / r.totalTicks : 0);
      },
    };
  }

  // --- guarded nodes: pockets, the Root, the heart ----------------------------

  /** The Root sheet's "Feeds the Bloom" box; returns the text element. */
  private feedsBox(parent: HTMLElement): HTMLElement {
    const box = h('div', 'feeds-box', '', parent);
    h('b', '', 'Feeds the Heart', box);
    return h('div', '', '', box);
  }

  /** A cut Root: nothing to build or fight, only a place for ships to stand. */
  private cutRootSections(): void {
    const sec = h('section', '', '', this.root);
    const msg = this.feedsBox(sec);
    this.ups.push(() => setText(msg, feedsBloomText(this.world, isCaptured(this.world))));
    const ships = this.row(sec, 'Ships here / en route');
    const node = this.node;
    this.ups.push(() => {
      const c = shipCounts(this.world);
      setText(ships.val, `${c.at[node]} / ${c.enRoute[node]}`);
    });
  }

  /** A living guarded node's sheet: prize, guards per type, ship tags, ships here, the live battle. */
  private guardedSections(n: Node): void {
    const isRoot = n.kind === 'root';
    const name = guardName(this.world, n.index);
    const isHeart = n.kind === 'heart';
    const sec = h('section', '', '', this.root);
    const prize = h('div', 'prize-line', '', sec);
    const supply = h('div', 'note supply', '', sec);
    const feeds = isRoot ? this.feedsBox(sec) : null;

    // One row per guard type: icon, count/cap, regrow, hp and damage, a thin regrow bar.
    const guardRows = (['thorn', 'spore'] as const).map((type) => {
      const wrap = h('div', 'guard-row', '', sec);
      wrap.dataset.guard = type;
      const top = h('div', 'gr-top', '', wrap);
      guardIcon(top, 22, type);
      const label = h('b', 'gr-name', '', top);
      const regrow = h('span', 'gr-regrow', '', top);
      const stats = h('div', 'gr-stats', '', wrap);
      const progress = bar(wrap, 'regrow');
      return { type, wrap, label, regrow, stats, progress };
    });

    // Your ships here: one tag per unlocked ship type, from the sim's guardian selector.
    const tagSec = h('section', 'tags', '', this.root);
    h('div', 'lbl', 'Your ships vs this guard', tagSec);
    const tagRows = SHIP_TYPES.map((type) => {
      const wrap = h('div', 'tag-row', '', tagSec);
      wrap.dataset.ship = type;
      const top = h('div', 'tr-top', '', wrap);
      shipIcon(top, 22, type);
      h('b', 'tr-name', SHIP_NAME[type], top);
      const badge = h('span', 'tag-badge', '', top);
      h('div', 'tr-phrase', COUNTER_PHRASE[type], wrap);
      return { type, wrap, badge };
    });

    const here = h('section', '', '', this.root);
    const ships = this.row(here, 'Ships here');
    const enRoute = this.row(here, 'En route');
    const hint = h('div', 'note', '', here);

    // Always shown, with its space reserved, so Retreat never appears where "Attack from" was.
    const battle = h('section', 'battle', '', this.root);
    const lines = h('div', 'lines', '', battle);
    const bLine = h('div', '', '', lines);
    const bLost = h('div', '', '', lines);
    const retreat = btn(battle, '', () => this.host.send({ type: 'sendShips', from: n.index, to: 0, counts: SEND_ALL }), 'danger');

    this.ups.push(() => {
      const w = this.world;
      const g = guardianStatus(w, n.index);
      const unlocked = unlockStatus(w);
      // Prize line.
      if (isRoot) setText(prize, 'No prize · feeds the Heart');
      else if (g.prize === null) setText(prize, '-');
      else {
        const u = g.prize === 'ice' || g.prize === 'crystal' ? UNLOCKS[g.prize] : null;
        const unlock = u ? ` · unlocks ${u.component} → ${SHIP_NAME[u.ship]}` : '';
        setText(
          prize,
          isHeart
            ? `Prize: ${RES_NAME[g.prize]} · ${g.slots} slots`
            : `Prize: ${RES_NAME[g.prize]} · ${g.slots} slots · ${fmt10(g.prizePerMinPerExtractorX10)}/min each${unlock}`,
        );
      }
      const supplyText = isHeart ? supplyLine(w) : '';
      setText(supply, supplyText);
      setHidden(supply, supplyText === '');
      if (feeds) setText(feeds, feedsBloomText(w, isCaptured(w)));
      for (const r of guardRows) {
        const row = g.guards[r.type];
        setHidden(r.wrap, row.count === 0 && row.cap === 0);
        setText(r.label, `${GUARD_NAME[r.type]} ${row.count}/${row.cap}`);
        setText(r.regrow, `regrows ${regrowText(row.regrowTicks, w.tickRate)}`);
        setText(r.stats, `${row.hp} hp · hits ${row.damage}/round · heals ${row.repairPerRound}/round`);
        r.progress.set(row.count >= row.cap ? 0 : row.regrowProgress / Math.max(1, row.regrowTicks));
      }
      for (const r of tagRows) {
        setHidden(r.wrap, !unlocked.ships[r.type]);
        const tag = g.tags[r.type].tag;
        setText(r.badge, TAG_TEXT[tag]);
        r.badge.className = `tag-badge ${tag}`;
      }
      const c = shipCounts(w);
      setText(ships.val, shipsText(c.atByType[n.index]!));
      setText(enRoute.val, shipsText(c.enRouteByType[n.index]!));
      const total = c.total;
      const r = combatRates(w, n.index, c.byType);
      setText(
        hint,
        total === 0
          ? 'No ships yet. Waves must out-strip regrowth.'
          : `All ${total} ships together: strip ${fmt10(r.killPerSecX10)} guards/s vs ${name} regrows ${fmt10(r.regrowPerSecX10)}/s.`,
      );
      const b = battleStatus(w, n.index);
      if (b) {
        setText(bLine, `Battle: you strip ${fmt10(b.killPerSecX10)} guards/s · ${name} regrows ${fmt10(b.regrowPerSecX10)}/s`);
        setText(bLost, `Ships lost so far: ${b.shipsLost} · guards stripped: ${b.guardsKilled}`);
      } else {
        setText(bLine, 'No battle running.');
        setText(bLost, '');
      }
      const parked = c.at[n.index]!;
      retreat.set(`Retreat to Probe · ${parked}`, parked > 0);
    });
  }

  // --- send ships here, rally ----------------------------------------------

  private sendSection(n: Node): void {
    const sec = h('section', 'send', '', this.root);
    const title = h('div', 'lbl', '', sec);
    const nodes = this.world.nodes;
    const sources: Array<{ node: number; row: HTMLElement; b: Btn; choose: Btn }> = [];
    const attack = (): boolean => isGuarded(this.world, n.index);
    for (const m of nodes) {
      if (m.index === n.index) continue;
      const row = h('div', 'send-row', '', sec);
      const b = btn(row, '', () => this.host.send({ type: 'sendShips', from: m.index, to: n.index, counts: SEND_ALL }), 'send-btn');
      // "Choose…" opens the per-type send panel (DESIGN.md H3 "Attack").
      const choose = btn(row, 'Choose…', () => this.host.choose(m.index, n.index), 'choose-btn');
      sources.push({ node: m.index, row, b, choose });
    }
    // One press, one tick: every source's order goes in a single batch (see Session.sendAll).
    const all = btn(sec, '', () => {
      const at = shipCounts(this.world).at;
      const orders: Input[] = [];
      for (const s of sources) if (at[s.node]! > 0) orders.push({ type: 'sendShips', from: s.node, to: n.index, counts: SEND_ALL });
      this.host.sendAll(orders);
    }, 'send-btn all');
    this.ups.push(() => {
      const c = shipCounts(this.world);
      let total = 0;
      let live = 0;
      for (const s of sources) {
        const k = c.at[s.node]!;
        total += k;
        if (k > 0) live++;
        setHidden(s.row, k === 0);
        s.b.set(`${attack() ? 'Attack with all from' : 'Send all from'} ${shortName(nodes[s.node]!)} · ${k}`);
      }
      setHidden(all.el, live < 2);
      all.set(`${attack() ? 'Attack with all sources' : 'Send from all sources'} · ${total}`);
      setHidden(sec, total === 0);
      setText(title, attack() ? `Attack ${guardName(this.world, n.index)}` : 'Send ships here');
    });
  }

  /**
   * H5 "Recycle…": scrap the ships parked at this node for part of their ore (to change the mix at the limit). Shown only while ships are
   * parked here; never on a living guarded node (no recycling in a battle). One tap opens the panel.
   */
  private recycleSection(n: Node): void {
    const sec = h('section', 'recycle', '', this.root);
    const b = btn(sec, '', () => this.host.recycle(n.index), 'recycle-btn');
    recycleIcon(b.el, 22);
    const label = h('span', '', '', b.el);
    this.ups.push(() => {
      const k = shipCounts(this.world).at[n.index]!;
      setHidden(sec, k === 0);
      setText(label, `Recycle… · ${k} here`);
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
