import { expect, type Page } from '@playwright/test';

/** Two animation frames: a notice that just appeared has resized the canvas and the map has re-fitted. */
export async function settled(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

/**
 * Waits in game time, not wall time: steps the sim 30 ticks at a time (the advanceTicks hook, which pauses) until `cond` holds, so a
 * wait costs no real seconds. If the game was running when called, play is resumed afterwards (at the same speed), so the test goes
 * on as the wait it replaces would have left it (`resume` false leaves it paused, for waits that end on a panel covering the controls). Fails if `cap` ticks pass first. The assertion the test already makes after the
 * wait stays in place and runs against the live page.
 */
export async function stepSimUntil(page: Page, cond: () => Promise<boolean>, cap: number, what: string, resume = true): Promise<void> {
  const wasPaused = await page.evaluate(() => window.__factory4x!.paused());
  for (let t = 0; !(await cond()); t += 30) {
    if (t > cap) throw new Error(`${what} was not reached in ${cap} ticks`);
    await page.evaluate(() => window.__factory4x!.advanceTicks(30));
  }
  if (resume && !wasPaused && (await page.evaluate(() => window.__factory4x!.paused()))) {
    await page.locator('#b-pause').click();
    expect(await page.evaluate(() => window.__factory4x!.paused()), 'play resumed after stepping').toBe(false);
  }
}

/**
 * Taps an area on the overworld, once. The map is a pan, so the area is first centred in the part of the map no sheet covers (what a
 * drag does, in one step). The tap then waits until the area has stopped moving and the point under it is the canvas itself, not a
 * notice or the hint a layout shift has put there (the old boot.spec tap landed on #hint-text 2 runs in 5). The click is made once:
 * if the area's sheet isn't open after it, the test fails (a swallowed tap is a bug, not something to try again).
 */
export async function tapArea(page: Page, area: number): Promise<void> {
  let last = { x: -1, y: -1 };
  let at = { x: 0, y: 0 };
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
        at = last;
        return still && q.onCanvas;
      },
      { message: `area ${area} stopped moving with the canvas under it`, timeout: 15_000 },
    )
    .toBe(true);
  await page.mouse.click(at.x, at.y);
  expect(await page.evaluate(() => window.__factory4x!.selectedArea()), `the tap on area ${area} opened its sheet`).toBe(area);
}

/** Every visible control inside `root` is at least 44 px and nothing sticks out sideways. */
export async function expectControlsFit(page: Page, root: string, label: string): Promise<void> {
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
