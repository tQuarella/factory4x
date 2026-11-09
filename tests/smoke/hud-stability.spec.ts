import { expect, test, type Page } from '@playwright/test';
import type { CampaignStart } from '@factory4x/sim';

/**
 * H6 bug: the top bar oscillated while resources were gained and spent. The in-area HUD is held at its fullest (The Deep, all
 * five resource chips, all three ship chips, the fleet chip), the counts change on every frame across digit boundaries both
 * ways, and every HUD element must keep its box within 1 px of where it started.
 */

/** The same wide, tall text stress boot.spec.ts uses, so nothing depends on this machine's fallback font. */
const WIDE_FONT =
  '#sheet *, #research *, #sendpanel *, #result *, #win *, #chips *, #ow-stats *, #controls *, #tuning *, #feedback *, .card *, #banner, #toast, #toast::after, #hint { font-family: serif !important; font-size: 15px !important; letter-spacing: 0.15em !important; line-height: 1.5 !important; }';

const DEEP_START: CampaignStart = { reclaimed: ['landfall', 'shelf', 'shoal', 'veil', 'garden'], research: { lancer: 1, flak: 1 }, land: 'deep' };

/** Boundary-crossing walks; no two neighbours are equal (also round the end), so a count changes on every frame. */
const WALKS: Record<string, number[]> = {
  ore: [0, 1, 0, 1, 9, 10, 9, 10, 99, 100, 99, 100, 999, 1000, 999, 1000, 99, 10, 9, 1],
  ice: [0, 1, 9, 10, 99, 100, 99, 10, 9, 1, 0, 999, 1000, 999],
  crystal: [1000, 999, 100, 99, 10, 9, 1, 0, 1, 9, 10, 99, 100, 99, 9],
  // Components are capped at 50 (component.stockCap, at most 50), so they cross 0 and 9/10 but not 100.
  lens: [0, 1, 0, 9, 10, 9, 49, 50, 49, 0, 1, 10, 1],
  plating: [5, 0, 1, 0, 10, 9, 50, 49, 0, 9, 10, 1, 0, 5, 49],
  // The ORE/MIN block reserves three digits and its arrow (ore routes deliver tens a minute).
  rateOre: [0, 7, 99, 100, 99, 1, 0, 999, 998, 10, 9],
  rateIce: [0, 1, 0, 9, 10, 0, 99, 100, 0, 99],
  rateCrystal: [3, 0, 12, 0, 120, 0, 8, 0, 9],
  // Ships stay under the fleet limit (60 at most plus research), so the fleet chip is two digits: the HUD's counts cross 0, 9/10 and 59/60.
  drone: [0, 1, 0, 9, 10, 9, 59, 60, 59, 10, 1],
  lancer: [0, 1, 9, 10, 9, 1, 0, 10, 20, 9],
  flak: [1, 0, 10, 9, 0, 20, 9, 1, 10, 0, 9],
};
const FRAMES = 240;
const at = (k: string, i: number): number => WALKS[k]![i % WALKS[k]!.length]!;

interface Box { x: number; y: number; w: number; h: number }
interface Snap { boxes: Record<string, Box>; visible: string[]; rows: number; gaps: Record<string, number>; bottoms: Record<string, number> }

async function setup(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  await page.addStyleTag({ content: WIDE_FONT });
  await page.evaluate((s) => window.__factory4x!.startCampaign(s as never, {}), DEEP_START);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.onOverworld())).toBe(false);
  await page.locator('#b-s4').click();
}

/** Shows frame `i`, waits one animation frame, returns every HUD element's box, the shown chips and the chip row count. */
async function frame(page: Page, i: number): Promise<Snap> {
  const f = {
    stock: { ore: at('ore', i), ice: at('ice', i), crystal: at('crystal', i), lens: at('lens', i), plating: at('plating', i) },
    ore: at('rateOre', i),
    ice: at('rateIce', i),
    crystal: at('rateCrystal', i),
    ships: { drone: at('drone', i), lancer: at('lancer', i), flak: at('flak', i) },
    cap: 99,
  };
  await page.evaluate((v) => window.__factory4x!.debugHudFrame(v), f);
  return page.evaluate(
    () =>
      new Promise<Snap>((resolve) =>
        requestAnimationFrame(() => {
          const boxes: Record<string, Box> = {};
          const visible: string[] = [];
          const sel = '#bars, #stats, .stat, #chips, .chip-row, #chips .chip, #chips .chip canvas, #chips .chip b, #chips .chip small, #controls, #controls .ctl';
          const seen = new Map<string, number>();
          for (const e of document.querySelectorAll<HTMLElement>(sel)) {
            if (e.getClientRects().length === 0) continue;
            const r = e.getBoundingClientRect();
            const base = e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`;
            const n = seen.get(base) ?? 0;
            seen.set(base, n + 1);
            boxes[`${base}[${n}]`] = { x: r.x, y: r.y, w: r.width, h: r.height };
            if (e.classList.contains('chip')) visible.push(e.id);
          }
          const tops = new Set(
            [...document.querySelectorAll<HTMLElement>('#chips .chip')].filter((c) => c.getClientRects().length > 0).map((c) => Math.round(c.getBoundingClientRect().top / 4)),
          );
          // Each count's own text (a Range over the <b>'s contents, not the <b> box) starts beside its icon, whatever room the chip reserves.
          // Bottoms are measured from the top of #controls, so a layout can't push a chip down toward the buttons unseen.
          const gaps: Record<string, number> = {};
          const bottoms: Record<string, number> = {};
          const controlsTop = document.getElementById('controls')!.getBoundingClientRect().top;
          for (const c of document.querySelectorAll<HTMLElement>('#chips .chip')) {
            if (c.getClientRects().length === 0) continue;
            const range = document.createRange();
            range.selectNodeContents(c.querySelector('b')!);
            const text = range.getClientRects()[0]!;
            gaps[c.id] = text.left - c.querySelector('canvas')!.getBoundingClientRect().right;
            bottoms[c.id] = c.getBoundingClientRect().bottom - controlsTop;
          }
          resolve({ boxes, visible, rows: tops.size, gaps, bottoms });
        }),
      ),
  );
}

/**
 * Phone landscape (667x375), bottom of each chip minus the top of #controls, on main (f8fabe3) with no rates showing, its shortest
 * state. Chips already sit under the buttons there (a separate bug); this change must not push any lower.
 */
const MAIN_LANDSCAPE_BOTTOMS: Record<string, number> = { 'chip-ore': -96, 'chip-ice': -70, 'chip-crystal': -44, 'chip-lens': -18, 'chip-plating': 8, 'chip-drone': 34, 'chip-lancer': 60, 'chip-flak': 86, 'chip-fleet': 116 };

async function run(page: Page, size: { width: number; height: number }, maxRows: number | null, bottoms: Record<string, number> | null = null): Promise<void> {
  await setup(page, size);
  const first = await frame(page, 0);
  expect(first.visible.length).toBe(9);
  const bad: string[] = [];
  for (let i = 1; i < FRAMES; i++) {
    const cur = await frame(page, i);
    expect(cur.visible, `chips shown at frame ${i}`).toEqual(first.visible);
    if (bottoms) for (const [id, b] of Object.entries(cur.bottoms)) if (b > bottoms[id]! + 1 && bad.length < 12) bad.push(`frame ${i} ${id}: bottom ${b.toFixed(0)} px from the controls' top, main has ${bottoms[id]}`);
    if (maxRows !== null) expect(cur.rows, `rows at frame ${i}`).toBeLessThanOrEqual(maxRows);
    expect(cur.rows, `row count at frame ${i}`).toBe(first.rows);
    for (const [id, g] of Object.entries(cur.gaps)) if ((g > 8 || g < -1) && bad.length < 12) bad.push(`frame ${i} ${id}: its count starts ${g.toFixed(1)} px from its icon`);
    expect(Object.keys(cur.boxes), `elements at frame ${i}`).toEqual(Object.keys(first.boxes));
    for (const [k, b] of Object.entries(cur.boxes)) {
      const a = first.boxes[k]!;
      for (const d of ['x', 'y', 'w', 'h'] as const) {
        if (Math.abs(a[d] - b[d]) > 1 && bad.length < 12) bad.push(`frame ${i} ${k}.${d}: ${a[d].toFixed(1)} -> ${b[d].toFixed(1)}`);
      }
    }
  }
  expect(bad, 'HUD elements that moved or resized, or counts away from their icons').toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
}

test('the HUD holds still while counts change every frame: 375 px portrait, wide font', async ({ page }) => {
  await run(page, { width: 375, height: 667 }, 2);
});

test('the HUD holds still while counts change every frame: landscape', async ({ page }) => {
  await run(page, { width: 667, height: 375 }, null, MAIN_LANDSCAPE_BOTTOMS);
});

test('the HUD holds still while counts change every frame: desktop', async ({ page }) => {
  await run(page, { width: 1280, height: 800 }, null);
});
