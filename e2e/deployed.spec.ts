import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const BASE = (process.env.DEPLOYED_URL || '').replace(/\/+$/, '');
const STORAGE = process.env.DEPLOYED_STORAGE_STATE;
const routes = JSON.parse(readFileSync('e2e/routes.json', 'utf8')) as string[];

test.use(STORAGE ? { storageState: STORAGE } : {});

test.describe('deployed v3 smoke', () => {
  test.skip(!BASE, 'DEPLOYED_URL 未设置');
  test.beforeEach(() => {
    test.setTimeout(60_000);
  });

  for (const route of routes) {
    test(`@deployed ${route}`, async ({ page }) => {
      const issues: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') issues.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
      page.on('response', (response) => {
        if (response.status() >= 400) issues.push(`http ${response.status()}: ${response.url()}`);
      });

      const response = await page.goto(`${BASE}${route}`);
      expect(response?.ok(), `${route} 文档响应`).toBe(true);
      await expect(page.locator('main h1')).toHaveCount(1);
      await page.waitForLoadState('networkidle');

      const text = (await page.locator('main').innerText()).trim();
      expect(text.length, `${route} 正文不能为空`).toBeGreaterThan(20);
      expect(issues, route).toEqual([]);
    });
  }

  test('@deployed health', async ({ page }) => {
    const response = await page.request.get(`${BASE}/functions/v1/app/health`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { ok?: boolean; service?: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe('backend-lab');
  });
});
