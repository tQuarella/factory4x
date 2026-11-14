/**
 * H7 field sheets: the probe sheet (radar readout, five weight rows, rally, recycle) and the rock sheet (Mine / Stop, extractor pips,
 * haulers, buffer, delivered, raid rank). Built once when a node is selected; `update()` refreshes text, bars and enabled states in
 * place, as the other sheets do. Every number comes from `allocStatus` and `rockStatus`.
 */
import { BUILD_TYPES, allocStatus, econAtByType, isValidInput, raidStatus, rockStatus, shipCounts, type BuildType, type Input, type SimData, type World } from '@factory4x/sim';
import { bar, btn, h, setHidden, setText, toggleClass } from './dom.ts';
import {
  BACKED_UP_TEXT,
  BUILD_NAME,
  RADAR_NOTE,
  RAID_HELD_TEXT,
  RAID_RANK_TEXT,
  allocCostText,
  allocStateText,
  deliveredText,
  haulerRowText,
  pctText,
  pipText,
  radarLabel,
  raidRockText,
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

/** The radar's box, CSS px. Display only. It is the sheet's header, so it is as short as the Rally and Close buttons beside it. */
export const RADAR_W = 140;
export const RADAR_H = 104;

/** Probe sheet: builds the radar header and the five weight rows into `root` and pushes its per-refresh updater onto `ups`. */
export function buildProbeSheet(root: HTMLElement, host: FieldSheetHost, ups: Array<() => void>): void {
  const top = h('div', 'fp-top', '', root);
  const radar = h('canvas', 'fp-radar', '', top);
  radar.setAttribute('role', 'img');
  const side = h('div', 'fp-side', '', top);
  const head = h('div', 'fp-head', '', side);
  h('h2', '', 'Probe', head);
  const closeBtn = btn(head, '✕', () => host.close(), 'close');
  closeBtn.el.setAttribute('aria-label', 'Close');
  // Rally and Recycle sit side by side under the title, so the header is no taller than the radar. Recycle shows only with ships parked.
  const actions = h('div', 'fp-actions', '', side);
  const rally = btn(actions, '', () => host.send({ type: 'setRally', node: 0 }), 'rally');
  const recycle = btn(actions, '', () => host.recycle(0), 'recycle-btn');
  recycleIcon(recycle.el, 20);
  const recycleLabel = h('span', '', '', recycle.el);

  // H8: one line says what the weights mean, between the radar and the rows.
  h('div', 'note fp-note', RADAR_NOTE, root);

  const rows = BUILD_TYPES.map((type) => {
    const wrap = h('div', 'fp-row', '', root);
    wrap.dataset.type = type;
    buildIcon(wrap, 26, type);
    const text = h('div', 'fp-text', '', wrap);
    h('b', 'fp-name', BUILD_NAME[type], text);
    const state = h('div', 'fp-state', '', text);
    const minus = btn(wrap, '−', () => step(type, -1), 'fp-step');
    minus.el.setAttribute('aria-label', `Less ${BUILD_NAME[type]}`);
    // "3 · 30%": the weight, and the share of income it asks for (H8). The number keeps its own element.
    const wv = h('span', 'fp-wv', '', wrap);
    const weight = h('b', 'fp-w', '', wv);
    weight.setAttribute('aria-label', `${BUILD_NAME[type]} weight`);
    const pct = h('small', 'fp-pct', '', wv);
    const plus = btn(wrap, '+', () => step(type, 1), 'fp-step');
    plus.el.setAttribute('aria-label', `More ${BUILD_NAME[type]}`);
    return { type, wrap, state, minus, weight, pct, plus };
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
    const here = w.rally === 0;
    rally.set(here ? 'Rally set' : 'Rally here', !here);
    toggleClass(rally.el, 'on', here);
    const parked = shipCounts(w).at[0]! + econAtByType(w, 0).extractor + econAtByType(w, 0).hauler;
    setHidden(recycle.el, parked === 0);
    setText(recycleLabel, `Recycle… ${parked}`);
    for (const r of rows) {
      const row = st.rows.find((x) => x.type === r.type)!;
      r.wrap.title = `${BUILD_NAME[r.type]}: ${allocCostText(row)}`;
      setText(r.state, allocStateText(row));
      toggleClass(r.state, 'bad', row.state === 'locked' || row.state === 'waitingResource' || row.state === 'fleetFull');
      toggleClass(r.state, 'building', row.state === 'building');
      setText(r.weight, String(row.weight));
      setText(r.pct, pctText(row));
      r.minus.set('−', row.weight > 0);
      r.plus.set('+', row.weight < st.maxWeight);
      toggleClass(r.wrap, 'off', row.weight === 0);
    }
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
  const haulers = h('div', 'row haulers-row', '', sec);
  h('span', 'lbl', 'Haulers', haulers);
  const haulersVal = h('span', 'val', '', haulers);
  // H8: the per-rock hauler count. −, + and Auto (each 44 px) set `haulerSet`; Auto clears it. Hidden when haulers aren't staffed by need.
  const stepper = h('div', 'hstep', '', sec);
  const setCount = (to: number | null): void => host.send({ type: 'setHaulers', node, count: to });
  // Each tap reads the count as it is now, so a stale tap never overshoots.
  const base = (): number => {
    const r = rockStatus(host.world(), node);
    return r.haulerSet ?? r.haulerNeed;
  };
  const less = btn(stepper, '−', () => setCount(base() - 1), 'h-step');
  less.el.setAttribute('aria-label', 'Fewer haulers');
  const more = btn(stepper, '+', () => setCount(base() + 1), 'h-step');
  more.el.setAttribute('aria-label', 'More haulers');
  const auto = btn(stepper, 'Auto', () => setCount(null), 'h-auto');
  auto.el.setAttribute('aria-label', 'Haulers: Auto');
  const bufRow = h('div', 'row', '', sec);
  h('span', 'lbl', 'Buffer', bufRow);
  const buf = bar(bufRow, 'buf');
  const bufText = h('span', 'val', '', bufRow);
  const delivered = h('div', 'row', '', sec);
  h('span', 'lbl', 'Delivered', delivered);
  const deliveredVal = h('span', 'val', '', delivered);
  // The warnings' room is always reserved (a hidden sizer holds the longest text), so showing one moves nothing below it.
  const notes = h('div', 'note warn idle rock-note', '', sec);
  const sizer = h('span', 'sizer', `${BACKED_UP_TEXT}\n${RAID_RANK_TEXT}\n${RAID_HELD_TEXT}`, notes);
  sizer.setAttribute('aria-hidden', 'true');
  const msgs = h('div', 'msg', '', notes);
  const backed = h('div', 'backed', '', msgs);
  const rank = h('div', 'rank', '', msgs);
  // H8: the raid on this rock (replaces the rank line, which says the same thing sooner), and the haulers it holds at the probe.
  const raid = h('div', 'raid', '', msgs);
  const held = h('div', 'held', '', msgs);

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
    const byNeed = w.tun['hauler.autoNeed'] === 1;
    setHidden(stepper, !byNeed);
    setText(haulersVal, byNeed ? haulerRowText(st) : String(st.haulers));
    if (byNeed) {
      const cur = st.haulerSet ?? st.haulerNeed;
      less.set('−', cur > 0);
      more.set('+', cur < w.tun['rock.haulerMax']);
      auto.set('Auto', st.haulerSet !== null);
    }
    buf.set(st.buffer / Math.max(1, st.bufferCap));
    toggleClass(buf.el, 'full', st.backedUp);
    setText(bufText, `${st.buffer}/${st.bufferCap}`);
    setText(deliveredVal, deliveredText(st));
    const backedMsg = st.backedUp && st.mine ? BACKED_UP_TEXT : '';
    const rs = raidStatus(w);
    const raidOn = st.raidTarget || (rs.target === node && (rs.phase === 'muster' || rs.phase === 'out' || rs.phase === 'fight'));
    const raidMix = rs.phase === 'muster' ? rs.planned : rs.raiders.thorn + rs.raiders.spore > 0 ? rs.raiders : rs.planned;
    const raidMsg = raidOn ? raidRockText(rs.phase, raidMix) : '';
    const rankMsg = st.raidRank === 1 && st.mine && !raidOn ? RAID_RANK_TEXT : '';
    const heldMsg = st.haulersHeld ? RAID_HELD_TEXT : '';
    setText(backed, backedMsg);
    setText(rank, rankMsg);
    setText(raid, raidMsg);
    setText(held, heldMsg);
    toggleClass(notes, 'idle', backedMsg === '' && rankMsg === '' && raidMsg === '' && heldMsg === '');
  });
}
