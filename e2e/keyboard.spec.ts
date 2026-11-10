import { expect, test } from '@playwright/test';

const ENTRY = '/index.next.html';

test.describe('键盘路径门禁', () => {
  test('skip link 首个 Tab 可达，Enter 聚焦 #main 且不改变 hash', async ({ page }) => {
    await page.goto(`${ENTRY}#/`);
    await expect(page.locator('main h1')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
    expect(new URL(page.url()).hash).not.toBe('#main');
  });

  test('路由切换后 #main 获焦且滚动复位', async ({ page }) => {
    await page.goto(`${ENTRY}#/`);
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.locator('.stage-node[data-stage="s0"] .stage-node__head').click();
    await page.locator('.lesson-link[data-lesson="s0-l1"]').click();
    await expect(page).toHaveURL(/#\/lesson\/s0-l1$/);
    await expect(page.locator('#main')).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('搜索键盘路径：展开、ArrowDown、Enter 跳转', async ({ page }) => {
    await page.goto(`${ENTRY}#/`);
    const search = page.locator('#search-input');
    await search.focus();
    await page.keyboard.type('LinkHub 短链服务');
    await expect(page.locator('.search-hit')).toHaveCount(1);
    await expect(search).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.search-hit.is-active')).toHaveCount(1);

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/project\/p-graduation$/);
    await expect(search).toHaveValue('');
    await expect(page.locator('.search-hit')).toHaveCount(0);
  });

  test('搜索 Escape 关闭结果且焦点留在输入框', async ({ page }) => {
    await page.goto(`${ENTRY}#/`);
    const search = page.locator('#search-input');
    await search.focus();
    await page.keyboard.type('LinkHub');
    await expect(page.locator('.search-hit').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#search-results')).toBeHidden();
    await expect(search).toHaveAttribute('aria-expanded', 'false');
    await expect(search).toBeFocused();
  });

  test('侧栏阶段折叠可用 Enter 操作，课时列表显隐一致', async ({ page }) => {
    await page.goto(`${ENTRY}#/`);
    const head = page.locator('.stage-node[data-stage="s0"] .stage-node__head');
    const lessons = page.locator('.stage-node[data-stage="s0"] .stage-node__lessons');
    await head.focus();
    await expect(head).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(head).toHaveAttribute('aria-expanded', 'true');
    await expect(lessons).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(head).toHaveAttribute('aria-expanded', 'false');
    await expect(lessons).toBeHidden();
  });

  test('选择题可用 Enter 与 Space 作答', async ({ page }) => {
    await page.goto(`${ENTRY}#/lesson/s0-l1`);
    const options = page.locator('.quiz').first().locator('.opt');
    const first = options.nth(0);
    const second = options.nth(1);

    await first.focus();
    await page.keyboard.press('Enter');
    await expect(first).toHaveClass(/is-picked/);

    await second.focus();
    await page.keyboard.press('Space');
    await expect(second).toHaveClass(/is-picked/);
    await expect(first).not.toHaveClass(/is-picked/);
  });
});

test.describe('抽屉键盘可达性', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Tab 到菜单按钮后 Enter 打开抽屉', async ({ page }) => {
    await page.goto(`${ENTRY}#/`);
    await expect(page.locator('main h1')).toBeVisible();
    const toggle = page.locator('#menu-toggle');
    for (let index = 0; index < 5; index += 1) {
      await page.keyboard.press('Tab');
      if (await toggle.evaluate((element) => element === document.activeElement)) break;
    }
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#sidebar')).toHaveClass(/is-open/);
    await expect(page.locator('#scrim')).toBeVisible();
  });
});