import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = [
  '#/',
  '#/stage/s0',
  '#/lesson/s0-l1',
  '#/lesson/s7-l5',
  '#/project/p-graduation',
  '#/lab',
  '#/report',
];
const WIDTHS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const ENTRY = '/index.next.html';

for (const route of PAGES) {
  for (const viewport of WIDTHS) {
    test(`@a11y ${viewport.width} ${route}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`${ENTRY}${route}`);
      await expect(page.locator('main h1')).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const blocking = results.violations.filter(
        (item) => item.impact === 'serious' || item.impact === 'critical',
      );
      const summary = blocking.map((item) => ({
        id: item.id,
        impact: item.impact,
        nodes: item.nodes.map((node) => node.target.join(' ')).slice(0, 5),
      }));
      expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
    });
  }
}