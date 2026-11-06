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
    minY = Math.min(minY, n.y - n.r * 1.4 - MARGIN_SU - 40);
    maxY = Math.max(maxY, n.y + n.r + MARGIN_SU);
  }
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const scale = Math.max(0.05, Math.min(w / bw, h / bh));
  return { scale, ox: (w - bw * scale) / 2 - minX * scale, oy: (h - bh * scale) / 2 - minY * scale };
}
