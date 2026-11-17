import { expect, test, type Page } from '@playwright/test';
import { settled, stepSimUntil } from './helpers.ts';

/**
 * H10 client readouts: the hive sheet's guard line and rebuild, the hive's map label, "Hive −N" and "Hive 20 / 30" in the reports, the
 * roll segment of the banner, the tuning keys. `hive.rebuildTicks` 600 and `raid.rollMax` 1 are set in each test (the shipped data
 * keeps both at 0 until h10-design-data). The sim is stepped with `advanceTicks`, never waited for. 375x667, wide font, and the HUD
 * must not move.
 */

const WIDE_FONT =
  '#sheet *, #sendpanel *, #recyclepanel *, #fleetpanel *, #result *, #chips *, #controls *, #tuning *, .card *, #banner, #movebar, #toast, #hint { font-family: serif !important; font-size: 15px !important; letter-spacing: 0.15em !important; line-height: 1.5 !important; }';
const PHONE = { width: 375, height: 667 };
const IDS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];

interface Prong {
  target: number;
  phase: string;
  outcome: string | null;
  rolls: number;
  rolledFrom: number | null;
}
interface Raid {
  phase: string;
  target: number | null;
  prongs: Prong[];
  econ: number;
  last: null | { id: number; outcome: string };
}
interface Hive {
  total: number;
  totalCap: number;
  rebuild: null | { ticks: number; progress: number; nextType: 'thorn' | 'spore' | null };
}

async function ready(page: Page, size: { width: number; height: number } = PHONE): Promise<void> {
  await page.setViewportSize(size);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  await page.addStyleTag({ content: WIDE_FONT });
  await settled(page);
  if (!(await page.evaluate(() => window.__factory4x!.paused()))) await page.locator('#b-pause').click();
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
const hive = async (page: Page): Promise<Hive> => JSON.parse(await page.evaluate(() => window.__factory4x!.hiveStatus())) as Hive;
const label = async (page: Page): Promise<{ text: string; x: number; y: number; w: number; h: number } | null> => JSON.parse(await page.evaluate(() => window.__factory4x!.hiveLabel())) as { text: string; x: number; y: number; w: number; h: number } | null;
const step = (page: Page, n: number): Promise<void> => page.evaluate((k) => window.__factory4x!.advanceTicks(k), n);
const toastText = (page: Page): Promise<string> => page.evaluate(() => (document.getElementById('toast')!.hidden ? '' : document.getElementById('toast')!.textContent ?? ''));

async function hudBoxes(page: Page): Promise<string> {
  return page.evaluate(() => {
    const r = (id: string): string => {
      const b = document.getElementById(id)!.getBoundingClientRect();
      return `${id}:${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)},${Math.round(b.height)}`;
    };
    return ['bars', 'stats', 'chips', 'chip-ore', 'chip-fleet', 'chip-raid', 'controls'].map(r).join('|');
  });
}

async function until(page: Page, cond: (r: Raid) => boolean, what: string, cap = 12_000): Promise<Raid> {
  for (let t = 0; t <= cap; t += 5) {
    const r = await raid(page);
    if (cond(r)) return r;
    await step(page, 5);
  }
  throw new Error(`${what} was not reached in ${cap} ticks`);
}

async function tapAt(page: Page, x: number, y: number): Promise<void> {
  if (test.info().project.name === 'phone') await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Opens a node's sheet with a tap on the map. */
async function openNode(page: Page, node: number): Promise<void> {
  await settled(page);
  const p = await page.evaluate((n) => window.__factory4x!.nodeScreenPos(n), node);
  await tapAt(page, p.x, p.y);
  expect(await page.evaluate(() => window.__factory4x!.selected()), 'the tap opened the sheet').toBe(node);
}

/** Raids at 2 ships with a short muster; the first raid is beaten at its rock by parked ships, so the hive is short of guards. */
async function beatenRaid(page: Page): Promise<number> {
  await tune(page, 'raid.firstAtEcon', 2);
  await tune(page, 'raid.musterTicks', 60);
  const m = await until(page, (r) => r.phase === 'muster', 'the muster');
  await page.evaluate((n) => window.__factory4x!.debugParkShips(n, { drone: 12, lancer: 4 }), m.target!);
  // Stop at the first look after the outcome, before the toast is dismissed.
  await until(page, (r) => r.phase === 'none' && r.last !== null, 'the raid over');
  return m.target!;
}

test.describe('375x667 portrait, the hive readouts', () => {
  test.use({ viewport: PHONE });

  test('the hive sheet says "Guards n / cap · +1 Type in s", counts down, hides the regrow bars, ends at "Guards 30 / 30", and fits; the label follows', async ({ page }) => {
    test.setTimeout(120_000);
    await ready(page);
    const heart = await page.evaluate(() => window.__factory4x!.nodeIndex('heart'));
    await beatenRaid(page);
    const hud0 = await hudBoxes(page);
    // The hive is short of guards (the dead raiders are rebuilt one at a time).
    await settled(page);
    const h0 = await hive(page);
    expect(h0.total, 'the hive is below its caps after a beaten raid').toBeLessThan(h0.totalCap);
    expect(h0.rebuild).not.toBeNull();
    expect(h0.rebuild!.nextType).not.toBeNull();
    const text = (p: Hive): string => `Guards ${p.total} / ${p.totalCap} · +1 ${p.rebuild!.nextType === 'thorn' ? 'Thorn' : 'Spore'} in ${Math.ceil((p.rebuild!.ticks - p.rebuild!.progress) / 30)} s`;
    await openNode(page, heart);
    const line = page.locator('#sheet .hive-guards');
    await expect(line).toBeVisible();
    await expect(line).toHaveText(text(h0));
    await expect(line).toHaveText(/^Guards \d+ \/ \d+ · \+1 (Thorn|Spore) in \d+ s$/);
    // The per-type rows keep their counts and lose the regrow text and bars under the rebuild queue.
    await expect(page.locator('#sheet .guard-row .gr-name').first()).toHaveText(/\d+\/\d+/);
    await expect(page.locator('#sheet .gr-regrow:visible')).toHaveCount(0);
    await expect(page.locator('#sheet .bar.regrow:visible')).toHaveCount(0);
    // Fits 375x667 under the wide font without scrolling the sheet or the page sideways.
    const fit = await page.evaluate(() => {
      const s = document.getElementById('sheet')!;
      const l = document.querySelector<HTMLElement>('#sheet .hive-guards')!.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      return { lineShown: s.scrollTop === 0 && l.top >= sr.top && l.bottom <= sr.bottom, lineRight: l.right, lineLeft: l.left, page: document.documentElement.scrollWidth };
    });
    expect(fit.lineShown, 'the rebuild line is on screen at the top of the sheet, with no scrolling').toBe(true);
    expect(fit.lineRight).toBeLessThanOrEqual(PHONE.width);
    expect(fit.lineLeft).toBeGreaterThanOrEqual(0);
    expect(fit.page).toBeLessThanOrEqual(PHONE.width);
    await page.screenshot({ path: 'test-results/h10-hive-sheet.png' });
    // The map label carries the count while below the caps, inside the canvas.
    const lab = await label(page);
    expect(lab, 'the hive label was drawn').not.toBeNull();
    expect(lab!.text).toBe(`HIVE ${h0.total}/${h0.totalCap}`);
    const canvas = (await page.locator('#view').boundingBox())!;
    expect(lab!.x).toBeGreaterThanOrEqual(0);
    expect(lab!.x + lab!.w, 'the label stays inside the map').toBeLessThanOrEqual(canvas.width + 0.5);
    expect(await hudBoxes(page), 'the line and the label shift nothing in the HUD').toBe(hud0);
    // The countdown moves with the sim (60 ticks later it reads two seconds less, or the next guard's).
    await step(page, 60);
    await settled(page);
    const h1 = await hive(page);
    await expect(line).toHaveText(h1.total >= h1.totalCap ? `Guards ${h1.total} / ${h1.totalCap}` : text(h1));
    // Stepped on until full: "Guards 30 / 30", the label drops its count.
    for (let i = 0; i < 400 && (await hive(page)).total < (await hive(page)).totalCap; i++) await step(page, 60);
    const full = await hive(page);
    expect(full.total).toBe(full.totalCap);
    await settled(page);
    await expect(line).toHaveText(`Guards ${full.totalCap} / ${full.totalCap}`);
    expect((await label(page))!.text).toBe('HIVE');
    expect(await hudBoxes(page), 'a full hive shifts nothing either').toBe(hud0);
  });

  test('with hive.rebuildTicks set to 0 the hive sheet has no guard line and keeps its regrow rows', async ({ page }) => {
    await ready(page);
    await tune(page, 'hive.rebuildTicks', 0);
    const heart = await page.evaluate(() => window.__factory4x!.nodeIndex('heart'));
    await openNode(page, heart);
    await expect(page.locator('#sheet .hive-guards')).toBeHidden();
    await expect(page.locator('#sheet .gr-regrow:visible').first()).toBeVisible();
  });

  test('a raid report says "Hive −N" for the raiders it lost at the rocks; a push at the hive says "Hive n / cap"', async ({ page }) => {
    test.setTimeout(120_000);
    await ready(page);
    await beatenRaid(page);
    await settled(page);
    const t = await toastText(page);
    expect(t, 'the raid report names the hive loss').toMatch(/Raid beaten at A\d: \d+ killed, \d+ lost · Hive\s−\d+/);
    const killed = Number(/(\d+) killed/.exec(t)![1]);
    expect(Number(/Hive\s−(\d+)/.exec(t)![1]), 'Hive −N is the raiders killed').toBe(killed);
    // A push at the hive: its battle report ends with what is left of it.
    await page.locator('#toast').click();
    await tune(page, 'raid.enabled', 0);
    const heart = await page.evaluate(() => window.__factory4x!.nodeIndex('heart'));
    await page.evaluate((n) => window.__factory4x!.debugParkShips(n, { drone: 8, lancer: 3 }), heart);
    for (let i = 0; i < 400 && !/Hive held|Wave withdrew/.test(await toastText(page)); i++) await step(page, 15);
    const report = await toastText(page);
    expect(report).toMatch(/Hive held|Wave withdrew/);
    const left = await hive(page);
    expect(report, 'the report ends with the hive as it is').toMatch(new RegExp(`Hive ${left.total} / ${left.totalCap}$`));
    const tb = (await page.locator('#toast').boundingBox())!;
    expect(tb.x + tb.width).toBeLessThanOrEqual(PHONE.width);
  });

  test('the result panel lists the two hive loss totals', async ({ page }) => {
    test.setTimeout(120_000);
    await ready(page);
    await tune(page, 'raid.enabled', 0);
    const heart = await page.evaluate(() => window.__factory4x!.nodeIndex('heart'));
    await page.evaluate((n) => window.__factory4x!.debugParkShips(n, { drone: 60, lancer: 40, flak: 10 }), heart);
    await stepSimUntil(page, async () => !(await page.locator('#result').isHidden()), 6000, 'the hive falling', false);
    await expect(page.locator('#result')).toContainText('Hive −, raiders killed at rocks');
    await expect(page.locator('#result')).toContainText('Hive −, guards killed in pushes');
    const fit = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(fit).toBeLessThanOrEqual(PHONE.width);
  });

  test('the tuning panel lists the new keys, tags client.raidSlowdown "this device" and describes hive.regrowPct', async ({ page }) => {
    await ready(page);
    await page.locator('#b-tune').click();
    const row = (key: string) => page.locator('#tuning .t-row', { has: page.locator(`input[aria-label="${key}"]`) });
    await expect(row('client.raidSlowdown')).toContainText('this device');
    await expect(row('hive.rebuildTicks')).toBeAttached();
    await expect(row('raid.rollMax')).toBeAttached();
    await expect(row('hive.regrowPct')).toContainText('only when Hive rebuild is 0');
  });
});

test.describe('375x667 portrait, the roll banner', () => {
  test.use({ viewport: PHONE });

  test('at raid.rollMax 1 a prong that hit a rock reads "A5 hit → A6" while it flies on, its badge moves on the roll tick, and the HUD does not move', async ({ page }) => {
    test.setTimeout(180_000);
    await ready(page);
    await tune(page, 'raid.enabled', 0);
    await tune(page, 'raid.firstAtEcon', 2);
    await tune(page, 'raid.musterTicks', 60);
    await tune(page, 'raid.prongsMax', 1);
    await tune(page, 'raid.rollMax', 1);
    const nodes = await page.evaluate((l) => l.map((i) => window.__factory4x!.nodeIndex(i)), IDS);
    const ranked = async (): Promise<number> =>
      (await Promise.all(nodes.map(async (n) => (JSON.parse(await page.evaluate((k) => window.__factory4x!.rockStatus(k), n)) as { raidRank: number }).raidRank))).filter((x) => x > 0).length;
    await stepSimUntil(page, async () => (await ranked()) >= 2 && (await raid(page)).econ >= 6, 30_000, 'economy ships on two raidable rocks', false);
    await tune(page, 'raid.enabled', 1);
    await until(page, (r) => r.phase === 'muster', 'the muster', 3000);
    const hud0 = await hudBoxes(page);
    const badges = async (): Promise<number[]> => JSON.parse(await page.evaluate(() => window.__factory4x!.raidBadges())) as number[];
    const name = (n: number): string => IDS[nodes.indexOf(n)]!.toUpperCase();
    // One tick at a time until a prong has rolled (it hit, then flies on to the next rock).
    let r: Raid;
    let from: Prong | null = null;
    for (let i = 0; i < 6000; i++) {
      await step(page, 1);
      r = await raid(page);
      if (r.phase === 'none') break;
      if (r.prongs.some((p) => p.rolls > 0 && p.phase === 'out')) {
        from = r.prongs.find((p) => p.rolls > 0)!;
        break;
      }
    }
    expect(from, 'a prong rolled on (it hit a rock and another was raidable)').not.toBeNull();
    await settled(page);
    const p = from!;
    const banner = page.locator('#banner .bline.raid');
    await expect(banner).toHaveText(`Raid ${name(p.rolledFrom!)} hit → ${name(p.target)}`);
    expect(await badges(), 'the badge is on the new target on the roll tick').toEqual([p.target]);
    const lines = await banner.evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)));
    expect(lines, 'two lines of room under the wide font').toBe(2);
    const bb = (await page.locator('#banner').boundingBox())!;
    expect(bb.x + bb.width).toBeLessThanOrEqual(PHONE.width);
    expect(await hudBoxes(page), 'the roll segment shifts nothing in the HUD').toBe(hud0);
    await page.screenshot({ path: 'test-results/h10-roll-banner.png' });
    // It arrives and fights at the new rock: the segment gives way to the fight line.
    await until(page, (x) => x.phase === 'fight' || x.phase === 'none', 'the second fight', 3000);
    if ((await raid(page)).phase === 'fight') await expect(banner).toHaveText(new RegExp(`^Raid at ${name(p.target)}: \\d+ left`));
    expect(await hudBoxes(page)).toBe(hud0);
  });
});

type Box = { x: number; y: number; w: number; h: number };
const apart = (a: Box, b: Box): boolean => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;

for (const [what, size] of [
  ['375x667 with the wide font', PHONE],
  ['desktop 1280x800', { width: 1280, height: 800 }],
] as const) {
  test.describe(`the hive label is clear, ${what}`, () => {
    test.use({ viewport: size });

    test('below its caps, with the sheet open or closed, the hive label overlaps no other label and not the hive itself, and stays inside the map', async ({ page }) => {
      test.setTimeout(120_000);
      await ready(page, size);
      await beatenRaid(page);
      const heart = await page.evaluate(() => window.__factory4x!.nodeIndex('heart'));
      const h0 = await hive(page);
      expect(h0.total).toBeLessThan(h0.totalCap);
      const check = async (state: string): Promise<void> => {
        await settled(page);
        const labels = JSON.parse(await page.evaluate(() => window.__factory4x!.nodeLabels())) as Array<Box & { text: string }>;
        const mine = labels.find((l) => /^HIVE \d+\/\d+$/.test(l.text));
        expect(mine, `${state}: the hive label carries its count`).toBeDefined();
        expect(labels.some((l) => l.text === 'P1'), 'the P1 label was drawn').toBe(true);
        expect(labels.some((l) => l.text === 'P2'), 'the P2 label was drawn').toBe(true);
        for (const o of labels) if (o !== mine) expect(apart(mine!, o), `${state}: the hive label is clear of ${o.text}`).toBe(true);
        // The hive itself: its centre is well outside the label box (the node is more than 20 px across).
        const c = await page.evaluate((n) => window.__factory4x!.nodeScreenPos(n), heart);
        const cv = (await page.locator('#view').boundingBox())!;
        const cx = c.x - cv.x;
        const cy = c.y - cv.y;
        const nx = Math.min(Math.max(cx, mine!.x), mine!.x + mine!.w);
        const ny = Math.min(Math.max(cy, mine!.y), mine!.y + mine!.h);
        expect(Math.hypot(nx - cx, ny - cy), `${state}: the label is clear of the hive marker`).toBeGreaterThan(20);
        expect(mine!.x).toBeGreaterThanOrEqual(0);
        expect(mine!.y).toBeGreaterThanOrEqual(0);
        expect(mine!.x + mine!.w).toBeLessThanOrEqual(cv.width + 0.5);
        expect(mine!.y + mine!.h).toBeLessThanOrEqual(cv.height + 0.5);
      };
      await check('sheet closed');
      await openNode(page, heart);
      await check('hive sheet open');
      await page.screenshot({ path: `test-results/h10-hive-label-${size.width}.png` });
    });
  });
}

test.describe('375x667 portrait, shipped data (v18), nothing set in the test', () => {
  test.use({ viewport: PHONE });

  test('a passive run at 4x reaches its first raid: the game drops to 1x with the toast; every prong is beaten; the hive readout, label and "Hive −N" show; 4x comes back', async ({ page }) => {
    test.setTimeout(180_000);
    await ready(page);
    expect(await page.evaluate(() => JSON.parse(window.__factory4x!.hiveStatus()).rebuild !== null), 'the shipped hive rebuilds').toBe(true);
    await page.evaluate(() => window.__factory4x!.setSpeed(4));
    await stepSimUntil(page, async () => (await raid(page)).phase === 'muster', 60_000, 'the first raid', false);
    await settled(page);
    expect(await page.evaluate(() => Number(document.querySelector<HTMLElement>('.speed.on')?.dataset.speed)), 'the raid dropped the game to 1x').toBe(1);
    expect(await toastText(page)).toContain('1x for the raid · back to 4x after');
    const hud0 = await hudBoxes(page);
    // Every prong's rock gets a guard that beats it, so the hive loses the raiders it sent.
    const m = await raid(page);
    for (const p of m.prongs) await page.evaluate((n) => window.__factory4x!.debugParkShips(n, { drone: 12, lancer: 4 }), p.target);
    await until(page, (r) => r.phase === 'none' && r.last !== null, 'the raid over', 12_000);
    await settled(page);
    expect((await raid(page)).last!.outcome).toBe('beaten');
    expect(await page.evaluate(() => Number(document.querySelector<HTMLElement>('.speed.on')?.dataset.speed)), 'the outcome gave 4x back').toBe(4);
    expect(await toastText(page)).toMatch(/Hive\s−\d+/);
    // The hive sheet: the line and the countdown.
    const h0 = await hive(page);
    expect(h0.total).toBeLessThan(h0.totalCap);
    const heart = await page.evaluate(() => window.__factory4x!.nodeIndex('heart'));
    await openNode(page, heart);
    const line = page.locator('#sheet .hive-guards');
    await expect(line).toHaveText(/^Guards \d+ \/ \d+ · \+1 (Thorn|Spore) in \d+ s$/);
    await expect(line).toHaveText(`Guards ${h0.total} / ${h0.totalCap} · +1 ${h0.rebuild!.nextType === 'thorn' ? 'Thorn' : 'Spore'} in ${Math.ceil((h0.rebuild!.ticks - h0.rebuild!.progress) / 30)} s`);
    await step(page, 60);
    await settled(page);
    const h1 = await hive(page);
    await expect(line).toHaveText(h1.total >= h1.totalCap ? `Guards ${h1.total} / ${h1.totalCap}` : /^Guards \d+ \/ \d+ · \+1 (Thorn|Spore) in \d+ s$/);
    await page.screenshot({ path: 'test-results/h10-shipped-hive.png' });
    // The map label and its placement.
    const labels = JSON.parse(await page.evaluate(() => window.__factory4x!.nodeLabels())) as Array<Box & { text: string }>;
    const mine = labels.find((l) => /^HIVE \d+\/\d+$/.test(l.text));
    expect(mine, 'the hive label carries its count').toBeDefined();
    for (const o of labels) if (o !== mine) expect(apart(mine!, o), `the hive label is clear of ${o.text}`).toBe(true);
    expect(await hudBoxes(page), 'nothing in the HUD moved').toBe(hud0);
  });

  test('the tuning panel describes hive.regrowPct, and hive.rebuildTicks shows its shipped 600', async ({ page }) => {
    await ready(page);
    await page.locator('#b-tune').click();
    const row = (key: string) => page.locator('#tuning .t-row', { has: page.locator(`input[aria-label="${key}"]`) });
    await expect(row('hive.regrowPct')).toContainText('only when Hive rebuild is 0');
    await expect(page.locator('#tuning input[aria-label="hive.rebuildTicks"]')).toHaveValue('600');
    await expect(row('client.raidSlowdown')).toContainText('this device');
  });
});
