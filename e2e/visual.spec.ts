import { expect, test } from '@playwright/test';

const ENTRY = process.env.VISUAL_ENTRY || '';

const pages = [
  { route: '#/', slug: 'home' },
  { route: '#/stage/s0', slug: 'stage-s0' },
  { route: '#/lesson/s0-l1', slug: 'lesson-s0-l1' },
  { route: '#/lesson/s7-l5', slug: 'lesson-s7-l5' },
  { route: '#/project/p-graduation', slug: 'project-p-graduation' },
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
        await page.goto(`${ENTRY ? `/${ENTRY}` : '/'}${pageDef.route}`);
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
