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
  const pythonTab = page.getByRole('tablist', { name: '语言实现' }).getByRole('tab', { name: 'Python' });
  await pythonTab.click();
  await expect(pythonTab).toHaveAttribute('aria-selected', 'true');
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

function isStageChunk(name: string): boolean {
  return /\/assets\/(?:s[0-7]|appendix)-[^/]+\.js$/.test(name);
}

async function resourceNames(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
}

test('lazy 阶段内容按阶段加载，跨阶段才新增 chunk', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/index.next.html#/');
  await expect(page.locator('main h1')).toHaveText('把前端的手感，接后端的世界');
  expect((await resourceNames(page)).filter(isStageChunk)).toEqual([]);

  await page.getByRole('link', { name: '从第一讲开始' }).click();
  await expect(page.locator('main h1')).toHaveText('从 URL 到响应：请求的四段旅程');
  await expect.poll(async () => (await resourceNames(page)).filter(isStageChunk)).toHaveLength(1);

  const sameStage = (await resourceNames(page)).filter(isStageChunk);
  await page.locator('.lesson-nav a').filter({ hasText: '下一讲' }).click();
  await expect(page.locator('main h1')).toHaveText('Node.js/Python 运行时：事件循环与并发模型');
  expect((await resourceNames(page)).filter(isStageChunk)).toEqual(sameStage);

  await page.locator('.stage-node[data-stage="s1"] .stage-node__head').click();
  await page.locator('.lesson-link[data-lesson="s1-l1"]').click();
  await expect(page.locator('main h1')).toHaveText('关系模型与 SQL：从对象到表');
  await expect.poll(async () => (await resourceNames(page)).filter(isStageChunk).length).toBe(sameStage.length + 1);
  expect(errors).toEqual([]);
});

test('search 索引在聚焦搜索框后才按需下载并可用', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/index.next.html#/');
  await expect(page.locator('main h1')).toHaveText('把前端的手感，接后端的世界');
  const isIndexChunk = (name: string) => name.includes('/search-index-');
  expect((await resourceNames(page)).filter(isIndexChunk)).toEqual([]);

  await page.locator('#search-input').focus();
  await expect.poll(async () => page.evaluate(() => {
    const found = performance.getEntriesByType('resource')
      .find((item) => item.name.includes('/search-index-')) as
      { decodedBodySize?: number; encodedBodySize?: number } | undefined;
    return found ? found.decodedBodySize || found.encodedBodySize || 0 : 0;
  })).toBeGreaterThan(300_000);

  await page.locator('#search-input').fill('LinkHub');
  await expect(page.getByRole('option').first()).toBeVisible();
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
