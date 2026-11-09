/**
 * Overworld band labels (DESIGN.md H6 "Overworld map"): one pill per band at the map's left edge, placed in the gap between the
 * bands so it never covers a node, its relay mark, lock badge or name label. Pure geometry in content px (the map at scroll 0),
 * so it is unit-tested against any shipped map.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Name label box: wide enough for a name and, once reclaimed, a second line of export rates. */
const NAME_W = 130;
const NAME_H = 32;
/** Px between a node's rim and its name label: clear of the selection ring at r + 6. */
export const NAME_GAP = 9;
/** Marks reach about 1.49 of a node's radius (ART_STYLE.md H6 entities); the box is a square of 1.5 r. */
const MARK_REACH = 1.5;

/** The area a node occupies including the corner marks and its selection ring. */
export function nodeBox(c: { x: number; y: number }, r: number): Rect {
  return { x: c.x - MARK_REACH * r, y: c.y - MARK_REACH * r, w: 2 * MARK_REACH * r, h: 2 * MARK_REACH * r };
}

/** The name label's box under or over a node. */
export function nameBox(c: { x: number; y: number }, r: number, side: 'above' | 'below'): Rect {
  return { x: c.x - NAME_W / 2, y: side === 'above' ? c.y - r - NAME_GAP - NAME_H : c.y + r + NAME_GAP, w: NAME_W, h: NAME_H };
}

export function overlap(a: Rect, b: Rect, pad = 0): boolean {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export interface BandLabel {
  band: number;
  rect: Rect;
}

export interface BandLayoutInput {
  /** Node centres in content px, with each node's band (tier) and name-label side. */
  centers: readonly { x: number; y: number }[];
  bands: readonly number[];
  sides: readonly ('above' | 'below')[];
  r: number;
  /** Label size per band (the pill's width and height). */
  pill: (band: number) => { w: number; h: number };
  contentH: number;
}

/**
 * Where each band's pill goes: at x = 4, in the vertical gap beside the band (between its lowest row and the row of the band below,
 * or on the row for band 0), nearest the gap's middle, clear of every node box and name label when any such place exists.
 */
export function bandLabels(input: BandLayoutInput): BandLabel[] {
  const { centers, bands, sides, r, pill, contentH } = input;
  const occupied: Rect[] = [];
  const top: Record<number, number> = {};
  const bottom: Record<number, number> = {};
  centers.forEach((c, i) => {
    const b = bands[i]!;
    for (const box of [nodeBox(c, r), nameBox(c, r, sides[i]!)]) {
      occupied.push(box);
      top[b] = Math.min(top[b] ?? Infinity, box.y);
      bottom[b] = Math.max(bottom[b] ?? -Infinity, box.y + box.h);
    }
  });
  const out: BandLabel[] = [];
  for (const band of [...new Set(bands)].sort((a, b) => a - b)) {
    const { w, h } = pill(band);
    // Higher bands sit higher on the map (smaller y). The gap is between this band's bottom and the next lower band's top.
    const below = top[band - 1];
    const mid = below === undefined ? ((top[band] ?? 0) + (bottom[band] ?? 0)) / 2 : (bottom[band]! + below) / 2;
    let best: Rect | null = null;
    let bestKey = Infinity;
    for (let dy = 0; dy <= 400; dy += 2) {
      for (const sign of dy === 0 ? [1] : [1, -1]) {
        const y = mid + sign * dy - h / 2;
        if (y < 2 || y + h > contentH - 2) continue;
        const rect = { x: 4, y, w, h };
        let area = 0;
        for (const o of occupied) area += overlapArea(rect, o);
        // Any overlap costs far more than distance from the middle.
        const key = area * 1000 + dy;
        if (key < bestKey) {
          bestKey = key;
          best = rect;
        }
      }
      if (best !== null && bestKey < 1000) break;
    }
    out.push({ band, rect: best ?? { x: 4, y: Math.max(2, mid - h / 2), w, h } });
  }
  return out;
}
