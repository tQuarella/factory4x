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

/** Pauses (a no-op when already paused: the advanceTicks hook pauses). */
async function pause(page: Page): Promise<void> {
  if (!(await page.evaluate(() => window.__factory4x!.paused()))) await page.locator('#b-pause').click();
  expect(await page.evaluate(() => window.__factory4x!.paused())).toBe(true);
}

/**
 * Steps the sim 30 ticks at a time (the advanceTicks hook, which pauses) until `cond` holds, so a wait costs no wall-clock time and
 * a short state is never missed. Fails if it takes more than `cap` ticks.
 */
async function stepUntil(page: Page, cond: () => Promise<boolean>, cap = 9000, what = 'the state'): Promise<void> {
  for (let t = 0; t <= cap; t += 30) {
    if (await cond()) return;
    await page.evaluate(() => window.__factory4x!.advanceTicks(30));
  }
  throw new Error(`${what} was not reached in ${cap} ticks`);
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
  raidRank: number;
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
  await stepUntil(page, async () => JSON.parse(await page.evaluate(() => window.__factory4x!.econShips())).length > 0, 3000, 'the first economy ship');
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

test('acceptance 1: taking the hive opens the result panel once, from the real trigger, and New run starts a fresh field', async ({ page }) => {
  test.setTimeout(120_000);
  await ready(page, PHONE, false);
  // A small hive and a rich start, so a drone wave can take it: guards at the least the tuning allows, no raids, room for a big fleet.
  await tune(page, 'economy.startStock', 200);
  await tune(page, 'guard.capPct', 25);
  await tune(page, 'field.fleetCap', 80);
  await tune(page, 'raid.enabled', 0);
  await tune(page, 'ship.drone.cost', 5);
  await tune(page, 'ship.drone.buildTicks', 15);
  await page.locator('#b-tune').click();
  await page.locator('#tuning button', { hasText: 'New run…' }).click();
  await page.locator('.modal .card button', { hasText: 'Yes, new run' }).click();
  await pause(page);
  await tapNode(page, 'probe');
  const sheet = page.locator('#sheet');
  for (const type of ['extractor', 'hauler']) {
    const w = Number(await sheet.locator(`.fp-row[data-type="${type}"] .fp-w`).textContent());
    for (let i = 0; i < w; i++) await tap(page, sheet.locator(`.fp-row[data-type="${type}"] .fp-step`, { hasText: '−' }));
  }
  for (let i = 0; i < 5; i++) await tap(page, sheet.locator('.fp-row[data-type="drone"] .fp-step', { hasText: '+' }));
  await tap(page, sheet.locator('.close'));
  const captured = async (): Promise<number | null> => (JSON.parse(await page.evaluate(() => window.__factory4x!.fieldSummary())) as { capturedTick: number | null }).capturedTick;
  await expect(page.locator('#result')).toBeHidden();
  for (let wave = 0; wave < 8 && (await captured()) === null; wave++) {
    // Build up drones at the probe, then send them all at the hive.
    for (let i = 0; i < 60 && (await page.evaluate(() => window.__factory4x!.shipsAt(0))) < 20; i++) await page.evaluate(() => window.__factory4x!.advanceTicks(90));
    await tapNode(page, 'heart');
    await tap(page, page.locator('#sheet .send-btn', { hasText: 'Attack with all from Probe' }));
    await tap(page, page.locator('#sheet .close'));
    for (let i = 0; i < 80 && (await captured()) === null; i++) await page.evaluate(() => window.__factory4x!.advanceTicks(60));
  }
  expect(await captured(), 'the hive fell').not.toBeNull();
  // The real trigger (refreshUi seeing the capture) opened the panel.
  const card = page.locator('#result .card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('The hive has fallen');
  await expect(card.locator('button', { hasText: 'New run' })).toBeVisible();
  // Keep playing closes it, and it does not come back while the run goes on.
  await tap(page, card.locator('button', { hasText: 'Keep playing' }));
  await expect(page.locator('#result')).toBeHidden();
  for (let i = 0; i < 5; i++) await page.evaluate(() => window.__factory4x!.advanceTicks(60));
  await settled(page);
  await expect(page.locator('#result')).toBeHidden();
  // The win does not show the campaign's win panel.
  await expect(page.locator('#win')).toBeHidden();
  // A new run from the panel's own button: shown again on demand, New run asks, then the field restarts.
  await page.evaluate(() => window.__factory4x!.debugShowResult());
  await tap(page, page.locator('#result .card button', { hasText: 'New run' }));
  await tap(page, page.locator('.modal .card button', { hasText: 'Yes, new run' }));
  await expect(page.locator('#result')).toBeHidden();
  expect(await captured()).toBeNull();
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
    expect(radarBox!.height, 'the radar is the header: its box is no taller than 110 px').toBeLessThanOrEqual(110);
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

  for (const wide of [true, false]) {
    test(`acceptance 2: with ships parked at the probe, Recycle shown and the longest state lines, the probe sheet never scrolls and the map keeps its room (${wide ? 'wide font' : 'normal font'})`, async ({ page }) => {
      await ready(page, PHONE, wide);
      await pause(page);
      await tapNode(page, 'probe');
      const sheet = page.locator('#sheet');
      const plus = (type: string) => sheet.locator(`.fp-row[data-type="${type}"] .fp-step`, { hasText: '+' });
      // Drones at full weight, Lancer and Flak raised before their pockets are taken: the longest state lines.
      for (let i = 0; i < 5; i++) await tap(page, plus('drone'));
      await tap(page, plus('lancer'));
      await tap(page, plus('flak'));
      await expect(sheet.locator('.fp-row[data-type="lancer"] .fp-state')).toHaveText('needs crystal pocket');
      await expect(sheet.locator('.fp-row[data-type="flak"] .fp-state')).toHaveText('needs ice pocket');
      // Run until warships and economy ships are parked at the probe (the rally point), so Recycle shows.
      for (let i = 0; i < 40 && !(await sheet.locator('.recycle-btn').isVisible()); i++) await page.evaluate(() => window.__factory4x!.advanceTicks(60));
      await expect(sheet.locator('.recycle-btn')).toBeVisible();
      await settled(page);
      const fit = await page.evaluate(() => {
        const e = document.getElementById('sheet')!;
        return { scroll: e.scrollHeight, client: e.clientHeight, stage: document.getElementById('stage')!.clientHeight };
      });
      expect(fit.scroll, 'no scrolling in the probe sheet').toBeLessThanOrEqual(fit.client + 1);
      await expectControlsFit(page, '#sheet', 'the probe sheet controls');
      if (!wide) expect(fit.stage, 'the map keeps about 200 px behind the probe sheet').toBeGreaterThanOrEqual(195);
      // The probe and the hive are both on the map, and nothing of the sheet covers them.
      for (const id of ['probe', 'heart']) {
        const node = await page.evaluate((i) => window.__factory4x!.nodeIndex(i), id);
        const p = await page.evaluate((i) => window.__factory4x!.nodeScreenPos(i), node);
        const sheetTop = await page.evaluate(() => document.getElementById('sheet')!.getBoundingClientRect().top);
        expect(p.y, `${id} is above the sheet`).toBeLessThan(sheetTop);
        expect(p.y, `${id} is on the screen`).toBeGreaterThan(0);
      }
    });
  }

  test('acceptance 2: each row states what it is doing: off, saving, building, needs crystal, fleet full', async ({ page }) => {
    await ready(page, PHONE);
    await tapNode(page, 'probe');
    const sheet = page.locator('#sheet');
    const state = (type: string) => sheet.locator(`.fp-row[data-type="${type}"] .fp-state`);
    await expect(state('drone')).toHaveText('off');
    await expect(state('extractor')).toHaveText(/^(saving \d+\/20|building \d+%)$/);
    // A Lancer with a weight but no crystal yet says what it needs.
    await tap(page, sheet.locator('.fp-row[data-type="lancer"] .fp-step', { hasText: '+' }));
    await expect(state('lancer')).toHaveText('needs crystal pocket');
    await tap(page, sheet.locator('.fp-row[data-type="flak"] .fp-step', { hasText: '+' }));
    await expect(state('flak')).toHaveText('needs ice pocket');
    await expect(state('flak')).toHaveCSS('color', 'rgb(255, 210, 122)');
    // The extractor bay builds: its line reads building N% at some point in the first minute.
    await stepUntil(page, async () => /^building \d+%$/.test((await state('extractor').textContent()) ?? ''), 3000, 'the extractor bay building');
    await expectControlsFit(page, '#sheet', 'the state lines fit');
    // Fleet full: cap the fleet at the ships already out, and the next start waits.
    const n = JSON.parse(await page.evaluate(() => window.__factory4x!.econShips())).length;
    await tap(page, page.locator('#sheet .close'));
    await tune(page, 'field.fleetCap', Math.max(1, n));
    await tapNode(page, 'probe');
    await stepUntil(page, async () => (await sheet.locator('.fp-state', { hasText: 'fleet full' }).count()) > 0, 6000, 'fleet full');
    await expect(sheet.locator('.fp-state', { hasText: 'fleet full' }).first()).toBeVisible();
  });

  test('acceptance 3: the rock sheet: Stop takes the extractors off the rock, Mine puts them back; pips, haulers, buffer and delivered read from the status', async ({ page }) => {
    await ready(page, PHONE);
    const a1 = await page.evaluate(() => window.__factory4x!.nodeIndex('a1'));
    await stepUntil(page, async () => (await rock(page, a1)).docked > 0, 6000, 'an extractor docked at the nearest rock');
    await pause(page);
    await tapNode(page, 'a1');
    const sheet = page.locator('#sheet');
    await expect(sheet.locator('.mine-btn')).toHaveText('Stop mining');
    const st = await rock(page, a1);
    await expect(sheet.locator('.pips .pip')).toHaveCount(st.slots);
    await expect(sheet.locator('.pips .pip.on')).toHaveCount(st.docked);
    await expect(sheet.locator('.pip-text')).toContainText(`${st.docked}/${st.slots}`);
    await expect(sheet.locator('.pips .pip.queued')).toHaveCount(st.inFlight);
    await expect(sheet.locator('.lbl', { hasText: 'Haulers' })).toBeVisible();
    await expect(sheet.locator('.lbl', { hasText: 'Buffer' })).toBeVisible();
    await expect(sheet.locator('.lbl', { hasText: 'Delivered' })).toBeVisible();
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
    await stepUntil(page, async () => (await rock(page, a1)).docked === 0, 3000, 'the extractors off the rock');
    await settled(page);
    expect(await page.evaluate(() => JSON.parse(window.__factory4x!.mapField()).mine)).not.toContain(a1);
    await tap(page, sheet.locator('.mine-btn'));
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setMine', node: a1, on: true });
    expect((await rock(page, a1)).mine).toBe(true);
    await expect(sheet.locator('.mine-btn')).toHaveText('Stop mining');
  });

  test('acceptance 3: a full buffer says "Backed up: add haulers" and holds its room; the note never moves the controls below it', async ({ page }) => {
    await ready(page, PHONE);
    await pause(page);
    await tune(page, 'node.bufferCap', 10);
    await tapNode(page, 'probe');
    // No haulers: switch the hauler weight to 0 so the buffers fill and stay full.
    const hauler = page.locator('#sheet .fp-row[data-type="hauler"]');
    const w = Number(await hauler.locator('.fp-w').textContent());
    for (let i = 0; i < w; i++) await tap(page, hauler.locator('.fp-step', { hasText: '−' }));
    await tap(page, page.locator('#sheet .close'));
    const a1 = await page.evaluate(() => window.__factory4x!.nodeIndex('a1'));
    await stepUntil(page, async () => (await rock(page, a1)).backedUp, 12000, 'a full buffer at a1');
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

  test('acceptance 3: the raid-rank line shows on the mined rock nearest the hive, not on the others, and not on a Stopped rock', async ({ page }) => {
    await ready(page, PHONE);
    const ids = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    const nodes = await page.evaluate((l) => l.map((i) => window.__factory4x!.nodeIndex(i)), ids);
    // Raids target a mined rock with an extractor or hauler: wait until two rocks have one.
    await stepUntil(page, async () => {
      let n = 0;
      for (const i of nodes) if ((await rock(page, i)).raidRank > 0) n++;
      return n >= 2;
    }, 12000, 'two raidable rocks');
    await pause(page);
    const ranks = await Promise.all(nodes.map(async (i) => (await rock(page, i)).raidRank));
    const first = ids[ranks.indexOf(1)]!;
    const other = ids[ranks.findIndex((r) => r > 1)]!;
    expect(first, 'one rock is the first target').toBeDefined();
    const note = page.locator('#sheet .rock-note');
    await tapNode(page, first);
    await expect(note.locator('.rank')).toHaveText('Nearest mined rock to the hive: raids hit here first.');
    await expect(note).not.toHaveClass(/idle/);
    await tap(page, page.locator('#sheet .close'));
    await tapNode(page, other);
    await expect(note.locator('.rank')).toHaveText('');
    await tap(page, page.locator('#sheet .close'));
    // Stop the first rock: it is no longer raidable, so the line goes, and another rock takes rank 1.
    await tapNode(page, first);
    await tap(page, page.locator('#sheet .mine-btn'));
    expect((await rock(page, nodes[ids.indexOf(first)]!)).raidRank).toBe(0);
    await expect(note.locator('.rank')).toHaveText('');
  });

  test('acceptance 5: the map draws the economy: docked extractors, haul lines, idle ships at the probe, and the Mine badge', async ({ page }) => {
    await ready(page, PHONE);
    // What the last drawn frame shows: a frame is drawn after each step, so settle first.
    const map = async (): Promise<{ mine: number[]; haul: Array<[number, number]>; econ: { docked: number; idle: number; waiting: number; moving: number } }> => {
      await settled(page);
      return JSON.parse(await page.evaluate(() => window.__factory4x!.mapField()));
    };
    // The six near rocks and a5, a6 and a7 are marked at the start: seven asteroids wear the badge, the pockets and hive do not.
    const m0 = await map();
    const marked = await page.evaluate(() => ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'].map((id) => window.__factory4x!.nodeIndex(id)));
    expect([...m0.mine].sort((a, b) => a - b)).toEqual([...marked].sort((a, b) => a - b));
    await stepUntil(page, async () => (await map()).econ.docked > 0, 6000, 'a docked extractor');
    await stepUntil(page, async () => (await map()).haul.length > 0, 9000, 'a rock with haulers getting its line');
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
    await stepUntil(page, async () => (await map()).econ.idle > 0, 6000, 'an idle ship at the probe');
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
    // An extractor itself (not only a hauler) is parked at the probe.
    await stepUntil(
      page,
      async () => (JSON.parse(await page.evaluate(() => window.__factory4x!.econShips())) as Array<{ type: string; at: number | null }>).some((e) => e.type === 'extractor' && e.at === 0),
      6000,
      'an extractor parked at the probe',
    );
    await pause(page);
    await tapNode(page, 'probe');
    const recycle = page.locator('#sheet .recycle-btn');
    await expect(recycle).toBeVisible();
    await tap(page, recycle);
    const panel = page.locator('#recyclepanel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.sp-row[data-ship="extractor"]')).toBeVisible();
    await expectControlsFit(page, '#recyclepanel', 'the recycle panel');
    await tap(page, panel.locator('.sp-row[data-ship="extractor"] .sp-all'));
    await tap(page, panel.locator('.primary'));
    expect((await inputs(page)).slice(-1)[0]!.type).toBe('recycleShips');
    // The refund goes into stock and the allocation takes it at once, so the proof is the summary's recycled count.
    const sum = JSON.parse(await page.evaluate(() => window.__factory4x!.fieldSummary())) as { recycled: { extractor: number } };
    expect(sum.recycled.extractor).toBeGreaterThan(0);
  });
});
