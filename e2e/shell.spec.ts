import { expect, test } from '@playwright/test';
import { entryUrl } from './lib/entry';

test.describe('React shell', () => {
  test('侧栏、搜索与语言轨道', async ({ page }) => {
    await page.goto(entryUrl('#/lesson/m1-http'));
    await expect(page.locator('.stage-node')).toHaveCount(6);
    await expect(page.locator('.lesson-link')).toHaveCount(45);
    await expect(page.locator('.lesson-link.is-current')).toContainText('从 URL 到响应');

    const search = page.locator('#search-input');
    await search.fill('LinkHub 短链服务');
    await expect(page.locator('.search-hit')).toHaveCount(1);
    await search.press('ArrowDown');
    await search.press('Enter');
    await expect(page).toHaveURL(/#\/project\/x-linkhub$/);
    await expect(search).toHaveValue('');

    await page.getByRole('button', { name: 'Python' }).click();
    await expect(page.getByRole('button', { name: 'Python' })).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Python' })).toHaveAttribute('aria-pressed', 'true');
  });
});

test('旧课时 ID 重定向到 R2 ID', async ({ page }) => {
  await page.goto(entryUrl('#/lesson/s0-l1'));
  await expect(page).toHaveURL(/#\/lesson\/m1-http$/);
  await expect(page.locator('main h1')).toHaveText('从 URL 到响应：请求的四段旅程');
});

test.describe('移动端抽屉', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('菜单打开、scrim 关闭', async ({ page }) => {
    await page.goto(entryUrl('#/'));
    await page.getByRole('button', { name: '打开课程目录' }).click();
    await expect(page.locator('#sidebar')).toHaveClass(/is-open/);
    await expect(page.locator('#scrim')).toBeVisible();
    await page.locator('#scrim').click({ position: { x: 380, y: 400 } });
    await expect(page.locator('#sidebar')).not.toHaveClass(/is-open/);
  });
});
