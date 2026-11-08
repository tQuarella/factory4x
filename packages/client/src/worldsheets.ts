/**
 * Overworld sheets (DESIGN.md H4 "Client: screens and phone UI"): the area sheet (tap an area) and the research sheet.
 * Built once per open; `update()` refreshes text and enabled states in place, so a finger that lands on a button is
 * still on it when it lifts. Every number is a selector result or a live tunable.
 */
import {
  RAW_RESOURCES,
  areaStatus,
  landingEffects,
  researchStatus,
  type AreaGuardedNode,
  type AreaStatus,
  type Input,
  type RawResource,
  type ResearchRow,
  type World,
} from '@factory4x/sim';
import { bar, btn, h, setHidden, setText, toggleClass, type Btn } from './dom.ts';
import { mmss } from './format.ts';
import { iconCanvas, paintIcon, researchIcon, resourceIcon, shipIcon } from './icons.ts';
import { drawGuardRing, drawProbeCore } from './placeholders.ts';
import {
  COUNTER_PHRASE,
  RES_NAME,
  TAG_TEXT,
  TIER_NAME,
  effectText,
  exportX10,
  purchaseNotice,
  ratesX10Text,
  researchBlock,
  tripleText,
} from './report.ts';
import type { Session } from './session.ts';

export interface WorldHost {
  session: Session;
  send(input: Input): void;
  /** Land in an area (the Land button). */
  land(area: number): void;
  /** A short notice in the notices strip. */
  notice(text: string): void;
  close(): void;
}

const GUARD_LABEL = (c: { thorn: number; spore: number }): string => {
  const parts: string[] = [];
  if (c.thorn > 0) parts.push(`${c.thorn} Thorn`);
  if (c.spore > 0) parts.push(`${c.spore} Spore`);
  return parts.length > 0 ? parts.join(' ') : 'no guards';
};

/** The state line of the area sheet: "Open", "Held: reclaim a neighbour first", "Reclaimed in 8:12". */
export function areaStateText(st: Pick<AreaStatus, 'state' | 'record'>, tickRate: number): string {
  if (st.state === 'reclaimed') return `Reclaimed${st.record.reclaimPlayTicks === null ? '' : ` in ${mmss(Math.floor(st.record.reclaimPlayTicks / tickRate))}`}`;
  if (st.state === 'open') return 'Open';
  if (st.state === 'active') return 'You are here';
  return 'Held: reclaim a neighbour first';
}

/** The row of a guarded node in the area sheet. */
export function guardedRowText(g: AreaGuardedNode, hasRoot: boolean): { title: string; counts: string; starved: string } {
  const prize = g.prize ? ` · ${RES_NAME[g.prize]}` : '';
  const title = g.kind === 'pocket' ? `Pocket ${g.id.toUpperCase()}${prize}` : g.kind === 'root' ? 'Root' : `Heart${prize}`;
  let counts = GUARD_LABEL(g.caps);
  if (g.kind === 'heart' && hasRoot) counts += ' · Root-fed';
  if (g.kind === 'root') counts += ' · feeds the Heart';
  const starved = g.starvedCaps ? `Root cut: ${GUARD_LABEL(g.starvedCaps)}` : '';
  return { title, counts, starved };
}

export class AreaSheet {
  private readonly root: HTMLElement;
  private readonly host: WorldHost;
  private area = -1;
  private sig = '';
  private land: Btn | null = null;

  constructor(root: HTMLElement, host: WorldHost) {
    this.root = root;
    this.host = host;
  }

  get selected(): number | null {
    return this.area < 0 ? null : this.area;
  }

  private get world(): World {
    return this.host.session.world;
  }

  open(area: number): void {
    this.area = area;
    this.build();
  }

  close(): void {
    this.area = -1;
    this.sig = '';
    this.land = null;
    this.root.replaceChildren();
    this.root.classList.remove('world');
    this.root.hidden = true;
  }

  private signature(): string {
    const w = this.world;
    return `${this.area}|${JSON.stringify(areaStatus(w, this.host.session.data, this.area))}|${w.tun['shipments.pct']}`;
  }

  update(): void {
    if (this.area < 0) return;
    if (this.signature() !== this.sig) this.build();
  }

  private build(): void {
    const world = this.world;
    const data = this.host.session.data;
    const st = areaStatus(world, data, this.area);
    this.sig = this.signature();
    this.root.replaceChildren();
    this.root.hidden = false;
    this.root.classList.add('world');
    this.root.scrollTop = 0;

    const head = h('div', 'sheet-head', '', this.root);
    h('h2', '', st.name, head);
    const closeBtn = btn(head, '✕', () => this.host.close(), 'close');
    closeBtn.el.setAttribute('aria-label', 'Close');

    const state = h('div', 'area-state', '', this.root);
    h('span', 'area-tier', TIER_NAME[st.tier] ?? `Tier ${st.tier}`, state);
    const stateText = h('span', `area-status ${st.state}`, areaStateText(st, data.tickRate), state);
    stateText.dataset.state = st.state;

    const flow = h('section', 'area-flow', '', this.root);
    const pct = world.tun['shipments.pct'];
    if (st.state === 'reclaimed') h('div', 'note', `Haul paid: ${tripleText(st.haul)}`, flow);
    else h('div', 'note haul', `Reclaim to haul ${tripleText(st.haul)}`, flow);
    const exp = exportX10(st.export, pct);
    if (pct === 0) h('div', 'note', 'Shipments are off (shipments.pct 0), so this area pays its haul only.', flow);
    else h('div', 'note export', `${st.state === 'reclaimed' ? 'Ships' : 'then ships'} ${ratesX10Text(exp).replace(/^\+/, '').replace(/ \+/g, ' · ')} while you play elsewhere`, flow);

    const guards = h('section', 'area-guards', '', this.root);
    h('div', 'lbl', 'Guarded nodes', guards);
    for (const g of st.guarded) {
      const row = h('div', 'guard-row area-guard', '', guards);
      row.dataset.node = g.id;
      const top = h('div', 'gr-top', '', row);
      const total = g.caps.thorn + g.caps.spore;
      if (total > 0) {
        iconCanvas(top, 26, (ctx, r) => drawGuardRing(ctx, r, g.caps.thorn / total, g.caps.spore / total, 0));
      }
      const text = guardedRowText(g, st.hasRoot);
      h('b', 'gr-name', text.title, top);
      h('div', 'gr-stats', text.counts, row);
      if (text.starved) h('div', 'gr-stats', text.starved, row);
    }

    const heart = st.guarded[st.guarded.length - 1];
    const heartGuards = heart ? heart.caps.thorn + heart.caps.spore : 0;
    const tags = h('section', 'area-tags', '', this.root);
    if (heartGuards === 0) {
      h('div', 'note', 'No guards: the first ship to arrive reclaims it.', tags);
    } else {
      h('div', 'lbl', 'Heart counters', tags);
      for (const ship of ['lancer', 'flak'] as const) {
        const t = st.heartTags[ship];
        const row = h('div', 'tag-row area-tag', '', tags);
        row.dataset.ship = ship;
        shipIcon(row, 22, ship);
        const name = h('span', 'tr-name', ship === 'lancer' ? 'Lancer' : 'Flak', row);
        if (!t.researched) h('small', 'not-researched', ' (not researched)', name);
        const badge = h('span', `tag-badge ${t.tag}`, TAG_TEXT[t.tag], row);
        badge.title = COUNTER_PHRASE[ship];
      }
    }

    const foot = h('div', 'sheet-foot', '', this.root);
    if (st.state === 'reclaimed') {
      h('div', 'note', 'Reclaimed: nothing more to do here.', foot);
      this.land = null;
    } else {
      const area = this.area;
      this.land = btn(foot, '', () => this.host.land(area), 'primary land');
      this.land.set(st.state === 'open' ? 'Land' : 'Locked', st.state === 'open');
    }
  }
}

// ---------------------------------------------------------------------------

interface CostChips {
  chips: Record<RawResource, { el: HTMLElement; num: HTMLElement }>;
  set(cost: Readonly<Record<RawResource, number>> | null, have: Readonly<Record<RawResource, number>>): void;
}

function costChips(parent: HTMLElement): CostChips {
  const wrap = h('div', 'cost-chips', '', parent);
  const chips = {} as CostChips['chips'];
  for (const r of RAW_RESOURCES) {
    const el = h('span', 'cost-chip', '', wrap);
    el.dataset.res = r;
    resourceIcon(el, 16, r);
    chips[r] = { el, num: h('b', '', '', el) };
  }
  return {
    chips,
    set(cost, have) {
      for (const r of RAW_RESOURCES) {
        const c = chips[r];
        const need = cost === null ? 0 : cost[r];
        setHidden(c.el, need <= 0);
        setText(c.num, String(need));
        toggleClass(c.el, 'short', need > have[r]);
      }
      setHidden(wrap, cost === null);
    },
  };
}

interface ResearchCard {
  row: HTMLElement;
  update(r: ResearchRow, world: World): void;
}

export class ResearchSheet {
  private readonly root: HTMLElement;
  private readonly host: WorldHost;
  private cards: ResearchCard[] = [];
  private core: { canvas: HTMLCanvasElement; frac: number } | null = null;
  private built = false;

  constructor(root: HTMLElement, host: WorldHost) {
    this.root = root;
    this.host = host;
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  private get world(): World {
    return this.host.session.world;
  }

  open(): void {
    if (!this.built) this.build();
    this.root.hidden = false;
    this.root.scrollTop = 0;
    this.update();
  }

  close(): void {
    this.root.hidden = true;
  }

  /** "Extraction 1", or just "Lancer design" for a one-level item. */
  private itemLabel(id: string, level: number): string {
    const item = this.host.session.data.research.find((r) => r.id === id);
    return item && item.levels.length > 1 ? `${item.name} ${level}` : (item?.name ?? id);
  }

  private areaName(id: string): string {
    return this.host.session.data.map.areas.find((a) => a.id === id)?.name ?? id;
  }

  private buy(item: number): void {
    const before = researchStatus(this.world, this.host.session.data)[item]!;
    this.host.send({ type: 'buyResearch', item });
    const w = this.world;
    const after = researchStatus(w, this.host.session.data)[item]!;
    if (after.level > before.level) {
      this.host.notice(purchaseNotice(after, landingEffects(w).rigNodes));
    }
    this.update();
  }

  private build(): void {
    this.built = true;
    this.root.replaceChildren();
    const data = this.host.session.data;
    const head = h('div', 'sheet-head', '', this.root);
    h('h2', '', 'Research', head);
    const closeBtn = btn(head, '✕', () => this.host.close(), 'close');
    closeBtn.el.setAttribute('aria-label', 'Close research');
    h('div', 'note', 'Bought with the stockpile. Reclaimed areas ship home while you play elsewhere.', this.root);

    const order = ['core', 'lancer', 'flak', 'opening', 'extract', 'rigs', 'yards'];
    const ordered = data.research
      .map((item, index) => ({ item, index }))
      .sort((a, b) => order.indexOf(a.item.id) - order.indexOf(b.item.id));
    this.cards = [];
    for (const { item, index } of ordered) {
      if (item.id === 'core') this.cards.push(this.coreCard(index));
      else if (item.kind === 'design') this.cards.push(this.designCard(index));
      else this.cards.push(this.grindRow(index));
    }
  }

  private requires(parent: HTMLElement): { set(r: ResearchRow, world: World): void } {
    const el = h('div', 'note req', '', parent);
    return {
      set: (r, world) => {
        const item = this.host.session.data.research[r.index]!;
        const parts = item.requires.map((q) => {
          if ('item' in q) {
            const ok = (world.campaign.research[q.item] ?? 0) >= q.level;
            return `${this.itemLabel(q.item, q.level)}${ok ? ' ✓' : ''}`;
          }
          const idx = this.host.session.data.map.areas.findIndex((a) => a.id === q.area);
          const ok = world.campaign.areas[idx]?.reclaimedTick != null;
          return `${this.areaName(q.area)} reclaimed${ok ? ' ✓' : ''}`;
        });
        setHidden(el, parts.length === 0);
        setText(el, parts.length > 0 ? `Needs: ${parts.join(', ')}` : '');
      },
    };
  }

  private action(parent: HTMLElement, index: number, verb: string): { set(r: ResearchRow): void } {
    const b = btn(parent, verb, () => this.buy(index), 'primary buy');
    b.el.dataset.item = this.host.session.data.research[index]!.id;
    return {
      set: (r) => {
        const can = r.canBuy;
        const label = can ? verb : r.cost === null ? 'Maxed' : researchBlock(r, (id, level) => this.itemLabel(id, level), (id) => this.areaName(id));
        b.set(label, can);
        toggleClass(b.el, 'blocked', !can);
      },
    };
  }

  private coreCard(index: number): ResearchCard {
    const row = h('section', 'rcard core', '', this.root);
    row.dataset.item = 'core';
    const top = h('div', 'rc-top', '', row);
    const canvas = iconCanvas(top, 56, (ctx, r) => drawProbeCore(ctx, r, 0, 0));
    this.core = { canvas, frac: 0 };
    const text = h('div', 'rc-text', '', top);
    h('b', 'rc-name', this.host.session.data.research[index]!.name, text);
    h('div', 'note', 'Launches the new probe: the end of this system.', text);
    const reqs = this.requires(row);
    const needs: Array<{ res: RawResource; num: HTMLElement; fill: { set(f: number): void } }> = [];
    for (const r of RAW_RESOURCES) {
      const line = h('div', 'need-row', '', row);
      line.dataset.res = r;
      resourceIcon(line, 18, r);
      const num = h('span', 'need-num', '', line);
      needs.push({ res: r, num, fill: bar(line, 'build') });
    }
    const act = this.action(row, index, 'Launch the probe');
    return {
      row,
      update: (r, world) => {
        reqs.set(r, world);
        const have = world.campaign.stockpile;
        let got = 0;
        let want = 0;
        for (const n of needs) {
          const need = r.cost === null ? 0 : r.cost[n.res];
          const line = n.num.parentElement!;
          setHidden(line, need <= 0);
          setText(n.num, `${Math.min(have[n.res], need)} / ${need}`);
          n.fill.set(need <= 0 ? 1 : have[n.res] / need);
          got += Math.min(have[n.res], need);
          want += need;
        }
        const frac = r.level > 0 ? 1 : want > 0 ? got / want : 0;
        if (this.core && Math.abs(this.core.frac - frac) > 0.02) {
          this.core.frac = frac;
          paintIcon(this.core.canvas, 56, (ctx, rad) => drawProbeCore(ctx, rad, 0, frac));
        }
        act.set(r);
      },
    };
  }

  private designCard(index: number): ResearchCard {
    const item = this.host.session.data.research[index]!;
    const row = h('section', 'rcard design', '', this.root);
    row.dataset.item = item.id;
    const top = h('div', 'rc-top', '', row);
    researchIcon(top, 56, item.id);
    const text = h('div', 'rc-text', '', top);
    h('b', 'rc-name', item.name, text);
    const phrase = item.id === 'lancer' || item.id === 'flak' ? COUNTER_PHRASE[item.id] : '';
    h('div', 'rc-phrase', phrase, text);
    const eff = h('div', 'note', '', text);
    const chips = costChips(row);
    const reqs = this.requires(row);
    const act = this.action(row, index, 'Research');
    return {
      row,
      update: (r, world) => {
        setText(eff, effectText(r, world.tun, world.tickRate));
        chips.set(r.cost, world.campaign.stockpile);
        reqs.set(r, world);
        act.set(r);
      },
    };
  }

  private grindRow(index: number): ResearchCard {
    const item = this.host.session.data.research[index]!;
    const row = h('section', 'rcard grind', '', this.root);
    row.dataset.item = item.id;
    const top = h('div', 'rc-top', '', row);
    researchIcon(top, 32, item.id);
    const text = h('div', 'rc-text', '', top);
    const nameLine = h('div', 'rc-nameline', '', text);
    h('b', 'rc-name', item.name, nameLine);
    const pips = h('span', 'rc-level', '', nameLine);
    const eff = h('div', 'note', '', text);
    const reqs = this.requires(row);
    const bottom = h('div', 'rc-bottom', '', row);
    const chips = costChips(bottom);
    const act = this.action(bottom, index, 'Buy');
    return {
      row,
      update: (r, world) => {
        setText(pips, `${r.level}/${r.maxLevel}`);
        setText(eff, effectText(r, world.tun, world.tickRate));
        chips.set(r.cost, world.campaign.stockpile);
        reqs.set(r, world);
        act.set(r);
      },
    };
  }

  update(): void {
    if (!this.isOpen) return;
    const w = this.world;
    const rows = researchStatus(w, this.host.session.data);
    for (const card of this.cards) {
      const id = card.row.dataset.item;
      const r = rows.find((x) => x.id === id);
      if (r) card.update(r, w);
    }
  }
}
