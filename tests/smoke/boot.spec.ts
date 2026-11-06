import { expect, test } from '@playwright/test';
import { defaultData, replayHashes } from '@factory4x/sim';
import { referenceReplay } from '../../packages/bots/src/reference-replay.ts';

test('build loads, sim ticks, and no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.locator('canvas#view')).toBeVisible();
  await expect(page.locator('#version')).not.toBeEmpty();

  // Sim advances in real time (30 ticks/s): wait for at least one second of ticks.
  await expect.poll(() => page.evaluate(() => window.__factory4x?.tick() ?? 0), { timeout: 10_000 }).toBeGreaterThan(30);

  // Canvas fits the viewport (no horizontal scroll on phones).
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);

  expect(errors).toEqual([]);
});

test('browser sim matches Node sim (cross-engine determinism)', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  const ticks = 3000;
  const every = 300;
  const browser = await page.evaluate(
    ([t, e, r]) => window.__factory4x!.replayHashes(t, e, r),
    [ticks, every, referenceReplay] as const,
  );
  expect(browser).toEqual(replayHashes(referenceReplay, defaultData, ticks, every));
});
