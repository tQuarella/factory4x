import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectControlsFit, settled } from './helpers.ts';

/**
 * H7 client, the economy part: a run lands in the field, the probe sheet (radar and five rows), the rock sheet (Mine / Stop), the map's
 * economy, the tuning panel and the result panel. Every layout assertion runs with a wide font forced on the elements under test, so a
 * layout that only fits this machine's fonts fails here too. Taps are made once; a tap that did nothing fails the test.
 */

const WIDE_FONT =
  '#sheet *, #sendpanel *, #recyclepanel *, #result *, #chips *, #controls *, #tuning *, #feedback *, .card *, #banner, #toast, #hint { font-family: serif !important; font-size: 15px !important; letter-spacing: 0.15em !important; line-height: 1.5 !important; }';

const PHONE = { width: 375, height: 667 };

async function ready(page: Page, size: { width: number; height: number } | null = null, wide = true): Promise<void> {
  if (size) await page.setViewportSize(size);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  if (wide) await page.addStyleTag({ content: WIDE_FONT });
  await settled(page);
}

/** A tap at a viewport point: by touch on the phone project, by mouse on the desktop one. */
async function tapAt(page: Page, x: number, y: number): Promise<void> {
  if (test.info().project.name === 'phone') await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Taps an element once, at its centre (by touch on the phone project). */
async function tap(page: Page, loc: Locator): Promise<void> {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  expect(b, 'the element to tap is on screen').not.toBeNull();
  await tapAt(page, b!.x + b!.width / 2, b!.y + b!.height / 2);
}

/** Taps a node once, after the map has settled, and checks its sheet opened. */
async function tapNode(page: Page, id: string): Promise<number> {
  const node = await page.evaluate((i) => window.__factory4x!.nodeIndex(i), id);
  expect(node, `node ${id} exists`).toBeGreaterThanOrEqual(0);
  await settled(page);
  const p = await page.evaluate((i) => window.__factory4x!.nodeScreenPos(i), node);
  const onCanvas = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.id === 'view', [p.x, p.y]);
  expect(onCanvas, `the canvas is under node ${id}`).toBe(true);
  await tapAt(page, p.x, p.y);
  expect(await page.evaluate(() => window.__factory4x!.selected()), `the tap on ${id} opened its sheet`).toBe(node);
  return node;
}

async function pause(page: Page): Promise<void> {
  await page.locator('#b-pause').click();
  expect(await page.evaluate(() => window.__factory4x!.paused())).toBe(true);
}

/** Sets a sim tunable through the tuning panel, as a player would (and so through the input log). */
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

interface Alloc {
  rows: Array<{ type: string; weight: number; share: number; state: string; building: number }>;
  maxWeight: number;
  stockOre: number;
}
const alloc = async (page: Page): Promise<Alloc> => JSON.parse(await page.evaluate(() => window.__factory4x!.allocStatus())) as Alloc;
interface Rock {
  mine: boolean;
  docked: number;
  bound: number;
  inFlight: number;
  haulers: number;
  buffer: number;
  backedUp: boolean;
  slots: number;
}
const rock = async (page: Page, node: number): Promise<Rock> => JSON.parse(await page.evaluate((n) => window.__factory4x!.rockStatus(n), node)) as Rock;
const inputs = async (page: Page): Promise<Array<Record<string, unknown>>> => JSON.parse(await page.evaluate(() => window.__factory4x!.log())) as Array<Record<string, unknown>>;

test('acceptance 1: a run opens in the field and runs; no overworld, research or withdraw is reachable; New run is the only restart', async ({ page }) => {
  await ready(page);
  expect(await page.evaluate(() => window.__factory4x!.isField())).toBe(true);
  expect(await page.evaluate(() => window.__factory4x!.onOverworld())).toBe(false);
  expect(await page.evaluate(() => window.__factory4x!.activeArea())).toBeNull();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.tick()), { message: 'the field ticks from the first second' }).toBeGreaterThan(10);
  await expect(page.locator('#b-world')).toBeHidden();
  await expect(page.locator('#b-research')).toBeHidden();
  await expect(page.locator('#ow-stats')).toBeHidden();
  await expect(page.locator('#thr')).toBeVisible();
  await expect(page.locator('#hint-text')).toContainText('mine and haul on their own');
  // The first ships are economy ships: after a while the economy has ships and no warship exists.
  await expect.poll(async () => JSON.parse(await page.evaluate(() => window.__factory4x!.econShips())).length, { timeout: 20_000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__factory4x!.wavesSent())).toBe(0);
  expect((await alloc(page)).rows.filter((r) => r.type !== 'extractor' && r.type !== 'hauler').map((r) => r.weight)).toEqual([0, 0, 0]);
});

test('acceptance 1: the tuning panel shows the H7 keys, hides the parked ones, and says New run', async ({ page }) => {
  await ready(page);
  await page.locator('#b-tune').click();
  const keys = await page.locator('#tuning input').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  for (const k of ['alloc.maxWeight', 'ship.extractor.cost', 'ship.hauler.cargo', 'field.fleetCap', 'fleet.countsEconomy', 'raid.enabled', 'raid.firstAtEcon', 'hive.regrowPct', 'economy.startStock']) {
    expect(keys, k).toContain(k);
  }
  for (const k of ['extractor.cost', 'route.podOreForLevel', 'research.opening.cost', 'fleet.cap', 'fleet.relayStep', 'overworld.bandLock', 'system.variant', 'build.queueMax']) {
    expect(keys, `${k} is parked in field mode`).not.toContain(k);
  }
  expect(keys.filter((k) => k !== null && /^(route|component|research|bloom\.starved)/.test(k))).toEqual([]);
  await expect(page.locator('#tuning button', { hasText: 'New run…' })).toBeVisible();
  await expect(page.locator('#tuning button', { hasText: 'New system' })).toHaveCount(0);
  await expect(page.locator('#tuning')).not.toContainText('New system');
});

test('acceptance 1: New run asks first, keeps the tuning and starts a fresh field', async ({ page }) => {
  await ready(page);
  await tune(page, 'economy.startStock', 90);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.tick())).toBeGreaterThan(30);
  const seedBefore = await page.evaluate(() => window.__factory4x!.tick());
  await page.locator('#b-tune').click();
  await page.locator('#tuning button', { hasText: 'New run…' }).click();
  await expect(page.locator('.modal .card')).toContainText('new run');
  // Keep playing leaves the run alone.
  await page.locator('.modal .card button', { hasText: 'Keep playing' }).click();
  expect(await page.evaluate(() => window.__factory4x!.tick())).toBeGreaterThanOrEqual(seedBefore);
  await page.locator('#tuning button', { hasText: 'New run…' }).click();
  await page.locator('.modal .card button', { hasText: 'Yes, new run' }).click();
  await expect(page.locator('#tuning')).toBeHidden();
  expect(await page.evaluate(() => window.__factory4x!.tick())).toBeLessThan(seedBefore);
  expect(await page.evaluate(() => window.__factory4x!.isField())).toBe(true);
  await page.locator('#b-tune').click();
  await expect(page.locator('#tuning input[aria-label="economy.startStock"]')).toHaveValue('90');
});

test('acceptance 1: the result panel shows the run and offers New run', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => window.__factory4x!.debugShowResult());
  const card = page.locator('#result .card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('The hive has fallen');
  for (const t of ['Time to the hive', 'Peak ore/min', 'Ships built', 'Ships lost', 'Raids', 'Economy ships lost to raids', 'Weight changes']) await expect(card).toContainText(t);
  await expect(card.locator('button', { hasText: 'New run' })).toBeVisible();
  await expect(card.locator('button', { hasText: 'Keep playing' })).toBeVisible();
  await expectControlsFit(page, '#result', 'the result panel fits');
  await card.locator('button', { hasText: 'New run' }).click();
  await page.locator('.modal .card button', { hasText: 'Yes, new run' }).click();
  await expect(page.locator('#result')).toBeHidden();
  expect(await page.evaluate(() => window.__factory4x!.tick())).toBeLessThan(60);
});

test.describe('375x667 portrait, by touch', () => {
  test.use({ viewport: PHONE });

  test('acceptance 2: the probe sheet, radar and five rows, fits without scrolling under a wide font; + and − change the weights through the input log', async ({ page }) => {
    await ready(page, PHONE);
    await pause(page);
    await tapNode(page, 'probe');
    const sheet = page.locator('#sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.fp-row')).toHaveCount(5);
    await expect(sheet.locator('canvas.fp-radar')).toBeVisible();
    // Fits: no scrolling inside the sheet, nothing sticks out, every control is at least 44 px.
    const fit = await page.evaluate(() => {
      const e = document.getElementById('sheet')!;
      const r = e.getBoundingClientRect();
      return { scroll: e.scrollHeight, client: e.clientHeight, bottom: r.bottom, vh: window.innerHeight, over: document.documentElement.scrollWidth > window.innerWidth };
    });
    expect(fit.scroll, 'the probe sheet needs no scrolling').toBeLessThanOrEqual(fit.client + 1);
    expect(fit.bottom).toBeLessThanOrEqual(fit.vh + 1);
    expect(fit.over).toBe(false);
    await expectControlsFit(page, '#sheet', 'the probe sheet controls');
    // Each row's buttons are 44 px or more, and the radar's box is inside the sheet.
    const steps = await sheet.locator('.fp-step').evaluateAll((els) => els.map((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]));
    expect(steps).toHaveLength(10);
    for (const [w, h] of steps) {
      expect(w).toBeGreaterThanOrEqual(43.5);
      expect(h).toBeGreaterThanOrEqual(43.5);
    }
    const radarBox = await sheet.locator('canvas.fp-radar').boundingBox();
    expect(radarBox!.x).toBeGreaterThanOrEqual(0);
    expect(radarBox!.x + radarBox!.width).toBeLessThanOrEqual(PHONE.width);
    // The radar is display only: a tap on it does nothing.
    const before = await inputs(page);
    await tapAt(page, radarBox!.x + radarBox!.width / 2, radarBox!.y + radarBox!.height / 2);
    expect(await inputs(page)).toEqual(before);

    // + on the drone: one setAlloc, the weight and the radar follow.
    const drone = sheet.locator('.fp-row[data-type="drone"]');
    const radarBefore = await sheet.locator('canvas.fp-radar').getAttribute('aria-label');
    await tap(page, drone.locator('.fp-step', { hasText: '+' }));
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setAlloc', shipType: 'drone', weight: 1 });
    await expect(drone.locator('.fp-w')).toHaveText('1');
    await expect(sheet.locator('canvas.fp-radar')).toHaveAttribute('aria-label', /Drone 1/);
    expect(await sheet.locator('canvas.fp-radar').getAttribute('aria-label')).not.toBe(radarBefore);
    expect((await alloc(page)).rows.find((r) => r.type === 'drone')!.weight).toBe(1);
    // − takes it back to 0, and − is then disabled.
    await tap(page, drone.locator('.fp-step', { hasText: '−' }));
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setAlloc', shipType: 'drone', weight: 0 });
    await expect(drone.locator('.fp-w')).toHaveText('0');
    await expect(drone.locator('.fp-step', { hasText: '−' })).toBeDisabled();
    await expect(sheet.locator('canvas.fp-radar')).toHaveAttribute('aria-label', /Drone 0/);
    // + stops at the top of the scale.
    const max = (await alloc(page)).maxWeight;
    for (let i = 0; i < max; i++) await tap(page, drone.locator('.fp-step', { hasText: '+' }));
    await expect(drone.locator('.fp-w')).toHaveText(String(max));
    await expect(drone.locator('.fp-step', { hasText: '+' })).toBeDisabled();
    expect(await inputs(page)).toHaveLength(before.length + 2 + max);
  });

  test('acceptance 2: each row states what it is doing: off, saving, building, needs crystal, fleet full', async ({ page }) => {
    await ready(page, PHONE);
    await tapNode(page, 'probe');
    const sheet = page.locator('#sheet');
    const state = (type: string) => sheet.locator(`.fp-row[data-type="${type}"] .fp-state`);
    await expect(state('drone')).toHaveText('off');
    await expect(state('extractor')).toHaveText(/^(saving \d+\/20|building \d+%)$/);
    // A Lancer with a weight but no crystal yet says what it needs.
    await tap(page, sheet.locator('.fp-row[data-type="lancer"] .fp-step', { hasText: '+' }));
    await expect(state('lancer')).toHaveText('needs crystal: take the crystal pocket');
    await tap(page, sheet.locator('.fp-row[data-type="flak"] .fp-step', { hasText: '+' }));
    await expect(state('flak')).toHaveText('needs ice: take the ice pocket');
    await expect(state('flak')).toHaveCSS('color', 'rgb(255, 210, 122)');
    // The extractor bay builds: its line reads building N% at some point in the first minute.
    await page.evaluate(() => window.__factory4x!.setSpeed(4));
    await expect(state('extractor')).toHaveText(/^building \d+%$/, { timeout: 30_000 });
    await expectControlsFit(page, '#sheet', 'the state lines fit');
    // Fleet full: cap the fleet at the ships already out, and the next start waits.
    const n = JSON.parse(await page.evaluate(() => window.__factory4x!.econShips())).length;
    await tap(page, page.locator('#sheet .close'));
    await tune(page, 'field.fleetCap', Math.max(1, n));
    await tapNode(page, 'probe');
    await expect(sheet.locator('.fp-state', { hasText: 'fleet full' }).first()).toBeVisible({ timeout: 60_000 });
  });

  test('acceptance 3: the rock sheet: Stop takes the extractors off the rock, Mine puts them back; pips, haulers, buffer and delivered read from the status', async ({ page }) => {
    await ready(page, PHONE);
    await page.evaluate(() => window.__factory4x!.setSpeed(4));
    const a1 = await page.evaluate(() => window.__factory4x!.nodeIndex('a1'));
    await expect.poll(async () => (await rock(page, a1)).docked, { timeout: 60_000, message: 'an extractor docks at the nearest rock' }).toBeGreaterThan(0);
    await pause(page);
    await tapNode(page, 'a1');
    const sheet = page.locator('#sheet');
    await expect(sheet.locator('.mine-btn')).toHaveText('Stop mining');
    const st = await rock(page, a1);
    await expect(sheet.locator('.pips .pip')).toHaveCount(st.slots);
    await expect(sheet.locator('.pips .pip.on')).toHaveCount(st.docked);
    await expect(sheet.locator('.pip-text')).toContainText(`${st.docked}/${st.slots}`);
    await expect(sheet.locator('.pips .pip.queued')).toHaveCount(st.inFlight);
    await expect(sheet.getByText('Haulers')).toBeVisible();
    await expect(sheet.getByText('Buffer')).toBeVisible();
    await expect(sheet.getByText('Delivered')).toBeVisible();
    await expectControlsFit(page, '#sheet', 'the rock sheet controls');
    expect(await page.evaluate(() => JSON.parse(window.__factory4x!.mapField()).mine)).toContain(a1);

    await tap(page, sheet.locator('.mine-btn'));
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setMine', node: a1, on: false });
    // Paused, the input stepped one tick: the extractors are already unbound.
    const off = await rock(page, a1);
    expect(off.mine).toBe(false);
    expect(off.bound).toBe(0);
    await expect(sheet.locator('.mine-btn')).toHaveText('Mine this rock');
    await expect(sheet.locator('.pips .pip.on')).toHaveCount(0);
    // They leave: running, none of them is docked at a1 any more.
    await page.locator('#b-pause').click();
    await expect.poll(async () => (await rock(page, a1)).docked, { timeout: 20_000 }).toBe(0);
    expect(await page.evaluate(() => JSON.parse(window.__factory4x!.mapField()).mine)).not.toContain(a1);
    await pause(page);
    await tap(page, sheet.locator('.mine-btn'));
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setMine', node: a1, on: true });
    expect((await rock(page, a1)).mine).toBe(true);
    await expect(sheet.locator('.mine-btn')).toHaveText('Stop mining');
  });

  test('acceptance 3: a full buffer says "Backed up: add haulers" and holds its room; the note never moves the controls below it', async ({ page }) => {
    await ready(page, PHONE);
    await tune(page, 'node.bufferCap', 10);
    await tapNode(page, 'probe');
    // No haulers: switch the hauler weight to 0 so the buffers fill and stay full.
    const hauler = page.locator('#sheet .fp-row[data-type="hauler"]');
    const w = Number(await hauler.locator('.fp-w').textContent());
    for (let i = 0; i < w; i++) await tap(page, hauler.locator('.fp-step', { hasText: '−' }));
    await page.evaluate(() => window.__factory4x!.setSpeed(4));
    await tap(page, page.locator('#sheet .close'));
    const a1 = await page.evaluate(() => window.__factory4x!.nodeIndex('a1'));
    await expect.poll(async () => (await rock(page, a1)).backedUp, { timeout: 90_000 }).toBe(true);
    await tapNode(page, 'a1');
    const sheet = page.locator('#sheet');
    await expect(sheet.locator('.rock-note .backed')).toHaveText('Backed up: add haulers');
    const y1 = await sheet.locator('.rock .mine-btn').boundingBox();
    const rec = await sheet.locator('section.rock').evaluate((e) => e.getBoundingClientRect().height);
    expect(y1).not.toBeNull();
    // The reserved room is there with or without the note: the rock section's height is the same on a rock with no note.
    await tap(page, page.locator('#sheet .close'));
    const a7 = await page.evaluate(() => window.__factory4x!.nodeIndex('a7'));
    expect((await rock(page, a7)).backedUp).toBe(false);
    await tapNode(page, 'a7');
    expect(await sheet.locator('section.rock').evaluate((e) => e.getBoundingClientRect().height)).toBeCloseTo(rec, 0);
  });

  test('acceptance 5: the map draws the economy: docked extractors, haul lines, idle ships at the probe, and the Mine badge', async ({ page }) => {
    await ready(page, PHONE);
    await page.evaluate(() => window.__factory4x!.setSpeed(4));
    const map = async (): Promise<{ mine: number[]; haul: Array<[number, number]>; econ: { docked: number; idle: number; waiting: number; moving: number } }> =>
      JSON.parse(await page.evaluate(() => window.__factory4x!.mapField()));
    // The six near rocks and a5, a6 and a7 are marked at the start: seven asteroids wear the badge, the pockets and hive do not.
    const m0 = await map();
    const marked = await page.evaluate(() => ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'].map((id) => window.__factory4x!.nodeIndex(id)));
    expect([...m0.mine].sort((a, b) => a - b)).toEqual([...marked].sort((a, b) => a - b));
    await expect.poll(async () => (await map()).econ.docked, { timeout: 60_000 }).toBeGreaterThan(0);
    await expect.poll(async () => (await map()).haul.length, { timeout: 90_000, message: 'a rock with haulers gets its line' }).toBeGreaterThan(0);
    for (const [, level] of (await map()).haul) expect(level).toBeGreaterThanOrEqual(1);
    // Stop every rock: nothing to mine, so the extractors come home and idle at the probe, and every badge goes.
    await pause(page);
    await page.evaluate(() => window.__factory4x!.nodeIndex('a1'));
    for (const id of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']) {
      const node = await tapNode(page, id);
      await tap(page, page.locator('#sheet .mine-btn'));
      await tap(page, page.locator('#sheet .close'));
      expect((await rock(page, node)).mine).toBe(false);
    }
    await page.locator('#b-pause').click();
    await expect.poll(async () => (await map()).econ.idle, { timeout: 60_000 }).toBeGreaterThan(0);
    expect((await map()).mine).toEqual([]);
  });

  test('the top bar holds still: the field HUD fits 375 px under a wide font, with the fleet chip and no per-type ship chips', async ({ page }) => {
    await ready(page, PHONE);
    await page.evaluate(() => window.__factory4x!.setSpeed(4));
    await expect(page.locator('#chip-fleet')).toBeVisible();
    await expect(page.locator('#chip-fleet')).toContainText(/Fleet \d+\/\d+/);
    for (const t of ['drone', 'lancer', 'flak', 'lens', 'plating']) await expect(page.locator(`#chip-${t}`)).toBeHidden();
    const boxes: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(400);
      boxes.push(
        await page.evaluate(() => {
          const r = (id: string): string => {
            const b = document.getElementById(id)!.getBoundingClientRect();
            return `${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)},${Math.round(b.height)}`;
          };
          return ['bars', 'chip-ore', 'chip-fleet', 'controls'].map(r).join('|');
        }),
      );
    }
    expect(new Set(boxes).size, `the top bar moved: ${[...new Set(boxes)].join(' / ')}`).toBe(1);
    await expectControlsFit(page, '#bars', 'the top bar');
  });

  test('a recycle panel lists the economy ships parked at the probe', async ({ page }) => {
    await ready(page, PHONE);
    // Stop every rock so the first economy ships have nowhere to go and idle at the probe.
    await pause(page);
    for (const id of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']) {
      await tapNode(page, id);
      await tap(page, page.locator('#sheet .mine-btn'));
      await tap(page, page.locator('#sheet .close'));
    }
    await page.locator('#b-pause').click();
    await page.evaluate(() => window.__factory4x!.setSpeed(4));
    await expect.poll(async () => JSON.parse(await page.evaluate(() => window.__factory4x!.mapField())).econ.idle, { timeout: 60_000 }).toBeGreaterThan(0);
    await pause(page);
    await tapNode(page, 'probe');
    const recycle = page.locator('#sheet .recycle-btn');
    await expect(recycle).toBeVisible();
    await tap(page, recycle);
    const panel = page.locator('#recyclepanel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.sp-row[data-ship="extractor"]')).toBeVisible();
    await expect(panel.locator('.sp-row[data-ship="hauler"]')).toBeVisible();
    await expectControlsFit(page, '#recyclepanel', 'the recycle panel');
    const stock = await page.evaluate(() => window.__factory4x!.stock());
    await tap(page, panel.locator('.sp-row[data-ship="extractor"] .sp-all'));
    await tap(page, panel.locator('.primary'));
    expect((await inputs(page)).slice(-1)[0]!.type).toBe('recycleShips');
    expect(await page.evaluate(() => window.__factory4x!.stock())).toBeGreaterThan(stock);
  });
});
