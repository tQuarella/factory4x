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
  drawShip,
  drawThorn,
} from './placeholders.ts';

type Ctx = CanvasRenderingContext2D;
type Entry = { label: string; draw: (ctx: Ctx, r: number) => void };

const T = 1.3;
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
const cellW = [64, 96, 160];
const rowH = 130;
const labelW = 100;
const width = labelW + cellW.reduce((a, b) => a + b, 0);
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
  const y = row * rowH + rowH / 2;
  ctx.fillStyle = palette.starBright;
  ctx.fillText(e.label, 4, y + 4);
  let x = labelW;
  sizes.forEach((s, i) => {
    ctx.save();
    ctx.translate(x + (cellW[i] ?? 0) / 2, y);
    // Sizes are the entity diameter in px, so r is half of it.
    e.draw(ctx, s / 2);
    ctx.restore();
    x += cellW[i] ?? 0;
  });
});
