import { expect, test } from '@playwright/test';
import { entryUrl } from './lib/entry';

const pages = [
  { route: '#/', slug: 'home' },
  // R2 IDs also rename screenshot slugs; regenerate the affected visual baselines.
  { route: '#/stage/m1', slug: 'stage-m1' },
  { route: '#/lesson/m1-http', slug: 'lesson-m1-http' },
  { route: '#/lesson/m4-coding-team', slug: 'lesson-m4-coding-team' },
  { route: '#/project/x-linkhub', slug: 'project-x-linkhub' },
  { route: '#/lab', slug: 'lab' },
  { route: '#/report', slug: 'report' },
];

const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];

test.describe('v2 visual baseline', () => {
  for (const viewport of viewports) {
    for (const pageDef of pages) {
      test(`@visual ${pageDef.slug} @ ${viewport.name}`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', '视觉基线只在 chromium 项目运行');

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(entryUrl(pageDef.route));
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await expect(page.locator('main h1')).toBeVisible();
        await page.addStyleTag({
          content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
        });
        await page.waitForFunction('document.fonts.status === "loaded"');
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveScreenshot(`${pageDef.slug}-${viewport.name}.png`, {
          fullPage: true,
        });
      });
    }
  }
});
