/**
 * Procedural placeholder art (see ART_STYLE.md "Placeholders"). Each draw
 * function renders one entity type centered at (0, 0) with radius r, so
 * generated sprites can later replace them one for one. Rendering code may use
 * floating-point Math freely; only packages/sim is restricted.
 */
import { palette } from './palette.ts';

type Ctx = CanvasRenderingContext2D;

function polygon(ctx: Ctx, sides: number, r: number, rotation = 0): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

function disc(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

export function drawProbe(ctx: Ctx, r: number, t: number): void {
  ctx.save();
  ctx.fillStyle = palette.probeGlow;
  disc(ctx, 0, 0, r * (1.6 + 0.1 * Math.sin(t * 2)));
  ctx.fill();
  ctx.strokeStyle = palette.probe;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  polygon(ctx, 6, r, t * 0.2);
  ctx.stroke();
  polygon(ctx, 6, r * 0.45, -t * 0.4);
  ctx.fillStyle = palette.probe;
  ctx.fill();
  ctx.restore();
}

/** Seeded irregular outline; shared by asteroid and withered Bloom. */
function rockPath(ctx: Ctx, r: number, seed: number, n: number, lo: number): void {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const jitter = lo + (1 - lo) * Math.abs(Math.sin(seed * 12.9898 + i * 78.233));
    ctx.lineTo(Math.cos(a) * r * jitter, Math.sin(a) * r * jitter);
  }
  ctx.closePath();
}

/**
 * Irregular rock; `seed` keeps each outline stable. Extractor pips sit in a
 * row below the rock: filled teal = built, hollow = free slot.
 */
export function drawAsteroid(ctx: Ctx, r: number, seed: number, extractors: number, slots: number): void {
  ctx.save();
  rockPath(ctx, r, seed, 9, 0.75);
  ctx.fillStyle = palette.asteroid;
  ctx.fill();
  ctx.fillStyle = palette.asteroidOre;
  disc(ctx, r * 0.2, -r * 0.15, r * 0.18);
  ctx.fill();
  if (slots > 0) {
    const pr = Math.max(2.2, r * 0.11);
    const gap = pr * 2.7;
    const y = r * 1.18 + pr;
    const x0 = (-(slots - 1) * gap) / 2;
    ctx.lineWidth = Math.max(1, pr * 0.5);
    ctx.strokeStyle = palette.asteroidOre;
    ctx.fillStyle = palette.asteroidOre;
    for (let i = 0; i < slots; i++) {
      disc(ctx, x0 + i * gap, y, pr);
      if (i < extractors) ctx.fill();
      else ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * The Bloom's rock. Alive: glowing hot-pink coral, a lumpy mass with stubby
 * arms that breathes. Withered (captured): grey rock, teal ore veins, no glow.
 */
export function drawRichNode(ctx: Ctx, r: number, t: number, captured: boolean): void {
  ctx.save();
  if (captured) {
    rockPath(ctx, r, 7, 11, 0.8);
    ctx.fillStyle = palette.withered;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.strokeStyle = palette.witheredDark;
    ctx.stroke();
    ctx.strokeStyle = palette.asteroidOre;
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.1);
    ctx.lineTo(-r * 0.1, r * 0.1);
    ctx.lineTo(r * 0.2, -r * 0.35);
    ctx.moveTo(-r * 0.1, r * 0.1);
    ctx.lineTo(r * 0.15, r * 0.55);
    ctx.moveTo(r * 0.2, -r * 0.35);
    ctx.lineTo(r * 0.55, -r * 0.2);
    ctx.stroke();
    ctx.fillStyle = palette.asteroidOre;
    disc(ctx, -r * 0.1, r * 0.1, r * 0.2);
    ctx.fill();
  } else {
    const breathe = 1 + 0.04 * Math.sin(t * 2.5);
    ctx.fillStyle = palette.bloomGlow;
    disc(ctx, 0, 0, r * 1.45 * breathe);
    ctx.fill();
    const arms = 8;
    ctx.strokeStyle = palette.bloom;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2.5, r * 0.3);
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * Math.PI * 2 + 0.2;
      const len = r * (0.72 + 0.14 * Math.abs(Math.sin(i * 2.7))) * breathe;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.fillStyle = palette.bloom;
    disc(ctx, 0, 0, r * 0.62 * breathe);
    ctx.fill();
    ctx.fillStyle = palette.bloomHi;
    disc(ctx, 0, 0, r * 0.26);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * One orbiting thorn: a four-spike seed-pod, drawn once per thorn around the
 * rich node. Stays within r. hpFrac 0..1 shrinks and dims it; there is no
 * ring, so a full ring of thorns stays quiet.
 */
export function drawThorn(ctx: Ctx, r: number, t: number, hpFrac: number): void {
  const f = Math.min(1, Math.max(0, hpFrac));
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.5 * f;
  ctx.rotate(t * 0.8);
  const body = r * (0.5 + 0.5 * f);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 === 0 ? body : body * 0.32;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = palette.thorn;
  ctx.fill();
  ctx.fillStyle = palette.thornCore;
  disc(ctx, 0, 0, body * 0.2);
  ctx.fill();
  ctx.restore();
}

export type ShipType = 'drone' | 'lancer' | 'flak';
export type ResourceKind = 'ore' | 'ice' | 'crystal' | 'lens' | 'plating';

/**
 * Player ship, facing right and rotated by `heading` (radians; H1/H2 callers
 * pass only r and heading, which still works). The three types differ by shape:
 * drone = small arrowhead, lancer = long thin needle with a bright tip, flak =
 * short wide block with a ring. Stays within r.
 */
export function drawShip(ctx: Ctx, r: number, heading: number, type: ShipType = 'drone'): void {
  ctx.save();
  ctx.rotate(heading);
  ctx.fillStyle = palette.ship;
  ctx.beginPath();
  if (type === 'lancer') {
    ctx.moveTo(r, 0);
    ctx.lineTo(r * 0.4, r * 0.12);
    ctx.lineTo(-r * 0.55, r * 0.14);
    ctx.lineTo(-r * 0.9, r * 0.38);
    ctx.lineTo(-r * 0.75, 0);
    ctx.lineTo(-r * 0.9, -r * 0.38);
    ctx.lineTo(-r * 0.55, -r * 0.14);
    ctx.lineTo(r * 0.4, -r * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.starBright;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(r * 0.5, r * 0.11);
    ctx.lineTo(r * 0.5, -r * 0.11);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'flak') {
    ctx.moveTo(r * 0.55, -r * 0.4);
    ctx.lineTo(r * 0.65, -r * 0.2);
    ctx.lineTo(r * 0.65, r * 0.2);
    ctx.lineTo(r * 0.55, r * 0.4);
    ctx.lineTo(-r * 0.5, r * 0.72);
    ctx.lineTo(-r * 0.62, r * 0.66);
    ctx.lineTo(-r * 0.62, -r * 0.66);
    ctx.lineTo(-r * 0.5, -r * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = palette.space;
    ctx.lineWidth = Math.max(1.5, r * 0.15);
    disc(ctx, 0, 0, r * 0.38);
    ctx.stroke();
    ctx.fillStyle = palette.starBright;
    disc(ctx, 0, 0, r * 0.14);
    ctx.fill();
  } else {
    const k = 0.85;
    ctx.moveTo(r * k, 0);
    ctx.lineTo(-r * 0.7 * k, r * 0.6 * k);
    ctx.lineTo(-r * 0.4 * k, 0);
    ctx.lineTo(-r * 0.7 * k, -r * 0.6 * k);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Spore: a small round puff with a dotted halo (Thorns are spikes, Spores are
 * round). hpFrac 0..1 shrinks and dims the body. Stays within r.
 */
export function drawSpore(ctx: Ctx, r: number, t: number, hpFrac: number): void {
  const f = Math.min(1, Math.max(0, hpFrac));
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.45 * f;
  const body = r * (0.38 + 0.27 * f) * (1 + 0.04 * Math.sin(t * 3));
  ctx.fillStyle = palette.sporeGlow;
  disc(ctx, 0, 0, r * 0.82);
  ctx.fill();
  ctx.fillStyle = palette.spore;
  const dots = 8;
  const dr = Math.max(1, r * 0.1);
  for (let i = 0; i < dots; i++) {
    const a = t * 0.6 + (i / dots) * Math.PI * 2;
    disc(ctx, Math.cos(a) * (r - dr), Math.sin(a) * (r - dr), dr);
    ctx.fill();
  }
  disc(ctx, 0, 0, body);
  ctx.fill();
  ctx.fillStyle = palette.starBright;
  ctx.globalAlpha *= 0.8;
  disc(ctx, -body * 0.25, -body * 0.25, body * 0.28);
  ctx.fill();
  ctx.restore();
}

/**
 * Guard ring: two arcs around a guarded node, Thorn colour then Spore colour,
 * each a fraction of the full circle (shares are of full strength, so the ring
 * shrinks as guards die; if they sum past 1 they are scaled to fit). Drawn
 * inside radius r (outer edge at r). Starts at 12 o'clock.
 */
export function drawGuardRing(ctx: Ctx, r: number, thornShare: number, sporeShare: number, t: number): void {
  const th = Math.max(0, thornShare);
  const sp = Math.max(0, sporeShare);
  const sum = th + sp;
  if (sum <= 0) return;
  const scale = sum > 1 ? 1 / sum : 1;
  const w = Math.max(2.5, r * 0.16);
  const rad = r - w / 2;
  const full = Math.PI * 2;
  const gap = th > 0 && sp > 0 && sum * scale < 0.95 ? 0.12 : 0;
  const start = -Math.PI / 2 + Math.sin(t * 0.8) * 0.05;
  ctx.save();
  ctx.lineWidth = w;
  ctx.lineCap = 'butt';
  let a = start;
  const arc = (share: number, color: string): void => {
    const len = Math.max(0, share * scale * full - gap);
    if (len > 0) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, rad, a + gap / 2, a + gap / 2 + len);
      ctx.stroke();
    }
    a += share * scale * full;
  };
  arc(th, palette.thorn);
  arc(sp, palette.spore);
  ctx.restore();
}

/**
 * Resource and component icon, centered, within radius r. Shapes differ so
 * they read in greyscale: ore = faceted chunk (teal), ice = six-spoke flake
 * (pale cyan), crystal = tall faceted shard (violet), lens = ring with a dot,
 * plating = stack of three plates.
 */
export function drawResourceIcon(ctx: Ctx, r: number, kind: ResourceKind): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'ore') {
    ctx.fillStyle = palette.asteroidOre;
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, -r * 0.1);
    ctx.lineTo(-r * 0.3, -r * 0.8);
    ctx.lineTo(r * 0.55, -r * 0.65);
    ctx.lineTo(r * 0.9, r * 0.15);
    ctx.lineTo(r * 0.3, r * 0.8);
    ctx.lineTo(-r * 0.6, r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.space;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(r * 0.55, -r * 0.65);
    ctx.lineTo(r * 0.9, r * 0.15);
    ctx.lineTo(r * 0.3, r * 0.8);
    ctx.lineTo(r * 0.05, r * 0.05);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'ice') {
    ctx.strokeStyle = palette.ice;
    ctx.lineWidth = Math.max(1.5, r * 0.2);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      ctx.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
      ctx.lineTo(-Math.cos(a) * r * 0.85, -Math.sin(a) * r * 0.85);
    }
    ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bx = Math.cos(a) * r * 0.6;
      const by = Math.sin(a) * r * 0.6;
      for (const s of [-1, 1]) {
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + s * 0.9) * r * 0.3, by + Math.sin(a + s * 0.9) * r * 0.3);
      }
    }
    ctx.stroke();
    ctx.fillStyle = palette.ice;
    polygon(ctx, 6, r * 0.28, 0);
    ctx.fill();
  } else if (kind === 'crystal') {
    ctx.fillStyle = palette.crystal;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.55, -r * 0.35);
    ctx.lineTo(r * 0.4, r * 0.75);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.4, r * 0.75);
    ctx.lineTo(-r * 0.55, -r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.starBright;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.55, -r * 0.35);
    ctx.lineTo(0, -r * 0.2);
    ctx.lineTo(-r * 0.55, -r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = palette.space;
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.beginPath();
    ctx.lineCap = 'butt';
    ctx.moveTo(0, -r * 0.2);
    ctx.lineTo(0, r * 0.9);
    ctx.stroke();
  } else if (kind === 'lens') {
    ctx.strokeStyle = palette.starBright;
    ctx.lineWidth = Math.max(1.5, r * 0.24);
    disc(ctx, 0, 0, r * 0.76);
    ctx.stroke();
    ctx.fillStyle = palette.starBright;
    disc(ctx, 0, 0, r * 0.26);
    ctx.fill();
  } else {
    // Three stacked flat diamonds, top plate last, each separated by a dark edge.
    ctx.strokeStyle = palette.space;
    ctx.lineWidth = Math.max(1, r * 0.1);
    for (let i = 2; i >= 0; i--) {
      const cy = (i - 1) * r * 0.4;
      ctx.fillStyle = palette.plating;
      ctx.globalAlpha = i === 0 ? 1 : 0.8;
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, cy);
      ctx.lineTo(0, cy - r * 0.3);
      ctx.lineTo(r * 0.8, cy);
      ctx.lineTo(0, cy + r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Pocket: a small guarded (or captured) rock. Alive: dark rock with an edge
 * and three pink pointed fronds sprouting from the rim (not a round coral,
 * smaller than the heart), prize icon in the centre. Captured: grey rock with
 * the prize icon, no fronds and no glow. Stays within r.
 */
export function drawPocket(ctx: Ctx, r: number, t: number, alive: boolean, prize: ResourceKind = 'ore'): void {
  ctx.save();
  const rock = r * 0.74;
  if (alive) {
    const sway = Math.sin(t * 1.8) * 0.08;
    ctx.fillStyle = palette.bloomGlow;
    disc(ctx, 0, 0, r * 0.95);
    ctx.fill();
    rockPath(ctx, rock, 4, 9, 0.85);
    ctx.fillStyle = palette.rootRock;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.strokeStyle = palette.rootRockEdge;
    ctx.stroke();
    ctx.fillStyle = palette.bloom;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 1.55 + sway;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(rock * 0.55, -r * 0.2);
      ctx.quadraticCurveTo(r * 0.82, -r * 0.2, r * 0.98, 0);
      ctx.quadraticCurveTo(r * 0.82, r * 0.2, rock * 0.55, r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = palette.space;
    ctx.globalAlpha = 0.55;
    disc(ctx, 0, 0, r * 0.46);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    rockPath(ctx, rock, 4, 9, 0.85);
    ctx.fillStyle = palette.withered;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.strokeStyle = palette.witheredDark;
    ctx.stroke();
  }
  drawResourceIcon(ctx, r * 0.4, prize);
  ctx.restore();
}

/** Pod in transit: a bright teal dot with a soft halo. */
export function drawPod(ctx: Ctx, r: number): void {
  ctx.save();
  ctx.fillStyle = palette.route;
  ctx.globalAlpha = 0.45;
  disc(ctx, 0, 0, r * 1.7);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.asteroidOre;
  disc(ctx, 0, 0, r);
  ctx.fill();
  ctx.restore();
}

/**
 * Route between two world points (call with an untranslated context).
 * `level` (1 and up) thickens the line; `backedUp` turns it dashed amber.
 */
export function drawRoute(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  level: number,
  backedUp: boolean,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.5 + 1.5 * Math.max(0, level);
  if (backedUp) {
    ctx.strokeStyle = palette.routeBackedUp;
    ctx.setLineDash([ctx.lineWidth * 2.5, ctx.lineWidth * 2]);
  } else {
    ctx.strokeStyle = palette.route;
  }
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** Rally flag: amber pennant on a pale pole, centered, within radius r (pole spans y = +0.9r to -0.9r). */
export function drawRallyFlag(ctx: Ctx, r: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = palette.starBright;
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, r * 0.9);
  ctx.lineTo(-r * 0.3, -r * 0.9);
  ctx.stroke();
  ctx.fillStyle = palette.probe;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.9);
  ctx.lineTo(r * 0.75, -r * 0.5);
  ctx.lineTo(-r * 0.3, -r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Hit flash: expanding white ring with a burst. frac 0 = just hit, 1 = gone. */
export function drawHitFlash(ctx: Ctx, r: number, frac: number): void {
  const f = Math.min(1, Math.max(0, frac));
  ctx.save();
  ctx.globalAlpha = 1 - f;
  ctx.strokeStyle = palette.flash;
  ctx.fillStyle = palette.flash;
  ctx.lineWidth = Math.max(1.5, r * 0.18 * (1 - f));
  disc(ctx, 0, 0, r * (0.4 + 0.9 * f));
  ctx.stroke();
  disc(ctx, 0, 0, r * 0.45 * (1 - f));
  ctx.fill();
  ctx.restore();
}

export function drawMob(ctx: Ctx, r: number, t: number): void {
  ctx.save();
  ctx.fillStyle = palette.mobGlow;
  disc(ctx, 0, 0, r * 1.5);
  ctx.fill();
  ctx.beginPath();
  const spikes = 7;
  for (let i = 0; i < spikes * 2; i++) {
    const a = t * 0.5 + (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.55;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = palette.mob;
  ctx.fill();
  ctx.restore();
}

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Blend two #rrggbb colors; k 0 = a, 1 = b. */
function mix(a: string, b: string, k: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const f = Math.min(1, Math.max(0, k));
  return `rgb(${Math.round(ar + (br - ar) * f)}, ${Math.round(ag + (bg - ag) * f)}, ${Math.round(ab + (bb - ab) * f)})`;
}

/**
 * The Root: where the Bloom drinks from. An upright hot-pink stalk with a bud
 * and two leaf blades, sunk into a small dark rock at the bottom; smaller and
 * taller than the round Bloom. Alive: faint glow, gentle sway. Cut: the stalk
 * greys and droops, no glow. The Root's thorns are drawn by the caller with
 * `drawThorn`. Stays within r.
 */
export function drawRoot(ctx: Ctx, r: number, t: number, cut: boolean): void {
  ctx.save();
  const rockY = r * 0.62;
  // Rock: small dark mass with a pale edge so it still reads on space.
  ctx.beginPath();
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const j = 0.8 + 0.2 * Math.abs(Math.sin(i * 7.3 + 1.1));
    ctx.lineTo(Math.cos(a) * r * 0.62 * j, rockY + Math.sin(a) * r * 0.3 * j);
  }
  ctx.closePath();
  ctx.fillStyle = palette.rootRock;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.strokeStyle = cut ? palette.withered : palette.rootRockEdge;
  ctx.stroke();

  const base = rockY - r * 0.1;
  const sway = cut ? 0 : Math.sin(t * 1.6) * r * 0.06;
  const droop = cut ? r * 0.5 : 0;
  const topX = sway + droop;
  const topY = -r * (cut ? 0.4 : 0.7);
  const ctrlX = sway * 0.5 + (cut ? r * 0.05 : 0);
  const ctrlY = (base + topY) / 2;
  const body = cut ? palette.withered : palette.bloom;
  const hi = cut ? palette.withered : palette.bloomHi;

  if (!cut) {
    ctx.fillStyle = palette.bloomGlow;
    disc(ctx, topX * 0.5, -r * 0.1, r * (0.82 + 0.03 * Math.sin(t * 2.5)));
    ctx.fill();
  }
  // Stalk
  ctx.lineCap = 'round';
  ctx.strokeStyle = body;
  ctx.lineWidth = Math.max(2.5, r * 0.26);
  ctx.beginPath();
  ctx.moveTo(0, base);
  ctx.quadraticCurveTo(ctrlX, ctrlY, topX, topY);
  ctx.stroke();
  // Leaf blades (pointed, angled out and up; fold down when cut)
  ctx.fillStyle = body;
  const ly = r * 0.12 + (cut ? r * 0.1 : 0);
  for (const s of [-1, 1]) {
    const lift = cut ? r * 0.25 : -r * 0.3;
    ctx.beginPath();
    ctx.moveTo(sway * 0.3, ly);
    ctx.quadraticCurveTo(s * r * 0.55, ly + (cut ? r * 0.05 : -r * 0.35), s * r * 0.8, ly + lift);
    ctx.quadraticCurveTo(s * r * 0.4, ly + lift * 0.1 + r * 0.12, sway * 0.3, ly + r * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  // Bud
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(topX, topY, r * 0.2, r * 0.26, cut ? 0.9 : 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hi;
  disc(ctx, topX, topY, r * 0.08);
  ctx.fill();
  ctx.restore();
}

/**
 * Vine from the Root (x1, y1) to the Bloom (x2, y2), in world coordinates (call
 * with an untranslated context). Alive: a gently waving pink line with pale
 * pulses travelling slowly toward the Bloom. Cut: thinner, grey, sagging, no
 * pulses.
 */
export function drawVine(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
  cut: boolean,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  // Offset along the normal at fraction u; alive waves, cut sags to one side.
  const off = (u: number): number =>
    cut
      ? Math.sin(u * Math.PI) * len * 0.07
      : Math.sin(u * Math.PI * 3 - t * 1.2) * Math.min(6, len * 0.02) * Math.sin(u * Math.PI);
  const pt = (u: number): [number, number] => [x1 + dx * u + nx * off(u), y1 + dy * u + ny * off(u)];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = cut ? palette.withered : palette.vine;
  ctx.lineWidth = cut ? 2.5 : 3.5;
  const steps = 24;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const [px, py] = pt(i / steps);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  if (!cut) {
    const count = Math.max(1, Math.round(len / 110));
    ctx.fillStyle = palette.vinePulse;
    for (let i = 0; i < count; i++) {
      const u = (t * 0.22 + i / count) % 1;
      const [px, py] = pt(u);
      disc(ctx, px, py, 3.5);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * A thorn falling away and fading as the Bloom starves. frac 0 = a normal
 * thorn, 1 = gone. It drifts down, tumbles, shrinks and greys out.
 */
export function drawWiltingThorn(ctx: Ctx, r: number, frac: number): void {
  const f = Math.min(1, Math.max(0, frac));
  ctx.save();
  ctx.translate(0, r * 0.9 * f);
  ctx.rotate(f * 2.2);
  ctx.globalAlpha = 1 - f * f;
  const body = r * (1 - 0.45 * f);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 === 0 ? body : body * 0.32;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = mix(palette.thorn, palette.withered, f * 1.2);
  ctx.fill();
  ctx.fillStyle = mix(palette.thornCore, palette.withered, f * 1.2);
  disc(ctx, 0, 0, body * 0.2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// H4 (Reclaim ladder): overworld art. See ART_STYLE.md "H4 entities".
// ---------------------------------------------------------------------------

export type AreaNodeState = 'locked' | 'open' | 'reclaimed';
export type LaneState = 'closed' | 'open' | 'owned';
export type ResearchIconId = 'lancer' | 'flak' | 'opening' | 'extract' | 'rigs' | 'yards' | 'core';

/** Four rocks around an open centre (the caller draws the prize icon there). All within 0.7r. */
const AREA_ROCKS: readonly [number, number, number][] = [
  [-0.37, -0.31, 0.27],
  [0.37, -0.35, 0.25],
  [0.39, 0.33, 0.26],
  [-0.35, 0.37, 0.24],
];

/**
 * Area node on the overworld: a cluster of four rocks around an open centre,
 * everything within r including spikes. `tier` 0..3 is the number of Bloom
 * spikes on the rim while the area is held (locked or open); a reclaimed area
 * has none. locked = dim grey-blue rocks and faint spikes; open = full rocks,
 * pink spikes and a pulsing dashed pale ring; reclaimed = amber rocks and a
 * steady solid amber rim (the only place amber marks an area).
 */
export function drawAreaNode(ctx: Ctx, r: number, t: number, tier: number, state: AreaNodeState): void {
  ctx.save();
  ctx.lineJoin = 'round';
  const spikes = state === 'reclaimed' ? 0 : Math.max(0, Math.min(3, Math.round(tier)));
  const lw = Math.max(1.5, r * 0.07);
  // Backing disc so the rocks and the centre icon sit on something.
  ctx.fillStyle = palette.space;
  ctx.globalAlpha = 0.7;
  disc(ctx, 0, 0, r * 0.74);
  ctx.fill();
  ctx.globalAlpha = state === 'locked' ? 0.6 : 1;
  const rockFill = state === 'locked' ? palette.areaLocked : state === 'reclaimed' ? palette.probe : palette.asteroid;
  AREA_ROCKS.forEach(([x, y, k], i) => {
    ctx.save();
    ctx.translate(x * r, y * r);
    rockPath(ctx, k * r, 3 + i * 2, 8, 0.78);
    ctx.fillStyle = rockFill;
    ctx.fill();
    ctx.strokeStyle = palette.space;
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.stroke();
    ctx.restore();
  });
  // Spikes from the rim of the cluster out to r.
  if (spikes > 0) {
    ctx.fillStyle = palette.bloom;
    ctx.globalAlpha = state === 'locked' ? 0.35 : 1;
    for (let i = 0; i < spikes; i++) {
      const a = -Math.PI / 2 + (i / spikes) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(r * 0.7, -r * 0.14);
      ctx.lineTo(r, 0);
      ctx.lineTo(r * 0.7, r * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  if (state === 'open') {
    // Invitation: a pale dashed ring whose strength breathes.
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 3);
    ctx.strokeStyle = palette.starBright;
    ctx.lineWidth = lw;
    ctx.setLineDash([lw * 3, lw * 2]);
    disc(ctx, 0, 0, r * 0.9);
    ctx.stroke();
  } else if (state === 'reclaimed') {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = palette.probe;
    ctx.lineWidth = lw * 1.4;
    disc(ctx, 0, 0, r * 0.88);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Lane between two area nodes (untranslated context; the caller trims the ends
 * to the node rims). Stays within 4 px of the segment. closed = dim dotted,
 * open = dashed, owned = solid amber with comet pulses running from (x1, y1)
 * to (x2, y2).
 */
export function drawLane(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, t: number, state: LaneState): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  if (state === 'closed') {
    ctx.strokeStyle = palette.laneClosed;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([0.1, 7]);
    ctx.stroke();
  } else if (state === 'open') {
    ctx.strokeStyle = palette.laneOpen;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([9, 6]);
    ctx.stroke();
  } else {
    ctx.strokeStyle = palette.laneOwned;
    ctx.lineWidth = 3;
    ctx.stroke();
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      const n = Math.max(1, Math.round(len / 80));
      ctx.fillStyle = palette.flash;
      for (let i = 0; i < n; i++) {
        const head = (t * 0.45 + i / n) % 1;
        for (let k = 0; k < 3; k++) {
          const f = head - k * (10 / len);
          if (f < 0) continue;
          ctx.globalAlpha = 1 - k * 0.3;
          disc(ctx, x1 + dx * f, y1 + dy * f, 3.2 - k * 0.7);
          ctx.fill();
        }
      }
    }
  }
  ctx.restore();
}

/**
 * Probe core: a compact seed of the probe shape (hexagon around a smaller
 * hexagon) with a soft glow. `frac` 0..1 fills the hexagon from the bottom up,
 * from an empty pale outline to a complete amber core. Within r including glow.
 */
export function drawProbeCore(ctx: Ctx, r: number, t: number, frac: number): void {
  const f = Math.max(0, Math.min(1, frac));
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.fillStyle = palette.probeGlow;
  ctx.globalAlpha = 0.25 + 0.75 * f;
  disc(ctx, 0, 0, r * (0.9 + 0.06 * Math.sin(t * 2)));
  ctx.fill();
  ctx.globalAlpha = 1;
  const hex = r * 0.74;
  const lw = Math.max(1.5, r * 0.1);
  if (f > 0) {
    // The hexagon cut by a horizontal line: keep the part below y = top.
    const top = hex - 2 * hex * f;
    const pts: [number, number][] = [];
    for (let i = 0; i < 6; i++) pts.push([Math.cos(Math.PI / 6 + (i / 6) * Math.PI * 2) * hex, Math.sin(Math.PI / 6 + (i / 6) * Math.PI * 2) * hex]);
    ctx.fillStyle = palette.probe;
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const [nx, ny] = pts[(i + 1) % 6] as [number, number];
      const inside = y >= top;
      if (inside) ctx.lineTo(x, y);
      if (inside !== ny >= top) {
        const u = (top - y) / (ny - y);
        ctx.lineTo(x + (nx - x) * u, top);
      }
    });
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = f >= 1 ? palette.probe : palette.starBright;
  ctx.lineWidth = lw;
  polygon(ctx, 6, hex - lw / 2, Math.PI / 6);
  ctx.stroke();
  // Inner hexagon: the seed, dark once the core is complete.
  polygon(ctx, 6, hex * 0.42, -t * 0.4);
  ctx.fillStyle = f >= 1 ? palette.space : palette.probeGlow;
  ctx.fill();
  if (f >= 1) {
    ctx.strokeStyle = palette.space;
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.stroke();
  }
  ctx.restore();
}

/** Stockpile: a steel crate with a lid band and an X brace, three resource pips on top. Within r. */
export function drawStockpileIcon(ctx: Ctx, r: number): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const w = r * 0.68;
  const top = -r * 0.15;
  const bot = r * 0.62;
  const lw = Math.max(1.5, r * 0.13);
  ctx.fillStyle = palette.rootRock;
  ctx.fillRect(-w, top, w * 2, bot - top);
  ctx.strokeStyle = palette.plating;
  ctx.lineWidth = lw;
  ctx.strokeRect(-w + lw / 2, top + lw / 2, w * 2 - lw, bot - top - lw);
  ctx.lineWidth = Math.max(1.2, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(-w * 0.8, top + r * 0.28);
  ctx.lineTo(w * 0.8, top + r * 0.28);
  ctx.moveTo(-w * 0.75, top + r * 0.4);
  ctx.lineTo(w * 0.75, bot - r * 0.12);
  ctx.moveTo(w * 0.75, top + r * 0.4);
  ctx.lineTo(-w * 0.75, bot - r * 0.12);
  ctx.stroke();
  // Pips: ore, ice, crystal peeking above the lid.
  const py = -r * 0.48;
  const pr = r * 0.2;
  ctx.fillStyle = palette.asteroidOre;
  disc(ctx, -w * 0.55, py, pr);
  ctx.fill();
  ctx.fillStyle = palette.ice;
  disc(ctx, 0, py - r * 0.1, pr);
  ctx.fill();
  ctx.fillStyle = palette.crystal;
  disc(ctx, w * 0.55, py, pr);
  ctx.fill();
  ctx.restore();
}

/**
 * Research icons, each within r and told apart by silhouette at 24 px:
 * lancer and flak = the ship inside a dashed blueprint square; opening = an
 * ore chip with a plus; extract = a steel drill bit; rigs = an extractor mast
 * on a rock; yards = a chevron with speed lines; core = the probe core.
 */
export function drawResearchIcon(ctx: Ctx, r: number, id: ResearchIconId): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lw = Math.max(1.5, r * 0.16);
  if (id === 'lancer' || id === 'flak') {
    const h = r * 0.66;
    const bw = Math.max(1.2, r * 0.09);
    ctx.strokeStyle = palette.starBright;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = bw;
    ctx.setLineDash([bw * 3, bw * 2]);
    ctx.strokeRect(-h + bw / 2, -h + bw / 2, h * 2 - bw, h * 2 - bw);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    drawShip(ctx, r * 0.48, 0, id);
  } else if (id === 'opening') {
    ctx.save();
    ctx.translate(-r * 0.2, r * 0.2);
    drawResourceIcon(ctx, r * 0.62, 'ore');
    ctx.restore();
    ctx.strokeStyle = palette.starBright;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(r * 0.55, -r * 0.8 + lw / 2);
    ctx.lineTo(r * 0.55, -r * 0.3);
    ctx.moveTo(r * 0.3, -r * 0.55);
    ctx.lineTo(r * 0.8 - lw / 2, -r * 0.55);
    ctx.stroke();
  } else if (id === 'extract') {
    // Drill bit pointing down: shank, steel cone with thread cuts, teal tip.
    ctx.fillStyle = palette.plating;
    ctx.fillRect(-r * 0.2, -r * 0.92, r * 0.4, r * 0.4);
    ctx.beginPath();
    ctx.moveTo(-r * 0.46, -r * 0.52);
    ctx.lineTo(r * 0.46, -r * 0.52);
    ctx.lineTo(0, r * 0.92);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = palette.space;
    ctx.lineWidth = Math.max(1.2, r * 0.12);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const y = -r * 0.3 + i * r * 0.36;
      const hw = r * 0.46 * (1 - (y + r * 0.52) / (r * 1.44));
      ctx.moveTo(-hw, y);
      ctx.lineTo(hw, y + r * 0.16);
    }
    ctx.stroke();
    ctx.fillStyle = palette.asteroidOre;
    ctx.beginPath();
    ctx.moveTo(-r * 0.14, r * 0.62);
    ctx.lineTo(r * 0.14, r * 0.62);
    ctx.lineTo(0, r * 0.92);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'rigs') {
    // A wide flat rock with an extractor mast and a pump head on top.
    ctx.save();
    ctx.translate(0, r * 0.45);
    ctx.scale(1.4, 0.7);
    rockPath(ctx, r * 0.5, 6, 9, 0.8);
    ctx.fillStyle = palette.asteroid;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = palette.asteroidOre;
    ctx.fillStyle = palette.asteroidOre;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.4);
    ctx.lineTo(0, -r * 0.6);
    ctx.moveTo(-r * 0.55, -r * 0.7);
    ctx.lineTo(r * 0.5, -r * 0.7);
    ctx.stroke();
    disc(ctx, 0, -r * 0.7, r * 0.2);
    ctx.fill();
  } else if (id === 'yards') {
    ctx.strokeStyle = palette.ship;
    ctx.lineWidth = lw * 1.3;
    ctx.beginPath();
    ctx.moveTo(r * 0.05, -r * 0.62);
    ctx.lineTo(r * 0.7, 0);
    ctx.lineTo(r * 0.05, r * 0.62);
    ctx.stroke();
    ctx.strokeStyle = palette.starBright;
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.moveTo(-r * 0.75, -r * 0.42);
    ctx.lineTo(-r * 0.3, -r * 0.42);
    ctx.moveTo(-r * 0.85, 0);
    ctx.lineTo(-r * 0.15, 0);
    ctx.moveTo(-r * 0.75, r * 0.42);
    ctx.lineTo(-r * 0.3, r * 0.42);
    ctx.stroke();
  } else {
    drawProbeCore(ctx, r, 0, 1);
  }
  ctx.restore();
}
