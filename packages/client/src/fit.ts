/** Fits the whole fixed map into the map area: no pan, no zoom (DESIGN.md H1 scope). The overworld fit (H6) pans: see fitOverworld. */

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
const OW_PAD_Y = 46;
/** Largest overworld scale, so desktop nodes don't balloon. */
const OW_MAX_SCALE = 0.7;
/** Smallest on-screen node radius, px (the spec: area radius at least 22 px, so a node is a 44 px target). */
export const OW_MIN_NODE_PX = 22.5;

/**
 * The overworld's layout (DESIGN.md H6 "Overworld map"): the frame's width fills the map width, and the map pans when the
 * frame is taller than the view. A screen position is `o + su * scale - scroll`. `contentW` x `contentH` is the frame plus its
 * label padding in px, the extent a scroll can reach.
 */
export interface OwFit {
  scale: number;
  /** Screen offset of the frame origin (0, 0) at scroll 0. */
  ox: number;
  oy: number;
  contentW: number;
  contentH: number;
}

/**
 * Fits area nodes of radius `r` su into a w x h px map. The scale fills the width, so a phone pans vertically. If the whole
 * frame fits at a scale that still gives nodes at least OW_MIN_NODE_PX, that scale is used and nothing pans (a wide screen).
 */
export function fitOverworld(points: readonly { x: number; y: number }[], r: number, w: number, h: number): OwFit {
  if (points.length === 0) return { scale: 1, ox: 0, oy: 0, contentW: w, contentH: h };
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
  const minScale = OW_MIN_NODE_PX / r;
  const wFill = (w - 2 * OW_PAD_X) / bw;
  const hFill = (h - 2 * OW_PAD_Y) / bh;
  // The scale the height allows when the whole frame fits with nodes still big enough (no pan); otherwise the width fills the view.
  let scale = hFill >= minScale ? Math.min(wFill, hFill) : wFill;
  scale = Math.max(minScale, Math.min(OW_MAX_SCALE, scale));
  const contentW = bw * scale + 2 * OW_PAD_X;
  const contentH = bh * scale + 2 * OW_PAD_Y;
  // Centred across when it fits; flush to the padding on an axis that scrolls (and always at the top, so a sheet can extend the scroll).
  const ox = (contentW <= w ? (w - contentW) / 2 : 0) + OW_PAD_X - minX * scale;
  const oy = OW_PAD_Y - minY * scale;
  return { scale, ox, oy, contentW, contentH };
}

/** The most an axis scrolls: the content less the part of the view that no sheet covers (the last `cover` px). */
export function scrollMax(content: number, view: number, cover = 0): number {
  return Math.max(0, content - Math.max(1, view - cover));
}

/** `v` held to 0..max. */
export function clampScroll(v: number, max: number): number {
  return Math.max(0, Math.min(max, v));
}
