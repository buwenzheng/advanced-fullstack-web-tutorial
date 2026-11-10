import { expect, test } from '@playwright/test';

const lessons = [
  { route: '/lesson/s0-l1', title: '从 URL 到响应：请求的四段旅程' },
  { route: '/lesson/s7-l5', title: 'Agent 工作流、工具链与团队落地' },
  { route: '/lesson/a1', title: '复杂度与测量：先能算，再能测' },
];

function collectErrors(page: import('@playwright/test').Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

for (const item of lessons) {
  test(`lesson 正文与检查题渲染：${item.route}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`/index.next.html#${item.route}`);
    await expect(page.locator('main h1')).toHaveText(item.title);
    await expect(page.locator('.lesson-body .lblock').first()).toBeVisible();
    await expect(page.locator('.quiz')).toHaveCount(3);
    await expect(page.locator('.lesson-nav a').first()).toBeVisible();
    expect(errors, item.route).toEqual([]);
  });
}

test('lesson 双轨切换与 MCQ 作答反馈', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/index.next.html#/lesson/s0-l1');

  const panes = page.locator('.code-tracks .codeblock');
  await expect(panes).toHaveCount(2);
  await expect(panes.nth(1)).toHaveAttribute('hidden', '');
  await page.getByRole('tab', { name: 'Python' }).click();
  await expect(page.getByRole('tab', { name: 'Python' })).toHaveAttribute('aria-selected', 'true');
  await expect(panes.nth(1)).not.toHaveAttribute('hidden');

  const quiz = page.locator('.quiz').first();
  await quiz.getByRole('button', { name: /所有用户的 DNS 缓存同时过期/ }).click();
  await quiz.getByRole('button', { name: '提交答案' }).click();
  await expect(quiz.locator('.quiz__feedback')).toHaveClass(/is-wrong/);
  await expect(quiz.locator('.quiz__feedback')).toContainText('答错了');
  await expect(quiz.getByRole('button', { name: '再试一次' })).toBeVisible();
  expect(errors).toEqual([]);
});
