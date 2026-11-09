import { expect, test, type Page } from '@playwright/test';
import { defaultData, type CampaignStart } from '@factory4x/sim';

/**
 * H6 client: the pannable overworld on the real 10-area map, in the fullest state a game reaches (every chip, the notices strip up,
 * a wide font), in portrait, landscape and on a desktop. Numbers come from the shipped data (area order, tunable defaults) or the
 * page's own selectors; nothing here pins a tuned value.
 */

const WIDE_FONT =
  '#sheet *, #research *, #sendpanel *, #result *, #win *, #chips *, #ow-stats *, #controls *, #tuning *, #feedback *, .card *, #banner, #toast, #toast::after, #hint { font-family: serif !important; font-size: 15px !important; letter-spacing: 0.15em !important; line-height: 1.5 !important; }';

const AREAS = defaultData.map.areas;
const AREA = Object.fromEntries(AREAS.map((a, i) => [a.id, i])) as Record<string, number>;
const name = (id: string): string => AREAS[AREA[id]!]!.name;
const FLEET_CAP = defaultData.tunables['fleet.cap'].default;
const RELAY_STEP = defaultData.tunables['fleet.relayStep'].default;

const PORTRAIT = { width: 375, height: 667 };
const LANDSCAPE = { width: 667, height: 375 };
const DESKTOP = { width: 1280, height: 800 };

async function ready(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  await page.addStyleTag({ content: WIDE_FONT });
}

async function settled(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function startCampaign(page: Page, start: CampaignStart, tunables: Record<string, number> = {}): Promise<void> {
  await page.evaluate(([s, t]) => window.__factory4x!.startCampaign(s as never, t as never), [start, tunables] as const);
  await settled(page);
}

/** Taps an area: centres it clear of any sheet, waits until it stops moving and the canvas is what is under it, taps until its sheet opens. */
async function tapArea(page: Page, area: number): Promise<void> {
  let last = { x: -1, y: -1 };
  await expect
    .poll(
      async () => {
        await page.evaluate((i) => window.__factory4x!.centerOnArea(i), area);
        await settled(page);
        const q = await page.evaluate((i) => {
          const p = window.__factory4x!.areaScreenPos(i);
          const hit = document.elementFromPoint(p.x, p.y);
          return { ...p, onCanvas: hit !== null && hit.id === 'view' };
        }, area);
        const still = Math.abs(q.x - last.x) < 0.5 && Math.abs(q.y - last.y) < 0.5;
        last = { x: q.x, y: q.y };
        if (!still || !q.onCanvas) return false;
        await page.mouse.click(q.x, q.y);
        return (await page.evaluate(() => window.__factory4x!.selectedArea())) === area;
      },
      { message: `tapping area ${area}`, timeout: 15_000 },
    )
    .toBe(true);
}

/** The fullest overworld: five areas reclaimed, all three stockpile chips with rates, a long notice up, a wide font. */
const FULL: CampaignStart = { reclaimed: ['landfall', 'shelf', 'shoal', 'rime', 'glint'], research: { lancer: 1 }, stockpile: { ore: 1234, ice: 456, crystal: 789 } };

interface Rect { x: number; y: number; w: number; h: number }
const hits = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** True if a circle of radius r at (cx, cy) touches the rect. */
const circleHits = (cx: number, cy: number, r: number, b: Rect): boolean => {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
  const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
  return Math.hypot(cx - nx, cy - ny) < r;
};

for (const vp of [
  { name: 'portrait 375x667', size: PORTRAIT },
  { name: 'landscape 667x375', size: LANDSCAPE },
  { name: 'desktop 1280x800', size: DESKTOP },
]) {
  test(`${vp.name}: every area node is a 44 px target and no band label or name label overlaps a node (fullest state, wide font)`, async ({ page }) => {
    await ready(page, vp.size);
    await startCampaign(page, FULL);
    // The notices strip at its fullest: the canvas is as short as it gets.
    await page.evaluate(() => window.__factory4x!.debugShowNotices(true));
    await expect(page.locator('#toast')).toBeVisible();
    await settled(page);
    const radius = await page.evaluate(() => window.__factory4x!.areaRadius());
    expect(radius * 2, 'node diameter').toBeGreaterThanOrEqual(44);
    const seenBands = new Set<number>();
    const seenLabels = new Set<number>();
    // Look from every area: the map pans, so each view shows another part of it.
    for (let a = 0; a < AREAS.length; a++) {
      await page.evaluate((i) => window.__factory4x!.centerOnArea(i), a);
      await settled(page);
      const view = await page.evaluate(() => {
        const f = window.__factory4x!;
        return {
          nodes: Array.from({ length: Number(JSON.parse(f.campaign()).areaCount) }, (_, i) => f.areaScreenPos(i)),
          bands: f.bandRects(),
          labels: f.areaLabelRects(),
        };
      });
      const canvas = (await page.locator('#view').boundingBox())!;
      for (const b of view.bands) {
        if (b.y + b.h < canvas.y || b.y > canvas.y + canvas.height) continue;
        seenBands.add(b.band);
        expect(b.x, `band ${b.band} label inside the map`).toBeGreaterThanOrEqual(canvas.x);
        view.nodes.forEach((n, i) => expect(circleHits(n.x, n.y, radius, b), `band ${b.band} label on ${AREAS[i]!.name} (centred on ${AREAS[a]!.name}, ${vp.name})`).toBe(false));
        view.labels.forEach((l, i) => l && expect(hits(b, l), `band ${b.band} label on the name of ${AREAS[i]!.name}`).toBe(false));
      }
      view.labels.forEach((l, i) => {
        if (!l) return;
        seenLabels.add(i);
        view.nodes.forEach((n, k) => {
          if (k !== i) expect(circleHits(n.x, n.y, radius, l), `the name ${AREAS[i]!.name} on the node ${AREAS[k]!.name} (${vp.name})`).toBe(false);
        });
        view.labels.forEach((m, k) => {
          if (m && k > i) expect(hits(l, m), `the names ${AREAS[i]!.name} and ${AREAS[k]!.name} overlap (${vp.name})`).toBe(false);
        });
      });
      // Neighbouring centres are at least a node apart, so a tap picks one.
      view.nodes.forEach((p, i) => view.nodes.forEach((q, k) => k > i && expect(Math.hypot(p.x - q.x, p.y - q.y), `${AREAS[i]!.name} and ${AREAS[k]!.name}`).toBeGreaterThanOrEqual(44)));
    }
    expect(seenBands.size, 'every band label was on screen at some pan').toBe(new Set(AREAS.map((a) => a.tier)).size);
    expect(seenLabels.size, 'every name label was drawn at some pan').toBe(AREAS.length);
  });
}

test('landscape 667x375: on the overworld no stock or fleet chip lies under a control button, and the Research label fits its button', async ({ page }) => {
  await ready(page, LANDSCAPE);
  await startCampaign(page, FULL);
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    const rect = (e: Element): DOMRect => e.getBoundingClientRect();
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('#controls .ctl')).filter((b) => b.getClientRects().length > 0);
    const bars = rect(document.getElementById('bars')!);
    const parts = Array.from(document.querySelectorAll<HTMLElement>('#ow-stats .chip, #ow-stats .reclaimed, #ow-stats .sp-icon')).filter((c) => c.getClientRects().length > 0);
    for (const c of parts) {
      const range = document.createRange();
      range.selectNodeContents(c);
      const t = Array.from(range.getClientRects());
      const boxes = [rect(c), ...t];
      for (const b of buttons) {
        const r = rect(b);
        for (const x of boxes) if (x.width > 0 && x.left < r.right - 0.5 && x.right > r.left + 0.5 && x.top < r.bottom - 0.5 && x.bottom > r.top + 0.5) out.push(`${c.id || c.className} is under ${b.id}`);
      }
      for (const x of boxes) if (x.width > 0 && (x.right > bars.right + 0.5 || x.left < bars.left - 0.5)) out.push(`${c.id || c.className} pokes out of the bar`);
    }
    const research = document.getElementById('b-research')!;
    const range = document.createRange();
    range.selectNodeContents(research);
    const text = range.getBoundingClientRect();
    const box = rect(research);
    if (text.left < box.left - 1 || text.right > box.right + 1) out.push('the Research label pokes out of its button');
    return out;
  });
  expect(bad).toEqual([]);
});

test('portrait: pan by dragging to The Deep and tap it; a drag is not a tap and a short touch is', async ({ page }) => {
  await ready(page, PORTRAIT);
  const deep = AREA.deep!;
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('view')!).touchAction)).toBe('none');
  // The Deep is above the first view, off the top of the map.
  const canvas = (await page.locator('#view').boundingBox())!;
  const first = await page.evaluate((i) => window.__factory4x!.areaScreenPos(i), deep);
  expect(first.y, 'The Deep starts off the map').toBeLessThan(canvas.y);
  // A drag that starts on Landfall pans the map and does not open its sheet.
  const landfall = await page.evaluate((i) => window.__factory4x!.areaScreenPos(i), AREA.landfall!);
  const y0 = await page.evaluate(() => window.__factory4x!.overworldScroll().y);
  await page.mouse.move(landfall.x, landfall.y);
  await page.mouse.down();
  await page.mouse.move(landfall.x, landfall.y - 4, { steps: 2 });
  await page.mouse.move(landfall.x, landfall.y + 30, { steps: 5 });
  await page.mouse.up();
  await settled(page);
  expect(await page.evaluate(() => window.__factory4x!.selectedArea()), 'a drag over a node opens no sheet').toBe(null);
  expect(await page.evaluate(() => window.__factory4x!.overworldScroll().y), 'the drag panned').toBeLessThan(y0);
  // Drag down (the map moves down, showing what is above) until The Deep is on the map.
  for (let n = 0; n < 12; n++) {
    const p = await page.evaluate((i) => window.__factory4x!.areaScreenPos(i), deep);
    if (p.y > canvas.y + 40 && p.y < canvas.y + canvas.height - 40) break;
    const x = canvas.x + canvas.width - 20;
    await page.mouse.move(x, canvas.y + 60);
    await page.mouse.down();
    await page.mouse.move(x, canvas.y + 200, { steps: 8 });
    await page.mouse.move(x, canvas.y + 320, { steps: 8 });
    await page.mouse.up();
    await settled(page);
  }
  const p = await page.evaluate((i) => window.__factory4x!.areaScreenPos(i), deep);
  expect(p.y, 'The Deep is on the map after dragging').toBeGreaterThan(canvas.y + 20);
  expect(p.y).toBeLessThan(canvas.y + canvas.height);
  // A touch that moves under the slop is a tap.
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 3, p.y + 2);
  await page.mouse.up();
  await expect(page.locator('#sheet h2')).toHaveText(name('deep'));
  await expect(page.locator('#sheet .area-status')).toHaveText('Unscouted');
  expect(await page.evaluate(() => window.__factory4x!.selectedArea())).toBe(deep);
});

test('portrait: with a sheet open the other areas stay reachable by dragging, and a tap on one switches the sheet', async ({ page }) => {
  await ready(page, PORTRAIT);
  await startCampaign(page, FULL);
  await tapArea(page, AREA.landfall!);
  const sheet = (await page.locator('#sheet').boundingBox())!;
  const canvas = (await page.locator('#view').boundingBox())!;
  // Every area can be brought into the part of the map the sheet doesn't cover, by dragging alone (no closing the sheet).
  const far = AREAS.map((_, i) => i).sort((a, b) => AREAS[b]!.y - AREAS[a]!.y).slice(-3);
  for (const a of far) {
    for (let n = 0; n < 16; n++) {
      const p = await page.evaluate((i) => window.__factory4x!.areaScreenPos(i), a);
      if (p.y > canvas.y + 30 && p.y < sheet.y - 40) break;
      const x = canvas.x + canvas.width - 14;
      await page.mouse.move(x, canvas.y + 80);
      await page.mouse.down();
      await page.mouse.move(x, canvas.y + 160, { steps: 6 });
      await page.mouse.move(x, canvas.y + 300, { steps: 6 });
      await page.mouse.up();
      await settled(page);
    }
    const p = await page.evaluate((i) => window.__factory4x!.areaScreenPos(i), a);
    expect(p.y, `${AREAS[a]!.name} reachable above the sheet`).toBeGreaterThan(canvas.y);
    expect(p.y, `${AREAS[a]!.name} reachable above the sheet`).toBeLessThan(sheet.y - 30);
  }
  expect(await page.locator('#sheet').isVisible(), 'the sheet stayed open while panning').toBe(true);
  // And a tap on a visible one switches the sheet without closing it first.
  const top = far[far.length - 1]!;
  const p = await page.evaluate((i) => window.__factory4x!.areaScreenPos(i), top);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('#sheet h2')).toHaveText(AREAS[top]!.name);
});

/** An area known (lane-joined to a reclaimed one) and behind a band lock with these reclaimed: the data's lanes decide. */
function lockedKnown(reclaimed: string[]): string[] {
  const done = new Set(reclaimed);
  return AREAS.filter((a) => a.tier >= 2 && !done.has(a.id) && defaultData.map.lanes.some(([x, y]) => (x === a.id && done.has(y)) || (y === a.id && done.has(x)))).map((a) => a.id);
}

test('a locked area has no Land button, only the line that says which relays open its band; a relay says what it does', async ({ page }) => {
  await ready(page, PORTRAIT);
  const start = { reclaimed: ['landfall', 'shelf', 'shoal'] };
  await startCampaign(page, start);
  const locked = lockedKnown(start.reclaimed);
  expect(locked.length, 'the map has a band 2 area joined to a band 1 area by a lane').toBeGreaterThan(0);
  const id = locked[0]!;
  await tapArea(page, AREA[id]!);
  await expect(page.locator('#sheet h2')).toHaveText(name(id));
  await expect(page.locator('#sheet .area-status')).toHaveText('Locked');
  await expect(page.locator('#sheet button.land')).toHaveCount(0);
  await expect(page.locator('#sheet .lock-line')).toContainText(/^Locked: reclaim a band 1 relay \(.+ Relay( or .+ Relay)?\)\.$/);
  await expect(page.locator('#sheet .lock-line')).toContainText(name('rime'));
  await expect(page.locator('#sheet .lock-line')).toContainText(name('glint'));
  // A relay: what reclaiming it does, with the limits from the data.
  await tapArea(page, AREA.rime!);
  await expect(page.locator('#sheet .relay-line')).toHaveText(`Command relay: reclaim it to raise your fleet limit ${FLEET_CAP} → ${FLEET_CAP + RELAY_STEP} and open band 2.`);
  await expect(page.locator('#sheet button.land')).toBeEnabled();
});

test('a far area says unscouted and shows its band and kind; a second relay of a band says it pays its haul only', async ({ page }) => {
  await ready(page, PORTRAIT);
  await startCampaign(page, { reclaimed: ['landfall', 'shelf', 'shoal', 'rime'] });
  const far = AREAS.find((a) => a.tier === 3)!;
  await tapArea(page, AREA[far.id]!);
  await expect(page.locator('#sheet .area-status')).toHaveText('Unscouted');
  await expect(page.locator('#sheet .far-line')).toHaveText('Band 3 · Area. Unscouted: reclaim a neighbour to scout it.');
  await expect(page.locator('#sheet button.land')).toHaveCount(0);
  await tapArea(page, AREA.glint!);
  await expect(page.locator('#sheet .relay-line')).toHaveText('Band 2 is already open: this relay pays its haul only.');
});

test('a repeat haul shows the decayed amount with its reason', async ({ page }) => {
  await ready(page, PORTRAIT);
  // Frost Shelf and Rime Relay are one group (band 1, ice side): with Shelf reclaimed, Rime pays a decayed haul.
  await startCampaign(page, { reclaimed: ['landfall', 'shelf'] });
  const pct = defaultData.tunables['areas.repeatHaulPct'].default;
  const haul = AREAS[AREA.rime!]!.haul;
  await tapArea(page, AREA.rime!);
  const first = Math.floor((haul.ore * pct) / 100);
  await expect(page.locator('#sheet .haul')).toContainText(`${first} ore`);
  await expect(page.locator('#sheet .haul')).toContainText(`${name('shelf')} already reclaimed`);
  // Frost Shelf's own sheet (reclaimed first, so never decayed) pays what the data says, or what the constructed start recorded.
  await tapArea(page, AREA.shoal!);
  await expect(page.locator('#sheet .haul')).not.toContainText('already reclaimed');
});

/** How many pixels of the canvas around an area's upper-right corner are the padlock's steel grey (palette.plating). */
async function padlockPixels(page: Page, area: number): Promise<number> {
  return page.evaluate((i) => {
    const f = window.__factory4x!;
    const c = document.getElementById('view') as HTMLCanvasElement;
    const box = c.getBoundingClientRect();
    const p = f.areaScreenPos(i);
    const r = f.areaRadius();
    const dpr = c.width / box.width;
    const cx = (p.x - box.left + 0.7 * r) * dpr;
    const cy = (p.y - box.top - 0.7 * r) * dpr;
    const half = Math.ceil(0.5 * r * dpr);
    const data = c.getContext('2d')!.getImageData(Math.max(0, Math.round(cx - half)), Math.max(0, Math.round(cy - half)), half * 2, half * 2).data;
    let n = 0;
    for (let k = 0; k < data.length; k += 4) if (Math.abs(data[k]! - 168) < 5 && Math.abs(data[k + 1]! - 179) < 5 && Math.abs(data[k + 2]! - 199) < 5) n++;
    return n;
  }, area);
}

test('the locked badge is drawn on a locked area, and gone with overworld.bandLock 0', async ({ page }) => {
  await ready(page, PORTRAIT);
  const start = { reclaimed: ['landfall', 'shelf', 'shoal'] };
  const id = lockedKnown(start.reclaimed)[0]!;
  await startCampaign(page, start);
  await page.evaluate((i) => window.__factory4x!.centerOnArea(i), AREA[id]!);
  await settled(page);
  await expect.poll(() => padlockPixels(page, AREA[id]!), { message: 'padlock pixels with the lock on' }).toBeGreaterThan(40);
  await startCampaign(page, start, { 'overworld.bandLock': 0 });
  await page.evaluate((i) => window.__factory4x!.centerOnArea(i), AREA[id]!);
  await settled(page);
  await expect.poll(() => padlockPixels(page, AREA[id]!), { message: 'padlock pixels with the lock off' }).toBeLessThan(10);
  // With the lock off the area opens at once.
  await tapArea(page, AREA[id]!);
  await expect(page.locator('#sheet .area-status')).toHaveText('Open');
  await expect(page.locator('#sheet button.land')).toBeEnabled();
});

// ---------------------------------------------------------------------------
// The step moment: reclaim the first relay of a band through the game.

/** Rime Relay with cheap, quick ships and soft guards, landed from a constructed campaign; sends drones at the heart until it falls. */
async function reclaimRime(page: Page): Promise<void> {
  await startCampaign(
    page,
    { reclaimed: ['landfall', 'shelf'], land: 'rime' },
    { 'guard.capPct': 25, 'ship.drone.cost': 5, 'ship.drone.buildTicks': 15, 'economy.startStock': 200 },
  );
  await expect(page.locator('#toast')).toContainText('Landed in');
  await page.locator('#b-s4').click();
  const heart = await page.evaluate(() => window.__factory4x!.nodeIndex('heart'));
  await expect.poll(() => page.evaluate(() => window.__factory4x!.shipsAt(0)), { timeout: 30_000 }).toBeGreaterThanOrEqual(FLEET_CAP);
  const p = await page.evaluate((i) => window.__factory4x!.nodeScreenPos(i), heart);
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('#sheet')).toBeVisible();
  for (let n = 0; n < 6 && !(await page.locator('#result').isVisible()); n++) {
    const attack = page.locator('#sheet button', { hasText: /^Attack with all from Probe/ });
    await attack.click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
  }
  await expect(page.locator('#result')).toBeVisible({ timeout: 40_000 });
}

test('portrait: reclaiming a relay plays the step moment once, with its notice, and the next landing shows the new limit', async ({ page }) => {
  test.setTimeout(120_000);
  await ready(page, PORTRAIT);
  await reclaimRime(page);
  // Back to the overworld: the step moment starts, and a tap during it skips it. (Everything in one frame sequence, so the check
  // can't miss its 1.5 s.)
  const during = await page.evaluate(
    () =>
      new Promise<{ active: boolean; skipped: boolean; started: number }>((resolve) => {
        const f = window.__factory4x!;
        const btn = Array.from(document.querySelectorAll<HTMLButtonElement>('#result button')).find((b) => /Back to the overworld/.test(b.textContent ?? ''))!;
        btn.click();
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const active = f.stepActive();
              f.skipStep();
              resolve({ active, skipped: !f.stepActive(), started: f.stepsStarted() });
            }),
          ),
        );
      }),
  );
  expect(during.active, 'the step moment is playing right after the return').toBe(true);
  expect(during.skipped, 'it can be skipped').toBe(true);
  expect(during.started).toBe(1);
  await expect(page.locator('#toast')).toContainText(`Command relay reclaimed: fleet limit ${FLEET_CAP} → ${FLEET_CAP + RELAY_STEP}. Band 2 is open.`);
  // Once: the notice and the step are not repeated by the next look at the overworld or by a reload.
  await page.locator('#toast').click();
  await page.evaluate(() => window.__factory4x!.saveNow());
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  expect(await page.evaluate(() => window.__factory4x!.stepsStarted())).toBe(0);
  await expect(page.locator('#toast')).toBeHidden();
  // The band is open now: its areas are no longer locked, the top row shows the new limit, and the next landing names it.
  await expect(page.locator('#sp-fleet')).toHaveText(`Fleet limit ${FLEET_CAP + RELAY_STEP}`);
  await tapArea(page, AREA.shoal!);
  await expect(page.locator('#sheet .fleet-limit')).toHaveText(`Your fleet limit: ${FLEET_CAP + RELAY_STEP}`);
  await page.locator('#sheet button.land').click();
  await expect(page.locator('#toast')).toContainText(`fleet limit ${FLEET_CAP + RELAY_STEP}`);
});

test('the step moment leaves the band in view and the padlocks gone once it has played', async ({ page }) => {
  test.setTimeout(120_000);
  await ready(page, PORTRAIT);
  await reclaimRime(page);
  await page.locator('#result button', { hasText: 'Back to the overworld' }).click();
  await expect.poll(() => page.evaluate(() => window.__factory4x!.onOverworld())).toBe(true);
  // It starts with the first refresh on the overworld, plays for about 1.5 s, then stops.
  await expect.poll(() => page.evaluate(() => window.__factory4x!.stepsStarted())).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__factory4x!.stepActive()), { timeout: 5000 }).toBe(false);
  const canvas = (await page.locator('#view').boundingBox())!;
  const band2 = AREAS.filter((a) => a.tier === 2);
  let inView = 0;
  for (const a of band2) {
    const p = await page.evaluate((i) => window.__factory4x!.areaScreenPos(i), AREA[a.id]!);
    if (p.y > canvas.y && p.y < canvas.y + canvas.height) inView++;
  }
  expect(inView, 'the newly opened band is in view').toBeGreaterThan(0);
  // The padlocks of the band that opened are gone (they were drawn on them a moment ago, in the step's first half).
  for (const id of lockedKnown(['landfall', 'shelf', 'rime'])) {
    await page.evaluate((i) => window.__factory4x!.centerOnArea(i), AREA[id]!);
    await settled(page);
    expect(await padlockPixels(page, AREA[id]!), `padlock on ${name(id)}`).toBeLessThan(10);
  }
});
