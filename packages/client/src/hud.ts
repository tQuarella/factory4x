/**
 * The HUD chips: icon + count per resource and per ship type, hidden until owned (DESIGN.md H3 "HUD").
 * Built once; `update` touches text and visibility only. All values come from the sim's selectors.
 */
import { RAW_RESOURCES, RESOURCES, SHIP_TYPES, campaignStatus, fleetStatus, prizePerMin, shipCounts, unlockStatus, type RawResource, type Resource, type ShipType, type SimData, type World } from '@factory4x/sim';
import { h, setHidden, setText, toggleClass } from './dom.ts';
import { fmt10 } from './format.ts';
import { fleetIcon, paintIcon, resourceIcon, shipIcon, stockpileIcon } from './icons.ts';
import { drawFleetIcon } from './placeholders.ts';
import { palette } from './palette.ts';
import { RES_NAME, SHIP_NAME, fleetChipText, fleetLine } from './report.ts';

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
  private readonly fleet: Chip & { icon: HTMLCanvasElement; full: boolean };

  constructor(root: HTMLElement) {
    for (const r of RESOURCES) {
      this.res.set(r, makeChip(root, `chip-${r}`, RES_NAME[r], (p) => resourceIcon(p, 18, r), r === 'ice' || r === 'crystal'));
    }
    for (const s of SHIP_TYPES) {
      this.ships.set(s, makeChip(root, `chip-${s}`, SHIP_NAME[s], (p) => shipIcon(p, 20, s), false));
    }
    // H5: the fleet chip, "Fleet 9/12", with the fleet icon (closed amber bracket at the limit). Hidden while the limit is off.
    let icon!: HTMLCanvasElement;
    const chip = makeChip(root, 'chip-fleet', 'Fleet limit', (p) => (icon = fleetIcon(p, 26, false)), false);
    chip.el.classList.add('fleet');
    chip.el.hidden = true;
    this.fleet = { ...chip, icon, full: false };
  }

  update(world: Readonly<World>, data: SimData): void {
    const f = fleetStatus(world, data);
    setHidden(this.fleet.el, f.cap === null);
    if (f.cap !== null) {
      setText(this.fleet.count, fleetChipText(f.count, f.cap));
      this.fleet.el.title = fleetLine({ count: f.count, cap: f.cap, level: f.level, maxLevel: f.maxLevel });
      toggleClass(this.fleet.el, 'full', f.full);
      // The chip's edge is the probe amber at the limit (palette.probe), and the icon's bracket closes.
      this.fleet.el.style.borderColor = f.full ? palette.probe : '';
      if (this.fleet.full !== f.full) {
        this.fleet.full = f.full;
        paintIcon(this.fleet.icon, 26, (ctx, r) => drawFleetIcon(ctx, r, f.full));
      }
    }
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

/**
 * The overworld's top row (DESIGN.md H4 "HUD, top row"): the stockpile icon and chips (ice and crystal hidden until the
 * stockpile first holds some), each with the rate the reclaimed areas ship at while you play, and "Reclaimed 3/6".
 */
export class OverworldHud {
  private readonly chips = new Map<RawResource, Chip>();
  private readonly reclaimed: HTMLElement;

  constructor(root: HTMLElement) {
    const stock = h('span', 'sp-icon', '', root);
    stock.title = 'Stockpile';
    stock.setAttribute('aria-label', 'Stockpile');
    stockpileIcon(stock, 26);
    const chips = h('div', 'sp-chips', '', root);
    for (const r of RAW_RESOURCES) this.chips.set(r, makeChip(chips, `sp-${r}`, `${RES_NAME[r]} in the stockpile`, (p) => resourceIcon(p, 18, r), true));
    this.reclaimed = h('span', 'reclaimed', '', root);
    this.reclaimed.id = 'reclaimed';
  }

  update(world: Readonly<World>, data: SimData): void {
    const st = campaignStatus(world, data);
    const totals = world.campaign.totals;
    for (const r of RAW_RESOURCES) {
      const c = this.chips.get(r)!;
      const seen = r === 'ore' || st.stockpile[r] > 0 || totals.hauled[r] > 0 || totals.shipped[r] > 0;
      setHidden(c.el, !seen);
      setText(c.count, String(st.stockpile[r]));
      const rate = st.shipPerMinX10[r];
      if (c.rate) setText(c.rate, rate > 0 ? `+${fmt10(rate)}/min` : '');
      c.el.title = rate > 0 ? `${RES_NAME[r]} in the stockpile, +${fmt10(rate)}/min while you play` : `${RES_NAME[r]} in the stockpile`;
    }
    setText(this.reclaimed, `Reclaimed ${st.reclaimed}/${st.areaCount}`);
  }
}
