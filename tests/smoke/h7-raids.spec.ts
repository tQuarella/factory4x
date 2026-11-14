import { expect, test, type Page } from '@playwright/test';
import { settled } from './helpers.ts';

/**
 * H7 client, raid readability (acceptance 4): the muster banner (a tap opens the target's sheet), the raid marker on its dashed line with
 * a countdown, the rock under raid, the battle line, the end toast, and the raid chip in each state. The raid is driven with tunables
 * (raid.firstAtEcon 2, a short muster) and stepped tick by tick with the advanceTicks hook, so no phase is missed. At every phase the
 * top bar's boxes are measured: nothing in the HUD shifts when the banner, chip or toast appears. A wide font is forced throughout.
 */

const WIDE_FONT =
  '#sheet *, #chips *, #controls *, #tuning *, .card *, #banner, #toast, #hint { font-family: serif !important; font-size: 15px !important; letter-spacing: 0.15em !important; line-height: 1.5 !important; }';
const PHONE = { width: 375, height: 667 };

interface Raid {
  phase: 'none' | 'muster' | 'out' | 'fight' | 'home';
  planned: { thorn: number; spore: number };
  raiders: { thorn: number; spore: number };
  target: number | null;
  ticksToLaunch: number;
  ticksToArrival: number;
  econ: number;
  nextRaidAtEcon: number;
  last: { outcome: string; lostEcon: { extractor: number; hauler: number } } | null;
}
const raid = async (page: Page): Promise<Raid> => JSON.parse(await page.evaluate(() => window.__factory4x!.raidStatus())) as Raid;
const map = async (page: Page): Promise<{ raid: { pulse: boolean; line: boolean; marker: boolean; raided: number; countdown: string; from: number; to: number; frac: number } }> => JSON.parse(await page.evaluate(() => window.__factory4x!.mapField()));

/** The boxes that make up the HUD: they must not move or resize when a raid notice, chip state or toast changes. */
async function hudBoxes(page: Page): Promise<string> {
  return page.evaluate(() => {
    const r = (id: string): string => {
      const b = document.getElementById(id)!.getBoundingClientRect();
      return `${id}:${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)},${Math.round(b.height)}`;
    };
    return ['bars', 'stats', 'chips', 'chip-ore', 'chip-fleet', 'chip-raid', 'controls'].map(r).join('|');
  });
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

/** Steps the sim until `until` holds (or the cap), in small chunks, refreshing the screen each time. */
async function stepUntil(page: Page, until: (r: Raid) => boolean, chunk = 15, cap = 9000): Promise<Raid> {
  for (let t = 0; t < cap; t += chunk) {
    const r = await raid(page);
    if (until(r)) return r;
    await page.evaluate((n) => window.__factory4x!.advanceTicks(n), chunk);
  }
  throw new Error('the raid never reached the state');
}

test.describe('375x667 portrait, by touch', () => {
  test.use({ viewport: PHONE });

  test('acceptance 4: a raid is readable in every phase and the HUD never moves', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
    await page.addStyleTag({ content: WIDE_FONT });
    await tune(page, 'raid.firstAtEcon', 2);
    await tune(page, 'raid.musterTicks', 600);
    // The chip before any raid: raids start at 2 ships.
    const hud0 = await hudBoxes(page);
    await page.evaluate(() => window.__factory4x!.advanceTicks(1));
    await expect(page.locator('#chip-raid')).toBeVisible();
    await expect(page.locator('#chip-raid b')).toHaveText('Raids at 2 ships');

    // Muster: the banner names the mix, the target and the seconds; the hive pulses; the chip counts down.
    const m = await stepUntil(page, (r) => r.phase === 'muster');
    await settled(page);
    const target = m.target!;
    expect(target).not.toBeNull();
    const banner = page.locator('#banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveText(/^Raid gathering: (\d+ (Spores?|Thorns?)(, )?)+ → [A-Z0-9]+ in \d+ s$/);
    await expect(page.locator('#chip-raid b')).toHaveText(/^Raid \d:\d\d$/);
    expect((await map(page)).raid.pulse).toBe(true);
    expect(await hudBoxes(page), 'the HUD did not move at the muster').toBe(hud0);
    // A tap on the banner opens the target's sheet.
    const b = (await banner.boundingBox())!;
    if (test.info().project.name === 'phone') await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    expect(await page.evaluate(() => window.__factory4x!.selected()), 'the banner tap opened the target sheet').toBe(target);
    await page.locator('#sheet .close').click();

    // Out: the marker rides the dashed line, with a countdown.
    const out = await stepUntil(page, (r) => r.phase === 'out', 5);
    await page.evaluate(() => window.__factory4x!.advanceTicks(10));
    await settled(page);
    const drawn = (await map(page)).raid;
    expect(drawn.line, 'the dashed line is drawn').toBe(true);
    expect(drawn.marker, 'the raid marker is drawn').toBe(true);
    expect(drawn.countdown).toMatch(/^\d+s$/);
    await expect(page.locator('#chip-raid b')).toHaveText(/^Raid \d:\d\d$/);
    expect(out.raiders.thorn + out.raiders.spore).toBeGreaterThan(0);
    expect(await hudBoxes(page), 'the HUD did not move while the raid is out').toBe(hud0);

    // At the target: the rock is flagged, the battle line counts the raiders left.
    const fight = await stepUntil(page, (r) => r.phase === 'fight', 5);
    await settled(page);
    expect((await map(page)).raid.raided, 'the rock under raid is drawn raided').toBe(target);
    await expect(banner).toHaveText(new RegExp(`^Raid at [A-Z0-9]+: ${fight.raiders.thorn + fight.raiders.spore} left$`));
    await expect(page.locator('#chip-raid b')).toHaveText('Raid on');
    expect(await hudBoxes(page), 'the HUD did not move in the fight').toBe(hud0);

    // The end: a toast says how it went, and the chip is back to its resting text.
    const end = await stepUntil(page, (r) => r.phase === 'none' && r.last !== null, 5);
    await settled(page);
    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/^Raid (beaten at [A-Z0-9]+: \d+ killed, \d+ lost|hit [A-Z0-9]+: lost .+|turned back)/);
    expect(['beaten', 'hit', 'turnedBack']).toContain(end.last!.outcome);
    if (end.last!.outcome === 'hit') {
      const n = end.last!.lostEcon.extractor + end.last!.lostEcon.hauler;
      expect(n).toBeGreaterThan(0);
      await expect(toast).toContainText(/lost \d+ (extractors?|haulers?)/);
    }
    expect(await hudBoxes(page), 'the HUD did not move at the end toast').toBe(hud0);
    await expect(page.locator('#chip-raid b')).not.toHaveText(/^Raid (\d|on|leaving)/);
    await expect(page.locator('#banner')).toBeHidden();
  });

  test('the raid chip hides when raids are off', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
    await expect(page.locator('#chip-raid')).toBeVisible();
    await tune(page, 'raid.enabled', 0);
    await expect(page.locator('#chip-raid')).toBeHidden();
  });

  interface Flight { phase: string; from: number; target: number; ticksLeft: number; flightTicks: number }
  const flight = async (page: Page): Promise<Flight | null> => JSON.parse(await page.evaluate(() => window.__factory4x!.raidFlight())) as Flight | null;
  const hiveOf = (page: Page): Promise<number> => page.evaluate(() => window.__factory4x!.nodeIndex('heart'));

  async function openGame(page: Page): Promise<void> {
    await page.setViewportSize(PHONE);
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
    await page.addStyleTag({ content: WIDE_FONT });
    await tune(page, 'raid.firstAtEcon', 2);
    await tune(page, 'raid.musterTicks', 300);
  }

  test('acceptance 4: a retarget redraws the leg from the rock the raid was flying to, with the progress of the new flight', async ({ page }) => {
    await openGame(page);
    const hive = await hiveOf(page);
    await stepUntil(page, (r) => r.phase === 'out', 5);
    await page.evaluate(() => window.__factory4x!.advanceTicks(20));
    await settled(page);
    const first = (await flight(page))!;
    expect(first.from, 'the first leg starts at the hive').toBe(hive);
    const m1 = (await map(page)).raid;
    expect([m1.from, m1.to], 'the first leg is drawn hive to target').toEqual([hive, first.target]);
    expect(m1.frac).toBeCloseTo(1 - first.ticksLeft / first.flightTicks, 1);
    // Stop the rock the raid is flying to (the counterplay the banner invites), through its sheet.
    const ids = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    let targetId = '';
    for (const id of ids) if ((await page.evaluate((i) => window.__factory4x!.nodeIndex(i), id)) === first.target) targetId = id;
    expect(targetId, 'the target is an asteroid').not.toBe('');
    const node = first.target;
    await settled(page);
    const p = await page.evaluate((i) => window.__factory4x!.nodeScreenPos(i), node);
    if (test.info().project.name === 'phone') await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
    expect(await page.evaluate(() => window.__factory4x!.selected())).toBe(node);
    await page.locator('#sheet .mine-btn').click();
    await page.locator('#sheet .close').click();
    // The raid arrives, finds the rock unmarked and flies on from it: the new leg starts at the old target.
    for (let t = 0; t < 600; t += 3) {
      const f = await flight(page);
      if (f === null || f.from !== hive) break;
      await page.evaluate(() => window.__factory4x!.advanceTicks(3));
    }
    const second = await flight(page);
    expect(second, 'the raid is still on').not.toBeNull();
    expect(second!.from, 'the new leg starts at the rock it was flying to').toBe(first.target);
    await page.evaluate(() => window.__factory4x!.advanceTicks(4));
    await settled(page);
    const f2 = (await flight(page))!;
    const m2 = (await map(page)).raid;
    expect(m2.from).toBe(first.target);
    expect(m2.to).toBe(f2.phase === 'home' ? hive : f2.target);
    expect(f2.target === first.target ? true : f2.phase === 'out' || f2.phase === 'home').toBe(true);
    expect(m2.marker).toBe(true);
    expect(m2.frac, 'progress comes from the new flight').toBeCloseTo(1 - f2.ticksLeft / f2.flightTicks, 1);
    expect(m2.frac).toBeLessThan(0.6);
  });

  test('acceptance 4: a run resumed mid-flight draws the marker where the raid is, not at the hive', async ({ page }) => {
    await openGame(page);
    await stepUntil(page, (r) => r.phase === 'out', 5);
    let f = (await flight(page))!;
    while (f.ticksLeft > f.flightTicks / 2) {
      await page.evaluate(() => window.__factory4x!.advanceTicks(5));
      f = (await flight(page))!;
    }
    expect(f.phase).toBe('out');
    expect(await page.evaluate(() => window.__factory4x!.saveNow())).toBe(true);
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
    await page.evaluate(() => window.__factory4x!.advanceTicks(0));
    await settled(page);
    const g = (await flight(page))!;
    expect(g.ticksLeft).toBe(f.ticksLeft);
    const m = (await map(page)).raid;
    expect(m.marker).toBe(true);
    expect(m.frac, 'half way along its leg').toBeGreaterThan(0.45);
    expect(m.frac).toBeCloseTo(1 - g.ticksLeft / g.flightTicks, 1);
    expect(m.from).toBe(g.from);
  });
});
