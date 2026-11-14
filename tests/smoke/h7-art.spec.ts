import { expect, test } from '@playwright/test';

/**
 * H7 art, the gallery's pixel scan (acceptance 6): the extractor and hauler are told apart, at 24 px, from the three warships and a
 * rock (their alpha masks overlap by well under three quarters, and each covers enough pixels to be seen), and every new draw stays
 * within its bounds as measured on a real canvas.
 */

interface Sil {
  fill: Record<string, number>;
  iou: Record<string, number>;
}

test('the extractor and hauler read at 24 px against the warships and a rock; new draws stay within their bounds', async ({ page }) => {
  // The gallery draws a few hundred scans on load; on a phone-sized device pixel ratio under a loaded machine that takes a while.
  test.setTimeout(120_000);
  await page.goto('/gallery.html');
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { __silhouettes?: unknown }).__silhouettes)), { timeout: 100_000 }).toBe(true);
  const sil = (await page.evaluate(() => (window as unknown as { __silhouettes: Sil }).__silhouettes));
  for (const hull of ['extractor', 'hauler']) {
    expect(sil.fill[hull], `${hull} covers enough of its 24 px cell to be seen`).toBeGreaterThan(80);
    for (const other of ['extractor', 'hauler', 'drone', 'lancer', 'flak', 'rock']) {
      if (other === hull) continue;
      const key = `${hull}|${other}`;
      expect(sil.iou[key], `${hull} against ${other} at 24 px`).toBeLessThan(0.75);
    }
  }
  const bounds = await page.locator('#bounds').textContent();
  for (const name of ['extractor', 'hauler', 'raid marker', 'mine badge']) {
    const m = new RegExp(`^${name}: ([0-9.]+) r$`, 'm').exec(bounds ?? '');
    expect(m, `${name} is measured in the gallery`).not.toBeNull();
    expect(Number(m![1]), `${name} stays within r (1.002 r allows for antialiasing)`).toBeLessThanOrEqual(1.002);
  }
  const raided = /^raided rock \(rim and glow, no pips\): ([0-9.]+) r/m.exec(bounds ?? '');
  expect(raided).not.toBeNull();
  expect(Number(raided![1])).toBeLessThanOrEqual(1.102);
});
