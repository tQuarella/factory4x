import { expect, type Page } from '@playwright/test';

/** Two animation frames: a notice that just appeared has resized the canvas and the map has re-fitted. */
export async function settled(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
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
