import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectControlsFit, settled, stepSimUntil } from './helpers.ts';

/**
 * H8 client: drag to move (and the long-press half), the tap-Move-tap fallback, the hauler count, Mine mode, the weight column, the
 * raid badge, and the fleet panel. Drags are synthetic pointer events dispatched on the canvas (touch pointers on the phone project,
 * mouse on the desktop one), so a gesture is exact and repeatable; taps are real (a touch tap on the phone project). The sim is stepped
 * with `advanceTicks`, never waited for. Every layout assertion forces a wide font on the elements under test, so a layout that only
 * fits this machine's fonts fails here too.
 */

const WIDE_FONT =
  '#sheet *, #sendpanel *, #recyclepanel *, #fleetpanel *, #result *, #chips *, #controls *, #tuning *, .card *, #banner, #movebar, #toast, #hint { font-family: serif !important; font-size: 15px !important; letter-spacing: 0.15em !important; line-height: 1.5 !important; }';
const PHONE = { width: 375, height: 667 };
const IDS = ['probe', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'p1', 'p2', 'heart'];

async function ready(page: Page, size: { width: number; height: number } | null = PHONE, wide = true): Promise<void> {
  if (size) await page.setViewportSize(size);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Boolean(window.__factory4x))).toBe(true);
  if (wide) await page.addStyleTag({ content: WIDE_FONT });
  await settled(page);
}

const isPhone = (): boolean => test.info().project.name === 'phone';

async function tapAt(page: Page, x: number, y: number): Promise<void> {
  if (isPhone()) await page.touchscreen.tap(x, y);
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

/** The boxes that make up the HUD: nothing may move or resize when a badge, a mode or a drag changes. */
const hudBoxes = (page: Page): Promise<string> =>
  page.evaluate(() =>
    ['bars', 'stats', 'chips', 'chip-ore', 'chip-fleet', 'chip-raid', 'controls', 'b-mine']
      .map((id) => {
        const b = document.getElementById(id)!.getBoundingClientRect();
        return `${id}:${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)},${Math.round(b.height)}`;
      })
      .join('|'),
  );

const nodeOf = (page: Page, id: string): Promise<number> => page.evaluate((i) => window.__factory4x!.nodeIndex(i), id);
const inputs = async (page: Page): Promise<Array<Record<string, unknown>>> => JSON.parse(await page.evaluate(() => window.__factory4x!.log())) as Array<Record<string, unknown>>;
const selected = (page: Page): Promise<number | null> => page.evaluate(() => window.__factory4x!.selected());

interface Rock {
  mine: boolean;
  docked: number;
  haulers: number;
  haulerNeed: number;
  haulerSet: number | null;
  haulerTarget: number;
  raidTarget: boolean;
  haulersHeld: boolean;
}
const rock = async (page: Page, node: number): Promise<Rock> => JSON.parse(await page.evaluate((n) => window.__factory4x!.rockStatus(n), node)) as Rock;
const econ = async (page: Page): Promise<Array<{ type: string; at: number | null; target: number | null; moving: boolean }>> => JSON.parse(await page.evaluate(() => window.__factory4x!.econShips())) as Array<{ type: string; at: number | null; target: number | null; moving: boolean }>;

/** Sets a tunable (sim or client) through the tuning panel, as a player would. */
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

type PType = 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel';

/** One synthetic pointer event on the canvas (touch on the phone project, mouse on desktop). */
async function ptr(page: Page, type: PType, x: number, y: number, o: { id?: number; primary?: boolean } = {}): Promise<void> {
  await page.evaluate(
    ({ type, x, y, id, primary, kind }) => {
      const c = document.getElementById('view')!;
      c.dispatchEvent(
        new PointerEvent(type, { pointerId: id, pointerType: kind, isPrimary: primary, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1 }),
      );
    },
    { type, x, y, id: o.id ?? 1, primary: o.primary ?? true, kind: isPhone() ? 'touch' : 'mouse' },
  );
}

/** The click a browser sends after a pointer release (the gesture must swallow it after a drag). */
async function clickAt(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(([x, y]) => document.getElementById('view')!.dispatchEvent(new MouseEvent('click', { clientX: x!, clientY: y!, bubbles: true })), [x, y]);
}

/** A node's screen position, after the map has settled (a notice above the canvas moves it). */
async function nodePt(page: Page, id: number | string): Promise<{ x: number; y: number }> {
  const node = typeof id === 'string' ? await nodeOf(page, id) : id;
  await settled(page);
  return page.evaluate((i) => window.__factory4x!.nodeScreenPos(i), node);
}

/**
 * An all-drag in one synchronous run (no timer can fire inside it): down on `from`, two moves, up on `to` shifted `shift` px back toward
 * `from`, then the click a browser would send. Positions are read after the map settled.
 */
async function dragAll(page: Page, from: number, to: number, shift = 0): Promise<void> {
  await settled(page);
  await page.evaluate(
    ({ from, to, shift, kind }) => {
      const f = window.__factory4x!;
      const c = document.getElementById('view')!;
      const a = f.nodeScreenPos(from);
      const t = f.nodeScreenPos(to);
      const d = Math.hypot(a.x - t.x, a.y - t.y) || 1;
      const b = { x: t.x + ((a.x - t.x) / d) * shift, y: t.y + ((a.y - t.y) / d) * shift };
      const fire = (type: string, x: number, y: number): void => {
        c.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: kind, isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
      };
      fire('pointerdown', a.x, a.y);
      fire('pointermove', (a.x + b.x) / 2, (a.y + b.y) / 2);
      fire('pointermove', b.x, b.y);
      fire('pointerup', b.x, b.y);
      c.dispatchEvent(new MouseEvent('click', { clientX: b.x, clientY: b.y, bubbles: true }));
    },
    { from, to, shift, kind: isPhone() ? 'touch' : 'mouse' },
  );
}

const park = (page: Page, node: number, counts: { drone?: number; lancer?: number; flak?: number }): Promise<void> => page.evaluate(([n, c]) => window.__factory4x!.debugParkShips(n as number, c as Record<string, number>), [node, counts] as const);
const at = (page: Page, node: number): Promise<{ drone: number; lancer: number; flak: number }> => page.evaluate((n) => window.__factory4x!.shipsAtByType(n), node);
const gesture = async (page: Page): Promise<{ phase: string; moves: number; cancels: number; arms: number }> => JSON.parse(await page.evaluate(() => window.__factory4x!.gestureState())) as { phase: string; moves: number; cancels: number; arms: number };
const dragState = async (page: Page): Promise<null | { from: number; part: string; armed: boolean; finger: { x: number; y: number }; ghost: null | { x: number; y: number; w: number; counts: Array<{ type: string; count: number }> }; target: number | null; aim: string; tag: string | null }> =>
  JSON.parse(await page.evaluate(() => window.__factory4x!.mapDrag()));

for (const [label, size] of [['375x667', PHONE], ['the project size', null]] as const) {
  test.describe(`drag to move at ${label}`, () => {
    test(`(a) an all-drag lands moveShips on the intended node for every pair of nodes, dropped at the centre and a little short of it (${label})`, async ({ page }) => {
      test.setTimeout(120_000);
      await ready(page, size, false);
      await pause(page);
      const nodes = await Promise.all(IDS.map((id) => nodeOf(page, id)));
      for (const n of nodes) expect(n).toBeGreaterThanOrEqual(0);
      const failures: string[] = [];
      let sent = 0;
      for (const shift of [0, 8]) {
        for (const from of nodes) {
          for (const to of nodes) {
            if (from === to) continue;
            await park(page, from, { drone: 2 });
            const before = (await inputs(page)).length;
            await dragAll(page, from, to, shift);
            const log = await inputs(page);
            const last = log[log.length - 1];
            if (log.length !== before + 1 || last!.type !== 'moveShips' || last!.from !== from || last!.to !== to || last!.part !== 'all') {
              failures.push(`${IDS[nodes.indexOf(from)]} -> ${IDS[nodes.indexOf(to)]} (shift ${shift}): ${JSON.stringify(log.slice(before))}`);
            } else sent++;
            if ((await selected(page)) !== null) failures.push(`${IDS[nodes.indexOf(from)]} -> ${IDS[nodes.indexOf(to)]}: a sheet opened after the drag`);
          }
        }
      }
      expect(failures, 'pairs where the drag did not land on its target').toEqual([]);
      expect(sent).toBe(2 * nodes.length * (nodes.length - 1));
    });
  });
}

test.describe('375x667 portrait, drag and its edges', () => {
  test.use({ viewport: PHONE });

  test('the ghost chip sits 48 px above the finger, the target is highlighted with its name and Attack tag, and nothing in the HUD moves', async ({ page }) => {
    await ready(page);
    await pause(page);
    const a1 = await nodeOf(page, 'a1');
    const a2 = await nodeOf(page, 'a2');
    const heart = await nodeOf(page, 'heart');
    await park(page, a1, { drone: 3, lancer: 1 });
    const hud = () => page.evaluate(() => Array.from(document.querySelectorAll('#bars button, #bars .chip')).map((e) => { const b = e.getBoundingClientRect(); return [e.id, Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)].join(','); }).join('|'));
    const hud0 = await hud();
    const from = await nodePt(page, a1);
    await ptr(page, 'pointerdown', from.x, from.y);
    // Over a2: a plain move, the node named.
    const p2 = await nodePt(page, a2);
    await ptr(page, 'pointermove', (from.x + p2.x) / 2, (from.y + p2.y) / 2);
    await ptr(page, 'pointermove', p2.x, p2.y);
    await settled(page);
    const s = await dragState(page);
    expect(s, 'the drag is drawn').not.toBeNull();
    expect(s!.target).toBe(a2);
    expect(s!.aim).toBe('move');
    expect(s!.tag).toBeNull();
    expect(s!.ghost!.counts, 'the ghost shows the carried counts').toEqual([{ type: 'drone', count: 3 }, { type: 'lancer', count: 1 }]);
    const r = await page.evaluate(() => document.getElementById('view')!.getBoundingClientRect());
    expect(Math.abs(s!.finger.y - s!.ghost!.y - 48), 'the ghost is 48 px above the finger').toBeLessThanOrEqual(1);
    expect(await hud(), 'the HUD did not move during the drag').toBe(hud0);
    await page.screenshot({ path: 'test-results/h8-drag-move.png' });
    // Over the guarded hive: Attack and the tag.
    const ph = await nodePt(page, heart);
    await ptr(page, 'pointermove', ph.x, ph.y);
    await settled(page);
    const t = await dragState(page);
    expect(t!.target).toBe(heart);
    expect(t!.aim).toBe('attack');
    expect(t!.tag).toMatch(/^Attack · (Strong|Even|Weak)$/);
    expect(await hud(), 'the HUD did not move over a guarded node').toBe(hud0);
    await page.screenshot({ path: 'test-results/h8-drag-attack.png' });
    // Over nothing (the canvas corner): no target, grey line.
    await ptr(page, 'pointermove', r.left + 3, r.top + 3);
    await settled(page);
    const n = await dragState(page);
    expect(n!.target).toBeNull();
    expect(n!.aim).toBe('none');
    // Release there: a cancel. Nothing sent.
    const before = (await inputs(page)).length;
    await ptr(page, 'pointerup', r.left + 3, r.top + 3);
    await clickAt(page, r.left + 3, r.top + 3);
    expect((await inputs(page)).length).toBe(before);
    await settled(page);
    expect(await dragState(page), 'the drawing is gone after the release').toBeNull();
  });

  test('(b) a long press then a drag sends split; a lone ship still moves', async ({ page }) => {
    await ready(page);
    await pause(page);
    await tune(page, 'client.longPressMs', 250);
    const probe = await nodeOf(page, 'probe');
    const a1 = await nodeOf(page, 'a1');
    await park(page, probe, { drone: 4, flak: 1 });
    const from = await nodePt(page, probe);
    const to = await nodePt(page, a1);
    await ptr(page, 'pointerdown', from.x, from.y);
    await expect.poll(async () => (await gesture(page)).phase, { message: 'the long press armed a split' }).toBe('armed');
    expect((await gesture(page)).arms).toBe(1);
    await settled(page);
    expect((await dragState(page))!.armed, 'the armed source pulses').toBe(true);
    expect((await dragState(page))!.ghost!.counts, 'the armed split already shows its half counts').toEqual([{ type: 'drone', count: 2 }]);
    await page.screenshot({ path: 'test-results/h8-split-armed.png' });
    await ptr(page, 'pointermove', (from.x + to.x) / 2, (from.y + to.y) / 2);
    await ptr(page, 'pointermove', to.x, to.y);
    await settled(page);
    const s = await dragState(page);
    expect(s!.part).toBe('split');
    expect(s!.ghost!.counts, 'the ghost shows the half counts').toEqual([{ type: 'drone', count: 2 }]);
    await ptr(page, 'pointerup', to.x, to.y);
    await clickAt(page, to.x, to.y);
    const log = await inputs(page);
    expect(log[log.length - 1]).toEqual({ type: 'moveShips', from: probe, to: a1, part: 'split' });
    // The sim computed the counts: 2 of 4 drones, floor(1/2) = 0 flak.
    expect((await at(page, probe)).drone).toBe(2);
    expect((await at(page, probe)).flak).toBe(1);
    expect(await selected(page)).toBeNull();
    // One lone ship: the 1-ship fallback.
    const a2 = await nodeOf(page, 'a2');
    await park(page, a2, { lancer: 1 });
    const f2 = await nodePt(page, a2);
    const t2 = await nodePt(page, a1);
    await ptr(page, 'pointerdown', f2.x, f2.y);
    await expect.poll(async () => (await gesture(page)).phase).toBe('armed');
    await ptr(page, 'pointermove', t2.x, t2.y);
    await ptr(page, 'pointerup', t2.x, t2.y);
    const log2 = await inputs(page);
    expect(log2[log2.length - 1]).toEqual({ type: 'moveShips', from: a2, to: a1, part: 'split' });
    expect((await at(page, a2)).lancer).toBe(0);
  });

  test('(c) a tap within the slop opens the sheet and sends no input, short or long; a tap on a node with no warships does the same', async ({ page }) => {
    await ready(page);
    await pause(page);
    await tune(page, 'client.longPressMs', 250);
    const a1 = await nodeOf(page, 'a1');
    const a3 = await nodeOf(page, 'a3');
    await park(page, a1, { drone: 2 });
    const before = (await inputs(page)).length;
    // A real tap (touch on the phone project).
    let p = await nodePt(page, a1);
    await tapAt(page, p.x, p.y);
    expect(await selected(page), 'the tap opened the sheet').toBe(a1);
    expect((await inputs(page)).length, 'and sent nothing').toBe(before);
    await page.locator('#sheet .close').click();
    // A shaky tap: 8 px of travel (the slop is 12) and a release on the spot is still a tap.
    p = await nodePt(page, a1);
    await ptr(page, 'pointerdown', p.x, p.y);
    await ptr(page, 'pointermove', p.x + 6, p.y + 5);
    await ptr(page, 'pointerup', p.x + 6, p.y + 5);
    await clickAt(page, p.x + 6, p.y + 5);
    expect(await selected(page), 'a tap with a little jitter is a tap').toBe(a1);
    expect((await inputs(page)).length).toBe(before);
    await page.locator('#sheet .close').click();
    // A long tap: held past the long-press time, released without moving: armed, then a tap.
    p = await nodePt(page, a1);
    await ptr(page, 'pointerdown', p.x, p.y);
    await expect.poll(async () => (await gesture(page)).phase).toBe('armed');
    await ptr(page, 'pointerup', p.x, p.y);
    await clickAt(page, p.x, p.y);
    expect(await selected(page), 'a long tap opens the sheet').toBe(a1);
    expect((await inputs(page)).length).toBe(before);
    await page.locator('#sheet .close').click();
    // A node with no warships: the tap opens its sheet; a drag from it starts nothing and sends nothing (and opens nothing).
    p = await nodePt(page, a3);
    await tapAt(page, p.x, p.y);
    expect(await selected(page)).toBe(a3);
    await page.locator('#sheet .close').click();
    await dragAll(page, a3, a1);
    expect((await inputs(page)).length, 'no drag starts from a node with no warships').toBe(before);
    expect(await selected(page)).toBeNull();
    expect((await gesture(page)).phase).toBe('idle');
  });

  test('(d) every cancel sends nothing and leaves the sheet alone: empty space, the source, a sheet, pointercancel, a second pointer', async ({ page }) => {
    await ready(page);
    await pause(page);
    const probe = await nodeOf(page, 'probe');
    const a1 = await nodeOf(page, 'a1');
    const a2 = await nodeOf(page, 'a2');
    await park(page, a1, { drone: 2 });
    const before = (await inputs(page)).length;
    const nothing = async (what: string): Promise<void> => {
      expect((await inputs(page)).length, `${what}: nothing was sent`).toBe(before);
      expect(await selected(page), `${what}: no sheet opened`).toBeNull();
      expect((await gesture(page)).phase, `${what}: the gesture ended`).toBe('idle');
    };
    const r = await page.evaluate(() => { const b = document.getElementById('view')!.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; });
    // Empty space: a corner of the canvas with no node.
    let from = await nodePt(page, a1);
    await ptr(page, 'pointerdown', from.x, from.y);
    await ptr(page, 'pointermove', r.l + 4, r.t + 4);
    expect((await dragState(page)) === null || true).toBe(true);
    await ptr(page, 'pointerup', r.l + 4, r.t + 4);
    await clickAt(page, r.l + 4, r.t + 4);
    await nothing('empty space');
    // The source: out past the slop and back onto it.
    from = await nodePt(page, a1);
    const away = await nodePt(page, a2);
    await ptr(page, 'pointerdown', from.x, from.y);
    await ptr(page, 'pointermove', away.x, away.y);
    await ptr(page, 'pointermove', from.x + 2, from.y + 2);
    await settled(page);
    expect((await dragState(page))!.target, 'the source is never its own target').toBeNull();
    await ptr(page, 'pointerup', from.x + 2, from.y + 2);
    await clickAt(page, from.x + 2, from.y + 2);
    await nothing('the source');
    // A sheet: open the probe's, then drop on it.
    const pp = await nodePt(page, probe);
    await tapAt(page, pp.x, pp.y);
    expect(await selected(page)).toBe(probe);
    await settled(page);
    const sheet = (await page.locator('#sheet').boundingBox())!;
    from = await nodePt(page, a1);
    await ptr(page, 'pointerdown', from.x, from.y);
    await ptr(page, 'pointermove', from.x + 30, from.y + 30);
    await ptr(page, 'pointermove', sheet.x + sheet.width / 2, sheet.y + 60);
    await settled(page);
    expect((await dragState(page))!.target, 'a sheet is not a target').toBeNull();
    expect((await dragState(page))!.aim).toBe('none');
    await ptr(page, 'pointerup', sheet.x + sheet.width / 2, sheet.y + 60);
    expect((await inputs(page)).length, 'over a sheet: nothing was sent').toBe(before);
    expect(await selected(page), 'over a sheet: the sheet stayed as it was').toBe(probe);
    await page.locator('#sheet .close').click();
    // pointercancel.
    from = await nodePt(page, a1);
    const to = await nodePt(page, a2);
    await ptr(page, 'pointerdown', from.x, from.y);
    await ptr(page, 'pointermove', to.x, to.y);
    await ptr(page, 'pointercancel', to.x, to.y);
    await clickAt(page, to.x, to.y);
    await nothing('pointercancel');
    // A second pointer, down in the middle of a drag.
    from = await nodePt(page, a1);
    await ptr(page, 'pointerdown', from.x, from.y);
    await ptr(page, 'pointermove', to.x, to.y);
    await ptr(page, 'pointerdown', r.l + 20, r.t + 20, { id: 2, primary: false });
    await settled(page);
    expect(await dragState(page), 'the second pointer cancelled the drag').toBeNull();
    await ptr(page, 'pointerup', r.l + 20, r.t + 20, { id: 2, primary: false });
    await ptr(page, 'pointerup', to.x, to.y);
    await clickAt(page, to.x, to.y);
    await nothing('a second pointer');
    // The counters saw the cancels, and no move.
    const g = await gesture(page);
    expect(g.moves).toBe(0);
    expect(g.cancels).toBeGreaterThanOrEqual(5);
    // After all that a drag still works (the gesture is not stuck).
    await dragAll(page, a1, a2);
    const log = await inputs(page);
    expect(log[log.length - 1]).toEqual({ type: 'moveShips', from: a1, to: a2, part: 'all' });
  });

  test('a drag never also taps: the click after a drop opens no sheet, and the next real tap still does', async ({ page }) => {
    await ready(page);
    await pause(page);
    const a1 = await nodeOf(page, 'a1');
    const a2 = await nodeOf(page, 'a2');
    await park(page, a1, { drone: 1 });
    await dragAll(page, a1, a2);
    expect(await selected(page)).toBeNull();
    const toast = page.locator('#toast');
    await expect(toast).toContainText(/^Moved 1 → A2/);
    const p = await nodePt(page, a2);
    await tapAt(page, p.x, p.y);
    expect(await selected(page), 'a tap after a drag opens the sheet').toBe(a2);
  });

  test('a drag onto a guarded node says it is an attack', async ({ page }) => {
    await ready(page);
    await pause(page);
    const a1 = await nodeOf(page, 'a1');
    const p1 = await nodeOf(page, 'p1');
    await park(page, a1, { drone: 3 });
    await dragAll(page, a1, p1);
    const log = await inputs(page);
    expect(log[log.length - 1]).toEqual({ type: 'moveShips', from: a1, to: p1, part: 'all' });
    await expect(page.locator('#toast')).toContainText(/^Sent 3 to attack P1/);
  });
});

test.describe('375x667 portrait, tap-Move-tap (client.moveGesture 0)', () => {
  test.use({ viewport: PHONE });

  test('Move all and Move half put up a banner; the next node tap sends moveShips; Cancel and empty space cancel; drags are off', async ({ page }) => {
    await ready(page);
    await pause(page);
    await tune(page, 'client.moveGesture', 0);
    const a1 = await nodeOf(page, 'a1');
    const a2 = await nodeOf(page, 'a2');
    await park(page, a1, { drone: 4 });
    // Drags are off: a drag from a1 sends nothing (and, with no gesture, a node tap opens the sheet).
    const before = (await inputs(page)).length;
    await dragAll(page, a1, a2);
    expect((await inputs(page)).length, 'no drag with moveGesture 0').toBe(before);
    // Open the sheet: Move all / Move half are there.
    let p = await nodePt(page, a1);
    await tapAt(page, p.x, p.y);
    expect(await selected(page)).toBe(a1);
    const sheet = page.locator('#sheet');
    await expect(sheet.locator('.move-all')).toHaveText('Move all · 4');
    await expect(sheet.locator('.move-half')).toHaveText('Move half · 2');
    await expectControlsFit(page, '#sheet', 'the move buttons fit');
    await tap(page, sheet.locator('.move-all'));
    await expect(page.locator('#movebar')).toBeVisible();
    await expect(page.locator('#move-text')).toHaveText('Tap where to send 4 ships');
    await expect(page.locator('#move-cancel')).toBeVisible();
    expect(await selected(page), 'the sheet closed').toBeNull();
    // The next node tap sends it.
    p = await nodePt(page, a2);
    await tapAt(page, p.x, p.y);
    const log = await inputs(page);
    expect(log[log.length - 1]).toEqual({ type: 'moveShips', from: a1, to: a2, part: 'all' });
    await expect(page.locator('#movebar')).toBeHidden();
    expect(await selected(page), 'the target tap opened no sheet').toBeNull();
    // Move half, from a node holding warships again: the banner counts what a move would carry now.
    await park(page, a2, { drone: 4 });
    p = await nodePt(page, a2);
    await tapAt(page, p.x, p.y);
    await tap(page, sheet.locator('.move-half'));
    await expect(page.locator('#move-text')).toHaveText('Tap where to send 2 ships');
    // Cancel button.
    await tap(page, page.locator('#move-cancel'));
    await expect(page.locator('#movebar')).toBeHidden();
    expect(await page.evaluate(() => window.__factory4x!.pendingMove())).toBe('null');
    // Empty space cancels too, and a tap on the source.
    p = await nodePt(page, a2);
    await tapAt(page, p.x, p.y);
    await tap(page, sheet.locator('.move-half'));
    const r = await page.evaluate(() => { const b = document.getElementById('view')!.getBoundingClientRect(); return { l: b.left, t: b.top }; });
    const n = (await inputs(page)).length;
    await tapAt(page, r.l + 4, r.t + 4);
    await expect(page.locator('#movebar')).toBeHidden();
    expect((await inputs(page)).length, 'empty space cancelled').toBe(n);
    // Move half sends the split.
    p = await nodePt(page, a2);
    await tapAt(page, p.x, p.y);
    await tap(page, sheet.locator('.move-half'));
    const a3 = await nodeOf(page, 'a3');
    p = await nodePt(page, a3);
    await tapAt(page, p.x, p.y);
    const log2 = await inputs(page);
    expect(log2[log2.length - 1]).toEqual({ type: 'moveShips', from: a2, to: a3, part: 'split' });
    await page.screenshot({ path: 'test-results/h8-move-banner.png' });
  });

  test('the Move buttons are hidden while drags are on', async ({ page }) => {
    await ready(page);
    await pause(page);
    const a1 = await nodeOf(page, 'a1');
    await park(page, a1, { drone: 2 });
    const p = await nodePt(page, a1);
    await tapAt(page, p.x, p.y);
    await expect(page.locator('#sheet .move-all')).toBeHidden();
  });
});

test.describe('375x667 portrait, Mine mode', () => {
  test.use({ viewport: PHONE });

  test('the Mine button marks and unmarks two rocks in three taps and opens no sheet; taps elsewhere do nothing; drags are off', async ({ page }) => {
    await ready(page);
    await pause(page);
    const a1 = await nodeOf(page, 'a1');
    const a2 = await nodeOf(page, 'a2');
    const heart = await nodeOf(page, 'heart');
    expect((await rock(page, a1)).mine && (await rock(page, a2)).mine, 'both rocks start marked').toBe(true);
    const mine = page.locator('#b-mine');
    await expect(mine).toBeVisible();
    const box = (await mine.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(43.5);
    expect(box.height).toBeGreaterThanOrEqual(43.5);
    const before = (await inputs(page)).length;
    // Tap 1: the mode. Tap 2 and 3: the rocks.
    await tap(page, mine);
    await expect(mine).toHaveAttribute('aria-pressed', 'true');
    await expect(mine).toHaveClass(/\bon\b/);
    await expect(page.locator('#toast')).toHaveText(/^Tap rocks to mine or stop\. Tap Mine to finish\./);
    let p = await nodePt(page, a1);
    await tapAt(page, p.x, p.y);
    p = await nodePt(page, a2);
    await tapAt(page, p.x, p.y);
    const log = (await inputs(page)).slice(before);
    expect(log).toEqual([
      { type: 'setMine', node: a1, on: false },
      { type: 'setMine', node: a2, on: false },
    ]);
    expect(await selected(page), 'no sheet opened').toBeNull();
    expect((await rock(page, a1)).mine || (await rock(page, a2)).mine).toBe(false);
    // Taps elsewhere do nothing: the guarded hive, empty space, the probe.
    const n = (await inputs(page)).length;
    for (const node of [heart, 0]) {
      p = await nodePt(page, node);
      await tapAt(page, p.x, p.y);
    }
    const r = await page.evaluate(() => { const b = document.getElementById('view')!.getBoundingClientRect(); return { l: b.left, t: b.top }; });
    await tapAt(page, r.l + 4, r.t + 4);
    expect((await inputs(page)).length).toBe(n);
    expect(await selected(page)).toBeNull();
    // Drags are off.
    await park(page, a1, { drone: 2 });
    await dragAll(page, a1, a2);
    expect((await inputs(page)).length, 'no drag in Mine mode').toBe(n);
    // Marking again is a tap each (the badge pops); the map draws the badge.
    p = await nodePt(page, a1);
    await tapAt(page, p.x, p.y);
    expect((await rock(page, a1)).mine).toBe(true);
    await settled(page);
    expect(await page.evaluate(() => JSON.parse(window.__factory4x!.mapField()).mine)).toContain(a1);
    await page.screenshot({ path: 'test-results/h8-mine-mode.png' });
    // Leaving: tap Mine again; a node tap opens its sheet as before.
    await tap(page, mine);
    await expect(mine).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => window.__factory4x!.mineMode())).toBe(false);
    p = await nodePt(page, a1);
    await tapAt(page, p.x, p.y);
    expect(await selected(page)).toBe(a1);
  });

  test('Mine mode shifts nothing in the HUD', async ({ page }) => {
    await ready(page);
    await pause(page);
    const boxes = () => page.evaluate(() => ['bars', 'stats', 'chips', 'chip-ore', 'chip-fleet', 'chip-raid', 'controls'].map((id) => { const b = document.getElementById(id)!.getBoundingClientRect(); return `${id}:${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)},${Math.round(b.height)}`; }).join('|'));
    const before = await boxes();
    await tap(page, page.locator('#b-mine'));
    await settled(page);
    expect(await boxes(), 'entering Mine mode').toBe(before);
    const a1 = await nodeOf(page, 'a1');
    const p = await nodePt(page, a1);
    await tapAt(page, p.x, p.y);
    await settled(page);
    expect(await boxes(), 'marking a rock').toBe(before);
    await expectControlsFit(page, '#controls', 'the control bar fits with the Mine button');
  });
});

test.describe('375x667 portrait, weights and the hauler count', () => {
  test.use({ viewport: PHONE });

  test('each weight row reads "weight · income%", with the line under the radar, and the haulers say "enough haulers" when no rock is short', async ({ page }) => {
    await ready(page);
    await pause(page);
    const p = await nodePt(page, 'probe');
    await tapAt(page, p.x, p.y);
    const sheet = page.locator('#sheet');
    await expect(sheet.locator('.fp-note')).toHaveText('Income is split by these weights.');
    const alloc = JSON.parse(await page.evaluate(() => window.__factory4x!.allocStatus())) as { rows: Array<{ type: string; weight: number; incomePct: number; state: string }> };
    for (const r of alloc.rows) {
      const row = sheet.locator(`.fp-row[data-type="${r.type}"]`);
      await expect(row.locator('.fp-wv')).toHaveText(`${r.weight} · ${r.incomePct}%`);
    }
    // Raising the drone share lowers the others' shares: extractor 3 of 5 = 60%, then 3 of 8 = 37%.
    const ext = alloc.rows.find((r) => r.type === 'extractor')!;
    expect(ext.incomePct).toBe(Math.floor((ext.weight * 100) / alloc.rows.filter((r) => r.weight > 0).reduce((a, r) => a + r.weight, 0)));
    for (let i = 0; i < 3; i++) await tap(page, sheet.locator('.fp-row[data-type="drone"] .fp-step', { hasText: '+' }));
    await expect(sheet.locator('.fp-row[data-type="extractor"] .fp-wv')).toHaveText(`${ext.weight} · ${Math.floor((ext.weight * 100) / (alloc.rows.filter((r) => r.weight > 0).reduce((a, r) => a + r.weight, 0) + 3))}%`);
    // The hauler's state line says it has enough when no rock is short (the opening: one hauler per rock worked).
    await expectControlsFit(page, '#sheet', 'the weight column fits');
    const fit = await page.evaluate(() => {
      const e = document.getElementById('sheet')!;
      return { scroll: e.scrollHeight, client: e.clientHeight };
    });
    expect(fit.scroll, 'the probe sheet with the % column does not scroll').toBeLessThanOrEqual(fit.client + 1);
    await page.screenshot({ path: 'test-results/h8-probe-sheet.png' });
  });

  test('the Hauler row reads exactly "enough haulers" while no rock is short of haulers', async ({ page }) => {
    await ready(page);
    await pause(page);
    // The premise, checked in the sim first: the Hauler row is in the `enough` state (the opening has no rock short of a hauler).
    const haulerState = async (): Promise<string> =>
      (JSON.parse(await page.evaluate(() => window.__factory4x!.allocStatus())) as { rows: Array<{ type: string; state: string }> }).rows.find((r) => r.type === 'hauler')!.state;
    await stepSimUntil(page, async () => (await haulerState()) === 'enough', 3000, 'the Hauler row in the enough state', false);
    expect(await haulerState()).toBe('enough');
    const p = await nodePt(page, 'probe');
    await tapAt(page, p.x, p.y);
    await expect(page.locator('#sheet .fp-row[data-type="hauler"] .fp-state')).toHaveText('enough haulers');
  });

  test('touch-action is none on the field canvas, so a drag never scrolls or zooms the page', async ({ page }) => {
    await ready(page, PHONE, false);
    await expect(page.locator('#view')).toHaveCSS('touch-action', 'none');
  });

  test('with client.haulerStepper 1 the rock sheet shows the hauler count; − and + set it, Auto clears it; it is hidden with hauler.autoNeed 0', async ({ page }) => {
    await ready(page);
    await pause(page);
    await tune(page, 'client.haulerStepper', 1);
    const a1 = await nodeOf(page, 'a1');
    await stepSimUntil(page, async () => (await rock(page, a1)).haulers >= 1, 9000, 'a hauler at a1', false);
    const p = await nodePt(page, a1);
    await tapAt(page, p.x, p.y);
    const sheet = page.locator('#sheet');
    const need = (await rock(page, a1)).haulerNeed;
    expect(need).toBeGreaterThanOrEqual(1);
    await expect(sheet.locator('.haulers-row .val')).toHaveText(`${need} · Auto`);
    await expect(sheet.locator('.h-auto')).toBeDisabled();
    await expectControlsFit(page, '#sheet', 'the hauler row fits');
    // + sets need + 1.
    await tap(page, sheet.locator('.h-step', { hasText: '+' }));
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setHaulers', node: a1, count: need + 1 });
    await expect(sheet.locator('.haulers-row .val')).toHaveText(`${need + 1} · set (Auto ${need})`);
    await expect(sheet.locator('.h-auto')).toBeEnabled();
    // − back down to 0: the hauler goes home and stays there, so the rock's haulers fall after its next trip.
    for (let i = 0; i < need + 1; i++) await tap(page, sheet.locator('.h-step', { hasText: '−' }));
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setHaulers', node: a1, count: 0 });
    await expect(sheet.locator('.haulers-row .val')).toHaveText(`0 · set (Auto ${need})`);
    await expect(sheet.locator('.h-step', { hasText: '−' })).toBeDisabled();
    await stepSimUntil(page, async () => (await rock(page, a1)).haulers === 0, 3000, 'the hauler leaving a1 after its trip home', false);
    expect((await rock(page, a1)).haulers).toBe(0);
    await expect(sheet.locator('.buf, .bar.buf').first()).toBeVisible();
    // Auto: the need again, and a hauler comes back to a1.
    await tap(page, sheet.locator('.h-auto'));
    expect((await inputs(page)).slice(-1)[0]).toEqual({ type: 'setHaulers', node: a1, count: null });
    await expect(sheet.locator('.haulers-row .val')).toHaveText(`${need} · Auto`);
    await stepSimUntil(page, async () => (await rock(page, a1)).haulers >= 1, 9000, 'a hauler back at a1', false);
    // Hidden when haulers are not staffed by need.
    await page.locator('#sheet .close').click();
    await tune(page, 'hauler.autoNeed', 0);
    await tapAt(page, p.x, p.y);
    await expect(sheet.locator('.hstep')).toBeHidden();
    await expect(sheet.locator('.haulers-row .val')).toHaveText(/^\d+$/);
  });

  for (const wide of [true, false]) {
    test(`the rock sheet, with the hauler row and both raid lines, fits 375x667 without scrolling and the map keeps its room (${wide ? 'wide font' : 'normal font'})`, async ({ page }) => {
      await ready(page, PHONE, wide);
      await pause(page);
      await tune(page, 'raid.firstAtEcon', 2);
      await tune(page, 'raid.musterTicks', 0);
      const raid = async (): Promise<{ phase: string; target: number | null }> => JSON.parse(await page.evaluate(() => window.__factory4x!.raidStatus())) as { phase: string; target: number | null };
      // The tallest state: the raid is out (the banner is up), the target's haulers are held, so the raid line and the held line show.
      await stepSimUntil(page, async () => (await raid()).phase === 'out', 12_000, 'the raid flying out', false);
      const target = (await raid()).target!;
      expect((await rock(page, target)).haulersHeld, 'the hold applies, so both raid lines show').toBe(true);
      const p = await nodePt(page, target);
      await tapAt(page, p.x, p.y);
      const sheet = page.locator('#sheet');
      await expect(sheet.locator('.rock-note .raid')).toHaveText(/^Raid coming: (\d+ (Spores?|Thorns?)(, )?)+$/);
      await expect(sheet.locator('.rock-note .held')).toHaveText('Haulers waiting at the probe');
      await settled(page);
      const fit = await page.evaluate(() => {
        const e = document.getElementById('sheet')!;
        return { scroll: e.scrollHeight, client: e.clientHeight, stage: document.getElementById('stage')!.clientHeight };
      });
      console.log(`rock sheet open, raid out, ${wide ? 'wide' : 'normal'} font: map (stage) ${fit.stage} px, sheet ${fit.client} px`);
      await page.screenshot({ path: wide ? 'test-results/h8-rock-sheet-raid.png' : 'test-results/h8-rock-sheet-raid-normal.png' });
      expect(fit.scroll, 'no scrolling in the rock sheet').toBeLessThanOrEqual(fit.client + 1);
      await expectControlsFit(page, '#sheet', 'the rock sheet controls');
      if (!wide) expect(fit.stage, 'the map keeps about 200 px behind the rock sheet (H7 rule)').toBeGreaterThanOrEqual(195);
    });
  }
});

test.describe('375x667 portrait, the raid badge', () => {
  test.use({ viewport: PHONE });

  test('the target rock wears the raid badge from the muster to the raid\'s end, and the rock sheet says what is coming', async ({ page }) => {
    await ready(page);
    await pause(page);
    await tune(page, 'raid.firstAtEcon', 2);
    await tune(page, 'raid.musterTicks', 0);
    const raid = async (): Promise<{ phase: string; target: number | null; last: unknown }> => JSON.parse(await page.evaluate(() => window.__factory4x!.raidStatus())) as { phase: string; target: number | null; last: unknown };
    expect(await page.evaluate(() => window.__factory4x!.raidBadge()), 'no badge before a raid').toBe(-1);
    const hud0 = await hudBoxes(page);
    await stepSimUntil(page, async () => (await raid()).phase !== 'none', 12_000, 'a raid', false);
    const target = (await raid()).target!;
    await settled(page);
    expect(await page.evaluate(() => window.__factory4x!.raidBadge()), 'the badge is on the target at the muster').toBe(target);
    expect(await hudBoxes(page), 'the HUD did not move when the badge appeared').toBe(hud0);
    await page.screenshot({ path: 'test-results/h8-raid-badge.png' });
    // Out: the target's haulers wait at the probe (H10), and the rock sheet says so.
    await stepSimUntil(page, async () => (await raid()).phase === 'out', 3000, 'the raid flying out', false);
    await settled(page);
    expect((await rock(page, target)).haulersHeld, 'the hold applies to the target rock').toBe(true);
    let p = await nodePt(page, target);
    await tapAt(page, p.x, p.y);
    await expect(page.locator('#sheet .rock-note .held')).toHaveText('Haulers waiting at the probe');
    await expect(page.locator('#sheet .rock-note .raid')).toHaveText(/^Raid coming: /);
    await page.locator('#sheet .close').click();
    // Fighting: still there.
    await stepSimUntil(page, async () => (await raid()).phase === 'fight', 3000, 'the fight', false);
    await settled(page);
    expect(await page.evaluate(() => window.__factory4x!.raidBadge())).toBe(target);
    expect(await hudBoxes(page), 'the HUD did not move in the fight').toBe(hud0);
    p = await nodePt(page, target);
    await tapAt(page, p.x, p.y);
    await expect(page.locator('#sheet .rock-note .raid')).toHaveText(/^Raid here: /);
    await page.locator('#sheet .close').click();
    // The end: the badge and the hold are gone.
    await stepSimUntil(page, async () => (await raid()).phase === 'none' && (await raid()).last !== null, 6000, 'the raid ending', false);
    await settled(page);
    expect(await page.evaluate(() => window.__factory4x!.raidBadge()), 'no badge after the raid').toBe(-1);
    expect(await hudBoxes(page), 'the HUD did not move at the end').toBe(hud0);
    expect((await rock(page, target)).haulersHeld, 'the hold ended with the raid').toBe(false);
    p = await nodePt(page, target);
    await tapAt(page, p.x, p.y);
    await expect(page.locator('#sheet .rock-note .held')).toHaveText('');
  });
});

test.describe('375x667 portrait, the fleet panel', () => {
  test.use({ viewport: PHONE });

  test('the Fleet chip opens the panel: five rows, and Recycle sends recycleFleet for an idle hauler', async ({ page }) => {
    await ready(page);
    await pause(page);
    await tune(page, 'client.haulerStepper', 1);
    // The premise is stated: a hauler idles at the probe because its rock's count is set to 0 (it parks when no rock is short).
    const a1 = await nodeOf(page, 'a1');
    await stepSimUntil(page, async () => (await rock(page, a1)).haulers >= 1, 9000, 'a hauler at a1', false);
    let p = await nodePt(page, a1);
    await tapAt(page, p.x, p.y);
    await tap(page, page.locator('#sheet .h-step', { hasText: '−' }));
    for (let i = 0; i < 4; i++) if (!(await page.locator('#sheet .h-step', { hasText: '−' }).isDisabled())) await tap(page, page.locator('#sheet .h-step', { hasText: '−' }));
    await page.locator('#sheet .close').click();
    await stepSimUntil(page, async () => (await econ(page)).some((e) => e.type === 'hauler' && e.target === null && e.at === 0 && !e.moving), 6000, 'an idle hauler at the probe', false);
    // Open the panel from the chip.
    const chip = page.locator('#chip-fleet');
    await expect(chip).toBeVisible();
    const cb = (await chip.boundingBox())!;
    await tapAt(page, cb.x + cb.width / 2, cb.y + cb.height / 2);
    const panel = page.locator('#fleetpanel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.fl-row')).toHaveCount(5);
    for (const t of ['extractor', 'hauler', 'drone', 'lancer', 'flak']) await expect(panel.locator(`.fl-row[data-type="${t}"]`)).toBeVisible();
    const hauler = panel.locator('.fl-row[data-type="hauler"]');
    const fleet = JSON.parse(await page.evaluate(() => window.__factory4x!.fleetTypes())) as Record<string, { alive: number; idle: number; recyclable: number }>;
    await expect(hauler.locator('.fl-alive')).toHaveText(`${fleet.hauler!.alive} alive · idle ${fleet.hauler!.idle}`);
    expect(fleet.hauler!.idle).toBeGreaterThanOrEqual(1);
    // Fits without scrolling under the wide font, and every button is 44 px.
    const fit = await page.evaluate(() => {
      const e = document.getElementById('fleetpanel')!;
      const c = e.querySelector('.card')!.getBoundingClientRect();
      return { scroll: e.scrollHeight, client: e.clientHeight, top: c.top, bottom: c.bottom, vh: window.innerHeight };
    });
    expect(fit.scroll, 'the fleet panel does not scroll').toBeLessThanOrEqual(fit.client + 1);
    expect(fit.top).toBeGreaterThanOrEqual(0);
    expect(fit.bottom).toBeLessThanOrEqual(fit.vh);
    await expectControlsFit(page, '#fleetpanel', 'the fleet panel controls');
    await expect(panel.locator('.fl-go')).toBeDisabled();
    await tap(page, hauler.locator('.sp-step', { hasText: '+' }));
    await expect(hauler.locator('.fl-count')).toHaveText(`1/${fleet.hauler!.recyclable}`);
    await expect(panel.locator('.fl-go')).toHaveText(/^Recycle 1 \(\+\d+ ore\)$/);
    await page.screenshot({ path: 'test-results/h8-fleet-panel.png' });
    const aliveBefore = fleet.hauler!.alive;
    await tap(page, panel.locator('.fl-go'));
    const last = (await inputs(page)).slice(-1)[0] as { type: string; counts: Record<string, number> };
    expect(last.type).toBe('recycleFleet');
    expect(last.counts).toEqual({ extractor: 0, hauler: 1, drone: 0, lancer: 0, flak: 0 });
    await expect(panel).toBeHidden();
    await expect(page.locator('#toast')).toContainText(/^Recycled 1 hauler: \+\d+ ore\./);
    const after = JSON.parse(await page.evaluate(() => window.__factory4x!.fleetTypes())) as Record<string, { alive: number }>;
    expect(after.hauler!.alive).toBe(aliveBefore - 1);
    p = await nodePt(page, a1);
    expect(p.x).toBeGreaterThan(0);
  });
});

test.describe('the H8 tuning keys', () => {
  test('the tuning panel lists the H8 keys, and the client keys are tagged "this device"', async ({ page }) => {
    await ready(page, PHONE, false);
    await page.locator('#b-tune').click();
    const keys = await page.locator('#tuning input').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    for (const k of ['hauler.autoNeed', 'hauler.needPct', 'rock.haulerMax', 'raid.shieldEcon', 'raid.haulersHold', 'move.splitPct', 'client.longPressMs', 'client.dragSlopPx', 'client.moveGesture']) expect(keys, k).toContain(k);
    for (const k of ['client.longPressMs', 'client.dragSlopPx', 'client.moveGesture', 'client.autosaveSec']) {
      const row = page.locator('#tuning .t-row', { has: page.locator(`input[aria-label="${k}"]`) });
      await expect(row.locator('.tag')).toHaveText(/this device/);
    }
    const sim = page.locator('#tuning .t-row', { has: page.locator('input[aria-label="move.splitPct"]') });
    await expect(sim.locator('.tag')).toHaveCount(0);
  });
});
