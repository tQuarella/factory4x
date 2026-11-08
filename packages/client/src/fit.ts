/** Fits the whole fixed map into the map area: no pan, no zoom (DESIGN.md H1 scope). */

export interface Fit {
  scale: number;
  ox: number;
  oy: number;
}

export interface Box {
  x: number;
  y: number;
  r: number;
}

/** Margin in su around each node's radius: room for labels, pips and the thorn ring. */
const MARGIN_SU = 100;

/** Scale and offset that center every node (plus margin) in a w x h area. */
export function fitMap(nodes: readonly Box[], w: number, h: number): Fit {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.r - MARGIN_SU);
    maxX = Math.max(maxX, n.x + n.r + MARGIN_SU);
    minY = Math.min(minY, n.y - n.r * 1.4 - MARGIN_SU - 110);
    maxY = Math.max(maxY, n.y + n.r + MARGIN_SU);
  }
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const scale = Math.max(0.05, Math.min(w / bw, h / bh));
  return { scale, ox: (w - bw * scale) / 2 - minX * scale, oy: (h - bh * scale) / 2 - minY * scale };
}

/** Overworld: px kept clear beside the outermost nodes (name labels are wider than a node) and above and below (two label lines). */
const OW_PAD_X = 30;
const OW_PAD_Y = 40;
/** Largest overworld scale, so desktop nodes don't balloon. */
const OW_MAX_SCALE = 0.7;

/** Fits area nodes of radius `r` su into w x h px with room for their labels. */
export function fitOverworld(points: readonly { x: number; y: number }[], r: number, w: number, h: number): Fit {
  if (points.length === 0) return { scale: 1, ox: 0, oy: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x - r);
    maxX = Math.max(maxX, p.x + r);
    minY = Math.min(minY, p.y - r);
    maxY = Math.max(maxY, p.y + r);
  }
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const scale = Math.max(0.05, Math.min(OW_MAX_SCALE, (w - 2 * OW_PAD_X) / bw, (h - 2 * OW_PAD_Y) / bh));
  return { scale, ox: (w - bw * scale) / 2 - minX * scale, oy: (h - bh * scale) / 2 - minY * scale };
}
