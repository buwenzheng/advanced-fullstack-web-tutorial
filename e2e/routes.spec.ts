import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const routes = JSON.parse(readFileSync('e2e/routes.json', 'utf8')) as string[];
const ENTRY = '/index.next.html';

test.describe('React 66 路由质量门禁', () => {
  test.setTimeout(240_000);

  for (const route of routes) {
    test(`@routes ${route}`, async ({ page }) => {
      const issues: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') issues.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));

      const response = await page.goto(`${ENTRY}${route}`);
      expect(response?.ok(), `${route} 文档响应`).toBe(true);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('main h1')).toHaveCount(1);

      const text = (await page.locator('main').innerText()).trim();
      expect(text.length, `${route} 正文不能为空`).toBeGreaterThan(20);
      expect(issues, route).toEqual([]);
    });
  }
});