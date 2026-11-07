/** Static readability gallery (not linked from the game). Owned by Art Direction. */
import { palette } from './palette.ts';
import {
  drawAsteroid,
  drawHitFlash,
  drawPod,
  drawProbe,
  drawRallyFlag,
  drawRichNode,
  drawRoute,
  drawRoot,
  drawShip,
  drawThorn,
  drawVine,
  drawWiltingThorn,
} from './placeholders.ts';

type Ctx = CanvasRenderingContext2D;
type Entry = { label: string; draw: (ctx: Ctx, r: number) => void };

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

const entries: Entry[] = [
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
  { label: 'ship', draw: (c, r) => drawShip(c, r, 0) },
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
const width = cellW.reduce((a, b) => a + b, 0);
const height = entries.length * rowH;
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
  const top = row * rowH;
  ctx.fillStyle = palette.starBright;
  ctx.fillText(`${e.label}  (24 / 48 / 96)`, 2, top + 14);
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
