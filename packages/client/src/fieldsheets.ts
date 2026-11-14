/**
 * H7 field sheets: the probe sheet (radar readout, five weight rows, rally, recycle) and the rock sheet (Mine / Stop, extractor pips,
 * haulers, buffer, delivered, raid rank). Built once when a node is selected; `update()` refreshes text, bars and enabled states in
 * place, as the other sheets do. Every number comes from `allocStatus` and `rockStatus`.
 */
import { BUILD_TYPES, allocStatus, econAtByType, fleetStatus, isValidInput, rockStatus, shipCounts, type BuildType, type Input, type SimData, type World } from '@factory4x/sim';
import { bar, btn, h, setHidden, setText, toggleClass } from './dom.ts';
import {
  BACKED_UP_TEXT,
  BUILD_NAME,
  RAID_RANK_TEXT,
  allocCostText,
  allocStateText,
  deliveredText,
  incomeText,
  pipText,
  radarLabel,
} from './fieldreport.ts';
import { buildIcon, paintRadar, recycleIcon } from './icons.ts';

export interface FieldSheetHost {
  world(): World;
  data(): SimData;
  send(input: Input): void;
  /** Opens the Recycle panel for the ships parked at `node`. */
  recycle(node: number): void;
  close(): void;
}

/** The radar's box, CSS px. Display only. */
export const RADAR_W = 148;
export const RADAR_H = 124;

/** The five state lines the probe sheet can show, for a test that has to reach each one. */
export const ROW_SELECTOR = '.fp-row';

/** Probe sheet: returns its per-refresh updaters. */
export function buildProbeSheet(root: HTMLElement, host: FieldSheetHost, ups: Array<() => void>): void {
  const top = h('div', 'fp-top', '', root);
  const radar = h('canvas', 'fp-radar', '', top);
  radar.setAttribute('role', 'img');
  const side = h('div', 'fp-side', '', top);
  const head = h('div', 'fp-head', '', side);
  h('h2', '', 'Probe', head);
  const closeBtn = btn(head, '✕', () => host.close(), 'close');
  closeBtn.el.setAttribute('aria-label', 'Close');
  const money = h('div', 'fp-money', '', side);
  const rally = btn(side, '', () => host.send({ type: 'setRally', node: 0 }), 'rally');
  const recycle = btn(side, '', () => host.recycle(0), 'recycle-btn');
  recycleIcon(recycle.el, 20);
  const recycleLabel = h('span', '', '', recycle.el);

  const rows = BUILD_TYPES.map((type) => {
    const wrap = h('div', 'fp-row', '', root);
    wrap.dataset.type = type;
    buildIcon(wrap, 26, type);
    const text = h('div', 'fp-text', '', wrap);
    const name = h('b', 'fp-name', BUILD_NAME[type], text);
    const cost = h('small', 'fp-cost', '', name);
    const state = h('div', 'fp-state', '', text);
    const minus = btn(wrap, '−', () => step(type, -1), 'fp-step');
    minus.el.setAttribute('aria-label', `Less ${BUILD_NAME[type]}`);
    const weight = h('b', 'fp-w', '', wrap);
    weight.setAttribute('aria-label', `${BUILD_NAME[type]} weight`);
    const plus = btn(wrap, '+', () => step(type, 1), 'fp-step');
    plus.el.setAttribute('aria-label', `More ${BUILD_NAME[type]}`);
    return { type, wrap, cost, state, minus, weight, plus };
  });

  // Reads the weight when tapped, so a stale tap never overshoots.
  function step(type: BuildType, d: number): void {
    const row = allocStatus(host.world(), host.data()).rows.find((r) => r.type === type)!;
    host.send({ type: 'setAlloc', shipType: type, weight: row.weight + d });
  }

  let radarSig = '';
  ups.push(() => {
    const w = host.world();
    const st = allocStatus(w, host.data());
    const sig = `${st.maxWeight}:${st.rows.map((r) => r.weight).join(',')}`;
    if (sig !== radarSig) {
      radarSig = sig;
      paintRadar(radar, RADAR_W, RADAR_H, st.rows.map((r) => r.weight), st.maxWeight);
      radar.setAttribute('aria-label', radarLabel(st.rows));
    }
    setText(money, incomeText(st.stockOre, st.incomePerMin));
    const here = w.rally === 0;
    rally.set(here ? 'Rally set' : 'Rally here', !here);
    toggleClass(rally.el, 'on', here);
    const parked = shipCounts(w).at[0]! + econAtByType(w, 0).extractor + econAtByType(w, 0).hauler;
    setHidden(recycle.el, parked === 0);
    setText(recycleLabel, `Recycle… ${parked}`);
    for (const r of rows) {
      const row = st.rows.find((x) => x.type === r.type)!;
      setText(r.cost, ` ${allocCostText(row)}`);
      setText(r.state, allocStateText(row));
      toggleClass(r.state, 'bad', row.state === 'locked' || row.state === 'waitingResource' || row.state === 'fleetFull');
      toggleClass(r.state, 'building', row.state === 'building');
      setText(r.weight, String(row.weight));
      r.minus.set('−', row.weight > 0);
      r.plus.set('+', row.weight < st.maxWeight);
      toggleClass(r.wrap, 'off', row.weight === 0);
    }
    // The fleet line rides in the money line's tooltip, so the chip and the sheet agree.
    const f = fleetStatus(w, host.data());
    money.title = f.cap === null ? '' : `Fleet ${f.count}/${f.cap}`;
  });
}

/** Rock sheet (an asteroid, or a captured pocket or hive): returns nothing, adds its updaters to `ups`. */
export function buildRockSheet(root: HTMLElement, host: FieldSheetHost, node: number, ups: Array<() => void>): void {
  const sec = h('section', 'rock', '', root);
  const mine = btn(sec, '', () => {
    const on = rockStatus(host.world(), node).mine;
    host.send({ type: 'setMine', node, on: !on });
  }, 'mine-btn');
  const pipRow = h('div', 'pips', '', sec);
  const n = host.world().nodes[node]!;
  const pips: HTMLElement[] = [];
  for (let i = 0; i < n.slots; i++) pips.push(h('span', 'pip', '', pipRow));
  const pipLabel = h('span', 'pip-text', '', pipRow);
  const haulers = h('div', 'row', '', sec);
  h('span', 'lbl', 'Haulers', haulers);
  const haulersVal = h('span', 'val', '', haulers);
  const bufRow = h('div', 'row', '', sec);
  h('span', 'lbl', 'Buffer', bufRow);
  const buf = bar(bufRow, 'buf');
  const bufText = h('span', 'val', '', bufRow);
  const delivered = h('div', 'row', '', sec);
  h('span', 'lbl', 'Delivered', delivered);
  const deliveredVal = h('span', 'val', '', delivered);
  // The warnings' room is always reserved (a hidden sizer holds the longest text), so showing one moves nothing below it.
  const notes = h('div', 'note warn idle rock-note', '', sec);
  const sizer = h('span', 'sizer', `${BACKED_UP_TEXT}\n${RAID_RANK_TEXT}`, notes);
  sizer.setAttribute('aria-hidden', 'true');
  const msgs = h('div', 'msg', '', notes);
  const backed = h('div', 'backed', '', msgs);
  const rank = h('div', 'rank', '', msgs);

  ups.push(() => {
    const w = host.world();
    const st = rockStatus(w, node);
    const input: Input = { type: 'setMine', node, on: !st.mine };
    mine.set(st.mine ? 'Stop mining' : 'Mine this rock', isValidInput(w, host.data(), input));
    toggleClass(mine.el, 'on', st.mine);
    const docked = st.docked + st.freeExtractors;
    pips.forEach((p, i) => {
      toggleClass(p, 'on', i < docked);
      toggleClass(p, 'queued', i >= docked && i < docked + st.inFlight);
    });
    setText(pipLabel, pipText(st));
    setText(haulersVal, String(st.haulers));
    buf.set(st.buffer / Math.max(1, st.bufferCap));
    toggleClass(buf.el, 'full', st.backedUp);
    setText(bufText, `${st.buffer}/${st.bufferCap}`);
    setText(deliveredVal, deliveredText(st));
    const backedMsg = st.backedUp && st.mine ? BACKED_UP_TEXT : '';
    const rankMsg = st.raidRank === 1 && st.mine ? RAID_RANK_TEXT : '';
    setText(backed, backedMsg);
    setText(rank, rankMsg);
    toggleClass(notes, 'idle', backedMsg === '' && rankMsg === '');
  });
}
