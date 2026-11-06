/**
 * Milestone 0 placeholder client. Proves the pipeline end to end: the sim runs
 * at a fixed tick in the browser, the renderer draws procedural placeholders,
 * and the build version is visible. Engineers replace this in Milestone 1
 * (renderer library choice is theirs).
 */
import { createWorld, defaultData, replayHashes, step, worldHash } from '@factory4x/sim';
import { palette } from './palette.ts';
import { drawAsteroid, drawMob, drawProbe, drawShip } from './placeholders.ts';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const $ = (id: string) => document.getElementById(id)!;
$('version').textContent = __BUILD_VERSION__;

const world = createWorld(1, defaultData);
const tickMs = 1000 / defaultData.tickRate;

// Static starfield, generated once per resize.
let stars: Array<{ x: number; y: number; r: number; bright: boolean }> = [];
function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  stars = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.clientWidth,
    y: Math.random() * canvas.clientHeight,
    r: Math.random() * 1.2 + 0.3,
    bright: Math.random() < 0.15,
  }));
}
window.addEventListener('resize', resize);
resize();

function render(t: number): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const s = Math.min(w, h);
  ctx.fillStyle = palette.space;
  ctx.fillRect(0, 0, w, h);
  for (const st of stars) {
    ctx.fillStyle = st.bright ? palette.starBright : palette.starDim;
    ctx.fillRect(st.x, st.y, st.r, st.r);
  }

  const cx = w / 2;
  const cy = h / 2;
  const asteroid = { x: cx - s * 0.3, y: cy + s * 0.15 };
  const mob = { x: cx + s * 0.32, y: cy - s * 0.2 };

  // Logistics route: asteroid -> probe, with a packet moving along it.
  ctx.strokeStyle = palette.route;
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(asteroid.x, asteroid.y);
  ctx.lineTo(cx, cy);
  ctx.stroke();
  ctx.setLineDash([]);
  const p = (t * 0.4) % 1;
  ctx.fillStyle = palette.asteroidOre;
  ctx.beginPath();
  ctx.arc(asteroid.x + (cx - asteroid.x) * p, asteroid.y + (cy - asteroid.y) * p, 3, 0, Math.PI * 2);
  ctx.fill();

  const at = (x: number, y: number, draw: () => void) => {
    ctx.save();
    ctx.translate(x, y);
    draw();
    ctx.restore();
  };
  at(asteroid.x, asteroid.y, () => drawAsteroid(ctx, s * 0.07, 3, 1, 2));
  at(mob.x, mob.y, () => drawMob(ctx, s * 0.05, t));
  const orbit = t * 0.6;
  at(cx + Math.cos(orbit) * s * 0.14, cy + Math.sin(orbit) * s * 0.14, () => drawShip(ctx, s * 0.025, orbit + Math.PI / 2));
  at(cx, cy, () => drawProbe(ctx, s * 0.06, t));
}

// Fixed-step sim with a render loop decoupled from it.
let acc = 0;
let last = performance.now();
function frame(now: number): void {
  acc += Math.min(now - last, 250);
  last = now;
  while (acc >= tickMs) {
    step(world, defaultData, []);
    acc -= tickMs;
  }
  render(now / 1000);
  $('tick').textContent = String(world.tick);
  $('stock').textContent = String(world.probe.stock);
  if (world.tick % 30 === 0) $('hash').textContent = worldHash(world);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__factory4x = {
  version: __BUILD_VERSION__,
  tick: () => world.tick,
  replayHashes: (ticks, every, replay) => replayHashes(replay, defaultData, ticks, every),
};
