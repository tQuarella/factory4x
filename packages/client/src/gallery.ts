/** Static readability gallery (not linked from the game). Owned by Art Direction. */
import { palette } from './palette.ts';
import {
  type ResourceKind,
  type AreaNodeState,
  type LaneState,
  type ResearchIconId,
  drawAreaNode,
  drawAsteroid,
  drawExtractor,
  drawFleetIcon,
  drawHauler,
  drawMineBadge,
  drawRadar,
  drawRaidMarker,
  drawRaidBadge,
  drawDragGhost,
  drawDragLine,
  drawDropHighlight,
  drawDropTag,
  drawSplitPulse,
  drawGuardRing,
  drawHitFlash,
  drawLane,
  drawLockBadge,
  drawRelayIcon,
  drawRelayMark,
  drawBandPill,
  drawBandDivider,
  type LaneMode,
  drawPocket,
  drawPod,
  drawProbe,
  drawProbeCore,
  drawRallyFlag,
  drawRecycleIcon,
  drawResearchIcon,
  drawStockpileIcon,
  drawRichNode,
  drawResourceIcon,
  drawRoute,
  drawRoot,
  drawShip,
  drawSpore,
  drawThorn,
  drawVine,
  drawWiltingThorn,
} from './placeholders.ts';

type Ctx = CanvasRenderingContext2D;
type Entry = { label: string; draw: (ctx: Ctx, r: number) => void; strip?: boolean; h?: number };

const T = 1.3;

function wiltSeq(c: Ctx, r: number): void {
  [0, 0.33, 0.66, 0.9].forEach((f, i) => {
    c.save();
    c.translate((i - 1.5) * r * 0.9, -r * 0.3);
    drawWiltingThorn(c, r * 0.4, f);
    c.restore();
  });
}

function rootVsBloom(c: Ctx, r: number): void {
  c.save();
  c.translate(-r * 0.9, 0);
  drawRoot(c, r * 0.8, T, false);
  c.restore();
  c.save();
  c.translate(r * 0.9, 0);
  drawRichNode(c, r * 0.8, T, false);
  c.restore();
}

const kinds: ResourceKind[] = ['ore', 'ice', 'crystal', 'lens', 'plating'];

/** Actual-size (24 px) strip: three ships, spore, thorn, guard ring, pocket, icons. Draws at r = 12 across the width. */
function strip(c: Ctx, grey: boolean): void {
  const r = 12;
  const items: ((c2: Ctx) => void)[] = [
    (c2) => drawShip(c2, r, 0, 'drone'),
    (c2) => drawShip(c2, r, 0, 'lancer'),
    (c2) => drawShip(c2, r, 0, 'flak'),
    (c2) => drawSpore(c2, r, T, 1),
    (c2) => drawThorn(c2, r, T, 1),
    (c2) => drawGuardRing(c2, r, 0.5, 0.4, T),
    (c2) => drawPocket(c2, r, T, true, 'ice'),
    (c2) => drawPocket(c2, r, T, false, 'crystal'),
    ...kinds.map((k) => (c2: Ctx) => drawResourceIcon(c2, r, k)),
  ];
  c.save();
  if (grey) c.filter = 'grayscale(1)';
  items.forEach((f, i) => {
    c.save();
    c.translate(r + 2 + (i % 7) * 46, 40 + Math.floor(i / 7) * 48);
    f(c);
    c.restore();
  });
  c.restore();
}

/** The two economy hulls between the three warships, at r. */
function econRow(c: Ctx, r: number): void {
  const k = r * 0.2;
  const xs = [-4, -2, 0, 2, 4].map((i) => i * r * 0.5);
  const draws: Array<(c2: Ctx) => void> = [(c2) => drawExtractor(c2, r * 0.46), (c2) => drawHauler(c2, r * 0.46), (c2) => drawShip(c2, r * 0.46, 0, 'drone'), (c2) => drawShip(c2, r * 0.46, 0, 'lancer'), (c2) => drawShip(c2, r * 0.46, 0, 'flak')];
  draws.forEach((f, i) => {
    c.save();
    c.translate(xs[i]! + k, 0);
    f(c);
    c.restore();
  });
}

/** One of every guard-ring split, over a Thorn/Spore pair, at the given r. */
function ringSet(c: Ctx, r: number): void {
  [[1, 0], [0.5, 0.5], [0.25, 0.25], [0.1, 0.4]].forEach(([a, b], i) => {
    c.save();
    c.translate((i - 1.5) * r * 0.9, 0);
    drawGuardRing(c, r * 0.42, a ?? 0, b ?? 0, T);
    c.restore();
  });
}

function shipRow(c: Ctx, r: number): void {
  (['drone', 'lancer', 'flak'] as const).forEach((t, i) => {
    c.save();
    c.translate((i - 1) * r * 0.95, 0);
    drawShip(c, r * 0.45, 0, t);
    c.restore();
  });
}

function iconRow(c: Ctx, r: number): void {
  kinds.forEach((k, i) => {
    c.save();
    c.translate((i - 2) * r * 0.62, 0);
    drawResourceIcon(c, r * 0.28, k);
    c.restore();
  });
}

const researchIds: ResearchIconId[] = ['lancer', 'flak', 'opening', 'extract', 'rigs', 'yards', 'core'];
const researchIds5: ResearchIconId[] = [...researchIds, 'fleet'];
const areaStates: AreaNodeState[] = ['locked', 'open', 'reclaimed', 'far'];

/** H4 actual-size strip: 3 rows of 7 at r = 12 (area tiers and states, research icons, core, crate, lanes). */
function strip4(c: Ctx, grey: boolean): void {
  const r = 12;
  const items: ((c2: Ctx) => void)[] = [
    ...[0, 1, 2, 3].map((tier) => (c2: Ctx) => drawAreaNode(c2, r, T, tier, 'open')),
    (c2) => drawAreaNode(c2, r, T, 2, 'locked'),
    (c2) => drawAreaNode(c2, r, T, 3, 'locked'),
    (c2) => drawAreaNode(c2, r, T, 2, 'reclaimed'),
    ...researchIds.map((id) => (c2: Ctx) => drawResearchIcon(c2, r, id)),
    (c2) => drawProbeCore(c2, r, T, 0),
    (c2) => drawProbeCore(c2, r, T, 0.5),
    (c2) => drawProbeCore(c2, r, T, 1),
    (c2) => drawStockpileIcon(c2, r),
    ...(['closed', 'open', 'owned'] as LaneState[]).map((s) => (c2: Ctx) => drawLane(c2, -20, 6, 20, -6, T, s)),
  ];
  c.save();
  if (grey) c.filter = 'grayscale(1)';
  items.forEach((f, i) => {
    c.save();
    c.translate(r + 2 + (i % 7) * 46, 40 + Math.floor(i / 7) * 48);
    f(c);
    c.restore();
  });
  c.restore();
}

/** H5 actual-size strip: the new icons beside the H4 research icons they must not be mistaken for. */
function strip5(c: Ctx, grey: boolean): void {
  const r = 12;
  const items: ((c2: Ctx) => void)[] = [
    (c2) => drawFleetIcon(c2, r, false),
    (c2) => drawFleetIcon(c2, r, true),
    (c2) => drawRecycleIcon(c2, r),
    (c2) => drawResearchIcon(c2, r, 'fleet'),
    ...researchIds.map((id) => (c2: Ctx) => drawResearchIcon(c2, r, id)),
    (c2) => drawShip(c2, r, 0, 'drone'),
    (c2) => drawResourceIcon(c2, r, 'ore'),
    (c2) => drawStockpileIcon(c2, r),
  ];
  c.save();
  if (grey) c.filter = 'grayscale(1)';
  items.forEach((f, i) => {
    c.save();
    c.translate(r + 2 + (i % 7) * 46, 40 + Math.floor(i / 7) * 48);
    f(c);
    c.restore();
  });
  c.restore();
}

/** H7 actual-size strip: the extractor and hauler beside the warships and a rock they must not be mistaken for, then the new marks. */
function strip7(c: Ctx, grey: boolean): void {
  const r = 12;
  const items: ((c2: Ctx) => void)[] = [
    (c2) => drawExtractor(c2, r),
    (c2) => drawHauler(c2, r),
    (c2) => drawShip(c2, r, 0, 'drone'),
    (c2) => drawShip(c2, r, 0, 'lancer'),
    (c2) => drawShip(c2, r, 0, 'flak'),
    (c2) => drawAsteroid(c2, r, 3, 0, 0),
    (c2) => drawAsteroid(c2, r, 3, 0, 0, 'raided', T),
    (c2) => drawRaidMarker(c2, r, { thorn: 3, spore: 2 }),
    (c2) => drawRaidMarker(c2, r, { thorn: 0, spore: 4 }),
    (c2) => drawMineBadge(c2, r),
    (c2) => drawLockBadge(c2, r),
    (c2) => bangBadge(c2, r * 0.6),
    (c2) => drawResourceIcon(c2, r, 'ore'),
  ];
  c.save();
  if (grey) c.filter = 'grayscale(1)';
  items.forEach((f, i) => {
    c.save();
    c.translate(r + 2 + (i % 7) * 46, 40 + Math.floor(i / 7) * 48);
    f(c);
    c.restore();
  });
  c.restore();
}

/** H8 actual-size strip: the raid badge in three mixes beside the mine badge, then the pulse and the two highlights on a rock. */
function strip8(c: Ctx, grey: boolean): void {
  const r = 12;
  const items: ((c2: Ctx) => void)[] = [
    (c2) => drawRaidBadge(c2, r, { thorn: 3, spore: 2 }),
    (c2) => drawRaidBadge(c2, r, { thorn: 0, spore: 4 }),
    (c2) => drawRaidBadge(c2, r, { thorn: 4, spore: 0 }),
    (c2) => drawMineBadge(c2, r),
    (c2) => { drawAsteroid(c2, r * 0.6, 3, 0, 0); drawSplitPulse(c2, r * 0.75, 0.2); },
    (c2) => { drawAsteroid(c2, r * 0.6, 3, 0, 0); drawDropHighlight(c2, r * 0.9, false, 0); },
    (c2) => { drawAsteroid(c2, r * 0.6, 3, 0, 0); drawDropHighlight(c2, r * 0.9, true, 0); },
  ];
  c.save();
  if (grey) c.filter = 'grayscale(1)';
  items.forEach((f, i) => {
    c.save();
    c.translate(r + 2 + i * 46, 40);
    f(c);
    c.restore();
  });
  c.restore();
}

/** A rock with the raid badge at its lower left and the mine badge at its lower right, as view.ts places them. */
function rockBadges(c: Ctx, r: number): void {
  drawAsteroid(c, r * 0.7, 3, 1, 3);
  c.save();
  c.translate(-r * 0.7 * 0.95, r * 0.7 * 0.7);
  drawRaidBadge(c, Math.max(8, r * 0.7 * 0.4), { thorn: 3, spore: 2 });
  c.restore();
  c.save();
  c.translate(r * 0.7 * 0.95, r * 0.7 * 0.7);
  drawMineBadge(c, Math.max(7, r * 0.7 * 0.34));
  c.restore();
}

function dragLines(c: Ctx, r: number): void {
  const aims = ['move', 'attack', 'none'] as const;
  aims.forEach((aim, i) => {
    drawDragLine(c, -r * 1.1, (i - 1) * r * 0.5, r * 1.1, (i - 1) * r * 0.5, aim, 0);
  });
}

function ghostRow(c: Ctx, r: number): void {
  const s = r / 24;
  c.save();
  c.scale(s, s);
  const rows: Array<[Array<{ type: 'drone' | 'lancer' | 'flak'; count: number }>, 'move' | 'attack']> = [
    [[{ type: 'drone', count: 6 }], 'move'],
    [[{ type: 'drone', count: 3 }, { type: 'lancer', count: 2 }], 'move'],
    [[{ type: 'drone', count: 2 }, { type: 'flak', count: 1 }], 'attack'],
  ];
  rows.forEach(([entries, aim], i) => {
    c.save();
    c.translate(0, (i - 1) * 38);
    drawDragGhost(c, entries, aim);
    c.restore();
  });
  c.restore();
}

function dropRow(c: Ctx, r: number): void {
  c.save();
  c.translate(-r * 0.75, 0);
  drawAsteroid(c, r * 0.35, 3, 0, 0);
  drawDropHighlight(c, r * 0.55, false, 0);
  c.translate(0, -r * 0.75);
  drawDropTag(c, 'A5', null);
  c.restore();
  c.save();
  c.translate(r * 0.75, 0);
  drawRichNode(c, r * 0.35, T, false);
  drawDropHighlight(c, r * 0.55, true, 0);
  c.translate(0, -r * 0.75);
  drawDropTag(c, 'Hive', 'Attack · Even');
  c.restore();
}

/** The H1 "!" badge as view.ts draws it (amber pill, dark glyph), for side-by-side checks. */
function bangBadge(c: Ctx, r: number): void {
  const h = r * 1.3;
  const w = r * 1.3;
  c.save();
  c.fillStyle = palette.routeBackedUp;
  c.beginPath();
  c.roundRect(-w / 2, -h / 2, w, h, h / 2);
  c.fill();
  c.fillStyle = '#2a1e00';
  c.font = `700 ${Math.max(8, r * 1.1)}px ui-monospace, Menlo, Consolas, monospace`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('!', 0, r * 0.05);
  c.restore();
}

type Prize = 'ore' | 'ice' | 'crystal' | null;

/**
 * An area node as the overworld draws it (H6 rules): the prize icon in the
 * centre (none on a far node), the relay mark added at the upper left (dimmed
 * to the node's 0.5 on a far relay, which shows only the mark), and the lock
 * badge at the upper right.
 */
function nodeWith(c: Ctx, r: number, state: AreaNodeState, prize: Prize, relay: boolean, lock: boolean): void {
  drawAreaNode(c, r, T, 2, state);
  if (prize && state !== 'far') drawResourceIcon(c, r * 0.4, prize);
  if (relay) {
    c.save();
    c.translate(-r * 0.7, -r * 0.7);
    drawRelayMark(c, r * 0.5, state === 'far' ? 0.5 : 1);
    c.restore();
  }
  if (lock) {
    c.save();
    c.translate(r * 0.7, -r * 0.7);
    drawLockBadge(c, r * 0.5);
    c.restore();
  }
}

/** H6 actual-size strip: the new draws beside the area node, fleet icon and "!" badge they must not be mistaken for. */
function strip6(c: Ctx, grey: boolean): void {
  const r = 12;
  const laneAt = (m: LaneMode) => (c2: Ctx) => drawLane(c2, -10, 4, 10, -4, T, 'owned', m, 55);
  const items: ((c2: Ctx) => void)[] = [
    // Row 1: relay icon, lock, and a relay node in all four states (ice haul, crystal haul, locked with lock, far).
    (c2) => drawRelayIcon(c2, r),
    (c2) => drawLockBadge(c2, r),
    (c2) => nodeWith(c2, r, 'reclaimed', 'ice', true, false),
    (c2) => nodeWith(c2, r, 'open', 'crystal', true, false),
    (c2) => nodeWith(c2, r, 'locked', 'ice', true, true),
    (c2) => nodeWith(c2, r, 'far', null, true, false),
    (c2) => nodeWith(c2, r, 'far', null, false, false),
    // Row 2: non-relay nodes, and what the new draws must not be mistaken for.
    (c2) => nodeWith(c2, r, 'locked', 'ore', false, true),
    (c2) => nodeWith(c2, r, 'open', 'ore', false, false),
    (c2) => drawFleetIcon(c2, r, false),
    (c2) => drawFleetIcon(c2, r, true),
    (c2) => bangBadge(c2, r),
    (c2) => drawResearchIcon(c2, r, 'fleet'),
    (c2) => drawStockpileIcon(c2, r),
    // Row 3: the three lane modes, every one fully on the canvas.
    laneAt('dim'),
    laneAt('normal'),
    laneAt('reveal'),
  ];
  c.save();
  if (grey) c.filter = 'grayscale(1)';
  items.forEach((f, i) => {
    c.save();
    c.translate(r + 2 + (i % 7) * 46, 40 + Math.floor(i / 7) * 48);
    f(c);
    c.restore();
  });
  c.restore();
}

function laneModes(c: Ctx, r: number): void {
  const rows: [LaneState, LaneMode, number][] = [
    ['owned', 'dim', 0],
    ['owned', 'normal', 0],
    ['owned', 'reveal', 20],
    ['owned', 'reveal', 60],
    ['owned', 'reveal', 90],
    ['open', 'dim', 0],
    ['open', 'reveal', 50],
  ];
  rows.forEach(([s, m, p], i) => drawLane(c, -r, (i - 3) * r * 0.28, r, (i - 3) * r * 0.28, T, s, m, p));
}

function bandRow(c: Ctx, r: number): void {
  c.save();
  drawBandDivider(c, -r * 1.1, -r * 0.55, r * 1.1);
  c.translate(0, -r * 0.35);
  c.font = `600 ${Math.max(7, r * 0.22)}px ui-monospace, Menlo, Consolas, monospace`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  drawBandPill(c, r * 1.5, r * 0.4);
  c.fillStyle = palette.starBright;
  c.fillText('BAND 2', 0, 0);
  c.translate(0, r * 0.7);
  drawBandPill(c, r * 1.5, r * 0.4);
  c.fillStyle = palette.areaLocked;
  c.fillText('BAND 3', 0, 0);
  c.restore();
}

function areaRow(c: Ctx, r: number, state: AreaNodeState): void {
  [0, 1, 2, 3].forEach((tier, i) => {
    c.save();
    c.translate((i - 1.5) * r * 0.5, 0);
    drawAreaNode(c, r * 0.22, T, tier, state);
    c.restore();
  });
}

function researchRow(c: Ctx, r: number): void {
  researchIds5.forEach((id, i) => {
    c.save();
    c.translate((i - 3.5) * r * 0.27, 0);
    drawResearchIcon(c, r * 0.125, id);
    c.restore();
  });
}

function laneSet(c: Ctx, r: number): void {
  (['closed', 'open', 'owned'] as LaneState[]).forEach((s, i) => {
    drawLane(c, -r, (i - 1) * r * 0.45, r, (i - 1) * r * 0.45, T, s);
  });
}

function coreSet(c: Ctx, r: number): void {
  [0, 0.4, 0.75, 1].forEach((f, i) => {
    c.save();
    c.translate((i - 1.5) * r * 0.5, 0);
    drawProbeCore(c, r * 0.22, T, f);
    c.restore();
  });
}

const entries: Entry[] = [
  { label: '24 px strip, colour', draw: (c) => strip(c, false), strip: true },
  { label: '24 px strip, greyscale (shape-only check)', draw: (c) => strip(c, true), strip: true },
  { label: 'H4 24 px strip, colour (areas, research, core, crate, lanes)', draw: (c) => strip4(c, false), strip: true, h: 170 },
  { label: 'H4 24 px strip, greyscale', draw: (c) => strip4(c, true), strip: true, h: 170 },
  { label: 'H5 24 px strip, colour (fleet, fleet full, recycle, research fleet; then H4 research icons, drone, ore, crate)', draw: (c) => strip5(c, false), strip: true, h: 120 },
  { label: 'H5 24 px strip, greyscale (shape-only)', draw: (c) => strip5(c, true), strip: true, h: 120 },
  { label: 'H6 24 px strip, colour (relay, lock, relay nodes reclaimed, open, locked+lock, far; plain far; locked+lock, open; fleet, full, !, research fleet, crate; lanes dim, normal, reveal)', draw: (c) => strip6(c, false), strip: true, h: 170 },
  { label: 'H6 24 px strip, greyscale (shape-only)', draw: (c) => strip6(c, true), strip: true, h: 170 },
  { label: 'H7 24 px strip, colour (extractor, hauler, drone, lancer, flak, rock, raided rock; raid marker 3/2, 0/4; mine badge, lock, "!", ore)', draw: (c) => strip7(c, false), strip: true, h: 120 },
  { label: 'H7 24 px strip, greyscale (shape-only)', draw: (c) => strip7(c, true), strip: true, h: 120 },
  { label: 'H8 24 px strip, colour (raid badge 3/2, 0/4, 4/0; mine badge beside it; split pulse, drop highlight on a rock, attack highlight; ghost chip and tag are shown below)', draw: (c) => strip8(c, false), strip: true, h: 120 },
  { label: 'H8 24 px strip, greyscale (shape-only)', draw: (c) => strip8(c, true), strip: true, h: 120 },
  { label: 'raid badge: 3 Thorn 2 Spore', draw: (c, r) => drawRaidBadge(c, r, { thorn: 3, spore: 2 }) },
  { label: 'raid badge: all Spores (left) vs all Thorns (right)', draw: (c, r) => { c.save(); c.translate(-r * 0.6, 0); drawRaidBadge(c, r * 0.5, { thorn: 0, spore: 4 }); c.restore(); c.save(); c.translate(r * 0.6, 0); drawRaidBadge(c, r * 0.5, { thorn: 4, spore: 0 }); c.restore(); } },
  { label: 'a rock with the raid badge (lower left) and the mine badge (lower right)', draw: (c, r) => rockBadges(c, r) },
  { label: 'drag line: to a node (blue), at an enemy (pink), over nothing (grey)', draw: (c, r) => dragLines(c, r) },
  { label: 'ghost chip: 6 drones; 3 drones and 2 lancers (blue edge); 2 drones and 1 flak (attack, pink edge)', draw: (c, r) => ghostRow(c, r) },
  { label: 'drop-target highlight and tag: a rock (move), the hive (attack)', draw: (c, r) => dropRow(c, r) },
  { label: 'split-armed pulse on a rock', draw: (c, r) => { drawAsteroid(c, r * 0.6, 3, 0, 0); drawSplitPulse(c, r * 0.8, 0.2); } },
  { label: 'extractor', draw: (c, r) => drawExtractor(c, r) },
  { label: 'hauler', draw: (c, r) => drawHauler(c, r) },
  { label: 'extractor, hauler and the warships (drone, lancer, flak)', draw: (c, r) => econRow(c, r) },
  { label: 'raid marker: 3 Thorn 2 Spore', draw: (c, r) => drawRaidMarker(c, r, { thorn: 3, spore: 2 }) },
  { label: 'raid marker: all Spores', draw: (c, r) => drawRaidMarker(c, r, { thorn: 0, spore: 4 }) },
  { label: 'mine badge (left) vs lock (middle) vs "!" (right)', draw: (c, r) => { c.save(); c.translate(-r * 0.7, 0); drawMineBadge(c, r * 0.4); c.restore(); drawLockBadge(c, r * 0.4); c.save(); c.translate(r * 0.7, 0); bangBadge(c, r * 0.28); c.restore(); } },
  { label: 'asteroid under raid (the raided state)', draw: (c, r) => drawAsteroid(c, r * 0.8, 3, 1, 3, 'raided', T) },
  { label: 'radar, 3/2/0/0/0 of 5', draw: (c, r) => drawRadar(c, r * 2, r * 1.7, [3, 2, 0, 0, 0], 5) },
  { label: 'radar, 4/2/1/3/5 of 5', draw: (c, r) => drawRadar(c, r * 2, r * 1.7, [4, 2, 1, 3, 5], 5) },
  { label: 'drone', draw: (c, r) => drawShip(c, r, 0, 'drone') },
  { label: 'lancer', draw: (c, r) => drawShip(c, r, 0, 'lancer') },
  { label: 'flak', draw: (c, r) => drawShip(c, r, 0, 'flak') },
  { label: 'three ships (drone, lancer, flak)', draw: (c, r) => shipRow(c, r) },
  { label: 'spore hp 1', draw: (c, r) => drawSpore(c, r, T, 1) },
  { label: 'spore hp .4', draw: (c, r) => drawSpore(c, r, T, 0.4) },
  { label: 'spore (left) vs thorn (right)', draw: (c, r) => { c.save(); c.translate(-r * 0.6, 0); drawSpore(c, r * 0.5, T, 1); c.restore(); c.save(); c.translate(r * 0.6, 0); drawThorn(c, r * 0.5, T, 1); c.restore(); } },
  { label: 'guard ring 60/40', draw: (c, r) => drawGuardRing(c, r, 0.6, 0.4, T) },
  { label: 'guard ring 20/10 (damaged)', draw: (c, r) => drawGuardRing(c, r, 0.2, 0.1, T) },
  { label: 'guard ring splits 100/0, 50/50, 25/25, 10/40', draw: (c, r) => ringSet(c, r) },
  { label: 'pocket alive, ice', draw: (c, r) => drawPocket(c, r, T, true, 'ice') },
  { label: 'pocket alive, crystal + ring', draw: (c, r) => { drawPocket(c, r * 0.8, T, true, 'crystal'); drawGuardRing(c, r, 0.5, 0.5, T); } },
  { label: 'pocket captured, ice', draw: (c, r) => drawPocket(c, r, T, false, 'ice') },
  { label: 'pocket alive (left) vs bloom heart (right)', draw: (c, r) => { c.save(); c.translate(-r * 0.8, 0); drawPocket(c, r * 0.5, T, true, 'ore'); c.restore(); c.save(); c.translate(r * 0.9, 0); drawRichNode(c, r * 0.65, T, false); c.restore(); } },
  { label: 'icon ore', draw: (c, r) => drawResourceIcon(c, r, 'ore') },
  { label: 'icon ice', draw: (c, r) => drawResourceIcon(c, r, 'ice') },
  { label: 'icon crystal', draw: (c, r) => drawResourceIcon(c, r, 'crystal') },
  { label: 'icon lens', draw: (c, r) => drawResourceIcon(c, r, 'lens') },
  { label: 'icon plating', draw: (c, r) => drawResourceIcon(c, r, 'plating') },
  { label: 'icons ore ice crystal lens plating', draw: (c, r) => iconRow(c, r) },
  { label: 'probe', draw: (c, r) => drawProbe(c, r, T) },
  { label: 'asteroid 0/3', draw: (c, r) => drawAsteroid(c, r, 3, 0, 3) },
  { label: 'asteroid 2/3', draw: (c, r) => drawAsteroid(c, r, 5, 2, 3) },
  { label: 'asteroid 3/3', draw: (c, r) => drawAsteroid(c, r, 8, 3, 3) },
  { label: 'bloom alive', draw: (c, r) => drawRichNode(c, r, T, false) },
  { label: 'bloom withered', draw: (c, r) => drawRichNode(c, r, T, true) },
  { label: 'thorn hp 1', draw: (c, r) => drawThorn(c, r, T, 1) },
  { label: 'thorn hp .6', draw: (c, r) => drawThorn(c, r, T, 0.6) },
  { label: 'thorn hp .2', draw: (c, r) => drawThorn(c, r, T, 0.2) },
  { label: 'root alive', draw: (c, r) => drawRoot(c, r, T, false) },
  { label: 'root cut', draw: (c, r) => drawRoot(c, r, T, true) },
  { label: 'root (left) vs bloom (right)', draw: (c, r) => rootVsBloom(c, r) },
  { label: 'vine alive', draw: (c, r) => drawVine(c, -r * 1.2, r * 0.3, r * 1.2, -r * 0.3, T, false) },
  { label: 'vine alive, later', draw: (c, r) => drawVine(c, -r * 1.2, r * 0.3, r * 1.2, -r * 0.3, T + 1.5, false) },
  { label: 'vine cut', draw: (c, r) => drawVine(c, -r * 1.2, r * 0.3, r * 1.2, -r * 0.3, T, true) },
  { label: 'wilting thorn 0 / .33 / .66 / .9', draw: (c, r) => wiltSeq(c, r) },
  { label: 'pod', draw: (c, r) => drawPod(c, r) },
  { label: 'rally flag', draw: (c, r) => drawRallyFlag(c, r) },
  { label: 'hit 0.1', draw: (c, r) => drawHitFlash(c, r, 0.1) },
  { label: 'hit 0.5', draw: (c, r) => drawHitFlash(c, r, 0.5) },
  { label: 'area node tier 0-3, locked', draw: (c, r) => areaRow(c, r * 4, 'locked') },
  { label: 'area node tier 0-3, open', draw: (c, r) => areaRow(c, r * 4, 'open') },
  { label: 'area node tier 0-3, reclaimed', draw: (c, r) => areaRow(c, r * 4, 'reclaimed') },
  ...areaStates.map((s) => ({ label: `area node tier 3, ${s}, core icon`, draw: (c: Ctx, r: number) => { drawAreaNode(c, r, T, 3, s); drawProbeCore(c, r * 0.45, T, 0); } })),
  { label: 'area node tier 2, open, ice icon', draw: (c, r) => { drawAreaNode(c, r, T, 2, 'open'); drawResourceIcon(c, r * 0.4, 'ice'); } },
  { label: 'lanes closed / open / owned', draw: (c, r) => laneSet(c, r) },
  ...researchIds.map((id) => ({ label: `research ${id}`, draw: (c: Ctx, r: number) => drawResearchIcon(c, r, id) })),
  { label: 'research icons, all eight', draw: (c, r) => researchRow(c, r * 4) },
  { label: 'relay icon', draw: (c, r) => drawRelayIcon(c, r) },
  { label: 'lock badge', draw: (c, r) => drawLockBadge(c, r) },
  { label: '"!" badge (H1, for comparison)', draw: (c, r) => bangBadge(c, r * 0.6) },
  { label: 'relay (left) vs fleet (right)', draw: (c, r) => { c.save(); c.translate(-r * 0.55, 0); drawRelayIcon(c, r * 0.5); c.restore(); c.save(); c.translate(r * 0.55, 0); drawFleetIcon(c, r * 0.5, false); c.restore(); } },
  { label: 'lock (left) vs "!" (right)', draw: (c, r) => { c.save(); c.translate(-r * 0.5, 0); drawLockBadge(c, r * 0.45); c.restore(); c.save(); c.translate(r * 0.5, 0); bangBadge(c, r * 0.3); c.restore(); } },
  { label: 'area node far (hollow rocks, no ring)', draw: (c, r) => drawAreaNode(c, r, T, 2, 'far') },
  { label: 'relay node, reclaimed (ice haul, relay mark upper left)', draw: (c, r) => nodeWith(c, r * 0.8, 'reclaimed', 'ice', true, false) },
  { label: 'relay node, open (crystal haul)', draw: (c, r) => nodeWith(c, r * 0.8, 'open', 'crystal', true, false) },
  { label: 'relay node, locked + lock badge (marks on opposite corners)', draw: (c, r) => nodeWith(c, r * 0.8, 'locked', 'ice', true, true) },
  { label: 'relay node, far (no prize, relay mark dimmed)', draw: (c, r) => nodeWith(c, r * 0.8, 'far', null, true, false) },
  { label: 'plain nodes: locked + lock badge, far (no prize)', draw: (c, r) => { c.save(); c.translate(-r * 0.5, 0); nodeWith(c, r * 0.4, 'locked', 'ore', false, true); c.restore(); c.save(); c.translate(r * 0.5, 0); nodeWith(c, r * 0.4, 'far', null, false, false); c.restore(); } },
  { label: 'lane modes: dim, normal, reveal 20/60/90, open dim, open reveal 50', draw: (c, r) => laneModes(c, r) },
  { label: 'band label pills and divider', draw: (c, r) => bandRow(c, r) },
  { label: 'fleet icon', draw: (c, r) => drawFleetIcon(c, r, false) },
  { label: 'fleet icon, full', draw: (c, r) => drawFleetIcon(c, r, true) },
  { label: 'recycle icon', draw: (c, r) => drawRecycleIcon(c, r) },
  { label: 'fleet (left) vs full (right)', draw: (c, r) => { c.save(); c.translate(-r * 0.55, 0); drawFleetIcon(c, r * 0.5, false); c.restore(); c.save(); c.translate(r * 0.55, 0); drawFleetIcon(c, r * 0.5, true); c.restore(); } },
  { label: 'probe core frac 0', draw: (c, r) => drawProbeCore(c, r, T, 0) },
  { label: 'probe core frac .5', draw: (c, r) => drawProbeCore(c, r, T, 0.5) },
  { label: 'probe core frac 1', draw: (c, r) => drawProbeCore(c, r, T, 1) },
  { label: 'probe core 0 / .4 / .75 / 1', draw: (c, r) => coreSet(c, r * 4) },
  { label: 'stockpile icon', draw: (c, r) => drawStockpileIcon(c, r) },
  { label: 'route L1', draw: (c, r) => drawRoute(c, -r, 0, r, 0, 1, false) },
  { label: 'route L3', draw: (c, r) => drawRoute(c, -r, 0, r, 0, 3, false) },
  { label: 'route backed up', draw: (c, r) => drawRoute(c, -r, 0, r, 0, 1, true) },
];

// ---- The 24 px silhouette check (H7): each hull's alpha mask at 24 px against the others, as intersection over union ----
/** The alpha mask of `draw` at a 24 px entity (r = 12), on a 32 px cell, as a 0/1 array. */
function mask24(draw: (c: Ctx, r: number) => void): Uint8Array {
  const size = 32;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c = cv.getContext('2d', { willReadFrequently: true }) as Ctx;
  c.translate(size / 2, size / 2);
  draw(c, 12);
  const d = c.getImageData(0, 0, size, size).data;
  const m = new Uint8Array(size * size);
  for (let i = 0; i < m.length; i++) m[i] = (d[i * 4 + 3] ?? 0) >= 128 ? 1 : 0;
  return m;
}
const iou = (a: Uint8Array, b: Uint8Array): number => {
  let i = 0;
  let u = 0;
  for (let k = 0; k < a.length; k++) {
    if (a[k] && b[k]) i++;
    if (a[k] || b[k]) u++;
  }
  return u === 0 ? 0 : i / u;
};
const sil: Array<[string, (c: Ctx, r: number) => void]> = [
  ['extractor', (c, r) => drawExtractor(c, r)],
  ['hauler', (c, r) => drawHauler(c, r)],
  ['drone', (c, r) => drawShip(c, r, 0, 'drone')],
  ['lancer', (c, r) => drawShip(c, r, 0, 'lancer')],
  ['flak', (c, r) => drawShip(c, r, 0, 'flak')],
  ['rock', (c, r) => drawAsteroid(c, r, 3, 0, 0)],
];
const masks = new Map(sil.map(([n, f]) => [n, mask24(f)]));
const silhouettes: { fill: Record<string, number>; iou: Record<string, number> } = { fill: {}, iou: {} };
for (const [n] of sil) silhouettes.fill[n] = (masks.get(n) as Uint8Array).reduce((a, b) => a + b, 0);
for (const a of ['extractor', 'hauler']) {
  for (const [b] of sil) {
    if (a === b) continue;
    const v = iou(masks.get(a) as Uint8Array, masks.get(b) as Uint8Array);
    silhouettes.iou[`${a}|${b}`] = v;
  }
}
(window as unknown as { __silhouettes: typeof silhouettes }).__silhouettes = silhouettes;

const sizes = [24, 48, 96];
// Columns sum to 344 px so all three fit a 375 px screen with no sideways scroll.
const cellW = [60, 104, 180];
const rowH = 190;
const stripH = 120;
const rowHeight = (e: Entry): number => e.h ?? (e.strip ? stripH : rowH);
const rowTop = (i: number): number => entries.slice(0, i).reduce((a, e) => a + rowHeight(e), 0);
const width = cellW.reduce((a, b) => a + b, 0);
const height = rowTop(entries.length);
const canvas = document.getElementById('g') as HTMLCanvasElement;
const dpr = window.devicePixelRatio || 1;
canvas.width = width * dpr;
canvas.height = height * dpr;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
const ctx = canvas.getContext('2d') as Ctx;
ctx.scale(dpr, dpr);
ctx.fillStyle = palette.space;
ctx.fillRect(0, 0, width, height);
ctx.font = '12px system-ui, sans-serif';
entries.forEach((e, row) => {
  const top = rowTop(row);
  ctx.fillStyle = palette.starBright;
  ctx.fillText(e.strip ? e.label : `${e.label}  (24 / 48 / 96)`, 2, top + 14);
  if (e.strip) {
    ctx.save();
    ctx.translate(0, top + 10);
    e.draw(ctx, 12);
    ctx.restore();
    return;
  }
  const y = top + 24 + (rowH - 24) / 2;
  let x = 0;
  sizes.forEach((s, i) => {
    const w = cellW[i] ?? 0;
    ctx.save();
    ctx.translate(x + w / 2, y);
    // Sizes are the entity diameter in px, so r is half of it.
    e.draw(ctx, s / 2);
    ctx.restore();
    x += w;
  });
});

// ---- Measured bounds (pixel scan at r = 50 on an offscreen canvas) ----
function measure(draw: (c: Ctx, r: number) => void, perp?: (x: number, y: number) => number): number {
  const R = 50;
  const size = 520;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c = cv.getContext('2d', { willReadFrequently: true }) as Ctx;
  c.translate(size / 2, size / 2);
  draw(c, R);
  const d = c.getImageData(0, 0, size, size).data;
  let worst = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((d[(y * size + x) * 4 + 3] ?? 0) < 8) continue;
      const px = x - size / 2;
      const py = y - size / 2;
      worst = Math.max(worst, perp ? perp(px, py) : Math.hypot(px, py));
    }
  }
  return worst;
}
const boundLines: string[] = [];
for (const s of areaStates) {
  for (const tier of [0, 1, 2, 3]) {
    boundLines.push(`area node tier ${tier} ${s}: ${(measure((c, r) => drawAreaNode(c, r, 0.5, tier, s)) / 50).toFixed(3)} r (limit 1.000 r)`);
  }
}
for (const id of researchIds5) boundLines.push(`research ${id}: ${(measure((c, r) => drawResearchIcon(c, r, id)) / 50).toFixed(3)} r`);
boundLines.push(`fleet icon: ${(measure((c, r) => drawFleetIcon(c, r, false)) / 50).toFixed(3)} r`);
boundLines.push(`fleet icon full: ${(measure((c, r) => drawFleetIcon(c, r, true)) / 50).toFixed(3)} r`);
boundLines.push(`recycle icon: ${(measure((c, r) => drawRecycleIcon(c, r)) / 50).toFixed(3)} r`);
boundLines.push(`probe core: ${(measure((c, r) => drawProbeCore(c, r, 0.5, 1)) / 50).toFixed(3)} r`);
boundLines.push(`stockpile icon: ${(measure((c, r) => drawStockpileIcon(c, r)) / 50).toFixed(3)} r`);
boundLines.push(`relay icon: ${(measure((c, r) => drawRelayIcon(c, r)) / 50).toFixed(3)} r`);
boundLines.push(`relay mark: ${(measure((c, r) => drawRelayMark(c, r)) / 50).toFixed(3)} r`);
boundLines.push(`lock badge: ${(measure((c, r) => drawLockBadge(c, r)) / 50).toFixed(3)} r`);
// How far each corner mark reaches from the node's centre when placed as ART_STYLE "Callers" says (node r = 50).
boundLines.push(`relay mark at the upper left, reach from the node centre: ${(measure((c, r) => { c.translate(-r * 0.7, -r * 0.7); drawRelayMark(c, r * 0.5); }) / 50).toFixed(3)} node r`);
boundLines.push(`lock badge at the upper right, reach from the node centre: ${(measure((c, r) => { c.translate(r * 0.7, -r * 0.7); drawLockBadge(c, r * 0.5); }) / 50).toFixed(3)} node r`);
for (const s of ['closed', 'open', 'owned'] as LaneState[]) {
  // Segment along x from -150 to 150, so the distance to it is |y| inside the span and the end distance beyond.
  const dist = (x: number, y: number): number => (Math.abs(x) <= 150 ? Math.abs(y) : Math.hypot(Math.abs(x) - 150, y));
  boundLines.push(`lane ${s}: ${measure((c) => drawLane(c, -150, 0, 150, 0, 1.1, s), dist).toFixed(2)} px from segment (limit 4)`);
}
boundLines.push(`extractor: ${(measure((c, r) => drawExtractor(c, r)) / 50).toFixed(3)} r`);
boundLines.push(`hauler: ${(measure((c, r) => drawHauler(c, r)) / 50).toFixed(3)} r`);
boundLines.push(`raid marker: ${(measure((c, r) => drawRaidMarker(c, r, { thorn: 3, spore: 2 })) / 50).toFixed(3)} r`);
boundLines.push(`mine badge: ${(measure((c, r) => drawMineBadge(c, r)) / 50).toFixed(3)} r`);
boundLines.push(`raid badge: ${(measure((c, r) => drawRaidBadge(c, r, { thorn: 3, spore: 2 })) / 50).toFixed(3)} r`);
boundLines.push(`split pulse: ${(measure((c, r) => drawSplitPulse(c, r, 0)) / 50).toFixed(3)} r (limit 1.500 r)`);
boundLines.push(`drop highlight: ${(measure((c, r) => drawDropHighlight(c, r, true, 0)) / 50).toFixed(3)} r (limit r + 7 px = 1.140 r at r = 50)`);
boundLines.push(`raided rock (rim and glow, no pips): ${(measure((c, r) => drawAsteroid(c, r, 3, 0, 0, 'raided', 0.3)) / 50).toFixed(3)} r (limit 1.100 r)`);

for (const key of Object.keys(silhouettes.iou)) {
  const [hull] = key.split('|') as [string];
  boundLines.push(`24 px silhouette ${key.replace('|', ' vs ')}: overlap ${(silhouettes.iou[key] as number).toFixed(2)} (limit 0.75), ${hull} covers ${silhouettes.fill[hull]} px`);
}
const boundsEl = document.getElementById('bounds');
if (boundsEl) boundsEl.textContent = ['(pixel scan includes antialiasing: 1.002 r or 4.00 px is the limit; exact geometry is checked in test/h4-art.test.ts and test/h6-art.test.ts)', ...boundLines].join('\n');

// ---- Overworld mock at 375x667 ----
{
  const mock = document.getElementById('m') as HTMLCanvasElement | null;
  if (mock) {
    const W = 375;
    const H = 667;
    mock.width = W * dpr;
    mock.height = H * dpr;
    mock.style.width = `${W}px`;
    mock.style.height = `${H}px`;
    const m = mock.getContext('2d') as Ctx;
    m.scale(dpr, dpr);
    m.fillStyle = palette.space;
    m.fillRect(0, 0, W, H);
    const k = 0.52;
    const pos = (x: number, y: number): [number, number] => [(x - 500) * k + W / 2, (y - 200) * k + 70];
    type Area = { id: string; name: string; tier: number; x: number; y: number; state: AreaNodeState; prize: ResourceKind | 'core' };
    const areas: Area[] = [
      { id: 'landfall', name: 'Landfall', tier: 0, x: 500, y: 1150, state: 'reclaimed', prize: 'ore' },
      { id: 'shelf', name: 'Frost Shelf', tier: 1, x: 220, y: 870, state: 'reclaimed', prize: 'ice' },
      { id: 'shoal', name: 'Glass Shoal', tier: 1, x: 780, y: 870, state: 'open', prize: 'crystal' },
      { id: 'veil', name: 'Spore Veil', tier: 2, x: 220, y: 520, state: 'open', prize: 'ice' },
      { id: 'garden', name: 'Thorn Garden', tier: 2, x: 780, y: 520, state: 'locked', prize: 'crystal' },
      { id: 'deep', name: 'The Deep', tier: 3, x: 500, y: 200, state: 'locked', prize: 'core' },
    ];
    const byId = new Map(areas.map((a) => [a.id, a]));
    const lanes: [string, string][] = [['landfall', 'shelf'], ['landfall', 'shoal'], ['shelf', 'veil'], ['shoal', 'garden'], ['veil', 'garden'], ['veil', 'deep'], ['garden', 'deep']];
    const rr = 80 * k;
    for (const [a, b] of lanes) {
      const A = byId.get(a) as Area;
      const B = byId.get(b) as Area;
      const both = A.state === 'reclaimed' && B.state === 'reclaimed';
      const either = A.state === 'reclaimed' || B.state === 'reclaimed';
      // Order the ends so pulses flow toward Landfall (the lower node is the later one).
      const [from, to] = A.y < B.y ? [B, A] : [A, B];
      const [fx, fy] = pos(from.x, from.y);
      const [tx, ty] = pos(to.x, to.y);
      const len = Math.hypot(tx - fx, ty - fy);
      const ux = (tx - fx) / len;
      const uy = (ty - fy) / len;
      drawLane(m, fx + ux * rr, fy + uy * rr, tx - ux * rr, ty - uy * rr, T, both ? 'owned' : either ? 'open' : 'closed');
    }
    m.textAlign = 'center';
    m.font = '12px system-ui, sans-serif';
    for (const a of areas) {
      const [x, y] = pos(a.x, a.y);
      m.save();
      m.translate(x, y);
      drawAreaNode(m, rr, T, a.tier, a.state);
      if (a.prize === 'core') drawProbeCore(m, rr * 0.45, T, 0);
      else drawResourceIcon(m, rr * 0.4, a.prize);
      m.restore();
      m.fillStyle = a.state === 'locked' ? palette.areaLocked : palette.starBright;
      m.fillText(a.name, x, y + rr + 14);
    }
    m.save();
    m.translate(24, 26);
    drawStockpileIcon(m, 12);
    m.restore();
    m.textAlign = 'left';
    m.fillStyle = palette.starBright;
    m.fillText('ore 150  ice 80  crystal 0', 44, 31);
  }
}

// ---- H5 mock HUD row at 375 px: ship chips and the fleet chip, normal and full ----
{
  const hud = document.getElementById('h') as HTMLCanvasElement | null;
  if (hud) {
    const W = 375;
    const rows = 4;
    const H = rows * 56;
    hud.width = W * dpr;
    hud.height = H * dpr;
    hud.style.width = `${W}px`;
    hud.style.height = `${H}px`;
    const h = hud.getContext('2d') as Ctx;
    h.scale(dpr, dpr);
    h.fillStyle = palette.space;
    h.fillRect(0, 0, W, H);
    h.font = '13px system-ui, sans-serif';
    h.textBaseline = 'middle';
    const chip = (x: number, y: number, w: number, label: string, icon: (c: Ctx) => void, edge: string): number => {
      h.fillStyle = 'rgba(207, 232, 255, 0.08)';
      h.fillRect(x, y, w, 44);
      h.strokeStyle = edge;
      h.lineWidth = 1;
      h.strokeRect(x + 0.5, y + 0.5, w - 1, 43);
      h.save();
      h.translate(x + 18, y + 22);
      icon(h);
      h.restore();
      h.fillStyle = palette.starBright;
      h.fillText(label, x + 34, y + 23);
      return x + w + 6;
    };
    const shipChips = (y: number): number => {
      let x = 6;
      x = chip(x, y, 62, '3', (c) => drawShip(c, 11, 0, 'drone'), palette.starDim);
      x = chip(x, y, 62, '2', (c) => drawShip(c, 11, 0, 'lancer'), palette.starDim);
      x = chip(x, y, 62, '1', (c) => drawShip(c, 11, 0, 'flak'), palette.starDim);
      return x;
    };
    // Rows: normal, full, normal with the wide-font stress (16px), and a recycle button row.
    let x = shipChips(6);
    chip(x, 6, 126, 'Fleet 6/12', (c) => drawFleetIcon(c, 12, false), palette.starDim);
    x = shipChips(62);
    chip(x, 62, 126, 'Fleet 12/12', (c) => drawFleetIcon(c, 12, true), palette.probe);
    h.font = '16px system-ui, sans-serif';
    x = shipChips(118);
    chip(x, 118, 126, 'Fleet 12/12', (c) => drawFleetIcon(c, 12, true), palette.probe);
    h.font = '13px system-ui, sans-serif';
    chip(6, 174, 120, 'Recycle...', (c) => drawRecycleIcon(c, 12), palette.asteroidOre);
    chip(132, 174, 150, 'Fleet limit 12 > 18', (c) => drawResearchIcon(c, 12, 'fleet'), palette.starDim);
  }
}
