import { expect, test } from '@playwright/test';
import { entryUrl } from './lib/entry';

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
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
];

for (const route of PAGES) {
  for (const viewport of WIDTHS) {
    test(`@responsive ${viewport.width} ${route}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(entryUrl(route));
      await expect(page.locator('main h1')).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route} 横向溢出`).toBeLessThanOrEqual(1);

      const menuVisible = await page.locator('#menu-toggle').isVisible();
      const sidebarBox = await page.locator('#sidebar').boundingBox();
      if (viewport.width <= 860) {
        expect(menuVisible, '窄屏必须显示菜单按钮').toBe(true);
        expect(sidebarBox?.x ?? 0, '窄屏侧栏应收起').toBeLessThan(0);
      } else {
        expect(menuVisible, '宽屏必须隐藏菜单按钮').toBe(false);
        expect(sidebarBox?.x ?? 0, '宽屏侧栏应可见').toBeGreaterThanOrEqual(0);
      }
    });
  }
}

test.describe('移动端抽屉专项', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('菜单按钮打开抽屉，scrim 可见且 aria-expanded 同步', async ({ page }) => {
    await page.goto(entryUrl('#/'));
    await page.locator('#menu-toggle').click();
    await expect(page.locator('#sidebar')).toHaveClass(/is-open/);
    await expect(page.locator('#scrim')).toBeVisible();
    await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded', 'true');
  });

  test('点击 scrim 关闭抽屉并复位 aria-expanded', async ({ page }) => {
    await page.goto(entryUrl('#/'));
    const toggle = page.locator('#menu-toggle');
    await toggle.click();
    await page.locator('#scrim').click({ position: { x: 380, y: 400 } });
    await expect(page.locator('#sidebar')).not.toHaveClass(/is-open/);
    await expect(page.locator('#scrim')).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('从抽屉进入课时后自动关闭', async ({ page }) => {
    await page.goto(entryUrl('#/lesson/s0-l1'));
    await page.locator('#menu-toggle').click();
    await expect(page.locator('#sidebar')).toHaveClass(/is-open/);
    await page.locator('.lesson-link[data-lesson="s0-l2"]').click();
    await expect(page).toHaveURL(/#\/lesson\/s0-l2$/);
    await expect(page.locator('#sidebar')).not.toHaveClass(/is-open/);
    await expect(page.locator('#scrim')).toBeHidden();
  });

  test('代码块与表格在自身容器内滚动，文档无横向溢出', async ({ page }) => {
    await page.goto(entryUrl('#/lesson/s0-l1'));
    await expect(page.locator('main h1')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, '文档横向溢出').toBeLessThanOrEqual(1);

    for (const selector of ['.codeblock pre', '.tbl-wrap']) {
      const targets = page.locator(selector);
      const count = await targets.count();
      expect(count, `${selector} 应存在`).toBeGreaterThan(0);
      const metrics = await targets.evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element);
          const before = element.scrollLeft;
          element.scrollLeft = 120;
          const after = element.scrollLeft;
          element.scrollLeft = before;
          return {
            overflowX: style.overflowX,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            scrolled: after,
          };
        }),
      );
      for (const [index, item] of metrics.entries()) {
        expect(['auto', 'scroll'], `${selector}[${index}] overflow-x`).toContain(item.overflowX);
        if (item.scrollWidth > item.clientWidth) {
          expect(item.scrolled, `${selector}[${index}] 应可滚动`).toBeGreaterThan(0);
        }
      }
    }
    const codeOverflow = await page
      .locator('.codeblock pre')
      .first()
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(codeOverflow, '代码块内容应溢出并可滚动').toBe(true);

    const docOverflowAfter = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(docOverflowAfter, '容器滚动后文档仍无横向溢出').toBeLessThanOrEqual(1);
  });
});