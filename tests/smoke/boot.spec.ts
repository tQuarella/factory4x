import { expect, test, type Page } from '@playwright/test';
import { defaultData, replayHashes } from '@factory4x/sim';
import { referenceReplay } from '../../packages/bots/src/reference-replay.ts';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
}

/** Taps a node on the map by its screen position. */
async function tapNode(page: Page, node: number): Promise<void> {
  const p = await page.evaluate((i) => window.__factory4x!.nodeScreenPos(i), node);
  await page.mouse.click(p.x, p.y);
}

test('build loads, sim ticks, and no console errors', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('canvas#view')).toBeVisible();
  await expect(page.locator('#version')).not.toBeEmpty();
  await expect(page.locator('[data-hud="cw-hud-version"]')).toBeVisible();

  await expect.poll(() => page.evaluate(() => window.__factory4x?.tick() ?? 0), { timeout: 10_000 }).toBeGreaterThan(30);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});

test('tapping an asteroid opens its sheet; queuing an extractor changes the queue', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await tapNode(page, 1);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.selected())).toBe(1);
  await expect(page.locator('#sheet')).toBeVisible();
  await expect(page.locator('#sheet h2')).toContainText('A1');

  const before = await page.evaluate(() => window.__factory4x!.pendingBuilds());
  await page.locator('#sheet button', { hasText: /^Extractor/ }).click();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.pendingBuilds())).toBe(before + 1);
  expect(await page.evaluate(() => window.__factory4x!.inputCount())).toBeGreaterThan(0);

  // Tapping empty space deselects.
  const box = (await page.locator('#view').boundingBox())!;
  await page.mouse.click(box.x + 6, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.selected())).toBe(null);
  expect(errors).toEqual([]);
});

test('every control is at least 44 px', async ({ page }) => {
  await ready(page);
  await tapNode(page, 0);
  await expect(page.locator('#sheet')).toBeVisible();
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('button, input'))
      .filter((b) => b.offsetParent !== null && !b.closest('[hidden]'))
      .map((b) => ({ t: b.id || b.textContent?.slice(0, 20) || b.tagName, r: b.getBoundingClientRect() }))
      .filter((b) => b.r.height < 43.5 || b.r.width < 43.5)
      .map((b) => b.t),
  );
  expect(small).toEqual([]);
});

test('pause stops the tick counter and the time controls work', async ({ page }) => {
  await ready(page);
  await page.locator('#b-pause').click();
  await expect(page.locator('#paused')).toBeVisible();
  const t0 = await page.evaluate(() => window.__factory4x!.tick());
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__factory4x!.tick())).toBe(t0);
  await page.locator('#b-pause').click();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.tick())).toBeGreaterThan(t0);
});

test('tuning panel lists tunables and steppers change them through the input log', async ({ page }) => {
  await ready(page);
  await page.locator('#b-tune').click();
  await expect(page.locator('#tuning')).toBeVisible();
  const before = await page.evaluate(() => window.__factory4x!.inputCount());
  await page.getByLabel('Increase extractor.cost').click();
  await expect(page.getByLabel('extractor.cost', { exact: true })).toHaveValue('30');
  expect(await page.evaluate(() => window.__factory4x!.inputCount())).toBe(before + 1);
  await page.getByLabel('Reset extractor.cost to default').click();
  await expect(page.getByLabel('extractor.cost', { exact: true })).toHaveValue('20');
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
});

test('feedback pauses the game and builds a note', async ({ page }) => {
  await ready(page);
  await page.locator('#b-note').click();
  await expect(page.locator('#feedback')).toBeVisible();
  expect(await page.evaluate(() => window.__factory4x!.paused())).toBe(true);
  await page.locator('#feedback textarea').fill('smoke note');
  await page.locator('#feedback button', { hasText: 'Copy note' }).click();
  await page.locator('#feedback button.close').click();
  expect(await page.evaluate(() => window.__factory4x!.paused())).toBe(false);
});

test('autosave resumes the run and the replay still matches after a reload', async ({ page }) => {
  await ready(page);
  await tapNode(page, 1);
  await page.locator('#sheet button', { hasText: /^Extractor/ }).click();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.tick())).toBeGreaterThan(60);
  expect(await page.evaluate(() => window.__factory4x!.saveNow())).toBe(true);
  const savedTick = await page.evaluate(() => window.__factory4x!.tick());
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  expect(await page.evaluate(() => window.__factory4x!.tick())).toBeGreaterThanOrEqual(savedTick);
  expect(await page.evaluate(() => window.__factory4x!.inputCount())).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.tick())).toBeGreaterThan(savedTick + 30);
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
});

test('browser sim matches Node sim (cross-engine determinism)', async ({ page }) => {
  await ready(page);
  const ticks = 3000;
  const every = 300;
  const browser = await page.evaluate(
    ([t, e, r]) => window.__factory4x!.replayHashes(t, e, r),
    [ticks, every, referenceReplay] as const,
  );
  expect(browser).toEqual(replayHashes(referenceReplay, defaultData, ticks, every));
});

async function noticesClearOfBloom(page: Page): Promise<void> {
  await ready(page);
  await tapNode(page, 6);
  await expect(page.locator('#sheet')).toBeVisible();
  await page.evaluate(() => window.__factory4x!.debugShowNotices(true));
  await expect(page.locator('#banner')).toBeVisible();
  await expect(page.locator('#toast')).toBeVisible();
  const pos = await page.evaluate(() => window.__factory4x!.nodeScreenPos(6));
  // Generous box around the Bloom: thorn ring, label above it, badges.
  const view = (await page.locator('#view').boundingBox())!;
  // Only the part inside the canvas is ever drawn on.
  const bloom = { l: pos.x - 50, r: pos.x + 50, t: Math.max(view.y, pos.y - 62), b: pos.y + 50 };
  for (const sel of ['#banner', '#toast']) {
    const r = (await page.locator(sel).boundingBox())!;
    const hit = r.x < bloom.r && r.x + r.width > bloom.l && r.y < bloom.b && r.y + r.height > bloom.t;
    expect(hit, `${sel} overlaps the Bloom`).toBe(false);
    if (sel === '#banner') expect(r.y + r.height, 'banner sits above the map').toBeLessThanOrEqual(view.y + 1);
  }
}

test('battle banner and toast never cover the rich node', async ({ page }) => {
  await noticesClearOfBloom(page);
});

test('Reset all sends only changed tunables; New run keeps tuning and applies startStock', async ({ page }) => {
  await ready(page);
  await page.locator('#b-tune').click();
  await page.getByLabel('Increase extractor.cost', { exact: true }).click();
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => window.__factory4x!.inputCount());
  await page.locator('#tuning button', { hasText: 'Reset all' }).click();
  await expect(page.getByLabel('extractor.cost', { exact: true })).toHaveValue('20');
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__factory4x!.inputCount())).toBe(before + 1);

  const field = page.getByLabel('economy.startStock', { exact: true });
  await field.fill('150');
  await field.dispatchEvent('change');
  await page.locator('#tuning button', { hasText: 'New run' }).click();
  await expect(page.locator('.card')).toContainText('tuning is kept');
  await page.locator('.card button', { hasText: 'Yes, new run' }).click();
  await expect(page.getByLabel('economy.startStock', { exact: true })).toHaveValue('150');
  await expect.poll(() => page.evaluate(() => window.__factory4x!.stock())).toBeGreaterThan(100);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
});

test('paused "Attack with all" from two sources is one press, one tick, one wave', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  // Cheap, fast ships so two groups stage quickly.
  await page.locator('#b-tune').click();
  for (const [key, value] of [['ship.cost', '5'], ['ship.buildTicks', '15']] as const) {
    const field = page.getByLabel(key, { exact: true });
    await field.fill(value);
    await field.dispatchEvent('change');
  }
  await page.locator('#tuning button[aria-label="Close"]').click();
  await page.locator('#b-s4').click();

  // Stage ships at A5 (node 5), then let more gather at the Probe (node 0).
  await expect.poll(() => page.evaluate(() => window.__factory4x!.shipsAt(0)), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  await tapNode(page, 5);
  await page.locator('#sheet button', { hasText: /^From Probe/ }).click();
  await expect
    .poll(() => page.evaluate(() => [window.__factory4x!.shipsAt(5) > 0, window.__factory4x!.shipsAt(0) > 0].join()), { timeout: 30_000 })
    .toBe('true,true');

  await page.locator('#b-pause').click();
  await expect(page.locator('#paused')).toBeVisible();
  await tapNode(page, 6);
  const t0 = await page.evaluate(() => window.__factory4x!.tick());
  expect(await page.evaluate(() => window.__factory4x!.wavesSent())).toBe(0);
  await page.locator('#sheet button', { hasText: /^Attack with all/ }).click();
  expect(await page.evaluate(() => window.__factory4x!.tick())).toBe(t0 + 1);
  expect(await page.evaluate(() => window.__factory4x!.wavesSent())).toBe(1);
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
  expect(errors).toEqual([]);
});

test.describe('375x667 portrait', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('loads without horizontal overflow', async ({ page }) => {
    const errors = watchErrors(page);
    await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    expect(errors).toEqual([]);
  });

  test('every visible control is at least 44 px with each sheet open', async ({ page }) => {
    await ready(page);
    for (const node of [0, 1, 6]) {
      await tapNode(page, node);
      await expect(page.locator('#sheet')).toBeVisible();
      const small = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('button, input'))
          .filter((b) => b.offsetParent !== null && !b.closest('[hidden]'))
          .map((b) => ({ t: b.id || b.textContent?.slice(0, 20) || b.tagName, r: b.getBoundingClientRect() }))
          .filter((b) => b.r.height < 43.5 || b.r.width < 43.5)
          .map((b) => b.t),
      );
      expect(small, `node ${node}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    }
  });

  test('banner and toast never cover the rich node', async ({ page }) => {
    await noticesClearOfBloom(page);
  });
});
