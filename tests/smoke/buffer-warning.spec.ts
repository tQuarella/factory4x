import { expect, test, type Page } from '@playwright/test';

/**
 * H6 bug: "When an asteroid buffer is full the warning shows and hides rapidly, shifting the buttons under it." A buffer that
 * sits at its cap with pods leaving flips `buffer >= cap` every time a pod takes ore. Here a1 is rigged (one extractor, an L1
 * route), extracts more than the L1 route carries, and is left to back up at 4x. From the first "Backed up" on, the warning must
 * be shown on every animation frame and nothing in the sheet may move; after the route upgrade carries the extraction, it must clear
 * within 2 game seconds.
 */

const WIDE_FONT =
  '#sheet *, #research *, #sendpanel *, #result *, #win *, #chips *, #ow-stats *, #controls *, #tuning *, #feedback *, .card *, #banner, #toast, #toast::after, #hint { font-family: serif !important; font-size: 15px !important; letter-spacing: 0.15em !important; line-height: 1.5 !important; }';

// Pods leave every 300 ticks, so an L1 route carries 6/min and L2 12/min. One extractor gives 11/min: over L1, under L2. A 10-ore
// buffer fills in about two game minutes; the upgrade builds in 30 ticks.
const TUNABLES = { 'extractor.orePerMin': 11, 'node.bufferCap': 10, 'route.podIntervalTicks': 300, 'route.buildTicks': 30 };

interface Sample { shown: boolean; boxes: Record<string, number[]> }

async function setup(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  await page.addStyleTag({ content: WIDE_FONT });
  await page.evaluate((t) => window.__factory4x!.startCampaign({ research: { rigs: 1 }, land: 'landfall' } as never, t), TUNABLES);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.onOverworld())).toBe(false);
  await page.locator('#b-s4').click();
  const a1 = await page.evaluate(() => window.__factory4x!.nodeIndex('a1'));
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  const p = await page.evaluate((i) => window.__factory4x!.nodeScreenPos(i), a1);
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.selected())).toBe(a1);
}

/** One animation frame per sample for `ms`: is the warning showing, and where is every row and button of the sheet. */
function record(page: Page, ms: number): Promise<Sample[]> {
  return page.evaluate(
    (duration) =>
      new Promise<Sample[]>((resolve) => {
        const out: Sample[] = [];
        const t0 = performance.now();
        const step = (): void => {
          const warn = document.querySelector<HTMLElement>('#sheet .note.warn');
          const shown = !!warn && warn.getClientRects().length > 0 && getComputedStyle(warn).visibility !== 'hidden' && (warn.textContent ?? '').includes('Backed up');
          const boxes: Record<string, number[]> = {};
          let n = 0;
          for (const e of document.querySelectorAll<HTMLElement>('#sheet .row, #sheet .actions button, #sheet .pips')) {
            const r = e.getBoundingClientRect();
            boxes[`${e.tagName}${n++}`] = [r.x, r.y, r.width, r.height];
          }
          out.push({ shown, boxes });
          if (performance.now() - t0 < duration) requestAnimationFrame(step);
          else resolve(out);
        };
        requestAnimationFrame(step);
      }),
    ms,
  );
}

async function run(page: Page, size: { width: number; height: number }): Promise<void> {
  test.setTimeout(150_000);
  await setup(page, size);
  // Wait for the first backed-up warning (in the unfixed build it may blink, so poll the sheet's text, not its visibility).
  await expect.poll(() => page.evaluate(() => document.querySelector('#sheet .note.warn')?.textContent ?? ''), { timeout: 90_000, intervals: [100] }).toContain('Backed up');
  const samples = await record(page, 20_000);
  expect(samples.length).toBeGreaterThan(300);
  const first = samples[0]!;
  const bad: string[] = [];
  samples.forEach((s, i) => {
    if (!s.shown && bad.length < 8) bad.push(`frame ${i}: the warning is not showing`);
    for (const [k, b] of Object.entries(s.boxes)) {
      const a = first.boxes[k];
      if (!a) bad.push(`frame ${i}: ${k} appeared`);
      else if (b.some((v, j) => Math.abs(v - a[j]!) > 1) && bad.length < 8) bad.push(`frame ${i}: ${k} moved ${a.map(Math.round)} -> ${b.map(Math.round)}`);
    }
    if (Object.keys(s.boxes).length !== Object.keys(first.boxes).length && bad.length < 8) bad.push(`frame ${i}: ${Object.keys(s.boxes).length} sheet elements, was ${Object.keys(first.boxes).length}`);
  });
  expect(bad, 'the warning flickered or the sheet moved').toEqual([]);

  // The upgrade: once the route carries L2 (12/min against 11/min), the warning goes within 2 game seconds (60 ticks).
  await page.locator('#sheet button', { hasText: /^Upgrade route/ }).click();
  await expect(page.locator('#sheet')).toContainText('L2/5', { timeout: 30_000 });
  const t0 = await page.evaluate(() => window.__factory4x!.tick());
  await expect.poll(() => page.evaluate(() => (document.querySelector('#sheet .note.warn')?.classList.contains('idle') ?? true) || (document.querySelector('#sheet .note.warn') as HTMLElement | null)?.hidden === true), { intervals: [50] }).toBe(true);
  const t1 = await page.evaluate(() => window.__factory4x!.tick());
  expect(t1 - t0, 'game ticks from the upgrade to the warning clearing').toBeLessThanOrEqual(60);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
}

test('the backed-up warning holds steady and moves nothing: 375 px portrait, wide font', async ({ page }) => {
  await run(page, { width: 375, height: 667 });
});

test('the backed-up warning holds steady and moves nothing: desktop', async ({ page }) => {
  await run(page, { width: 1280, height: 800 });
});
