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

/**
 * One wide, tall text stress for every layout assertion in this file, so nothing depends on which monospace the OS
 * falls back to (CI's Linux font wrapped text that Windows' Consolas didn't). Covers the sheet, panels, chips and notices.
 */
const WIDE_FONT =
  '#sheet *, #sendpanel *, #result *, #chips *, #tuning *, #feedback *, .card *, #banner, #toast, #toast::after, #hint { font-family: serif !important; font-size: 15px !important; letter-spacing: 0.15em !important; line-height: 1.5 !important; }';

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  await page.addStyleTag({ content: WIDE_FONT });
}

/** Taps a node on the map by its screen position. */
async function tapNode(page: Page, node: number): Promise<void> {
  const p = await page.evaluate((i) => window.__factory4x!.nodeScreenPos(i), node);
  await page.mouse.click(p.x, p.y);
}

test('build loads, sim ticks, and no console errors', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
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
  await page.locator('#sheet button', { hasText: /^Send all from Probe/ }).click();
  await expect
    .poll(() => page.evaluate(() => [window.__factory4x!.shipsAt(5) > 0, window.__factory4x!.shipsAt(0) > 0].join()), { timeout: 30_000 })
    .toBe('true,true');

  await page.locator('#b-pause').click();
  await expect(page.locator('#paused')).toBeVisible();
  await tapNode(page, HEART);
  const t0 = await page.evaluate(() => window.__factory4x!.tick());
  expect(await page.evaluate(() => window.__factory4x!.wavesSent())).toBe(0);
  await page.locator('#sheet button', { hasText: /^Attack with all sources/ }).click();
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

// ---------------------------------------------------------------------------
// H3: the counter web through the UI. One play-through. Unstressed text would hide layout bugs, so every
// H3 surface runs with a wide serif font and wide letter spacing, as the notices tests above do.

/** Sets sim tunables through the tuning panel, then starts a New run (startStock applies there). Leaves the game at 4x. */
async function startTunedRun(page: Page, values: Record<string, number>): Promise<void> {
  await page.locator('#b-tune').click();
  for (const [key, value] of Object.entries(values)) {
    const field = page.getByLabel(key, { exact: true });
    await field.fill(String(value));
    await field.dispatchEvent('change');
  }
  await page.locator('#tuning button', { hasText: 'New run' }).click();
  await page.locator('.card button', { hasText: 'Yes, new run' }).click();
  await expect(page.locator('#tuning')).toBeHidden();
  await page.locator('#b-s4').click();
}

/** Every visible control inside `root` is at least 44 px and nothing sticks out sideways. */
async function expectControlsFit(page: Page, root: string, label: string): Promise<void> {
  const bad = await page.evaluate((sel) => {
    const out: string[] = [];
    const w = window.innerWidth;
    for (const r of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      for (const e of Array.from(r.querySelectorAll<HTMLElement>('button, input, .card, .tag-badge, .chip, .capture-order'))) {
        if (e.offsetParent === null || e.closest('[hidden]')) continue;
        const b = e.getBoundingClientRect();
        const name = `${e.tagName}.${e.className} "${(e.textContent ?? '').slice(0, 24)}"`;
        if (b.right > w + 1 || b.left < -1) out.push(`${name} sticks out: ${Math.round(b.left)}..${Math.round(b.right)} of ${w}`);
        if ((e.tagName === 'BUTTON' || e.tagName === 'INPUT') && (b.height < 43.5 || b.width < 43.5)) out.push(`${name} is ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
    }
    if (document.documentElement.scrollWidth > w) out.push('page scrolls sideways');
    return out;
  }, root);
  expect(bad, label).toEqual([]);
}

async function h3PlayThrough(page: Page): Promise<void> {
  const errors = watchErrors(page);
  await ready(page);
  // Frost Gate, cheap and quick, soft guards, and a pocket that pays fast, so the whole chain fits in a few seconds at 4x.
  await startTunedRun(page, {
    'system.variant': 1,
    'economy.startStock': 200,
    'guard.capPct': 25,
    'ship.drone.cost': 5,
    'ship.drone.buildTicks': 15,
    'ship.lancer.cost': 5,
    'ship.lancer.buildTicks': 30,
    'component.buildTicks': 30,
    'pocket.resourcePerMin': 40,
  });
  await expect.poll(() => page.evaluate(() => window.__factory4x!.systemName())).toBe('Frost Gate');

  // The HUD starts simple: ore and drone chips only.
  await expect(page.locator('#chip-ore')).toBeVisible();
  await expect(page.locator('#chip-drone')).toBeVisible();
  for (const hidden of ['ice', 'crystal', 'lens', 'plating', 'lancer', 'flak']) await expect(page.locator(`#chip-${hidden}`)).toBeHidden();
  await expectControlsFit(page, '#bars', 'HUD at the start');

  // Take the crystal pocket with drones.
  const crystal = await page.evaluate(() => window.__factory4x!.pocketNode('crystal'));
  const ice = await page.evaluate(() => window.__factory4x!.pocketNode('ice'));
  expect(crystal).toBeGreaterThan(0);
  expect(ice).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.shipsAt(0)), { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
  // Stop the drone yard so the start stock is left for components and lancers.
  await tapNode(page, 0);
  const droneRow = page.locator('#sheet [data-yard="drone"]');
  await expect(droneRow.locator('button.tog')).toHaveText('ON');
  await droneRow.locator('button.tog').click();
  await expect(droneRow.locator('button.tog')).toHaveText('OFF');
  await tapNode(page, crystal);
  await expect(page.locator('#sheet h2')).toContainText(/Pocket P\d · Crystal/);
  await expect(page.locator('#sheet .prize-line')).toContainText(/Prize: Crystal · \d slots · \d+\/min each · unlocks Lens → Lancer/);
  await expect(page.locator('#sheet [data-ship="drone"] .tag-badge')).toHaveText('Even');
  await expect(page.locator('#sheet [data-ship="lancer"]')).toBeHidden();
  await expectControlsFit(page, '#sheet', 'pocket sheet');
  await page.locator('#sheet button', { hasText: /^Attack with all from Probe/ }).click();
  await expect.poll(() => page.evaluate((n) => window.__factory4x!.owned(n), crystal), { timeout: 20_000 }).toBe(true);

  // The captured pocket is a producer: route its crystal to the probe, and the crystal chip and the Lancer yard appear.
  await expect(page.locator('#sheet h2')).toContainText('Crystal');
  await page.locator('#sheet button', { hasText: /^Route to probe/ }).click();
  await expect(page.locator('#chip-crystal')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#toast')).toContainText(/Crystal delivered: Lens and Lancers unlocked\. Turn on the Lancer yard at the Probe/);
  await expect(page.locator('#chip-lens')).toBeVisible();

  // The probe sheet: one tap on the unlock notice opens it. Yards (Lancer row unlocked, off at first), Assembly (lens).
  await page.locator('#toast').click();
  await expect(page.locator('#sheet h2')).toHaveText('Probe');
  await expect(page.locator('#toast')).toBeHidden();
  const lancerRow = page.locator('#sheet [data-yard="lancer"]');
  await expect(lancerRow).toBeVisible();
  await expect(page.locator('#sheet [data-yard="flak"]')).toBeHidden();
  await expect(page.locator('#sheet')).toContainText('Take an ice pocket to unlock Flak');
  await expect(lancerRow).toContainText(/5 ore \+ 1 Lens/i);
  await expect(page.locator('#sheet [data-assembler="lens"]')).toBeVisible();
  await expect(page.locator('#sheet [data-assembler="lens"]')).toContainText(/5 ore \+ 4 crystal/);
  await expect(page.locator('#sheet [data-assembler="plating"]')).toBeHidden();
  await expectControlsFit(page, '#sheet', 'probe sheet with yards and assembly');
  await lancerRow.locator('button.tog').click();
  await expect(lancerRow.locator('button.tog')).toHaveText('ON');
  // The first wave took every drone, so start the drone yard again for the mixed fleet.
  await droneRow.locator('button.tog').click();
  await expect(droneRow.locator('button.tog')).toHaveText('ON');
  await expect(page.locator('#chip-lancer')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#chip-lancer b')).not.toHaveText('0', { timeout: 30_000 });
  await expectControlsFit(page, '#bars', 'HUD with chips');

  // Wait for a mixed fleet at the probe, then open the ice pocket and choose ships.
  await expect
    .poll(() => page.evaluate(() => {
      const c = window.__factory4x!.shipsAtByType(0);
      return c.drone > 0 && c.lancer > 0;
    }), { timeout: 30_000 })
    .toBe(true);
  await tapNode(page, ice);
  await expect(page.locator('#sheet .prize-line')).toContainText(/Prize: Ice · \d slots · \d+\/min each · unlocks Plating → Flak/);
  await expect(page.locator('#sheet [data-ship="lancer"] .tag-badge')).toHaveText(/Weak|Even|Strong/);
  await expect(page.locator('#sheet [data-ship="drone"] .tag-badge')).toHaveText('Even');
  await expect(page.locator('#sheet [data-ship="lancer"]')).toContainText('Strong vs Thorns, Weak vs Spores');
  await expectControlsFit(page, '#sheet', 'ice pocket sheet with tags and send rows');
  await page.locator('#sheet .send-row', { hasText: 'from Probe' }).locator('button.choose-btn').click();
  const panel = page.locator('#sendpanel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-ship="drone"]')).toBeVisible();
  await expect(panel.locator('[data-ship="lancer"]')).toBeVisible();
  await expect(panel.locator('[data-ship="flak"]')).toBeHidden();
  await expectControlsFit(page, '#sendpanel', 'send panel');
  const sendBtn = panel.locator('button.primary');
  const sendBox = (await sendBtn.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(sendBox.y + sendBox.height, 'Send stays on screen').toBeLessThanOrEqual(vp.height);
  const shown = async (type: string): Promise<number> => Number((await panel.locator(`[data-ship="${type}"] .sp-count`).innerText()).split('/')[0]);
  const drones = await shown('drone');
  const lancers = await shown('lancer');
  expect(drones).toBeGreaterThan(0);
  expect(lancers).toBeGreaterThan(0);
  await panel.getByLabel('Fewer Drone').click();
  expect(await shown('drone')).toBe(drones - 1);
  await panel.getByLabel('All Drone').click();
  expect(await shown('drone')).toBeGreaterThanOrEqual(drones);
  await panel.getByLabel('Fewer Lancer').click();
  expect(await shown('lancer')).toBe(lancers - 1);
  await panel.getByLabel('More Lancer').click();
  expect(await shown('lancer')).toBe(lancers);
  const wave0 = await page.evaluate(() => window.__factory4x!.wavesSent());
  await sendBtn.click();
  await expect(panel).toBeHidden();
  await expect.poll(() => page.evaluate(() => JSON.parse(window.__factory4x!.lastInput()).type as string)).toBe('sendShips');
  const input = JSON.parse(await page.evaluate(() => window.__factory4x!.lastInput())) as { type: string; from: number; to: number; counts: Record<string, number> };
  expect(input.type).toBe('sendShips');
  expect(input.from).toBe(0);
  expect(input.to).toBe(ice);
  expect(input.counts.lancer).toBe(lancers);
  expect(input.counts.drone).toBeGreaterThan(0);
  expect(input.counts.flak).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.wavesSent())).toBe(wave0 + 1);

  // The result panel lists the capture order (the heart is not taken, so it ends with the pocket).
  await page.evaluate(() => window.__factory4x!.debugShowResult());
  await expect(page.locator('#result .capture-order')).toContainText(/Crystal \(P\d\) \d+:\d\d/);
  await expect(page.locator('#result')).toContainText('Frost Gate');
  await expect(page.locator('#result')).toContainText('Ships lost');
  await expectControlsFit(page, '#result', 'result panel');
  await page.locator('#result button', { hasText: 'Keep playing' }).click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
  expect(errors).toEqual([]);
}

test('H3: capture a pocket, unlock Lancers, send a mixed fleet through the send panel', async ({ page }) => {
  test.setTimeout(90_000);
  await h3PlayThrough(page);
});

test.describe('H3 at 375x667 portrait', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('capture a pocket, unlock Lancers, send a mixed fleet through the send panel', async ({ page }) => {
    test.setTimeout(90_000);
    await h3PlayThrough(page);
  });
});
