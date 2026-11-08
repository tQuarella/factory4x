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

test('the Root sheet opens with the Feeds the Heart box; the heart sheet says fed; the probe names the layout', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  const root = await page.evaluate(() => window.__factory4x!.rootNode());
  await tapNode(page, root);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.selected())).toBe(root);
  await expect(page.locator('#sheet h2')).toContainText('Root');
  await expect(page.locator('#sheet')).toContainText('Feeds the Heart');
  await expect(page.locator('#sheet')).toContainText(/Cut it: \d+ Thorns \d+ Spores, 1 \/ 10\.0 s and 1 \/ 3\.3 s, no repair/);
  // Node 15 is the heart.
  await tapNode(page, 15);
  await expect(page.locator('#sheet')).toContainText('Fed by the Root');
  await tapNode(page, 0);
  const name = await page.evaluate(() => window.__factory4x!.systemName());
  expect(name).toMatch(/^(Frost Gate|Glass Thicket|Twin Seams)$/);
  await expect(page.locator('#sheet')).toContainText(`System: ${name}`);
  expect(errors).toEqual([]);
});

test('the tuning panel shows layout names and tick values in seconds; New run moves to the next layout', async ({ page }) => {
  await ready(page);
  await page.locator('#b-tune').click();
  await expect(page.locator('#tuning')).toContainText('0 · by seed / 1 Frost / 2 Glass / 3 Twin');
  await expect(page.locator('#tuning')).toContainText('60 · 2.0 s');
  const before = await page.evaluate(() => window.__factory4x!.systemName());
  await page.locator('#tuning button', { hasText: 'New run' }).click();
  await page.locator('.card button', { hasText: 'Yes, new run' }).click();
  const order = ['Frost Gate', 'Glass Thicket', 'Twin Seams'];
  await expect.poll(() => page.evaluate(() => window.__factory4x!.systemName())).toBe(order[(order.indexOf(before) + 1) % 3]);
});

test('forcing system.variant 3 and starting a New run gives Twin Seams, and the replay still matches', async ({ page }) => {
  await ready(page);
  await page.locator('#b-tune').click();
  const field = page.getByLabel('system.variant', { exact: true });
  await field.fill('3');
  await field.dispatchEvent('change');
  await page.locator('#tuning button', { hasText: 'New run' }).click();
  await page.locator('.card button', { hasText: 'Yes, new run' }).click();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.systemName())).toBe('Twin Seams');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
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

/**
 * Wide, tall text in the notices, so the check doesn't depend on which monospace
 * the OS falls back to (CI's Linux font wrapped the toast into the heart while
 * Windows' Consolas didn't).
 */
const WIDE_NOTICE_FONT = '#banner, #toast, #toast::after, #hint { font-family: serif !important; font-size: 15px !important; letter-spacing: 0.25em !important; line-height: 1.6 !important; }';

/** Node index of the Bloom heart on the H3 map. */
const HEART = 15;

async function noticesClearOfBloom(page: Page, stress = false): Promise<void> {
  await ready(page);
  if (stress) await page.addStyleTag({ content: WIDE_NOTICE_FONT });
  await tapNode(page, HEART);
  await expect(page.locator('#sheet')).toBeVisible();
  await page.evaluate(() => window.__factory4x!.debugShowNotices(true));
  await expect(page.locator('#banner')).toBeVisible();
  await expect(page.locator('#toast')).toBeVisible();
  await expect(page.locator('#banner')).toContainText('HEART ·');
  await expect(page.locator('#banner')).toContainText('ROOT ·');
  await expect(page.locator('#toast')).toContainText('Root cut:');
  const rootNode = await page.evaluate(() => window.__factory4x!.rootNode());
  const view = (await page.locator('#view').boundingBox())!;
  // Only the part inside the canvas is ever drawn on.
  // The notices strip is capped, so the map keeps most of its height with both notices up, whatever the font.
  const map = (await page.locator('#map').boundingBox())!;
  expect(view.height, 'map height with both notices').toBeGreaterThanOrEqual(map.height * 0.55 - 1);
  expect((await page.locator('#toast').boundingBox())!.height, 'toast stays tappable').toBeGreaterThanOrEqual(43.5);
  for (const sel of ['#banner', '#toast']) {
    const r = (await page.locator(sel).boundingBox())!;
    for (const node of [HEART, rootNode]) {
      const pos = await page.evaluate((i) => window.__factory4x!.nodeScreenPos(i), node);
      // Generous box around each guarded node: thorn ring, label above it, badges.
      const box = { l: pos.x - 50, r: pos.x + 50, t: Math.max(view.y, pos.y - 62), b: pos.y + 50 };
      const hit = r.x < box.r && r.x + r.width > box.l && r.y < box.b && r.y + r.height > box.t;
      expect(hit, `${sel} overlaps node ${node} r=${JSON.stringify(r)} box=${JSON.stringify(box)} view=${JSON.stringify(view)}`).toBe(false);
    }
    // Notices live in the strip above the canvas, so no text metric can push one onto the map.
    expect(r.y + r.height, `${sel} sits above the map`).toBeLessThanOrEqual(view.y + 1);
  }
}

test('battle banner and toast never cover the heart', async ({ page }) => {
  await noticesClearOfBloom(page);
});

test('battle banner and toast never cover the heart, even with a wide font', async ({ page }) => {
  await noticesClearOfBloom(page, true);
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
  for (const [key, value] of [['ship.drone.cost', '5'], ['ship.drone.buildTicks', '15']] as const) {
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
  await tapNode(page, HEART);
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
    // Probe, an asteroid, a pocket, the Root and the heart.
    for (const node of [0, 1, 10, 14, HEART]) {
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

  test('banner and toast never cover the heart', async ({ page }) => {
    await noticesClearOfBloom(page);
  });

  test('banner and toast never cover the heart, even with a wide font', async ({ page }) => {
    await noticesClearOfBloom(page, true);
  });
});
