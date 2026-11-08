import { expect, test, type Page } from '@playwright/test';
import { createWorld, defaultData, replayHashes, serializeWorld, type CampaignStart } from '@factory4x/sim';
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
 * falls back to (CI's Linux font wrapped text that Windows' Consolas didn't). Covers the sheets, panels, both HUDs
 * (chips, stockpile, the control row) and the notices.
 */
const WIDE_FONT =
  '#sheet *, #research *, #sendpanel *, #result *, #win *, #chips *, #ow-stats *, #controls *, #tuning *, #feedback *, .card *, #banner, #toast, #toast::after, #hint { font-family: serif !important; font-size: 15px !important; letter-spacing: 0.15em !important; line-height: 1.5 !important; }';

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  await page.addStyleTag({ content: WIDE_FONT });
}

/** Two animation frames: a notice that just appeared has resized the canvas and the map has re-fitted. */
async function settled(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

/** Taps a node of the area being played, by its screen position. */
async function tapNode(page: Page, node: number): Promise<void> {
  await settled(page);
  const p = await page.evaluate((i) => window.__factory4x!.nodeScreenPos(i), node);
  await page.mouse.click(p.x, p.y);
}

/** Taps an area on the overworld by its screen position (data order: landfall 0, shelf 1, shoal 2, veil 3, garden 4, deep 5). */
async function tapArea(page: Page, area: number): Promise<void> {
  await settled(page);
  const p = await page.evaluate((i) => window.__factory4x!.areaScreenPos(i), area);
  await page.mouse.click(p.x, p.y);
}

const LANDFALL = 0;
const SHELF = 1;

/** Overworld to landed, by taps: tap the area, tap Land. */
async function landByTaps(page: Page, area: number, name: string): Promise<void> {
  await tapArea(page, area);
  await expect(page.locator('#sheet h2')).toHaveText(name);
  await page.locator('#sheet button.land').click();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.activeArea())).toBe(area);
}

/** Every area but The Deep reclaimed, both designs bought, landed in The Deep at tick 0 (the H3 game, as a dev hook). */
const DEEP_START: CampaignStart = { reclaimed: ['landfall', 'shelf', 'shoal', 'veil', 'garden'], research: { lancer: 1, flak: 1 }, land: 'deep' };

async function startCampaign(page: Page, start: CampaignStart, tunables: Record<string, number> = {}): Promise<void> {
  await page.evaluate(([s, t]) => window.__factory4x!.startCampaign(s as never, t as never), [start, tunables] as const);
}

/** Node index of the Bloom heart on The Deep (the H3 map). */
const HEART = 15;

/** Every visible control inside `root` is at least 44 px and nothing sticks out sideways. */
async function expectControlsFit(page: Page, root: string, label: string): Promise<void> {
  const bad = await page.evaluate((sel) => {
    const out: string[] = [];
    const w = window.innerWidth;
    for (const r of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      for (const e of Array.from(r.querySelectorAll<HTMLElement>('button, input, .card, .tag-badge, .chip, .cost-chip, .capture-order, .reclaimed'))) {
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

/** No text in the HUD wraps onto a second line, and no control's text pokes out of the control. */
async function expectHudNoWrap(page: Page, label: string): Promise<void> {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    for (const e of Array.from(document.querySelectorAll<HTMLElement>('#bars b, #bars small, #bars .reclaimed, #bars button, #bars .lbl'))) {
      if (e.offsetParent === null || e.closest('[hidden]')) continue;
      if (e.textContent === null || e.textContent.trim() === '') continue;
      const range = document.createRange();
      range.selectNodeContents(e);
      const lines = new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top)));
      const name = `${e.tagName}.${e.className}#${e.id} "${e.textContent.slice(0, 24)}"`;
      if (lines.size > 1) out.push(`${name} wraps onto ${lines.size} lines`);
      const box = e.getBoundingClientRect();
      const text = range.getBoundingClientRect();
      if (e.tagName === 'BUTTON' && (text.left < box.left - 1 || text.right > box.right + 1)) out.push(`${name} text pokes out of its button`);
    }
    return out;
  });
  expect(bad, label).toEqual([]);
}

test('build loads on the overworld; nothing ticks there; no console errors', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await expect(page.locator('canvas#view')).toBeVisible();
  await expect(page.locator('#version')).not.toBeEmpty();
  await expect(page.locator('[data-hud="cw-hud-version"]')).toBeVisible();
  expect(await page.evaluate(() => window.__factory4x!.onOverworld())).toBe(true);
  await expect(page.locator('#reclaimed')).toHaveText(/^Reclaimed 0\/6$/);
  await expect(page.locator('#b-research')).toBeVisible();
  // No speed or pause buttons on the overworld: it is paused.
  for (const id of ['#b-pause', '#b-s1', '#b-s2', '#b-s4', '#b-world']) await expect(page.locator(id)).toBeHidden();
  await expect(page.locator('#hint')).toContainText('Tap Landfall, then Land');
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__factory4x!.tick())).toBe(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});

test('overworld: tap an area for its sheet; a held area cannot be landed on', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await tapArea(page, LANDFALL);
  await expect(page.locator('#sheet h2')).toHaveText('Landfall');
  await expect(page.locator('#sheet .area-status')).toHaveText('Open');
  await expect(page.locator('#sheet')).toContainText(/Reclaim to haul \d+ ore/);
  await expect(page.locator('#sheet')).toContainText(/then ships .* while you play elsewhere/);
  await expect(page.locator('#sheet button.land')).toBeEnabled();
  await tapArea(page, 3);
  await expect(page.locator('#sheet h2')).toHaveText('Spore Veil');
  await expect(page.locator('#sheet .area-status')).toContainText('Held: reclaim a neighbour first');
  await expect(page.locator('#sheet button.land')).toBeDisabled();
  await expect(page.locator('#sheet .area-guard').first()).toBeVisible();
  // Heart counters carry "(not researched)" on designs you lack; Landfall has no guards.
  await page.locator('#sheet .area-tags').scrollIntoViewIfNeeded();
  await expect(page.locator('#sheet .area-tag[data-ship="lancer"]')).toContainText('(not researched)');
  await expect(page.locator('#sheet .area-tag[data-ship="lancer"] .tag-badge')).toHaveText(/Strong|Even|Weak/);
  // On a phone the sheet overlays the bottom of the map, where Landfall is: tap empty space first.
  const box = (await page.locator('#view').boundingBox())!;
  await page.mouse.click(box.x + 4, box.y + box.height / 2);
  await expect(page.locator('#sheet')).toBeHidden();
  await tapArea(page, LANDFALL);
  await expect(page.locator('#sheet')).toContainText('No guards: the first ship to arrive reclaims it');
  await page.mouse.click(box.x + 4, box.y + box.height / 2);
  await expect(page.locator('#sheet')).toBeHidden();
  expect(errors).toEqual([]);
});

/** The first slice, by taps: land in Landfall, build nothing, send the first drone at the empty heart, take the result, go back. */
async function landfallRun(page: Page): Promise<void> {
  const errors = watchErrors(page);
  await ready(page);
  await landByTaps(page, LANDFALL, 'Landfall');
  await expect(page.locator('#toast')).toContainText('Landed in Landfall');
  await expect(page.locator('#b-world')).toBeVisible();
  await expect(page.locator('#b-research')).toBeHidden();
  await page.locator('#b-s4').click();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.shipsAt(0)), { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
  const heart = await page.evaluate(() => window.__factory4x!.nodeIndex('heart'));
  await tapNode(page, heart);
  await expect(page.locator('#sheet')).toContainText('Prize: Ore');
  // The heart has no Root, so no supply line.
  await expect(page.locator('#sheet .supply')).toBeHidden();
  await page.locator('#sheet button', { hasText: /^Attack with all from Probe/ }).click();
  await expect(page.locator('#result')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#result h2')).toHaveText('Landfall reclaimed');
  await expect(page.locator('#result .haul-line')).toContainText(/\+\d+ ore/);
  await expectControlsFit(page, '#result', 'area result panel');
  await page.locator('#result button', { hasText: 'Back to the overworld' }).click();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.onOverworld())).toBe(true);
  await expect(page.locator('#reclaimed')).toHaveText(/^Reclaimed 1\/6$/);
  await expect(page.locator('#toast')).toContainText(/Landfall reclaimed: \+\d+ ore\. Opened: Frost Shelf, Glass Shoal\./);
  await expect(page.locator('#sp-ore b')).not.toHaveText('0');
  // Frost Shelf is open now.
  await page.locator('#toast').click();
  await tapArea(page, SHELF);
  await expect(page.locator('#sheet .area-status')).toHaveText('Open');
  await expect(page.locator('#sheet button.land')).toBeEnabled();
  // The sheet overlays the bottom of the map (Landfall is under it): tap empty space to close it, then Landfall.
  const box = (await page.locator('#view').boundingBox())!;
  await page.mouse.click(box.x + 4, box.y + box.height / 2);
  await expect(page.locator('#sheet')).toBeHidden();
  await tapArea(page, LANDFALL);
  await expect(page.locator('#sheet .area-status')).toContainText('Reclaimed');
  await expect(page.locator('#sheet button.land')).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
  expect(errors).toEqual([]);
}

test('overworld: land in Landfall, reclaim it with the first ship, return', async ({ page }) => {
  test.setTimeout(90_000);
  await landfallRun(page);
});

test('research: buy a level and see it in the next landing notice; a withdraw keeps it', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await startCampaign(page, { reclaimed: ['landfall'], stockpile: { ore: 400, ice: 0, crystal: 0 } });
  await expect(page.locator('#sp-ore b')).toHaveText('400');
  await page.locator('#b-research').click();
  await expect(page.locator('#research')).toBeVisible();
  const opening = page.locator('#research section[data-item="opening"]');
  const extract = page.locator('#research section[data-item="extract"]');
  await expect(opening).toContainText('0/3');
  // Rigs needs Extraction first and says so.
  await expect(page.locator('#research section[data-item="rigs"] button.buy')).toBeDisabled();
  await expect(page.locator('#research section[data-item="rigs"] button.buy')).toHaveText(/^Needs Extraction 1$/);
  await expect(page.locator('#research section[data-item="core"] button.buy')).toBeDisabled();
  await opening.locator('button.buy').click();
  await expect(opening).toContainText('1/3');
  await expect(page.locator('#toast')).toContainText(/^Opening ore 1: you now land with \d+ ore/);
  await extract.locator('button.buy').click();
  await expect(extract).toContainText('1/3');
  await expect(page.locator('#toast')).toContainText(/Extraction 1: extractors now yield \+\d+%/);
  // Now Seed rigs is buyable.
  await expect(page.locator('#research section[data-item="rigs"] button.buy')).toBeEnabled();
  await expect(page.locator('#sp-ore b')).not.toHaveText('400');
  await page.locator('#research button[aria-label="Close research"]').click();
  await expect(page.locator('#research')).toBeHidden();

  // The next landing names both effects, and the ore it names is the ore in stock.
  await landByTaps(page, SHELF, 'Frost Shelf');
  const toast = await page.locator('#toast').innerText();
  expect(toast).toMatch(/Landed in Frost Shelf · \d+ ore/);
  expect(toast).toMatch(/extraction \+\d+%/);
  const named = Number(/Landed in Frost Shelf · (\d+) ore/.exec(toast)![1]);
  // The notice names the opening ore the research gives: the live start stock plus the opening step (both tunables, read from the data).
  expect(named).toBe(defaultData.tunables['economy.startStock'].default + defaultData.tunables['research.opening.step'].default);

  // A withdraw returns to the overworld and keeps research and the stockpile.
  const ore = await page.evaluate(() => JSON.parse(window.__factory4x!.campaign()).stockpile.ore as number);
  await page.locator('#b-world').click();
  await expect(page.locator('section.overlay:not([id]) .card')).toContainText('Withdraw from Frost Shelf?');
  await expect(page.locator('section.overlay:not([id]) .card')).toContainText('Research and the stockpile are kept');
  await page.locator('section.overlay:not([id]) .card button', { hasText: 'Withdraw' }).click();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.onOverworld())).toBe(true);
  await expect(page.locator('#toast')).toContainText('Withdrew from Frost Shelf');
  await expect(page.locator('#reclaimed')).toHaveText(/^Reclaimed 1\/6$/);
  expect(await page.evaluate(() => JSON.parse(window.__factory4x!.campaign()).stockpile.ore as number)).toBeGreaterThanOrEqual(ore);
  expect(await page.evaluate(() => JSON.parse(window.__factory4x!.campaign()).research.opening as number)).toBe(1);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
  expect(errors).toEqual([]);
});

test('withdraw asks first; Stay keeps the area; Withdraw resets it', async ({ page }) => {
  await ready(page);
  await landByTaps(page, LANDFALL, 'Landfall');
  await page.locator('#b-world').click();
  await expect(page.locator('section.overlay:not([id]) .card')).toContainText('Withdraw from Landfall?');
  await page.locator('section.overlay:not([id]) .card button', { hasText: 'Stay' }).click();
  await expect(page.locator('section.overlay:not([id]) .card')).toHaveCount(0);
  expect(await page.evaluate(() => window.__factory4x!.onOverworld())).toBe(false);
  await page.locator('#b-world').click();
  await page.locator('section.overlay:not([id]) .card button', { hasText: 'Withdraw' }).click();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.onOverworld())).toBe(true);
  await expect(page.locator('#reclaimed')).toHaveText(/^Reclaimed 0\/6$/);
  // The area is held and open again: a second landing works.
  await landByTaps(page, LANDFALL, 'Landfall');
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
});

test('a tap on the overworld in the first frame after a running withdraw keeps its sheet, and Land works', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await landByTaps(page, LANDFALL, 'Landfall');
  expect(await page.evaluate(() => window.__factory4x!.paused())).toBe(false);
  await page.locator('#b-world').click();
  await page.locator('section.overlay:not([id]) .card button', { hasText: 'Withdraw' }).click();
  // The withdraw applies inside the frame loop (the game is running). Tap Landfall from inside the page in the
  // first animation frame where onOverworld() is true: no Playwright round trip, so no time for a UI refresh.
  const tapped = await page.evaluate(
    (area) =>
      new Promise<boolean>((resolve) => {
        const poll = (): void => {
          const f = window.__factory4x!;
          if (!f.onOverworld()) {
            requestAnimationFrame(poll);
            return;
          }
          const p = f.areaScreenPos(area);
          document.querySelector('canvas#view')!.dispatchEvent(new MouseEvent('click', { clientX: p.x, clientY: p.y, bubbles: true }));
          resolve(true);
        };
        requestAnimationFrame(poll);
      }),
    LANDFALL,
  );
  expect(tapped).toBe(true);
  // Several 100 ms UI refreshes later, the sheet the tap opened is still open.
  await page.waitForTimeout(400);
  await expect(page.locator('#sheet h2')).toHaveText('Landfall');
  await page.locator('#sheet button.land').click();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.activeArea())).toBe(LANDFALL);
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
  expect(errors).toEqual([]);
});

test('win: buy the probe core and reach the win panel; New system asks first', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await startCampaign(page, {
    reclaimed: ['landfall', 'shelf', 'shoal', 'veil', 'garden', 'deep'],
    research: { lancer: 1, flak: 1 },
    stockpile: { ore: 2000, ice: 600, crystal: 600 },
  });
  await expect(page.locator('#reclaimed')).toHaveText(/^Reclaimed 6\/6$/);
  await page.locator('#b-research').click();
  const core = page.locator('#research section[data-item="core"] button.buy');
  await expect(core).toBeEnabled();
  await expectControlsFit(page, '#research', 'research sheet');
  await core.click();
  await expect(page.locator('#win')).toBeVisible();
  await expect(page.locator('#win h2')).toHaveText('The new probe launches.');
  await expect(page.locator('#win .win-areas')).toContainText('Landfall');
  await expect(page.locator('#win .win-research')).toContainText('Probe core');
  await expect(page.locator('#win')).toContainText('Total play time');
  await expectControlsFit(page, '#win', 'win panel');
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
  await page.locator('#win button', { hasText: 'New system' }).click();
  await expect(page.locator('section.overlay:not([id]) .card')).toContainText('Start a new system? This erases your campaign');
  await page.locator('section.overlay:not([id]) .card button', { hasText: 'Keep playing' }).click();
  await expect(page.locator('#win')).toBeVisible();
  await page.locator('#win button', { hasText: 'New system' }).click();
  await page.locator('section.overlay:not([id]) .card button', { hasText: 'Yes, new system' }).click();
  await expect(page.locator('#win')).toBeHidden();
  await expect(page.locator('#reclaimed')).toHaveText(/^Reclaimed 0\/6$/);
  expect(errors).toEqual([]);
});

test('an H3 save (data v5) starts fresh with the toast', async ({ page }) => {
  // A save from the H3 build: data version 5. Planted before the page's scripts run (the page also saves on pagehide).
  const world = JSON.parse(serializeWorld(createWorld(1, defaultData))) as { dataVersion: number };
  world.dataVersion = 5;
  const save = JSON.stringify({ format: 2, seed: 1, dataVersion: 5, world: JSON.stringify(world), log: [], pending: [], history: [], flags: {} });
  await page.addInitScript((text) => window.localStorage.setItem('fvn.save', text), save);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  await expect(page.locator('#toast')).toContainText(/older game data \(v5; this build is v\d+\), so it was discarded and a new run started/);
  expect(await page.evaluate(() => window.__factory4x!.onOverworld())).toBe(true);
});

test('tapping an asteroid opens its sheet; queuing an extractor changes the queue', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await landByTaps(page, LANDFALL, 'Landfall');
  const a1 = await page.evaluate(() => window.__factory4x!.nodeIndex('a1'));
  await tapNode(page, a1);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.selected())).toBe(a1);
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

test('the asteroid sheet shows the Extraction-boosted rate (12.5/min each at level 1), even with a wide font', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await startCampaign(page, { research: { extract: 1, rigs: 1 }, land: 'landfall' });
  await page.addStyleTag({ content: '#sheet, #sheet * { font-family: "Courier New", monospace !important; font-size: 17px !important; letter-spacing: 1px !important; }' });
  const a1 = await page.evaluate(() => window.__factory4x!.nodeIndex('a1'));
  await tapNode(page, a1);
  await expect(page.locator('#sheet')).toBeVisible();
  // Seed rigs gives a1 one extractor: 10/min base, +25% from Extraction 1.
  await expect(page.locator('#sheet')).toContainText('12.5/min each');
  await expect(page.locator('#sheet')).toContainText('+12.5/min');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});

test('the Root sheet opens with the Feeds the Heart box; the heart sheet says fed; the probe names the layout', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await startCampaign(page, DEEP_START);
  const root = await page.evaluate(() => window.__factory4x!.rootNode());
  await tapNode(page, root);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.selected())).toBe(root);
  await expect(page.locator('#sheet h2')).toContainText('Root');
  await expect(page.locator('#sheet')).toContainText('Feeds the Heart');
  await expect(page.locator('#sheet')).toContainText(/Cut it: \d+ Thorns \d+ Spores, 1 \/ 10\.0 s and 1 \/ 3\.3 s, no repair/);
  await tapNode(page, HEART);
  await expect(page.locator('#sheet')).toContainText('Fed by the Root');
  await tapNode(page, 0);
  const name = await page.evaluate(() => window.__factory4x!.systemName());
  expect(name).toMatch(/^(Frost Gate|Glass Thicket|Twin Seams)$/);
  await expect(page.locator('#sheet')).toContainText(`System: ${name}`);
  await expect(page.locator('#sheet .shipments')).toContainText(/Shipments/);
  expect(errors).toEqual([]);
});

test('the probe sheet shows the Shipments line and the new yard states', async ({ page }) => {
  await ready(page);
  // Landing in a held area with no designs: the lancer and flak rows are hidden (nothing delivered, nothing researched).
  await startCampaign(page, { reclaimed: ['landfall'], land: 'shelf' });
  await tapNode(page, 0);
  await expect(page.locator('#sheet .shipments')).toContainText(/\+[\d.]+ ore\/min to the stockpile|none yet/);
  await expect(page.locator('#sheet [data-yard="drone"]')).toBeVisible();
  await expect(page.locator('#sheet [data-yard="lancer"]')).toBeHidden();
  await expect(page.locator('#sheet')).toContainText('Take a crystal pocket to unlock Lancers');
  // With the Lancer design researched the row shows at once; Frost Shelf has no crystal pocket.
  await startCampaign(page, { reclaimed: ['landfall'], research: { lancer: 1 }, land: 'shelf' });
  await tapNode(page, 0);
  const lancer = page.locator('#sheet [data-yard="lancer"]');
  await expect(lancer).toBeVisible();
  await expect(lancer).toContainText('No crystal here: no lens source in this area');
  await expect(lancer.locator('button.tog')).toHaveText('ON');
  // Without the design, a delivered-resource row would say "Design not researched"; here the Flak row stays hidden.
  await expect(page.locator('#sheet [data-yard="flak"]')).toBeHidden();
  await expectControlsFit(page, '#sheet', 'probe sheet');
});

test('the tuning panel shows layout names and tick values in seconds; New system moves to the next layout', async ({ page }) => {
  await ready(page);
  await page.locator('#b-tune').click();
  await expect(page.locator('#tuning')).toContainText('0 · by seed / 1 Frost / 2 Glass / 3 Twin');
  await expect(page.locator('#tuning')).toContainText('60 · 2.0 s');
  await expect(page.locator('#tuning')).toContainText('applies at the next landing');
  for (const key of ['research.opening.step', 'research.extract.stepPct', 'research.yards.stepPct', 'research.costPct', 'shipments.pct']) {
    await expect(page.getByLabel(key, { exact: true })).toBeVisible();
  }
  const before = await page.evaluate(() => window.__factory4x!.systemName());
  await page.locator('#tuning button', { hasText: 'New system' }).click();
  await expect(page.locator('section.overlay:not([id]) .card')).toContainText('Start a new system? This erases your campaign');
  await page.locator('section.overlay:not([id]) .card button', { hasText: 'Yes, new system' }).click();
  const order = ['Frost Gate', 'Glass Thicket', 'Twin Seams'];
  await expect.poll(() => page.evaluate(() => window.__factory4x!.systemName())).toBe(order[(order.indexOf(before) + 1) % 3]);
});

test('forcing system.variant 3 and starting a New system gives Twin Seams, and the replay still matches', async ({ page }) => {
  await ready(page);
  await page.locator('#b-tune').click();
  const field = page.getByLabel('system.variant', { exact: true });
  await field.fill('3');
  await field.dispatchEvent('change');
  await page.locator('#tuning button', { hasText: 'New system' }).click();
  await page.locator('section.overlay:not([id]) .card button', { hasText: 'Yes, new system' }).click();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.systemName())).toBe('Twin Seams');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
});

test('every control is at least 44 px', async ({ page }) => {
  await ready(page);
  const small = async (): Promise<string[]> =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('button, input'))
        .filter((b) => b.offsetParent !== null && !b.closest('[hidden]'))
        .map((b) => ({ t: b.id || b.textContent?.slice(0, 20) || b.tagName, r: b.getBoundingClientRect() }))
        .filter((b) => b.r.height < 43.5 || b.r.width < 43.5)
        .map((b) => b.t),
    );
  expect(await small(), 'overworld').toEqual([]);
  await tapArea(page, LANDFALL);
  await expect(page.locator('#sheet')).toBeVisible();
  expect(await small(), 'area sheet').toEqual([]);
  await page.locator('#sheet button.land').click();
  await tapNode(page, 0);
  await expect(page.locator('#sheet')).toBeVisible();
  expect(await small(), 'probe sheet').toEqual([]);
});

test('pause stops the tick counter and the time controls work', async ({ page }) => {
  await ready(page);
  await landByTaps(page, LANDFALL, 'Landfall');
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
  await landByTaps(page, LANDFALL, 'Landfall');
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
  await landByTaps(page, LANDFALL, 'Landfall');
  const a1 = await page.evaluate(() => window.__factory4x!.nodeIndex('a1'));
  await tapNode(page, a1);
  await page.locator('#sheet button', { hasText: /^Extractor/ }).click();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.tick())).toBeGreaterThan(60);
  expect(await page.evaluate(() => window.__factory4x!.saveNow())).toBe(true);
  const savedTick = await page.evaluate(() => window.__factory4x!.tick());
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  expect(await page.evaluate(() => window.__factory4x!.tick())).toBeGreaterThanOrEqual(savedTick);
  expect(await page.evaluate(() => window.__factory4x!.activeArea())).toBe(LANDFALL);
  expect(await page.evaluate(() => window.__factory4x!.inputCount())).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.tick())).toBeGreaterThan(savedTick + 30);
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
});

test('autosave of a constructed campaign resumes on the overworld and replays from its start', async ({ page }) => {
  await ready(page);
  await startCampaign(page, { reclaimed: ['landfall', 'shelf'], research: { opening: 1 }, stockpile: { ore: 90 } });
  expect(await page.evaluate(() => window.__factory4x!.saveNow())).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  await expect(page.locator('#reclaimed')).toHaveText(/^Reclaimed 2\/6$/);
  await expect(page.locator('#sp-ore b')).toHaveText('90');
  expect(await page.evaluate(() => window.__factory4x!.onOverworld())).toBe(true);
  await landByTaps(page, 3, 'Spore Veil');
  await page.waitForTimeout(300);
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

test('browser sim matches Node sim on a campaign log (landing, research, withdraw, a second landing)', async ({ page }) => {
  await ready(page);
  // A short campaign by taps in the page, then the page's own log replayed in Node and in the browser.
  await startCampaign(page, { reclaimed: ['landfall'], stockpile: { ore: 200, ice: 0, crystal: 0 } });
  await page.locator('#b-research').click();
  await page.locator('#research section[data-item="opening"] button.buy').click();
  await page.locator('#research button[aria-label="Close research"]').click();
  await landByTaps(page, SHELF, 'Frost Shelf');
  await page.waitForTimeout(500);
  await page.locator('#b-world').click();
  await page.locator('section.overlay:not([id]) .card button', { hasText: 'Withdraw' }).click();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.onOverworld())).toBe(true);
  await landByTaps(page, SHELF, 'Frost Shelf');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
});

/**
 * Wide, tall text in the notices, so the check doesn't depend on which monospace
 * the OS falls back to (CI's Linux font wrapped the toast into the heart while
 * Windows' Consolas didn't).
 */
const WIDE_NOTICE_FONT = '#banner, #toast, #toast::after, #hint { font-family: serif !important; font-size: 15px !important; letter-spacing: 0.25em !important; line-height: 1.6 !important; }';

async function noticesClearOfBloom(page: Page, stress = false): Promise<void> {
  await ready(page);
  await startCampaign(page, DEEP_START);
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

test('Reset all sends only changed tunables; New system keeps tuning and the start stock applies at the landing', async ({ page }) => {
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
  await page.locator('#tuning button', { hasText: 'New system' }).click();
  await expect(page.locator('section.overlay:not([id]) .card')).toContainText('tuning is kept');
  await page.locator('section.overlay:not([id]) .card button', { hasText: 'Yes, new system' }).click();
  await expect(page.getByLabel('economy.startStock', { exact: true })).toHaveValue('150');
  await landByTaps(page, LANDFALL, 'Landfall');
  await expect.poll(() => page.evaluate(() => window.__factory4x!.stock())).toBeGreaterThan(100);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
});

test('paused "Attack with all" from two sources is one press, one tick, one wave', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await startCampaign(page, DEEP_START);
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
    await startCampaign(page, DEEP_START);
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

  test('overworld HUD fits and does not wrap under a wide font, at the start and with a full stockpile', async ({ page }) => {
    await ready(page);
    await expect(page.locator('#reclaimed')).toBeVisible();
    await expectControlsFit(page, '#bars', 'overworld HUD at the start');
    await expectHudNoWrap(page, 'overworld HUD at the start');
    await startCampaign(page, { reclaimed: ['landfall', 'shelf', 'shoal', 'veil'], research: { lancer: 1 }, stockpile: { ore: 1234, ice: 456, crystal: 789 } });
    await expect(page.locator('#sp-crystal')).toBeVisible();
    await expect(page.locator('#sp-ice small')).toHaveText(/^\+[\d.]+\/min$/);
    await expectControlsFit(page, '#bars', 'overworld HUD with all three chips and rates');
    await expectHudNoWrap(page, 'overworld HUD with all three chips and rates');
  });

  test('pause and play icons swap on each tap of the pause button', async ({ page }) => {
    await ready(page);
    await landByTaps(page, LANDFALL, 'Landfall');
    const shown = (): Promise<string> =>
      page.evaluate(() => {
        const vis = (sel: string): boolean => {
          const e = document.querySelector<SVGElement>(sel)!;
          const r = e.getBoundingClientRect();
          return getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && r.width > 0 && r.height > 0;
        };
        return `${vis('#b-pause .i-pause') ? 'pause' : ''}${vis('#b-pause .i-play') ? 'play' : ''}`;
      });
    expect(await shown()).toBe('pause');
    for (let i = 0; i < 2; i++) {
      await page.locator('#b-pause').click();
      await expect.poll(shown).toBe('play');
      await page.locator('#b-pause').click();
      await expect.poll(shown).toBe('pause');
    }
  });

  test('area HUD fits and does not wrap under a wide font, with the Overworld button', async ({ page }) => {
    await ready(page);
    await startCampaign(page, DEEP_START);
    await expect(page.locator('#b-world')).toBeVisible();
    await expect(page.locator('#b-world')).toHaveAttribute('aria-label', 'Overworld');
    await expectControlsFit(page, '#bars', 'area HUD');
    await expectHudNoWrap(page, 'area HUD');
  });

  test('overworld: area nodes are 44 px targets, labels stay off the canvas edges, the selected area clears the sheet', async ({ page }) => {
    await ready(page);
    await startCampaign(page, { reclaimed: ['landfall'], stockpile: { ore: 300 } });
    // Dismiss the first-run hint's strip effects: take the map as it is, then measure.
    const view = (await page.locator('#view').boundingBox())!;
    for (let a = 0; a < 6; a++) {
      const p = await page.evaluate((i) => window.__factory4x!.areaScreenPos(i), a);
      expect(p.y - view.y, `area ${a} top gap`).toBeGreaterThanOrEqual(50);
      expect(view.y + view.height - p.y, `area ${a} bottom gap`).toBeGreaterThanOrEqual(50);
      expect(p.x - view.x, `area ${a} left gap`).toBeGreaterThanOrEqual(40);
      expect(view.x + view.width - p.x, `area ${a} right gap`).toBeGreaterThanOrEqual(40);
    }
    // Neighbouring area centres are at least 44 px apart, so a tap picks one.
    for (let a = 0; a < 6; a++) {
      for (let b = a + 1; b < 6; b++) {
        const p = await page.evaluate((i) => window.__factory4x!.areaScreenPos(i), a);
        const q = await page.evaluate((i) => window.__factory4x!.areaScreenPos(i), b);
        expect(Math.hypot(p.x - q.x, p.y - q.y), `areas ${a} and ${b}`).toBeGreaterThanOrEqual(44);
      }
    }
    // Landfall sits at the bottom, where the sheet lands. It pans clear of it.
    await tapArea(page, LANDFALL);
    await expect(page.locator('#sheet')).toBeVisible();
    await page.waitForTimeout(700);
    const sheet = (await page.locator('#sheet').boundingBox())!;
    const land = await page.evaluate((i) => window.__factory4x!.areaScreenPos(i), LANDFALL);
    expect(land.y + 36, 'Landfall and its label clear the sheet').toBeLessThanOrEqual(sheet.y + 1);
    expect(land.y, 'Landfall still on the map').toBeGreaterThan(view.y);
    // Every sheet control is reachable and at least 44 px, and the sheet doesn't cover the whole map.
    expect(sheet.height).toBeLessThan(view.height * 0.6);
    await expectControlsFit(page, '#sheet', 'area sheet');
    // An open area (Frost Shelf) shows its Land button on screen without scrolling (it is sticky), and clears the sheet too.
    await tapArea(page, SHELF);
    await expect(page.locator('#sheet h2')).toHaveText('Frost Shelf');
    await page.waitForTimeout(700);
    const shelf = await page.evaluate((i) => window.__factory4x!.areaScreenPos(i), SHELF);
    expect(shelf.y + 36, 'Frost Shelf and its label clear the sheet').toBeLessThanOrEqual((await page.locator('#sheet').boundingBox())!.y + 1);
    const landBtn = (await page.locator('#sheet button.land').boundingBox())!;
    expect(landBtn.y + landBtn.height).toBeLessThanOrEqual(667);
  });

  test('research sheet fits at 375 px with a wide font', async ({ page }) => {
    await ready(page);
    await startCampaign(page, { reclaimed: ['landfall', 'shelf', 'shoal'], research: { opening: 1, extract: 1, lancer: 1 }, stockpile: { ore: 300, ice: 50, crystal: 50 } });
    await page.locator('#b-research').click();
    await expect(page.locator('#research')).toBeVisible();
    await expectControlsFit(page, '#research', 'research sheet');
    const box = (await page.locator('#research').boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(667);
    expect(box.x).toBeGreaterThanOrEqual(0);
    // Scrolled to the end, the last row's button is reachable and still fits.
    await page.locator('#research').evaluate((e) => (e.scrollTop = e.scrollHeight));
    await expectControlsFit(page, '#research', 'research sheet, scrolled');
    for (const item of ['lancer', 'flak', 'opening', 'extract', 'rigs', 'yards', 'core']) {
      await expect(page.locator(`#research section[data-item="${item}"]`)).toHaveCount(1);
    }
  });

  test('overworld: the whole first slice by touch, then the result and notices fit', async ({ page }) => {
    test.setTimeout(90_000);
    await landfallRun(page);
  });
});

// ---------------------------------------------------------------------------
// H3: the counter web through the UI. One play-through. Unstressed text would hide layout bugs, so every
// H3 surface runs with a wide serif font and wide letter spacing, as the notices tests above do.

/** Sets sim tunables through the tuning panel, then lands in The Deep from a constructed campaign (the H3 game). Leaves the game at 4x. */
async function startTunedDeep(page: Page, values: Record<string, number>, start: CampaignStart): Promise<void> {
  await page.locator('#b-tune').click();
  for (const [key, value] of Object.entries(values)) {
    const field = page.getByLabel(key, { exact: true });
    await field.fill(String(value));
    await field.dispatchEvent('change');
  }
  await page.locator('#tuning button[aria-label="Close"]').click();
  await expect(page.locator('#tuning')).toBeHidden();
  await startCampaign(page, start);
  await page.locator('#b-s4').click();
}

async function h3PlayThrough(page: Page): Promise<void> {
  const errors = watchErrors(page);
  await ready(page);
  // Frost Gate, cheap and quick, soft guards, and a pocket that pays fast, so the whole chain fits in a few seconds at 4x.
  // The Lancer design is bought (its yard lands on) and the Flak design is not (its row stays hidden).
  await startTunedDeep(
    page,
    {
      'system.variant': 1,
      'economy.startStock': 200,
      'guard.capPct': 25,
      'ship.drone.cost': 5,
      'ship.drone.buildTicks': 15,
      'ship.lancer.cost': 5,
      'ship.lancer.buildTicks': 30,
      'component.buildTicks': 30,
      'pocket.resourcePerMin': 40,
      // H5: no fleet limit (H4's rules), so the first wave's drones don't keep the Lancer yard waiting for a slot.
      'fleet.cap': 0,
    },
    { ...DEEP_START, research: { lancer: 1 } },
  );
  await expect.poll(() => page.evaluate(() => window.__factory4x!.systemName())).toBe('Frost Gate');
  await expect(page.locator('#toast')).toContainText('Landed in The Deep');
  await expect(page.locator('#toast')).toContainText('Lancer yard on');

  // The HUD starts simple: ore and drone chips only.
  await expect(page.locator('#chip-ore')).toBeVisible();
  await expect(page.locator('#chip-drone')).toBeVisible();
  for (const hidden of ['ice', 'crystal', 'lens', 'plating', 'lancer', 'flak']) await expect(page.locator(`#chip-${hidden}`)).toBeHidden();
  await expectControlsFit(page, '#bars', 'HUD at the start');
  await expectHudNoWrap(page, 'HUD at the start');

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

  // The captured pocket is a producer: route its crystal to the probe, and the crystal chip appears.
  await expect(page.locator('#sheet h2')).toContainText('Crystal');
  await page.locator('#sheet button', { hasText: /^Route to probe/ }).click();
  await expect(page.locator('#chip-crystal')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#toast')).toContainText(/Crystal delivered: Lens and Lancers unlocked\. The Lancer yard is on/);
  await expect(page.locator('#chip-lens')).toBeVisible();

  // The probe sheet: one tap on the unlock notice opens it. Yards (Lancer row already on: the design is researched), Assembly (lens).
  await page.locator('#toast').click();
  await expect(page.locator('#sheet h2')).toHaveText('Probe');
  await expect(page.locator('#toast')).toBeHidden();
  const lancerRow = page.locator('#sheet [data-yard="lancer"]');
  await expect(lancerRow).toBeVisible();
  await expect(lancerRow.locator('button.tog')).toHaveText('ON');
  await expect(page.locator('#sheet [data-yard="flak"]')).toBeHidden();
  await expect(page.locator('#sheet')).toContainText('Take an ice pocket to unlock Flak');
  await expect(lancerRow).toContainText(/5 ore \+ 1 Lens/i);
  await expect(page.locator('#sheet [data-assembler="lens"]')).toBeVisible();
  await expect(page.locator('#sheet [data-assembler="lens"]')).toContainText(/5 ore \+ 4 crystal/);
  await expect(page.locator('#sheet [data-assembler="plating"]')).toBeHidden();
  await expect(page.locator('#sheet .shipments')).toContainText('Shipments');
  await expectControlsFit(page, '#sheet', 'probe sheet with yards and assembly');
  // The first wave took every drone, so start the drone yard again for the mixed fleet.
  await droneRow.locator('button.tog').click();
  await expect(droneRow.locator('button.tog')).toHaveText('ON');
  await expect(page.locator('#chip-lancer')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#chip-lancer b')).not.toHaveText('0', { timeout: 30_000 });
  await expectControlsFit(page, '#bars', 'HUD with chips');
  await expectHudNoWrap(page, 'HUD with chips');

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

  // The area result panel lists the capture order (the heart is not taken, so it ends with the pocket).
  await page.evaluate(() => window.__factory4x!.debugShowResult());
  await expect(page.locator('#result .capture-order').first()).toContainText(/Crystal \(P\d\) \d+:\d\d/);
  await expect(page.locator('#result')).toContainText('The Deep');
  await expect(page.locator('#result')).toContainText('Ships lost');
  await expect(page.locator('#result')).toContainText('Hauled to the stockpile');
  await expectControlsFit(page, '#result', 'area result panel');
  await page.locator('#result button', { hasText: 'Keep playing here' }).click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
  expect(errors).toEqual([]);
}

test('H3 in The Deep: capture a pocket, Lancer yard on from research, send a mixed fleet through the send panel', async ({ page }) => {
  test.setTimeout(90_000);
  await h3PlayThrough(page);
});

test.describe('H3 at 375x667 portrait', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('capture a pocket, Lancer yard on from research, send a mixed fleet through the send panel', async ({ page }) => {
    test.setTimeout(90_000);
    await h3PlayThrough(page);
  });
});

// ---------------------------------------------------------------------------
// H5: the fleet limit. Values that are data (the limit, the step) are read from the shipped data, never pinned; a small
// `fleet.cap` is set through the dev hook so the fleet fills in seconds. Every surface runs under WIDE_FONT.

const FLEET_CAP = defaultData.tunables['fleet.cap'].default;
const FLEET_STEP = defaultData.tunables['research.fleet.step'].default;
const PROBE = 0;
const SHOAL = 2;

/** Lands in Frost Shelf with `fleet.cap` set, at 4x, and waits until the yards have filled the fleet. */
async function fillFleet(page: Page, cap: number): Promise<void> {
  await startCampaign(page, { reclaimed: ['landfall'], land: 'shelf' }, { 'fleet.cap': cap });
  await page.locator('#b-s4').click();
  await expect(page.locator('#chip-fleet b')).toHaveText(`Fleet ${cap}/${cap}`, { timeout: 30_000 });
  // The count includes a ship in a yard: wait until every ship is built and parked (the yard row then reads "fleet full").
  await expect.poll(() => page.evaluate(() => window.__factory4x!.shipsAt(0)), { timeout: 30_000 }).toBe(cap);
}

/** Pauses, turns the drone yard off (so no ore is spent while the stock is read), and opens the Recycle panel at the probe. */
async function openRecycleAtProbe(page: Page): Promise<void> {
  await page.locator('#b-pause').click();
  await tapNode(page, PROBE);
  await expect(page.locator('#sheet h2')).toHaveText('Probe');
  const tog = page.locator('#sheet .yard-row[data-yard="drone"] button.tog');
  if ((await tog.textContent()) === 'ON') await tog.click();
  await expect(tog).toHaveText('OFF');
  await page.locator('#sheet button.recycle-btn').scrollIntoViewIfNeeded();
  await page.locator('#sheet button.recycle-btn').click();
  await expect(page.locator('#recyclepanel')).toBeVisible();
}

test('H5: the fleet fills, the chip turns amber and the yard row says why, with counts', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await fillFleet(page, 2);
  const chip = page.locator('#chip-fleet');
  await expect(chip).toHaveClass(/full/);
  // The full style: the chip's edge is the probe amber (palette.probe).
  expect(await chip.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe('rgb(255, 210, 122)');
  await expect(page.locator('#toast')).toContainText('Fleet full (2/2): yards paused. Recycle ships at a node to change your mix.');
  await tapNode(page, PROBE);
  await expect(page.locator('#sheet .fleet-line')).toHaveText('Fleet 2/2 · Command limit 0/3');
  await expect(page.locator('#sheet .yard-row[data-yard="drone"] .yr-status')).toHaveText('idle: fleet full (2/2)');
  expect(errors).toEqual([]);
});

test('H5: recycle frees a slot, the stock rises by the preview, and the yard resumes', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await fillFleet(page, 2);
  await openRecycleAtProbe(page);
  const panel = page.locator('#recyclepanel');
  // Every row defaults to 0, never to all.
  await expect(panel.locator('.sp-row[data-ship="drone"] .sp-count')).toHaveText('0/2');
  await expect(panel.locator('.recycle-preview')).toHaveText('+0 ore');
  await expect(panel.locator('button.primary')).toBeDisabled();
  await panel.locator('button[aria-label="More Drone"]').click();
  await panel.locator('button[aria-label="More Drone"]').click();
  await expect(panel.locator('.sp-row[data-ship="drone"] .sp-count')).toHaveText('2/2');
  const preview = Number(/^\+(\d+) ore$/.exec((await panel.locator('.recycle-preview').textContent())!)![1]);
  const before = await page.evaluate(() => window.__factory4x!.stock());
  await panel.locator('button.primary').click();
  await expect(panel).toBeHidden();
  const gained = (await page.evaluate(() => window.__factory4x!.stock())) - before;
  // One paused tick of probe mining may add an ore on top of the refund.
  expect(gained).toBeGreaterThanOrEqual(preview);
  expect(gained).toBeLessThanOrEqual(preview + 1);
  await expect(page.locator('#toast')).toContainText(`Recycled 2 drones: +${preview} ore.`);
  await expect(page.locator('#chip-fleet b')).toHaveText('Fleet 0/2');
  await expect(page.locator('#chip-fleet')).not.toHaveClass(/full/);
  // The yard resumes: switch it back on and play on.
  await page.locator('#sheet .yard-row[data-yard="drone"] button.tog').click();
  await page.locator('#b-pause').click();
  await expect(page.locator('#chip-fleet b')).toHaveText('Fleet 2/2', { timeout: 30_000 });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__factory4x!.replayMatchesLive())).toBe(true);
  expect(errors).toEqual([]);
});

test('H5: Command limit is bought on the overworld and the next landing shows the new limit', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await startCampaign(page, { reclaimed: ['landfall', 'shelf'], stockpile: { ore: 500, ice: 100, crystal: 100 } });
  await tapArea(page, SHOAL);
  await expect(page.locator('#sheet .fleet-limit')).toHaveText(`Your fleet limit: ${FLEET_CAP}`);
  await page.locator('#b-research').click();
  const card = page.locator('#research section[data-item="fleet"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Command limit');
  await expect(card).toContainText('0/3');
  await expect(card).toContainText(`Fleet limit ${FLEET_CAP} → ${FLEET_CAP + FLEET_STEP}`);
  // It sits in the meaty-step group after the designs, never above the probe core.
  const order = await page.locator('#research section.rcard').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.item));
  expect(order.indexOf('core')).toBe(0);
  expect(order.indexOf('fleet')).toBeGreaterThan(order.indexOf('flak'));
  await card.locator('button.buy').click();
  await expect(card).toContainText('1/3');
  await expect(page.locator('#toast')).toContainText(`Command limit 1: fleet limit now ${FLEET_CAP + FLEET_STEP}.`);
  await page.locator('#research button[aria-label="Close research"]').click();
  await landByTaps(page, SHOAL, 'Glass Shoal');
  await expect(page.locator('#toast')).toContainText(`fleet limit ${FLEET_CAP + FLEET_STEP}`);
  await expect(page.locator('#chip-fleet b')).toHaveText(new RegExp(`^Fleet \\d+/${FLEET_CAP + FLEET_STEP}$`));
  expect(errors).toEqual([]);
});

test('H5: a disabled Command limit says why: the area tier it needs', async ({ page }) => {
  await ready(page);
  await startCampaign(page, { reclaimed: ['landfall'], stockpile: { ore: 500, ice: 100, crystal: 100 } });
  await page.locator('#b-research').click();
  const buy = page.locator('#research section[data-item="fleet"] button.buy');
  await expect(buy).toBeDisabled();
  await expect(buy).toHaveText(/^Needs an? \w+ area reclaimed$/);
  await expect(page.locator('#research section[data-item="fleet"] .req')).toContainText(/Needs: an? \w+ area reclaimed/);
});

test('H5: fleet.cap 0 hides the limit UI everywhere and says so on Command limit', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await startCampaign(page, { reclaimed: ['landfall', 'shelf'], stockpile: { ore: 500, ice: 100, crystal: 100 } }, { 'fleet.cap': 0 });
  await tapArea(page, SHOAL);
  await expect(page.locator('#sheet h2')).toHaveText('Glass Shoal');
  await expect(page.locator('#sheet .fleet-limit')).toBeHidden();
  await page.locator('#b-research').click();
  const buy = page.locator('#research section[data-item="fleet"] button.buy');
  await expect(buy).toBeDisabled();
  await expect(buy).toHaveText('Fleet limit is off (tuning)');
  await page.locator('#research button[aria-label="Close research"]').click();
  await landByTaps(page, SHOAL, 'Glass Shoal');
  await expect(page.locator('#toast')).not.toContainText('fleet limit');
  await expect(page.locator('#chip-fleet')).toBeHidden();
  await tapNode(page, PROBE);
  await expect(page.locator('#sheet .fleet-line')).toBeHidden();
  await expect(page.locator('#sheet .yard-row[data-yard="drone"] .yr-status')).not.toContainText('fleet full');
  expect(errors).toEqual([]);
});

test('H5: the tuning panel labels the fleet limit as the A/B switch', async ({ page }) => {
  await ready(page);
  await page.locator('#b-tune').click();
  await expect(page.locator('#tuning')).toContainText('Fleet limit (0 = none)');
  await expect(page.getByLabel('fleet.cap', { exact: true })).toHaveValue(String(FLEET_CAP));
  await expect(page.getByLabel('fleet.recycleRefundPct', { exact: true })).toBeVisible();
  await expect(page.getByLabel('research.fleet.step', { exact: true })).toBeVisible();
});

test('H5: a v7 save (before the fleet limit) starts fresh with the toast', async ({ page }) => {
  const world = JSON.parse(serializeWorld(createWorld(1, defaultData))) as { dataVersion: number };
  world.dataVersion = 7;
  const save = JSON.stringify({ format: 2, seed: 1, dataVersion: 7, world: JSON.stringify(world), log: [], pending: [], history: [], flags: {} });
  await page.addInitScript((text) => window.localStorage.setItem('fvn.save', text), save);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  await expect(page.locator('#toast')).toContainText(/older game data \(v7; this build is v\d+\), so it was discarded and a new run started/);
  expect(await page.evaluate(() => window.__factory4x!.onOverworld())).toBe(true);
});

// The chips a mid-visit HUD shows. Unlocks come from deliveries, so the states are set in one synchronous evaluate
// (the next refresh puts the real state back) and measured at once, with values longer than the game produces.
const HUD_STATES = [
  { name: 'Frost Shelf mid-visit', show: ['ore', 'ice', 'plating', 'drone', 'flak'], fleet: 'Fleet 12/12', full: false },
  { name: 'Frost Shelf mid-visit, full', show: ['ore', 'ice', 'plating', 'drone', 'flak'], fleet: 'Fleet 12/12', full: true },
  { name: 'The Deep, everything unlocked', show: ['ore', 'ice', 'crystal', 'lens', 'plating', 'drone', 'lancer', 'flak'], fleet: 'Fleet 30/30', full: false },
  { name: 'The Deep, everything unlocked, full', show: ['ore', 'ice', 'crystal', 'lens', 'plating', 'drone', 'lancer', 'flak'], fleet: 'Fleet 30/30', full: true },
];
type HudState = (typeof HUD_STATES)[number];

/** Lands in The Deep (wide or normal font), shows exactly the state's chips with long values, and measures them against #bars. */
async function hudInState(page: Page, state: HudState, wide: boolean) {
  if (wide) await ready(page);
  else {
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  }
  await startCampaign(page, DEEP_START);
  await expect(page.locator('#chip-fleet')).toBeVisible();
  return page.evaluate((s) => {
    for (const e of Array.from(document.querySelectorAll<HTMLElement>('#chips .chip'))) {
      const id = e.id.replace('chip-', '');
      e.hidden = id !== 'fleet' && !s.show.includes(id);
      if (id === 'ice' || id === 'crystal') (e.querySelector('small') as HTMLElement).textContent = '+12.5';
      if (/^(ore|ice|crystal|lens|plating)$/.test(id)) (e.querySelector('b') as HTMLElement).textContent = '999';
      if (/^(drone|lancer|flak)$/.test(id)) (e.querySelector('b') as HTMLElement).textContent = '30';
    }
    const fleet = document.getElementById('chip-fleet')!;
    // The numbers have their own span (the column layout drops the word); before that, the whole label was the b.
    const numbers = fleet.querySelector<HTMLElement>('.fl-n');
    if (numbers) numbers.textContent = s.fleet.replace(/^Fleet /, '');
    else (fleet.querySelector('b') as HTMLElement).textContent = s.fleet;
    fleet.classList.toggle('full', s.full);
    const centre = (e: Element): number => {
      const r = e.getBoundingClientRect();
      return r.top + r.height / 2;
    };
    const chips = Array.from(document.querySelectorAll<HTMLElement>('#chips .chip')).filter((e) => !e.hidden);
    const ships = chips.filter((e) => /^chip-(drone|lancer|flak)$/.test(e.id));
    const rows = new Set(chips.map((e) => Math.round(centre(e) / 12)));
    const bars = document.getElementById('bars')!.getBoundingClientRect();
    const inked = chips.flatMap((e) => [e, ...Array.from(e.querySelectorAll('*'))]).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
    return {
      fleetY: centre(fleet),
      boxes: chips.map((e) => {
        const r = e.getBoundingClientRect();
        return `${e.id}:${Math.round(r.left)}..${Math.round(r.right)},${Math.round(r.top)}`;
      }),
      shipYs: ships.map(centre),
      rows: rows.size,
      // The chips and everything drawn inside them (a label can overflow a chip that fits).
      right: Math.max(...inked.map((r) => r.right)),
      left: Math.min(...inked.map((r) => r.left)),
      barsLeft: bars.left,
      barsRight: bars.right,
      visible: chips.length,
      statsBottom: document.getElementById('stats')!.getBoundingClientRect().bottom,
      ctlTop: document.getElementById('controls')!.getBoundingClientRect().top,
    };
  }, state);
}

// The landscape and desktop layout (min-aspect-ratio 1/1): #bars is a 132-156 px column on the left. Every visible chip,
// the ship group and the fleet chip included, must lie inside it horizontally (h5-client round 2 drew them at negative x).
for (const vp of [
  { name: 'desktop 1280x720', width: 1280, height: 720 },
  { name: 'phone landscape 667x375', width: 667, height: 375 },
]) {
  test.describe(`H5 HUD chips in the column layout, ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const wide of [true, false]) {
      for (const state of HUD_STATES) {
        test(`${state.name}, ${wide ? 'wide font' : 'normal font'}: every chip lies inside #bars`, async ({ page }) => {
          const m = await hudInState(page, state, wide);
          expect(m.visible).toBe(state.show.length + 1);
          expect(m.left, `chips vs #bars ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(m.barsLeft - 0.5);
          expect(m.right, `chips vs #bars ${JSON.stringify(m)}`).toBeLessThanOrEqual(m.barsRight + 0.5);
        });
      }
    }
  });
}

test.describe('H5 at 375x667 portrait', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the fleet chip and the ship chips fit the HUD under a wide font, normal and full', async ({ page }) => {
    await ready(page);
    await startCampaign(page, DEEP_START);
    await expect(page.locator('#chip-fleet')).toBeVisible();
    await expectControlsFit(page, '#bars', 'area HUD with the fleet chip');
    await expectHudNoWrap(page, 'area HUD with the fleet chip');
    await page.addStyleTag({ content: '#chip-fleet, #chip-fleet * { font-size: 16px !important; }' });
    await expectHudNoWrap(page, 'area HUD with a 16 px fleet chip');
  });

  for (const wide of [true, false]) {
    for (const state of HUD_STATES) {
      test(`HUD chips: ${state.name}, ${wide ? 'wide font' : 'normal font'}: the fleet chip shares the ships' row, two rows at most`, async ({ page }) => {
        const m = await hudInState(page, state, wide);
        expect(m.shipYs.length).toBeGreaterThanOrEqual(2);
        for (const y of m.shipYs) expect(Math.abs(y - m.fleetY), `fleet chip row vs ship chip row ${JSON.stringify(m)}`).toBeLessThanOrEqual(6);
        // Two rows: resources, then ships and the fleet. The one extreme (all five resources with rates at the wide stress: about
        // 330 px of resource chips in 263 px) puts the resources on two rows; the fleet chip still shares the ships' row.
        expect(m.rows, `chip rows ${JSON.stringify(m)}`).toBeLessThanOrEqual(2);
        expect(m.right).toBeLessThanOrEqual(375);
        expect(m.left).toBeGreaterThanOrEqual(0);
        expect(m.statsBottom).toBeLessThanOrEqual(m.ctlTop + 1);
      });
    }
  }

  test('the full fleet chip, the yard reason and the Recycle panel fit by touch', async ({ page }) => {
    test.setTimeout(90_000);
    await ready(page);
    await fillFleet(page, 3);
    await expectHudNoWrap(page, 'full fleet HUD');
    await expectControlsFit(page, '#bars', 'full fleet HUD');
    await page.screenshot({ path: 'test-results/h5-full-hud.png' });
    await openRecycleAtProbe(page);
    await expectControlsFit(page, '#recyclepanel', 'recycle panel');
    const card = (await page.locator('#recyclepanel .card').boundingBox())!;
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.y + card.height).toBeLessThanOrEqual(667);
    await page.locator('#recyclepanel button[aria-label="All Drone"]').click();
    await expectControlsFit(page, '#recyclepanel', 'recycle panel with a count');
    await page.screenshot({ path: 'test-results/h5-recycle.png' });
    await page.locator('#recyclepanel button', { hasText: 'Cancel' }).click();
    await expect(page.locator('#recyclepanel')).toBeHidden();
  });

  test('the research sheet with the Command limit card fits, with a wide font', async ({ page }) => {
    await ready(page);
    await startCampaign(page, { reclaimed: ['landfall', 'shelf', 'shoal'], research: { fleet: 1 }, stockpile: { ore: 300, ice: 50, crystal: 50 } });
    await page.locator('#b-research').click();
    await expect(page.locator('#research section[data-item="fleet"]')).toHaveCount(1);
    await page.locator('#research section[data-item="fleet"]').scrollIntoViewIfNeeded();
    await expectControlsFit(page, '#research', 'research sheet with the Command limit card');
    await page.screenshot({ path: 'test-results/h5-research.png' });
    // A disabled reason fits in its button too.
    await startCampaign(page, { reclaimed: ['landfall'] }, { 'fleet.cap': 0 });
    await page.locator('#b-research').click();
    await page.locator('#research section[data-item="fleet"]').scrollIntoViewIfNeeded();
    await expect(page.locator('#research section[data-item="fleet"] button.buy')).toHaveText('Fleet limit is off (tuning)');
    await expectControlsFit(page, '#research', 'disabled Command limit button');
  });
});
