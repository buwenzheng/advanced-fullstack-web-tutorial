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

test('project 页渲染毕业项目里程碑与模板，勾选后进度更新', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/index.next.html#/project/p-graduation');

  await expect(page.locator('main h1')).toHaveText('LinkHub 短链服务');
  await expect(page.locator('.project-hero .eyebrow')).toHaveText('毕业项目');
  await expect(page.locator('.milestone')).toHaveCount(11);
  await expect(page.locator('.milestone__note')).toHaveCount(11);
  await expect(page.locator('.template-card')).toHaveCount(6);

  const first = page.locator('.milestone').first();
  await first.locator('.milestone__box').click();
  await expect(first).toHaveClass(/is-done/);
  await expect(page.locator('.project-hero .badge--amber')).toContainText('1/11');
  await page.reload();
  await expect(page.locator('.milestone').first()).toHaveClass(/is-done/);
  expect(errors).toEqual([]);
});

test('lab 实验台 10 个场景、429 限流与幂等重放', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/index.next.html#/lab');

  await expect(page.locator('main h1')).toHaveText('HTTP 实验室');
  await expect(page.locator('.lab-layout > .list-stack').first().locator('button')).toHaveCount(10);

  await page.getByRole('button', { name: '触发限流（429）' }).click();
  for (let index = 0; index < 3; index += 1) {
    const send = page.getByRole('button', { name: '发送请求' });
    await send.click();
    await expect(send).toBeEnabled();
  }
  await expect(page.locator('.badge', { hasText: '429 Too Many Requests' })).toBeVisible();
  await expect(page.locator('.console-out')).toContainText('rate_limited');
  const retryRow = page.locator('.tbl-wrap tr').filter({ hasText: 'retry-after' });
  await expect(retryRow).toContainText('3');

  await page.getByRole('button', { name: '幂等键（重复提交）' }).click();
  for (let index = 0; index < 2; index += 1) {
    const send = page.getByRole('button', { name: '发送请求' });
    await send.click();
    await expect(send).toBeEnabled();
  }
  await expect(page.locator('.badge--violet')).toHaveText('幂等重放');
  const replayRow = page.locator('.tbl-wrap tr').filter({ hasText: 'idempotency-replayed' });
  await expect(replayRow).toContainText('true');
  expect(errors).toEqual([]);
});

test('report 报告页展示统计与错题列表', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem('bff-lab-progress-v1', JSON.stringify({
      q: { 's2-l1-check-3': { picked: [2], correct: false, attempts: 1, solved: false } },
      l: {},
      p: {},
      meta: { version: 2, startedAt: 0 },
    }));
  });
  await page.goto('/index.next.html#/report');

  await expect(page.locator('main h1')).toHaveText('学习报告');
  await expect(page.locator('.stat')).toHaveCount(5);
  await expect(page.locator('.stat').nth(1)).toContainText('1');
  await expect(page.locator('.stat').nth(4)).toContainText('1');
  await expect(page.locator('.bar-row')).toHaveCount(11);
  const wrongRow = page.locator('.list-stack .lesson-row');
  await expect(wrongRow).toHaveCount(1);
  await expect(wrongRow.first()).toContainText('破坏性变更');
  await expect(wrongRow.first()).toContainText('已尝试 1 次');
  expect(errors).toEqual([]);
});
