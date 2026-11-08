/** Static readability gallery (not linked from the game). Owned by Art Direction. */
import { palette } from './palette.ts';
import {
  type ResourceKind,
  type AreaNodeState,
  type LaneState,
  type ResearchIconId,
  drawAreaNode,
  drawAsteroid,
  drawGuardRing,
  drawHitFlash,
  drawLane,
  drawPocket,
  drawPod,
  drawProbe,
  drawProbeCore,
  drawRallyFlag,
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
const areaStates: AreaNodeState[] = ['locked', 'open', 'reclaimed'];

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

function areaRow(c: Ctx, r: number, state: AreaNodeState): void {
  [0, 1, 2, 3].forEach((tier, i) => {
    c.save();
    c.translate((i - 1.5) * r * 0.5, 0);
    drawAreaNode(c, r * 0.22, T, tier, state);
    c.restore();
  });
}

function researchRow(c: Ctx, r: number): void {
  researchIds.forEach((id, i) => {
    c.save();
    c.translate((i - 3) * r * 0.3, 0);
    drawResearchIcon(c, r * 0.14, id);
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
  { label: 'research icons, all seven', draw: (c, r) => researchRow(c, r * 4) },
  { label: 'probe core frac 0', draw: (c, r) => drawProbeCore(c, r, T, 0) },
  { label: 'probe core frac .5', draw: (c, r) => drawProbeCore(c, r, T, 0.5) },
  { label: 'probe core frac 1', draw: (c, r) => drawProbeCore(c, r, T, 1) },
  { label: 'probe core 0 / .4 / .75 / 1', draw: (c, r) => coreSet(c, r * 4) },
  { label: 'stockpile icon', draw: (c, r) => drawStockpileIcon(c, r) },
  { label: 'route L1', draw: (c, r) => drawRoute(c, -r, 0, r, 0, 1, false) },
  { label: 'route L3', draw: (c, r) => drawRoute(c, -r, 0, r, 0, 3, false) },
  { label: 'route backed up', draw: (c, r) => drawRoute(c, -r, 0, r, 0, 1, true) },
];

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
for (const id of researchIds) boundLines.push(`research ${id}: ${(measure((c, r) => drawResearchIcon(c, r, id)) / 50).toFixed(3)} r`);
boundLines.push(`probe core: ${(measure((c, r) => drawProbeCore(c, r, 0.5, 1)) / 50).toFixed(3)} r`);
boundLines.push(`stockpile icon: ${(measure((c, r) => drawStockpileIcon(c, r)) / 50).toFixed(3)} r`);
for (const s of ['closed', 'open', 'owned'] as LaneState[]) {
  // Segment along x from -150 to 150, so the distance to it is |y| inside the span and the end distance beyond.
  const dist = (x: number, y: number): number => (Math.abs(x) <= 150 ? Math.abs(y) : Math.hypot(Math.abs(x) - 150, y));
  boundLines.push(`lane ${s}: ${measure((c) => drawLane(c, -150, 0, 150, 0, 1.1, s), dist).toFixed(2)} px from segment (limit 4)`);
}
const boundsEl = document.getElementById('bounds');
if (boundsEl) boundsEl.textContent = boundLines.join('\n');

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
