/** Static readability gallery (not linked from the game). Owned by Art Direction. */
import { palette } from './palette.ts';
import {
  type ResourceKind,
  drawAsteroid,
  drawGuardRing,
  drawHitFlash,
  drawPocket,
  drawPod,
  drawProbe,
  drawRallyFlag,
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
type Entry = { label: string; draw: (ctx: Ctx, r: number) => void; strip?: boolean };

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

const entries: Entry[] = [
  { label: '24 px strip, colour', draw: (c) => strip(c, false), strip: true },
  { label: '24 px strip, greyscale (shape-only check)', draw: (c) => strip(c, true), strip: true },
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
  { label: 'route L1', draw: (c, r) => drawRoute(c, -r, 0, r, 0, 1, false) },
  { label: 'route L3', draw: (c, r) => drawRoute(c, -r, 0, r, 0, 3, false) },
  { label: 'route backed up', draw: (c, r) => drawRoute(c, -r, 0, r, 0, 1, true) },
];

const sizes = [24, 48, 96];
// Columns sum to 344 px so all three fit a 375 px screen with no sideways scroll.
const cellW = [60, 104, 180];
const rowH = 190;
const stripH = 120;
const rowTop = (i: number): number => entries.slice(0, i).reduce((a, e) => a + (e.strip ? stripH : rowH), 0);
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
