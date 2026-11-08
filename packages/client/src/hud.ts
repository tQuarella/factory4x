/**
 * The HUD chips: icon + count per resource and per ship type, hidden until owned (DESIGN.md H3 "HUD").
 * Built once; `update` touches text and visibility only. All values come from the sim's selectors.
 */
import { RESOURCES, SHIP_TYPES, prizePerMin, shipCounts, unlockStatus, type Resource, type ShipType, type World } from '@factory4x/sim';
import { h, setHidden, setText } from './dom.ts';
import { resourceIcon, shipIcon } from './icons.ts';
import { RES_NAME, SHIP_NAME } from './report.ts';

interface Chip {
  el: HTMLElement;
  count: HTMLElement;
  rate: HTMLElement | null;
}

function makeChip(root: HTMLElement, id: string, label: string, icon: (parent: HTMLElement) => void, withRate: boolean): Chip {
  const el = h('span', 'chip', '', root);
  el.id = id;
  el.title = label;
  el.setAttribute('aria-label', label);
  icon(el);
  const count = h('b', '', '0', el);
  const rate = withRate ? h('small', '', '', el) : null;
  return { el, count, rate };
}

export class Hud {
  private readonly res = new Map<Resource, Chip>();
  private readonly ships = new Map<ShipType, Chip>();

  constructor(root: HTMLElement) {
    for (const r of RESOURCES) {
      this.res.set(r, makeChip(root, `chip-${r}`, RES_NAME[r], (p) => resourceIcon(p, 18, r), r === 'ice' || r === 'crystal'));
    }
    for (const s of SHIP_TYPES) {
      this.ships.set(s, makeChip(root, `chip-${s}`, SHIP_NAME[s], (p) => shipIcon(p, 20, s), false));
    }
  }

  update(world: Readonly<World>): void {
    const unlocked = unlockStatus(world);
    const perMin = prizePerMin(world);
    for (const r of RESOURCES) {
      const c = this.res.get(r)!;
      setHidden(c.el, !unlocked.resources[r]);
      setText(c.count, String(world.stock[r]));
      if (c.rate) {
        const v = r === 'ice' || r === 'crystal' ? perMin[r] : 0;
        setText(c.rate, v > 0 ? `${v}/min` : '');
      }
    }
    const counts = shipCounts(world).byType;
    for (const s of SHIP_TYPES) {
      const c = this.ships.get(s)!;
      setHidden(c.el, !unlocked.ships[s]);
      setText(c.count, String(counts[s]));
    }
  }
}
