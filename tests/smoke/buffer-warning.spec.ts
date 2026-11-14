import { expect, test, type Page } from '@playwright/test';
import { stepSimUntil } from './helpers.ts';

/**
 * H6 bug: "When an asteroid buffer is full the warning shows and hides rapidly, shifting the buttons under it." A buffer that
 * sits at its cap with pods leaving flips `buffer >= cap` every time a pod takes ore. These tests hold a1's buffer at its cap
 * and sample every animation frame: the sheet's warning, the map's "!" badge and dashed route (as MapView drew them), and the
 * place of every row and button in the sheet, measured from the sheet's own top so a scroll can't hide a shift.
 */

const WIDE_FONT =
  '#sheet *, #research *, #sendpanel *, #result *, #win *, #chips *, #ow-stats *, #controls *, #tuning *, #feedback *, .card *, #banner, #toast, #toast::after, #hint { font-family: serif !important; font-size: 15px !important; letter-spacing: 0.15em !important; line-height: 1.5 !important; }';

const PORTRAIT = { width: 375, height: 667 };
const DESKTOP = { width: 1280, height: 800 };
const TICKS_PER_SEC = 30;

// 4x: pods leave every 300 ticks (an L1 route carries 6/min, L2 12/min) and one extractor gives 11/min: over L1, under L2. A
// 10-ore buffer fills in about two game minutes; the upgrade builds in 30 ticks.
const SLOW = { 'extractor.orePerMin': 11, 'node.bufferCap': 10, 'route.podIntervalTicks': 300, 'route.buildTicks': 30 };
// 1x: a pod every 150 ticks (5 s) and 40/min extracted: the buffer fills in about 20 s and sits at its cap with pods leaving.
const FAST = { 'extractor.orePerMin': 40, 'node.bufferCap': 10, 'route.podIntervalTicks': 150, 'route.buildTicks': 30 };
// No route: an extractor built in 30 ticks that fills a 10-ore buffer in about 15 game seconds.
const NO_ROUTE = { 'extractor.orePerMin': 40, 'node.bufferCap': 10, 'extractor.buildTicks': 30 };

interface Sample { shown: boolean; text: string; badge: boolean; route: boolean; boxes: Record<string, number[]> }

async function setup(page: Page, size: { width: number; height: number }, speed: 1 | 4, rigs: number, tunables: Record<string, number>): Promise<number> {
  await page.setViewportSize(size);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  await page.addStyleTag({ content: WIDE_FONT });
  await page.evaluate(([r, t]) => window.__factory4x!.startCampaign({ research: r ? { rigs: r } : {}, land: 'landfall' } as never, t as Record<string, number>), [rigs, tunables] as const);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.onOverworld())).toBe(false);
  await page.locator(speed === 4 ? '#b-s4' : '#b-s1').click();
  const a1 = await page.evaluate(() => window.__factory4x!.nodeIndex('a1'));
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  const p = await page.evaluate((i) => window.__factory4x!.nodeScreenPos(i), a1);
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.selected())).toBe(a1);
  return a1;
}

/** One animation frame per sample until `ticks` game ticks have passed. */
function record(page: Page, a1: number, ticks: number): Promise<Sample[]> {
  return page.evaluate(
    ([node, span]) =>
      new Promise<Sample[]>((resolve) => {
        const out: Sample[] = [];
        const f = window.__factory4x!;
        const t0 = f.tick();
        const step = (): void => {
          const sheet = document.getElementById('sheet')!;
          const warn = document.querySelector<HTMLElement>('#sheet .note.warn');
          const shown = !!warn && warn.getClientRects().length > 0 && getComputedStyle(warn).visibility !== 'hidden';
          const text = shown ? ((warn!.querySelector('.msg') ?? warn!).textContent ?? '') : '';
          const boxes: Record<string, number[]> = {};
          const top = sheet.getBoundingClientRect().top - sheet.scrollTop;
          let n = 0;
          for (const e of document.querySelectorAll<HTMLElement>('#sheet .row, #sheet .actions button, #sheet .pips')) {
            const r = e.getBoundingClientRect();
            boxes[`${e.tagName}${n++}`] = [r.x, r.y - top, r.width, r.height];
          }
          const drawn = f.mapBackedUp(node!);
          out.push({ shown, text, badge: drawn.badge, route: drawn.route, boxes });
          if (f.tick() - t0 < span!) requestAnimationFrame(step);
          else resolve(out);
        };
        requestAnimationFrame(step);
      }),
    [a1, ticks] as const,
  );
}

interface Expect { warning: RegExp | null; badge: boolean; route: boolean }

/** Every frame matches `want`, and every sheet box is within 1 px of `ref`. */
function check(samples: Sample[], ref: Sample, want: Expect): string[] {
  const bad: string[] = [];
  const add = (m: string): void => {
    if (bad.length < 10) bad.push(m);
  };
  samples.forEach((s, i) => {
    if (want.warning ? !s.shown || !want.warning.test(s.text) : s.shown) add(`frame ${i}: warning ${s.shown ? `shows "${s.text}"` : 'is hidden'}, wanted ${want.warning ?? 'none'}`);
    if (s.badge !== want.badge) add(`frame ${i}: map "!" badge ${s.badge ? 'drawn' : 'not drawn'}`);
    if (s.route !== want.route) add(`frame ${i}: dashed route ${s.route ? 'drawn' : 'not drawn'}`);
    if (Object.keys(s.boxes).length !== Object.keys(ref.boxes).length) add(`frame ${i}: ${Object.keys(s.boxes).length} sheet elements, was ${Object.keys(ref.boxes).length}`);
    for (const [k, b] of Object.entries(s.boxes)) {
      const a = ref.boxes[k];
      if (a && b.some((v, j) => Math.abs(v - a[j]!) > 1)) add(`frame ${i}: ${k} moved ${a.map(Math.round)} -> ${b.map(Math.round)}`);
    }
  });
  return bad;
}

const warnText = (page: Page): Promise<string> => page.evaluate(() => {
  const w = document.querySelector('#sheet .note.warn');
  return ((w?.querySelector('.msg') ?? w)?.textContent ?? '').trim();
});

/** Rigged a1 backs up: held for `holdTicks`; with `upgrade`, upgraded, cleared within 2 game seconds, and quiet for 10 more. */
async function backedUp(page: Page, size: { width: number; height: number }, speed: 1 | 4, tunables: Record<string, number>, holdTicks: number, upgrade: boolean): Promise<void> {
  test.setTimeout(180_000);
  const a1 = await setup(page, size, speed, 1, tunables);
  const [ref] = await record(page, a1, 2);
  expect(ref!.shown, 'no warning before the buffer fills').toBe(false);
  await stepSimUntil(page, async () => (await warnText(page)).includes('Backed up: route at capacity'), 6000, 'the route-at-capacity warning');
  await expect.poll(() => warnText(page), { timeout: 120_000, intervals: [100] }).toContain('Backed up: route at capacity');
  const held = await record(page, a1, holdTicks);
  expect(held.length).toBeGreaterThan(40);
  expect(check(held, ref!, { warning: /Backed up: route at capacity/, badge: true, route: true }), 'warning flickered, or the badge, the route or the sheet moved').toEqual([]);
  if (!upgrade) return;

  // L2 carries 12/min against 11/min: the warning goes within 2 game seconds of the upgrade finishing, and stays gone.
  await page.locator('#sheet button', { hasText: /^Upgrade route/ }).click();
  await expect(page.locator('#sheet')).toContainText('L2/5', { timeout: 30_000 });
  const t0 = await page.evaluate(() => window.__factory4x!.tick());
  await expect.poll(() => page.evaluate(() => {
    const w = document.querySelector('#sheet .note.warn');
    return !((w?.querySelector('.msg') ?? w)?.textContent ?? '').trim();
  }), { intervals: [50] }).toBe(true);
  expect((await page.evaluate(() => window.__factory4x!.tick())) - t0, 'game ticks from the upgrade to the warning clearing').toBeLessThanOrEqual(2 * TICKS_PER_SEC);
  const after = await record(page, a1, 10 * TICKS_PER_SEC);
  expect(after.length).toBeGreaterThan(20);
  expect(check(after, ref!, { warning: null, badge: false, route: false }), 'after the upgrade the warning, the badge or the route came back, or the sheet moved').toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
}

test('a backed-up buffer holds its warning, badge and route steady, and clears for good: 375 px portrait, wide font, 4x', async ({ page }) => {
  await backedUp(page, PORTRAIT, 4, SLOW, 20 * TICKS_PER_SEC, true);
});

test('a backed-up buffer holds its warning, badge and route steady, and clears for good: desktop, 4x', async ({ page }) => {
  await backedUp(page, DESKTOP, 4, SLOW, 20 * TICKS_PER_SEC, true);
});

test('a backed-up buffer holds its warning, badge and route steady: 375 px portrait, wide font, 1x', async ({ page }) => {
  // 15 game seconds at the cap: three pod departures at 1x.
  await backedUp(page, PORTRAIT, 1, FAST, 15 * TICKS_PER_SEC, false);
});

test('with no route: "No route" then "Backed up: no route" hold steady and move nothing', async ({ page }) => {
  test.setTimeout(120_000);
  const a1 = await setup(page, PORTRAIT, 4, 0, NO_ROUTE);
  const [ref] = await record(page, a1, 2);
  expect(ref!.shown).toBe(false);
  await page.locator('#sheet button', { hasText: /^Extractor/ }).click();
  await stepSimUntil(page, async () => /^No route: this ore goes nowhere\. Build a route\.$/.test(await warnText(page)), 3000, 'the no-route warning');
  await expect.poll(() => warnText(page), { timeout: 30_000, intervals: [50] }).toMatch(/^No route: this ore goes nowhere\. Build a route\.$/);
  const noRoute = await record(page, a1, 5 * TICKS_PER_SEC);
  expect(check(noRoute, ref!, { warning: /^No route: this ore goes nowhere\. Build a route\.$/, badge: true, route: false }), 'the no-route warning flickered or the sheet moved').toEqual([]);
  // The buffer fills with nothing to carry it away.
  await stepSimUntil(page, async () => /^Backed up: no route\. Build one\.$/.test(await warnText(page)), 6000, 'the backed-up no-route warning');
  await expect.poll(() => warnText(page), { timeout: 60_000, intervals: [50] }).toMatch(/^Backed up: no route\. Build one\.$/);
  const full = await record(page, a1, 5 * TICKS_PER_SEC);
  expect(check(full, ref!, { warning: /^Backed up: no route\. Build one\.$/, badge: true, route: false }), 'the full-buffer no-route warning flickered or the sheet moved').toEqual([]);
});
