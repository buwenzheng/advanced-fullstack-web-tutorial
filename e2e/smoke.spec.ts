import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const routes = JSON.parse(readFileSync('e2e/routes.json', 'utf8')) as string[];

test.describe('v2 route smoke', () => {
  for (const route of routes) {
    test(`${route}`, async ({ page }) => {
      const issues: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') issues.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));

      await page.goto(`/${route}`);
      await expect(page.locator('main h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(issues, route).toEqual([]);
    });
  }
});
