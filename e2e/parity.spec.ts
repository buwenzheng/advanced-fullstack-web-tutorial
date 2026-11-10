import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';

const routes = JSON.parse(readFileSync('e2e/routes.json', 'utf8')) as string[];
const BASE_URL = 'http://127.0.0.1:4173';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function openContext(browser: Browser): Promise<{ context: BrowserContext; page: Page; errors: string[] }> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  return { context, page, errors: collectErrors(page) };
}

async function normalizedMainText(page: Page): Promise<string> {
  return (await page.locator('main').innerText()).replace(/\s+/g, ' ').trim();
}

for (const route of routes) {
  test(`text parity ${route}`, async ({ browser }) => {
    const v2 = await openContext(browser);
    const react = await openContext(browser);
    try {
      await v2.page.goto(`/${route}`);
      await react.page.goto(`/index.next.html${route}`);
      await v2.page.locator('main h1').waitFor();
      await react.page.locator('main h1').waitFor();
      await react.page.waitForLoadState('networkidle');

      expect(await normalizedMainText(react.page)).toBe(await normalizedMainText(v2.page));
      expect(react.errors, 'react console errors').toEqual([]);
      expect(v2.errors, 'v2 console errors').toEqual([]);
    } finally {
      await v2.context.close();
      await react.context.close();
    }
  });
}