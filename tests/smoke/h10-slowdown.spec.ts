import { expect, test, type Page } from '@playwright/test';
import { settled, stepSimUntil } from './helpers.ts';

/**
 * H10 phase 1 (S1-S6): the auto-slowdown. A raid musters and the client drops from 4x to 1x, then gives 4x back when every prong's
 * outcome is decided. The sim is stepped with `advanceTicks` (the hook runs the slowdown after every tick, as the frame loop does after
 * each advance), never waited for in real time. Layout assertions force a wide font on the elements under test.
 */

const WIDE_FONT =
  '#sheet *, #sendpanel *, #recyclepanel *, #fleetpanel *, #result *, #chips *, #controls *, #tuning *, .card *, #banner, #movebar, #toast, #hint { font-family: serif !important; font-size: 15px !important; letter-spacing: 0.15em !important; line-height: 1.5 !important; }';
const PHONE = { width: 375, height: 667 };
const TOAST_4X = '1x for the raid · back to 4x after';

interface Prong {
  target: number;
  phase: string;
  outcome: string | null;
}
interface Raid {
  phase: string;
  target: number | null;
  prongs: Prong[];
  econ: number;
  last: null | { id: number };
}

async function ready(page: Page): Promise<void> {
  await page.setViewportSize(PHONE);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  await page.addStyleTag({ content: WIDE_FONT });
  await settled(page);
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

const raid = async (page: Page): Promise<Raid> => JSON.parse(await page.evaluate(() => window.__factory4x!.raidStatus())) as Raid;
/** The speed the control shows pressed (the session's speed). */
const speed = (page: Page): Promise<number> => page.evaluate(() => Number(document.querySelector<HTMLElement>('.speed.on')?.dataset.speed ?? 0));
const toastText = (page: Page): Promise<string> => page.evaluate(() => (document.getElementById('toast')!.hidden ? '' : document.getElementById('toast')!.textContent ?? ''));
const step = (page: Page, n: number): Promise<void> => page.evaluate((k) => window.__factory4x!.advanceTicks(k), n);

async function hudBoxes(page: Page): Promise<string> {
  return page.evaluate(() => {
    const r = (id: string): string => {
      const b = document.getElementById(id)!.getBoundingClientRect();
      return `${id}:${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)},${Math.round(b.height)}`;
    };
    return ['bars', 'stats', 'chips', 'chip-ore', 'chip-fleet', 'chip-raid', 'controls'].map(r).join('|');
  });
}

/** Steps in chunks of 5 ticks until `cond` holds (the slowdown runs after every tick inside a chunk). */
async function until(page: Page, cond: (r: Raid) => boolean, what: string, cap = 12_000): Promise<Raid> {
  for (let t = 0; t <= cap; t += 5) {
    const r = await raid(page);
    if (cond(r)) return r;
    await step(page, 5);
  }
  throw new Error(`${what} was not reached in ${cap} ticks`);
}

/** Raids at 2 ships with a muster of `musterTicks`; the game is paused at 4x and the raid not yet mustered. */
async function setup(page: Page, musterTicks: number, at: 1 | 2 | 4 = 4): Promise<void> {
  await ready(page);
  await pause(page);
  await tune(page, 'raid.firstAtEcon', 2);
  await tune(page, 'raid.musterTicks', musterTicks);
  await page.evaluate((v) => window.__factory4x!.setSpeed(v), at);
  expect(await speed(page)).toBe(at);
}

const mustered = (r: Raid): boolean => r.phase === 'muster' || r.phase === 'out' || r.phase === 'fight';

test.describe('375x667 portrait, the raid auto-slowdown', () => {
  test.use({ viewport: PHONE });

  test('at 4x a raid drops the game to 1x with a toast naming the real speed, shifts nothing in the HUD, and its outcome gives 4x back (musterTicks 0)', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page, 0);
    const hud0 = await hudBoxes(page);
    const r0 = await until(page, mustered, 'a raid');
    expect(r0.phase).not.toBe('none');
    await settled(page);
    expect(await speed(page), 'the raid dropped the game to 1x').toBe(1);
    expect(await toastText(page)).toBe(TOAST_4X);
    expect(await page.evaluate(() => window.__factory4x!.paused()), 'pause was not touched').toBe(true);
    const tb = (await page.locator('#toast').boundingBox())!;
    expect(tb.x + tb.width, 'the toast fits the phone width under the wide font').toBeLessThanOrEqual(PHONE.width);
    expect(tb.x).toBeGreaterThanOrEqual(0);
    expect(await hudBoxes(page), 'the toast and the pressed 1x shifted nothing in the HUD').toBe(hud0);
    await page.screenshot({ path: 'test-results/h10-slowdown-engaged.png' });
    // It holds 1x through the out and fight phases.
    const fight = await until(page, (r) => r.phase === 'fight' || r.phase === 'none', 'the fight');
    if (fight.phase === 'fight') expect(await speed(page), '1x holds in the fight').toBe(1);
    const id = fight.last?.id ?? 0;
    // The outcome is decided: 4x is back.
    await until(page, (r) => r.phase === 'none' && (r.last?.id ?? 0) > id, 'the raid over');
    await settled(page);
    expect(await speed(page), 'the outcome restored 4x').toBe(4);
    expect(await page.evaluate(() => window.__factory4x!.paused()), 'pause still untouched').toBe(true);
    expect(await hudBoxes(page), 'the restore shifted nothing in the HUD').toBe(hud0);
  });

  test('at 1x a raid changes nothing: no toast, still 1x after it', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page, 0, 1);
    const r0 = await until(page, mustered, 'a raid');
    expect(r0.phase).not.toBe('none');
    expect(await speed(page)).toBe(1);
    expect(await toastText(page)).not.toContain('for the raid');
    await until(page, (r) => r.phase === 'none' && r.last !== null, 'the raid over');
    expect(await speed(page)).toBe(1);
    expect(await toastText(page)).not.toContain('for the raid');
  });

  test('with client.raidSlowdown 0 (the tuning panel, this device) nothing engages: still 4x through the raid, no toast', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page, 0, 1);
    await tune(page, 'client.raidSlowdown', 0);
    await page.evaluate(() => window.__factory4x!.setSpeed(4));
    await until(page, mustered, 'a raid');
    expect(await speed(page)).toBe(4);
    expect(await toastText(page)).not.toContain('for the raid');
    await until(page, (r) => r.phase === 'none' && r.last !== null, 'the raid over');
    expect(await speed(page)).toBe(4);
  });

  test('a prong beaten by parked ships restores 4x', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page, 60);
    const m = await until(page, (r) => r.phase === 'muster', 'the muster');
    expect(await speed(page)).toBe(1);
    await page.evaluate((n) => window.__factory4x!.debugParkShips(n, { drone: 12, lancer: 4 }), m.target!);
    const done = await until(page, (r) => r.phase === 'none' && r.last !== null, 'the raid over');
    expect(done.last).not.toBeNull();
    expect(await speed(page), 'a beaten prong decides the raid and restores 4x').toBe(4);
  });

  test('a muster cancelled by a battle at the hive restores 4x; the muster that follows has a new id and engages again', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page, 3000);
    await until(page, (r) => r.phase === 'muster', 'the muster');
    expect(await speed(page)).toBe(1);
    expect(await toastText(page)).toBe(TOAST_4X);
    const hive = await page.evaluate(() => window.__factory4x!.nodeIndex('heart'));
    await page.evaluate((n) => window.__factory4x!.debugParkShips(n, { drone: 8, lancer: 3 }), hive);
    await until(page, (r) => r.phase === 'none', 'the muster cancelled', 600);
    await settled(page);
    expect(await speed(page), 'the cancelled muster gave 4x back').toBe(4);
    // The battle ends; the raid musters again under a new id and engages again.
    await until(page, (r) => r.phase === 'muster', 'the muster again', 9000);
    expect(await speed(page), 'the next muster engaged again').toBe(1);
    // The battle's report landed after the engage note and did not replace it: both show, the note first.
    const both = await toastText(page);
    expect(both.startsWith(TOAST_4X), 'the engage note is first').toBe(true);
    expect(both, 'the battle report is there too').toMatch(/Hive/);
  });

  test('a raid that turns back (every rock unmarked before it arrives, so nothing is hit) restores 4x', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page, 600);
    await until(page, (r) => r.phase === 'muster', 'the muster');
    expect(await speed(page)).toBe(1);
    // Unmark every marked rock with a real tap on its sheet's Mine button, so the raid finds nothing raidable.
    for (const id of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']) {
      const node = await page.evaluate((i) => window.__factory4x!.nodeIndex(i), id);
      const marked = (JSON.parse(await page.evaluate((n) => window.__factory4x!.rockStatus(n), node)) as { mine: boolean }).mine;
      if (!marked) continue;
      await settled(page);
      const p = await page.evaluate((i) => window.__factory4x!.nodeScreenPos(i), node);
      if (test.info().project.name === 'phone') await page.touchscreen.tap(p.x, p.y);
      else await page.mouse.click(p.x, p.y);
      expect(await page.evaluate(() => window.__factory4x!.selected()), `the tap on ${id} opened its sheet`).toBe(node);
      await page.locator('#sheet .mine-btn').click();
      await page.locator('#sheet .close').click();
    }
    const done = await until(page, (r) => r.phase === 'none' && r.last !== null, 'the raid over');
    expect(done.last).not.toBeNull();
    expect((done.last as unknown as { outcome: string }).outcome, 'nothing was hit, so it turned back').toBe('turnedBack');
    expect(await speed(page), 'a turned-back raid restores 4x').toBe(4);
  });

  test('a speed tap mid-raid wins: it stays, nothing is restored at the raid end, and the same raid never re-engages', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page, 600);
    await until(page, (r) => r.phase === 'muster', 'the muster');
    expect(await speed(page)).toBe(1);
    // A real touch on 2x.
    const two = page.locator('.speed[data-speed="2"]');
    const b = (await two.boundingBox())!;
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2).catch(() => two.click());
    if ((await speed(page)) !== 2) await two.click();
    expect(await speed(page)).toBe(2);
    // The rest of the raid, in steps: still 2x at every look, so it did not re-engage.
    for (let i = 0; i < 400; i++) {
      await step(page, 15);
      const r = await raid(page);
      expect(await speed(page), `2x holds (phase ${r.phase})`).toBe(2);
      if (r.phase === 'none') break;
    }
    expect((await raid(page)).phase).toBe('none');
    expect(await speed(page), 'nothing restored at the end').toBe(2);
  });

  test('pause is not a speed change: pausing and un-pausing mid-raid leave 1x, and the restore still comes', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page, 600);
    await until(page, (r) => r.phase === 'muster', 'the muster');
    expect(await speed(page)).toBe(1);
    await page.locator('#b-pause').click();
    expect(await page.evaluate(() => window.__factory4x!.paused())).toBe(false);
    expect(await speed(page), 'un-pausing runs at 1x').toBe(1);
    await page.locator('#b-pause').click();
    expect(await page.evaluate(() => window.__factory4x!.paused())).toBe(true);
    expect(await speed(page)).toBe(1);
    // The tuning panel pauses the game; it is not a speed change either.
    await page.locator('#b-tune').click();
    await page.locator('#tuning .close').click();
    expect(await speed(page)).toBe(1);
    await until(page, (r) => r.phase === 'none' && r.last !== null, 'the raid over');
    expect(await speed(page), 'restored after pause and the panel').toBe(4);
  });

  test('a reload mid-raid loads at 1x with nothing remembered: the raid engages and ends without a toast or a speed change', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page, 600);
    await until(page, (r) => r.phase === 'muster', 'the muster');
    expect(await speed(page)).toBe(1);
    expect(await page.evaluate(() => window.__factory4x!.saveNow())).toBe(true);
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
    await page.addStyleTag({ content: WIDE_FONT });
    await settled(page);
    expect((await raid(page)).phase, 'the save holds the raid').not.toBe('none');
    expect(await speed(page), 'a load starts at 1x').toBe(1);
    expect(await toastText(page)).not.toContain('for the raid');
    await step(page, 5);
    expect(await toastText(page)).not.toContain('for the raid');
    await until(page, (r) => r.phase === 'none', 'the raid over');
    expect(await speed(page)).toBe(1);
  });

  test('a split raid engages once, holds 1x until both prongs are decided, then restores', async ({ page }) => {
    test.setTimeout(180_000);
    const IDS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    await ready(page);
    await pause(page);
    // As H9: raids off while the economy grows over two raidable rocks, then on, so the first raid is a two-prong one.
    await tune(page, 'raid.enabled', 0);
    await tune(page, 'raid.firstAtEcon', 2);
    await tune(page, 'raid.musterTicks', 60);
    await tune(page, 'raid.prongMinSize', 2);
    const nodes = await page.evaluate((l) => l.map((i) => window.__factory4x!.nodeIndex(i)), IDS);
    const ranked = async (): Promise<number> =>
      (await Promise.all(nodes.map(async (n) => (JSON.parse(await page.evaluate((k) => window.__factory4x!.rockStatus(k), n)) as { raidRank: number }).raidRank))).filter((x) => x > 0).length;
    await stepSimUntil(page, async () => (await ranked()) >= 2 && (await raid(page)).econ >= 10, 30_000, 'ten economy ships on two raidable rocks', false);
    await page.evaluate(() => window.__factory4x!.setSpeed(4));
    await tune(page, 'raid.enabled', 1);
    const m = await until(page, (r) => r.phase === 'muster', 'the muster', 3000);
    expect(m.prongs, 'two prongs').toHaveLength(2);
    expect(await speed(page)).toBe(1);
    expect(await toastText(page)).toBe(TOAST_4X);
    // The first prong's rock gets a guard that beats it; the other prong is still out: 1x holds.
    await page.evaluate((n) => window.__factory4x!.debugParkShips(n, { drone: 12, lancer: 4 }), m.prongs[0]!.target);
    const half = await until(page, (r) => r.phase === 'none' || (r.prongs[0]?.outcome !== null && r.prongs[1]?.outcome === null), 'one prong decided');
    if (half.phase !== 'none') expect(await speed(page), 'one prong decided, one still out: 1x holds').toBe(1);
    await until(page, (r) => r.phase === 'none', 'both decided');
    expect(await speed(page), 'both decided: 4x is back').toBe(4);
  });
});
