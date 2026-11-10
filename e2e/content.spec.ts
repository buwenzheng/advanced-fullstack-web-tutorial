import { expect, test } from '@playwright/test';
import { entryUrl } from './lib/entry';
import { entryClosure } from './lib/manifest';

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
    await page.goto(entryUrl(`#${item.route}`));
    await expect(page.locator('main h1')).toHaveText(item.title);
    await expect(page.locator('.lesson-body .lblock').first()).toBeVisible();
    await expect(page.locator('.quiz')).toHaveCount(3);
    await expect(page.locator('.lesson-nav a').first()).toBeVisible();
    expect(errors, item.route).toEqual([]);
  });
}

test('lesson 双轨切换与 MCQ 作答反馈', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(entryUrl('#/lesson/s0-l1'));

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
  await page.goto(entryUrl('#/project/p-graduation'));

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
  await page.goto(entryUrl('#/lab'));

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

function collectJsResponses(page: import('@playwright/test').Page): string[] {
  const files: string[] = [];
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname;
    if (!pathname.endsWith('.js')) return;
    files.push(pathname.split('/').pop() ?? '');
  });
  return files;
}

function outsideClosure(responses: string[], closure: Set<string>): Set<string> {
  const entryNames = new Set([...closure].map((file) => file.split('/').pop() ?? ''));
  return new Set(responses.filter((file) => !entryNames.has(file)));
}

async function settle(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

test('lazy 入口闭包与阶段 chunk 强断言', async ({ page }) => {
  const closure = entryClosure();
  const errors = collectErrors(page);
  const jsResponses = collectJsResponses(page);

  await page.goto(entryUrl('#/'));
  await expect(page.locator('main h1')).toHaveText('把前端的手感，接后端的世界');
  await settle(page);
  expect(outsideClosure(jsResponses, closure), '首页只应请求入口闭包内 JS').toEqual(new Set());

  await page.getByRole('link', { name: '从第一讲开始' }).click();
  await expect(page.locator('main h1')).toHaveText('从 URL 到响应：请求的四段旅程');
  await settle(page);
  const firstOutside = outsideClosure(jsResponses, closure);
  expect(firstOutside.size, '进入课时应出现闭包外 JS').toBeGreaterThanOrEqual(1);

  await page.locator('.lesson-nav a').filter({ hasText: '下一讲' }).click();
  await expect(page.locator('main h1')).toHaveText('Node.js/Python 运行时：事件循环与并发模型');
  await settle(page);
  expect(outsideClosure(jsResponses, closure), '同阶段切换不应新增 chunk').toEqual(firstOutside);

  await page.locator('.stage-node[data-stage="s1"] .stage-node__head').click();
  await page.locator('.lesson-link[data-lesson="s1-l1"]').click();
  await expect(page.locator('main h1')).toHaveText('关系模型与 SQL：从对象到表');
  await settle(page);
  expect(outsideClosure(jsResponses, closure).size, '跨阶段应新增 1 个 chunk').toBe(
    firstOutside.size + 1,
  );
  expect(errors).toEqual([]);
});

test('search 索引在聚焦搜索框后才按需下载并可用', async ({ page }) => {
  const errors = collectErrors(page);
  const indexRequests: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/search-index')) indexRequests.push(response.url());
  });

  await page.goto(entryUrl('#/'));
  await expect(page.locator('main h1')).toHaveText('把前端的手感，接后端的世界');
  await settle(page);
  expect(indexRequests, '首页不应请求 search-index 产物').toEqual([]);

  await page.locator('#search-input').focus();
  await expect.poll(() => indexRequests.length, '聚焦后应请求 search-index').toBeGreaterThan(0);
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
  await page.goto(entryUrl('#/report'));

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
