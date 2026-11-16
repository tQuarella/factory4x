import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectControlsFit, settled, stepSimUntil } from './helpers.ts';

/**
 * H9 client: the extractor dial on the rock sheet, the haulers line (and H8's stepper behind `client.haulerStepper`), the raid banner's
 * fixed room, the chip, the tuning keys. The sim is stepped with `advanceTicks`, never waited for. Taps are real (touch on the phone
 * project). Every layout assertion forces a wide font on the elements under test, so a layout that only fits this machine's fonts fails here.
 */

const WIDE_FONT =
  '#sheet *, #sendpanel *, #recyclepanel *, #fleetpanel *, #result *, #chips *, #controls *, #tuning *, .card *, #banner, #movebar, #toast, #hint { font-family: serif !important; font-size: 15px !important; letter-spacing: 0.15em !important; line-height: 1.5 !important; }';
const PHONE = { width: 375, height: 667 };

async function ready(page: Page, size: { width: number; height: number } | null = PHONE, wide = true): Promise<void> {
  if (size) await page.setViewportSize(size);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  if (wide) await page.addStyleTag({ content: WIDE_FONT });
  await settled(page);
}

async function tapAt(page: Page, x: number, y: number): Promise<void> {
  if (test.info().project.name === 'phone') await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function tap(page: Page, loc: Locator): Promise<void> {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  expect(b, 'the element to tap is on screen').not.toBeNull();
  await tapAt(page, b!.x + b!.width / 2, b!.y + b!.height / 2);
}

async function pause(page: Page): Promise<void> {
  if (!(await page.evaluate(() => window.__factory4x!.paused()))) await page.locator('#b-pause').click();
  expect(await page.evaluate(() => window.__factory4x!.paused())).toBe(true);
}

async function tune(page: Page, key: string, value: number): Promise<void> {
  await page.locator('#b-tune').click();
  const input = page.locator(`#tuning input[aria-label="${key}"]`);
  await input.scrollIntoViewIfNeeded();
  await input.evaluate((el, v) => {
    (el as HTMLInputElement).value = String(v);
    el.dispatchEvent(new Event('change'));
  }, value);
  await page.locator('#tuning .close').click();
  await expect(page.locator('#tuning')).toBeHidden();
}

/** Opens a node's sheet by tapping it on the map (once). */
async function openRock(page: Page, id: string): Promise<number> {
  const node = await page.evaluate((i) => window.__factory4x!.nodeIndex(i), id);
  await settled(page);
  const p = await page.evaluate((i) => window.__factory4x!.nodeScreenPos(i), node);
  await tapAt(page, p.x, p.y);
  expect(await page.evaluate(() => window.__factory4x!.selected()), `the tap on ${id} opened its sheet`).toBe(node);
  return node;
}

interface Rock {
  mine: boolean;
  docked: number;
  bound: number;
  inFlight: number;
  slots: number;
  haulers: number;
  haulerTarget: number;
  haulerSet: number | null;
  extractorSet: number | null;
  extCap: number;
  raidTarget: boolean;
  raidMix: { thorn: number; spore: number } | null;
  raidNext: boolean;
  raidRank: number;
}
const rock = async (page: Page, node: number): Promise<Rock> => JSON.parse(await page.evaluate((n) => window.__factory4x!.rockStatus(n), node)) as Rock;
const inputs = async (page: Page): Promise<Array<Record<string, unknown>>> => JSON.parse(await page.evaluate(() => window.__factory4x!.log())) as Array<Record<string, unknown>>;
const econ = async (page: Page): Promise<Array<{ type: string; at: number | null; target: number | null; moving: boolean }>> => JSON.parse(await page.evaluate(() => window.__factory4x!.econShips())) as Array<{ type: string; at: number | null; target: number | null; moving: boolean }>;
const extractorShips = async (page: Page): Promise<number> => (await econ(page)).filter((e) => e.type === 'extractor').length;

/** The boxes that make up the HUD: nothing may move or resize when a raid line, a chip suffix or a badge appears. */
const hudBoxes = (page: Page): Promise<string> =>
  page.evaluate(() =>
    ['bars', 'stats', 'chips', 'chip-ore', 'chip-fleet', 'chip-raid', 'controls', 'b-mine']
      .map((id) => {
        const b = document.getElementById(id)!.getBoundingClientRect();
        return `${id}:${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)},${Math.round(b.height)}`;
      })
      .join('|'),
  );

interface Raid {
  phase: string;
  target: number | null;
  prongs: Array<{ target: number; phase: string; planned: { thorn: number; spore: number } }>;
  nextProngs: number;
  last: unknown;
}
const raid = async (page: Page): Promise<Raid> => JSON.parse(await page.evaluate(() => window.__factory4x!.raidStatus())) as Raid;

test.describe('375x667 portrait, the extractor dial', () => {
  test.use({ viewport: PHONE });

  test('the row reads "Extractors d / cap" with −, + and All; each sends setExtractors, stops at 1 and at the slots, and All is pressed while the count is null', async ({ page }) => {
    await ready(page);
    await pause(page);
    const a1 = await page.evaluate(() => window.__factory4x!.nodeIndex('a1'));
    await stepSimUntil(page, async () => (await rock(page, a1)).docked >= 1, 9000, 'an extractor docked at a1', false);
    await openRock(page, 'a1');
    const sheet = page.locator('#sheet');
    const st = await rock(page, a1);
    expect(st.extractorSet, 'the dial starts at All').toBeNull();
    expect(st.slots).toBeGreaterThanOrEqual(2);
    const label = sheet.locator('.ext-lbl');
    await expect(label).toHaveText(`Extractors ${st.docked} / ${st.slots}`);
    const less = sheet.locator('.e-step', { hasText: '−' });
    const more = sheet.locator('.e-step', { hasText: '+' });
    const all = sheet.locator('.e-all');
    // All is pressed while null; + stops at the slots.
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    await expect(more).toBeDisabled();
    await expect(less).toBeEnabled();
    await expectControlsFit(page, '#sheet', 'the extractor row fits');
    // − sends slots − 1; All is no longer pressed.
    await tap(page, less);
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setExtractors', node: a1, count: st.slots - 1 });
    await expect(label).toHaveText(new RegExp(`/ ${st.slots - 1}$`));
    await expect(all).toHaveAttribute('aria-pressed', 'false');
    await expect(more).toBeEnabled();
    // − again and again stops at 1 (an asteroid's minCount).
    for (let i = 0; i < st.slots; i++) if (await less.isEnabled()) await tap(page, less);
    await expect(less).toBeDisabled();
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setExtractors', node: a1, count: 1 });
    await expect(label).toHaveText(/ \/ 1$/);
    // + back up to the slots, then it stops.
    for (let i = 0; i < st.slots; i++) if (await more.isEnabled()) await tap(page, more);
    await expect(more).toBeDisabled();
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setExtractors', node: a1, count: st.slots });
    // All sends null and is pressed again.
    await tap(page, all);
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setExtractors', node: a1, count: null });
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    // All pressed while already null changes nothing but is accepted.
    await tap(page, all);
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setExtractors', node: a1, count: null });
    expect((await rock(page, a1)).extractorSet).toBeNull();
  });

  test('lowering a rock: an extractor leaves, the rock\'s haulers drop after their next trip home, and no extractor is built for it', async ({ page }) => {
    test.setTimeout(120_000);
    await ready(page);
    await pause(page);
    // Raids off, so no raid kills a ship in the window and the ship count is the dial's alone.
    await tune(page, 'raid.enabled', 0);
    const ids = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    // The premise: every marked rock is at its cap with nothing in flight, so H4b holds the extractor share and the surplus has nowhere to go.
    const everyRockFull = async (): Promise<boolean> => {
      for (const x of [...ids, 'p1', 'p2', 'heart']) {
        const r = await rock(page, await page.evaluate((y) => window.__factory4x!.nodeIndex(y), x)).catch(() => null);
        if (r !== null && r.mine && (r.bound !== r.extCap || r.inFlight > 0)) return false;
      }
      return true;
    };
    // The rock under test is one that needs two haulers (a far, rich one), so lowering it makes a real drop.
    const busy = async (): Promise<string | null> => {
      for (const x of ids) {
        const r = await rock(page, await page.evaluate((y) => window.__factory4x!.nodeIndex(y), x));
        if (r.mine && r.docked >= 2 && r.haulers >= 2) return x;
      }
      return null;
    };
    await stepSimUntil(page, async () => (await busy()) !== null && (await everyRockFull()), 30_000, 'every marked rock full, and a rock with two extractors and two haulers', false);
    const id = (await busy())!;
    const a1 = await page.evaluate((y) => window.__factory4x!.nodeIndex(y), id);
    const before = await rock(page, a1);
    expect(before.docked).toBeGreaterThanOrEqual(2);
    await openRock(page, id);
    const sheet = page.locator('#sheet');
    // Lower the dial to 1 with the − button.
    const less = sheet.locator('.e-step', { hasText: '−' });
    for (let i = 0; i < before.slots; i++) if (await less.isEnabled()) await tap(page, less);
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setExtractors', node: a1, count: 1 });
    await page.locator('#sheet .close').click();
    const ships0 = await extractorShips(page);
    const haulersAtLowering = (await rock(page, a1)).haulers;
    // An extractor leaves: a1 keeps one, whatever the probe builds meanwhile.
    await stepSimUntil(page, async () => (await rock(page, a1)).docked === 1, 3000, 'the surplus extractors leaving a1', false);
    expect((await rock(page, a1)).docked).toBe(1);
    // No extractor is built for a1, and none comes back: a1's bound count never exceeds the dial, sampled over the next minute of play.
    for (let t = 0; t < 1800; t += 30) {
      await page.evaluate(() => window.__factory4x!.advanceTicks(30));
      const r = await rock(page, a1);
      expect(r.bound, `bound at a1 at +${t} ticks`).toBeLessThanOrEqual(1);
      expect(r.docked).toBeLessThanOrEqual(1);
    }
    expect(await extractorShips(page), 'exactly the same extractor ships: the surplus went home, and none was built').toBe(ships0);
    // The haulers follow the need of what is mined: after their next trip home a1 has no more than its target.
    const target = (await rock(page, a1)).haulerTarget;
    await stepSimUntil(page, async () => (await rock(page, a1)).haulers <= target, 3000, 'a1\'s haulers falling to the target', false);
    expect((await rock(page, a1)).haulers).toBeLessThanOrEqual(target);
    expect(target, 'the target fell with the extractors').toBeLessThanOrEqual(before.haulerTarget);
    expect(haulersAtLowering, 'a1 had more haulers than the new target when it was lowered, so the drop is real').toBeGreaterThan(target);
    // The sheet says so: the haulers line is the read-only target.
    await openRock(page, id);
    await expect(sheet.locator('.haulers-line')).toHaveText(`Haulers ${target} (auto)`);
    await expect(sheet.locator('.ext-lbl')).toHaveText(/^Extractors 1 \/ 1$/);
  });

  test('an unmarked rock shows the kept setting greyed, with the buttons enabled; the setting is kept for when it is marked again', async ({ page }) => {
    await ready(page);
    await pause(page);
    const a1 = await openRock(page, 'a1');
    const sheet = page.locator('#sheet');
    await tap(page, sheet.locator('.mine-btn'));
    expect((await rock(page, a1)).mine).toBe(false);
    await expect(sheet.locator('.ext-row')).toHaveClass(/\bdim\b/);
    const less = sheet.locator('.e-step', { hasText: '−' });
    const more = sheet.locator('.e-step', { hasText: '+' });
    await expect(less).toBeEnabled();
    await tap(page, less);
    const last = (await inputs(page)).slice(-1)[0] as { type: string; count: number };
    expect(last.type).toBe('setExtractors');
    const slots = (await rock(page, a1)).slots;
    expect(last.count).toBe(slots - 1);
    await expect(sheet.locator('.ext-lbl')).toHaveText(`Extractors 0 / ${slots - 1}`);
    await expect(sheet.locator('.ext-row')).toHaveClass(/\bdim\b/);
    await expect(more).toBeEnabled();
    // The greyed row is still a 44 px row.
    await expectControlsFit(page, '#sheet', 'the greyed extractor row');
    // Marked again: the row is lit and keeps the setting.
    await tap(page, sheet.locator('.mine-btn'));
    expect((await rock(page, a1)).mine).toBe(true);
    await expect(sheet.locator('.ext-row')).not.toHaveClass(/\bdim\b/);
    expect((await rock(page, a1)).extractorSet).toBe(slots - 1);
  });

  test('"+1 on the way" shows while an extractor is in flight to the rock', async ({ page }) => {
    await ready(page);
    await pause(page);
    const a1 = await page.evaluate(() => window.__factory4x!.nodeIndex('a1'));
    await stepSimUntil(page, async () => (await rock(page, a1)).inFlight >= 1, 12_000, 'an extractor on its way to a1', false);
    await openRock(page, 'a1');
    const st = await rock(page, a1);
    await expect(page.locator('#sheet .pip-text')).toHaveText(`+${st.inFlight} on the way`);
    await expect(page.locator('#sheet .ext-lbl')).toHaveText(`Extractors ${st.docked} / ${st.slots}`);
  });

  test('the haulers line is read-only; with client.haulerStepper 1 H8\'s hauler row comes back under the extractor row, and both fit', async ({ page }) => {
    await ready(page);
    await pause(page);
    const a1 = await page.evaluate(() => window.__factory4x!.nodeIndex('a1'));
    await stepSimUntil(page, async () => (await rock(page, a1)).haulers >= 1, 9000, 'a hauler at a1', false);
    await openRock(page, 'a1');
    const sheet = page.locator('#sheet');
    const need = (await rock(page, a1)).haulerTarget;
    await expect(sheet.locator('.haulers-line')).toHaveText(`Haulers ${need} (auto)`);
    await expect(sheet.locator('.haulers-line button')).toHaveCount(0);
    await expect(sheet.locator('.hstep')).toBeHidden();
    await expect(sheet.locator('.haulers-row')).toBeHidden();
    await page.locator('#sheet .close').click();
    // The stepper is a setting of this device.
    await tune(page, 'client.haulerStepper', 1);
    await openRock(page, 'a1');
    await expect(sheet.locator('.hstep')).toBeVisible();
    await expect(sheet.locator('.haulers-row .val')).toHaveText(`${need} · Auto`);
    await expect(sheet.locator('.haulers-line')).toBeHidden();
    await expect(sheet.locator('.ext-row')).toBeVisible();
    await tap(page, sheet.locator('.h-step', { hasText: '+' }));
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setHaulers', node: a1, count: need + 1 });
    await expect(sheet.locator('.haulers-row .val')).toHaveText(`${need + 1} · set (Auto ${need})`);
    await settled(page);
    const fit = await page.evaluate(() => {
      const e = document.getElementById('sheet')!;
      return { scroll: e.scrollHeight, client: e.clientHeight, stage: document.getElementById('stage')!.clientHeight };
    });
    console.log(`rock sheet open with the hauler stepper, wide font: map (stage) ${fit.stage} px, sheet ${fit.client} px`);
    await page.screenshot({ path: 'test-results/h9-rock-sheet-stepper.png' });
    expect(fit.scroll, 'no scrolling with both rows').toBeLessThanOrEqual(fit.client + 1);
    expect(fit.stage, 'the map keeps at least 140 px with both rows (measured 141)').toBeGreaterThanOrEqual(140);
    await expectControlsFit(page, '#sheet', 'the extractor and hauler rows');
    // Back off: with the stepper off again the read-only line shows the kept count: "Haulers 2 (set 2)".
    await page.locator('#sheet .close').click();
    await tune(page, 'client.haulerStepper', 0);
    await openRock(page, 'a1');
    await expect(sheet.locator('.haulers-line')).toHaveText(`Haulers ${need + 1} (set ${need + 1})`);
  });

  for (const wide of [true, false]) {
    test(`the rock sheet with the extractor row, the haulers line, and the raid and rank lines fits 375x667 without scrolling, and the map keeps the room H8 left it (${wide ? 'wide font' : 'normal font'})`, async ({ page }) => {
      await ready(page, PHONE, wide);
      await pause(page);
      await tune(page, 'raid.firstAtEcon', 2);
      await tune(page, 'raid.musterTicks', 0);
      await settled(page);
      const measure = async (what: string): Promise<{ scroll: number; client: number; stage: number }> => {
        await settled(page);
        const fit = await page.evaluate(() => {
          const e = document.getElementById('sheet')!;
          return { scroll: e.scrollHeight, client: e.clientHeight, stage: document.getElementById('stage')!.clientHeight };
        });
        console.log(`rock sheet open, ${what}, ${wide ? 'wide' : 'normal'} font: map (stage) ${fit.stage} px, sheet ${fit.client} px`);
        expect(fit.scroll, `no scrolling in the rock sheet (${what})`).toBeLessThanOrEqual(fit.client + 1);
        await expectControlsFit(page, '#sheet', `the rock sheet controls (${what})`);
        return fit;
      };
      // The rank line first (two rocks are raidable, the raid not yet mustered), then the tallest state: the raid out, held haulers.
      const ids = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
      const nodes = await page.evaluate((l) => l.map((i) => window.__factory4x!.nodeIndex(i)), ids);
      await stepSimUntil(page, async () => (await raid(page)).phase !== 'none' || (await Promise.all(nodes.map((n) => rock(page, n)))).some((r) => r.raidNext), 12_000, 'a rock a raid would hit next', false);
      const first = await raid(page);
      await stepSimUntil(page, async () => (await raid(page)).phase === 'out', 12_000, 'the raid flying out', false);
      const target = (await raid(page)).target!;
      expect((await rock(page, target)).raidMix, 'the prong aimed here has a mix').not.toBeNull();
      const p = await page.evaluate((n) => window.__factory4x!.nodeScreenPos(n), target);
      await settled(page);
      await tapAt(page, (await page.evaluate((n) => window.__factory4x!.nodeScreenPos(n), target)).x, p.y);
      const sheet = page.locator('#sheet');
      await expect(sheet.locator('.rock-note .raid')).toHaveText(/^Raid coming: (\d+ (Spores?|Thorns?)(, )?)+$/);
      const fit = await measure('raid out');
      await page.screenshot({ path: wide ? 'test-results/h9-rock-sheet-raid.png' : 'test-results/h9-rock-sheet-raid-normal.png' });
      // The map keeps at least H8's room behind the rock sheet (H8 measured 185 px under the wide font and 210 px under the normal one).
      expect(fit.stage, 'the map keeps its room behind the rock sheet').toBeGreaterThanOrEqual(wide ? 185 : 210);
      void first;
    });
  }

  test('the tuning panel lists raid.prongsMax and raid.prongMinSize, and client.haulerStepper is tagged "this device"', async ({ page }) => {
    await ready(page, PHONE, false);
    await page.locator('#b-tune').click();
    const keys = await page.locator('#tuning input').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    for (const k of ['raid.prongsMax', 'raid.prongMinSize', 'client.haulerStepper']) expect(keys, k).toContain(k);
    const device = page.locator('#tuning .t-row', { has: page.locator('input[aria-label="client.haulerStepper"]') });
    await expect(device.locator('.tag')).toHaveText(/this device/);
    for (const k of ['raid.prongsMax', 'raid.prongMinSize']) {
      await expect(page.locator('#tuning .t-row', { has: page.locator(`input[aria-label="${k}"]`) }).locator('.tag')).toHaveCount(0);
    }
  });
});

test.describe('375x667 portrait, the raid banner and chip', () => {
  test.use({ viewport: PHONE });

  test('the banner has a fixed two-line room under the wide font, from the muster to the fight, and the chip suffix and banner shift nothing in the HUD', async ({ page }) => {
    await ready(page);
    await pause(page);
    await tune(page, 'raid.firstAtEcon', 2);
    await tune(page, 'raid.musterTicks', 300);
    const hud0 = await hudBoxes(page);
    await stepSimUntil(page, async () => (await raid(page)).phase === 'muster', 12_000, 'the muster', false);
    await settled(page);
    expect(await hudBoxes(page), 'the HUD did not move at the muster').toBe(hud0);
    const bannerBox = (): Promise<{ h: number; lines: number; text: string; raid: boolean }> =>
      page.evaluate(() => {
        const b = document.getElementById('banner')!;
        const l = b.querySelector<HTMLElement>('.bline.raid');
        const lh = l === null ? 0 : parseFloat(getComputedStyle(l).lineHeight);
        return { h: Math.round(b.getBoundingClientRect().height), lines: l === null ? 0 : Math.round(l.getBoundingClientRect().height / lh), text: b.textContent ?? '', raid: l !== null };
      });
    const m = await bannerBox();
    expect(m.raid, 'the muster line is a raid line').toBe(true);
    expect(m.text).toMatch(/^Raid gathering/);
    expect(m.lines, 'two lines of room under the wide font').toBe(2);
    await page.screenshot({ path: 'test-results/h9-banner-muster.png' });
    // One prong (h9-sim's shape, or a small raid): H7's text, unchanged.
    const r = await raid(page);
    if (r.prongs.length === 1) expect(m.text).toMatch(/^Raid gathering: (\d+ (Spores?|Thorns?)(, )?)+ → A\d in \d+ s$/);
    // The fight has the same room, so the map below never moves when the muster gives way to it.
    await stepSimUntil(page, async () => (await raid(page)).phase === 'fight', 6000, 'the fight', false);
    await settled(page);
    const f = await bannerBox();
    expect(f.text).toMatch(/^Raid at /);
    expect(f.h, 'the banner is as tall in the fight as at the muster').toBe(m.h);
    expect(await hudBoxes(page), 'the HUD did not move in the fight').toBe(hud0);
    // Tapping the banner opens the first prong's rock.
    await page.locator('#banner').click();
    expect(await page.evaluate(() => window.__factory4x!.selected())).toBe((await raid(page)).target);
  });
});

test.describe('375x667 portrait, two prongs', () => {
  test.use({ viewport: PHONE });

  interface Prong {
    target: number;
    phase: string;
    planned: { thorn: number; spore: number };
    raiders: { thorn: number; spore: number };
    outcome: string | null;
  }
  interface TwoRaid {
    phase: string;
    target: number | null;
    prongs: Prong[];
    nextProngs: number;
    econ: number;
    last: null | { prongs: Array<{ target: number; outcome: string }> };
  }
  const raid2 = async (page: Page): Promise<TwoRaid> => JSON.parse(await page.evaluate(() => window.__factory4x!.raidStatus())) as TwoRaid;
  const IDS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
  /** The map's short name of a rock ("A5"). */
  const name = async (page: Page, node: number): Promise<string> => {
    const idx = await page.evaluate((l) => l.map((i) => window.__factory4x!.nodeIndex(i)), IDS);
    return IDS[idx.indexOf(node)]!.toUpperCase();
  };

  /**
   * The raid tunables of H7 and H8 (firstAtEcon 2, a short muster) plus raid.prongMinSize 2, as the spec's tests use. Raids stay off while the
   * economy grows to a size that can split (R4: about half the economy ships) over two raidable rocks, then switch on, so the first raid is
   * a two-prong one. Stops at its muster, paused.
   */
  async function toTwoProngMuster(page: Page, musterTicks: number): Promise<void> {
    await tune(page, 'raid.enabled', 0);
    await tune(page, 'raid.firstAtEcon', 2);
    await tune(page, 'raid.musterTicks', musterTicks);
    await tune(page, 'raid.prongMinSize', 2);
    const nodes = await page.evaluate((l) => l.map((i) => window.__factory4x!.nodeIndex(i)), IDS);
    await stepSimUntil(
      page,
      async () => {
        const ranked = (await Promise.all(nodes.map((n) => rock(page, n)))).filter((r) => r.raidRank > 0).length;
        return ranked >= 2 && (await raid2(page)).econ >= 10;
      },
      30_000,
      'ten economy ships on two raidable rocks',
      false,
    );
    await tune(page, 'raid.enabled', 1);
    // One tick at a time near the muster, so a short one is never skipped.
    for (let i = 0; i < 600 && (await raid2(page)).phase === 'none'; i++) await page.evaluate(() => window.__factory4x!.advanceTicks(1));
    const r = await raid2(page);
    expect(r.phase, 'the raid mustered').not.toBe('none');
    expect(r.prongs, 'two prongs').toHaveLength(2);
  }

  test('the muster names both rocks, the chip says "· 2", both rocks wear a badge with their own mix, and nothing in the HUD moves', async ({ page }) => {
    test.setTimeout(150_000);
    await ready(page);
    await pause(page);
    const hud0 = await hudBoxes(page);
    await toTwoProngMuster(page, 600);
    const r = await raid2(page);
    expect(r.phase).toBe('muster');
    const [p0, p1] = r.prongs as [Prong, Prong];
    expect(p0.target).not.toBe(p1.target);
    const n0 = await name(page, p0.target);
    const n1 = await name(page, p1.target);
    await settled(page);
    // The banner: one segment per prong, with the counts from `planned`, and two lines of room.
    const seg = (n: string, c: { thorn: number; spore: number }): string => [n, c.thorn > 0 ? `${c.thorn}T` : '', c.spore > 0 ? `${c.spore}S` : ''].filter((x) => x !== '').join(' ');
    const banner = page.locator('#banner .bline.raid');
    await expect(banner).toHaveText(new RegExp(`^Raid gathering in \\d+ s → ${seg(n0, p0.planned)} · ${seg(n1, p1.planned)}$`));
    const lines = await banner.evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)));
    expect(lines, 'two lines of room under the wide font').toBe(2);
    const bannerBox = await page.locator('#banner').boundingBox();
    expect(bannerBox!.x + bannerBox!.width, 'the banner stays on screen').toBeLessThanOrEqual(PHONE.width);
    // The chip: the soonest time, plus "· 2".
    await expect(page.locator('#chip-raid')).toContainText(/Raid \d+:\d\d · 2/);
    expect(await hudBoxes(page), 'two prongs, the banner and the chip suffix shift nothing in the HUD').toBe(hud0);
    // Two badges, one per prong target, and nowhere else.
    expect(JSON.parse(await page.evaluate(() => window.__factory4x!.raidBadges())) as number[]).toEqual([p0.target, p1.target].sort((a, b) => a - b));
    await page.screenshot({ path: 'test-results/h9-two-prong-muster.png' });
    // Each rock carries its own prong's plan, and the banner opens the first prong's rock.
    for (const p of [p0, p1]) {
      const st = await rock(page, p.target);
      expect(st.raidMix).toEqual(p.planned);
      expect(st.raidTarget).toBe(true);
    }
    await page.locator('#banner').click();
    expect(await page.evaluate(() => window.__factory4x!.selected())).toBe(p0.target);
    await expect(page.locator('#sheet .rock-note .raid')).toHaveText(/^Raid coming: /);
    await page.locator('#sheet .close').click();
    await settled(page);
    const p = await page.evaluate((n) => window.__factory4x!.nodeScreenPos(n), p1.target);
    await tapAt(page, p.x, p.y);
    expect(await page.evaluate(() => window.__factory4x!.selected())).toBe(p1.target);
    await expect(page.locator('#sheet .rock-note .raid')).toHaveText(/^Raid coming: /);
  });

  test('two legs fly out with their own markers; the rock sheet with two prongs out fits and the map keeps its room; the end report lists each prong', async ({ page }) => {
    test.setTimeout(150_000);
    await ready(page);
    await pause(page);
    await toTwoProngMuster(page, 30);
    const map = async (): Promise<{ prongs: Array<{ target: number; marker: boolean; countdown: string; frac: number }> }> => JSON.parse(await page.evaluate(() => window.__factory4x!.mapField()));
    await stepSimUntil(page, async () => (await raid2(page)).prongs.every((p) => p.phase === 'out'), 600, 'both prongs out', false);
    await settled(page);
    const r = await raid2(page);
    const m = await map();
    expect(m.prongs.map((p) => p.target).sort((a, b) => a - b), 'a leg per prong').toEqual(r.prongs.map((p) => p.target).sort((a, b) => a - b));
    for (const leg of m.prongs) {
      expect(leg.marker, `prong at ${leg.target} has a marker`).toBe(true);
      expect(leg.countdown).toMatch(/^\d+s$/);
    }
    expect(await page.evaluate(() => window.__factory4x!.raidFlight())).toContain('"prongs":[');
    // The rock sheet on the second prong's rock, raid out: it fits without scrolling, and the map keeps its room.
    const target = r.prongs[1]!.target;
    const p = await page.evaluate((n) => window.__factory4x!.nodeScreenPos(n), target);
    await tapAt(page, p.x, p.y);
    await expect(page.locator('#sheet .rock-note .raid')).toHaveText(/^Raid coming: /);
    await settled(page);
    const fit = await page.evaluate(() => {
      const e = document.getElementById('sheet')!;
      // A rock with ships parked at it adds the Recycle section (H8), which H8's 185 px figure did not include.
      const rec = e.querySelector('.recycle-btn')?.closest('section');
      const extra = rec !== null && rec !== undefined && !rec.hasAttribute('hidden') ? rec.getBoundingClientRect().height : 0;
      return { scroll: e.scrollHeight, client: e.clientHeight, stage: document.getElementById('stage')!.clientHeight, extra };
    });
    console.log(`rock sheet open, two prongs out, wide font: map (stage) ${fit.stage} px, sheet ${fit.client} px, Recycle section ${Math.round(fit.extra)} px`);
    await page.screenshot({ path: 'test-results/h9-two-prong-out.png' });
    expect(fit.scroll).toBeLessThanOrEqual(fit.client + 1);
    expect(fit.stage + fit.extra, 'the map keeps the room H8 left it with two prongs out, counting the Recycle section').toBeGreaterThanOrEqual(185);
    await expectControlsFit(page, '#sheet', 'the rock sheet with two prongs out');
    await page.locator('#sheet .close').click();
    // To the end: a toast lists each prong, badges clear, the result line counts prongs.
    // On the way, a prong that is done leaves nothing on its rock (no mix, no badge) while the other may still be out.
    let sawDoneWhileOtherLive = false;
    await stepSimUntil(
      page,
      async () => {
        const now = await raid2(page);
        const live = now.prongs.filter((q) => q.phase !== 'done').map((q) => q.target);
        for (const q of now.prongs) {
          if (q.phase !== 'done' || live.includes(q.target)) continue;
          const st = await rock(page, q.target);
          expect(st.raidMix, `the done prong's rock ${q.target} has no mix`).toBeNull();
          expect(st.raidTarget, `the done prong's rock ${q.target} is no longer a target`).toBe(false);
          if (live.length > 0) sawDoneWhileOtherLive = true;
        }
        return now.phase === 'none' && now.last !== null;
      },
      9000,
      'the raid ending',
      false,
    );
    console.log(`a done prong was seen while the other was still live: ${sawDoneWhileOtherLive}`);
    await settled(page);
    expect(await page.evaluate(() => window.__factory4x!.raidBadges())).toBe('[]');
    const last = (await raid2(page)).last!;
    expect(last.prongs).toHaveLength(2);
    await expect(page.locator('#toast')).toContainText(/Raid: A\d (beaten|turned back|hit, [^·]+ lost) · A\d (beaten|turned back|hit, [^·]+ lost)/);
    await page.evaluate(() => window.__factory4x!.debugShowResult());
    await expect(page.locator('#result .stat-line', { hasText: 'Raid prongs' })).toContainText(/\d+: \d+ beaten · \d+ hit · \d+ turned back/);
  });

  test('one prong beaten while the other is still out: its badge, leg, mix and raid line are gone, and the other prong badge, leg, countdown, banner and chip still show', async ({ page }) => {
    test.setTimeout(150_000);
    await ready(page);
    await pause(page);
    await toTwoProngMuster(page, 60);
    const r0 = await raid2(page);
    const [first, second] = r0.prongs as [Prong, Prong];
    // The first prong's rock gets a guard big enough to beat it, parked before the raid arrives.
    await page.evaluate(([n]) => window.__factory4x!.debugParkShips(n as number, { drone: 12, lancer: 4 }), [first.target] as const);
    const map = async (): Promise<{ prongs: Array<{ target: number; marker: boolean; countdown: string }> }> => JSON.parse(await page.evaluate(() => window.__factory4x!.mapField()));
    const badges = async (): Promise<number[]> => JSON.parse(await page.evaluate(() => window.__factory4x!.raidBadges())) as number[];
    // One tick at a time, until the first prong is done and the second is not.
    let r = r0;
    for (let i = 0; i < 3000 && !(r.prongs[0]!.phase === 'done' && r.prongs[1]!.phase !== 'done'); i++) {
      await page.evaluate(() => window.__factory4x!.advanceTicks(1));
      r = await raid2(page);
      if (r.phase === 'none') break;
    }
    expect(r.prongs[0]!.phase, 'the first prong is done').toBe('done');
    expect(r.prongs[0]!.outcome).toBe('beaten');
    expect(r.prongs[1]!.phase, 'the second prong is still in play').not.toBe('done');
    const nFirst = await name(page, first.target);
    const nSecond = await name(page, second.target);
    const check = async (what: string): Promise<void> => {
      await settled(page);
      // Map: one badge (the live prong's rock) and one leg (its own marker or fight line); nothing for the done prong.
      expect(await badges(), `${what}: only the live prong wears a badge`).toEqual([second.target]);
      const m = await map();
      expect(m.prongs.map((p) => p.target), `${what}: only the live prong has a leg`).toEqual([second.target]);
      // The done prong's rock: no mix, no target flag, and no raid line on its sheet.
      const done = await rock(page, first.target);
      expect(done.raidMix, `${what}: no mix on the done prong's rock`).toBeNull();
      expect(done.raidTarget).toBe(false);
      // The live prong's rock still carries its raiders.
      const live = await rock(page, second.target);
      expect(live.raidMix, `${what}: the live prong keeps its mix`).not.toBeNull();
      expect(live.raidTarget).toBe(true);
      // The chip names the soonest time or the fight, with no "· 2" now that one prong is left.
      await expect(page.locator('#chip-raid')).toContainText(/Raid/);
      await expect(page.locator('#chip-raid')).not.toContainText('· 2');
    };
    // Phase A: the second prong is still flying (when it is): its marker and countdown show, and there is no banner.
    const live = r.prongs[1]!;
    if (live.phase === 'out') {
      await check('second prong out');
      const m = await map();
      expect(m.prongs[0]!.marker).toBe(true);
      expect(m.prongs[0]!.countdown).toMatch(/^\d+s$/);
      await expect(page.locator('#chip-raid')).toContainText(/Raid \d+:\d\d/);
      await expect(page.locator('#banner .bline.raid')).toHaveCount(0);
      await page.screenshot({ path: 'test-results/h9-one-done-out.png' });
      // The done rock's sheet has no raid line; the live rock's does.
      await openRock(page, nFirst.toLowerCase());
      await expect(page.locator('#sheet .rock-note .raid')).toHaveText('');
      await page.locator('#sheet .close').click();
      await openRock(page, nSecond.toLowerCase());
      await expect(page.locator('#sheet .rock-note .raid')).toHaveText(/^Raid coming: /);
      await page.locator('#sheet .close').click();
      // Phase B: it arrives and fights; the banner names only its rock.
      await stepSimUntil(page, async () => (await raid2(page)).prongs[1]!.phase === 'fight' || (await raid2(page)).phase === 'none', 3000, 'the second prong fighting', false);
    }
    const now = await raid2(page);
    if (now.phase === 'fight') {
      await check('second prong fighting');
      await expect(page.locator('#banner .bline.raid')).toHaveText(new RegExp(`^Raid at ${nSecond}: [0-9]+ left$`));
      await expect(page.locator('#chip-raid')).toContainText('Raid on');
      await page.screenshot({ path: 'test-results/h9-one-done-fight.png' });
    }
  });

  test('before the raid, the rank line shows on both rocks a split would hit and on no other', async ({ page }) => {
    test.setTimeout(150_000);
    await ready(page);
    await pause(page);
    // Raids stay on (nextProngs is 0 with them off) but their threshold is out of reach, so none musters.
    await tune(page, 'raid.firstAtEcon', 20);
    await tune(page, 'raid.prongMinSize', 2);
    const nodes = await page.evaluate((l) => l.map((i) => window.__factory4x!.nodeIndex(i)), IDS);
    await stepSimUntil(page, async () => (await raid2(page)).nextProngs === 2, 30_000, 'a raid that would split', false);
    const marked = (await Promise.all(nodes.map(async (n) => ({ n, r: await rock(page, n) })))).filter((x) => x.r.mine);
    const next = marked.filter((x) => x.r.raidNext).map((x) => x.n);
    expect(next, 'two rocks a raid would hit').toHaveLength(2);
    for (const x of marked) {
      const id = IDS[nodes.indexOf(x.n)]!;
      await openRock(page, id);
      await expect(page.locator('#sheet .rock-note .rank'), id).toHaveText(next.includes(x.n) ? /raids hit here first/i : '');
      await page.locator('#sheet .close').click();
    }
  });
});
