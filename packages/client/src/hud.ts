/**
 * The HUD chips: icon + count per resource and per ship type, hidden until owned (DESIGN.md H3 "HUD").
 * Built once; `update` touches text and visibility only. All values come from the sim's selectors.
 */
import { RAW_RESOURCES, RESOURCES, SHIP_TYPES, campaignStatus, fleetCap, fleetStatus, isField, prizePerMin, shipCounts, unlockStatus, type RawResource, type Resource, type ShipType, type SimData, type World } from '@factory4x/sim';
import { h, setHidden, setText, toggleClass } from './dom.ts';
import { fmt10 } from './format.ts';
import { fleetIcon, paintIcon, resourceIcon, shipIcon, stockpileIcon } from './icons.ts';
import { drawFleetIcon } from './placeholders.ts';
import { palette } from './palette.ts';
import { RES_NAME, SHIP_NAME, fleetChipText, fleetLimitText, fleetLine } from './report.ts';

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
  private readonly fleet: Chip & { icon: HTMLCanvasElement; full: boolean; numbers: HTMLElement };

  constructor(root: HTMLElement) {
    // Two rows, so the fleet chip always sits with the ship chips it counts: resources, then ships and the fleet.
    const resRow = h('div', 'chip-row res', '', root);
    const shipRow = h('div', 'chip-row ships', '', root);
    for (const r of RESOURCES) {
      this.res.set(r, makeChip(resRow, `chip-${r}`, RES_NAME[r], (p) => resourceIcon(p, 18, r), r === 'ice' || r === 'crystal'));
    }
    for (const s of SHIP_TYPES) {
      this.ships.set(s, makeChip(shipRow, `chip-${s}`, SHIP_NAME[s], (p) => shipIcon(p, 20, s), false));
    }
    // H5: the fleet chip, "Fleet 9/12", with the fleet icon (closed amber bracket at the limit). Hidden while the limit is off.
    let icon!: HTMLCanvasElement;
    const chip = makeChip(shipRow, 'chip-fleet', 'Fleet limit', (p) => (icon = fleetIcon(p, 26, false)), false);
    chip.el.classList.add('fleet');
    chip.el.hidden = true;
    // "Fleet " and "9/12" are separate spans (the text stays "Fleet 9/12"), so the narrow landscape column can drop the
    // word and keep the icon and the numbers, as the ship chips do.
    chip.count.textContent = '';
    h('span', 'fl-word', 'Fleet ', chip.count);
    const numbers = h('span', 'fl-n', '', chip.count);
    this.fleet = { ...chip, icon, full: false, numbers };
  }

  update(world: Readonly<World>, data: SimData): void {
    const f = fleetStatus(world, data);
    setHidden(this.fleet.el, f.cap === null);
    if (f.cap !== null) {
      setText(this.fleet.numbers, fleetChipText(f.count, f.cap).replace(/^Fleet /, ''));
      this.fleet.el.title = fleetLine({ count: f.count, cap: f.cap });
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
    // H7: a field run has no lens or plating (no assemblers) and no per-type ship chips (the fleet chip counts every ship).
    const field = isField(world);
    for (const r of RESOURCES) {
      const c = this.res.get(r)!;
      setHidden(c.el, !unlocked.resources[r] || (field && (r === 'lens' || r === 'plating')));
      setText(c.count, String(world.stock[r]));
      if (c.rate) {
        const v = r === 'ice' || r === 'crystal' ? perMin[r] : 0;
        // "+3": the rate is per minute, as the ORE/MIN block and the sheets say; the unit stays in the tooltip so five resource chips fit a phone.
        setText(c.rate, v > 0 ? `+${v}` : '');
        if (v > 0) c.el.title = `${RES_NAME[r]}, +${v}/min from the pockets`;
      }
    }
    const counts = shipCounts(world).byType;
    for (const s of SHIP_TYPES) {
      const c = this.ships.get(s)!;
      setHidden(c.el, field || !unlocked.ships[s]);
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
  /** H6: "Fleet limit 20" with the fleet icon, hidden while `fleet.cap` is 0. Its count has room for three digits, so a relay never reflows the row. */
  private readonly fleet: Chip;

  constructor(root: HTMLElement) {
    const stock = h('span', 'sp-icon', '', root);
    stock.title = 'Stockpile';
    stock.setAttribute('aria-label', 'Stockpile');
    stockpileIcon(stock, 26);
    const chips = h('div', 'sp-chips', '', root);
    for (const r of RAW_RESOURCES) this.chips.set(r, makeChip(chips, `sp-${r}`, `${RES_NAME[r]} in the stockpile`, (p) => resourceIcon(p, 18, r), true));
    this.fleet = makeChip(chips, 'sp-fleet', 'Fleet limit', (p) => fleetIcon(p, 22, false), false);
    this.fleet.el.classList.add('fleet-limit');
    this.fleet.el.hidden = true;
    this.reclaimed = h('span', 'reclaimed', '', root);
    this.reclaimed.id = 'reclaimed';
  }

  update(world: Readonly<World>, data: SimData): void {
    const cap = fleetCap(world, data);
    setHidden(this.fleet.el, cap === null);
    if (cap !== null) {
      setText(this.fleet.count, fleetLimitText(cap));
      this.fleet.el.title = `${fleetLimitText(cap)}: reclaim command relays to raise it`;
    }
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
